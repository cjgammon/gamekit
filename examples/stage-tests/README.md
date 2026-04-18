# GameKit Stage Tests

Visual regression tests for each stage of GameKit development. Each file tests specific features in isolation to verify nothing breaks as we add new functionality.

## Quick Start

**⚠️ IMPORTANT: Do NOT open HTML files directly** (file:// URLs cause CORS errors with ES modules)

**Use a local server instead:**

```bash
# Option 1: Vite (recommended)
cd examples/stage-tests
npx vite
# Then open http://localhost:5173/

# Option 2: Python
cd examples/stage-tests
python3 -m http.server 8888
# Then open http://localhost:8888/

# Option 3: Any server
cd examples/stage-tests
npx serve -p 3000
# Then open http://localhost:3000/
```

**The index page** (`index.html`) provides a visual directory of all stage tests with descriptions and links.

## Test Files

### Stage 1: Core Architecture
**File:** `stage1-structure.html`

**Tests:**
- ✓ Class instantiation (Game, GKBox, GKCircle)
- ✓ Method signatures exist
- ✓ TypeScript types work
- ✓ Sprites can be added to game
- ✓ All API methods callable

**Expected:** Console logs showing successful creation, no errors

---

### Stage 2: Rendering System
**File:** `stage2-rendering.html`

**Tests:**
- ✓ Canvas appears in browser
- ✓ Sprites render at correct positions
- ✓ Colors display correctly
- ✓ Dynamic position changes work

**Expected:**
- Black canvas filling screen
- White paddle (left), white ball (center)
- 3 colored boxes at top (red, green, blue)
- 3 colored circles at bottom (yellow, cyan, magenta)
- Paddle moves right after 1 second
- Ball moves after 2 seconds

---

### Stage 3: Physics System
**File:** `stage3-physics.html`

**Tests:**
- ✓ Gravity affects dynamic sprites
- ✓ Static sprites stay in place
- ✓ Collisions detected
- ✓ Bounce values work correctly
- ✓ Velocity can be set
- ✓ Automatic physics/render sync

**Expected:**
- Gray floor and walls (static)
- Multiple colored sprites falling with gravity
- Different bounce behaviors
- Cyan ball launches horizontally after 0.5s
- Magenta ball bounces forever (perfect bounce)

---

### Stage 4: Collision System
**File:** `stage4-collisions.html`

**Tests:**
- ✓ onCollide() callback registration
- ✓ Collision detection between sprites
- ✓ Multiple collision pairs working simultaneously
- ✓ Ball-floor, ball-ball, ball-wall collisions
- ✓ Score tracking with collision counts

**Expected:**
- Multiple sprites falling and colliding
- Console logs show collision events with emojis
- Score counter increments with each collision
- Red ball hits floor repeatedly
- Green and blue boxes collide with each other
- Cyan ball hits walls after launching
- Magenta ball bounces forever, hitting walls

---

### Stage 5: Input System
**File:** `stage5-input.html`

**Tests:**
- ✓ game.isKeyDown() for smooth movement (held keys)
- ✓ game.onKey() for discrete actions (key press events)
- ✓ game.onTap() for mouse/touch input with coordinates
- ✓ Keyboard-controlled paddle movement
- ✓ Multiple key bindings (Arrow keys + WASD)

**Expected:**
- White paddle responds smoothly to arrow keys or W/S
- Space launches ball (one time)
- R key resets ball position
- Clicking moves paddle to mouse Y position
- Console shows input events
- Previous physics and collision features still work

---

### Stage 7: Multiplayer Network
**File:** `stage7-multiplayer.html`

**Tests:**
- ✓ game.createRoom() creates multiplayer room
- ✓ game.joinRoom() joins existing room with code
- ✓ Automatic sprite synchronization (20Hz)
- ✓ game.setOwner() marks sprites for network sync
- ✓ game.onPlayerJoin() / onPlayerLeave() fire
- ✓ game.send() and game.onMessage() for custom messages

**Expected:**
- First player creates room, gets room code
- Second player joins with ?room=CODE parameter
- Both players see each other's paddles move in real-time
- Host controls ball physics, guests see it synced
- Player join notifications appear
- Score updates sent via custom messages
- Console shows network events

**Setup:**
1. Start server: `cd packages/gamekit-server && node server.js`
2. Open page in first browser (creates room)
3. Copy room code from console or screen
4. Open `?room=CODE` in second browser
5. Control paddles in both browsers - see real-time sync!

---

## Purpose

These tests serve as:

1. **Visual regression tests** - Quickly verify earlier features still work
2. **Documentation** - Examples of how to use each feature
3. **Learning progression** - Step-by-step feature introduction
4. **Debugging tool** - Isolate which stage broke when something fails

## Development Workflow

When implementing a new stage:

1. **Update pong example** (`examples/pong/game.js`) with new features
2. **Test the pong example** to verify it works
3. **Copy pong code** into a new `stageN-name.html` test file
4. **Build TypeScript** (`npm run build` in `packages/gamekit`)
5. **Test the stage file** to verify it works standalone

This ensures both the main example and the regression tests stay in sync.

## Adding New Tests

When adding a new stage, create `stageN-name.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GameKit Stage N - Feature Name</title>
</head>
<body>
  <script type="module">
    import { Game, GKBox, GKCircle } from '../../packages/gamekit/dist/index.js';

    // Your test code here
    console.log('=== Stage N Test ===');
    // ...
  </script>
</body>
</html>
```

And update this README with:
- What the stage tests
- Expected visual output
- Expected console output
