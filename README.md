# my-pi-kit

My personal Pi customization package. Keep reusable resources in Git, and credentials and runtime data outside this repository.

## Structure

- `extensions/`: TypeScript or JavaScript extensions; multi-file extensions use an `index.ts` or `index.js` entry point.
- `skills/`: one folder per skill, containing `SKILL.md` and any supporting files.
- `prompts/`: Markdown prompt templates.
- `themes/`: JSON themes.
- `config/`: managed, non-secret configuration fragments (our convention, not Pi package discovery).
- `scripts/setup.mjs`: our cross-platform configuration/setup helper.

Pi discovers resources from the conventional resource directories above. `extensions/notify.ts` provides completion notifications; the setup script separately configures the community `pi-codex-search` package and pinned GitHub version of `larsderidder/pi-browser`.

### Completion notifications

The notification extension runs when an interactive task settles. On native Windows it uses `extensions/notify-windows.ps1` to find the hosting Windows Terminal process and compare it to the foreground window's process. When they match, no toast (or associated sound) is sent. When another application is focused or the terminal is minimized, the usual Windows toast is requested. Sound still depends on Windows notification settings.

This is a process-level check, not a tab-level check: another tab or window sharing the same Windows Terminal process also suppresses notifications. If terminal ancestry cannot be resolved, it falls back to notifying. WSL and other terminal protocols retain the bundled example's unconditional behavior. Notification failures appear as a Pi warning. Run `/reload` after edits.

## Use this checkout

```bash
pi install ~/codes/my-pi-kit
```

On Windows, you can also use:

```bash
pi install C:/Users/dell/codes/my-pi-kit
```

Local packages load directly from the checkout without copying. After editing resources, run `/reload` in Pi.

## Personal settings

Pi normally reads personal configuration from `~/.pi/agent/`. Installing this package does **not** apply files in `config/` automatically.

### Restore this setup

Requires Node.js 22+ and Pi on PATH. From this checkout:

```bash
npm run setup -- --dry-run  # preview without writes or network calls
npm run setup              # merge configuration and reconcile packages
```

This helper is ours, not an official Pi setup command. It manages only:

| Kit file | Destination |
| --- | --- |
| `config/settings.json` | `~/.pi/agent/settings.json` |
| `config/keybindings.json` | `~/.pi/agent/keybindings.json` |
| `config/pi-codex-search.json` | `~/.pi/pi-codex-search.json` |
| `config/AGENTS.md` (opt-in `--link-agents`) | Symlinks at `~/.codex/AGENTS.md` and `~/.pi/agent/AGENTS.md` |

`PI_CODING_AGENT_DIR` overrides Pi's settings, keybindings, and instruction destinations. The search extension uses the fixed home-level path, even with a custom agent directory.

The script preserves unrelated settings. Kit values override matching keys; nested objects merge, arrays replace. Packages are merged separately: unrelated packages and existing resource filters survive, while kit-managed package sources win (including their version selection). It adds this checkout using its actual path, so no machine-specific path is stored in Git. Changed existing files receive adjacent `.backup-<unique-id>` copies. Repeating setup does not rewrite unchanged configuration.

By default it runs `pi update --extensions`, reconciling **all configured personal packages**, including updating unpinned ones. Use `npm run setup -- --config-only` to write configuration without invoking Pi or using the network. If installation fails, the merged configuration remains; fix the error and rerun. Backups may contain private existing settings: keep them outside Git. Avoid concurrent configuration edits while setup runs.

Package declarations currently use unpinned `npm:pi-codex-search` (installed version checked: 0.1.6) and `git:github.com/larsderidder/pi-browser@32b5baaf7ca0d6258b1d0841cff9c6c88aafff2b` (pinned commit). Setup reconciles all configured packages unless `--config-only` is used. The saved search preferences match pi-codex-search 0.1.6 defaults; experimental standalone browsing is disabled.

### Personal proxy

`config/settings.json` sets `httpProxy` to `http://127.0.0.1:7897`, this machine's Clash Verge Rev mixed port. Keep Clash's core running; System Proxy and TUN can both be off. Restart Pi after applying this setting, then resume your session. Browser traffic and extension-specific clients may need separate configuration. On another machine, change/remove this value if no proxy listens there. To undo, remove `httpProxy` from both the kit fragment and active settings (setup preserves omitted keys), then restart Pi.

### Browser automation

`pi-browser` is third-party executable code with broad browser automation tools. We pinned the reviewed source commit; we have not performed a full security audit. It can connect to a Chrome-compatible browser over CDP, which grants powerful access to that browser and its signed-in pages. Never expose its debugging port to a network or connect your everyday profile unless you intend to give the agent that access.

