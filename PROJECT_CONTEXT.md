# PROJECT_CONTEXT.md

生成日期：2026-06-10

本文只总结当前项目中真实存在的文件、配置、脚本和已存在文档记录的信息。没有运行测试、构建或 Cocos 预览。

## 1. 项目技术栈

- 项目名：`MemeBadminton`，见 `package.json`。
- 引擎：Cocos Creator `3.8.8`，见 `package.json` 的 `creator.version`。
- 游戏逻辑语言：TypeScript，脚本位于 `assets/scripts/**/*.ts`。
- TypeScript 配置：
  - `tsconfig.json`：Cocos 项目脚本配置，继承 `temp/tsconfig.cocos.json`，`strict=false`，包含 `assets/scripts/**/*.ts`。
  - `tsconfig.tests.json`：测试编译配置，`strict=true`，输出到 `temp/test-dist`。
- Node/npm：
  - `package.json`
  - `package-lock.json`
  - `node_modules/` 当前存在，但被 `.gitignore` 忽略。
- 运行时依赖：
  - `ws`：LAN WebSocket 服务端使用。
- 开发依赖：
  - `typescript`
  - `eslint`
  - `typescript-eslint`
  - `@typescript-eslint/parser`
  - `@typescript-eslint/eslint-plugin`
  - `@eslint/js`
  - `prettier`
- 服务端/联机：
  - `server/lan-server.js`：Node WebSocket + UDP LAN 发现/中继服务。
  - `server/lan-discovery.js`：局域网广播地址和本机 IPv4 地址工具。
  - `server/room.ts`：房间模型，供测试编译。
- 自动化脚本：
  - `scripts/typecheck.ps1`
  - `scripts/cocos-build.ps1`
  - `scripts/cocos-preview.ps1`
  - `scripts/read-latest-log.ps1`
  - `scripts/collect-logs.ps1`
- 代码检查/格式化配置：
  - `eslint.config.mjs`
  - `.prettierrc.json`
  - `.prettierignore`
- Cocos/MCP 相关：
  - `settings/mcp-server.json`
  - `extensions/cocos-mcp-server/` 当前存在，但 `extensions/` 被 `.gitignore` 忽略。

## 2. 目录结构说明

- `assets/`：Cocos 游戏资源和脚本。
- `assets/scenes/`：场景文件，目前存在 `assets/scenes/scene.scene`。
- `assets/scripts/`：TypeScript 游戏逻辑。
- `assets/scripts/core/`：主流程、HUD 模型、输入命令、选角、房间视图模型、判分模型等。
- `assets/scripts/player/`：玩家控制和球拍击球相关组件。
- `assets/scripts/ball/`：羽毛球/地面/网/墙/天花板碰撞相关逻辑。
- `assets/scripts/skill/`：技能充能、技能执行和三个角色技能模型。
- `assets/scripts/net/`：客户端网络消息类型和 WebSocket 客户端。
- `assets/scripts/audio/`：背景音乐、角色得分/技能音效路径和播放管理。
- `assets/scripts/media/`：胜利视频路径模型和播放管理。
- `assets/source/`：源图片资源，包含 `kobe.png`、`kun.png`、`nailong.png`、`start.png`、`local.png`、`connect.png`、`background.png`、`羽毛球.png`、`羽毛球拍.png` 等。
- `assets/resources/audio/`：运行时加载音频资源，包含 `bgm.mp3`、`kobe_score.mp3`、`kobe_skill.mp3`、`kun_score.mp3`、`kun_skill.mp3`、`nailong_score.mp3`、`nailong_skill.mp3`。
- `assets/resources/video/`：胜利视频资源，包含 `kobe_win.mp4`、`kun_win.mp4`、`nailong_win.mp4`。
- `assets/prefabs/`：当前可见文件为 `BallMat.pmtl` 和对应 `.meta`。
- `docs/`：设计、规格、架构、构建和场景分析文档。
- `docs/specs/`：当前开发规格文档目录，`docs/specs/README.md` 说明此目录优先于旧长文档。
- `docs/superpowers/plans/`：存在 `2026-06-10-lan-udp-host-authority.md`。
- `server/`：LAN 联机服务端和房间模型。
- `tests/`：TypeScript/JavaScript 测试文件。
- `scripts/`：PowerShell 自动化脚本。
- `settings/`：Cocos 项目设置，当前存在 `settings/v2/packages/*.json` 和 MCP 配置。
- `profiles/`：本地 Cocos 编辑器配置当前存在，但被 `.gitignore` 忽略。
- `library/`、`temp/`、`build/`、`local/`、`native/`：Cocos 生成或本地目录，被 `.gitignore` 忽略；当前 `library/`、`temp/` 存在。
- `logs/`：当前存在 `logs/build/`、`logs/error/`、`logs/runtime/`，被 `.gitignore` 忽略。
- `.claude/`、`.codex/`、`.creator/`：当前存在的本地工具/编辑器目录。

