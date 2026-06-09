export type CharacterAudioEvent = 'score' | 'skill';

const CHARACTER_AUDIO_KEYS: Record<string, string> = {
    caixukun: 'kun',
    kun: 'kun',
    nailong: 'nailong',
    kobe: 'kobe',
};

const PRELOAD_AUDIO_KEYS = ['kun', 'nailong', 'kobe'];
const AUDIO_EVENTS: CharacterAudioEvent[] = ['score', 'skill'];
const BACKGROUND_MUSIC_PATH = 'audio/bgm';

export function getCharacterAudioCuePath(characterId: string, event: CharacterAudioEvent): string | null {
    const audioKey = CHARACTER_AUDIO_KEYS[characterId];
    if (!audioKey) {
        return null;
    }

    return `audio/${audioKey}_${event}`;
}

export function getAllCharacterAudioCuePaths(): string[] {
    const paths: string[] = [];
    for (const audioKey of PRELOAD_AUDIO_KEYS) {
        for (const event of AUDIO_EVENTS) {
            paths.push(`audio/${audioKey}_${event}`);
        }
    }

    return paths;
}

export function getBackgroundMusicPath(): string {
    return BACKGROUND_MUSIC_PATH;
}
