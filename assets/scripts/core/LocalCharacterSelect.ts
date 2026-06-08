export type PlayerId = 'player1' | 'player2';

export interface LocalPlayerSetup {
    playerId: PlayerId;
    displayName: string;
    characterId: string;
    isReady: boolean;
}

export interface LocalMatchSetup {
    roomId: string;
    localPlayerId: PlayerId;
    players: LocalPlayerSetup[];
}

export class LocalCharacterSelect {
    private readonly _defaultPlayer1CharacterId: string;
    private readonly _defaultPlayer2CharacterId: string;
    private readonly _selectedCharacters: Record<PlayerId, string>;
    private readonly _confirmedPlayers: Record<PlayerId, boolean> = {
        player1: false,
        player2: false,
    };

    constructor(defaultPlayer1CharacterId: string, defaultPlayer2CharacterId: string) {
        this._defaultPlayer1CharacterId = defaultPlayer1CharacterId;
        this._defaultPlayer2CharacterId = defaultPlayer2CharacterId;
        this._selectedCharacters = {
            player1: defaultPlayer1CharacterId,
            player2: defaultPlayer2CharacterId,
        };
    }

    public selectCharacter(playerId: PlayerId, characterId: string): void {
        if (this._confirmedPlayers[playerId]) {
            return;
        }

        this._selectedCharacters[playerId] = characterId;
    }

    public confirmPlayer(playerId: PlayerId): void {
        this._confirmedPlayers[playerId] = true;
    }

    public isConfirmed(playerId: PlayerId): boolean {
        return this._confirmedPlayers[playerId];
    }

    public getSelectedCharacter(playerId: PlayerId): string {
        return this._selectedCharacters[playerId];
    }

    public isReadyToStart(): boolean {
        return this._confirmedPlayers.player1 && this._confirmedPlayers.player2;
    }

    public reset(): void {
        this._selectedCharacters.player1 = this._defaultPlayer1CharacterId;
        this._selectedCharacters.player2 = this._defaultPlayer2CharacterId;
        this._confirmedPlayers.player1 = false;
        this._confirmedPlayers.player2 = false;
    }

    public createMatchSetup(): LocalMatchSetup {
        return {
            roomId: 'LOCAL',
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
}