## 3. 主要场景/页面/模块

### 场景

- `assets/scenes/scene.scene`
  - 这是当前唯一通过文件清单确认存在的 Cocos 场景。
  - `docs/scene-analysis.md` 记录的场景 UUID：`b00da435-df28-4eb7-9611-8618c9ec0849`。
  - 当前 `scene.scene` 可直接检索到的节点包括：`Canvas`、`Camera`、`GameManager`、`Background`、`Player1`、`Player2`、`Shuttlecock`、`Walls`、`WallLeft`、`WallRight`、`WallBottom`、`Score1Label`、`Score2Label`。
  - `scene.scene` 中 `Shuttlecock` 初始 `_active=false`。
  - 当前 `scene.scene` 没有检索到 `_name: "Net"` 的节点；`GameManager` 组件的 `netNode` 当前引用的是 `Background` 节点。
  - `GameManager` 组件挂在 `Canvas/GameManager`。
  - `PlayerController` 组件挂在 `Player1` 和 `Player2`。
  - `FloorCollision` 组件挂在 `WallBottom`，用于通知 `GameManager.onBallLanded`。

### 页面/状态

当前没有单独的主菜单、房间、选角页面场景文件；这些页面由 `assets/scripts/core/GameManager.ts` 在运行时创建 UI 节点：

- `main_menu`：`enterMainMenu`
- `online_room`：`enterOnlineRoom`
- `character_select`：`enterLocalCharacterSelect`、`enterCharacterSelect`、`renderCharacterSelect`
- `battle`：`startBattle`
- `result`：`enterResult`、`enterResultWithVictoryVideo`

`GameManager.ts` 中的应用状态类型为：

```ts
type AppState = 'main_menu' | 'online_room' | 'character_select' | 'battle' | 'result';
```

`GameManager.ts` 中的战斗状态类型为：

```ts
type GameState = 'waitingServe' | 'playing' | 'roundEnd' | 'matchEnd';
```

### 主要模块

- `assets/scripts/core/GameManager.ts`
  - 当前主流程集中控制脚本。
  - 负责主菜单、局域网房间页、本地/联机选角、战斗开始、比分、局分、技能系统初始化、胜利视频、网络事件处理。
- `assets/scripts/player/PlayerController.ts`
  - 负责玩家移动、跳跃、挥拍、击球判定、发球、技能按键、远程命令执行。
  - P1 默认键位为 A/D/W/S/Space，P2 会在运行时改为方向键和 Enter。
- `assets/scripts/core/InputRouter.ts`
  - 定义 `PlayerCommand` 和 `CommandType`，供本地输入和网络输入转发使用。
- `assets/scripts/core/HitDecision.ts`
  - 根据羽毛球相对位置选择高击/低击，并判断击球范围。
- `assets/scripts/core/JumpMotion.ts`
  - 跳跃运动模型。
- `assets/scripts/core/RoundScoringModel.ts`
  - 单回合判分锁，避免一次 rally 重复计分。
- `assets/scripts/core/BattleHudModel.ts`
  - 比分和技能条显示模型。
