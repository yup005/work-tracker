/** Local test-only server. Production relies on trusted Sites identity headers. */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { handle } from './server.mjs';
const base=import.meta.dirname,dbPath=resolve(base,'work-tracker-local.sqlite');
const db=new DatabaseSync(dbPath);db.exec(await readFile(resolve(base,'schema.sql'),'utf8'));
// Local-only migration for previously created preview databases whose user role CHECK predated Admin.
const oldUsersSql=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()?.sql||'';
if(oldUsersSql.includes("('boss','qa','engineer')")) {
 const migratedSql=oldUsersSql.replace(/CREATE TABLE(?: IF NOT EXISTS)? users/i,'CREATE TABLE users_migrated').replace("('boss','qa','engineer')","('boss','admin','qa','engineer')");
 db.exec(`BEGIN; ${migratedSql}; INSERT INTO users_migrated SELECT * FROM users; DROP TABLE users; ALTER TABLE users_migrated RENAME TO users; COMMIT;`);
}

if(!db.prepare('PRAGMA table_info(tasks)').all().some(c=>c.name==='sort_order')) db.exec('ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 1000');
db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const name of ['0001_password_auth.sql','0002_releases.sql','0003_release_auto_roles.sql','0004_work_structure.sql']){
 if(!db.prepare('SELECT name FROM local_migrations WHERE name=?').get(name)){
  db.exec(await readFile(resolve(base,'migrations',name),'utf8'));
  db.prepare('INSERT INTO local_migrations(name) VALUES(?)').run(name);
 }
}
const wrapper={prepare(sql){return {bind(...args){return {first:async()=>db.prepare(sql).get(...args)??null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>db.prepare(sql).run(...args)};}}}};
for(const [email,name,role] of [['boss@demo.local','Manager','member'],['zoey@demo.local','Zoey','admin'],['sean@demo.local','Sean','member']])db.prepare('INSERT OR IGNORE INTO users(email,display_name,role) VALUES(?,?,?)').run(email,name,role);
db.exec("UPDATE users SET is_boss=1,groups_json='[\"Management\"]' WHERE email='boss@demo.local'; UPDATE users SET groups_json='[\"QA\"]' WHERE email='zoey@demo.local'; UPDATE users SET groups_json='[\"Engineering\"]' WHERE email='sean@demo.local';");
const storage=resolve(base,'.local-files');await mkdir(storage,{recursive:true});
const BUCKET={async put(key,data){await writeFile(resolve(storage,key.replace(/\//g,'_')),Buffer.from(data));},async get(key){const f=resolve(storage,key.replace(/\//g,'_'));if(!existsSync(f))return null;return {body:await readFile(f)};}};
// These are fixtures for local preview, not real accounts.
for(const [email,role] of [['boss@demo.local','member'],['zoey@demo.local','admin'],['sean@demo.local','member']]) db.prepare('UPDATE users SET role=? WHERE email=?').run(role,email);
const env={DB:wrapper,BUCKET,DEV_AUTH:'1',ADMIN_EMAIL:'zoey@demo.local'};
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const port=Number(process.env.PORT||4173);
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,`http://127.0.0.1:${port}`);let response;
  if(url.pathname.startsWith('/api/')){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const method=req.method||'GET';const data=Buffer.concat(chunks);
    const request=new Request(url,{method,headers:req.headers,body:['GET','HEAD'].includes(method)?undefined:data,duplex:'half'});
    response=await handle(request,env);
  }else{
    const file=url.pathname==='/'?'index.html':url.pathname.replace(/^\/+/, '');
    if(file.includes('..')||!['index.html','styles.css','app.js','favicon.svg'].includes(file)){res.writeHead(404);res.end('Not found');return;}
    const f=resolve(base,'public',file), body=await readFile(f);
    res.writeHead(200,{'content-type':types[extname(file)]||'text/plain','cache-control':'no-store'});res.end(body);return;
  }
  const buf=Buffer.from(await response.arrayBuffer());res.writeHead(response.status,Object.fromEntries(response.headers));res.end(buf);
 }catch(e){res.writeHead(500);res.end('Server error: '+e.message);}
}).listen(port,'127.0.0.1',()=>console.log('Work Tracker local preview: http://127.0.0.1:'+port));
