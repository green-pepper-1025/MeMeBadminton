# Scene Analysis

Generated: 2026-06-08

## MCP Coverage

MCP successfully returned:

- Project information.
- Scene list.
- All scene nodes.
- Selected node components.
- Available component types.
- Custom script component IDs.

MCP limitations observed:

- Full unused asset analysis is not available in the current MCP implementation.
- Full prefab dependency analysis is not available from the currently exposed tools.
- Build and preview MCP tools are partially available, but project build actions require editor UI or additional MCP build-system tools.

## Scene List

| Scene         | Path                             | UUID                                   |
| ------------- | -------------------------------- | -------------------------------------- |
| `scene.scene` | `db://assets/scenes/scene.scene` | `b00da435-df28-4eb7-9611-8618c9ec0849` |

## Scene Structure

```text
scene
└─ Canvas
   ├─ Camera
   ├─ GameManager
   ├─ Background
   ├─ Net (inactive)
   ├─ Player1
   │  ├─ Body
   │  └─ Racket
   ├─ Player2
   │  ├─ Body
   │  └─ Racket
   ├─ Shuttlecock (inactive)
   ├─ Walls
   │  ├─ WallLeft
   │  ├─ WallRight
   │  └─ WallBottom
   ├─ Score1Label
   └─ Score2Label
```

MCP node paths are currently returned as root-style paths such as `/Player1`, but the serialized scene file confirms these nodes are children of `Canvas`.

## UI Layer

```text
Canvas
├─ Camera: cc.Camera
├─ Background: cc.Sprite
├─ Net: cc.Sprite, inactive
├─ Score1Label: cc.Label
├─ Score2Label: cc.Label
└─ Gameplay nodes: Player1, Player2, Shuttlecock, Walls
```

## Component Mounting

| Node          | Key Components                                       | Notes                                            |
| ------------- | ---------------------------------------------------- | ------------------------------------------------ |
| `Canvas`      | `cc.Canvas`, `cc.Widget`, `cc.UITransform`           | Root UI node.                                    |
| `GameManager` | `GameManager`                                        | References labels, shuttlecock, net.             |
| `Player1`     | `PlayerController`                                   | WASD controls, racket and shuttlecock assigned.  |
| `Player2`     | `PlayerController`                                   | Arrow controls, racket and shuttlecock assigned. |
| `Shuttlecock` | `cc.Sprite`, `cc.RigidBody2D`, `cc.CircleCollider2D` | Inactive until serve.                            |
| `WallBottom`  | `cc.Sprite`, `cc.BoxCollider2D`, `FloorCollision`    | Scores on shuttlecock contact.                   |
| `Net`         | `cc.Sprite`                                          | Inactive; used as score divider reference.       |
| `Score1Label` | `cc.Label`                                           | Bound to `GameManager.score1Label`.              |
| `Score2Label` | `cc.Label`                                           | Bound to `GameManager.score2Label`.              |

## Node Dependency Relationships

```text
GameManager
├─ score1Label -> Score1Label.cc.Label
├─ score2Label -> Score2Label.cc.Label
├─ shuttlecock -> Shuttlecock
└─ netNode -> Net

Player1.PlayerController
├─ racketNode -> Player1/Racket
└─ shuttlecockNode -> Shuttlecock

Player2.PlayerController
├─ racketNode -> Player2/Racket
└─ shuttlecockNode -> Shuttlecock

WallBottom.FloorCollision
└─ runtime lookup -> GameManager
```

## Physics Settings

Project physics settings define:

- Gravity: `y = -6`
- Collision groups:
    - `PLAYER`
    - `BALL`
    - `GROUND`
    - `NET`
- Collision matrix:
    - `0: 31`
    - `1: 29`
    - `2: 27`
    - `3: 7`
    - `4: 7`

High-risk mismatch: the inspected colliders and rigid bodies for `Shuttlecock` and `WallBottom` currently report group `DEFAULT`, not the named project groups.

## High-Risk References

- `Net` is inactive but still used as the world-space divider for scoring. This is acceptable only if inactive nodes retain the intended transform.
- `Shuttlecock` starts inactive, then `GameManager.tryServe` activates it.
- `GameManager` scene overrides set `serveForceX=5` and `serveForceY=3`, while script defaults are `300` and `600`.
- `InputRouter` custom script exists but is not mounted in the current scene.
- `RacketHit` custom script exists but current player hit logic is distance-based in `PlayerController`.

## Manual Test Required After Scene Or Physics Changes

Now需要你在 Cocos Creator 中手动测试 if future changes modify:

- Node active state.
- Collider group or shape.
- Rigidbody parameters.
- UI label binding.
- GameManager object references.

Suggested test flow:

1. Open `assets/scenes/scene.scene`.
2. Run preview.
3. Press `W` for Player1 serve and verify the shuttlecock appears and moves.
4. Move Player1 with `A/D`, Player2 with arrow left/right.
5. Swing with `W/S` and arrow up/down.
6. Let the shuttlecock hit bottom and verify score changes once.
