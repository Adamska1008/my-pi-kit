# WSLc command recipes

These examples target WSL **3.0.1**. PowerShell is the default shell unless marked otherwise. Commands are checked against official documentation and release source, not locally runtime-tested. Adapt image/tool versions to the repository; example tags float. Execute only the selected recipe, not this file from top to bottom.

## Contents

- [Preflight](#preflight)
- [Bind mount and run](#bind-mount-and-run)
- [Build an image](#build-an-image)
- [Reusable environment](#reusable-environment)
- [Local service](#local-service)
- [Volumes and networks](#volumes-and-networks)
- [Shell boundaries](#shell-boundaries)
- [Troubleshooting](#troubleshooting)
- [Acceptance checks](#acceptance-checks)

## Preflight

```powershell
wsl.exe --version
$cli = Get-Command wslc.exe -ErrorAction SilentlyContinue
if (-not $cli) { throw 'Native WSLc is unavailable. Request a stable WSL update/install; do not install a distro.' }
& $cli.Source version
if ($LASTEXITCODE -ne 0) { throw 'WSLc version check failed; inspect the error.' }
& $cli.Source run --help
```

Only with authorization, update existing WSL with `wsl.exe --update`. For a new install, elevated PowerShell: `wsl.exe --install --no-distribution`. Do not default to pre-release. Reboot if the installer requires it; never reboot automatically.

After authorization for network/runtime startup:

```powershell
wslc.exe run --rm hello-world
$smokeExit = $LASTEXITCODE
```

## Bind mount and run

### Read-only mount probe

Set the working directory to the Windows project directory first. Use a filesystem directory, not a non-filesystem PowerShell provider.

```powershell
$project = (Get-Item -LiteralPath .).FullName
if (-not (Test-Path -LiteralPath $project -PathType Container)) { throw 'Expected a project directory.' }
if ($project.Contains(',')) { throw 'Use the comma-path procedure below; this simple mount recipe cannot encode that path.' }
$mount = "type=bind,source=$project,target=/workspace,readonly"
$runArgs = @('run', '--rm', '--mount', $mount, '--workdir', '/workspace', 'alpine:3.22', 'ls', '-la', '/workspace')
wslc.exe @runArgs
$mountExit = $LASTEXITCODE
```

A successful listing proves visibility, not write permissions or good I/O performance. Read-only mount tests also appear in Microsoft's release tests.

Mount fields are CSV, independent of shell quoting. A path containing a comma needs a **quoted CSV field** that survives the native-process invocation: the parser-tested literal is `type=bind,"source=C:\mount,a",target=/data,readonly`. Do not assume wrapping the entire mount argument alone solves commas. Prefer an argv-preserving native launcher (e.g. Python `subprocess.run([...])`) and test the exact mount with `ls` before writes; Windows PowerShell 5.1 and PowerShell 7 differ in embedded quote handling. If quoting cannot be verified, propose a temporary clean-path copy/build context rather than silently mis-mounting.

### Writable Node test run

This grants container code write access to the project. Use only when required and authorized. It creates dependencies/artifacts on the Windows filesystem; `--rm` will not delete them. Check repository scripts and runtime requirements; the image version here is illustrative.

```powershell
$project = (Get-Item -LiteralPath .).FullName
if ($project.Contains(',')) { throw 'Use verified CSV mount quoting for comma paths.' }
$runArgs = @(
    'run', '--rm',
    '--mount', "type=bind,source=$project,target=/workspace",
    '--workdir', '/workspace',
    'node:22-bookworm',
    'sh', '-c', 'npm ci && npm test'
)
wslc.exe @runArgs
$testExit = $LASTEXITCODE
# Report $testExit. In a standalone CI/script entry point, exit $testExit.
```

Do not share Linux-created `node_modules` with native Windows Node. Use a named Linux-native volume for `/workspace/node_modules` if persistent dependencies are wanted:

```powershell
# Add this pair before the image in $runArgs (choose a project-scoped volume name):
# '--mount', 'type=volume,source=agent-myproject-node22-deps,target=/workspace/node_modules'
```

Explicitly record this cache as retained data. A volume hides content at its mount point. Dependency install scripts execute project/package code and can modify writable host mounts. For untrusted code, build a scoped image using COPY and run without a host mount/network where feasible.

## Build an image

Inspect any existing Dockerfile/Containerfile first. Avoid modifying the repository just to prove WSLc works. `--file` makes the chosen build file explicit; the source registers this flag.

```powershell
# In the project root, if this file exists:
wslc.exe build --file Containerfile --tag agent-myproject:test .
$buildExit = $LASTEXITCODE
if ($buildExit -ne 0) { throw "Image build failed: $buildExit" }
wslc.exe image list
wslc.exe run --rm agent-myproject:test
$runExit = $LASTEXITCODE
```

For `Dockerfile`, use `--file Dockerfile`. Confirm `wslc.exe build --help` before build-specific options; do not assume Docker Buildx flags. Building executes RUN instructions and may download images/packages.

An illustrative toolchain image, only when the project needs one and authorizes creating it:

```dockerfile
FROM node:22-bookworm
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npm", "test"]
```

Use an existing lockfile; adapt if absent. Keep credentials, `.env`, `.git`, agent data, host dependencies, and build outputs out of the build context. Verify local ignore-file behavior; do not assume an ignore file is honored without checking. A dedicated staging directory containing only required project files is the fallback when exclusion support is uncertain. Don't put tokens in build args or COPY; consult local build-secret help if credentials are necessary.

## Reusable environment

A named container can amortize setup across commands. This example uses a unique owned name and no host mounts. It remains running until stopped. Do not leave an idle container as an undocumented background resource.

```powershell
$name = 'agent-linux-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
wslc.exe run --detach --rm --name $name alpine:3.22 sleep 3600
$launchExit = $LASTEXITCODE
if ($launchExit -ne 0) { throw "Container launch failed: $launchExit" }
try {
    wslc.exe exec $name uname -a
    $commandExit = $LASTEXITCODE
    # Further selected commands here; do not overwrite a failed result unnoticed.
} finally {
    wslc.exe container stop $name
    $cleanupExit = $LASTEXITCODE
}
# Report $commandExit and $cleanupExit separately.
```

For debugging jobs that exit quickly, omit `--rm` deliberately, inspect/log the owned container, then `container rm $name` after it stops. Do not use `exec` on an exited container. `exec` runs a new process; it doesn't resurrect the init process or preserve environment changes made only in a previous shell process.

## Local service

Check that the desired Windows host port is unused. Use an explicit loopback bind to avoid unintended LAN exposure. The application must listen on the container interface (`0.0.0.0`), not just its container loopback. The 3.0.1 tests exercise explicit host-IP port mappings.

```powershell
$name = 'agent-web-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
wslc.exe run --detach --rm --name $name --publish 127.0.0.1:8080:80 nginx:stable
$launchExit = $LASTEXITCODE
if ($launchExit -ne 0) { throw "Service launch failed: $launchExit" }
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 15; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/' -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) {
        wslc.exe container logs --tail 100 $name
        wslc.exe container inspect $name
        throw 'Service did not become ready within the retry budget.'
    }
    # Use the service here. Stop only when the requested task is finished.
} finally {
    wslc.exe container stop $name
    $cleanupExit = $LASTEXITCODE
}
```

If the user requests a service left running, don't use immediate finally cleanup: record its exact name, URL, and stop command. Non-loopback publishing requires explicit intent. Don't “fix” reachability by disabling Windows Firewall/VPN/security software.

## Volumes and networks

Persist data on a named volume instead of host directories when Linux filesystem semantics matter:

```powershell
wslc.exe volume create agent-myproject-cache
wslc.exe run --rm --mount type=volume,source=agent-myproject-cache,target=/cache alpine:3.22 ls -la /cache
wslc.exe volume list
```

Check each exit code before proceeding. Volumes persist across throwaway containers. Only with authorization, remove a specifically owned unused volume: `wslc.exe volume rm agent-myproject-cache`. Never replace removal of a known volume with `volume prune`.

For multiple containers, confirm network subcommand help. 3.0.1 tests cover:

```powershell
wslc.exe network create --driver bridge agent-myproject-net
# In run options before the image:
# --network agent-myproject-net --network-alias db
wslc.exe network list
```

Use a unique owned network name for real tasks; the fixed one above is explanatory. Start each required service explicitly; aliases require a user-defined network. Apply application-level readiness checks before starting dependents. Remove only the owned network after its containers are stopped/removed: `wslc.exe network rm <owned-network>`. `--network host` is rejected in this release.

## Shell boundaries

### Git Bash/MSYS on Windows

Without disabling conversion, MSYS may rewrite `/workspace`, `/bin/sh`, or mount arguments to Windows paths before `wslc.exe` sees them.

```bash
project_win=$(cygpath -w "$PWD")
# Simple recipe: project path must not contain commas.
MSYS_NO_PATHCONV=1 wslc.exe run --rm \
  --mount "type=bind,source=$project_win,target=/workspace,readonly" \
  --workdir /workspace alpine:3.22 ls -la /workspace
rc=$?
# Preserve/report rc before subsequent commands; exit "$rc" only in a standalone script.
```

Scope the environment override to this invocation; do not globally change the user's shell. For complex embedded quotes, prefer a PowerShell script file or argv-preserving process launcher over nested `bash -c` -> `powershell -Command` -> `sh -c` strings.

### Agent already inside a WSL distribution

```bash
command -v wslc.exe
project_win=$(wslpath -w "$PWD")
wslc.exe run --rm \
  --mount "type=bind,source=$project_win,target=/workspace,readonly" \
  --workdir /workspace alpine:3.22 ls -la /workspace
rc=$?
```

This is still a Windows-native CLI invocation. Do not install a distribution for this recipe; it is only for agents already in one. Projects under a distro home may convert to `\\wsl.localhost\...` UNC paths. That conversion does **not** prove mount access works; probe before writes. If Windows interop is disabled or UNC access fails, use a Windows-side execution tool or an authorized staging copy. Avoid manipulating undocumented WSLc-internal Linux paths.

## Troubleshooting

| Symptom | First action | Avoid |
| --- | --- | --- |
| `wslc.exe` missing | WSL package version, Windows PATH; authorized stable update | Installing Docker/Ubuntu automatically |
| CLI exists but session won't start | Capture exact error; check component/restart/virtualization/policy prerequisites | Global shutdown or system changes without approval |
| Image pull fails | Check reference/tag, registry reachability and managed registry policy | Invented insecure registries or policy bypass |
| Private registry denies access | `wslc.exe login --help`; prefer supported `--password-stdin` with secret-safe input | Passwords in argv/logs or reading unrelated credentials |
| Files missing in mount | Absolute Windows source, literal argument received, MSYS conversion, UNC access | Guessing `/mnt/c` paths for Windows-native CLI |
| Read-only filesystem | Expected for readonly source; arrange authorized scratch/output mount | Dropping readonly silently |
| Permission/CRLF/shebang failures | Inspect actual path/user, line endings, interpreter and mount semantics | Blanket `chmod -R 777` or assuming NTFS acts like ext4 |
| Test failure disappears after cleanup | Capture exit code immediately; keep named container if diagnostics require it | Reporting cleanup exit code as test result |
| Service not reachable | Logs/inspect, bounded readiness, listen address, host port conflict and mapping | `--network host`, disabling firewall |
| Repeated I/O slow | Measure; consider COPY into image or named Linux-native cache volume | Assuming legacy WSL filesystem advice directly applies to virtiofs |
| Unsupported Docker flag/integration | Local subcommand help, bundled 3.0.1 limits, targeted new research | Blind `docker` -> `wslc` substitution |

Useful scoped diagnostics:

```powershell
# Set $name to the exact owned name/ID and $image to the chosen image reference.
wslc.exe container list --all
wslc.exe container inspect $name
wslc.exe container logs --tail 100 $name
wslc.exe image inspect $image
wslc.exe info
```

Redact secrets from inspect/log output before including it in reports. These commands may initialize service infrastructure; they are diagnostics, not promises of zero side effects. Use `logs --follow` only with a deliberate timeout. Confirm `--format` values with local help if automation needs machine-readable output; don't assume Docker Go-template formats.

## Acceptance checks

Perform on a WSLc-capable host when authorized. This is a test plan, not a claim of completed execution:

1. Version/help checks succeed without installing a distro or separate engine.
2. `run --rm hello-world` succeeds; no leftover task container.
3. A read-only mount lists the intended Windows project; test paths with spaces and non-ASCII names. Probe comma/UNC paths separately before claiming support.
4. `wslc.exe run --rm alpine:3.22 sh -c 'exit 42'` yields native exit code 42; cleanup doesn't mask it.
5. A write attempted on a read-only mount fails and leaves the host unchanged. Use a disposable fixture, not a real repository.
6. An authorized writable fixture produces the expected artifact; artifact persists after `--rm`.
7. A named-volume fixture persists across two containers and is removed only by exact owned name after approval.
8. A detached service passes bounded readiness, then exact scoped stop removes the `--rm` container. No unrelated resources are modified.
9. An intentional application failure produces a failure report rather than a readiness/success claim.
10. Git Bash path conversion is disabled only for the selected invocation; argv/exit code remain intact.
