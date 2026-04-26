# Multiplayer Platform Game Example - Design

**Date:** 2026-04-26
**Status:** Approved

## Context

This design addresses the need for a multiplayer platform game example that demonstrates gamekit's capabilities for building side-scrolling style games with multiple players. The example will showcase platform collision mechanics, collectible items, and player interactions while following the existing stage test pattern used in the gamekit project.

The user wants a learning-focused example that demonstrates how to build multiplayer games with jumping, platforms, and collectibles—core mechanics for platform-style games. The example should be simple enough for developers to understand and adapt while being complete enough to show real multiplayer gameplay.

## Solution: Fixed-Screen Multiplayer Platformer

### Architecture Overview

**File Location:** `examples/platform/`

This will be a standalone example directory (similar to `examples/pong/`) containing the platform game files. The main game will be in `game.js` with an `index.html` file to run it.

**Core Components:**
- **Game instance:** 800x600 canvas with gravity enabled, connected to gamekit-server on localhost:3000
- **Static environment:** Multiple platform boxes at different heights forming a level layout
- **Dynamic entities:** Player sprites (one per connected player) and collectible items
- **Multiplayer model:** Room-based networking—first player creates room, others join with room code
- **Synchronization:** Player sprites sync automatically via `game.setOwner()`, collectibles sync via custom messages

The design reuses gamekit's existing APIs without requiring engine modifications:
- Physics: gravity, collision detection, velocity (Matter.js)
- Input: `isKeyDown()`, `onKey()` for keyboard controls
- Multiplayer: `createRoom()`, `joinRoom()`, `setOwner()`, `send()`, `onMessage()`

### Game Mechanics

#### Player Movement

Each player controls a character sprite with these mechanics:

**Horizontal Movement:**
- Arrow keys (Left/Right) or A/D keys for movement
- Continuous velocity-based movement (not teleporting)
- Movement speed: 5 pixels/frame
- Physics-based, smooth acceleration/deceleration

**Jumping:**
- Spacebar to jump
- Applies upward velocity (-15 to -20 pixels/frame)
- Only allowed when player is touching ground (platform collision detected)
- Single jump only (no double-jump) for simplicity

**Player Sprite:**
- GKBox: 20px width, 40px height (tall rectangle representing a character)
- Physics enabled: `isStatic: false`
- Unique color per player (red, blue, green, yellow, purple, orange)
- Bounce: 0 (no bouncing on landing)
- Friction: 0.01 (minimal sliding)

**Ground Detection:**
- Track collision events with platform sprites
- Set `isGrounded = true` when colliding with any platform
- Set `isGrounded = false` briefly after jump initiation
- Only enable jump input when `isGrounded === true`

#### Platform Collision

