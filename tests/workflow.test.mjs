import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handle} from '../server.mjs';

function context(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0001_password_auth.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0002_releases.sql',import.meta.url),'utf8'));
 const DB={prepare(query){return {bind(...args){return {first:async()=>db.prepare(query).get(...args)??null,all:async()=>({results:db.prepare(query).all(...args)}),run:async()=>db.prepare(query).run(...args)};}}}};
 for(const [email,name,role] of [['boss@demo.local','Boss','viewer'],['zoey@demo.local','Zoey','admin'],['sean@demo.local','Sean','member']])db.prepare('INSERT INTO users(email,display_name,role) VALUES(?,?,?)').run(email,name,role);
 db.exec("UPDATE users SET is_boss=1,groups_json='[\"Management\"]' WHERE email='boss@demo.local'; UPDATE users SET groups_json='[\"QA\"]' WHERE email='zoey@demo.local'; UPDATE users SET groups_json='[\"Engineering\"]' WHERE email='sean@demo.local';");
db.exec(readFileSync(new URL('../migrations/0003_release_auto_roles.sql',import.meta.url),'utf8'));
db.exec(readFileSync(new URL('../migrations/0004_work_structure.sql',import.meta.url),'utf8'));
const objects=new Map();const BUCKET={put:async(k,d)=>{objects.set(k,d)},get:async(k)=>objects.has(k)?{body:objects.get(k)}:null};
 const env={DB,BUCKET,DEV_AUTH:'1',ADMIN_EMAIL:'zoey@demo.local'};
 async function request(path,{who='zoey@demo.local',method='GET',body}={}){
 const headers={'x-dev-user':who};if(body!==undefined && !(body instanceof FormData))headers['content-type']='application/json';
 const r=await handle(new Request('http://127.0.0.1:4173/api'+path,{method,headers,body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)}),env);
 const data=r.headers.get('content-type')?.includes('application/json')?await r.json():await r.text();return {status:r.status,data};
 }
 return {db,env,request};
}

test('Engineering and QA workflow, append-only history, daily work, and secure office separation',async()=>{
 const {db,request}=context();
 const created=await request('/tasks',{method:'POST',body:{title:'CPA calculation QA','type':'Bug Fix',priority:'High',project:'Financial',description:'Test net earned according to agreed rules',activity_date:'2026-10-08'}});
 assert.equal(created.status,201);const id=created.data.id;
 assert.equal((await request('/tasks/'+id,{who:'sean@demo.local',method:'PATCH',body:{qa_status:'Passed'}})).status,403);
 assert.equal((await request('/tasks/'+id,{who:'boss@demo.local',method:'PATCH',body:{development_status:'On Stage'}})).status,403);
 assert.equal((await request('/tasks/'+id,{who:'sean@demo.local',method:'PATCH',body:{development_status:'On Stage',activity_date:'2026-10-07'}})).status,200);
 const qa=await request('/tasks/'+id+'/activity',{method:'POST',body:{action_type:'QA Testing',activity_date:'2026-10-08',environment:'Stage',result:'No Visible Changes',notes:'The stage screen looks the same after merge'}});
 assert.equal(qa.status,201);
 const comments=await request('/tasks/'+id+'/comments',{method:'POST',who:'sean@demo.local',body:{body:'Patch has been merged, please hard-refresh'}});
 assert.equal(comments.status,201);
 const details=(await request('/tasks/'+id)).data;
 assert.equal(details.task.qa_status,'No Visible Changes','QA test itself synchronizes the QA status');
 assert.equal(details.activities.length,3,'Requirement, Development and QA test; a comment is not counted as work');
 assert.equal(details.comments.length,1);
 const list=(await request('/tasks')).data.tasks[0];
 assert.equal(list.last_engineer_action,'2026-10-07');assert.equal(list.last_qa_action,'2026-10-08');
 assert.throws(()=>db.prepare('UPDATE activities SET notes=?').run('tampered'),/Activities are immutable/);
 assert.throws(()=>db.prepare('DELETE FROM comments').run(),/Comments are immutable/);
 const createdOffice=await request('/office',{method:'POST',body:{work_date:'2026-10-08',title:'Order supplies',details:'Review order quantity',category:'Purchasing',status:'Completed'}});
 assert.equal(createdOffice.status,201);
 assert.equal((await request('/office',{who:'sean@demo.local'})).data.logs.length,0);
 assert.equal((await request('/office',{who:'boss@demo.local'})).data.logs.length,1);
 assert.equal((await request('/office/'+createdOffice.data.id,{who:'sean@demo.local'})).status,404);
 assert.equal((await request('/office/'+createdOffice.data.id,{who:'zoey@demo.local',method:'PATCH',body:{details:'Review order quantity x3'}})).status,200);
 assert.equal((await request('/office/'+createdOffice.data.id)).data.revisions.length,2);
 assert.equal((await request('/daily?date=2026-10-08',{who:'boss@demo.local'})).data.office.length,1);
 assert.equal((await request('/daily?date=2026-10-08',{who:'sean@demo.local'})).data.office.length,0);
 assert.equal((await request('/daily?date=2026-10-08&email=zoey@demo.local',{who:'sean@demo.local'})).status,403);
 assert.equal((await request('/export',{who:'sean@demo.local'})).status,403);
 assert.equal((await request('/export',{who:'boss@demo.local'})).status,403);
 const exportData=await request('/export',{who:'zoey@demo.local'});
 assert.equal(exportData.status,200);assert.equal(exportData.data.tables.office_revisions.length,2);
 db.close();
});

