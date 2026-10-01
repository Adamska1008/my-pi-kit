import assert from 'node:assert/strict';
import test from 'node:test';
import dollarSkills, { expandDollarSkill } from '../extensions/dollar-skills/index.js';

const commands = [
  { name: 'skill:poteto-mode', source: 'skill' },
  { name: 'skill:tdd', source: 'skill' },
  { name: 'skill:how', source: 'skill' },
  { name: 'reload', source: 'extension' },
  { name: 'skill:fake', source: 'extension' },
  { name: 'skill:template', source: 'prompt' },
];

for (const [input, expected] of [
  ['$poteto-mode Fix this bug.', '/skill:poteto-mode Fix this bug.'],
  ['$tdd', '/skill:tdd'],
  ['$how\tExplain authentication.', '/skill:how Explain authentication.'],
  ['$how\nExplain authentication.\nKeep the details.', '/skill:how Explain authentication.\nKeep the details.'],
  ['$how  Keep  spacing and $PATH.', '/skill:how  Keep  spacing and $PATH.'],
  ['$tdd\r\nAdd a regression.', '/skill:tdd \nAdd a regression.'],
]) {
  test(`expands ${JSON.stringify(input)}`, () => {
    assert.equal(expandDollarSkill(input, commands), expected);
  });
}

for (const input of [
  '$unknown Do something.',
  '$reload',
  '$fake',
  '$template',
  '$PATH',
  '$HOME/bin',
  '$how-to',
  '$how.foo',
  '$how:',
  '$how(...)',
  '$how--bad',
  '$how-',
  '$',
  '$100.00',
  '${how}',
  '$(echo how)',
  ' $how Explain.',
  'Use $how to explain.',
  '`$how`',
  '/skill:how Explain.',
  '```\n$how\n```',
]) {
  test(`leaves ${JSON.stringify(input)} unchanged`, () => {
    assert.equal(expandDollarSkill(input, commands), undefined);
  });
}

function harness(initialCommands = commands) {
  let handler;
  let currentCommands = initialCommands;
  dollarSkills({
    on(event, callback) {
      assert.equal(event, 'input');
      handler = callback;
    },
    getCommands() { return currentCommands; },
  });
  return {
    input(event) { return handler(event); },
    setCommands(next) { currentCommands = next; },
  };
}

for (const source of ['interactive', 'rpc']) {
  test(`transforms ${source} input while preserving images`, () => {
    const images = [{ type: 'image', data: 'fixture', mimeType: 'image/png' }];
    const result = harness().input({ text: '$tdd Fix it.', source, images });
    assert.deepEqual(result, { action: 'transform', text: '/skill:tdd Fix it.', images });
    assert.equal(result.images, images);
  });
}

test('ignores extension-injected messages', () => {
  assert.deepEqual(harness().input({ text: '$tdd Fix it.', source: 'extension' }), { action: 'continue' });
});

test('passes unknown aliases and ordinary text through', () => {
  for (const text of ['$unknown', 'Ordinary text', '/skill:tdd']) {
    assert.deepEqual(harness().input({ text, source: 'interactive' }), { action: 'continue' });
  }
});

test('consults the live command registry rather than caching names', () => {
  const host = harness([]);
  assert.deepEqual(host.input({ text: '$tdd', source: 'interactive' }), { action: 'continue' });
  host.setCommands(commands);
  assert.equal(host.input({ text: '$tdd', source: 'interactive' }).text, '/skill:tdd');
  host.setCommands([]);
  assert.deepEqual(host.input({ text: '$tdd', source: 'interactive' }), { action: 'continue' });
});
