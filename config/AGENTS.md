- When reporting information to me, be extremly concise and sacrifice grammar for the sake of concision.

## Baseline constraints (all work modes)

- Work-mode changes do not waive safety, scope, or authorization requirements. Preserve unrelated user changes; do not overwrite or discard them without explicit authorization.
- Never put credentials, `auth.json`, API keys, session history, or private runtime data in the kit. Review configuration before committing. Do not commit or push unless requested; choosing `oneshot` is not such a request.

## Work modes

- Default to `incremental`. The user may explicitly select `incremental` or `oneshot` in natural language (for example, "这个任务 oneshot，一次做完"). Do not infer oneshot merely from task size, frontend work, or a request to implement a complete feature.
- A mode selection applies only to the current task unless the user explicitly requests session-wide scope. Task-scoped overrides take precedence over the session mode; after task completion or cancellation, return to the session mode (default: `incremental`). Session-wide selections last until explicitly changed and do not carry into other sessions.
- Briefly confirm the selected mode and scope when switching; a clear selection needs no extra approval. If scope is unclear, use task scope. These are conversational instructions, not an implemented command or persistent plugin setting.
- In both modes, validate changes with relevant tests/checks where possible and report changes, results, and any unverified behavior. Neither mode authorizes expanding the task or bypassing necessary clarification or authorization.

### Incremental (default)

The following line limits and per-batch review pauses apply only in `incremental` mode:

- Regardless of request size, the normal budget for each review batch is 200 changed lines or fewer, not 300. A feature needing more than 200 lines must be split into multiple batches of 200 lines or fewer; inability to finish the whole feature in one batch is not grounds for exceeding the budget. Exceed 200 only when even the smallest coherent, independently verifiable increment genuinely cannot fit or be split further; explain why the exception is necessary. Even then, the batch must remain strictly below 300 changed lines: 300 is a hard boundary, never an ordinary target or an allowance for bundling extra work. Count additions plus deletions across all files, including tests, configuration, and documentation; do not treat individual tool calls or files as separate batches.
- Each batch must be independently verifiable, but need not deliver an independent or complete user-facing feature. Partial feature implementation is explicitly allowed: for example, a tested helper, data model, preparatory refactor, or one layer of a larger feature. Keep each increment coherent and the existing code working; validate the increment on its own without relying on future batches. Do not confuse an incomplete overall feature with a broken intermediate state. If no verifiable increment fits the hard limit, stop and ask the user how to proceed rather than exceeding it.
- Validate each batch independently. After completing one batch, summarize the changes and validation, then stop all further operations and wait for explicit human review approval before starting another batch. Do not automatically continue through the remaining request.

### Oneshot (explicit opt-in)

- Complete the agreed task continuously without the incremental line limits or intermediate review pauses. Internal planning, multiple tool calls, and staged implementation are still allowed; oneshot does not mean a single tool call.
- Keep baseline constraints and validation requirements. Stop for genuine blockers or necessary authorization; otherwise finish the task, validate, and provide a final summary for human review. Restore the applicable session mode after a task-scoped oneshot ends.

## Personal Pi customizations

- My Pi kit repository is `~/codes/my-pi-kit` (Windows: `C:/Users/dell/codes/my-pi-kit`). Use it as the source of truth for my custom Pi extensions and portable configuration. Read its `README.md` before modifying Pi customizations.
- The kit is installed as a local Pi package: resources load directly from the checkout. Put extensions in `extensions/`, skills in `skills/`, prompt templates in `prompts/`, and themes in `themes/`. Do not edit Pi's installed release files or third-party installed package code to customize behavior.
- `config/` and `scripts/setup.mjs` are our own conventions, not automatic Pi package features. Keep reusable, non-secret configuration changes in the kit as well as applying them to the active configuration when requested.
- Setup manages `config/settings.json`, `config/keybindings.json`, and `config/pi-codex-search.json`, merging into personal configuration with backups. Opt-in `--link-agents` also links global instruction paths to `config/AGENTS.md`, backing up replaced files/links without merging their contents. Read `scripts/setup.mjs` and `scripts/link-agents.mjs` before extending setup.
- From the kit: `npm test` runs isolated tests; `npm run setup -- --dry-run` previews; `npm run setup -- --config-only` applies configuration without package updates; `npm run setup` also reconciles ALL configured packages via `pi update --extensions` (unpinned packages may update).
- After changing Pi resources or instructions, ask me to run `/reload`; do not claim a reload happened unless confirmed. Local kit edits need no reinstall.
- Global instructions are maintained in `~/codes/my-pi-kit/config/AGENTS.md`. Both `~/.codex/AGENTS.md` and `~/.pi/agent/AGENTS.md` link directly to this source (Pi destination honors `PI_CODING_AGENT_DIR`). Edit the kit source; do not replace the links. Restore with `npm run setup -- --config-only --link-agents`; preview by adding `--dry-run`. Keep these global rules portable and non-secret.
