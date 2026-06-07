# MemeBadminton Specs

这个目录是后续 coding 的唯一开发依据。旧的长文档保留为参考资料，但如果和本目录冲突，以 `docs/specs/` 为准。

## 文档优先级

1. `00-product-spec.md`：产品目标、范围、核心流程。
2. `01-flow-spec.md`：页面和状态流转。
3. `02-main-menu-spec.md`：主页面规格。
4. `03-online-room-spec.md`：双人联机房间规格。
5. `04-character-select-spec.md`：角色选择规格。
6. `05-battle-entry-spec.md`：进入对战和比赛初始化规格。

## 当前架构决策

- 先做可演示 MVP，再做完整内容。
- MVP 主流程：主页面 -> 双人联机 -> 房间等待 -> 双方选角色 -> 对战。
- 战斗物理先由 Cocos 客户端计算。
- 服务端后续只做房间、选角同步、准备确认、关键事件仲裁。
- 暂不做服务器完整物理同步。

## Coding 规则

每次开始 coding 前先确认对应 spec：

- 如果 spec 已存在，按 spec 实现。
- 如果需求超出 spec，先改 spec，再改代码。
- 如果旧文档和 spec 冲突，优先更新或废弃旧文档描述。
