---
name: wsl-containers
description: Run Linux container images directly on Windows using native WSL containers (WSLc, wslc.exe, WSL 3.x), without installing an Ubuntu-style distribution or Docker Desktop. Use for disposable Linux build/test environments, containerized tools, Windows project bind mounts, Containerfile builds, local services, volumes, networks, and WSLc troubleshooting. Do not substitute traditional docker-via-wsl instructions for this workflow.
---

# Native WSL containers

Use `wslc.exe` from Windows to build and run Linux container images. No user-installed Linux distribution or separately installed Docker engine is needed. WSL still supplies a Linux kernel/VM and managed container infrastructure: “no distro” does not mean “no Linux runtime.” A container image itself includes its own userspace/root filesystem.

## Evidence and scope

Researched 2026-10-01 against Microsoft documentation and the **WSL 3.0.1 release source**. WSLc appeared in 2.9.3 preview and became generally available in 3.0.1 on 2026-09-29. Package versions and WSL 1/2 distribution architecture are different concepts.

The bundled recipes were documentation/source-checked, **not executed against WSLc locally**. The authoring host had WSL 2.6.1 and no `wslc.exe`. Never represent these as locally tested commands. The installed binary's help takes precedence over this snapshot.

Read [command recipes](references/recipes.md) for the selected task. Read [sources and compatibility](references/sources.md) when version behavior, architecture, or integration matters. Normal use requires local help, not repeated web searches. Research again only for an unsupported/new feature or a discrepancy with the installed version.

## Workflow

### 1. Establish the execution boundary

Identify the host shell, Windows project path, required image/toolchain, command, required writes, network access, and whether the environment is disposable or persistent. Inspect the repository's existing build/test instructions and container files before choosing an image.

Prefer direct Windows PowerShell/native process invocation. Do not install Ubuntu or Docker Desktop just to use WSLc. Do not invoke `wsl -d Ubuntu docker ...` as a substitute.

From PowerShell, perform read-only capability checks:

```powershell
wsl.exe --version
Get-Command wslc.exe -ErrorAction SilentlyContinue
# Only if the binary is found:
wslc.exe version
wslc.exe --help
wslc.exe run --help
```

If WSLc is absent, stop and report the prerequisite. With explicit user authorization:

- Existing WSL: `wsl.exe --update` (stable channel, not pre-release by default).
- Fresh WSL installation, from elevated PowerShell: `wsl.exe --install --no-distribution`.
- Honor restart/elevation requirements; recheck version and binary afterward.

Do not change Windows optional features, update WSL, restart/shut down WSL, or install a distro without permission. A version number alone does not prove the CLI works; policy or missing components may block it.

An authorized smoke test is `wslc.exe run --rm hello-world`. This can download an image, start runtime infrastructure, and use disk/network; it is not a read-only check.

### 2. Choose the smallest suitable workflow

| Need | Approach |
| --- | --- |
| One Linux command/build/test | Foreground `run --rm`, no TTY, explicit image |
| Inspect source without modification | Read-only Windows bind mount |
| Build writes artifacts into repository | Explicitly authorize writable project mount |
| Repeated commands with shared process/files | Named detached container plus `exec`; bounded lifetime |
| Toolchain/dependencies captured reproducibly | Existing Dockerfile/Containerfile or a scoped new Containerfile |
| Persistent Linux-native data/cache | Named volume; preserve unless deletion is requested |
| Local web/database service | Named detached container, explicit loopback port, readiness check |
| Multiple interacting services | Explicit user-defined network; no assumed Compose support |

Choose an image matching the project's runtime version and host architecture. Prefer existing pinned tags/digests; floating example tags are not reproducibility guarantees. Don't silently switch glibc applications to Alpine/musl. Containers are not a safe place to execute arbitrary hostile code with host access.

### 3. Construct commands safely

