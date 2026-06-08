import { LocalCharacterSelect } from '../assets/scripts/core/LocalCharacterSelect';

function assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}. Expected ${expected}, got ${actual}`);
    }
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function testBuildsLocalMatchSetupAfterBothPlayersConfirm(): void {
    const select = new LocalCharacterSelect('kobe', 'caixukun');

    select.selectCharacter('player1', 'nailong');
    select.selectCharacter('player2', 'kobe');
    select.confirmPlayer('player1');

    assertEqual(select.isReadyToStart(), false, 'one confirmed player cannot start local match');

    select.confirmPlayer('player2');

    assertEqual(select.isReadyToStart(), true, 'both confirmed players can start local match');
    const setup = select.createMatchSetup();
    assertEqual(setup.roomId, 'LOCAL', 'local match uses local room id');
    assertEqual(setup.localPlayerId, 'player1', 'local match uses player1 as local player');
    assertEqual(setup.players[0].characterId, 'nailong', 'P1 selected character is stored');
    assertEqual(setup.players[1].characterId, 'kobe', 'P2 selected character is stored');
}

function testConfirmedPlayerCannotSwitchCharacter(): void {
    const select = new LocalCharacterSelect('kobe', 'caixukun');

    select.confirmPlayer('player1');
    select.selectCharacter('player1', 'nailong');

    assertEqual(select.getSelectedCharacter('player1'), 'kobe', 'confirmed P1 selection stays locked');
}

function testResetRestoresDefaultsAndClearsConfirmations(): void {
    const select = new LocalCharacterSelect('kobe', 'caixukun');

    select.selectCharacter('player1', 'nailong');
    select.selectCharacter('player2', 'kobe');
    select.confirmPlayer('player1');
    select.confirmPlayer('player2');
    select.reset();

    assertEqual(select.getSelectedCharacter('player1'), 'kobe', 'P1 default character is restored');
    assertEqual(select.getSelectedCharacter('player2'), 'caixukun', 'P2 default character is restored');
    assertEqual(select.isConfirmed('player1'), false, 'P1 confirmation is cleared');
    assertEqual(select.isConfirmed('player2'), false, 'P2 confirmation is cleared');
}

testBuildsLocalMatchSetupAfterBothPlayersConfirm();
testConfirmedPlayerCannotSwitchCharacter();
testResetRestoresDefaultsAndClearsConfirmations();
