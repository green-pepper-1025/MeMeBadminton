import {
    buildVictoryVideoRequest,
    getAllVictoryVideoPaths,
    getCharacterVictoryVideoPath,
} from '../assets/scripts/media/VictoryVideoModel';

function assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

function testCharacterVictoryVideoPaths(): void {
    assertEqual(
        getCharacterVictoryVideoPath('caixukun'),
        'video/kun_win',
        'Caixukun victory video uses Kun asset',
    );
    assertEqual(getCharacterVictoryVideoPath('kun'), 'video/kun_win', 'Kun alias victory video matches asset');
    assertEqual(
        getCharacterVictoryVideoPath('nailong'),
        'video/nailong_win',
        'Nailong victory video matches asset',
    );
    assertEqual(getCharacterVictoryVideoPath('kobe'), 'video/kobe_win', 'Kobe victory video matches asset');
}

function testUnknownCharacterSkipsVideo(): void {
    assertEqual(getCharacterVictoryVideoPath('unknown'), null, 'Unknown character has no victory video');
    assertEqual(getCharacterVictoryVideoPath(''), null, 'Blank character has no victory video');
}

function testAllVictoryVideoPathsAreUniqueResourcesPaths(): void {
    const paths = getAllVictoryVideoPaths();
    assertEqual(paths.length, 3, 'All three victory video paths are listed');
    assertEqual(new Set(paths).size, 3, 'Victory video preload paths are unique');
    assertEqual(paths.includes('video/kun_win'), true, 'Kun victory video is listed');
    assertEqual(paths.includes('video/nailong_win'), true, 'Nailong victory video is listed');
    assertEqual(paths.includes('video/kobe_win'), true, 'Kobe victory video is listed');
}

function testVictoryVideoRequestCarriesPlaybackPolicy(): void {
    const request = buildVictoryVideoRequest('kobe');
    assertEqual(request.shouldPlay, true, 'Known character should play a video');
    assertEqual(request.resourcePath, 'video/kobe_win', 'Known character request carries resource path');
    assertEqual(request.loop, false, 'Victory video should not loop');
}

function testMissingVictoryVideoRequestFallsBack(): void {
    const request = buildVictoryVideoRequest('missing');
    assertEqual(request.shouldPlay, false, 'Missing character should skip video');
    assertEqual(request.resourcePath, null, 'Missing character has no resource path');
    assertEqual(request.loop, false, 'Fallback request still keeps non-looping policy');
}

testCharacterVictoryVideoPaths();
testUnknownCharacterSkipsVideo();
testAllVictoryVideoPathsAreUniqueResourcesPaths();
testVictoryVideoRequestCarriesPlaybackPolicy();
testMissingVictoryVideoRequestFallsBack();