- `assets/scripts/core/LocalCharacterSelect.ts`
  - 本地双人选角状态和 `LocalMatchSetup` 生成。
- `assets/scripts/core/LanRoomFlowModel.ts`
  - LAN 房间页视图模型和自动刷新节流判断。
- `assets/scripts/ball/ShuttleCollision.ts`
  - `ShuttleCourtCollision` 组件，处理网、左右墙、天花板碰撞，并调用 `GameManager.onBallNetFailed`。
- `assets/scripts/ball/ShuttleCollisionModel.ts`
  - 碰撞计算模型，测试覆盖较多。
- `assets/scripts/ball/FloorCollision.ts`
  - 通过 2D 碰撞检测落地，并调用 `GameManager.onBallLanded`。
- `assets/scripts/ball/ShuttlecockVisual.ts`
  - 羽毛球视觉相关脚本。
- `assets/scripts/player/RacketHit.ts`
  - 球拍击球组件；`docs/scene-analysis.md` 记录当前主要击球流程在 `PlayerController` 中是距离判定。
- `assets/scripts/skill/SkillSystem.ts`
  - 技能充能、冷却和每局使用次数。
- `assets/scripts/skill/SkillExecutor.ts`
  - 执行 `helicopter_smash`、`jiyin_dance`、`duang` 等技能效果。
- `assets/scripts/skill/KobeSpecialModel.ts`
  - 科比技能模型。
- `assets/scripts/skill/KunSkillModel.ts`
  - 蔡徐坤/kun 技能轨迹模型。
- `assets/scripts/skill/NailongSkillModel.ts`
  - 奶龙技能模型，扩大接球范围和视觉缩放。
- `assets/scripts/net/NetworkClient.ts`
  - WebSocket 客户端单例，处理房间、选角、准备、输入、球状态、比分同步。
- `assets/scripts/net/NetworkTypes.ts`
  - 网络消息和房间/比分/球状态类型。
- `assets/scripts/audio/AudioManager.ts`
  - Cocos `resources` 音频加载和播放。
- `assets/scripts/audio/CharacterAudioCues.ts`
  - 角色音效路径映射。
- `assets/scripts/media/VictoryVideoManager.ts`
  - 胜利视频播放层。
- `assets/scripts/media/VictoryVideoModel.ts`
  - 胜利视频资源路径模型。

## 4. 游戏主流程

### 规格文档中的 MVP 流程

`README.md` 和 `docs/specs/00-product-spec.md` 记录的 MVP 主流程：

```text
启动游戏
  -> 主页面
  -> 点击“双人联机”
  -> 进入房间/匹配等待
  -> 双方进入角色选择
  -> 双方确认角色
  -> 进入对战场景
  -> 完成 11 分制、三局两胜比赛
  -> 展示结果
  -> 返回主页面或再来一局
```

`docs/specs/05-battle-entry-spec.md` 记录：

- 单局 11 分。
- 不做正式羽毛球 2 分领先规则。
- 三局两胜。
- `player1` 左半场，`player2` 右半场。
- 第一球默认 P1 发球。
- 得分方获得下一球发球权。

### 当前实现中的流程

`GameManager.onLoad` 当前执行：

1. 记录 Canvas、Player1、Player2 引用。
2. 确保 Shuttlecock 上存在 `ShuttleCourtCollision`。
3. 收集战斗节点。
4. 创建战斗 HUD。
5. 创建 `MvpFlowRoot`。
6. 创建 `VictoryVideoManager`。
7. 注册网络事件。
8. 播放背景音乐。
9. 进入 `enterMainMenu`。

`enterMainMenu` 当前提供：

- 如果 `startSpriteFrame` 存在：创建 `StartBackground`，并创建本地对战和联机对战的点击区域。
- 如果没有 `startSpriteFrame`：用 Label/Button 创建标题、`联机对战`、`本地对战`。

本地对战流程：

1. `enterLocalCharacterSelect`
2. `LocalCharacterSelect.reset`
3. 双方选择并确认角色。
4. `LocalCharacterSelect.createMatchSetup`
5. `startBattle('local')`
6. 初始化技能、比分、角色皮肤、玩家控制。

