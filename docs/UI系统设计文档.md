# 《抽象羽球大乱斗》UI 系统设计文档

## 一、UI 架构设计

### 1.1 UI 层级结构

```
Canvas (根节点)
├── UIManager (管理器组件)
├── Screens (场景层)
│   ├── MainMenuScreen
│   ├── CharacterSelectScreen
│   ├── GameScreen
│   └── ResultScreen
├── Popups (弹窗层)
│   ├── PausePopup
│   ├── SettingsPopup
│   └── ConfirmPopup
└── Toast (提示层)
    └── ToastMessage
```

### 1.2 UI 管理器架构

```typescript
/**
 * UI 管理器
 * 职责：管理所有 UI 场景的显示、隐藏、切换
 */
export class UIManager {
    private static _instance: UIManager;
    private _currentScreen: UIScreen | null = null;
    private _screenStack: UIScreen[] = [];
    private _popupStack: UIPopup[] = [];
    
    /**
     * 显示场景（隐藏当前场景）
     */
    public showScreen(screenType: ScreenType): void {
        // 隐藏当前场景
        if (this._currentScreen) {
            this._currentScreen.hide();
        }
        
        // 显示新场景
        const screen = this._getScreen(screenType);
        screen.show();
        this._currentScreen = screen;
        
        // 触发事件
        EventBus.emit(GameEvent.UI_SCREEN_CHANGE, { 
            from: this._currentScreen?.type, 
            to: screenType 
        });
    }
    
    /**
     * 显示弹窗（不隐藏当前场景）
     */
    public showPopup(popupType: PopupType): void {
        const popup = this._getPopup(popupType);
        popup.show();
        this._popupStack.push(popup);
    }
    
    /**
     * 关闭弹窗
     */
    public closePopup(): void {
        const popup = this._popupStack.pop();
        if (popup) {
            popup.hide();
        }
    }
}
```

---

## 二、场景设计

### 2.1 主菜单场景 (MainMenuScreen)

#### 布局设计

```
┌─────────────────────────────────────────┐
│                                         │
│         抽象羽球大乱斗                    │
│       ABSTRACT BADMINTON                │
│                                         │
│         [开始游戏]                       │
│         [设置]                          │
│         [退出]                          │
│                                         │
│                                         │
│         v1.0.0                          │
└─────────────────────────────────────────┘
```

#### 组件结构

```typescript
MainMenuScreen
├── TitleLabel (标题)
├── StartButton (开始游戏按钮)
├── SettingsButton (设置按钮)
├── ExitButton (退出按钮)
└── VersionLabel (版本号)
```

#### 交互逻辑

```typescript
export class MainMenuScreen extends UIScreen {
    @property(Button)
    private startButton: Button = null!;
    
    @property(Button)
    private settingsButton: Button = null!;
    
    @property(Button)
    private exitButton: Button = null!;
    
    onLoad() {
        // 绑定按钮事件
        this.startButton.node.on('click', this.onStartClick, this);
        this.settingsButton.node.on('click', this.onSettingsClick, this);
        this.exitButton.node.on('click', this.onExitClick, this);
    }
    
    private onStartClick(): void {
        AudioManager.play('button_click');
        GameStateManager.getInstance().changeState(GameState.CHARACTER_SELECT);
        UIManager.getInstance().showScreen(ScreenType.CHARACTER_SELECT);
    }
    
    private onSettingsClick(): void {
        AudioManager.play('button_click');
        UIManager.getInstance().showPopup(PopupType.SETTINGS);
    }
    
    private onExitClick(): void {
        AudioManager.play('button_click');
        UIManager.getInstance().showPopup(PopupType.CONFIRM_EXIT);
    }
}
```

### 2.2 角色选择场景 (CharacterSelectScreen)

#### 布局设计

```
┌─────────────────────────────────────────┐
│  [返回]              选择角色            │
│                                         │
│   ┌─────┐    ┌─────┐    ┌─────┐       │
│   │科比 │    │蔡徐坤│    │奶龙 │       │
│   │     │    │     │    │     │       │
│   └─────┘    └─────┘    └─────┘       │
│                                         │
│   技能：直升机扣杀                       │
│   描述：瞬移至高空垂直扣杀                │
│                                         │
│              [确认]                     │
└─────────────────────────────────────────┘
```

#### 组件结构

```typescript
CharacterSelectScreen
├── BackButton (返回按钮)
├── TitleLabel (标题)
├── CharacterList (角色列表)
│   ├── CharacterCard1 (科比)
│   ├── CharacterCard2 (蔡徐坤)
│   └── CharacterCard3 (奶龙)
├── SkillInfoPanel (技能信息面板)
│   ├── SkillNameLabel
│   └── SkillDescLabel
└── ConfirmButton (确认按钮)
```

#### 角色卡片组件

