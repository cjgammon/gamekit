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
