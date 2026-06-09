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
import {
    NetworkClient,
    BallStatePayload,
    LanRoomAdvertise,
    RoomSnapshot,
    ScoreUpdatePayload,
} from '../net/NetworkClient';
import { SkillExecutor } from '../skill/SkillExecutor';
import { SkillPlayerId, SkillSystem } from '../skill/SkillSystem';
import { AudioManager } from '../audio/AudioManager';
import { LocalCharacterSelect } from './LocalCharacterSelect';
import { buildLanRoomViewModel, shouldRequestLanRoomBrowse } from './LanRoomFlowModel';
import { buildScoreboardModel, buildSkillMeterModel } from './BattleHudModel';
import { ShuttleCourtCollision } from '../ball/ShuttleCollision';
import { lockRoundForScore, startNextRally } from './RoundScoringModel';
import { VictoryVideoManager } from '../media/VictoryVideoManager';
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

interface ScoreboardHudRefs {
    root: Node;
    player1NameLabel: Label;
    player2NameLabel: Label;
    score1Label: Label;
    score2Label: Label;
    gameLabel: Label;
    roundsLabel: Label;
}

interface SkillMeterHudRefs {
    root: Node;
    fillGraphics: Graphics;
    playerLabel: Label;
    usesLabel: Label;
    color: Color;
}

interface LocalCharacterCardLayout {
    x: number;
    y: number;
    width: number;
    height: number;
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

    @property(SpriteFrame)
    public startSpriteFrame: SpriteFrame = null;

    @property(SpriteFrame)
    public localCharacterSelectSpriteFrame: SpriteFrame = null;

    @property(SpriteFrame)
    public connectSpriteFrame: SpriteFrame = null;

    @property
    public characterBodyWidth: number = 96;

    @property
    public characterBodyHeight: number = 132;

    @property(Vec3)
    public leftKobeSkillPoint: Vec3 = new Vec3(-285, -30, 0);

    @property(Vec3)
    public rightKobeSkillPoint: Vec3 = new Vec3(285, -30, 0);

    @property
    public kobeSkillHorizontalSpeed: number = 980;

    @property
    public kobeSkillVerticalSpeed: number = 220;

    @property
    public kobeSkillDownwardForce: number = 40;

    @property
    public kobeSkillDuration: number = 0.32;

    @property
    public kobeSkillInputLockDuration: number = 0.28;

    @property(Vec3)
    public leftKunSkillPoint: Vec3 = new Vec3(-380, 92, 0);

    @property(Vec3)
    public rightKunSkillPoint: Vec3 = new Vec3(380, 92, 0);

    @property
    public kunSkillHorizontalSpeed: number = 900;

    @property
    public kunSkillDuration: number = 0.82;

    @property
    public kunSkillCurveAmplitude: number = 94;

    @property
    public kunSkillCurveFrequency: number = 1.5;

    @property
    public kunSkillVerticalLift: number = 88;

    @property
    public kunSkillVerticalDrop: number = 70;

    @property
    public kunSkillBallOffsetY: number = -18;

    @property
    public kunSkillControlPoints: number = 18;

    @property
    public kunSkillInputLockDuration: number = 0.32;

    private _score1: number = 0;
    private _score2: number = 0;
    private _roundsWon1: number = 0;
    private _roundsWon2: number = 0;

    // 当前状态：'waitingServe' | 'playing' | 'roundEnd' | 'matchEnd'
    private _gameState: GameState = 'waitingServe';
    private _hasScoredThisRally: boolean = false;
    // 当前发球方：1 或 2
    private _currentServer: number = 1;
    private _appState: AppState = 'main_menu';
    private _battleMode: BattleMode = 'local';
    private _flowRoot: Node = null;
    private _battleHudRoot: Node = null;
    private _scoreboardHud: ScoreboardHudRefs = null;
    private _skillMeterHuds: Record<SkillPlayerId, SkillMeterHudRefs> = {
        player1: null,
        player2: null,
    };
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
    private _lanRooms: LanRoomAdvertise[] = [];
    private _pendingNetworkAction: () => void = null;
    private _lanRoomBrowseElapsed: number = 0;
    private _hasRequestedInitialLanBrowse: boolean = false;
    private _pendingBallState: BallStatePayload = null;
    private _ballSyncElapsed: number = 0;
    private readonly _ballSyncInterval: number = 1 / 15;
    private readonly _lanRoomBrowseInterval: number = 3;
    private readonly _network: NetworkClient = NetworkClient.getInstance();
    private readonly _audioManager: AudioManager = AudioManager.getInstance();
    private readonly _skillSystem: SkillSystem = new SkillSystem();
    private readonly _skillExecutor: SkillExecutor = new SkillExecutor();
    private readonly _localCharacterSelect: LocalCharacterSelect = new LocalCharacterSelect('kobe', 'caixukun');
    private _victoryVideoManager: VictoryVideoManager = null;
    private readonly _localCharacterCardLayouts: Record<PlayerId, LocalCharacterCardLayout[]> = {
        player1: [
            { x: -516, y: 37, width: 150, height: 240 },
            { x: -356, y: 37, width: 150, height: 240 },
            { x: -201, y: 37, width: 150, height: 240 },
        ],
        player2: [
            { x: 204, y: 37, width: 150, height: 240 },
            { x: 356, y: 37, width: 150, height: 240 },
            { x: 510, y: 37, width: 150, height: 240 },
        ],
    };
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

