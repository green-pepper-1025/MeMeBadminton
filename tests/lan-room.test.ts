import { LanRoom } from '../server/room';

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

function testAssignsPlayerSlotsAndSnapshots(): void {
    const room = new LanRoom('ROOM');
    const p1 = room.join('client-a');
    const p2 = room.join('client-b');

    assertEqual(p1.playerId, 'player1', 'first client is assigned player1');
    assertEqual(p2.playerId, 'player2', 'second client is assigned player2');

    const snapshot = room.getSnapshot();
    assertEqual(snapshot.roomId, 'ROOM', 'snapshot contains room id');
    assertEqual(snapshot.players.length, 2, 'snapshot contains both players');
    assert(snapshot.players.some((player) => player.clientId === 'client-a' && player.playerId === 'player1'), 'snapshot has P1');
    assert(snapshot.players.some((player) => player.clientId === 'client-b' && player.playerId === 'player2'), 'snapshot has P2');
}

function testReadyStartsMatchWithHostAuthority(): void {
    const room = new LanRoom('ROOM');
    room.join('client-a');
    room.join('client-b');

    room.selectCharacter('client-a', 'kobe');
    room.selectCharacter('client-b', 'nailong');

    assertEqual(room.setReady('client-a', true), false, 'one ready player does not start match');
    assertEqual(room.setReady('client-b', true), true, 'both ready players start match');

    const snapshot = room.getSnapshot();
    assertEqual(snapshot.matchStarted, true, 'snapshot marks match as started');
    assertEqual(snapshot.hostPlayerId, 'player1', 'player1 is authoritative host');
    assertEqual(snapshot.players[0].characterId, 'kobe', 'P1 character is stored');
    assertEqual(snapshot.players[1].characterId, 'nailong', 'P2 character is stored');
}

function testBuildsForwardOnlyInputMessage(): void {
    const room = new LanRoom('ROOM');
    room.join('client-a');
    room.join('client-b');

    const forwarded = room.buildInputForward('client-b', {
        playerId: 2,
        type: 'swing_up',
        timestamp: 123,
    });

    assertEqual(forwarded.toClientId, 'client-a', 'player2 input is forwarded to host client');
    assertEqual(forwarded.message.type, 'PLAYER_INPUT', 'input message type is preserved');
    assertEqual(forwarded.message.data.command.type, 'swing_up', 'input command is forwarded unchanged');
}

testAssignsPlayerSlotsAndSnapshots();
testReadyStartsMatchWithHostAuthority();
testBuildsForwardOnlyInputMessage();
