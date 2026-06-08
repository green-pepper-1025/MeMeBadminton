export type PlayerId = 'player1' | 'player2';

export interface RoomPlayer {
    clientId: string;
    playerId: PlayerId;
    characterId: string;
    isReady: boolean;
    connected: boolean;
}

export interface RoomSnapshot {
    roomId: string;
    hostPlayerId: PlayerId;
    matchStarted: boolean;
    players: RoomPlayer[];
}

export interface ForwardMessage {
    toClientId: string;
    message: {
        type: string;
        data: any;
        timestamp: number;
    };
}

export class LanRoom {
    private readonly _players: RoomPlayer[] = [];
    private _matchStarted: boolean = false;

    public constructor(private readonly _roomId: string) {}

    public join(clientId: string): RoomPlayer {
        const existing = this._players.find((player) => player.clientId === clientId);
        if (existing) {
            existing.connected = true;
            return existing;
        }

        if (this._players.length >= 2) {
            throw new Error('Room is full');
        }

        const player: RoomPlayer = {
            clientId,
            playerId: this._players.length === 0 ? 'player1' : 'player2',
            characterId: this._players.length === 0 ? 'kobe' : 'caixukun',
            isReady: false,
            connected: true,
        };
        this._players.push(player);
        return player;
    }

    public leave(clientId: string): void {
        const player = this.getPlayerByClientId(clientId);
        if (player) {
            player.connected = false;
            player.isReady = false;
            this._matchStarted = false;
        }
    }

    public selectCharacter(clientId: string, characterId: string): void {
        const player = this.requirePlayer(clientId);
        if (player.isReady) {
            return;
        }

        player.characterId = characterId;
    }

    public setReady(clientId: string, ready: boolean): boolean {
        const player = this.requirePlayer(clientId);
        player.isReady = ready;
        this._matchStarted = this._players.length === 2 && this._players.every((item) => item.connected && item.isReady);
        return this._matchStarted;
    }

    public buildInputForward(clientId: string, command: any): ForwardMessage {
        this.requirePlayer(clientId);
        const target = this._players.find((player) => player.clientId !== clientId && player.connected);
        if (!target) {
            throw new Error('No target player');
        }

        return {
            toClientId: target.clientId,
            message: {
                type: 'PLAYER_INPUT',
                data: { command },
                timestamp: Date.now(),
            },
        };
    }

    public getSnapshot(): RoomSnapshot {
        return {
            roomId: this._roomId,
            hostPlayerId: 'player1',
            matchStarted: this._matchStarted,
            players: this._players.map((player) => ({ ...player })),
        };
    }

    private getPlayerByClientId(clientId: string): RoomPlayer | null {
        return this._players.find((player) => player.clientId === clientId) ?? null;
    }

    private requirePlayer(clientId: string): RoomPlayer {
        const player = this.getPlayerByClientId(clientId);
        if (!player) {
            throw new Error('Client has not joined this room');
        }

        return player;
    }
}
