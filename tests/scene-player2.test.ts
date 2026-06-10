export {};

declare function require(name: string): { readFileSync(path: string, encoding: string): string };

const { readFileSync } = require('fs');

type SceneRef = { __id__: number };
type SceneObject = {
    __type__?: string;
    _name?: string;
    _parent?: SceneRef;
    _children?: SceneRef[];
    node?: SceneRef;
    leftLegNode?: SceneRef | null;
    rightLegNode?: SceneRef | null;
    leftArmNode?: SceneRef | null;
    rightArmNode?: SceneRef | null;
    racketNode?: SceneRef | null;
    shuttlecockNode?: SceneRef | null;
    leftKey?: number;
    rightKey?: number;
    jumpKey?: number;
    strikeKey?: number;
    skillKey?: number;
    playerId?: number;
};

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function refId(ref: SceneRef | null | undefined, label: string): number {
    assert(Boolean(ref), `${label} should be assigned`);
    return (ref as SceneRef).__id__;
}

const scene = JSON.parse(readFileSync('assets/scenes/scene.scene', 'utf8')) as SceneObject[];

function findNode(name: string): { id: number; node: SceneObject } {
    const id = scene.findIndex((item) => item.__type__ === 'cc.Node' && item._name === name);
    assert(id >= 0, `${name} node should exist`);
    return { id, node: scene[id] };
}

function findPlayerController(nodeId: number, playerId: number): SceneObject {
    const controller = scene.find((item) => item.node?.__id__ === nodeId && item.playerId === playerId);
    assert(Boolean(controller), `Player${playerId} controller should exist`);
    return controller as SceneObject;
}

function assertNodeReference(ref: SceneRef | null | undefined, expectedName: string, player2Id: number): void {
    const id = refId(ref, `${expectedName} reference`);
    const node = scene[id];
    assert(node?.__type__ === 'cc.Node', `${expectedName} reference should point to a node`);
    assert(node._name === expectedName, `${expectedName} reference should point to ${expectedName}`);
    assert(node._parent?.__id__ === player2Id || scene[node._parent?.__id__ ?? -1]?._parent?.__id__ === player2Id, `${expectedName} should belong to Player2`);
}

function testPlayer2UsesEnterForSkill(): void {
    const { id } = findNode('Player2');
    const controller = findPlayerController(id, 2);

    assert(controller.skillKey === 13, 'Player2 skillKey should be Enter');
    assert(controller.strikeKey !== 13, 'Player2 Enter should not be assigned as strikeKey');
}

function testPlayer2UsesArrowDownForStrike(): void {
    const { id } = findNode('Player2');
    const controller = findPlayerController(id, 2);

    assert(controller.leftKey === 37, 'Player2 leftKey should be ArrowLeft');
    assert(controller.rightKey === 39, 'Player2 rightKey should be ArrowRight');
    assert(controller.jumpKey === 38, 'Player2 jumpKey should be ArrowUp');
    assert(controller.strikeKey === 40, 'Player2 strikeKey should be ArrowDown');
}

function testPlayer1ControlsStayOnWasdAndSpace(): void {
    const { id } = findNode('Player1');
    const controller = findPlayerController(id, 1);

    assert(controller.leftKey === 65, 'Player1 leftKey should remain A');
    assert(controller.rightKey === 68, 'Player1 rightKey should remain D');
    assert(controller.jumpKey === 87, 'Player1 jumpKey should remain W');
    assert(controller.strikeKey === 83, 'Player1 strikeKey should remain S');
    assert(controller.skillKey === 32, 'Player1 skillKey should remain Space');
}

function testPlayer2ServeFacesPlayer1Half(): void {
    const source = readFileSync('assets/scripts/player/PlayerController.ts', 'utf8');
    const gameManagerSource = readFileSync('assets/scripts/core/GameManager.ts', 'utf8');

    assert(
        source.includes('const facingRight = this.playerId === 1;'),
        'PlayerController.tryServe should treat only Player1 as facing right so Player2 serves toward Player1 half'
    );
    assert(
        !source.includes('const facingRight = this.playerId === 2;'),
        'PlayerController.tryServe should not treat Player2 as facing right'
    );
    assert(
        gameManagerSource.includes('Math.abs(this.serveForceX) * dirX'),
        'GameManager.tryServe should use serveForceX as a magnitude so negative scene overrides do not reverse both serves'
    );
}

function testServeSwingDoesNotApplyNormalHit(): void {
    const source = readFileSync('assets/scripts/player/PlayerController.ts', 'utf8');

    assert(
        source.includes('playSwingAnimation(true, tryHit)'),
        'performHighHit(false) should pass the no-hit intent into the serve swing animation'
    );
    assert(
        source.includes('this._swingCanHit') && source.includes('&& this._swingCanHit'),
        'PlayerController.update should not perform normal hits during a serve-only swing'
    );
}

function testOutOfRangeRallyStrikeStillSwings(): void {
    const source = readFileSync('assets/scripts/player/PlayerController.ts', 'utf8');

    assert(
        source.includes('if (!action) {\n            this.performHighHit();\n            return;\n        }'),
        'PlayerController should still play a swing during a rally when the shuttle is outside hit range'
    );
}

function testPlayer2HasPlayer1LimbRigReferences(): void {
    const { id } = findNode('Player2');
    const controller = findPlayerController(id, 2);

    assertNodeReference(controller.leftLegNode, 'LeftLeg', id);
    assertNodeReference(controller.rightLegNode, 'RightLeg', id);
    assertNodeReference(controller.leftArmNode, 'LeftArm', id);
    assertNodeReference(controller.rightArmNode, 'RightArm', id);
    assertNodeReference(controller.racketNode, 'Racket', id);
    assert(refId(controller.shuttlecockNode, 'shuttlecockNode') >= 0, 'Player2 shuttlecockNode should be assigned');
}

testPlayer2UsesEnterForSkill();
testPlayer2UsesArrowDownForStrike();
testPlayer1ControlsStayOnWasdAndSpace();
testPlayer2ServeFacesPlayer1Half();
testServeSwingDoesNotApplyNormalHit();
testOutOfRangeRallyStrikeStillSwings();
testPlayer2HasPlayer1LimbRigReferences();
