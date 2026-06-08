# MemeBadminton Project Architecture

Generated: 2026-06-08

## Summary

MemeBadminton is a Cocos Creator badminton prototype using TypeScript game scripts and a single playable scene.

## Engine And Tooling

- Engine: Cocos Creator 3.8.8, declared in `package.json`.
- MCP server: `settings/mcp-server.json` uses port `3000`, `autoStart=false`.
- Language: TypeScript.
- Editor generated type base: `temp/tsconfig.cocos.json`.
- Cocos type declarations:
    - `temp/declarations/cc.custom-macro`
    - `temp/declarations/jsb`
    - `temp/declarations/cc`
    - `temp/declarations/cc.env`

## Directory Map

- `assets/`: game source assets.
- `assets/scripts/core/`: game state and input abstraction.
- `assets/scripts/player/`: player control and racket hit behavior.
- `assets/scripts/ball/`: floor collision scoring hook.
- `assets/scenes/`: Cocos scene assets.
- `assets/prefabs/`: prefab/material resources. Current MCP prefab query found no prefab assets.
- `assets/source/`: image source assets.
- `settings/`: project settings committed by Cocos.
- `profiles/`: local editor profile settings.
- `extensions/cocos-mcp-server/`: MCP editor extension source and built output.
- `docs/`: design and operational documentation.
- `logs/`: generated build, runtime, and error logs.
- `scripts/`: automation scripts for type checking, build, preview, and log collection.

## TypeScript Configuration

Root `tsconfig.json` extends `temp/tsconfig.cocos.json` and now adds project aliases:

- `@assets/* -> assets/*`
- `@scripts/* -> assets/scripts/*`
- `@core/* -> assets/scripts/core/*`
- `@player/* -> assets/scripts/player/*`
- `@ball/* -> assets/scripts/ball/*`

The root config keeps `strict=false` to match the current codebase, while the Cocos-generated base has strict options and Cocos API type declarations.

## Build And Preview Configuration

- Start scene: `profiles/v2/packages/preview.json` points to scene UUID `b00da435-df28-4eb7-9611-8618c9ec0849`.
- Build profile: `profiles/v2/packages/builder.json` currently only stores log level metadata.
- Preview profile: current preview platform is `gameView`.
- Cocos executable found locally: `D:\allTheApp\cocos\editors\Creator\3.8.8\CocosCreator.exe`.

## Runtime Architecture

Primary runtime scripts:

- `GameManager`: owns scoring, serve state, round state, and ball reset.
- `PlayerController`: owns keyboard input, player movement, swing animation, serve attempt, and distance-based hit impulse.
- `InputRouter`: command abstraction intended for future networking, but not currently wired into the scene.
- `FloorCollision`: notifies `GameManager` when the shuttlecock hits the bottom wall.
- `RacketHit`: physics-contact-based hit component, currently separate from the active distance-based hit flow.

## Current Scene Assets

- Scene: `assets/scenes/scene.scene`
- Scene UUID: `b00da435-df28-4eb7-9611-8618c9ec0849`
- Material asset: `assets/prefabs/BallMat.pmtl`
- Prefabs: none found by MCP in `db://assets/prefabs`.

## High-Risk Areas

- Physics groups are configured in project settings, but key colliders still use `DEFAULT`.
- `InputRouter` is not integrated with `PlayerController`; two input strategies exist.
- Build automation depends on Cocos Creator CLI behavior and should be verified from the installed editor.
- MCP cannot currently perform full asset dependency or unused asset analysis.

## Development Agent Workflow

Use this sequence for future feature work:

1. Read the requirement.
2. Run `git status --short --branch`.
3. Use MCP to inspect affected scene nodes and components.
4. Identify impacted files and scene references.
5. Modify code or configuration.
6. Run `npm run typecheck`.
7. Run the relevant build script, for example `npm run build:web-desktop`.
8. Run `npm run logs:latest` and inspect failures.
9. Fix errors and repeat validation.
10. Generate a change report and commit with `feat:`, `fix:`, `refactor:`, or `docs:`.

## Rollback Plan

For severe failures on this branch:

1. Capture current state with `git status --short`.
2. Keep generated logs under `logs/error/`.
3. Revert only the problematic commit with `git revert <commit>`.
4. Avoid `git reset --hard` unless explicitly requested.