```typescript
export class CharacterCard extends Component {
    @property(Sprite)
    private avatar: Sprite = null!;
    
    @property(Label)
    private nameLabel: Label = null!;
    
    @property(Node)
    private selectedFrame: Node = null!;
    
    private _characterData: CharacterConfig | null = null;
    private _isSelected: boolean = false;
    
    /**
     * 初始化角色卡片
     */
    public init(characterData: CharacterConfig): void {
        this._characterData = characterData;
        this.nameLabel.string = characterData.name;
        // 加载角色头像
        this.loadAvatar(characterData.skinPath);
        
        // 绑定点击事件
        this.node.on('click', this.onCardClick, this);
    }
    
    /**
     * 点击卡片
     */
    private onCardClick(): void {
        AudioManager.play('card_select');
        EventBus.emit('character:selected', this._characterData);
    }
    
    /**
     * 设置选中状态
     */
    public setSelected(selected: boolean): void {
        this._isSelected = selected;
        this.selectedFrame.active = selected;
    }
}
```

### 2.3 游戏场景 (GameScreen)

#### 布局设计（参考 StickBadminton）

```
┌─────────────────────────────────────────┐
│  [暂停]        1 - 1        [技能]      │  ← HUD 层
│                                         │
│                                         │
│              ●                          │  ← 游戏层
│                                         │
│    ◯                  ◯                │
│   /|\        ║        /|\              │
│   / \        ║        / \              │
│─────────────────────────────────────────│
│  ████████████████████████████████████  │  ← 地面
│                                         │
│  ⚡⚡⚡  科比                            │  ← 技能充能条
└─────────────────────────────────────────┘
```

#### 组件结构

```typescript
GameScreen
├── HUD (抬头显示)
│   ├── PauseButton (暂停按钮)
│   ├── ScoreBoard (计分板)
│   │   ├── Player1Score
│   │   └── Player2Score
│   └── SkillButton (技能按钮)
├── SkillBar (技能充能条)
│   ├── Player1SkillBar
│   │   ├── ChargeBar (充能进度条)
│   │   ├── ChargeText (充能百分比)
│   │   └── UsesText (剩余次数)
│   └── Player2SkillBar
└── GameOverlay (游戏覆盖层)
    ├── RoundStartText (回合开始提示)
    ├── ScoreText (得分提示)
    └── RoundEndText (回合结束提示)
```

#### 计分板组件

```typescript
export class ScoreBoard extends Component {
    @property(Label)
    private player1ScoreLabel: Label = null!;
    
    @property(Label)
    private player2ScoreLabel: Label = null!;
    
    @property(Label)
    private separatorLabel: Label = null!;
    
    private _player1Score: number = 0;
    private _player2Score: number = 0;
    
    onLoad() {
        // 监听得分事件
        EventBus.on(GameEvent.SCORE_CHANGED, this.onScoreChanged, this);
    }
    
    onDestroy() {
        EventBus.off(GameEvent.SCORE_CHANGED, this.onScoreChanged, this);
    }
    
    /**
     * 更新得分
     */
    private onScoreChanged(data: { scoringPlayer: string }): void {
        if (data.scoringPlayer === 'player1') {
            this._player1Score++;
        } else {
            this._player2Score++;
        }
        
        // 更新显示
        this.updateDisplay();
        
        // 播放得分动画
        this.playScoreAnimation(data.scoringPlayer);
    }
    
    /**
     * 更新显示
     */
    private updateDisplay(): void {
        this.player1ScoreLabel.string = this._player1Score.toString();
        this.player2ScoreLabel.string = this._player2Score.toString();
    }
    
    /**
     * 播放得分动画
     */
    private playScoreAnimation(scoringPlayer: string): void {
        const label = scoringPlayer === 'player1' 
            ? this.player1ScoreLabel 
            : this.player2ScoreLabel;
        
        // 放大 → 缩小动画
        tween(label.node)
            .to(0.1, { scale: new Vec3(1.5, 1.5, 1) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .start();
    }
}
```

#### 技能充能条组件