test('Untrusted local preview header cannot authenticate a deployed Sites URL',async()=>{
 const {db,env}=context();
 const req=new Request('https://flowmd.example.com/api/me',{headers:{'x-dev-user':'boss@demo.local'}});
 const resp=await handle(req,env);assert.equal(resp.status,401);
 const req2=new Request('https://flowmd.example.com/api/me',{headers:{'oai-authenticated-user-email':'sean@demo.local','oai-authenticated-user-id':'real-sean'}});
 const resp2=await handle(req2,env);assert.equal(resp2.status,200);
 db.close();
});

test('Files remain private when attached to a private office log',async()=>{
 const {db,request}=context();
 const office=await request('/office',{method:'POST',body:{title:'Vendor document',work_date:'2026-10-08'}});
 const form=new FormData();form.append('file',new File(['sample'], 'invoice-note.txt',{type:'text/plain'}));form.append('office_id',office.data.id);
 const upload=await request('/attachments',{method:'POST',body:form});assert.equal(upload.status,201);
 assert.equal((await request('/attachments/'+upload.data.id,{who:'sean@demo.local'})).status,404);
 assert.equal((await request('/attachments/'+upload.data.id,{who:'boss@demo.local'})).status,200);
 db.close();
});

test('Priority queue, manual ranking, boss-first daily activity, and role-safe team activity',async()=>{
 const {db,request}=context();
 const low=await request('/tasks',{method:'POST',body:{title:'Low urgency item',priority:'Low',activity_date:'2026-10-08'}});
 const urgent=await request('/tasks',{method:'POST',body:{title:'Urgent appointment fix',priority:'Urgent',activity_date:'2026-10-08'}});
 const high=await request('/tasks',{method:'POST',body:{title:'High priority QA',priority:'High',activity_date:'2026-10-08'}});
 assert.equal(low.status,201);assert.equal(urgent.status,201);assert.equal(high.status,201);
 const tasks=(await request('/tasks')).data.tasks;
 assert.deepEqual(tasks.map(x=>x.priority),['Urgent','High','Low']);
 assert.equal(tasks[0].sort_order>0,true);
 const newRank=await request('/tasks/'+low.data.id,{method:'PATCH',body:{sort_order:1,activity_date:'2026-10-08'}});
 assert.equal(newRank.status,200);
 assert.equal((await request('/tasks/'+low.data.id,{method:'PATCH',who:'sean@demo.local',body:{sort_order:2}})).status,403);
 assert.equal((await request('/tasks')).data.tasks[0].priority,'Urgent','Priority mode stays primary when rank changes');
 const office=await request('/office',{method:'POST',body:{work_date:'2026-10-08',title:'Order printer paper',category:'Purchasing',status:'Completed'}});
 assert.equal(office.status,201);
 const qaSummary=(await request('/summary?date=2026-10-08')).data;
 const bossSummary=(await request('/summary?date=2026-10-08',{who:'boss@demo.local'})).data;
 const engineerSummary=(await request('/summary?date=2026-10-08',{who:'sean@demo.local'})).data;
 assert.ok(qaSummary.today_activity.some(x=>x.title==='Order printer paper' && x.private));
 assert.ok(bossSummary.today_activity.some(x=>x.title==='Order printer paper' && x.private));
 assert.ok(!engineerSummary.today_activity.some(x=>x.private),'Engineer cannot view private office work through dashboard');
 const anotherQA=await request('/tasks/'+urgent.data.id+'/activity',{who:'sean@demo.local',method:'POST',body:{action_type:'Development',activity_date:'2026-10-08',environment:'Local',result:'Fixed locally'}});
 assert.equal(anotherQA.status,201);
 const teamQA=await request('/daily?date=2026-10-08&scope=team');
 assert.ok(!teamQA.data.activities.some(x=>x.actor_email==='sean@demo.local'),'Admin daily page includes only own dated work');
 assert.ok(teamQA.data.office.some(x=>x.title==='Order printer paper'));
 const teamEngineer=await request('/daily?date=2026-10-08&scope=team',{who:'sean@demo.local'});
 assert.ok(!teamEngineer.data.activities.some(x=>x.actor_email==='zoey@demo.local'),'Individual daily work is never shared with other employees');
 assert.equal(teamEngineer.data.office.length,0);
 assert.equal((await request('/daily?date=2026-10-08&scope=team&email=zoey@demo.local',{who:'sean@demo.local'})).status,403);
 db.close();
});


