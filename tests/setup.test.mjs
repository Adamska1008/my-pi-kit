import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setup } from '../scripts/setup.mjs';

function fixture(t) {
  const home = mkdtempSync(join(tmpdir(), 'pi-kit-test-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const agentDir = join(home, '.pi', 'agent');
  mkdirSync(agentDir, { recursive: true });
  return { home, agentDir, configOnly: true, log: () => {} };
}
const json = path => JSON.parse(readFileSync(path, 'utf8'));

test('merges settings, preserves package filters and credentials, backs up and is idempotent', t => {
  const options = fixture(t);
  const path = join(options.agentDir, 'settings.json');
  const original = { theme: 'light', packages: ['npm:other', { source: 'npm:pi-codex-search@0.1.5', extensions: [] }] };
  writeFileSync(path, JSON.stringify(original));
  writeFileSync(join(options.agentDir, 'auth.json'), 'do-not-touch');
  writeFileSync(join(options.agentDir, 'keybindings.json'), JSON.stringify({ 'app.session.new': 'ctrl+n' }));
  setup(options);
  const actual = json(path);
  assert.equal(actual.theme, 'light');
  assert.equal(actual.packages.length, 4);
  assert.deepEqual(actual.packages[1], { source: 'npm:pi-codex-search', extensions: [] });
  assert.equal(actual.packages[2], 'git:github.com/larsderidder/pi-browser@32b5baaf7ca0d6258b1d0841cff9c6c88aafff2b');
  assert.equal(json(join(options.agentDir, 'keybindings.json'))['app.session.new'], 'ctrl+n');
  assert.ok(json(join(options.agentDir, 'keybindings.json'))['tui.editor.deleteWordBackward'].includes('ctrl+backspace'));
  assert.equal(json(join(options.home, '.pi', 'pi-codex-search.json')).standaloneEnabled, false);
  assert.equal(readFileSync(join(options.agentDir, 'auth.json'), 'utf8'), 'do-not-touch');
  const files = readdirSync(options.agentDir).sort();
  assert.deepEqual(json(join(options.agentDir, files.find(f => f.startsWith('settings.json.backup-')))), original);
  setup(options);
  assert.deepEqual(readdirSync(options.agentDir).sort(), files);
});

test('dry run neither writes files nor invokes package manager', t => {
  const options = fixture(t);
  setup({ ...options, dryRun: true, configOnly: false });
  assert.deepEqual(readdirSync(options.agentDir), []);
  assert.equal(existsSync(join(options.home, '.pi', 'pi-codex-search.json')), false);
});

test('malformed destination aborts before any settings writes', t => {
  const options = fixture(t);
  writeFileSync(join(options.agentDir, 'keybindings.json'), '{bad json');
  assert.throws(() => setup(options), SyntaxError);
  assert.equal(existsSync(join(options.agentDir, 'settings.json')), false);
});

test('custom agent directory does not relocate extension home configuration', t => {
  const options = fixture(t);
  const agentDir = join(options.home, 'custom-agent');
  setup({ ...options, agentDir });
  assert.ok(existsSync(join(agentDir, 'settings.json')));
  assert.ok(existsSync(join(options.home, '.pi', 'pi-codex-search.json')));
});