```typescript
export class SkillBar extends Component {
    @property(Sprite)
    private chargeBar: Sprite = null!;
    
    @property(Label)
    private chargeText: Label = null!;
    
    @property(Label)
    private usesText: Label = null!;
    
    @property(Node)
    private readyEffect: Node = null!;
    
    private _currentCharge: number = 0;
    private _usesRemaining: number = 3;
    
    onLoad() {
        EventBus.on('skill:charge_updated', this.onChargeUpdated, this);
        EventBus.on('skill:ready', this.onSkillReady, this);
        EventBus.on('skill:used', this.onSkillUsed, this);
    }
    
    /**
     * 更新充能进度
     */
    private onChargeUpdated(data: { charge: number }): void {
        this._currentCharge = data.charge;
        
        // 更新进度条
        this.chargeBar.fillRange = this._currentCharge / 100;
        
        // 更新文本
        this.chargeText.string = `${Math.floor(this._currentCharge)}%`;
    }
    
    /**
     * 技能充能完成
     */
    private onSkillReady(): void {
        // 播放准备特效
        this.readyEffect.active = true;
        
        // 闪烁动画
        tween(this.chargeBar.node)
            .to(0.3, { scale: new Vec3(1.1, 1.1, 1) })
            .to(0.3, { scale: new Vec3(1, 1, 1) })
            .union()
            .repeat(3)
            .start();
        
        // 播放音效
        AudioManager.play('skill_ready');
    }
    
    /**
     * 技能使用
     */
    private onSkillUsed(): void {
        this._currentCharge = 0;
        this._usesRemaining--;
        
        // 更新显示
        this.chargeBar.fillRange = 0;
        this.chargeText.string = '0%';
        this.usesText.string = `×${this._usesRemaining}`;
        this.readyEffect.active = false;
    }
}
```

### 2.4 结算场景 (ResultScreen)

#### 布局设计

```
┌─────────────────────────────────────────┐
│                                         │
│              胜利！                      │
│                                         │
│         ┌─────────────┐                │
│         │   科比      │                │
│         │   2 : 0     │                │
│         └─────────────┘                │
│                                         │
│         [再来一局]  [返回菜单]          │
│                                         │
└─────────────────────────────────────────┘
```

#### 组件结构

```typescript
ResultScreen
├── ResultTitle (胜利/失败标题)
├── WinnerPanel (获胜者信息)
│   ├── WinnerAvatar (头像)
│   ├── WinnerName (名称)
│   └── ScoreText (比分)
├── RematchButton (再来一局)
└── BackToMenuButton (返回菜单)
```

---

## 三、弹窗设计

### 3.1 暂停弹窗 (PausePopup)

```
┌─────────────────────────────────────────┐
│                                         │
│              暂停                        │
│                                         │
│         [继续游戏]                       │
│         [设置]                          │
│         [退出到菜单]                     │
│                                         │
└─────────────────────────────────────────┘
```

### 3.2 设置弹窗 (SettingsPopup)

```
┌─────────────────────────────────────────┐
│  [关闭]          设置                    │
│                                         │
│  音效音量:  ━━━━━●━━━━  80%            │
│  音乐音量:  ━━━━━━━●━━  70%            │
│                                         │
│  全屏:      [✓]                         │
│  分辨率:    [1920x1080 ▼]              │
│                                         │
│              [应用]                     │
└─────────────────────────────────────────┘
```

### 3.3 确认弹窗 (ConfirmPopup)

```
┌─────────────────────────────────────────┐
│                                         │
│         确认退出游戏？                   │
│                                         │
│         [确认]    [取消]                │
│                                         │
└─────────────────────────────────────────┘
```

---

## 四、UI 动画设计

### 4.1 场景切换动画

```typescript
export class ScreenTransition {
    /**
     * 淡入淡出
     */
    public static fadeInOut(
        fromScreen: UIScreen, 
        toScreen: UIScreen, 
        duration: number = 0.3
    ): void {
        // 淡出当前场景
        tween(fromScreen.node)
            .to(duration, { opacity: 0 })
            .call(() => {
                fromScreen.node.active = false;
                toScreen.node.active = true;
                toScreen.node.opacity = 0;
            })
            .start();
        
        // 淡入新场景
        tween(toScreen.node)
            .delay(duration)
            .to(duration, { opacity: 255 })
            .start();
    }
    
    /**
     * 滑动切换
     */
    public static slideTransition(
        fromScreen: UIScreen, 
        toScreen: UIScreen, 
        direction: 'left' | 'right'
    ): void {
        const screenWidth = 1920;
        const offset = direction === 'left' ? -screenWidth : screenWidth;
        
        // 当前场景滑出
        tween(fromScreen.node)
            .to(0.3, { position: new Vec3(offset, 0, 0) })
            .call(() => {
                fromScreen.node.active = false;
            })
            .start();
        
        // 新场景滑入
        toScreen.node.position = new Vec3(-offset, 0, 0);
        toScreen.node.active = true;
        tween(toScreen.node)
            .to(0.3, { position: new Vec3(0, 0, 0) })
            .start();
    }
}
```

### 4.2 按钮动画

```typescript
export class ButtonAnimation {
    /**
     * 按钮按下效果
     */
    public static pressEffect(button: Node): void {
        tween(button)
            .to(0.1, { scale: new Vec3(0.95, 0.95, 1) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .start();
    }
    
    /**
     * 按钮悬停效果
     */
    public static hoverEffect(button: Node): void {
        tween(button)
            .to(0.2, { scale: new Vec3(1.05, 1.05, 1) })
            .start();
    }
    
    /**
     * 按钮离开效果
     */
    public static leaveEffect(button: Node): void {
        tween(button)
            .to(0.2, { scale: new Vec3(1, 1, 1) })
            .start();
    }
}
```