test('Private daily records for engineers, boss read-only, Admin account management, individual dashboards', async()=>{
 const {db,request}=context();
 const engineer=await request('/office',{who:'sean@demo.local',method:'POST',body:{title:'Investigate local build',category:'Development (unlinked)',details:'Tried alternate dependency versions',work_date:'2026-10-08'}});
 assert.equal(engineer.status,201,'Engineer can create private unlinked daily work');
 const qa=await request('/office',{method:'POST',body:{title:'Buy clinic stationery',category:'Purchasing',work_date:'2026-10-08'}});
 assert.equal(qa.status,201);
 const task=await request('/tasks',{method:'POST',body:{title:'Shared priority task',activity_date:'2026-10-08'}});
 assert.equal(task.status,201);
 await request('/tasks/'+task.data.id+'/activity',{who:'sean@demo.local',method:'POST',body:{action_type:'Development',activity_date:'2026-10-08',result:'Local fix completed'}});
 const engineerMine=await request('/daily?date=2026-10-08&scope=team',{who:'sean@demo.local'});
 assert.deepEqual(engineerMine.data.office.map(x=>x.title),['Investigate local build']);
 assert.ok(engineerMine.data.activities.every(x=>x.actor_email==='sean@demo.local'));
 const adminMine=await request('/daily?date=2026-10-08',{who:'zoey@demo.local'});
 assert.deepEqual(adminMine.data.office.map(x=>x.title),['Buy clinic stationery']);
 const bossView=await request('/daily?date=2026-10-08',{who:'boss@demo.local'});
 assert.deepEqual(new Set(bossView.data.office.map(x=>x.title)),new Set(['Investigate local build','Buy clinic stationery']));
 assert.equal((await request('/office/'+engineer.data.id,{who:'zoey@demo.local'})).status,404,'Admin cannot view engineer personal record');
 assert.equal((await request('/attachments',{who:'boss@demo.local',method:'POST',body:{}})).status,403);
 assert.equal((await request('/office',{who:'boss@demo.local',method:'POST',body:{title:'Boss writes',work_date:'2026-10-08'}})).status,403);
 assert.equal((await request('/tasks',{who:'boss@demo.local',method:'POST',body:{title:'Boss writes'}})).status,403);
 assert.equal((await request('/tasks/'+task.data.id+'/comments',{who:'boss@demo.local',method:'POST',body:{body:'Boss comments'}})).status,403);
 assert.equal((await request('/tasks/'+task.data.id+'/activity',{who:'boss@demo.local',method:'POST',body:{action_type:'QA Testing',result:'Passed',activity_date:'2026-10-08'}})).status,403);
 assert.equal((await request('/users',{who:'boss@demo.local',method:'POST',body:{email:'new@example.com',role:'member',groups:['Engineering']}})).status,403);
 assert.equal((await request('/users',{who:'sean@demo.local',method:'POST',body:{email:'new@example.com',role:'member',groups:['Engineering']}})).status,403);
 assert.equal((await request('/users',{who:'zoey@demo.local',method:'POST',body:{email:'new@example.com',role:'member',groups:['Engineering']}})).status,201);
 const summaryEngineer=(await request('/summary?date=2026-10-08',{who:'sean@demo.local'})).data;
 assert.ok(summaryEngineer.today_activity.some(a=>a.title==='Investigate local build'));
 assert.ok(!summaryEngineer.today_activity.some(a=>a.title==='Buy clinic stationery'));
 assert.ok(summaryEngineer.daily.every(a=>a.email==='sean@demo.local'));
 const summaryAdmin=(await request('/summary?date=2026-10-08',{who:'zoey@demo.local'})).data;
 assert.ok(!summaryAdmin.today_activity.some(a=>a.title==='Investigate local build'));
 const summaryBoss=(await request('/summary?date=2026-10-08',{who:'boss@demo.local'})).data;
 assert.ok(summaryBoss.today_activity.some(a=>a.title==='Investigate local build'));
 assert.ok(summaryBoss.today_activity.some(a=>a.title==='Buy clinic stationery'));
 const exportAdmin=await request('/export',{who:'zoey@demo.local'});
 assert.equal(exportAdmin.status,200);
 assert.deepEqual(exportAdmin.data.tables.office_logs.map(a=>a.title),['Buy clinic stationery'],'Admin export must not leak private records');
 db.close();
});