**Platform Design:**
- Static GKBox sprites (won't move with physics)
- Various sizes: 100-300px wide, 20px tall
- Positioned at different Y heights to create level structure
- Color: 0x444444 (gray)

**Level Layout:**
```
Ground floor (Y=580, width=800)
Platform 1 (Y=450, width=200, X=150)
Platform 2 (Y=350, width=150, X=500)
Platform 3 (Y=250, width=180, X=300)
Platform 4 (Y=150, width=120, X=600)
Left wall (X=10, height=600)
Right wall (X=790, height=600)
```

**Collision Behavior:**
- Platforms are always solid (no drop-through mechanics)
- Matter.js handles collision physics automatically
- Players can walk on top, edges create natural fall-off points
- Walls prevent players from leaving play area

#### Collectibles

**Design:**
- GKCircle sprites: 10px radius
- Color: 0xFFD700 (gold)
- Static positioning on platforms
- 8-10 collectibles placed throughout level

**Placement Strategy:**
- Distribute across different platform heights
- At least one per platform to encourage exploration
- Some in challenging positions (platform edges, high platforms)

**Collection Mechanic:**
- Use collision detection: `collectible.onCollide(player, callback)`
- When player touches collectible:
  1. Increment player's score locally
  2. Hide collectible sprite (`collectible.visible = false`)
  3. Send network message: `game.send('collectItem', {id, playerId})`
- All clients listen for 'collectItem' message and hide matching collectible
- Each collectible has unique ID (index or UUID)

**Respawn System:**
- After all collectibles collected, respawn new set
- Randomize positions (within platform bounds)
- Host sends 'respawnCollectibles' message with new positions
- Keep game continuously playable

#### Player Interactions

**Physical Collision:**
- Players have physics bodies, naturally collide with each other
- Matter.js handles collision response (bump, push)
- No special mechanics beyond physics

**Visual Feedback:**
- Each player sprite has name label above (white text)
- Score display in corner showing all player scores
- Color-coded so players can identify themselves

### Implementation Details

#### Player Spawn System

**Initial Spawn:**
- New player spawns at random platform
- Check existing player positions to avoid overlap
- Spawn at platform center, slightly above surface

**Color Assignment:**
```javascript
const colors = [0xFF0000, 0x0000FF, 0x00FF00, 0xFFFF00, 0xFF00FF, 0xFFA500];
const playerColor = colors[playerIndex % colors.length];
```

**Spawn Platforms:**
- Ground floor always safe spawn
- Alternate between platforms 1-3 for variety
- Avoid spawning on highest platform (too advantageous)

#### Network Synchronization

**Player Position Sync:**
- Each player marks their sprite with `game.setOwner(playerSprite)`
- Gamekit automatically syncs position/velocity at 20Hz
- No manual sync code needed for movement

**Collectible Sync:**
```javascript
// Player who collects item sends:
game.send('collectItem', {
  id: collectible.id,
  playerId: localPlayer.id
});

// All clients listen:
game.onMessage('collectItem', (data) => {
  const collectible = collectibles.find(c => c.id === data.id);
  if (collectible) {
    collectible.visible = false;
    // Update score display
  }
});
```

**Score Sync:**
```javascript
// Send score updates periodically or on change:
game.send('scoreUpdate', {
  playerId: localPlayer.id,
  score: localPlayer.score
});

// All clients track scores:
game.onMessage('scoreUpdate', (data) => {
  playerScores[data.playerId] = data.score;
  updateScoreDisplay();
});
```

**Respawn Sync:**
```javascript
// Host only:
if (isHost) {
  game.send('respawnCollectibles', {
    positions: generateCollectiblePositions()
  });
}

// All clients:
game.onMessage('respawnCollectibles', (data) => {
  respawnCollectibles(data.positions);
});
```

#### Visual Design

**Screen Layout:**
```
┌─────────────────────────────────┐
│ Instructions (top-left)          │
│ Room Code (if host, top-left)   │
│                                  │
│         [Platform 4]             │
│                                  │
│    [Platform 3]    ●             │
│                                  │
│              [Platform 2]  ●     │
│                                  │
│  [Platform 1]  ●                 │
│                                  │
│  █  █        █                   │
│ [Ground────────────────────]     │
│                                  │
│ Scores (bottom-right)            │
└─────────────────────────────────┘
```

**UI Elements:**
- **Instructions overlay** (top-left, semi-transparent):
  - Arrow keys / AD = Move
  - Space = Jump
  - Setup steps (server, room code)
- **Room code display** (top-left, green box, host only)
- **Score display** (bottom-right, color-coded):
  ```
  Red: 5
  Blue: 3
  Green: 7
  ```
- **Player name labels** (above each sprite, white text with shadow)

**Color Palette:**
- Background: 0x111111 (very dark gray)
- Platforms: 0x444444 (medium gray)
- Walls: 0x444444 (same as platforms)
- Collectibles: 0xFFD700 (gold)
- Players: cycle through vibrant colors
- Text: white (0xFFFFFF) with drop shadow for readability

#### Code Structure

**File Structure:**
```
examples/platform/
├── index.html          # Main HTML page with canvas and UI
├── game.js            # Main game logic (module)
└── README.md          # Setup and play instructions
```

**game.js structure:**

```javascript
// 1. Imports
import { Game, GKBox, GKCircle } from '../../packages/gamekit/dist/index.js';

// 2. Game creation
const game = new Game({...});

// 3. Environment setup (platforms, walls)

// 4. Player creation (local player sprite)

// 5. Collectibles creation

// 6. Input handlers (movement, jump)

// 7. Collision handlers (ground detection, collectibles)

// 8. Multiplayer setup (createRoom / joinRoom)

// 9. Network message handlers (collectItem, scoreUpdate, etc.)

// 10. Game loop logic (update scores, check respawn)
```

**Key Functions:**
- `createPlatforms()` - Generate level layout
- `createPlayer(color, name)` - Create player sprite
- `createCollectibles()` - Place collectible items
- `handleMovement()` - Process keyboard input
- `handleCollectible(player, collectible)` - Collection logic
- `updateScoreDisplay()` - Refresh UI
- `respawnCollectibles(positions)` - Reset items

### Testing & Verification

**Setup Requirements:**
1. Build gamekit: `cd packages/gamekit && npm run build`
2. Start server: `cd packages/gamekit-server && node server.js`
3. Open example: Navigate to `http://localhost:5173/examples/platform/`

**Single Player Test:**
- Player sprite appears on screen
- Arrow keys / AD move player left/right
- Spacebar makes player jump
- Player cannot jump while in air
- Player collects items on contact
- Score increments when collecting
- Player stays within walls
- Player lands on platforms correctly

**Multiplayer Test:**
- First browser creates room, displays room code
- Second browser joins with `?room=CODE` parameter
- Both players see each other's sprites
- Player movements sync in real-time
- Collectible disappears for both when either collects it
- Scores update for all players
- New players spawn without overlapping existing players
- Player join/leave notifications appear

**Expected Console Output:**
```
=== GameKit Stage 8 Test ===
Testing: Multiplayer platformer mechanics

Creating game with gravity...
Creating platforms...
Creating collectibles...
Creating local player...
Room created: ABC123
Share: http://localhost:5173/...?room=ABC123

Player 2 joined!
Collectible collected! Score: 1
Score update from Player 2: 1
All collectibles collected! Respawning...
```

### Success Criteria

- [ ] Players can move left/right smoothly with keyboard
- [ ] Players can jump when on ground (not in air)
- [ ] Players land on platforms and can walk across them
- [ ] Players collect items on contact
- [ ] Collected items disappear for all players
- [ ] Scores update correctly for all players
- [ ] Multiple players can play simultaneously
- [ ] Player positions sync across clients
- [ ] Room creation and joining works reliably
- [ ] Example is well-commented and educational
- [ ] Code follows stage test pattern conventions

### Future Enhancements (Out of Scope)

These are explicitly NOT included in this learning example but could be added later:

- Moving platforms
- Animated sprites
- Sound effects
- Double-jump mechanic
- Player health/damage
- Enemies or hazards
- Power-ups (speed boost, jump boost)
- Level scrolling (camera system)
- Level editor
- Persistent leaderboard
