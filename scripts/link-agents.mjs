import { lstatSync, readFileSync, readlinkSync, mkdirSync, symlinkSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

function stat(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Stage every symlink before replacing destinations; never write through old links.
export function linkAgents({ root, home, agentDir, dryRun = false, log = console.log }) {
  const source = resolve(root, 'config', 'AGENTS.md');
  if (!stat(source)?.isFile()) throw new Error(`Expected regular instructions file: ${source}`);
  readFileSync(source, 'utf8');
  const paths = [...new Set([resolve(home, '.codex', 'AGENTS.md'), resolve(agentDir, 'AGENTS.md')])];
  const pending = [];
  for (const path of paths) {
    if (path === source) throw new Error('Instructions source cannot also be a destination');
    const before = stat(path);
    if (before && !before.isFile() && !before.isSymbolicLink()) throw new Error(`Not a file or symlink: ${path}`);
    if (before?.isSymbolicLink() && resolve(dirname(path), readlinkSync(path)) === source) {
      log(`Unchanged: ${path}`);
      continue;
    }
    pending.push({ path, before, temp: `${path}.link-${randomUUID()}`, backup: `${path}.backup-${randomUUID()}` });
    log(`${dryRun ? 'Would link' : 'Linking'}: ${path} -> ${source}`);
  }
  if (dryRun) return;
  try {
    for (const item of pending) {
      mkdirSync(dirname(item.path), { recursive: true });
      symlinkSync(source, item.temp, 'file');
    }
    for (const item of pending) {
      if (item.before) {
        renameSync(item.path, item.backup);
        item.saved = true;
        log(`Backup: ${item.backup}`);
      }
      renameSync(item.temp, item.path);
      item.installed = true;
    }
  } catch (error) {
    const failures = [];
    for (const item of [...pending].reverse()) {
      try {
        if (item.installed) unlinkSync(item.path);
        if (item.saved) renameSync(item.backup, item.path);
      } catch (rollback) { failures.push(`${item.path}: ${rollback.message}; backup: ${item.backup}`); }
    }
    throw new Error(`AGENTS linking failed: ${error.message}. On Windows, enable Developer Mode or use an elevated terminal.${failures.length ? ` Rollback failures: ${failures.join('; ')}` : ''}`, { cause: error });
  } finally {
    for (const item of pending) if (stat(item.temp)) unlinkSync(item.temp);
  }
}
