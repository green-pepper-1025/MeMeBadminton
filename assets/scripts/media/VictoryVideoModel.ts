export type CharacterVideoEvent = 'win';

export interface VictoryVideoRequest {
    shouldPlay: boolean;
    resourcePath: string | null;
    loop: boolean;
}

const CHARACTER_VIDEO_KEYS: Record<string, string> = {
    caixukun: 'kun',
    kun: 'kun',
    nailong: 'nailong',
    kobe: 'kobe',
};

const PRELOAD_VIDEO_KEYS = ['kun', 'nailong', 'kobe'];

export function getCharacterVictoryVideoPath(characterId: string): string | null {
    return getCharacterVideoPath(characterId, 'win');
}

export function getCharacterVideoPath(characterId: string, event: CharacterVideoEvent): string | null {
    const videoKey = CHARACTER_VIDEO_KEYS[characterId];
    if (!videoKey) {
        return null;
    }

    return `video/${videoKey}_${event}`;
}

export function getAllVictoryVideoPaths(): string[] {
    return PRELOAD_VIDEO_KEYS.map((videoKey) => `video/${videoKey}_win`);
}

export function buildVictoryVideoRequest(characterId: string): VictoryVideoRequest {
    const resourcePath = getCharacterVictoryVideoPath(characterId);

    return {
        shouldPlay: resourcePath !== null,
        resourcePath,
        loop: false,
    };
}
