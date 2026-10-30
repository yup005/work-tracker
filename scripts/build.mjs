import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai/drizzle', { recursive: true });
const assets = {};
for (const [file, type] of [
  ['index.html', 'text/html; charset=utf-8'],
  ['app.js', 'application/javascript; charset=utf-8'],
  ['language.js', 'application/javascript; charset=utf-8'],
  ['styles.css', 'text/css; charset=utf-8'],
  ['favicon.svg', 'image/svg+xml'],
])
  assets['/' + file] = { body: await readFile('public/' + file, 'utf8'), type };
const signals = (await readFile('task-signals.mjs', 'utf8')).replace(
  'export function createTaskSignals',
  'function createTaskSignals',
);
const serverSource = await readFile('server.mjs', 'utf8');
const signalsImport =
  /^import\s*\{\s*createTaskSignals\s*\}\s*from\s*['"]\.\/task-signals\.mjs['"];?\s*/m;

if (!signalsImport.test(serverSource)) {
  throw new Error('Expected createTaskSignals import was not found in server.mjs');
}
const api = serverSource.replace(signalsImport, signals + '\n');
const index =
  api.slice(0, api.indexOf('export default ')) +
  `\nconst assets=${JSON.stringify(assets)};\nexport default {async fetch(request,env){ const p=new URL(request.url).pathname; if(p.startsWith('/api/'))return handle(request,{...env,DEV_AUTH:undefined});const asset=assets[p==='/'?'/index.html':p];return asset?new Response(asset.body,{headers:{'content-type':asset.type,'x-content-type-options':'nosniff','cache-control':'no-store'}}):new Response('Not found',{status:404});}};`;
await writeFile('dist/server/index.js', index);
// Hosting configuration is supplied by supported deployment environments.
// A repository checkout can still build and test the Worker without that file.
try {
  await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.warn('No .openai/hosting.json found; omitting deployment-only metadata.');
}
await copyFile('schema.sql', 'dist/.openai/drizzle/0000_work_tracker.sql');
console.log('Built Worker with embedded assets and D1 schema migration');

await copyFile('migrations/0001_password_auth.sql', 'dist/.openai/drizzle/0001_password_auth.sql');

await copyFile('migrations/0002_releases.sql', 'dist/.openai/drizzle/0002_releases.sql');

await copyFile(
  'migrations/0003_release_auto_roles.sql',
  'dist/.openai/drizzle/0003_release_auto_roles.sql',
);

await copyFile(
  'migrations/0004_work_structure.sql',
  'dist/.openai/drizzle/0004_work_structure.sql',
);

await copyFile('migrations/0005_task_focus.sql', 'dist/.openai/drizzle/0005_task_focus.sql');

await copyFile(
  'migrations/0006_activity_evidence.sql',
  'dist/.openai/drizzle/0006_activity_evidence.sql',
);

await copyFile(
  'migrations/0007_guided_workflow.sql',
  'dist/.openai/drizzle/0007_guided_workflow.sql',
);

await copyFile(
  'migrations/0008_private_evidence.sql',
  'dist/.openai/drizzle/0008_private_evidence.sql',
);
await copyFile(
  'migrations/0009_pending_comments.sql',
  'dist/.openai/drizzle/0009_pending_comments.sql',
);
await copyFile(
  'migrations/0010_promote_daily_task.sql',
  'dist/.openai/drizzle/0010_promote_daily_task.sql',
);

await copyFile(
  'migrations/0011_private_archive.sql',
  'dist/.openai/drizzle/0011_private_archive.sql',
);
await copyFile('migrations/0012_instructions.sql', 'dist/.openai/drizzle/0012_instructions.sql');

await copyFile('migrations/0013_comment_work.sql', 'dist/.openai/drizzle/0013_comment_work.sql');

await copyFile(
  'migrations/0014_comment_replies.sql',
  'dist/.openai/drizzle/0014_comment_replies.sql',
);

await copyFile(
  'migrations/0015_user_language_switch.sql',
  'dist/.openai/drizzle/0015_user_language_switch.sql',
);
await copyFile(
  'migrations/0016_task_categories.sql',
  'dist/.openai/drizzle/0016_task_categories.sql',
);

await copyFile(
  'migrations/0017_completed_dates.sql',
  'dist/.openai/drizzle/0017_completed_dates.sql',
);

await copyFile('migrations/0018_user_avatars.sql', 'dist/.openai/drizzle/0018_user_avatars.sql');
await copyFile(
  'migrations/0019_future_release_plans.sql',
  'dist/.openai/drizzle/0019_future_release_plans.sql',
);

await copyFile('migrations/0020_work_tracking.sql', 'dist/.openai/drizzle/0020_work_tracking.sql');

await copyFile('migrations/0021_pm_handoff.sql', 'dist/.openai/drizzle/0021_pm_handoff.sql');

await copyFile(
  'migrations/0022_pm_engineering_tasks.sql',
  'dist/.openai/drizzle/0022_pm_engineering_tasks.sql',
);

await copyFile(
  'migrations/0023_current_stage_dates.sql',
  'dist/.openai/drizzle/0023_current_stage_dates.sql',
);

await copyFile('migrations/0024_creation_work.sql', 'dist/.openai/drizzle/0024_creation_work.sql');

await copyFile(
  'migrations/0025_qa_feedback_replies.sql',
  'dist/.openai/drizzle/0025_qa_feedback_replies.sql',
);

await copyFile(
  'migrations/0026_pr_review_and_loading.sql',
  'dist/.openai/drizzle/0026_pr_review_and_loading.sql',
);

await copyFile(
  'migrations/0027_instruction_baseline.sql',
  'dist/.openai/drizzle/0027_instruction_baseline.sql',
);

await copyFile(
  'migrations/0028_qa_result_labels.sql',
  'dist/.openai/drizzle/0028_qa_result_labels.sql',
);

await copyFile(
  'migrations/0029_production_completes_task.sql',
  'dist/.openai/drizzle/0029_production_completes_task.sql',
);

await copyFile(
  'migrations/0030_pre_identifier_backup.sql',
  'dist/.openai/drizzle/0030_pre_identifier_backup.sql',
);

await copyFile(
  'migrations/0031_task_numbers_and_urgent.sql',
  'dist/.openai/drizzle/0031_task_numbers_and_urgent.sql',
);