联机对战流程：

1. `enterOnlineRoom`
2. 连接 WebSocket，默认地址为 `ws://localhost:8787`。
3. 可创建房间、刷新 LAN 房间列表、修改地址、加入发现的房间。
4. `NetworkClient` 接收 `ROOM_SNAPSHOT` 后，如果连接玩家数达到 2，则进入 `enterCharacterSelect`。
5. 选择角色并发送 `CHARACTER_SELECT`。
6. 确认角色并发送 `CHARACTER_READY`。
7. 服务端或远端触发 `MATCH_START` 后，`createMatchSetupFromSnapshot` 并 `startBattle('online')`。

战斗流程：

1. `resetMatch` 将比分、局分、当前发球方、战斗状态重置。
2. 初始 `_gameState='waitingServe'`，`_currentServer=1`。
3. `PlayerController` 在击球键触发时，如果球未激活，会调用 `GameManager.tryServe`。
4. `tryServe` 激活羽毛球，设置到球拍位置，对 `RigidBody2D` 施加发球冲量，并进入 `playing`。
5. 击球时 `PlayerController.performHit` 对羽毛球施加冲量，并通知 `GameManager.onPlayerHitBall` 增加技能充能。
6. `FloorCollision` 落地或 `ShuttleCourtCollision` 碰网失败后通知 `GameManager` 计分。
7. `RoundScoringModel` 锁定当前 rally，避免重复计分。
8. 达到 `pointsToWinRound=11` 后增加局分。
9. 达到 `roundsToWinMatch=2` 后进入 `matchEnd`，播放胜利视频并进入结果页。

## 5. 角色选择、联机、本地对战相关文件

### 角色定义和资源

- `assets/scripts/core/GameManager.ts`
  - 内置角色数组 `_characters`：
    - `kobe`，显示名 `科比`，技能 `helicopter_smash`
    - `caixukun`，显示名 `蔡徐坤`，技能 `jiyin_dance`
    - `nailong`，显示名 `奶龙`，技能 `duang`
  - 持有 `kobeSpriteFrame`、`caixukunSpriteFrame`、`nailongSpriteFrame`、`startSpriteFrame`、`localCharacterSelectSpriteFrame`、`connectSpriteFrame` 属性。
- `assets/source/kobe.png`
- `assets/source/kun.png`
- `assets/source/nailong.png`
- `assets/source/start.png`
- `assets/source/local.png`
- `assets/source/connect.png`
- `assets/resources/audio/kobe_score.mp3`
- `assets/resources/audio/kobe_skill.mp3`
- `assets/resources/audio/kun_score.mp3`
- `assets/resources/audio/kun_skill.mp3`
- `assets/resources/audio/nailong_score.mp3`
- `assets/resources/audio/nailong_skill.mp3`
- `assets/resources/video/kobe_win.mp4`
- `assets/resources/video/kun_win.mp4`
- `assets/resources/video/nailong_win.mp4`

### 角色选择

- `assets/scripts/core/GameManager.ts`
  - `enterLocalCharacterSelect`
  - `enterCharacterSelect`
  - `renderCharacterSelect`
  - `renderLocalCharacterSelect`
  - `selectCharacter`
  - `confirmCharacter`
  - `createMatchSetup`
  - `createMatchSetupFromSnapshot`
- `assets/scripts/core/LocalCharacterSelect.ts`
  - 本地选角模型。
  - 已确认玩家不能切换角色。
  - 双方确认后可生成 `roomId='LOCAL'` 的 `LocalMatchSetup`。
- `tests/local-character-select.test.ts`
  - 覆盖本地选角、确认锁定、重置。
- `docs/specs/04-character-select-spec.md`
  - 角色选择规格。

### 本地对战

- `assets/scripts/core/GameManager.ts`
  - `enterLocalCharacterSelect`
  - `renderLocalCharacterSelect`
  - `startBattle('local')`
  - `configurePlayerControl`
  - 本地模式下 P1/P2 都设置为本地控制。
