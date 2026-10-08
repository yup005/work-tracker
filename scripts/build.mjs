import {readFile,writeFile,mkdir,rm,copyFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai/drizzle',{recursive:true});
const assets={};for(const [file,type] of [['index.html','text/html; charset=utf-8'],['app.js','application/javascript; charset=utf-8'],['styles.css','text/css; charset=utf-8'],['favicon.svg','image/svg+xml']])assets['/'+file]={body:await readFile('public/'+file,'utf8'),type};
const api=await readFile('server.mjs','utf8');
const index=api.slice(0,api.indexOf('export default '))+`\nconst assets=${JSON.stringify(assets)};\nexport default {async fetch(request,env){ const p=new URL(request.url).pathname; if(p.startsWith('/api/'))return handle(request,{...env,DEV_AUTH:undefined});const asset=assets[p==='/'?'/index.html':p];return asset?new Response(asset.body,{headers:{'content-type':asset.type,'x-content-type-options':'nosniff','cache-control':'no-store'}}):new Response('Not found',{status:404});}};`;
await writeFile('dist/server/index.js',index);await copyFile('.openai/hosting.json','dist/.openai/hosting.json');await copyFile('schema.sql','dist/.openai/drizzle/0000_work_tracker.sql');
console.log('Built Worker with embedded assets and D1 schema migration');

await copyFile("migrations/0001_password_auth.sql","dist/.openai/drizzle/0001_password_auth.sql");

await copyFile('migrations/0002_releases.sql','dist/.openai/drizzle/0002_releases.sql');

await copyFile('migrations/0003_release_auto_roles.sql','dist/.openai/drizzle/0003_release_auto_roles.sql');

await copyFile('migrations/0004_work_structure.sql','dist/.openai/drizzle/0004_work_structure.sql');
