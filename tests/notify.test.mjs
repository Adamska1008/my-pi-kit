import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerNotifications } from '../extensions/notify.ts';

function fixture(sendError) {
  const sessions = new Map([['a', []], ['b', []]]);
  let active = 'a';
  const events = {}, commands = {}, notices = [], sent = [];
  const ctx = {
    mode: 'tui',
    sessionManager: {
      getSessionId: () => active,
      getEntries: () => [...sessions.get(active)],
      getBranch: () => { throw new Error('Preferences must not depend on branch'); },
    },
    ui: { notify: (...args) => notices.push(args) },
  };
  const pi = {
    on: (name, handler) => { events[name] = handler; },
    registerCommand: (name, command) => { commands[name] = command; },
    appendEntry: (customType, data) => sessions.get(active).push({ type: 'custom', customType, data }),
  };
  const reload = () => registerNotifications(pi, async (...args) => {
    if (sendError) throw sendError;
    sent.push(args);
  });
  reload();
  return {
    ctx, sessions, notices, sent, commands, events, reload,
    switchTo: id => { active = id; },
    command: args => commands.notify.handler(args, ctx),
    settle: () => events.agent_settled({}, ctx),
  };
}

test('defaults on; status and invalid arguments never write preferences', async () => {
  const f = fixture();
  for (const arg of ['', 'status', 'bogus', 'off now']) await f.command(arg);
  assert.deepEqual(f.notices, [
    ['Session completion notifications: on', 'info'],
    ['Session completion notifications: on', 'info'],
    ['Usage: /notify [on|off|status]', 'warning'],
    ['Usage: /notify [on|off|status]', 'warning'],
  ]);
  assert.equal(f.sessions.get('a').length, 0);
  assert.deepEqual(Object.keys(f.events), ['agent_settled']);
  await f.settle();
  assert.deepEqual(f.sent, [['Pi', 'Ready for input']]);
});

test('off suppresses delivery, on restores it, duplicate commands are idempotent', async () => {
  const f = fixture();
  await f.command(' OFF ');
  await f.command('off');
  await f.settle();
  assert.equal(f.sent.length, 0);
  assert.equal(f.sessions.get('a').length, 1);
  await f.command('on');
  await f.command('on');
  await f.settle();
  assert.equal(f.sent.length, 1);
  assert.equal(f.sessions.get('a').length, 2);
});

test('session-wide state survives reload/switch; new sessions and forks default on', async () => {
  const f = fixture();
  await f.command('off');
  f.reload();
  await f.settle();
  assert.equal(f.sent.length, 0);
  f.switchTo('b');
  await f.settle();
  assert.equal(f.sent.length, 1);
  f.switchTo('a');
  await f.settle();
  assert.equal(f.sent.length, 1);
  f.sessions.set('fork', structuredClone(f.sessions.get('a')));
  f.switchTo('fork');
  await f.settle();
  assert.equal(f.sent.length, 2);
});

test('ignores malformed/unrelated entries, preserving latest valid preference', async () => {
  const f = fixture();
  await f.command('off');
  f.sessions.get('a').push(
    { type: 'message' },
    { type: 'custom', customType: 'other', data: { sessionId: 'a', enabled: true } },
    ...[null, {}, { sessionId: 'a', enabled: 'true' }, { sessionId: 'b', enabled: true }]
      .map(data => ({ type: 'custom', customType: 'my-pi-kit:notify', data })),
  );
  await f.settle();
  assert.equal(f.sent.length, 0);
});

test('non-TUI modes never send desktop notifications; errors stay UI warnings', async () => {
  const f = fixture(new Error('delivery failed'));
  for (const mode of ['rpc', 'json', 'print']) {
    f.ctx.mode = mode;
    await f.settle();
  }
  assert.equal(f.notices.length, 0);
  f.ctx.mode = 'tui';
  await f.settle();
  assert.deepEqual(f.notices, [['Desktop notification failed: delivery failed', 'warning']]);
});

test('offers command argument completions', () => {
  const f = fixture();
  assert.deepEqual(f.commands.notify.getArgumentCompletions('o').map(x => x.value), ['on', 'off']);
  assert.deepEqual(f.commands.notify.getArgumentCompletions('x'), []);
});
