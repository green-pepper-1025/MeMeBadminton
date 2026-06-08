import { BallStatePayload, NetworkMessage, NetworkMessageType, RoomSnapshot, ScoreUpdatePayload } from './NetworkTypes';

type NetworkHandler<T = any> = (data: T) => void;
type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export class NetworkClient {
    private static _instance: NetworkClient = null;

    private _socket: WebSocket = null;
    private _serverUrl: string = 'ws://localhost:8787';
    private _state: ConnectionState = 'idle';
    private readonly _handlers: Map<NetworkMessageType, Set<NetworkHandler>> = new Map();

    public static getInstance(): NetworkClient {
        if (!NetworkClient._instance) {
            NetworkClient._instance = new NetworkClient();
        }

        return NetworkClient._instance;
    }

    public get state(): ConnectionState {
        return this._state;
    }

    public get serverUrl(): string {
        return this._serverUrl;
    }

    public get isConnected(): boolean {
        return this._state === 'connected' && this._socket?.readyState === WebSocket.OPEN;
    }

    public connect(serverUrl: string): void {
        this.close();
        this._serverUrl = serverUrl || this._serverUrl;
        this._state = 'connecting';
        this.emitLocal('CONNECTED' as NetworkMessageType, { state: this._state });

        try {
            this._socket = new WebSocket(this._serverUrl);
        } catch (error) {
            this._state = 'error';
            this.emitLocal('ERROR', { message: String(error) });
            return;
        }

        this._socket.onopen = () => {
            this._state = 'connected';
            this.emitLocal('CONNECTED', { state: this._state });
        };
        this._socket.onclose = () => {
            this._state = 'disconnected';
            this.emitLocal('PLAYER_DISCONNECTED', { reason: 'socket_closed' });
        };
        this._socket.onerror = () => {
            this._state = 'error';
            this.emitLocal('ERROR', { message: 'WebSocket error' });
        };
        this._socket.onmessage = (event: MessageEvent) => this.handleMessage(event.data);
    }

    public close(): void {
        if (this._socket) {
            this._socket.onopen = null;
            this._socket.onclose = null;
            this._socket.onerror = null;
            this._socket.onmessage = null;
            if (this._socket.readyState === WebSocket.OPEN || this._socket.readyState === WebSocket.CONNECTING) {
                this._socket.close();
            }
        }

        this._socket = null;
    }

    public on<T = any>(type: NetworkMessageType, handler: NetworkHandler<T>): void {
        if (!this._handlers.has(type)) {
            this._handlers.set(type, new Set());
        }

        this._handlers.get(type).add(handler as NetworkHandler);
    }

    public off<T = any>(type: NetworkMessageType, handler: NetworkHandler<T>): void {
        this._handlers.get(type)?.delete(handler as NetworkHandler);
    }

    public joinRoom(roomId: string): void {
        this.send('JOIN_ROOM', { roomId });
    }

    public selectCharacter(characterId: string): void {
        this.send('CHARACTER_SELECT', { characterId });
    }

    public setReady(isReady: boolean): void {
        this.send('CHARACTER_READY', { isReady });
    }

    public sendPlayerInput(command: any): void {
        this.send('PLAYER_INPUT', { command });
    }

    public sendBallState(payload: BallStatePayload): void {
        this.send('BALL_STATE', payload);
    }

    public sendScoreUpdate(payload: ScoreUpdatePayload): void {
        this.send('SCORE_UPDATE', payload);
    }

    public sendMatchEvent(eventType: string, payload: any): void {
        this.send('MATCH_EVENT', { eventType, payload });
    }

    public send(type: NetworkMessageType, data: any): void {
        if (!this.isConnected) {
            return;
        }

        const message: NetworkMessage = {
            type,
            data,
            timestamp: Date.now(),
        };
        this._socket.send(JSON.stringify(message));
    }

    private handleMessage(raw: any): void {
        let message: NetworkMessage;
        try {
            message = JSON.parse(String(raw));
        } catch {
            this.emitLocal('ERROR', { message: 'Bad network message' });
            return;
        }

        this.emitLocal(message.type, message.data);
    }

    private emitLocal<T = any>(type: NetworkMessageType, data: T): void {
        const handlers = this._handlers.get(type);
        if (!handlers) {
            return;
        }

        handlers.forEach((handler) => handler(data));
    }
}

export type { RoomSnapshot, BallStatePayload, ScoreUpdatePayload };
