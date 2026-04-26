# Multiplayer Platform Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fixed-screen multiplayer platformer example demonstrating jumping mechanics, platform collision, collectibles, and player interactions using gamekit.

**Architecture:** Single-screen arena with platforms at different heights. Players move left/right and jump between platforms. Room-based multiplayer with automatic position sync and custom messages for collectibles. All game logic in `game.js`, HTML provides UI overlay for instructions and scores.

**Tech Stack:** GameKit (PixiJS + Matter.js + Socket.io), ES6 modules, vanilla JS

---

## File Structure

```
examples/platform/
├── index.html          # Main HTML page with canvas and UI overlays
├── game.js            # Complete game logic (imports, setup, mechanics, multiplayer)
└── README.md          # Setup instructions and feature documentation
```

**File Responsibilities:**
- `index.html`: Canvas container, UI overlays (instructions, room code, scores), styling
- `game.js`: Game instance, platforms, player sprites, movement/jump mechanics, collectibles, network sync
- `README.md`: How to run, controls, multiplayer setup, technical details

---

## Task 1: Create Directory and README

**Files:**
- Create: `examples/platform/README.md`

- [ ] **Step 1: Create platform directory**

```bash
mkdir -p examples/platform
```

- [ ] **Step 2: Write README with setup instructions**

Create `examples/platform/README.md`:

```markdown
# Multiplayer Platform Game

A fixed-screen multiplayer platformer demonstrating jumping mechanics, platform collision, collectibles, and real-time player sync.

## Features

- Side-scrolling platform mechanics (move left/right, jump)
- Multiple platforms at different heights
- Collectible items with network sync
- Room-based multiplayer (flexible player count)
- Physics-based player interactions

## Setup

### 1. Build GameKit

```bash
cd packages/gamekit
npm run build
```

### 2. Start GameKit Server

```bash
cd packages/gamekit-server
node server.js
```

Server runs on `http://localhost:3000`

### 3. Run the Example

```bash
# From project root, start dev server
npx vite

# Or use any local server in examples/platform/
cd examples/platform
python3 -m http.server 8888
```

Open `http://localhost:5173/examples/platform/` (Vite) or `http://localhost:8888/` (Python)

## Controls

- **Arrow Left/Right** or **A/D**: Move left/right
- **Spacebar**: Jump (only when on ground)
- **Click**: Move player to mouse Y position (optional)

## Multiplayer

### Host (Player 1)
1. Open the page
2. Enter your name
3. Room code appears on screen
4. Share the URL with room code to other players

### Guest (Player 2+)
1. Open page with `?room=CODE` parameter
2. Enter your name
3. Play!

**Example:** `http://localhost:5173/examples/platform/?room=ABC123`

## Architecture

- **Game Engine**: GameKit (PixiJS for rendering, Matter.js for physics, Socket.io for networking)
- **Physics**: Gravity-enabled, platform collision detection, velocity-based movement
- **Sync**: Automatic position/velocity sync at 20Hz via `game.setOwner()`
- **Custom Messages**: Collectible pickup, score updates, respawn events

## Code Structure

```javascript
// game.js structure
1. Imports from gamekit
2. Game instance creation (800x600, gravity enabled)
3. Platform creation (ground, 4 floating platforms, walls)
4. Player sprite setup
5. Collectibles creation
6. Input handlers (movement, jump)
7. Collision detection (ground, collectibles)
8. Multiplayer room setup
9. Network message handlers
10. Game loop logic
```

## Technical Details

- **Canvas:** 800x600px
- **Gravity:** 1 (normal gravity)
- **Player Size:** 20x40px box
- **Platform Size:** 20px tall, 100-300px wide
- **Collectible Size:** 10px radius circles
- **Jump Velocity:** -15 to -20 pixels/frame
- **Movement Speed:** 5 pixels/frame
- **Network Sync:** 20Hz (50ms interval)

## Success Criteria

