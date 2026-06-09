# LAN UDP Host Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a LAN 1v1 flow where Node provides UDP room discovery and a host-authoritative sidecar while Cocos keeps using WebSocket for browser preview compatibility.

**Architecture:** The Cocos client connects to a local Node sidecar over WebSocket. The sidecar uses UDP port 12345 for room advertisements and UDP port 12346 for host/client messages, while the player who creates the room is the only authority for gameplay state. Existing GameManager code keeps rendering in Cocos and sends inputs/state through the NetworkClient abstraction.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node.js `dgram`, WebSocket `ws`, JSON messages.

---

### Task 1: Protocol and Room Model

**Files:**
- Modify: `assets/scripts/net/NetworkTypes.ts`
- Modify: `server/room.ts`
- Test: `tests/lan-room.test.ts`

- [x] Add lowercase UDP-inspired message names while keeping legacy uppercase aliases for existing Cocos handlers.
- [x] Extend the room model so host membership, join responses, remote endpoint metadata, and authoritative forwarding are explicit.
- [x] Add tests for 1v1 capacity, join response shape, and host-targeted client input forwarding.

### Task 2: Node Sidecar UDP Discovery and Bridge

**Files:**
- Modify: `server/lan-server.js`
- Test: command-line smoke coverage through `server/room.ts` unit tests and Node syntax check.

- [x] Add UDP broadcast discovery on port 12345 for host-created rooms.
- [x] Add UDP game socket on port 12346 for `join_request`, `join_response`, `heartbeat`, `disconnect`, `player_input`, `game_start`, `game_state`, `game_end`, and `map_sync`.
- [x] Bridge local Cocos WebSocket messages to UDP host/client messages and emit uppercase compatibility events back to Cocos.

### Task 3: Cocos Network Client and GameManager Bridge

**Files:**
- Modify: `assets/scripts/net/NetworkClient.ts`
- Modify: `assets/scripts/core/GameManager.ts`

- [x] Add room creation, room browsing, and selected-room join APIs to `NetworkClient`.
- [x] Render create/search/join controls in the existing online room view.
- [x] Send player input from client to host and only send ball/score state from host to client.

### Task 4: Verification and Publish

**Files:**
- Modify: `package.json`
- Verify: `npm test`, `npm run typecheck`, `npm run lint`

- [x] Add a working `npm test` script matching the current test setup.
- [x] Run tests, typecheck, and lint.
- [x] Commit and push changes to the current branch.
