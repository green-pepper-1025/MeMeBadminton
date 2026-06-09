export type NetworkPlayerId = 'player1' | 'player2';

export type NetworkMessageType =
    | 'room_advertise'
    | 'join_request'
    | 'join_response'
    | 'heartbeat'
    | 'disconnect'
    | 'player_input'
    | 'game_start'
    | 'game_state'
    | 'game_end'
    | 'map_sync'
    | 'room_list'
    | 'create_room'
    | 'browse_rooms'
    | 'CONNECTED'
    | 'JOIN_ROOM'
    | 'CREATE_ROOM'
    | 'BROWSE_ROOMS'
    | 'ROOM_LIST'
    | 'JOIN_RESPONSE'
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
    player_id?: NetworkPlayerId;
    timestamp: number;
}

export interface LanRoomAdvertise {
    room_id: string;
    room_name: string;
    host_name: string;
    host: string;
    port: number;
    players: number;
    max_players: number;
}

export interface JoinResponsePayload {
    success: boolean;
    player_id?: NetworkPlayerId;
    reason?: string;
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

export interface GameStatePayload {
    players?: Array<{
        playerId: NetworkPlayerId;
        position: { x: number; y: number; z: number };
        active?: boolean;
    }>;
    ball?: BallStatePayload;
    scores?: ScoreUpdatePayload;
    round_info?: Record<string, any>;
}
