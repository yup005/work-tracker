import test from 'node:test';
import { sourceIndex } from './source-index.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  handle,
  businessDaysSince,
  withInactivityReminder,
  instructionGuides,
  currentStageDue,
  followUpState,
} from '../server.mjs';
import vm from 'node:vm';

function context({ commentMigration = true, signalsMigration = true } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0001_password_auth.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0002_releases.sql', import.meta.url), 'utf8'));
  const DB = {
    prepare(query) {
      return {
        bind(...args) {
          return {
            first: async () => db.prepare(query).get(...args) ?? null,
            all: async () => ({ results: db.prepare(query).all(...args) }),
            run: async () => db.prepare(query).run(...args),
            execute: () => db.prepare(query).run(...args),
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
  db.exec(
    readFileSync(new URL('../migrations/0027_instruction_baseline.sql', import.meta.url), 'utf8'),
  );
  for (const [email, name, role] of [
    ['boss@demo.local', 'Boss', 'viewer'],
    ['admin@demo.local', 'Admin', 'admin'],
    ['engineer@demo.local', 'Engineer', 'member'],
  ])
    db.prepare('INSERT INTO users(email,display_name,role) VALUES(?,?,?)').run(email, name, role);
  db.exec(
    "UPDATE users SET is_boss=1,groups_json='[\"Management\"]' WHERE email='boss@demo.local'; UPDATE users SET groups_json='[\"QA\"]' WHERE email='admin@demo.local'; UPDATE users SET groups_json='[\"Engineering\"]' WHERE email='engineer@demo.local';",
  );
  db.exec(
    readFileSync(new URL('../migrations/0003_release_auto_roles.sql', import.meta.url), 'utf8'),
  );
  db.exec(readFileSync(new URL('../migrations/0004_work_structure.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0005_task_focus.sql', import.meta.url), 'utf8'));
  db.exec(
    readFileSync(new URL('../migrations/0006_activity_evidence.sql', import.meta.url), 'utf8'),
  );
  db.exec(readFileSync(new URL('../migrations/0007_guided_workflow.sql', import.meta.url), 'utf8'));
  db.exec(
    readFileSync(new URL('../migrations/0008_private_evidence.sql', import.meta.url), 'utf8'),
  );
  db.exec(
    readFileSync(new URL('../migrations/0009_pending_comments.sql', import.meta.url), 'utf8'),
  );
  db.exec(
    readFileSync(new URL('../migrations/0010_promote_daily_task.sql', import.meta.url), 'utf8'),
  );
  db.exec(readFileSync(new URL('../migrations/0011_private_archive.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0012_instructions.sql', import.meta.url), 'utf8'));
  if (commentMigration)
    db.exec(readFileSync(new URL('../migrations/0013_comment_work.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0014_comment_replies.sql', import.meta.url), 'utf8'));
  db.exec(
    readFileSync(new URL('../migrations/0015_user_language_switch.sql', import.meta.url), 'utf8'),
  );
  db.exec(readFileSync(new URL('../migrations/0016_task_categories.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0017_completed_dates.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0018_user_avatars.sql', import.meta.url), 'utf8'));
  db.exec(
    readFileSync(new URL('../migrations/0019_future_release_plans.sql', import.meta.url), 'utf8'),
  );
  db.exec(readFileSync(new URL('../migrations/0020_work_tracking.sql', import.meta.url), 'utf8'));
  const pmMigration = readFileSync(
    new URL('../migrations/0021_pm_handoff.sql', import.meta.url),
    'utf8',
  );
  db.exec(commentMigration ? pmMigration : pmMigration.split('-- New discussions')[0]);
  if (commentMigration)
    db.exec(
      readFileSync(new URL('../migrations/0022_pm_engineering_tasks.sql', import.meta.url), 'utf8'),
    );
  db.exec(
    readFileSync(new URL('../migrations/0023_current_stage_dates.sql', import.meta.url), 'utf8'),
  );
  db.exec(readFileSync(new URL('../migrations/0024_creation_work.sql', import.meta.url), 'utf8'));
  db.exec(
    readFileSync(new URL('../migrations/0025_qa_feedback_replies.sql', import.meta.url), 'utf8'),
  );
  db.exec(
    readFileSync(new URL('../migrations/0026_pr_review_and_loading.sql', import.meta.url), 'utf8'),
  );
  if (signalsMigration)
    db.exec(
      readFileSync(
        new URL('../migrations/0031_task_numbers_and_urgent.sql', import.meta.url),
        'utf8',
      ),
    );
  const objects = new Map();
  const BUCKET = {
    put: async (k, d) => {
      objects.set(k, d);
    },
    get: async (k) => (objects.has(k) ? { body: objects.get(k) } : null),
    delete: async (k) => objects.delete(k),
  };
  const env = { DB, BUCKET, DEV_AUTH: '1', ADMIN_EMAIL: 'admin@demo.local' };
  async function request(path, { who = 'admin@demo.local', method = 'GET', body, mode } = {}) {
    const headers = { 'x-dev-user': who };
    if (mode) headers['x-workspace-mode'] = mode;
    if (body !== undefined && !(body instanceof FormData))
      headers['content-type'] = 'application/json';
    const r = await handle(
      new Request('http://127.0.0.1:4173/api' + path, {
        method,
        headers,
        body:
          body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      }),
      env,
    );
    const data = r.headers.get('content-type')?.includes('application/json')
      ? await r.json()
      : await r.text();
    return { status: r.status, data };
  }
  return { db, env, request };
}

// Isolated regression fixtures represent already reviewed or QA-approved existing work.
function reviewed(db, tid, passed = false) {
  db.prepare(
    "UPDATE tasks SET feasibility='Confirmed',estimated_delivery_date='2099-12-31',qa_owner='admin@demo.local',assignee='engineer@demo.local' WHERE id=?",
  ).run(tid);
  if (passed)
    db.prepare(
      "UPDATE tasks SET development_status='Approved for Production',qa_status='Passed',current_environment='Stage',stage_confirmed_at='verified-stage',qa_passed_stage_at='verified-stage' WHERE id=?",
    ).run(tid);
}

test('Engineering and QA workflow, append-only history, daily work, and secure office separation', async () => {
  const { db, request } = context();
  const created = await request('/tasks', {
    method: 'POST',
    body: {
      title: 'CPA calculation QA',
      type: 'Bug Fix',
      priority: 'High',
      project: 'Financial',
      description: 'Test net earned according to agreed rules',
      activity_date: '2026-10-08',
    },
  });
  assert.equal(created.status, 201);
  const id = created.data.id;
  reviewed(db, id);
  assert.equal(
    (
      await request('/tasks/' + id, {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { qa_status: 'Passed' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/tasks/' + id, {
        who: 'boss@demo.local',
        method: 'PATCH',
        body: { development_status: 'On Stage' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/tasks/' + id, {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { development_status: 'On Stage', activity_date: '2026-10-07' },
      })
    ).status,
    200,
  );
  const qa = await request('/tasks/' + id + '/activity', {
    method: 'POST',
    body: {
      action_type: 'QA Testing',
      activity_date: '2026-10-08',
      environment: 'Stage',
      result: 'No Visible Changes',
      notes: 'The stage screen looks the same after merge',
    },
  });
  assert.equal(qa.status, 201);
  const comments = await request('/tasks/' + id + '/comments', {
    method: 'POST',
    who: 'engineer@demo.local',
    body: { body: 'Patch has been merged, please hard-refresh' },
  });
  assert.equal(comments.status, 201);
  const details = (await request('/tasks/' + id)).data;
  assert.equal(
    details.task.qa_status,
    'No Visible Changes',
    'QA test itself synchronizes the QA status',
  );
  assert.equal(
    details.activities.length,
    4,
    'Requirement, Development, QA test and requirement discussion all remain in history',
  );
  assert.equal(details.comments.length, 1);
  const list = (await request('/tasks')).data.tasks[0];
  assert.equal(list.last_engineer_action, '2026-10-07');
  assert.equal(list.last_qa_action, '2026-10-08');
  assert.throws(
    () => db.prepare('UPDATE activities SET notes=?').run('tampered'),
    /Activities are immutable/,
  );
  assert.throws(() => db.prepare('DELETE FROM comments').run(), /Comments are immutable/);
  const createdOffice = await request('/office', {
    method: 'POST',
    body: {
      work_date: '2026-10-08',
      title: 'Order supplies',
      details: 'Review order quantity',
      category: 'Purchasing',
      status: 'Completed',
    },
  });
  assert.equal(createdOffice.status, 201);
  assert.equal((await request('/office', { who: 'engineer@demo.local' })).data.logs.length, 0);
  assert.equal((await request('/office', { who: 'boss@demo.local' })).data.logs.length, 1);
  assert.equal(
    (await request('/office/' + createdOffice.data.id, { who: 'engineer@demo.local' })).status,
    404,
  );
  assert.equal(
    (
      await request('/office/' + createdOffice.data.id, {
        who: 'admin@demo.local',
        method: 'PATCH',
        body: { details: 'Review order quantity x3' },
      })
    ).status,
    200,
  );
  assert.equal((await request('/office/' + createdOffice.data.id)).data.revisions.length, 2);
  assert.equal(
    (await request('/daily?date=2026-10-08', { who: 'boss@demo.local' })).data.office.length,
    1,
  );
  assert.equal(
    (await request('/daily?date=2026-10-08', { who: 'engineer@demo.local' })).data.office.length,
    0,
  );
  assert.equal(
    (await request('/daily?date=2026-10-08&email=admin@demo.local', { who: 'engineer@demo.local' }))
      .status,
    403,
  );
  assert.equal((await request('/export', { who: 'engineer@demo.local' })).status, 403);
  assert.equal((await request('/export', { who: 'boss@demo.local' })).status, 403);
  const exportData = await request('/export', { who: 'admin@demo.local' });
  assert.equal(exportData.status, 200);
  assert.equal(exportData.data.tables.office_revisions.length, 2);
  db.close();
});

test('Untrusted local preview header cannot authenticate a hosted application URL', async () => {
  const { db, env } = context();
  const req = new Request('https://app.example.com/api/me', {
    headers: { 'x-dev-user': 'boss@demo.local' },
  });
  const resp = await handle(req, env);
  assert.equal(resp.status, 401);
  const req2 = new Request('https://app.example.com/api/me', {
    headers: {
      'oai-authenticated-user-email': 'engineer@demo.local',
      'oai-authenticated-user-id': 'real-engineer',
    },
  });
  const resp2 = await handle(req2, env);
  assert.equal(resp2.status, 200);
  db.close();
});

test('Files remain private when attached to a private office log', async () => {
  const { db, request } = context();
  const office = await request('/office', {
    method: 'POST',
    body: { title: 'Vendor document', work_date: '2026-10-08' },
  });
  const form = new FormData();
  form.append('file', new File(['sample'], 'invoice-note.txt', { type: 'text/plain' }));
  form.append('office_id', office.data.id);
  const upload = await request('/attachments', { method: 'POST', body: form });
  assert.equal(upload.status, 201);
  assert.equal(
    (await request('/attachments/' + upload.data.id, { who: 'engineer@demo.local' })).status,
    404,
  );
  assert.equal(
    (await request('/attachments/' + upload.data.id, { who: 'boss@demo.local' })).status,
    200,
  );
  db.close();
});

test('Priority queue, manual ranking, boss-first daily activity, and role-safe team activity', async () => {
  const { db, request } = context();
  const low = await request('/tasks', {
    method: 'POST',
    body: { title: 'Low urgency item', priority: 'Low', activity_date: '2026-10-08' },
  });
  const urgent = await request('/tasks', {
    method: 'POST',
    body: { title: 'Urgent appointment fix', priority: 'Urgent', activity_date: '2026-10-08' },
  });
  const high = await request('/tasks', {
    method: 'POST',
    body: { title: 'High priority QA', priority: 'High', activity_date: '2026-10-08' },
  });
  assert.equal(low.status, 201);
  assert.equal(urgent.status, 201);
  assert.equal(high.status, 201);
  const tasks = (await request('/tasks')).data.tasks;
  assert.deepEqual(
    tasks.map((x) => x.priority),
    ['Urgent', 'High', 'Low'],
  );
  assert.equal(tasks[0].sort_order > 0, true);
  const newRank = await request('/tasks/' + low.data.id, {
    method: 'PATCH',
    body: { sort_order: 1, activity_date: '2026-10-08' },
  });
  assert.equal(newRank.status, 200);
  assert.equal(
    (
      await request('/tasks/' + low.data.id, {
        method: 'PATCH',
        who: 'engineer@demo.local',
        body: { sort_order: 2 },
      })
    ).status,
    403,
  );
  assert.equal(
    (await request('/tasks')).data.tasks[0].priority,
    'Urgent',
    'Priority mode stays primary when rank changes',
  );
  const office = await request('/office', {
    method: 'POST',
    body: {
      work_date: '2026-10-08',
      title: 'Order printer paper',
      category: 'Purchasing',
      status: 'Completed',
    },
  });
  assert.equal(office.status, 201);
  const qaSummary = (await request('/summary?date=2026-10-08')).data;
  const bossSummary = (await request('/summary?date=2026-10-08', { who: 'boss@demo.local' })).data;
  const engineerSummary = (
    await request('/summary?date=2026-10-08', { who: 'engineer@demo.local' })
  ).data;
  assert.ok(qaSummary.today_activity.some((x) => x.title === 'Order printer paper' && x.private));
  assert.ok(bossSummary.today_activity.some((x) => x.title === 'Order printer paper' && x.private));
  assert.ok(
    !engineerSummary.today_activity.some((x) => x.private),
    'Engineer cannot view private office work through dashboard',
  );
  const anotherQA = await request('/tasks/' + urgent.data.id + '/activity', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: {
      action_type: 'Development',
      activity_date: '2026-10-08',
      environment: 'Local',
      result: 'Fixed locally',
    },
  });
  assert.equal(anotherQA.status, 201);
  const teamQA = await request('/daily?date=2026-10-08&scope=team');
  assert.ok(
    !teamQA.data.activities.some((x) => x.actor_email === 'engineer@demo.local'),
    'Admin daily page includes only own dated work',
  );
  assert.ok(teamQA.data.office.some((x) => x.title === 'Order printer paper'));
  const teamEngineer = await request('/daily?date=2026-10-08&scope=team', {
    who: 'engineer@demo.local',
  });
  assert.ok(
    !teamEngineer.data.activities.some((x) => x.actor_email === 'admin@demo.local'),
    'Individual daily work is never shared with other employees',
  );
  assert.equal(teamEngineer.data.office.length, 0);
  assert.equal(
    (
      await request('/daily?date=2026-10-08&scope=team&email=admin@demo.local', {
        who: 'engineer@demo.local',
      })
    ).status,
    403,
  );
  db.close();
});

test('Private daily records for engineers, boss read-only, Admin account management, individual dashboards', async () => {
  const { db, request } = context();
  const engineer = await request('/office', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: {
      title: 'Investigate local build',
      category: 'Development (unlinked)',
      details: 'Tried alternate dependency versions',
      work_date: '2026-10-08',
    },
  });
  assert.equal(engineer.status, 201, 'Engineer can create private unlinked daily work');
  const qa = await request('/office', {
    method: 'POST',
    body: { title: 'Buy clinic stationery', category: 'Purchasing', work_date: '2026-10-08' },
  });
  assert.equal(qa.status, 201);
  const task = await request('/tasks', {
    method: 'POST',
    body: { title: 'Shared priority task', activity_date: '2026-10-08' },
  });
  assert.equal(task.status, 201);
  await request('/tasks/' + task.data.id + '/activity', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: {
      action_type: 'Development',
      activity_date: '2026-10-08',
      result: 'Local fix completed',
    },
  });
  const engineerMine = await request('/daily?date=2026-10-08&scope=team', {
    who: 'engineer@demo.local',
  });
  assert.deepEqual(
    engineerMine.data.office.map((x) => x.title),
    ['Investigate local build'],
  );
  assert.ok(engineerMine.data.activities.every((x) => x.actor_email === 'engineer@demo.local'));
  const adminMine = await request('/daily?date=2026-10-08', { who: 'admin@demo.local' });
  assert.deepEqual(
    adminMine.data.office.map((x) => x.title),
    ['Buy clinic stationery'],
  );
  const bossView = await request('/daily?date=2026-10-08', { who: 'boss@demo.local' });
  assert.deepEqual(
    new Set(bossView.data.office.map((x) => x.title)),
    new Set(['Investigate local build', 'Buy clinic stationery']),
  );
  assert.equal(
    (await request('/office/' + engineer.data.id, { who: 'admin@demo.local' })).status,
    404,
    'Admin cannot view engineer personal record',
  );
  assert.equal(
    (await request('/attachments', { who: 'boss@demo.local', method: 'POST', body: {} })).status,
    403,
  );
  assert.equal(
    (
      await request('/office', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { title: 'Boss writes', work_date: '2026-10-08' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/tasks', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { title: 'Boss writes' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/tasks/' + task.data.id + '/comments', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { body: 'Boss comments' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/tasks/' + task.data.id + '/activity', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { action_type: 'QA Testing', result: 'Passed', activity_date: '2026-10-08' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/users', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { email: 'new@example.com', role: 'member', groups: ['Engineering'] },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/users', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { email: 'new@example.com', role: 'member', groups: ['Engineering'] },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/users', {
        who: 'admin@demo.local',
        method: 'POST',
        body: { email: 'new@example.com', role: 'member', groups: ['Engineering'] },
      })
    ).status,
    201,
  );
  const summaryEngineer = (
    await request('/summary?date=2026-10-08', { who: 'engineer@demo.local' })
  ).data;
  assert.ok(summaryEngineer.today_activity.some((a) => a.title === 'Investigate local build'));
  assert.ok(!summaryEngineer.today_activity.some((a) => a.title === 'Buy clinic stationery'));
  assert.ok(summaryEngineer.daily.every((a) => a.email === 'engineer@demo.local'));
  const summaryAdmin = (await request('/summary?date=2026-10-08', { who: 'admin@demo.local' }))
    .data;
  assert.ok(!summaryAdmin.today_activity.some((a) => a.title === 'Investigate local build'));
  const summaryBoss = (await request('/summary?date=2026-10-08', { who: 'boss@demo.local' })).data;
  assert.ok(summaryBoss.today_activity.some((a) => a.title === 'Investigate local build'));
  assert.ok(summaryBoss.today_activity.some((a) => a.title === 'Buy clinic stationery'));
  const exportAdmin = await request('/export', { who: 'admin@demo.local' });
  assert.equal(exportAdmin.status, 200);
  assert.deepEqual(
    exportAdmin.data.tables.office_logs.map((a) => a.title),
    ['Buy clinic stationery'],
    'Admin export must not leak private records',
  );
  db.close();
});

test('Roles and multi-group membership are independent; shared daily excludes private work', async () => {
  const { db, request } = context();
  const added = await request('/users', {
    method: 'POST',
    body: {
      email: 'dual@example.com',
      display_name: 'Dual',
      role: 'member',
      groups: ['Engineering', 'QA'],
    },
  });
  assert.equal(added.status, 201);
  const me = (await request('/me', { who: 'dual@example.com' })).data.user;
  assert.equal(me.role, 'member');
  assert.deepEqual(me.groups, ['Engineering', 'QA']);
  const created = await request('/tasks', {
    who: 'dual@example.com',
    method: 'POST',
    body: { title: 'Shared task', activity_date: '2026-10-08' },
  });
  reviewed(db, created.data.id);
  assert.equal(
    (
      await request('/tasks/' + created.data.id, {
        who: 'dual@example.com',
        method: 'PATCH',
        body: { development_status: 'On Stage', activity_date: '2026-10-08' },
      })
    ).status,
    200,
  );
  await request('/tasks/' + created.data.id + '/activity', {
    who: 'dual@example.com',
    method: 'POST',
    body: {
      action_type: 'QA Testing',
      activity_date: '2026-10-08',
      result: 'Passed',
      notes: 'Verified shared task',
    },
  });
  await request('/office', {
    who: 'dual@example.com',
    method: 'POST',
    body: { title: 'Secret personal work', work_date: '2026-10-08' },
  });
  const daily = (
    await request('/engineering-daily?date=2026-10-08', { who: 'engineer@demo.local' })
  ).data;
  assert.ok(daily.activities.length > 0);
  assert.deepEqual(daily.office, []);
  assert.ok(!JSON.stringify(daily).includes('Secret personal work'));
  assert.equal(
    (
      await request('/users', {
        method: 'POST',
        body: {
          email: 'viewer@example.com',
          role: 'member',
          groups: ['Management', 'Engineering', 'QA'],
        },
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request('/tasks', {
        who: 'viewer@example.com',
        mode: 'team',
        method: 'POST',
        body: { title: 'Must fail' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/daily?date=2026-10-08&email=dual@example.com', {
        who: 'viewer@example.com',
        mode: 'team',
      })
    ).status,
    200,
  );
  db.close();
});

test('Independent passwords, owner bootstrap, sessions, CSRF, roles and logout', async () => {
  const { env, db } = context();
  env.DEV_AUTH = undefined;
  const origin = 'https://tracker.example';
  async function call(path, body, extra = {}) {
    return handle(
      new Request(origin + '/api' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { origin, 'content-type': 'application/json', ...extra },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
  }
  const owner = {
    'oai-authenticated-user-email': 'admin@demo.local',
    'oai-authenticated-user-id': 'stable-admin',
  };
  assert.equal(
    (await call('/me', undefined, owner)).status,
    401,
    'Platform identity alone cannot log in',
  );
  assert.equal(
    (
      await call(
        '/auth/setup',
        { password: 'secure-passphrase-admin' },
        {
          'oai-authenticated-user-email': 'engineer@demo.local',
          'oai-authenticated-user-id': 'stable-engineer',
        },
      )
    ).status,
    403,
  );
  const setup = await call('/auth/setup', { password: 'secure-passphrase-admin' }, owner);
  assert.equal(setup.status, 200);
  const cookie = setup.headers.get('set-cookie').split(';')[0];
  assert.match(setup.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
  const me = await (await call('/me', undefined, { cookie })).json();
  assert.equal(me.user.display_name, 'Admin');
  assert.equal(me.user.role, 'admin');
  assert.deepEqual(me.user.groups, ['QA']);
  assert.equal(
    (await call('/auth/setup', { password: 'different-secure-passphrase' }, owner)).status,
    409,
  );
  assert.equal(
    (await call('/auth/login', { email: 'admin@demo.local', password: 'wrong' })).status,
    401,
  );
  assert.equal(
    (await call('/auth/login', { email: 'admin@demo.local', password: 'secure-passphrase-admin' }))
      .status,
    200,
  );
  assert.equal(
    (
      await call(
        '/auth/login',
        { email: 'admin@demo.local', password: 'secure-passphrase-admin' },
        { origin: 'https://evil.example' },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        '/password',
        { email: 'engineer@demo.local', password: 'secure-passphrase-engineer' },
        { cookie },
      )
    ).status,
    200,
  );
  const engineer = await call('/auth/login', {
    email: 'engineer@demo.local',
    password: 'secure-passphrase-engineer',
  });
  const sc = engineer.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (await call('/users', { email: 'hacker@example.com', role: 'admin' }, { cookie: sc })).status,
    403,
  );
  assert.equal(
    (await call('/daily?date=2026-10-08&email=admin@demo.local', undefined, { cookie: sc })).status,
    403,
  );
  db.prepare('UPDATE auth_sessions SET expires_at=0 WHERE email=?').run('engineer@demo.local');
  assert.equal((await call('/me', undefined, { cookie: sc })).status, 401);
  assert.equal((await call('/auth/logout', {}, { cookie })).status, 200);
  assert.equal((await call('/me', undefined, { cookie })).status, 401);
  for (let i = 0; i < 11; i++)
    await call('/auth/login', { email: 'missing@example.com', password: 'bad' });
  assert.equal(
    (await call('/auth/login', { email: 'missing@example.com', password: 'bad' })).status,
    429,
  );
  assert.notEqual(
    db.prepare('SELECT password_hash FROM auth_credentials WHERE email=?').get('admin@demo.local')
      .password_hash,
    'secure-passphrase-admin',
  );
  db.close();
});

test('Board image bytes round-trip and safe preview stays read-only', async () => {
  const { db, request } = context();
  const t = (await request('/tasks', { method: 'POST', body: { title: 'Screenshot task' } })).data;
  const form = new FormData();
  form.append('task_id', t.id);
  form.append(
    'file',
    new File([new Uint8Array([137, 80, 78, 71])], 'screenshot.png', { type: 'image/png' }),
  );
  const upload = await request('/attachments', { method: 'POST', body: form });
  assert.equal(upload.status, 201);
  const got = await request('/attachments/' + upload.data.id + '?preview=1', {
    who: 'engineer@demo.local',
  });
  assert.equal(got.status, 200);
  assert.equal(
    db.prepare('SELECT content_type FROM attachments WHERE id=?').get(upload.data.id).content_type,
    'image/png',
  );
  db.close();
});

test('Management automatically grants read-only Boss access', async () => {
  const { db, request } = context();
  assert.equal(
    (
      await request('/users', {
        method: 'POST',
        body: { email: 'manager@example.com', role: 'member', groups: ['Management'] },
      })
    ).status,
    201,
  );
  const user = (await request('/me', { who: 'manager@example.com' })).data.user;
  assert.equal(user.role, 'member');
  assert.equal(user.is_boss, 1);
  await request('/office', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: { title: 'Private engineering work', work_date: '2026-10-08' },
  });
  const daily = await request('/daily?date=2026-10-08&email=engineer@demo.local', {
    who: 'manager@example.com',
  });
  assert.equal(daily.status, 200);
  assert.ok(daily.data.office.some((x) => x.title === 'Private engineering work'));
  assert.equal(
    (
      await request('/tasks', {
        who: 'manager@example.com',
        method: 'POST',
        body: { title: 'Forbidden' },
      })
    ).status,
    403,
  );
  db.close();
});

test('Release plans, permissions, delivered snapshot and historical lock', async () => {
  const { db, request } = context();
  assert.equal(
    (
      await request('/releases', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { version: 'x', planned_date: '2026-10-14' },
      })
    ).status,
    403,
  );
  const created = await request('/releases', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: { version: 'v1.0', planned_date: '2026-10-14' },
  });
  assert.equal(created.status, 201);
  const rid = created.data.id;
  const t = await request('/tasks', {
    method: 'POST',
    body: { title: 'Fixed billing bug', type: 'Bug Fix' },
  });
  const tid = t.data.id;
  assert.equal(
    (
      await request('/releases/' + rid, {
        method: 'PATCH',
        body: { task_ids: [tid], publish: true, released_date: '2026-10-14' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/releases/' + rid, {
        method: 'PATCH',
        body: { task_ids: [tid], notes: 'Billing fix' },
      })
    ).status,
    200,
  );
  db.prepare("UPDATE tasks SET development_status='On Production' WHERE id=?").run(tid);
  assert.equal(
    (
      await request('/releases/' + rid, {
        method: 'PATCH',
        body: { publish: true, released_date: '2026-10-14' },
      })
    ).status,
    200,
  );
  db.prepare('UPDATE tasks SET title=? WHERE id=?').run('Changed task title', tid);
  const list = await request('/releases', { who: 'boss@demo.local' });
  assert.equal(list.status, 200);
  assert.equal(
    JSON.parse(list.data.releases.find((r) => r.id === rid).snapshot_json)[0].title,
    'Fixed billing bug',
  );
  assert.equal(
    (await request('/releases/' + rid, { method: 'PATCH', body: { notes: 'rewrite' } })).status,
    409,
  );
  db.close();
});

test('Auto release inclusion uses production dates, respects exclusions and never duplicates released tasks', async () => {
  const { db, request } = context();
  const t = (
    await request('/tasks', { method: 'POST', body: { title: 'Auto fix', type: 'Bug Fix' } })
  ).data.id;
  const closed = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Closed without production', type: 'Bug Fix' },
    })
  ).data.id;
  await request('/tasks/' + closed, {
    method: 'PATCH',
    body: { development_status: 'Closed', activity_date: '2026-10-09' },
  });
  reviewed(db, t, true);
  await request('/tasks/' + t, {
    method: 'PATCH',
    body: { development_status: 'On Production', activity_date: '2026-10-09' },
  });
  const r = (
    await request('/releases', {
      method: 'POST',
      body: { version: 'auto-1', planned_date: '2026-10-14' },
    })
  ).data.id;
  assert.equal(
    (
      await request('/releases', {
        method: 'POST',
        body: { version: 'auto-2', planned_date: '2026-10-21' },
      })
    ).status,
    201,
  );
  let list = (await request('/releases')).data.releases;
  assert.deepEqual(JSON.parse(list.find((x) => x.id === r).task_ids_json), [t]);

  await request('/releases/' + r, { method: 'PATCH', body: { task_ids: [] } });
  list = (await request('/releases')).data.releases;
  assert.deepEqual(JSON.parse(list.find((x) => x.id === r).task_ids_json), []);
  await request('/releases/' + r, {
    method: 'PATCH',
    body: { task_ids: [t], publish: true, released_date: '2026-10-14' },
  });
  const future = (await request('/releases')).data.releases.find((r) => r.status === 'Planned').id;
  assert.equal(
    (await request('/releases/' + future, { method: 'PATCH', body: { task_ids: [t] } })).status,
    409,
  );
  assert.deepEqual(
    JSON.parse(
      (await request('/releases')).data.releases.find((x) => x.id === future).task_ids_json,
    ),
    [],
  );
  assert.equal(
    (
      await request('/users', {
        method: 'POST',
        body: { email: 'oldviewer@example.com', role: 'viewer', groups: [] },
      })
    ).status,
    400,
  );
  db.close();
});

test('Team edit preserves passwords and only Admin sees password setup status', async () => {
  const { db, request } = context();
  const row = () => request('/users');
  assert.equal(
    (await row()).data.users.find((u) => u.email === 'engineer@demo.local').has_password,
    0,
  );
  db.prepare('INSERT INTO auth_credentials(email,salt,password_hash) VALUES(?,?,?)').run(
    'engineer@demo.local',
    'test-salt',
    'test-hash',
  );
  assert.equal(
    (await row()).data.users.find((u) => u.email === 'engineer@demo.local').has_password,
    1,
  );
  await request('/users', {
    method: 'POST',
    body: {
      email: 'engineer@demo.local',
      display_name: 'Engineer updated',
      role: 'member',
      groups: ['Engineering', 'QA'],
    },
  });
  assert.equal(
    db
      .prepare('SELECT password_hash FROM auth_credentials WHERE email=?')
      .get('engineer@demo.local').password_hash,
    'test-hash',
  );
  const users = (await request('/users', { who: 'engineer@demo.local' })).data.users;
  assert.equal(users.find((u) => u.email === 'engineer@demo.local').has_password, null);
  assert.ok(!JSON.stringify(users).includes('test-hash'));
  db.close();
});

test('Private projects, child tasks and dated editable work stay isolated; deleted work disappears', async () => {
  const { db, request } = context();
  const project = (
    await request('/private-work', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { kind: 'Project', title: 'Private prototype' },
    })
  ).data.id;
  const child = (
    await request('/private-work', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { kind: 'Task', title: 'Design login', parent_id: project },
    })
  ).data.id;
  assert.equal(
    (await request('/private-work')).data.items.length,
    0,
    'Admin must not see employee private projects',
  );
  assert.equal((await request('/private-work', { who: 'boss@demo.local' })).data.items.length, 2);
  assert.equal((await request('/private-work?email=engineer@demo.local')).status, 403);
  assert.equal(
    (await request('/private-work/' + child, { method: 'PATCH', body: { title: 'Unauthorized' } }))
      .status,
    404,
  );
  assert.equal(
    (
      await request('/private-work/' + child, {
        who: 'boss@demo.local',
        method: 'PATCH',
        body: { title: 'Unauthorized' },
      })
    ).status,
    403,
  );
  const entry = (
    await request('/office', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { title: 'Initial progress', work_item_id: child, work_date: '2026-10-08' },
    })
  ).data.id;
  assert.equal(
    (
      await request('/office/' + entry, {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { title: 'Login layout done', details: 'Continue tomorrow', work_date: '2026-10-09' },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('/daily?date=2026-10-08', { who: 'engineer@demo.local' })).data.office.length,
    0,
  );
  assert.equal(
    (await request('/daily?date=2026-10-09', { who: 'boss@demo.local' })).data.office[0]
      .work_item_id,
    child,
  );
  assert.equal((await request('/office/' + entry, { method: 'DELETE' })).status, 404);
  assert.equal(
    (await request('/office/' + entry, { who: 'engineer@demo.local', method: 'DELETE' })).status,
    200,
  );
  assert.equal(
    (await request('/daily?date=2026-10-09', { who: 'boss@demo.local' })).data.office.length,
    0,
  );
  assert.equal((await request('/office/' + entry, { who: 'engineer@demo.local' })).status, 404);
  assert.ok(
    db
      .prepare('SELECT * FROM office_revisions WHERE office_id=? AND change_type=?')
      .get(entry, 'Deleted'),
  );
  assert.equal(
    (await request('/private-work/' + project, { who: 'engineer@demo.local', method: 'DELETE' }))
      .status,
    409,
  );
  await request('/private-work/' + child, {
    who: 'engineer@demo.local',
    method: 'PATCH',
    body: { status: 'Completed' },
  });
  assert.equal(
    (await request('/private-work', { who: 'engineer@demo.local' })).data.items.find(
      (i) => i.id === child,
    ).status,
    'Completed',
  );
  db.close();
});
test('Admin-only history and shared categories with cycle-safe parent tasks', async () => {
  const { db, request } = context();
  assert.equal((await request('/activity', { who: 'engineer@demo.local' })).status, 403);
  assert.equal((await request('/activity', { who: 'boss@demo.local' })).status, 403);
  assert.equal((await request('/activity')).status, 200);
  assert.equal(
    (await request('/engineering-daily?date=2026-10-08', { who: 'engineer@demo.local' })).status,
    200,
  );
  const parent = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Financial Reports', category: 'Reports' },
    })
  ).data.id;
  const child = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Gross Report', category: 'Reports', parent_task_id: parent },
    })
  ).data.id;
  const item = (await request('/tasks/' + child)).data.task;
  assert.equal(item.category, 'Reports');
  assert.equal(item.parent_task_id, parent);
  assert.equal(
    (await request('/tasks/' + parent, { method: 'PATCH', body: { parent_task_id: child } }))
      .status,
    400,
  );
  assert.equal(
    (
      await request('/tasks/' + child, {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { category: 'Billing' },
      })
    ).status,
    200,
  );
  db.close();
});
test('Custom categories persist, normalize duplicates, stay reusable and preserve Manager read-only access', async () => {
  const { db, request } = context();
  const guide = instructionGuides({ role: 'admin', groups: ['QA'] }).find(
    (g) => g.id === 'task-categories-admin-qa-v1',
  );
  assert.ok(guide);
  const created = await request('/categories', {
    method: 'POST',
    body: { name: '  Inventory  Operations  ' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.name, 'Inventory Operations');
  const duplicate = await request('/categories', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: { name: 'inventory operations' },
  });
  assert.equal(duplicate.data.name, 'Inventory Operations');
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM task_categories WHERE name='Inventory Operations' COLLATE NOCASE",
      )
      .get().n,
    1,
  );
  assert.ok(
    (await request('/me', { who: 'engineer@demo.local' })).data.statuses.categories.includes(
      'Inventory Operations',
    ),
  );
  assert.ok(
    (await request('/categories', { who: 'boss@demo.local' })).data.categories.includes(
      'Inventory Operations',
    ),
  );
  assert.equal(
    (
      await request('/categories', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { name: 'Forbidden category' },
      })
    ).status,
    403,
  );
  for (const name of ['', '  ', 'x'.repeat(81), '__add_category__', 'all'])
    assert.equal((await request('/categories', { method: 'POST', body: { name } })).status, 400);
  const taskId = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Check stock', category: 'inventory operations' },
    })
  ).data.id;
  assert.equal((await request('/tasks/' + taskId)).data.task.category, 'Inventory Operations');
  assert.equal(
    (
      await request('/tasks/' + taskId, {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { category: 'New workflow' },
      })
    ).status,
    200,
  );
  assert.ok((await request('/me')).data.statuses.categories.includes('New workflow'));
  const me = (await request('/me')).data;
  assert.ok(me.instructions.guides.some((g) => g.id === guide.id));
  assert.ok(!me.instructions.acknowledged.includes(guide.id));
  assert.equal(
    (await request('/instructions/ack', { method: 'POST', body: { id: guide.id } })).status,
    200,
  );
  assert.ok(
    !(await request('/me', { who: 'engineer@demo.local' })).data.instructions.acknowledged.includes(
      guide.id,
    ),
  );
  assert.equal(
    db.prepare('SELECT count(*) AS n FROM activities WHERE is_work=1').get().n,
    1,
    'Only the task submission counts; category creation and edits remain audit records',
  );
  db.close();
});
test('Cards and List retain the same task identity, categories and sorting without visible Order numbers', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    sandbox = { document: { addEventListener() {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext(
    code.slice(sourceIndex(code, 'const taskTitle='), sourceIndex(code, 'function setView(')),
    sandbox,
  );
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'const priorityRank='),
      sourceIndex(code, 'function renderDaily('),
    ),
    sandbox,
  );
  const task = {
    id: 'task-a',
    title: 'Check receipt <unsafe>',
    type: 'Bug Fix',
    priority: 'High',
    category: 'Billing',
    sort_order: 20,
    development_status: 'On Stage',
    qa_status: 'Retest Required',
    assignee: 'engineer@demo.local',
    updated_at: '2026-10-12',
    workflow: { phase: 'qa', owner: 'admin@demo.local' },
  };
  vm.runInContext(
    `state.user={email:'admin@demo.local',role:'admin',groups:['QA']};state.users=[];state.statuses={categories:['Billing'],development:['On Stage']};state.tasks=${JSON.stringify([task])};state.boardLayout='cards';`,
    sandbox,
  );
  const cards = vm.runInContext('renderBoard()', sandbox);
  assert.match(cards, /data-row-task="task-a"/);
  assert.match(cards, /category-tag/);
  assert.match(cards, /Billing/);
  assert.match(cards, /Test on Stage/);
  assert.match(cards, /Check receipt &lt;unsafe&gt;/);
  assert.ok(!cards.includes('<th>ORDER</th>'));
  vm.runInContext("state.boardLayout='list'", sandbox);
  const list = vm.runInContext('renderBoard()', sandbox);
  assert.match(list, /<th>CATEGORY<\/th>/);
  assert.match(list, /data-row-task="task-a"/);
  assert.match(list, /category-tag/);
  assert.ok(!list.includes('<th>ORDER</th>'));
  assert.ok(!list.includes('<td>20</td>'));
  assert.match(list, /Manual order/);
  assert.match(list, /Daily Engineering Activity/);
  vm.runInContext("state.user={role:'member',groups:['Management']}", sandbox);
  const readonly = vm.runInContext('renderBoard()', sandbox);
  assert.ok(!readonly.includes('data-modal="task"'));
  assert.ok(!readonly.includes('__add_category__'));
});
test('Exactly one automatic pending version persists until release, then next Wednesday opens', async () => {
  const { db, request } = context();
  const r = (await request('/releases/ensure', { method: 'POST' })).data.release;
  const again = (await request('/releases/ensure', { method: 'POST' })).data.release;
  assert.equal(again.id, r.id);
  const candidates = await Promise.all([
    request('/releases/ensure', { method: 'POST' }),
    request('/releases/ensure', { method: 'POST' }),
  ]);
  assert.ok(candidates.every((x) => x.data.release.id === r.id));
  const t = (await request('/tasks', { method: 'POST', body: { title: 'Ready feature' } })).data.id;
  reviewed(db, t, true);
  await request('/tasks/' + t, {
    method: 'PATCH',
    body: { development_status: 'On Production', activity_date: '2026-10-08' },
  });
  assert.equal(
    (
      await request('/releases/' + r.id, {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { publish: true, task_ids: [t], released_date: '2026-10-14' },
      })
    ).status,
    200,
  );
  const releases = (await request('/releases')).data.releases;
  const next = releases.filter((x) => x.status === 'Planned');
  assert.equal(next.length, 1);
  assert.equal(new Date(next[0].planned_date + 'T12:00:00Z').getUTCDay(), 3);
  assert.notEqual(next[0].id, r.id);
  assert.equal((await request('/releases/ensure', { method: 'POST' })).data.release.id, next[0].id);
  db.close();
});

test('Member choices remain validated and removed next-step overrides preserve legacy text', async () => {
  const { db, request } = context();
  const t = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Assigned work', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  db.prepare("UPDATE tasks SET next_step='Retest billing' WHERE id=?").run(t);
  assert.equal((await request('/tasks/' + t)).data.task.next_step, 'Retest billing');
  assert.equal(
    (await request('/tasks/' + t, { method: 'PATCH', body: { assignee: 'missing@example.com' } }))
      .status,
    400,
  );
  assert.equal(
    (
      await request('/tasks/' + t, {
        method: 'PATCH',
        body: { next_action_owner: 'boss@demo.local' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/tasks/' + t, {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { next_step: 'Ready for Stage' },
      })
    ).status,
    400,
  );
  assert.equal((await request('/tasks/' + t)).data.task.next_step, 'Retest billing');
  db.close();
});
test('Deletion requires confirmation; multi-person work and parent tasks archive and can be restored', async () => {
  const { db, request } = context();
  const solo = (await request('/tasks', { method: 'POST', body: { title: 'Single-person draft' } }))
    .data.id;
  assert.equal((await request('/tasks/' + solo, { method: 'DELETE', body: {} })).status, 400);
  assert.equal(
    (
      await request('/tasks/' + solo, {
        who: 'engineer@demo.local',
        method: 'DELETE',
        body: { confirm: true },
      })
    ).status,
    403,
  );
  assert.equal((await request('/tasks/' + solo)).data.removal_mode, 'Deleted');
  assert.equal(
    (await request('/tasks/' + solo, { method: 'DELETE', body: { confirm: true } })).data.action,
    'Deleted',
  );
  assert.equal((await request('/tasks/' + solo)).status, 404);
  assert.ok(!(await request('/tasks')).data.tasks.some((t) => t.id === solo));
  const team = (await request('/tasks', { method: 'POST', body: { title: 'Shared work' } })).data
    .id;
  await request('/tasks/' + team + '/comments', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: { body: 'Working on this' },
  });
  assert.equal((await request('/tasks/' + team)).data.removal_mode, 'Archived');
  assert.equal(
    (await request('/tasks/' + team, { method: 'DELETE', body: { confirm: true } })).data.action,
    'Archived',
  );
  assert.equal((await request('/tasks/' + team)).status, 200);
  assert.ok((await request('/tasks?archived=1')).data.tasks.some((t) => t.id === team));
  assert.equal(
    (await request('/tasks/' + team, { method: 'PATCH', body: { title: 'Overwrite' } })).status,
    409,
  );
  assert.equal((await request('/tasks/' + team + '/restore', { method: 'POST' })).status, 200);
  assert.ok((await request('/tasks')).data.tasks.some((t) => t.id === team));
  const parent = (await request('/tasks', { method: 'POST', body: { title: 'Parent' } })).data.id;
  await request('/tasks', { method: 'POST', body: { title: 'Child', parent_task_id: parent } });
  assert.equal(
    (await request('/tasks/' + parent, { method: 'DELETE', body: { confirm: true } })).data.action,
    'Archived',
  );
  db.close();
});

test('Removal preserves released snapshots and clears unfinished release selections', async () => {
  const { db, request } = context();
  const t = (
    await request('/tasks', { method: 'POST', body: { title: 'Single contributor delivery' } })
  ).data.id;
  const plan = (await request('/releases/ensure', { method: 'POST' })).data.release;
  await request('/releases/' + plan.id, { method: 'PATCH', body: { task_ids: [t] } });
  reviewed(db, t, true);
  await request('/tasks/' + t, { method: 'PATCH', body: { development_status: 'On Production' } });
  await request('/releases/' + plan.id, {
    method: 'PATCH',
    body: { publish: true, task_ids: [t], released_date: '2026-10-14' },
  });
  const d = await request('/tasks/' + t);
  assert.equal(d.data.removal_mode, 'Archived');
  assert.equal(d.data.removal_reason, 'Included in a released version');
  assert.equal(
    (await request('/tasks/' + t, { method: 'DELETE', body: { confirm: true } })).data.action,
    'Archived',
  );
  const released = (await request('/releases')).data.releases.find((r) => r.id === plan.id);
  assert.equal(JSON.parse(released.snapshot_json)[0].title, 'Single contributor delivery');
  const temp = (await request('/tasks', { method: 'POST', body: { title: 'Temporary draft' } }))
    .data.id;
  const next = (await request('/releases')).data.releases.find((r) => r.status === 'Planned');
  await request('/releases/' + next.id, { method: 'PATCH', body: { task_ids: [temp] } });
  await request('/tasks/' + temp, { method: 'DELETE', body: { confirm: true } });
  assert.deepEqual(
    JSON.parse(
      (await request('/releases')).data.releases.find((r) => r.id === next.id).task_ids_json,
    ),
    [],
  );
  db.close();
});

test('Metadata changes remain in history, while blocked QA testing counts as work', async () => {
  const { db, request } = context();
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Daily work distinction', activity_date: '2026-10-08' },
    })
  ).data.id;
  reviewed(db, tid);
  await request('/tasks/' + tid, {
    method: 'PATCH',
    body: {
      assignee: 'engineer@demo.local',
      development_status: 'On Stage',
      priority: 'High',
      activity_date: '2026-10-08',
    },
  });
  assert.equal(
    (await request('/daily?date=2026-10-08', { who: 'boss@demo.local' })).data.activities.length,
    1,
  );
  assert.equal((await request('/engineering-daily?date=2026-10-08')).data.activities.length, 1);
  assert.ok((await request('/activity')).data.activities.length >= 2);
  const qa = await request('/tasks/' + tid + '/activity', {
    method: 'POST',
    body: {
      action_type: 'QA Testing',
      activity_date: '2026-10-08',
      result: 'No Visible Changes',
      notes: 'Checked Stage; no change. Blocked pending merge.',
    },
  });
  assert.equal(qa.status, 201);
  assert.ok(qa.data.id);
  const daily = (await request('/daily?date=2026-10-08', { who: 'boss@demo.local' })).data;
  assert.equal(daily.activities.length, 2);
  assert.equal(
    daily.activities.find((a) => a.action_type === 'QA Testing').result,
    'No Visible Changes',
  );
  assert.equal(
    (await request('/summary?date=2026-10-08', { who: 'boss@demo.local' })).data.today_activity
      .length,
    2,
  );
  db.close();
});
test('Environment follows steps, can be manually overridden, and work transitions also synchronize', async () => {
  const { db, request } = context();
  const tid = (
    await request('/tasks', { method: 'POST', body: { title: 'Environment transitions' } })
  ).data.id;
  const current = async () => (await request('/tasks/' + tid)).data.task.current_environment;
  assert.equal(await current(), '—');
  reviewed(db, tid);
  await request('/tasks/' + tid, {
    method: 'PATCH',
    body: { development_status: 'In Development' },
  });
  assert.equal(await current(), 'Local');
  await request('/tasks/' + tid, { method: 'PATCH', body: { development_status: 'On Stage' } });
  assert.equal(await current(), 'Stage');
  await request('/tasks/' + tid, { method: 'PATCH', body: { current_environment: 'Local' } });
  assert.equal(await current(), 'Local');
  await request('/tasks/' + tid, { method: 'PATCH', body: { assignee: 'engineer@demo.local' } });
  assert.equal(await current(), 'Local');
  await request('/tasks/' + tid + '/activity', {
    method: 'POST',
    body: { action_type: 'QA Testing', result: 'Passed', notes: 'Verified on Stage' },
  });
  await request('/tasks/' + tid, {
    method: 'PATCH',
    body: { development_status: 'Awaiting Production Deploy' },
  });
  assert.equal(await current(), 'Stage');
  const work = await request('/tasks/' + tid + '/activity', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: {
      action_type: 'Development',
      result: 'On Production',
      notes: 'Deployed and checked',
      environment: 'Stage',
    },
  });
  assert.equal(work.status, 201);
  assert.equal(await current(), 'Production');
  await request('/tasks/' + tid, {
    method: 'PATCH',
    body: { development_status: 'On Stage', current_environment: 'Production' },
  });
  assert.equal(await current(), 'Production');
  db.close();
});
test('Images link to feedback and comments; deletion enforces ownership, confirmation and hides the file', async () => {
  const { db, request } = context();
  const tid = (await request('/tasks', { method: 'POST', body: { title: 'Screenshot evidence' } }))
    .data.id;
  reviewed(db, tid);
  await request('/tasks/' + tid, { method: 'PATCH', body: { development_status: 'On Stage' } });
  const qa = (
    await request('/tasks/' + tid + '/activity', {
      method: 'POST',
      body: {
        action_type: 'QA Testing',
        result: 'No Visible Changes',
        notes: 'Screenshot evidence',
      },
    })
  ).data.id;
  const cid = (
    await request('/tasks/' + tid + '/comments', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { body: 'Here is the current state' },
    })
  ).data.id;
  const upload = async (link, who = 'engineer@demo.local') => {
    const f = new FormData();
    f.append('task_id', tid);
    f.append('file', new File([new Uint8Array([1, 2, 3])], 'screen.png', { type: 'image/png' }));
    for (const [k, v] of Object.entries(link)) f.append(k, v);
    return request('/attachments', { who, method: 'POST', body: f });
  };
  const a = (await upload({ activity_id: qa })).data.id;
  const b = (await upload({ comment_id: cid })).data.id;
  const detail = (await request('/tasks/' + tid)).data;
  assert.equal(detail.attachments.find((f) => f.id === a).activity_id, qa);
  assert.equal(detail.attachments.find((f) => f.id === b).comment_id, cid);
  const other = (await request('/tasks', { method: 'POST', body: { title: 'Other task' } })).data
    .id;
  const otherComment = (
    await request('/tasks/' + other + '/comments', { method: 'POST', body: { body: 'Other' } })
  ).data.id;
  assert.equal((await upload({ comment_id: otherComment })).status, 400);
  assert.equal(
    (await request('/attachments/' + a, { who: 'engineer@demo.local', method: 'DELETE', body: {} }))
      .status,
    400,
  );
  assert.equal(
    (
      await request('/attachments/' + a, {
        who: 'boss@demo.local',
        method: 'DELETE',
        body: { confirm: true },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/attachments/' + a, {
        who: 'engineer@demo.local',
        method: 'DELETE',
        body: { confirm: true },
      })
    ).status,
    200,
  );
  assert.equal((await request('/attachments/' + a, { who: 'engineer@demo.local' })).status, 404);
  assert.ok(!(await request('/tasks/' + tid)).data.attachments.some((f) => f.id === a));
  assert.ok((await request('/tasks/' + tid)).data.attachments.some((f) => f.id === b));
  db.close();
});

async function advance(request, tid, action, fields = {}, who = 'engineer@demo.local') {
  const d = (await request('/tasks/' + tid, { who })).data;
  return request('/tasks/' + tid + '/workflow', {
    who,
    method: 'POST',
    body: { action, confirm: true, expected_revision: d.task.workflow_revision, ...fields },
  });
}
const futureDelivery = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
};

test('Dashboard next actions follow confirmed Stage handoff, QA feedback and Production completion', async () => {
  const { db, request } = context();
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Next action workflow', type: 'Bug Fix' },
    })
  ).data.id;
  reviewed(db, tid);
  const confirm = async (action, fields) =>
    assert.equal(
      (
        await advance(
          request,
          tid,
          action,
          fields,
          action === 'qa' ? 'admin@demo.local' : 'engineer@demo.local',
        )
      ).status,
      201,
    );
  const next = async () => {
    const task = (await request('/tasks/' + tid)).data.task;
    return (
      await request('/summary?date=2026-10-08', { who: task.next_action_owner || task.assignee })
    ).data.next_actions.find((t) => t.id === tid);
  };
  await confirm('progress', { development_status: 'Merged / Awaiting Stage' });
  assert.equal((await next()).workflow.phase, 'stage_deploy');
  assert.equal((await next()).workflow.owner, 'engineer@demo.local');
  await confirm('stage', { qa_owner: 'admin@demo.local' });
  assert.equal((await next()).workflow.phase, 'qa');
  assert.equal((await next()).workflow.owner, 'admin@demo.local');
  await confirm('qa', { qa_status: 'Changes Required', notes: 'Fix the calculation' });
  assert.equal((await next()).workflow.phase, 'development');
  assert.equal((await next()).workflow.owner, 'engineer@demo.local');
  await request('/tasks/' + tid + '/tracking', {
    who: 'engineer@demo.local',
    method: 'PATCH',
    body: { estimated_delivery_date: '2099-12-31' },
  });
  await confirm('stage', { qa_owner: 'admin@demo.local' });
  await confirm('qa', { qa_status: 'Passed', notes: 'Verified the fixed Stage build' });
  assert.equal((await next()).workflow.phase, 'production');
  assert.equal((await next()).workflow.owner, 'engineer@demo.local');
  await confirm('production', {});
  assert.equal(
    await next(),
    undefined,
    'Production confirmation completes the task and removes the next action',
  );
  const detail = (await request('/tasks/' + tid)).data;
  assert.equal(detail.task.assignee, 'engineer@demo.local');
  assert.equal(detail.task.development_status, 'Closed');
  assert.deepEqual(detail.workflow.actions, []);
  const completion = detail.activities.find((a) => a.result === 'On Production');
  assert.equal(completion.actor_email, 'engineer@demo.local');
  assert.equal(completion.is_work, 1);
  const count = detail.activities.length;
  assert.equal(
    (
      await advance(
        request,
        tid,
        'close',
        { notes: 'Obsolete second completion' },
        'admin@demo.local',
      )
    ).status,
    200,
  );
  assert.equal((await request('/tasks/' + tid)).data.activities.length, count);
});

test('Requested daily task promotion preserves dated work, images, history and owner isolation without duplicates', async () => {
  const migration = readFileSync(
    new URL('../migrations/0010_promote_daily_task.sql', import.meta.url),
    'utf8',
  );
  for (const reuseExisting of [false, true]) {
    const { db, request } = context(),
      oid = '93852b66-746f-45b3-bdf4-b29cd3e1a901',
      title = 'Anyura gross report数据修复';
    const existing = crypto.randomUUID(),
      other = crypto.randomUUID();
    db.prepare('INSERT INTO private_work(id,owner_email,kind,title) VALUES(?,?,?,?)').run(
      other,
      'engineer@demo.local',
      'Task',
      title,
    );
    if (reuseExisting)
      db.prepare('INSERT INTO private_work(id,owner_email,kind,title) VALUES(?,?,?,?)').run(
        existing,
        'admin@demo.local',
        'Task',
        title,
      );
    db.prepare(
      'INSERT INTO office_logs(id,owner_email,work_date,title,details,status,created_at) VALUES(?,?,?,?,?,?,?)',
    ).run(
      oid,
      'admin@demo.local',
      '2026-10-08',
      title,
      'Waiting for the refund correction',
      'In Progress',
      '2026-10-08T20:00:00.000Z',
    );
    db.prepare(
      'INSERT INTO office_revisions(id,office_id,actor_email,change_type,details) VALUES(?,?,?,?,?)',
    ).run(crypto.randomUUID(), oid, 'admin@demo.local', 'Created', 'Original work record');
    const image = new FormData();
    image.append('office_id', oid);
    image.append('file', new File(['image evidence'], 'gross-report.png', { type: 'image/png' }));
    assert.equal((await request('/attachments', { method: 'POST', body: image })).status, 201);
    db.exec(migration);
    db.exec(migration);
    const items = (await request('/private-work')).data.items;
    assert.equal(items.length, 1, 'Reuse or create exactly one task owned by this employee');
    const taskId = reuseExisting ? existing : oid;
    assert.equal(items[0].id, taskId);
    assert.equal(items[0].kind, 'Task');
    const detail = (await request('/private-work/' + taskId)).data;
    assert.equal(detail.activities.length, 1);
    assert.equal(detail.activities[0].id, oid);
    assert.equal(detail.activities[0].work_date, '2026-10-08');
    assert.equal(detail.activities[0].details, 'Waiting for the refund correction');
    assert.equal(detail.attachments.length, 1);
    assert.equal(
      (await request('/daily?date=2026-10-08')).data.office.length,
      1,
      'Promotion does not manufacture daily work',
    );
    assert.equal(
      (await request('/office/' + oid)).data.revisions.length,
      2,
      'Linking is audited once and preserves the original revision',
    );
    assert.equal(
      (await request('/private-work/' + taskId, { who: 'engineer@demo.local' })).status,
      404,
    );
    assert.equal(
      (await request('/private-work/' + taskId, { who: 'boss@demo.local' })).status,
      200,
    );
    assert.equal(
      db.prepare('SELECT work_item_id FROM office_logs WHERE id=?').get(oid).work_item_id,
      taskId,
    );
    assert.equal(db.prepare('SELECT title FROM private_work WHERE id=?').get(other).title, title);
  }
});

test('New comments stay highlighted until this task has work or a guided action; history remains intact', async () => {
  const { db, request } = context();
  const tid = (
    await request('/tasks', { method: 'POST', body: { title: 'Comment handoff', type: 'Bug Fix' } })
  ).data.id;
  reviewed(db, tid);
  const other = (
    await request('/tasks', { method: 'POST', body: { title: 'Other task', type: 'Bug Fix' } })
  ).data.id;
  reviewed(db, other);
  const comment = async (body) =>
    request('/tasks/' + tid + '/comments', { method: 'POST', body: { body } });
  const detail = async () => (await request('/tasks/' + tid)).data;
  const pending = async () =>
    (await detail()).comments.filter((c) => c.pending_action).map((c) => c.body);
  await comment('Please check the screenshot');
  await comment('Also check billing');
  assert.deepEqual(await pending(), ['Please check the screenshot', 'Also check billing']);
  assert.equal(
    (await request('/tasks/' + tid, { who: 'boss@demo.local' })).data.comments.filter(
      (c) => c.pending_action,
    ).length,
    2,
  );
  await request('/tasks/' + tid, {
    method: 'PATCH',
    body: { priority: 'High', assignee: 'engineer@demo.local' },
  });
  await request('/tasks/' + tid + '/activity', {
    method: 'POST',
    body: { action_type: 'Status Change', result: 'Updated metadata' },
  });
  await request('/tasks/' + other + '/activity', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: { action_type: 'Development', notes: 'Worked on a different task' },
  });
  assert.equal(
    (
      await request('/tasks/' + tid + '/activity', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { action_type: 'Development', notes: 'Forbidden' },
      })
    ).status,
    403,
  );
  assert.equal(
    (await pending()).length,
    2,
    'Metadata, another task and rejected actions do not clear comments',
  );
  assert.equal(
    (await advance(request, tid, 'progress', { development_status: 'PR Submitted' })).status,
    201,
  );
  assert.deepEqual(
    await pending(),
    [],
    'Guided progress without notes still acknowledges comments',
  );
  assert.equal(
    (await detail()).comments.length,
    2,
    'Hiding the highlight preserves Discussion history',
  );
  await comment('Please retest this build');
  await request('/tasks/' + tid + '/activity', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: {
      action_type: 'Development',
      activity_date: '2026-01-01',
      notes: 'Checked and fixed the build',
    },
  });
  assert.deepEqual(
    await pending(),
    [],
    'Recording time, not backdated work date, determines acknowledgement',
  );
  await advance(request, tid, 'pr-review', { pr_reviewer: 'engineer@demo.local' });
  await advance(request, tid, 'stage', { qa_owner: 'admin@demo.local' });
  await comment('Is the fix visible on Stage?');
  assert.equal(
    (
      await request('/tasks/' + tid + '/activity', {
        method: 'POST',
        body: {
          action_type: 'QA Testing',
          result: 'No Visible Changes',
          notes: 'Checked Stage; blocked',
        },
      })
    ).status,
    201,
  );
  assert.deepEqual(await pending(), [], 'Blocked QA is an actual action');
  // Fixed identical timestamps verify atomic insertion order, including a
  // comment posted immediately after an action at the same recorded time.
  const timestamp = '2030-01-01T00:00:00.000Z';
  db.prepare('INSERT INTO comments(id,task_id,actor_email,body,created_at) VALUES(?,?,?,?,?)').run(
    crypto.randomUUID(),
    tid,
    'admin@demo.local',
    'Before action',
    timestamp,
  );
  db.prepare(
    'INSERT INTO activities(id,task_id,actor_email,action_type,activity_date,notes,is_work,created_at) VALUES(?,?,?,?,?,?,?,?)',
  ).run(
    crypto.randomUUID(),
    tid,
    'engineer@demo.local',
    'Development',
    '2026-10-08',
    'Work action',
    1,
    timestamp,
  );
  db.prepare('INSERT INTO comments(id,task_id,actor_email,body,created_at) VALUES(?,?,?,?,?)').run(
    crypto.randomUUID(),
    tid,
    'admin@demo.local',
    'After action',
    timestamp,
  );
  assert.deepEqual(await pending(), ['After action']);
  assert.throws(
    () => db.prepare('DELETE FROM comments WHERE task_id=?').run(tid),
    /Comments are immutable/,
  );
});

test('Guided workflow requires review and explicit Stage confirmation; QA issues loop back before Production', async () => {
  const { db, request } = context();
  await request('/users', {
    method: 'POST',
    body: { email: 'qa@example.com', display_name: 'QA', role: 'member', groups: ['QA'] },
  });
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Guided billing fix', type: 'Bug Fix', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  let detail = (await request('/tasks/' + tid)).data;
  assert.equal(detail.workflow.phase, 'review');
  assert.equal(detail.task.next_action_owner, 'engineer@demo.local');
  assert.equal(
    (
      await advance(request, tid, 'review', {
        feasibility: 'Confirmed',
        assignee: 'engineer@demo.local',
      })
    ).status,
    400,
    'ETA is required',
  );
  assert.equal(
    (
      await advance(
        request,
        tid,
        'review',
        {
          feasibility: 'Confirmed',
          assignee: 'engineer@demo.local',
          estimated_delivery_date: futureDelivery(),
        },
        'qa@example.com',
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/tasks/' + tid, {
        method: 'PATCH',
        body: { development_status: 'In Development' },
      })
    ).status,
    409,
    'Manual status cannot bypass engineer review',
  );
  assert.equal(
    (
      await advance(request, tid, 'review', {
        feasibility: 'Confirmed',
        assignee: 'engineer@demo.local',
        estimated_delivery_date: futureDelivery(),
        notes: 'Requirements reviewed; the fix is feasible.',
      })
    ).status,
    201,
  );
  assert.equal(
    (await advance(request, tid, 'progress', { development_status: 'PR Submitted' })).status,
    201,
  );
  assert.equal(
    (await advance(request, tid, 'progress', { development_status: 'Merged / Awaiting Stage' }))
      .status,
    409,
  );
  assert.equal(
    (await advance(request, tid, 'pr-review', { pr_reviewer: 'engineer@demo.local' })).status,
    201,
  );
  detail = (await request('/tasks/' + tid)).data;
  assert.equal(detail.workflow.phase, 'stage_deploy');
  assert.equal(detail.task.next_action_owner, 'engineer@demo.local');
  assert.equal(detail.task.stage_confirmed_at, '');
  assert.equal(
    (
      await request('/tasks/' + tid + '/activity', {
        method: 'POST',
        who: 'qa@example.com',
        body: { action_type: 'QA Testing', result: 'Passed', notes: 'Not actually on Stage' },
      })
    ).status,
    409,
  );
  await request('/tasks/' + tid, {
    who: 'engineer@demo.local',
    method: 'PATCH',
    body: { current_environment: 'Stage' },
  });
  assert.equal(
    (await request('/tasks/' + tid, { method: 'PATCH', body: { qa_status: 'Passed' } })).status,
    409,
    'A manual environment change never opens QA',
  );
  assert.equal(
    (await advance(request, tid, 'stage', { qa_owner: 'engineer@demo.local' })).status,
    400,
    'Stage handoff needs an active QA member',
  );
  assert.equal(
    (
      await advance(request, tid, 'stage', {
        qa_owner: 'qa@example.com',
        notes: 'Deployed to Stage; test billing totals.',
      })
    ).status,
    201,
  );
  detail = (await request('/tasks/' + tid)).data;
  assert.equal(detail.workflow.phase, 'qa');
  assert.equal(detail.workflow.owner, 'qa@example.com');
  assert.equal(detail.task.current_environment, 'Stage');
  assert.ok(detail.task.stage_confirmed_at);
  assert.equal(
    (
      await advance(
        request,
        tid,
        'qa',
        { qa_status: 'Passed', notes: 'Verified' },
        'engineer@demo.local',
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await advance(
        request,
        tid,
        'qa',
        {
          qa_status: 'No Visible Changes',
          notes: 'Tested Stage; the totals still show the old result.',
        },
        'qa@example.com',
      )
    ).status,
    201,
  );
  detail = (await request('/tasks/' + tid)).data;
  assert.equal(detail.workflow.phase, 'development');
  assert.equal(detail.task.development_status, 'In Development');
  assert.equal(detail.task.next_action_owner, 'engineer@demo.local');
  assert.equal(detail.task.stage_confirmed_at, '');
  assert.equal(
    (
      await request('/tasks/' + tid + '/activity', {
        method: 'POST',
        who: 'qa@example.com',
        body: { action_type: 'QA Testing', result: 'Passed', notes: 'Retest too soon' },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request('/tasks/' + tid, {
        method: 'PATCH',
        body: { development_status: 'On Production' },
      })
    ).status,
    409,
  );
  await request('/tasks/' + tid + '/tracking', {
    who: 'engineer@demo.local',
    method: 'PATCH',
    body: { estimated_delivery_date: '2099-12-31' },
  });
  const qaWork = db
    .prepare("SELECT * FROM activities WHERE task_id=? AND action_type='QA Testing'")
    .all(tid);
  assert.equal(qaWork.length, 1);
  assert.equal(qaWork[0].is_work, 1);
  assert.equal(qaWork[0].environment, 'Stage');
  assert.equal(
    (
      await advance(request, tid, 'stage', {
        qa_owner: 'qa@example.com',
        notes: 'Fixed the billing total and redeployed Stage.',
      })
    ).status,
    201,
  );
  assert.equal((await request('/tasks/' + tid)).data.task.qa_status, 'Retest Required');
  assert.equal(
    (await advance(request, tid, 'qa', { qa_status: 'Partially Passed' }, 'qa@example.com')).status,
    400,
    'Unresolved QA needs issue details',
  );
  assert.equal(
    (
      await advance(
        request,
        tid,
        'qa',
        { qa_status: 'Passed', notes: 'Billing totals verified on the fixed Stage build.' },
        'qa@example.com',
      )
    ).status,
    201,
  );
  detail = (await request('/tasks/' + tid)).data;
  assert.equal(detail.workflow.phase, 'production');
  assert.equal(detail.task.next_action_owner, 'engineer@demo.local');
  assert.equal(detail.task.qa_passed_stage_at, detail.task.stage_confirmed_at);
  assert.equal((await advance(request, tid, 'production', {}, 'qa@example.com')).status, 403);
  const pending = (await request('/releases')).data.releases.find((r) => r.status === 'Planned');
  assert.equal(
    (
      await advance(request, tid, 'production', {
        notes: 'Deployed and verified production billing.',
      })
    ).status,
    201,
  );
  detail = (await request('/tasks/' + tid)).data;
  assert.equal(detail.workflow.phase, 'done');
  assert.equal(detail.task.current_environment, 'Production');
  assert.equal(detail.task.next_action_owner, '');
  const releases = (await request('/releases')).data.releases.filter((r) => r.status === 'Planned');
  assert.equal(releases.length, 1);
  assert.equal(releases[0].id, pending.id);
  assert.ok(JSON.parse(releases[0].task_ids_json).includes(tid));
  assert.equal(
    (await advance(request, tid, 'production')).status,
    409,
    'Production cannot be confirmed twice',
  );
  db.close();
});

test('Next-step confirmation detects concurrent changes and resets QA approval for a new Stage build', async () => {
  const { db, request } = context();
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Fresh build only', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  await advance(request, tid, 'review', {
    feasibility: 'Confirmed',
    assignee: 'engineer@demo.local',
    estimated_delivery_date: futureDelivery(),
  });
  const revision = (await request('/tasks/' + tid)).data.task.workflow_revision;
  await request('/tasks/' + tid, { method: 'PATCH', body: { priority: 'High' } });
  const stale = await request('/tasks/' + tid + '/workflow', {
    method: 'POST',
    who: 'engineer@demo.local',
    body: {
      action: 'stage',
      qa_owner: 'admin@demo.local',
      confirm: true,
      expected_revision: revision,
    },
  });
  assert.equal(stale.status, 409);
  assert.equal((await request('/tasks/' + tid)).data.workflow.phase, 'development');
  await advance(request, tid, 'stage', { qa_owner: 'admin@demo.local' });
  await advance(
    request,
    tid,
    'qa',
    { qa_status: 'Passed', notes: 'Tested Stage' },
    'admin@demo.local',
  );
  await request('/tasks/' + tid, {
    who: 'engineer@demo.local',
    method: 'PATCH',
    body: { development_status: 'In Development' },
  });
  assert.equal((await request('/tasks/' + tid)).data.task.qa_passed_stage_at, '');
  await advance(request, tid, 'stage', { qa_owner: 'admin@demo.local' });
  assert.equal((await request('/tasks/' + tid)).data.task.qa_status, 'Retest Required');
  assert.equal(
    (
      await request('/tasks/' + tid + '/activity', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { action_type: 'Development', result: 'On Production' },
      })
    ).status,
    409,
  );
  const held = (await request('/tasks', { method: 'POST', body: { title: 'Ambiguous request' } }))
    .data.id;
  assert.equal(
    (
      await advance(request, held, 'review', {
        feasibility: 'Needs Clarification',
        assignee: 'engineer@demo.local',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await advance(request, held, 'review', {
        feasibility: 'Needs Clarification',
        assignee: 'engineer@demo.local',
        notes: 'Need acceptance criteria.',
      })
    ).status,
    201,
  );
  assert.equal((await request('/tasks/' + held)).data.task.development_status, 'On Hold');
  assert.equal(
    (
      await advance(request, held, 'review', {
        feasibility: 'Confirmed',
        assignee: 'engineer@demo.local',
        estimated_delivery_date: futureDelivery(),
        notes: 'Acceptance criteria clarified.',
      })
    ).status,
    201,
  );
  assert.equal((await request('/tasks/' + held)).data.workflow.phase, 'development');
  db.close();
});

test('Private task has multi-day activity and image history; owner and Manager only, never shared-board data', async () => {
  const { db, request } = context();
  const who = 'engineer@demo.local';
  const task = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: { title: 'Design Work Tracker', kind: 'Task' },
    })
  ).data.id;
  const first = (
    await request('/office', {
      who,
      method: 'POST',
      body: {
        title: 'Design Work Tracker',
        work_item_id: task,
        work_date: '2026-10-07',
        status: 'In Progress',
        details: 'Drafted the layout',
      },
    })
  ).data.id;
  const second = (
    await request('/office', {
      who,
      method: 'POST',
      body: {
        title: 'Design Work Tracker',
        work_item_id: task,
        work_date: '2026-10-08',
        status: 'Blocked',
        details: 'Waiting for feedback',
      },
    })
  ).data.id;
  const upload = async (key, value, actor = who) => {
    const f = new FormData();
    f.append(key, value);
    f.append('file', new File(['image'], 'work.png', { type: 'image/png' }));
    return request('/attachments', { who: actor, method: 'POST', body: f });
  };
  const cover = (await upload('private_work_id', task)).data.id;
  const evidence = (await upload('office_id', second)).data.id;
  const detail = (await request('/private-work/' + task, { who })).data;
  assert.equal(detail.activities.length, 2);
  assert.deepEqual(
    detail.activities.map((a) => a.work_date),
    ['2026-10-08', '2026-10-07'],
  );
  assert.equal(detail.attachments.length, 2);
  assert.equal(
    (await request('/private-work/' + task, { who: 'boss@demo.local' })).data.attachments.length,
    2,
  );
  assert.equal(
    (await request('/private-work/' + task)).status,
    404,
    'Admin cannot see another person’s private task',
  );
  assert.equal((await request('/attachments/' + cover)).status, 404);
  assert.equal((await request('/attachments/' + evidence)).status, 404);
  assert.equal((await request('/attachments/' + cover, { who: 'boss@demo.local' })).status, 200);
  assert.equal((await upload('private_work_id', task, 'admin@demo.local')).status, 404);
  assert.equal(
    (await request('/private-work', { who: 'boss@demo.local' })).data.attachments.length,
    1,
  );
  assert.equal((await request('/daily?date=2026-10-08', { who })).data.attachments.length, 1);
  assert.equal((await request('/daily?date=2026-10-07', { who })).data.attachments.length, 0);
  assert.equal((await request('/engineering-daily?date=2026-10-08')).data.activities.length, 0);
  assert.equal(
    (await request('/export')).data.tables.attachments.length,
    0,
    'Private attachment metadata stays out of other people’s exports',
  );
  assert.equal(
    (await request('/attachments/' + cover, { who, method: 'DELETE', body: {} })).status,
    400,
  );
  assert.equal(
    (
      await request('/attachments/' + cover, {
        who: 'boss@demo.local',
        method: 'DELETE',
        body: { confirm: true },
      })
    ).status,
    403,
  );
  assert.equal(
    (await request('/attachments/' + cover, { who, method: 'DELETE', body: { confirm: true } }))
      .status,
    200,
  );
  assert.equal((await request('/attachments/' + cover, { who })).status, 404);
  await request('/office/' + second, { who, method: 'DELETE' });
  assert.equal((await request('/attachments/' + evidence, { who })).status, 404);
  assert.equal((await request('/private-work/' + task, { who })).data.activities.length, 1);
  assert.equal((await request('/private-work/' + task, { who })).data.activities[0].id, first);
  db.close();
});

test('Project overview includes only its own and child-task activity, with private evidence and completion status', async () => {
  const { db, request } = context(),
    who = 'engineer@demo.local';
  const create = async (kind, title, parent_id = '') =>
    (await request('/private-work', { who, method: 'POST', body: { kind, title, parent_id } })).data
      .id;
  const project = await create('Project', 'Prototype'),
    child = await create('Task', 'Design login', project),
    other = await create('Project', 'Unrelated'),
    otherChild = await create('Task', 'Unrelated task', other);
  const log = async (work_item_id, title, work_date) =>
    (
      await request('/office', {
        who,
        method: 'POST',
        body: { work_item_id, title, work_date, status: 'In Progress' },
      })
    ).data.id;
  const direct = await log(project, 'Reviewed project scope', '2026-10-07'),
    progress = await log(child, 'Designed login', '2026-10-08');
  await log(otherChild, 'Unrelated work', '2026-10-09');
  const removed = await log(child, 'Removed activity', '2026-10-09');
  await request('/office/' + removed, { who, method: 'DELETE' });
  const upload = async (key, value) => {
    const form = new FormData();
    form.append(key, value);
    form.append('file', new File(['image'], 'reference.png', { type: 'image/png' }));
    const r = await request('/attachments', { who, method: 'POST', body: form });
    assert.equal(r.status, 201);
    return r.data.id;
  };
  const reference = await upload('private_work_id', project),
    evidence = await upload('office_id', progress);
  await upload('private_work_id', child);
  await upload('private_work_id', other);
  await request('/private-work/' + child, { who, method: 'PATCH', body: { status: 'Completed' } });
  const detail = (await request('/private-work/' + project, { who })).data;
  assert.deepEqual(
    detail.children.map((t) => t.id),
    [child],
  );
  assert.equal(detail.children[0].status, 'Completed');
  assert.deepEqual(
    detail.activities.map((a) => a.id),
    [progress, direct],
  );
  assert.deepEqual(
    detail.attachments.map((a) => a.id).sort(),
    [reference, evidence].sort(),
    'Child progress evidence appears alongside project references, without mixing in general task attachments',
  );
  assert.deepEqual(
    (await request('/private-work/' + child, { who })).data.activities.map((a) => a.id),
    [progress],
  );
  assert.equal(
    (await request('/private-work/' + project)).status,
    404,
    'Admin cannot see someone else’s private project',
  );
  assert.deepEqual(
    (await request('/private-work/' + project, { who: 'boss@demo.local' })).data.activities.map(
      (a) => a.id,
    ),
    [progress, direct],
  );
  assert.equal(
    (
      await request('/private-work/' + project, {
        who: 'boss@demo.local',
        method: 'PATCH',
        body: { status: 'Completed' },
      })
    ).status,
    403,
  );
  await request('/private-work/' + project, {
    who,
    method: 'PATCH',
    body: { status: 'Completed' },
  });
  assert.equal((await request('/private-work/' + project, { who })).data.item.status, 'Completed');
  await request('/private-work/' + child, { who, method: 'DELETE' });
  const after = (await request('/private-work/' + project, { who })).data;
  assert.equal(after.children.length, 0);
  assert.deepEqual(
    after.activities.map((a) => a.id),
    [direct],
  );
  assert.deepEqual(
    after.attachments.map((a) => a.id),
    [reference],
  );
  db.close();
});

test('Recurring reminders persist without manufactured work; partial activity counts and completion advances one cycle', async () => {
  const { db, request } = context();
  const who = 'engineer@demo.local',
    today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }),
    y = new Date(today + 'T12:00:00Z');
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterday = y.toISOString().slice(0, 10),
    n = new Date(today + 'T12:00:00Z');
  n.setUTCDate(n.getUTCDate() + 1);
  const tomorrow = n.toISOString().slice(0, 10);
  const task = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: {
        title: 'Daily review',
        kind: 'Task',
        recurrence_rule: 'daily',
        next_due_date: yesterday,
      },
    })
  ).data.id;
  const summary = () => request('/summary?date=' + today, { who });
  assert.equal((await summary()).data.personal_reminders[0].id, task);
  assert.equal((await summary()).data.today_activity.length, 0);
  assert.equal(
    (await summary()).data.personal_reminders[0].next_due_date,
    yesterday,
    'Reading reminders does not advance an overdue task',
  );
  assert.equal(
    (await request('/summary?date=' + today)).data.personal_reminders.length,
    0,
    'Other members including Admin cannot see these reminders',
  );
  const log = (
    await request('/office', {
      who,
      method: 'POST',
      body: {
        title: 'Daily review',
        work_item_id: task,
        work_date: today,
        status: 'Blocked',
        details: 'Checked the task, waiting for deployment',
        complete_occurrence: false,
      },
    })
  ).data.id;
  assert.equal((await summary()).data.today_activity.length, 1);
  assert.equal((await summary()).data.personal_reminders.length, 1);
  await request('/office/' + log, {
    who,
    method: 'PATCH',
    body: { details: 'Confirmed still blocked' },
  });
  assert.equal((await summary()).data.personal_reminders.length, 1);
  const finish = (
    await request('/office', {
      who,
      method: 'POST',
      body: {
        title: 'Daily review',
        work_item_id: task,
        work_date: today,
        status: 'Completed',
        details: 'Review finished',
        complete_occurrence: true,
      },
    })
  ).data.id;
  assert.equal((await summary()).data.today_activity.length, 2);
  assert.equal((await summary()).data.personal_reminders.length, 0);
  assert.equal((await request('/private-work/' + task, { who })).data.item.next_due_date, tomorrow);
  await request('/office/' + finish, {
    who,
    method: 'PATCH',
    body: { details: 'Added completion details' },
  });
  assert.equal(
    (await request('/private-work/' + task, { who })).data.item.next_due_date,
    tomorrow,
    'Editing or upload retries do not complete a second cycle',
  );
  assert.equal(
    (await request('/private-work/' + task, { who })).data.item.status,
    'In Progress',
    'Completing one occurrence does not finish the entire recurring task',
  );
  assert.equal(
    (
      await request('/private-work', {
        who,
        method: 'POST',
        body: {
          title: 'Invalid date',
          kind: 'Task',
          recurrence_rule: 'daily',
          next_due_date: '2026-02-31',
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/private-work', {
        who,
        method: 'POST',
        body: {
          title: 'Project repeat',
          kind: 'Project',
          recurrence_rule: 'daily',
          next_due_date: today,
        },
      })
    ).status,
    400,
  );
  db.close();
});

test('Weekly recurrence keeps cadence after a late completion; monthly recurrence preserves the day through February', async () => {
  const { db, request } = context();
  const who = 'engineer@demo.local';
  const create = async (rule, due) =>
    (
      await request('/private-work', {
        who,
        method: 'POST',
        body: { title: 'Scheduled work', kind: 'Task', recurrence_rule: rule, next_due_date: due },
      })
    ).data.id;
  const done = async (tid, date) =>
    request('/office', {
      who,
      method: 'POST',
      body: {
        title: 'Completed scheduled work',
        work_item_id: tid,
        work_date: date,
        status: 'Completed',
        details: 'Did the work',
      },
    });
  const weekly = await create('weekly', '2026-10-01');
  await done(weekly, '2026-10-09');
  assert.equal(
    (await request('/private-work/' + weekly, { who })).data.item.next_due_date,
    '2026-10-15',
  );
  const monthly = await create('monthly', '2027-01-31');
  await done(monthly, '2027-01-31');
  assert.equal(
    (await request('/private-work/' + monthly, { who })).data.item.next_due_date,
    '2027-02-28',
  );
  await request('/private-work/' + monthly, {
    who,
    method: 'PATCH',
    body: {
      description: 'Monthly checklist',
      recurrence_rule: 'monthly',
      next_due_date: '2027-02-28',
    },
  });
  await done(monthly, '2027-02-28');
  assert.equal(
    (await request('/private-work/' + monthly, { who })).data.item.next_due_date,
    '2027-03-31',
  );
  await request('/private-work/' + weekly, {
    who,
    method: 'PATCH',
    body: { recurrence_rule: 'none' },
  });
  assert.equal((await request('/private-work/' + weekly, { who })).data.item.next_due_date, '');
  db.close();
});

test('Inactivity reminder counts three local working days, skips weekends and follows the latest progress start or activity', () => {
  const friday = '2026-10-02T19:00:00Z';
  assert.equal(businessDaysSince(friday, '2026-10-04'), 0);
  assert.equal(businessDaysSince(friday, '2026-10-06'), 2);
  assert.equal(businessDaysSince(friday, '2026-10-07'), 3);
  assert.equal(businessDaysSince('2026-10-05', '2026-10-08'), 3);
  assert.equal(
    businessDaysSince(friday, '2026-10-07T06:59:00Z'),
    2,
    'Still Tuesday in Los Angeles',
  );
  assert.equal(businessDaysSince(friday, '2026-10-07T07:00:00Z'), 3);
  assert.equal(businessDaysSince('2026-10-01', '2026-10-15'), 10);
  assert.equal(
    businessDaysSince('2026-03-06T20:00:00Z', '2026-03-11T19:00:00Z'),
    3,
    'DST does not add or remove working days',
  );
  const item = { kind: 'Task', status: 'In Progress', created_at: friday };
  assert.equal(withInactivityReminder(item, '2026-10-06').inactivity_reminder, null);
  assert.equal(withInactivityReminder(item, '2026-10-07').inactivity_reminder.business_days, 3);
  assert.equal(
    withInactivityReminder({ ...item, updated_at: '2026-10-07T19:00:00Z' }, '2026-10-07')
      .inactivity_reminder.business_days,
    3,
    'Metadata edits do not reset the timer',
  );
  for (const change of [
    { last_activity_at: '2026-10-06T19:00:00Z' },
    { progress_started_at: '2026-10-06T19:00:00Z' },
    { status: 'Waiting' },
    { status: 'Completed' },
    { kind: 'Project' },
  ])
    assert.equal(
      withInactivityReminder({ ...item, ...change }, '2026-10-07').inactivity_reminder,
      null,
    );
  assert.equal(
    withInactivityReminder({ ...item, last_activity_at: '2026-10-08T19:00:00Z' }, '2026-10-07')
      .inactivity_reminder,
    null,
  );
});

test('Inactivity reminder appears only for the owner, clears with actual activity and preserves privacy and audit history', async () => {
  const { db, request } = context(),
    who = 'engineer@demo.local';
  const task = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: { title: 'Ongoing design', kind: 'Task' },
    })
  ).data.id;
  db.prepare("UPDATE private_work SET created_at='2020-01-01T20:00:00Z' WHERE id=?").run(task);
  const list = async () =>
    (await request('/private-work', { who })).data.items.find((i) => i.id === task);
  assert.ok((await list()).inactivity_reminder);
  assert.ok((await request('/private-work/' + task, { who })).data.item.inactivity_reminder);
  const summary = async (actor = who) =>
    (await request('/summary?date=2026-10-08', { who: actor })).data.personal_reminders;
  assert.deepEqual(
    (await summary()).map((i) => i.id),
    [task],
  );
  assert.equal((await summary('admin@demo.local')).length, 0);
  assert.equal((await summary('boss@demo.local')).length, 0);
  await request('/private-work/' + task, {
    who,
    method: 'PATCH',
    body: { title: 'Renamed ongoing design', description: 'Changed description' },
  });
  assert.ok((await list()).inactivity_reminder, 'Editing settings is not work');
  const activity = (
    await request('/office', {
      who,
      method: 'POST',
      body: {
        title: 'Drafted layout',
        work_item_id: task,
        work_date: '2026-10-01',
        status: 'In Progress',
      },
    })
  ).data.id;
  assert.equal(
    (await list()).inactivity_reminder,
    null,
    'Actual new activity resets the timer even when logging an earlier work date',
  );
  assert.equal((await summary()).length, 0);
  db.prepare("UPDATE office_logs SET created_at='2020-01-02T20:00:00Z' WHERE id=?").run(activity);
  assert.ok((await list()).inactivity_reminder);
  await request('/office/' + activity, {
    who,
    method: 'PATCH',
    body: { details: 'Clarified an existing record' },
  });
  assert.ok(
    (await list()).inactivity_reminder,
    'Editing historical work does not create a new activity',
  );
  await request('/private-work/' + task, { who, method: 'PATCH', body: { status: 'Waiting' } });
  assert.equal((await list()).inactivity_reminder, null);
  await request('/private-work/' + task, { who, method: 'PATCH', body: { status: 'In Progress' } });
  assert.equal(
    (await list()).inactivity_reminder,
    null,
    'Reopening the task starts a fresh three-day period',
  );
  db.prepare(
    "UPDATE private_work_revisions SET recorded_at='2020-01-03T20:00:00Z' WHERE work_id=? AND change_type='Edited'",
  ).run(task);
  assert.ok((await list()).inactivity_reminder);
  await request('/private-work/' + task, { who, method: 'PATCH', body: { status: 'Completed' } });
  assert.equal((await list()).inactivity_reminder, null);
  assert.equal((await summary()).length, 0);
  await request('/private-work/' + task, { who, method: 'DELETE' });
  assert.equal((await request('/private-work', { who })).data.items.length, 0);
  assert.equal(
    (await request('/daily?date=2026-10-01', { who })).data.office.length,
    1,
    'Reminder reads never manufacture or delete dated work',
  );
  db.close();
});

test('Explicit engineering archive is confirmed, Admin-only and preserves single-person task history', async () => {
  const { db, request } = context();
  const id = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Single-person draft', activity_date: '2026-10-08' },
    })
  ).data.id;
  assert.equal(
    (await request('/tasks/' + id + '/archive', { method: 'POST', body: {} })).status,
    400,
  );
  assert.equal(
    (
      await request('/tasks/' + id + '/archive', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { confirm: true },
      })
    ).status,
    403,
  );
  assert.equal(
    (await request('/tasks/' + id + '/archive', { method: 'POST', body: { confirm: true } }))
      .status,
    200,
  );
  assert.equal((await request('/tasks')).data.tasks.length, 0);
  assert.equal((await request('/tasks?archived=1')).data.tasks[0].id, id);
  assert.equal((await request('/tasks/' + id)).data.activities.length, 1);
  assert.equal((await request('/tasks/' + id)).data.task.deleted, 0);
  assert.equal(
    (await request('/tasks/' + id + '/archive', { method: 'POST', body: { confirm: true } }))
      .status,
    200,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM task_removals WHERE task_id=? AND action='Archived'").get(id)
      .n,
    1,
  );
  assert.equal(
    (await request('/tasks/' + id + '/restore', { method: 'POST', body: {} })).status,
    200,
  );
  assert.equal((await request('/tasks')).data.tasks[0].id, id);
  db.close();
});

test('Private task archive keeps dated activity and files, blocks new work and remains owner-only to restore', async () => {
  const { db, request } = context(),
    who = 'engineer@demo.local';
  const project = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: { title: 'Private prototype', kind: 'Project' },
    })
  ).data.id;
  const id = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: { title: 'Draft login', kind: 'Task', parent_id: project },
    })
  ).data.id;
  const activity = (
    await request('/office', {
      who,
      method: 'POST',
      body: { title: 'Login design', work_item_id: id, work_date: '2026-10-08' },
    })
  ).data.id;
  const form = new FormData();
  form.append('private_work_id', id);
  form.append('file', new File(['image'], 'design.png', { type: 'image/png' }));
  const attachment = (await request('/attachments', { who, method: 'POST', body: form })).data.id;
  assert.equal(
    (await request('/private-work/' + id + '/archive', { who, method: 'POST', body: {} })).status,
    400,
  );
  assert.equal(
    (await request('/private-work/' + id + '/archive', { method: 'POST', body: { confirm: true } }))
      .status,
    404,
  );
  assert.equal(
    (
      await request('/private-work/' + id + '/archive', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { confirm: true },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/private-work/' + id + '/archive', {
        who,
        method: 'POST',
        body: { confirm: true },
      })
    ).status,
    200,
  );
  const detail = (await request('/private-work/' + id, { who })).data;
  assert.equal(detail.item.archived, 1);
  assert.equal(detail.item.deleted, 0);
  assert.equal(detail.item.inactivity_reminder, null);
  assert.equal(detail.activities[0].id, activity);
  assert.equal(detail.attachments[0].id, attachment);
  assert.equal(
    (await request('/daily?date=2026-10-08', { who: 'boss@demo.local' })).data.office[0].id,
    activity,
  );
  assert.equal(
    (
      await request('/office', {
        who,
        method: 'POST',
        body: { title: 'New progress', work_item_id: id, work_date: '2026-10-08' },
      })
    ).status,
    409,
  );
  assert.equal(
    (await request('/office/' + activity, { who, method: 'PATCH', body: { details: 'Changed' } }))
      .status,
    409,
  );
  assert.equal(
    (await request('/private-work/' + id, { who, method: 'PATCH', body: { status: 'Completed' } }))
      .status,
    409,
  );
  assert.equal((await request('/attachments', { who, method: 'POST', body: form })).status, 409);
  assert.equal(
    (
      await request('/private-work/' + id + '/restore', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { confirm: true },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/private-work/' + id + '/restore', {
        who,
        method: 'POST',
        body: { confirm: true },
      })
    ).status,
    200,
  );
  assert.equal((await request('/private-work/' + id, { who })).data.item.archived, 0);
  assert.equal(
    (
      await request('/private-work/' + project + '/archive', {
        who,
        method: 'POST',
        body: { confirm: true },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('/private-work/' + id, { who })).data.item.archived,
    0,
    'Archiving a project does not silently change individual task state',
  );
  assert.equal(
    (
      await request('/private-work', {
        who,
        method: 'POST',
        body: { title: 'New task', kind: 'Task', parent_id: project },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request('/private-work/' + project + '/restore', {
        who,
        method: 'POST',
        body: { confirm: true },
      })
    ).status,
    200,
  );
  db.close();
});

test('Members and Managers can change their own password, verifying the old password and invalidating all old sessions', async () => {
  const { env, db } = context();
  env.DEV_AUTH = undefined;
  const origin = 'https://tracker.example';
  const call = (path, body, cookie = '') =>
    handle(
      new Request(origin + '/api' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          origin,
          'content-type': 'application/json',
          cookie,
          'oai-authenticated-user-email': 'admin@demo.local',
          'oai-authenticated-user-id': 'owner',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
  const setup = await call('/auth/setup', { password: 'admin-password-original' });
  const admin = setup.headers.get('set-cookie').split(';')[0];
  for (const email of ['engineer@demo.local', 'boss@demo.local']) {
    assert.equal(
      (await call('/password', { email, password: 'original-password-123' }, admin)).status,
      200,
    );
    const login = await call('/auth/login', { email, password: 'original-password-123' });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const second = await call('/auth/login', { email, password: 'original-password-123' });
    const secondCookie = second.headers.get('set-cookie').split(';')[0];
    assert.equal(
      (
        await call(
          '/password',
          { password: 'replacement-password-123', current_password: 'wrong' },
          cookie,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          '/password',
          { password: 'short', current_password: 'original-password-123' },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          '/password',
          {
            email: 'admin@demo.local',
            password: 'replacement-password-123',
            current_password: 'original-password-123',
          },
          cookie,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          '/password',
          { password: 'replacement-password-123', current_password: 'original-password-123' },
          cookie,
        )
      ).status,
      200,
    );
    assert.equal((await call('/me', undefined, cookie)).status, 401);
    assert.equal((await call('/me', undefined, secondCookie)).status, 401);
    assert.equal(
      (await call('/auth/login', { email, password: 'original-password-123' })).status,
      401,
    );
    const newLogin = await call('/auth/login', { email, password: 'replacement-password-123' });
    assert.equal(newLogin.status, 200);
    if (email === 'boss@demo.local')
      assert.equal(
        (
          await call(
            '/tasks',
            { title: 'Still read-only', activity_date: '2026-10-08' },
            newLogin.headers.get('set-cookie').split(';')[0],
          )
        ).status,
        403,
      );
  }
  assert.equal(
    (await call('/me', undefined, admin)).status,
    200,
    'Other accounts remain signed in',
  );
  db.close();
});

test('Instructions start unread and acknowledgements belong to the signed-in account', async () => {
  const { db, request } = context();
  const engineer = (await request('/me', { who: 'engineer@demo.local' })).data.instructions;
  const admin = (await request('/me')).data.instructions;
  assert.deepEqual(engineer.acknowledged, []);
  assert.deepEqual(admin.acknowledged, []);
  const gid = engineer.guides.find((g) => g.surface === 'daily').id;
  assert.equal(
    (
      await request('/instructions/ack', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { id: gid, email: 'admin@demo.local' },
      })
    ).status,
    200,
  );
  assert.deepEqual(
    (await request('/me', { who: 'engineer@demo.local' })).data.instructions.acknowledged,
    [gid, 'first-use-daily'],
  );
  assert.deepEqual((await request('/me')).data.instructions.acknowledged, []);
  const recorded = db
    .prepare('SELECT acknowledged_at FROM instruction_acknowledgements')
    .get().acknowledged_at;
  assert.equal(
    (
      await request('/instructions/ack', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { id: gid },
      })
    ).status,
    200,
  );
  assert.equal(db.prepare('SELECT count(*) n FROM instruction_acknowledgements').get().n, 1);
  assert.equal(
    db.prepare('SELECT acknowledged_at FROM instruction_acknowledgements').get().acknowledged_at,
    recorded,
  );
  assert.equal(db.prepare('SELECT count(*) n FROM activities').get().n, 0);
  assert.equal(
    (
      await request('/instructions/ack', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { id: 'team-access-admin-v1' },
      })
    ).status,
    404,
  );
  assert.equal(
    (await request('/instructions/ack', { method: 'POST', body: { id: 'unknown-feature-v1' } }))
      .status,
    404,
  );
  db.close();
});

test('Manager can acknowledge their guides without gaining workspace write access', async () => {
  const { db, request } = context();
  const guides = (await request('/me', { who: 'boss@demo.local' })).data.instructions.guides;
  assert.ok(guides.some((g) => g.id === 'dashboard-manager-v4'));
  assert.ok(
    !guides.some((g) => ['private-task', 'private-project', 'team', 'history'].includes(g.surface)),
  );
  assert.ok(!guides.some((g) => g.id === 'version-planning-v1'));
  assert.equal(
    (
      await request('/instructions/ack', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { id: 'dashboard-manager-v4' },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request('/instructions/ack', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { id: 'private-task-v5' },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request('/tasks', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { title: 'Not allowed' },
      })
    ).status,
    403,
  );
  db.close();
});

test('Guides adapt to work groups while older confirmations suppress update prompts', async () => {
  const { db, request } = context();
  const engineer = instructionGuides({ role: 'member', groups: ['Engineering'] });
  const qa = instructionGuides({ role: 'member', groups: ['QA'] });
  assert.ok(
    engineer
      .find((g) => g.surface === 'engineering-task')
      .steps.some((s) => s.includes('Review feasibility')),
  );
  assert.ok(
    !qa
      .find((g) => g.surface === 'engineering-task')
      .steps.some((s) => s.includes('Review feasibility')),
  );
  assert.ok(
    qa
      .find((g) => g.surface === 'engineering-task')
      .steps.some((s) => s.includes('Record a test result')),
  );
  assert.ok(!engineer.some((g) => g.surface === 'team'));
  assert.notEqual(
    engineer.find((g) => g.surface === 'board').id,
    instructionGuides({ role: 'admin', groups: ['Engineering'] }).find((g) => g.surface === 'board')
      .id,
  );
  db.prepare('INSERT INTO instruction_acknowledgements VALUES(?,?,?)').run(
    'engineer@demo.local',
    'dashboard-engineering-v0',
    'old-version',
  );
  const current = (await request('/me', { who: 'engineer@demo.local' })).data.instructions;
  assert.ok(
    !current.acknowledged.includes(current.guides.find((g) => g.surface === 'dashboard').id),
  );
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const sandbox = { document: { addEventListener() {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext(`state.instructions=${JSON.stringify(current)}`, sandbox);
  assert.equal(
    vm.runInContext('instructionFor("dashboard")', sandbox),
    '',
    'An older acknowledgement covers the same feature after an update',
  );
  vm.runInContext(
    'state.instructions.acknowledged.push(...state.instructions.guides.filter(g=>g.surface==="dashboard").map(g=>g.id))',
    sandbox,
  );
  assert.equal(vm.runInContext('instructionFor("dashboard")', sandbox), '');
  assert.match(
    vm.runInContext(
      'instructionCard(state.instructions.guides.find(g=>g.surface==="dashboard"),true)',
      sandbox,
    ),
    /Reviewed/,
  );
  db.exec("UPDATE users SET groups_json='[\"QA\"]' WHERE email='engineer@demo.local'");
  assert.ok(
    (await request('/me', { who: 'engineer@demo.local' })).data.instructions.guides.some(
      (g) => g.id === 'dashboard-qa-v5',
    ),
  );
  db.close();
});

test('Private tasks may start completed, preserve their project link, and do not manufacture dated work', async () => {
  const { db, request } = context(),
    who = 'engineer@demo.local';
  const project = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: { title: 'Catalog', kind: 'Project' },
    })
  ).data.id;
  const created = await request('/private-work', {
    who,
    method: 'POST',
    body: { title: 'Prices updated', kind: 'Task', parent_id: project, status: 'Completed' },
  });
  assert.equal(created.status, 201);
  const task = (await request('/private-work/' + created.data.id, { who })).data.item;
  assert.equal(task.status, 'Completed');
  assert.equal(task.parent_id, project);
  assert.equal(task.inactivity_reminder, null);
  assert.equal(
    (await request('/private-work/' + project, { who })).data.children[0].status,
    'Completed',
  );
  assert.equal(db.prepare('SELECT count(*) n FROM office_logs').get().n, 0);
  const revision = JSON.parse(
    db.prepare('SELECT details FROM private_work_revisions WHERE work_id=?').get(created.data.id)
      .details,
  );
  assert.equal(revision.status, 'Completed');
  assert.equal(
    (
      await request('/private-work', {
        who,
        method: 'POST',
        body: { title: 'Invalid', kind: 'Task', status: 'On Production' },
      })
    ).status,
    400,
  );
  const ongoing = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: { title: 'Default status', kind: 'Task' },
    })
  ).data.id;
  assert.equal(
    (await request('/private-work/' + ongoing, { who })).data.item.status,
    'In Progress',
  );
  db.close();
});

test('Requirement discussions count once on the posting day, retain images and keep pending highlights', async () => {
  const { db, request } = context(),
    who = 'engineer@demo.local';
  const tid = (await request('/tasks', { method: 'POST', body: { title: 'Discuss requirements' } }))
    .data.id;
  const posted = await request('/tasks/' + tid + '/comments', {
    who,
    method: 'POST',
    body: { body: 'Confirm billing scope before implementation' },
  });
  assert.equal(posted.status, 201);
  const cid = posted.data.id;
  const work = db.prepare('SELECT * FROM activities WHERE comment_id=?').get(cid);
  assert.equal(work.is_work, 1);
  assert.equal(work.result, 'Requirement discussion');
  assert.equal(work.notes, 'Confirm billing scope before implementation');
  assert.equal(
    work.created_at,
    db.prepare('SELECT created_at FROM comments WHERE id=?').get(cid).created_at,
  );
  assert.equal(
    work.activity_date,
    new Date(work.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }),
  );
  const f = new FormData();
  f.append('file', new File(['screenshot'], 'scope.png', { type: 'image/png' }));
  f.append('task_id', tid);
  f.append('comment_id', cid);
  assert.equal((await request('/attachments', { who, method: 'POST', body: f })).status, 201);
  const daily = await request('/daily?date=' + work.activity_date, { who });
  assert.equal(daily.data.activities.filter((a) => a.comment_id === cid).length, 1);
  assert.equal(daily.data.attachments.filter((a) => a.comment_id === cid).length, 1);
  assert.equal(
    (await request('/daily?date=' + work.activity_date)).data.activities.filter(
      (a) => a.comment_id === cid,
    ).length,
    0,
    'Another employee cannot browse this person’s daily page',
  );
  assert.equal(
    (
      await request('/daily?date=' + work.activity_date, { who: 'boss@demo.local' })
    ).data.activities.filter((a) => a.comment_id === cid).length,
    1,
  );
  const board = (await request('/engineering-daily?date=' + work.activity_date)).data;
  assert.equal(board.activities.filter((a) => a.comment_id === cid).length, 1);
  assert.equal(board.attachments.filter((a) => a.comment_id === cid).length, 1);
  assert.equal(
    (await request('/summary?date=' + work.activity_date, { who })).data.today_activity.filter(
      (a) => a.notes === work.notes,
    ).length,
    1,
  );
  assert.equal(
    (await request('/tasks/' + tid)).data.comments.find((c) => c.id === cid).pending_action,
    1,
  );
  await request('/tasks/' + tid, { method: 'PATCH', body: { assignee: who } });
  assert.equal(
    (await request('/daily?date=' + work.activity_date, { who })).data.activities.filter(
      (a) => a.comment_id === cid,
    ).length,
    1,
    'Assignee edits do not add work',
  );
  assert.equal(
    (await request('/tasks/' + tid)).data.comments.find((c) => c.id === cid).pending_action,
    1,
  );
  await request('/tasks/' + tid + '/comments', {
    who,
    method: 'POST',
    body: { body: 'Also confirm the refund edge case' },
  });
  assert.equal(
    (await request('/tasks/' + tid)).data.comments.filter((c) => c.pending_action).length,
    2,
    'Another discussion does not clear unanswered comments',
  );
  db.close();
});

test('Historical discussion backfill and new discussion dates use Los Angeles time including DST', async () => {
  const { db, request } = context({ commentMigration: false });
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Historical requirement discussion' },
    })
  ).data.id;
  const dates = [
    '2026-10-09T01:00:00.000Z',
    '2026-01-09T07:30:00.000Z',
    '2026-03-08T09:59:00.000Z',
    '2026-03-08T10:01:00.000Z',
    '2026-11-01T08:59:00.000Z',
    '2026-11-01T09:01:00.000Z',
  ];
  const insert = (dt) => {
    const cid = crypto.randomUUID();
    db.prepare(
      'INSERT INTO comments(id,task_id,actor_email,body,created_at) VALUES(?,?,?,?,?)',
    ).run(cid, tid, 'engineer@demo.local', 'Scope discussion', dt);
    return cid;
  };
  const ids = dates.map(insert);
  db.exec(readFileSync(new URL('../migrations/0013_comment_work.sql', import.meta.url), 'utf8'));
  for (let i = 0; i < ids.length; i++) {
    const work = db.prepare('SELECT * FROM activities WHERE comment_id=?').get(ids[i]);
    assert.equal(
      work.activity_date,
      new Date(dates[i]).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }),
    );
    assert.equal(work.created_at, dates[i]);
  }
  assert.equal(
    db.prepare('SELECT count(*) n FROM pending_task_comments WHERE task_id=?').get(tid).n,
    dates.length,
    'Backfill does not clear pending comments',
  );
  for (const dt of dates) {
    const cid = insert(dt);
    assert.equal(
      db.prepare('SELECT activity_date FROM activities WHERE comment_id=?').get(cid).activity_date,
      new Date(dt).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }),
    );
  }
  assert.equal(
    db.prepare('SELECT count(*) n FROM activities WHERE comment_id IS NOT NULL').get().n,
    dates.length * 2,
  );
  db.close();
});

test('Replies stay linked to the original task discussion and count as work without clearing pending comments', async () => {
  const { db, request } = context();
  const task = (await request('/tasks', { method: 'POST', body: { title: 'Scope conversation' } }))
    .data.id;
  const other = (await request('/tasks', { method: 'POST', body: { title: 'Other conversation' } }))
    .data.id;
  const parent = (
    await request('/tasks/' + task + '/comments', {
      method: 'POST',
      body: { body: 'Should refunded rewards appear?' },
    })
  ).data.id;
  const reply = await request('/tasks/' + task + '/comments', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: { body: 'Keep them in the reward detail view.', reply_to: parent },
  });
  assert.equal(reply.status, 201);
  const detail = (await request('/tasks/' + task)).data;
  assert.equal(detail.comments.find((c) => c.id === reply.data.id).reply_to, parent);
  assert.equal(detail.comments.filter((c) => c.pending_action).length, 2);
  assert.equal(detail.activities.filter((a) => a.comment_id === reply.data.id).length, 1);
  assert.equal(
    (
      await request('/tasks/' + other + '/comments', {
        method: 'POST',
        body: { body: 'Wrong task', reply_to: parent },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/tasks/' + task + '/comments', {
        method: 'POST',
        body: { body: 'Unknown parent', reply_to: crypto.randomUUID() },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/tasks/' + task + '/comments', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { body: 'No manager writes', reply_to: parent },
      })
    ).status,
    403,
  );
  db.close();
});

test('Highlighted Reply opens the existing composer inline with an escaped parent context', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const composer = {
      scrollIntoView() {
        this.scrolled = true;
      },
    },
    contextNode = {},
    postButton = {},
    anchor = {
      append(el) {
        this.child = el;
      },
    },
    discussion = {},
    body = {
      focus() {
        this.focused = true;
      },
    },
    highlight = {
      dataset: { highlightComment: 'parent-id' },
      append(el) {
        this.child = el;
      },
    };
  const nodes = {
    '#comment-composer': composer,
    '#comment-reply-context': contextNode,
    '#add-comment': postButton,
    '#discussion-compose-anchor': anchor,
    '#task-discussion': discussion,
    '#comment-body': body,
  };
  const sandbox = {
    document: {
      addEventListener() {},
      querySelector: (s) => nodes[s],
      querySelectorAll: () => [highlight],
    },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext(
    `state.user={email:'admin@demo.local',role:'admin',groups:['QA']};state.users=[];state.detailData={task:{archived:0},comments:[{id:'parent-id',actor_email:'engineer@demo.local',body:'<script>scope</script>'}]};startCommentReply('parent-id');`,
    sandbox,
  );
  assert.equal(highlight.child, composer);
  assert.ok(composer.scrolled);
  assert.ok(body.focused);
  assert.match(contextNode.innerHTML, /&lt;script&gt;scope&lt;\/script&gt;/);
  assert.equal(postButton.textContent, 'Post reply');
  assert.equal(vm.runInContext('state.replyTo', sandbox), 'parent-id');
});

test('Inline private activity retries failed images against the saved entry and clears the draft after success', async () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const nodes = {};
  for (const [id, value] of Object.entries({
    'private-activity-item': 'task-id',
    'private-activity-details': 'Checked prices',
    'private-activity-date': '2026-10-08',
    'private-activity-status': 'In Progress',
  }))
    nodes['#' + id] = { value };
  nodes['#private-activity-cycle'] = { hidden: true };
  nodes['#private-activity-error'] = {};
  nodes['#private-activity-file-list'] = {};
  const button = {},
    form = { dataset: {}, querySelector: () => button };
  let uploadFails = true,
    reloads = 0;
  const calls = [];
  const sandbox = {
    document: { addEventListener() {}, querySelector: (id) => nodes[id] },
    console,
    FormData,
    api: async (path, opts) => {
      calls.push({ path, opts });
      if (path === '/attachments') {
        if (uploadFails) throw Error('Upload failed');
        return {};
      }
      return { id: 'entry-id' };
    },
    reload: async () => {
      reloads++;
    },
    showToast() {},
  };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const api=')), sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'let pendingPrivateActivityFiles=[];'),
      sourceIndex(code, 'function renderPrivateDetail(d){'),
    ),
    sandbox,
  );
  vm.runInContext(
    "state.privateItems=[{id:'task-id',title:'Update prices'}];state.privateDetailData={item:{title:'Update prices'}};pendingPrivateActivityFiles=[new Blob(['image'])];",
    Object.assign(sandbox, { Blob }),
  );
  await sandbox.savePrivateActivity(form);
  assert.equal(form.dataset.savedId, 'entry-id');
  assert.match(nodes['#private-activity-error'].textContent, /save again/);
  assert.equal(reloads, 0);
  uploadFails = false;
  await sandbox.savePrivateActivity(form);
  assert.equal(calls.filter((c) => c.path === '/office').length, 1);
  assert.equal(calls.filter((c) => c.path === '/office/entry-id').length, 1);
  assert.ok(
    calls
      .filter((c) => c.path === '/attachments')
      .every((c) => c.opts.body.get('office_id') === 'entry-id'),
  );
  assert.equal(reloads, 1);
  assert.equal(nodes['#private-activity-details'].value, '');
  assert.equal(form.dataset.savedId, undefined);
});

test('Board next action states the required step alongside its owner', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const sandbox = {
    ui: (x) => String(x ?? ''),
    e: (x) => String(x ?? ''),
    who: (email) => (email === 'admin@demo.local' ? 'Admin' : 'Engineer'),
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function boardNextAction('),
      sourceIndex(code, 'function renderBoard()'),
    ),
    sandbox,
  );
  assert.equal(
    sandbox.boardNextAction({
      feasibility: 'Pending',
      workflow: { phase: 'review', owner: 'admin@demo.local' },
    }),
    'Review feasibility · Admin',
  );
  assert.equal(
    sandbox.boardNextAction({
      qa_status: 'Changes Required',
      workflow: { phase: 'development', owner: 'engineer@demo.local' },
    }),
    'Fix QA feedback · Engineer',
  );
  assert.equal(
    sandbox.boardNextAction({ workflow: { phase: 'qa', owner: 'admin@demo.local' } }),
    'Test on Stage · Admin',
  );
  assert.equal(
    sandbox.boardNextAction({
      development_status: 'Closed',
      workflow: { phase: 'done', owner: '' },
    }),
    'Completed',
  );
});

test('Completed activity only completes its private task when explicitly selected, with owner-only audit', async () => {
  const { db, request } = context();
  const task = (
    await request('/private-work', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { kind: 'Task', title: 'Check clinic pricing' },
    })
  ).data.id;
  const record = {
    title: 'Pricing checked',
    status: 'Completed',
    work_date: '2026-10-08',
    work_item_id: task,
    details: 'Verified the updated prices.',
  };
  assert.equal(
    (await request('/office', { who: 'engineer@demo.local', method: 'POST', body: record })).status,
    201,
  );
  assert.equal(
    (await request('/private-work/' + task, { who: 'engineer@demo.local' })).data.item.status,
    'In Progress',
  );
  const initial = db.prepare('SELECT count(*) n FROM office_logs').get().n;
  assert.equal(
    (
      await request('/office', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { ...record, status: 'In Progress', complete_task: true },
      })
    ).status,
    400,
  );
  assert.equal(
    db.prepare('SELECT count(*) n FROM office_logs').get().n,
    initial,
    'Invalid completion creates no activity',
  );
  assert.equal(
    (await request('/office', { method: 'POST', body: { ...record, complete_task: true } })).status,
    404,
    'Admin cannot complete another person’s private task',
  );
  const result = await request('/office', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: { ...record, complete_task: true },
  });
  assert.equal(result.status, 201);
  assert.equal(
    (await request('/private-work/' + task, { who: 'engineer@demo.local' })).data.item.status,
    'Completed',
  );
  const audit = db
    .prepare(
      "SELECT * FROM private_work_revisions WHERE work_id=? AND change_type='Completed with activity'",
    )
    .all(task);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_email, 'engineer@demo.local');
  assert.equal(JSON.parse(audit[0].details).officeId, result.data.id);
  assert.equal(
    (
      await request('/office/' + result.data.id, {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { complete_task: true },
      })
    ).status,
    200,
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM private_work_revisions WHERE work_id=? AND change_type='Completed with activity'",
      )
      .get(task).n,
    1,
  );
  const other = (
    await request('/private-work', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { kind: 'Task', title: 'Follow up' },
    })
  ).data.id;
  const entry = (
    await request('/office', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { ...record, work_item_id: other },
    })
  ).data.id;
  assert.equal(
    (
      await request('/office/' + entry, {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { complete_task: true },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('/private-work/' + other, { who: 'engineer@demo.local' })).data.item.status,
    'Completed',
  );
  db.close();
});

test('Project overview status changes require confirmation and preserve child-task status', async () => {
  const { db, request } = context(),
    who = 'engineer@demo.local';
  const project = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: { kind: 'Project', title: 'Monthly report' },
    })
  ).data.id;
  const child = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: { kind: 'Task', title: 'Check totals', parent_id: project },
    })
  ).data.id;
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const nodes = {
    '#private-status-options': { hidden: false },
    '#modal-content': {},
    '#modal-shade': { classList: { remove() {} } },
    '#confirm-private-status': {},
    '#private-status-error': {},
    '#private-status-completed-date': { value: '2026-10-12' },
  };
  const writes = [];
  const sandbox = {
    todayDate: () => '2026-10-12',
    state: {
      privateDetailData: { item: (await request('/private-work/' + project, { who })).data.item },
      user: { email: who },
    },
    canWrite: () => true,
    e: (x) => String(x),
    badge: (x) => x,
    $: (key) => nodes[key],
    document: { querySelector: () => ({ setAttribute() {} }) },
    closeModal() {},
    reload: async () => {},
    showToast() {},
    api: async (path, opts) => {
      writes.push(path);
      const response = await request(path, {
        who,
        method: opts.method,
        body: JSON.parse(opts.body),
      });
      assert.equal(response.status, 200);
      return response.data;
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function confirmPrivateTaskStatus('),
      sourceIndex(code, "document.addEventListener('click',ev=>{const trigger="),
    ),
    sandbox,
  );
  sandbox.confirmPrivateTaskStatus('Completed');
  assert.equal(writes.length, 0, 'Selecting a status only opens confirmation');
  assert.match(nodes['#modal-content'].innerHTML, /Change project status/);
  await nodes['#confirm-private-status'].onclick();
  assert.equal((await request('/private-work/' + project, { who })).data.item.status, 'Completed');
  assert.equal((await request('/private-work/' + child, { who })).data.item.status, 'In Progress');
  assert.equal(db.prepare('SELECT count(*) n FROM office_logs').get().n, 0);
  assert.equal(
    (await request('/private-work/' + project, { method: 'PATCH', body: { status: 'Waiting' } }))
      .status,
    404,
  );
  assert.equal(
    (
      await request('/private-work/' + project, {
        who: 'boss@demo.local',
        method: 'PATCH',
        body: { status: 'Waiting' },
      })
    ).status,
    403,
  );
  db.close();
});

test('Unified drop areas link files to the selected comment, activity or general task', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    handlers = {},
    uploads = [],
    queued = [];
  const sandbox = {
    document: { addEventListener: (event, fn) => (handlers[event] = fn) },
    state: { detail: 'task', detailData: { task: { archived: false } } },
    canWrite: () => true,
    busy: (fn) => fn(),
    uploadTaskFiles: (files, link) => uploads.push({ files, link }),
    queueEvidence: (files, kind) => queued.push({ files, kind }),
    uploadPrivateTaskImages: (files) => uploads.push({ files, private: true }),
    chosenAttachmentLink: () => ({ activityId: 'selected-activity' }),
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, "document.addEventListener('drop',"),
      sourceIndex(code, 'let pendingActivityFiles='),
    ),
    sandbox,
  );
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function evidencePaste('),
      sourceIndex(
        code,
        "document.addEventListener('change',ev=>{\n if(ev.target.matches('#detail-content .task-field'))",
      ),
    ),
    sandbox,
  );
  const files = [{ name: 'requirements.pdf' }, { name: 'screenshot.png' }];
  function drop(dataset) {
    let prevented = false;
    handlers.drop({
      target: { closest: () => ({ dataset, classList: { remove() {} } }) },
      preventDefault: () => (prevented = true),
      dataTransfer: { files },
    });
    assert.ok(prevented);
  }
  drop({ uploadComment: 'comment-1' });
  assert.equal(uploads[0].link.commentId, 'comment-1');
  drop({ uploadActivity: 'activity-1' });
  assert.equal(uploads[1].link.activityId, 'activity-1');
  drop({});
  assert.equal(uploads[2].link.activityId, 'selected-activity');
  drop({ evidenceKind: 'daily-task' });
  assert.equal(queued[0].kind, 'daily-task');
  assert.equal(uploads[0].files[0].name, 'requirements.pdf');
  sandbox.evidencePaste(files, { closest: () => ({ dataset: { uploadComment: 'comment-2' } }) });
  assert.equal(uploads[3].link.commentId, 'comment-2');
  sandbox.state.detailData.task.archived = true;
  drop({ uploadComment: 'comment-1' });
  assert.equal(uploads.length, 4);
});

test('Board QA filters group detailed outcomes and only offer confirmed Stage work as ready', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const sandbox = { state: { qaFilter: 'ready' } };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function matchesBoardQA('),
      sourceIndex(code, 'function filterBoardTasks('),
    ),
    sandbox,
  );
  const check = (qa_status, phase) => sandbox.matchesBoardQA({ qa_status, workflow: { phase } });
  assert.equal(check('Not Tested', 'review'), false);
  assert.equal(check('Not Tested', 'development'), false);
  assert.equal(check('Not Tested', 'qa'), true);
  assert.equal(check('Retest Required', 'qa'), true);
  sandbox.state.qaFilter = 'changes';
  for (const result of ['Changes Required', 'Partially Passed', 'Need Explanation'])
    assert.equal(check(result, 'development'), true);
  assert.equal(check('Passed', 'production'), false);
  sandbox.state.qaFilter = 'blocked';
  assert.equal(check('Unable to Test', 'development'), true);
  assert.equal(check('No Visible Changes', 'development'), true);
  assert.equal(check('Changes Required', 'development'), false);
  sandbox.state.qaFilter = 'passed';
  assert.equal(check('Passed', 'production'), true);
  assert.equal(check('Partially Passed', 'development'), false);
});

test('Board filters combine with search and clear individually without changing scope or sorting', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const sandbox = {
    state: {
      tasks: [],
      filter: 'Admin',
      categoryFilter: 'Billing',
      devFilter: 'On Stage',
      qaFilter: 'ready',
      boardScope: 'archived',
      boardSort: 'recent',
    },
    who: (email) => (email === 'admin@example.com' ? 'Admin' : 'Ethan'),
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'const boardFilterFields='),
      sourceIndex(code, 'function renderBoardFilters('),
    ),
    sandbox,
  );
  const rows = [
    {
      id: 'match',
      title: 'Fix receipt',
      assignee: 'admin@example.com',
      category: 'Billing',
      development_status: 'On Stage',
      qa_status: 'Not Tested',
      workflow: { phase: 'qa' },
    },
    {
      id: 'other-person',
      title: 'Fix receipt',
      assignee: 'ethan@example.com',
      category: 'Billing',
      development_status: 'On Stage',
      qa_status: 'Not Tested',
      workflow: { phase: 'qa' },
    },
    {
      id: 'other-category',
      title: 'Fix report',
      assignee: 'admin@example.com',
      category: 'Report',
      development_status: 'On Stage',
      qa_status: 'Not Tested',
      workflow: { phase: 'qa' },
    },
  ];
  assert.deepEqual(
    Array.from(sandbox.filterBoardTasks(rows), (t) => t.id),
    ['match'],
  );
  assert.equal(
    sandbox.boardFilterEntries().find((f) => f.key === 'qaFilter').value,
    'Ready to test',
  );
  sandbox.clearBoardFilters('filter');
  assert.deepEqual(
    Array.from(sandbox.filterBoardTasks(rows), (t) => t.id),
    ['match', 'other-person'],
  );
  sandbox.clearBoardFilters('all');
  assert.equal(sandbox.boardFilterEntries().length, 0);
  assert.equal(sandbox.filterBoardTasks(rows).length, 3);
  assert.equal(sandbox.state.boardScope, 'archived');
  assert.equal(sandbox.state.boardSort, 'recent');
});

test('Engineering and Management combine personal work with read-only team activity, without Admin or QA', async () => {
  const { db, request } = context(),
    who = 'engineering-manager@example.com';
  assert.equal(
    (
      await request('/users', {
        method: 'POST',
        body: { email: who, role: 'member', groups: ['Engineering', 'Management'] },
      })
    ).status,
    201,
  );
  const task = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Review this request', assignee: who },
    })
  ).data.id;
  assert.equal(
    (
      await advance(
        request,
        task,
        'review',
        { feasibility: 'Confirmed', assignee: who, estimated_delivery_date: '2099-10-09' },
        who,
      )
    ).status,
    201,
  );
  const own = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: { title: 'Personal follow-up', kind: 'Task' },
    })
  ).data.id;
  const other = (
    await request('/private-work', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { title: 'Other ongoing task', kind: 'Task' },
    })
  ).data.id;
  await request('/office', {
    who,
    method: 'POST',
    body: { title: 'My daily update', work_date: '2026-10-08', work_item_id: own },
  });
  const otherEntry = (
    await request('/office', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { title: 'Engineer daily update', work_date: '2026-10-08', work_item_id: other },
    })
  ).data.id;
  const personal = (await request('/daily?date=2026-10-08', { who })).data;
  assert.deepEqual(
    personal.office.map((a) => a.title),
    ['My daily update'],
  );
  assert.ok((await request('/office', { who })).data.logs.every((a) => a.owner_email === who));
  assert.ok(
    (await request('/summary?date=2026-10-08', { who })).data.today_activity.every(
      (a) => a.person === who,
    ),
  );
  assert.deepEqual(
    (await request('/private-work', { who })).data.items.map((i) => i.id),
    [own],
  );
  assert.equal((await request('/private-work/' + other, { who })).status, 404);
  assert.equal(
    (await request('/daily?date=2026-10-08&email=engineer@demo.local', { who })).status,
    403,
  );
  const team = (await request('/daily?date=2026-10-08', { who, mode: 'team' })).data;
  assert.ok(team.office.some((a) => a.owner_email === 'engineer@demo.local'));
  assert.ok(
    (await request('/summary?date=2026-10-08', { who, mode: 'team' })).data.today_activity.some(
      (a) => a.person === 'engineer@demo.local',
    ),
  );
  assert.equal(
    (
      await request('/office/' + otherEntry, {
        who,
        mode: 'team',
        method: 'PATCH',
        body: { details: 'Changed' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/office', {
        who,
        mode: 'team',
        method: 'POST',
        body: { title: 'No team writes' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/private-work/' + own, {
        who,
        mode: 'team',
        method: 'PATCH',
        body: { status: 'Completed' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/tasks/' + task + '/comments', {
        who,
        mode: 'team',
        method: 'POST',
        body: { body: 'No team writes' },
      })
    ).status,
    403,
  );
  assert.equal(
    (await request('/tasks/' + task, { who, method: 'PATCH', body: { qa_status: 'Passed' } }))
      .status,
    403,
  );
  assert.equal(
    (
      await request('/users', {
        who,
        method: 'POST',
        body: { email: 'new@example.com', role: 'member' },
      })
    ).status,
    403,
  );
  assert.equal((await request('/activity', { who })).status, 403);
  db.close();
});

test('QA and future work groups gain their own personal perspective without engineering privileges', async () => {
  const { db, request } = context();
  for (const [who, group] of [
    ['qa-manager@example.com', 'QA'],
    ['design-manager@example.com', 'Design'],
  ]) {
    db.prepare(
      'INSERT INTO users(email,display_name,role,is_boss,groups_json) VALUES(?,?,?,1,?)',
    ).run(who, group + ' Manager', 'member', JSON.stringify([group, 'Management']));
    assert.equal(
      (
        await request('/private-work', {
          who,
          method: 'POST',
          body: { title: 'My work', kind: 'Task' },
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await request('/office', {
          who,
          method: 'POST',
          body: { title: 'Daily update', work_date: '2026-10-08' },
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await request('/office', {
          who,
          mode: 'team',
          method: 'POST',
          body: { title: 'Forbidden' },
        })
      ).status,
      403,
    );
    const task = (await request('/tasks', { method: 'POST', body: { title: 'Shared task' } })).data
      .id;
    reviewed(db, task);
    db.prepare(
      "UPDATE tasks SET development_status='On Stage',stage_confirmed_at='confirmed-stage',current_environment='Stage' WHERE id=?",
    ).run(task);
    assert.equal(
      (
        await request('/tasks/' + task + '/activity', {
          who,
          method: 'POST',
          body: {
            action_type: 'Development',
            activity_date: '2026-10-08',
            notes: 'Not an engineer',
          },
        })
      ).status,
      403,
    );
    const result = await request('/tasks/' + task + '/activity', {
      who,
      method: 'POST',
      body: {
        action_type: 'QA Testing',
        activity_date: '2026-10-08',
        result: 'Passed',
        notes: 'Checked the updated task',
      },
    });
    assert.equal(result.status, group === 'QA' ? 201 : 403);
    assert.equal(
      (
        await request('/users', {
          who,
          method: 'POST',
          body: { email: 'someone@example.com', role: 'member' },
        })
      ).status,
      403,
    );
  }
  db.close();
});

test('Explicit Admin role is preserved for combined groups, while team perspective and Manager-only accounts stay read-only', async () => {
  const { db, request } = context(),
    who = 'admin-manager@example.com';
  assert.equal(
    (
      await request('/users', {
        method: 'POST',
        body: { email: who, role: 'admin', groups: ['Engineering', 'Management'] },
      })
    ).status,
    201,
  );
  assert.equal((await request('/me', { who })).data.user.role, 'admin');
  assert.equal(
    (
      await request('/users', {
        who,
        method: 'POST',
        body: { email: 'created@example.com', role: 'member' },
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request('/users', {
        who,
        mode: 'team',
        method: 'POST',
        body: { email: 'blocked@example.com', role: 'member' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/office', {
        who: 'boss@demo.local',
        mode: 'personal',
        method: 'POST',
        body: { title: 'Cannot bypass Manager-only access' },
      })
    ).status,
    403,
  );
  const me = (await request('/me', { who })).data;
  assert.ok(me.statuses.work_groups.includes('Management'));
  const gid = me.instructions.guides.find((g) => g.surface === 'workspace').id;
  assert.equal(
    (await request('/instructions/ack', { who, mode: 'team', method: 'POST', body: { id: gid } }))
      .status,
    200,
  );
  assert.deepEqual((await request('/me', { who })).data.instructions.acknowledged, [
    gid,
    'first-use-workspace',
  ]);
  assert.deepEqual(
    (await request('/me', { who: 'boss@demo.local' })).data.instructions.acknowledged,
    [],
  );
  db.close();
});

test('Combined-group UI scopes guides and capabilities to the selected perspective, including future groups', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    sandbox = { document: { addEventListener() {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  for (const group of ['Engineering', 'QA', 'Design']) {
    const user = { email: 'mixed@example.com', role: 'member', groups: [group, 'Management'] },
      guides = instructionGuides(user);
    assert.equal(new Set(guides.map((g) => g.id)).size, guides.length);
    assert.ok(guides.some((g) => g.surface === 'workspace'));
    assert.ok(guides.some((g) => g.surface === 'private-task' && g.workspace === 'personal'));
    vm.runInContext(
      `state.user=${JSON.stringify(user)};state.instructions={guides:${JSON.stringify(guides)},acknowledged:[]};state.workspaceMode='personal'`,
      sandbox,
    );
    assert.equal(vm.runInContext('hasDualWorkspace()', sandbox), true);
    assert.equal(vm.runInContext('canWrite()', sandbox), true);
    assert.equal(vm.runInContext('canDev()', sandbox), group === 'Engineering');
    assert.equal(vm.runInContext('canQA()', sandbox), group === 'QA');
    assert.equal(vm.runInContext('canManage()', sandbox), false);
    assert.match(
      vm.runInContext('instructionFor("private-task")', sandbox),
      /Opening a task shows its Overview/,
    );
    vm.runInContext("state.workspaceMode='team'", sandbox);
    assert.equal(vm.runInContext('instructionFor("private-task")', sandbox), '');
    assert.match(
      vm.runInContext('instructionFor("dashboard")', sandbox),
      /QA starts only after the Stage handoff/,
    );
    assert.equal(vm.runInContext('canWrite()', sandbox), false);
    assert.equal(vm.runInContext('canDev()', sandbox), false);
    assert.equal(vm.runInContext('canQA()', sandbox), false);
  }
  vm.runInContext("state.user.groups=['Management'];state.workspaceMode='personal'", sandbox);
  assert.equal(vm.runInContext('hasDualWorkspace()', sandbox), false);
  assert.equal(vm.runInContext('canWrite()', sandbox), false);
});

test('Perspective switching protects an unfinished draft and clears the prior private data before loading', async () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  let pending,
    dirty = true,
    reloads = 0;
  const nodes = {
    '#crumb': {},
    '#content': {},
    '#team-nav': {},
    '#history-nav': {},
    '#admin-nav': {},
  };
  const sandbox = {
    document: {
      addEventListener() {},
      querySelector: (key) => nodes[key] || null,
      querySelectorAll: () => [],
    },
    console,
    hasDirtyTask: () => dirty,
    askDiscardTask: (fn) => (pending = fn),
    closeDetail() {},
    reload: async () => {
      reloads++;
      assert.equal(vm.runInContext('state.privateItems.length', sandbox), 0);
      assert.equal(vm.runInContext('state.office.length', sandbox), 0);
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'let workspaceSwitchBusy=false;'),
      sourceIndex(code, 'function labelMobileTables('),
    ),
    sandbox,
  );
  vm.runInContext(
    "state.user={role:'member',groups:['Management','Design']};state.privateItems=[{title:'Private draft'}];state.office=[{title:'Old data'}];",
    sandbox,
  );
  await sandbox.setWorkspaceMode('team');
  assert.equal(reloads, 0);
  assert.equal(vm.runInContext('state.workspaceMode', sandbox), 'personal');
  assert.ok(pending);
  dirty = false;
  await pending();
  assert.equal(reloads, 1);
  assert.equal(vm.runInContext('state.workspaceMode', sandbox), 'team');
  assert.equal(vm.runInContext('canWrite()', sandbox), false);
  await sandbox.setWorkspaceMode('personal');
  assert.equal(reloads, 2);
  assert.equal(vm.runInContext('canWrite()', sandbox), true);
});

test('A stale reload cannot overwrite the selected perspective after a mode change', async () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  let release,
    painted = 0;
  const sandbox = {
    state: { workspaceRevision: 0, day: '2026-10-08', summary: { current: true } },
    canManage: () => false,
    api: (path) =>
      path.startsWith('/summary')
        ? new Promise((resolve) => (release = resolve))
        : Promise.resolve({ users: [], tasks: [], logs: [] }),
    render: () => painted++,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'async function reload(){'),
      sourceIndex(code, 'let workspaceSwitchBusy=false;'),
    ),
    sandbox,
  );
  const loading = sandbox.reload();
  sandbox.state.workspaceRevision++;
  release({ today_activity: [{ person: 'old-perspective@example.com' }] });
  await loading;
  assert.equal(painted, 0);
  assert.deepEqual(sandbox.state.summary, { current: true });
});

test('Team overview renders shared Engineering activity with its images in viewing mode', async () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    root = {};
  const sandbox = {
    ui: (x) => String(x),
    state: { day: '2026-10-08', view: 'dashboard', workspaceRevision: 1, tasks: [] },
    isBoss: () => true,
    $: () => root,
    e: (x) => String(x),
    who: (x) => x,
    dateFmt: (x) => x,
    badge: (x) => x,
    empty: (x) => x,
    attachmentTiles: (files, writable) => {
      assert.equal(writable, false);
      return files.map((f) => f.filename).join(' ');
    },
    api: async (path) =>
      path.startsWith('/daily')
        ? {
            activities: [],
            office: [
              { owner_email: 'engineer@demo.local', title: 'Daily update', created_at: 'now' },
            ],
          }
        : path.startsWith('/engineering-daily')
          ? {
              activities: [
                {
                  id: 'activity',
                  task_id: 'task',
                  task_title: 'Stage fix',
                  actor_email: 'engineer@demo.local',
                  action_type: 'Development',
                  result: 'Updated',
                },
              ],
              attachments: [{ activity_id: 'activity', filename: 'screenshot.png' }],
            }
          : { releases: [] },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'async function loadManagerOverview(){'),
      sourceIndex(code, 'function parentTaskSelect('),
    ),
    sandbox,
  );
  await sandbox.loadManagerOverview();
  assert.match(root.innerHTML, /Daily update/);
  assert.match(root.innerHTML, /Stage fix/);
  assert.match(root.innerHTML, /screenshot.png/);
});

test('Language switching defaults off for every account and only Admin can grant or revoke it', async () => {
  const { db, request } = context();
  const data = {
    email: 'engineer@demo.local',
    display_name: 'Engineer',
    role: 'member',
    groups: ['Engineering'],
    language_switch_enabled: true,
  };
  for (const who of ['admin@demo.local', 'engineer@demo.local', 'boss@demo.local']) {
    const me = (await request('/me', { who })).data;
    assert.equal(me.user.language_switch_enabled, 0);
    assert.ok(!me.instructions.guides.some((g) => g.id.startsWith('account-language-')));
  }
  assert.equal(
    (await request('/users', { who: 'engineer@demo.local', method: 'POST', body: data })).status,
    403,
  );
  assert.equal(
    (await request('/users', { who: 'boss@demo.local', method: 'POST', body: data })).status,
    403,
  );
  assert.equal(
    (
      await request('/users', {
        method: 'POST',
        body: { ...data, language_switch_enabled: 'true' },
      })
    ).status,
    400,
  );
  assert.equal((await request('/users', { method: 'POST', body: data })).status, 201);
  let me = (await request('/me', { who: 'engineer@demo.local' })).data;
  assert.equal(me.user.language_switch_enabled, 1);
  assert.ok(me.instructions.guides.some((g) => g.id === 'account-language-v2'));
  assert.equal(
    (await request('/users')).data.users.find((u) => u.email === data.email)
      .language_switch_enabled,
    1,
  );
  assert.equal(
    (await request('/users', { who: 'engineer@demo.local' })).data.users.find(
      (u) => u.email === data.email,
    ).language_switch_enabled,
    null,
  );
  const { language_switch_enabled, ...legacy } = data;
  assert.equal((await request('/users', { method: 'POST', body: legacy })).status, 201);
  assert.equal(
    (await request('/me', { who: data.email })).data.user.language_switch_enabled,
    1,
    'Legacy name/role edits preserve the option',
  );
  assert.equal(
    (
      await request('/instructions/ack', {
        who: data.email,
        method: 'POST',
        body: { id: 'account-language-v2' },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('/users', { method: 'POST', body: { ...data, language_switch_enabled: false } }))
      .status,
    201,
  );
  me = (await request('/me', { who: data.email })).data;
  assert.equal(me.user.language_switch_enabled, 0);
  assert.ok(!me.instructions.guides.some((g) => g.id.startsWith('account-language-')));
  assert.equal(
    (
      await request('/instructions/ack', {
        who: data.email,
        method: 'POST',
        body: { id: 'account-language-v2' },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request('/users', {
        method: 'POST',
        body: { email: 'new@demo.local', display_name: 'New', role: 'member', groups: ['QA'] },
      })
    ).status,
    201,
  );
  assert.equal(
    db.prepare('SELECT language_switch_enabled FROM users WHERE email=?').get('new@demo.local')
      .language_switch_enabled,
    0,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM activities').get().n, 0);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM office_logs').get().n,
    0,
    'Account changes are not work activity',
  );
  db.close();
});

test('Language permission refreshes through password sessions and preserves credentials, groups and workspace restrictions', async () => {
  const { db, env, request } = context(),
    email = 'engineer@demo.local',
    password = 'fixture-password-2026';
  await request('/password', { method: 'POST', body: { email, password } });
  const hash = db
    .prepare('SELECT password_hash FROM auth_credentials WHERE email=?')
    .get(email).password_hash;
  const body = {
    email,
    display_name: 'Engineer',
    role: 'member',
    groups: ['Engineering'],
    language_switch_enabled: true,
  };
  await request('/users', { method: 'POST', body });
  assert.equal(
    db.prepare('SELECT password_hash FROM auth_credentials WHERE email=?').get(email).password_hash,
    hash,
  );
  const prod = { ...env, DEV_AUTH: undefined };
  const login = await handle(
    new Request('http://127.0.0.1:4173/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-work-tracker': '1',
        origin: 'http://127.0.0.1:4173',
      },
      body: JSON.stringify({ email, password }),
    }),
    prod,
  );
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const me = async () => {
    const res = await handle(
      new Request('http://127.0.0.1:4173/api/me', { headers: { cookie } }),
      prod,
    );
    assert.equal(res.status, 200);
    return res.json();
  };
  assert.equal((await me()).user.language_switch_enabled, 1);
  await request('/users', { method: 'POST', body: { ...body, language_switch_enabled: false } });
  assert.equal(
    (await me()).user.language_switch_enabled,
    0,
    'Existing session observes revocation',
  );
  await request('/users', {
    method: 'POST',
    body: {
      email: 'admin@demo.local',
      display_name: 'Admin',
      role: 'admin',
      groups: ['Engineering', 'Management'],
      language_switch_enabled: true,
    },
  });
  assert.equal(
    (await request('/me')).data.user.language_switch_enabled,
    1,
    'Admin can enable their own account',
  );
  assert.equal((await request('/users', { mode: 'team', method: 'POST', body })).status, 403);
  assert.equal((await request('/users', { method: 'POST', body })).status, 201);
  db.close();
});

test('Ordinary private activity needs no result; explicit completion saves work and finishes only the selected task', async () => {
  const { db, request } = context(),
    who = 'engineer@demo.local',
    work_date = '2026-10-12';
  const task = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: { kind: 'Task', title: 'Update contact list' },
    })
  ).data.id;
  const record = {
    work_item_id: task,
    work_date,
    title: 'Checked contact details',
    details: 'Confirmed the latest phone numbers',
  };
  const progress = await request('/office', { who, method: 'POST', body: record });
  assert.equal(progress.status, 201);
  assert.equal((await request('/office/' + progress.data.id, { who })).data.office.status, '');
  assert.equal((await request('/private-work/' + task, { who })).data.item.status, 'In Progress');
  const completed = await request('/office', {
    who,
    method: 'POST',
    body: { ...record, details: 'Updated and checked every contact', complete_task: true },
  });
  assert.equal(completed.status, 201);
  assert.equal((await request('/private-work/' + task, { who })).data.item.status, 'Completed');
  assert.equal(
    (await request('/office/' + completed.data.id, { who })).data.office.status,
    'Completed',
  );
  assert.equal(
    (await request('/daily?date=' + work_date, { who: 'boss@demo.local' })).data.office.length,
    2,
  );
  const second = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: { kind: 'Task', title: 'Prepare monthly report' },
    })
  ).data.id;
  const draft = (
    await request('/office', { who, method: 'POST', body: { ...record, work_item_id: second } })
  ).data.id;
  assert.equal(
    (await request('/office/' + draft, { who, method: 'PATCH', body: { complete_task: true } }))
      .status,
    200,
  );
  assert.equal((await request('/private-work/' + second, { who })).data.item.status, 'Completed');
  assert.equal(
    (
      await request('/office/' + draft, {
        who,
        method: 'PATCH',
        body: { details: 'Added a clarification' },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('/office/' + draft, { who })).data.office.status,
    'Completed',
    'Editing details preserves an existing result',
  );
  const standalone = await request('/office', {
    who,
    method: 'POST',
    body: { work_date, title: 'Answered a quick question' },
  });
  assert.equal(standalone.status, 201);
  assert.equal((await request('/office/' + standalone.data.id, { who })).data.office.status, '');
  assert.equal(
    (
      await request('/office', {
        who,
        method: 'POST',
        body: { work_date, title: 'No task', complete_task: true },
      })
    ).status,
    400,
  );
  db.close();
});

test('An occurrence checkbox advances recurring work without completing the whole task; ordinary progress leaves it due', async () => {
  const { db, request } = context(),
    who = 'engineer@demo.local';
  const task = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: {
        kind: 'Task',
        title: 'Weekly review',
        recurrence_rule: 'weekly',
        next_due_date: '2026-10-12',
      },
    })
  ).data.id;
  const body = {
    work_item_id: task,
    work_date: '2026-10-12',
    title: 'Reviewed records',
    details: 'Checked the current week',
  };
  await request('/office', { who, method: 'POST', body });
  let item = (await request('/private-work/' + task, { who })).data.item;
  assert.equal(item.next_due_date, '2026-10-12');
  await request('/office', { who, method: 'POST', body: { ...body, complete_occurrence: true } });
  item = (await request('/private-work/' + task, { who })).data.item;
  assert.equal(item.next_due_date, '2026-10-19');
  assert.equal(item.status, 'In Progress');
  await request('/office', {
    who,
    method: 'POST',
    body: { ...body, complete_task: true, complete_occurrence: false },
  });
  item = (await request('/private-work/' + task, { who })).data.item;
  assert.equal(item.status, 'In Progress');
  assert.equal(item.next_due_date, '2026-10-19');
  db.close();
});

test('Private activity forms expose completion without a status selector or a prior Completed result', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    nodes = {
      '#private-activity-complete-task-control': { hidden: true, dataset: {} },
      '#private-activity-complete-task': { checked: false },
      '#private-activity-complete-task-note': { dataset: {} },
    };
  const sandbox = {
    document: { addEventListener() {}, querySelector: (id) => nodes[id] },
    console,
    evidencePicker: () => '',
  };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const api=')), sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function completeTaskControl('),
      sourceIndex(code, 'function syncOfficeRecurrence('),
    ),
    sandbox,
  );
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function privateActivityComposer('),
      sourceIndex(code, 'async function savePrivateActivity('),
    ),
    sandbox,
  );
  const task = { id: 'task', kind: 'Task', status: 'In Progress', recurrence_rule: 'none' };
  sandbox.task = task;
  const html = vm.runInContext('privateActivityComposer(task)', sandbox);
  assert.ok(!html.includes('Activity result'));
  assert.match(html, /type="hidden" id="private-activity-status" value=""/);
  assert.match(html, /Complete task/);
  sandbox.syncCompleteTaskControl('private-activity', task, '');
  assert.equal(nodes['#private-activity-complete-task-control'].hidden, false);
  nodes['#private-activity-complete-task'].checked = true;
  sandbox.syncCompleteTaskControl('private-activity', { ...task, id: 'another-task' }, '');
  assert.equal(
    nodes['#private-activity-complete-task'].checked,
    false,
    'Changing the associated task clears completion consent',
  );
  sandbox.syncCompleteTaskControl('private-activity', { ...task, kind: 'Project' }, '');
  assert.equal(nodes['#private-activity-complete-task-control'].hidden, true);
});

test('Redesigned cards and activity entries open the original Engineering, private and daily forms directly', async () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    calls = [];
  let click;
  const sandbox = {
    document: {
      addEventListener(name, fn) {
        if (name === 'click') click = fn;
      },
    },
    busy: (fn) => fn(),
    openDetail: (id) => calls.push(['engineering', id]),
    openPrivateDetail: (id) => calls.push(['private', id]),
    editOffice: (id) => calls.push(['activity', id]),
  };
  vm.createContext(sandbox);
  const start = sourceIndex(code, "document.addEventListener('click',ev=>{\n const download="),
    end = sourceIndex(code, "document.addEventListener('change',ev=>{", start);
  vm.runInContext(code.slice(start, end), sandbox);
  for (const [selector, dataset] of [
    ['[data-row-task]', { rowTask: 'engineering-id' }],
    ['[data-row-private]', { rowPrivate: 'private-id' }],
    ['[data-row-office]', { rowOffice: 'activity-id' }],
  ])
    await click({ target: { closest: (s) => (s === selector ? { dataset } : null) } });
  assert.deepEqual(calls, [
    ['engineering', 'engineering-id'],
    ['private', 'private-id'],
    ['activity', 'activity-id'],
  ]);
  await click({
    target: {
      closest: (s) =>
        s === '[data-row-private]'
          ? { dataset: { rowPrivate: 'parent' } }
          : s === 'button,input,select,a'
            ? {}
            : null,
    },
  });
  assert.equal(calls.length, 3, 'Nested form controls never reopen the row');
});

test('Opening a private task immediately renders its separate Overview and activity composer with completion available', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    root = {},
    nodes = {
      '#detail-content': root,
      '#private-activity-item': { value: 'private-task' },
      '#private-activity-complete-task-control': { hidden: true, dataset: {} },
      '#private-activity-complete-task': { checked: false },
      '#private-activity-complete-task-note': { dataset: {} },
      '#private-activity-cycle': { hidden: true },
      '#private-activity-complete-cycle': { checked: false },
    };
  const sandbox = {
    document: { addEventListener() {}, querySelector: (id) => nodes[id] },
    console,
    badge: (x) => '<span>' + x + '</span>',
    evidencePicker: () => '<div>Upload area</div>',
    attachmentTiles: () => '',
    instructionFor: () => '',
    todayDate: () => '2026-10-12',
  };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function recurrenceBadge('),
      sourceIndex(code, 'function syncOfficeRecurrence('),
    ),
    sandbox,
  );
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'let pendingPrivateActivityFiles=[];'),
      sourceIndex(code, 'function renderPersonalReminders('),
    ),
    sandbox,
  );
  vm.runInContext(
    "state.user={email:'me@example.com',role:'member',groups:['Engineering']};state.privateItems=[{id:'private-task',owner_email:'me@example.com',kind:'Task',title:'Update price list',status:'In Progress',recurrence_rule:'none'}];renderPrivateDetail({item:state.privateItems[0],children:[],activities:[],attachments:[]});",
    sandbox,
  );
  assert.match(root.innerHTML, /Task overview/);
  assert.match(root.innerHTML, /form[^>]*id="private-activity-form"/);
  assert.match(root.innerHTML, /textarea[^>]*id="private-activity-details"/);
  assert.ok(!root.innerHTML.includes('Discussion'));
  assert.ok(!root.innerHTML.includes('data-workflow-field'));
  assert.ok(!/<details[^>]*>[\s\S]*?<summary>Add activity/.test(root.innerHTML));
  assert.equal(
    nodes['#private-activity-complete-task-control'].hidden,
    false,
    'Completion is initialized when the form first opens',
  );
  vm.runInContext(
    "state.user.groups=['Management'];renderPrivateDetail({item:state.privateItems[0],children:[],activities:[],attachments:[]});",
    sandbox,
  );
  assert.ok(!root.innerHTML.includes('private-activity-form'), 'Manager stays read-only');
});

test('Board stage tabs combine with search and existing filters, and Clear all preserves sorting and archive scope', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const tasks = [
    {
      id: 'dev',
      title: 'Report design',
      category: 'Reports',
      development_status: 'In Development',
      qa_status: 'Not Tested',
      workflow: { phase: 'development' },
    },
    {
      id: 'qa',
      title: 'Report test',
      category: 'Reports',
      development_status: 'On Stage',
      qa_status: 'Retest Required',
      workflow: { phase: 'qa' },
    },
    {
      id: 'waiting',
      title: 'Report not on Stage',
      category: 'Reports',
      development_status: 'Merged / Awaiting Stage',
      qa_status: 'Not Tested',
      workflow: { phase: 'stage_deploy' },
    },
    {
      id: 'prod',
      title: 'Billing fix',
      category: 'Billing',
      development_status: 'On Production',
      qa_status: 'Passed',
      workflow: { phase: 'done' },
    },
  ];
  const state = {
    tasks,
    filter: 'Report',
    categoryFilter: 'Reports',
    devFilter: 'all',
    qaFilter: 'all',
    boardPhase: 'qa',
    boardSort: 'manual',
    boardScope: 'archived',
  };
  const sandbox = { state, e: (x) => String(x ?? ''), who: (x) => x };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'const boardFilterFields='),
      sourceIndex(code, 'function renderBoard(){'),
    ),
    sandbox,
  );
  assert.deepEqual(
    Array.from(sandbox.filterBoardTasks(tasks), (t) => t.id),
    ['qa'],
  );
  assert.equal(sandbox.filterBoardTasks(tasks, { ignorePhase: true }).length, 3);
  assert.match(sandbox.renderBoardPhaseTabs(tasks), /data-board-phase="qa" class="selected"/);
  assert.ok(
    !sandbox.boardFilterEntries().some((f) => f.key === 'boardPhase'),
    'The selected stage tab does not create a duplicate filter chip',
  );
  state.devFilter = 'In Development';
  assert.equal(
    sandbox.filterBoardTasks(tasks).length,
    0,
    'An explicit development filter still intersects the stage tab',
  );
  sandbox.clearBoardFilters('devFilter');
  assert.equal(sandbox.filterBoardTasks(tasks).length, 1);
  sandbox.clearBoardFilters('all');
  assert.equal(state.boardPhase, 'all');
  assert.equal(state.boardScope, 'archived');
  assert.equal(state.boardSort, 'manual');
  assert.equal(sandbox.filterBoardTasks(tasks).length, 4);
  state.boardPhase = 'production';
  assert.deepEqual(
    Array.from(sandbox.filterBoardTasks(tasks), (t) => t.id),
    ['prod'],
  );
});

test('Version cards retain expandable planning controls and locked release snapshots without using current task edits', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    root = { querySelectorAll: () => [] },
    nodes = { '#release-results': root };
  const sandbox = {
    document: {
      addEventListener() {},
      querySelector: (id) => nodes[id],
      querySelectorAll: () => [],
    },
    console,
    todayDate: () => '2026-10-12',
  };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'let releaseList='),
      sourceIndex(code, 'async function saveRelease('),
    ),
    sandbox,
  );
  const planned = {
    id: 'plan',
    version: 'v1',
    status: 'Planned',
    planned_date: '2026-10-14',
    task_ids_json: '["pending-task"]',
    snapshot_json: '[]',
    notes: 'Check the notes',
  };
  const released = {
    id: 'released',
    version: 'v0',
    status: 'Released',
    planned_date: '2026-10-07',
    released_date: '2026-10-07',
    task_ids_json: '["task"]',
    snapshot_json: JSON.stringify([
      {
        id: 'task',
        title: 'Original released title',
        type: 'Bug Fix',
        development_status: 'On Production',
        project: 'Reports',
      },
    ]),
    notes: 'Historical notes',
  };
  sandbox.planned = planned;
  sandbox.released = released;
  vm.runInContext(
    "state.user={email:'engineer@example.com',role:'member',groups:['Engineering']};state.tasks=[{id:'task',title:'Renamed task',type:'Bug Fix',development_status:'On Production',project:'Reports'},{id:'pending-task',title:'Current improvement',type:'Improvement',development_status:'On Stage'}];releaseList=[planned,released];selectedRelease='plan';releaseEditorOpen=false;renderReleases();",
    sandbox,
  );
  assert.match(root.innerHTML, /version-card-list/);
  assert.match(root.innerHTML, /Review plan/);
  assert.match(root.innerHTML, /Original released title/);
  assert.ok(
    !root.innerHTML.includes('id="release-planned"'),
    'Preview cards do not crowd the page with every editor',
  );
  vm.runInContext('releaseEditorOpen=true;renderReleases();', sandbox);
  for (const field of [
    'release-notes',
    'release-planned',
    'release-actual',
    'release-save',
    'release-publish',
  ])
    assert.ok(root.innerHTML.includes('id="' + field + '"'));
  assert.match(root.innerHTML, /name="release-task"/);
  assert.match(root.innerHTML, /value="2026-10-12"/);
  vm.runInContext("selectedRelease='released';renderReleases();", sandbox);
  assert.match(root.innerHTML, /textarea[^>]*id="release-notes" disabled/);
  assert.ok(!root.innerHTML.includes('id="release-publish"'));
  assert.match(root.innerHTML, /Original released title/);
  vm.runInContext(
    "state.user.groups=['Management'];selectedRelease='plan';renderReleases();",
    sandbox,
  );
  assert.ok(!root.innerHTML.includes('name="release-task"'));
  assert.ok(!root.innerHTML.includes('id="release-save"'));
});

test('Release confirmation feedback accepts mixed selection, carries unfinished work and rejects no ready tasks or missing date', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    button = {},
    note = { dataset: {} },
    date = { value: '2026-10-12' };
  let selected = [];
  const nodes = {
    '#release-publish': button,
    '#release-ready-note': note,
    '#release-actual': date,
  };
  const sandbox = {
    releaseReady: (t) => ['On Production', 'Closed'].includes(t?.development_status),
    state: {
      tasks: [
        { id: 'stage', development_status: 'On Stage' },
        { id: 'prod', development_status: 'On Production' },
        { id: 'closed', development_status: 'Closed' },
      ],
    },
    $: (id) => nodes[id],
    document: { querySelectorAll: () => selected },
    systemText: (el, text) => (el.textContent = text),
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function updateReleaseReadiness(){'),
      sourceIndex(code, 'function releaseDetail('),
    ),
    sandbox,
  );
  sandbox.updateReleaseReadiness();
  assert.equal(button.disabled, true);
  assert.match(note.textContent, /Select at least/);
  selected = [{ value: 'stage' }];
  sandbox.updateReleaseReadiness();
  assert.equal(button.disabled, true);
  assert.match(note.textContent, /On Production or Closed/);
  selected = [{ value: 'stage' }, { value: 'prod' }, { value: 'closed' }];
  sandbox.updateReleaseReadiness();
  assert.equal(button.disabled, false);
  assert.match(note.textContent, /unfinished tasks move/);
  date.value = '';
  sandbox.updateReleaseReadiness();
  assert.equal(button.disabled, true);
  assert.match(note.textContent, /date/);
  assert.equal(
    nodes['#release-save'],
    undefined,
    'The helper only changes the confirmation action',
  );
});

test('Reference-style task cards show the current QA owner without changing the engineering assignee or list next action', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const sandbox = { document: { addEventListener() {} }, console, empty: () => '' };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function boardNextAction('),
      sourceIndex(code, 'const boardFilterFields='),
    ),
    sandbox,
  );
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function boardPhaseBadge('),
      sourceIndex(
        code,
        "document.addEventListener('click',ev=>{const button=ev.target.closest('[data-board-layout]')",
      ),
    ),
    sandbox,
  );
  const task = {
    id: 'task',
    title: 'Verify the report',
    category: 'Reports',
    project: 'Financial',
    priority: 'High',
    assignee: 'engineer@example.com',
    next_action_owner: 'qa@example.com',
    estimated_delivery_date: '2026-10-13',
    development_status: 'On Stage',
    qa_status: 'Retest Required',
    workflow: { phase: 'qa', owner: 'qa@example.com' },
  };
  sandbox.task = task;
  vm.runInContext(
    "state.day='2026-10-12';state.tasks=[task];state.users=[{email:'engineer@example.com',display_name:'Ethan'},{email:'qa@example.com',display_name:'Admin'}];",
    sandbox,
  );
  const html = vm.runInContext('renderEngineeringCards([task],[task])', sandbox);
  assert.match(html, /mini-avatar[^>]*>A<\/span>Admin/);
  assert.match(html, /Assignee: Ethan/);
  assert.match(html, /Test on Stage/);
  assert.match(html, /card-priority[\s\S]*High priority/);
  assert.match(html, /workspace-priority-date">Due Oct 13/);
  assert.ok(!html.includes('Last engineer'));
  assert.equal(task.assignee, 'engineer@example.com');
  assert.match(
    vm.runInContext('boardNextAction(task)', sandbox),
    /Test on Stage · Admin/,
    'List still shows the action and owner',
  );
  assert.ok(
    !vm.runInContext('boardNextAction(task,false)', sandbox).includes('Admin'),
    'Card avoids repeating its owner',
  );
});

test('Board layout is in its heading and stage tabs do not add redundant filter badges', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    state = {
      tasks: [],
      archivedTasks: [],
      statuses: { categories: [], development: [] },
      filter: '',
      categoryFilter: 'all',
      devFilter: 'all',
      qaFilter: 'all',
      boardPhase: 'engineering',
      boardLayout: 'cards',
      boardScope: 'active',
      boardSort: 'priority',
    };
  const sandbox = {
    state,
    e: (x) => String(x ?? ''),
    tr: (x) => x,
    ui: (x) => x,
    who: (x) => x,
    categoryPicker: () => '',
    option: () => '',
    workspaceDayLabel: () => '',
    canWrite: () => true,
    heading: (day, title, sub, actions) => `<header>${actions}</header>`,
    renderEngineeringCards: () => '<main>Tasks</main>',
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'const boardFilterFields='),
      sourceIndex(code, 'function boardPhaseBadge('),
    ),
    sandbox,
  );
  let html = sandbox.renderBoard();
  assert.ok(html.indexOf('data-board-layout="cards"') < html.indexOf('</header>'));
  assert.ok(html.indexOf('data-board-layout="list"') < html.indexOf('board-toolbar'));
  assert.match(html, />\+ New<\/button>/);
  assert.ok(!html.includes('Stage:'));
  assert.ok(!html.includes('board-filter-count'));
  state.categoryFilter = 'Billing';
  html = sandbox.renderBoard();
  assert.match(html, /Category: Billing/);
  assert.match(html, /board-filter-count">1/);
  assert.match(html, /data-board-phase="engineering" class="selected"/);
  sandbox.canWrite = () => false;
  html = sandbox.renderBoard();
  assert.ok(!html.includes('data-modal="task"'));
  assert.match(html, /data-board-layout="list"/);
});

test('Creating an Engineering task uploads references and retries only failed files without duplicating the task', async () => {
  const { db, request } = context(),
    code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const calls = [],
    opened = [],
    toasts = [],
    button = { disabled: false },
    cancel = { dataset: {} },
    error = { dataset: {} },
    list = {};
  let failPdf = true,
    closed = 0,
    reloads = 0;
  const fields = {
    '#new-title': { value: 'Review login issue' },
    '#new-category': { value: 'General' },
    '#new-parent': { value: '' },
    '#new-description': { value: 'The login page shows an error' },
    '#new-assignee': { value: 'engineer@demo.local' },
  };
  const nodes = {
    ...fields,
    '#new-task-file-list': list,
    '#new-task-upload-error': error,
    '[data-save-modal="task"]': button,
    '#modal-content .form-actions [data-close="modal"]': cancel,
    '[data-key="new-type"]': { value: 'Bug Fix' },
    '[data-key="new-priority"]': { value: 'Medium' },
  };
  const sandbox = {
    FormData,
    console,
    todayDate: () => '2026-10-13',
    state: { day: '2026-10-12' },
    document: {
      addEventListener() {},
      querySelector: (id) => nodes[id],
      querySelectorAll: () => Object.values(fields),
    },
    $: (id) => nodes[id],
    e: (x) => String(x ?? ''),
    systemText: (node, text) => {
      if (node) node.textContent = text;
    },
    showToast: (...args) => toasts.push(args),
    closeModal: () => closed++,
    reload: async () => reloads++,
    openDetail: async (id) => opened.push(id),
    api: async (path, opts) => {
      calls.push({ path, opts });
      if (path === '/attachments' && opts.body.get('file').name === 'requirements.pdf' && failPdf) {
        failPdf = false;
        throw Error('Temporary upload failure');
      }
      const r = await request(path, {
        ...opts,
        body: typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body,
      });
      assert.ok(r.status < 300, JSON.stringify(r.data));
      return r.data;
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'let pendingNewTaskFiles='),
      sourceIndex(code, 'let editingOfficeId='),
    ),
    sandbox,
  );
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function queueEvidence('),
      sourceIndex(code, 'function evidencePaste('),
    ),
    sandbox,
  );
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'async function saveModal('),
      sourceIndex(code, 'async function saveTask('),
    ),
    sandbox,
  );
  sandbox.files = [
    new File(['image'], 'screenshot.png', { type: 'image/png' }),
    new File(['requirements'], 'requirements.pdf', { type: 'application/pdf' }),
    { name: 'too-large.pdf', size: 9 * 1024 * 1024 },
  ];
  vm.runInContext("queueEvidence(files,'new-task')", sandbox);
  assert.match(list.innerHTML, /screenshot.png/);
  assert.match(list.innerHTML, /requirements.pdf/);
  assert.ok(!list.innerHTML.includes('too-large'));
  await sandbox.saveModal('task');
  assert.equal(db.prepare('SELECT count(*) n FROM tasks').get().n, 1);
  assert.equal(db.prepare('SELECT count(*) n FROM attachments').get().n, 1);
  assert.equal(button.textContent, 'Retry uploads');
  assert.match(error.textContent, /Task created/);
  assert.equal(cancel.textContent, 'View task');
  assert.equal(closed, 0);
  assert.equal(button.disabled, false);
  assert.ok(Object.values(fields).every((f) => f.disabled));
  assert.match(list.innerHTML, /requirements.pdf/);
  assert.ok(!list.innerHTML.includes('screenshot.png'));
  const taskId = db.prepare('SELECT id FROM tasks').get().id;
  await sandbox.saveModal('task');
  assert.equal(db.prepare('SELECT count(*) n FROM tasks').get().n, 1);
  assert.equal(db.prepare('SELECT count(*) n FROM attachments').get().n, 2);
  assert.equal(closed, 1);
  assert.equal(reloads, 1);
  assert.deepEqual(opened, [taskId]);
  assert.equal(calls.filter((c) => c.path === '/tasks').length, 1);
  assert.deepEqual(
    calls.filter((c) => c.path === '/attachments').map((c) => c.opts.body.get('file').name),
    ['screenshot.png', 'requirements.pdf', 'requirements.pdf'],
  );
  assert.ok(
    calls
      .filter((c) => c.path === '/attachments')
      .every(
        (c) =>
          c.opts.body.get('task_id') === taskId &&
          !c.opts.body.get('activity_id') &&
          !c.opts.body.get('comment_id'),
      ),
  );
  const d = (await request('/tasks/' + taskId)).data;
  assert.equal(d.attachments.length, 2);
  assert.equal(d.workflow.phase, 'review');
  assert.equal(
    d.activities.filter((a) => a.is_work).length,
    1,
    'Only one creation record counts, despite upload retry',
  );
  assert.equal(d.activities.find((a) => a.is_work).activity_date, '2026-10-13');
  db.close();
});

test('New-task attachments route file selection, drop and paste to the draft before a task exists', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    handlers = {},
    queued = [],
    file = new File(['image'], 'screen.png', { type: 'image/png' });
  const sandbox = {
    document: {
      addEventListener: (name, fn) => {
        handlers[name] = fn;
      },
    },
    state: { detail: null },
    canWrite: () => true,
    queueEvidence: (files, kind) => queued.push({ files, kind }),
  };
  vm.createContext(sandbox);
  const paste = sourceIndex(code, "document.addEventListener('paste',ev=>{");
  vm.runInContext(code.slice(paste, sourceIndex(code, 'function passwordModal(', paste)), sandbox);
  let prevented = 0;
  handlers.paste({
    clipboardData: { files: [file] },
    target: { closest: (s) => (s === '#modal-content.task-create-modal' ? {} : null) },
    preventDefault: () => prevented++,
  });
  const drop = sourceIndex(code, "document.addEventListener('drop',ev=>{");
  vm.runInContext(code.slice(drop, sourceIndex(code, 'let pendingActivityFiles=', drop)), sandbox);
  handlers.drop({
    dataTransfer: { files: [file] },
    target: {
      closest: () => ({ dataset: { evidenceKind: 'new-task' }, classList: { remove() {} } }),
    },
    preventDefault: () => prevented++,
  });
  const change = sourceIndex(
    code,
    "document.addEventListener('change',ev=>{\n if(ev.target.matches('#detail-content .task-field'))",
  );
  vm.runInContext(
    code.slice(
      change,
      sourceIndex(
        code,
        "document.addEventListener('click',ev=>{const b=ev.target.closest('[data-delete-attachment]')",
        change,
      ),
    ),
    sandbox,
  );
  const input = { id: 'new-task-files', files: [file], value: 'selected', matches: () => false };
  handlers.change({ target: input });
  assert.equal(input.value, '');
  assert.equal(prevented, 2);
  assert.equal(queued.length, 3);
  assert.ok(queued.every((q) => q.kind === 'new-task' && q.files[0] === file));
});

test('New Engineering creation instructions stay unread after an earlier guide and omit creation actions for Managers', async () => {
  const { db, request } = context();
  db.prepare('INSERT INTO instruction_acknowledgements VALUES(?,?,?)').run(
    'engineer@demo.local',
    'engineering-board-shared-v6',
    'read-earlier',
  );
  const current = (await request('/me', { who: 'engineer@demo.local' })).data.instructions,
    guide = current.guides.find((g) => g.id === 'engineering-board-shared-v9');
  assert.equal(guide.id, 'engineering-board-shared-v9');
  assert.ok(!current.acknowledged.includes(guide.id));
  assert.ok(guide.steps.some((s) => s.includes('Retry uploads')));
  assert.ok(guide.steps.some((s) => s.includes('Cards / List at the top')));
  const manager = instructionGuides({ role: 'member', groups: ['Management'] }).find(
    (g) => g.id === 'engineering-board-manager-v8',
  );
  assert.ok(!manager.steps.some((s) => s.includes('Create task') || s.includes('Retry uploads')));
  db.close();
});

test('Daily Work keeps one lower project creation entry, including before the first project, and Managers get no creation controls', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    root = {},
    rows = {},
    state = {
      day: '2026-10-12',
      users: [],
      privateItems: [],
      privateSearch: '',
      privateStatus: 'Active work',
    };
  let manager = false;
  const sandbox = {
    state,
    $: (id) => (id === '#private-work-results' ? root : rows),
    isBoss: () => manager,
    canWrite: () => !manager,
    e: (x) => String(x ?? ''),
    tr: (x) => x,
    ui: (x, v = {}) => x.replace(/\{(\w+)\}/g, (_, k) => v[k]),
    heading: (eyebrow, title, sub, actions) => `<header>${actions}</header>`,
    option: () => '',
    badge: (x) => `<span>${x}</span>`,
    todayDate: () => '2026-10-12',
    timeFmt: (x) => x,
    inactivityReminder: () => '',
    recurrenceBadge: () => '',
    empty: (x) => x,
    labelMobileTables() {},
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function renderDaily('),
      sourceIndex(code, 'async function loadDaily('),
    ),
    sandbox,
  );
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function renderPrivateWork('),
      sourceIndex(code, 'function dailyActivitySection('),
    ),
    sandbox,
  );
  const check = () => {
    sandbox.renderPrivateWork();
    const header = sandbox.renderDaily(),
      html = header + root.innerHTML;
    assert.equal((html.match(/data-private-project/g) || []).length, 1);
    assert.ok(!header.includes('data-private-project'));
    assert.match(header, /data-modal="office"/);
    assert.ok(
      root.innerHTML.indexOf('data-private-project') < root.innerHTML.indexOf('Daily Work Board'),
    );
  };
  check();
  assert.ok(
    !root.innerHTML.includes('workspace-project-card'),
    'The first-project entry does not need an empty project card',
  );
  state.privateItems = [
    {
      id: 'project',
      kind: 'Project',
      title: 'Monthly report',
      status: 'In Progress',
      updated_at: '2026-10-12',
      archived: 0,
    },
  ];
  check();
  assert.match(root.innerHTML, /data-row-private="project"/);
  state.privateStatus = 'Archived work';
  check();
  manager = true;
  sandbox.renderPrivateWork();
  assert.equal(root.innerHTML, '');
  assert.ok(!sandbox.renderDaily().includes('data-private-project'));
  assert.ok(!sandbox.renderDaily().includes('data-modal="office"'));
});

test('Engineering ownership views distinguish involvement, current action and public work while completion stays separate from archive', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    me = 'me@example.com';
  const make = (id, fields = {}) => ({
    id,
    title: id,
    category: 'General',
    development_status: 'In Development',
    assignee: 'other@example.com',
    qa_owner: '',
    next_action_owner: '',
    created_by: 'other@example.com',
    workflow: { phase: 'development', owner: 'other@example.com', actions: ['progress'] },
    ...fields,
  });
  const tasks = [
    make('engineering', { assignee: me }),
    make('qa', { qa_owner: me, workflow: { phase: 'qa', owner: me, actions: ['qa'] } }),
    make('request', { created_by: me }),
    make('public', { assignee: '', workflow: { phase: 'review', owner: '', actions: ['review'] } }),
    make('other'),
    make('production', {
      assignee: me,
      development_status: 'On Production',
      workflow: { phase: 'done', owner: me, actions: ['close'] },
    }),
    make('finished', {
      assignee: me,
      development_status: 'Closed',
      workflow: { phase: 'done', owner: '', actions: [] },
    }),
  ];
  const state = {
    user: { email: me },
    tasks,
    archivedTasks: [
      make('stored', { archived: 1 }),
      make('stored-finished', { archived: 1, development_status: 'Closed' }),
    ],
    filter: '',
    categoryFilter: 'all',
    devFilter: 'all',
    qaFilter: 'all',
    boardPhase: 'all',
    boardPeople: 'all',
    boardScope: 'active',
    boardSort: 'recent',
  };
  const sandbox = { state, who: (x) => x, e: (x) => x };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'const boardFilterFields='),
      sourceIndex(code, 'function renderBoardFilters('),
    ),
    sandbox,
  );
  const ids = () => Array.from(sandbox.filterBoardTasks(sandbox.boardScopeTasks()), (t) => t.id);
  assert.deepEqual(ids(), ['engineering', 'qa', 'request', 'public', 'other', 'production']);
  state.boardPeople = 'action';
  assert.deepEqual(
    ids(),
    ['qa', 'production'],
    'Assigned engineering work waits for QA when QA owns the current action',
  );
  state.boardPeople = 'unassigned';
  assert.deepEqual(ids(), ['public']);
  state.boardPeople = 'action';
  state.boardPhase = 'qa';
  assert.deepEqual(ids(), ['qa']);
  state.filter = 'production';
  assert.deepEqual(ids(), []);
  sandbox.clearBoardFilters('all');
  assert.equal(state.boardPeople, 'all');
  assert.equal(state.boardSort, 'recent');
  state.boardScope = 'completed';
  assert.deepEqual(ids(), ['finished']);
  state.boardScope = 'archived';
  assert.deepEqual(ids(), ['stored', 'stored-finished']);
  assert.equal(
    state.archivedTasks[0].development_status,
    'In Development',
    'Archiving does not mark unfinished work complete',
  );
  assert.equal(state.archivedTasks[1].development_status, 'Closed', 'Archive retains completion');
});

test('Engineering can customize the current plan alongside future versions and released records stay locked, including automatic-name collisions', async () => {
  const { db, request } = context(),
    plan = (await request('/releases/ensure', { who: 'engineer@demo.local', method: 'POST' })).data
      .release;
  db.prepare(
    "INSERT INTO releases(id,version,planned_date,status,released_date,created_by,snapshot_json) VALUES(?,?,?,'Released',?,?,?)",
  ).run(
    'historical',
    'v1.0',
    '2026-10-07',
    '2026-10-07',
    'engineer@demo.local',
    '[{"title":"Original delivery"}]',
  );
  const change = (body) =>
    request('/releases/' + plan.id, { who: 'engineer@demo.local', method: 'PATCH', body });
  assert.equal(
    (await change({ version: 'v2.0', planned_date: '2026-10-14', notes: 'Planned improvements' }))
      .status,
    200,
  );
  let current = (await request('/releases')).data.releases.filter((r) => r.status === 'Planned');
  assert.equal(current.length, 1);
  assert.equal(current[0].id, plan.id);
  assert.equal(current[0].version, 'v2.0');
  assert.equal(current[0].planned_date, '2026-10-14');
  assert.equal((await change({ version: '' })).status, 400);
  assert.equal((await change({ version: 'v1.0' })).status, 409);
  assert.equal((await change({ planned_date: '' })).status, 400);
  assert.equal(
    (
      await request('/releases', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { version: 'another', planned_date: '2026-11-11' },
      })
    ).status,
    201,
  );
  await request('/users', {
    method: 'POST',
    body: { email: 'qa-only@example.com', role: 'member', groups: ['QA'] },
  });
  assert.equal(
    (
      await request('/releases/' + plan.id, {
        who: 'qa-only@example.com',
        method: 'PATCH',
        body: { version: 'unauthorized' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/releases/' + plan.id, {
        who: 'boss@demo.local',
        method: 'PATCH',
        body: { version: 'unauthorized' },
      })
    ).status,
    403,
  );
  const tid = (await request('/tasks', { method: 'POST', body: { title: 'Delivered fix' } })).data
    .id;
  reviewed(db, tid, true);
  assert.equal(
    (
      await request('/tasks/' + tid, {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { development_status: 'On Production', activity_date: '2026-10-14' },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await change({
        version: 'Release 2026-10-21',
        task_ids: [tid],
        publish: true,
        released_date: '2026-10-14',
      })
    ).status,
    200,
  );
  const all = (await request('/releases')).data.releases;
  current = all.filter((r) => r.status === 'Planned');
  assert.equal(current.length, 2);
  assert.ok(current.some((r) => r.version === 'another' && r.planned_date === '2026-11-11'));
  const next = current.find((r) => r.is_auto === 1);
  assert.equal(new Date(next.planned_date + 'T12:00:00Z').getUTCDay(), 3);
  assert.equal(next.version, `Release ${next.planned_date}${next.planned_date === '2026-10-21' ? ' (2)' : ''}`);
  assert.equal(all.find((r) => r.id === plan.id).version, 'Release 2026-10-21');
  assert.equal((await change({ version: 'rewrite' })).status, 409);
  assert.equal(
    all.find((r) => r.id === 'historical').snapshot_json,
    '[{"title":"Original delivery"}]',
  );
  db.close();
});

test('+ Plan creates a future version without replacing or rerendering the open current plan draft', async () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  let allowed = true,
    loaded = 0,
    posted,
    focused = 0,
    closed = 0;
  const button = { disabled: false },
    form = {},
    draft = { value: 'Keep my current notes' },
    content = { classList: { remove() {} }, innerHTML: '' };
  const nodes = {
    '#modal-content': content,
    '#modal-shade': { classList: { remove() {} } },
    '#plan-version-name': {
      value: 'November improvements',
      focus() {
        focused++;
      },
    },
    '#plan-version-date': { value: '2026-11-11' },
    '#plan-version-notes': { value: 'Future changes' },
    '#plan-version-error': { textContent: '' },
    '#release-plan-form': form,
    '#release-notes': draft,
  };
  const sandbox = {
    state: { view: 'releases' },
    canDev: () => allowed,
    $: (id) => nodes[id],
    document: { addEventListener() {} },
    e: (x) => String(x),
    tr: (x) => x,
    ui: (x) => String(x),
    closeModal: () => closed++,
    showToast() {},
    api: async (path, args) => {
      posted = { path, body: JSON.parse(args.body) };
      return { id: 'future' };
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(sourceIndex(code, 'let releaseList='), sourceIndex(code, 'function releaseItems(')),
    sandbox,
  );
  sandbox.loadReleases = async () => loaded++;
  vm.runInContext(
    "releaseList=[{id:'current',status:'Planned',planned_date:'2026-10-14'}];selectedRelease='current';releaseEditorOpen=true;",
    sandbox,
  );
  sandbox.openReleasePlan();
  assert.match(content.innerHTML, /Plan a version/);
  assert.match(content.innerHTML, /id="plan-version-date" required type="date"/);
  assert.equal(draft.value, 'Keep my current notes');
  assert.equal(focused, 1);
  assert.equal(loaded, 0);
  await form.onsubmit({ preventDefault() {}, target: { querySelector: () => button } });
  assert.equal(posted.path, '/releases');
  assert.deepEqual(posted.body, {
    version: 'November improvements',
    planned_date: '2026-11-11',
    notes: 'Future changes',
  });
  assert.equal(vm.runInContext('selectedRelease', sandbox), 'future');
  assert.equal(vm.runInContext('releaseEditorOpen', sandbox), true);
  assert.equal(closed, 1);
  assert.equal(loaded, 1);
  assert.equal(button.disabled, false);
  allowed = false;
  content.innerHTML = 'unchanged';
  sandbox.openReleasePlan();
  assert.equal(content.innerHTML, 'unchanged');
});

test('Private tasks own a completion date without activity, allow owner corrections and clear it on reopening', async () => {
  const { db, request } = context(),
    who = 'engineer@demo.local';
  const tid = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: {
        kind: 'Task',
        title: 'Finished setup',
        status: 'Completed',
        completed_date: '2026-10-08',
      },
    })
  ).data.id;
  const get = async () => (await request('/private-work/' + tid, { who })).data.item;
  assert.equal((await get()).completed_date, '2026-10-08');
  assert.equal((await get()).status, 'Completed');
  assert.equal(db.prepare('SELECT count(*) n FROM office_logs').get().n, 0);
  assert.equal(
    (
      await request('/private-work/' + tid, {
        who,
        method: 'PATCH',
        body: { completed_date: '2026-10-09' },
      })
    ).status,
    200,
  );
  assert.equal((await get()).completed_date, '2026-10-09');
  assert.equal((await get()).status, 'Completed');
  assert.equal(db.prepare('SELECT count(*) n FROM office_logs').get().n, 0);
  assert.equal(
    (
      await request('/private-work/' + tid, {
        who,
        method: 'PATCH',
        body: { completed_date: '2026-02-31' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/private-work/' + tid, {
        method: 'PATCH',
        body: { completed_date: '2026-10-10' },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request('/private-work/' + tid, {
        who: 'boss@demo.local',
        method: 'PATCH',
        body: { completed_date: '2026-10-10' },
      })
    ).status,
    403,
  );
  await request('/private-work/' + tid, { who, method: 'PATCH', body: { status: 'In Progress' } });
  assert.equal((await get()).completed_date, '');
  assert.equal(
    (
      await request('/private-work/' + tid, {
        who,
        method: 'PATCH',
        body: { completed_date: '2026-10-10' },
      })
    ).status,
    409,
  );
  await request('/private-work/' + tid, {
    who,
    method: 'PATCH',
    body: { status: 'Completed', completed_date: '2026-10-11' },
  });
  assert.equal((await get()).completed_date, '2026-10-11');
  assert.equal(db.prepare('SELECT count(*) n FROM office_logs').get().n, 0);
  const other = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: { kind: 'Task', title: 'Finished with a work log' },
    })
  ).data.id;
  await request('/office', {
    who,
    method: 'POST',
    body: {
      title: 'Checked final details',
      work_item_id: other,
      work_date: '2026-10-12',
      complete_task: true,
      completed_date: '2026-10-10',
    },
  });
  const detail = (await request('/private-work/' + other, { who })).data;
  assert.equal(detail.item.completed_date, '2026-10-10');
  assert.equal(detail.activities[0].work_date, '2026-10-12');
  db.close();
});

test('Recurring status completion advances only one occurrence without inventing activity and rejects stale completion', async () => {
  const { db, request } = context(),
    who = 'engineer@demo.local';
  const tid = (
    await request('/private-work', {
      who,
      method: 'POST',
      body: {
        title: 'Weekly check',
        kind: 'Task',
        recurrence_rule: 'weekly',
        next_due_date: '2026-10-12',
      },
    })
  ).data.id;
  const finish = {
    status: 'Completed',
    completed_date: '2026-10-11',
    expected_due_date: '2026-10-12',
  };
  assert.equal(
    (await request('/private-work/' + tid, { who, method: 'PATCH', body: finish })).status,
    200,
  );
  let item = (await request('/private-work/' + tid, { who })).data.item;
  assert.equal(item.status, 'In Progress');
  assert.equal(item.completed_date, '2026-10-11');
  assert.equal(item.next_due_date, '2026-10-19');
  assert.equal(item.recurrence_rule, 'weekly');
  assert.equal(db.prepare('SELECT count(*) n FROM office_logs').get().n, 0);
  assert.equal(
    (await request('/private-work/' + tid, { who, method: 'PATCH', body: finish })).status,
    409,
  );
  assert.equal(
    (
      await request('/private-work/' + tid, {
        who,
        method: 'PATCH',
        body: { completed_date: '2026-10-10' },
      })
    ).status,
    200,
  );
  item = (await request('/private-work/' + tid, { who })).data.item;
  assert.equal(item.next_due_date, '2026-10-19');
  assert.equal(item.completed_date, '2026-10-10');
  await request('/office', {
    who,
    method: 'POST',
    body: {
      title: 'Next weekly check',
      work_item_id: tid,
      work_date: '2026-10-19',
      complete_task: true,
    },
  });
  item = (await request('/private-work/' + tid, { who })).data.item;
  assert.equal(item.status, 'In Progress');
  assert.equal(item.next_due_date, '2026-10-26');
  assert.equal(item.completed_date, '2026-10-19');
  const created = await request('/private-work', {
    who,
    method: 'POST',
    body: {
      title: 'Already checked',
      kind: 'Task',
      status: 'Completed',
      recurrence_rule: 'daily',
      next_due_date: '2026-10-12',
      completed_date: '2026-10-12',
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.occurrence_completed, true);
  item = (await request('/private-work/' + created.data.id, { who })).data.item;
  assert.equal(item.status, 'In Progress');
  assert.equal(item.next_due_date, '2026-10-13');
  await request('/private-work/' + tid, {
    who,
    method: 'PATCH',
    body: { recurrence_rule: 'none', status: 'Completed', completed_date: '2026-10-20' },
  });
  item = (await request('/private-work/' + tid, { who })).data.item;
  assert.equal(item.status, 'Completed');
  assert.equal(item.recurrence_rule, 'none');
  db.close();
});

test('New activity menus omit completed tasks while historical editing retains only its current completed association', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    me = 'owner@example.com';
  const project = {
      id: 'project',
      kind: 'Project',
      title: 'Project',
      owner_email: me,
      status: 'In Progress',
    },
    ongoing = {
      id: 'ongoing',
      kind: 'Task',
      title: 'Current work',
      owner_email: me,
      parent_id: 'project',
      status: 'In Progress',
    },
    finished = {
      id: 'finished',
      kind: 'Task',
      title: 'Finished work',
      owner_email: me,
      parent_id: 'project',
      status: 'Completed',
    },
    otherFinished = { ...finished, id: 'other-finished', title: 'Other finished work' };
  const sandbox = {
    state: {
      user: { email: me },
      privateItems: [project, ongoing, finished, otherFinished],
      day: '2026-10-12',
    },
    e: (x) => String(x ?? ''),
    ui: (x) => x,
    tr: (x) => x,
    evidencePicker: () => '',
    completeTaskControl: () => '',
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function privateActivityAssociation('),
      sourceIndex(code, 'async function openPrivateActivity('),
    ),
    sandbox,
  );
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function privateActivityComposer('),
      sourceIndex(code, 'async function savePrivateActivity('),
    ),
    sandbox,
  );
  let html = sandbox.privateActivityAssociation('project');
  assert.match(html, /value="ongoing"/);
  assert.ok(!html.includes('value="finished"'));
  assert.ok(!html.includes('value="other-finished"'));
  html = sandbox.privateActivityAssociation();
  assert.ok(!html.includes('value="finished"'));
  html = sandbox.privateActivityAssociation('finished', true);
  assert.match(html, /value="finished" selected/);
  assert.ok(!html.includes('value="other-finished"'));
  html = sandbox.privateActivityComposer(project, [ongoing, finished]);
  assert.match(html, /value="ongoing"/);
  assert.ok(!html.includes('value="finished"'));
});

test('Engineering completion date is independent metadata and preserves the recorded work day and pending comments', async () => {
  const { db, request } = context();
  const tid = (await request('/tasks', { method: 'POST', body: { title: 'Finish verified work' } }))
    .data.id;
  reviewed(db, tid, true);
  await request('/tasks/' + tid, {
    who: 'engineer@demo.local',
    method: 'PATCH',
    body: { development_status: 'On Production', activity_date: '2026-10-12' },
  });
  assert.equal(
    (
      await request('/tasks/' + tid, {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { completed_date: '2026-10-09' },
      })
    ).status,
    200,
  );
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.completed_date, '2026-10-09');
  assert.equal(d.task.development_status, 'Closed');
  const workDays = d.activities.map((a) => a.activity_date);
  const cid = (
    await request('/tasks/' + tid + '/comments', {
      method: 'POST',
      body: { body: 'Follow-up discussion' },
    })
  ).data.id;
  const workCount = db
    .prepare('SELECT count(*) n FROM activities WHERE task_id=? AND is_work=1')
    .get(tid).n;
  assert.equal(
    (
      await request('/tasks/' + tid, {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { completed_date: '2026-10-10' },
      })
    ).status,
    200,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.completed_date, '2026-10-10');
  assert.equal(
    db.prepare('SELECT count(*) n FROM activities WHERE task_id=? AND is_work=1').get(tid).n,
    workCount,
  );
  assert.ok(d.comments.find((c) => c.id === cid).pending_action);
  assert.deepEqual(
    d.activities.filter((a) => a.result.includes('On Production')).map((a) => a.activity_date),
    ['2026-10-12'],
  );
  const active = (await request('/tasks', { method: 'POST', body: { title: 'Still pending' } }))
    .data.id;
  assert.equal(
    (await request('/tasks/' + active, { method: 'PATCH', body: { completed_date: '2026-10-10' } }))
      .status,
    409,
  );
  db.close();
});

test('Private activity rows show recorded work without legacy statuses while Engineering results remain visible', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    me = 'me@example.com';
  const sandbox = {
    state: { user: { email: me }, privateItems: [{ id: 'task', title: 'Update prices' }] },
    canWrite: () => true,
    isBoss: () => false,
    e: (x) => String(x ?? ''),
    ui: (x) => x,
    who: (x) => x,
    badge: (x) => `<span class="badge">${x}</span>`,
    attachmentTiles: (files) => files.map((f) => f.filename).join(' '),
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function dailyActivitySection('),
      sourceIndex(code, 'let pendingNewTaskFiles='),
    ),
    sandbox,
  );
  const rows = [
    {
      id: 'office-1',
      person: me,
      title: 'Update prices',
      item: 'task',
      result: 'In Progress',
      kind: 'Private activity',
      notes: 'Checked the current prices',
      attachments: [{ filename: 'checked.png' }],
    },
    {
      id: 'office-2',
      person: me,
      title: 'Finished changes',
      result: 'Completed',
      notes: 'Updated the price list',
    },
  ];
  let html = sandbox.dailyActivitySection(rows, 'Daily Work activity', true, false);
  assert.ok(!html.includes('<th>RESULT</th>'));
  assert.ok(!html.includes('<th>STATUS'));
  assert.ok(!html.includes('<span class="badge">In Progress'));
  assert.ok(!html.includes('<span class="badge">Completed'));
  assert.match(html, /checked.png/);
  assert.match(html, /data-row-office="office-1"/);
  assert.equal(
    (html.match(/Update prices/g) || []).length,
    2,
    'Title appears once in the visible cell and once in its accessible row label',
  );
  assert.match(sandbox.dailyActivitySection([], 'Daily Work activity', true, false), /colspan="3"/);
  const engineering = {
    task_id: 'shared',
    person: me,
    title: 'Test Stage',
    result: 'Changes Required',
    kind: 'QA Testing',
    notes: 'The new screen still needs fixes',
  };
  html = sandbox.dailyActivitySection([engineering], 'Engineering activity', true);
  assert.match(html, /<th>RESULT<\/th>/);
  assert.match(html, /<span class="badge">Changes Required/);
  assert.match(html, /data-row-task="shared"/);
  sandbox.isBoss = () => true;
  sandbox.canWrite = () => false;
  html = sandbox.dailyActivitySection([...rows, engineering], 'Team activities');
  assert.ok(!html.includes('<span class="badge">Completed'));
  assert.ok(!html.includes('<span class="badge">In Progress'));
  assert.match(html, /<span class="badge">Changes Required/);
  assert.equal(rows[0].result, 'In Progress', 'Rendering never rewrites old activity data');
});

test('Dashboard omits private activity results and retains shared test outcomes', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    state = {
      day: '2026-10-12',
      summary: {
        counts: {},
        today_activity: [
          {
            id: 'office',
            private: true,
            title: 'Followed up with the engineer',
            person: 'me@example.com',
            result: 'In Progress',
            notes: 'Reported what I checked',
            created_at: 'now',
          },
          {
            id: 'finished',
            private: true,
            title: 'Updated the list',
            person: 'me@example.com',
            result: 'Completed',
            notes: 'The changes are saved',
            created_at: 'now',
          },
          {
            activity_id: 'shared-activity',
            task_id: 'shared',
            private: false,
            title: 'Tested Stage',
            person: 'me@example.com',
            category: 'QA Testing',
            result: 'Passed',
            created_at: 'now',
          },
        ],
      },
    };
  const sandbox = {
    state,
    e: (x) => String(x ?? ''),
    who: (x) => x,
    initial: () => 'M',
    timeFmt: (x) => x,
    badge: (x) => `<span class="badge">${x}</span>`,
    heading: () => '',
    workspaceDayLabel: () => '',
    canWrite: () => false,
    canManage: () => false,
    avatarHtml: () => '<span class="mini-avatar">M</span>',
    renderNextActions: () => '',
    dashboardTracking: () => '',
    renderPersonalReminders: () => '',
    empty: () => '',
    ui: (x) => x,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function renderDashboard('),
      sourceIndex(code, 'function isNextActionRelevant('),
    ),
    sandbox,
  );
  const html = sandbox.renderDashboard();
  assert.ok(!html.includes('<span class="badge">In Progress'));
  assert.ok(!html.includes('<span class="badge">Completed'));
  assert.match(html, /<span class="badge">Passed/);
  assert.match(html, /data-row-office="office"/);
  assert.match(html, /data-row-activity="shared-activity" data-activity-task="shared"/);
  assert.match(html, /Reported what I checked/);
  assert.ok(!html.includes('now'), 'Submission timestamps stay out of the Dashboard');
});

test('My account Change password opens and submits the self-change form, while Admin reset keeps its own fields', async () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    writes = [];
  let signedOut = 0;
  const nodes = {
    '#modal-content': { classList: { remove() {} } },
    '#modal-shade': { classList: { remove() {} } },
    '#account-change-password': {},
    '#account-sign-out': {},
    '#account-remove-avatar': {},
    '#member-password-form': {},
    '#password-error': { dataset: {} },
    '#current-password': { value: 'old fixture password' },
    '#member-password': { value: 'new fixture password' },
    '#confirm-password': { value: 'new fixture password' },
    '#login-email': { value: '' },
  };
  const sandbox = {
    state: {
      user: { email: 'me@example.com', display_name: 'Me' },
      users: [{ email: 'member@example.com', has_password: 1 }],
    },
    avatarSaving: false,
    avatarHtml: () => '<span>Me</span>',
    e: (x) => String(x ?? ''),
    ui: (x) => x,
    instructionFor: () => '',
    systemText: (node, text) => (node.textContent = text),
    $: (id) => nodes[id],
    closeModal() {},
    showLogin: async () => signedOut++,
    showToast() {},
    reload: async () => {},
    api: async (path, opts) => {
      writes.push({ path, body: JSON.parse(opts.body) });
      return {};
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function passwordModal('),
      sourceIndex(code, "$('#change-password').onclick"),
    ),
    sandbox,
  );
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function accountMenu(){'),
      sourceIndex(
        code,
        "document.addEventListener('change',ev=>{if(ev.target.id==='account-avatar-file')",
      ),
    ),
    sandbox,
  );
  sandbox.accountMenu();
  nodes['#account-change-password'].onclick();
  assert.match(nodes['#modal-content'].innerHTML, /<h2>Change password/);
  assert.match(nodes['#modal-content'].innerHTML, /id="current-password"/);
  assert.match(nodes['#modal-content'].innerHTML, /id="confirm-password"/);
  assert.equal(typeof nodes['#member-password-form'].onsubmit, 'function');
  const button = { disabled: false };
  await nodes['#member-password-form'].onsubmit({
    preventDefault() {},
    target: { querySelector: () => button },
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, '/password');
  assert.equal(writes[0].body.current_password, 'old fixture password');
  assert.equal(writes[0].body.password, 'new fixture password');
  assert.equal(signedOut, 1);
  assert.equal(nodes['#login-email'].value, 'me@example.com');
  sandbox.passwordModal('member@example.com');
  assert.match(nodes['#modal-content'].innerHTML, /<h2>Reset password/);
  assert.ok(!nodes['#modal-content'].innerHTML.includes('id="current-password"'));
  sandbox.state.users[0].has_password = 0;
  sandbox.passwordModal('member@example.com');
  assert.match(nodes['#modal-content'].innerHTML, /<h2>Set password/);
});

test('Avatars persist per account, are readable only after sign-in, and replace or remove storage without task activity', async () => {
  const { db, env, request } = context(),
    who = 'engineer@demo.local',
    bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGQAAAABJRU5ErkJggg==',
      'base64',
    );
  const upload = async (target) => {
    const form = new FormData();
    form.append('file', new File([bytes], 'photo.png', { type: 'image/png' }));
    if (target) form.append('email', target);
    return request('/avatar', { who, method: 'POST', body: form });
  };
  const first = await upload();
  assert.equal(first.status, 201);
  const aid = first.data.avatar_id;
  assert.equal((await request('/me', { who })).data.user.avatar_id, aid);
  assert.equal((await request('/users')).data.users.find((u) => u.email === who).avatar_id, aid);
  assert.equal((await request('/avatars/' + aid, { who: 'boss@demo.local' })).status, 200);
  const response = await handle(
    new Request('http://127.0.0.1:4173/api/avatars/' + aid, { headers: { 'x-dev-user': who } }),
    env,
  );
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [...bytes]);
  assert.equal(
    (
      await handle(new Request('http://127.0.0.1:4173/api/avatars/' + aid), {
        ...env,
        DEV_AUTH: undefined,
      })
    ).status,
    401,
  );
  const oldKey = db.prepare('SELECT object_key FROM user_avatars WHERE id=?').get(aid).object_key;
  assert.equal((await upload('admin@demo.local')).status, 403);
  assert.equal((await request('/me')).data.user.avatar_id, '');
  const invalid = new FormData();
  invalid.append(
    'file',
    new File(['<svg><script>bad</script></svg>'], 'fake.png', { type: 'image/png' }),
  );
  assert.equal((await request('/avatar', { who, method: 'POST', body: invalid })).status, 400);
  assert.equal((await request('/me', { who })).data.user.avatar_id, aid);
  const second = await upload();
  assert.equal(second.status, 201);
  assert.notEqual(second.data.avatar_id, aid);
  assert.equal((await request('/avatars/' + aid, { who })).status, 404);
  assert.equal(await env.BUCKET.get(oldKey), null);
  assert.equal(db.prepare('SELECT count(*) n FROM user_avatars').get().n, 1);
  assert.equal((await request('/avatar', { who, method: 'DELETE' })).status, 200);
  assert.equal((await request('/me', { who })).data.user.avatar_id, '');
  assert.equal(db.prepare('SELECT count(*) n FROM user_avatars').get().n, 0);
  assert.equal((await request('/avatars/' + second.data.avatar_id, { who })).status, 404);
  assert.equal(db.prepare('SELECT count(*) n FROM activities').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM office_logs').get().n, 0);
  db.close();
});

test('Manager can manage their own avatar while all workspace write restrictions remain in force', async () => {
  const { db, request } = context(),
    who = 'boss@demo.local',
    form = new FormData();
  form.append(
    'file',
    new File(
      [Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64')],
      'photo.gif',
      { type: 'image/gif' },
    ),
  );
  const uploaded = await request('/avatar', { who, mode: 'team', method: 'POST', body: form });
  assert.equal(uploaded.status, 201);
  assert.equal(
    (await request('/me', { who, mode: 'team' })).data.user.avatar_id,
    uploaded.data.avatar_id,
  );
  assert.equal(
    (
      await request('/tasks', {
        who,
        mode: 'team',
        method: 'POST',
        body: { title: 'Not permitted' },
      })
    ).status,
    403,
  );
  assert.equal(
    (await request('/office', { who, method: 'POST', body: { title: 'Not permitted' } })).status,
    403,
  );
  assert.equal((await request('/avatar', { who, mode: 'team', method: 'DELETE' })).status, 200);
  assert.ok(
    instructionGuides({ role: 'member', groups: ['Management'] }).some(
      (g) => g.id === 'account-avatar-v1',
    ),
  );
  db.close();
});

test('Avatar updates refresh photo elements without rerendering or discarding an existing task draft', async () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    calls = [],
    draft = { value: 'Unsaved task notes' },
    button = { disabled: false },
    status = { dataset: {} },
    error = { dataset: {} },
    remove = { hidden: true };
  let updates = 0;
  const sandbox = {
    avatarSaving: false,
    state: {
      user: { email: 'manager@example.com', groups: ['Management'] },
      users: [{ email: 'manager@example.com' }],
    },
    document: { querySelectorAll: () => [button] },
    $: (id) =>
      ({
        '#avatar-upload-status': status,
        '#avatar-upload-error': error,
        '#account-remove-avatar': remove,
        '#activity-notes': draft,
      })[id],
    FormData,
    prepareAvatarPhoto: async (file) => file,
    systemText: (node, text) => {
      if (node) node.textContent = text;
    },
    updateProfileAvatars: () => updates++,
    showToast() {},
    api: async (path, opts) => {
      calls.push({ path, opts });
      return { avatar_id: opts.method === 'DELETE' ? '' : 'new-avatar' };
    },
    render() {
      throw Error('Must preserve task draft');
    },
    reload() {
      throw Error('Must preserve task draft');
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'async function saveAccountAvatar('),
      sourceIndex(code, 'function accountMenu(){'),
    ),
    sandbox,
  );
  await sandbox.saveAccountAvatar(new File(['image'], 'photo.png', { type: 'image/png' }));
  assert.equal(sandbox.state.user.avatar_id, 'new-avatar');
  assert.equal(sandbox.state.users[0].avatar_id, 'new-avatar');
  assert.equal(remove.hidden, false);
  assert.equal(draft.value, 'Unsaved task notes');
  assert.equal(updates, 1);
  assert.equal(calls[0].path, '/avatar');
  assert.equal(calls[0].opts.body.get('file').name, 'photo.png');
  assert.equal(button.disabled, false);
  await sandbox.saveAccountAvatar(null, true);
  assert.equal(sandbox.state.user.avatar_id, '');
  assert.equal(remove.hidden, true);
  assert.equal(draft.value, 'Unsaved task notes');
  assert.equal(updates, 2);
});

test('Multiple future plans preserve their notes and reservations alongside one automatic current version', async (t) => {
  // This fixture exercises the release window containing its October 9 delivery.
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 13, 19) });
  const { db, request } = context(),
    current = (await request('/releases/ensure', { method: 'POST' })).data.release;
  const november = (
    await request('/releases', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { version: 'November updates', planned_date: '2026-11-11', notes: 'Improve search' },
    })
  ).data.id;
  assert.equal(
    (
      await request('/releases', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { version: 'December updates', planned_date: '2026-12-09', notes: 'Year-end fixes' },
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request('/releases', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { version: 'No date' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/releases', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { version: 'Manager plan', planned_date: '2026-11-18' },
      })
    ).status,
    403,
  );
  const tid = (await request('/tasks', { method: 'POST', body: { title: 'Reserved feature' } }))
    .data.id;
  reviewed(db, tid, true);
  await request('/tasks/' + tid, {
    who: 'engineer@demo.local',
    method: 'PATCH',
    body: { development_status: 'On Production', activity_date: '2026-10-09' },
  });
  assert.equal(
    (await request('/releases/' + november, { method: 'PATCH', body: { task_ids: [tid] } })).status,
    200,
  );
  for (let i = 0; i < 3; i++) {
    const plans = (await request('/releases')).data.releases.filter((r) => r.status === 'Planned');
    assert.equal(plans.length, 3);
    assert.equal(plans.filter((r) => r.is_auto === 1).length, 1);
    assert.equal(plans.find((r) => r.is_auto === 1).id, current.id);
    assert.deepEqual(
      JSON.parse(plans.find((r) => r.id === current.id).task_ids_json),
      [],
      'Automatic suggestions respect explicit future reservations',
    );
    assert.equal(plans.find((r) => r.id === november).notes, 'Improve search');
    assert.deepEqual(plans.find((r) => r.id === november).selected_task_ids, [tid]);
  }
  assert.equal(
    (await request('/releases/' + current.id, { method: 'PATCH', body: { task_ids: [tid] } }))
      .status,
    409,
  );
  assert.equal(
    (await request('/releases/' + november, { method: 'PATCH', body: { task_ids: [] } })).status,
    200,
  );
  assert.ok(
    JSON.parse(
      (await request('/releases')).data.releases.find((r) => r.id === current.id).task_ids_json,
    ).includes(tid),
  );
  db.close();
});

test('A mixed release snapshots only delivered work and carries unfinished tasks repeatedly without completing them or creating activity', async () => {
  const { db, request } = context(),
    current = (await request('/releases/ensure', { method: 'POST' })).data.release;
  const future = (
    await request('/releases', {
      method: 'POST',
      body: { version: 'Next month', planned_date: '2026-11-11', notes: 'Keep this future plan' },
    })
  ).data.id;
  const ready = (
      await request('/tasks', {
        method: 'POST',
        body: { title: 'Delivered change', type: 'Bug Fix' },
      })
    ).data.id,
    pending = (
      await request('/tasks', {
        method: 'POST',
        body: { title: 'Still in QA', type: 'New Feature' },
      })
    ).data.id;
  db.prepare("UPDATE tasks SET development_status='On Production' WHERE id=?").run(ready);
  db.prepare("UPDATE tasks SET development_status='On Stage' WHERE id=?").run(pending);
  const workBefore = db.prepare('SELECT COUNT(*) n FROM activities').get().n;
  const published = await request('/releases/' + current.id, {
    method: 'PATCH',
    body: { task_ids: [ready, pending], publish: true, released_date: '2026-10-14' },
  });
  assert.equal(published.status, 200);
  assert.deepEqual(published.data.released_task_ids, [ready]);
  assert.deepEqual(published.data.deferred_task_ids, [pending]);
  let plans = (await request('/releases')).data.releases,
    locked = plans.find((r) => r.id === current.id),
    next = plans.find((r) => r.id === published.data.next_release_id);
  assert.deepEqual(JSON.parse(locked.task_ids_json), [ready]);
  assert.deepEqual(
    JSON.parse(locked.snapshot_json).map((t) => t.id),
    [ready],
  );
  assert.deepEqual(JSON.parse(locked.deferred_task_ids_json), [pending]);
  assert.equal(new Date(next.planned_date + 'T12:00:00Z').getUTCDay(), 3);
  assert.ok(JSON.parse(next.task_ids_json).includes(pending));
  assert.equal(next.is_auto, 1);
  assert.equal(plans.filter((r) => r.status === 'Planned' && r.is_auto === 1).length, 1);
  assert.equal(plans.find((r) => r.id === future).notes, 'Keep this future plan');
  assert.equal(
    db.prepare('SELECT development_status FROM tasks WHERE id=?').get(pending).development_status,
    'On Stage',
  );
  assert.equal(db.prepare('SELECT COUNT(*) n FROM activities').get().n, workBefore);
  const secondReady = (
    await request('/tasks', { method: 'POST', body: { title: 'Second delivered change' } })
  ).data.id;
  db.prepare("UPDATE tasks SET development_status='Closed' WHERE id=?").run(secondReady);
  const second = await request('/releases/' + next.id, {
    method: 'PATCH',
    body: { task_ids: [secondReady, pending], publish: true, released_date: '2026-10-21' },
  });
  assert.equal(second.status, 200);
  plans = (await request('/releases')).data.releases;
  const third = plans.find((r) => r.id === second.data.next_release_id);
  assert.equal(third.planned_date, '2026-10-28');
  assert.deepEqual(JSON.parse(third.task_ids_json), [pending]);
  assert.equal(plans.find((r) => r.id === future).status, 'Planned');
  assert.equal(
    db.prepare('SELECT development_status FROM tasks WHERE id=?').get(pending).development_status,
    'On Stage',
  );
  assert.equal(
    (
      await request('/releases/' + third.id, {
        method: 'PATCH',
        body: { task_ids: [pending], publish: true, released_date: '2026-10-28' },
      })
    ).status,
    400,
    'Unfinished work alone cannot manufacture a released version',
  );
  db.close();
});

test('Release carryover merges with a manually planned next Wednesday instead of creating a duplicate plan', async () => {
  const { db, request } = context(),
    current = (await request('/releases/ensure', { method: 'POST' })).data.release;
  const manual = (
    await request('/releases', {
      method: 'POST',
      body: { version: 'Our next release', planned_date: '2026-10-21', notes: 'Existing scope' },
    })
  ).data.id;
  const ready = (await request('/tasks', { method: 'POST', body: { title: 'Released' } })).data.id,
    pending = (await request('/tasks', { method: 'POST', body: { title: 'Carry me' } })).data.id,
    existing = (
      await request('/tasks', { method: 'POST', body: { title: 'Already in next plan' } })
    ).data.id;
  db.prepare("UPDATE tasks SET development_status='On Production' WHERE id=?").run(ready);
  await request('/releases/' + manual, { method: 'PATCH', body: { task_ids: [existing] } });
  const result = await request('/releases/' + current.id, {
    method: 'PATCH',
    body: { task_ids: [ready, pending], publish: true, released_date: '2026-10-14' },
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.next_release_id, manual);
  const planned = (await request('/releases')).data.releases.filter((r) => r.status === 'Planned');
  assert.equal(planned.length, 1);
  assert.equal(planned[0].id, manual);
  assert.equal(planned[0].is_auto, 0);
  assert.equal(planned[0].notes, 'Existing scope');
  assert.deepEqual(new Set(JSON.parse(planned[0].task_ids_json)), new Set([existing, pending]));
  assert.equal((await request('/releases/ensure', { method: 'POST' })).data.release.id, manual);
  db.close();
});

test('Release plans reject stale edits and transaction failure rolls back snapshot, new plan and unfinished carryover', async () => {
  const { db, env, request } = context(),
    plan = (await request('/releases/ensure', { method: 'POST' })).data.release;
  const ready = (await request('/tasks', { method: 'POST', body: { title: 'Ready' } })).data.id,
    pending = (await request('/tasks', { method: 'POST', body: { title: 'Not ready' } })).data.id;
  db.prepare("UPDATE tasks SET development_status='On Production' WHERE id=?").run(ready);
  assert.equal(
    (
      await request('/releases/' + plan.id, {
        method: 'PATCH',
        body: { plan_revision: 0, task_ids: [ready, pending], notes: 'Reviewed' },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request('/releases/' + plan.id, {
        method: 'PATCH',
        body: { plan_revision: 0, notes: 'Stale overwrite' },
      })
    ).status,
    409,
  );
  const batch = env.DB.batch;
  env.DB.batch = async (statements) => {
    db.exec('BEGIN');
    try {
      statements[0].execute();
      statements[1].execute();
      throw new Error('Simulated carryover failure');
    } finally {
      db.exec('ROLLBACK');
    }
  };
  const body = {
    plan_revision: 1,
    task_ids: [ready, pending],
    publish: true,
    released_date: '2026-10-14',
  };
  assert.notEqual((await request('/releases/' + plan.id, { method: 'PATCH', body })).status, 200);
  const unchanged = db.prepare('SELECT * FROM releases WHERE id=?').get(plan.id);
  assert.equal(unchanged.status, 'Planned');
  assert.equal(unchanged.plan_revision, 1);
  assert.equal(unchanged.notes, 'Reviewed');
  assert.equal(unchanged.snapshot_json, '[]');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM releases').get().n, 1);
  env.DB.batch = batch;
  const success = await request('/releases/' + plan.id, { method: 'PATCH', body });
  assert.equal(success.status, 200);
  assert.equal((await request('/releases/' + plan.id, { method: 'PATCH', body })).status, 409);
  const next = db.prepare('SELECT * FROM releases WHERE id=?').get(success.data.next_release_id);
  assert.deepEqual(JSON.parse(next.task_ids_json), [pending]);
  db.close();
});

test('Concurrent reservations cannot put one task in two plans and changed delivery status blocks stale release confirmation', async () => {
  const { db, env, request } = context(),
    current = (await request('/releases/ensure', { method: 'POST' })).data.release;
  const a = (
      await request('/releases', {
        method: 'POST',
        body: { version: 'November A', planned_date: '2026-11-04' },
      })
    ).data.id,
    b = (
      await request('/releases', {
        method: 'POST',
        body: { version: 'November B', planned_date: '2026-11-11' },
      })
    ).data.id;
  const tid = (await request('/tasks', { method: 'POST', body: { title: 'Reserve once' } })).data
    .id;
  const attempts = await Promise.all(
    [a, b].map((rid) =>
      request('/releases/' + rid, { method: 'PATCH', body: { task_ids: [tid] } }),
    ),
  );
  assert.deepEqual(attempts.map((x) => x.status).sort(), [200, 409]);
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM releases,json_each(task_ids_json) WHERE value=? AND status='Planned'",
      )
      .get(tid).n,
    1,
  );
  const ready = (await request('/tasks', { method: 'POST', body: { title: 'Readiness changed' } }))
    .data.id;
  db.prepare("UPDATE tasks SET development_status='On Production' WHERE id=?").run(ready);
  const batch = env.DB.batch;
  env.DB.batch = async (statements) => {
    db.prepare("UPDATE tasks SET development_status='On Stage' WHERE id=?").run(ready);
    return batch(statements);
  };
  const result = await request('/releases/' + current.id, {
    method: 'PATCH',
    body: { task_ids: [ready], publish: true, released_date: '2026-10-14' },
  });
  assert.equal(result.status, 409);
  assert.equal(
    db.prepare('SELECT status FROM releases WHERE id=?').get(current.id).status,
    'Planned',
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM releases WHERE status='Released'").get().n, 0);
  db.close();
});

test('Version task picker separates readiness, names future reservations and omits already released tasks', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    sandbox = { document: { addEventListener() {}, querySelectorAll: () => [] }, console };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'let releaseList='),
      sourceIndex(code, 'async function submitRelease('),
    ),
    sandbox,
  );
  vm.runInContext(
    "state.tasks=[{id:'ready',title:'Search fix',type:'Bug Fix',development_status:'On Production',qa_status:'Passed'},{id:'pending',title:'Export feature',type:'New Feature',development_status:'On Stage',qa_status:'Not Tested'},{id:'reserved',title:'Next month feature',type:'New Feature',development_status:'In Development'},{id:'old',title:'Already shipped',development_status:'Closed'}];releaseList=[{id:'current',status:'Planned',task_ids_json:'[\"ready\",\"pending\"]',selected_task_ids:['ready','pending']},{id:'future',version:'November updates',status:'Planned',task_ids_json:'[\"reserved\"]',selected_task_ids:['reserved']},{id:'past',status:'Released',task_ids_json:'[\"old\"]'}]",
    sandbox,
  );
  const html = vm.runInContext('releaseTaskPicker(releaseList[0])', sandbox);
  assert.match(html, /Ready for release/);
  assert.match(html, /Not ready/);
  assert.match(html, /Selected in November updates/);
  assert.match(html, /value="reserved"\s+disabled/);
  assert.match(html, /value="pending" checked/);
  assert.ok(!html.includes('Already shipped'));
});

test('Actual release confirmation reviews delivered and deferred tasks before sending the preserved plan revision', async () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  let posted,
    loaded = 0,
    closed = 0;
  const nodes = {
    '#release-actual': { value: '2026-10-14' },
    '#release-version': { value: 'October release' },
    '#release-planned': { value: '2026-10-14' },
    '#release-notes': { value: 'Reviewed notes' },
    '#modal-content': { classList: { remove() {} }, innerHTML: '' },
    '#modal-shade': { classList: { remove() {} } },
    '#confirm-release': { disabled: false },
    '#release-confirm-error': { textContent: '' },
  };
  const sandbox = {
    document: {
      addEventListener() {},
      querySelector: (id) => nodes[id],
      querySelectorAll: () => [{ value: 'ready' }, { value: 'pending' }],
    },
    console,
    api: async (path, args) => {
      posted = { path, body: JSON.parse(args.body) };
      return { deferred_task_ids: ['pending'] };
    },
    closeModal: () => closed++,
    showToast() {},
  };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const api=')), sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'let releaseList='),
      sourceIndex(
        code,
        "document.addEventListener('click',ev=>{const button=ev.target.closest('[data-edit-user]')",
      ),
    ),
    sandbox,
  );
  sandbox.loadReleases = async () => loaded++;
  vm.runInContext(
    "state.user={email:'engineer@demo.local',role:'member',groups:['Engineering']};state.tasks=[{id:'ready',title:'Finished fix',development_status:'On Production'},{id:'pending',title:'QA pending',development_status:'On Stage'}];releaseList=[{id:'current',status:'Planned',plan_revision:3,planned_date:'2026-10-14'}];selectedRelease='current'",
    sandbox,
  );
  await sandbox.saveRelease(true);
  assert.equal(posted, undefined);
  assert.match(nodes['#modal-content'].innerHTML, /In this release/);
  assert.match(nodes['#modal-content'].innerHTML, /Move to next plan/);
  assert.match(nodes['#modal-content'].innerHTML, /QA pending/);
  await nodes['#confirm-release'].onclick();
  assert.equal(posted.path, '/releases/current');
  assert.deepEqual(posted.body.task_ids, ['ready', 'pending']);
  assert.equal(posted.body.plan_revision, 3);
  assert.equal(posted.body.released_date, '2026-10-14');
  assert.equal(loaded, 1);
  assert.equal(closed, 1);
});

test('Version instructions introduce future plans and carryover only with writer actions for Engineering or Admin', () => {
  const engineer = instructionGuides({ role: 'member', groups: ['Engineering'] }),
    manager = instructionGuides({ role: 'member', groups: ['Management'] }),
    qa = instructionGuides({ role: 'member', groups: ['QA'] });
  const writer = engineer.find((g) => g.surface === 'releases'),
    reader = manager.find((g) => g.surface === 'releases');
  assert.equal(writer.id, 'version-planning-v5');
  assert.ok(writer.steps.some((s) => s.includes('Click + Plan')));
  assert.ok(writer.steps.some((s) => s.includes('selected unfinished tasks move')));
  assert.equal(reader.id, 'version-viewing-v4');
  assert.ok(!reader.steps.some((s) => s.includes('Click + Plan')));
  assert.equal(qa.find((g) => g.surface === 'releases').id, 'version-viewing-v4');
});

test('Owner eligibility follows Work groups for Admin too, while Admin may manage a task assigned to an engineer', async () => {
  const { db, request } = context();
  assert.equal(
    (
      await request('/tasks', {
        method: 'POST',
        body: { title: 'Invalid Admin engineer', assignee: 'admin@demo.local' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/tasks', {
        method: 'POST',
        body: { title: 'Invalid next owner', next_action_owner: 'admin@demo.local' },
      })
    ).status,
    400,
  );
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Engineering work', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  assert.equal(
    (await request('/tasks/' + tid, { method: 'PATCH', body: { assignee: 'admin@demo.local' } }))
      .status,
    400,
  );
  assert.equal(
    (
      await request('/tasks/' + tid, {
        method: 'PATCH',
        body: { next_action_owner: 'admin@demo.local' },
      })
    ).status,
    400,
  );
  let t = (await request('/tasks/' + tid)).data.task;
  assert.equal(
    (
      await request('/tasks/' + tid + '/workflow', {
        method: 'POST',
        body: {
          action: 'review',
          confirm: true,
          expected_revision: t.workflow_revision,
          feasibility: 'Confirmed',
          assignee: 'admin@demo.local',
          estimated_delivery_date: '2099-12-31',
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/workflow', {
        method: 'POST',
        body: {
          action: 'review',
          confirm: true,
          expected_revision: t.workflow_revision,
          feasibility: 'Confirmed',
          assignee: 'engineer@demo.local',
          estimated_delivery_date: '2099-12-31',
        },
      })
    ).status,
    201,
    'Admin retains action permissions, without being an Engineering owner',
  );
  db.prepare("UPDATE users SET groups_json='[]' WHERE email='admin@demo.local'").run();
  t = (await request('/tasks/' + tid)).data.task;
  assert.equal(
    (
      await request('/tasks/' + tid + '/workflow', {
        method: 'POST',
        body: {
          action: 'stage',
          confirm: true,
          expected_revision: t.workflow_revision,
          qa_owner: 'admin@demo.local',
        },
      })
    ).status,
    400,
    'An Admin without QA membership is not a QA owner',
  );
  assert.equal(
    (await request('/tasks/' + tid, { method: 'PATCH', body: { qa_owner: 'admin@demo.local' } }))
      .status,
    400,
  );
  db.prepare(
    'UPDATE users SET groups_json=\'["Engineering","QA"]\' WHERE email=\'admin@demo.local\'',
  ).run();
  assert.equal(
    (
      await request('/tasks/' + tid, {
        method: 'PATCH',
        body: { assignee: 'admin@demo.local', qa_owner: 'admin@demo.local' },
      })
    ).status,
    200,
  );
  assert.equal((await request('/tasks/' + tid)).data.task.assignee, 'admin@demo.local');
  db.close();
});

test('Engineering and QA dropdowns exclude out-of-group Admin and keep historical owners disabled rather than silently replacing them', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    sandbox = {
      state: {
        users: [
          {
            email: 'admin@example.com',
            display_name: 'Admin',
            role: 'admin',
            enabled: 1,
            groups_json: '["QA"]',
          },
          {
            email: 'engineer@example.com',
            display_name: 'Ethan',
            role: 'member',
            enabled: 1,
            groups_json: '["Engineering"]',
          },
          {
            email: 'dual@example.com',
            display_name: 'Dual',
            role: 'admin',
            enabled: 1,
            groups_json: '["Engineering","QA","Management"]',
          },
          {
            email: 'inactive@example.com',
            display_name: 'Inactive',
            role: 'member',
            enabled: 0,
            groups_json: '["Engineering"]',
          },
        ],
      },
      e: (x) => String(x),
      who: (email) => (email === 'admin@example.com' ? 'Admin' : email),
    };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function memberCanWork('),
      sourceIndex(code, 'function linkedEvidencePicker('),
    ),
    sandbox,
  );
  const engineering = sandbox.workflowMemberOptions('Engineering'),
    qa = sandbox.workflowMemberOptions('QA');
  assert.ok(!engineering.includes('admin@example.com'));
  assert.match(engineering, /Ethan/);
  assert.match(engineering, /Dual/);
  assert.ok(!engineering.includes('Inactive'));
  assert.match(qa, /Admin/);
  assert.match(qa, /Dual/);
  assert.ok(!qa.includes('Ethan'));
  assert.match(
    sandbox.workflowMemberOptions('Engineering', 'admin@example.com'),
    /value="admin@example.com" selected disabled>Admin \(Engineering unavailable\)/,
  );
});

test('Legacy CRM default is omitted from task cards and new requests no longer insert an assumed project', async () => {
  const { db, request } = context(),
    created = await request('/tasks', { method: 'POST', body: { title: 'General request' } });
  assert.equal(created.status, 201);
  assert.equal((await request('/tasks/' + created.data.id)).data.task.project, '');
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    sandbox = { document: { addEventListener() {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function boardNextAction('),
      sourceIndex(code, 'const boardFilterFields='),
    ),
    sandbox,
  );
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function boardPhaseBadge('),
      sourceIndex(
        code,
        "document.addEventListener('click',ev=>{const button=ev.target.closest('[data-board-layout]')",
      ),
    ),
    sandbox,
  );
  sandbox.task = {
    id: 'legacy',
    title: 'A legacy task',
    project: 'CRM',
    type: 'Bug Fix',
    category: 'General',
    priority: 'Medium',
    assignee: 'engineer@demo.local',
    development_status: 'In Development',
    qa_status: 'Not Tested',
    workflow: { phase: 'development', owner: 'engineer@demo.local' },
  };
  const html = vm.runInContext('renderEngineeringCards([task],[task])', sandbox);
  assert.ok(!html.includes('CRM'));
  assert.match(html, /Bug Fix/);
  assert.match(html, /Continue development/);
  assert.match(html, /QA: Not Tested/);
  db.close();
});

test('Quick and PM work reuse task records, do not require QA/release, and preserve privacy', async () => {
  const { db, request } = context();
  db.prepare('INSERT INTO users(email,display_name,role,groups_json) VALUES(?,?,?,?)').run(
    'pm@example.com',
    'PM',
    'member',
    '["PM"]',
  );
  assert.ok((await request('/me')).data.statuses.work_groups.includes('PM'));
  const quick = await request('/tasks', {
    method: 'POST',
    body: { title: 'Fix config', work_kind: 'Quick Task', assignee: 'engineer@demo.local' },
  });
  assert.equal(quick.status, 201);
  const tid = quick.data.id;
  let t = (await request('/tasks/' + tid)).data.task;
  assert.equal(t.work_kind, 'Quick Task');
  assert.equal(
    (
      await request('/tasks/' + tid + '/work-status', {
        method: 'POST',
        who: 'pm@example.com',
        body: { confirm: true, status: 'Completed', expected_revision: t.workflow_revision },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/work-status', {
        method: 'POST',
        who: 'engineer@demo.local',
        body: {
          confirm: true,
          status: 'Completed',
          completed_date: '2026-10-12',
          expected_revision: t.workflow_revision,
        },
      })
    ).status,
    200,
  );
  assert.equal((await request('/tasks/' + tid)).data.task.completed_date, '2026-10-12');
  assert.equal(
    (await advance(request, tid, 'stage', { qa_owner: 'admin@demo.local' })).status,
    409,
  );
  const pm = await request('/tasks', {
    who: 'pm@example.com',
    method: 'POST',
    body: {
      title: 'Design report',
      work_kind: 'PM Task',
      assignee: 'pm@example.com',
      work_category: 'Report Design',
    },
  });
  assert.equal(pm.status, 201);
  const engineering = (
    await request('/tasks', { method: 'POST', body: { title: 'Implement report' } })
  ).data.id;
  assert.equal(
    (
      await request('/tasks/' + pm.data.id + '/link-engineering', {
        who: 'pm@example.com',
        method: 'POST',
        body: { engineering_task_id: engineering },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('/tasks/' + pm.data.id)).data.links[0].engineering_task_id,
    engineering,
  );
  const privateId = (
    await request('/office', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { title: 'Private work', work_date: '2026-10-12' },
    })
  ).data.id;
  assert.equal((await request('/office/' + privateId, { who: 'pm@example.com' })).status, 404);
  assert.equal((await request('/office/' + privateId)).status, 404);
  const release = (await request('/releases')).data.releases.find((x) => x.status === 'Planned');
  assert.equal(
    (
      await request('/releases/' + release.id, {
        method: 'PATCH',
        body: { plan_revision: release.plan_revision, task_ids: [tid] },
      })
    ).status,
    400,
  );
  db.close();
});

test('Personal actions exclude Admin-wide queues and Backlog; collaborators need explicit assistance', async () => {
  const { db, request } = context();
  db.prepare('INSERT INTO users(email,display_name,role,groups_json) VALUES(?,?,?,?)').run(
    'engineer2@example.com',
    'Engineer 2',
    'member',
    '["Engineering"]',
  );
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Shared work', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  reviewed(db, tid);
  let t = (await request('/tasks/' + tid)).data.task;
  assert.equal(
    (
      await request('/tasks/' + tid + '/tracking', {
        method: 'PATCH',
        who: 'engineer@demo.local',
        body: {
          primary_owner: 'engineer@demo.local',
          collaborators: ['engineer2@example.com'],
          expected_revision: t.workflow_revision,
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('/summary?date=2026-10-12')).data.next_actions.length,
    0,
    'Admin is waiting for engineering, not assigned',
  );
  assert.equal(
    (await request('/summary?date=2026-10-12', { who: 'engineer2@example.com' })).data
      .collaborator_actions.length,
    0,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/collaborator-work', {
        method: 'POST',
        who: 'engineer@demo.local',
        body: { email: 'engineer2@example.com', description: 'Check API', status: 'Open' },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('/summary?date=2026-10-12', { who: 'engineer2@example.com' })).data
      .collaborator_actions.length,
    1,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/collaborator-work', {
        method: 'POST',
        who: 'engineer2@example.com',
        body: { email: 'engineer2@example.com', description: 'Checked API', status: 'Completed' },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('/summary?date=2026-10-12', { who: 'engineer2@example.com' })).data
      .collaborator_actions.length,
    0,
  );
  await request('/tasks/' + tid + '/tracking', {
    method: 'PATCH',
    body: { planning_status: 'Backlog' },
  });
  assert.equal(
    (await request('/summary?date=2026-10-12', { who: 'engineer@demo.local' })).data.next_actions
      .length,
    0,
  );
  assert.equal(
    (await request('/summary?date=2026-10-12', { who: 'engineer@demo.local' })).data.needs_follow_up
      .length,
    0,
  );
  assert.equal(
    (await advance(request, tid, 'stage', { qa_owner: 'admin@demo.local' })).status,
    409,
  );
  db.close();
});

test('Discussion requests resolve by the requested responder and ordinary work cannot clear them', async () => {
  const { db, request } = context();
  const tid = (await request('/tasks', { method: 'POST', body: { title: 'Question' } })).data.id;
  const c = await request('/tasks/' + tid + '/comments', {
    method: 'POST',
    body: {
      body: '@engineer@demo.local please confirm scope',
      action_owners: ['engineer@demo.local'],
    },
  });
  assert.equal(c.status, 201);
  let queue = (await request('/summary?date=2026-10-12', { who: 'engineer@demo.local' })).data
    .discussion_actions;
  assert.equal(queue.length, 1);
  await request('/tasks/' + tid + '/activity', {
    method: 'POST',
    who: 'engineer@demo.local',
    body: { action_type: 'Other', notes: 'Unrelated investigation' },
  });
  assert.equal(
    (await request('/summary?date=2026-10-12', { who: 'engineer@demo.local' })).data
      .discussion_actions.length,
    1,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/comments', {
        method: 'POST',
        who: 'engineer@demo.local',
        body: {
          body: 'Confirmed. @admin@demo.local can you approve?',
          reply_to: c.data.id,
          action_owners: ['admin@demo.local'],
        },
      })
    ).status,
    201,
  );
  assert.equal(
    (await request('/summary?date=2026-10-12', { who: 'engineer@demo.local' })).data
      .discussion_actions.length,
    0,
  );
  queue = (await request('/summary?date=2026-10-12')).data.discussion_actions;
  assert.equal(queue.length, 1);
  assert.equal(
    (
      await request('/discussion-actions/' + queue[0].id + '/resolve', {
        method: 'POST',
        who: 'engineer@demo.local',
        body: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (await request('/discussion-actions/' + queue[0].id + '/resolve', { method: 'POST', body: {} }))
      .status,
    200,
  );
  assert.equal((await request('/summary?date=2026-10-12')).data.discussion_actions.length, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM comments').get().n, 2);
  db.close();
});

test('Activity corrections retain originals, count once on corrected date and preserve author permission', async () => {
  const { db, request } = context();
  const tid = (await request('/tasks', { method: 'POST', body: { title: 'Activity edit' } })).data
    .id;
  const a = await request('/tasks/' + tid + '/activity', {
    method: 'POST',
    who: 'engineer@demo.local',
    body: {
      action_type: 'Other',
      activity_date: '2026-10-10',
      notes: 'Original notes',
      minutes: 30,
    },
  });
  assert.equal(a.status, 201);
  const edit = {
    activity_id: a.data.id,
    notes: 'Corrected notes',
    activity_date: '2026-10-11',
    minutes: 45,
  };
  db.prepare('INSERT INTO users(email,display_name,role,groups_json) VALUES(?,?,?,?)').run(
    'other@example.com',
    'Other',
    'member',
    '["QA"]',
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/activity-edit', {
        who: 'other@example.com',
        method: 'POST',
        body: edit,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/activity-edit', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: edit,
      })
    ).status,
    200,
  );
  const detail = (await request('/tasks/' + tid)).data.activities.find((x) => x.id === a.data.id);
  assert.equal(detail.original_notes, 'Original notes');
  assert.equal(detail.notes, 'Corrected notes');
  assert.equal(detail.edit_history.length, 1);
  assert.equal(
    (await request('/workload?date=2026-10-10', { who: 'engineer@demo.local' })).data.shared.length,
    0,
  );
  const workload = (await request('/workload?date=2026-10-11', { who: 'engineer@demo.local' })).data
    .shared;
  assert.equal(workload[0].activity_count, 1);
  assert.equal(workload[0].minutes, 45);
  assert.throws(
    () => db.prepare('UPDATE activities SET notes=? WHERE id=?').run('changed', a.data.id),
    /immutable/,
  );
  assert.throws(() => db.prepare('DELETE FROM activity_edits').run(), /immutable/);
  db.close();
});

test('Undo Stage Change restores latest state, preserves activities and excludes mistaken workload', async () => {
  const { db, request } = context();
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Undo handoff', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  reviewed(db, tid);
  const stage = await advance(
    request,
    tid,
    'stage',
    { qa_owner: 'admin@demo.local', activity_date: '2026-10-12', notes: 'Mistaken handoff' },
    'engineer@demo.local',
  );
  assert.equal(stage.status, 201);
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.development_status, 'On Stage');
  const count = d.activities.length;
  assert.equal(
    (
      await request('/tasks/' + tid + '/undo-stage', {
        method: 'POST',
        who: 'boss@demo.local',
        body: { confirm: true, reason: 'Mistake', expected_revision: d.task.workflow_revision },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/undo-stage', {
        method: 'POST',
        who: 'engineer@demo.local',
        body: {
          confirm: true,
          reason: 'Build not ready',
          expected_revision: d.task.workflow_revision,
        },
      })
    ).status,
    200,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.development_status, 'New Request');
  assert.equal(d.activities.length, count + 1);
  assert.ok(d.activities.find((x) => x.id === stage.data.id).excluded);
  assert.ok(d.stage_changes[0].undone);
  assert.equal(
    (await request('/workload?date=2026-10-12', { who: 'engineer@demo.local' })).data.shared.length,
    0,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/undo-stage', {
        method: 'POST',
        who: 'engineer@demo.local',
        body: { confirm: true, reason: 'Again', expected_revision: d.task.workflow_revision },
      })
    ).status,
    409,
  );
  assert.equal(d.qa_rounds[0].is_undone, 1);
  db.close();
});

test('QA rounds keep separate dates, return to Primary Owner and require renewed engineering estimate', async () => {
  const { db, request } = context();
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Date rounds', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  reviewed(db, tid);
  await advance(
    request,
    tid,
    'stage',
    { qa_owner: 'admin@demo.local', activity_date: '2026-10-12' },
    'engineer@demo.local',
  );
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.qa_due_date, '2026-10-19');
  assert.equal(d.task.engineering_completed_date, '2026-10-12');
  assert.equal(d.task.estimated_delivery_date, '2099-12-31');
  assert.equal(
    (
      await request('/tasks/' + tid + '/tracking', {
        method: 'PATCH',
        body: { qa_due_date: '2026-10-21' },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await advance(
        request,
        tid,
        'qa',
        { qa_status: 'Changes Required', notes: 'Fix calculation', activity_date: '2026-10-13' },
        'admin@demo.local',
      )
    ).status,
    201,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.delivery_reset_required, 1);
  assert.equal(d.task.next_action_owner, 'engineer@demo.local');
  assert.equal(d.qa_rounds[0].due_date, '2026-10-21');
  assert.equal(d.qa_rounds[0].completed_date, '2026-10-13');
  assert.equal(
    (await advance(request, tid, 'stage', { qa_owner: 'admin@demo.local' }, 'engineer@demo.local'))
      .status,
    409,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/tracking', {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { estimated_delivery_date: '2099-12-30' },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await advance(
        request,
        tid,
        'stage',
        { qa_owner: 'admin@demo.local', activity_date: '2026-10-25' },
        'engineer@demo.local',
      )
    ).status,
    201,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.qa_due_date, '2026-11-01');
  assert.equal(d.qa_rounds.length, 2);
  assert.equal(d.qa_rounds[1].due_date, '2026-10-21');
  db.close();
});

test('Stale detects actual progress separately from overdue, ignores discussion and future plans', async () => {
  const { db, request } = context();
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Stale task', assignee: 'engineer@demo.local', activity_date: '2026-10-01' },
    })
  ).data.id;
  reviewed(db, tid);
  db.prepare("UPDATE tasks SET created_at='2026-10-01T12:00:00Z' WHERE id=?").run(tid);
  await request('/tasks/' + tid + '/comments', {
    method: 'POST',
    body: { body: 'Just checking in' },
  });
  const t = (await request('/tasks')).data.tasks.find((t) => t.id === tid);
  assert.equal(t.follow_up.status, 'Stale');
  await request('/tasks/' + tid + '/activity', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: {
      action_type: 'Other',
      notes: 'Fixed the issue',
      activity_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }),
    },
  });
  assert.equal((await request('/tasks')).data.tasks.find((t) => t.id === tid).follow_up, null);
  await request('/tasks/' + tid + '/tracking', {
    method: 'PATCH',
    body: { blocked_reason: 'Waiting on vendor', follow_up_date: '2099-12-31' },
  });
  assert.equal(
    (await request('/summary?date=2026-10-12', { who: 'engineer@demo.local' })).data.needs_follow_up
      .length,
    0,
  );
  await request('/tasks/' + tid + '/tracking', {
    method: 'PATCH',
    body: { planning_status: 'Backlog' },
  });
  assert.equal((await request('/tasks')).data.tasks.find((t) => t.id === tid).follow_up, null);
  db.close();
});

test('Recorded work time and roles stay separate without duplicate counts or private access expansion', async () => {
  const { db, request } = context();
  db.prepare('INSERT INTO users(email,display_name,role,groups_json) VALUES(?,?,?,?)').run(
    'pm@example.com',
    'PM',
    'member',
    '["PM"]',
  );
  const pm = (
    await request('/tasks', {
      who: 'pm@example.com',
      method: 'POST',
      body: {
        title: 'Report design',
        work_kind: 'PM Task',
        assignee: 'pm@example.com',
        work_category: 'Report Design',
      },
    })
  ).data.id;
  assert.equal(
    (
      await request('/tasks/' + pm + '/activity', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { action_type: 'Other', notes: 'Wrong role', minutes: 20 },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/tasks/' + pm + '/activity', {
        who: 'pm@example.com',
        method: 'POST',
        body: {
          action_type: 'Other',
          notes: 'Design details',
          minutes: 60,
          work_role: 'PM',
          activity_date: '2026-10-12',
        },
      })
    ).status,
    201,
  );
  const work = (await request('/workload?date=2026-10-12', { who: 'pm@example.com' })).data;
  assert.equal(work.shared[0].work_role, 'PM');
  assert.equal(work.shared[0].category, 'Report Design');
  assert.equal(work.shared[0].minutes, 60);
  assert.equal(work.shared[0].activity_count, 1);
  const office = await request('/office', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: { title: 'Private daily work', work_date: '2026-10-12', minutes: 35 },
  });
  assert.equal(office.status, 201);
  assert.equal((await request('/workload?date=2026-10-12')).data.daily.length, 0);
  assert.equal(
    (await request('/workload?date=2026-10-12', { who: 'boss@demo.local' })).data.daily[0].minutes,
    35,
  );
  assert.equal(
    (
      await request('/office/' + office.data.id, {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { minutes: 45 },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request('/office/' + office.data.id, { who: 'engineer@demo.local' })
    ).data.revisions.some((x) => JSON.parse(x.details).field === 'minutes'),
    true,
  );
  db.close();
});

test('Stage undo transaction does not apply audit exclusions when a concurrent task save wins', async () => {
  const { db, request, env } = context();
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Concurrent undo', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  reviewed(db, tid);
  const stage = await advance(
    request,
    tid,
    'stage',
    { qa_owner: 'admin@demo.local' },
    'engineer@demo.local',
  );
  const before = (await request('/tasks/' + tid)).data;
  const batch = env.DB.batch.bind(env.DB);
  let once = true;
  env.DB.batch = async (statements) => {
    if (once) {
      once = false;
      db.prepare('UPDATE tasks SET workflow_revision=workflow_revision+1 WHERE id=?').run(tid);
    }
    return batch(statements);
  };
  const undo = await request('/tasks/' + tid + '/undo-stage', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: { confirm: true, reason: 'Mistake', expected_revision: before.task.workflow_revision },
  });
  assert.equal(undo.status, 409);
  const after = (await request('/tasks/' + tid)).data;
  assert.equal(after.task.development_status, 'On Stage');
  assert.equal(after.activities.find((x) => x.id === stage.data.id).excluded, 0);
  assert.equal(after.qa_rounds[0].is_undone, 0);
  assert.equal(after.stage_changes[0].undone, 0);
  db.close();
});

test('Attachment changes preserve evidence audit and task activity originals', async () => {
  const { db, request } = context();
  const tid = (await request('/tasks', { method: 'POST', body: { title: 'Attachment history' } }))
    .data.id;
  const activity = (
    await request('/tasks/' + tid + '/activity', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { action_type: 'Other', notes: 'Evidence retained' },
    })
  ).data.id;
  const form = new FormData();
  form.append('task_id', tid);
  form.append('activity_id', activity);
  form.append('file', new File(['test'], 'evidence.txt', { type: 'text/plain' }));
  const file = (
    await request('/attachments', { who: 'engineer@demo.local', method: 'POST', body: form })
  ).data.id;
  assert.equal(
    (
      await request('/attachments/' + file, {
        who: 'engineer@demo.local',
        method: 'DELETE',
        body: { confirm: true },
      })
    ).status,
    200,
  );
  const a = (await request('/tasks/' + tid)).data.activities.find((x) => x.id === activity);
  assert.deepEqual(
    a.attachment_history.map((x) => x.action),
    ['Added', 'Removed'],
  );
  assert.equal(
    db.prepare('SELECT notes FROM activities WHERE id=?').get(activity).notes,
    'Evidence retained',
  );
  db.close();
});

async function pmFixture(request, db) {
  db.prepare('INSERT INTO users(email,display_name,role,groups_json) VALUES(?,?,?,?)').run(
    'pm@example.com',
    'PM',
    'member',
    '["PM"]',
  );
  db.prepare('INSERT INTO users(email,display_name,role,groups_json) VALUES(?,?,?,?)').run(
    'second@example.com',
    'Other engineer',
    'member',
    '["Engineering"]',
  );
  return (
    await request('/tasks', {
      who: 'pm@example.com',
      method: 'POST',
      body: {
        title: 'New report requirement',
        description: 'Explain outstanding balances',
        work_kind: 'PM Task',
        assignee: 'pm@example.com',
        work_category: 'Report Design',
        activity_date: '2026-10-12',
      },
    })
  ).data.id;
}
async function pmAction(request, tid, action, body = {}, who = 'pm@example.com') {
  const t = (await request('/tasks/' + tid, { who })).data.task;
  return request('/tasks/' + tid + '/pm-workflow', {
    who,
    method: 'POST',
    body: {
      action,
      confirm: true,
      expected_revision: t.workflow_revision,
      activity_date: '2026-10-12',
      ...body,
    },
  });
}
test('PM design handoff and clarification continue the same task into the existing Engineering and QA workflow', async () => {
  const { db, request } = context(),
    tid = await pmFixture(request, db);
  assert.equal((await pmAction(request, tid, 'design-ready')).status, 400);
  assert.equal(
    (await pmAction(request, tid, 'save', { solution: 'Balance summary with detailed payments' }))
      .status,
    201,
  );
  assert.equal((await pmAction(request, tid, 'design-ready')).status, 201);
  assert.equal(
    (await pmAction(request, tid, 'handoff', { engineer: 'engineer@demo.local' })).status,
    201,
  );
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.pm_stage, 'Engineer Review');
  assert.equal(d.workflow.owner, 'engineer@demo.local');
  assert.equal(d.workflow.phase, 'review');
  assert.equal(d.task.work_kind, 'Engineering');
  assert.equal(
    (
      await pmAction(
        request,
        tid,
        'request-details',
        { notes: 'Which payments should be included?' },
        'engineer@demo.local',
      )
    ).status,
    201,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.pm_stage, 'Needs Details');
  assert.equal(d.workflow.owner, 'pm@example.com');
  assert.match(d.comments[0].body, /@pm@example.com.*Which payments/);
  assert.equal(
    d.discussion_actions.filter((a) => !a.resolved && a.owner_email === 'pm@example.com').length,
    1,
  );
  assert.equal(
    (
      await pmAction(request, tid, 'save', {
        solution: 'Balance summary. Include settled payments only.',
      })
    ).status,
    201,
  );
  assert.equal(
    (await pmAction(request, tid, 'handoff', { engineer: 'engineer@demo.local' })).status,
    201,
  );
  assert.equal((await pmAction(request, tid, 'accept', {}, 'engineer@demo.local')).status, 201);
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.id, tid);
  assert.equal(d.task.pm_owner, 'pm@example.com');
  assert.equal(d.task.assignee, 'engineer@demo.local');
  assert.equal(d.workflow.phase, 'review');
  assert.equal(d.discussion_actions.filter((a) => !a.resolved).length, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM tasks').get().n, 1);
  assert.equal(
    (
      await advance(
        request,
        tid,
        'review',
        {
          feasibility: 'Confirmed',
          assignee: 'engineer@demo.local',
          estimated_delivery_date: '2099-12-31',
        },
        'engineer@demo.local',
      )
    ).status,
    201,
  );
  const before = (await request('/tasks/' + tid)).data.task;
  assert.equal(
    (
      await pmAction(
        request,
        tid,
        'request-details',
        { notes: 'Please clarify the empty state.' },
        'engineer@demo.local',
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await pmAction(request, tid, 'save', {
        solution: 'Balance summary. Settled payments only. Empty state: no outstanding balances.',
      })
    ).status,
    201,
  );
  assert.equal(
    (await pmAction(request, tid, 'handoff', { engineer: 'engineer@demo.local' })).status,
    201,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.workflow.phase, 'development');
  assert.equal(d.task.development_status, before.development_status);
  assert.equal(d.task.estimated_delivery_date, before.estimated_delivery_date);
  assert.equal(
    (await advance(request, tid, 'stage', { qa_owner: 'admin@demo.local' }, 'engineer@demo.local'))
      .status,
    201,
  );
  assert.equal(
    (
      await advance(
        request,
        tid,
        'qa',
        { qa_status: 'Passed', notes: 'Verified report totals' },
        'admin@demo.local',
      )
    ).status,
    201,
  );
  assert.equal((await advance(request, tid, 'production', {}, 'engineer@demo.local')).status, 201);
  assert.equal(
    (await advance(request, tid, 'close', { notes: 'Obsolete completion' }, 'engineer@demo.local'))
      .status,
    200,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.pm_stage, 'Completed');
  assert.equal(d.task.work_status, 'Completed');
  assert.equal(d.task.development_status, 'Closed');
  assert.ok(d.pm_handoffs.length >= 9);
  assert.equal(d.qa_rounds.length, 1);
  db.close();
});

test('PM handoff enforces owner, explicit engineer membership, current stage and independent read-only team view', async () => {
  const { db, request } = context(),
    tid = await pmFixture(request, db);
  assert.equal(
    (await pmAction(request, tid, 'save', { solution: 'Unauthorized' }, 'second@example.com'))
      .status,
    403,
  );
  assert.equal(
    (await pmAction(request, tid, 'handoff', { engineer: 'engineer@demo.local' })).status,
    409,
  );
  await pmAction(request, tid, 'save', { solution: 'Design ready' });
  await pmAction(request, tid, 'design-ready');
  assert.equal(
    (await pmAction(request, tid, 'handoff', { engineer: 'admin@demo.local' })).status,
    400,
  );
  await pmAction(request, tid, 'handoff', { engineer: 'engineer@demo.local' });
  assert.equal((await pmAction(request, tid, 'accept', {}, 'second@example.com')).status, 403);
  assert.equal(
    (await pmAction(request, tid, 'request-details', { notes: '' }, 'engineer@demo.local')).status,
    400,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/work-status', {
        who: 'pm@example.com',
        method: 'POST',
        body: { confirm: true, status: 'Completed' },
      })
    ).status,
    400,
  );
  const t = (await request('/tasks/' + tid)).data.task;
  assert.equal(
    (
      await request('/tasks/' + tid + '/pm-workflow', {
        who: 'boss@demo.local',
        mode: 'team',
        method: 'POST',
        body: { action: 'accept', confirm: true, expected_revision: t.workflow_revision },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/pm-workflow', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { action: 'accept', confirm: true, expected_revision: t.workflow_revision - 1 },
      })
    ).status,
    409,
  );
  assert.equal(db.prepare('SELECT count(*) n FROM tasks').get().n, 1);
  db.close();
});

test('Concurrent PM handoff does not create orphan mentions, history or duplicate work', async () => {
  const { db, request, env } = context(),
    tid = await pmFixture(request, db);
  await pmAction(request, tid, 'save', { solution: 'Design' });
  await pmAction(request, tid, 'design-ready');
  await pmAction(request, tid, 'handoff', { engineer: 'engineer@demo.local' });
  const before = (await request('/tasks/' + tid)).data,
    batch = env.DB.batch.bind(env.DB);
  let once = true;
  env.DB.batch = async (statements) => {
    if (once) {
      once = false;
      db.prepare('UPDATE tasks SET workflow_revision=workflow_revision+1 WHERE id=?').run(tid);
    }
    return batch(statements);
  };
  assert.equal(
    (
      await pmAction(
        request,
        tid,
        'request-details',
        { notes: 'Race question' },
        'engineer@demo.local',
      )
    ).status,
    409,
  );
  const after = (await request('/tasks/' + tid)).data;
  assert.equal(after.task.pm_stage, 'Engineer Review');
  assert.equal(after.activities.length, before.activities.length);
  assert.equal(after.comments.length, 0);
  assert.equal(after.discussion_actions.length, 0);
  assert.equal(after.pm_handoffs.length, before.pm_handoffs.length);
  db.close();
});

test('PM owner can upload images, edit, archive and restore while shared deletion retains history', async () => {
  const { db, request } = context(),
    tid = await pmFixture(request, db);
  const form = new FormData();
  form.append('task_id', tid);
  form.append('file', new File(['image'], 'design.png', { type: 'image/png' }));
  const upload = await request('/attachments', {
    who: 'pm@example.com',
    method: 'POST',
    body: form,
  });
  assert.equal(upload.status, 201);
  await pmAction(request, tid, 'save', {
    title: 'Updated report design',
    solution: 'Acceptance details',
  });
  assert.equal(
    (
      await request('/tasks/' + tid + '/archive', {
        who: 'second@example.com',
        method: 'POST',
        body: { confirm: true },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/archive', {
        who: 'pm@example.com',
        method: 'POST',
        body: { confirm: true },
      })
    ).status,
    200,
  );
  assert.equal(
    (await pmAction(request, tid, 'save', { title: 'Cannot edit archived' })).status,
    404,
  );
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.archived, 1);
  assert.equal(d.attachments[0].id, upload.data.id);
  assert.equal(
    (await request('/tasks/' + tid + '/restore', { who: 'pm@example.com', method: 'POST' })).status,
    200,
  );
  await request('/tasks/' + tid + '/comments', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: { body: 'Engineer clarification' },
  });
  const removed = await request('/tasks/' + tid, {
    who: 'pm@example.com',
    method: 'DELETE',
    body: { confirm: true },
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.data.action, 'Archived');
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.comments.length, 1);
  assert.equal(d.attachments.length, 1);
  assert.equal(d.task.deleted, 0);
  db.close();
});

test('Editing task work without a Time spent field preserves the latest historical minutes', async () => {
  const { db, request } = context(),
    tid = (await request('/tasks', { method: 'POST', body: { title: 'Preserve task history' } }))
      .data.id;
  const activity = (
    await request('/tasks/' + tid + '/activity', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { action_type: 'Other', notes: 'Original', minutes: 30 },
    })
  ).data.id;
  await request('/tasks/' + tid + '/activity-edit', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: { activity_id: activity, notes: 'Corrected', minutes: 45 },
  });
  assert.equal(
    (
      await request('/tasks/' + tid + '/activity-edit', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { activity_id: activity, notes: 'Notes only' },
      })
    ).status,
    200,
  );
  const d = (await request('/tasks/' + tid)).data.activities.find((a) => a.id === activity);
  assert.equal(d.minutes, 45);
  assert.equal(d.edit_history.length, 2);
  assert.equal(db.prepare('SELECT minutes FROM activities WHERE id=?').get(activity).minutes, 30);
  db.close();
});

test('Workload merges work categories without duplicating activity totals or adding distinct task counts', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function workloadModel('),
      sourceIndex(code, 'async function loadWorkload('),
    ),
    sandbox,
  );
  const m = sandbox.workloadModel({
    shared: [
      {
        email: 'engineer',
        work_kind: 'Engineering',
        work_role: 'Engineering',
        category: 'Development',
        activity_count: 2,
        rework_requests: 0,
        participated_tasks: 1,
      },
      {
        email: 'engineer',
        work_kind: 'Engineering',
        work_role: 'Engineering',
        category: 'Deployment',
        activity_count: 1,
        rework_requests: 0,
        participated_tasks: 1,
      },
      {
        email: 'qa',
        work_kind: 'Engineering',
        work_role: 'QA',
        category: 'QA Testing',
        activity_count: 2,
        rework_requests: 1,
        participated_tasks: 1,
      },
    ],
    daily: [{ email: 'engineer', category: 'Work', activity_count: 1, minutes: 90 }],
  });
  assert.equal(m.activities, 6);
  assert.equal(m.returns, 1);
  assert.equal(m.rows.length, 3);
  assert.equal(m.rows.find((r) => r.label === 'Engineering').activities, 3);
  assert.equal(m.rows.find((r) => r.label === 'Engineering').categories.length, 2);
  assert.equal(m.rows.find((r) => r.label === 'Engineering').participated_tasks, undefined);
});

test('A ready PM design returns to Draft when its saved requirement or solution changes, without losing handoff history', async () => {
  const { db, request } = context(),
    tid = await pmFixture(request, db);
  await pmAction(request, tid, 'save', { solution: 'Initial proposed design' });
  await pmAction(request, tid, 'design-ready');
  assert.equal(
    (
      await pmAction(request, tid, 'save', {
        title: 'Rename the requirement',
        solution: 'Initial proposed design',
      })
    ).status,
    201,
  );
  assert.equal(
    (await request('/tasks/' + tid)).data.task.pm_stage,
    'Design Ready',
    'Renaming or saving identical design text does not revoke readiness',
  );
  await pmAction(request, tid, 'save', { description: 'The requirement changed' });
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.pm_stage, 'Draft');
  assert.equal(d.workflow.owner, 'pm@example.com');
  assert.equal(d.task.pm_solution, 'Initial proposed design');
  assert.ok(
    d.pm_handoffs.some(
      (h) => h.action === 'save' && h.from_stage === 'Design Ready' && h.to_stage === 'Draft',
    ),
  );
  assert.equal(
    (await pmAction(request, tid, 'handoff', { engineer: 'engineer@demo.local' })).status,
    409,
    'A changed draft must be reviewed again before assignment',
  );
  await pmAction(request, tid, 'design-ready');
  await pmAction(request, tid, 'save', { solution: '' });
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.pm_stage, 'Draft');
  assert.equal((await pmAction(request, tid, 'design-ready')).status, 400);
  assert.ok(d.pm_handoffs.some((h) => h.solution === 'Initial proposed design'));
  db.close();
});

test('PM readiness distinguishes a saved design from requested details that still need updating, and preserves read-only views', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    sandbox = {
      canWrite: () => true,
      canManage: () => false,
      canDev: () => false,
      state: { user: { email: 'pm@example.com' } },
      e: (x) => String(x ?? ''),
      ui: (x) => String(x ?? ''),
      badge: (x) => `<span>${x}</span>`,
      avatarHtml: () => '',
      who: (x) => x,
    };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function pmCanEdit('),
      sourceIndex(code, 'function renderPmDetail('),
    ),
    sandbox,
  );
  const d = {
    task: {
      title: 'Require a balance report',
      description: '',
      pm_owner: 'pm@example.com',
      pm_stage: 'Draft',
      planning_status: 'Active',
      pm_solution: '',
      archived: 0,
    },
    workflow: {},
    pm_handoffs: [],
  };
  assert.equal(sandbox.pmDesignReadiness(d).ready, false);
  let html = sandbox.pmWorkflowCard(d, true);
  assert.match(html, /Add design details/);
  assert.match(html, /data-pm-action="design-ready" disabled/);
  assert.ok(!html.includes('data-pm-action="handoff"'));
  d.task.pm_solution = 'Saved proposal';
  html = sandbox.pmWorkflowCard(d, true);
  assert.equal(sandbox.pmDesignReadiness(d).ready, true);
  assert.match(html, /data-pm-action="design-ready" >/);
  assert.ok(!html.includes('data-pm-action="handoff"'));
  d.task.pm_stage = 'Design Ready';
  html = sandbox.pmWorkflowCard(d, true);
  assert.match(html, /Design ready to hand off/);
  assert.match(html, /Choose engineer & hand off/);
  assert.ok(!html.includes('data-pm-action="design-ready"'));
  d.task.pm_stage = 'Needs Details';
  d.pm_handoffs = [
    {
      action: 'request-details',
      solution: 'Saved proposal',
      notes: 'Add pending-payment behavior',
    },
  ];
  assert.equal(sandbox.pmDesignReadiness(d).ready, false);
  html = sandbox.pmWorkflowCard(d, true);
  assert.match(html, /Add requested details/);
  assert.match(html, /data-pm-action="handoff" disabled/);
  d.task.pm_solution += ' Pending payments stay outstanding.';
  assert.equal(sandbox.pmDesignReadiness(d).ready, true);
  html = sandbox.pmWorkflowCard(d, true);
  assert.match(html, /Details updated — ready to resubmit/);
  assert.match(html, /Resubmit Handoff/);
  sandbox.canWrite = () => false;
  sandbox.state.user.email = 'manager@example.com';
  html = sandbox.pmWorkflowCard(d, false);
  assert.ok(
    !html.includes('data-pm-action=') && !html.includes('data-edit-pm'),
    'Read-only viewing never exposes design or handoff controls',
  );
  d.task.archived = 1;
  sandbox.canWrite = () => true;
  sandbox.canManage = () => true;
  html = sandbox.pmWorkflowCard(d, false);
  assert.ok(!html.includes('data-pm-action='), 'Archived PM work cannot advance');
});

test('The updated PM readiness guide is independently unread after acknowledging the previous handoff guide', async () => {
  const { db, request } = context();
  const old = 'pm-handoff-qa-v1';
  db.prepare(
    'INSERT INTO instruction_acknowledgements(email,instruction_id,acknowledged_at) VALUES(?,?,?)',
  ).run('admin@demo.local', old, '2026-10-12T12:00:00Z');
  const me = (await request('/me')).data,
    guide = me.instructions.guides.find((g) => g.id === 'pm-handoff-qa-v4');
  assert.ok(guide);
  assert.ok(!me.instructions.acknowledged.includes(guide.id));
  assert.ok(guide.steps.some((s) => s.includes('Mark design ready')));
  assert.ok(guide.steps.some((s) => s.includes('returns it to Draft')));
  assert.equal(
    (await request('/instructions/ack', { method: 'POST', body: { id: guide.id } })).status,
    200,
  );
  assert.ok((await request('/me')).data.instructions.acknowledged.includes(guide.id));
  assert.ok(
    !(await request('/me', { who: 'engineer@demo.local' })).data.instructions.acknowledged.includes(
      'pm-handoff-engineering-v4',
    ),
  );
  db.close();
});

test('PM handoff becomes an ordinary Engineering task immediately and uses standard review, clarification and work filters', async () => {
  const { db, request } = context(),
    tid = await pmFixture(request, db);
  await pmAction(request, tid, 'save', { solution: 'Initial report design' });
  await pmAction(request, tid, 'design-ready');
  await pmAction(request, tid, 'handoff', { engineer: 'engineer@demo.local' });
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.work_kind, 'Engineering');
  assert.equal(d.workflow.phase, 'review');
  assert.deepEqual(d.workflow.actions, ['review']);
  assert.equal(d.task.pm_owner, 'pm@example.com');
  assert.ok(d.pm_handoffs.length);
  assert.equal(
    (await pmAction(request, tid, 'save', { solution: 'Cannot edit during Engineering' })).status,
    409,
  );
  const date = '2099-12-31';
  assert.equal(
    (
      await advance(
        request,
        tid,
        'review',
        {
          feasibility: 'Needs Clarification',
          assignee: 'engineer@demo.local',
          notes: 'Define pending-payment rules',
        },
        'engineer@demo.local',
      )
    ).status,
    201,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.work_kind, 'PM Task');
  assert.equal(d.task.pm_stage, 'Needs Details');
  assert.equal(d.workflow.owner, 'pm@example.com');
  assert.equal(d.task.feasibility, 'Pending');
  assert.match(d.comments[0].body, /@pm@example.com.*pending-payment/);
  await pmAction(request, tid, 'save', {
    solution: 'Pending payments stay pending until settled.',
  });
  await pmAction(request, tid, 'handoff', { engineer: 'engineer@demo.local' });
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.work_kind, 'Engineering');
  assert.equal(d.task.id, tid);
  assert.equal(d.workflow.phase, 'review');
  assert.equal(
    (
      await advance(
        request,
        tid,
        'review',
        {
          feasibility: 'Confirmed',
          assignee: 'engineer@demo.local',
          estimated_delivery_date: date,
        },
        'engineer@demo.local',
      )
    ).status,
    201,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.pm_stage, 'Implementation');
  assert.equal(d.workflow.phase, 'development');
  const list = (await request('/tasks')).data.tasks;
  assert.equal(list.filter((t) => t.work_kind === 'Engineering').length, 1);
  assert.equal(list.filter((t) => t.work_kind === 'PM Task').length, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM tasks').get().n, 1);
  const work = (await request('/workload?date=2026-10-12', { who: 'pm@example.com' })).data.shared;
  assert.equal(work[0].work_role, 'PM');
  assert.equal(work[0].category, 'Report Design');
  db.close();
});

test('Existing handed-off PM tasks migrate to Engineering without copying records or changing dates, files or history', async () => {
  const { db, request } = context(),
    tid = await pmFixture(request, db);
  await pmAction(request, tid, 'save', { solution: 'Design remains available' });
  await pmAction(request, tid, 'design-ready');
  await pmAction(request, tid, 'handoff', { engineer: 'engineer@demo.local' });
  db.prepare(
    "UPDATE tasks SET work_kind='PM Task',pm_stage='Implementation',development_status='In Development',estimated_delivery_date='2099-12-31' WHERE id=?",
  ).run(tid);
  const before = (await request('/tasks/' + tid)).data;
  db.exec(
    readFileSync(new URL('../migrations/0022_pm_engineering_tasks.sql', import.meta.url), 'utf8'),
  );
  const after = (await request('/tasks/' + tid)).data;
  assert.equal(after.task.work_kind, 'Engineering');
  assert.equal(after.task.id, tid);
  assert.equal(after.task.estimated_delivery_date, before.task.estimated_delivery_date);
  assert.equal(after.task.development_status, before.task.development_status);
  assert.equal(after.task.pm_solution, before.task.pm_solution);
  assert.equal(after.activities.length, before.activities.length);
  assert.equal(after.pm_handoffs.length, before.pm_handoffs.length);
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    body = code.slice(
      sourceIndex(code, 'function renderPmDetail('),
      sourceIndex(code, 'function editPmTask('),
    );
  assert.ok(!body.includes('workflowCard('), 'PM details no longer embed an Engineering workflow');
  assert.match(code, /\$\{t\.pm_owner\s*\?\s*pmSourceDetails\(d,\s*writable\)/);
  db.close();
});

test('Current-stage deadlines replace the Engineering estimate through QA, Production and completion, including undo', async () => {
  const { db, request } = context(),
    tid = (
      await request('/tasks', {
        method: 'POST',
        body: { title: 'Current deadline', assignee: 'engineer@demo.local' },
      })
    ).data.id;
  reviewed(db, tid);
  db.prepare(
    "UPDATE tasks SET estimated_delivery_date='2026-10-12',original_delivery_date='2026-10-12' WHERE id=?",
  ).run(tid);
  assert.equal(
    (
      await advance(request, tid, 'stage', {
        qa_owner: 'admin@demo.local',
        activity_date: '2026-10-12',
      })
    ).status,
    201,
  );
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.current_due_date, '2026-10-19');
  assert.equal(d.task.current_due_label, 'QA due');
  assert.equal(d.task.estimated_delivery_date, '2026-10-12');
  const list = (await request('/tasks')).data.tasks.find((t) => t.id === tid);
  assert.equal(list.current_due_date, '2026-10-19');
  assert.ok(!followUpState({ ...list, last_progress_date: '2026-10-12' }, '2026-10-13')?.overdue);
  assert.ok(followUpState({ ...list, last_progress_date: '2026-10-12' }, '2026-10-20')?.overdue);
  assert.equal(
    (
      await advance(
        request,
        tid,
        'qa',
        {
          qa_status: 'Passed',
          notes: 'Validated the delivered Stage build',
          activity_date: '2026-10-13',
        },
        'admin@demo.local',
      )
    ).status,
    201,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.workflow.phase, 'production');
  assert.equal(d.task.current_due_date, '2026-10-20');
  assert.equal(d.task.current_due_label, 'Production due');
  assert.equal(
    (
      await advance(request, tid, 'production', {
        notes: 'Production verified',
        activity_date: '2026-10-14',
      })
    ).status,
    201,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.production_completed_date, '2026-10-14');
  assert.equal(d.task.current_due_date, '');
  assert.equal(d.task.current_due_label, '');
  assert.equal(d.task.completed_date, '2026-10-14');
  assert.equal(
    (
      await request('/tasks/' + tid + '/undo-stage', {
        method: 'POST',
        who: 'engineer@demo.local',
        body: {
          confirm: true,
          reason: 'Deployment confirmation was premature',
          expected_revision: d.task.workflow_revision,
        },
      })
    ).status,
    200,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.workflow.phase, 'production');
  assert.equal(d.task.production_completed_date, '');
  assert.equal(d.task.current_due_date, '2026-10-20');
  await advance(request, tid, 'production', {
    notes: 'Verified again',
    activity_date: '2026-10-14',
  });
  await advance(request, tid, 'close', {
    notes: 'Completion confirmed',
    completed_date: '2026-10-15',
  });
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.current_due_date, '');
  assert.equal(d.task.follow_up, null);
  assert.equal((await request('/tasks')).data.tasks.find((t) => t.id === tid).follow_up, null);
  assert.equal(d.task.original_delivery_date, '2026-10-12');
  db.close();
});

test('QA return removes the stale deadline and the original workflow sets the new estimate in the same Stage confirmation', async () => {
  const { db, request } = context(),
    tid = (
      await request('/tasks', {
        method: 'POST',
        body: { title: 'QA correction', assignee: 'engineer@demo.local' },
      })
    ).data.id;
  reviewed(db, tid);
  db.prepare(
    "UPDATE tasks SET estimated_delivery_date='2026-10-12',original_delivery_date='2026-10-12' WHERE id=?",
  ).run(tid);
  await advance(request, tid, 'stage', {
    qa_owner: 'admin@demo.local',
    activity_date: '2026-10-12',
  });
  await advance(
    request,
    tid,
    'qa',
    {
      qa_status: 'Changes Required',
      notes: 'Fix the missing validation',
      activity_date: '2026-10-13',
    },
    'admin@demo.local',
  );
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.current_due_date, '');
  assert.equal(d.task.delivery_reset_required, 1);
  assert.ok(!followUpState({ ...d.task, last_progress_date: '2026-10-13' }, '2026-10-14')?.overdue);
  assert.equal(
    (await advance(request, tid, 'progress', { development_status: 'In Development' })).status,
    409,
  );
  assert.equal(
    (
      await advance(request, tid, 'stage', {
        qa_owner: 'admin@demo.local',
        estimated_delivery_date: '2020-10-12',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/tracking', {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { estimated_delivery_date: '2020-10-12' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/tracking', {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { blocked_reason: 'Waiting on validation notes' },
      })
    ).status,
    200,
  );
  assert.equal((await request('/tasks/' + tid)).data.task.delivery_reset_required, 1);
  const estimate = futureDelivery();
  assert.equal(
    (
      await advance(request, tid, 'stage', {
        qa_owner: 'admin@demo.local',
        estimated_delivery_date: estimate,
        activity_date: '2026-10-14',
      })
    ).status,
    201,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.delivery_reset_required, 0);
  assert.equal(d.task.current_due_date, '2026-10-21');
  assert.equal(d.task.original_delivery_date, '2026-10-12');
  assert.equal(d.task.estimated_delivery_date, estimate);
  assert.equal(d.qa_rounds[0].engineering_due, estimate);
  assert.equal(d.qa_rounds.length, 2);
  db.close();
});

test('Stage deadline calculations handle month/year boundaries and preserve unknown historical dates', () => {
  const base = {
    work_kind: 'Engineering',
    planning_status: 'Active',
    feasibility: 'Confirmed',
    development_status: 'On Stage',
    stage_confirmed_at: 'build',
    qa_status: 'Passed',
    qa_passed_stage_at: 'build',
    estimated_delivery_date: '2020-01-01',
  };
  assert.equal(
    currentStageDue({ ...base, qa_completed_date: '2026-12-28' }).current_due_date,
    '2027-01-04',
  );
  assert.equal(currentStageDue(base).current_due_date, '');
  assert.equal(
    currentStageDue({
      ...base,
      development_status: 'On Production',
      production_completed_date: '2028-02-26',
    }).current_due_date,
    '',
  );
  assert.equal(currentStageDue({ ...base, planning_status: 'Backlog' }).current_due_date, '');
});

test('Engineering detail hierarchy uses the original Next Step, exposes prior results and collapses supplemental settings', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    body = code.slice(
      sourceIndex(code, 'function renderDetail('),
      sourceIndex(code, 'function changeTab('),
    );
  const order = [
    'task-description-block',
    'task-evidence',
    '${workflowCard(d,writable)}',
    '${previousStageCard(d)}',
    'task-settings',
    '${trackingOverview(d,writable)}',
  ];
  for (let i = 1; i < order.length; i++)
    assert.ok(body.replace(/\s+/g, '').indexOf(order[i].replace(/\s+/g, '')) > body.replace(/\s+/g, '').indexOf(order[i - 1].replace(/\s+/g, '')), order[i]);
  assert.match(body, /<details class="task-secondary task-settings">/);
  assert.ok(!body.includes('latest-feedback'));
  assert.ok(body.includes('task-manage'));
  const sandbox = { document: { addEventListener() {}, querySelectorAll: () => [] }, console };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  sandbox.canUndoPreviousStage = () => false;
  sandbox.attachmentTiles = (files) => files.map((f) => f.filename).join(' ');
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function previousStageSnapshot('),
      sourceIndex(code, 'function renderDetail('),
    ),
    sandbox,
  );
  const d = {
    task: { qa_status: 'Passed' },
    workflow: { phase: 'production' },
    stage_changes: [],
    activities: [
      {
        id: 'undone',
        result: 'Failed',
        action_type: 'QA Testing',
        excluded: 1,
        acknowledges_comments: 1,
      },
      {
        id: 'real',
        result: 'Passed',
        notes: 'Verified the report totals',
        action_type: 'QA Testing',
        acknowledges_comments: 1,
        activity_date: '2026-10-13',
        actor_email: 'qa@example.com',
      },
    ],
    attachments: [
      { activity_id: 'real', filename: 'QA evidence.png' },
      { activity_id: 'undone', filename: 'Old evidence.png' },
    ],
  };
  const html = sandbox.previousStageCard(d);
  assert.match(html, /PREVIOUS STAGE.*QA/);
  assert.match(html, /Verified the report totals/);
  assert.match(html, /QA evidence.png/);
  assert.ok(!html.includes('Old evidence.png'));
  const guides = instructionGuides({ role: 'member', groups: ['Engineering'] });
  assert.ok(guides.find((g) => g.surface === 'engineering-task').id.endsWith('-v12'));
  assert.ok(
    guides
      .find((g) => g.surface === 'engineering-task')
      .steps.some((x) => x.includes('new Engineering estimated')),
  );
});

test('PM-origin review consolidates both non-confirmed choices into the PM return, while direct Engineering retains feasibility review', async () => {
  for (const choice of ['Needs Clarification', 'Cannot Complete']) {
    const { db, request } = context(),
      tid = await pmFixture(request, db);
    await pmAction(request, tid, 'save', { solution: 'Initial balance report design' });
    await pmAction(request, tid, 'design-ready');
    await pmAction(request, tid, 'handoff', { engineer: 'engineer@demo.local' });
    assert.equal(
      (
        await advance(request, tid, 'review', {
          feasibility: choice,
          assignee: 'engineer@demo.local',
          notes: '',
        })
      ).status,
      400,
    );
    assert.equal((await request('/tasks/' + tid)).data.task.work_kind, 'Engineering');
    assert.equal(
      (
        await advance(request, tid, 'review', {
          feasibility: choice,
          assignee: 'engineer@demo.local',
          notes: 'Define how refund status affects the balance',
        })
      ).status,
      201,
    );
    let d = (await request('/tasks/' + tid)).data;
    assert.equal(d.task.work_kind, 'PM Task');
    assert.equal(d.task.pm_stage, 'Needs Details');
    assert.equal(d.workflow.owner, 'pm@example.com');
    assert.equal(d.task.id, tid);
    assert.equal(d.discussion_actions.length, 1);
    assert.match(d.comments[0].body, /@pm@example.com/);
    if (choice === 'Cannot Complete') assert.match(d.pm_handoffs[0].notes, /Cannot Complete:/);
    await pmAction(request, tid, 'save', {
      solution: 'Revised refund rules and clear acceptance criteria',
    });
    await pmAction(request, tid, 'handoff', { engineer: 'engineer@demo.local' });
    d = (await request('/tasks/' + tid)).data;
    assert.equal(d.workflow.phase, 'review');
    assert.equal(d.task.work_kind, 'Engineering');
    assert.equal(
      (
        await advance(request, tid, 'review', {
          feasibility: 'Confirmed',
          assignee: 'engineer@demo.local',
          estimated_delivery_date: futureDelivery(),
          notes: 'Ready to implement',
        })
      ).status,
      201,
    );
    d = (await request('/tasks/' + tid)).data;
    assert.equal(d.workflow.phase, 'development');
    assert.equal(db.prepare('SELECT count(*) n FROM tasks').get().n, 1);
    db.close();
  }
  const { db, request } = context(),
    tid = (await request('/tasks', { method: 'POST', body: { title: 'Direct engineering scope' } }))
      .data.id;
  assert.equal(
    (
      await advance(request, tid, 'review', {
        feasibility: 'Cannot Complete',
        assignee: 'engineer@demo.local',
        notes: 'External API does not support this operation',
      })
    ).status,
    201,
  );
  const d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.work_kind, 'Engineering');
  assert.equal(d.task.feasibility, 'Cannot Complete');
  assert.equal(d.task.development_status, 'On Hold');
  assert.equal(d.comments.length, 0);
  db.close();
});

test('New-task group defaults remain overridable and Engineering may request PM work only with an explicit PM owner', async () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function defaultNewWorkKind('),
      sourceIndex(code, 'function modal('),
    ),
    sandbox,
  );
  for (const [groups, kind] of [
    [['Engineering'], 'Engineering'],
    [['PM'], 'PM Task'],
    [['PM', 'Engineering'], 'Engineering'],
    [['QA'], 'Engineering'],
    [[], 'Engineering'],
  ])
    assert.equal(sandbox.defaultNewWorkKind({ groups }), kind);
  assert.ok(code.includes('defaultNewWorkKind(state.user)'));
  assert.match(code, /if\s*\(\s*kind\s*===\s*['\"]task['\"]\s*\)\s*\{\s*syncNewWorkKind\(\);/);
  const { db, request } = context();
  db.prepare('INSERT INTO users(email,display_name,role,groups_json) VALUES(?,?,?,?)').run(
    'pm@example.com',
    'PM',
    'member',
    JSON.stringify(['PM']),
  );
  const manual = await request('/tasks', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: {
      title: 'PM research request',
      work_kind: 'PM Task',
      assignee: 'pm@example.com',
      work_category: 'Requirement Research',
    },
  });
  assert.equal(manual.status, 201);
  assert.equal((await request('/tasks/' + manual.data.id)).data.task.work_kind, 'PM Task');
  assert.equal(
    (
      await request('/tasks', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: {
          title: 'Cannot assign PM ownership to an engineer',
          work_kind: 'PM Task',
          assignee: 'engineer@demo.local',
          work_category: 'Requirement Research',
        },
      })
    ).status,
    400,
  );
  const direct = await request('/tasks', {
    who: 'pm@example.com',
    method: 'POST',
    body: {
      title: 'Manual Engineering choice',
      work_kind: 'Engineering',
      assignee: 'engineer@demo.local',
    },
  });
  assert.equal(direct.status, 201);
  assert.equal((await request('/tasks/' + direct.data.id)).data.task.work_kind, 'Engineering');
  db.close();
});

test('Reference-only extra work cannot advance Engineering, QA or the current environment', async () => {
  const { db, request } = context(),
    tid = (
      await request('/tasks', {
        method: 'POST',
        body: { title: 'Extra work stays a reference', assignee: 'engineer@demo.local' },
      })
    ).data.id;
  reviewed(db, tid);
  const before = (await request('/tasks/' + tid)).data;
  const r = await request('/tasks/' + tid + '/activity', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: {
      action_type: 'Development',
      advance_workflow: false,
      result: 'On Stage',
      notes: 'Investigated the stage build',
      environment: 'Production',
      environment_override: true,
      activity_date: '2026-10-13',
    },
  });
  assert.equal(r.status, 201);
  const after = (await request('/tasks/' + tid)).data;
  for (const key of [
    'development_status',
    'qa_status',
    'stage_confirmed_at',
    'qa_due_date',
    'current_environment',
    'workflow_revision',
  ])
    assert.equal(after.task[key], before.task[key], key);
  assert.equal(after.qa_rounds.length, 0);
  assert.equal(after.stage_changes.length, before.stage_changes.length);
  assert.equal(after.activities[0].id, r.data.id);
  assert.equal(after.activities[0].environment, 'Production');
  assert.equal(
    (
      await request('/tasks/' + tid + '/activity', {
        method: 'POST',
        body: {
          action_type: 'QA Testing',
          advance_workflow: false,
          result: 'Passed',
          notes: 'Use the current Next Step',
        },
      })
    ).status,
    409,
  );
  db.close();
});

test('Supplemental settings lock previous stage deadlines and completed planning without changing recorded results', async () => {
  const { db, request } = context(),
    tid = (
      await request('/tasks', {
        method: 'POST',
        body: { title: 'Active settings only', assignee: 'engineer@demo.local' },
      })
    ).data.id;
  reviewed(db, tid);
  await advance(request, tid, 'stage', { qa_owner: 'admin@demo.local' });
  const before = (await request('/tasks/' + tid)).data;
  assert.equal(
    (
      await request('/tasks/' + tid + '/tracking', {
        method: 'PATCH',
        body: { estimated_delivery_date: '2098-12-31' },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/tracking', {
        method: 'PATCH',
        body: { qa_due_date: '2099-11-30' },
      })
    ).status,
    200,
  );
  await advance(
    request,
    tid,
    'qa',
    { qa_status: 'Passed', notes: 'The current build passed' },
    'admin@demo.local',
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/tracking', {
        method: 'PATCH',
        body: { qa_due_date: '2099-12-01' },
      })
    ).status,
    409,
  );
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.qa_due_date, '2099-11-30');
  assert.equal(d.qa_rounds[0].due_date, '2099-11-30');
  assert.equal(d.task.estimated_delivery_date, before.task.estimated_delivery_date);
  await advance(request, tid, 'production', { notes: 'Production verified' });
  await advance(request, tid, 'close', { notes: 'Completion check done' });
  assert.equal(
    (
      await request('/tasks/' + tid + '/tracking', {
        method: 'PATCH',
        body: { planning_status: 'Active' },
      })
    ).status,
    409,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.planning_status, 'Completed');
  assert.equal(d.task.development_status, 'Closed');
  assert.equal(d.task.qa_status, 'Passed');
  db.close();
});

test('Task requests and bug reports count once for the creator on their recorded day, with metadata edits excluded', async () => {
  const { db, request } = context(),
    date = '2026-10-13';
  const requestId = (
    await request('/tasks', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: {
        title: 'New export requirement',
        type: 'New Feature',
        assignee: 'engineer@demo.local',
        activity_date: date,
      },
    })
  ).data.id;
  const bugId = (
    await request('/tasks', {
      method: 'POST',
      body: {
        title: 'Report balance mismatch',
        type: 'Bug Fix',
        assignee: 'engineer@demo.local',
        description: 'Opening the balance report shows a mismatch.',
        activity_date: date,
      },
    })
  ).data.id;
  let own = (await request('/summary?date=' + date)).data;
  assert.equal(own.today_activity.length, 1);
  assert.equal(own.today_activity[0].task_id, bugId);
  assert.equal(own.daily[0].count, 1);
  const engineer = (await request('/summary?date=' + date, { who: 'engineer@demo.local' })).data;
  assert.equal(engineer.today_activity.length, 1);
  assert.equal(engineer.today_activity[0].task_id, requestId);
  const manager = (await request('/summary?date=' + date, { who: 'boss@demo.local' })).data;
  assert.equal(manager.today_activity.length, 2);
  assert.equal((await request('/engineering-daily?date=' + date)).data.activities.length, 2);
  assert.equal((await request('/summary?date=2026-10-12')).data.today_activity.length, 0);
  await request('/tasks/' + bugId, {
    method: 'PATCH',
    body: { title: 'Report rounded balance mismatch', activity_date: date },
  });
  own = (await request('/summary?date=' + date)).data;
  assert.equal(own.today_activity.length, 1);
  assert.equal(own.daily[0].count, 1);
  assert.equal(
    (await request('/tasks/' + bugId)).data.activities.filter((a) => a.is_work).length,
    1,
  );
  const form = new FormData();
  form.append('task_id', bugId);
  form.append('file', new File(['report steps'], 'bug-report.txt', { type: 'text/plain' }));
  const file = (await request('/attachments', { method: 'POST', body: form })).data.id;
  assert.ok((await request('/daily?date=' + date)).data.attachments.some((a) => a.id === file));
  assert.equal(
    (await request('/workload?date=' + date)).data.shared.reduce((n, r) => n + r.activity_count, 0),
    1,
  );
  assert.equal((await request('/tasks/' + bugId)).data.workflow.phase, 'review');
  db.close();
});

test('Existing initial submissions become visible without rewriting immutable records or promoting settings edits', async () => {
  const { db, request } = context(),
    tid = '33333333-3333-4333-8333-333333333333',
    aid = '44444444-4444-4444-8444-444444444444';
  db.prepare('INSERT INTO tasks(id,title,type,created_by) VALUES(?,?,?,?)').run(
    tid,
    'Legacy bug report',
    'Bug Fix',
    'admin@demo.local',
  );
  db.prepare(
    'INSERT INTO activities(id,task_id,actor_email,action_type,activity_date,result,notes,is_work) VALUES(?,?,?,?,?,?,?,?)',
  ).run(
    aid,
    tid,
    'admin@demo.local',
    'Requirement',
    '2026-10-13',
    'New request submitted',
    'Report reproduced',
    0,
  );
  db.prepare(
    'INSERT INTO activities(id,task_id,actor_email,action_type,activity_date,result,notes,is_work) VALUES(?,?,?,?,?,?,?,?)',
  ).run(
    '55555555-5555-4555-8555-555555555555',
    tid,
    'admin@demo.local',
    'Status Change',
    '2026-10-13',
    'Task updated',
    'Priority updated',
    0,
  );
  const old = readFileSync(
      new URL('../migrations/0020_work_tracking.sql', import.meta.url),
      'utf8',
    ),
    start = old.indexOf('CREATE VIEW effective_work_activities'),
    end = old.indexOf('CREATE TABLE attachment_change_history', start);
  db.exec('DROP VIEW effective_work_activities;' + old.slice(start, end));
  assert.equal((await request('/summary?date=2026-10-13')).data.today_activity.length, 0);
  const original = JSON.stringify(
    db.prepare('SELECT * FROM activities WHERE task_id=? ORDER BY rowid').all(tid),
  );
  db.exec(readFileSync(new URL('../migrations/0024_creation_work.sql', import.meta.url), 'utf8'));
  const summary = (await request('/summary?date=2026-10-13')).data;
  assert.equal(summary.today_activity.length, 1);
  assert.ok(summary.today_activity[0].activity_id);
  assert.equal(summary.daily[0].count, 1);
  const detail = (await request('/tasks/' + tid)).data;
  assert.equal(detail.activities.filter((a) => a.is_work).length, 1);
  assert.equal(detail.activities.find((a) => a.id === aid).is_work, 1);
  assert.equal(
    JSON.stringify(db.prepare('SELECT * FROM activities WHERE task_id=? ORDER BY rowid').all(tid)),
    original,
  );
  assert.throws(
    () => db.prepare('UPDATE activities SET is_work=1 WHERE id=?').run(aid),
    /immutable/,
  );
  assert.equal(
    (await request('/summary?date=2026-10-13', { who: 'engineer@demo.local' })).data.today_activity
      .length,
    0,
  );
  db.close();
});

test('Closed panels and rendered defaults cannot trigger the task discard guard, while actual open-task edits remain protected', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    nodes = {
      '#activity-notes': { value: '' },
      '#activity-result': { value: '' },
      '#comment-body': { value: '' },
    },
    fields = [{ value: '2026-10-13', dataset: { start: '2026-10-12' }, disabled: false }],
    metadata = [{ value: '', dataset: { key: 'parent_task_id', start: '' }, disabled: false }];
  const sandbox = {
    console,
    pendingActivityFiles: [],
    pendingCommentFiles: [],
    pendingPrivateActivityFiles: [],
    document: {
      addEventListener() {},
      querySelector: (key) => nodes[key] || null,
      querySelectorAll: (selector) =>
        selector === '#detail-content [data-workflow-field]'
          ? fields
          : selector === '#detail-content .task-field'
            ? metadata
            : [],
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function captureTaskDraftBaseline('),
      sourceIndex(code, 'function askDiscardTask('),
    ),
    sandbox,
  );
  vm.runInContext('state.detail=null;state.privateDetail=null;state.trackingDirty=true', sandbox);
  assert.equal(sandbox.hasDirtyTask(), false, 'A closed panel may have stale form values');
  vm.runInContext(
    "state.detail='old-task';state.trackingDirty=false;state.detailData={task:{parent_task_id:'archived-parent'}}",
    sandbox,
  );
  assert.equal(sandbox.hasDirtyTask(), true, 'An open workflow edit needs confirmation');
  fields[0].value = fields[0].dataset.start;
  assert.equal(sandbox.hasDirtyTask(), false, 'An automatic display fallback is not an edit');
  metadata[0].value = 'new-parent';
  assert.equal(sandbox.hasDirtyTask(), true);
  metadata[0].disabled = true;
  fields[0].disabled = true;
  fields[0].value = '2026-10-20';
  assert.equal(sandbox.hasDirtyTask(), false);
  metadata[0].disabled = false;
  metadata[0].value = '';
  nodes['#activity-notes'].value = 'Unsaved investigation';
  assert.equal(sandbox.hasDirtyTask(), true);
  vm.runInContext('state.detail=null', sandbox);
  assert.equal(
    sandbox.hasDirtyTask(),
    false,
    'Opening a successfully created task must not inspect the closed task',
  );
});

test('Stage colors follow real QA return, retest, delivery and completion without letting old QA feedback win', async () => {
  const { db, request } = context(),
    code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function taskStageTone('),
      sourceIndex(code, 'const activeTaskDue='),
    ),
    sandbox,
  );
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Stage color progression', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  const tone = async () => {
    const d = (await request('/tasks/' + tid)).data;
    return sandbox.taskStageTone(d.task, d.workflow);
  };
  assert.equal(await tone(), 'waiting');
  reviewed(db, tid);
  assert.equal(await tone(), 'development');
  assert.equal(
    (
      await advance(
        request,
        tid,
        'progress',
        { development_status: 'PR Submitted', notes: 'PR is ready' },
        'engineer@demo.local',
      )
    ).status,
    201,
  );
  assert.equal(await tone(), 'pr');
  await advance(
    request,
    tid,
    'pr-review',
    { pr_reviewer: 'engineer@demo.local' },
    'engineer@demo.local',
  );
  await advance(request, tid, 'stage', { qa_owner: 'admin@demo.local' }, 'engineer@demo.local');
  assert.equal(await tone(), 'qa');
  await advance(
    request,
    tid,
    'qa',
    { qa_status: 'Changes Required', notes: 'Fix the totals' },
    'admin@demo.local',
  );
  assert.equal(await tone(), 'changes');
  await advance(
    request,
    tid,
    'stage',
    { qa_owner: 'admin@demo.local', estimated_delivery_date: '2099-12-31' },
    'engineer@demo.local',
  );
  assert.equal(await tone(), 'qa');
  await advance(
    request,
    tid,
    'qa',
    { qa_status: 'Passed', notes: 'Retest passed' },
    'admin@demo.local',
  );
  assert.equal(await tone(), 'production');
  await advance(
    request,
    tid,
    'production',
    { notes: 'Production verified' },
    'engineer@demo.local',
  );
  assert.equal(await tone(), 'completed');
  await advance(request, tid, 'close', { notes: 'Finished verification' }, 'engineer@demo.local');
  assert.equal(await tone(), 'completed');
  assert.equal(
    sandbox.taskStageTone({ archived: 1, development_status: 'Closed' }, { phase: 'archived' }),
    'waiting',
  );
  db.close();
});

test('Engineering can discuss failed QA with linked replies and evidence while the recorded result and workflow remain unchanged', async () => {
  const { db, request } = context(),
    tid = (
      await request('/tasks', {
        method: 'POST',
        body: { title: 'Discuss QA feedback', assignee: 'engineer@demo.local' },
      })
    ).data.id;
  reviewed(db, tid);
  await advance(request, tid, 'stage', { qa_owner: 'admin@demo.local' });
  await advance(
    request,
    tid,
    'qa',
    { qa_status: 'Partially Passed', notes: 'The restriction must apply to each issued reward.' },
    'admin@demo.local',
  );
  const before = (await request('/tasks/' + tid)).data,
    qa = before.activities.find((a) => a.action_type === 'QA Testing'),
    original = db.prepare('SELECT * FROM activities WHERE id=?').get(qa.id);
  const r = await request('/tasks/' + tid + '/comments', {
    who: 'engineer@demo.local',
    method: 'POST',
    body: {
      body: 'Does the restriction also apply to previously issued rewards?',
      reply_to_activity: qa.id,
      action_owners: ['admin@demo.local'],
    },
  });
  assert.equal(r.status, 201);
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.comments[0].reply_to_activity, qa.id);
  assert.equal(d.comments[0].reply_to, null);
  for (const key of [
    'development_status',
    'qa_status',
    'workflow_revision',
    'qa_due_date',
    'estimated_delivery_date',
    'stage_confirmed_at',
  ])
    assert.equal(d.task[key], before.task[key], key);
  assert.deepEqual(db.prepare('SELECT * FROM activities WHERE id=?').get(qa.id), original);
  const response = await request('/tasks/' + tid + '/comments', {
    method: 'POST',
    body: {
      body: 'Apply it to new reward issuances; retain the previous history.',
      reply_to: r.data.id,
    },
  });
  assert.equal(response.status, 201);
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.comments[1].reply_to_activity, qa.id);
  assert.equal(d.comments[1].reply_to, r.data.id);
  assert.equal(
    db.prepare('SELECT resolved FROM discussion_actions WHERE comment_id=?').get(r.data.id)
      .resolved,
    1,
  );
  const form = new FormData();
  form.append('task_id', tid);
  form.append('comment_id', r.data.id);
  form.append('file', new File(['evidence'], 'reward-notes.txt', { type: 'text/plain' }));
  assert.equal(
    (await request('/attachments', { who: 'engineer@demo.local', method: 'POST', body: form }))
      .status,
    201,
  );
  assert.equal((await request('/tasks/' + tid)).data.attachments[0].comment_id, r.data.id);
  assert.equal(
    (
      await request('/tasks/' + tid + '/comments', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { body: 'Manager cannot post', reply_to_activity: qa.id },
      })
    ).status,
    403,
  );
  await request('/tasks/' + tid + '/archive', { method: 'POST', body: { confirm: true } });
  assert.equal(
    (
      await request('/tasks/' + tid + '/comments', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { body: 'Archived task', reply_to_activity: qa.id },
      })
    ).status,
    409,
  );
  db.close();
});

test('QA reply links reject other tasks and non-QA activity and cannot switch a thread to different feedback', async () => {
  const { db, request } = context(),
    tid = (await request('/tasks', { method: 'POST', body: { title: 'Valid QA discussion' } })).data
      .id,
    other = (await request('/tasks', { method: 'POST', body: { title: 'Other task' } })).data.id;
  reviewed(db, tid);
  reviewed(db, other);
  for (const id of [tid, other]) {
    await advance(request, id, 'stage', { qa_owner: 'admin@demo.local' });
    await advance(
      request,
      id,
      'qa',
      { qa_status: 'Changes Required', notes: 'Needs a fix' },
      'admin@demo.local',
    );
  }
  const d = (await request('/tasks/' + tid)).data,
    qa = d.activities.find((a) => a.action_type === 'QA Testing'),
    foreign = (await request('/tasks/' + other)).data.activities.find(
      (a) => a.action_type === 'QA Testing',
    ),
    notQa = d.activities.find((a) => a.action_type !== 'QA Testing');
  const before = db.prepare('SELECT count(*) n FROM comments').get().n;
  for (const activity of [foreign.id, notQa.id, '00000000-0000-0000-0000-000000000000'])
    assert.equal(
      (
        await request('/tasks/' + tid + '/comments', {
          who: 'engineer@demo.local',
          method: 'POST',
          body: { body: 'Invalid link', reply_to_activity: activity },
        })
      ).status,
      400,
    );
  assert.equal(db.prepare('SELECT count(*) n FROM comments').get().n, before);
  const root = (
    await request('/tasks/' + tid + '/comments', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { body: 'Valid question', reply_to_activity: qa.id },
    })
  ).data.id;
  assert.equal(
    (
      await request('/tasks/' + tid + '/comments', {
        method: 'POST',
        body: { body: 'Wrong thread', reply_to: root, reply_to_activity: foreign.id },
      })
    ).status,
    400,
  );
  const guide = instructionGuides({
    role: 'member',
    email: 'engineer@demo.local',
    groups: ['Engineering'],
  }).find((g) => g.id === 'qa-feedback-replies-engineering-v1');
  assert.ok(guide);
  assert.ok(guide.steps.some((s) => s.includes('Post reply')));
  assert.equal(
    (
      await request('/instructions/ack', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { id: guide.id },
      })
    ).status,
    200,
  );
  const qaGuides = (await request('/me', { who: 'admin@demo.local' })).data.instructions;
  assert.ok(qaGuides.guides.some((g) => g.id === 'qa-feedback-replies-qa-v1'));
  assert.ok(!qaGuides.acknowledged.includes('qa-feedback-replies-qa-v1'));
  const managerGuide = instructionGuides({
    role: 'member',
    email: 'boss@demo.local',
    groups: ['Management'],
  }).find((g) => g.id === 'qa-feedback-replies-manager-v1');
  assert.ok(managerGuide);
  assert.ok(!managerGuide.steps.some((s) => s.includes('Post reply')));
  db.close();
});

test('PR reviewer and engineer owner share review and deployment; proxy confirmation is audited and QA waits for Stage', async () => {
  const { db, request } = context();
  await request('/users', {
    method: 'POST',
    body: {
      email: 'reviewer@example.com',
      display_name: 'Reviewer',
      role: 'member',
      groups: ['Engineering'],
    },
  });
  const tid = (
    await request('/tasks', {
      who: 'engineer@demo.local',
      method: 'POST',
      body: { title: 'PR reviewer handoff', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  reviewed(db, tid);
  await advance(
    request,
    tid,
    'progress',
    { development_status: 'PR Submitted' },
    'engineer@demo.local',
  );
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.workflow.phase, 'pr_review');
  assert.equal(
    (await advance(request, tid, 'stage', { qa_owner: 'admin@demo.local' }, 'engineer@demo.local'))
      .status,
    409,
  );
  assert.equal(
    (
      await advance(
        request,
        tid,
        'assign-pr-reviewer',
        { pr_reviewer: 'admin@demo.local' },
        'engineer@demo.local',
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await advance(
        request,
        tid,
        'assign-pr-reviewer',
        { pr_reviewer: 'reviewer@example.com' },
        'engineer@demo.local',
      )
    ).status,
    201,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.workflow.owner, 'reviewer@example.com');
  assert.deepEqual(d.workflow.owners, ['reviewer@example.com', 'engineer@demo.local']);
  for (const person of d.workflow.owners)
    assert.ok(
      (await request('/summary?date=2026-10-13', { who: person })).data.next_actions.some(
        (t) => t.id === tid,
      ),
    );
  assert.equal(
    (
      await advance(
        request,
        tid,
        'pr-review',
        { pr_reviewer: 'reviewer@example.com', notes: 'Reviewer reviewed and merged externally.' },
        'engineer@demo.local',
      )
    ).status,
    201,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.workflow.phase, 'stage_deploy');
  assert.equal(d.task.current_due_label, 'Stage deployment due');
  const reviewDue = new Date(d.task.pr_review_completed_date + 'T12:00:00Z');
  reviewDue.setUTCDate(reviewDue.getUTCDate() + 7);
  assert.equal(d.task.current_due_date, reviewDue.toISOString().slice(0, 10));
  assert.equal(d.task.pr_review_confirmed_by, 'engineer@demo.local');
  assert.equal(d.task.pr_reviewer, 'reviewer@example.com');
  assert.ok(d.task.pr_review_merged_at);
  assert.equal(d.task.stage_confirmed_at, '');
  assert.equal(
    (
      await request('/tasks/' + tid + '/undo-stage', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: {
          confirm: true,
          reason: 'Mistaken merge confirmation',
          expected_revision: d.task.workflow_revision,
        },
      })
    ).status,
    200,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.workflow.phase, 'pr_review');
  assert.equal(d.task.pr_review_merged_at, '');
  assert.equal(d.task.pr_reviewer, 'reviewer@example.com');
  await advance(
    request,
    tid,
    'pr-review',
    { pr_reviewer: 'reviewer@example.com' },
    'reviewer@example.com',
  );
  assert.equal(
    (await advance(request, tid, 'stage', { qa_owner: 'admin@demo.local' }, 'reviewer@example.com'))
      .status,
    201,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.workflow.phase, 'qa');
  assert.equal(d.workflow.owner, 'admin@demo.local');
  assert.equal(d.task.pr_review_confirmed_by, 'reviewer@example.com');
  assert.ok(d.task.stage_confirmed_at);
  db.close();
});

test('Unassigned Engineering Backlog stays separate and its creator can assign an owner before activation', async () => {
  const { db, request } = context(),
    tid = (
      await request('/tasks', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { title: 'Backlog idea', planning_status: 'Backlog', assignee: '' },
      })
    ).data.id;
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.assignee, '');
  assert.equal(d.workflow.phase, 'planning');
  assert.ok(
    !(
      await request('/summary?date=2026-10-13', { who: 'engineer@demo.local' })
    ).data.next_actions.some((t) => t.id === tid),
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/tracking', {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { planning_status: 'Backlog', primary_owner: '' },
      })
    ).status,
    200,
  );
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    sandbox = {
      state: { boardScope: 'active', planningFilter: 'all', filter: '', boardPeople: 'all' },
      e: (x) => String(x),
      ui: (x) => x,
      renderBoardGroup: (items) => items.map((t) => t.title).join('|'),
    };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function renderBoardSections('),
      sourceIndex(code, 'function boardPhaseBadge('),
    ),
    sandbox,
  );
  const html = sandbox.renderBoardSections(
    [
      { title: 'Active work', planning_status: 'Active' },
      { title: 'Backlog idea', planning_status: 'Backlog' },
    ],
    [],
  );
  assert.ok(html.indexOf('Active work') < html.indexOf('<details'));
  assert.match(html, /Backlog/);
  assert.match(html, /Backlog idea/);
  assert.equal(
    (
      await request('/tasks/' + tid + '/tracking', {
        who: 'engineer@demo.local',
        method: 'PATCH',
        body: { planning_status: 'Active', primary_owner: 'engineer@demo.local' },
      })
    ).status,
    200,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.assignee, 'engineer@demo.local');
  assert.equal(d.workflow.owner, 'engineer@demo.local');
  assert.equal(d.workflow.phase, 'review');
  db.close();
});

test('Chinese composition cannot redraw the search or trigger Enter actions before the candidate is committed', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    listeners = {},
    timers = new Map();
  let serial = 0,
    renders = 0;
  const field = {
    id: 'task-search',
    value: '输',
    selectionStart: 1,
    focus() {},
    setSelectionRange() {},
  };
  const sandbox = {
    document: {
      addEventListener: (type, fn) => {
        (listeners[type] ??= []).push(fn);
      },
      querySelector: () => field,
    },
    console,
    setTimeout: (fn) => {
      const id = ++serial;
      timers.set(id, fn);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    render: () => renders++,
    structuredClone,
    FormData,
  };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext('let filterTimer;', sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function handleFilterInput('),
      sourceIndex(
        code,
        "$('#panel-shade').addEventListener",
        sourceIndex(code, 'function handleFilterInput('),
      ),
    ),
    sandbox,
  );
  listeners.compositionstart[0]({ target: field });
  listeners.input[0]({ target: field, isComposing: true });
  for (const fn of timers.values()) fn();
  assert.equal(renders, 0);
  assert.equal(timers.size, 0);
  let stopped = false;
  listeners.keydown.at(-1)({
    target: field,
    key: 'Enter',
    isComposing: true,
    stopImmediatePropagation: () => (stopped = true),
  });
  assert.ok(stopped);
  field.value = '输入中文';
  field.selectionStart = 4;
  listeners.compositionend[0]({ target: field });
  assert.equal(timers.size, 1);
  for (const fn of timers.values()) fn();
  assert.equal(renders, 1);
  assert.equal(vm.runInContext('state.filter', sandbox), '输入中文');
  vm.runInContext('deferredRender=true', sandbox);
  field.id = 'comment-body';
  field.value = '补充中文说明';
  listeners.compositionstart[0]({ target: field });
  listeners.compositionend[0]({ target: field });
  assert.equal(renders, 1);
  assert.equal(field.value, '补充中文说明');
});

test('Read caching deduplicates requests, retains independent copies and is isolated by account and workspace; writes invalidate it', async () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  let calls = 0;
  const sandbox = {
    document: { addEventListener() {}, querySelector: () => ({ value: 'engineer@demo.local' }) },
    console,
    structuredClone,
    FormData,
    fetch: async () => {
      calls++;
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ items: [{ title: 'Original', request: calls }] }),
      };
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext(
    "state.user={email:'engineer@demo.local',role:'member',groups:['Engineering']};",
    sandbox,
  );
  const first = await vm.runInContext(
    "Promise.all([api('/private-work'),api('/private-work')])",
    sandbox,
  );
  assert.equal(calls, 1);
  first[0].items[0].title = 'Changed by UI';
  const cached = await vm.runInContext("api('/private-work')", sandbox);
  assert.equal(cached.items[0].title, 'Original');
  assert.equal(calls, 1);
  vm.runInContext("state.workspaceMode='team';", sandbox);
  await vm.runInContext("api('/private-work')", sandbox);
  assert.equal(calls, 2);
  vm.runInContext("state.user.email='other@example.com';", sandbox);
  await vm.runInContext("api('/private-work')", sandbox);
  assert.equal(calls, 3);
  await vm.runInContext("api('/tasks/test',{method:'POST',body:'{}'})", sandbox);
  await vm.runInContext("api('/private-work')", sandbox);
  assert.equal(calls, 5);
});

test('The authorized guide baseline applies only to existing accounts and frozen guide IDs; updates still need confirmation', async () => {
  const { db, request } = context();
  db.prepare('INSERT INTO instruction_baseline_users(email) VALUES(?)').run('engineer@demo.local');
  const current = (await request('/me', { who: 'engineer@demo.local' })).data.instructions;
  assert.ok(current.acknowledged.includes('engineering-task-engineering-v12'));
  assert.ok(!current.acknowledged.includes('workspace-update-engineering-v1'));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM instruction_acknowledgements').get().n, 0);
  const newUser = (await request('/me')).data.instructions;
  assert.equal(newUser.acknowledged.length, 0);
  const ids = ['workspace-update-engineering-v1', 'pr-review-engineering-v1'];
  assert.equal(
    (
      await request('/instructions/ack', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { ids },
      })
    ).status,
    200,
  );
  assert.equal(db.prepare('SELECT COUNT(*) n FROM instruction_acknowledgements').get().n, 2);
  assert.equal(
    (
      await request('/instructions/ack', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: { ids: ['qa-feedback-replies-engineering-v1', 'team-access-admin-v1'] },
      })
    ).status,
    404,
  );
  assert.equal(db.prepare('SELECT COUNT(*) n FROM instruction_acknowledgements').get().n, 2);
  assert.ok(!(await request('/me')).data.instructions.acknowledged.includes(ids[0]));
  db.close();
});

test('Page instructions consolidate to one brief card and one explicit confirmation without discarding full guides', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    sandbox = { document: { addEventListener() {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  const guides = instructionGuides({ role: 'member', groups: ['Engineering'] });
  vm.runInContext(`state.instructions={guides:${JSON.stringify(guides)},acknowledged:[]}`, sandbox);
  const html = vm.runInContext('instructionFor("engineering-task")', sandbox);
  assert.equal((html.match(/<aside /g) || []).length, 1);
  assert.equal((html.match(/I understand/g) || []).length, 1);
  assert.equal((html.match(/<li>/g) || []).length, 3);
  assert.match(html, /Read full guide/);
  assert.ok(guides.filter((g) => g.surface === 'engineering-task').length > 1);
});

test('Board focus separates feasibility, development, PR review and Stage deployment and intersects shared owners', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    me = 'owner@example.com';
  const make = (id, phase, owner = me, extra = {}) => ({
    id,
    title: id,
    category: 'Reports',
    development_status: 'In Development',
    qa_status: 'Not Tested',
    assignee: me,
    workflow: { phase, owner, actions: ['progress'], ...extra },
  });
  const tasks = [
    make('request', 'review'),
    make('working', 'development'),
    make('fix', 'development'),
    make('PR', 'pr_review', 'reviewer@example.com', { owners: ['reviewer@example.com', me] }),
    make('deploy', 'stage_deploy', 'reviewer@example.com', {
      owners: ['reviewer@example.com', me],
    }),
    make('test', 'qa', 'qa@example.com'),
    make('production', 'production'),
    make('unassigned', 'review'),
  ];
  tasks.at(-1).assignee = '';
  tasks.at(-1).workflow.owner = '';
  tasks[2].qa_status = 'Changes Required';
  const state = {
      tasks,
      filter: '',
      categoryFilter: 'all',
      devFilter: 'all',
      qaFilter: 'all',
      workKindFilter: 'all',
      planningFilter: 'all',
      boardPhase: 'all',
      boardPeople: 'all',
      user: { email: me },
    },
    sandbox = { state, e: (x) => String(x ?? ''), who: (x) => x };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'const boardFilterFields='),
      sourceIndex(code, 'function renderBoardFilters('),
    ),
    sandbox,
  );
  const ids = () => Array.from(sandbox.filterBoardTasks(tasks), (t) => t.id);
  for (const [phase, expected] of [
    ['review', ['request', 'unassigned']],
    ['engineering', ['working', 'fix']],
    ['pr', ['PR', 'deploy']],
    ['qa', ['test']],
  ]) {
    state.boardPhase = phase;
    assert.deepEqual(ids(), expected);
  }
  state.boardPeople = 'action';
  state.boardPhase = 'pr';
  assert.deepEqual(ids(), ['PR', 'deploy']);
  state.boardPhase = 'qa';
  assert.deepEqual(ids(), []);
  state.boardPeople = 'unassigned';
  state.boardPhase = 'review';
  assert.deepEqual(ids(), ['unassigned']);
  state.boardPeople = 'all';
  state.boardPhase = 'engineering';
  state.qaFilter = 'changes';
  assert.deepEqual(ids(), ['fix']);
  const html = sandbox.renderBoardFocus(tasks);
  assert.equal((html.match(/class="board-tab-count"/g) || []).length, 1);
  assert.match(html, /Development<span class="board-tab-count">1<\/span>/);
  assert.ok(!html.includes('data-board-phase="stage_deploy"'));
  assert.match(html, /PR & Stage/);
  assert.equal((html.match(/data-board-people=/g) || []).length, 3);
  assert.ok(!html.includes('Related to me'));
  assert.match(html, /Feasibility/);
  assert.match(html, /PR & Stage/);
  assert.match(html, /data-board-people="all" class="selected" aria-pressed="true"/);
});

test('Daily Engineering Activity stays collapsed, avoids the initial request and ignores stale responses', async () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    state = { view: 'board', boardActivityOpen: false, day: '2026-10-13', workspaceRevision: 1 },
    root = { innerHTML: '' };
  let calls = 0,
    resolve;
  const sandbox = {
    state,
    $: () => root,
    api: () => {
      calls++;
      return new Promise((r) => (resolve = r));
    },
    e: (x) => x,
    ui: (x) => x,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'async function loadBoardActivity('),
      sourceIndex(code, 'function renderPrivateWork('),
    ),
    sandbox,
  );
  await sandbox.loadBoardActivity();
  assert.equal(calls, 0);
  state.boardActivityOpen = true;
  const pending = sandbox.loadBoardActivity();
  assert.equal(calls, 1);
  resolve({ activities: [] });
  await pending;
  assert.match(root.innerHTML, /No board activity for this date/);
  root.innerHTML = 'kept';
  const stale = sandbox.loadBoardActivity();
  state.workspaceRevision++;
  resolve({ activities: [] });
  await stale;
  assert.equal(root.innerHTML, 'kept');
  state.boardActivityOpen = false;
  await sandbox.loadBoardActivity();
  assert.equal(calls, 2);
  const renderState = {
      tasks: [],
      archivedTasks: [],
      statuses: { categories: [], development: [] },
      filter: '',
      categoryFilter: 'all',
      devFilter: 'all',
      qaFilter: 'all',
      boardPhase: 'all',
      boardPeople: 'all',
      boardActivityOpen: false,
      boardLayout: 'cards',
      boardScope: 'active',
      boardSort: 'priority',
      day: '2026-10-13',
    },
    renderer = {
      state: renderState,
      e: (x) => String(x ?? ''),
      tr: (x) => x,
      ui: (x) => x,
      who: (x) => x,
      categoryPicker: () => '',
      option: () => '',
      workspaceDayLabel: () => '',
      canWrite: () => true,
      heading: () => '',
      renderEngineeringCards: () => '',
    };
  vm.createContext(renderer);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'const boardFilterFields='),
      sourceIndex(code, 'function boardPhaseBadge('),
    ),
    renderer,
  );
  let html = renderer.renderBoard();
  assert.match(html, /<details[^>]*id="board-daily-activity"\s*>/);
  assert.ok(!html.includes('id="board-people"'));
  renderState.boardActivityOpen = true;
  html = renderer.renderBoard();
  assert.match(html, /<details[^>]*id="board-daily-activity" open>/);
});

test('Stage correction previews actual restored values, stays in history and respects read-only and stale state', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    escape = (x) =>
      String(x ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
      ),
    sandbox = {
      state: { user: { email: 'eng@example.com', groups: ['Engineering'] } },
      canDev: () => true,
      canQA: () => false,
      canManage: () => false,
      e: escape,
      tr: (x) => x,
      ui: escape,
      who: (x) => x,
      dateFmt: (x) => x,
      timeFmt: (x) => x,
      option: () => '',
      workflowMemberOptions: () => '',
      collaboratorPicker: () => '',
    };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function undoStageContext('),
      sourceIndex(code, 'function discussionRecipientPicker('),
    ),
    sandbox,
  );
  const before = {
      development_status: 'In Development',
      qa_status: 'Not Tested',
      next_action_owner: 'eng@example.com',
      qa_due_date: '',
      assignee: 'eng@example.com',
    },
    d = {
      task: {
        work_kind: 'Engineering',
        planning_status: 'Active',
        development_status: 'On Stage',
        qa_status: 'Retest Required',
        next_action_owner: 'qa@example.com',
        assignee: 'eng@example.com',
        primary_owner: 'eng@example.com',
        qa_due_date: '2026-10-22',
        workflow_revision: 7,
        collaborators_json: '[]',
      },
      workflow: { phase: 'qa' },
      stage_changes: [
        {
          id: 1,
          to_revision: 7,
          before_json: JSON.stringify(before),
          after_json: JSON.stringify({
            development_status: 'On Stage',
            qa_status: 'Retest Required',
          }),
          recorded_at: '2026-10-15',
        },
      ],
      qa_rounds: [],
      collaborator_work: [],
    };
  const html = sandbox.trackingOverview(d, true),
    history = html.indexOf('<details class="stage-change-history">');
  assert.ok(history > 0);
  assert.ok(!html.slice(0, history).includes('data-undo-stage'));
  assert.match(html.slice(history), /Undo last stage change/);
  assert.match(html, /Changes to restore/);
  assert.match(html, /On Stage/);
  assert.match(html, /In Development/);
  assert.match(html, /2026-10-22/);
  assert.match(html, /does not undo code merges or deployments/);
  assert.equal(sandbox.stageCorrectionControl(d, false), '');
  d.stage_changes[0].to_revision = 6;
  assert.equal(sandbox.undoStagePreview(d), '');
  assert.equal(sandbox.stageCorrectionControl(d, true), '');
  d.stage_changes[0].to_revision = 7;
  d.stage_changes[0].undone = 1;
  assert.equal(sandbox.stageCorrectionControl(d, true), '');
  d.stage_changes[0].undone = 0;
  d.stage_changes[0].activity_id = 'latest';
  d.activities = [
    {
      id: 'latest',
      result: 'On Stage',
      action_type: 'Deployment',
      acknowledges_comments: 1,
      notes: 'Ready to test',
    },
  ];
  d.comments = [];
  d.attachments = [];
  sandbox.canWrite = () => true;
  sandbox.badge = (x) => x;
  sandbox.attachmentTiles = () => '';
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function previousStageSnapshot('),
      sourceIndex(code, 'function renderDetail('),
    ),
    sandbox,
  );
  assert.match(sandbox.previousStageCard(d), /Undo this stage change/);
  assert.ok(
    !sandbox.trackingOverview(d, true).includes('data-undo-stage'),
    'The matching card owns the entry; settings do not duplicate it',
  );
  d.stage_changes[0].activity_id = 'other-update';
  assert.ok(
    !sandbox.previousStageCard(d).includes('data-undo-stage'),
    'An older feedback card must not offer undo for a different update',
  );
  assert.match(sandbox.trackingOverview(d, true), /data-undo-stage/);
});

test('Undo clarification retains explicit confirmation, reason and revision without performing an undo on open', async () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    writes = [];
  let modal,
    toasts = 0;
  const sandbox = {
    e: (x) => String(x ?? ''),
    ui: (x) => String(x ?? ''),
    tr: (x) => x,
    who: (x) => x,
    dateFmt: (x) => x,
    $: () => ({ value: 'Confirmed the wrong stage' }),
    showToast: () => toasts++,
    trackingConfirmation: (title, body, action, options) =>
      (modal = { title, body, action, options }),
    api: async (path, options) => writes.push({ path, body: JSON.parse(options.body) }),
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'function undoStageContext('),
      sourceIndex(code, 'function trackingOverview('),
    ),
    sandbox,
  );
  const d = {
    task: { id: 'task-id', development_status: 'PR Submitted', workflow_revision: 4 },
    stage_changes: [
      { to_revision: 4, before_json: JSON.stringify({ development_status: 'In Development' }) },
    ],
  };
  sandbox.showUndoStageConfirmation(d);
  assert.equal(writes.length, 0);
  assert.equal(modal.title, 'Undo last stage change?');
  assert.equal(modal.options.label, 'Undo this change');
  assert.match(modal.body, /Why was this stage change a mistake/);
  assert.match(modal.body, /Activity history is kept/);
  await modal.action();
  assert.deepEqual(writes, [
    {
      path: '/tasks/task-id/undo-stage',
      body: { confirm: true, reason: 'Confirmed the wrong stage', expected_revision: 4 },
    },
  ]);
  d.task.workflow_revision = 5;
  sandbox.showUndoStageConfirmation(d);
  assert.equal(toasts, 1);
  assert.equal(writes.length, 1);
});

test('Attachment areas focus without opening a picker; only Choose files opens the correct destination', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    handlers = {},
    opened = [];
  let focused = 0,
    choose = false;
  const zone = {
    dataset: { evidenceInput: 'workflow-files' },
    hasAttribute: () => false,
    focus: () => focused++,
  };
  const sandbox = {
    document: { addEventListener: (name, fn) => (handlers[name] = fn) },
    $: (id) => ({ click: () => opened.push(id) }),
  };
  vm.createContext(sandbox);
  const start = sourceIndex(
    code,
    "document.addEventListener('click',ev=>{const zone=ev.target.closest('.paste-target')",
  );
  vm.runInContext(
    code.slice(start, sourceIndex(code, "document.addEventListener('dragover'", start)),
    sandbox,
  );
  const target = {
    closest: (selector) =>
      selector === '.paste-target'
        ? zone
        : selector === '[data-choose-files]'
          ? choose
          : selector === 'button,a,input'
            ? choose
            : null,
  };
  handlers.click({ target });
  assert.equal(focused, 1);
  assert.equal(opened.length, 0);
  choose = true;
  handlers.click({ target });
  assert.deepEqual(opened, ['#workflow-files']);
  assert.equal(focused, 1);
  zone.dataset.evidenceInput = 'comment-file-qa';
  handlers.click({ target });
  assert.equal(opened.at(-1), '#comment-file-qa');
  zone.hasAttribute = () => true;
  handlers.click({ target });
  assert.equal(opened.length, 2);
});

test('Activity labels distinguish work records from stages while preserving original option values', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    sandbox = { e: (x) => String(x) };
  vm.createContext(sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'const activityTypeLabels='),
      sourceIndex(code, 'const inputSelect='),
    ),
    sandbox,
  );
  const keys = ['Requirement', 'Development', 'PR', 'Merge', 'Deployment', 'Feedback', 'Other'];
  const html = sandbox.activityTypeSelect([...keys, 'Development'], 'Development');
  assert.match(html, /Activity type/);
  assert.match(html, /<option value="Development" selected>Development work<\/option>/);
  for (const key of keys)
    assert.equal((html.match(new RegExp('value="' + key + '"', 'g')) || []).length, 1);
  assert.match(
    code,
    /action_type:\s*kind,\s*advance_workflow:\s*false/,
    'Recording an activity must not advance workflow',
  );
  const before = {
    development_status: 'PR Submitted',
    qa_status: 'Need Explanation',
    category: 'Reports',
  };
  sandbox.activityTypeSelect(keys, 'PR');
  assert.deepEqual(before, {
    development_status: 'PR Submitted',
    qa_status: 'Need Explanation',
    category: 'Reports',
  });
});

test('Existing stage, QA and legacy Type values remain compatible after display clarification', async () => {
  const { db, request } = context();
  const me = (await request('/me')).data;
  for (const key of ['development', 'qa', 'types', 'priorities', 'actions', 'categories'])
    assert.equal(
      new Set(me.statuses[key]).size,
      me.statuses[key].length,
      key + ' must not have duplicate options',
    );
  for (const stage of [
    'New Request',
    'Under Review',
    'Approved',
    'In Development',
    'PR Submitted',
    'Merged / Awaiting Stage',
    'On Stage',
    'Approved for Production',
    'Awaiting Production Deploy',
    'On Production',
    'Closed',
    'On Hold',
  ])
    assert.ok(me.statuses.development.includes(stage));
  for (const result of [
    'Not Tested',
    'Retest Required',
    'Passed',
    'Partially Passed',
    'Changes Required',
    'Need Explanation',
    'No Visible Changes',
    'Unable to Test',
  ])
    assert.ok(me.statuses.qa.includes(result));
  for (const type of ['UI/UX', 'Investigation']) {
    const r = await request('/tasks', {
      method: 'POST',
      body: { title: 'Legacy type remains supported', type },
    });
    assert.equal(r.status, 201);
    const d = (await request('/tasks/' + r.data.id)).data;
    assert.equal(d.task.type, type);
    assert.equal(d.task.development_status, 'New Request');
  }
  db.close();
});

test('Category frequency ordering counts non-deleted active, completed and archived tasks without changing names', async () => {
  const { db, request } = context();
  for (const category of ['Reports', 'Reports', 'Reports', 'Billing', 'Billing', 'General'])
    await request('/tasks', { method: 'POST', body: { title: 'Frequency fixture', category } });
  const reportIds = db.prepare("SELECT id FROM tasks WHERE category='Reports'").all();
  db.prepare('UPDATE tasks SET archived=1 WHERE id=?').run(reportIds[0].id);
  db.prepare(
    "UPDATE tasks SET development_status='Closed',planning_status='Completed' WHERE id=?",
  ).run(reportIds[1].id);
  const removed = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Deleted category fixture', category: 'Other' },
    })
  ).data.id;
  db.prepare('UPDATE tasks SET deleted=1 WHERE id=?').run(removed);
  const list = (await request('/categories')).data.categories;
  assert.deepEqual(list.slice(0, 3), ['Reports', 'Billing', 'General']);
  assert.deepEqual(list.slice(3), ['Other', 'Patients', 'Scheduling']);
  assert.deepEqual((await request('/me')).data.statuses.categories, list);
  assert.equal(
    db.prepare('SELECT category FROM tasks WHERE id=?').get(reportIds[0].id).category,
    'Reports',
  );
  db.close();
});

async function qaStageFixture() {
  const c = context();
  const tid = (
    await c.request('/tasks', {
      method: 'POST',
      body: { title: 'Simple QA outcomes', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  assert.equal(
    (
      await advance(c.request, tid, 'review', {
        feasibility: 'Confirmed',
        assignee: 'engineer@demo.local',
        estimated_delivery_date: futureDelivery(),
      })
    ).status,
    201,
  );
  assert.equal(
    (await advance(c.request, tid, 'stage', { qa_owner: 'admin@demo.local' })).status,
    201,
  );
  return { ...c, tid };
}
test('Passed needs no details, while partial and unsuccessful QA require issues and return to Engineering', async () => {
  for (const result of ['Passed', 'Partially Passed', 'Not Passed']) {
    const { db, request, tid } = await qaStageFixture();
    const me = (await request('/me')).data;
    assert.deepEqual(me.statuses.qa_results, ['Passed', 'Partially Passed', 'Not Passed']);
    const blank = await advance(request, tid, 'qa', { qa_status: result }, 'admin@demo.local');
    assert.equal(blank.status, result === 'Passed' ? 201 : 400);
    if (result !== 'Passed')
      assert.equal(
        (
          await advance(
            request,
            tid,
            'qa',
            { qa_status: result, notes: 'The total is incorrect; show the tax breakdown.' },
            'admin@demo.local',
          )
        ).status,
        201,
      );
    const d = (await request('/tasks/' + tid)).data;
    assert.equal(d.task.qa_status, result);
    assert.equal(d.workflow.phase, result === 'Passed' ? 'production' : 'development');
    const activity = d.activities.find((a) => a.action_type === 'QA Testing');
    assert.equal(activity.result, result);
    assert.ok(activity.notes);
    if (result !== 'Passed') {
      assert.equal(d.task.delivery_reset_required, 1);
      assert.equal(d.task.next_action_owner, 'engineer@demo.local');
    }
    assert.equal(d.qa_rounds[0].result, result);
    db.close();
  }
});

test('Discussion before a QA verdict keeps the confirmed Stage, round, due date and task result intact', async () => {
  const { db, request, tid } = await qaStageFixture();
  const before = (await request('/tasks/' + tid)).data;
  const comment = await request('/tasks/' + tid + '/comments', {
    method: 'POST',
    body: { body: 'Which date should this report use?', action_owners: ['engineer@demo.local'] },
  });
  assert.equal(comment.status, 201);
  const after = (await request('/tasks/' + tid)).data;
  for (const key of [
    'development_status',
    'qa_status',
    'stage_confirmed_at',
    'qa_due_date',
    'qa_completed_date',
    'estimated_delivery_date',
    'delivery_reset_required',
    'workflow_revision',
  ])
    assert.equal(after.task[key], before.task[key], key);
  assert.equal(after.workflow.phase, 'qa');
  assert.deepEqual(after.qa_rounds, before.qa_rounds);
  assert.equal(
    after.discussion_actions.filter((a) => !a.resolved && a.owner_email === 'engineer@demo.local')
      .length,
    1,
  );
  db.close();
});

test('Current QA labels migrate once with a record of original values; discussions and immutable history stay intact', async () => {
  const { db, request } = context(),
    migration = readFileSync(
      new URL('../migrations/0028_qa_result_labels.sql', import.meta.url),
      'utf8',
    ),
    ids = [];
  for (const qa of [
    'Changes Required',
    'No Visible Changes',
    'Unable to Test',
    'Need Explanation',
    'Partially Passed',
    'Passed',
    'Not Tested',
    'Retest Required',
  ]) {
    const tid = (await request('/tasks', { method: 'POST', body: { title: 'Existing QA label' } }))
      .data.id;
    db.prepare('UPDATE tasks SET qa_status=? WHERE id=?').run(qa, tid);
    ids.push(tid);
  }
  const deleted = (await request('/tasks', { method: 'POST', body: { title: 'Deleted history' } }))
    .data.id;
  db.prepare("UPDATE tasks SET qa_status='Changes Required',deleted=1 WHERE id=?").run(deleted);
  const before = db.prepare('SELECT * FROM tasks ORDER BY id').all(),
    history = db.prepare('SELECT * FROM activities ORDER BY id').all(),
    stageHistory = db.prepare('SELECT * FROM stage_changes').all(),
    trigger = db
      .prepare("SELECT sql FROM sqlite_master WHERE name='stage_changes_capture'")
      .get().sql;
  db.exec(migration);
  db.exec(migration);
  const after = db.prepare('SELECT * FROM tasks ORDER BY id').all();
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        after.map((t) => ({ ...t, qa_status: before.find((b) => b.id === t.id).qa_status })),
      ),
    ),
    JSON.parse(JSON.stringify(before)),
  );
  assert.deepEqual(db.prepare('SELECT * FROM activities ORDER BY id').all(), history);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM qa_result_label_changes').get().n, 3);
  assert.deepEqual(db.prepare('SELECT * FROM stage_changes').all(), stageHistory);
  assert.equal(
    db.prepare("SELECT sql FROM sqlite_master WHERE name='stage_changes_capture'").get().sql,
    trigger,
  );
  for (let i = 0; i < ids.length; i++)
    assert.equal(
      db.prepare('SELECT qa_status FROM tasks WHERE id=?').get(ids[i]).qa_status,
      i < 3 ? 'Not Passed' : before.find((t) => t.id === ids[i]).qa_status,
    );
  assert.equal(
    db.prepare('SELECT qa_status FROM tasks WHERE id=?').get(deleted).qa_status,
    'Changes Required',
  );
  db.close();
});

test('First-use onboarding is stable across old versions, roles and future reference guides, with per-account acknowledgement', async () => {
  const { db, request } = context();
  db.prepare('INSERT INTO instruction_acknowledgements VALUES(?,?,?)').run(
    'engineer@demo.local',
    'engineering-task-engineering-v1',
    'already-read',
  );
  let me = (await request('/me', { who: 'engineer@demo.local' })).data.instructions;
  assert.ok(me.acknowledged.includes('first-use-engineering-task'));
  assert.ok(me.onboarding.every((g) => g.steps.length <= 3));
  assert.equal(new Set(me.onboarding.map((g) => g.id)).size, me.onboarding.length);
  db.exec("UPDATE users SET groups_json='[\"QA\"]' WHERE email='engineer@demo.local'");
  assert.ok(
    (await request('/me', { who: 'engineer@demo.local' })).data.instructions.acknowledged.includes(
      'first-use-engineering-task',
    ),
  );
  me = (await request('/me')).data.instructions;
  assert.ok(!me.acknowledged.includes('first-use-engineering-task'));
  assert.equal(
    (
      await request('/instructions/ack', {
        method: 'POST',
        body: { id: 'first-use-engineering-task' },
      })
    ).status,
    200,
  );
  const again = (await request('/me')).data.instructions;
  assert.ok(again.acknowledged.includes('first-use-engineering-task'));
  assert.equal(
    db
      .prepare('SELECT COUNT(*) n FROM instruction_acknowledgements WHERE email=?')
      .get('admin@demo.local').n,
    1,
  );
  assert.equal(
    (
      await request('/instructions/ack', {
        who: 'boss@demo.local',
        method: 'POST',
        body: { id: 'first-use-private-task' },
      })
    ).status,
    404,
  );
  db.close();
});

test('Confirmed Production deployment completes once, preserves the owner, joins release candidates and can be corrected with Undo', async () => {
  const { db, request, tid } = await qaStageFixture();
  await advance(request, tid, 'qa', { qa_status: 'Passed' }, 'admin@demo.local');
  const before = (await request('/tasks/' + tid)).data,
    day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  assert.equal(
    (
      await advance(request, tid, 'production', {
        activity_date: day,
        notes: 'Deployed and verified.',
      })
    ).status,
    201,
  );
  let d = (await request('/tasks/' + tid)).data;
  assert.equal(d.task.development_status, 'Closed');
  assert.equal(d.task.planning_status, 'Completed');
  assert.equal(d.task.completed_date, day);
  assert.equal(d.task.production_completed_date, day);
  assert.equal(d.task.current_environment, 'Production');
  assert.equal(d.task.assignee, before.task.assignee);
  assert.deepEqual(d.workflow.actions, []);
  assert.equal(d.task.current_due_date, '');
  assert.equal(d.activities.filter((a) => a.result === 'On Production').length, 1);
  const activityCount = d.activities.length;
  assert.equal((await advance(request, tid, 'close', { notes: 'Old client retry' })).status, 200);
  assert.equal((await request('/tasks/' + tid)).data.activities.length, activityCount);
  assert.ok(
    (await request('/releases')).data.releases.some((r) => r.auto_candidates?.includes(tid)),
  );
  assert.equal(
    (
      await request('/tasks/' + tid + '/undo-stage', {
        who: 'engineer@demo.local',
        method: 'POST',
        body: {
          confirm: true,
          reason: 'Deployment confirmation was premature',
          expected_revision: d.task.workflow_revision,
        },
      })
    ).status,
    200,
  );
  d = (await request('/tasks/' + tid)).data;
  assert.equal(d.workflow.phase, 'production');
  assert.equal(d.task.completed_date, '');
  assert.equal(d.task.planning_status, 'Active');
  db.close();
});

test('Existing On Production tasks complete from recorded dates without a fabricated work entry or changes to history', async () => {
  const { db, request } = context(),
    migration = readFileSync(
      new URL('../migrations/0029_production_completes_task.sql', import.meta.url),
      'utf8',
    );
  const dated = (await request('/tasks', { method: 'POST', body: { title: 'Already delivered' } }))
      .data.id,
    unknown = (await request('/tasks', { method: 'POST', body: { title: 'Unknown old date' } }))
      .data.id,
    waiting = (await request('/tasks', { method: 'POST', body: { title: 'Not delivered' } })).data
      .id;
  db.prepare(
    "UPDATE tasks SET development_status='On Production',production_completed_date='2026-10-13',next_action_owner='engineer@demo.local' WHERE id=?",
  ).run(dated);
  db.prepare("UPDATE tasks SET development_status='On Production' WHERE id=?").run(unknown);
  const logs = db.prepare('SELECT * FROM activities').all(),
    stages = db.prepare('SELECT * FROM stage_changes').all(),
    releases = db.prepare('SELECT * FROM releases').all();
  db.exec(migration);
  db.exec(migration);
  assert.equal(
    db.prepare('SELECT completed_date FROM tasks WHERE id=?').get(dated).completed_date,
    '2026-10-13',
  );
  assert.equal(
    db.prepare('SELECT completed_date FROM tasks WHERE id=?').get(unknown).completed_date,
    '',
  );
  for (const tid of [dated, unknown]) {
    const t = db.prepare('SELECT * FROM tasks WHERE id=?').get(tid);
    assert.equal(t.development_status, 'Closed');
    assert.equal(t.planning_status, 'Completed');
    assert.equal(t.next_action_owner, '');
  }
  assert.equal(
    db.prepare('SELECT development_status FROM tasks WHERE id=?').get(waiting).development_status,
    'New Request',
  );
  assert.equal(db.prepare('SELECT COUNT(*) n FROM production_completion_changes').get().n, 2);
  assert.deepEqual(db.prepare('SELECT * FROM activities').all(), logs);
  assert.deepEqual(db.prepare('SELECT * FROM stage_changes').all(), stages);
  assert.deepEqual(db.prepare('SELECT * FROM releases').all(), releases);
  db.close();
});

test('QA-approved tasks auto-join current release Changes while future reservations, exclusions and Stage validation remain intact', async () => {
  const { db, request, tid } = await qaStageFixture();
  await advance(request, tid, 'qa', { qa_status: 'Passed' }, 'admin@demo.local');
  const me = (await request('/releases')).data.releases,
    current = me.find((r) => r.status === 'Planned');
  assert.ok(current.auto_candidates.includes(tid));
  assert.ok(JSON.parse(current.task_ids_json).includes(tid));
  const future = (
    await request('/releases', {
      method: 'POST',
      body: { version: 'Future reserved QA', planned_date: '2099-11-11' },
    })
  ).data.id;
  assert.equal(
    (await request('/releases/' + future, { method: 'PATCH', body: { task_ids: [tid] } })).status,
    200,
  );
  assert.ok(
    !JSON.parse(
      (await request('/releases')).data.releases.find((r) => r.id === current.id).task_ids_json,
    ).includes(tid),
  );
  await request('/releases/' + future, { method: 'PATCH', body: { task_ids: [] } });
  const refreshed = (await request('/releases')).data.releases.find((r) => r.id === current.id);
  await request('/releases/' + current.id, {
    method: 'PATCH',
    body: { task_ids: [], plan_revision: refreshed.plan_revision },
  });
  assert.ok(
    !JSON.parse(
      (await request('/releases')).data.releases.find((r) => r.id === current.id).task_ids_json,
    ).includes(tid),
  );
  db.prepare("UPDATE releases SET auto_excluded_json='[]' WHERE id=?").run(current.id);
  db.prepare("UPDATE tasks SET qa_passed_stage_at='a different build' WHERE id=?").run(tid);
  assert.ok(
    !(await request('/releases')).data.releases
      .find((r) => r.id === current.id)
      .auto_candidates.includes(tid),
  );
  assert.equal(
    (await request('/tasks/' + tid)).data.task.development_status,
    'Approved for Production',
  );
  db.close();
});

test('Overdue release plans keep the original plan date and default actual release date to the current day', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    root = { querySelectorAll: () => [] },
    nodes = { '#release-results': root };
  const sandbox = {
    document: {
      addEventListener() {},
      querySelector: (id) => nodes[id],
      querySelectorAll: () => [],
    },
    console,
    todayDate: () => '2026-10-15',
  };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'let releaseList='),
      sourceIndex(code, 'async function saveRelease('),
    ),
    sandbox,
  );
  vm.runInContext(
    `state.user={role:'admin',groups:['Engineering']};releaseList=[{id:'overdue',version:'v1',status:'Planned',planned_date:'2026-10-14',task_ids_json:'[]',notes:''}];selectedRelease='overdue';releaseEditorOpen=true;renderReleases();`,
    sandbox,
  );
  assert.match(root.innerHTML, /Overdue/);
  assert.match(root.innerHTML, /id="release-planned"[^>]*value="2026-10-14"/);
  assert.match(root.innerHTML, /id="release-actual"[^>]*value="2026-10-15"/);
  assert.equal(
    vm.runInContext(`releaseIsOverdue({status:'Released',planned_date:'2026-10-14'})`, sandbox),
    false,
  );
  assert.equal(
    vm.runInContext(`releaseIsOverdue({status:'Planned',planned_date:'2026-10-15'})`, sandbox),
    false,
  );
});

test('Task numbers backfill every task without changing existing fields or history', async () => {
  const { db, request } = context({ signalsMigration: false });
  const a = (await request('/tasks', { method: 'POST', body: { title: 'Legacy engineering' } }))
    .data.id;
  const b = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Legacy quick', work_kind: 'Quick Task', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  const p = (
    await request('/private-work', {
      method: 'POST',
      who: 'engineer@demo.local',
      body: { kind: 'Task', title: 'Private old task' },
    })
  ).data.id;
  db.prepare('UPDATE tasks SET deleted=1 WHERE id=?').run(b);
  const old = db.prepare('SELECT * FROM tasks ORDER BY id').all(),
    history = db.prepare('SELECT * FROM activities ORDER BY id').all(),
    stage = db.prepare('SELECT * FROM stage_changes ORDER BY id').all();
  db.exec(
    readFileSync(
      new URL('../migrations/0031_task_numbers_and_urgent.sql', import.meta.url),
      'utf8',
    ),
  );
  const rows = db.prepare('SELECT * FROM tasks ORDER BY id').all();
  for (let i = 0; i < rows.length; i++) {
    const { task_code, ...rest } = rows[i];
    assert.match(task_code, /^WT-\d{6}$/);
    assert.deepEqual(rest, { ...old[i] });
  }
  assert.deepEqual(db.prepare('SELECT * FROM activities ORDER BY id').all(), history);
  assert.deepEqual(db.prepare('SELECT * FROM stage_changes ORDER BY id').all(), stage);
  assert.match(
    db.prepare('SELECT task_code FROM private_work WHERE id=?').get(p).task_code,
    /^WT-\d{6}$/,
  );
  assert.equal(
    new Set(
      db
        .prepare('SELECT number FROM task_numbers')
        .all()
        .map((r) => r.number),
    ).size,
    3,
  );
  assert.throws(
    () => db.prepare("UPDATE tasks SET task_code='WT-999999' WHERE id=?").run(a),
    /permanent/,
  );
  assert.throws(() => db.exec('DELETE FROM task_numbers'), /permanent/);
  db.close();
});

test('Concurrent shared, Quick and private task creation reserves one permanent global sequence', async () => {
  const { db, request } = context();
  const created = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      i % 2
        ? request('/tasks', {
            method: 'POST',
            body: { title: 'Quick ' + i, work_kind: 'Quick Task', assignee: 'engineer@demo.local' },
          })
        : request('/private-work', {
            method: 'POST',
            who: 'engineer@demo.local',
            body: { kind: 'Task', title: 'Private ' + i },
          }),
    ),
  );
  assert(created.every((r) => r.status === 201));
  const ids = db.prepare('SELECT * FROM task_numbers').all();
  assert.equal(ids.length, 20);
  assert.equal(new Set(ids.map((r) => r.number)).size, 20);
  const before = Math.max(...ids.map((r) => r.number));
  db.prepare('UPDATE tasks SET deleted=1,archived=1').run();
  await request('/tasks', { method: 'POST', body: { title: 'Next task' } });
  assert.equal(db.prepare('SELECT MAX(number) n FROM task_numbers').get().n, before + 1);
  const privateId = created[0].data.id;
  assert.equal(
    (await request('/private-work/' + privateId)).status,
    404,
    'Admin gets no access to another person private task',
  );
  const exportData = (await request('/export')).data;
  assert.equal(exportData.tables.task_numbers.filter((r) => r.entity === 'private').length, 0);
  db.close();
});

test('Urgency is independent, access-scoped and acknowledgement survives refresh without changing work', async () => {
  const { db, request } = context();
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Urgent communication', assignee: 'engineer@demo.local', priority: 'Low' },
    })
  ).data.id;
  const before = db.prepare('SELECT * FROM tasks WHERE id=?').get(tid),
    work = db.prepare('SELECT count(*) n FROM activities').get().n,
    stages = db.prepare('SELECT count(*) n FROM stage_changes').get().n;
  const action = (who, name) =>
    request('/tasks/' + tid + '/urgent', { method: 'POST', who, body: { action: name } });
  assert.equal((await action('admin@demo.local', 'mark')).status, 200);
  assert.equal((await action('admin@demo.local', 'mark')).status, 200);
  assert.equal(db.prepare('SELECT count(*) n FROM urgent_events').get().n, 1);
  let summary = (await request('/summary', { who: 'engineer@demo.local' })).data;
  assert.equal(summary.urgent_reminders[0].id, tid);
  assert.equal(
    (await request('/summary')).data.urgent_reminders.length,
    0,
    'Marker is not automatically a recipient',
  );
  assert.equal((await action('admin@demo.local', 'acknowledge')).status, 403);
  assert.equal((await action('engineer@demo.local', 'acknowledge')).status, 200);
  assert.equal((await action('engineer@demo.local', 'acknowledge')).status, 200);
  assert.equal(
    (await request('/summary', { who: 'engineer@demo.local' })).data.urgent_reminders.length,
    0,
  );
  const details = (await request('/tasks/' + tid, { who: 'engineer@demo.local' })).data;
  assert.equal(details.task.urgency.active, true);
  assert.equal(details.urgency_events.length, 2);
  assert.deepEqual(db.prepare('SELECT * FROM tasks WHERE id=?').get(tid), before);
  assert.equal(db.prepare('SELECT count(*) n FROM activities').get().n, work);
  assert.equal(db.prepare('SELECT count(*) n FROM stage_changes').get().n, stages);
  assert.equal(
    (await action('engineer@demo.local', 'cancel')).status,
    200,
    'Actual task owner can cancel',
  );
  assert.equal((await request('/tasks/' + tid)).data.task.urgency, null);
  assert.equal(db.prepare('SELECT count(*) n FROM urgent_events').get().n, 3);
  db.close();
});

test('Only marker or actual owner can cancel; Manager urgent communication grants no workflow permissions', async () => {
  const { db, request } = context();
  db.exec(
    "INSERT INTO users(email,display_name,role,groups_json) VALUES('other@demo.local','Other','admin','[]')",
  );
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Permission boundary', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  const path = '/tasks/' + tid + '/urgent';
  assert.equal(
    (
      await request(path, {
        who: 'boss@demo.local',
        mode: 'team',
        method: 'POST',
        body: { action: 'mark' },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(path, { who: 'other@demo.local', method: 'POST', body: { action: 'cancel' } }))
      .status,
    403,
    'Unrelated Admin is not a task owner',
  );
  assert.equal(
    (
      await request('/tasks/' + tid, {
        who: 'boss@demo.local',
        mode: 'team',
        method: 'PATCH',
        body: { title: 'Forbidden edit' },
      })
    ).status,
    403,
  );
  assert.equal(
    (await request(path, { who: 'boss@demo.local', method: 'POST', body: { action: 'cancel' } }))
      .status,
    200,
  );
  db.close();
});

test('Urgent recipients follow QA, PR co-owners, discussion and resolved work', async () => {
  const { db, request } = context();
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Handoff urgency', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  const urgent = (who, action) =>
      request('/tasks/' + tid + '/urgent', { method: 'POST', who, body: { action } }),
    summary = async (who) => (await request('/summary', { who })).data.urgent_reminders;
  await urgent('admin@demo.local', 'mark');
  await urgent('engineer@demo.local', 'acknowledge');
  db.prepare(
    "UPDATE tasks SET development_status='On Stage',feasibility='Confirmed',qa_owner='admin@demo.local',stage_confirmed_at='round-1' WHERE id=?",
  ).run(tid);
  assert.equal((await summary('engineer@demo.local')).length, 0);
  assert.equal((await summary('admin@demo.local')).length, 1);
  await urgent('admin@demo.local', 'acknowledge');
  db.prepare(
    "UPDATE tasks SET development_status='In Development',qa_status='Not Passed' WHERE id=?",
  ).run(tid);
  assert.equal(
    (await summary('engineer@demo.local')).length,
    1,
    'New Engineering action gets a fresh acknowledgement',
  );
  db.exec(
    "INSERT INTO users(email,display_name,role,groups_json) VALUES('reviewer@demo.local','Reviewer','member','[\"Engineering\"]')",
  );
  db.prepare(
    "UPDATE tasks SET development_status='PR Submitted',pr_reviewer='reviewer@demo.local' WHERE id=?",
  ).run(tid);
  assert.equal((await summary('reviewer@demo.local')).length, 1);
  assert.equal((await summary('engineer@demo.local')).length, 1);
  db.prepare(
    "INSERT INTO comments(id,task_id,actor_email,body) VALUES('urgent-discussion',?,'engineer@demo.local','Please confirm')",
  ).run(tid);
  db.prepare(
    "INSERT INTO discussion_actions(id,task_id,comment_id,owner_email) VALUES('urgent-reply',?,'urgent-discussion','admin@demo.local')",
  ).run(tid);
  assert.equal((await summary('admin@demo.local')).length, 1);
  db.exec("UPDATE discussion_actions SET resolved=1 WHERE id='urgent-reply'");
  assert.equal((await summary('admin@demo.local')).length, 0);
  db.prepare(
    "UPDATE tasks SET development_status='Closed',planning_status='Completed' WHERE id=?",
  ).run(tid);
  assert.equal((await summary('engineer@demo.local')).length, 0);
  assert.equal((await summary('reviewer@demo.local')).length, 0);
  db.close();
});

test('Urgent requires a resolvable current action owner and concurrent marks do not duplicate reminders', async () => {
  const { db, request } = context();
  const a = (await request('/tasks', { method: 'POST', body: { title: 'Unassigned' } })).data.id;
  assert.equal(
    (await request('/tasks/' + a + '/urgent', { method: 'POST', body: { action: 'mark' } })).status,
    409,
  );
  db.prepare(
    "UPDATE tasks SET assignee='engineer@demo.local',primary_owner='engineer@demo.local',next_action_owner='engineer@demo.local' WHERE id=?",
  ).run(a);
  const calls = await Promise.all(
    Array.from({ length: 5 }, () =>
      request('/tasks/' + a + '/urgent', { method: 'POST', body: { action: 'mark' } }),
    ),
  );
  assert(calls.every((r) => r.status === 200));
  assert.equal(db.prepare('SELECT count(*) n FROM urgent_events').get().n, 1);
  assert.equal(
    (await request('/summary', { who: 'engineer@demo.local' })).data.urgent_reminders.length,
    1,
  );
  await request('/tasks/' + a + '/urgent', { method: 'POST', body: { action: 'cancel' } });
  await request('/tasks/' + a + '/urgent', { method: 'POST', body: { action: 'mark' } });
  assert.equal(db.prepare('SELECT cycle FROM task_urgency').get().cycle, 2);
  db.close();
});

test('A returning action owner gets a fresh reminder, while harmless text edits do not rearm acknowledgements', async () => {
  const { db, request } = context();
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Urgent reassignment', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  const call = (action, who = 'engineer@demo.local') =>
    request('/tasks/' + tid + '/urgent', { method: 'POST', who, body: { action } });
  await call('mark', 'admin@demo.local');
  await call('acknowledge');
  db.prepare("UPDATE tasks SET title='Edited title',description='More detail' WHERE id=?").run(tid);
  assert.equal(
    (await request('/summary', { who: 'engineer@demo.local' })).data.urgent_reminders.length,
    0,
  );
  db.prepare(
    "UPDATE tasks SET assignee='admin@demo.local',next_action_owner='admin@demo.local' WHERE id=?",
  ).run(tid);
  db.prepare(
    "UPDATE tasks SET assignee='engineer@demo.local',next_action_owner='engineer@demo.local' WHERE id=?",
  ).run(tid);
  assert.equal(
    (await request('/summary', { who: 'engineer@demo.local' })).data.urgent_reminders.length,
    1,
  );
  db.close();
});

test('Urgent PR co-owners acknowledge independently and disabled recipients are not notified', async () => {
  const { db, request } = context();
  db.exec(
    "INSERT INTO users(email,display_name,role,groups_json) VALUES('review@demo.local','Review','member','[\"Engineering\"]')",
  );
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Shared review', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  db.prepare(
    "UPDATE tasks SET development_status='PR Submitted',feasibility='Confirmed',pr_reviewer='review@demo.local' WHERE id=?",
  ).run(tid);
  await request('/tasks/' + tid + '/urgent', { method: 'POST', body: { action: 'mark' } });
  await request('/tasks/' + tid + '/urgent', {
    method: 'POST',
    who: 'review@demo.local',
    body: { action: 'acknowledge' },
  });
  assert.equal(
    (await request('/summary', { who: 'review@demo.local' })).data.urgent_reminders.length,
    0,
  );
  assert.equal(
    (await request('/summary', { who: 'engineer@demo.local' })).data.urgent_reminders.length,
    1,
  );
  db.exec("UPDATE users SET enabled=0 WHERE email='engineer@demo.local'");
  assert.equal((await request('/tasks/' + tid)).data.task.urgency.pending, false);
  assert.equal((await request('/summary', { who: 'engineer@demo.local' })).status, 403);
  db.close();
});

test('Urgent data cannot be read or changed without the existing authenticated session', async () => {
  const { db, env } = context();
  const before = db.prepare('SELECT count(*) n FROM task_urgency').get().n;
  const r = await handle(
    new Request('https://app.example.com/api/tasks/00000000-0000-0000-0000-000000000001/urgent', {
      method: 'POST',
      headers: { origin: 'https://app.example.com', 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'mark' }),
    }),
    { ...env, DEV_AUTH: undefined },
  );
  assert.equal(r.status, 401);
  assert.equal(db.prepare('SELECT count(*) n FROM task_urgency').get().n, before);
  db.close();
});

test('Task identifiers appear only in details while board search still matches them', () => {
  const code = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'),
    sandbox = { document: { addEventListener() {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(code.slice(0, sourceIndex(code, 'const taskTitle=')), sandbox);
  vm.runInContext(
    code.slice(
      sourceIndex(code, 'const priorityRank='),
      sourceIndex(code, 'function renderDaily('),
    ),
    sandbox,
  );
  const t = {
    id: 'test-code',
    task_code: 'WT-000123',
    title: 'Numbered task',
    description: 'Task description',
    category: 'Billing',
    priority: 'Medium',
    type: 'Improvement',
    sort_order: 10,
    development_status: 'New Request',
    qa_status: 'Not Tested',
    assignee: 'engineer@demo.local',
    planning_status: 'Active',
    workflow: { phase: 'review', owner: 'engineer@demo.local' },
  };
  sandbox.testTask = t;
  vm.runInContext(
    "state.user={email:'engineer@demo.local',role:'member',groups:['Engineering']};state.tasks=[testTask];state.filter='wt-000123';",
    sandbox,
  );
  assert.equal(vm.runInContext('filterBoardTasks(state.tasks).length', sandbox), 1);
  assert.ok(
    !vm
      .runInContext('renderEngineeringCards(state.tasks,state.tasks)', sandbox)
      .includes('WT-000123'),
  );
  const details = vm.runInContext('taskIdentity(testTask)', sandbox);
  assert.match(details, /WT-000123/);
  assert.match(details, /Click to copy/);
  assert.ok(!details.includes('Copy Task Link'));
  assert.ok(!details.includes('Copy ID'));
  assert.ok(!details.includes('<svg'));
});

test('Backup checkpoint verifies every table and identifiers migration verifies the original task fields', () => {
  const { db } = context({ signalsMigration: false });
  db.exec(
    readFileSync(new URL('../migrations/0028_qa_result_labels.sql', import.meta.url), 'utf8'),
  );
  db.exec(
    readFileSync(
      new URL('../migrations/0029_production_completes_task.sql', import.meta.url),
      'utf8',
    ),
  );
  db.exec(
    "INSERT INTO tasks(id,title,type,created_by) VALUES('safety-check','Keep historical records','Bug Fix','engineer@demo.local'); INSERT INTO comments(id,task_id,actor_email,body) VALUES('safety-comment','safety-check','engineer@demo.local','Original comment');",
  );
  db.exec(
    readFileSync(new URL('../migrations/0030_pre_identifier_backup.sql', import.meta.url), 'utf8'),
  );
  const checkpoints = db.prepare('SELECT * FROM system_backup_v85_manifest').all();
  assert.equal(checkpoints.length, 32);
  assert(checkpoints.every((r) => r.verified === 1 && r.row_count === r.snapshot_count));
  const before = db.prepare("SELECT * FROM tasks WHERE id='safety-check'").get();
  db.exec(
    readFileSync(
      new URL('../migrations/0031_task_numbers_and_urgent.sql', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(
    db.prepare('SELECT count(*) n FROM identifier_verification WHERE verified=1').get().n,
    5,
  );
  const { task_code, ...after } = db.prepare("SELECT * FROM tasks WHERE id='safety-check'").get();
  assert.deepEqual(after, { ...before });
  assert.equal(
    db.prepare("SELECT body FROM comments WHERE id='safety-comment'").get().body,
    'Original comment',
  );
  db.exec("UPDATE tasks SET description='Later edit' WHERE id='safety-check'");
  db.exec(
    "UPDATE tasks SET description=(SELECT description FROM system_backup_v85_tasks WHERE id=tasks.id) WHERE id='safety-check'",
  );
  assert.equal(
    db.prepare("SELECT description FROM tasks WHERE id='safety-check'").get().description,
    before.description,
  );
  db.close();
});

test('An owner handoff racing acknowledgement cannot acknowledge the new action', async () => {
  const { db, env, request } = context();
  const tid = (
    await request('/tasks', {
      method: 'POST',
      body: { title: 'Concurrent handoff', assignee: 'engineer@demo.local' },
    })
  ).data.id;
  await request('/tasks/' + tid + '/urgent', { method: 'POST', body: { action: 'mark' } });
  const batch = env.DB.batch;
  let changed = false;
  env.DB.batch = async (statements) => {
    if (!changed) {
      changed = true;
      db.prepare(
        "UPDATE tasks SET assignee='admin@demo.local',primary_owner='admin@demo.local',next_action_owner='admin@demo.local' WHERE id=?",
      ).run(tid);
    }
    return batch(statements);
  };
  assert.equal(
    (
      await request('/tasks/' + tid + '/urgent', {
        method: 'POST',
        who: 'engineer@demo.local',
        body: { action: 'acknowledge' },
      })
    ).status,
    409,
  );
  assert.equal(db.prepare('SELECT count(*) n FROM urgent_acknowledgements').get().n, 0);
  assert.equal(
    db.prepare("SELECT count(*) n FROM urgent_events WHERE action='Acknowledged Reminder'").get().n,
    0,
  );
  db.close();
});