test('Roles and multi-group membership are independent; shared daily excludes private work',async()=>{
 const {db,request}=context();
 const added=await request('/users',{method:'POST',body:{email:'dual@example.com',display_name:'Dual',role:'member',groups:['Engineering','QA']}});assert.equal(added.status,201);
 const me=(await request('/me',{who:'dual@example.com'})).data.user;assert.equal(me.role,'member');assert.deepEqual(me.groups,['Engineering','QA']);
 const created=await request('/tasks',{who:'dual@example.com',method:'POST',body:{title:'Shared task',activity_date:'2026-10-08'}});
 assert.equal((await request('/tasks/'+created.data.id,{who:'dual@example.com',method:'PATCH',body:{development_status:'On Stage',qa_status:'Passed',activity_date:'2026-10-08'}})).status,200);
 await request('/office',{who:'dual@example.com',method:'POST',body:{title:'Secret personal work',work_date:'2026-10-08'}});
 const daily=(await request('/engineering-daily?date=2026-10-08',{who:'sean@demo.local'})).data;assert.ok(daily.activities.length>0);assert.deepEqual(daily.office,[]);assert.ok(!JSON.stringify(daily).includes('Secret personal work'));
 assert.equal((await request('/users',{method:'POST',body:{email:'viewer@example.com',role:'member',groups:['Management','Engineering','QA']}})).status,201);
 assert.equal((await request('/tasks',{who:'viewer@example.com',method:'POST',body:{title:'Must fail'}})).status,403);
 assert.equal((await request('/daily?date=2026-10-08&email=dual@example.com',{who:'viewer@example.com'})).status,200);
 db.close();
});