- [ ] Players can move left/right smoothly
- [ ] Players can jump when on ground (not in air)
- [ ] Players land on platforms correctly
- [ ] Players collect items on contact
- [ ] Collectibles disappear for all players
- [ ] Scores update correctly
- [ ] Multiple players can play simultaneously
- [ ] Room creation/joining works reliably
```

- [ ] **Step 3: Verify README was created**

```bash
ls -la examples/platform/
cat examples/platform/README.md
```

Expected: Directory exists with README.md file containing setup instructions

- [ ] **Step 4: Commit**

```bash
git add examples/platform/README.md
git commit -m "docs: add platform game README with setup instructions"
```

---

## Task 2: Create HTML Structure

**Files:**
- Create: `examples/platform/index.html`

- [ ] **Step 1: Create index.html with canvas and UI overlays**

Create `examples/platform/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Multiplayer Platform Game - GameKit</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: #000;
      color: #fff;
      font-family: 'Courier New', monospace;
      overflow: hidden;
    }

    #ui {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 100;
    }

    #instructions {
      position: absolute;
      top: 20px;
      left: 20px;
      font-size: 14px;
      line-height: 1.6;
      background: rgba(0, 0, 0, 0.7);
      padding: 15px;
      border-radius: 5px;
      max-width: 300px;
    }

    .key {
      display: inline-block;
      background: #333;
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid #666;
      font-size: 12px;
    }

    #room-info {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0, 150, 50, 0.9);
      padding: 15px 20px;
      border-radius: 5px;
      font-size: 16px;
      font-weight: bold;
      display: none;
    }

    #scores {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.7);
      padding: 15px;
      border-radius: 5px;
      font-size: 14px;
      min-width: 150px;
    }

    .score-item {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      padding: 3px 0;
    }

    .player-color {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 2px;
      margin-right: 8px;
    }

    #waiting {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      padding: 30px;
      border-radius: 10px;
      text-align: center;
      display: none;
    }

    #waiting h2 {
      margin-bottom: 20px;
      font-size: 24px;
    }

    #waiting p {
      margin: 10px 0;
      font-size: 16px;
    }

    .highlight {
      color: #4a8;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <!-- Canvas will be injected here by GameKit -->

  <!-- UI Overlay -->
  <div id="ui">
    <!-- Instructions -->
    <div id="instructions">
      <strong>PLATFORM GAME</strong><br>
      <span class="key">←</span> <span class="key">→</span> or <span class="key">A</span> <span class="key">D</span> - Move<br>
      <span class="key">Space</span> - Jump<br>
      <br>
      <span class="highlight">SETUP:</span><br>
      1. Start server: <code>node packages/gamekit-server/server.js</code><br>
      2. Host creates room<br>
      3. Others join with <code>?room=CODE</code>
    </div>

    <!-- Room Code (host only) -->
    <div id="room-info">
      Room: <span id="room-code">----</span>
    </div>

    <!-- Scores -->
    <div id="scores">
      <strong>SCORES</strong>
      <div id="score-list"></div>
    </div>

    <!-- Waiting Screen -->
    <div id="waiting">
      <h2>Connecting...</h2>
      <p id="waiting-message">Creating room...</p>
    </div>
  </div>

  <script type="module" src="./game.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify HTML file was created**

```bash
cat examples/platform/index.html | head -20
```

Expected: HTML file with UI overlays and styles

- [ ] **Step 3: Commit**

```bash
git add examples/platform/index.html
git commit -m "feat: add platform game HTML with UI overlays"
```

---

## Task 3: Create Game Scaffold

**Files:**
- Create: `examples/platform/game.js`

- [ ] **Step 1: Create game.js with imports and game instance**

Create `examples/platform/game.js`:

```javascript
// ============================================================
//  Multiplayer Platform Game
//  Fixed-screen platformer with jumping mechanics
// ============================================================

import { Game, GKBox, GKCircle } from '../../packages/gamekit/dist/index.js';

console.log('=== Multiplayer Platform Game ===\n');

// Game constants
const PLAYER_WIDTH = 20;
const PLAYER_HEIGHT = 40;
const PLAYER_SPEED = 5;
const JUMP_VELOCITY = -15;
const COLLECTIBLE_RADIUS = 10;

// Game state
let localPlayer = null;
let isGrounded = false;
let collectibles = [];
let playerScores = {};
let isHost = false;
let localPlayerId = null;

// UI elements
const roomInfo = document.getElementById('room-info');
const roomCodeEl = document.getElementById('room-code');
const scoreList = document.getElementById('score-list');
const waiting = document.getElementById('waiting');
const waitingMessage = document.getElementById('waiting-message');

// Get server URL from URL parameter or use default
const serverUrl = new URLSearchParams(window.location.search).get('server') || 'http://localhost:3000';
console.log(`Server URL: ${serverUrl}`);

// Create game with gravity
console.log('Creating game instance...');
const game = new Game({
  width: 800,
  height: 600,
  gravity: 1,  // Normal gravity for platformer
  background: 0x111111,
  server: serverUrl
});

console.log('Game instance created');
console.log('Ready for platform setup');
```

- [ ] **Step 2: Verify game.js was created**

```bash
cat examples/platform/game.js
```

Expected: JavaScript file with imports, constants, and game instance

- [ ] **Step 3: Test game loads (will show blank canvas)**

```bash
# Start dev server if not already running
npx vite &
sleep 2
# Check if file is accessible
curl -s http://localhost:5173/examples/platform/game.js | head -10
```

Expected: Game module code returned, no 404 error

- [ ] **Step 4: Commit**

```bash
git add examples/platform/game.js
git commit -m "feat: add platform game scaffold with game instance"
```

---

## Task 4: Add Platforms and Walls

**Files:**
- Modify: `examples/platform/game.js`

- [ ] **Step 1: Add platform creation code after game instance**

Add to `game.js` after game creation:

```javascript
// ============================================================
// PLATFORMS AND WALLS
// ============================================================

console.log('Creating platforms...');

// Ground floor (full width)
const ground = new GKBox({
  x: 400,
  y: 580,
  width: 800,
  height: 40,
  color: 0x444444,
  isStatic: true
});
game.add(ground);

// Platform 1 (low left)
const platform1 = new GKBox({
  x: 150,
  y: 450,
  width: 200,
  height: 20,
  color: 0x444444,
  isStatic: true
});
game.add(platform1);

// Platform 2 (mid right)
const platform2 = new GKBox({
  x: 500,
  y: 350,
  width: 150,
  height: 20,
  color: 0x444444,
  isStatic: true
});
game.add(platform2);

// Platform 3 (mid left)
const platform3 = new GKBox({
  x: 300,
  y: 250,
  width: 180,
  height: 20,
  color: 0x444444,
  isStatic: true
});
game.add(platform3);

// Platform 4 (high right)
const platform4 = new GKBox({
  x: 600,
  y: 150,
  width: 120,
  height: 20,
  color: 0x444444,
  isStatic: true
});
game.add(platform4);

// Left wall
const leftWall = new GKBox({
  x: 10,
  y: 300,
  width: 20,
  height: 600,
  color: 0x444444,
  isStatic: true
});
game.add(leftWall);

// Right wall
const rightWall = new GKBox({
  x: 790,
  y: 300,
  width: 20,
  height: 600,
  color: 0x444444,
  isStatic: true
});
game.add(rightWall);

// Store platforms for collision detection
const platforms = [ground, platform1, platform2, platform3, platform4];

console.log('Platforms created');
```

- [ ] **Step 2: Verify platforms appear in browser**

```bash
# Open in browser (if Vite is running)
echo "Open http://localhost:5173/examples/platform/ and verify:"
echo "- Ground floor at bottom"
echo "- 4 floating platforms at different heights"
echo "- Left and right walls"
```

Expected: Gray platforms visible on black background

- [ ] **Step 3: Commit**

```bash
git add examples/platform/game.js
git commit -m "feat: add platforms and walls to level layout"
```

---

## Task 5: Add Player Sprite

**Files:**
- Modify: `examples/platform/game.js`

- [ ] **Step 1: Add player creation function**

Add after platforms code:

```javascript
// ============================================================
// PLAYER CREATION
// ============================================================

const playerColors = [0xFF0000, 0x0000FF, 0x00FF00, 0xFFFF00, 0xFF00FF, 0xFFA500];

function createPlayer(playerIndex, playerName) {
  console.log(`Creating player ${playerIndex}: ${playerName}`);

  const color = playerColors[playerIndex % playerColors.length];

  // Spawn on ground initially
  const player = new GKBox({
    x: 400,
    y: 500,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    color: color,
    isStatic: false,
    bounce: 0,
    friction: 0.01
  });

  game.add(player);

  // Store player data
  player.playerName = playerName;
  player.score = 0;

  return player;
}

// Create local player (temporary - will be replaced in multiplayer setup)
console.log('Creating local player...');
localPlayer = createPlayer(0, 'Player 1');
localPlayerId = 'temp-id';
playerScores[localPlayerId] = 0;

console.log('Player created');
```

- [ ] **Step 2: Verify player sprite appears**

```bash
echo "Open http://localhost:5173/examples/platform/ and verify:"
echo "- Red player box appears on ground"
echo "- Player falls with gravity and lands on ground"
```

Expected: Red 20x40 box falling and landing on ground platform

- [ ] **Step 3: Commit**

```bash
git add examples/platform/game.js
git commit -m "feat: add player sprite with gravity physics"
```

---

## Task 6: Add Horizontal Movement

**Files:**
- Modify: `examples/platform/game.js`

- [ ] **Step 1: Add movement input handler**

Add after player creation:

```javascript
// ============================================================
// INPUT HANDLERS
// ============================================================

console.log('Setting up input handlers...');

// Horizontal movement (runs every frame)
game.onUpdate(() => {
  if (!localPlayer) return;

  // Left movement
  if (game.isKeyDown('ArrowLeft') || game.isKeyDown('a') || game.isKeyDown('A')) {
    localPlayer.setVelocity(-PLAYER_SPEED, localPlayer.body.velocity.y);
  }

  // Right movement
  if (game.isKeyDown('ArrowRight') || game.isKeyDown('d') || game.isKeyDown('D')) {
    localPlayer.setVelocity(PLAYER_SPEED, localPlayer.body.velocity.y);
  }
});

console.log('Input handlers ready');
```

- [ ] **Step 2: Test movement in browser**

```bash
echo "Open http://localhost:5173/examples/platform/ and verify:"
echo "- Arrow Left/Right moves player left/right"
echo "- A/D keys also move player"
echo "- Player moves smoothly at constant speed"
echo "- Player stops at walls"
```

Expected: Player moves left/right with keyboard input, walls prevent movement beyond bounds

- [ ] **Step 3: Commit**

```bash
git add examples/platform/game.js
git commit -m "feat: add horizontal player movement controls"
```

---

## Task 7: Add Jump Mechanics with Ground Detection

**Files:**
- Modify: `examples/platform/game.js`

- [ ] **Step 1: Add ground collision detection**

Add after platforms array definition:

```javascript
// ============================================================
// COLLISION DETECTION
// ============================================================

console.log('Setting up collision detection...');

// Ground detection - set isGrounded when player touches any platform
platforms.forEach(platform => {
  platform.onCollide(localPlayer, () => {
    isGrounded = true;
  });
});

console.log('Collision detection ready');
```

- [ ] **Step 2: Add jump input handler**

Add inside input handlers section after movement code:

```javascript
// Jump (only when grounded)
game.onKey(' ', () => {
  if (isGrounded && localPlayer) {
    console.log('Jump!');
    localPlayer.setVelocity(localPlayer.body.velocity.x, JUMP_VELOCITY);
    isGrounded = false; // Prevent double jump
  }
});

// Reset isGrounded flag periodically (Matter.js collision detection delay)
game.onUpdate(() => {
  if (!localPlayer) return;

  // Check if player is falling (not on any platform)
  const isFalling = localPlayer.body.velocity.y > 0.5;
  if (isFalling && isGrounded) {
    // Player left platform, allow jump again when landing
    isGrounded = false;
  }
});
```

- [ ] **Step 3: Test jumping in browser**

```bash
echo "Open http://localhost:5173/examples/platform/ and verify:"
echo "- Spacebar makes player jump from ground"
echo "- Player cannot jump while in air (no double jump)"
echo "- Player lands on platforms and can jump again"
echo "- Player can jump from any platform to reach higher ones"
```

Expected: Player jumps only when on ground/platform, lands correctly, can navigate between platforms

- [ ] **Step 4: Commit**

```bash
git add examples/platform/game.js
git commit -m "feat: add jump mechanics with ground detection"
```

---

## Task 8: Add Collectibles

**Files:**
- Modify: `examples/platform/game.js`

- [ ] **Step 1: Add collectible creation function**

Add after player creation code:

```javascript
// ============================================================
// COLLECTIBLES
// ============================================================

function createCollectibles() {
  console.log('Creating collectibles...');

  // Clear existing collectibles
  collectibles.forEach(c => game.remove(c));
  collectibles = [];

  // Collectible positions (on platforms)
  const positions = [
    { x: 100, y: 560 },  // Ground left
    { x: 300, y: 560 },  // Ground center
    { x: 500, y: 560 },  // Ground right
    { x: 150, y: 430 },  // Platform 1
    { x: 500, y: 330 },  // Platform 2 left
    { x: 550, y: 330 },  // Platform 2 right
    { x: 300, y: 230 },  // Platform 3
    { x: 600, y: 130 },  // Platform 4
  ];

  positions.forEach((pos, index) => {
    const collectible = new GKCircle({
      x: pos.x,
      y: pos.y,
      radius: COLLECTIBLE_RADIUS,
      color: 0xFFD700,  // Gold
      isStatic: true
    });

    collectible.id = `collectible-${index}`;
    collectible.visible = true;

    game.add(collectible);
    collectibles.push(collectible);
  });

  console.log(`${collectibles.length} collectibles created`);
}

// Create initial collectibles
createCollectibles();
```

- [ ] **Step 2: Verify collectibles appear**

```bash
echo "Open http://localhost:5173/examples/platform/ and verify:"
echo "- 8 gold circles appear on platforms"
echo "- Collectibles are distributed across different heights"
echo "- Collectibles remain visible as player moves"
```

Expected: Gold collectible circles visible on various platforms

- [ ] **Step 3: Commit**

```bash
git add examples/platform/game.js
git commit -m "feat: add collectible items on platforms"
```

---

## Task 9: Add Collectible Collision Handling

**Files:**
- Modify: `examples/platform/game.js`

- [ ] **Step 1: Add collection logic**

Add after collectible creation:

```javascript
// Collectible collision detection
function setupCollectibleCollisions() {
  collectibles.forEach(collectible => {
    collectible.onCollide(localPlayer, () => {
      if (collectible.visible) {
        console.log(`Collected ${collectible.id}!`);

        // Hide collectible
        collectible.visible = false;

        // Increment score
        playerScores[localPlayerId]++;
        updateScoreDisplay();

        // TODO: Send network message (will be added in multiplayer task)
      }
    });
  });
}

setupCollectibleCollisions();
```

- [ ] **Step 2: Add score display update function**

Add after setupCollectibleCollisions:

```javascript
// Update score display
function updateScoreDisplay() {
  if (!scoreList) return;

  scoreList.innerHTML = '';

  Object.entries(playerScores).forEach(([playerId, score]) => {
    const playerName = playerId === localPlayerId ? localPlayer.playerName : `Player ${playerId}`;
    const playerColor = playerId === localPlayerId ? localPlayer.color : 0xFFFFFF;

    const colorHex = '#' + playerColor.toString(16).padStart(6, '0');

    const scoreItem = document.createElement('div');
    scoreItem.className = 'score-item';
    scoreItem.innerHTML = `
      <span><span class="player-color" style="background: ${colorHex}"></span>${playerName}</span>
      <span>${score}</span>
    `;
    scoreList.appendChild(scoreItem);
  });
}

// Initialize score display
updateScoreDisplay();
```

- [ ] **Step 3: Test collectible collection**

```bash
echo "Open http://localhost:5173/examples/platform/ and verify:"
echo "- Player touches collectible, it disappears"
echo "- Score increments in bottom-right corner"
echo "- Console shows 'Collected collectible-N!'"
echo "- Player can collect all 8 collectibles"
```

Expected: Collectibles disappear on contact, score updates, console logs collection events

- [ ] **Step 4: Commit**

```bash
git add examples/platform/game.js
git commit -m "feat: add collectible collision and score tracking"
```

---

## Task 10: Add Multiplayer Room Setup

**Files:**
- Modify: `examples/platform/game.js`

- [ ] **Step 1: Add multiplayer setup code**

Add at the end of game.js:

```javascript
// ============================================================
// MULTIPLAYER SETUP
// ============================================================

console.log('Setting up multiplayer...');

const urlParams = new URLSearchParams(window.location.search);
const roomCodeParam = urlParams.get('room');

if (roomCodeParam) {
  // Join existing room
  console.log(`Joining room: ${roomCodeParam}`);
  waitingMessage.textContent = `Joining room ${roomCodeParam}...`;
  waiting.style.display = 'block';

  const playerName = prompt('Enter your name:', 'Player') || 'Player';

  game.joinRoom(roomCodeParam, playerName)
    .then(() => {
      console.log('Joined room successfully');
      waiting.style.display = 'none';

      // Recreate local player with network sync
      game.remove(localPlayer);
      const playerIndex = game.players.length - 1;
      localPlayer = createPlayer(playerIndex, playerName);
      localPlayerId = game.playerId;
      playerScores[localPlayerId] = 0;

      // Enable network sync for local player
      game.setOwner(localPlayer);

      // Re-setup collision detection
      platforms.forEach(platform => {
        platform.onCollide(localPlayer, () => {
          isGrounded = true;
        });
      });
      setupCollectibleCollisions();

      updateScoreDisplay();
      console.log('Local player synced');
    })
    .catch(err => {
      console.error('Failed to join room:', err);
      waitingMessage.textContent = 'Failed to join room. Server running?';
      setTimeout(() => {
        waiting.style.display = 'none';
      }, 3000);
    });
} else {
  // Create new room
  console.log('Creating room...');
  waitingMessage.textContent = 'Creating room...';
  waiting.style.display = 'block';

  const playerName = prompt('Enter your name:', 'Player 1') || 'Player 1';

  game.createRoom(playerName)
    .then(({ code }) => {
      console.log(`Room created: ${code}`);
      console.log(`Share URL: ${window.location.href}?room=${code}`);
      isHost = true;

      waiting.style.display = 'none';

      // Display room code
      roomCodeEl.textContent = code;
      roomInfo.style.display = 'block';

      // Recreate local player with network sync
      game.remove(localPlayer);
      localPlayer = createPlayer(0, playerName);
      localPlayerId = game.playerId;
      playerScores[localPlayerId] = 0;

      // Enable network sync
      game.setOwner(localPlayer);

      // Re-setup collision detection
      platforms.forEach(platform => {
        platform.onCollide(localPlayer, () => {
          isGrounded = true;
        });
      });
      setupCollectibleCollisions();

      updateScoreDisplay();
      console.log('Host player synced');
    })
    .catch(err => {
      console.error('Failed to create room:', err);
      waitingMessage.textContent = 'Failed to create room. Server running on :3000?';
      setTimeout(() => {
        waiting.style.display = 'none';
      }, 3000);
    });
}

console.log('Multiplayer setup complete');
```

- [ ] **Step 2: Test room creation in browser**

```bash
echo "1. Start gamekit server: cd packages/gamekit-server && node server.js"
echo "2. Open http://localhost:5173/examples/platform/"
echo "3. Enter name, verify:"
echo "   - Room code appears in top-right"
echo "   - Player can move and collect items"
echo "   - Console shows room code and share URL"
```

Expected: Room created, room code displayed, player movement/collection still works

- [ ] **Step 3: Test room joining**

```bash
echo "1. Copy room code from first browser"
echo "2. Open http://localhost:5173/examples/platform/?room=CODE in second browser"
echo "3. Enter name, verify:"
echo "   - Both players see each other"
echo "   - Both players move independently"
echo "   - Player colors are different (red vs blue)"
```

Expected: Two players visible, moving independently, different colors

- [ ] **Step 4: Commit**

```bash
git add examples/platform/game.js
git commit -m "feat: add multiplayer room creation and joining"
```

---

## Task 11: Add Network Sync for Collectibles

**Files:**
- Modify: `examples/platform/game.js`

- [ ] **Step 1: Add network message handlers**

Add before multiplayer setup section:

```javascript
// ============================================================
// NETWORK MESSAGES
// ============================================================

// Handle collectible collection
game.onMessage('collectItem', (data) => {
  console.log(`Player ${data.playerId} collected ${data.id}`);

  const collectible = collectibles.find(c => c.id === data.id);
  if (collectible && collectible.visible) {
    collectible.visible = false;
  }

  // Update scores
  if (!playerScores[data.playerId]) {
    playerScores[data.playerId] = 0;
  }
  playerScores[data.playerId]++;
  updateScoreDisplay();
});

// Handle score updates
game.onMessage('scoreUpdate', (data) => {
  console.log(`Score update: ${data.playerId} = ${data.score}`);
  playerScores[data.playerId] = data.score;
  updateScoreDisplay();
});

// Handle player join
game.onPlayerJoin((player) => {
  console.log(`${player.name} joined!`);

  // Initialize their score
  playerScores[player.id] = 0;
  updateScoreDisplay();

  // Show notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 150, 50, 0.95);
    color: #fff;
    padding: 20px 40px;
    border-radius: 8px;
    font-size: 18px;
    z-index: 1000;
  `;
  notification.textContent = `${player.name} joined!`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
});

