import {createTaskSignals} from './task-signals.mjs';
/** Work Tracker HTTP API. Hosted setup requires trusted upstream identity headers. */
const TYPES = ['Bug Fix','New Feature','Improvement','UI/UX','Investigation'];
const PRIORITIES = ['Low','Medium','High','Urgent'];
const DEV = ['New Request','Under Review','Approved','In Development','PR Submitted','Merged / Awaiting Stage','On Stage','Approved for Production','Awaiting Production Deploy','On Production','Closed','On Hold'];
const QA_RESULTS = ['Passed','Partially Passed','Not Passed'];
const QA = ['Not Passed','Not Tested','Retest Required','Passed','Partially Passed','Changes Required','Need Explanation','No Visible Changes','Unable to Test'];
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
// Add future work groups here; personal/team perspectives do not depend on a specific group's name.
const WORK_GROUPS={Engineering:{label:'Engineering'},QA:{label:'QA'},PM:{label:'PM'},Management:{label:'Manager'}};
function hasPersonalWorkGroups(u){return u.groups.some(g=>g!=='Management');}
function isRole(u,...roles){return roles.some(r=>r==='boss'?isBossUser(u):isBossUser(u)&&!hasPersonalWorkGroups(u)?false:r==='engineer'?u.groups.includes('Engineering'):r==='qa'?u.groups.includes('QA'):r===u.role);}
// Each feature guide has a stable, versioned ID. New behavior gets a new ID so
// people who acknowledged an earlier guide still receive the new instruction.
export function instructionGuides(user){
 if(isBossUser(user)&&hasPersonalWorkGroups(user)){
  const personal=instructionGuides({...user,groups:user.groups.filter(g=>g!=='Management')}).map(g=>({...g,workspace:'personal'}));
  const team=instructionGuides({...user,groups:['Management']}).map(g=>({...g,workspace:'team'}));
  const guides=new Map();for(const guide of [...personal,...team])guides.set(guide.id,guides.has(guide.id)?{...guide,workspace:undefined}:guide);
  const group=user.groups.filter(g=>g!=='Management').sort().map(g=>g.toLowerCase().replace(/[^a-z0-9]+/g,'-')).join('-');
  return [{id:'workspace-switch-'+group+'-manager-v1',surface:'workspace',title:'Your work and the team overview',steps:[
   'Use My work and Team overview at the top of the page to switch views. My work opens by default.',
   'My work shows your personal Next actions, Daily Work, tasks, projects and reminders. Use shared boards for work permitted by your assigned groups.',
   'Team overview shows everyone’s dated activity, engineering progress and versions. This view is read-only; other people’s private ongoing boards are not shown.',
   'Switch back to My work to add activity or advance a task. Confirm before discarding an unfinished draft.'
  ]},...guides.values()];
 }

 const manager=isBossUser(user),admin=isRole(user,'admin'),engineer=isRole(user,'engineer'),qa=isRole(user,'qa');
 const audience=manager?'manager':engineer&&qa?'engineering-qa':engineer?'engineering':qa?'qa':'member';
 const guides=[];
 if(!manager)guides.push({id:'simple-work-'+audience+'-v3',surface:'simple-work',title:'Quick Tasks and PM work',steps:[
 'Use Quick Task for independent small work. Choose its owner, record dated Activity and confirm To Do, In Progress or Completed without QA or Release.',
 'Use PM Task for requirements and design. Mark design ready and submit Handoff; the same record becomes an ordinary Engineering task for review and implementation.',
 'Choose Backlog or Planned for future work, and Active when work begins. Edit Activity to update notes, date and attachments while retaining history.'
 ]});
 if(!manager)guides.push({id:'work-tracking-'+(admin?'admin-':'')+audience+'-v4',surface:'board',title:'Planning, collaboration and follow-up',steps:[
 'In + New, choose Engineering, Quick Task or PM Task. Quick Tasks use To Do, In Progress and Completed; use Activity on an existing task when the work belongs there.',
 'In + New, Work type defaults to Engineering for Engineering members and PM Task for PM members. Members of both groups default to Engineering. You can change Work type before creating the task.',
 'Choose Backlog or Planned for future work. Change Planning status to Active in Work tracking when work begins; in Engineering details, expand Task settings to find it.',
 'In Engineering details, expand Task settings for Primary Owner and Collaborators. Assign specific assistance under Collaboration to request their action.',
 'QA due date starts seven days after entering QA. After QA returns work to Engineering, set a new Engineering estimated delivery date before the next QA round.',
 'To correct a mistaken confirmation, use Undo this stage change in the matching Previous stage card. If the latest update is not shown there, open Task settings → Stage change history → Undo last stage change. Review the values and enter a reason; history remains. For failed QA, record the QA result in Next Step.',
 'In Activity timeline, choose Edit activity to correct notes, date or attachments. Expand Edit history to read prior versions.'
 ]});
 if(!manager)guides.push({id:'action-dashboard-'+audience+'-v3',surface:'dashboard',title:'Your actions and follow-ups',steps:[
 'Needs My Action shows your current task steps, explicitly assigned collaboration and Discussion requests. Waiting on Others shows related work waiting for another person.',
 'When posting a Discussion, choose the people whose response you need. Reply to their request or choose Resolved to clear your action.',
 'Needs Follow-up shows At Risk after five days, owner reminders after seven days and Stale after ten days without actual work. Due dates show Overdue separately.',
 'For blocked work, set Blocked / waiting reason and Follow-up date in Work tracking. Backlog and Planned work do not generate reminders.',
 'Today’s activity shows your submissions, dated work and feedback. Choose a date on Dashboard to review that day. Daily Work keeps its existing privacy.'
 ]});
 guides.push({id:'pm-handoff-'+audience+'-v4',surface:'pm-task',title:manager?'Review PM handoffs':'From PM design to Engineering',steps:manager?[
 'Open a PM Task to review its design, handoff owner, requested details, images and history. Team overview is read-only.'
 ]:[
 'Create a PM Task, choose its PM owner and category, and use Edit PM task to record the requirement and design. Add reference images in Task images & files.',
 'PM workflow shows saved requirement and design checks. Save draft in Edit PM task, then click Mark design ready to review the saved design and confirm readiness.',
 'Design Ready highlights Choose engineer & hand off. Select an Engineering member and submit Handoff; this same record becomes an Engineering task and appears in Engineering filters.',
 'Editing the requirement or design after Design Ready returns it to Draft. Review the updated version and use Mark design ready again before handoff.',
 'Handoff opens the ordinary Engineering task details. Use Next Step to review feasibility and delivery, then follow the existing Development, Stage, QA and Production workflow.',
 'Expand PM source to read the original design. In Next Step review, choose Confirmed to start Engineering; Needs Clarification or Cannot Complete returns the task to PM with an explanation and an @ request. After accepting, use Return to PM if new questions arise. PM updates the design and resubmits Handoff.',
 'Edit activity corrects dated work while retaining history. The PM owner or Admin can Archive or Delete at the bottom; shared or released history is preserved by archiving.'
 ]});
 const add=(id,surface,title,steps)=>guides.push({id,surface,title,steps});
 add('backlog-board-'+audience+'-v1','board','Keeping Backlog separate',manager?[
  'Expand Backlog or Planned below the active tasks to review future work separately.'
 ]:[
  'In + New, choose Backlog and leave Assignee empty to record an idea before assigning an engineer.',
  'Expand Backlog below the active Board tasks. In Task settings, choose Primary Owner and change Planning status to Active when the work is ready to begin.'
 ]);
 add('board-focus-'+audience+'-v1','board','Focus on the work you need',[
  'Choose Feasibility for requests awaiting assessment, Development for development and fixes, or PR & Stage for PR review and Stage deployment. Only the selected tab shows its count.',
  manager?'Use All or Unassigned beside the stage tabs to review task ownership. Viewing does not assign a task.':'Choose All, Needs my action or Unassigned beside the stage tabs. Needs my action includes your current steps and shared PR review/deployment steps.',
  'Daily Engineering Activity is collapsed initially. Click its heading to load the daily records; change Work date inside to review another day.'
 ]);
 add('stage-colors-'+audience+'-v1','board','Task stage colors',['Look at the task background on Engineering Board and its Next Step card: gray is waiting, blue is PR, yellow is waiting for QA, red needs changes, pale green is Production and stronger green is completed. Keep reading the stage label for the exact status.']);
 add('activity-preview-'+audience+'-v1','dashboard','Reading activity details',['Today’s activity shows a short preview of each entry. Click an entry to read its full notes and attachments; for Engineering activity, use Open task to continue to its task.']);
 add('task-reporting-'+audience+'-v1','dashboard','Creating tasks and reporting bugs',manager?[
  'Choose a date on Dashboard to read new task submissions and bug reports in Today’s activity. Click an entry to open its task and attachments.'
 ]:[
  'Use Engineering Board → + New to create a request or report a bug. Choose Bug Fix for a bug report and add the reproduction steps and screenshots.',
  'After Create task, open Dashboard → Today’s activity to see your submission on the day you created it. PM and Quick Task submissions appear there too.',
  'Use Activity for later work. Editing task settings does not add another task creation record.'
 ]);

 add('task-categories-'+(admin&&!manager?'admin-':'')+audience+'-v1','board','Task categories',manager?[
  'Category tags identify each shared task. Use Filters → Category to show tasks in one category.'
 ]:[
  'In a new task or Task details & PR, open Category and choose + Add category. Enter its name and click Add category; existing categories can be reused.',
  'Category appears as a colored tag in the task list. Use Filters → Category to show only that category.',
  'Order numbers are hidden in the task list. Use Sort by → Manual order to apply the existing task order.',
  'Cards and List open the same Engineering task details. Filters and sorting apply in either layout.'
 ]);
 if(user.language_switch_enabled) add('account-language-v2','workspace','Language settings',[
  'English is the default. Use 中文 or English in the top bar to switch language when Admin has enabled it for your account. This browser remembers your choice for your account.',
  '中文 keeps navigation names, fields, status tags and terms such as Stage in English. Descriptions, tips and examples appear in Chinese.',
  'Changing language keeps your drafts, task content, comments and uploaded files unchanged.'
 ]);
 add('activity-records-'+audience+'-v1','daily','Activity and follow-up work',manager?[
  'Read Activity as work someone already did. Task status shows what still needs follow-up; Engineering results describe the test or deployment.'
 ]:[
  'Use Activity to record what you did, with a work date and optional files. Choose Task for work that needs a next action or continued follow-up.',
  'Record progress under its Task. Use the task status tag or Complete task when a one-off task is finished; use Complete this occurrence for repeating work. Activity history shows your actions, while Task overview shows its current status.'
 ]);
 add('dashboard-'+audience+(manager?'-v4':'-v5'),'dashboard',manager?'Your Manager overview':'Start with your next actions',manager?[
  'Choose a date to review each person’s work. Click an entry to read its details and view screenshots.',
  'Daily Work shows dated team activity. Personal projects, ongoing tasks and reminders stay in each person’s workspace.',
  'Engineering Board and Version Control show shared progress and upcoming releases; your workspace is for viewing.',
  'On a phone, use the bottom navigation to switch sections. Swipe it sideways for more sections; use the account icon at the top for account settings.'
 ]:[
  'Next actions shows the task, what needs to happen and who owns the next step. Click any row to open the task.',
  engineer?'Needs My Action shows the step currently owned by you. Unassigned tasks remain on the shared board; work waiting for another person appears in Waiting on Others.':qa?'Open tasks waiting for QA and test only the build that Engineering has confirmed is on Stage.':'Use Daily Work for your personal tasks and ongoing projects; use Engineering Board for shared team requests.',
  'Use Discussion to ask questions or clarify requirements. Click Reply to respond to a comment, and attach screenshots when helpful.',
  'On a phone, use the bottom navigation to switch sections. Swipe it sideways for more sections; use the account icon at the top for account settings.'
 ]);
 add('daily-'+(manager?'manager':'private')+(manager?'-v2':'-v7'),'daily',manager?'Review daily team activity':'Tasks, projects and daily activity',manager?[
  'Select a date and, optionally, a team member to review their work for that day.',
  'Click a daily entry to read its details and attached images. You do not see private ongoing project or task boards.'
 ]:[
  'Use + Activity for work you did today. Choose Task for ongoing work. For an already finished task, choose Completed and set its Completed date.',
  'Click a task or project to open its Overview and the ready-to-use Add activity form. Click its status tag to change In Progress, Waiting or Completed, then confirm.',
  'Ordinary activity needs only a description, work date and optional attachments. When logging work on a task, check Complete task if the whole task is finished.' ,
  'Use + Project above Daily Work Board to group related tasks. Projects appear separately above the board; a task can also stand alone.',
  'Click the dashed attachment area to focus it. A blue outline means it is ready; press ⌘V / Ctrl+V to paste an image there. Choose files opens the file picker.',
  'Expand Daily Work activity to review dated entries. Your private work is visible to you; the Manager can review its daily activity.'
 ]);
 if(!manager){
  add('private-project-v6','private-project','Working within a project',[
   '+ Task in Related tasks creates a piece of work within this project. Choose Completed when adding a task that is already finished. The Add activity form is already open below the related tasks and defaults to this project.',
   'In Add activity, choose Project itself or one of its unfinished tasks, describe your work and attach screenshots. Complete task finishes a one-off task; Complete this occurrence finishes only the current repeat.',
   'Click the status tag in the project overview, choose In Progress, Waiting or Completed, then confirm. Edit project lets you upload or manage project reference attachments. The overview previews existing files; the timeline contains dated work.',
   'Click the dashed attachment area to focus it. A blue outline means it is ready; press ⌘V / Ctrl+V to paste an image there. Choose files opens the file picker.',
   'Archive and Delete are inside Edit project. Archiving retains history; archived work can be restored from the board filter.'
  ]);
  add('private-task-v9','private-task','Continue a task across days',[
   'Opening a task shows its Overview and the Add activity form. Record progress and attach images directly; expand Activity history to review earlier updates.',
   'Record your progress in Add activity. For a one-off task, choose Complete task when it is finished. For repeating work, choose Complete this occurrence; future repeats remain active.',
   'Click the status tag in Overview, choose In Progress, Waiting or Completed, then confirm. Use Edit task for title, description and repeat settings; edit dated updates in Activity history.',
   'Click the status tag and choose Complete this occurrence for repeating work. Confirm its completion date to advance the next reminder. Use Edit task → Repeat → Does not repeat or Archive task to stop future repeats.',
   'Set Completed date when marking a task Completed, or click its date in Overview to correct it. Activity work dates are separate. Completed tasks stay out of new Activity belongs to lists.',
   'When a task shows Update needed, open it and record your latest progress in Add activity.',
   'Click the dashed attachment area to focus it. A blue outline means it is ready; press ⌘V / Ctrl+V to paste an image there. Choose files opens the file picker.',
   'Archive and Delete are inside Edit task. To restore archived work, select Archived work on Daily Work Board.'
  ]);
 }
 add('engineering-board-'+(manager?'manager-v8':admin?'admin-v9':'shared-v9'),'board','Using the shared Engineering Board',[
  manager?'Click a task to view its next step, feedback, screenshots and history.':'Create a shared request with + New. Use a broad category and optionally link it to a parent task.',
  ...(!manager?['In New task, add images or files before clicking Create task. Click the Attachments area, then paste with ⌘V / Ctrl+V, or click Choose files. Remove a selected file with ×. If an upload fails, click Retry uploads.']:[]),
  ...(!manager?['Choose Engineering owner from Engineering members and QA owner from QA members. If an existing owner shows unavailable, choose another member. Admin users need the corresponding Work group to appear in these lists.']:[]),
  'Click a task to open it. Active shows unfinished tasks; Completed shows finished tasks. Archived stores tasks with their history and can include unfinished work. Archiving does not complete a task.',
  'Use Cards / List at the top to switch the layout. Choose Feasibility, Development, PR & Stage, Ready for QA or Production to focus on one workflow step; choose All tasks to show every stage. Open Filters for category, development, QA progress and sorting.',
  manager?'Use All or Unassigned beside the stage tabs to review task ownership. Viewing does not assign a task.':'Choose All, Needs my action or Unassigned beside the stage tabs. Needs my action includes your current steps and shared PR review/deployment steps.',
  ...(!manager&&(admin||engineer)?['Open an unassigned request and choose yourself as Engineer during review. Confirm feasibility and the delivery date to start development.']:[]),
  'Cards highlight the next step and show its owner beside the avatar. Switch to List to see Assignee and the last Engineering / QA dates. Open the task to carry out its step; Daily Engineering Activity shows dated work.',
  admin?'Archive and Delete are directly visible at the bottom of task details. Shared or released tasks are preserved by archiving. Use Archived tasks to find and restore them.':'Archived tasks are available from the Board scope filter.'
 ]);
 add('engineering-task-'+audience+(manager?'-v8':'-v12'),'engineering-task',manager?'Reading an engineering task':'Follow the task’s next step',[
  'Read Task description and Task images & files at the top. Expand Next Step below them to see the current action, responsible person and stage controls.',
  'Expand Next Step when you are ready to confirm progress, a QA result or delivery. Read Previous stage below it for the last completed result; expand Activity timeline for the full history.',
  'The due date follows the current stage: entering QA gives QA seven days from Engineering delivery; passing QA gives Production seven days from the QA work date. Confirming Production deployment completes the task.',
  ...(!manager?['If QA returns the task, enter a new Engineering estimated delivery date in Next Step before confirming progress or a fresh Stage handoff. The previous estimate stays in history.',
  'Expand Task settings for planning, primary owner, collaborators and follow-up reminders. These settings supplement Next Step; use Next Step to advance the workflow.']:[]),
  ...(!manager?['For tasks handed off from PM, Confirmed starts Engineering. Needs Clarification or Cannot Complete returns the same task to PM; explain the missing details or feasibility concern. After review, Return to PM is available in Next Step. Direct Engineering tasks retain their original review behavior.']:[]),
  ...(!manager?['Only edit deadlines for the current stage. Completed tasks keep Completed planning status. Record other work saves extra notes and attachments; use Next Step for stage changes and QA results.']:[]),
  ...(!manager?['Estimated delivery date defaults to today in gray when no estimate is saved or QA requests a new estimate. Change the date if needed; confirming Next Step saves the estimate.']:[]),
  ...(!manager?['Choose Engineering owner from Engineering members and QA owner from QA members. If an existing owner shows unavailable, choose another member. Admin users need the corresponding Work group to appear in these lists.']:[]),
  ...(engineer?['Review feasibility and estimated delivery first. Record development stages, then select Merged to Stage → QA only after the Stage build is ready to test; choose QA and confirm once.']:[]),
  ...(qa?['QA starts after Engineering confirms the Stage build. Record a test result and screenshots; problems return to Engineering, and fixes need a fresh Stage confirmation before retesting.']:[]),
  ...(!manager&&!engineer&&!qa?['Engineering reviews scope and delivery, develops the change and confirms Stage before QA tests it. Passed QA then allows Production handoff.']:[]),
  manager||!(admin||engineer)?'View Completed date on finished tasks. Activity timeline keeps the separate work dates.':'Set Completed date when confirming completion. Click the date in task details to correct it; Activity timeline keeps its own work dates.',
  'Click Reply on a highlighted comment to write underneath it. Add images if needed, then click Post reply. Open Discussion to read or reply to older comments.',
  ...(!manager&&(admin||engineer)?['You can record work on a task assigned to another engineer. Keep the Assignee unchanged. Confirm deployed & complete after verifying the Production deployment; no separate completion check is needed.']:[]),
  ...(admin?['Archive and Delete are at the bottom of task details. Archive retains history; shared or released tasks can only be archived. Delete asks for confirmation.']:[]),
  ...(!manager?['Click the dashed attachment area to focus it. A blue outline means it is ready; press ⌘V / Ctrl+V to paste an image there. Choose files opens the file picker.']:[])
 ]);
 for(const surface of (manager?['account-avatar']:['engineering-task','pm-task','simple-work','daily','private-project','private-task','account-avatar']))add('attachment-paste-'+surface+'-'+audience+'-v1',surface,'Add attachments',[
  'Click the dashed attachment area to focus it. A blue outline means it is ready; press ⌘V / Ctrl+V to paste an image there. Choose files opens the file picker.'
 ]);
 if(!manager)add('activity-type-clarity-'+audience+'-v1','engineering-task','Activity type and task stage',[
  'Use Activity type in Record other work to describe work you did. Development work records an activity; it does not move the task to Development.',
  'Use Next Step to confirm a workflow change. Category is the product area, Type is the kind of request, and Planning status says whether the work is queued or active.'
 ]);
 add('qa-results-'+audience+'-v1','engineering-task','Record a QA result',[
  'Choose Passed, Partially Passed or Not Passed. Details are optional for Passed; describe the issues for the other two results.',
  'Use Need Explanation to discuss a question with the engineer before choosing a result. Posting a discussion does not finish QA or return the task to development.'
 ]);
 add('task-window-'+audience+'-v1','engineering-task','Open task in a new tab',[
  'Use Open in new tab in the task header for a full page. Save any changes first; the new tab opens the saved task.',
  'Use Back to board to return. Task actions and permissions stay the same.'
 ]);
 if(!manager&&(admin||engineer||qa))add('stage-correction-'+audience+'-v1','engineering-task','Correct a mistaken stage change',[
  'To correct a mistaken confirmation, click Undo this stage change in its Previous stage card. Review Changes to restore before confirming.',
  'Enter why it was a mistake, then confirm Undo this change. If the latest update is not shown in Previous stage, find Undo last stage change in Task settings → Stage change history. Activity history is kept.',
  'Only the Work Tracker record is restored. Code merges and deployments are unchanged. Use Next Step to record a failed QA result.'
 ]);
 add('pr-review-'+audience+'-v1','engineering-task','PR review and Stage deployment',manager||!(admin||engineer)?[
  'PR review and merge are separate from deploying to Stage. QA starts only after the Stage handoff is confirmed.'
 ]:[
  'Confirm PR Submitted in Next Step. Then choose PR reviewer and click Assign reviewer; the reviewer and engineer owner share this task.',
  'After the PR is reviewed and merged, click Confirm reviewed & merged. The engineer owner or another Engineering task owner can record it on behalf of a reviewer who does not use this workspace.',
  'Deploy the merged build to Stage. In Next Step, choose QA owner and click Confirm deployed to Stage → QA only when the build is ready to test.'
 ]);
 add('qa-feedback-replies-'+audience+'-v1','engineering-task','Discussing QA feedback',manager?['Read replies below Previous stage · QA or in Discussion. The replies stay linked to the QA feedback.']:[
  'Click Reply below Previous stage · QA to answer the feedback directly. Add your explanation or screenshots, then click Post reply.',
  'Response needed from initially selects the QA author. Change or clear it before posting if a response is not needed. QA can reply in the same discussion.',
  'Replies appear below the feedback and remain in Discussion. After fixing the issue, expand Next Step to confirm a fresh Stage build and hand it back to QA.'
 ]);
 add('version-'+(admin||engineer?'planning-v5':'viewing-v4'),'releases','Version plans and releases',[
  'Next release is the current plan. Planned release cards show later plans, including versions scheduled for next month.',
  'Each version card previews its date and changes. Open Review plan or View details to see the full version; click a task title to open its Engineering details.',
  ...(admin||engineer?[
   'Click + Plan to add a future version with its name, planned date and notes. Open Review plan to choose tasks, then Save plan. Later plans stay available while the current version is unfinished.',
   'In Include Engineering Board tasks, Ready for release shows On Production or Closed tasks. Not ready shows work still in development or QA. Tasks already selected in another version show that version name.',
   'After the actual release, check the actual date (today by default) and click Confirm actual release. Review the confirmation: ready tasks enter this release, and selected unfinished tasks move to the next plan. At least one ready task is required.',
   'The next Wednesday plan opens after the current version is released. If you already planned that next version, open its card to continue.'
  ]:['Open a version to review planned or delivered features, bug fixes and release notes. Unfinished tasks appear in the next plan rather than the delivered changes.']),
  'Recording a release updates this tracker; it does not deploy the engineering code. Released records are locked.'
 ]);
 if(admin){
  add('team-language-admin-v1','team','Control language switching',[
   'In Team Access, open Edit for a member, select Allow language switching and Save record to show their 中文 / English buttons. You can enable it for your own account in the same way.',
   'Leave the option unchecked to keep the account in English without a language button. New accounts start with this option off.'
  ]);
  add('team-access-admin-v2','team','Manage accounts and work groups',[
   '+ Add member creates an account with an Admin or Member role. Work groups determine Engineering, QA or Manager access.',
   'Edit changes the name, role and work groups. Reset password appears inside Edit after a password has been set.',
   'Select Management together with a work group to enable My work and Team overview. Choose the Admin system role separately when that person should manage accounts and Activity History. Management alone keeps the viewing-only interface.'
  ]);
  add('activity-history-admin-v1','history','Review the work history',[
   'Activity History is Admin only. Search by task, person or result to find original actions and timestamps.',
   'Work history retains earlier actions. Daily Work is the place to edit your own daily entries.'
  ]);
 }
 add('account-avatar-v1','account-avatar','Your profile photo',[
  'Open My account by clicking your avatar or the account icon. Click the upload area, then paste with ⌘V / Ctrl+V, or click Choose files. Your photo appears beside your name in the workspace.',
  'Upload another photo to replace it. Remove photo returns to your initials. Change password opens the password form below your account details.'
 ]);
 add('account-password-v1','account','Manage your own password',[
  'Open Change password from your account. Enter your current password and confirm a new password of at least 12 characters.',
  'After a successful change, sign in again with the new password. On small screens, use the account icon in the top bar.'
 ]);
 add('workspace-update-'+audience+'-v1','dashboard','What changed',manager?[
  'PR review and merge are separate from deploying to Stage. QA starts only after the Stage handoff is confirmed.',
  'Expand Backlog or Planned below the active tasks to review future work separately.'
 ]:[
  'PR Submitted → choose PR reviewer → Confirm reviewed & merged → deploy to Stage → choose QA. The engineer owner can record the review on behalf of the reviewer.',
  'Click Reply below QA feedback to discuss it with Engineering or QA. Replies keep the original QA result unchanged.',
  'Backlog may have no Assignee. Expand its separate Board section, then choose Primary Owner in Task settings when activating it.'
 ]);
 return guides;
}
function featureIntroductions(user,guides=instructionGuides(user)){
 const preferred={dashboard:'dashboard-',board:'engineering-board-',daily:'daily-private-', 'engineering-task':'engineering-task-','pm-task':'pm-handoff-','simple-work':'simple-work-','private-project':'private-project-','private-task':'private-task-',releases:'version-planning-',team:'team-access-',history:'activity-history-','account-avatar':'account-avatar-',account:'account-password-',workspace:'workspace-switch-'};
 const grouped=new Map();for(const g of guides){const key=(g.workspace||'')+'|'+g.surface;const group=grouped.get(key)||[];group.push(g);grouped.set(key,group);}
 return [...grouped.values()].map(topics=>{const first=topics[0],main=topics.find(g=>g.id.startsWith(preferred[first.surface]||''))||first;
  const steps=first.surface==='engineering-task'?(isBossUser(user)&&first.workspace!=='personal'?main.steps.slice(0,3):[main.steps[0], 'Use Next Step to confirm Engineering or QA work. QA offers Passed, Partially Passed and Not Passed; use Need Explanation to discuss questions first.', 'Open Task settings for owners and planning, Activity timeline for history, or Discussion to exchange details.']):main.steps.slice(0,3);
  return {id:'first-use-'+first.surface+(first.workspace?'-'+first.workspace:''),surface:first.surface,workspace:first.workspace,title:main.title,steps,topic_ids:topics.map(g=>g.id)};
 });
}
async function userInstructions(env,user){
 const guides=instructionGuides(user),onboarding=featureIntroductions(user,guides),explicit=(await all(env,'SELECT instruction_id FROM instruction_acknowledgements WHERE email=?',user.email)).map(r=>r.instruction_id);
 const baseline=(await all(env,'SELECT g.instruction_id FROM instruction_baseline_guides g JOIN instruction_baseline_users u ON u.email=?',user.email)).map(g=>g.instruction_id);
 const read=new Set([...explicit,...baseline]),family=id=>id.replace(/-v\d+$/,'').replace(/(?:-(?:admin|engineering-qa|engineering|qa|manager|member|shared))+$/,''),readFamilies=new Set([...read].map(family));
 const acknowledged=[...explicit,...baseline.filter(id=>guides.some(g=>g.id===id))];
 for(const intro of onboarding)if(read.has(intro.id)||intro.topic_ids.some(id=>read.has(id)||readFamilies.has(family(id))))acknowledged.push(intro.id);
 return {guides,onboarding,acknowledged:[...new Set(acknowledged)]};
}
async function sharedDailyAttachments(env,date,actor=''){
 return all(env,`SELECT DISTINCT f.id,f.task_id,f.activity_id,f.comment_id,f.owner_email,f.filename,f.byte_size,f.content_type,f.created_at
 FROM attachments f JOIN effective_work_activities a ON f.activity_id=a.id OR (a.comment_id IS NOT NULL AND f.comment_id=a.comment_id) OR (f.task_id=a.task_id AND f.activity_id IS NULL AND f.comment_id IS NULL AND a.action_type='Requirement' AND a.result='New request submitted' AND a.id=(SELECT id FROM activities initial WHERE initial.task_id=a.task_id ORDER BY initial.rowid LIMIT 1))
 JOIN tasks t ON t.id=a.task_id WHERE f.deleted=0 AND t.deleted=0 AND a.is_work=1 AND a.activity_date=? ${actor?'AND a.actor_email=?':''} ORDER BY f.created_at`,date,...(actor?[actor]:[]));
}
async function currentUser(req,env){
  if(env.DEV_AUTH!=='1') {
    const token=(req.headers.get('cookie')||'').match(/(?:^|;\s*)wt_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if(!token) throw Object.assign(new Error('Sign in required'),{status:401});
    const session=await first(env,'SELECT email FROM auth_sessions WHERE token_hash=? AND expires_at>?',await digest(token),Date.now());
    if(!session) throw Object.assign(new Error('Sign in required'),{status:401});
    const user=await first(env,'SELECT email,display_name,role,groups_json,is_boss,identity_id,enabled,language_switch_enabled,avatar_id FROM users WHERE email=?',session.email);
    if(!user?.enabled) throw Object.assign(new Error('Access not granted'),{status:403});
    user.groups=JSON.parse(user.groups_json);delete user.groups_json;
    if(user.email===clean(env.ADMIN_EMAIL,254).toLowerCase())user.display_name='Admin';
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
  if(admin && email===admin) await run(env,"INSERT INTO users(email,display_name,role,groups_json) VALUES(?,?,'admin','[\"QA\"]') ON CONFLICT(email) DO NOTHING",email,'Admin');
  if(env.BOSS_EMAIL && email===env.BOSS_EMAIL.toLowerCase()) await run(env,"INSERT INTO users(email,display_name,role,is_boss,groups_json) VALUES(?,?,'member',1,'[\"Management\"]') ON CONFLICT(email) DO NOTHING",email,'Boss');
  const user=await first(env,'SELECT email,display_name,role,groups_json,is_boss,identity_id,enabled,language_switch_enabled,avatar_id FROM users WHERE email=?',email);
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
  await run(env,"UPDATE users SET display_name='Admin' WHERE email=?",u.email);return sessionResponse(env,u.email);
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
async function task(env,taskId,includeArchived=false){const t=await first(env,'SELECT * FROM tasks WHERE id=? AND deleted=0'+(includeArchived?'':' AND archived=0'),taskId); if(!t) throw Object.assign(new Error('Task not found'),{status:404}); return {...t,...currentStageDue(t)};}
async function office(env,oid,user){const o=await first(env,'SELECT * FROM office_logs WHERE id=? AND deleted=0',oid); if(!o || (!isRole(user,'boss') && o.owner_email!==user.email)) throw Object.assign(new Error('Office record not found'),{status:404}); return o;}
async function addActivity(env,taskId,actor,kind,date,environment,result,notes,prUrl='',isWork=1,acknowledgesComments=false,minutes=0,workRole=''){
 const workTask=await first(env,'SELECT work_kind,pm_owner FROM tasks WHERE id=?',taskId);const person=await first(env,'SELECT groups_json,role FROM users WHERE email=?',actor);const groups=JSON.parse(person?.groups_json||'[]');if(workRole&&!['Other',...groups.filter(g=>g!=='Management'),...(person?.role==='admin'?['Engineering','QA','PM']:[]),...(isWork&&['Development','PR','Merge','Deployment'].includes(kind)?['Engineering']:[]),...(person&&JSON.parse(person.groups_json||'[]').includes('QA')?['QA']:[])].includes(workRole))throw Object.assign(new Error('Choose one of your work roles'),{status:400});const recordedRole=workRole||(kind==='QA Testing'?'QA':['Development','PR','Merge','Deployment'].includes(kind)?'Engineering':kind==='Requirement'&&groups.includes('PM')?'PM':hasPmOrigin(workTask||{})&&groups.includes('PM')?'PM':'Other');
 const aid=id();await run(env,`INSERT INTO activities(id,task_id,actor_email,action_type,activity_date,environment,result,notes,github_pr_url,is_work,acknowledges_comments,minutes,work_role) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,aid,taskId,actor,kind,date,environment,result,notes,prUrl,isWork,acknowledgesComments?1:0,minutes,recordedRole);return aid;
}
function stepEnvironment(status,current='—'){return status==='In Development'?'Local':['PR Submitted','Merged / Awaiting Stage'].includes(status)?'PR':['On Stage','Approved for Production','Awaiting Production Deploy'].includes(status)?'Stage':status==='On Production'?'Production':['New Request','Under Review','Approved'].includes(status)?'—':current;}
const FEASIBILITY=['Pending','Confirmed','Needs Clarification','Cannot Complete'];
const ENGINEERING_STAGES=['In Development','PR Submitted','Merged / Awaiting Stage'];
function qaReady(t){return (t.work_kind!=='PM Task'||engineeringTask(t))&&t.development_status==='On Stage'&&!!t.stage_confirmed_at;}
function productionReady(t){return (t.work_kind!=='PM Task'||engineeringTask(t))&&['On Stage','Approved for Production','Awaiting Production Deploy'].includes(t.development_status)&&t.qa_status==='Passed'&&!!t.stage_confirmed_at&&t.qa_passed_stage_at===t.stage_confirmed_at;}
function workflowGuide(t){
 if(t.planning_status==='Backlog'||t.planning_status==='Planned')return {revision:t.workflow_revision,owner:'',role:t.work_kind||'Engineering',phase:'planning',instruction:'Planned work. Activate when ready to start.',actions:[]};
 if(t.work_kind==='PM Task'&&!engineeringTask(t))return pmWorkflowGuide(t);
 if(simpleTask(t))return {revision:t.workflow_revision,owner:t.work_status==='Completed'?'':t.assignee,role:t.work_kind,phase:t.work_status==='Completed'?'done':'simple',instruction:'Record activity and update the task status. QA and Release are not required.',actions:[]};
 const base={revision:t.workflow_revision,owner:t.next_action_owner||t.assignee,role:'Engineering'};
 if(t.archived)return {...base,phase:'archived',instruction:'Restore this task to continue.',actions:[]};
 if(t.development_status==='Closed')return {...base,phase:'done',owner:'',instruction:'Task completed. Review the history below.',actions:[]};
 if(t.development_status==='On Production')return {...base,phase:'done',owner:'',instruction:'Production deployment is complete. Review the history below.',actions:[]};
 if(qaReady(t)&&!productionReady(t))return {...base,phase:'qa',role:'QA',owner:t.qa_owner||t.next_action_owner,instruction:'The engineer has confirmed this change is merged to Stage and ready to test. Test it and record the result. Issues return to Engineering.',actions:['qa']};
 if(productionReady(t))return {...base,phase:'production',owner:t.assignee,instruction:'QA passed this Stage build. Deploy to Production, verify the result, then confirm here to include it in the version update.',actions:['production']};
 if(t.feasibility!=='Confirmed')return {...base,phase:'review',instruction:hasPmOrigin(t)?'Review the PM design. Choose Confirmed and a delivery date to start Engineering; Needs Clarification or Cannot Complete returns the task to PM with your explanation.':t.feasibility==='Pending'?'Review feasibility, choose the engineer and confirm the estimated delivery date.':t.feasibility==='Cannot Complete'?'On hold: engineer cannot complete this request. Revise the scope and review again.':'Clarify the request, then confirm feasibility and delivery date.',actions:['review']};
 const owners=[...new Set([t.pr_reviewer,t.assignee].filter(Boolean))];
 if(t.development_status==='PR Submitted')return {...base,phase:'pr_review',owner:t.pr_reviewer||t.assignee,owners,instruction:'Choose the PR reviewer, then confirm review and merge. The engineer owner or another Engineering task owner can record this on behalf of the reviewer.',actions:['assign-pr-reviewer','pr-review','progress']};
 if(t.development_status==='Merged / Awaiting Stage')return {...base,phase:'stage_deploy',owner:t.assignee,owners,instruction:'PR review and merge are complete. Deploy the merged build to Stage, verify it is ready to test, then select QA and confirm the handoff.',actions:['stage','progress']};
 return {...base,phase:'development',owner:t.assignee,instruction:t.qa_status!=='Not Tested'?'Address the QA feedback. Confirm the fixed build is merged to Stage and ready to test, then hand it back to QA in the same step.':'Continue engineering work. Confirm merged to Stage and assign QA in one step, only when the build is available for testing.',actions:['progress','stage']};
}
const taskSignals=createTaskSignals({all,first,sql,workflowGuide,id,stamp});
async function workflowMember(env,email,group){
 await validMember(env,email);
 const u=await first(env,'SELECT groups_json FROM users WHERE email=? AND enabled=1',email);
 if(!u||!JSON.parse(u.groups_json).includes(group))throw Object.assign(new Error('Choose an active '+group+' member'),{status:400});
}
function developmentTransition(t,target){
 if(!DEV.includes(target))throw Object.assign(new Error('Invalid development status'),{status:400});
 if(['In Development','PR Submitted','Merged / Awaiting Stage','On Stage','Approved for Production','Awaiting Production Deploy','On Production'].includes(target)&&t.feasibility!=='Confirmed')throw Object.assign(new Error('Engineer must confirm feasibility and delivery first'),{status:409});
 if(['Approved for Production','Awaiting Production Deploy','On Production'].includes(target)&&!productionReady(t))throw Object.assign(new Error('QA must pass the current Stage build before Production'),{status:409});
 if(target==='Closed'&&!['On Production','Closed'].includes(t.development_status))throw Object.assign(new Error('Confirm Production deployment before closing the task'),{status:409});
 if(['Merged / Awaiting Stage','On Stage'].includes(target)&&t.development_status==='PR Submitted'&&!t.pr_review_merged_at)throw Object.assign(new Error('Confirm PR review and merge before deploying to Stage'),{status:409});
 const c={development_status:target==='On Production'?'Closed':target,current_environment:stepEnvironment(target,t.current_environment)};if(target==='On Production'){c.production_completed_date=fmtDate();c.completed_date=fmtDate();c.planning_status='Completed';}if(target==='Closed')c.completed_date=t.completed_date||fmtDate();else if(t.development_status==='Closed')c.completed_date='';
 if(target==='On Stage'&&t.development_status!=='On Stage'){
  if(!t.qa_owner)throw Object.assign(new Error('Choose the QA owner before confirming Stage'),{status:400});
  c.stage_confirmed_at=stamp();c.qa_passed_stage_at='';c.qa_status=t.qa_status==='Not Tested'?'Not Tested':'Retest Required';c.next_action_owner=t.qa_owner;
 }else if(['New Request','Under Review','Approved','In Development','PR Submitted','Merged / Awaiting Stage','On Hold'].includes(target)){
  c.stage_confirmed_at='';c.qa_passed_stage_at='';c.next_action_owner=t.primary_owner||t.assignee;
 }else if(['Approved for Production','Awaiting Production Deploy'].includes(target))c.next_action_owner=t.primary_owner||t.assignee;
 else if(['On Production','Closed'].includes(target))c.next_action_owner='';
 if(['In Development','PR Submitted'].includes(target)){c.pr_review_merged_at='';c.pr_review_confirmed_by='';if(target==='PR Submitted')c.next_action_owner=t.pr_reviewer||t.assignee;}
 return c;
}
function qaTransition(t,result){
 if(!qaReady(t))throw Object.assign(new Error('Engineer must confirm this build is on Stage before QA testing'),{status:409});
 if(!QA.includes(result))throw Object.assign(new Error('Choose a QA result'),{status:400});
 if(['Not Tested','Retest Required'].includes(result))return {qa_status:result,qa_passed_stage_at:''};
 if(result==='Passed')return {qa_status:result,qa_passed_stage_at:t.stage_confirmed_at,development_status:'Approved for Production',next_action_owner:t.assignee};
 return {pr_review_merged_at:'',pr_review_confirmed_by:'',qa_status:result,qa_passed_stage_at:'',stage_confirmed_at:'',development_status:'In Development',current_environment:'Local',next_action_owner:t.assignee};
}
async function saveTaskTransition(env,t,changes,expected=t.workflow_revision){
 const fields=Object.keys(changes),result=await run(env,`UPDATE tasks SET ${fields.map(f=>f+'=?').join(',')},updated_at=?,workflow_revision=workflow_revision+1 WHERE id=? AND workflow_revision=? AND archived=0 AND deleted=0`,...fields.map(f=>changes[f]),stamp(),t.id,expected);
 if(!(result.meta?.changes??result.changes))throw Object.assign(new Error('Task changed. Refresh it before confirming the next step.'),{status:409});
}
const ENVIRONMENTS=['—','Local','PR','Stage','Production'];
function validUrl(value){if (!value) return '';try {const u=new URL(value);if (u.protocol!=='https:'||u.hostname!=='github.com') throw 0;return u.href.slice(0,600);}catch {throw Object.assign(new Error('PR link must be a github.com HTTPS URL'),{status:400});}}
function requireDate(v){const d=clean(v,10)||fmtDate();if(!isDate(d)) throw Object.assign(new Error('Date must use YYYY-MM-DD'),{status:400});return d;}
function dashboardTask(t){const keys=['id','title','type','category','work_kind','priority','sort_order','planning_status','assignee','primary_owner','next_action_owner','qa_owner','created_by','workflow','current_due_date','current_due_label','follow_up','qa_status','development_status','work_status','pm_stage','urgency'];return Object.fromEntries(keys.map(k=>[k,t[k]]));}
async function queryTasks(env,archived=0){const rows=await all(env,`SELECT t.*, (SELECT MAX(recorded_at) FROM stage_changes h WHERE h.task_id=t.id AND h.undone=0) last_stage_progress_at, (SELECT MAX(COALESCE((SELECT e.activity_date FROM activity_edits e WHERE e.activity_id=a.id ORDER BY e.rowid DESC LIMIT 1),a.activity_date)) FROM activities a WHERE a.task_id=t.id AND a.is_work=1 AND a.comment_id IS NULL AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id)) last_progress_date, (SELECT MAX(activity_date) FROM activities a WHERE a.task_id=t.id AND a.action_type IN ('Development','PR','Merge','Deployment') AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id)) last_engineer_action, (SELECT MAX(activity_date) FROM activities a WHERE a.task_id=t.id AND a.is_work=1 AND a.action_type='QA Testing' AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id)) last_qa_action, (SELECT COUNT(*) FROM activities a WHERE a.task_id=t.id) activity_count FROM tasks t WHERE deleted=0 AND archived=? ORDER BY CASE WHEN development_status='Closed' THEN 1 ELSE 0 END, CASE priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,sort_order ASC,updated_at DESC`,archived);return rows.map(t=>{const result={...t,...currentStageDue(t),workflow:workflowGuide(t)};return {...result,follow_up:followUpState(result)};});}
async function releasePlan(env){
 const releases=await all(env,'SELECT * FROM releases ORDER BY planned_date DESC,created_at DESC');
 const delivered=new Set(releases.filter(r=>r.status==='Released').flatMap(r=>JSON.parse(r.task_ids_json)));
 for(const r of releases)if(r.status==='Planned')r.selected_task_ids=JSON.parse(r.task_ids_json).filter(id=>!delivered.has(id));
 const next=releases.filter(r=>r.status==='Planned').sort((a,b)=>a.planned_date.localeCompare(b.planned_date)||a.created_at.localeCompare(b.created_at))[0];
 if(next){
  const last=releases.filter(r=>r.status==='Released').sort((a,b)=>b.released_date.localeCompare(a.released_date))[0];
  const date=new Date(next.planned_date+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-7);
  const start=last?.released_date||date.toISOString().slice(0,10),end=next.planned_date<fmtDate()?fmtDate():next.planned_date;
  const candidates=await all(env,`SELECT t.id FROM tasks t WHERE t.archived=0 AND t.deleted=0 AND t.work_kind='Engineering' AND (
   (t.development_status IN ('On Stage','Approved for Production','Awaiting Production Deploy') AND t.qa_status='Passed' AND t.stage_confirmed_at<>'' AND t.qa_passed_stage_at=t.stage_confirmed_at AND (t.qa_completed_date='' OR t.qa_completed_date<=?))
   OR (t.development_status IN ('On Production','Closed') AND ((t.production_completed_date>? AND t.production_completed_date<=?) OR EXISTS(SELECT 1 FROM activities a WHERE a.task_id=t.id AND a.action_type IN ('Development','Deployment') AND (a.environment='On Production' OR a.result='On Production') AND a.activity_date>? AND a.activity_date<=? AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id)))))`,end,start,end,start,end);
  const reserved=new Set(releases.filter(r=>r.status==='Planned'&&r.id!==next.id).flatMap(r=>r.selected_task_ids));
  next.auto_candidates=candidates.filter(t=>!delivered.has(t.id)&&!reserved.has(t.id)).map(t=>t.id);
  next.auto_start=start;next.auto_end=end;
  const excluded=new Set(JSON.parse(next.auto_excluded_json||'[]'));
  next.task_ids_json=JSON.stringify([...new Set([...JSON.parse(next.task_ids_json),...next.auto_candidates.filter(id=>!excluded.has(id))])].filter(id=>!delivered.has(id)));
 }
 for(const r of releases)if(r.status==='Planned')r.task_ids_json=JSON.stringify(JSON.parse(r.task_ids_json).filter(id=>!delivered.has(id)));
 return {releases,delivered};
}
function upcomingWednesday(after){const date=new Date(after+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+((3-date.getUTCDay()+7)%7||7));return date.toISOString().slice(0,10);}
async function automaticReleaseDraft(env,after=fmtDate(),reservedVersion=''){
 const last=await first(env,"SELECT MAX(released_date) date FROM releases WHERE status='Released'");
 const planned=upcomingWednesday([fmtDate(),after,last?.date||''].sort().at(-1)),rid=id();let count=(await first(env,'SELECT COUNT(*) n FROM releases WHERE planned_date=?',planned)).n,version='Release '+planned+(count?' ('+(count+1)+')':'');
 while(version===reservedVersion||await first(env,'SELECT id FROM releases WHERE version=?',version)){count++;version='Release '+planned+' ('+(count+1)+')';}
 return {id:rid,version,planned_date:planned};
}
function automaticReleaseInsert(env,draft,actor,guard='1=1',params=[]){
 return sql(env,`INSERT INTO releases(id,version,planned_date,created_by,is_auto) SELECT ?,?,?,?,1 WHERE ${guard} AND NOT EXISTS(SELECT 1 FROM releases WHERE status='Planned' AND (is_auto=1 OR planned_date<=?))`,draft.id,draft.version,draft.planned_date,actor,...params,draft.planned_date);
}
async function ensureRelease(env,actor,after=fmtDate()){
 const draft=await automaticReleaseDraft(env,after);await automaticReleaseInsert(env,draft,actor).run();
 return first(env,"SELECT * FROM releases WHERE status='Planned' ORDER BY planned_date,created_at,id LIMIT 1");
}
async function validateParent(env,taskId,parent){if(!parent)return;const seen=new Set([taskId]);let current=parent;while(current){if(seen.has(current))throw Object.assign(new Error('Parent task would create a cycle'),{status:400});seen.add(current);const t=await task(env,current);current=t.parent_task_id;}}
const PRIVATE_WORK_SELECT=`SELECT w.*,
 (SELECT MAX(created_at) FROM office_logs o WHERE o.deleted=0 AND o.work_item_id=w.id AND o.owner_email=w.owner_email) last_activity_at,
 (SELECT MAX(recorded_at) FROM private_work_revisions r WHERE r.work_id=w.id AND r.change_type='Edited' AND json_extract(r.details,'$.new.status')='In Progress' AND json_extract(r.details,'$.old.status')<>'In Progress') progress_started_at
 FROM private_work w`;
// Count weekdays after the starting local date; Friday reaches three on Wednesday.
export function businessDaysSince(since,now=new Date()){
 const localDate=value=>isDate(String(value))?String(value):new Date(value).toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'});
 const start=new Date(localDate(since)+'T12:00:00Z'),end=new Date(localDate(now)+'T12:00:00Z');
 const days=Math.floor((end-start)/86400000);if(!Number.isFinite(days)||days<=0)return 0;
 let count=Math.floor(days/7)*5;for(let day=1;day<=days%7;day++){const weekday=(start.getUTCDay()+day)%7;if(weekday!==0&&weekday!==6)count++;}return count;
}
export function withInactivityReminder(item,now=new Date()){
 const since=[item.created_at,item.progress_started_at,item.last_activity_at,item.recurrence_rule&&item.recurrence_rule!=='none'?item.next_due_date:null].filter(Boolean).sort().at(-1),days=businessDaysSince(since,now);
 return {...item,inactivity_reminder:!item.archived&&item.kind==='Task'&&item.status==='In Progress'&&days>=3?{business_days:days,since,last_activity_at:item.last_activity_at||null}:null};
}
async function privateItem(env,iid,user){const item=await first(env,PRIVATE_WORK_SELECT+' WHERE w.id=? AND w.deleted=0',iid);if(!item||((!isRole(user,'boss')||hasPersonalWorkGroups(user))&&item.owner_email!==user.email))throw Object.assign(new Error('Private task not found'),{status:404});return withInactivityReminder(item);}
const REPEAT_RULES=['none','daily','weekly','monthly'];
function recurrenceConfig(d,item={}){
 const rule=clean(d.recurrence_rule??item.recurrence_rule,20)||'none';
 if(!REPEAT_RULES.includes(rule))throw Object.assign(new Error('Choose daily, weekly, monthly, or no repeat'),{status:400});
 const due=rule==='none'?'':clean(d.next_due_date??item.next_due_date,10)||fmtDate();
 if(due&&!isDate(due))throw Object.assign(new Error('Choose a valid first due date'),{status:400});
 return {recurrence_rule:rule,next_due_date:due,recurrence_anchor_day:due?(due===item.next_due_date&&item.recurrence_anchor_day?item.recurrence_anchor_day:Number(due.slice(8))):0};
}
function nextOccurrence(item,date){
 const due=item.next_due_date;if(!due||date<due)return due;
 const current=new Date(due+'T12:00:00Z'),done=new Date(date+'T12:00:00Z');
 if(item.recurrence_rule==='daily'||item.recurrence_rule==='weekly'){
  const step=item.recurrence_rule==='weekly'?7:1,days=Math.floor((done-current)/86400000);
  current.setUTCDate(current.getUTCDate()+(Math.floor(days/step)+1)*step);return current.toISOString().slice(0,10);
 }
 let year=current.getUTCFullYear(),month=current.getUTCMonth(),next=due;
 while(next<=date){month++;if(month===12){year++;month=0;}const day=Math.min(item.recurrence_anchor_day||Number(due.slice(8)),new Date(Date.UTC(year,month+1,0)).getUTCDate());next=new Date(Date.UTC(year,month,day,12)).toISOString().slice(0,10);}
 return next;
}
function completedDate(value,fallback=fmtDate()){const date=value===undefined?fallback:clean(value,10);if(!isDate(date))throw Object.assign(new Error('Choose a valid completion date'),{status:400});return date;}
async function completeOccurrence(env,itemId,officeId,user,date,completed,{expectedDue,explicitCurrent=false}={}){
 if(!itemId||!completed)return;
 const item=await privateItem(env,itemId,user);
 if(item.recurrence_rule==='none'||item.status==='Completed')return;
 if(expectedDue!==undefined&&expectedDue!==item.next_due_date)throw Object.assign(new Error('This occurrence has changed. Refresh the task before completing it.'),{status:409});
 if(officeId&&await first(env,"SELECT id FROM private_work_revisions WHERE work_id=? AND change_type='Occurrence completed' AND json_extract(details,'$.officeId')=? LIMIT 1",item.id,officeId))return;
 if(!explicitCurrent&&date<item.next_due_date)return;
 const due=nextOccurrence(item,date<item.next_due_date?item.next_due_date:date),r=await run(env,'UPDATE private_work SET next_due_date=?,completed_date=?,updated_at=? WHERE id=? AND next_due_date=? AND status<>? AND archived=0',due,date,stamp(),item.id,item.next_due_date,'Completed');
 if(!(r.meta?.changes??r.changes)){if(explicitCurrent)throw Object.assign(new Error('This occurrence has changed. Refresh the task before completing it.'),{status:409});return;}
 await run(env,'INSERT INTO private_work_revisions(id,work_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',id(),item.id,user.email,'Occurrence completed',JSON.stringify({officeId,work_date:date,completed_date:date,old_due:item.next_due_date,next_due:due}));return {next_due_date:due,completed_date:date};
}
async function requestedTaskCompletion(env,user,d,itemId,status,date=fmtDate()){
 if(d.complete_task===undefined||d.complete_task===false)return null;
 if(d.complete_task!==true)throw Object.assign(new Error('Task completion must be true or false'),{status:400});
 if(!itemId||status!=='Completed')throw Object.assign(new Error('Choose a task and a Completed activity result before completing the task'),{status:400});
 const item=await privateItem(env,itemId,user);
 if(item.owner_email!==user.email)throw Object.assign(new Error('Forbidden'),{status:403});
 if(item.kind!=='Task'||item.archived)throw Object.assign(new Error('Only an active task can be completed with an activity'),{status:400});
 return {...item,completion_date:completedDate(d.completed_date,date)};
}
async function finishPrivateTask(env,user,item,officeId){
 if(!item||item.status==='Completed')return;
 if(item.recurrence_rule!=='none'){await completeOccurrence(env,item.id,officeId,user,item.completion_date,true);return;}
 const result=await run(env,"UPDATE private_work SET status='Completed',completed_date=?,updated_at=? WHERE id=? AND status<>'Completed'",item.completion_date,stamp(),item.id);
 if(result.meta?.changes??result.changes)await run(env,'INSERT INTO private_work_revisions(id,work_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',id(),item.id,user.email,'Completed with activity',JSON.stringify({officeId,old_status:item.status,new_status:'Completed',completed_date:item.completion_date}));
}
async function contributors(env,t){const people=await all(env,`SELECT actor_email person FROM activities WHERE task_id=? AND is_work=1 UNION SELECT actor_email person FROM comments WHERE task_id=? UNION SELECT owner_email person FROM attachments WHERE task_id=?`,t.id,t.id,t.id);return [...new Set([t.created_by,...people.map(x=>x.person)].filter(p=>p&&p!=='github-sync'&&p!=='system'))];}
async function taskDisposition(env,t){const people=await contributors(env,t),children=await first(env,'SELECT id FROM tasks WHERE parent_task_id=? AND deleted=0 LIMIT 1',t.id),shipped=await first(env,"SELECT id FROM releases WHERE status='Released' AND EXISTS(SELECT 1 FROM json_each(releases.task_ids_json) WHERE value=?) LIMIT 1",t.id);return {people,mode:people.length>1||children||shipped?'Archived':'Deleted',reason:people.length>1?'Multiple contributors':children?'Has child tasks':shipped?'Included in a released version':'Single contributor'};}
async function validMember(env,email){if(!email)return;const u=await first(env,'SELECT enabled,groups_json FROM users WHERE email=?',email);if(!u||!u.enabled||(JSON.parse(u.groups_json).includes('Management')&&!hasPersonalWorkGroups({groups:JSON.parse(u.groups_json)})))throw Object.assign(new Error('Choose an active team member'),{status:400});}
async function taskCategories(env){return (await all(env,`SELECT c.name FROM task_categories c LEFT JOIN tasks t ON t.category=c.name COLLATE NOCASE AND t.deleted=0 GROUP BY c.name ORDER BY COUNT(t.id) DESC,c.name COLLATE NOCASE`)).map(c=>c.name);}
function categoryName(value){
 if(typeof value!=='string')throw Object.assign(new Error('Enter a category name'),{status:400});
 const name=value.trim().replace(/\s+/g,' ');
 if(!name||name.length>80||name==='__add_category__'||name==='all'||/[\x00-\x1f\x7f]/.test(name))throw Object.assign(new Error('Category name must be 1–80 characters'),{status:400});
 return name;
}
async function ensureTaskCategory(env,value){
 const name=categoryName(value);
 await run(env,'INSERT INTO task_categories(name) VALUES(?) ON CONFLICT(name) DO NOTHING',name);
 return (await first(env,'SELECT name FROM task_categories WHERE name=? COLLATE NOCASE',name)).name;
}
function avatarImageType(bytes){const b=new Uint8Array(bytes);if(b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return 'image/png';if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';const ascii=(start,end)=>String.fromCharCode(...b.slice(start,end));if(b.length>=12&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')return 'image/webp';if(b.length>=6&&['GIF87a','GIF89a'].includes(ascii(0,6)))return 'image/gif';return '';}
async function api(req,env){
 const url=new URL(req.url), p=url.pathname, method=req.method;
 if(p==='/api/health') return ok({ok:true});
 if(p.startsWith('/api/auth/'))return authApi(req,env);
 if(env.DEV_AUTH!=='1')checkOrigin(req);
 const user=await currentUser(req,env);
 // Manager-only accounts and the team perspective stay read-only; combined groups can work in their personal perspective.
 const teamView=isBossUser(user)&&(!hasPersonalWorkGroups(user)||req.headers.get('x-workspace-mode')==='team');
 // Urgent communication is an explicit, narrowly scoped exception for anyone who can access shared tasks.
 const urgentRoute=p.match(/^\/api\/tasks\/([a-f0-9-]{36})\/urgent$/);
 if(urgentRoute&&method==='POST'){const t=await task(env,urgentRoute[1],true),d=await json(req);return ok(await taskSignals.perform(env,t,user,clean(d.action,30)));}
 if(teamView && method!=='GET' && method!=='HEAD' && !(((p==='/api/password'||p==='/api/instructions/ack')&&method==='POST')||(p==='/api/avatar'&&['POST','DELETE'].includes(method)))) return err('Team overview is read-only',403);
 if(p==='/api/me' && method==='GET') return ok({user,instructions:await userInstructions(env,user),devMode:env.DEV_AUTH==='1' && ['127.0.0.1','localhost'].includes(new URL(req.url).hostname),statuses:{work_groups:Object.keys(WORK_GROUPS),development:DEV,qa:QA,qa_results:QA_RESULTS,types:['New Feature','Bug Fix','Improvement'],categories:await taskCategories(env),priorities:PRIORITIES,actions:ACTIONS}});
 if(p==='/api/avatar'&&method==='POST'){
  if(!env.BUCKET)return err('Avatar storage is not configured',503);
  const form=await req.formData(),file=form.get('file'),target=clean(form.get('email'),254).toLowerCase();if(target&&target!==user.email)return err('You can change only your own avatar',403);
  if(!(file instanceof File)||!file.size||file.size>8*1024*1024)return err('Choose a photo up to 8 MB');
  const bytes=await file.arrayBuffer(),type=avatarImageType(bytes);if(!type)return err('Choose a PNG, JPG, WebP or GIF image');
  const aid=id(),key='avatars/'+aid;await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});
  try{await run(env,'INSERT INTO user_avatars(id,owner_email,object_key,content_type,byte_size) VALUES(?,?,?,?,?)',aid,user.email,key,type,file.size);await run(env,'UPDATE users SET avatar_id=? WHERE email=?',aid,user.email);}catch(error){await env.BUCKET.delete(key);await run(env,'DELETE FROM user_avatars WHERE id=?',aid);throw error;}
  if(user.avatar_id){const old=await first(env,'SELECT object_key FROM user_avatars WHERE id=? AND owner_email=?',user.avatar_id,user.email);await run(env,'DELETE FROM user_avatars WHERE id=? AND owner_email=?',user.avatar_id,user.email);if(old)await env.BUCKET.delete(old.object_key);}
  return ok({avatar_id:aid},201);
 }
 if(p==='/api/avatar'&&method==='DELETE'){
  const old=user.avatar_id?await first(env,'SELECT object_key FROM user_avatars WHERE id=? AND owner_email=?',user.avatar_id,user.email):null;
  await run(env,"UPDATE users SET avatar_id='' WHERE email=?",user.email);if(user.avatar_id)await run(env,'DELETE FROM user_avatars WHERE id=? AND owner_email=?',user.avatar_id,user.email);if(old)await env.BUCKET?.delete(old.object_key);return ok({avatar_id:''});
 }
 const avatarRoute=p.match(/^\/api\/avatars\/([a-f0-9-]{36})$/);
 if(avatarRoute&&['GET','HEAD'].includes(method)){const a=await first(env,'SELECT a.object_key,a.content_type FROM user_avatars a JOIN users u ON u.avatar_id=a.id AND u.email=a.owner_email WHERE a.id=? AND u.enabled=1',avatarRoute[1]);if(!a)return err('Avatar not found',404);const object=await env.BUCKET?.get(a.object_key);if(!object)return err('Avatar not found',404);return new Response(method==='HEAD'?null:object.body,{headers:{'content-type':a.content_type,'cache-control':'private, max-age=86400','x-content-type-options':'nosniff'}});}
 if(p==='/api/categories' && method==='GET')return ok({categories:await taskCategories(env)});
 if(p==='/api/categories' && method==='POST'){
  const d=await json(req),name=await ensureTaskCategory(env,d.name);
  return ok({name,categories:await taskCategories(env)},201);
 }
 if(p==='/api/instructions/ack' && method==='POST'){
  const d=await json(req);
  const ids=Array.isArray(d.ids)?[...new Set(d.ids)]:[d.id],available=[...instructionGuides(user),...featureIntroductions(user)];
  if(!ids.length||ids.length>100||ids.some(id=>typeof id!=='string'||!available.some(g=>g.id===id)))return err('Instruction is not available to this account',404);
  const date=stamp();await env.DB.batch(ids.map(id=>sql(env,'INSERT INTO instruction_acknowledgements(email,instruction_id,acknowledged_at) VALUES(?,?,?) ON CONFLICT(email,instruction_id) DO NOTHING',user.email,id,date)));
  return ok({id:d.id,ids,acknowledged:true});
 }
 if(p==='/api/export' && method==='GET'){
   if(!isRole(user,'admin')) return err('Only Admin can export workspace data',403);
   const result={exported_at:stamp(),format:'work-tracker-v2',tables:{}};
   // Admin exports only shared workspace data and their own private work.
   // Full tenant backup, including other people's private records, must occur at DB infrastructure level.
   for(const name of ['users','tasks','activities','comments','releases','activity_edits','stage_changes','excluded_activities','qa_rounds','discussion_actions','discussion_action_history','task_collaborator_work','work_links','attachment_change_history']) result.tables[name]=await all(env,`SELECT * FROM ${name}`);
   result.tables.task_urgency=await all(env,'SELECT * FROM task_urgency');
   result.tables.urgent_events=await all(env,'SELECT * FROM urgent_events');
   result.tables.urgent_acknowledgements=await all(env,'SELECT * FROM urgent_acknowledgements');
   result.tables.task_numbers=await all(env,"SELECT * FROM task_numbers WHERE entity='shared' OR (entity='private' AND entity_id IN(SELECT id FROM private_work WHERE owner_email=?))",user.email);
   result.tables.private_work=await all(env,'SELECT * FROM private_work WHERE owner_email=?',user.email);
   result.tables.private_work_revisions=await all(env,'SELECT r.* FROM private_work_revisions r JOIN private_work w ON w.id=r.work_id WHERE w.owner_email=?',user.email);
   result.tables.office_logs=await all(env,'SELECT * FROM office_logs WHERE deleted=0 AND owner_email=?',user.email);
   result.tables.office_revisions=await all(env,'SELECT r.* FROM office_revisions r JOIN office_logs o ON o.id=r.office_id WHERE o.owner_email=?',user.email);
   result.tables.attachments=await all(env,'SELECT * FROM attachments WHERE (office_id IS NULL AND private_work_id IS NULL) OR office_id IN (SELECT id FROM office_logs WHERE deleted=0 AND owner_email=?) OR private_work_id IN (SELECT id FROM private_work WHERE owner_email=?)',user.email,user.email);
   return new Response(JSON.stringify(result,null,2),{headers:{'content-type':'application/json','content-disposition':`attachment; filename="work-tracker-backup-${fmtDate()}.json"`,'cache-control':'no-store'}});
 }
 if(p==='/api/releases/ensure' && method==='POST'){if(!isRole(user,'admin','engineer'))return err('Engineering permission required',403);return ok({release:await ensureRelease(env,user.email)});}
 if(p==='/api/releases' && method==='GET'){await ensureRelease(env,'system');return ok({releases:(await releasePlan(env)).releases});}
 if(p==='/api/releases' && method==='POST'){
  if(!isRole(user,'admin','engineer'))return err('Only Engineering or Admin can manage releases',403);
  const d=await json(req),version=clean(d.version,60),planned=clean(d.planned_date,10);
  if(!version)return err('Version name is required');
  if(!isDate(planned))return err('Choose the planned release date');
  if(await first(env,'SELECT id FROM releases WHERE version=?',version))return err('Version already exists',409);
  const rid=id();await run(env,'INSERT INTO releases(id,version,planned_date,created_by,notes,is_auto) VALUES(?,?,?,?,?,0)',rid,version,planned,user.email,clean(d.notes,10000));return ok({id:rid},201);
 }
 if(p.startsWith('/api/releases/') && method==='PATCH'){
  if(!isRole(user,'admin','engineer'))return err('Only Engineering or Admin can manage releases',403);
  const rid=p.slice('/api/releases/'.length),r=await first(env,'SELECT * FROM releases WHERE id=?',rid);
  if(!r)return err('Release not found',404);if(r.status==='Released')return err('Released versions are locked',409);
  const plan=await releasePlan(env),effective=plan.releases.find(x=>x.id===rid);
  const d=await json(req),ids=Array.isArray(d.task_ids)?[...new Set(d.task_ids)]:JSON.parse(effective.task_ids_json);
  const revision=d.plan_revision===undefined?r.plan_revision:d.plan_revision;
  if(!Number.isInteger(revision)||revision!==r.plan_revision)return err('Release plan changed. Refresh it before saving.',409);
  if(ids.some(id=>plan.delivered.has(id)))return err('Task already belongs to a released version',409);
  if(ids.length>500)return err('Too many tasks');
  const other=plan.releases.find(x=>x.id!==rid&&x.status==='Planned'&&x.selected_task_ids.some(id=>ids.includes(id)));
  if(other)return err('Task already selected in '+other.version+'. Remove it from that plan first.',409);
  const tasks=[];for(const tid of ids){if(typeof tid!=='string')return err('Invalid task');const selected=await task(env,tid);if(simpleTask(selected))return err('Quick Tasks and PM Tasks do not belong to Engineering releases');tasks.push(selected);}
  const version=d.version===undefined?r.version:clean(d.version,60);if(!version)return err('Version name is required');
  if(version!==r.version&&await first(env,'SELECT id FROM releases WHERE version=? AND id<>?',version,rid))return err('Version already exists',409);
  if(d.planned_date!==undefined&&!isDate(clean(d.planned_date,10)))return err('Choose the planned release date');
  const notes=d.notes===undefined?r.notes:clean(d.notes,10000),planned=d.planned_date===undefined?r.planned_date:requireDate(d.planned_date);
  // Reserve each task in one plan. The SQL guard covers concurrent edits, too.
  const selectionGuard=`NOT EXISTS(SELECT 1 FROM releases other,json_each(other.task_ids_json) pick WHERE other.id<>? AND pick.value IN (SELECT value FROM json_each(?)))`;
  if(d.publish===true){
   const ready=tasks.filter(t=>['On Production','Closed'].includes(t.development_status)),deferred=tasks.filter(t=>!['On Production','Closed'].includes(t.development_status));
   if(!ready.length)return err('Select at least one task that is On Production or Closed');
   const date=requireDate(d.released_date);
   const readyIds=JSON.stringify(ready.map(t=>t.id)),deferredIds=JSON.stringify(deferred.map(t=>t.id)),draft=await automaticReleaseDraft(env,date,version);
   const guard="EXISTS(SELECT 1 FROM releases WHERE id=? AND status='Released' AND plan_revision=? AND rollover_release_id='')",params=[rid,revision+1];
   // D1 batch is transactional: either snapshot, next plan and carryover all succeed,
   // or the release remains editable. Repeated confirmation cannot duplicate a release.
   const results=await env.DB.batch([
    sql(env,`UPDATE releases SET status='Released',released_date=?,published_by=?,version=?,notes=?,planned_date=?,task_ids_json=?,snapshot_json=?,deferred_task_ids_json=?,plan_revision=plan_revision+1 WHERE id=? AND status='Planned' AND plan_revision=? AND ${selectionGuard} AND NOT EXISTS(SELECT 1 FROM tasks WHERE id IN (SELECT value FROM json_each(?)) AND (development_status NOT IN ('On Production','Closed') OR archived=1 OR deleted=1))`,date,user.email,version,notes,planned,readyIds,JSON.stringify(ready.map(t=>({id:t.id,title:t.title,type:t.type,project:t.project,category:t.category,parent_task_id:t.parent_task_id,development_status:t.development_status,qa_status:t.qa_status,github_pr_url:t.github_pr_url}))),deferredIds,rid,revision,rid,JSON.stringify(ids),readyIds),
    automaticReleaseInsert(env,draft,user.email,guard,params),
    sql(env,`UPDATE releases SET task_ids_json=(SELECT json_group_array(value) FROM (SELECT value FROM json_each(releases.task_ids_json) UNION SELECT value FROM json_each(?))),auto_excluded_json=(SELECT json_group_array(value) FROM json_each(releases.auto_excluded_json) WHERE value NOT IN (SELECT value FROM json_each(?))),plan_revision=plan_revision+1 WHERE id=(SELECT id FROM releases WHERE status='Planned' ORDER BY planned_date,created_at,id LIMIT 1) AND ${guard} AND json_array_length(?)>0`,deferredIds,deferredIds,...params,deferredIds),
    sql(env,`UPDATE releases SET rollover_release_id=(SELECT id FROM releases WHERE status='Planned' ORDER BY planned_date,created_at,id LIMIT 1) WHERE id=? AND status='Released' AND plan_revision=? AND rollover_release_id=''`,...params)
   ]);
   if(!(results[0].meta?.changes??results[0].changes))return err('Release plan or task changed. Refresh it before confirming.',409);
   const saved=await first(env,'SELECT rollover_release_id FROM releases WHERE id=?',rid);
   return ok({success:true,released_task_ids:ready.map(t=>t.id),deferred_task_ids:deferred.map(t=>t.id),next_release_id:saved.rollover_release_id});
  }
  const result=await run(env,`UPDATE releases SET version=?,notes=?,planned_date=?,task_ids_json=?,auto_excluded_json=?,plan_revision=plan_revision+1 WHERE id=? AND status='Planned' AND plan_revision=? AND ${selectionGuard}`,version,notes,planned,JSON.stringify(ids),JSON.stringify((effective.auto_candidates||[]).filter(id=>!ids.includes(id))),rid,revision,rid,JSON.stringify(ids));
  if(!(result.meta?.changes??result.changes))return err('Release plan or task selection changed. Refresh it before saving.',409);
  return ok({success:true});
 }
 if(p==='/api/users' && method==='GET') return ok({users:await all(env,"SELECT email,display_name,role,groups_json,is_boss,identity_id,enabled,avatar_id, CASE WHEN ?=1 THEN language_switch_enabled ELSE NULL END AS language_switch_enabled, CASE WHEN ?=1 THEN EXISTS(SELECT 1 FROM auth_credentials c WHERE c.email=users.email) ELSE NULL END AS has_password FROM users ORDER BY display_name,email",isRole(user,'admin')?1:0,isRole(user,'admin')?1:0)});
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
  if(Object.hasOwn(d,'language_switch_enabled')&&typeof d.language_switch_enabled!=='boolean')return err('Invalid language switching option');
  const existing=await first(env,'SELECT language_switch_enabled FROM users WHERE email=?',email);
  const languageSwitch=Object.hasOwn(d,'language_switch_enabled')?Number(d.language_switch_enabled):(existing?.language_switch_enabled||0);
  let role=clean(d.role,30);
  const groups=Array.isArray(d.groups)?[...new Set(d.groups)]:[]; const boss=groups.includes('Management')?1:0;
  if(boss&&!hasPersonalWorkGroups({groups}))role='member';
  if(groups.some(g=>!Object.hasOwn(WORK_GROUPS,g)))return err('Invalid work groups or Boss role');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['admin','member'].includes(role)) return err('Invalid email or role');
  if(email===clean(env.ADMIN_EMAIL,254).toLowerCase() && role!=='admin') return err('Cannot downgrade the configured Admin',403);
  await run(env,`INSERT INTO users(email,display_name,role,groups_json,is_boss,language_switch_enabled) VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,role=excluded.role,groups_json=excluded.groups_json,is_boss=excluded.is_boss,language_switch_enabled=excluded.language_switch_enabled,enabled=1`,email,name,role,JSON.stringify(groups),boss,languageSwitch);
  return ok({success:true},201);
 }
 const trackingResponse=await trackingRoutes(req,env,user,teamView);if(trackingResponse)return trackingResponse;
 if(p==='/api/tasks' && method==='GET') return ok({tasks:await taskSignals.decorate(env,await queryTasks(env,url.searchParams.get('archived')==='1'?1:0),user)});
 if(p==='/api/tasks' && method==='POST'){
  const d=await json(req), title=clean(d.title,160),type=clean(d.type,30)||'New Feature',priority=clean(d.priority,16)||'Medium';
  if(!title || !TYPES.includes(type) || !PRIORITIES.includes(priority)) return err('Invalid title, type or priority');
  if(clean(d.next_step,2000)||(clean(d.next_action_owner,254)&&clean(d.next_action_owner,254)!==clean(d.assignee,254)))return err('Next-step overrides were removed. Use the stage owner settings or Discussion.');
  const taskId=id(),description=clean(d.description,9000);
  const workKind=clean(d.work_kind,30)||'Engineering',planning=clean(d.planning_status,30)||'Active';if(!WORK_KINDS.includes(workKind)||!PLANNING.includes(planning)||planning==='Completed')return err('Choose a valid work type and planning status');if(workKind==='PM Task'&&!user.groups.includes('PM')&&!user.groups.includes('Engineering')&&!isRole(user,'admin'))return err('PM or Engineering permission required',403);if(clean(d.assignee,254)){if(workKind==='Quick Task')await validMember(env,clean(d.assignee,254));else await workflowMember(env,clean(d.assignee,254),workKind==='PM Task'?'PM':'Engineering');}if(clean(d.next_action_owner,254)&&workKind==='Engineering')await workflowMember(env,clean(d.next_action_owner,254),'Engineering');if(workKind!=='Engineering'&&!clean(d.assignee,254))return err('Choose the task owner');if(workKind==='PM Task'&&!PM_CATEGORIES.includes(d.work_category))return err('Choose a PM work category');
  const parent=clean(d.parent_task_id,36);await validateParent(env,taskId,parent);
  const category=await ensureTaskCategory(env,d.category||'General');
  const rank=Number((await first(env, 'SELECT COALESCE(MAX(sort_order),0) AS n FROM tasks')).n)+10;
  await run(env,`INSERT INTO tasks(id,title,description,type,priority,sort_order,project,assignee,next_action_owner,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)`,taskId,title,description,type,priority,Math.min(rank,1000000),clean(d.project,120),clean(d.assignee,254),clean(d.next_action_owner,254)||clean(d.assignee,254),user.email);
  await run(env,'UPDATE tasks SET category=?,parent_task_id=?,next_step=? WHERE id=?',category,parent,clean(d.next_step,2000),taskId);
  await run(env,'UPDATE tasks SET work_kind=?,planning_status=?,primary_owner=?,work_category=?,pm_owner=? WHERE id=?',workKind,planning,clean(d.assignee,254),clean(d.work_category,120),workKind==='PM Task'?clean(d.assignee,254):'',taskId);
  const creationRole=workKind==='PM Task'&&user.groups.includes('PM')?'PM':user.groups.includes('Engineering')?'Engineering':user.groups.includes('PM')?'PM':user.groups.includes('QA')?'QA':'Other';
  await addActivity(env,taskId,user.email,'Requirement',requireDate(d.activity_date),'','New request submitted',description||title,'',1,false,0,creationRole);
  return ok({id:taskId},201);
 }
 const tm=p.match(/^\/api\/tasks\/([a-f0-9-]{36})(?:\/(activity|comments|sync-pr|restore|archive|workflow))?$/);
 if(tm){
  const taskId=tm[1],sub=tm[2]||'',t=await task(env,taskId,true);
  if(method==='GET'&&!sub){
   const [activities,comments,attachments,disposition,tracking,decorated,urgency_events]=await Promise.all([effectiveActivities(env,taskId),all(env,'SELECT c.*,EXISTS(SELECT 1 FROM pending_task_comments p WHERE p.comment_id=c.id) pending_action FROM comments c WHERE c.task_id=? ORDER BY c.created_at ASC,c.rowid ASC',taskId),all(env,'SELECT id,task_id,activity_id,comment_id,owner_email,filename,byte_size,content_type,created_at FROM attachments WHERE deleted=0 AND task_id=? ORDER BY created_at DESC',taskId),taskDisposition(env,t),trackingTaskData(env,t),taskSignals.decorate(env,[t],user),all(env,'SELECT * FROM urgent_events WHERE task_id=? ORDER BY recorded_at DESC,rowid DESC',taskId)]);const view={...decorated[0],last_progress_date:activities.filter(a=>a.is_work&&!a.comment_id&&!a.excluded).map(a=>a.activity_date).sort().at(-1)||'',last_stage_progress_at:tracking.stage_changes.find(h=>!h.undone)?.recorded_at||''};return ok({task:{...view,follow_up:followUpState(view)},workflow:workflowGuide(t),activities,comments,attachments,contributors:disposition.people,removal_mode:disposition.mode,removal_reason:disposition.reason,urgency_events,...tracking});
  }
  if(method==='DELETE'&&!sub){
   if(!isRole(user,'admin')&&!(t.work_kind==='PM Task'&&pmOwnerAllowed(user,t)))return err('Only Admin or the PM owner can remove this task',403);
   const d=await json(req);if(d.confirm!==true)return err('Confirm this action before continuing',400);
   const disposition=await taskDisposition(env,t),people=disposition.people,archive=disposition.mode==='Archived';
   await run(env,'UPDATE tasks SET archived=?,deleted=?,updated_at=? WHERE id=?',archive?1:0,archive?0:1,stamp(),taskId);
   await run(env,'INSERT INTO task_removals(id,task_id,actor_email,action,contributor_count) VALUES(?,?,?,?,?)',id(),taskId,user.email,archive?'Archived':'Deleted',people.length);
   await run(env,"UPDATE releases SET task_ids_json=COALESCE((SELECT json_group_array(value) FROM json_each(releases.task_ids_json) WHERE value<>?), '[]') WHERE status='Planned'",taskId);
   return ok({action:disposition.mode,reason:disposition.reason});
  }
  if(method==='POST'&&sub==='archive'){
   if(!isRole(user,'admin')&&!(t.work_kind==='PM Task'&&pmOwnerAllowed(user,t)))return err('Only Admin or the PM owner can archive this task',403);
   const d=await json(req);if(d.confirm!==true)return err('Confirm archiving before continuing');
   if(t.archived)return ok({success:true});
   await run(env,'UPDATE tasks SET archived=1,updated_at=? WHERE id=?',stamp(),taskId);
   await run(env,'INSERT INTO task_removals(id,task_id,actor_email,action,contributor_count) VALUES(?,?,?,?,?)',id(),taskId,user.email,'Archived',(await contributors(env,t)).length);
   await run(env,"UPDATE releases SET task_ids_json=COALESCE((SELECT json_group_array(value) FROM json_each(releases.task_ids_json) WHERE value<>?), '[]') WHERE status='Planned'",taskId);
   return ok({success:true});
  }
  if(method==='POST'&&sub==='restore'){
   if(!isRole(user,'admin')&&!(t.work_kind==='PM Task'&&pmOwnerAllowed(user,t)))return err('Only Admin or the PM owner can restore this task',403);
   await run(env,'UPDATE tasks SET archived=0,updated_at=? WHERE id=?',stamp(),taskId);
   await run(env,'INSERT INTO task_removals(id,task_id,actor_email,action,contributor_count) VALUES(?,?,?,?,?)',id(),taskId,user.email,'Restored',(await contributors(env,t)).length);return ok({success:true});
  }
  if(t.archived&&method!=='GET')return err('Restore this archived task before changing it',409);
  if(method==='POST'&&sub==='workflow'){
   const d=await json(req),action=clean(d.action,30),guide=workflowGuide(t);
   if(simpleTask(t)||['Backlog','Planned'].includes(t.planning_status))return err('Activate Engineering work before using its workflow',409);
   if(d.confirm!==true)return err('Confirm the next step before continuing');
   if(!Number.isInteger(d.expected_revision)||d.expected_revision!==t.workflow_revision)return err('Task changed. Refresh it before confirming the next step.',409);
   if(action==='close'&&t.development_status==='Closed'){if(!isRole(user,'engineer','admin'))return err('Engineering permission required',403);return ok({success:true,already_completed:true,workflow:guide});}
   if(!guide.actions.includes(action))return err('This action is not available at the current step',409);
   if(!isRole(user,action==='qa'?'qa':'engineer','admin'))return err((action==='qa'?'QA':'Engineering')+' permission required',403);
   const minutes=Number(d.minutes||0);if(!Number.isInteger(minutes)||minutes<0||minutes>1440)return err('Minutes must be 0–1440');const note=clean(d.notes,9000),date=requireDate(d.activity_date);let changes={},kind='Development',result='',isWork=0;
   if(action==='review'){
    const decision=clean(d.feasibility,40),engineer=clean(d.assignee,254),due=clean(d.estimated_delivery_date,10);
    if(!FEASIBILITY.includes(decision)||decision==='Pending')return err('Choose a feasibility decision');
    await workflowMember(env,engineer,'Engineering');
    if(decision==='Confirmed'&&(!isDate(due)||due<fmtDate()))return err('Choose an estimated delivery date of today or later');
    if(decision!=='Confirmed'&&!note)return err('Explain what needs clarification or why this cannot be completed');
    if(hasPmOrigin(t)&&decision!=='Confirmed')return pmWorkflowAction(env,user,t,{...d,action:'request-details',notes:decision==='Cannot Complete'?'Cannot Complete: '+note:note});
    changes={primary_owner:t.primary_owner||engineer,feasibility:decision,estimated_delivery_date:decision==='Confirmed'?due:'',review_notes:note,assignee:engineer,next_action_owner:decision==='Needs Clarification'?t.created_by:engineer,development_status:decision==='Confirmed'?'In Development':'On Hold',current_environment:decision==='Confirmed'?'Local':'—',stage_confirmed_at:'',qa_passed_stage_at:''};
    kind='Requirement';result='Engineer review: '+decision;isWork=1;
   }else if(action==='assign-pr-reviewer'||action==='pr-review'){
    const reviewer=clean(d.pr_reviewer,254)||t.pr_reviewer;await workflowMember(env,reviewer,'Engineering');
    changes={pr_reviewer:reviewer,next_action_owner:reviewer};kind='PR';result='PR reviewer assigned';
    if(action==='pr-review'){const merged=stamp();changes={...developmentTransition({...t,pr_review_merged_at:merged},'Merged / Awaiting Stage'),pr_reviewer:reviewer,pr_review_merged_at:merged,pr_review_confirmed_by:user.email,next_action_owner:t.assignee};result='PR reviewed and merged';isWork=1;}
   }else if(action==='progress'){
    const target=clean(d.development_status,80);if(!ENGINEERING_STAGES.includes(target))return err('Choose an engineering stage');
    changes=developmentTransition(t,target);result=target;isWork=note?1:0;
   }else if(action==='stage'){
    const qa=clean(d.qa_owner,254);await workflowMember(env,qa,'QA');
    changes={...developmentTransition({...t,qa_owner:qa},'On Stage'),qa_owner:qa};result='On Stage';kind='Deployment';isWork=1;
   }else if(action==='qa'){
    const qa=clean(d.qa_status,40);if(['Not Tested','Retest Required'].includes(qa))return err('Record an actual test result');
    if(qa!=='Passed'&&!note)return err('Describe what did not pass and what needs to change');
    changes=qaTransition(t,qa);result=qa;kind='QA Testing';isWork=1;
   }else if(action==='close'){
    if(!note)return err('Describe what you confirmed or reported before completing this task');
    changes=developmentTransition(t,'Closed');changes.completed_date=completedDate(d.completed_date);kind='Requirement';result='Completed';isWork=1;
   }else if(action==='production'){
    changes=developmentTransition(t,'On Production');result='On Production';isWork=1;
   }
   if(['progress','stage'].includes(action)&&t.delivery_reset_required){
    const due=clean(d.estimated_delivery_date,10);if(!due)return err('Set a new Engineering estimated delivery date before sending this round to QA',409);if(!isDate(due)||due<fmtDate())return err('Choose a new Engineering estimated delivery date of today or later');
    changes.estimated_delivery_date=due;
   }
   await trackedDates(env,t,changes,date);await saveTaskTransition(env,t,changes,d.expected_revision);await recordQaRound(env,t,changes,date);
   const activityId=await addActivity(env,taskId,user.email,kind,date,action==='qa'?'Stage':changes.current_environment||t.current_environment,result,note||({stage:'Engineer confirmed the change is merged to Stage and available for QA testing.',production:'Engineer confirmed Production deployment and verification.',qa:'QA passed the current Stage build.'}[action]||'Workflow step confirmed'),t.github_pr_url,isWork,action!=='assign-pr-reviewer',minutes,action==='qa'?'QA':'Engineering');
   if(action==='production')await ensureRelease(env,'system');
   return ok({success:true,id:activityId,workflow:workflowGuide(await task(env,taskId))},201);
  }
  if(method==='PATCH'&&!sub){
   if(simpleTask(t))return err('Use Work tracking to edit this task',409);
   if(['Backlog','Planned'].includes(t.planning_status)&&Object.hasOwn(await req.clone().json(),'development_status'))return err('Activate this task before advancing its workflow',409);
   const d=await json(req);if(Object.hasOwn(d,'next_step')||Object.hasOwn(d,'next_action_owner'))return err('Next-step overrides were removed. Use the stage owner settings or Discussion.');const date=requireDate(d.activity_date), changes=[];
   const fields=['title','description','type','priority','project','assignee','development_status','qa_status','github_pr_url','sort_order','category','parent_task_id','current_environment','estimated_delivery_date','qa_owner','completed_date'];
   for(const field of fields){
     if(!Object.hasOwn(d,field)) continue;
     if(['estimated_delivery_date','qa_owner','completed_date'].includes(field)&&!isRole(user,'engineer','admin'))return err('Engineering permission required',403);
     if(field==='development_status'&&!isRole(user,'engineer','admin')) return err('Only engineer or boss can update development status',403);
     if(field==='qa_status'&&!isRole(user,'qa','admin')) return err('Only QA or boss can update QA status',403);
     if(['category','parent_task_id','current_environment'].includes(field)&&!isRole(user,'engineer','qa','admin'))return err('Task editing permission required',403);
     if(field==='sort_order'&&!isRole(user,'admin')) return err('Only QA or boss can change board order',403);
     if(['title','description','type','project','priority','assignee','next_action_owner'].includes(field)&&!isRole(user,'qa','admin')) return err('Only QA or boss can edit task definition',403);
     const value=field==='sort_order'?Number(d[field]):field==='github_pr_url'?validUrl(clean(d[field],600)):field==='category'?categoryName(d[field]):clean(d[field],field==='description'?9000:field==='next_step'?2000:field==='title'?160:254);
     if(field==='estimated_delivery_date'&&value&&!isDate(value))return err('Choose a valid estimated delivery date');
     if(field==='estimated_delivery_date'&&t.delivery_reset_required&&(!isDate(value)||value<fmtDate()))return err('Choose a new Engineering estimated delivery date of today or later');
     if(field==='completed_date'){if((d.development_status??t.development_status)!=='Closed')return err('Complete the task before setting its completion date',409);completedDate(value);}
     if(field==='qa_owner')await workflowMember(env,value,'QA');
     if(field==='current_environment'&&!ENVIRONMENTS.includes(value))return err('Invalid environment');
     if(field==='title'&&!value)return err('Title is required');
     if(field==='sort_order'&&(!Number.isInteger(value)||value<1||value>1000000))return err('Manual order must be an integer from 1 to 1,000,000');
     if((field==='type'&&!TYPES.includes(value))||(field==='priority'&&!PRIORITIES.includes(value))||(field==='development_status'&&!DEV.includes(value))||(field==='qa_status'&&!QA.includes(value))) return err('Invalid '+field);
     if(field==='assignee'&&value)await workflowMember(env,value,'Engineering');
     if(field==='parent_task_id')await validateParent(env,taskId,value);
     if(value!==t[field]) changes.push([field,value,t[field]]);
   }
   if(changes.length){
    for(const change of changes)if(change[0]==='category')change[1]=await ensureTaskCategory(env,change[1]);
    const patch=Object.fromEntries(changes.map(([f,v])=>[f,v]));
    if(patch.development_status==='On Stage')await workflowMember(env,patch.qa_owner||t.qa_owner,'QA');
    if(Object.hasOwn(patch,'development_status'))Object.assign(patch,developmentTransition({...t,qa_owner:patch.qa_owner??t.qa_owner},patch.development_status));
    if(Object.hasOwn(d,'qa_status')&&d.qa_status!==t.qa_status)Object.assign(patch,qaTransition(t,d.qa_status));
    if(Object.hasOwn(d,'current_environment'))patch.current_environment=d.current_environment;if(Object.hasOwn(d,'completed_date'))patch.completed_date=completedDate(d.completed_date);
    await trackedDates(env,t,patch,date);await saveTaskTransition(env,t,patch);await recordQaRound(env,t,patch,date);
   }
   // One user save generates one dated audit event, even if several fields changed.
   // Metadata changes stay in audit history; guided confirmations record actual work.
   if(changes.length){
     const devChange=changes.some(([f])=>f==='development_status');
     const qaChange=changes.some(([f])=>f==='qa_status');
     const prChange=changes.some(([f])=>f==='github_pr_url');
     const kind=devChange?'Development':qaChange?'QA Testing':prChange?'PR':'Status Change';
     const result=changes.map(([f,v,o])=>`${f}: ${o||'—'} → ${v||'—'}`).join(' | ');
     await addActivity(env,taskId,user.email,kind,date,devChange?clean(d.development_status,120):'',result,clean(d.note,3000)||'Task updated',prChange?validUrl(clean(d.github_pr_url,600)):'',0);
   }
   return ok({updated:changes.length});
  }
  if(method==='POST'&&sub==='activity'){
   const d=await json(req),kind=clean(d.action_type,24);if(simpleTask(t)&&!taskOwnerAllowed(user,t))return err('Only the task owner or Admin can record this work',403);
   if(!ACTIONS.includes(kind)) return err('Invalid activity type');
   if(t.work_kind==='PM Task'&&!engineeringTask(t)&&['Development','PR','Merge','Deployment','QA Testing'].includes(kind))return err('Complete the PM handoff before Engineering work',409);
   if(['Development','PR','Merge','Deployment'].includes(kind)&&!isRole(user,'engineer','admin')) return err('Engineer permission required',403);
   if(kind==='QA Testing'&&!isRole(user,'qa','admin')) return err('QA permission required',403);
   if(d.advance_workflow===false&&kind==='QA Testing')return err('Use Next Step to record QA results',409);
   const workRole=clean(d.work_role,30);if(workRole&&!['Other',...user.groups.filter(g=>g!=='Management'),...(isRole(user,'admin')?['Engineering','QA','PM']:[])].includes(workRole))return err('Choose one of your work roles');const minutes=Number(d.minutes||0);if(!Number.isInteger(minutes)||minutes<0||minutes>1440)return err('Minutes must be 0–1440');
   const date=requireDate(d.activity_date), note=clean(d.notes,9000),result=clean(d.result,240),picked=clean(d.environment,120),manual=d.environment_override===true||(picked&&picked!==t.current_environment),en=kind==='Development'&&DEV.includes(result)&&!manual?stepEnvironment(result,t.current_environment):picked||t.current_environment;
   if(!ENVIRONMENTS.includes(en))return err('Invalid environment');
   if(!note&&!result) return err('Add result or notes');
   const pr=validUrl(clean(d.github_pr_url,600));
   let changes={};
   if(d.advance_workflow!==false&&['Backlog','Planned'].includes(t.planning_status)&&((kind==='Development'&&DEV.includes(result))||kind==='QA Testing'))return err('Activate this task before advancing its workflow',409);
   if(kind==='QA Testing'&&['Partially Passed','Not Passed'].includes(result)&&!note)return err('Describe what did not pass and what needs to change');
   if(d.advance_workflow!==false&&kind==='QA Testing'){if(simpleTask(t))return err('Simple work does not use QA workflow');if(!qaReady(t))return err('Engineer must confirm this build is on Stage before QA testing',409);if(QA.includes(result))changes=qaTransition(t,result);}
   else if(d.advance_workflow!==false&&!simpleTask(t)&&kind==='Development'&&DEV.includes(result))changes=developmentTransition(t,result);
   if(d.advance_workflow!==false&&manual&&ENVIRONMENTS.includes(en)&&isRole(user,'engineer','qa','admin'))changes.current_environment=en;
   if(Object.keys(changes).length){await trackedDates(env,t,changes,date);await saveTaskTransition(env,t,changes);await recordQaRound(env,t,changes,date);}
   else await run(env,'UPDATE tasks SET updated_at=? WHERE id=?',stamp(),taskId);
   const activityId=await addActivity(env,taskId,user.email,kind,date,en,result,note,pr,kind==='Status Change'?0:1,false,minutes,clean(d.work_role,30));
   return ok({success:true,id:activityId},201);
  }
  if(method==='POST'&&sub==='comments'){
   const d=await json(req),body=clean(d.body,6000),replyTo=clean(d.reply_to,36);let replyActivity=clean(d.reply_to_activity,36);
   if(!body) return err('Comment required');
   if(replyTo){const parent=await first(env,'SELECT id,reply_to_activity FROM comments WHERE id=? AND task_id=?',replyTo,taskId);if(!parent)return err('Reply must belong to a comment on this task');if(replyActivity&&replyActivity!==parent.reply_to_activity)return err('Reply must stay with its original QA feedback');replyActivity=parent.reply_to_activity||'';}
   if(replyActivity&&!await first(env,"SELECT a.id FROM activities a WHERE a.id=? AND a.task_id=? AND a.action_type='QA Testing' AND a.comment_id IS NULL AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id)",replyActivity,taskId))return err('Reply must refer to QA feedback on this task');
   const membersBefore=Array.isArray(d.action_owners)?d.action_owners:[];for(const person of membersBefore)await validMember(env,clean(person,254));
   const commentId=id();await run(env,'INSERT INTO comments(id,task_id,actor_email,body,reply_to,reply_to_activity) VALUES(?,?,?,?,?,?)',commentId,taskId,user.email,body,replyTo||null,replyActivity||null);
   const explicit=Array.isArray(d.action_owners)?d.action_owners.map(x=>clean(x,254)):[];const members=await all(env,'SELECT email FROM users WHERE enabled=1');const mentioned=members.filter(u=>body.includes('@'+u.email)).map(u=>u.email);const targets=[...new Set([...explicit,...mentioned])];
   for(const person of targets)await validMember(env,person);
   for(const person of targets)await run(env,'INSERT INTO discussion_actions(id,task_id,comment_id,owner_email) VALUES(?,?,?,?)',id(),taskId,commentId,person);
   if(replyTo){const actions=await all(env,'SELECT * FROM discussion_actions WHERE comment_id=? AND owner_email=? AND resolved=0',replyTo,user.email);for(const a of actions)await env.DB.batch([sql(env,'UPDATE discussion_actions SET resolved=1,resolved_by=?,resolved_at=? WHERE id=?',user.email,stamp(),a.id),sql(env,'INSERT INTO discussion_action_history(id,action_id,actor_email,action,recorded_at) VALUES(?,?,?,?,?)',id(),a.id,user.email,'Replied',stamp())]);}
   return ok({success:true,id:commentId},201);
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
   if(t.feasibility!=='Confirmed')return err('Engineer must confirm feasibility before syncing the development stage',409);
   if(!['In Development','PR Submitted','Merged / Awaiting Stage'].includes(t.development_status))return ok({status:t.development_status,merged,github_state:gh.state,updated:false});
   if(target!==t.development_status){
     await saveTaskTransition(env,t,developmentTransition(t,target));
     await addActivity(env,taskId,'github-sync',merged?'Merge':'PR',(merged?gh.merged_at:gh.updated_at||stamp()).slice(0,10),'GitHub',merged?'Merged':'PR '+gh.state,`GitHub PR #${gh.number}: ${gh.title}`,t.github_pr_url,0);
   }
   return ok({status:target,merged,github_state:gh.state,updated:target!==t.development_status});
  }
 }
 if(p==='/api/office' && method==='GET'){
  const rows=teamView?await all(env,'SELECT * FROM office_logs WHERE deleted=0 ORDER BY work_date DESC,created_at DESC LIMIT 500'):await all(env,'SELECT * FROM office_logs WHERE deleted=0 AND owner_email=? ORDER BY work_date DESC,created_at DESC LIMIT 500',user.email);
  return ok({logs:rows});
 }
 if(p==='/api/office' && method==='POST'){
  const d=await json(req),title=clean(d.title,180);if(!title)return err('Title required');const minutes=Number(d.minutes||0);if(!Number.isInteger(minutes)||minutes<0||minutes>1440)return err('Minutes must be 0–1440');
  const itemId=clean(d.work_item_id,36);if(itemId){const item=await privateItem(env,itemId,user);if(item.owner_email!==user.email)return err('Forbidden',403);if(item.archived)return err('Restore archived work before adding or editing activity',409);}
  const officeId=id(),workDate=requireDate(d.work_date),category=clean(d.category,80)||'Office',details=clean(d.details,6000),status=clean(d.status,80)||(d.complete_task===true||d.complete_occurrence===true?'Completed':'');
  const completion=await requestedTaskCompletion(env,user,d,itemId,status,workDate);
  await run(env,'INSERT INTO office_logs(id,owner_email,work_date,category,title,details,status,minutes) VALUES(?,?,?,?,?,?,?,?)',officeId,user.email,workDate,category,title,details,status,minutes);
  await run(env,'UPDATE office_logs SET work_item_id=?,complete_occurrence=? WHERE id=?',itemId,d.complete_occurrence===true||(d.complete_occurrence!==false&&status==='Completed')?1:0,officeId);
  await run(env,'INSERT INTO office_revisions(id,office_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',id(),officeId,user.email,'Created',JSON.stringify({workDate,category,title,status,details,minutes}));
  await completeOccurrence(env,itemId,officeId,user,workDate,d.complete_occurrence===true||(d.complete_occurrence!==false&&status==='Completed'));
  await finishPrivateTask(env,user,completion,officeId);
  return ok({id:officeId},201);
 }
 const om=p.match(/^\/api\/office\/([a-f0-9-]{36})$/);
 if(om&&method==='GET'){
   const o=await office(env,om[1],user);
   return ok({office:o,attachments:await all(env,'SELECT id,office_id,owner_email,filename,byte_size,content_type,created_at FROM attachments WHERE office_id=? AND deleted=0 ORDER BY created_at',o.id),revisions:await all(env,'SELECT * FROM office_revisions WHERE office_id=? ORDER BY recorded_at DESC',o.id)});
 }
 if(om&&method==='PATCH'){
  const o=await office(env,om[1],user);if(o.owner_email!==user.email)return err('Forbidden',403);if(o.work_item_id&&(await first(env,'SELECT archived FROM private_work WHERE id=?',o.work_item_id))?.archived)return err('Restore archived work before editing its activity',409);
  const d=await json(req),patch=[];if(!Object.hasOwn(d,'status')&&(d.complete_task===true||d.complete_occurrence===true))d.status='Completed';if(Object.hasOwn(d,'status')&&!Object.hasOwn(d,'complete_occurrence'))d.complete_occurrence=d.status==='Completed';for(const [k,max] of [['title',180],['details',6000],['category',80],['status',80],['work_date',10],['work_item_id',36],['complete_occurrence',1],['minutes',4]]){
   if(Object.hasOwn(d,k)){if(k==='complete_occurrence'&&typeof d[k]!=='boolean')return err('Completion must be true or false');let v=k==='complete_occurrence'?(d[k]?1:0):clean(d[k],max);if(k==='minutes'){v=Number(d[k]);if(!Number.isInteger(v)||v<0||v>1440)return err('Minutes must be 0–1440');}if(k==='work_date')v=requireDate(v);if(k==='title'&&!v)return err('Title required');if(k==='work_item_id'&&v){const item=await privateItem(env,v,user);if(item.owner_email!==user.email)return err('Forbidden',403);if(item.archived)return err('Restore archived work before adding or editing activity',409);}patch.push([k,v]);}
  }
  const completion=await requestedTaskCompletion(env,user,d,d.work_item_id??o.work_item_id,d.status??o.status,d.work_date??o.work_date);
  for(const [k,v] of patch){
    if(v===o[k])continue;
    await run(env,`UPDATE office_logs SET ${k}=?,updated_at=? WHERE id=?`,v,stamp(),o.id);
    await run(env,'INSERT INTO office_revisions(id,office_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',id(),o.id,user.email,'Edited',JSON.stringify({field:k,old:o[k],new:v}));
  }
  await finishPrivateTask(env,user,completion,o.id);
  const updated=await office(env,o.id,user);await completeOccurrence(env,updated.work_item_id,o.id,user,updated.work_date,updated.complete_occurrence===1);
  return ok({success:true});
 }
 if(om&&method==='DELETE'){
  const o=await office(env,om[1],user);if(o.owner_email!==user.email)return err('Forbidden',403);if(o.work_item_id&&(await first(env,'SELECT archived FROM private_work WHERE id=?',o.work_item_id))?.archived)return err('Restore archived work before editing its activity',409);
  await run(env,'UPDATE office_logs SET deleted=1,updated_at=? WHERE id=?',stamp(),o.id);
  await run(env,'INSERT INTO office_revisions(id,office_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',id(),o.id,user.email,'Deleted',JSON.stringify({title:o.title}));return ok({success:true});
 }
 if(p==='/api/private-work'&&method==='GET'){
  const email=clean(url.searchParams.get('email'),254).toLowerCase();if(email&&email!==user.email&&(!isRole(user,'boss')||hasPersonalWorkGroups(user)))return err('Forbidden',403);
  const owner=isRole(user,'boss')&&!hasPersonalWorkGroups(user)?email:user.email;
  const rows=await all(env,PRIVATE_WORK_SELECT+` WHERE w.deleted=0 ${owner?'AND w.owner_email=?':''} ORDER BY w.created_at`,...(owner?[owner]:[])),items=rows.map(i=>withInactivityReminder(i));
  const attachments=await all(env,`SELECT a.id,a.private_work_id,a.owner_email,a.filename,a.byte_size,a.content_type,a.created_at FROM attachments a JOIN private_work w ON w.id=a.private_work_id WHERE a.deleted=0 AND w.deleted=0 ${owner?'AND w.owner_email=?':''} ORDER BY a.created_at`,...(owner?[owner]:[]));
  return ok({items,attachments});
 }
 if(p==='/api/private-work'&&method==='POST'){
  const d=await json(req),title=clean(d.title,180),kind=clean(d.kind,20)||'Task',parent=clean(d.parent_id,36),description=clean(d.description,6000),status=d.status===undefined?'In Progress':clean(d.status,40);
  if(!title||!['Task','Project'].includes(kind))return err('Invalid title or mode');
  if(!['In Progress','Waiting','Completed'].includes(status))return err('Invalid work status');
  if(parent){const item=await privateItem(env,parent,user);if(item.archived)return err('Restore this project before adding a task',409);if(item.owner_email!==user.email||item.kind!=='Project'||kind!=='Task')return err('A task can belong to your own project only');}
  const repeat=recurrenceConfig(d);if(kind!=='Task'&&repeat.recurrence_rule!=='none')return err('Only tasks can repeat');
  const completingRepeat=status==='Completed'&&repeat.recurrence_rule!=='none',storedStatus=completingRepeat?'In Progress':status,date=status==='Completed'?completedDate(d.completed_date):'';
  const iid=id();await run(env,'INSERT INTO private_work(id,owner_email,kind,title,description,parent_id,status,recurrence_rule,next_due_date,recurrence_anchor_day,completed_date) VALUES(?,?,?,?,?,?,?,?,?,?,?)',iid,user.email,kind,title,description,parent,storedStatus,repeat.recurrence_rule,repeat.next_due_date,repeat.recurrence_anchor_day,completingRepeat?'':date);
  await run(env,'INSERT INTO private_work_revisions(id,work_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',id(),iid,user.email,'Created',JSON.stringify({title,kind,parent,status:storedStatus,completed_date:date,...repeat}));const occurrence=completingRepeat?await completeOccurrence(env,iid,'',user,date,true,{explicitCurrent:true,expectedDue:repeat.next_due_date}):null;return ok({id:iid,...(occurrence?{occurrence_completed:true,...occurrence}:{})},201);
 }
 const privateArchive=p.match(/^\/api\/private-work\/([a-f0-9-]{36})\/(archive|restore)$/);
 if(privateArchive&&method==='POST'){
  const item=await privateItem(env,privateArchive[1],user);if(item.owner_email!==user.email)return err('Forbidden',403);
  const d=await json(req);if(d.confirm!==true)return err('Confirm archiving or restoring before continuing');
  const archived=privateArchive[2]==='archive'?1:0;if(item.archived===archived)return ok({success:true});
  await run(env,'UPDATE private_work SET archived=?,updated_at=? WHERE id=?',archived,stamp(),item.id);
  await run(env,'INSERT INTO private_work_revisions(id,work_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',id(),item.id,user.email,archived?'Archived':'Restored',JSON.stringify({old_archived:item.archived,archived}));return ok({success:true});
 }
 const pm=p.match(/^\/api\/private-work\/([a-f0-9-]{36})$/);
 if(pm&&method==='GET'){
  const item=await privateItem(env,pm[1],user);
  const children=item.kind==='Project'?await all(env,"SELECT * FROM private_work WHERE deleted=0 AND kind='Task' AND parent_id=? AND owner_email=? ORDER BY created_at",item.id,item.owner_email):[];
  const scope="(work_item_id=? OR (?='Project' AND work_item_id IN (SELECT id FROM private_work WHERE deleted=0 AND kind='Task' AND parent_id=? AND owner_email=?)))";
  const activities=await all(env,`SELECT * FROM office_logs WHERE deleted=0 AND owner_email=? AND ${scope} ORDER BY work_date DESC,created_at DESC`,item.owner_email,item.id,item.kind,item.id,item.owner_email);
  const attachments=await all(env,`SELECT id,private_work_id,office_id,owner_email,filename,byte_size,content_type,created_at FROM attachments WHERE deleted=0 AND owner_email=? AND (private_work_id=? OR office_id IN (SELECT id FROM office_logs WHERE deleted=0 AND owner_email=? AND ${scope})) ORDER BY created_at`,item.owner_email,item.id,item.owner_email,item.id,item.kind,item.id,item.owner_email);
  return ok({item,children,activities,attachments});
 }
 if(pm&&['PATCH','DELETE'].includes(method)){
  const item=await privateItem(env,pm[1],user);if(item.owner_email!==user.email)return err('Forbidden',403);if(item.archived)return err('Restore archived work before changing it',409);
  const d=method==='PATCH'?await json(req):{};const title=d.title===undefined?item.title:clean(d.title,180),description=d.description===undefined?item.description:clean(d.description,6000),status=d.status===undefined?item.status:clean(d.status,40);
  if(!title||!['In Progress','Waiting','Completed'].includes(status))return err('Invalid title or status');
  if(method==='DELETE'&&await first(env,'SELECT id FROM private_work WHERE parent_id=? AND deleted=0',item.id))return err('Remove or finish editing child tasks before deleting the project',409);
  const repeat=recurrenceConfig(d,item);if(item.kind!=='Task'&&repeat.recurrence_rule!=='none')return err('Only tasks can repeat');
  if(method==='PATCH'&&d.status==='Completed'&&item.recurrence_rule!=='none'&&repeat.recurrence_rule!=='none'){const date=completedDate(d.completed_date);const occurrence=await completeOccurrence(env,item.id,'',user,date,true,{explicitCurrent:true,expectedDue:d.expected_due_date??item.next_due_date});return ok({success:true,occurrence_completed:true,...occurrence});}
  let date=status==='Completed'?(d.completed_date!==undefined?completedDate(d.completed_date):item.status==='Completed'?item.completed_date:fmtDate()):'';
  if(repeat.recurrence_rule!=='none'&&status!=='Completed')date=d.completed_date===undefined?item.completed_date:completedDate(d.completed_date);
  else if(d.completed_date&&status!=='Completed')return err('Complete the task before setting its completion date',409);
  await run(env,'UPDATE private_work SET title=?,description=?,status=?,completed_date=?,deleted=?,recurrence_rule=?,next_due_date=?,recurrence_anchor_day=?,updated_at=? WHERE id=?',title,description,status,date,method==='DELETE'?1:0,repeat.recurrence_rule,repeat.next_due_date,repeat.recurrence_anchor_day,stamp(),item.id);
  await run(env,'INSERT INTO private_work_revisions(id,work_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',id(),item.id,user.email,method==='DELETE'?'Deleted':'Edited',JSON.stringify({old:item,new:{title,description,status,completed_date:date,...repeat}}));return ok({success:true});
 }
 if(p==='/api/daily'&&method==='GET'){
   const d=requireDate(url.searchParams.get('date'));
   const who=clean(url.searchParams.get('email'),254).toLowerCase();
   if(who && who!==user.email&&!teamView)return err('Forbidden',403);
   // Each person's daily page is private. Only Boss can browse other employees or the whole team.
   const filterWho=teamView?who:user.email;
   const a=filterWho?await all(env,`SELECT a.*,t.title task_title,t.type task_type FROM effective_work_activities a JOIN tasks t ON a.task_id=t.id WHERE a.is_work=1 AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id) AND t.deleted=0 AND a.activity_date=? AND a.actor_email=? ORDER BY a.created_at DESC`,d,filterWho):await all(env,`SELECT a.*,t.title task_title,t.type task_type FROM effective_work_activities a JOIN tasks t ON a.task_id=t.id WHERE a.is_work=1 AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id) AND t.deleted=0 AND a.activity_date=? ORDER BY a.created_at DESC`,d);
   const o=filterWho?await all(env,'SELECT * FROM office_logs WHERE deleted=0 AND work_date=? AND owner_email=? ORDER BY created_at DESC',d,filterWho):await all(env,'SELECT * FROM office_logs WHERE deleted=0 AND work_date=? ORDER BY created_at DESC',d);
   const attachments=await all(env,`SELECT a.id,a.office_id,a.owner_email,a.filename,a.byte_size,a.content_type,a.created_at FROM attachments a JOIN office_logs o ON o.id=a.office_id WHERE a.deleted=0 AND o.deleted=0 AND o.work_date=? ${filterWho?'AND o.owner_email=?':''} ORDER BY a.created_at`,d,...(filterWho?[filterWho]:[]));
   return ok({date:d,activities:a,office:o,attachments:[...attachments,...await sharedDailyAttachments(env,d,filterWho)]});
 }
 if(p==='/api/engineering-daily'&&method==='GET'){
   const date=requireDate(url.searchParams.get('date'));
   return ok({date,activities:await all(env,'SELECT a.*,t.title task_title FROM effective_work_activities a JOIN tasks t ON t.id=a.task_id WHERE a.is_work=1 AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id) AND t.deleted=0 AND a.activity_date=? AND t.deleted=0 ORDER BY a.created_at DESC',date),attachments:await sharedDailyAttachments(env,date),office:[]});
 }
 if(p==='/api/activity'&&method==='GET'){
   if(!isRole(user,'admin'))return err('Activity History is Admin only',403);
   const filterWho=clean(url.searchParams.get('email'),254).toLowerCase();
   const rows=filterWho?await all(env,`SELECT a.*,t.title task_title FROM effective_work_activities a JOIN tasks t ON a.task_id=t.id WHERE a.actor_email=? ORDER BY a.created_at DESC LIMIT 500`,filterWho):await all(env,`SELECT a.*,t.title task_title FROM effective_work_activities a JOIN tasks t ON a.task_id=t.id ORDER BY a.created_at DESC LIMIT 500`);
   return ok({activities:rows});
 }
 if(p==='/api/summary'&&method==='GET'){
   const date=requireDate(url.searchParams.get('date'));
   const boss=teamView;
   const daily=boss?await all(env,`SELECT actor_email email,COUNT(*) count FROM effective_work_activities WHERE is_work=1 AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=effective_work_activities.id) AND activity_date=? GROUP BY actor_email`,date):await all(env,`SELECT actor_email email,COUNT(*) count FROM effective_work_activities WHERE is_work=1 AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=effective_work_activities.id) AND activity_date=? AND actor_email=? GROUP BY actor_email`,date,user.email);
   const personal=boss?await all(env,`SELECT owner_email email,COUNT(*) count FROM office_logs WHERE deleted=0 AND work_date=? GROUP BY owner_email`,date):await all(env,`SELECT owner_email email,COUNT(*) count FROM office_logs WHERE deleted=0 AND work_date=? AND owner_email=? GROUP BY owner_email`,date,user.email);
   const tasks=await taskSignals.decorate(env,await queryTasks(env),user);
   const todayActions=boss?await all(env,`SELECT a.id activity_id,a.task_id,a.actor_email person,a.action_type category,a.activity_date work_date,a.result,a.notes,t.title,a.created_at FROM effective_work_activities a JOIN tasks t ON t.id=a.task_id WHERE a.is_work=1 AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id) AND t.deleted=0 AND a.activity_date=? ORDER BY a.created_at DESC LIMIT 40`,date):await all(env,`SELECT a.id activity_id,a.task_id,a.actor_email person,a.action_type category,a.activity_date work_date,a.result,a.notes,t.title,a.created_at FROM effective_work_activities a JOIN tasks t ON t.id=a.task_id WHERE a.is_work=1 AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id) AND t.deleted=0 AND a.activity_date=? AND a.actor_email=? ORDER BY a.created_at DESC LIMIT 40`,date,user.email);
   const todayOffice=boss?await all(env,'SELECT id,owner_email person,category,work_date,status result,details notes,title,created_at FROM office_logs WHERE deleted=0 AND work_date=? ORDER BY created_at DESC LIMIT 40',date):await all(env,'SELECT id,owner_email person,category,work_date,status result,details notes,title,created_at FROM office_logs WHERE deleted=0 AND work_date=? AND owner_email=? ORDER BY created_at DESC LIMIT 40',date,user.email);
   const today_activity=[...todayActions.map(a=>({...a,private:false})),...todayOffice.map(a=>({...a,private:true}))].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,20);
   const privateTasks=boss?[]:(await all(env,PRIVATE_WORK_SELECT+" WHERE w.deleted=0 AND w.archived=0 AND w.owner_email=? AND w.kind='Task' AND w.status<>'Completed' ORDER BY w.next_due_date,w.created_at",user.email)).map(i=>withInactivityReminder(i));
   const personal_reminders=privateTasks.filter(i=>i.inactivity_reminder||(i.recurrence_rule!=='none'&&i.next_due_date<=fmtDate()));
   return ok({...(url.searchParams.get('include_tasks')==='1'?{tasks}:{}),date,daily,urgent_reminders:tasks.filter(t=>t.urgency?.pending).map(dashboardTask),personal_reminders,office_counts:personal,today_activity,next_actions:tasks.filter(t=>t.planning_status==='Active'&&(t.workflow.owner===user.email||t.workflow.owners?.includes(user.email))&&t.development_status!=='Closed'),waiting_on_others:tasks.filter(t=>t.planning_status==='Active'&&t.workflow.owner&&t.workflow.owner!==user.email&&!t.workflow.owners?.includes(user.email)&&[t.assignee,t.primary_owner,t.qa_owner,t.created_by,t.pm_owner,t.pr_reviewer,...JSON.parse(t.collaborators_json||'[]')].includes(user.email)),needs_follow_up:tasks.filter(t=>t.follow_up&&(!t.follow_up.reason||t.follow_up.reminder_due)&&(user.groups.includes('PM')||[t.assignee,t.primary_owner,t.qa_owner,t.created_by,t.pm_owner,t.pr_reviewer,...JSON.parse(t.collaborators_json||'[]')].includes(user.email))),discussion_actions:await all(env,'SELECT a.*,c.body,t.title FROM discussion_actions a JOIN comments c ON c.id=a.comment_id JOIN tasks t ON t.id=a.task_id WHERE a.owner_email=? AND a.resolved=0 AND t.deleted=0 AND t.archived=0 AND t.planning_status=?',user.email,'Active'),collaborator_actions:await all(env,"SELECT c.*,t.title FROM task_collaborator_work c JOIN tasks t ON t.id=c.task_id WHERE c.email=? AND c.status='Open' AND t.planning_status='Active' AND t.deleted=0 AND t.archived=0 AND t.development_status<>'Closed' AND EXISTS(SELECT 1 FROM json_each(t.collaborators_json) WHERE value=c.email)",user.email),counts:{total:tasks.filter(t=>t.planning_status==='Active'&&t.development_status!=='Closed').length,needQa:tasks.filter(t=>t.planning_status==='Active'&&qaReady(t)&&t.qa_status!=='Passed').length,needEngineering:tasks.filter(t=>['Not Passed','Changes Required','Partially Passed','Need Explanation','No Visible Changes','Unable to Test'].includes(t.qa_status)).length,production:tasks.filter(t=>t.development_status==='On Production').length},attention:tasks.filter(t=>['Not Passed','Changes Required','Partially Passed','Need Explanation','No Visible Changes','Unable to Test'].includes(t.qa_status)||qaReady(t)&&t.qa_status!=='Passed').slice(0,15)});
 }
 if(p==='/api/attachments'&&method==='POST'){
   if(!env.BUCKET)return err('Attachment storage is not configured',503);
   const form=await req.formData(), file=form.get('file'), tid=clean(form.get('task_id'),36),oid=clean(form.get('office_id'),36),aid=clean(form.get('activity_id'),36),cid=clean(form.get('comment_id'),36),wid=clean(form.get('private_work_id'),36);
   if(!(file instanceof File)||[tid,oid,wid].filter(Boolean).length!==1)return err('File and exactly one task, daily activity, or private task are required');
   if((aid||cid)&&!tid)return err('Activity/comment links belong to shared tasks only');
   if(file.size>8*1024*1024)return err('Maximum file size is 8MB');
   if(tid)await task(env,tid);if(oid){const o=await office(env,oid,user);if(o.owner_email!==user.email)return err('Forbidden',403);if(o.work_item_id&&(await first(env,'SELECT archived FROM private_work WHERE id=?',o.work_item_id))?.archived)return err('Restore archived work before adding attachments',409);}if(wid){const w=await privateItem(env,wid,user);if(w.owner_email!==user.email)return err('Forbidden',403);if(w.archived)return err('Restore archived work before adding attachments',409);}
   if(aid&&cid)return err('Choose either activity or comment');
   if(cid&&!await first(env,'SELECT id FROM comments WHERE id=? AND task_id=?',cid,tid))return err('Comment does not belong to task');
   if(aid&&!await first(env,'SELECT id FROM activities WHERE id=? AND task_id=?',aid,tid))return err('Activity does not belong to task');
   const key=`files/${id()}`,fid=id(),type=clean(file.type,120)||'application/octet-stream';
   await env.BUCKET.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:type}});
   await run(env,'INSERT INTO attachments(id,task_id,activity_id,office_id,owner_email,filename,content_type,object_key,byte_size) VALUES(?,?,?,?,?,?,?,?,?)',fid,tid||null,aid||null,oid||null,user.email,clean(file.name,255),type,key,file.size);
   if(cid)await run(env,'UPDATE attachments SET comment_id=? WHERE id=?',cid,fid);
   if(wid)await run(env,'UPDATE attachments SET private_work_id=? WHERE id=?',wid,fid);
   return ok({id:fid},201);
 }
 const am=p.match(/^\/api\/attachments\/([a-f0-9-]{36})$/);
 if(am&&method==='DELETE'){
  const a=await first(env,'SELECT * FROM attachments WHERE id=? AND deleted=0',am[1]);if(!a)return err('Attachment not found',404);
  if(a.office_id){const o=await office(env,a.office_id,user);if(o.owner_email!==user.email)return err('Forbidden',403);}
  if(a.private_work_id){const w=await privateItem(env,a.private_work_id,user);if(w.owner_email!==user.email)return err('Forbidden',403);if(w.archived)return err('Restore archived work before adding attachments',409);}
  if(a.task_id){const t=await task(env,a.task_id,true);if(t.archived)return err('Restore the task before removing attachments',409);if(a.owner_email!==user.email&&!isRole(user,'admin'))return err('Only the uploader or Admin can delete this attachment',403);}
  const d=await json(req);if(d.confirm!==true)return err('Confirm attachment deletion');
  await run(env,'UPDATE attachments SET deleted=1,deleted_by=?,deleted_at=? WHERE id=?',user.email,stamp(),a.id);return ok({success:true});
 }
 if(am&&method==='GET'){
   const a=await first(env,'SELECT * FROM attachments WHERE id=? AND deleted=0',am[1]);if(!a)return err('Attachment not found',404);
   if(a.office_id)await office(env,a.office_id,user);if(a.private_work_id)await privateItem(env,a.private_work_id,user);if(a.task_id)await task(env,a.task_id,true);
   const obj=await env.BUCKET?.get(a.object_key);if(!obj)return err('Stored object not found',404);
   const inline=url.searchParams.get('preview')==='1' && ['image/png','image/jpeg','image/webp','image/gif'].includes(a.content_type);
   const safeName=a.filename.replace(/[\r\n"\\]/g,'_');
   return new Response(obj.body,{headers:{'content-type':a.content_type,'content-disposition':`${inline?'inline':'attachment'}; filename="${safeName}"`,'x-content-type-options':'nosniff','cache-control':'private, no-store'}});
 }
 return err('Route not found',404);
}
// Work tracking uses append-only corrections; original activity rows remain immutable.
const PM_CATEGORIES=['New Feature Requirements','Improvements','Product Design','Report Design','Business Logic Design','Requirement Research','Engineering Coordination','Feature Planning'];
const WORK_KINDS=['Engineering','Quick Task','PM Task'];
const PLANNING=['Backlog','Planned','Active','Completed'];
const SIMPLE_STATUS=['To Do','In Progress','Completed'];
function hasPmOrigin(t){return t.work_kind==='PM Task'||!!t.pm_owner;}
function engineeringTask(t){return t.work_kind==='Engineering'||t.work_kind==='PM Task'&&!!t.pm_engineer&&['Implementation','Completed'].includes(t.pm_stage);}
function simpleTask(t){return t.work_kind&&!engineeringTask(t);}
function pmOwnerAllowed(user,t){return isRole(user,'admin')||user.email===(t.pm_owner||t.assignee);}
function pmWorkflowGuide(t){const stage=t.pm_stage||'Draft',review=stage==='Engineer Review';return {revision:t.workflow_revision,owner:t.archived||stage==='Completed'?'':review?t.pm_engineer:t.pm_owner||t.assignee,role:review?'Engineering':'PM',phase:t.archived?'archived':stage==='Completed'?'done':'pm',instruction:stage==='Draft'?'Record the requirement and design, then mark the design ready.':stage==='Design Ready'?'Submit the completed design to an engineer for confirmation.':review?'Confirm the requirement, or return it to PM with the details you need.':stage==='Needs Details'?'Add the requested details and submit the handoff again.':'PM work completed. Review the history below.',actions:[]};}
function taskOwnerAllowed(user,t){return isRole(user,'admin')||t.planning_status==='Backlog'&&t.created_by===user.email||t.assignee===user.email||t.primary_owner===user.email||t.pm_owner===user.email||JSON.parse(t.collaborators_json||'[]').includes(user.email);}
async function trackingChanges(env,t,patch,expected=t.workflow_revision){
 const keys=Object.keys(patch);const r=await run(env,`UPDATE tasks SET ${keys.map(k=>k+'=?').join(',')},updated_at=?,workflow_revision=workflow_revision+1 WHERE id=? AND workflow_revision=? AND archived=0 AND deleted=0`,...keys.map(k=>patch[k]),stamp(),t.id,expected);
 if(!(r.meta?.changes??r.changes))throw Object.assign(new Error('Task changed. Reopen it before saving.'),{status:409});
}
async function effectiveActivities(env,tid){
 const rows=await all(env,'SELECT a.*,w.is_work effective_is_work,EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id) excluded FROM activities a JOIN effective_work_activities w ON w.id=a.id WHERE a.task_id=? ORDER BY a.created_at DESC,a.rowid DESC',tid);
 const attachmentChanges=await all(env,'SELECT h.* FROM attachment_change_history h JOIN activities a ON a.id=h.activity_id WHERE a.task_id=? ORDER BY h.id',tid);
 const edits=await all(env,'SELECT e.* FROM activity_edits e JOIN activities a ON a.id=e.activity_id WHERE a.task_id=? ORDER BY e.recorded_at,e.rowid',tid);
 return rows.map(a=>{const history=edits.filter(e=>e.activity_id===a.id),last=history.at(-1);return {...a,original_notes:a.notes,original_date:a.activity_date,attachment_history:attachmentChanges.filter(h=>h.activity_id===a.id),edit_history:history,...(last?{notes:last.notes,activity_date:last.activity_date,minutes:last.minutes}:{}),is_work:a.excluded?0:a.effective_is_work};});
}
function plusWeek(date){if(!isDate(date))return '';const due=new Date(date+'T12:00:00Z');due.setUTCDate(due.getUTCDate()+7);return due.toISOString().slice(0,10);}
export function currentStageDue(t){
 const phase=workflowGuide(t).phase;let date='',label='';
 if(phase==='pr_review'){date=plusWeek(t.pr_submitted_date);label='PR review due';}
 else if(phase==='stage_deploy'){date=plusWeek(t.pr_review_completed_date);label='Stage deployment due';}
 else if(phase==='qa'){date=t.qa_due_date||'';label='QA due';}
 else if(phase==='production'){date=plusWeek(t.qa_completed_date);label='Production due';}
 else if(phase==='done'&&t.development_status==='On Production'){date='';label='';}
 else if(['review','development','simple'].includes(phase)){date=t.delivery_reset_required?'':t.estimated_delivery_date||'';label='Engineering due';}
 return {current_due_date:date,current_due_label:label};
}
export function followUpState(t,today=fmtDate()){
 if(t.archived||t.planning_status!=='Active'||t.development_status==='Closed'||t.work_status==='Completed')return null;
 const due=currentStageDue(t).current_due_date;
 if(t.blocked_reason||t.development_status==='On Hold')return {status:'Blocked / Waiting',reason:t.blocked_reason||t.review_notes||'Waiting for clarification',reminder_due:!!t.follow_up_date&&t.follow_up_date<=today,due_date:t.follow_up_date||''};
 const since=[t.last_progress_date,t.last_stage_progress_at,t.created_at].filter(Boolean).map(x=>x.slice(0,10)).sort().at(-1)||'',days=isDate(since)?Math.max(0,Math.floor((new Date(today+'T12:00Z')-new Date(since+'T12:00Z'))/86400000)):0;
 const overdue=!!due&&due<today;
 return overdue||days>=5?{status:days>=10?'Stale':days>=7?'Reminder to Owner':days>=5?'At Risk':'Overdue',overdue,days,since,due_date:due||''}:null;
}
async function trackingTaskData(env,t){
 const [stage_changes,qa_rounds,discussion_actions,collaborator_work,links]=await Promise.all([
 all(env,'SELECT * FROM stage_changes WHERE task_id=? ORDER BY id DESC',t.id),all(env,'SELECT * FROM qa_rounds WHERE task_id=? ORDER BY entered_at DESC,rowid DESC',t.id),all(env,'SELECT a.*,c.body,c.actor_email FROM discussion_actions a JOIN comments c ON c.id=a.comment_id WHERE a.task_id=? ORDER BY a.rowid DESC',t.id),all(env,'SELECT * FROM task_collaborator_work WHERE task_id=?',t.id),all(env,'SELECT * FROM work_links WHERE pm_task_id=? OR engineering_task_id=?',t.id,t.id)]);
 return {stage_changes,qa_rounds,discussion_actions,collaborator_work,links,pm_handoffs:hasPmOrigin(t)?await all(env,'SELECT * FROM pm_handoffs WHERE task_id=? ORDER BY recorded_at DESC,rowid DESC',t.id):[]};
}
async function trackedDates(env,t,changes,date){
 if(hasPmOrigin(t)&&changes.assignee)changes.pm_engineer=changes.assignee;
 if(hasPmOrigin(t)&&changes.feasibility==='Confirmed')changes.pm_stage='Implementation';
 if(changes.estimated_delivery_date){changes.delivery_reset_required=0;}
 if(changes.estimated_delivery_date&&!t.original_delivery_date)changes.original_delivery_date=changes.estimated_delivery_date;
 if(changes.assignee&&!t.primary_owner)changes.primary_owner=changes.assignee;
 if(changes.development_status==='On Stage'&&t.development_status!=='On Stage'){
  if(changes.delivery_reset_required??t.delivery_reset_required)throw Object.assign(new Error('Set a new Engineering estimated delivery date before sending this round to QA'),{status:409});
  const due=new Date(date+'T12:00:00Z');due.setUTCDate(due.getUTCDate()+7);
  changes.engineering_completed_date=date;changes.qa_due_date=due.toISOString().slice(0,10);changes.qa_completed_date='';
 }
 if(changes.qa_status&& !['Not Tested','Retest Required'].includes(changes.qa_status)){
  changes.qa_completed_date=date;
  if(changes.qa_status!=='Passed'){changes.assignee=t.primary_owner||t.assignee;changes.next_action_owner=t.primary_owner||t.assignee;changes.delivery_reset_required=1;}
 }
 if(changes.development_status==='PR Submitted'&&t.development_status!=='PR Submitted'){changes.pr_submitted_date=date;changes.pr_review_completed_date='';}
 if(changes.pr_review_merged_at)changes.pr_review_completed_date=date;
 if(changes.development_status==='In Development')changes.pr_review_completed_date='';
 if(changes.production_completed_date||changes.development_status==='On Production'&&t.development_status!=='On Production'){changes.production_completed_date=date;changes.completed_date=date;}
 if(changes.development_status==='Closed'){changes.planning_status='Completed';if(hasPmOrigin(t)){changes.pm_stage='Completed';changes.work_status='Completed';}}
 return changes;
}
async function recordQaRound(env,t,changes,date){
 if(changes.development_status==='On Stage'&&t.development_status!=='On Stage')await run(env,'INSERT INTO qa_rounds(id,task_id,entered_at,engineering_due,engineering_completed_date,due_date) VALUES(?,?,?,?,?,?)',id(),t.id,changes.stage_confirmed_at,changes.estimated_delivery_date||t.estimated_delivery_date,date,changes.qa_due_date);
 if(changes.qa_status&&!['Not Tested','Retest Required'].includes(changes.qa_status))await run(env,"UPDATE qa_rounds SET completed_date=?,result=? WHERE task_id=? AND entered_at=? AND is_undone=0",date,changes.qa_status,t.id,t.stage_confirmed_at);
}
async function pmWorkflowAction(env,user,t,d){
 if(!hasPmOrigin(t))return err('Choose a task with PM source details');
 if(d.confirm!==true||!Number.isInteger(d.expected_revision)||d.expected_revision!==t.workflow_revision)return err('Task changed. Reopen it before confirming.',409);
 const action=clean(d.action,40),stage=t.pm_stage||'Draft',pm=t.pm_owner||t.assignee,date=requireDate(d.activity_date),ts=stamp(),token=id(),notes=clean(d.notes,9000),patch={};
 const pmActions=['save','design-ready','handoff','revise-design'];
 if(t.work_kind==='Engineering'&&pmActions.includes(action))return err('Return this task to PM before editing its design',409);
 if(pmActions.includes(action)&&!pmOwnerAllowed(user,t))return err('Only the PM owner or Admin can change the design',403);
 if(['accept','request-details'].includes(action)&&(!isRole(user,'engineer','admin')||user.email!==t.pm_engineer&&!isRole(user,'admin')))return err('Only the assigned engineer or Admin can confirm this handoff',403);
 if(![...pmActions,'accept','request-details'].includes(action))return err('Choose a PM handoff action');
 if(action!=='save'&&t.planning_status!=='Active')return err('Activate this task before using Handoff',409);
 if(stage==='Completed'&&action!=='save')return err('This task is already completed',409);
 if(action==='save'){
  if(Object.hasOwn(d,'title')){patch.title=clean(d.title,160);if(!patch.title)return err('Title is required');}
  if(Object.hasOwn(d,'description'))patch.description=clean(d.description,9000);
  if(Object.hasOwn(d,'solution'))patch.pm_solution=clean(d.solution,9000);
  if(stage==='Design Ready'&&((Object.hasOwn(patch,'pm_solution')&&patch.pm_solution!==t.pm_solution)||(Object.hasOwn(patch,'description')&&patch.description!==t.description))){patch.pm_stage='Draft';patch.next_action_owner=pm;}
  if(Object.hasOwn(d,'work_category')){if(!PM_CATEGORIES.includes(d.work_category))return err('Choose a PM work category');patch.work_category=d.work_category;}
  if(Object.hasOwn(d,'pm_owner')){const owner=clean(d.pm_owner,254);await workflowMember(env,owner,'PM');patch.pm_owner=owner;if(!t.pm_engineer){patch.assignee=owner;patch.primary_owner=owner;}if(['Draft','Design Ready','Needs Details'].includes(stage))patch.next_action_owner=owner;}
 }else if(action==='design-ready'){
  if(stage!=='Draft')return err('Complete the current draft before Handoff',409);
  if(!t.pm_solution.trim())return err('Record the design in Edit PM task first');
  patch.pm_stage='Design Ready';patch.work_status='In Progress';patch.next_action_owner=pm;
 }else if(action==='revise-design'){
  if(stage!=='Design Ready')return err('Only a ready design can return to Draft',409);patch.pm_stage='Draft';patch.next_action_owner=pm;
 }else if(action==='handoff'){
  if(!['Design Ready','Needs Details'].includes(stage))return err('Complete the design or requested details before Handoff',409);
  if(!t.pm_solution.trim())return err('Record the design before Handoff');
  const engineer=clean(d.engineer,254);await workflowMember(env,engineer,'Engineering');
  if(t.pm_resume_stage==='Implementation'&&engineer!==t.pm_engineer)return err('Return this clarification to the current engineer');
  if(stage==='Needs Details'){const request=await first(env,"SELECT solution FROM pm_handoffs WHERE task_id=? AND action='request-details' ORDER BY rowid DESC LIMIT 1",t.id);if(request&&request.solution===t.pm_solution)return err('Add the requested details in Edit PM task before submitting Handoff');}
  patch.work_kind='Engineering';patch.pm_engineer=engineer;patch.assignee=engineer;patch.primary_owner=engineer;patch.next_action_owner=t.pm_resume_stage==='Implementation'?(t.pm_resume_owner||engineer):engineer;patch.pm_stage=t.pm_resume_stage==='Implementation'?'Implementation':'Engineer Review';patch.pm_resume_stage='';patch.pm_resume_owner='';patch.work_status='In Progress';
 }else if(action==='accept'){
  if(stage!=='Engineer Review')return err('This handoff is not awaiting confirmation',409);
  await workflowMember(env,t.pm_engineer,'Engineering');
  patch.pm_stage='Implementation';patch.next_action_owner=t.pm_resume_stage==='Implementation'?(t.pm_resume_owner||t.pm_engineer):t.pm_engineer;patch.pm_resume_stage='';patch.pm_resume_owner='';
 }else if(action==='request-details'){
  if(!['Engineer Review','Implementation'].includes(stage)||t.development_status==='Closed')return err('This task cannot be returned to PM at this step',409);
  if(!notes)return err('Describe the details PM needs to add');
  await workflowMember(env,pm,'PM');
  patch.work_kind='PM Task';patch.pm_stage='Needs Details';patch.pm_resume_stage=t.feasibility==='Confirmed'?'Implementation':'Engineer Review';patch.pm_resume_owner=t.next_action_owner;patch.next_action_owner=pm;
 }
 const next=patch.pm_stage||stage,keys=Object.keys(patch),guard='EXISTS(SELECT 1 FROM tasks WHERE id=? AND pm_transition_token=?)',aid=id(),event=id();
 const actions={save:'PM design updated','design-ready':'Design ready',handoff:'PM handoff submitted','revise-design':'Design returned to Draft',accept:'Requirement confirmed','request-details':'PM details requested'};
 const result=actions[action],solution=patch.pm_solution??t.pm_solution,role=['accept','request-details'].includes(action)?'Engineering':'PM';
 const batch=[sql(env,`UPDATE tasks SET ${keys.map(k=>k+'=?,').join('')}pm_transition_token=?,updated_at=?,workflow_revision=workflow_revision+1 WHERE id=? AND workflow_revision=? AND archived=0 AND deleted=0`,...keys.map(k=>patch[k]),token,ts,t.id,d.expected_revision),
  sql(env,`INSERT INTO pm_handoffs(id,task_id,actor_email,action,from_stage,to_stage,notes,solution,engineer_email,recorded_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${guard}`,event,t.id,user.email,action,stage,next,notes,solution,patch.pm_engineer||t.pm_engineer,ts,t.id,token),
  sql(env,`INSERT INTO activities(id,task_id,actor_email,action_type,activity_date,environment,result,notes,is_work,work_role) SELECT ?,?,?,'Requirement',?,'',?,?,?,? WHERE ${guard}`,aid,t.id,user.email,date,result,notes|| (action==='save'?solution||patch.description||patch.title||result:result),action==='request-details'?0:action!=='save'||Object.hasOwn(patch,'pm_solution')&&patch.pm_solution!==t.pm_solution?1:0,role,t.id,token)];
 if(action==='request-details'){
  const cid=id();patch.pm_request_comment=cid;
  // Bind the request to this exact transition, so concurrent submissions cannot leave stray mentions.
  batch.push(sql(env,`UPDATE tasks SET pm_request_comment=? WHERE id=? AND pm_transition_token=?`,cid,t.id,token),
   sql(env,`INSERT INTO comments(id,task_id,actor_email,body) SELECT ?,?,?,? WHERE ${guard}`,cid,t.id,user.email,'@'+pm+' '+notes,t.id,token),
   sql(env,`INSERT INTO discussion_actions(id,task_id,comment_id,owner_email) SELECT ?,?,?,? WHERE ${guard}`,id(),t.id,cid,pm,t.id,token));
 }
 if(action==='handoff'&&t.pm_request_comment){batch.push(sql(env,`UPDATE discussion_actions SET resolved=1,resolved_by=?,resolved_at=? WHERE task_id=? AND comment_id=? AND resolved=0 AND ${guard}`,user.email,ts,t.id,t.pm_request_comment,t.id,token),sql(env,`INSERT INTO discussion_action_history(id,action_id,actor_email,action,recorded_at) SELECT ?,a.id,?,'PM details supplied',? FROM discussion_actions a WHERE a.task_id=? AND a.comment_id=? AND ${guard}`,id(),user.email,ts,t.id,t.pm_request_comment,t.id,token));}
 const results=await env.DB.batch(batch);if(!(results[0].meta?.changes??results[0].changes))return err('Task changed. Reopen it before confirming.',409);
 return ok({success:true,id:aid,workflow:workflowGuide(await task(env,t.id))},201);
}

async function trackingRoutes(req,env,user,teamView){
 const p=new URL(req.url).pathname,method=req.method;
 if(p==='/api/workload'&&method==='GET'){
  const date=requireDate(new URL(req.url).searchParams.get('date'));
  const shared=await all(env,`SELECT a.actor_email email,t.work_kind,COALESCE(NULLIF(a.work_role,''),CASE WHEN a.action_type='QA Testing' THEN 'QA' WHEN a.action_type IN ('Development','PR','Merge','Deployment') THEN 'Engineering' WHEN (t.work_kind='PM Task' OR t.pm_owner<>'') THEN 'PM' ELSE 'Other' END) work_role,CASE WHEN (t.work_kind='PM Task' OR t.pm_owner<>'') AND (a.work_role='PM' OR a.work_role='' AND a.action_type NOT IN ('Development','PR','Merge','Deployment','QA Testing')) THEN t.work_category ELSE a.action_type END category,COUNT(*) activity_count,SUM(CASE WHEN a.action_type='QA Testing' AND a.result NOT IN ('Passed','Not Tested','Retest Required') THEN 1 ELSE 0 END) rework_requests,SUM(COALESCE((SELECT e.minutes FROM activity_edits e WHERE e.activity_id=a.id ORDER BY e.rowid DESC LIMIT 1),a.minutes)) minutes,COUNT(DISTINCT a.task_id) participated_tasks FROM effective_work_activities a JOIN tasks t ON t.id=a.task_id WHERE a.is_work=1 AND COALESCE((SELECT e.activity_date FROM activity_edits e WHERE e.activity_id=a.id ORDER BY e.rowid DESC LIMIT 1),a.activity_date)=? AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id) AND (?=1 OR a.actor_email=?) GROUP BY a.actor_email,t.work_kind,work_role,category`,date,teamView?1:0,user.email);
  const daily=await all(env,'SELECT owner_email email,category,COUNT(*) activity_count,SUM(minutes) minutes FROM office_logs WHERE deleted=0 AND work_date=? AND (?=1 OR owner_email=?) GROUP BY owner_email,category',date,teamView?1:0,user.email);
  return ok({date,shared,daily});
 }
 const actionMatch=p.match(/^\/api\/discussion-actions\/([a-f0-9-]{36})\/resolve$/);
 if(actionMatch&&method==='POST'){
  const a=await first(env,'SELECT * FROM discussion_actions WHERE id=?',actionMatch[1]);if(!a)return err('Discussion action not found',404);
  if(a.owner_email!==user.email&&!isRole(user,'admin'))return err('Only the requested person or Admin can resolve this action',403);
  await env.DB.batch([sql(env,'UPDATE discussion_actions SET resolved=1,resolved_by=?,resolved_at=? WHERE id=?',user.email,stamp(),a.id),sql(env,'INSERT INTO discussion_action_history(id,action_id,actor_email,action,recorded_at) VALUES(?,?,?,?,?)',id(),a.id,user.email,'Resolved',stamp())]);return ok({success:true});
 }
 const match=p.match(/^\/api\/tasks\/([a-f0-9-]{36})\/(tracking|undo-stage|work-status|collaborator-work|link-engineering|activity-edit|pm-workflow)$/);
 if(!match)return null;
 const tid=match[1],sub=match[2],t=await task(env,tid);if(method==='GET')return null;
 const d=await json(req);
 if(t.archived)return err('Restore this archived task before changing it',409);
 if(sub==='pm-workflow'&&method==='POST')return pmWorkflowAction(env,user,t,d);
 if(sub==='activity-edit'&&method==='POST'){
  const a=await first(env,'SELECT * FROM activities WHERE id=? AND task_id=?',clean(d.activity_id,36),tid);
  if(!a||a.comment_id)return err('Work activity not found',404);
  if(a.actor_email!==user.email&&!isRole(user,'admin'))return err('Only the author or Admin can edit this activity',403);
  const previous=await first(env,'SELECT minutes FROM activity_edits WHERE activity_id=? ORDER BY rowid DESC LIMIT 1',a.id);
  const notes=clean(d.notes,9000),date=requireDate(d.activity_date),minutes=d.minutes===undefined?(previous?.minutes??a.minutes):Number(d.minutes);if(!notes||!Number.isInteger(minutes)||minutes<0||minutes>1440)return err('Enter activity notes and 0–1440 minutes');
  await run(env,'INSERT INTO activity_edits(id,activity_id,actor_email,notes,activity_date,minutes,recorded_at) VALUES(?,?,?,?,?,?,?)',id(),a.id,user.email,notes,date,minutes,stamp());return ok({success:true});
 }
 if(sub==='undo-stage'&&method==='POST'){
  if(!isRole(user,'engineer','qa','admin')&&!taskOwnerAllowed(user,t))return err('Task workflow permission required',403);
  if(d.confirm!==true||!clean(d.reason,2000))return err('Confirm undo and explain the mistaken action');
  const h=await first(env,'SELECT * FROM stage_changes WHERE task_id=? ORDER BY id DESC LIMIT 1',tid);
  if(!h||h.undone||h.to_revision!==t.workflow_revision||d.expected_revision!==t.workflow_revision)return err('Only the latest unchanged stage transition can be undone',409);
  if(await first(env,"SELECT id FROM releases WHERE status='Released' AND EXISTS(SELECT 1 FROM json_each(task_ids_json) WHERE value=?)",tid))return err('Released history is locked; use a new corrective task',409);
  const before=JSON.parse(h.before_json);if(hasPmOrigin(t)&&t.pm_stage==='Completed'&&before.development_status!=='Closed')before.pm_stage='Implementation';const keys=Object.keys(before),ts=stamp(),token=id();
  const guard='EXISTS(SELECT 1 FROM stage_changes WHERE id=? AND undo_token=?)';
  const batch=[sql(env,"UPDATE stage_changes SET undone=1,undo_actor=?,undo_reason=?,undo_token=? WHERE id=? AND undone=0 AND EXISTS(SELECT 1 FROM tasks WHERE id=? AND workflow_revision=?) AND id=(SELECT MAX(id) FROM stage_changes WHERE task_id=?)",user.email,clean(d.reason,2000),token,h.id,tid,t.workflow_revision,tid),
   sql(env,`UPDATE tasks SET ${keys.map(k=>k+'=?').join(',')},updated_at=?,workflow_revision=workflow_revision+1 WHERE id=? AND workflow_revision=? AND ${guard}`,...keys.map(k=>before[k]),ts,tid,t.workflow_revision,h.id,token),
   sql(env,`UPDATE stage_changes SET undone=1,undo_actor=?,undo_reason=?,undo_token=? WHERE task_id=? AND to_revision=? AND ${guard}`,user.email,clean(d.reason,2000),token,tid,t.workflow_revision+1,h.id,token)];
  if(h.activity_id)batch.push(sql(env,`INSERT OR IGNORE INTO excluded_activities(activity_id,reason,actor_email,recorded_at) SELECT ?,?,?,? WHERE ${guard}`,h.activity_id,clean(d.reason,2000),user.email,ts,h.id,token));
  batch.push(sql(env,`UPDATE qa_rounds SET is_undone=1 WHERE task_id=? AND entered_at=? AND ?='On Stage' AND ${guard}`,tid,t.stage_confirmed_at,t.development_status,h.id,token));
  if(before.stage_confirmed_at)batch.push(sql(env,`UPDATE qa_rounds SET completed_date='',result='' WHERE task_id=? AND entered_at=? AND ${guard}`,tid,before.stage_confirmed_at,h.id,token));
  const results=await env.DB.batch(batch);if(!(results[1].meta?.changes??results[1].changes))return err('Task changed. Reopen it before undoing.',409);
  await addActivity(env,tid,user.email,'Status Change',fmtDate(),before.current_environment,'Undo Stage Change',clean(d.reason,2000),'',0);return ok({success:true});
 }
 if(!taskOwnerAllowed(user,t)&&!isRole(user,'engineer','qa')&& !user.groups.includes('PM'))return err('Work tracking permission required',403);
 if(sub==='work-status'&&method==='POST'){
  if(t.work_kind==='PM Task')return err('Use the PM handoff workflow',409);if(!simpleTask(t))return err('Engineering uses its existing workflow');if(!taskOwnerAllowed(user,t))return err('Only the owner or Admin can update this task',403);
  if(d.confirm!==true||!SIMPLE_STATUS.includes(d.status))return err('Confirm a valid task status');
  const date=requireDate(d.activity_date),changes={work_status:d.status,development_status:d.status==='Completed'?'Closed':'New Request',planning_status:d.status==='Completed'?'Completed':'Active',completed_date:d.status==='Completed'?completedDate(d.completed_date,date):'',next_action_owner:d.status==='Completed'?'':t.assignee};
  await trackingChanges(env,t,changes,d.expected_revision);await addActivity(env,tid,user.email,'Status Change',date,'',d.status,clean(d.notes,9000)||'Task status confirmed','',0);return ok({success:true});
 }
 if(sub==='collaborator-work'&&method==='POST'){
  const email=clean(d.email,254);if(!JSON.parse(t.collaborators_json||'[]').includes(email))return err('Choose a listed collaborator');
  if(!taskOwnerAllowed(user,t))return err('Only the Primary Owner, assigned collaborators or Admin can change collaboration',403);
  if(user.email!==email&&user.email!==t.primary_owner&&!isRole(user,'admin'))return err('Only the Primary Owner or Admin can assign another collaborator',403);
  if(!['Open','Completed'].includes(d.status)||!clean(d.description,2000))return err('Describe the assigned work');
  await run(env,'INSERT INTO task_collaborator_work(task_id,email,description,status) VALUES(?,?,?,?) ON CONFLICT(task_id,email) DO UPDATE SET description=excluded.description,status=excluded.status',tid,email,clean(d.description,2000),d.status);
  await addActivity(env,tid,user.email,'Status Change',fmtDate(),'','Collaboration '+d.status,clean(d.description,2000),'',0);return ok({success:true});
 }
 if(sub==='link-engineering'&&method==='POST'){
  if(t.work_kind!=='PM Task'||(!taskOwnerAllowed(user,t)&&!user.groups.includes('PM')))return err('PM task permission required',403);
  const engineering=await task(env,clean(d.engineering_task_id,36));if(engineering.work_kind!=='Engineering')return err('Link an Engineering task');
  await run(env,'INSERT OR IGNORE INTO work_links(pm_task_id,engineering_task_id,actor_email,created_at) VALUES(?,?,?,?)',tid,engineering.id,user.email,stamp());await addActivity(env,tid,user.email,'Status Change',fmtDate(),'','Engineering link',engineering.title,'',0);return ok({success:true});
 }
 if(sub==='tracking'&&method==='PATCH'){
  if(!taskOwnerAllowed(user,t)&&!isRole(user,'qa')&&!user.groups.includes('PM'))return err('Task owner permission required',403);
  const patch={};
  if(t.work_kind==='PM Task'&&['title','description','assignee','work_category','pm_owner','pm_solution'].some(k=>Object.hasOwn(d,k)))return err('Use Edit PM task to update the requirement and design',409);
  if(simpleTask(t)&&!taskOwnerAllowed(user,t))return err('Only the task owner or Admin can edit this work',403);
  if(simpleTask(t)){for(const key of ['title','description'])if(Object.hasOwn(d,key)){patch[key]=clean(d[key],key==='title'?160:9000);if(key==='title'&&!patch[key])return err('Title is required');}if(Object.hasOwn(d,'assignee')){if(!taskOwnerAllowed(user,t))return err('Owner permission required',403);const person=clean(d.assignee,254);if(t.work_kind==='PM Task')await workflowMember(env,person,'PM');else await validMember(env,person);if(!person)return err('Choose an owner');patch.assignee=person;patch.primary_owner=person;patch.next_action_owner=t.work_status==='Completed'?'':person;}}
  if(Object.hasOwn(d,'planning_status')){if(t.development_status==='Closed'&&d.planning_status!=='Completed')return err('Completed tasks keep Completed planning status',409);if(!PLANNING.includes(d.planning_status))return err('Invalid planning status');if(d.planning_status==='Completed'&&t.development_status!=='Closed')return err('Complete the task using its workflow first',409);patch.planning_status=d.planning_status;}
  for(const field of ['qa_due_date','estimated_delivery_date','follow_up_date'])if(Object.hasOwn(d,field)){const v=clean(d[field],10);if(v&&!isDate(v))return err('Choose valid dates');patch[field]=v;}
  if(patch.qa_due_date!==undefined&&!isRole(user,'qa','admin'))return err('QA permission required',403);
  if(patch.qa_due_date!==undefined&&patch.qa_due_date!==t.qa_due_date&&workflowGuide(t).phase!=='qa')return err('Only the current QA deadline can be edited',409);
  if(patch.estimated_delivery_date!==undefined){if(patch.estimated_delivery_date!==t.estimated_delivery_date&&workflowGuide(t).phase!=='development')return err('Set the estimate in the current Engineering step',409);if(!taskOwnerAllowed(user,t))return err('Engineering owner permission required',403);if(t.delivery_reset_required&&(!isDate(patch.estimated_delivery_date)||patch.estimated_delivery_date<fmtDate()))return err('Choose a new Engineering estimated delivery date of today or later');patch.delivery_reset_required=0;if(!t.original_delivery_date)patch.original_delivery_date=patch.estimated_delivery_date;}
  if(Object.hasOwn(d,'blocked_reason'))patch.blocked_reason=clean(d.blocked_reason,2000);
  if(Object.hasOwn(d,'work_category')){if(t.work_kind==='PM Task'&&!PM_CATEGORIES.includes(d.work_category))return err('Choose a PM work category');patch.work_category=clean(d.work_category,120);}
  if(Object.hasOwn(d,'primary_owner')){if(!isRole(user,'admin')&&user.email!==t.primary_owner&&!(t.planning_status==='Backlog'&&!t.primary_owner&&t.created_by===user.email))return err('Primary Owner or Admin permission required',403);if(clean(d.primary_owner,254)||(d.planning_status??t.planning_status)!=='Backlog')await workflowMember(env,clean(d.primary_owner,254),'Engineering');patch.primary_owner=clean(d.primary_owner,254);if(!t.assignee&&patch.primary_owner){patch.assignee=patch.primary_owner;patch.next_action_owner=patch.primary_owner;}}
  if(Object.hasOwn(d,'collaborators')){if(!isRole(user,'admin')&&user.email!==t.primary_owner&&!(t.planning_status==='Backlog'&&!t.primary_owner&&t.created_by===user.email))return err('Primary Owner or Admin permission required',403);if(!Array.isArray(d.collaborators))return err('Choose collaborators');const people=[...new Set(d.collaborators.map(x=>clean(x,254)))];for(const email of people)await workflowMember(env,email,'Engineering');patch.collaborators_json=JSON.stringify(people);}
  if(Object.keys(patch).length){await trackingChanges(env,t,patch,d.expected_revision);await addActivity(env,tid,user.email,'Status Change',fmtDate(),'','Work tracking updated',JSON.stringify(patch),'',0);if(patch.qa_due_date!==undefined)await run(env,'UPDATE qa_rounds SET due_date=? WHERE task_id=? AND entered_at=? AND is_undone=0',patch.qa_due_date,tid,t.stage_confirmed_at);}
  return ok({success:true});
 }
 return err('Method not allowed',405);
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
 return new Response('Static assets not bound; configure an asset binding',{status:503});
}};
