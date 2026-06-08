export type NetworkPlayerId = 'player1' | 'player2';

export type NetworkMessageType =
    | 'CONNECTED'
    | 'JOIN_ROOM'
    | 'ROOM_SNAPSHOT'
    | 'CHARACTER_SELECT'
    | 'CHARACTER_READY'
    | 'MATCH_START'
    | 'PLAYER_INPUT'
    | 'BALL_STATE'
    | 'SCORE_UPDATE'
    | 'MATCH_EVENT'
    | 'PLAYER_DISCONNECTED'
    | 'ERROR'
    | 'PING'
    | 'PONG';

export interface NetworkMessage<T = any> {
    type: NetworkMessageType;
    data: T;
    timestamp: number;
}

export interface RoomPlayerState {
    clientId: string;
    playerId: NetworkPlayerId;
    characterId: string;
    isReady: boolean;
    connected: boolean;
}

export interface RoomSnapshot {
    roomId: string;
    hostPlayerId: NetworkPlayerId;
    localPlayerId?: NetworkPlayerId;
    matchStarted: boolean;
    players: RoomPlayerState[];
}

export interface BallStatePayload {
    position: { x: number; y: number; z: number };
    velocity: { x: number; y: number };
    active: boolean;
    currentServer: number;
    gameState: string;
}

export interface ScoreUpdatePayload {
    score1: number;
    score2: number;
    roundsWon1: number;
    roundsWon2: number;
    currentServer: number;
    gameState: string;
    winnerPlayerId: NetworkPlayerId;
}
