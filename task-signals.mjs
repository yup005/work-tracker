/** Urgency is separate from task priority, workflow and work accounting. */
export function createTaskSignals({ all, first, sql, workflowGuide, id, stamp }) {
  const activeTask = (t) =>
    !t.deleted &&
    !t.archived &&
    t.planning_status === 'Active' &&
    !['done', 'archived', 'planning'].includes(workflowGuide(t).phase);
  const ownerMayCancel = (u, t, s) =>
    u.email === s.marked_by ||
    [t.primary_owner, t.assignee, t.work_kind === 'PM Task' ? t.pm_owner : '']
      .filter(Boolean)
      .includes(u.email);
  async function actionContext(env, tasks, states = []) {
    const revisions = new Map(states.map((s) => [s.task_id, s.action_revision || 0]));
    const wanted = new Map(tasks.filter(activeTask).map((t) => [t.id, t]));
    if (!wanted.size) return new Map();
    const [users, discussions, collaborators] = await Promise.all([
      all(env, 'SELECT email FROM users WHERE enabled=1'),
      all(env, 'SELECT id,task_id,owner_email FROM discussion_actions WHERE resolved=0'),
      all(env, "SELECT task_id,email,description FROM task_collaborator_work WHERE status='Open'"),
    ]);
    const enabled = new Set(users.map((u) => u.email)),
      contexts = new Map();
    for (const t of wanted.values()) {
      const g = workflowGuide(t),
        keys = new Map(),
        add = (email, key) => {
          if (!enabled.has(email)) return;
          if (!keys.has(email)) keys.set(email, []);
          keys.get(email).push(key);
        };
      const owners = [...new Set([g.owner, ...(g.owners || [])].filter(Boolean))].sort();
      const stageKey = JSON.stringify([
        revisions.get(t.id) || 0,
        g.phase,
        t.development_status,
        t.qa_status,
        t.work_status,
        t.pm_stage,
        t.stage_confirmed_at || '',
        t.pr_review_merged_at || '',
        owners,
      ]);
      for (const owner of owners) add(owner, 'workflow:' + stageKey);
      for (const a of discussions) if (a.task_id === t.id) add(a.owner_email, 'discussion:' + a.id);
      const assigned = new Set(JSON.parse(t.collaborators_json || '[]'));
      for (const a of collaborators)
        if (a.task_id === t.id && assigned.has(a.email))
          add(a.email, 'collaboration:' + JSON.stringify([a.task_id, a.email, a.description]));
      contexts.set(
        t.id,
        new Map([...keys].map(([email, list]) => [email, JSON.stringify(list.sort())])),
      );
    }
    return contexts;
  }
  async function decorate(env, tasks, user) {
    const states = await all(env, 'SELECT * FROM task_urgency WHERE active=1');
    if (!states.length) return tasks.map((t) => ({ ...t, urgency: null }));
    const byId = new Map(states.map((s) => [s.task_id, s])),
      current = tasks.filter((t) => byId.has(t.id)),
      contexts = await actionContext(env, current, states);
    const acks = await all(
        env,
        'SELECT task_id,cycle,action_key FROM urgent_acknowledgements WHERE recipient_email=?',
        user.email,
      ),
      seen = new Set(acks.map((a) => JSON.stringify([a.task_id, a.cycle, a.action_key])));
    return tasks.map((t) => {
      const s = byId.get(t.id);
      if (!s) return { ...t, urgency: null };
      const actionKey = contexts.get(t.id)?.get(user.email) || '';
      return {
        ...t,
        urgency: {
          active: true,
          marked_by: s.marked_by,
          marked_at: s.marked_at,
          can_cancel: ownerMayCancel(user, t, s),
          pending: !!actionKey && !seen.has(JSON.stringify([t.id, s.cycle, actionKey])),
          action_key: actionKey,
          cycle: s.cycle,
        },
      };
    });
  }
  async function perform(env, t, user, action) {
    const existing = await first(env, 'SELECT * FROM task_urgency WHERE task_id=?', t.id),
      token = id(),
      now = stamp();
    if (action === 'mark') {
      if (existing?.active) return { success: true, already_urgent: true };
      const contexts = await actionContext(env, [t]);
      if (!contexts.get(t.id)?.size)
        throw Object.assign(
          new Error('Assign a current action owner before marking this task as urgent.'),
          { status: 409 },
        );
      await env.DB.batch([
        sql(
          env,
          `INSERT INTO task_urgency(task_id,cycle,active,marked_by,marked_at,event_token) VALUES(?,1,1,?,?,?) ON CONFLICT(task_id) DO UPDATE SET cycle=task_urgency.cycle+1,active=1,marked_by=excluded.marked_by,marked_at=excluded.marked_at,cancelled_by='',cancelled_at='',event_token=excluded.event_token WHERE task_urgency.active=0`,
          t.id,
          user.email,
          now,
          token,
        ),
        sql(
          env,
          "INSERT INTO urgent_events(id,task_id,cycle,action,actor_email,recorded_at) SELECT ?,task_id,cycle,'Marked as Urgent',?,? FROM task_urgency WHERE task_id=? AND event_token=?",
          token,
          user.email,
          now,
          t.id,
          token,
        ),
      ]);
      return { success: true };
    }
    if (action === 'cancel') {
      if (!existing?.active) return { success: true };
      if (!ownerMayCancel(user, t, existing))
        throw Object.assign(
          new Error('Only the person who marked this task urgent or the task owner can cancel it.'),
          { status: 403 },
        );
      await env.DB.batch([
        sql(
          env,
          'UPDATE task_urgency SET active=0,cancelled_by=?,cancelled_at=?,event_token=? WHERE task_id=? AND active=1 AND cycle=? AND action_revision=?',
          user.email,
          now,
          token,
          t.id,
          existing.cycle,
          existing.action_revision || 0,
        ),
        sql(
          env,
          "INSERT INTO urgent_events(id,task_id,cycle,action,actor_email,recorded_at) SELECT ?,task_id,cycle,'Cancelled Urgent',?,? FROM task_urgency WHERE task_id=? AND event_token=?",
          token,
          user.email,
          now,
          t.id,
          token,
        ),
      ]);
      const current = await first(
        env,
        'SELECT active,cycle,action_revision FROM task_urgency WHERE task_id=?',
        t.id,
      );
      if (
        current?.active &&
        (current.cycle !== existing.cycle ||
          current.action_revision !== (existing.action_revision || 0))
      )
        throw Object.assign(new Error('The task action changed. Reopen the task and try again.'), {
          status: 409,
        });
      return { success: true };
    }
    if (action === 'acknowledge') {
      if (!existing?.active) return { success: true };
      const key = (await actionContext(env, [t], [existing])).get(t.id)?.get(user.email);
      if (!key)
        throw Object.assign(
          new Error('Only a current action owner can acknowledge this reminder.'),
          { status: 403 },
        );
      await env.DB.batch([
        sql(
          env,
          `INSERT INTO urgent_acknowledgements(id,task_id,cycle,recipient_email,action_key,acknowledged_at) SELECT ?,task_id,cycle,?,?,? FROM task_urgency WHERE task_id=? AND active=1 AND cycle=? AND action_revision=? ON CONFLICT(task_id,cycle,recipient_email,action_key) DO NOTHING`,
          token,
          user.email,
          key,
          now,
          t.id,
          existing.cycle,
          existing.action_revision || 0,
        ),
        sql(
          env,
          "INSERT INTO urgent_events(id,task_id,cycle,action,actor_email,recorded_at) SELECT id,task_id,cycle,'Acknowledged Reminder',recipient_email,acknowledged_at FROM urgent_acknowledgements WHERE id=?",
          token,
        ),
      ]);
      const current = await first(
        env,
        'SELECT active,cycle,action_revision FROM task_urgency WHERE task_id=?',
        t.id,
      );
      if (
        !current?.active ||
        current.cycle !== existing.cycle ||
        current.action_revision !== (existing.action_revision || 0)
      )
        throw Object.assign(new Error('The task action changed. Reopen the task and try again.'), {
          status: 409,
        });
      return { success: true };
    }
    throw Object.assign(new Error('Choose Mark as Urgent, Cancel Urgent or Acknowledge.'), {
      status: 400,
    });
  }
  return { decorate, perform };
}
