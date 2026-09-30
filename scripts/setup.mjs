import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { spawnSync } from 'node:child_process';

const kitRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function readObject(path, optional = false) {
  let text;
  try { text = readFileSync(path, 'utf8'); }
  catch (error) {
    if (optional && error.code === 'ENOENT') return {};
    throw error;
  }
  const value = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!object(value)) throw new Error(`Expected a JSON object: ${path}`);
  return value;
}

// Kit values win; unrelated local values survive. Arrays are replaced, except packages.
export function merge(base, patch) {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      throw new Error(`Unsafe configuration key: ${key}`);
    }
    result[key] = object(value) ? merge(object(base[key]) ? base[key] : {}, value) : value;
  }
  return result;
}

function packageId(entry, agentDir, home) {
  const source = typeof entry === 'string' ? entry : entry?.source;
  if (typeof source !== 'string' || !source.trim()) throw new Error('Invalid package source');
  if (source.startsWith('npm:')) {
    const spec = source.slice(4);
    const version = spec.indexOf('@', 1);
    return `npm:${version < 0 ? spec : spec.slice(0, version)}`;
  }
  if (isAbsolute(source) || source.startsWith('.') || source.startsWith('~/')) {
    const path = source.startsWith('~/') ? resolve(home, source.slice(2)) : resolve(agentDir, source);
    return process.platform === 'win32' ? path.toLowerCase() : path;
  }
  if (source.startsWith('git:')) {
    const spec = source.slice(4);
    const ref = spec.lastIndexOf('@');
    return `git:${ref > spec.lastIndexOf('/') ? spec.slice(0, ref) : spec}`;
  }
  return source;
}

export function setup({ home = homedir(), agentDir = process.env.PI_CODING_AGENT_DIR || join(home, '.pi', 'agent'), root = kitRoot, dryRun = false, configOnly = false, log = console.log } = {}) {
  agentDir = resolve(agentDir);
  root = resolve(root);
  const settingsPath = join(agentDir, 'settings.json');
  const current = readObject(settingsPath, true);
  const desired = readObject(join(root, 'config', 'settings.json'));
  if (!Array.isArray(current.packages ?? []) || !Array.isArray(desired.packages ?? [])) {
    throw new Error('settings.packages must be an array');
  }
  const packages = [];
  for (const entry of current.packages ?? []) {
    const id = packageId(entry, agentDir, home);
    if (!packages.some(item => packageId(item, agentDir, home) === id)) packages.push(entry);
  }
  for (const entry of [...(desired.packages ?? []), root]) {
    const id = packageId(entry, agentDir, home);
    const index = packages.findIndex(item => packageId(item, agentDir, home) === id);
    if (index < 0) packages.push(entry);
    else if (typeof packages[index] === 'string') packages[index] = entry;
    else packages[index] = { ...packages[index], ...(object(entry) ? entry : { source: entry }) };
  }
  const settings = { ...merge(current, desired), packages };
  const targets = [
    [settingsPath, current, settings],
    ...[
      ['keybindings.json', join(agentDir, 'keybindings.json')],
      ['pi-codex-search.json', join(home, '.pi', 'pi-codex-search.json')],
    ].map(([name, target]) => {
      const existing = readObject(target, true);
      return [target, existing, merge(existing, readObject(join(root, 'config', name)))];
    }),
  ];
  // Parse and prepare every target before writing anything. Never read auth.json.
  for (const [path, before, after] of targets) {
    if (isDeepStrictEqual(before, after)) { log(`Unchanged: ${path}`); continue; }
    log(`${dryRun ? 'Would write' : 'Writing'}: ${path}`);
    if (dryRun) continue;
    mkdirSync(dirname(path), { recursive: true });
    const backup = `${path}.backup-${randomUUID()}`;
    try { copyFileSync(path, backup); log(`Backup: ${backup}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    writeFileSync(path, `${JSON.stringify(after, null, 2)}\n`, { mode: 0o600 });
  }
  if (!configOnly) {
    log(`${dryRun ? 'Would run' : 'Running'}: pi update --extensions (all configured packages)`);
    if (!dryRun) {
      // Only a fixed command is passed to cmd.exe; no config content is interpolated.
      const windows = process.platform === 'win32';
      const result = spawnSync(windows ? (process.env.ComSpec || 'cmd.exe') : 'pi',
        windows ? ['/d', '/s', '/c', 'pi update --extensions'] : ['update', '--extensions'],
        { cwd: agentDir, stdio: 'inherit', env: { ...process.env, PI_CODING_AGENT_DIR: agentDir } });
      if (result.error || result.status !== 0) {
        throw new Error(`Package reconciliation failed: ${result.error?.message || result.status}. Configuration was saved; retry pi update --extensions.`);
      }
    }
  }
  log(dryRun ? 'Dry run complete; nothing changed.' : 'Setup complete. Run /reload in Pi. On a new machine, sign in separately.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  try {
    for (const arg of args) if (!['--dry-run', '--config-only'].includes(arg)) throw new Error(`Unknown option: ${arg}`);
    setup({ dryRun: args.includes('--dry-run'), configOnly: args.includes('--config-only') });
  } catch (error) {
    console.error(`Setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
