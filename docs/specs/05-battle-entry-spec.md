# 05 Battle Entry Spec

## 一、页面目标

对战入口负责根据选角结果初始化战斗场景。Battle 场景不做选角，只消费选角结果。

## 二、输入数据

```typescript
interface BattleStartPayload {
    roomId: string;
    seed: number;
    localPlayerId: 'player1' | 'player2';
    players: BattlePlayerSetup[];
}

interface BattlePlayerSetup {
    playerId: 'player1' | 'player2';
    characterId: string;
    skinId: string;
    skillId: string;
    spawnSide: 'left' | 'right';
}
```

## 三、初始化流程

```text
BATTLE_LOADING
  读取 BattleStartPayload
  加载 Battle 场景
  创建/定位 P1 和 P2
  应用角色皮肤
  初始化技能系统
  初始化比分
  初始化发球方
  -> BATTLE
```

## 四、出生规则

- `player1` 出生在左半场。
- `player2` 出生在右半场。
- `player1` 默认朝右。
- `player2` 默认朝左。

## 五、发球规则

MVP：

- 第一球默认 P1 发球。
- 得分方获得下一球发球权。
- 新局开始时保留上一球得分方发球。

后续可改为随机首发球，但需要同步到双方客户端。

## 六、比赛规则

- 单局 11 分。
- 不做羽毛球正式规则的 2 分领先。
- 三局两胜。
- 一方赢 2 局后进入结果页。

## 七、Battle 场景职责

Battle 场景负责：

- 玩家移动。
- 挥拍。
- 羽毛球物理。
- 落地判分。
- 技能触发。
- 比分展示。
- 比赛结束事件。

Battle 场景不负责：

- 主菜单。
- 房间创建。
- 角色选择。
- 服务器连接 UI。

## 八、结果数据

```typescript
interface MatchResult {
    winnerPlayerId: 'player1' | 'player2';
    player1RoundsWon: number;
    player2RoundsWon: number;
}
```

## 九、验收标准

- 双方确认角色后能进入 Battle。
- Battle 能根据 `characterId` 初始化双方角色。
- P1/P2 出现在正确半场。
- 比赛规则按 11 分制、三局两胜执行。
- 比赛结束后能产出 `MatchResult`。