- `assets/scripts/core/LocalCharacterSelect.ts`
- `tests/local-character-select.test.ts`
- `tests/scene-player2.test.ts`
  - 覆盖 Player2 技能键和肢体引用的场景配置。

### 联机

- `assets/scripts/net/NetworkTypes.ts`
  - 网络消息类型、房间快照、球状态、比分状态等类型。
- `assets/scripts/net/NetworkClient.ts`
  - 默认服务器地址 `ws://localhost:8787`。
  - 支持创建房间、浏览 LAN 房间、加入房间、选角、准备、输入、球状态、比分同步。
- `assets/scripts/core/LanRoomFlowModel.ts`
  - LAN 房间页面模型。
- `assets/scripts/core/GameManager.ts`
  - `enterOnlineRoom`
  - `connectOnlineRoom`
  - `createLanRoom`
  - `browseLanRooms`
  - `joinLanRoom`
  - `registerNetworkHandlers`
  - `onRoomSnapshot`
  - `onMatchStart`
  - `onRemotePlayerInput`
  - `onRemoteBallState`
  - `onRemoteScoreUpdate`
- `server/lan-server.js`
  - WebSocket 监听端口：`PORT`，默认 `8787`。
  - UDP 房间发现端口：`DISCOVERY_PORT`，默认 `12345`。
  - UDP 游戏端口：`GAME_PORT`，默认 `12346`。
  - 默认房间：`LAN1`。
  - 支持 `create_room`、`browse_rooms`、`join_request`、`CHARACTER_SELECT`、`CHARACTER_READY`、`player_input`、`game_state` 等消息。
- `server/lan-discovery.js`
  - 计算全局广播和定向广播地址。
- `server/room.ts`
  - LAN 房间模型，限制两名玩家。
  - `player1` 是 host authority。
- `tests/lan-room.test.ts`
  - 覆盖房间加入、准备开始、第三人拒绝、输入转发、host 状态转发。
- `tests/lan-room-flow-model.test.ts`
  - 覆盖房间列表 UI 模型和自动刷新节流。
- `tests/lan-discovery.test.js`
  - 覆盖 LAN 发现工具。
- `docs/specs/03-online-room-spec.md`
  - 双人联机房间规格。
- `docs/网络架构设计文档.md`
- `docs/简化服务器设计文档.md`
- `docs/superpowers/plans/2026-06-10-lan-udp-host-authority.md`

## 6. 当前已知问题

以下只列出当前文件中已记录或可直接观察到的不一致/风险。

1. `README.md` 与 `package.json` 不一致：
   - `README.md` 写着“当前 package.json 主要保存 Cocos 项目信息，项目暂未配置 npm 脚本”。
   - 但 `package.json` 实际已经存在 `test`、`typecheck`、`lint`、`format`、`build:web-desktop`、`build:web-mobile`、`preview`、`server:lan`、`logs:latest`、`logs:collect`。
2. `README.md` 与实际测试工具不一致：
   - `README.md` 写“项目使用 Vitest 进行单元测试”。
   - `package.json` 没有 `vitest` 依赖，`test` 脚本实际是 `tsc -p tsconfig.tests.json && node tests/run-all-tests.js`。
3. `docs/build-guide.md` 记录过一次本地构建失败：
   - 失败信息：`EPERM: operation not permitted, open 'temp\logs\project.log'`。
   - 文档建议关闭 Cocos Creator、MCP 扩展或占用日志文件的进程后重试。
4. `docs/build-guide.md` 记录当前无法确认完全 headless 的预览服务器命令：
   - `npm run preview` 会打开 Cocos Creator。
   - 预览仍需要从编辑器启动，或依赖额外 MCP preview tool。
5. `docs/scene-analysis.md` 记录物理组风险：
   - 项目设置有 `PLAYER`、`BALL`、`GROUND`、`NET` 碰撞组。
   - 但检查到的关键 collider/rigidbody 仍报告为 `DEFAULT`。