- WSLc options go **before** the image (or container ID for `exec`); command and its arguments go afterward.
- `--workdir /workspace` is a Linux path. Bind `source=` is an absolute **Windows** path, not `/mnt/c/...` or Git Bash `/c/...`.
- Prefer `--mount "type=bind,source=C:\path,target=/workspace,readonly"` over colon-delimited `-v` for Windows paths.
- Use argument arrays/native process APIs where available. Never build shell commands by concatenating untrusted paths, image names, or user text.
- `sh -c` is needed for Linux pipelines/operators; it must exist in the image. Prefer direct argv for simple commands. An image ENTRYPOINT can affect appended commands; use `--entrypoint` deliberately when needed.
- Noninteractive jobs: omit `-t` and normally `-i`. Use `-i` only for actual stdin streaming; `-it` only for a real interactive terminal.
- Use a unique owned name such as `agent-test-<unique-id>` for persistent/detached work. Never replace a preexisting container with a colliding name.
- Mount only required directories. Read-only source plus a writable scratch volume/output directory is safer than mounting a whole home directory or drive.
- Never mount credentials, SSH keys, agent configuration, or Docker sockets by default. Do not expose secrets in command arguments, logs, build context, or images.

For Git Bash/MSYS, set `MSYS_NO_PATHCONV=1` for the single native command and convert the host path with `cygpath -w`. For an agent inside a WSL distro, invoke the Windows binary (`wslc.exe`) and convert paths with `wslpath -w`; do not treat the distro's filesystem as the WSLc session filesystem. UNC/distro-path mounts require a probe; no automatic performance or accessibility guarantee. See recipes.

### 4. Execute, verify, preserve the outcome

Run within the task's time budget. Record image reference, mounts and write access, command, name/ID when applicable, exit code, and useful output.

Foreground `run` and `exec` propagate process exit codes (source evidence bundled). In PowerShell capture `$LASTEXITCODE` **immediately**, before cleanup or any other native command. A successful detached `run -d` only confirms launch, not application readiness or test success. Verify logs and an application-level health/readiness request separately, with a bounded timeout.

On failure, distinguish prerequisite, registry/pull, startup, mount/permission, application, and network failures. Inspect/log the exact owned container. A `--rm` container's logs/metadata may disappear on exit; if diagnostics require retention, agree on a named run without `--rm` and scoped cleanup.

### 5. Clean up only owned resources

Stop the exact named container created for this task. For detached `--rm`, stopping it also removes it. Otherwise remove the exact owned stopped container using `wslc.exe container rm <name-or-id>`.

Do not run broad container/image/volume/network prune, forced deletion, session termination, or `wsl --shutdown` as routine cleanup. Preserve named volumes and downloaded/built images by default; removal requires explicit scope and authorization. `--rm` does not make host filesystem writes temporary.

Report failures honestly, including interrupted runs and incomplete cleanup. End with the tested command/outcome and resources intentionally left behind, not “environment works” based only on CLI availability.

## Compatibility guardrails (3.0.1 snapshot)

- Linux container images work; this is not Windows container support.
- No shipped `wslc compose` in the GA announcement; Compose is on the roadmap. Do not invent it.
- No assumed Docker Engine API endpoint, `DOCKER_HOST` recipe, Docker SDK, Testcontainers, Buildx, Kubernetes, or Dev Container compatibility. Verify the specific integration/version rather than inferring it from image compatibility.
- `--network host` is rejected by 3.0.1 tests; publish ports/use bridge networks instead.
- Don't copy Docker flags indiscriminately. Core run flags include `--mount`, `--workdir`, `--env`, `--env-file`, `--user`, `--entrypoint`, `--pull`, `--memory`, `--cpus`, `--gpus`, and `--network`; availability and semantics must match local help. In particular do not assume Docker fractional CPU or `--platform` behavior.
- GPU API/CLI support exists, but usable hardware, Windows driver, runtime/image compatibility, and actual workload success need separate verification.
- WSLc data is session-scoped; Docker Desktop images/volumes are not automatically the same store. Don't manipulate runtime VHDs or internal services directly.
- Respect managed-device registry/feature policy; do not bypass it by changing security, proxy, or firewall settings.
