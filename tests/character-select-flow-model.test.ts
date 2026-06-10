import {
    buildCharacterSelectFlowModel,
    CharacterSelectPlayerId,
    shouldEnterBattleFromRoomSnapshot,
} from '../assets/scripts/core/CharacterSelectFlowModel';

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}. Expected ${expected}, got ${actual}`);
    }
}

function canSelect(
    model: ReturnType<typeof buildCharacterSelectFlowModel>,
    playerId: CharacterSelectPlayerId,
): boolean {
    return model.players.find((player) => player.playerId === playerId)?.canSelect ?? false;
}

function canConfirm(
    model: ReturnType<typeof buildCharacterSelectFlowModel>,
    playerId: CharacterSelectPlayerId,
): boolean {
    return model.players.find((player) => player.playerId === playerId)?.canConfirm ?? false;
}

function testLocalModeAllowsBothPlayersToControlSelection(): void {
    const model = buildCharacterSelectFlowModel({
        mode: 'local',
        localPlayerId: 'player1',
        selectedCharacters: { player1: 'kobe', player2: 'caixukun' },
        confirmedPlayers: { player1: false, player2: false },
    });

    assert(canSelect(model, 'player1'), 'local P1 can select');
    assert(canSelect(model, 'player2'), 'local P2 can select');
    assert(canConfirm(model, 'player1'), 'local P1 can confirm');
    assert(canConfirm(model, 'player2'), 'local P2 can confirm');
}

function testOnlineModeOnlyAllowsLocalPlayerToControlSelection(): void {
    const model = buildCharacterSelectFlowModel({
        mode: 'online',
        localPlayerId: 'player2',
        selectedCharacters: { player1: 'nailong', player2: 'kobe' },
        confirmedPlayers: { player1: true, player2: false },
    });

    assertEqual(model.localPlayerId, 'player2', 'online model keeps local player id');
    assertEqual(model.remotePlayerId, 'player1', 'online model derives remote player id');
    assertEqual(canSelect(model, 'player1'), false, 'online remote player cannot be selected locally');
    assertEqual(canConfirm(model, 'player1'), false, 'online remote player cannot be confirmed locally');
    assertEqual(canSelect(model, 'player2'), true, 'online local player can select before confirming');
    assertEqual(canConfirm(model, 'player2'), true, 'online local player can confirm before confirming');
}

function testConfirmedPlayerIsLockedInEitherMode(): void {
    const model = buildCharacterSelectFlowModel({
        mode: 'online',
        localPlayerId: 'player1',
        selectedCharacters: { player1: 'kobe', player2: 'caixukun' },
        confirmedPlayers: { player1: true, player2: false },
    });

    assertEqual(canSelect(model, 'player1'), false, 'confirmed local player cannot keep changing character');
    assertEqual(canConfirm(model, 'player1'), false, 'confirmed local player does not need another confirm action');
}

function testStartedRoomSnapshotCanDriveBattleEntry(): void {
    assertEqual(
        shouldEnterBattleFromRoomSnapshot({
            roomId: 'ROOM',
            hostPlayerId: 'player1',
            matchStarted: true,
            players: [
                {
                    clientId: 'client-a',
                    playerId: 'player1',
                    characterId: 'kobe',
                    isReady: true,
                    connected: true,
                },
                {
                    clientId: 'client-b',
                    playerId: 'player2',
                    characterId: 'nailong',
                    isReady: true,
                    connected: true,
                },
            ],
        }),
        true,
        'started snapshot with two ready connected players can enter battle',
    );

    assertEqual(
        shouldEnterBattleFromRoomSnapshot({
            roomId: 'ROOM',
            hostPlayerId: 'player1',
            matchStarted: true,
            players: [
                {
                    clientId: 'client-a',
                    playerId: 'player1',
                    characterId: 'kobe',
                    isReady: true,
                    connected: true,
                },
            ],
        }),
        false,
        'started snapshot still needs both player seats',
    );
}

testLocalModeAllowsBothPlayersToControlSelection();
testOnlineModeOnlyAllowsLocalPlayerToControlSelection();
testConfirmedPlayerIsLockedInEitherMode();
testStartedRoomSnapshotCanDriveBattleEntry();
