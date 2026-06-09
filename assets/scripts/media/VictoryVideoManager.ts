import { Color, Graphics, Label, Node, resources, UITransform, VideoClip, VideoPlayer } from 'cc';
import { buildVictoryVideoRequest } from './VictoryVideoModel';

type PlaybackComplete = () => void;

export interface VictoryVideoManagerOptions {
    width: number;
    height: number;
}

export class VictoryVideoManager {
    private readonly _root: Node;
    private readonly _width: number;
    private readonly _height: number;
    private _overlay: Node = null;
    private _hasCompleted: boolean = false;
    private _playbackToken: number = 0;

    public constructor(root: Node, options: VictoryVideoManagerOptions = { width: 1280, height: 720 }) {
        this._root = root;
        this._width = options.width;
        this._height = options.height;
    }

    public playWinVideo(characterId: string, onComplete: PlaybackComplete): void {
        const request = buildVictoryVideoRequest(characterId);
        if (!request.shouldPlay || !request.resourcePath) {
            onComplete();
            return;
        }

        this.cleanupOverlay();
        this._hasCompleted = false;
        const playbackToken = ++this._playbackToken;
        this._overlay = this.createOverlay();

        resources.load(request.resourcePath, VideoClip, (error, clip) => {
            if (playbackToken !== this._playbackToken) {
                return;
            }

            if (error || !clip || !this._overlay) {
                console.warn(`[VictoryVideoManager] skip victory video: ${request.resourcePath}`, error);
                this.finish(playbackToken, onComplete);
                return;
            }

            const videoNode = new Node('VictoryVideoPlayer');
            this._overlay.addChild(videoNode);
            videoNode.setPosition(0, 0, 0);
            videoNode.addComponent(UITransform).setContentSize(this._width, this._height);

            const videoPlayer = videoNode.addComponent(VideoPlayer);
            videoPlayer.resourceType = VideoPlayer.ResourceType.LOCAL;
            videoPlayer.clip = clip;
            videoPlayer.loop = request.loop;
            videoPlayer.playOnAwake = false;
            videoPlayer.keepAspectRatio = true;
            videoPlayer.stayOnBottom = false;

            const completeOnce = () => this.finish(playbackToken, onComplete);
            videoNode.once(VideoPlayer.EventType.COMPLETED, completeOnce, this);
            videoNode.once(VideoPlayer.EventType.ERROR, completeOnce, this);
            videoPlayer.play();
        });
    }

    public cleanupOverlay(): void {
        if (this._overlay?.isValid) {
            this._overlay.destroy();
        }
        this._overlay = null;
        this._hasCompleted = false;
        this._playbackToken++;
    }

    private createOverlay(): Node {
        const overlay = new Node('VictoryVideoOverlay');
        this._root.addChild(overlay);
        overlay.setPosition(0, 0, 0);
        overlay.addComponent(UITransform).setContentSize(this._width, this._height);

        const background = overlay.addComponent(Graphics);
        background.fillColor = Color.BLACK;
        background.rect(-this._width / 2, -this._height / 2, this._width, this._height);
        background.fill();

        const loadingNode = new Node('LoadingLabel');
        overlay.addChild(loadingNode);
        loadingNode.setPosition(0, -300, 0);
        loadingNode.addComponent(UITransform).setContentSize(500, 40);
        const loadingLabel = loadingNode.addComponent(Label);
        loadingLabel.string = '胜利回放加载中';
        loadingLabel.fontSize = 22;
        loadingLabel.color = new Color(220, 230, 240, 255);
        loadingLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        loadingLabel.verticalAlign = Label.VerticalAlign.CENTER;

        return overlay;
    }

    private finish(playbackToken: number, onComplete: PlaybackComplete): void {
        if (this._hasCompleted || playbackToken !== this._playbackToken) {
            return;
        }

        this._hasCompleted = true;
        if (this._overlay?.isValid) {
            this._overlay.destroy();
        }
        this._overlay = null;
        onComplete();
    }
}
