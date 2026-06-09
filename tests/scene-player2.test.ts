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

function findPlayerController(nodeId: number): SceneObject {
    const controller = scene.find((item) => item.node?.__id__ === nodeId && item.playerId === 2);
    assert(Boolean(controller), 'Player2 controller should exist');
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
    const controller = findPlayerController(id);

    assert(controller.skillKey === 13, 'Player2 skillKey should be Enter');
}

function testPlayer2HasPlayer1LimbRigReferences(): void {
    const { id } = findNode('Player2');
    const controller = findPlayerController(id);

    assertNodeReference(controller.leftLegNode, 'LeftLeg', id);
    assertNodeReference(controller.rightLegNode, 'RightLeg', id);
    assertNodeReference(controller.leftArmNode, 'LeftArm', id);
    assertNodeReference(controller.rightArmNode, 'RightArm', id);
    assertNodeReference(controller.racketNode, 'Racket', id);
    assert(refId(controller.shuttlecockNode, 'shuttlecockNode') >= 0, 'Player2 shuttlecockNode should be assigned');
}

testPlayer2UsesEnterForSkill();
testPlayer2HasPlayer1LimbRigReferences();