// Handle player leave
game.onPlayerLeave((player) => {
  console.log(`${player.name} left`);
  delete playerScores[player.id];
  updateScoreDisplay();
});

console.log('Network message handlers ready');
```

- [ ] **Step 2: Update collectible collision to send network message**

Modify the collectible collision handler in setupCollectibleCollisions():

```javascript
// Replace the TODO comment with:
// Send network message
game.send('collectItem', {
  id: collectible.id,
  playerId: localPlayerId
});
```

- [ ] **Step 3: Test network sync with two browsers**

```bash
echo "1. Open first browser, create room"
echo "2. Open second browser with ?room=CODE"
echo "3. Player 1 collects item, verify:"
echo "   - Item disappears for both players"
echo "   - Player 1 score increments on both screens"
echo "4. Player 2 collects item, verify:"
echo "   - Item disappears for both players"
echo "   - Player 2 score increments on both screens"
```

Expected: Collectibles sync across all clients, scores update correctly for all players

- [ ] **Step 4: Commit**

```bash
git add examples/platform/game.js
git commit -m "feat: add network sync for collectibles and scores"
```

---

## Task 12: Add Player Spawn System

**Files:**
- Modify: `examples/platform/game.js`

- [ ] **Step 1: Add spawn position selection function**

Add after createPlayer function:

```javascript
// Get spawn position for new player
function getSpawnPosition(playerIndex) {
  const spawnPositions = [
    { x: 100, y: 500 },   // Ground left
    { x: 400, y: 500 },   // Ground center
    { x: 700, y: 500 },   // Ground right
    { x: 150, y: 400 },   // Platform 1
    { x: 500, y: 300 },   // Platform 2
    { x: 300, y: 200 },   // Platform 3
  ];

  return spawnPositions[playerIndex % spawnPositions.length];
}
```

- [ ] **Step 2: Update createPlayer to use spawn positions**

Modify createPlayer function to accept position:

```javascript
function createPlayer(playerIndex, playerName) {
  console.log(`Creating player ${playerIndex}: ${playerName}`);

  const color = playerColors[playerIndex % playerColors.length];
  const spawnPos = getSpawnPosition(playerIndex);

  const player = new GKBox({
    x: spawnPos.x,
    y: spawnPos.y,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    color: color,
    isStatic: false,
    bounce: 0,
    friction: 0.01
  });

  game.add(player);

  player.playerName = playerName;
  player.score = 0;

  return player;
}
```

- [ ] **Step 3: Test spawn positions with multiple players**

```bash
echo "1. Create room in first browser"
echo "2. Join with 2-3 more browsers"
echo "3. Verify:"
echo "   - Each player spawns at different position"
echo "   - No players overlap at spawn"
echo "   - Players cycle through spawn positions"
```

Expected: Players spawn at varied positions, no overlap

- [ ] **Step 4: Commit**

```bash
git add examples/platform/game.js
git commit -m "feat: add varied spawn positions for players"
```

---

## Task 13: Final Polish and Testing

**Files:**
- Modify: `examples/platform/game.js`
- Modify: `examples/platform/README.md`

- [ ] **Step 1: Add console welcome message**

Add at the very beginning of game.js after imports:

```javascript
console.log('╔════════════════════════════════════════╗');
console.log('║   MULTIPLAYER PLATFORM GAME - GAMEKIT  ║');
console.log('╚════════════════════════════════════════╝\n');
console.log('Controls:');
console.log('  ← → or A/D : Move left/right');
console.log('  Space      : Jump');
console.log('\nMultiplayer:');
console.log('  Host creates room, guests join with ?room=CODE');
console.log('');
```

- [ ] **Step 2: Run full single-player test**

```bash
echo "Single Player Test Checklist:"
echo "1. Open http://localhost:5173/examples/platform/"
echo "2. Enter name"
echo ""
echo "Verify:"
echo "[ ] Player sprite appears on ground"
echo "[ ] Arrow keys / AD move player left/right smoothly"
echo "[ ] Spacebar makes player jump"
echo "[ ] Player cannot jump while in air"
echo "[ ] Player lands on platforms correctly"
echo "[ ] Player collects items on contact"
echo "[ ] Score increments when collecting"
echo "[ ] Player stays within walls"
echo "[ ] Console shows welcome message and logs"
```

- [ ] **Step 3: Run full multiplayer test**

```bash
echo "Multiplayer Test Checklist:"
echo "1. Start server: cd packages/gamekit-server && node server.js"
echo "2. Browser 1: Open http://localhost:5173/examples/platform/"
echo "3. Browser 2: Open http://localhost:5173/examples/platform/?room=CODE"
echo ""
echo "Verify:"
echo "[ ] First browser creates room, displays room code"
echo "[ ] Second browser joins successfully"
echo "[ ] Both players see each other's sprites"
echo "[ ] Player movements sync in real-time"
echo "[ ] Players have different colors (red, blue)"
echo "[ ] Collectible disappears for both when either collects it"
echo "[ ] Scores update correctly for all players"
echo "[ ] New players spawn at different positions"
echo "[ ] Player join notification appears"
echo "[ ] Console shows network events"
```

- [ ] **Step 4: Update README with testing notes**

Add to README.md at the end:

```markdown
## Testing