For an isolated visible browser, reload Pi and run `/browser launch`, then log into sites manually in that browser. It uses a temporary Playwright profile; do not assume login persists after closing it. For a reusable dedicated profile, start a separate Chrome instance with its own user-data directory and a local debugging port, then `/browser connect <port>`. Keep that profile and CDP port private. The npm package named `pi-browser` is a different simple headless page reader; this kit uses the intended `larsderidder/pi-browser` GitHub package.

After setup, run `/reload`. On a new machine, sign in separately using `/login openai-codex`; credentials are never read or copied by this helper. Project search settings and environment variables can override these home preferences.

JSON configuration edits in Pi do not automatically sync back into this repository. Update the reviewed fragments here when you want to keep changes.

## Dollar-sign skill aliases

`extensions/dollar-skills/` lets you type `$skill-name` instead of `/skill:skill-name` at the very start of a message. After `/reload`, for example:

```text
$poteto-mode Fix this bug. Reproduce it first, then verify the fix.
$how Explain authentication in this repository.
$tdd Add a regression test, then fix the bug.
```

Only names in Pi's current skill registry are expanded. Unknown names, dollar signs later in a message, and extension-injected messages stay unchanged. Arguments and attached images are passed through to Pi's normal skill expansion. A tab or newline after the alias is accepted too. `/skill:name` continues to work. These are submission-time aliases, not `$` autocomplete or shell substitutions; use Pi's existing `/skill:` completion to discover names.

## Visual review skill

`skills/visual-review/` explains code changes using verified behavioral deltas, source anchors, and focused review questions. It chooses tables, annotated diffs, or diagrams according to the change; diagrams are optional. It does not edit your project or run tests by default.

After `/reload`, try:

```text
/skill:visual-review Explain the changes in /path/to/project from <base> to <head>
```

For uncommitted changes, explicitly say whether to include staged, unstaged, and untracked files. Ask for SVG/HTML if desired; the skill can use a separately installed `archify` skill for rendering. Examples and a real-patch evaluation checklist are bundled under `skills/visual-review/references/`; effectiveness has not yet been evaluated on your projects.

Run `npm test` for isolated setup, shared-conversation parser, and dollar-sign skill alias tests (no real configuration or network access).

## Shared global instructions

Maintain global rules in `config/AGENTS.md`; both Codex and Pi link directly to that file. Package installation alone does not install these links. To restore/migrate them:

```bash
npm run setup -- --config-only --link-agents --dry-run
npm run setup -- --config-only --link-agents
```

Linking is opt-in because it replaces existing global instructions for both tools. Review/merge any destination-specific rules into the kit first; setup does not merge Markdown. Replaced files or symlinks are renamed to adjacent `.backup-<unique-id>` paths, outside Git; symlink backups preserve the link, not a snapshot of its target. No credentials or session data are copied. All new links are staged before replacement, with rollback on link-install failure; JSON configuration is applied afterward and is not part of that rollback. Avoid concurrent edits/setup runs.

Windows requires Developer Mode or an elevated terminal for symlinks; failure leaves existing instruction paths intact unless rollback itself fails (reported with backup paths). No copy fallback: edits must stay in sync. Repeated setup leaves correct links untouched. Moving the checkout requires rerunning setup from its new location. To undo, remove the new links and rename the desired backups to their original paths. Run `/reload` in Pi; start a new Codex session to pick up changed instructions.

Run `npm test` for isolated setup tests (no real configuration or network access). Tests requiring successful symlink creation explicitly skip on Windows without that privilege; rerun elevated or with Developer Mode for full coverage. Permission-failure preservation is still tested.

Never commit API keys, OAuth credentials, `auth.json`, session history, or other private runtime data. Review settings and model configuration for embedded secrets. `.gitignore` is a safeguard, not a secret scanner.

`"private": true` in `package.json` prevents accidental npm publishing; it does not control GitHub repository visibility.

## Publish to GitHub

Create an empty GitHub repository named `my-pi-kit`, then run these commands from this directory, replacing `YOUR-NAME`:

```bash
git add .
git diff --cached
git commit -m "Initialize personal Pi kit"
git remote add origin https://github.com/YOUR-NAME/my-pi-kit.git
git push -u origin main
```

On another machine, clone and install the local checkout for development, or install directly:

```bash
pi install git:github.com/YOUR-NAME/my-pi-kit
```

Private repositories require appropriate Git authentication. Only install trusted packages: extensions run with Pi's operating-system permissions.

## Package management

```bash
pi list
pi update --extensions
pi remove <source>
```
