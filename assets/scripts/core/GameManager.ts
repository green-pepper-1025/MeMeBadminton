import {
    _decorator,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    RigidBody2D,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';
const { ccclass, property } = _decorator;

type GameState = 'waitingServe' | 'playing' | 'roundEnd' | 'matchEnd';
type AppState = 'main_menu' | 'online_room' | 'character_select' | 'battle' | 'result';
type PlayerId = 'player1' | 'player2';
type BattleMode = 'local' | 'online';

interface CharacterDefinition {
    characterId: string;
    displayName: string;
    skillId: string;
    description: string;
}

interface PlayerSetup {
    playerId: PlayerId;
    displayName: string;
    characterId: string;
    isReady: boolean;
}

interface MatchSetup {
    roomId: string;
    localPlayerId: PlayerId;
    players: PlayerSetup[];
}

interface MatchResult {
    winnerPlayerId: PlayerId;
    player1RoundsWon: number;
    player2RoundsWon: number;
}

@ccclass('GameManager')
export class GameManager extends Component {
    @property(Label)
    public score1Label: Label = null;
    @property(Label)
    public score2Label: Label = null;

    @property(Node)
    public shuttlecock: Node = null;

    @property(Node)
    public netNode: Node = null; // 拖入球网节点

    @property
    public floorY: number = -350;

    @property
    public pointsToWinRound: number = 11;

    @property
    public roundsToWinMatch: number = 2;

    // 发球基础力度
    @property
    public serveForceX: number = 300; // 水平方向
    @property
    public serveForceY: number = 600; // 垂直方向

    @property(SpriteFrame)
    public kobeSpriteFrame: SpriteFrame = null;

    @property(SpriteFrame)
    public caixukunSpriteFrame: SpriteFrame = null;

    @property(SpriteFrame)
    public nailongSpriteFrame: SpriteFrame = null;

    private _score1: number = 0;
    private _score2: number = 0;
    private _roundsWon1: number = 0;
    private _roundsWon2: number = 0;

    // 当前状态：'waitingServe' | 'playing' | 'roundEnd' | 'matchEnd'
    private _gameState: GameState = 'waitingServe';
    // 当前发球方：1 或 2
    private _currentServer: number = 1;
    private _appState: AppState = 'main_menu';
    private _battleMode: BattleMode = 'local';
    private _flowRoot: Node = null;
    private _canvasNode: Node = null;
    private _battleNodes: Node[] = [];
    private _player1Node: Node = null;
    private _player2Node: Node = null;
    private _player1StartPos: Vec3 = new Vec3(-500, -250, 0);
    private _player2StartPos: Vec3 = new Vec3(500, -250, 0);
    private _roomId: string = 'ABCD';
    private _matchSetup: MatchSetup = null;
    private _lastResult: MatchResult = null;
    private _selectedCharacters: Record<PlayerId, string> = {
        player1: 'kobe',
        player2: 'caixukun',
    };
    private _confirmedPlayers: Record<PlayerId, boolean> = {
        player1: false,
        player2: false,
    };
    private readonly _characters: CharacterDefinition[] = [
        {
            characterId: 'kobe',
            displayName: '科比',
            skillId: 'helicopter_smash',
            description: '强力扣杀',
        },
        {
            characterId: 'caixukun',
            displayName: '蔡徐坤',
            skillId: 'jiyin_dance',
            description: '轨迹扰动',
        },
        {
            characterId: 'nailong',
            displayName: '奶龙',
            skillId: 'duang',
            description: '接球范围扩大',
        },
    ];

    onLoad() {
        this._canvasNode = this.node.parent;
        this._player1Node = this._canvasNode?.getChildByName('Player1') ?? null;
        this._player2Node = this._canvasNode?.getChildByName('Player2') ?? null;

        if (this._player1Node) {
            this._player1StartPos = this._player1Node.position.clone();
        }
        if (this._player2Node) {
            this._player2StartPos = this._player2Node.position.clone();
        }

        this.collectBattleNodes();
        this.createFlowRoot();
        this.enterMainMenu();
    }

    // 供外部调用：得分后进入发球状态
    private addScoreAndServe(winner: 1 | 2): void {
        if (winner === 1) {
            this._score1++;
        } else {
            this._score2++;
        }
        this.updateScoreLabels();

        // 得分方获得发球权
        this._currentServer = winner;
        this.resetBall();

        if (this._score1 >= this.pointsToWinRound || this._score2 >= this.pointsToWinRound) {
            this.endRound(winner);
            return;
        }

        this._gameState = 'waitingServe';
    }

    // 发球：由 PlayerController 调用
    public tryServe(playerId: number, racketWorldPos: Vec3, facingRight: boolean): void {
        // 只有处于等待发球状态，且是该玩家发球，才能执行
        if (this._gameState !== 'waitingServe' || playerId !== this._currentServer) {
            return;
        }

        const ball = this.shuttlecock;
        if (!ball) return;

        // 激活球并放到球拍位置
        ball.active = true;
        ball.setWorldPosition(racketWorldPos);

        // 获取球的刚体
        const ballBody = ball.getComponent(RigidBody2D);
        if (ballBody) {
            // 停止之前的任何运动
            ballBody.linearVelocity = new Vec2(0, 0);
            ballBody.angularVelocity = 0;

            // 根据朝向计算发球方向（发球方向总是从发球方面向对方）
            const dirX = facingRight ? 1 : -1; // 右侧玩家面向左，左侧面向右
            const impulse = new Vec2(this.serveForceX * dirX, this.serveForceY);
            ballBody.applyLinearImpulseToCenter(impulse, true);
        }

        // 进入比赛状态
        this._gameState = 'playing';
    }

    public onBallLanded(ballX: number): void {
        if (this._gameState !== 'playing') {
            return;
        }

        // 获取球网世界 X 坐标作为分界线
        const dividerX = this.netNode ? this.netNode.worldPosition.x : 0;
        const winner = ballX < dividerX ? 2 : 1;

        console.log(`[落点] X: ${ballX}, 分界: ${dividerX}, 判定: ${winner === 2 ? '左半场 P2得分' : '右半场 P1得分'}`);

        this.addScoreAndServe(winner as 1 | 2);
    }

    private endRound(winner: 1 | 2): void {
        if (winner === 1) {
            this._roundsWon1++;
        } else {
            this._roundsWon2++;
        }

        console.log(`[局结束] P1局数: ${this._roundsWon1}, P2局数: ${this._roundsWon2}`);

        if (this._roundsWon1 >= this.roundsToWinMatch || this._roundsWon2 >= this.roundsToWinMatch) {
            this._gameState = 'matchEnd';
            console.log(`[比赛结束] 获胜方: P${winner}`);
            this.enterResult({
                winnerPlayerId: winner === 1 ? 'player1' : 'player2',
                player1RoundsWon: this._roundsWon1,
                player2RoundsWon: this._roundsWon2,
            });
            return;
        }

        this._gameState = 'roundEnd';
        this._score1 = 0;
        this._score2 = 0;
        this.updateScoreLabels();
        this._gameState = 'waitingServe';
    }

    private resetBall(): void {
        if (!this.shuttlecock) {
            return;
        }

        const ballBody = this.shuttlecock.getComponent(RigidBody2D);
        if (ballBody) {
            ballBody.linearVelocity = new Vec2(0, 0);
            ballBody.angularVelocity = 0;
        }

        this.shuttlecock.active = false;
    }

    private updateScoreLabels(): void {
        if (this.score1Label) {
            this.score1Label.string = `P1 ${this._score1} (${this._roundsWon1})`;
        }
        if (this.score2Label) {
            this.score2Label.string = `P2 ${this._score2} (${this._roundsWon2})`;
        }
    }

    update(_deltaTime: number): void {
        if (this._gameState !== 'playing' || !this.shuttlecock || !this.shuttlecock.active) {
            return;
        }

        // 兜底：如果地板碰撞没有配置成功，仍然按高度阈值结算。
        const ballY = this.shuttlecock.worldPosition.y;
        if (ballY <= this.floorY) {
            this.onBallLanded(this.shuttlecock.worldPosition.x);
        }
    }

    private collectBattleNodes(): void {
        if (!this._canvasNode) {
            return;
        }

        const names = ['Background', 'Player1', 'Player2', 'Walls', 'Score1Label', 'Score2Label'];
        this._battleNodes = names
            .map((name) => this._canvasNode.getChildByName(name))
            .filter((node): node is Node => node !== null);

        if (this.shuttlecock) {
            this._battleNodes.push(this.shuttlecock);
        }

        if (this.netNode) {
            this.netNode.active = true;
        }
    }

    private createFlowRoot(): void {
        if (!this._canvasNode) {
            return;
        }

        this._flowRoot = new Node('MvpFlowRoot');
        this._canvasNode.addChild(this._flowRoot);
        const transform = this._flowRoot.addComponent(UITransform);
        transform.setContentSize(1280, 720);
        this._flowRoot.setPosition(0, 0, 0);
    }

    private setBattleVisible(visible: boolean): void {
        for (const battleNode of this._battleNodes) {
            battleNode.active = visible;
        }

        if (this.shuttlecock) {
            this.shuttlecock.active = false;
        }
    }

    private clearFlowRoot(): void {
        if (!this._flowRoot) {
            return;
        }

        this._flowRoot.removeAllChildren();
    }

    private enterMainMenu(): void {
        this._appState = 'main_menu';
        this._gameState = 'waitingServe';
        this.setBattleVisible(false);
        this.clearFlowRoot();

        this.addLabel('抽象羽球大乱斗', 0, 170, 44);
        this.addLabel('Meme Badminton', 0, 115, 26);
        this.addButton('双人联机', 0, 30, 260, 64, () => this.enterOnlineRoom());
        this.addButton('本地双人', 0, -55, 260, 64, () => this.startBattle('local'));
    }

    private enterOnlineRoom(): void {
        this._appState = 'online_room';
        this._battleMode = 'online';
        this._roomId = this.createRoomId();
        this.clearFlowRoot();
        this.setBattleVisible(false);

        this.addLabel('双人联机', 0, 180, 38);
        this.addLabel(`房间号: ${this._roomId}`, 0, 115, 26);
        this.addLabel('P1: 已加入', 0, 55, 24);
        this.addLabel('P2: 等待中...', 0, 15, 24);
        this.addButton('模拟第二名玩家加入', 0, -70, 330, 58, () => this.enterCharacterSelect());
        this.addButton('取消', 0, -145, 180, 52, () => this.enterMainMenu(), new Color(78, 84, 96, 255));
    }

    private enterCharacterSelect(): void {
        this._appState = 'character_select';
        this._battleMode = 'online';
        this._confirmedPlayers.player1 = false;
        this._confirmedPlayers.player2 = false;
        this.clearFlowRoot();
        this.renderCharacterSelect();
    }

    private renderCharacterSelect(): void {
        this.clearFlowRoot();
        this.setBattleVisible(false);

        this.addLabel('选择角色', 0, 205, 38);

        this._characters.forEach((character, index) => {
            this.addButton(character.displayName, -260 + index * 260, 120, 210, 58, () =>
                this.selectCharacter('player1', character.characterId),
            );
        });

        const p1Character = this.getCharacter(this._selectedCharacters.player1);
        const p2Character = this.getCharacter(this._selectedCharacters.player2);
        this.addLabel(
            `我方: ${p1Character.displayName} / ${this._confirmedPlayers.player1 ? '已确认' : '未确认'}`,
            0,
            35,
            24,
        );
        this.addLabel(`技能: ${p1Character.description}`, 0, 0, 22);
        this.addLabel(
            `对方: ${p2Character.displayName} / ${this._confirmedPlayers.player2 ? '已确认' : '选择中'}`,
            0,
            -42,
            22,
        );

        this.addButton('确认我方角色', -150, -125, 230, 58, () => this.confirmCharacter('player1'));
        this.addButton('模拟对方确认', 150, -125, 230, 58, () => this.confirmCharacter('player2'));
        this.addButton('返回房间', 0, -200, 180, 46, () => this.enterOnlineRoom(), new Color(78, 84, 96, 255));
    }

    private selectCharacter(playerId: PlayerId, characterId: string): void {
        if (this._confirmedPlayers[playerId]) {
            return;
        }

        this._selectedCharacters[playerId] = characterId;
        if (playerId === 'player1') {
            const opponentIndex =
                (this._characters.findIndex((item) => item.characterId === characterId) + 1) % this._characters.length;
            this._selectedCharacters.player2 = this._characters[opponentIndex].characterId;
        }
        this.renderCharacterSelect();
    }

    private confirmCharacter(playerId: PlayerId): void {
        this._confirmedPlayers[playerId] = true;

        if (this._confirmedPlayers.player1 && this._confirmedPlayers.player2) {
            this.createMatchSetup();
            this.startBattle('online');
            return;
        }

        this.renderCharacterSelect();
    }

    private startBattle(mode: BattleMode): void {
        this._appState = 'battle';
        this._battleMode = mode;

        if (mode === 'local') {
            this._matchSetup = {
                roomId: 'LOCAL',
                localPlayerId: 'player1',
                players: [
                    { playerId: 'player1', displayName: 'P1', characterId: 'kobe', isReady: true },
                    { playerId: 'player2', displayName: 'P2', characterId: 'caixukun', isReady: true },
                ],
            };
        }

        this.clearFlowRoot();
        this.setBattleVisible(true);
        this.resetMatch();
        this.applyCharacterSprites();
    }

    private resetMatch(): void {
        this._score1 = 0;
        this._score2 = 0;
        this._roundsWon1 = 0;
        this._roundsWon2 = 0;
        this._currentServer = 1;
        this._gameState = 'waitingServe';
        this.resetBall();
        this.updateScoreLabels();

        if (this._player1Node) {
            this._player1Node.setPosition(this._player1StartPos);
        }
        if (this._player2Node) {
            this._player2Node.setPosition(this._player2StartPos);
        }
    }

    private enterResult(result: MatchResult): void {
        this._appState = 'result';
        this._lastResult = result;
        this.setBattleVisible(false);
        this.clearFlowRoot();

        const winnerText = result.winnerPlayerId === 'player1' ? 'P1 获胜' : 'P2 获胜';
        this.addLabel('比赛结果', 0, 170, 38);
        this.addLabel(winnerText, 0, 95, 34);
        this.addLabel(`局分 ${result.player1RoundsWon} : ${result.player2RoundsWon}`, 0, 40, 28);
        this.addButton('返回主页面', -150, -70, 230, 58, () => this.enterMainMenu());
        this.addButton('再来一局', 150, -70, 230, 58, () => {
            if (this._battleMode === 'online') {
                this.enterCharacterSelect();
            } else {
                this.startBattle('local');
            }
        });
    }

    private createMatchSetup(): void {
        this._matchSetup = {
            roomId: this._roomId,
            localPlayerId: 'player1',
            players: [
                {
                    playerId: 'player1',
                    displayName: 'P1',
                    characterId: this._selectedCharacters.player1,
                    isReady: true,
                },
                {
                    playerId: 'player2',
                    displayName: 'P2',
                    characterId: this._selectedCharacters.player2,
                    isReady: true,
                },
            ],
        };
    }

    private applyCharacterSprites(): void {
        if (!this._matchSetup) {
            return;
        }

        for (const player of this._matchSetup.players) {
            const playerNode = player.playerId === 'player1' ? this._player1Node : this._player2Node;
            if (!playerNode) {
                continue;
            }

            playerNode.getChildByName('CharacterName')?.destroy();

            const character = this.getCharacter(player.characterId);
            const bodySprite = playerNode.getChildByName('Body')?.getComponent(Sprite);
            if (!bodySprite) {
                continue;
            }

            const spriteFrame = this.getCharacterSpriteFrame(character.characterId);
            if (spriteFrame) {
                bodySprite.spriteFrame = spriteFrame;
            }
        }
    }

    private addButton(
        text: string,
        x: number,
        y: number,
        width: number,
        height: number,
        onClick: () => void,
        color: Color = new Color(42, 126, 210, 255),
    ): Node {
        const buttonNode = new Node(`${text}Button`);
        this._flowRoot.addChild(buttonNode);
        buttonNode.setPosition(x, y, 0);
        buttonNode.addComponent(UITransform).setContentSize(width, height);
        const graphics = buttonNode.addComponent(Graphics);
        graphics.fillColor = color;
        graphics.roundRect(-width / 2, -height / 2, width, height, 8);
        graphics.fill();
        buttonNode.on(Node.EventType.TOUCH_END, onClick, this);

        const labelNode = new Node('Label');
        buttonNode.addChild(labelNode);
        labelNode.addComponent(UITransform).setContentSize(width, height);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 24;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        return buttonNode;
    }

    private addLabel(text: string, x: number, y: number, fontSize: number): Node {
        const labelNode = new Node(`${text}Label`);
        this._flowRoot.addChild(labelNode);
        labelNode.setPosition(x, y, 0);
        labelNode.addComponent(UITransform).setContentSize(760, 52);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return labelNode;
    }

    private getCharacter(characterId: string): CharacterDefinition {
        return this._characters.find((character) => character.characterId === characterId) ?? this._characters[0];
    }

    private getCharacterSpriteFrame(characterId: string): SpriteFrame {
        if (characterId === 'kobe') {
            return this.kobeSpriteFrame;
        }
        if (characterId === 'caixukun') {
            return this.caixukunSpriteFrame;
        }
        if (characterId === 'nailong') {
            return this.nailongSpriteFrame;
        }

        return null;
    }

    private createRoomId(): string {
        return Math.random().toString(36).slice(2, 6).toUpperCase();
    }
}