6. `docs/scene-analysis.md` 记录 `InputRouter` 未挂到当前场景：
   - `InputRouter.ts` 存在。
   - 当前实际输入由 `PlayerController` 处理，并通过 `PlayerCommand` 转发给网络。
7. `docs/scene-analysis.md` 记录 `RacketHit` 与当前击球流分离：
   - `RacketHit.ts` 存在。
   - 当前主要击球逻辑在 `PlayerController` 中使用距离判定。
8. `docs/scene-analysis.md` 与当前 `scene.scene` 存在 Net 节点描述差异：
   - `docs/scene-analysis.md` 记录有 `Net` 节点且处于 inactive。
   - 当前 `assets/scenes/scene.scene` 没有检索到 `_name: "Net"` 的节点。
   - 当前 `GameManager.netNode` 引用的是 `Background` 节点；`GameManager` 会用 `netNode.worldPosition.x` 作为左右半场判分分界。
9. `ShuttleCourtCollision` 的默认 Net 查找和当前场景结构可能不一致：
   - `assets/scripts/ball/ShuttleCollision.ts` 会尝试查找 `Background/Net`。
   - 当前 `Background` 节点在 `scene.scene` 中没有子节点。
   - 但 `GameManager.netNode` 已显式引用 `Background`，所以是否符合预期需要在 Cocos 中手动验证。
10. `scene.scene` 与脚本默认发球参数不同：
   - `GameManager.ts` 默认 `serveForceX=300`、`serveForceY=600`。
   - `assets/scenes/scene.scene` 中 `GameManager` 组件覆盖为 `serveForceX=-80`、`serveForceY=50`。
11. `profiles/`、`extensions/`、`logs/`、`library/`、`temp/` 当前目录存在，但 `.gitignore` 忽略其中多个目录：
    - 后续总结或提交时要区分“本地存在”和“应提交的项目源文件”。

## 7. 运行和测试方式

### 安装依赖

```powershell
npm install
```

### Cocos 预览

```powershell
npm run preview
```

实际执行：

- 调用 `scripts/cocos-preview.ps1`。
- 脚本会打开 Cocos Creator 项目。
- `docs/build-guide.md` 记录当前仍需要从编辑器里启动预览，不能确认完全 headless 预览。

### Cocos 手动打开

`README.md` 记录的方式：

1. 安装 Cocos Creator 3.8.8。
2. 使用 Cocos Creator 打开项目根目录。
3. 打开 `assets/scenes/scene.scene`。
4. 在编辑器中运行预览。

### 类型检查

```powershell
npm run typecheck
```

实际执行：

- 调用 `scripts/typecheck.ps1`。
- 优先使用项目本地 `node_modules/.bin/tsc.cmd`。
- 如果本地没有，会尝试使用 `extensions/cocos-mcp-server/node_modules/.bin/tsc.cmd`。
- 日志写入 `logs/error/typecheck-*.log`。

### 单元测试

```powershell
npm run test
```

实际执行：

1. `tsc -p tsconfig.tests.json`
2. `node tests/run-all-tests.js`

测试文件当前包括：

- `tests/battle-hud-model.test.ts`
- `tests/character-audio-cues.test.ts`
- `tests/hit-decision.test.ts`
- `tests/jump-motion.test.ts`
- `tests/kobe-special-model.test.ts`
- `tests/kun-special-model.test.ts`
- `tests/lan-discovery.test.js`
- `tests/lan-room-flow-model.test.ts`
- `tests/lan-room.test.ts`
- `tests/local-character-select.test.ts`
- `tests/nailong-special-model.test.ts`
- `tests/round-scoring-model.test.ts`
- `tests/scene-player2.test.ts`
- `tests/shuttle-collision-model.test.ts`
- `tests/skill-system.test.ts`
- `tests/victory-video-model.test.ts`

### ESLint

```powershell
npm run lint
```

实际检查：

- `assets/scripts/**/*.ts`

### 格式化

```powershell
npm run format
npm run format:check
```

### 构建

```powershell
npm run build:web-desktop
npm run build:web-mobile
```

