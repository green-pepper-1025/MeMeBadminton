export type CharacterSelectPlayerId = 'player1' | 'player2';
export type CharacterSelectMode = 'local' | 'online';

export interface CharacterSelectFlowInput {
    mode: CharacterSelectMode;
    localPlayerId: CharacterSelectPlayerId;
    selectedCharacters: Record<CharacterSelectPlayerId, string>;
    confirmedPlayers: Record<CharacterSelectPlayerId, boolean>;
}

export interface CharacterSelectPlayerView {
    playerId: CharacterSelectPlayerId;
    selectedCharacterId: string;
    confirmed: boolean;
    canSelect: boolean;
    canConfirm: boolean;
}

export interface CharacterSelectFlowModel {
    mode: CharacterSelectMode;
    localPlayerId: CharacterSelectPlayerId;
    remotePlayerId: CharacterSelectPlayerId;
    players: CharacterSelectPlayerView[];
}

export interface CharacterSelectRoomSnapshot {
    roomId?: string;
    hostPlayerId?: CharacterSelectPlayerId;
    matchStarted: boolean;
    players: Array<{
        clientId?: string;
        playerId: CharacterSelectPlayerId;
        characterId?: string;
        isReady: boolean;
        connected: boolean;
    }>;
}

export function getRemotePlayerId(playerId: CharacterSelectPlayerId): CharacterSelectPlayerId {
    return playerId === 'player1' ? 'player2' : 'player1';
}

export function buildCharacterSelectFlowModel(input: CharacterSelectFlowInput): CharacterSelectFlowModel {
    const remotePlayerId = getRemotePlayerId(input.localPlayerId);
    const players: CharacterSelectPlayerView[] = (['player1', 'player2'] as CharacterSelectPlayerId[]).map(
        (playerId) => {
            const confirmed = input.confirmedPlayers[playerId];
            const isLocallyControllable = input.mode === 'local' || playerId === input.localPlayerId;

            return {
                playerId,
                selectedCharacterId: input.selectedCharacters[playerId],
                confirmed,
                canSelect: isLocallyControllable && !confirmed,
                canConfirm: isLocallyControllable && !confirmed,
            };
        },
    );

    return {
        mode: input.mode,
        localPlayerId: input.localPlayerId,
        remotePlayerId,
        players,
    };
}

export function shouldEnterBattleFromRoomSnapshot(snapshot: CharacterSelectRoomSnapshot | null): boolean {
    if (!snapshot?.matchStarted) {
        return false;
    }

    const player1 = snapshot.players.find((player) => player.playerId === 'player1');
    const player2 = snapshot.players.find((player) => player.playerId === 'player2');

    return Boolean(player1?.connected && player1.isReady && player2?.connected && player2.isReady);
}