        this.ensureShuttleCollision();
        this.collectBattleNodes();
        this.createBattleHud();
        this.createFlowRoot();
        this._victoryVideoManager = new VictoryVideoManager(this._flowRoot);
        this.registerNetworkHandlers();
        this._audioManager.playBackgroundMusic();
        this.enterMainMenu();
    }

    onDestroy(): void {
        this._victoryVideoManager?.cleanupOverlay();
        this.unregisterNetworkHandlers();
    }

    // 供外部调用：得分后进入发球状态
    private addScoreAndServe(winner: 1 | 2): boolean {
        if (!this.canApplyBallPhysics()) {
            return false;
        }

        if (!this.lockCurrentRallyForScore()) {
            return false;
        }

        this._skillExecutor.clearEffects();

        if (winner === 1) {
            this._score1++;
        } else {
            this._score2++;
        }
        this.playCharacterScoreCue(winner === 1 ? 'player1' : 'player2');
        this.updateScoreLabels();

        // 得分方获得发球权
        this._currentServer = winner;
        this.resetBall();

        if (this._score1 >= this.pointsToWinRound || this._score2 >= this.pointsToWinRound) {
            this.endRound(winner);
            this.broadcastScoreUpdate(winner);
            return true;
        }

        this._gameState = 'waitingServe';
        this.broadcastScoreUpdate(winner);
        return true;
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
        ball.getComponent(ShuttleCourtCollision)?.resetFlightState(true);

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
        this.startRally();
        this.broadcastBallState();
    }

    public onBallLanded(ballX: number): void {
        if (!this.canApplyBallPhysics()) {
            return;
        }

        if (this._gameState !== 'playing') {
            return;
        }

        this.scoreFromBallPosition(ballX, '落点');
    }

    public onBallNetFailed(ballX: number): void {
        if (!this.canApplyBallPhysics()) {
            return;
        }

        if (this._gameState !== 'playing') {
            return;
        }

        this.scoreFromBallPosition(ballX, '碰网失败');
    }

    public onBallOutOfBounds(ballX: number): void {
        if (!this.canApplyBallPhysics()) {
            return;
        }

        if (this._gameState !== 'playing') {
            return;
        }

        this.scoreFromBallPosition(ballX, '出界');
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

        this.syncSkillConfigs();
        const effectApplied = this._skillExecutor.execute(state.skillId, skillPlayerId, playerNode, this.shuttlecock);
        if (!effectApplied) {
            return false;
        }

        const result = this._skillSystem.tryUseSkill(skillPlayerId);
        if (result.success) {
            this.playCharacterSkillCue(skillPlayerId);
        }
        this.updateScoreLabels();
        return result.success;
    }

    private syncSkillConfigs(): void {
        this.syncKobeSkillConfig();
        this.syncKunSkillConfig();
    }

    private syncKobeSkillConfig(): void {
        const config = this._skillExecutor.kobeSkillConfig;
        config.leftKobeSkillPoint = { x: this.leftKobeSkillPoint.x, y: this.leftKobeSkillPoint.y };
        config.rightKobeSkillPoint = { x: this.rightKobeSkillPoint.x, y: this.rightKobeSkillPoint.y };
        config.kobeSkillHorizontalSpeed = this.kobeSkillHorizontalSpeed;
        config.kobeSkillVerticalSpeed = this.kobeSkillVerticalSpeed;
        config.kobeSkillDownwardForce = this.kobeSkillDownwardForce;
        config.kobeSkillDuration = this.kobeSkillDuration;
        config.kobeSkillInputLockDuration = this.kobeSkillInputLockDuration;
    }

    private syncKunSkillConfig(): void {
        const config = this._skillExecutor.kunSkillConfig;
        config.leftKunSkillPoint = { x: this.leftKunSkillPoint.x, y: this.leftKunSkillPoint.y };
        config.rightKunSkillPoint = { x: this.rightKunSkillPoint.x, y: this.rightKunSkillPoint.y };
        config.kunSkillHorizontalSpeed = this.kunSkillHorizontalSpeed;
        config.kunSkillDuration = this.kunSkillDuration;
        config.kunSkillCurveAmplitude = this.kunSkillCurveAmplitude;
        config.kunSkillCurveFrequency = this.kunSkillCurveFrequency;
        config.kunSkillVerticalLift = this.kunSkillVerticalLift;
        config.kunSkillVerticalDrop = this.kunSkillVerticalDrop;
        config.kunSkillBallOffsetY = this.kunSkillBallOffsetY;
        config.kunSkillControlPoints = this.kunSkillControlPoints;
        config.kunSkillInputLockDuration = this.kunSkillInputLockDuration;
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
            this.enterResultWithVictoryVideo({
                winnerPlayerId: winner === 1 ? 'player1' : 'player2',
                player1RoundsWon: this._roundsWon1,
                player2RoundsWon: this._roundsWon2,
            });
            return;
        }

        this._gameState = 'roundEnd';
        this._score1 = 0;
        this._score2 = 0;
        this._hasScoredThisRally = false;
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

        const servePosition = this.getCurrentServeWorldPosition();
        if (servePosition) {
            this.shuttlecock.setWorldPosition(servePosition);
        }
        this.shuttlecock.setRotationFromEuler(Vec3.ZERO);
        this.shuttlecock.getComponent(ShuttleCourtCollision)?.resetFlightState(false);
        this.shuttlecock.active = false;
    }

    private startRally(): void {
        const state = {
            gameState: this._gameState,
            hasScoredThisRally: this._hasScoredThisRally,
        };
        startNextRally(state);
        this._gameState = state.gameState;
        this._hasScoredThisRally = state.hasScoredThisRally;
    }

    private lockCurrentRallyForScore(): boolean {
        const state = {
            gameState: this._gameState,
            hasScoredThisRally: this._hasScoredThisRally,
        };
        const accepted = lockRoundForScore(state);
        this._gameState = state.gameState;
        this._hasScoredThisRally = state.hasScoredThisRally;
        return accepted;
    }

    private scoreFromBallPosition(ballX: number, reason: string): void {
        const dividerX = this.netNode ? this.netNode.worldPosition.x : 0;
        const winner = ballX < dividerX ? 2 : 1;

        if (!this.addScoreAndServe(winner as 1 | 2)) {
            return;
        }

        console.log(
            `[${reason}] X: ${ballX}, 分界: ${dividerX}, 判定: ${winner === 2 ? '左半场 P2得分' : '右半场 P1得分'}`,
        );
    }

    private getCurrentServeWorldPosition(): Vec3 {
        const serverNode = this._currentServer === 1 ? this._player1Node : this._player2Node;
        return (serverNode?.getChildByName('Racket') ?? serverNode)?.worldPosition.clone() ?? null;
    }

    private ensureShuttleCollision(): void {
        if (!this.shuttlecock) {
            return;
        }

        const collision =
            this.shuttlecock.getComponent(ShuttleCourtCollision) ??
            this.shuttlecock.addComponent(ShuttleCourtCollision);
        collision.gameManagerNode = this.node;
        collision.netNode = this.netNode;
        collision.floorY = this.floorY;
    }

    private updateScoreLabels(): void {
        if (this.score1Label) {
            this.score1Label.node.active = false;
        }
        if (this.score2Label) {
            this.score2Label.node.active = false;
        }

        this.updateScoreboardHud();
        this.updateSkillMeterHud('player1');
        this.updateSkillMeterHud('player2');
    }

    update(deltaTime: number): void {
        this.updateLanRoomDiscovery(deltaTime);

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

    private updateLanRoomDiscovery(deltaTime: number): void {
        if (this._appState !== 'online_room') {
            return;
        }
        if (this._pendingNetworkAction) {
            return;
        }

        this._lanRoomBrowseElapsed += deltaTime;
        const shouldBrowse = shouldRequestLanRoomBrowse(
            this._lanRoomBrowseElapsed,
            this._lanRoomBrowseInterval,
            !this._hasRequestedInitialLanBrowse,
        );
        if (!shouldBrowse) {
            return;
        }

        this._hasRequestedInitialLanBrowse = true;
        this._lanRoomBrowseElapsed = 0;
        this.requestLanRooms();
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

    private createBattleHud(): void {
        if (!this._canvasNode) {
            return;
        }

        this._battleHudRoot = new Node('BattleHudRoot');
        this._canvasNode.addChild(this._battleHudRoot);
        this._battleHudRoot.addComponent(UITransform).setContentSize(1280, 720);
        this._battleHudRoot.setPosition(0, 0, 0);
        this._battleNodes.push(this._battleHudRoot);

        this._scoreboardHud = this.createScoreboardHud();
        this._skillMeterHuds.player1 = this.createSkillMeterHud(
            'Player1SkillHud',
            -455,
            252,
            new Color(55, 174, 255, 255),
        );
        this._skillMeterHuds.player2 = this.createSkillMeterHud(
            'Player2SkillHud',
            455,
            252,
            new Color(255, 96, 86, 255),
        );
    }

    private createScoreboardHud(): ScoreboardHudRefs {
        const root = new Node('BadmintonScoreboard');
        this._battleHudRoot.addChild(root);
        root.setPosition(0, 292, 0);
        root.addComponent(UITransform).setContentSize(500, 100);

        const background = root.addComponent(Graphics);
        background.fillColor = new Color(18, 24, 34, 220);
        background.roundRect(-250, -50, 500, 100, 8);
        background.fill();
        background.strokeColor = new Color(105, 235, 255, 165);
        background.lineWidth = 3;
        background.roundRect(-250, -50, 500, 100, 8);
        background.stroke();

        this.addHudPanelAccent(root, -238, 34, 476, 6, new Color(255, 255, 255, 36));
        this.addHudPanelAccent(root, -238, -40, 476, 5, new Color(0, 0, 0, 70));

        const player1NameLabel = this.addHudLabel(root, 'P1Name', -164, 14, 18, 130);
        const score1Label = this.addHudLabel(root, 'P1Score', -78, 8, 46, 86);
        const vsLabel = this.addHudLabel(root, 'VsLabel', 0, 8, 19, 56);
        const score2Label = this.addHudLabel(root, 'P2Score', 78, 8, 46, 86);
        const player2NameLabel = this.addHudLabel(root, 'P2Name', 164, 14, 18, 130);
        const gameLabel = this.addHudLabel(root, 'GameLabel', 0, -28, 18, 140);
        const roundsLabel = this.addHudLabel(root, 'RoundsLabel', 0, -6, 15, 70);

        vsLabel.string = 'VS';
        vsLabel.color = new Color(255, 220, 91, 255);
        score1Label.color = Color.WHITE;
        score2Label.color = Color.WHITE;
        gameLabel.color = new Color(165, 233, 255, 255);
        roundsLabel.color = new Color(255, 220, 91, 255);

        return {
            root,
            player1NameLabel,
            player2NameLabel,
            score1Label,
            score2Label,
            gameLabel,
            roundsLabel,
        };
    }

    private createSkillMeterHud(name: string, x: number, y: number, color: Color): SkillMeterHudRefs {
        const root = new Node(name);
        this._battleHudRoot.addChild(root);
        root.setPosition(x, y, 0);
        root.addComponent(UITransform).setContentSize(270, 72);

        const background = root.addComponent(Graphics);
        background.fillColor = new Color(20, 25, 35, 188);
        background.roundRect(-135, -36, 270, 72, 8);
        background.fill();
        background.strokeColor = new Color(255, 255, 255, 100);
        background.lineWidth = 2;
        background.roundRect(-135, -36, 270, 72, 8);
        background.stroke();

        const fillNode = new Node('EnergyFill');
        root.addChild(fillNode);
        fillNode.setPosition(0, -8, 0);
        fillNode.addComponent(UITransform).setContentSize(218, 22);
        const fillGraphics = fillNode.addComponent(Graphics);

        const playerLabel = this.addHudLabel(root, 'PlayerLabel', -58, 18, 18, 120);
        const statusLabel = this.addHudLabel(root, 'SpecialLabel', 45, 18, 14, 90);
        const usesLabel = this.addHudLabel(root, 'UsesLabel', 104, -8, 18, 46);

        statusLabel.string = 'SPECIAL';
        statusLabel.color = new Color(255, 220, 91, 255);
        usesLabel.color = Color.WHITE;

        return {
            root,
            fillGraphics,
            playerLabel,
            usesLabel,
            color,
        };
    }

    private updateScoreboardHud(): void {
        if (!this._scoreboardHud) {
            return;
        }

        const model = buildScoreboardModel({
            player1Name: this.getHudPlayerName('player1'),
            player2Name: this.getHudPlayerName('player2'),
            score1: this._score1,
            score2: this._score2,
            roundsWon1: this._roundsWon1,
            roundsWon2: this._roundsWon2,
        });

        this._scoreboardHud.player1NameLabel.string = model.player1Name;
        this._scoreboardHud.player2NameLabel.string = model.player2Name;
        this._scoreboardHud.score1Label.string = model.score1Text;
        this._scoreboardHud.score2Label.string = model.score2Text;
        this._scoreboardHud.gameLabel.string = model.gameText;
        this._scoreboardHud.roundsLabel.string = model.roundsText;
    }

    private updateSkillMeterHud(playerId: SkillPlayerId): void {
        const hud = this._skillMeterHuds[playerId];
        if (!hud) {
            return;
        }

        hud.playerLabel.string = playerId === 'player1' ? 'P1' : 'P2';

        try {
            const state = this._skillSystem.getState(playerId);
            const model = buildSkillMeterModel(state);
            hud.usesLabel.string = model.usesText;
            this.drawSkillMeterFill(
                hud.fillGraphics,
                model.fillRatio,
                model.isFull ? new Color(255, 220, 91, 255) : hud.color,
            );
        } catch {
            hud.usesLabel.string = 'x0';
            this.drawSkillMeterFill(hud.fillGraphics, 0, hud.color);
        }
    }

    private drawSkillMeterFill(graphics: Graphics, ratio: number, color: Color): void {
        const width = 218;
        const height = 22;
        const fillWidth = Math.max(0, Math.min(width, width * ratio));

        graphics.clear();
        graphics.fillColor = new Color(0, 0, 0, 96);
        graphics.roundRect(-width / 2, -height / 2, width, height, 8);
        graphics.fill();

        if (fillWidth > 0) {
            graphics.fillColor = color;
            graphics.roundRect(-width / 2, -height / 2, fillWidth, height, 8);
            graphics.fill();
            graphics.fillColor = new Color(255, 255, 255, 72);
            graphics.roundRect(-width / 2 + 4, 1, Math.max(0, fillWidth - 8), 6, 4);
            graphics.fill();
        }

        graphics.strokeColor = new Color(255, 255, 255, 145);
        graphics.lineWidth = 2;
        graphics.roundRect(-width / 2, -height / 2, width, height, 8);
        graphics.stroke();
    }

    private addHudPanelAccent(parent: Node, x: number, y: number, width: number, height: number, color: Color): void {
        const accentNode = new Node('HudAccent');
        parent.addChild(accentNode);
        accentNode.setPosition(0, 0, 0);
        const graphics = accentNode.addComponent(Graphics);
        graphics.fillColor = color;
        graphics.roundRect(x, y, width, height, 3);
        graphics.fill();
    }

    private addHudLabel(parent: Node, name: string, x: number, y: number, fontSize: number, width: number): Label {
        const labelNode = new Node(name);
        parent.addChild(labelNode);
        labelNode.setPosition(x, y, 0);
        labelNode.addComponent(UITransform).setContentSize(width, 30);
        const label = labelNode.addComponent(Label);
        label.fontSize = fontSize;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return label;
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

        this._victoryVideoManager?.cleanupOverlay();
        this._flowRoot.removeAllChildren();
    }

    private enterMainMenu(): void {
        this._appState = 'main_menu';
        this._gameState = 'waitingServe';
        this.setBattleVisible(false);
        this.clearFlowRoot();

        if (this.startSpriteFrame) {
            this.addImageBackground('StartBackground', this.startSpriteFrame, 1280, 720);
            this.addHitAreaButton('LocalBattleButton', -410, -155, 380, 90, () => this.enterLocalCharacterSelect());
            this.addHitAreaButton('OnlineBattleButton', -410, -258, 380, 90, () => this.enterOnlineRoom());
            return;
        }

        this.addLabel('抽象羽球大乱斗', 0, 170, 44);
        this.addLabel('Meme Badminton', 0, 115, 26);
        this.addButton('联机对战', 0, 30, 260, 64, () => this.enterOnlineRoom());
        this.addButton('本地对战', 0, -55, 260, 64, () => this.enterLocalCharacterSelect());
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
        const isEnteringRoomPage = this._appState !== 'online_room';
        this._appState = 'online_room';
        this._battleMode = 'online';
        this._roomId = this._roomId === 'ABCD' ? 'LAN1' : this._roomId;
        if (isEnteringRoomPage) {
            this._hasRequestedInitialLanBrowse = false;
            this._lanRoomBrowseElapsed = this._lanRoomBrowseInterval;
        }
        this.clearFlowRoot();
        this.setBattleVisible(false);

        const model = buildLanRoomViewModel({
            serverUrl: this._serverUrl,
            connectionStatus: this._connectionStatus,
            roomId: this._roomId,
            snapshot: this._roomSnapshot,
            lanRooms: this._lanRooms,
        });

        if (this.connectSpriteFrame) {
            this.addConnectRoomImageScreen(model);
            return;
        }

        this.addLabel(model.title, 0, 210, 38);
        this.addLabel(model.statusLines[0], 0, 160, 20);
        this.addLabel(model.statusLines[1], 0, 126, 22);
        this.addLabel(model.roomStateText, 0, 92, 23);
        this.addLabel(model.statusLines[2], -290, 52, 21, 330);
        this.addLabel(model.statusLines[3], 290, 52, 21, 330);

        this.addButton('创建房间', -250, -15, 210, 54, () => this.createLanRoom());
        this.addButton('刷新房间', 0, -15, 210, 54, () => this.browseLanRooms(), new Color(48, 148, 98, 255));
        this.addButton('修改地址', 250, -15, 210, 54, () => this.editServerAddress(), new Color(78, 84, 96, 255));

        this.addLabel('房间列表', 0, -74, 24);
        if (model.emptyListText) {
            this.addLabel(model.emptyListText, 0, -128, 20);
        } else {
            model.roomRows.slice(0, 5).forEach((row, index) => {
                const y = -120 - index * 44;
                this.addRoomListItem(row.label, y, () => {
                    if (row.joinable) {
                        this.joinLanRoom(row.room);
                        return;
                    }
                    this._connectionStatus = '加入失败: 房间已满';
                    this.enterOnlineRoom();
                }, row.joinable);
            });
        }

        this.addButton('取消', 0, -282, 180, 46, () => this.enterMainMenu(), new Color(78, 84, 96, 255));
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
        if (this.localCharacterSelectSpriteFrame) {
            this.addLocalCharacterSelectImageScreen();
            return;
        }

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

    private addLocalCharacterSelectImageScreen(): void {
        this.addImageBackground('LocalCharacterSelectBackground', this.localCharacterSelectSpriteFrame, 1280, 768);
        this.addLocalCharacterHitAreas('player1');
        this.addLocalCharacterHitAreas('player2');
        this.addHitAreaButton('ConfirmP1Button', -326, -146, 310, 82, () => this.confirmCharacter('player1'));
        this.addHitAreaButton('ConfirmP2Button', 337, -146, 310, 82, () => this.confirmCharacter('player2'));
        this.addHitAreaButton('BackToMainMenuButton', -6, -290, 330, 82, () => this.enterMainMenu());

        this.addSelectedCharacterFrame('player1', new Color(64, 180, 255, 255));
        this.addSelectedCharacterFrame('player2', new Color(205, 92, 255, 255));

        if (this._localCharacterSelect.isConfirmed('player1')) {
            this.addLabel('P1 已确认', -318, 210, 26, 220);
        }
        if (this._localCharacterSelect.isConfirmed('player2')) {
            this.addLabel('P2 已确认', 343, 210, 26, 220);
        }
    }

    private addLocalCharacterHitAreas(playerId: PlayerId): void {
        const cardLayouts = this._localCharacterCardLayouts[playerId];
        this._characters.forEach((character, index) => {
            const layout = cardLayouts[index];
            this.addHitAreaButton(
                `${playerId}${character.characterId}Card`,
                layout.x,
                layout.y,
                layout.width,
                layout.height,
                () => this.selectCharacter(playerId, character.characterId),
            );
        });
    }

    private addConnectRoomImageScreen(model: ReturnType<typeof buildLanRoomViewModel>): void {
        this.addImageBackground('ConnectBackground', this.connectSpriteFrame, 1280, 768);

        const roomValue = this._roomSnapshot
            ? model.roomStateText.replace(/^房间\s*/, '').replace(': ', ' / ')
            : this._roomId;
        this.addLabel(this._serverUrl, -55, 170, 20, 460);
        this.addLabel(this._connectionStatus, -133, 133, 20, 305);
        this.addLabel(roomValue, -106, 98, 20, 370);

        this.addHitAreaButton('CreateLanRoomButton', -155, 47, 150, 52, () => this.createLanRoom());
        this.addHitAreaButton('RefreshLanRoomButton', 0, 47, 150, 52, () => this.browseLanRooms());
        this.addHitAreaButton('EditServerAddressButton', 164, 47, 150, 52, () => this.editServerAddress());

        if (model.emptyListText) {
            this.addLabel('未发现房间', -168, -62, 20, 190);
            this.addLabel('点击刷新', 41, -62, 20, 130);
            this.addLabel('等待搜索', 159, -62, 20, 130);
        } else {
            model.roomRows.slice(0, 5).forEach((row, index) => {
                this.addConnectRoomListItem(row, -62 - index * 34);
            });
        }

        this.addHitAreaButton('CancelConnectButton', 0, -308, 230, 64, () => this.enterMainMenu());
    }

    private addConnectRoomListItem(row: ReturnType<typeof buildLanRoomViewModel>['roomRows'][number], y: number): void {
        const playerCountText = `${row.room.players}/${row.room.max_players}`;
        const statusText = row.joinable ? '可加入' : '已满';

        this.addLabel(row.room.room_name, -168, y, 18, 200);
        this.addLabel(playerCountText, 41, y, 18, 90);
        this.addLabel(statusText, 159, y, 18, 100);
        this.addHitAreaButton(`ConnectRoomRow${row.room.room_id}`, 0, y, 480, 34, () => {
            if (row.joinable) {
                this.joinLanRoom(row.room);
                return;
            }
            this._connectionStatus = '加入失败: 房间已满';
            this.enterOnlineRoom();
        });
    }

    private addSelectedCharacterFrame(playerId: PlayerId, color: Color): void {
        const selectedCharacterId = this._localCharacterSelect.getSelectedCharacter(playerId);
        const selectedIndex = this._characters.findIndex((character) => character.characterId === selectedCharacterId);
        if (selectedIndex < 0) {
            return;
        }

        const layout = this._localCharacterCardLayouts[playerId][selectedIndex];
        const frameNode = new Node(`${playerId}SelectedFrame`);
        this._flowRoot.addChild(frameNode);
        frameNode.setPosition(layout.x, layout.y, 0);
        frameNode.addComponent(UITransform).setContentSize(layout.width, layout.height);
        const graphics = frameNode.addComponent(Graphics);
        graphics.strokeColor = color;
        graphics.lineWidth = 6;
        graphics.roundRect(-layout.width / 2, -layout.height / 2, layout.width, layout.height, 8);
        graphics.stroke();
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
        this._audioManager.preloadCharacterCues();
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
        this._hasScoredThisRally = false;
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

    private enterResultWithVictoryVideo(result: MatchResult): void {
        if (this.isShowingResult(result)) {
            return;
        }

        this._appState = 'result';
        this._lastResult = result;
        this._gameState = 'matchEnd';
        this.setBattleVisible(false);
        this.clearFlowRoot();

        const winnerCharacterId = this.getPlayerCharacterId(result.winnerPlayerId);
        if (!winnerCharacterId || !this._victoryVideoManager) {
            this.enterResult(result);
            return;
        }

        this._victoryVideoManager.playWinVideo(winnerCharacterId, () => {
            this.enterResult(result);
        });
    }

    private isShowingResult(result: MatchResult): boolean {
        return (
            this._appState === 'result' &&
            this._lastResult?.winnerPlayerId === result.winnerPlayerId &&
            this._lastResult?.player1RoundsWon === result.player1RoundsWon &&
            this._lastResult?.player2RoundsWon === result.player2RoundsWon
        );
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
        this._network.on('ROOM_LIST', this.onRoomList);
        this._network.on('JOIN_RESPONSE', this.onJoinResponse);
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
        this._network.off('ROOM_LIST', this.onRoomList);
        this._network.off('JOIN_RESPONSE', this.onJoinResponse);
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
        if (this._network.isConnected && this._pendingNetworkAction) {
            const action = this._pendingNetworkAction;
            this._pendingNetworkAction = null;
            action();
        }
        if (this._appState === 'online_room') {
            this.enterOnlineRoom();
        }
    };

    private onNetworkDisconnected = (): void => {
        this._connectionStatus = '已断开';
        if (this._battleMode === 'online' && this._appState === 'battle') {
            this.enterOnlineRoom();
        } else if (this._battleMode === 'online' && this._appState === 'character_select') {
            this.enterOnlineRoom();
        } else if (this._appState === 'online_room') {
            this.enterOnlineRoom();
        }
    };

    private onNetworkError = (data: any): void => {
        this._connectionStatus = `错误: ${data?.message ?? '连接失败'}`;
        if (this._appState === 'online_room' || (this._battleMode === 'online' && this._appState === 'character_select')) {
            this.enterOnlineRoom();
        }
    };

    private onRoomList = (data: any): void => {
        this._lanRooms = Array.isArray(data?.rooms) ? data.rooms : [];
        if (this._appState === 'online_room') {
            this.enterOnlineRoom();
        }
    };

    private onJoinResponse = (data: any): void => {
        if (!data?.success) {
            this._connectionStatus = `加入失败: ${data?.reason ?? 'unknown'}`;
            if (this._appState === 'online_room') {
                this.enterOnlineRoom();
            }
            return;
        }

        this._connectionStatus = '已加入房间';
        if (data.player_id) {
            this._localPlayerId = data.player_id;
            this._isHost = this._localPlayerId === 'player1';
        }
        if (data.room_snapshot) {
            this.onRoomSnapshot(data.room_snapshot);
            return;
        }
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

        this._confirmedPlayers.player1 = false;
        this._confirmedPlayers.player2 = false;
        for (const player of snapshot.players) {
            this._selectedCharacters[player.playerId] = player.characterId;
            this._confirmedPlayers[player.playerId] = player.isReady;
        }

        const connectedPlayers = snapshot.players.filter((player) => player.connected);
        if (this._appState === 'online_room' && connectedPlayers.length >= 2) {
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
        if (payload.winnerPlayerId) {
            this.playCharacterScoreCue(payload.winnerPlayerId);
        }
        this.updateScoreLabels();
        if (payload.gameState !== 'playing') {
            this.resetBall();
        }
        if (payload.gameState === 'matchEnd' && payload.winnerPlayerId) {
            this.enterResultWithVictoryVideo({
                winnerPlayerId: payload.winnerPlayerId,
                player1RoundsWon: this._roundsWon1,
                player2RoundsWon: this._roundsWon2,
            });
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

    private ensureNetworkReady(action: () => void): void {
        if (this._network.isConnected) {
            action();
            return;
        }

        this._pendingNetworkAction = action;
        this.connectOnlineRoom();
    }

    private createLanRoom(): void {
        this._roomId = this.createRoomId();
        this._roomSnapshot = null;
        this.ensureNetworkReady(() => {
            this._connectionStatus = '已创建房间，等待玩家加入';
            this._network.createRoom(this._roomId, 'MemeBadminton Host');
            if (this._appState === 'online_room') {
                this.enterOnlineRoom();
            }
        });
    }

    private browseLanRooms(): void {
        this.requestLanRooms();
    }

    private requestLanRooms(): void {
        if (this._pendingNetworkAction) {
            return;
        }

        this.ensureNetworkReady(() => {
            this._connectionStatus = '正在搜索局域网房间';
            this._network.browseRooms();
            if (this._appState === 'online_room') {
                this.enterOnlineRoom();
            }
        });
    }

    private joinLanRoom(room: LanRoomAdvertise): void {
        this._roomId = room.room_id;
        this.ensureNetworkReady(() => {
            this._connectionStatus = `正在加入 ${room.room_name}`;
            this._network.joinAdvertisedRoom(room);
            if (this._appState === 'online_room') {
                this.enterOnlineRoom();
            }
        });
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

    private addRoomListItem(labelText: string, y: number, onClick: () => void, joinable: boolean): Node {
        const width = 760;
        const height = 38;
        const itemNode = new Node(`RoomListItem${y}`);
        this._flowRoot.addChild(itemNode);
        itemNode.setPosition(0, y, 0);
        itemNode.addComponent(UITransform).setContentSize(width, height);
        const graphics = itemNode.addComponent(Graphics);
        graphics.fillColor = joinable ? new Color(40, 116, 92, 255) : new Color(72, 76, 84, 255);
        graphics.roundRect(-width / 2, -height / 2, width, height, 6);
        graphics.fill();
        itemNode.on(Node.EventType.TOUCH_END, onClick, this);

        const labelNode = new Node('Label');
        itemNode.addChild(labelNode);
        labelNode.addComponent(UITransform).setContentSize(width - 28, height);
        const label = labelNode.addComponent(Label);
        label.string = labelText;
        label.fontSize = 18;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return itemNode;
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

    private addImageBackground(name: string, spriteFrame: SpriteFrame, width: number, height: number): Node {
        const backgroundNode = new Node(name);
        this._flowRoot.addChild(backgroundNode);
        backgroundNode.setPosition(0, 0, 0);
        const transform = backgroundNode.addComponent(UITransform);
        const sprite = backgroundNode.addComponent(Sprite);
        sprite.spriteFrame = spriteFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        transform.setContentSize(width, height);
        return backgroundNode;
    }

    private addHitAreaButton(
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
        onClick: () => void,
    ): Node {
        const buttonNode = new Node(name);
        this._flowRoot.addChild(buttonNode);
        buttonNode.setPosition(x, y, 0);
        buttonNode.addComponent(UITransform).setContentSize(width, height);
        buttonNode.on(Node.EventType.TOUCH_END, onClick, this);
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

    private getHudPlayerName(playerId: PlayerId): string {
        const characterId =
            this._matchSetup?.players.find((player) => player.playerId === playerId)?.characterId ??
            this._selectedCharacters[playerId];

        if (characterId === 'kobe') {
            return 'KOBE';
        }
        if (characterId === 'caixukun') {
            return 'KUN';
        }
        if (characterId === 'nailong') {
            return 'NAILONG';
        }

        return playerId === 'player1' ? 'P1' : 'P2';
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

    private playCharacterScoreCue(playerId: PlayerId): void {
        const characterId = this.getPlayerCharacterId(playerId);
        if (characterId) {
            this._audioManager.playCharacterCue(characterId, 'score');
        }
    }

    private playCharacterSkillCue(playerId: SkillPlayerId): void {
        const characterId = this.getPlayerCharacterId(playerId);
        if (characterId) {
            this._audioManager.playCharacterCue(characterId, 'skill');
        }
    }

    private getPlayerCharacterId(playerId: PlayerId): string | null {
        return (
            this._matchSetup?.players.find((player) => player.playerId === playerId)?.characterId ??
            this._selectedCharacters[playerId] ??
            null
        );
    }

    private toSkillPlayerId(playerId: number): SkillPlayerId {
        return playerId === 1 ? 'player1' : 'player2';
    }

    private createRoomId(): string {
        return Math.random().toString(36).slice(2, 6).toUpperCase();
    }
}
