# gamekit Recipes

Small, self-contained snippets for common game tasks. Each one is a few lines you
can paste into a `Scene` and adapt. They assume you have a scene set up (see
[your-first-game.md](./your-first-game.md) or `npm create gamekit`).

Conventions used below:
- `this` is a `Scene` subclass; game logic goes in `fixedUpdate(dt)`.
- An `Entity` with a `width`/`height` but no texture draws as a white box, so most
  recipes need no art.

---

## Move with the keyboard

```ts
import { InputManager } from "@cjgammon/gamekit/input";

const input = new InputManager({
  up: ["KeyW", "ArrowUp"], down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
});
input.attach(window);

// in fixedUpdate(dt):
const dx = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
const dy = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);
const len = Math.hypot(dx, dy) || 1; // normalize so diagonals aren't faster
player.velocity.set((dx / len) * 200, (dy / len) * 200);
```

## Follow the mouse / aim at the pointer

`InputManager` tracks the pointer in canvas pixels; the camera converts that to
world space.

```ts
import { Vec2 } from "@cjgammon/gamekit";

// in fixedUpdate(dt):
const target = this.camera.screenToWorld(new Vec2(input.pointerX, input.pointerY));
const angle = Math.atan2(target.y - player.centerY, target.x - player.centerX);
player.rotation = angle; // or player.rotationDegrees = angle * 180 / Math.PI
```

## Shoot toward a point

```ts
function fireAt(scene: Scene, x: number, y: number, tx: number, ty: number) {
  const bullet = new Entity(x, y);
  bullet.width = bullet.height = 6;
  const a = Math.atan2(ty - y, tx - x);
  bullet.velocity.set(Math.cos(a) * 400, Math.sin(a) * 400);
  scene.add(bullet);
  scene.addTimer(2, () => bullet.kill()); // despawn after 2s
}
```

## Flash a sprite on hit

```ts
function flash(scene: Scene, sprite: Sprite) {
  sprite.tint = 0xff5555;
  scene.addTimer(0.1, () => (sprite.tint = 0xffffff)); // back to normal
}
```

## Screen shake

```ts
this.camera.shake(6, 0.25); // ±6 world units, decaying over 0.25s
```

## Camera follow with a deadzone and world bounds

```ts
this.camera.follow(player, 0.15);                 // ease toward the player
this.camera.deadzone = { x: 40, y: 30 };          // don't move until it leaves this box
this.camera.bounds = { minX: 0, minY: 0, maxX: 1280, maxY: 960 };
this.camera.snapToTarget();                       // center immediately on start
```

## Tween a property

```ts
import { Ease } from "@cjgammon/gamekit";

this.tween(sprite, { x: 400, alpha: 0 }, 0.5, { ease: Ease.quadOut });
```

## Score popup (tween up + fade, then remove)

```ts
function popup(scene: Scene, text: Text, x: number, y: number) {
  text.setPosition(x, y);
  text.alpha = 1;
  scene.add(text);
  scene.tween(text, { y: y - 24, alpha: 0 }, 0.6, { ease: Ease.quadOut });
  scene.addTimer(0.6, () => text.kill());
}
```

## Respawn after a delay

```ts
player.kill();
this.addTimer(1.5, () => {
  player.revive();
  player.setPosition(startX, startY); // snap so it doesn't smear from the death spot
});
```

## Play a sound on an event

```ts
import { AudioManager } from "@cjgammon/gamekit/audio";

const audio = new AudioManager();
audio.unlockOnGesture();                 // browsers need a gesture to start audio
await audio.load("hit", "/sfx/hit.wav"); // once, at startup

audio.play("hit", { volume: 0.6 });      // on the event
```

## A tilemap from an array (with collision)

```ts
import { Tilemap } from "@cjgammon/gamekit";

// 1 = solid, 0 = empty. Row-major, cols × rows.
const data = [
  1, 1, 1, 1, 1,
  1, 0, 0, 0, 1,
  1, 1, 1, 1, 1,
];
const map = new Tilemap(5, 3, 32, 32, data);
this.add(map);

// in fixedUpdate(dt): push the player out of solid tiles
map.collide(player);
```

## Pool bullets (reuse instead of allocating)

```ts
import { Group } from "@cjgammon/gamekit";

const bullets = new Group<Entity>();
bullets.recycling = true; // dead children are kept for reuse, not swept
this.add(bullets);

// to fire: reuse a dead bullet or make a new one
const b = bullets.recycle(() => {
  const e = new Entity();
  e.width = e.height = 6;
  return e;
})!;
b.setPosition(player.centerX, player.centerY);
b.velocity.set(0, -400);
```

## Detect overlaps / collisions between groups

```ts
// callback runs for each overlapping pair
this.overlap(playerBullets, enemies, (bullet, enemy) => {
  bullet.kill();
  enemy.kill();
  this.camera.shake(4, 0.15);
});

// collide() also separates the pair and zeroes velocity along the contact
this.collide(player, walls);
```

## A simple HUD

Everything is world-space, so position HUD text using the camera's visible rect.

```ts
// in update(dt), after super.update(dt):
const cam = this.camera;
const left = cam.x - cam.viewportWidth / cam.zoom / 2;
const top = cam.y - cam.viewportHeight / cam.zoom / 2;
this.hudText.setPosition(left + 4, top + 4);
this.hudText.setText(`Score ${this.score}`);
```

> A dedicated screen-space UI layer is on the roadmap to remove this camera math.

## Go multiplayer

The networking is a deeper topic — see the full walkthrough in
[tutorial-pong.md](./tutorial-pong.md). The short version: a `NetScene` keeps your
entities in sync with an authoritative server, predicts your own player, and
interpolates everyone else.

```ts
import { NetScene, WebSocketTransport } from "@cjgammon/gamekit/net";
import { simulatePlayer, PLAYER_SPEED } from "@cjgammon/gamekit";

const scene = new NetScene(transport, factory, {
  simulate: (entity, input, dt, ctx) =>
    simulatePlayer(entity, input, dt, { speed: PLAYER_SPEED, worldW: ctx.worldW, worldH: ctx.worldH }),
});
```

`npm create gamekit my-game --template multiplayer` scaffolds a working version of
this with a server.
