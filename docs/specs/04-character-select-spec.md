# 04 Character Select Spec

## 一、页面目标

角色选择页面负责让双方选择本局使用的角色，并在双方确认后进入对战。

## 二、角色原则

所有角色基础属性一致：

- 移动速度一致。
- 击球力度一致。
- 球拍范围一致。
- 跳跃能力如果后续加入，也保持一致。

角色差异只来自：

- `skinId`
- `skillId`
- 技能表现

## 三、角色数据

```typescript
interface CharacterDefinition {
    characterId: string;
    displayName: string;
    skinId: string;
    skillId: string;
    description: string;
}
```

首批角色：

| characterId | 名称 | skillId | 技能定位 |
| --- | --- | --- | --- |
| kobe | 科比 | helicopter_smash | 强力扣杀 |
| caixukun | 蔡徐坤 | jiyin_dance | 轨迹扰动 |
| nailong | 奶龙 | duang | 接球范围扩大 |

## 四、选角状态

```typescript
interface CharacterSelectSnapshot {
    roomId: string;
    players: CharacterSelectPlayer[];
}

interface CharacterSelectPlayer {
    playerId: 'player1' | 'player2';
    selectedCharacterId: string | null;
    confirmed: boolean;
}
```

## 五、页面 UI

```text
┌──────────────────────────────┐
│  选择角色                     │
│                              │
│  [科比] [蔡徐坤] [奶龙]        │
│                              │
│  当前选择: 科比                │
│  技能: 直升机扣杀              │
│                              │
│  我方: 已选择/未确认           │
│  对方: 选择中                  │
│                              │
│  [ 确认角色 ]                 │
└──────────────────────────────┘
```

## 六、交互

### 点击角色卡

行为：

1. 更新本地 `selectedCharacterId`。
2. 展示角色名称、描述、技能说明。
3. 如果已经确认，点击其他角色需要先取消确认或禁止切换。

MVP 建议确认后禁止切换。

### 点击确认角色

行为：

1. 设置本地 `confirmed = true`。
2. 同步给对方或服务器。
3. 如果双方都确认，进入 `BATTLE_LOADING`。

### 对方选择变化

行为：

1. 更新对方选择状态。
2. 显示“对方已选择”或“对方已确认”。

不需要展示对方具体角色也可以，但 MVP 展示出来更方便调试。

## 七、后续 WebSocket 消息

```typescript
enum CharacterSelectMessageType {
    CHARACTER_SELECT = 'character_select',
    CHARACTER_CONFIRM = 'character_confirm',
    CHARACTER_SELECT_SNAPSHOT = 'character_select_snapshot',
    BATTLE_START = 'battle_start',
}
```

## 八、验收标准

- 进入页面后能看到 3 个角色。
- 点击角色卡能更新当前选择。
- 点击确认后本方进入已确认状态。
- 双方确认后生成 `MatchSetup` 并进入对战加载。
