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

function testJoinResponseRejectsThirdPlayer(): void {
    const room = new LanRoom('ROOM');
    const first = room.joinWithResponse('client-a', { address: '192.168.1.10', port: 12346 });
    const second = room.joinWithResponse('client-b', { address: '192.168.1.11', port: 12346 });
    const third = room.joinWithResponse('client-c', { address: '192.168.1.12', port: 12346 });

    assertEqual(first.success, true, 'first client can create host slot');
    assertEqual(first.player_id, 'player1', 'first client is host player');
    assertEqual(second.success, true, 'second client can join');
    assertEqual(second.player_id, 'player2', 'second client is remote player');
    assertEqual(third.success, false, 'third client is rejected');
    assertEqual(third.reason, 'room_full', 'third client receives room_full reason');
}

function testClientInputTargetsHostAuthority(): void {
    const room = new LanRoom('ROOM');
    room.joinWithResponse('host-client', { address: '192.168.1.10', port: 12346 });
    room.joinWithResponse('remote-client', { address: '192.168.1.11', port: 12346 });

    const forwarded = room.buildHostAuthorityForward('remote-client', 'player_input', {
        keys_pressed: ['MOVE_LEFT'],
        keys_released: [],
    });

    assertEqual(forwarded.toClientId, 'host-client', 'remote input is sent to host authority');
    assertEqual(forwarded.message.type, 'player_input', 'wire message uses UDP protocol type');
    assertEqual(forwarded.message.player_id, 'player2', 'remote input keeps sender player id');
}

function testHostStateTargetsClientOnly(): void {
    const room = new LanRoom('ROOM');
    room.joinWithResponse('host-client', { address: '192.168.1.10', port: 12346 });
    room.joinWithResponse('remote-client', { address: '192.168.1.11', port: 12346 });

    const forwarded = room.buildClientStateForward('host-client', 'game_state', {
        tanks: [],
        bullets: [],
        scores: { player1: 0, player2: 0 },
    });

    assertEqual(forwarded.toClientId, 'remote-client', 'host state is sent to remote client');
    assertEqual(forwarded.message.type, 'game_state', 'wire message uses authoritative state type');
    assertEqual(forwarded.message.player_id, 'player1', 'state sender is the host player');
}

testAssignsPlayerSlotsAndSnapshots();
testReadyStartsMatchWithHostAuthority();
testBuildsForwardOnlyInputMessage();
testJoinResponseRejectsThirdPlayer();
testClientInputTargetsHostAuthority();
testHostStateTargetsClientOnly();
