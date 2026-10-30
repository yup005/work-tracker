/** Local test-only server. Hosted setup requires trusted upstream identity headers. */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { handle } from './server.mjs';
const base = import.meta.dirname,
  dbPath = resolve(base, 'work-tracker-local.sqlite');
const db = new DatabaseSync(dbPath);
db.exec(await readFile(resolve(base, 'schema.sql'), 'utf8'));
// Local-only migration for previously created preview databases whose user role CHECK predated Admin.
const oldUsersSql =
  db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()?.sql || '';
if (oldUsersSql.includes("('boss','qa','engineer')")) {
  const migratedSql = oldUsersSql
    .replace(/CREATE TABLE(?: IF NOT EXISTS)? users/i, 'CREATE TABLE users_migrated')
    .replace("('boss','qa','engineer')", "('boss','admin','qa','engineer')");
  db.exec(
    `BEGIN; ${migratedSql}; INSERT INTO users_migrated SELECT * FROM users; DROP TABLE users; ALTER TABLE users_migrated RENAME TO users; COMMIT;`,
  );
}

if (
  !db
    .prepare('PRAGMA table_info(tasks)')
    .all()
    .some((c) => c.name === 'sort_order')
)
  db.exec('ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 1000');
db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for (const name of [
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
]) {
  if (!db.prepare('SELECT name FROM local_migrations WHERE name=?').get(name)) {
    db.exec(await readFile(resolve(base, 'migrations', name), 'utf8'));
    db.prepare('INSERT INTO local_migrations(name) VALUES(?)').run(name);
  }
}
const wrapper = {
  prepare(sql) {
    return {
      bind(...args) {
        return {
          first: async () => db.prepare(sql).get(...args) ?? null,
          all: async () => ({ results: db.prepare(sql).all(...args) }),
          run: async () => db.prepare(sql).run(...args),
          execute: () => db.prepare(sql).run(...args),
        };
      },
    };
  },
  async batch(statements) {
    db.exec('BEGIN');
    try {
      const results = statements.map((statement) => statement.execute());
      db.exec('COMMIT');
      return results;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  },
};
for (const [email, name, role] of [
  ['boss@demo.local', 'Manager', 'member'],
  ['admin@demo.local', 'Admin', 'admin'],
  ['engineer@demo.local', 'Engineer', 'member'],
])
  db.prepare('INSERT OR IGNORE INTO users(email,display_name,role) VALUES(?,?,?)').run(
    email,
    name,
    role,
  );
db.exec(
  "UPDATE users SET is_boss=1,groups_json='[\"Management\"]' WHERE email='boss@demo.local'; UPDATE users SET groups_json='[\"QA\"]' WHERE email='admin@demo.local'; UPDATE users SET groups_json='[\"Engineering\"]' WHERE email='engineer@demo.local';",
);
const storage = resolve(base, '.local-files');
await mkdir(storage, { recursive: true });
const BUCKET = {
  async put(key, data) {
    await writeFile(resolve(storage, key.replace(/\//g, '_')), Buffer.from(data));
  },
  async get(key) {
    const f = resolve(storage, key.replace(/\//g, '_'));
    if (!existsSync(f)) return null;
    return { body: await readFile(f) };
  },
  async delete(key) {
    await rm(resolve(storage, key.replace(/\//g, '_')), { force: true });
  },
};
// These are fixtures for local preview, not real accounts.
for (const [email, role] of [
  ['boss@demo.local', 'member'],
  ['admin@demo.local', 'admin'],
  ['engineer@demo.local', 'member'],
])
  db.prepare('UPDATE users SET role=? WHERE email=?').run(role, email);
const env = { DB: wrapper, BUCKET, DEV_AUTH: '1', ADMIN_EMAIL: 'admin@demo.local' };
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    let response;
    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const method = req.method || 'GET';
      const data = Buffer.concat(chunks);
      const request = new Request(url, {
        method,
        headers: { ...req.headers, 'x-dev-user': req.headers['x-dev-user'] || 'admin@demo.local' },
        body: ['GET', 'HEAD'].includes(method) ? undefined : data,
        duplex: 'half',
      });
      response = await handle(request, env);
    } else {
      const file = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
      if (
        file.includes('..') ||
        !['index.html', 'styles.css', 'app.js', 'language.js', 'favicon.svg'].includes(file)
      ) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const f = resolve(base, 'public', file),
        body = await readFile(f);
      res.writeHead(200, {
        'content-type': types[extname(file)] || 'text/plain',
        'cache-control': 'no-store',
      });
      res.end(body);
      return;
    }
    const buf = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(buf);
  } catch (e) {
    res.writeHead(500);
    res.end('Server error: ' + e.message);
  }
}).listen(port, '127.0.0.1', () =>
  console.log('Work Tracker local preview: http://127.0.0.1:' + port),
);
