# KidEngine 🎮

A game engine that makes it easy to build multiplayer web games.
Uses [PixiJS](https://pixijs.com) for graphics, [Matter.js](https://brm.io/matter-js) for physics,
and [Socket.io](https://socket.io) for multiplayer — all hidden behind a simple API.

---

## Install

```bash
npm install kidengine
```

---

## Quick start

```js
import { createGame } from 'kidengine';

const game = createGame({ width: 800, height: 600 });

// add a player sprite
const player = game.sprite('assets/hero.png', { x: 400, y: 300 });
game.addPhysics(player);

// move with arrow keys
game.onUpdate(() => {
  if (game.isKeyDown('ArrowLeft'))  player.moveLeft(5);
  if (game.isKeyDown('ArrowRight')) player.moveRight(5);
  if (game.isKeyDown('ArrowUp'))    player.jump(10);
});

// make the camera follow the player
game.follow(player);
```

---

## createGame(options)

Creates the game and returns the game object. Call this once at the top of your `game.js`.

```js
const game = createGame({
  width:      800,                      // canvas width in pixels  (default: 800)
  height:     600,                      // canvas height in pixels (default: 600)
  gravity:    1,                        // gravity strength — 0 means no gravity (default: 1)
  background: 0x87ceeb,                 // background color as a hex number (default: sky blue)
  server:     'http://localhost:3000',  // multiplayer server address (default: localhost)
});
```

---

## Sprites

Sprites are the things you can see in your game — players, enemies, coins, platforms.

### game.sprite(imagePath, options)

Add a sprite from an image file.

```js
const player = game.sprite('assets/hero.png', {
  x:      100,   // starting x position
  y:      200,   // starting y position
  width:  64,    // display width  (optional — uses image size by default)
  height: 64,    // display height (optional)
});
```

### game.box(options)

Add a solid colored rectangle. Great for floors, walls, and platforms.

```js
const floor = game.box({
  x:        0,
  y:        560,
  width:    800,
  height:   40,
  color:    0x228B22,   // green
  isStatic: true,       // won't move when hit (default: true)
});
```

### game.circle(options)

Add a colored circle.

```js
const coin = game.circle({
  x:      300,
  y:      100,
  radius: 20,
  color:  0xFFD700,  // gold
});
```

---

## Sprite properties

Once you have a sprite, you can read and change these:

```js
player.x          // horizontal position
player.y          // vertical position
player.width      // width in pixels
player.height     // height in pixels
player.angle      // rotation in degrees
player.visible    // true/false — show or hide
player.alpha      // 0 (invisible) to 1 (fully visible)
player.velocityX  // current horizontal speed (physics only)
player.velocityY  // current vertical speed   (physics only)
player.data       // free object for your own data, e.g. player.data.health = 3
```

---

## Sprite methods

```js
player.moveLeft(speed)    // move left  (default speed: 5)
player.moveRight(speed)   // move right
player.moveUp(speed)      // move up
player.moveDown(speed)    // move down
player.jump(power)        // jump upward (default power: 10) — needs physics
player.setVelocity(x, y)  // set exact speed in both directions
player.moveTo(x, y)       // teleport to a position
player.setColor(0xff0000) // tint the sprite a color
player.destroy()          // remove from the game
```

---

## Physics

### game.addPhysics(sprite, options)

Give a sprite gravity and collisions.

```js
game.addPhysics(player, {
  isStatic:   false,  // false = moves around, true = immovable (default: false)
  bounce:     0.2,    // bounciness — 0 to 1 (default: 0.2)
  friction:   0.8,    // surface grip (default: 0.8)
  noRotation: true,   // stop the sprite from tipping over (default: true)
  shape:      'rect', // 'rect' or 'circle' (default: 'rect')
});
```

### game.applyForce(sprite, { x, y })

Push a sprite — good for explosions or knockback.
Force values are small: `{ x: 0, y: -0.05 }` is a gentle upward push.

```js
game.applyForce(player, { x: 0, y: -0.05 });
```

---

## Collisions

### game.onCollide(spriteA, spriteB, callback)

Run a function the moment two sprites touch.

```js
game.onCollide(player, enemy, () => {
  player.data.health -= 1;
});
```

### game.onOverlap(spriteA, spriteB, callback)

Run a function every frame while two sprites are overlapping.
Neither sprite bounces — use this for coins, doors, triggers.

```js
game.onOverlap(player, coin, () => {
  coin.destroy();
  score += 1;
});
```

---

## Input

### game.onKey(key, callback)

Run code the moment a key is pressed.

```js
game.onKey(' ', () => player.jump());         // spacebar
game.onKey('ArrowUp', () => player.jump());
game.onKey('Enter', () => startGame());
```

### game.isKeyDown(key)

Check if a key is currently being held. Use inside `game.onUpdate()` for smooth movement.

```js
game.onUpdate(() => {
  if (game.isKeyDown('ArrowLeft'))  player.moveLeft(4);
  if (game.isKeyDown('ArrowRight')) player.moveRight(4);
});
```

### game.onTap(callback)

Run code when the player clicks or taps the screen. Works on mobile too.

```js
game.onTap((x, y) => {
  console.log('Tapped at', x, y);
});
```

---

## Game loop

### game.onUpdate(callback)

Run your own code every frame (60 times per second).

```js
game.onUpdate((delta) => {
  // delta is a small number close to 1
  // multiply speeds by delta for smooth movement at any frame rate
  enemy.x += 2 * delta;
});
```

---

## Camera

### game.follow(sprite, options)

Make the camera follow a sprite.

```js
game.follow(player, {
  lerp:   0.1,   // smoothness — 0.05 (dreamy) to 0.3 (snappy). Default: 0.1
  bounds: {      // optional: stop camera at world edges
    x: 0, y: 0,
    width:  3200,
    height: 600,
  }
});
```

### game._camera.shake(intensity, duration)

Shake the screen — great for explosions and taking damage.

```js
game._camera.shake(10, 400);  // shake intensity 10, for 400ms
```

---

## Tilemaps

### game.tilemap(path, options)

Load a map made with [Tiled](https://www.mapeditor.org). Export it as JSON from Tiled first.
Name your collision layer **"Solid"** and the engine will build physics for it automatically.

```js
await game.tilemap('assets/maps/level1.json');
```

---

## Multiplayer

Multiplayer needs the server running. Start it with `node server/server.js`.

### game.createRoom(playerName)

Create a new room. Returns a Promise with a 4-letter code to share with friends.

```js
const { code, players } = await game.createRoom('Player1');
console.log('Share this code:', code); // e.g. "KQTW"
```

### game.joinRoom(code, playerName)

Join a friend's room using their code.

```js
const { code, players } = await game.joinRoom('KQTW', 'Player2');
```

### game.send(event, data)

Send a custom message to everyone else in your room.

```js
game.send('coinCollected', { x: 100, y: 200 });
```

### game.onMessage(event, callback)

Listen for custom messages from other players.

```js
game.onMessage('coinCollected', (data) => {
  console.log('A coin was collected at', data.x, data.y);
});
```

### game.setScore(number)

Update your score. The server keeps scores safe so nobody can cheat.

```js
game.setScore(score);
```

### game.requestLeaderboard()

Ask the server for the current scores. Listen for the response with `onMessage`.

```js
game.requestLeaderboard();

game.onMessage('leaderboard', ({ players }) => {
  players.forEach(p => console.log(p.name, p.score));
});
```

> **Sprite sync is automatic.** Any sprite you create is automatically sent to other
> players. You don't need to call anything — they'll see your sprites move in real time.

---

## Pause and resume

```js
game.pause();   // stop the game loop
game.resume();  // start it again
```

---

## Advanced: accessing internals

If you need to go deeper, these give you direct access to the underlying systems:

```js
game._app      // PixiJS Application
game._physics  // Physics system (Matter.js wrapper)
game._scene    // Scene manager
game._network  // Network manager
game._camera   // Camera
game._input    // Input handler
```

---

## Publishing to npm

```bash
npm login
npm publish
```

To update after making changes, bump the version in `package.json` first:

```bash
npm version patch   # 0.1.0 → 0.1.1  (small fixes)
npm version minor   # 0.1.0 → 0.2.0  (new features)
npm version major   # 0.1.0 → 1.0.0  (big changes)
npm publish
```