### 4.3 得分提示动画

```typescript
export class ScoreAnimation {
    /**
     * 显示得分提示
     */
    public static showScoreText(
        text: string, 
        position: Vec3, 
        parent: Node
    ): void {
        // 创建文本节点
        const textNode = new Node('ScoreText');
        const label = textNode.addComponent(Label);
        label.string = text;
        label.fontSize = 60;
        label.color = new Color(255, 255, 0, 255);
        
        textNode.setParent(parent);
        textNode.setPosition(position);
        
        // 向上飘动 + 淡出
        tween(textNode)
            .to(1.0, { 
                position: new Vec3(position.x, position.y + 100, 0),
                scale: new Vec3(1.5, 1.5, 1)
            })
            .start();
        
        tween(label)
            .delay(0.5)
            .to(0.5, { opacity: 0 })
            .call(() => {
                textNode.destroy();
            })
            .start();
    }
}
```

---

## 五、UI 事件系统

### 5.1 事件流

```
用户输入 → UI 组件 → EventBus → 游戏逻辑 → EventBus → UI 更新
```

### 5.2 UI 事件定义

```typescript
enum UIEvent {
    // 按钮事件
    BUTTON_CLICK = 'ui:button_click',
    BUTTON_HOVER = 'ui:button_hover',
    
    // 场景事件
    SCREEN_SHOW = 'ui:screen_show',
    SCREEN_HIDE = 'ui:screen_hide',
    
    // 弹窗事件
    POPUP_OPEN = 'ui:popup_open',
    POPUP_CLOSE = 'ui:popup_close',
    
    // 游戏 UI 事件
    SCORE_UPDATE = 'ui:score_update',
    SKILL_CHARGE_UPDATE = 'ui:skill_charge_update',
    ROUND_START = 'ui:round_start',
    ROUND_END = 'ui:round_end'
}
```

---

## 六、响应式设计

### 6.1 多分辨率适配

```typescript
export class UIAdapter {
    /**
     * 适配不同分辨率
     */
    public static adaptResolution(): void {
        const canvas = find('Canvas')!.getComponent(Canvas)!;
        const designResolution = new Size(1920, 1080);
        
        // 设置设计分辨率
        canvas.designResolution = designResolution;
        
        // 设置适配模式（等比缩放）
        canvas.fitHeight = true;
        canvas.fitWidth = true;
    }
}
```

### 6.2 Widget 组件使用

```typescript
// 顶部对齐
const topWidget = node.addComponent(Widget);
topWidget.isAlignTop = true;
topWidget.top = 20;

// 底部对齐
const bottomWidget = node.addComponent(Widget);
bottomWidget.isAlignBottom = true;
bottomWidget.bottom = 20;

// 居中对齐
const centerWidget = node.addComponent(Widget);
centerWidget.isAlignHorizontalCenter = true;
centerWidget.isAlignVerticalCenter = true;
```

---

## 七、性能优化

### 7.1 UI 对象池

```typescript
export class UIPool {
    private _pool: Map<string, Node[]> = new Map();
    
    /**
     * 获取 UI 节点
     */
    public get(prefabPath: string): Node {
        const pool = this._pool.get(prefabPath);
        if (pool && pool.length > 0) {
            return pool.pop()!;
        }
        
        // 加载预制体
        return this.loadPrefab(prefabPath);
    }
    
    /**
     * 回收 UI 节点
     */
    public put(prefabPath: string, node: Node): void {
        node.active = false;
        
        if (!this._pool.has(prefabPath)) {
            this._pool.set(prefabPath, []);
        }
        
        this._pool.get(prefabPath)!.push(node);
    }
}
```

### 7.2 减少 Draw Call

- 使用 Sprite Atlas（图集）
- 合并相同材质的 UI 元素
- 避免频繁修改 UI 层级

---

## 八、开发优先级

### Phase 1: 基础 UI（1周）
- [ ] UIManager 框架
- [ ] 主菜单场景
- [ ] 场景切换动画

### Phase 2: 游戏 UI（1周）
- [ ] 计分板
- [ ] 技能充能条
- [ ] 得分提示

### Phase 3: 完善 UI（1周）
- [ ] 角色选择场景
- [ ] 结算场景
- [ ] 暂停/设置弹窗

---

## 九、总结

UI 系统设计遵循以下原则：
1. **模块化**: 每个 UI 组件独立封装
2. **事件驱动**: 通过 EventBus 解耦 UI 与逻辑
3. **响应式**: 适配不同分辨率
4. **性能优化**: 对象池、图集、减少 Draw Call
5. **用户体验**: 流畅的动画、清晰的反馈
