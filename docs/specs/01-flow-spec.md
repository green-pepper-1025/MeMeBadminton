# 01 Flow Spec

## 一、全局状态

```typescript
enum AppState {
    BOOT = 'boot',
    MAIN_MENU = 'main_menu',
    ONLINE_ROOM = 'online_room',
    CHARACTER_SELECT = 'character_select',
    BATTLE_LOADING = 'battle_loading',
    BATTLE = 'battle',
    RESULT = 'result',
}
```

## 二、页面流转

```text
BOOT
  -> MAIN_MENU

MAIN_MENU
  点击“双人联机”
  -> ONLINE_ROOM

ONLINE_ROOM
  房间人数达到 2
  -> CHARACTER_SELECT

CHARACTER_SELECT
  双方都选择角色并确认
  -> BATTLE_LOADING
  -> BATTLE

BATTLE
  比赛结束
  -> RESULT

RESULT
  点击“返回主菜单”
  -> MAIN_MENU
  点击“再来一局”
  -> CHARACTER_SELECT 或 BATTLE_LOADING
```

## 三、核心数据

```typescript
interface MatchSetup {
    roomId: string;
    localPlayerId: 'player1' | 'player2';
    players: PlayerSetup[];
}

interface PlayerSetup {
    playerId: 'player1' | 'player2';
    displayName: string;
    characterId: string;
    isReady: boolean;
}
```

## 四、状态切换规则

- 只能从主页面进入联机房间。
- 只有房间内有两名玩家时，才能进入角色选择。
- 只有双方都确认角色时，才能进入对战。
- Battle 场景不负责选角，只接收 `MatchSetup`。
- 比赛结束后不直接销毁玩家选择数据，方便“再来一局”。

## 五、异常路径

### 房间中断

如果任意一方离开房间：

- 显示“对方已离开”。
- 返回主页面或重新匹配。

### 选角中断

如果任意一方退出选角：

- 另一方回到房间等待。

### 对战中断

MVP 阶段只提示“连接中断”，返回主页面。
