/** Work Tracker HTTP API. Deploy behind ChatGPT Sites authenticated identity. */
const TYPES = ['Bug Fix','New Feature','Improvement','UI/UX','Investigation'];
const PRIORITIES = ['Low','Medium','High','Urgent'];
const DEV = ['New Request','Under Review','Approved','In Development','PR Submitted','Merged / Awaiting Stage','On Stage','Approved for Production','Awaiting Production Deploy','On Production','Closed','On Hold'];
const QA = ['Not Tested','Retest Required','Passed','Partially Passed','Changes Required','Need Explanation','No Visible Changes','Unable to Test'];
const ACTIONS = ['Requirement','Development','PR','Merge','Deployment','QA Testing','Feedback','Status Change','Other'];
const fmtDate = () => new Date().toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'});
const stamp = () => new Date().toISOString();
const clean = (v,max=2000) => String(v??'').trim().slice(0,max);
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d+'T00:00:00Z').valueOf()) && new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const ok = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const err = (message,status=400) => ok({error:message},status);
const id = () => crypto.randomUUID();
const sql = (env, query, ...params) => env.DB.prepare(query).bind(...params);
const first = async (env,q,...p) => await sql(env,q,...p).first();
const all = async (env,q,...p) => (await sql(env,q,...p).all()).results;
const run = async (env,q,...p) => await sql(env,q,...p).run();
async function json(req) {try { const x=await req.json(); if (!x || typeof x !== 'object' || Array.isArray(x)) throw 0; return x;}catch{throw Object.assign(new Error('Invalid JSON object'),{status:400});}}
function isBossUser(u){return u.groups.includes('Management');}
function isRole(u,...roles){return roles.some(r=>r==='boss'?isBossUser(u):isBossUser(u)?false:r==='engineer'?u.groups.includes('Engineering'):r==='qa'?u.groups.includes('QA'):r===u.role);}
async function currentUser(req,env){
  if(env.DEV_AUTH!=='1') {
    const token=(req.headers.get('cookie')||'').match(/(?:^|;\s*)wt_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if(!token) throw Object.assign(new Error('Sign in required'),{status:401});
    const session=await first(env,'SELECT email FROM auth_sessions WHERE token_hash=? AND expires_at>?',await digest(token),Date.now());
    if(!session) throw Object.assign(new Error('Sign in required'),{status:401});
    const user=await first(env,'SELECT email,display_name,role,groups_json,is_boss,identity_id,enabled FROM users WHERE email=?',session.email);
    if(!user?.enabled) throw Object.assign(new Error('Access not granted'),{status:403});
    user.groups=JSON.parse(user.groups_json);delete user.groups_json;
    if(user.email===clean(env.ADMIN_EMAIL,254).toLowerCase())user.display_name='Zoey';
    return user;
  }
  return platformUser(req,env);
}
async function platformUser(req,env){
  const localPreview=env.DEV_AUTH==='1' && ['127.0.0.1','localhost'].includes(new URL(req.url).hostname);
  const email=clean(localPreview ? req.headers.get('x-dev-user') : req.headers.get('oai-authenticated-user-email'),254).toLowerCase();
  if(!email || !email.includes('@')) throw Object.assign(new Error('Sign in required'),{status:401});
  const admin=clean(env.ADMIN_EMAIL,254).toLowerCase();
  if(!admin && !localPreview) throw Object.assign(new Error('ADMIN_EMAIL must be configured'),{status:503});
  if(admin && email===admin) await run(env,"INSERT INTO users(email,display_name,role,groups_json) VALUES(?,?,'admin','[\"QA\"]') ON CONFLICT(email) DO NOTHING",email,'Zoey');
  if(env.BOSS_EMAIL && email===env.BOSS_EMAIL.toLowerCase()) await run(env,"INSERT INTO users(email,display_name,role,is_boss,groups_json) VALUES(?,?,'member',1,'[\"Management\"]') ON CONFLICT(email) DO NOTHING",email,'Boss');
  const user=await first(env,'SELECT email,display_name,role,groups_json,is_boss,identity_id,enabled FROM users WHERE email=?',email);
  if(!user || !user.enabled) throw Object.assign(new Error('Access not granted. Ask the owner to invite you.'),{status:403});
  const identity=localPreview ? 'preview:'+email : clean(req.headers.get('oai-authenticated-user-id'),200);
  if(!identity) throw Object.assign(new Error('Verified identity required'),{status:401});
  if(user.identity_id && user.identity_id!==identity) throw Object.assign(new Error('Account identity mismatch'),{status:403});
  if(!user.identity_id) await run(env,'UPDATE users SET identity_id=? WHERE email=? AND identity_id IS NULL',identity,email);
  user.groups=JSON.parse(user.groups_json);delete user.groups_json;
  return user;
}
const hex = bytes => [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async value => hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
async function passwordHash(password,salt){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256));
}
function passwordValid(p){return typeof p==='string' && p.length>=12 && p.length<=256;}
function same(a,b){let n=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)n|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return n===0;}
function checkOrigin(req){if(req.method==='GET'||req.method==='HEAD')return;const origin=req.headers.get('origin');if(origin!==new URL(req.url).origin)throw Object.assign(new Error('Invalid request origin'),{status:403});}
async function sessionResponse(env,email){
 const token=randomToken();await run(env,'INSERT INTO auth_sessions(token_hash,email,expires_at) VALUES(?,?,?)',await digest(token),email,Date.now()+7*86400000);
 const response=ok({success:true});response.headers.set('set-cookie',`wt_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`);return response;
}
async function authApi(req,env){
 const p=new URL(req.url).pathname;
 if(p==='/api/auth/status' && req.method==='GET'){
  const existing=await first(env,'SELECT email FROM auth_credentials WHERE email=?',clean(env.ADMIN_EMAIL,254).toLowerCase());
  const verified=req.headers.get('oai-authenticated-user-email')?.toLowerCase()===clean(env.ADMIN_EMAIL,254).toLowerCase() && !!req.headers.get('oai-authenticated-user-id');
  return ok({setupAvailable:!existing && verified,setupEmail:!existing && verified?clean(env.ADMIN_EMAIL,254).toLowerCase():null});
 }
 checkOrigin(req);
 if(p==='/api/auth/setup' && req.method==='POST'){
  const u=await platformUser(req,env);if(u.email!==clean(env.ADMIN_EMAIL,254).toLowerCase())return err('Only the site owner can set up this account',403);
  const d=await json(req);if(!passwordValid(d.password))return err('Use a password with 12–256 characters');
  const salt=randomToken(),hash=await passwordHash(d.password,salt);
  const created=await run(env,'INSERT INTO auth_credentials(email,salt,password_hash) VALUES(?,?,?) ON CONFLICT(email) DO NOTHING',u.email,salt,hash);
  if(!created.meta?.changes && !created.changes)return err('Account already configured. Sign in with your password.',409);
  await run(env,"UPDATE users SET display_name='Zoey' WHERE email=?",u.email);return sessionResponse(env,u.email);
 }
 if(p==='/api/auth/login' && req.method==='POST'){
  const d=await json(req),email=clean(d.email,254).toLowerCase();
  const key=await digest(email+'|'+(req.headers.get('cf-connecting-ip')||'unknown'));
  await run(env,'INSERT INTO auth_attempts(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END',key,Date.now()+900000,Date.now(),Date.now());
  const rate=await first(env,'SELECT attempts FROM auth_attempts WHERE key=?',key);if(rate.attempts>10)return err('Too many attempts. Try again in 15 minutes.',429);
  const c=await first(env,'SELECT c.* FROM auth_credentials c JOIN users u ON u.email=c.email WHERE c.email=? AND u.enabled=1',email);
  const value=await passwordHash(typeof d.password==='string'?d.password.slice(0,256):'',c?.salt||'invalid-account');
  if(!c || !same(value,c.password_hash))return err('Email or password is incorrect',401);
  await run(env,'DELETE FROM auth_attempts WHERE key=?',key);return sessionResponse(env,email);
 }
 if(p==='/api/auth/logout' && req.method==='POST'){
  const token=(req.headers.get('cookie')||'').match(/(?:^|;\s*)wt_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(token)await run(env,'DELETE FROM auth_sessions WHERE token_hash=?',await digest(token));
  const r=ok({success:true});r.headers.set('set-cookie','wt_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');return r;
 }
 return err('Not found',404);
}
async function task(env,taskId){const t=await first(env,'SELECT * FROM tasks WHERE id=? AND archived=0',taskId); if(!t) throw Object.assign(new Error('Task not found'),{status:404}); return t;}
async function office(env,oid,user){const o=await first(env,'SELECT * FROM office_logs WHERE id=? AND deleted=0',oid); if(!o || (!isRole(user,'boss') && o.owner_email!==user.email)) throw Object.assign(new Error('Office record not found'),{status:404}); return o;}
async function addActivity(env,taskId,actor,kind,date,environment,result,notes,prUrl=''){
  await run(env,`INSERT INTO activities(id,task_id,actor_email,action_type,activity_date,environment,result,notes,github_pr_url) VALUES(?,?,?,?,?,?,?,?,?)`,id(),taskId,actor,kind,date,environment,result,notes,prUrl);
}
function validUrl(value){if (!value) return '';try {const u=new URL(value);if (u.protocol!=='https:'||u.hostname!=='github.com') throw 0;return u.href.slice(0,600);}catch {throw Object.assign(new Error('PR link must be a github.com HTTPS URL'),{status:400});}}
function requireDate(v){const d=clean(v,10)||fmtDate();if(!isDate(d)) throw Object.assign(new Error('Date must use YYYY-MM-DD'),{status:400});return d;}
async function queryTasks(env){return all(env,`SELECT t.*, (SELECT MAX(activity_date) FROM activities a WHERE a.task_id=t.id AND a.action_type IN ('Development','PR','Merge','Deployment')) last_engineer_action, (SELECT MAX(activity_date) FROM activities a WHERE a.task_id=t.id AND a.action_type='QA Testing') last_qa_action, (SELECT COUNT(*) FROM activities a WHERE a.task_id=t.id) activity_count FROM tasks t WHERE archived=0 ORDER BY CASE WHEN development_status='Closed' THEN 1 ELSE 0 END, CASE priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,sort_order ASC,updated_at DESC`);}
async function releasePlan(env){
 const releases=await all(env,'SELECT * FROM releases ORDER BY planned_date DESC,created_at DESC');
 const delivered=new Set(releases.filter(r=>r.status==='Released').flatMap(r=>JSON.parse(r.task_ids_json)));
 const next=releases.filter(r=>r.status==='Planned').sort((a,b)=>a.planned_date.localeCompare(b.planned_date)||a.created_at.localeCompare(b.created_at))[0];
 if(next){
  const last=releases.filter(r=>r.status==='Released').sort((a,b)=>b.released_date.localeCompare(a.released_date))[0];
  const date=new Date(next.planned_date+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-7);
  const start=last?.released_date||date.toISOString().slice(0,10),end=next.planned_date<fmtDate()?fmtDate():next.planned_date;
  const candidates=await all(env,`SELECT t.id,MAX(a.activity_date) production_date FROM tasks t JOIN activities a ON a.task_id=t.id WHERE t.archived=0 AND t.development_status IN ('On Production','Closed') AND a.action_type='Development' AND (a.environment='On Production' OR a.result='On Production') GROUP BY t.id HAVING MAX(a.activity_date)>? AND MAX(a.activity_date)<=?`,start,end);
  next.auto_candidates=candidates.filter(t=>!delivered.has(t.id)).map(t=>t.id);
  next.auto_start=start;next.auto_end=end;
  const excluded=new Set(JSON.parse(next.auto_excluded_json||'[]'));
  next.task_ids_json=JSON.stringify([...new Set([...JSON.parse(next.task_ids_json),...next.auto_candidates.filter(id=>!excluded.has(id))])].filter(id=>!delivered.has(id)));
 }
 for(const r of releases)if(r.status==='Planned')r.task_ids_json=JSON.stringify(JSON.parse(r.task_ids_json).filter(id=>!delivered.has(id)));
 return {releases,delivered};
}
function upcomingWednesday(after){const date=new Date(after+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+((3-date.getUTCDay()+7)%7||7));return date.toISOString().slice(0,10);}
async function ensureRelease(env,actor,after=fmtDate()){
 const planned=upcomingWednesday(after),rid=id(),count=(await first(env,'SELECT COUNT(*) n FROM releases WHERE planned_date=?',planned)).n;
 await run(env,`INSERT INTO releases(id,version,planned_date,created_by) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM releases WHERE status='Planned')`,rid,'Release '+planned+(count?' ('+(count+1)+')':''),planned,actor);
 return first(env,"SELECT * FROM releases WHERE status='Planned' ORDER BY planned_date,created_at LIMIT 1");
}
async function validateParent(env,taskId,parent){if(!parent)return;const seen=new Set([taskId]);let current=parent;while(current){if(seen.has(current))throw Object.assign(new Error('Parent task would create a cycle'),{status:400});seen.add(current);const t=await task(env,current);current=t.parent_task_id;}}
async function privateItem(env,iid,user){const item=await first(env,'SELECT * FROM private_work WHERE id=? AND deleted=0',iid);if(!item||(!isRole(user,'boss')&&item.owner_email!==user.email))throw Object.assign(new Error('Private task not found'),{status:404});return item;}
async function api(req,env){
 const url=new URL(req.url), p=url.pathname, method=req.method;
 if(p==='/api/health') return ok({ok:true});
 if(p.startsWith('/api/auth/'))return authApi(req,env);
 if(env.DEV_AUTH!=='1')checkOrigin(req);
 const user=await currentUser(req,env);
 // Boss is deliberately read-only, including comments, attachments, and all changes.
 if(isBossUser(user) && method!=='GET' && method!=='HEAD') return err('Boss access is read-only',403);
 if(p==='/api/me' && method==='GET') return ok({user,devMode:env.DEV_AUTH==='1' && ['127.0.0.1','localhost'].includes(new URL(req.url).hostname),statuses:{development:DEV,qa:QA,types:['New Feature','Bug Fix','Improvement'],categories:['General','Billing','Reports','Scheduling','Patients','Other'],priorities:PRIORITIES,actions:ACTIONS}});
 if(p==='/api/export' && method==='GET'){
   if(!isRole(user,'admin')) return err('Only Admin can export workspace data',403);
   const result={exported_at:stamp(),format:'work-tracker-v2',tables:{}};
   // Admin exports only shared workspace data and their own private work.
   // Full tenant backup, including other people's private records, must occur at DB infrastructure level.
   for(const name of ['users','tasks','activities','comments','releases']) result.tables[name]=await all(env,`SELECT * FROM ${name}`);
   result.tables.private_work=await all(env,'SELECT * FROM private_work WHERE owner_email=?',user.email);
   result.tables.private_work_revisions=await all(env,'SELECT r.* FROM private_work_revisions r JOIN private_work w ON w.id=r.work_id WHERE w.owner_email=?',user.email);
   result.tables.office_logs=await all(env,'SELECT * FROM office_logs WHERE deleted=0 AND owner_email=?',user.email);
   result.tables.office_revisions=await all(env,'SELECT r.* FROM office_revisions r JOIN office_logs o ON o.id=r.office_id WHERE o.owner_email=?',user.email);
   result.tables.attachments=await all(env,'SELECT * FROM attachments WHERE office_id IS NULL OR office_id IN (SELECT id FROM office_logs WHERE deleted=0 AND owner_email=?)',user.email);
   return new Response(JSON.stringify(result,null,2),{headers:{'content-type':'application/json','content-disposition':`attachment; filename="work-tracker-backup-${fmtDate()}.json"`,'cache-control':'no-store'}});
 }
 if(p==='/api/releases/ensure' && method==='POST'){if(!isRole(user,'admin','engineer'))return err('Engineering permission required',403);return ok({release:await ensureRelease(env,user.email)});}
 if(p==='/api/releases' && method==='GET'){await ensureRelease(env,'system');return ok({releases:(await releasePlan(env)).releases});}
 if(p==='/api/releases' && method==='POST'){
  if(!isRole(user,'admin','engineer'))return err('Only Engineering or Admin can manage releases',403);
  if(await first(env,"SELECT id FROM releases WHERE status='Planned' LIMIT 1"))return err('Publish the current version before creating another plan',409);
  const d=await json(req),version=clean(d.version,60),planned=requireDate(d.planned_date);
  if(!version)return err('Version name is required');
  if(await first(env,'SELECT id FROM releases WHERE version=?',version))return err('Version already exists',409);
  const rid=id();await run(env,'INSERT INTO releases(id,version,planned_date,created_by) VALUES(?,?,?,?)',rid,version,planned,user.email);return ok({id:rid},201);
 }
 if(p.startsWith('/api/releases/') && method==='PATCH'){
  if(!isRole(user,'admin','engineer'))return err('Only Engineering or Admin can manage releases',403);
  const rid=p.slice('/api/releases/'.length),r=await first(env,'SELECT * FROM releases WHERE id=?',rid);
  if(!r)return err('Release not found',404);if(r.status==='Released')return err('Released versions are locked',409);
  const plan=await releasePlan(env),effective=plan.releases.find(x=>x.id===rid);
  const d=await json(req),ids=Array.isArray(d.task_ids)?[...new Set(d.task_ids)]:JSON.parse(effective.task_ids_json);
  if(ids.some(id=>plan.delivered.has(id)))return err('Task already belongs to a released version',409);
  if(ids.length>500)return err('Too many tasks');
  const tasks=[];for(const tid of ids){if(typeof tid!=='string')return err('Invalid task');tasks.push(await task(env,tid));}
  const notes=d.notes===undefined?r.notes:clean(d.notes,10000),planned=d.planned_date===undefined?r.planned_date:requireDate(d.planned_date);
  if(d.publish===true){
   if(!tasks.length)return err('Select at least one delivered task');
   if(tasks.some(t=>!['On Production','Closed'].includes(t.development_status)))return err('All selected tasks must be On Production or Closed before recording a release');
   const date=requireDate(d.released_date);
   const result=await run(env,"UPDATE releases SET status='Released',released_date=?,published_by=?,notes=?,planned_date=?,task_ids_json=?,snapshot_json=? WHERE id=? AND status='Planned'",date,user.email,notes,planned,JSON.stringify(ids),JSON.stringify(tasks.map(t=>({id:t.id,title:t.title,type:t.type,project:t.project,category:t.category,parent_task_id:t.parent_task_id,development_status:t.development_status,qa_status:t.qa_status,github_pr_url:t.github_pr_url}))),rid);
   await ensureRelease(env,user.email,date);return ok({success:true});
  }
  await run(env,"UPDATE releases SET notes=?,planned_date=?,task_ids_json=?,auto_excluded_json=? WHERE id=? AND status='Planned'",notes,planned,JSON.stringify(ids),JSON.stringify((effective.auto_candidates||[]).filter(id=>!ids.includes(id))),rid);return ok({success:true});
 }
 if(p==='/api/users' && method==='GET') return ok({users:await all(env,"SELECT email,display_name,role,groups_json,is_boss,identity_id,enabled, CASE WHEN ?=1 THEN EXISTS(SELECT 1 FROM auth_credentials c WHERE c.email=users.email) ELSE NULL END AS has_password FROM users ORDER BY display_name,email",isRole(user,'admin')?1:0)});
 if(p==='/api/password' && method==='POST'){
  const d=await json(req);const email=clean(d.email||user.email,254).toLowerCase();
  if(email!==user.email && !isRole(user,'admin'))return err('Only Admin can manage other accounts',403);
  if(!passwordValid(d.password))return err('Use a password with 12–256 characters');
  if(!await first(env,'SELECT email FROM users WHERE email=? AND enabled=1',email))return err('Account not found',404);
  if(email===user.email){const c=await first(env,'SELECT * FROM auth_credentials WHERE email=?',email);if(c && !same(await passwordHash(d.current_password||'',c.salt),c.password_hash))return err('Current password is incorrect',403);}
  const salt=randomToken();await run(env,'INSERT INTO auth_credentials(email,salt,password_hash) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash',email,salt,await passwordHash(d.password,salt));
  await run(env,'DELETE FROM auth_sessions WHERE email=?',email);return ok({success:true});
 }
 if(p==='/api/users' && method==='POST'){
  if(!isRole(user,'admin')) return err('Only Admin can manage members',403);
  const d=await json(req), email=clean(d.email,254).toLowerCase(), name=clean(d.display_name,80);
  let role=clean(d.role,30);
  const groups=Array.isArray(d.groups)?[...new Set(d.groups)]:[]; const boss=groups.includes('Management')?1:0;
  if(boss)role='member';
  if(groups.some(g=>!['Engineering','QA','Management'].includes(g)))return err('Invalid work groups or Boss role');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['admin','member'].includes(role)) return err('Invalid email or role');
  if(email===clean(env.ADMIN_EMAIL,254).toLowerCase() && role!=='admin') return err('Cannot downgrade the configured Admin',403);
  await run(env,`INSERT INTO users(email,display_name,role,groups_json,is_boss) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,role=excluded.role,groups_json=excluded.groups_json,is_boss=excluded.is_boss,enabled=1`,email,name,role,JSON.stringify(groups),boss);
  return ok({success:true},201);
 }
 if(p==='/api/tasks' && method==='GET') return ok({tasks:await queryTasks(env)});
 if(p==='/api/tasks' && method==='POST'){
  const d=await json(req), title=clean(d.title,160),type=clean(d.type,30)||'New Feature',priority=clean(d.priority,16)||'Medium';
  if(!title || !TYPES.includes(type) || !PRIORITIES.includes(priority)) return err('Invalid title, type or priority');
  const taskId=id(),description=clean(d.description,9000);
  const category=clean(d.category,80)||'General',parent=clean(d.parent_task_id,36);await validateParent(env,taskId,parent);
  const rank=Number((await first(env, 'SELECT COALESCE(MAX(sort_order),0) AS n FROM tasks')).n)+10;
  await run(env,`INSERT INTO tasks(id,title,description,type,priority,sort_order,project,assignee,next_action_owner,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)`,taskId,title,description,type,priority,Math.min(rank,1000000),clean(d.project,120)||'CRM',clean(d.assignee,254),clean(d.next_action_owner,254),user.email);
  await run(env,'UPDATE tasks SET category=?,parent_task_id=? WHERE id=?',category,parent,taskId);
  await addActivity(env,taskId,user.email,'Requirement',requireDate(d.activity_date),'','New request submitted',description||title);
  return ok({id:taskId},201);
 }
 const tm=p.match(/^\/api\/tasks\/([a-f0-9-]{36})(?:\/(activity|comments|sync-pr))?$/);
 if(tm){
  const taskId=tm[1],sub=tm[2]||'',t=await task(env,taskId);
  if(method==='GET'&&!sub){
   const activities=await all(env,'SELECT * FROM activities WHERE task_id=? ORDER BY created_at DESC,id DESC',taskId);
   const comments=await all(env,'SELECT * FROM comments WHERE task_id=? ORDER BY created_at ASC',taskId);
   const attachments=await all(env,'SELECT id,task_id,activity_id,filename,byte_size,content_type,created_at FROM attachments WHERE task_id=? ORDER BY created_at DESC',taskId);
   return ok({task:t,activities,comments,attachments});
  }
  if(method==='PATCH'&&!sub){
   const d=await json(req);const date=requireDate(d.activity_date), changes=[];
   const fields=['title','description','type','priority','project','assignee','next_action_owner','development_status','qa_status','github_pr_url','sort_order','category','parent_task_id'];
   for(const field of fields){
     if(!Object.hasOwn(d,field)) continue;
     if(field==='development_status'&&!isRole(user,'engineer','admin')) return err('Only engineer or boss can update development status',403);
     if(field==='qa_status'&&!isRole(user,'qa','admin')) return err('Only QA or boss can update QA status',403);
     if(['category','parent_task_id'].includes(field)&&!isRole(user,'engineer','qa','admin'))return err('Task editing permission required',403);
     if(field==='sort_order'&&!isRole(user,'admin')) return err('Only QA or boss can change board order',403);
     if(['title','description','type','project','priority','assignee','next_action_owner'].includes(field)&&!isRole(user,'qa','admin')) return err('Only QA or boss can edit task definition',403);
     const value=field==='sort_order'?Number(d[field]):field==='github_pr_url'?validUrl(clean(d[field],600)):clean(d[field],field==='description'?9000:field==='title'?160:254);
     if(field==='sort_order'&&(!Number.isInteger(value)||value<1||value>1000000))return err('Manual order must be an integer from 1 to 1,000,000');
     if((field==='type'&&!TYPES.includes(value))||(field==='priority'&&!PRIORITIES.includes(value))||(field==='development_status'&&!DEV.includes(value))||(field==='qa_status'&&!QA.includes(value))) return err('Invalid '+field);
     if(field==='parent_task_id')await validateParent(env,taskId,value);
     if(value!==t[field]) changes.push([field,value,t[field]]);
   }
   for(const [field,value] of changes) await run(env,`UPDATE tasks SET ${field}=?,updated_at=? WHERE id=?`,value,stamp(),taskId);
   // One user save generates one dated audit event, even if several fields changed.
   // A deployment stage change still counts as an engineering action.
   if(changes.length){
     const devChange=changes.some(([f])=>f==='development_status');
     const qaChange=changes.some(([f])=>f==='qa_status');
     const prChange=changes.some(([f])=>f==='github_pr_url');
     const kind=devChange?'Development':qaChange?'QA Testing':prChange?'PR':'Status Change';
     const result=changes.map(([f,v,o])=>`${f}: ${o||'—'} → ${v||'—'}`).join(' | ');
     await addActivity(env,taskId,user.email,kind,date,devChange?clean(d.development_status,120):'',result,clean(d.note,3000)||'Task updated',prChange?validUrl(clean(d.github_pr_url,600)):'');
   }
   return ok({updated:changes.length});
  }
  if(method==='POST'&&sub==='activity'){
   const d=await json(req),kind=clean(d.action_type,24);
   if(!ACTIONS.includes(kind)) return err('Invalid activity type');
   if(['Development','PR','Merge','Deployment'].includes(kind)&&!isRole(user,'engineer','admin')) return err('Engineer permission required',403);
   if(kind==='QA Testing'&&!isRole(user,'qa','admin')) return err('QA permission required',403);
   const date=requireDate(d.activity_date), note=clean(d.notes,9000),result=clean(d.result,240),en=clean(d.environment,120);
   if(!note&&!result) return err('Add result or notes');
   const pr=validUrl(clean(d.github_pr_url,600));
   await addActivity(env,taskId,user.email,kind,date,en,result,note,pr);
   // A single QA test entry can set the QA status without making a duplicate work entry.
   if(kind==='QA Testing' && QA.includes(result)) {
     await run(env,'UPDATE tasks SET qa_status=?,updated_at=? WHERE id=?',result,stamp(),taskId);
   } else if(kind==='Development' && DEV.includes(result)) {
     await run(env,'UPDATE tasks SET development_status=?,updated_at=? WHERE id=?',result,stamp(),taskId);
   } else await run(env,'UPDATE tasks SET updated_at=? WHERE id=?',stamp(),taskId);
   return ok({success:true},201);
  }
  if(method==='POST'&&sub==='comments'){
   const d=await json(req),body=clean(d.body,6000);
   if(!body) return err('Comment required');
   await run(env,'INSERT INTO comments(id,task_id,actor_email,body) VALUES(?,?,?,?)',id(),taskId,user.email,body);
   return ok({success:true},201);
  }
  if(method==='POST'&&sub==='sync-pr'){
   if(!isRole(user,'engineer','admin')) return err('Engineer permission required',403);
   const m=t.github_pr_url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
   if(!m) return err('Set a valid GitHub pull request link first');
   const headers={'accept':'application/vnd.github+json','user-agent':'Work-Tracker'};
   if(env.GITHUB_TOKEN) headers.authorization='Bearer '+env.GITHUB_TOKEN;
   const resp=await fetch(`https://api.github.com/repos/${encodeURIComponent(m[1])}/${encodeURIComponent(m[2])}/pulls/${m[3]}`,{headers});
   if(!resp.ok) return err('GitHub returned '+resp.status+' (for private repos, set GITHUB_TOKEN)',502);
   const gh=await resp.json();const merged=Boolean(gh.merged_at),target=merged?'Merged / Awaiting Stage':'PR Submitted';
   if(target!==t.development_status){
     await run(env,'UPDATE tasks SET development_status=?,updated_at=? WHERE id=?',target,stamp(),taskId);
     await addActivity(env,taskId,'github-sync',merged?'Merge':'PR',(merged?gh.merged_at:gh.updated_at||stamp()).slice(0,10),'GitHub',merged?'Merged':'PR '+gh.state,`GitHub PR #${gh.number}: ${gh.title}`,t.github_pr_url);
   }
   return ok({status:target,merged,github_state:gh.state,updated:target!==t.development_status});
  }
 }
 if(p==='/api/office' && method==='GET'){
  const rows=isRole(user,'boss')?await all(env,'SELECT * FROM office_logs WHERE deleted=0 ORDER BY work_date DESC,created_at DESC LIMIT 500'):await all(env,'SELECT * FROM office_logs WHERE deleted=0 AND owner_email=? ORDER BY work_date DESC,created_at DESC LIMIT 500',user.email);
  return ok({logs:rows});
 }
 if(p==='/api/office' && method==='POST'){
  const d=await json(req),title=clean(d.title,180);if(!title)return err('Title required');
  const itemId=clean(d.work_item_id,36);if(itemId){const item=await privateItem(env,itemId,user);if(item.owner_email!==user.email)return err('Forbidden',403);}
  const officeId=id(),workDate=requireDate(d.work_date),category=clean(d.category,80)||'Office',details=clean(d.details,6000),status=clean(d.status,80)||'In Progress';
  await run(env,'INSERT INTO office_logs(id,owner_email,work_date,category,title,details,status) VALUES(?,?,?,?,?,?,?)',officeId,user.email,workDate,category,title,details,status);
  await run(env,'UPDATE office_logs SET work_item_id=? WHERE id=?',itemId,officeId);
  await run(env,'INSERT INTO office_revisions(id,office_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',id(),officeId,user.email,'Created',JSON.stringify({workDate,category,title,status,details}));
  return ok({id:officeId},201);
 }
 const om=p.match(/^\/api\/office\/([a-f0-9-]{36})$/);
 if(om&&method==='GET'){
   const o=await office(env,om[1],user);
   return ok({office:o,revisions:await all(env,'SELECT * FROM office_revisions WHERE office_id=? ORDER BY recorded_at DESC',o.id)});
 }
 if(om&&method==='PATCH'){
  const o=await office(env,om[1],user);if(o.owner_email!==user.email)return err('Forbidden',403);
  const d=await json(req),patch=[];for(const [k,max] of [['title',180],['details',6000],['category',80],['status',80],['work_date',10],['work_item_id',36]]){
   if(Object.hasOwn(d,k)){let v=clean(d[k],max);if(k==='work_date')v=requireDate(v);if(k==='title'&&!v)return err('Title required');if(k==='work_item_id'&&v){const item=await privateItem(env,v,user);if(item.owner_email!==user.email)return err('Forbidden',403);}patch.push([k,v]);}
  }
  for(const [k,v] of patch){
    if(v===o[k])continue;
    await run(env,`UPDATE office_logs SET ${k}=?,updated_at=? WHERE id=?`,v,stamp(),o.id);
    await run(env,'INSERT INTO office_revisions(id,office_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',id(),o.id,user.email,'Edited',JSON.stringify({field:k,old:o[k],new:v}));
  }
  return ok({success:true});
 }
 if(om&&method==='DELETE'){
  const o=await office(env,om[1],user);if(o.owner_email!==user.email)return err('Forbidden',403);
  await run(env,'UPDATE office_logs SET deleted=1,updated_at=? WHERE id=?',stamp(),o.id);
  await run(env,'INSERT INTO office_revisions(id,office_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',id(),o.id,user.email,'Deleted',JSON.stringify({title:o.title}));return ok({success:true});
 }
 if(p==='/api/private-work'&&method==='GET'){
  const email=clean(url.searchParams.get('email'),254).toLowerCase();if(email&&email!==user.email&&!isRole(user,'boss'))return err('Forbidden',403);
  const owner=isRole(user,'boss')?email:user.email;
  return ok({items:owner?await all(env,'SELECT * FROM private_work WHERE deleted=0 AND owner_email=? ORDER BY created_at',owner):await all(env,'SELECT * FROM private_work WHERE deleted=0 ORDER BY owner_email,created_at')});
 }
 if(p==='/api/private-work'&&method==='POST'){
  const d=await json(req),title=clean(d.title,180),kind=clean(d.kind,20)||'Task',parent=clean(d.parent_id,36),description=clean(d.description,6000);
  if(!title||!['Task','Project'].includes(kind))return err('Invalid title or mode');
  if(parent){const item=await privateItem(env,parent,user);if(item.owner_email!==user.email||item.kind!=='Project'||kind!=='Task')return err('A task can belong to your own project only');}
  const iid=id();await run(env,'INSERT INTO private_work(id,owner_email,kind,title,description,parent_id) VALUES(?,?,?,?,?,?)',iid,user.email,kind,title,description,parent);
  await run(env,'INSERT INTO private_work_revisions(id,work_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',id(),iid,user.email,'Created',JSON.stringify({title,kind,parent}));return ok({id:iid},201);
 }
 const pm=p.match(/^\/api\/private-work\/([a-f0-9-]{36})$/);
 if(pm&&['PATCH','DELETE'].includes(method)){
  const item=await privateItem(env,pm[1],user);if(item.owner_email!==user.email)return err('Forbidden',403);
  const d=method==='PATCH'?await json(req):{};const title=d.title===undefined?item.title:clean(d.title,180),description=d.description===undefined?item.description:clean(d.description,6000),status=d.status===undefined?item.status:clean(d.status,40);
  if(!title||!['In Progress','Waiting','Completed'].includes(status))return err('Invalid title or status');
  if(method==='DELETE'&&await first(env,'SELECT id FROM private_work WHERE parent_id=? AND deleted=0',item.id))return err('Remove or finish editing child tasks before deleting the project',409);
  await run(env,'UPDATE private_work SET title=?,description=?,status=?,deleted=?,updated_at=? WHERE id=?',title,description,status,method==='DELETE'?1:0,stamp(),item.id);
  await run(env,'INSERT INTO private_work_revisions(id,work_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',id(),item.id,user.email,method==='DELETE'?'Deleted':'Edited',JSON.stringify({old:item,new:{title,description,status}}));return ok({success:true});
 }
 if(p==='/api/daily'&&method==='GET'){
   const d=requireDate(url.searchParams.get('date'));
   const who=clean(url.searchParams.get('email'),254).toLowerCase();
   if(who && who!==user.email&&!isRole(user,'boss'))return err('Forbidden',403);
   // Each person's daily page is private. Only Boss can browse other employees or the whole team.
   const filterWho=isRole(user,'boss')?who:user.email;
   const a=filterWho?await all(env,`SELECT a.*,t.title task_title,t.type task_type FROM activities a JOIN tasks t ON a.task_id=t.id WHERE a.activity_date=? AND a.actor_email=? ORDER BY a.created_at DESC`,d,filterWho):await all(env,`SELECT a.*,t.title task_title,t.type task_type FROM activities a JOIN tasks t ON a.task_id=t.id WHERE a.activity_date=? ORDER BY a.created_at DESC`,d);
   const o=filterWho?await all(env,'SELECT * FROM office_logs WHERE deleted=0 AND work_date=? AND owner_email=? ORDER BY created_at DESC',d,filterWho):await all(env,'SELECT * FROM office_logs WHERE deleted=0 AND work_date=? ORDER BY created_at DESC',d);
   return ok({date:d,activities:a,office:o});
 }
 if(p==='/api/engineering-daily'&&method==='GET'){
   const date=requireDate(url.searchParams.get('date'));
   return ok({date,activities:await all(env,'SELECT a.*,t.title task_title FROM activities a JOIN tasks t ON t.id=a.task_id WHERE a.activity_date=? ORDER BY a.created_at DESC',date),office:[]});
 }
 if(p==='/api/activity'&&method==='GET'){
   if(!isRole(user,'admin'))return err('Activity History is Admin only',403);
   const filterWho=clean(url.searchParams.get('email'),254).toLowerCase();
   const rows=filterWho?await all(env,`SELECT a.*,t.title task_title FROM activities a JOIN tasks t ON a.task_id=t.id WHERE a.actor_email=? ORDER BY a.created_at DESC LIMIT 500`,filterWho):await all(env,`SELECT a.*,t.title task_title FROM activities a JOIN tasks t ON a.task_id=t.id ORDER BY a.created_at DESC LIMIT 500`);
   return ok({activities:rows});
 }
 if(p==='/api/summary'&&method==='GET'){
   const date=requireDate(url.searchParams.get('date'));
   const boss=isRole(user,'boss');
   const daily=boss?await all(env,`SELECT actor_email email,COUNT(*) count FROM activities WHERE activity_date=? GROUP BY actor_email`,date):await all(env,`SELECT actor_email email,COUNT(*) count FROM activities WHERE activity_date=? AND actor_email=? GROUP BY actor_email`,date,user.email);
   const personal=boss?await all(env,`SELECT owner_email email,COUNT(*) count FROM office_logs WHERE deleted=0 AND work_date=? GROUP BY owner_email`,date):await all(env,`SELECT owner_email email,COUNT(*) count FROM office_logs WHERE deleted=0 AND work_date=? AND owner_email=? GROUP BY owner_email`,date,user.email);
   const tasks=await queryTasks(env);
   const todayActions=boss?await all(env,`SELECT a.task_id,a.actor_email person,a.action_type category,a.activity_date work_date,a.result,a.notes,t.title,a.created_at FROM activities a JOIN tasks t ON t.id=a.task_id WHERE a.activity_date=? ORDER BY a.created_at DESC LIMIT 40`,date):await all(env,`SELECT a.task_id,a.actor_email person,a.action_type category,a.activity_date work_date,a.result,a.notes,t.title,a.created_at FROM activities a JOIN tasks t ON t.id=a.task_id WHERE a.activity_date=? AND a.actor_email=? ORDER BY a.created_at DESC LIMIT 40`,date,user.email);
   const todayOffice=boss?await all(env,'SELECT id,owner_email person,category,work_date,status result,details notes,title,created_at FROM office_logs WHERE deleted=0 AND work_date=? ORDER BY created_at DESC LIMIT 40',date):await all(env,'SELECT id,owner_email person,category,work_date,status result,details notes,title,created_at FROM office_logs WHERE deleted=0 AND work_date=? AND owner_email=? ORDER BY created_at DESC LIMIT 40',date,user.email);
   const today_activity=[...todayActions.map(a=>({...a,private:false})),...todayOffice.map(a=>({...a,private:true}))].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,20);
   return ok({date,daily,office_counts:personal,today_activity,counts:{total:tasks.length,needQa:tasks.filter(t=>t.development_status==='On Stage'&&['Not Tested','Retest Required'].includes(t.qa_status)).length,needEngineering:tasks.filter(t=>['Changes Required','Need Explanation','No Visible Changes'].includes(t.qa_status)).length,production:tasks.filter(t=>t.development_status==='On Production').length},attention:tasks.filter(t=>['Changes Required','Need Explanation','No Visible Changes'].includes(t.qa_status)||t.development_status==='On Stage'&&['Not Tested','Retest Required'].includes(t.qa_status)).slice(0,15)});
 }
 if(p==='/api/attachments'&&method==='POST'){
   if(!env.BUCKET)return err('Attachment storage is not configured',503);
   const form=await req.formData(), file=form.get('file'), tid=clean(form.get('task_id'),36),oid=clean(form.get('office_id'),36),aid=clean(form.get('activity_id'),36);
   if(!(file instanceof File)||(!tid&&!oid)||(tid&&oid))return err('File and either task_id or office_id required');
   if(file.size>8*1024*1024)return err('Maximum file size is 8MB');
   if(tid)await task(env,tid);if(oid)await office(env,oid,user);
   if(aid&&!await first(env,'SELECT id FROM activities WHERE id=? AND task_id=?',aid,tid))return err('Activity does not belong to task');
   const key=`files/${id()}`,fid=id(),type=clean(file.type,120)||'application/octet-stream';
   await env.BUCKET.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:type}});
   await run(env,'INSERT INTO attachments(id,task_id,activity_id,office_id,owner_email,filename,content_type,object_key,byte_size) VALUES(?,?,?,?,?,?,?,?,?)',fid,tid||null,aid||null,oid||null,user.email,clean(file.name,255),type,key,file.size);
   return ok({id:fid},201);
 }
 const am=p.match(/^\/api\/attachments\/([a-f0-9-]{36})$/);
 if(am&&method==='GET'){
   const a=await first(env,'SELECT * FROM attachments WHERE id=?',am[1]);if(!a)return err('Attachment not found',404);
   if(a.office_id)await office(env,a.office_id,user);
   const obj=await env.BUCKET?.get(a.object_key);if(!obj)return err('Stored object not found',404);
   const inline=url.searchParams.get('preview')==='1' && ['image/png','image/jpeg','image/webp','image/gif'].includes(a.content_type);
   const safeName=a.filename.replace(/[\r\n"\\]/g,'_');
   return new Response(obj.body,{headers:{'content-type':a.content_type,'content-disposition':`${inline?'inline':'attachment'}; filename="${safeName}"`,'x-content-type-options':'nosniff','cache-control':'private, no-store'}});
 }
 return err('Route not found',404);
}
export async function handle(request,env){
 try {return await api(request,env);}catch(e){
  console.error('[Work Tracker API]',e?.message||e);
  return err(e?.status?e.message:'Request failed',e?.status||500);
 }
}
export default {async fetch(request,env){
 const pathname=new URL(request.url).pathname;
 if(pathname.startsWith('/api/'))return handle(request,env);
 if(env.ASSETS)return env.ASSETS.fetch(request);
 return new Response('Static assets not bound; use Sites/Assets configuration',{status:503});
}};