实际执行：

- 调用 `scripts/cocos-build.ps1`。
- 构建日志写入 `logs/build/`。
- 失败日志复制到 `logs/error/`。

### LAN 服务端

```powershell
npm run server:lan
```

实际执行：

- `node server/lan-server.js`
- 默认 WebSocket：`ws://0.0.0.0:8787`
- 默认 UDP discovery：`0.0.0.0:12345`
- 默认 UDP game：`0.0.0.0:12346`

### 查看日志

```powershell
npm run logs:latest
npm run logs:collect
```

### Cocos 手动测试要求

项目根目录 `AGENTS.md` 明确要求：当修改涉及场景节点配置、物理系统、核心游戏逻辑、UI 显示时，必须停下来让用户在 Cocos Creator 中手动测试。

本次只新增文档，没有修改游戏代码或场景。

## 8. 后续给 GPT 写 prompt 时必须知道的上下文

- 这是 Cocos Creator 3.8.8 + TypeScript 项目。
- 当前唯一确认存在的场景是 `assets/scenes/scene.scene`。
- 当前页面不是多个场景文件，而是由 `GameManager.ts` 在同一个场景里运行时创建/隐藏节点。
- `GameManager.ts` 是主流程核心，修改主菜单、房间、选角、战斗入口、结果页、网络事件时都要先读它。
- `docs/specs/README.md` 明确说 `docs/specs/` 是后续 coding 的唯一开发依据；旧长文档仅参考，冲突时以 `docs/specs/` 为准。
- 当前已有规格：
  - `docs/specs/00-product-spec.md`
  - `docs/specs/01-flow-spec.md`
  - `docs/specs/02-main-menu-spec.md`
  - `docs/specs/03-online-room-spec.md`
  - `docs/specs/04-character-select-spec.md`
  - `docs/specs/05-battle-entry-spec.md`
- 当前实现已经包含本地对战入口；这和 `02-main-menu-spec.md` 中“主页面只提供双人联机入口”的首版描述不同。
- 角色 ID 要使用当前代码中的值：
  - `kobe`
  - `caixukun`
  - `nailong`
- `kun` 在音频和视频模型中作为 `caixukun` 的别名存在。
- 当前技能 ID：
  - `helicopter_smash`
  - `jiyin_dance`
  - `duang`
- 当前默认联机地址：`ws://localhost:8787`。
- LAN 服务端实际文件是 JavaScript：`server/lan-server.js`，不是 Go 服务端。
- `server/room.ts` 是测试用/模型用 TypeScript 房间逻辑。
- 在线模式下 `player1` 是 host authority：
  - `GameManager.canApplyBallPhysics` 中 online 模式只有 host 应用球物理。
  - `server/room.ts` 中 `hostPlayerId` 固定为 `player1`。
- `NetworkClient.ts` 同时处理大写内部事件和小写 wire message 的兼容映射。
- 本地模式下 P1/P2 都是本地控制。
- P2 默认输入会在 `PlayerController.configureDefaultKeysForPlayer2` 中切换到方向键和 Enter。
- 不能把 `README.md` 中“暂无 npm 脚本”和“使用 Vitest”当作当前事实；应以 `package.json` 和 `tests/run-all-tests.js` 为准。
- 如果修改场景、物理、玩家控制、击球、得分、UI、动画，必须要求用户在 Cocos Creator 里手动测试，并给出具体步骤。
- 不要随意提交或总结 `library/`、`temp/`、`logs/`、`node_modules/`、`extensions/`、`profiles/` 中的本地产物；这些目录至少部分被 `.gitignore` 忽略。
- 如果需要验证构建，先看 `docs/build-guide.md`，其中记录过 `temp\logs\project.log` 被占用导致构建失败。
- 修改前建议先运行：

```powershell
git status --short --branch
```

- 常用验证命令：

```powershell
npm run typecheck
npm run test
npm run lint
```

- 本文生成时没有运行测试或构建；如果后续任务涉及代码修改，需要按风险补充验证。