test('Independent passwords, owner bootstrap, sessions, CSRF, roles and logout',async()=>{
 const {env,db}=context();env.DEV_AUTH=undefined;
 const origin='https://tracker.example';
 async function call(path,body,extra={}) {return handle(new Request(origin+'/api'+path,{method:body===undefined?'GET':'POST',headers:{origin,'content-type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)}),env);}
 const owner={'oai-authenticated-user-email':'zoey@demo.local','oai-authenticated-user-id':'stable-zoey'};
 assert.equal((await call('/me',undefined,owner)).status,401,'Platform identity alone cannot log in');
 assert.equal((await call('/auth/setup',{password:'secure-passphrase-zoey'}, {'oai-authenticated-user-email':'sean@demo.local','oai-authenticated-user-id':'stable-sean'})).status,403);
 const setup=await call('/auth/setup',{password:'secure-passphrase-zoey'},owner);assert.equal(setup.status,200);
 const cookie=setup.headers.get('set-cookie').split(';')[0];assert.match(setup.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 const me=await (await call('/me',undefined,{cookie})).json();assert.equal(me.user.display_name,'Zoey');assert.equal(me.user.role,'admin');assert.deepEqual(me.user.groups,['QA']);
 assert.equal((await call('/auth/setup',{password:'different-secure-passphrase'},owner)).status,409);
 assert.equal((await call('/auth/login',{email:'zoey@demo.local',password:'wrong'})).status,401);
 assert.equal((await call('/auth/login',{email:'zoey@demo.local',password:'secure-passphrase-zoey'})).status,200);
 assert.equal((await call('/auth/login',{email:'zoey@demo.local',password:'secure-passphrase-zoey'},{origin:'https://evil.example'})).status,403);
 assert.equal((await call('/password',{email:'sean@demo.local',password:'secure-passphrase-sean'},{cookie})).status,200);
 const sean=await call('/auth/login',{email:'sean@demo.local',password:'secure-passphrase-sean'});const sc=sean.headers.get('set-cookie').split(';')[0];
 assert.equal((await call('/users',{email:'hacker@example.com',role:'admin'},{cookie:sc})).status,403);
 assert.equal((await call('/daily?date=2026-10-08&email=zoey@demo.local',undefined,{cookie:sc})).status,403);
 db.prepare('UPDATE auth_sessions SET expires_at=0 WHERE email=?').run('sean@demo.local');assert.equal((await call('/me',undefined,{cookie:sc})).status,401);
 assert.equal((await call('/auth/logout',{}, {cookie})).status,200);assert.equal((await call('/me',undefined,{cookie})).status,401);
 for(let i=0;i<11;i++)await call('/auth/login',{email:'missing@example.com',password:'bad'});
 assert.equal((await call('/auth/login',{email:'missing@example.com',password:'bad'})).status,429);
 assert.notEqual(db.prepare('SELECT password_hash FROM auth_credentials WHERE email=?').get('zoey@demo.local').password_hash,'secure-passphrase-zoey');
 db.close();
});

test('Board image bytes round-trip and safe preview stays read-only',async()=>{
 const {db,request}=context();const t=(await request('/tasks',{method:'POST',body:{title:'Screenshot task'}})).data;
 const form=new FormData();form.append('task_id',t.id);form.append('file',new File([new Uint8Array([137,80,78,71])],'screenshot.png',{type:'image/png'}));
 const upload=await request('/attachments',{method:'POST',body:form});assert.equal(upload.status,201);
 const got=await request('/attachments/'+upload.data.id+'?preview=1',{who:'sean@demo.local'});assert.equal(got.status,200);
 assert.equal(db.prepare('SELECT content_type FROM attachments WHERE id=?').get(upload.data.id).content_type,'image/png');db.close();
});

test('Management automatically grants read-only Boss access',async()=>{
 const {db,request}=context();
 assert.equal((await request('/users',{method:'POST',body:{email:'manager@example.com',role:'member',groups:['Management']}})).status,201);
 const user=(await request('/me',{who:'manager@example.com'})).data.user;
 assert.equal(user.role,'member');assert.equal(user.is_boss,1);
 await request('/office',{who:'sean@demo.local',method:'POST',body:{title:'Private engineering work',work_date:'2026-10-08'}});
 const daily=await request('/daily?date=2026-10-08&email=sean@demo.local',{who:'manager@example.com'});
 assert.equal(daily.status,200);assert.ok(daily.data.office.some(x=>x.title==='Private engineering work'));
 assert.equal((await request('/tasks',{who:'manager@example.com',method:'POST',body:{title:'Forbidden'}})).status,403);
 db.close();
});

test('Release plans, permissions, delivered snapshot and historical lock',async()=>{
 const {db,request}=context();
 assert.equal((await request('/releases',{who:'boss@demo.local',method:'POST',body:{version:'x',planned_date:'2026-10-14'}})).status,403);
 const created=await request('/releases',{who:'sean@demo.local',method:'POST',body:{version:'v1.0',planned_date:'2026-10-14'}});assert.equal(created.status,201);
 const rid=created.data.id;
 const t=await request('/tasks',{method:'POST',body:{title:'Fixed billing bug',type:'Bug Fix'}});const tid=t.data.id;
 assert.equal((await request('/releases/'+rid,{method:'PATCH',body:{task_ids:[tid],publish:true,released_date:'2026-10-14'}})).status,400);
 assert.equal((await request('/releases/'+rid,{method:'PATCH',body:{task_ids:[tid],notes:'Billing fix'}})).status,200);
 db.prepare("UPDATE tasks SET development_status='On Production' WHERE id=?").run(tid);
 assert.equal((await request('/releases/'+rid,{method:'PATCH',body:{publish:true,released_date:'2026-10-14'}})).status,200);
 db.prepare('UPDATE tasks SET title=? WHERE id=?').run('Changed task title',tid);
 const list=await request('/releases',{who:'boss@demo.local'});assert.equal(list.status,200);assert.equal(JSON.parse(list.data.releases.find(r=>r.id===rid).snapshot_json)[0].title,'Fixed billing bug');
 assert.equal((await request('/releases/'+rid,{method:'PATCH',body:{notes:'rewrite'}})).status,409);
 db.close();
});

test('Auto release inclusion uses production dates, respects exclusions and never duplicates released tasks',async()=>{
 const {db,request}=context();
 const t=(await request('/tasks',{method:'POST',body:{title:'Auto fix',type:'Bug Fix'}})).data.id;
 const closed=(await request('/tasks',{method:'POST',body:{title:'Closed without production',type:'Bug Fix'}})).data.id;
 await request('/tasks/'+closed,{method:'PATCH',body:{development_status:'Closed',activity_date:'2026-10-09'}});
 await request('/tasks/'+t,{method:'PATCH',body:{development_status:'On Production',activity_date:'2026-10-09'}});
 const r=(await request('/releases',{method:'POST',body:{version:'auto-1',planned_date:'2026-10-14'}})).data.id;
 assert.equal((await request('/releases',{method:'POST',body:{version:'auto-2',planned_date:'2026-10-21'}})).status,409);
 let list=(await request('/releases')).data.releases;
 assert.deepEqual(JSON.parse(list.find(x=>x.id===r).task_ids_json),[t]);

 await request('/releases/'+r,{method:'PATCH',body:{task_ids:[]}});
 list=(await request('/releases')).data.releases;assert.deepEqual(JSON.parse(list.find(x=>x.id===r).task_ids_json),[]);
 await request('/releases/'+r,{method:'PATCH',body:{task_ids:[t],publish:true,released_date:'2026-10-14'}});
 const future=(await request('/releases')).data.releases.find(r=>r.status==='Planned').id;
 assert.equal((await request('/releases/'+future,{method:'PATCH',body:{task_ids:[t]}})).status,409);
 assert.deepEqual(JSON.parse((await request('/releases')).data.releases.find(x=>x.id===future).task_ids_json),[]);
 assert.equal((await request('/users',{method:'POST',body:{email:'oldviewer@example.com',role:'viewer',groups:[]}})).status,400);
 db.close();
});

test('Team edit preserves passwords and only Admin sees password setup status',async()=>{
 const {db,request}=context();
 const row=()=>request('/users');
 assert.equal((await row()).data.users.find(u=>u.email==='sean@demo.local').has_password,0);
 db.prepare('INSERT INTO auth_credentials(email,salt,password_hash) VALUES(?,?,?)').run('sean@demo.local','test-salt','test-hash');
 assert.equal((await row()).data.users.find(u=>u.email==='sean@demo.local').has_password,1);
 await request('/users',{method:'POST',body:{email:'sean@demo.local',display_name:'Sean updated',role:'member',groups:['Engineering','QA']}});
 assert.equal(db.prepare('SELECT password_hash FROM auth_credentials WHERE email=?').get('sean@demo.local').password_hash,'test-hash');
 const users=(await request('/users',{who:'sean@demo.local'})).data.users;
 assert.equal(users.find(u=>u.email==='sean@demo.local').has_password,null);
 assert.ok(!JSON.stringify(users).includes('test-hash'));
 db.close();
});

test('Private projects, child tasks and dated editable work stay isolated; deleted work disappears',async()=>{
 const {db,request}=context();
 const project=(await request('/private-work',{who:'sean@demo.local',method:'POST',body:{kind:'Project',title:'Private prototype'}})).data.id;
 const child=(await request('/private-work',{who:'sean@demo.local',method:'POST',body:{kind:'Task',title:'Design login',parent_id:project}})).data.id;
 assert.equal((await request('/private-work')).data.items.length,0,'Admin must not see employee private projects');
 assert.equal((await request('/private-work',{who:'boss@demo.local'})).data.items.length,2);
 assert.equal((await request('/private-work?email=sean@demo.local')).status,403);
 assert.equal((await request('/private-work/'+child,{method:'PATCH',body:{title:'Unauthorized'}})).status,404);
 assert.equal((await request('/private-work/'+child,{who:'boss@demo.local',method:'PATCH',body:{title:'Unauthorized'}})).status,403);
 const entry=(await request('/office',{who:'sean@demo.local',method:'POST',body:{title:'Initial progress',work_item_id:child,work_date:'2026-10-08'}})).data.id;
 assert.equal((await request('/office/'+entry,{who:'sean@demo.local',method:'PATCH',body:{title:'Login layout done',details:'Continue tomorrow',work_date:'2026-10-09'}})).status,200);
 assert.equal((await request('/daily?date=2026-10-08',{who:'sean@demo.local'})).data.office.length,0);
 assert.equal((await request('/daily?date=2026-10-09',{who:'boss@demo.local'})).data.office[0].work_item_id,child);
 assert.equal((await request('/office/'+entry,{method:'DELETE'})).status,404);
 assert.equal((await request('/office/'+entry,{who:'sean@demo.local',method:'DELETE'})).status,200);
 assert.equal((await request('/daily?date=2026-10-09',{who:'boss@demo.local'})).data.office.length,0);
 assert.equal((await request('/office/'+entry,{who:'sean@demo.local'})).status,404);
 assert.ok(db.prepare('SELECT * FROM office_revisions WHERE office_id=? AND change_type=?').get(entry,'Deleted'));
 assert.equal((await request('/private-work/'+project,{who:'sean@demo.local',method:'DELETE'})).status,409);
 await request('/private-work/'+child,{who:'sean@demo.local',method:'PATCH',body:{status:'Completed'}});
 assert.equal((await request('/private-work',{who:'sean@demo.local'})).data.items.find(i=>i.id===child).status,'Completed');
 db.close();
});
test('Admin-only history and shared categories with cycle-safe parent tasks',async()=>{
 const {db,request}=context();
 assert.equal((await request('/activity',{who:'sean@demo.local'})).status,403);
 assert.equal((await request('/activity',{who:'boss@demo.local'})).status,403);
 assert.equal((await request('/activity')).status,200);
 assert.equal((await request('/engineering-daily?date=2026-10-08',{who:'sean@demo.local'})).status,200);
 const parent=(await request('/tasks',{method:'POST',body:{title:'Financial Reports',category:'Reports'}})).data.id;
 const child=(await request('/tasks',{method:'POST',body:{title:'Gross Report',category:'Reports',parent_task_id:parent}})).data.id;
 const item=(await request('/tasks/'+child)).data.task;assert.equal(item.category,'Reports');assert.equal(item.parent_task_id,parent);
 assert.equal((await request('/tasks/'+parent,{method:'PATCH',body:{parent_task_id:child}})).status,400);
 assert.equal((await request('/tasks/'+child,{who:'sean@demo.local',method:'PATCH',body:{category:'Billing'}})).status,200);
 db.close();
});
test('Exactly one automatic pending version persists until release, then next Wednesday opens',async()=>{
 const {db,request}=context();
 const r=(await request('/releases/ensure',{method:'POST'})).data.release;
 const again=(await request('/releases/ensure',{method:'POST'})).data.release;assert.equal(again.id,r.id);
 const candidates=await Promise.all([request('/releases/ensure',{method:'POST'}),request('/releases/ensure',{method:'POST'})]);assert.ok(candidates.every(x=>x.data.release.id===r.id));
 const t=(await request('/tasks',{method:'POST',body:{title:'Ready feature'}})).data.id;
 await request('/tasks/'+t,{method:'PATCH',body:{development_status:'On Production',activity_date:'2026-10-08'}});
 assert.equal((await request('/releases/'+r.id,{who:'sean@demo.local',method:'PATCH',body:{publish:true,task_ids:[t],released_date:'2026-10-14'}})).status,200);
 const releases=(await request('/releases')).data.releases;
 const next=releases.filter(x=>x.status==='Planned');assert.equal(next.length,1);assert.equal(next[0].planned_date,'2026-10-21');assert.notEqual(next[0].id,r.id);
 assert.equal((await request('/releases/ensure',{method:'POST'})).data.release.id,next[0].id);
 db.close();
});
