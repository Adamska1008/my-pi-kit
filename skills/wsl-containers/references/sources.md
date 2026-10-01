# Research evidence and compatibility snapshot

Research date: **2026-10-01**. Baseline: **microsoft/WSL tag 3.0.1**, published 2026-09-29. Prefer these bundled conclusions for normal tasks; verify local CLI help. Revisit upstream only when a version discrepancy or new integration needs it.

## Official documentation

| Source | Verified conclusion |
| --- | --- |
| [WSL 3.0.1 release](https://github.com/microsoft/WSL/releases/tag/3.0.1) | WSLc generally available; SDK stdin support and preview-label removal included |
| [GA announcement, 2026-09-29](https://blogs.windows.com/windowsdeveloper/2026/09/29/wsl-containers-now-generally-available/) | Built-in WSLc CLI/API, Windows containerized Linux workflows, enterprise controls; Compose still future work |
| [WSL container overview](https://learn.microsoft.com/en-us/windows/wsl/wsl-container) | WSL >=2.9.3, `wslc.exe`, CLI/API surface and SDK package |
| [Getting started](https://learn.microsoft.com/en-us/windows/wsl/tutorials/wsl-containers) | Stable `wsl --update`, `version`, automatic image pull, `run --rm`, detached published service, exec, build, logs, inspect, scoped stop |
| [Basic WSL commands](https://learn.microsoft.com/en-us/windows/wsl/basic-commands) | `wsl --install --no-distribution` installs WSL without a distro |
| [Architecture deep dive](https://devblogs.microsoft.com/commandline/wslc-architecture-deep-dive/) | Per-session process/storage architecture, virtiofs host directory sharing, Consommé networking |
| [Docker API endpoint request #40976](https://github.com/microsoft/WSL/issues/40976) | Docker-compatible endpoint is a feature request; proposed `wslc_docker` named pipe/settings are not a working configuration recipe |

The Microsoft Learn overview/tutorial were also read directly from their MicrosoftDocs repository Markdown through the GitHub contents API, rather than relying only on search excerpts:

- [Overview Markdown](https://github.com/MicrosoftDocs/WSL/blob/main/WSL/wsl-container.md)
- [Tutorial Markdown](https://github.com/MicrosoftDocs/WSL/blob/main/WSL/tutorials/wsl-containers.md)

Both had `ms.date: 09/29/2026` during research. Earlier indexed snippets still mentioned pre-release updates; the current source says **stable `wsl --update`**. Release metadata was verified directly using GitHub's release API. This avoids conflating stale 2.9.3 preview instructions with 3.0.1 GA instructions.

## Release-pinned CLI evidence

These links are pinned to **3.0.1**, not moving master. They were fetched and inspected during authoring.

| Source | Evidence used |
| --- | --- |
| [RootCommand.cpp](https://github.com/microsoft/WSL/blob/3.0.1/src/windows/wslc/commands/RootCommand.cpp) | Root run/exec/build/login/logs/info aliases; global `--session`; no registered Compose command |
| [ContainerRunCommand.cpp](https://github.com/microsoft/WSL/blob/3.0.1/src/windows/wslc/commands/ContainerRunCommand.cpp) | Supported run options: mounts, env, workdir, detach/rm, networking, resources, GPU, entrypoint |
| [ContainerExecCommand.cpp](https://github.com/microsoft/WSL/blob/3.0.1/src/windows/wslc/commands/ContainerExecCommand.cpp) | Exec accepts command/forward args, env, workdir, user, stdin/TTY and detach |
| [ArgumentDefinitions.h](https://github.com/microsoft/WSL/blob/3.0.1/src/windows/wslc/arguments/ArgumentDefinitions.h) | Exact spellings/aliases; `--workdir/-w`, `--file/-f`, `--tag/-t`, `--mount`, `--password-stdin`; cpus has int64 conversion, not assumed fractional Docker CPUs |
| [ContainerListCommand.cpp](https://github.com/microsoft/WSL/blob/3.0.1/src/windows/wslc/commands/ContainerListCommand.cpp) | `--all`, `--format` options exist; format semantics must be checked rather than assuming Docker templates |
| [ContainerLogsCommand.cpp](https://github.com/microsoft/WSL/blob/3.0.1/src/windows/wslc/commands/ContainerLogsCommand.cpp) | `--tail`, `--follow`, timestamps/time-window support |
| [ImageBuildCommand.cpp](https://github.com/microsoft/WSL/blob/3.0.1/src/windows/wslc/commands/ImageBuildCommand.cpp) | Explicit `--file`, `--tag`, build args, targets, secrets, cache/progress/output options registered |
| [RegistryCommand.cpp](https://github.com/microsoft/WSL/blob/3.0.1/src/windows/wslc/commands/RegistryCommand.cpp) | Login command uses username/password/stdin options; don't expose credentials in args |
| [ContainerTasks.cpp](https://github.com/microsoft/WSL/blob/3.0.1/src/windows/wslc/tasks/ContainerTasks.cpp) | Run and exec assign CLI exit code from ContainerService result; copy implementation distinguishes host/container paths |
| [Mount parser tests](https://github.com/microsoft/WSL/blob/3.0.1/test/windows/wslc/WSLCCLIMountParserUnitTests.cpp) | Windows bind paths, spaces, quoted CSV comma fields, readonly, volume/tmpfs types, absolute container targets, rejected unsupported mount options |
| [Run end-to-end tests](https://github.com/microsoft/WSL/blob/3.0.1/test/windows/wslc/e2e/WSLCE2EContainerRunTests.cpp) | Bind mount readonly and named-volume persistence, write failure exit code, explicit host IP port mappings, rejected host networking, bridge networks/aliases |
| [Exec end-to-end tests](https://github.com/microsoft/WSL/blob/3.0.1/test/windows/wslc/e2e/WSLCE2EContainerExecTests.cpp) | `Exec_ExitCode_Propagates`: `sh -c "exit 42"` returns CLI exit code 42; workdir and env tests |

Source/tests are evidence of intended implementation, not proof every host/image behaves identically. We did **not** build WSL, execute Microsoft's test suite, benchmark filesystems, or runtime-test these recipes.

## Important boundaries

### No distro, but still Linux infrastructure

You do not need a registered Ubuntu/Debian distribution or your own Linux engine installation. WSL still provides a kernel/VM and container runtime. Images still carry userspace files. This skill doesn't claim Linux containers execute without Linux or without storage overhead.

### Sessions and storage

The architecture describes privileged `wslservice.exe` delegating session work to a user-context `wslcsession.exe`. Sessions have their own VHD storage for images/containers/networks/volumes. A Windows bind mount is shared using virtiofs; named Linux-native volumes avoid making all data live on NTFS. Don't assume Docker Desktop's image store is shared with WSLc or point tools at runtime-internal VHD files.

Local CLI exposes global `--session`, but do not invent root `session create` recipes: the inspected root command registry did not expose the internal SessionCommand implementation. Configure advanced session/storage behavior only from installed help/official settings documentation with user authorization.

### Networking

WSLc uses Consommé, a user-context Windows networking design. Containers use bridge networks; explicit port publishing maps a Windows host endpoint to a container port. GA source tests reject `--network host`. Avoid translating traditional WSL `.wslconfig` NAT/mirrored networking advice directly into WSLc configuration. Windows firewall, VPN, proxy, registry policy, and application bind addresses still affect success.

### Docker-compatible images versus Docker-compatible tooling

Docker images and a familiar CLI do not imply a Docker Engine API endpoint or full CLI equivalence. In this research snapshot:

- Compose support is planned, not shipped according to the GA announcement.
- Issue #40976 requests an API-compatible endpoint; don't copy proposed `DOCKER_HOST` pipes/settings as if implemented.
- Docker SDKs/Testcontainers and tools that require a daemon socket need independent compatibility verification.
- The GA announcement mentions integrations including VS Code Dev Containers/Aspire. This skill does **not** deny those integrations; it declines to promise them without checking their exact setup/version. Don't generalize them to all Docker-dependent tools.
- API/CLI GPU support doesn't prove a specific CUDA workload works on the current Windows GPU driver/image.

### SDK use (not the default agent execution path)

The official SDK NuGet package is `Microsoft.WSL.Containers`, with C, C#, and C++ projections and [API reference](https://wsl.dev/api-reference/). Object flow: `WslcService` prerequisite checks -> `Session` image/storage ownership -> `Container` lifecycle -> `Process` I/O, signals, exit observation. See [official samples](https://github.com/microsoft/WSL/tree/3.0.1/doc/samples).

Use CLI recipes for agent command execution. If writing a Windows application embedding containers, consult SDK lifetime/callback documentation; don't translate CLI recipes into guessed API calls. The overview still labels the C++/WinRT projection as preview.

## Refresh policy

When upstream changes, update the baseline tag, date, affected recipes, and evidence table together. Prefer official released documentation plus release-tag source/tests; treat issue comments and search excerpts as leads, not API contracts. Only claim runtime validation after recording host/WSL versions, actual commands, exit codes, and cleanup outcomes.
