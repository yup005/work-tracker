import test from 'node:test';
import { sourceIndex } from './source-index.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { instructionGuides } from '../server.mjs';
const languageCode = readFileSync(new URL('../public/language.js', import.meta.url), 'utf8');
const appCode = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function fixture(
  saved,
  unavailable = false,
  user = { email: 'admin@demo.local', language_switch_enabled: 1 },
) {
  const writes = [],
    handlers = {},
    nodes = [],
    placeholders = [],
    buttons = ['zh', 'en'].map((language) => ({
      dataset: { language },
      classList: {
        toggle(name, value) {
          this[name] = value;
        },
      },
      setAttribute(name, value) {
        this[name] = value;
      },
    }));
  const control = { hidden: true };
  const stored = new Map([
    ['work-tracker.language', 'zh'],
    ['work-tracker.language.account.admin%40demo.local', saved || 'zh'],
  ]);
  const document = {
    documentElement: {},
    addEventListener(name, fn) {
      handlers[name] = fn;
    },
    querySelectorAll(selector) {
      return selector === '[data-ui]'
        ? nodes
        : selector === '[placeholder]'
          ? placeholders
          : selector === '[data-language]'
            ? buttons
            : selector === '.language-switch'
              ? [control]
              : [];
    },
  };
  const sandbox = {
    document,
    console,
    localStorage: {
      getItem(key) {
        if (unavailable) throw Error('Storage unavailable');
        return stored.get(key) || null;
      },
      setItem(key, value) {
        if (unavailable) throw Error('Storage unavailable');
        stored.set(key, value);
        writes.push({ key, value });
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(languageCode, sandbox);
  if (user) sandbox.WorkTrackerLanguage.configure(user);
  return {
    sandbox,
    language: sandbox.WorkTrackerLanguage,
    document,
    nodes,
    placeholders,
    buttons,
    writes,
    handlers,
    control,
    stored,
  };
}
test('English is the default and language controls stay hidden until permitted, ignoring the legacy preference', () => {
  const f = fixture(undefined, false, null);
  assert.equal(f.language.current, 'en');
  assert.equal(f.document.documentElement.lang, 'en');
  assert.equal(f.control.hidden, true);
  assert.ok(f.buttons.every((b) => b.disabled));
  f.language.set('zh');
  assert.equal(f.language.current, 'en');
  assert.equal(f.writes.length, 0);
  f.language.configure({ email: 'admin@demo.local', language_switch_enabled: 0 });
  assert.equal(f.language.current, 'en');
  assert.equal(f.control.hidden, true);
  f.language.configure({ email: 'new@demo.local', language_switch_enabled: 1 });
  assert.equal(f.language.current, 'en');
  assert.equal(f.control.hidden, false);
  assert.ok(f.buttons.every((b) => !b.disabled));
  f.language.set('zh');
  assert.equal(f.document.documentElement.lang, 'zh-CN');
  assert.equal(f.language.translate('Tap to add photos or files'), '轻点添加照片或文件');
  assert.deepEqual(f.writes, [
    { key: 'work-tracker.language.account.new%40demo.local', value: 'zh' },
  ]);
});
test('Account switching, revocation and sign-out cannot leak a remembered Chinese preference', () => {
  const f = fixture('zh');
  assert.equal(f.language.current, 'zh');
  f.language.configure({ email: 'other@demo.local', language_switch_enabled: 1 });
  assert.equal(f.language.current, 'en');
  f.language.set('zh');
  f.language.configure({ email: 'other@demo.local', language_switch_enabled: 0 });
  assert.equal(f.language.current, 'en');
  assert.equal(f.control.hidden, true);
  f.handlers.click({ target: { closest: () => f.buttons[0] } });
  assert.equal(f.language.current, 'en');
  f.language.configure(null);
  assert.equal(f.control.hidden, true);
  assert.equal(f.language.current, 'en');
  f.language.configure({ email: 'admin@demo.local', language_switch_enabled: 1 });
  assert.equal(f.language.current, 'zh');
  f.language.set('en');
  assert.equal(f.document.documentElement.lang, 'en');
  assert.equal(fixture('en').language.current, 'en');
  const blocked = fixture(undefined, true);
  assert.equal(blocked.language.current, 'en');
  blocked.language.set('zh');
  assert.equal(blocked.language.current, 'zh');
  blocked.language.configure({ email: 'admin@demo.local', language_switch_enabled: 1 });
  assert.equal(blocked.language.current, 'zh');
  blocked.language.set('invalid');
  assert.equal(blocked.language.current, 'zh');
});
test('Live switching changes only marked copy and placeholders, preserving drafts, files and workflow enum values', () => {
  const f = fixture(),
    copyNode = {
      dataset: { ui: 'Record what you did. This update counts toward the selected day’s work.' },
    },
    namedNode = {
      dataset: {
        ui: 'No activity for {days} working days · Log progress or update the task status.',
        uiValues: '{"days":3}',
      },
    };
  const draft = {
      value: 'No tasks yet',
      files: [{ name: 'Tap to add photos or files.pdf' }],
      dataset: { savedId: 'entry' },
    },
    status = { value: 'In Progress' },
    input = {
      dataset: { uiPlaceholder: 'e.g. Fix a login issue' },
      value: 'Fix this real bug',
      placeholder: '例如：修复登录问题',
      setAttribute(k, v) {
        this[k] = v;
      },
      getAttribute(k) {
        return this[k];
      },
    };
  f.nodes.push(copyNode, namedNode);
  f.placeholders.push(input);
  f.language.apply();
  assert.match(copyNode.textContent, /记录你做了什么/);
  assert.match(namedNode.textContent, /3 个工作日/);
  f.handlers.click({ target: { closest: () => f.buttons[1] } });
  assert.equal(input.placeholder, 'e.g. Fix a login issue');
  assert.equal(copyNode.textContent, copyNode.dataset.ui);
  assert.match(namedNode.textContent, /3 working days/);
  f.language.set('zh');
  assert.equal(input.placeholder, '例如：修复登录问题');
  assert.equal(input.value, 'Fix this real bug');
  assert.equal(draft.value, 'No tasks yet');
  assert.equal(draft.files[0].name, 'Tap to add photos or files.pdf');
  assert.equal(draft.dataset.savedId, 'entry');
  assert.equal(status.value, 'In Progress');
});
test('System copy escapes named values, keeps technical terms in English and never treats user content as translations', () => {
  const f = fixture(),
    l = f.language;
  for (const name of [
    'Dashboard',
    'Daily Work',
    'Engineering Board',
    'Version Control',
    'Assignee',
    'Stage',
    'Production',
    'In Progress',
    'Changes Required',
    'Completed',
  ])
    assert.equal(l.translate(name), name);
  const html = l.html('Assigned to {assignee}. Your update will be recorded as {actor}.', {
    assignee: '<img src=x onerror=alert(1)>',
    actor: 'Admin "&" Ethan',
  });
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;img/);
  assert.match(html, /data-ui-values=/);
  assert.match(html, /Assignee/);
  vm.runInContext(appCode.slice(0, sourceIndex(appCode, 'const taskTitle=')), f.sandbox);
  const result = vm.runInContext(
    'projectTaskList([{id:"task",title:"No tasks yet",description:"Tap to add photos or files",status:"Completed"}],false,"project")',
    f.sandbox,
  );
  assert.match(result, /<strong>No tasks yet<\/strong>/);
  assert.match(result, /<small>Tap to add photos or files<\/small>/);
  assert.match(result, /Completed/);
  assert.match(result, /点击 task/);
});
test('Every work-group guide is available in Chinese while retaining stable account acknowledgement IDs', () => {
  const { language } = fixture();
  for (const groups of [
    ['Engineering'],
    ['QA'],
    ['Design'],
    ['Management'],
    ['Engineering', 'Management'],
    ['QA', 'Management'],
    ['Design', 'Management'],
    ['Engineering', 'QA', 'Management'],
  ]) {
    for (const role of ['member', 'admin']) {
      const guides = instructionGuides({ role, groups, language_switch_enabled: 1 });
      assert.equal(new Set(guides.map((g) => g.id)).size, guides.length);
      assert.ok(guides.some((g) => g.id === 'account-language-v2'));
      for (const g of guides) {
        assert.notEqual(language.translate(g.title), g.title, `Missing guide title: ${g.title}`);
        for (const s of g.steps)
          assert.notEqual(language.translate(s), s, `Missing guide step: ${s}`);
      }
    }
  }
});
test('Chinese Next Step explanations preserve the Stage confirmation gate and complete release sequence', () => {
  const { language } = fixture();
  for (const text of [
    'Review feasibility, choose the engineer and confirm the estimated delivery date.',
    'Continue engineering work. Confirm merged to Stage and assign QA in one step, only when the build is available for testing.',
    'The engineer has confirmed this change is merged to Stage and ready to test. Test it and record the result. Issues return to Engineering.',
    'QA passed this Stage build. Deploy to Production, verify the result, then confirm here to include it in the version update.',
    'This change is on Production. Record your completion check or handoff, then mark the task complete.',
  ])
    assert.notEqual(language.translate(text), text);
  assert.match(
    language.translate(
      'Continue engineering work. Confirm merged to Stage and assign QA in one step, only when the build is available for testing.',
    ),
    /只有.*Stage.*可测试/,
  );
  language.set('en');
  assert.equal(
    language.translate(
      'Review feasibility, choose the engineer and confirm the estimated delivery date.',
    ),
    'Review feasibility, choose the engineer and confirm the estimated delivery date.',
  );
});
test('Language asset loads before the app; controls start hidden and remain accessible on mobile when enabled', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'),
    build = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8'),
    local = readFileSync(new URL('../node-server.mjs', import.meta.url), 'utf8');
  assert.ok(html.indexOf('src="/language.js"') < html.indexOf('src="/app.js"'));
  assert.match(html, /data-language="zh"/);
  assert.match(html, /data-language="en"/);
  assert.match(html, /aria-label="Display language"/);
  assert.match(html, /id="language-switch"[^>]*\bhidden\b/);
  assert.match(html, /<html lang="en"/);
  assert.match(
    build,
    /\[\s*['\"]language\.js['\"]\s*,\s*['\"]application\/javascript; charset=utf-8['\"]\s*\]/,
  );
  assert.match(local, /'language.js'/);
  assert.match(
    readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8'),
    /\.language-switch button\s*\{\s*min-height:\s*40px/,
  );
});
test('Rendered Next Step uses Chinese copy and English statuses without exposing QA before the Stage handoff', () => {
  const f = fixture();
  vm.runInContext(appCode.slice(0, sourceIndex(appCode, 'const taskTitle=')), f.sandbox);
  f.sandbox.pendingActivityFiles = [];
  f.sandbox.pendingCommentFiles = [];
  vm.runInContext(
    appCode.slice(
      sourceIndex(appCode, 'function memberCanWork('),
      sourceIndex(appCode, 'function memberOptions('),
    ),
    f.sandbox,
  );
  vm.runInContext(
    "state.user={email:'engineer@demo.local',role:'admin',groups:['Engineering']};state.users=[];state.statuses={qa:['Not Tested','Retest Required','Passed','Changes Required']};",
    f.sandbox,
  );
  const task = {
    id: 'task',
    title: 'No tasks yet',
    assignee: 'engineer@demo.local',
    feasibility: 'Confirmed',
    development_status: 'In Development',
    qa_status: 'Not Tested',
  };
  const workflow = {
    phase: 'development',
    role: 'Engineering',
    owner: 'engineer@demo.local',
    instruction:
      'Continue engineering work. Confirm merged to Stage and assign QA in one step, only when the build is available for testing.',
    actions: ['progress', 'stage'],
  };
  f.sandbox.taskFixture = { task, workflow };
  const html = vm.runInContext('workflowCard(taskFixture,true)', f.sandbox);
  assert.match(html, /继续开发/);
  assert.match(html, /只有版本已上 Stage 并可测试/);
  assert.match(html, /data-stage-handoff hidden/);
  assert.match(html, /value="On Stage"/);
  assert.match(html, /Merged to Stage → QA/);
  assert.match(html, /点击此处，再按 ⌘V \/ Ctrl\+V 粘贴图片/);
  assert.ok(!html.includes('phase="qa"'));
  f.language.set('en');
  const english = vm.runInContext('workflowCard(taskFixture,true)', f.sandbox);
  assert.match(english, /Continue engineering work\./);
  assert.match(english, /Click here, then press ⌘V \/ Ctrl\+V to paste an image/);
  assert.match(english, /data-stage-handoff hidden/);
});

test('Language guide is offered only to enabled accounts, while Admin gets the account-control guide', () => {
  for (const groups of [['Engineering'], ['QA'], ['Management'], ['Design', 'Management']]) {
    const user = { role: 'member', groups };
    assert.ok(!instructionGuides(user).some((g) => g.id.startsWith('account-language-')));
    assert.ok(
      instructionGuides({ ...user, language_switch_enabled: 1 }).some(
        (g) => g.id === 'account-language-v2',
      ),
    );
  }
  const guides = instructionGuides({ role: 'admin', groups: ['QA'] });
  assert.ok(guides.some((g) => g.id === 'team-language-admin-v1'));
  assert.ok(!guides.some((g) => g.id === 'account-language-v2'));
});

test('Refreshing the workspace applies the current account permission and updated available guides', async () => {
  const calls = [],
    user = { email: 'member@example.com', language_switch_enabled: 0 };
  const sandbox = {
    state: {
      user: { email: user.email, language_switch_enabled: 1 },
      workspaceRevision: 1,
      day: '2026-10-09',
    },
    canManage: () => false,
    api: async (path) =>
      path === '/me'
        ? { user, instructions: { guides: [], acknowledged: ['kept'] } }
        : { users: [], tasks: [], logs: [], today_activity: [] },
    WorkTrackerLanguage: { configure: (u) => calls.push(u) },
    render: () => calls.push('render'),
  };
  vm.createContext(sandbox);
  vm.runInContext(
    appCode.slice(
      sourceIndex(appCode, 'async function reload(){'),
      sourceIndex(appCode, 'let workspaceSwitchBusy=false;'),
    ),
    sandbox,
  );
  await sandbox.reload();
  assert.equal(sandbox.state.user, user);
  assert.deepEqual(calls, [user, 'render']);
  assert.deepEqual(sandbox.state.instructions.acknowledged, ['kept']);
});
