import {
    getAllCharacterAudioCuePaths,
    getBackgroundMusicPath,
    getCharacterAudioCuePath,
} from '../assets/scripts/audio/CharacterAudioCues';

function assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

function testCharacterScoreCuePaths(): void {
    assertEqual(getCharacterAudioCuePath('caixukun', 'score'), 'audio/kun_score', 'Caixukun score uses Kun score cue');
    assertEqual(getCharacterAudioCuePath('kun', 'score'), 'audio/kun_score', 'Kun alias score uses Kun score cue');
    assertEqual(
        getCharacterAudioCuePath('nailong', 'score'),
        'audio/nailong_score',
        'Nailong score cue path matches asset',
    );
    assertEqual(getCharacterAudioCuePath('kobe', 'score'), 'audio/kobe_score', 'Kobe score cue path matches asset');
}

function testCharacterSkillCuePaths(): void {
    assertEqual(getCharacterAudioCuePath('caixukun', 'skill'), 'audio/kun_skill', 'Caixukun skill uses Kun skill cue');
    assertEqual(getCharacterAudioCuePath('kun', 'skill'), 'audio/kun_skill', 'Kun alias skill uses Kun skill cue');
    assertEqual(
        getCharacterAudioCuePath('nailong', 'skill'),
        'audio/nailong_skill',
        'Nailong skill cue path matches asset',
    );
    assertEqual(getCharacterAudioCuePath('kobe', 'skill'), 'audio/kobe_skill', 'Kobe skill cue path matches asset');
}

function testUnknownCharacterHasNoCue(): void {
    assertEqual(getCharacterAudioCuePath('unknown', 'score'), null, 'Unknown score cue is absent');
    assertEqual(getCharacterAudioCuePath('', 'skill'), null, 'Blank skill cue is absent');
}

function testAllCuePathsAreUniqueResourcesPaths(): void {
    const paths = getAllCharacterAudioCuePaths();
    assertEqual(paths.length, 6, 'All six character cue paths are listed for preload');
    assertEqual(new Set(paths).size, 6, 'Preload cue paths are unique');
    assertEqual(paths.includes('audio/kun_score'), true, 'Kun score is preloaded');
    assertEqual(paths.includes('audio/kobe_skill'), true, 'Kobe skill is preloaded');
}

function testBackgroundMusicPathUsesResourcesAudio(): void {
    assertEqual(getBackgroundMusicPath(), 'audio/bgm', 'BGM path points to resources audio bgm clip');
}

testCharacterScoreCuePaths();
testCharacterSkillCuePaths();
testUnknownCharacterHasNoCue();
testAllCuePathsAreUniqueResourcesPaths();
testBackgroundMusicPathUsesResourcesAudio();
