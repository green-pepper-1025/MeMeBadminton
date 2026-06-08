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
import { PlayerCommand } from './InputRouter';
import { NetworkClient, BallStatePayload, RoomSnapshot, ScoreUpdatePayload } from '../net/NetworkClient';
import { SkillExecutor } from '../skill/SkillExecutor';
import { SkillPlayerId, SkillSystem } from '../skill/SkillSystem';
import { LocalCharacterSelect } from './LocalCharacterSelect';
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

    @property
    public characterBodyWidth: number = 96;

    @property
    public characterBodyHeight: number = 132;

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
    private _localPlayerId: PlayerId = 'player1';
    private _isHost: boolean = true;
    private _serverUrl: string = 'ws://localhost:8787';
    private _connectionStatus: string = '未连接';
    private _roomSnapshot: RoomSnapshot = null;
    private _pendingBallState: BallStatePayload = null;
    private _ballSyncElapsed: number = 0;
    private readonly _ballSyncInterval: number = 1 / 15;
    private readonly _network: NetworkClient = NetworkClient.getInstance();
    private readonly _skillSystem: SkillSystem = new SkillSystem();
    private readonly _skillExecutor: SkillExecutor = new SkillExecutor();
    private readonly _localCharacterSelect: LocalCharacterSelect = new LocalCharacterSelect('kobe', 'caixukun');
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
        this.registerNetworkHandlers();
        this.enterMainMenu();
    }

    onDestroy(): void {
        this.unregisterNetworkHandlers();
    }

    // 供外部调用：得分后进入发球状态
    private addScoreAndServe(winner: 1 | 2): void {
        if (!this.canApplyBallPhysics()) {
            return;
        }

        this._skillExecutor.clearEffects();

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
            this.broadcastScoreUpdate(winner);
            return;
        }

        this._gameState = 'waitingServe';
        this.broadcastScoreUpdate(winner);
    }

    // 发球：由 PlayerController 调用
    public tryServe(playerId: number, racketWorldPos: Vec3, facingRight: boolean): void {
        if (!this.canApplyBallPhysics()) {
            return;
        }

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
        this.broadcastBallState();
    }

    public onBallLanded(ballX: number): void {
        if (!this.canApplyBallPhysics()) {
            return;
        }

        if (this._gameState !== 'playing') {
            return;
        }

        // 获取球网世界 X 坐标作为分界线
        const dividerX = this.netNode ? this.netNode.worldPosition.x : 0;
        const winner = ballX < dividerX ? 2 : 1;

        console.log(`[落点] X: ${ballX}, 分界: ${dividerX}, 判定: ${winner === 2 ? '左半场 P2得分' : '右半场 P1得分'}`);

        this.addScoreAndServe(winner as 1 | 2);
    }

    public onPlayerHitBall(playerId: number): void {
        if (!this.canApplyBallPhysics()) {
            return;
        }

        if (this._gameState !== 'playing') {
            return;
        }

        this._skillSystem.addHitCharge(this.toSkillPlayerId(playerId));
        this.updateScoreLabels();
    }

    public tryUseSkill(playerId: number): boolean {
        if (!this.canApplyBallPhysics()) {
            return false;
        }

        if (this._gameState !== 'playing') {
            return false;
        }

        const skillPlayerId = this.toSkillPlayerId(playerId);
        const playerNode = skillPlayerId === 'player1' ? this._player1Node : this._player2Node;
        let state = null;

        try {
            state = this._skillSystem.getState(skillPlayerId);
        } catch {
            return false;
        }

        if (!state.isReady || state.usesRemaining <= 0) {
            return false;
        }

        const effectApplied = this._skillExecutor.execute(state.skillId, skillPlayerId, playerNode, this.shuttlecock);
        if (!effectApplied) {
            return false;
        }

        const result = this._skillSystem.tryUseSkill(skillPlayerId);
        this.updateScoreLabels();
        return result.success;
    }

    public canApplyBallPhysics(): boolean {
        return this._battleMode !== 'online' || this._isHost;
    }

    public onLocalPlayerCommand(command: PlayerCommand): void {
        if (this._battleMode !== 'online' || !this._network.isConnected) {
            return;
        }

        this._network.sendPlayerInput(command);
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
        this._skillExecutor.clearEffects();
        this._skillSystem.resetRound();
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
            this.score1Label.string = `P1 ${this._score1} (${this._roundsWon1})\n${this.getSkillStatusText('player1')}`;
        }
        if (this.score2Label) {
            this.score2Label.string = `P2 ${this._score2} (${this._roundsWon2})\n${this.getSkillStatusText('player2')}`;
        }
    }

    update(deltaTime: number): void {
        if (this._appState === 'battle' && this._gameState === 'playing') {
            this._skillSystem.update(deltaTime);
            this._skillExecutor.update(deltaTime, this.shuttlecock);
            this.updateScoreLabels();
        }

        if (this._appState === 'battle' && this._battleMode === 'online') {
            if (this._isHost) {
                this._ballSyncElapsed += deltaTime;
                if (this._ballSyncElapsed >= this._ballSyncInterval) {
                    this._ballSyncElapsed = 0;
                    this.broadcastBallState();
                }
            } else {
                this.smoothRemoteBall(deltaTime);
            }
        }

        if (this._gameState !== 'playing' || !this.shuttlecock || !this.shuttlecock.active) {
            return;
        }

        if (!this.canApplyBallPhysics()) {
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
        this.addButton('本地双人', 0, -55, 260, 64, () => this.enterLocalCharacterSelect());
    }

    private enterLocalCharacterSelect(): void {
        this._appState = 'character_select';
        this._battleMode = 'local';
        this._matchSetup = null;
        this._localCharacterSelect.reset();
        this.clearFlowRoot();
        this.renderCharacterSelect();
    }

    private enterOnlineRoom(): void {
        this._appState = 'online_room';
        this._battleMode = 'online';
        this._roomId = this._roomId === 'ABCD' ? 'LAN1' : this._roomId;
        this.clearFlowRoot();
        this.setBattleVisible(false);

        this.addLabel('双人联机', 0, 180, 38);
        this.addLabel(`服务器: ${this._serverUrl}`, 0, 120, 22);
        this.addLabel(`状态: ${this._connectionStatus}`, 0, 78, 22);
        this.addLabel(`房间号: ${this._roomId}`, 0, 36, 24);

        const p1 = this._roomSnapshot?.players.find((player) => player.playerId === 'player1');
        const p2 = this._roomSnapshot?.players.find((player) => player.playerId === 'player2');
        this.addLabel(`P1: ${p1?.connected ? '已加入' : '等待中'} ${p1?.isReady ? '/ 已准备' : ''}`, 0, -12, 22);
        this.addLabel(`P2: ${p2?.connected ? '已加入' : '等待中'} ${p2?.isReady ? '/ 已准备' : ''}`, 0, -50, 22);

        this.addButton('修改地址', -170, -115, 220, 52, () => this.editServerAddress(), new Color(78, 84, 96, 255));
        this.addButton('连接房间', 110, -115, 220, 52, () => this.connectOnlineRoom());
        this.addButton('取消', 0, -190, 180, 52, () => this.enterMainMenu(), new Color(78, 84, 96, 255));
    }

    private enterCharacterSelect(): void {
        this._appState = 'character_select';
        this._battleMode = 'online';
        this.clearFlowRoot();
        this.renderCharacterSelect();
    }

    private renderCharacterSelect(): void {
        this.clearFlowRoot();
        this.setBattleVisible(false);

        if (this._battleMode === 'local') {
            this.renderLocalCharacterSelect();
            return;
        }

        this.addLabel('选择角色', 0, 205, 38);

        const localPlayerId = this._battleMode === 'online' ? this._localPlayerId : 'player1';
        const remotePlayerId = localPlayerId === 'player1' ? 'player2' : 'player1';

        this._characters.forEach((character, index) => {
            this.addButton(character.displayName, -260 + index * 260, 120, 210, 58, () =>
                this.selectCharacter(localPlayerId, character.characterId),
            );
        });

        const localCharacter = this.getCharacter(this._selectedCharacters[localPlayerId]);
        const remoteCharacter = this.getCharacter(this._selectedCharacters[remotePlayerId]);
        this.addLabel(
            `我方(${localPlayerId === 'player1' ? 'P1' : 'P2'}): ${localCharacter.displayName} / ${this._confirmedPlayers[localPlayerId] ? '已确认' : '未确认'}`,
            0,
            35,
            24,
        );
        this.addLabel(`技能: ${localCharacter.description}`, 0, 0, 22);
        this.addLabel(
            `对方(${remotePlayerId === 'player1' ? 'P1' : 'P2'}): ${remoteCharacter.displayName} / ${this._confirmedPlayers[remotePlayerId] ? '已确认' : '选择中'}`,
            0,
            -42,
            22,
        );

        this.addButton('确认我方角色', -150, -125, 230, 58, () => this.confirmCharacter(localPlayerId));
        this.addButton('刷新房间', 150, -125, 230, 58, () => this.renderCharacterSelect(), new Color(78, 84, 96, 255));
        this.addButton('返回房间', 0, -200, 180, 46, () => this.enterOnlineRoom(), new Color(78, 84, 96, 255));
    }

    private renderLocalCharacterSelect(): void {
        this.addLabel('本地双人选角', 0, 220, 38);
        this.addLocalPlayerSelectColumn('player1', -310, 'P1');
        this.addLocalPlayerSelectColumn('player2', 310, 'P2');

        const readyText = this._localCharacterSelect.isReadyToStart() ? '双方已确认，准备开始' : '双方确认后开始对战';
        this.addLabel(readyText, 0, -170, 22);
        this.addButton('返回主菜单', 0, -230, 210, 48, () => this.enterMainMenu(), new Color(78, 84, 96, 255));
    }

    private addLocalPlayerSelectColumn(playerId: PlayerId, x: number, title: string): void {
        const selectedCharacter = this.getCharacter(this._localCharacterSelect.getSelectedCharacter(playerId));
        const confirmed = this._localCharacterSelect.isConfirmed(playerId);

        this.addLabel(`${title} ${confirmed ? '已确认' : '选择中'}`, x, 150, 28, 460);
        this._characters.forEach((character, index) => {
            const isSelected = selectedCharacter.characterId === character.characterId;
            const buttonColor = isSelected ? new Color(42, 126, 210, 255) : new Color(78, 84, 96, 255);
            this.addButton(
                character.displayName,
                x - 150 + index * 150,
                85,
                130,
                52,
                () => this.selectCharacter(playerId, character.characterId),
                buttonColor,
            );
        });
        this.addLabel(`当前: ${selectedCharacter.displayName}`, x, 20, 24, 460);
        this.addLabel(`技能: ${selectedCharacter.description}`, x, -20, 22, 460);
        this.addButton(confirmed ? '已确认' : `确认${title}角色`, x, -95, 230, 54, () =>
            this.confirmCharacter(playerId),
        );
    }

    private selectCharacter(playerId: PlayerId, characterId: string): void {
        if (this._battleMode === 'local') {
            this._localCharacterSelect.selectCharacter(playerId, characterId);
            this.renderCharacterSelect();
            return;
        }

        if (this._confirmedPlayers[playerId]) {
            return;
        }

        this._selectedCharacters[playerId] = characterId;

        if (this._battleMode === 'online') {
            this._network.selectCharacter(characterId);
        }
        this.renderCharacterSelect();
    }

    private confirmCharacter(playerId: PlayerId): void {
        if (this._battleMode === 'local') {
            this._localCharacterSelect.confirmPlayer(playerId);
            if (this._localCharacterSelect.isReadyToStart()) {
                this._matchSetup = this._localCharacterSelect.createMatchSetup();
                this.startBattle('local');
                return;
            }

            this.renderCharacterSelect();
            return;
        }

        this._confirmedPlayers[playerId] = true;

        if (this._battleMode === 'online') {
            this._network.setReady(true);
            this.renderCharacterSelect();
            return;
        }

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

        if (mode === 'local' && !this._matchSetup) {
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
        this.initializeSkills();
        this.resetMatch();
        this.applyCharacterSprites();
        this.configurePlayerControl();
    }

    private resetMatch(): void {
        this._score1 = 0;
        this._score2 = 0;
        this._roundsWon1 = 0;
        this._roundsWon2 = 0;
        this._currentServer = 1;
        this._gameState = 'waitingServe';
        this._skillExecutor.clearEffects();
        this._skillSystem.resetRound();
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
                this.enterLocalCharacterSelect();
            }
        });
    }

    private createMatchSetup(): void {
        this._matchSetup = {
            roomId: this._roomId,
            localPlayerId: this._localPlayerId,
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

    private createMatchSetupFromSnapshot(snapshot: RoomSnapshot): void {
        this._matchSetup = {
            roomId: snapshot.roomId,
            localPlayerId: this._localPlayerId,
            players: [
                {
                    playerId: 'player1',
                    displayName: 'P1',
                    characterId:
                        snapshot.players.find((player) => player.playerId === 'player1')?.characterId ??
                        this._selectedCharacters.player1,
                    isReady: snapshot.players.find((player) => player.playerId === 'player1')?.isReady ?? false,
                },
                {
                    playerId: 'player2',
                    displayName: 'P2',
                    characterId:
                        snapshot.players.find((player) => player.playerId === 'player2')?.characterId ??
                        this._selectedCharacters.player2,
                    isReady: snapshot.players.find((player) => player.playerId === 'player2')?.isReady ?? false,
                },
            ],
        };
    }

    private configurePlayerControl(): void {
        const p1Controller = this._player1Node?.getComponent('PlayerController') as any;
        const p2Controller = this._player2Node?.getComponent('PlayerController') as any;

        if (this._battleMode === 'local') {
            if (p1Controller) p1Controller.isLocalControlled = true;
            if (p2Controller) p2Controller.isLocalControlled = true;
            this._localPlayerId = 'player1';
            this._isHost = true;
            return;
        }

        if (p1Controller) p1Controller.isLocalControlled = this._localPlayerId === 'player1';
        if (p2Controller) p2Controller.isLocalControlled = this._localPlayerId === 'player2';
        this._isHost = this._localPlayerId === 'player1';
    }

    private initializeSkills(): void {
        if (!this._matchSetup) {
            return;
        }

        for (const player of this._matchSetup.players) {
            const character = this.getCharacter(player.characterId);
            this._skillSystem.initializePlayer(player.playerId, character.skillId);
        }
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
                this.applyCharacterAppearance(bodySprite, spriteFrame);
            }
        }
    }

    private applyCharacterAppearance(bodySprite: Sprite, spriteFrame: SpriteFrame): void {
        bodySprite.spriteFrame = spriteFrame;
        const transform = bodySprite.node.getComponent(UITransform);
        transform?.setContentSize(this.characterBodyWidth, this.characterBodyHeight);
    }

    private registerNetworkHandlers(): void {
        this._network.on('CONNECTED', this.onNetworkConnected);
        this._network.on('ROOM_SNAPSHOT', this.onRoomSnapshot);
        this._network.on('MATCH_START', this.onMatchStart);
        this._network.on('PLAYER_INPUT', this.onRemotePlayerInput);
        this._network.on('BALL_STATE', this.onRemoteBallState);
        this._network.on('SCORE_UPDATE', this.onRemoteScoreUpdate);
        this._network.on('PLAYER_DISCONNECTED', this.onNetworkDisconnected);
        this._network.on('ERROR', this.onNetworkError);
    }

    private unregisterNetworkHandlers(): void {
        this._network.off('CONNECTED', this.onNetworkConnected);
        this._network.off('ROOM_SNAPSHOT', this.onRoomSnapshot);
        this._network.off('MATCH_START', this.onMatchStart);
        this._network.off('PLAYER_INPUT', this.onRemotePlayerInput);
        this._network.off('BALL_STATE', this.onRemoteBallState);
        this._network.off('SCORE_UPDATE', this.onRemoteScoreUpdate);
        this._network.off('PLAYER_DISCONNECTED', this.onNetworkDisconnected);
        this._network.off('ERROR', this.onNetworkError);
    }

    private onNetworkConnected = (): void => {
        this._connectionStatus = this._network.isConnected ? '已连接' : '连接中...';
        if (this._network.isConnected) {
            this._network.joinRoom(this._roomId);
        }
        if (this._appState === 'online_room') {
            this.enterOnlineRoom();
        }
    };

    private onNetworkDisconnected = (): void => {
        this._connectionStatus = '已断开';
        if (this._battleMode === 'online' && this._appState === 'battle') {
            this.enterOnlineRoom();
        } else if (this._appState === 'online_room') {
            this.enterOnlineRoom();
        }
    };

    private onNetworkError = (data: any): void => {
        this._connectionStatus = `错误: ${data?.message ?? '连接失败'}`;
        if (this._appState === 'online_room') {
            this.enterOnlineRoom();
        }
    };

    private onRoomSnapshot = (snapshot: RoomSnapshot): void => {
        this._roomSnapshot = snapshot;
        this._roomId = snapshot.roomId;
        if (snapshot.localPlayerId) {
            this._localPlayerId = snapshot.localPlayerId;
            this._isHost = this._localPlayerId === snapshot.hostPlayerId;
        }

        for (const player of snapshot.players) {
            this._selectedCharacters[player.playerId] = player.characterId;
            this._confirmedPlayers[player.playerId] = player.isReady;
        }

        if (this._appState === 'online_room' && snapshot.players.length >= 2) {
            this.enterCharacterSelect();
            return;
        }

        if (this._appState === 'online_room') {
            this.enterOnlineRoom();
        } else if (this._appState === 'character_select') {
            this.renderCharacterSelect();
        }
    };

    private onMatchStart = (snapshot: RoomSnapshot): void => {
        this._roomSnapshot = snapshot;
        this.createMatchSetupFromSnapshot(snapshot);
        this.startBattle('online');
    };

    private onRemotePlayerInput = (data: any): void => {
        const command = data?.command as PlayerCommand;
        if (!command) {
            return;
        }

        const targetNode = command.playerId === 1 ? this._player1Node : this._player2Node;
        const controller = targetNode?.getComponent('PlayerController') as any;
        controller?.handleCommand?.(command);
    };

    private onRemoteBallState = (payload: BallStatePayload): void => {
        if (this._isHost) {
            return;
        }

        this._pendingBallState = payload;
        this._currentServer = payload.currentServer;
        this._gameState = payload.gameState as GameState;
    };

    private onRemoteScoreUpdate = (payload: ScoreUpdatePayload): void => {
        if (this._isHost) {
            return;
        }

        this._score1 = payload.score1;
        this._score2 = payload.score2;
        this._roundsWon1 = payload.roundsWon1;
        this._roundsWon2 = payload.roundsWon2;
        this._currentServer = payload.currentServer;
        this._gameState = payload.gameState as GameState;
        this.updateScoreLabels();
        if (payload.gameState !== 'playing') {
            this.resetBall();
        }
    };

    private editServerAddress(): void {
        const nextUrl = window.prompt('输入 WebSocket 服务器地址', this._serverUrl);
        if (!nextUrl) {
            return;
        }

        this._serverUrl = nextUrl;
        this.enterOnlineRoom();
    }

    private connectOnlineRoom(): void {
        this._connectionStatus = '连接中...';
        this.enterOnlineRoom();
        this._network.connect(this._serverUrl);
    }

    private broadcastBallState(): void {
        if (this._battleMode !== 'online' || !this._isHost || !this._network.isConnected || !this.shuttlecock) {
            return;
        }

        const body = this.shuttlecock.getComponent(RigidBody2D);
        this._network.sendBallState({
            position: {
                x: this.shuttlecock.worldPosition.x,
                y: this.shuttlecock.worldPosition.y,
                z: this.shuttlecock.worldPosition.z,
            },
            velocity: {
                x: body?.linearVelocity.x ?? 0,
                y: body?.linearVelocity.y ?? 0,
            },
            active: this.shuttlecock.active,
            currentServer: this._currentServer,
            gameState: this._gameState,
        });
    }

    private broadcastScoreUpdate(winner: 1 | 2): void {
        if (this._battleMode !== 'online' || !this._isHost || !this._network.isConnected) {
            return;
        }

        this._network.sendScoreUpdate({
            score1: this._score1,
            score2: this._score2,
            roundsWon1: this._roundsWon1,
            roundsWon2: this._roundsWon2,
            currentServer: this._currentServer,
            gameState: this._gameState,
            winnerPlayerId: winner === 1 ? 'player1' : 'player2',
        });
    }

    private smoothRemoteBall(deltaTime: number): void {
        if (!this._pendingBallState || !this.shuttlecock) {
            return;
        }

        this.shuttlecock.active = this._pendingBallState.active;
        if (!this.shuttlecock.active) {
            return;
        }

        const current = this.shuttlecock.worldPosition;
        const target = new Vec3(
            this._pendingBallState.position.x,
            this._pendingBallState.position.y,
            this._pendingBallState.position.z,
        );
        const distance = Vec3.distance(current, target);
        const correction = distance > 120 ? 1 : Math.min(1, deltaTime * 12);
        const next = new Vec3();
        Vec3.lerp(next, current, target, correction);
        this.shuttlecock.setWorldPosition(next);

        const body = this.shuttlecock.getComponent(RigidBody2D);
        if (body) {
            body.linearVelocity = new Vec2(this._pendingBallState.velocity.x, this._pendingBallState.velocity.y);
            body.angularVelocity = 0;
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

    private addLabel(text: string, x: number, y: number, fontSize: number, width: number = 760): Node {
        const labelNode = new Node(`${text}Label`);
        this._flowRoot.addChild(labelNode);
        labelNode.setPosition(x, y, 0);
        labelNode.addComponent(UITransform).setContentSize(width, 52);
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

    private toSkillPlayerId(playerId: number): SkillPlayerId {
        return playerId === 1 ? 'player1' : 'player2';
    }

    private getSkillStatusText(playerId: SkillPlayerId): string {
        try {
            const state = this._skillSystem.getState(playerId);
            const readyText = state.isReady ? 'READY' : `${Math.floor(state.charge)}%`;
            return `技能 ${readyText} x${state.usesRemaining}`;
        } catch {
            return '技能 --';
        }
    }

    private createRoomId(): string {
        return Math.random().toString(36).slice(2, 6).toUpperCase();
    }
}
