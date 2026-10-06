import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readlinkSync, readdirSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { linkAgents } from '../scripts/link-agents.mjs';
import { setup } from '../scripts/setup.mjs';

function fixture(t) {
  const home = mkdtempSync(join(tmpdir(), 'kit-agents-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const root = join(home, 'kit');
  const agentDir = join(home, 'custom-agent');
  mkdirSync(join(root, 'config'), { recursive: true });
  const source = join(root, 'config', 'AGENTS.md');
  writeFileSync(source, 'shared instructions');
  return { home, root, agentDir, source, log: () => {} };
}

function canLink(t, o) {
  try { symlinkSync(o.source, join(o.home, 'probe'), 'file'); return true; }
  catch (error) {
    if (process.platform !== 'win32' || error.code !== 'EPERM') throw error;
    t.skip('Windows symlink privilege unavailable; rerun elevated or with Developer Mode');
    return false;
  }
}

test('links both tools, preserves old file/link, stays live and idempotent', t => {
  const o = fixture(t);
  if (!canLink(t, o)) return;
  const codex = join(o.home, '.codex');
  mkdirSync(codex);
  mkdirSync(o.agentDir);
  const c = join(codex, 'AGENTS.md'), p = join(o.agentDir, 'AGENTS.md');
  writeFileSync(c, 'old rules');
  symlinkSync(c, p, 'file');
  linkAgents(o);
  for (const path of [c, p]) assert.equal(readlinkSync(path), resolve(o.source));
  assert.equal(readFileSync(join(codex, readdirSync(codex).find(n => n.includes('.backup-'))), 'utf8'), 'old rules');
  assert.equal(readlinkSync(join(o.agentDir, readdirSync(o.agentDir).find(n => n.includes('.backup-')))), c);
  const before = [readdirSync(codex), readdirSync(o.agentDir)];
  linkAgents(o);
  assert.deepEqual([readdirSync(codex), readdirSync(o.agentDir)], before);
  writeFileSync(o.source, 'updated');
  for (const path of [c, p]) assert.equal(readFileSync(path, 'utf8'), 'updated');
});

test('permission failure preserves existing rules and removes staged files', t => {
  const o = fixture(t);
  const dir = join(o.home, '.codex');
  mkdirSync(dir);
  const path = join(dir, 'AGENTS.md');
  writeFileSync(path, 'original');
  try {
    linkAgents(o);
    assert.equal(readFileSync(path, 'utf8'), 'shared instructions');
  } catch (error) {
    assert.equal(error.cause?.code, 'EPERM');
    assert.match(error.message, /Developer Mode/);
    assert.equal(readFileSync(path, 'utf8'), 'original');
    assert.deepEqual(readdirSync(dir), ['AGENTS.md']);
    assert.equal(existsSync(join(o.agentDir, 'AGENTS.md')), false);
  }
});

test('dry-run creates no destinations; directories rejected before replacement', t => {
  const o = fixture(t);
  linkAgents({ ...o, dryRun: true });
  assert.equal(existsSync(o.agentDir), false);
  assert.equal(existsSync(join(o.home, '.codex')), false);
  mkdirSync(join(o.agentDir, 'AGENTS.md'), { recursive: true });
  assert.throws(() => linkAgents(o), /Not a file or symlink/);
  assert.equal(existsSync(join(o.home, '.codex')), false);
});

test('staging failure leaves old destination intact and cleans temporary links', t => {
  const o = fixture(t);
  if (!canLink(t, o)) return;
  mkdirSync(join(o.home, '.codex'));
  const c = join(o.home, '.codex', 'AGENTS.md');
  writeFileSync(c, 'keep me');
  writeFileSync(o.agentDir, 'blocks directory creation');
  assert.throws(() => linkAgents(o));
  assert.equal(readFileSync(c, 'utf8'), 'keep me');
  assert.deepEqual(readdirSync(join(o.home, '.codex')), ['AGENTS.md']);
});

test('setup opt-in installs instructions into isolated home', t => {
  const o = fixture(t);
  if (!canLink(t, o)) return;
  for (const name of ['settings.json', 'keybindings.json', 'pi-codex-search.json']) {
    writeFileSync(join(o.root, 'config', name), '{}');
  }
  setup({ ...o, configOnly: true, linkInstructions: true });
  assert.equal(readFileSync(join(o.agentDir, 'AGENTS.md'), 'utf8'), 'shared instructions');
  assert.equal(readFileSync(join(o.home, '.codex', 'AGENTS.md'), 'utf8'), 'shared instructions');
});