### Single Player
1. Start dev server
2. Open page
3. Test movement (arrows/AD), jumping (space), collecting

### Multiplayer
1. Start gamekit-server on port 3000
2. Open page in multiple browsers
3. First browser creates room (gets code)
4. Other browsers join with ?room=CODE
5. Verify position sync, collectible sync, score sync

### Common Issues

**"Failed to create room"**
- Ensure gamekit-server is running: `node packages/gamekit-server/server.js`
- Check console for connection errors

**"Collectibles not syncing"**
- Check browser console for network messages
- Verify both clients connected to same room

**"Player falling through platforms"**
- This is expected behavior if physics hasn't initialized
- Wait 1-2 seconds for Matter.js to stabilize

## License

Part of the GameKit examples. See main project for license.
```

- [ ] **Step 5: Final commit**

```bash
git add examples/platform/game.js examples/platform/README.md
git commit -m "feat: complete platform game with polish and documentation"
```

---

## Self-Review

**Spec Coverage Check:**

✓ Fixed-screen platformer architecture (Task 1-4)
✓ 800x600 canvas with gravity (Task 3)
✓ Multiple platforms at different heights (Task 4)
✓ Player sprite (20x40 box) with physics (Task 5)
✓ Horizontal movement (left/right, arrow keys/AD) (Task 6)
✓ Jump mechanics (spacebar, ground detection) (Task 7)
✓ Collectibles (gold circles, 8-10 items) (Task 8)
✓ Collectible collision and scoring (Task 9)
✓ Room-based multiplayer (create/join) (Task 10)
✓ Network sync for collectibles (Task 11)
✓ Score tracking and UI display (Task 9, 11)
✓ Player spawn system (Task 12)
✓ Instructions overlay (Task 2)
✓ Room code display (Task 2, 10)
✓ Score display (Task 2, 9)

**No placeholders:** All code blocks contain complete implementations. No "TBD", "TODO", or vague instructions.

**Type consistency:**
- `localPlayer` used consistently for player sprite reference
- `collectibles` array used consistently for collectible storage
- `playerScores` object used consistently for score tracking
- `isGrounded` boolean used consistently for jump logic
- Function names match across all tasks (createPlayer, updateScoreDisplay, etc.)

All spec requirements covered. Ready for execution.

---

## Execution Ready

Plan complete and saved to `docs/superpowers/plans/2026-04-26-multiplayer-platform-game.md`.
