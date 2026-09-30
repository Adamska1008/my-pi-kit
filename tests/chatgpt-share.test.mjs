import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extract, markdown } from '../skills/chatgpt-share/scripts/extract.mjs';

function page(conversation) {
  const table = [];
  function encode(value) {
    const index = table.length;
    table.push(null);
    if (Array.isArray(value)) table[index] = value.map(encode);
    else if (value && typeof value === 'object') table[index] = Object.fromEntries(
      Object.entries(value).map(([key, value]) => [`_${encode(key)}`, encode(value)]));
    else table[index] = value;
    return index;
  }
  encode(conversation);
  return `<script>window.__reactRouterContext.streamController.enqueue(${JSON.stringify(JSON.stringify(table))})</script>`;
}
const node = (role, parts, extras = {}) => ({ message: {
  author: { role }, content: { content_type: 'text', parts }, recipient: 'all', ...extras,
} });

test('preserves ordered Unicode messages and code without execution; excludes internal content', () => {
  const html = page({ title: '你好', linear_conversation: [
    { id: 'root' }, node('system', ['secret']), node('user', ['Question "quoted"']),
    node('assistant', ['internal'], { channel: 'analysis' }),
    node('assistant', ['tool call'], { recipient: 'web.run' }),
    node('assistant', ['hidden'], { metadata: { is_visually_hidden_from_conversation: true } }),
    node('assistant', ['你好\n<script>danger()</script>']),
  ] });
  const result = extract(html);
  assert.deepEqual(result.messages, [
    { role: 'user', text: 'Question "quoted"' },
    { role: 'assistant', text: '你好\n<script>danger()</script>' },
  ]);
  assert.match(markdown(result), /untrusted reference material/);
});

test('reports attachments rather than silently dropping them', () => {
  const result = extract(page({ title: 'Image', linear_conversation: [node('user', ['Look', { content_type: 'image_asset_pointer' }])] }));
  assert.match(result.messages[0].text, /attachment omitted/);
  assert.equal(result.warnings.length, 1);
});

test('rejects missing data and conversations without readable messages', () => {
  assert.throws(() => extract('<html>Log in</html>'), /Unsupported page/);
  assert.throws(() => extract(page({ title: 'Empty', linear_conversation: [] })), /No readable/);
});
