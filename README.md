# MemeBadminton

MemeBadminton 是一个基于 Cocos Creator 3.8.8 的 2D 横版羽毛球对战游戏项目。项目目标是先完成可演示 MVP，再逐步补齐联机、角色技能、UI 表现和更完整的比赛体验。

## 项目定位

- 两名玩家选择不同梗角色进行实时羽毛球对战。
- MVP 优先保证主流程完整、对战可玩、联机链路清晰。
- 战斗物理优先由 Cocos 客户端计算，服务端后续负责房间、选角同步、准备确认和关键事件仲裁。

## 技术栈

- 引擎：Cocos Creator 3.8.8
- 语言：TypeScript
- 版本控制：Git

## MVP 主流程

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

## 项目结构

```text
assets/                 游戏资源、场景、脚本、预制体和材质
assets/scenes/          Cocos 场景文件
assets/scripts/         TypeScript 游戏逻辑
assets/scripts/core/    核心流程和输入路由
assets/scripts/player/  玩家控制和球拍击球逻辑
assets/scripts/ball/    球体和落地碰撞逻辑
assets/scripts/skill/   角色技能系统
assets/scripts/net/     网络通信模块
docs/                   设计文档和开发规范
docs/specs/             当前 coding 的主要规格依据
extensions/             Cocos Creator 扩展插件
server/                 LAN 联机服务端（房间管理、中继）
tests/                  单元测试
profiles/               构建配置
settings/               项目设置
library/                Cocos 生成目录，不提交 Git
temp/                   Cocos 临时目录，不提交 Git
```

## 快速开始

1. 安装 Cocos Creator 3.8.8。
2. 使用 Cocos Creator 打开项目根目录。
3. 打开 `assets/scenes/scene.scene`。
4. 在编辑器中运行预览。

> 当前 `package.json` 主要保存 Cocos 项目信息，项目暂未配置 npm 脚本。

## 测试

项目使用 Vitest 进行单元测试，配置见 `tsconfig.tests.json`。

```bash
npm run test
```

测试覆盖模块：

- `tests/lan-room.test.ts` — LAN 房间创建、加入和状态管理
- `tests/skill-system.test.ts` — 技能系统触发与执行逻辑

## 开发规范

- 所有游戏逻辑使用 TypeScript。
- 遵循 Cocos Creator 组件化开发模式。
- 类名使用 PascalCase，方法名使用 camelCase。
- 开始 coding 前优先查看 `docs/specs/` 中的对应规格。
- 如果需求超出现有规格，先更新规格文档，再修改代码。
- 如果旧文档和 `docs/specs/` 冲突，以 `docs/specs/` 为准。

## 重要文档

- `docs/specs/README.md`：规格文档入口和优先级说明。
- `docs/specs/00-product-spec.md`：产品目标、MVP 范围和核心流程。
- `docs/specs/01-flow-spec.md`：页面和状态流转。
- `docs/specs/02-main-menu-spec.md`：主页面规格。
- `docs/specs/03-online-room-spec.md`：双人联机房间规格。
- `docs/specs/04-character-select-spec.md`：角色选择规格。
- `docs/specs/05-battle-entry-spec.md`：进入对战和比赛初始化规格。
- `docs/开发规范文档.md`：代码风格、架构、Git 工作流和测试规范。

## Cocos Creator 测试提示

当修改涉及场景节点、物理系统、玩家控制、击球、得分或 UI 显示时，需要在 Cocos Creator 中进行手动测试。推荐验证：

- 场景能正常打开和预览。
- 玩家输入、移动、跳跃和击球行为符合预期。
- 羽毛球落地和判分逻辑正确。
- UI Label、Sprite 和动画显示正常。
- 技能系统触发和执行效果符合预期。
- LAN 联机房间创建、加入和中继消息正常。

## Git 提交规范

提交信息建议使用：

```text
<type>(<scope>): <subject>
```

常用 type：

- `feat`：新功能
- `fix`：修复 Bug
- `docs`：文档更新
- `refactor`：重构
- `test`：测试相关
- `chore`：构建或工具链相关
