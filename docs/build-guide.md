# Build Guide

Generated: 2026-06-08

## Local Cocos Creator

Detected executable:

```powershell
D:\allTheApp\cocos\editors\Creator\3.8.8\CocosCreator.exe
```

If Cocos Creator is installed elsewhere, set:

```powershell
$env:COCOS_CREATOR = 'C:\Path\To\CocosCreator.exe'
```

## Install Dev Tooling

Run once from the project root:

```powershell
npm install
```

This installs TypeScript, ESLint, and Prettier declared in `package.json`.

## Type Check

```powershell
npm run typecheck
```

Behavior:

- Uses project-local `node_modules/.bin/tsc.cmd` when installed.
- Falls back to the MCP extension TypeScript compiler if available.
- Writes logs to `logs/error/typecheck-*.log`.

## Build

Web desktop:

```powershell
npm run build:web-desktop
```

Web mobile:

```powershell
npm run build:web-mobile
```

Direct script form:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/cocos-build.ps1 -Platform web-desktop
```

Logs:

- Build logs: `logs/build/`
- Failed build copies: `logs/error/`

## Preview

```powershell
npm run preview
```

This opens the project in Cocos Creator and records a runtime log entry under `logs/runtime/`.

Current limitation: a fully headless preview server command was not confirmed from the exposed MCP tools. Start preview from the editor after the project opens, or expose MCP `project_start_preview_server` for automation.

## Log Utilities

Read latest log:

```powershell
npm run logs:latest
```

Collect recent log inventory:

```powershell
npm run logs:collect
```

Directory structure:

```text
logs/
├─ build/
├─ runtime/
└─ error/
```

## Build Failure Workflow

1. Run the build command.
2. If it fails, inspect `logs/error/`.
3. Run `npm run logs:latest`.
4. Fix the reported TypeScript, asset, or build configuration issue.
5. Re-run `npm run typecheck`.
6. Re-run the build.

## Current Local Build Result

The one-key build script was executed once. Cocos Creator CLI started, but the build failed before compilation with:

```text
EPERM: operation not permitted, open 'temp\logs\project.log'
```

This usually means Cocos Creator, the MCP extension, or another process is holding the editor log file. Close the editor/MCP process or clear the locked `temp/logs/project.log`, then re-run `npm run build:web-desktop`.

## MCP Build Notes

The MCP extension source advertises build and preview tools, but the currently exposed callable tool set only includes `project_build_project` for build opening and not the complete build-system controls. The extension implementation notes that full build configuration may require direct Editor UI access.

Recommended additional MCP capabilities:

- Query builder worker readiness.
- Start and stop preview server.
- Stream Cocos Console logs.
- Return build task result and build log path.
- Query asset dependencies.
- Query prefab references and reverse references.
- Query and edit physics collision groups on components.
