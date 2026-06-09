import { AudioClip, AudioSource, director, Node, resources, warn } from 'cc';
import {
    CharacterAudioEvent,
    getAllCharacterAudioCuePaths,
    getBackgroundMusicPath,
    getCharacterAudioCuePath,
} from './CharacterAudioCues';

export class AudioManager {
    private static _instance: AudioManager = null;

    private readonly _clips: Map<string, AudioClip> = new Map();
    private readonly _loadingPaths: Set<string> = new Set();
    private readonly _pendingPlayCounts: Map<string, number> = new Map();
    private _audioSource: AudioSource = null;
    private _audioNode: Node = null;
    private _bgmSource: AudioSource = null;
    private _bgmNode: Node = null;
    private _currentBgmPath: string = '';

    public static getInstance(): AudioManager {
        if (!this._instance) {
            this._instance = new AudioManager();
        }

        return this._instance;
    }

    public preloadCharacterCues(): void {
        for (const path of getAllCharacterAudioCuePaths()) {
            this.loadClip(path);
        }
    }

    public playCharacterCue(characterId: string, event: CharacterAudioEvent): void {
        const path = getCharacterAudioCuePath(characterId, event);
        if (!path) {
            warn(`[AudioManager] Missing character audio cue for ${characterId}/${event}`);
            return;
        }

        this.playOneShot(path);
    }

    public playBackgroundMusic(): void {
        this.playLoopingMusic(getBackgroundMusicPath());
    }

    private playOneShot(path: string): void {
        const clip = this._clips.get(path);
        if (clip) {
            this.playClip(clip, path);
            return;
        }

        this._pendingPlayCounts.set(path, (this._pendingPlayCounts.get(path) ?? 0) + 1);
        this.loadClip(path);
    }

    private loadClip(path: string): void {
        if (this._clips.has(path) || this._loadingPaths.has(path)) {
            return;
        }

        this._loadingPaths.add(path);
        resources.load(path, AudioClip, (error, clip) => {
            this._loadingPaths.delete(path);

            if (error || !clip) {
                this._pendingPlayCounts.delete(path);
                warn(`[AudioManager] Failed to load audio resource: ${path}`, error);
                return;
            }

            this._clips.set(path, clip);
            this.playPending(path, clip);
        });
    }

    private playLoopingMusic(path: string): void {
        const source = this.getBgmSource();
        if (!source) {
            warn(`[AudioManager] BGM AudioSource unavailable for: ${path}`);
            return;
        }

        if (this._currentBgmPath === path && source.playing) {
            return;
        }

        const clip = this._clips.get(path);
        if (clip) {
            this.startBgmSource(source, path, clip);
            return;
        }

        if (this._loadingPaths.has(path)) {
            return;
        }

        this._loadingPaths.add(path);
        resources.load(path, AudioClip, (error, clip) => {
            this._loadingPaths.delete(path);

            if (error || !clip) {
                warn(`[AudioManager] Failed to load BGM resource: ${path}`, error);
                return;
            }

            this._clips.set(path, clip);
            this.startBgmSource(source, path, clip);
        });
    }

    private startBgmSource(source: AudioSource, path: string, clip: AudioClip): void {
        source.stop();
        source.clip = clip;
        source.loop = true;
        source.volume = 0.55;
        source.play();
        this._currentBgmPath = path;
    }

    private playPending(path: string, clip: AudioClip): void {
        const pendingCount = this._pendingPlayCounts.get(path) ?? 0;
        this._pendingPlayCounts.delete(path);

        for (let i = 0; i < pendingCount; i++) {
            this.playClip(clip, path);
        }
    }

    private playClip(clip: AudioClip, path: string): void {
        const source = this.getAudioSource();
        if (!source) {
            warn(`[AudioManager] AudioSource unavailable for cue: ${path}`);
            return;
        }

        source.playOneShot(clip, 1);
    }

    private getAudioSource(): AudioSource | null {
        if (this._audioSource && this._audioSource.isValid) {
            return this._audioSource;
        }

        const scene = director.getScene();
        if (!scene) {
            return null;
        }

        this._audioNode = new Node('ReusableAudioManager');
        scene.addChild(this._audioNode);
        this._audioSource = this._audioNode.addComponent(AudioSource);
        return this._audioSource;
    }

    private getBgmSource(): AudioSource | null {
        if (this._bgmSource && this._bgmSource.isValid) {
            return this._bgmSource;
        }

        const scene = director.getScene();
        if (!scene) {
            return null;
        }

        this._bgmNode = new Node('ReusableBgmAudioManager');
        scene.addChild(this._bgmNode);
        this._bgmSource = this._bgmNode.addComponent(AudioSource);
        return this._bgmSource;
    }
}
