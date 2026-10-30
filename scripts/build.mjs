import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';

const workerAssets = [
  ['index.html', 'text/html; charset=utf-8'],
  ['app.js', 'application/javascript; charset=utf-8'],
  ['language.js', 'application/javascript; charset=utf-8'],
  ['styles.css', 'text/css; charset=utf-8'],
  ['favicon.svg', 'image/svg+xml'],
];

const migrationFiles = [
  '0001_password_auth.sql',
  '0002_releases.sql',
  '0003_release_auto_roles.sql',
  '0004_work_structure.sql',
  '0005_task_focus.sql',
  '0006_activity_evidence.sql',
  '0007_guided_workflow.sql',
  '0008_private_evidence.sql',
  '0009_pending_comments.sql',
  '0010_promote_daily_task.sql',
  '0011_private_archive.sql',
  '0012_instructions.sql',
  '0013_comment_work.sql',
  '0014_comment_replies.sql',
  '0015_user_language_switch.sql',
  '0016_task_categories.sql',
  '0017_completed_dates.sql',
  '0018_user_avatars.sql',
  '0019_future_release_plans.sql',
  '0020_work_tracking.sql',
  '0021_pm_handoff.sql',
  '0022_pm_engineering_tasks.sql',
  '0023_current_stage_dates.sql',
  '0024_creation_work.sql',
  '0025_qa_feedback_replies.sql',
  '0026_pr_review_and_loading.sql',
  '0027_instruction_baseline.sql',
  '0028_qa_result_labels.sql',
  '0029_production_completes_task.sql',
  '0030_pre_identifier_backup.sql',
  '0031_task_numbers_and_urgent.sql',
];

async function readPublicAssets() {
  const assets = {};
  for (const [filename, contentType] of workerAssets) {
    assets['/' + filename] = {
      body: await readFile('public/' + filename, 'utf8'),
      type: contentType,
    };
  }
  return assets;
}

async function buildApiSource() {
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

  const apiSource = serverSource.replace(signalsImport, signals + '\n');
  const defaultExportIndex = apiSource.indexOf('export default ');
  if (defaultExportIndex < 0) {
    throw new Error('Expected a default export in server.mjs');
  }
  return apiSource.slice(0, defaultExportIndex);
}

function buildWorkerEntrypoint(assets) {
  // This string is emitted into dist/server/index.js as executable Worker code.
  return `
const assets = ${JSON.stringify(assets)};

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (path.startsWith('/api/')) {
      return handle(request, { ...env, DEV_AUTH: undefined });
    }

    const asset = assets[path === '/' ? '/index.html' : path];
    if (!asset) {
      return new Response('Not found', { status: 404 });
    }

    return new Response(asset.body, {
      headers: {
        'content-type': asset.type,
        'x-content-type-options': 'nosniff',
        'cache-control': 'no-store',
      },
    });
  },
};
`;
}

async function copyHostingConfig() {
  // Hosting configuration is optional in a local repository checkout.
  try {
    await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.warn('No .openai/hosting.json found; omitting deployment-only metadata.');
  }
}

async function copyDatabaseMigrations() {
  await copyFile('schema.sql', 'dist/.openai/drizzle/0000_work_tracker.sql');
  for (const filename of migrationFiles) {
    await copyFile('migrations/' + filename, 'dist/.openai/drizzle/' + filename);
  }
}

await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai/drizzle', { recursive: true });

const assets = await readPublicAssets();
const apiSource = await buildApiSource();
await writeFile('dist/server/index.js', apiSource + buildWorkerEntrypoint(assets));
await copyHostingConfig();
await copyDatabaseMigrations();

console.log('Built Worker with embedded assets and D1 schema migration');
