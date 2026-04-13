# Multiplayer Pong - Complete GameKit Demo

A full two-player competitive Pong game demonstrating all GameKit features from Stages 1-8.

## Features

✅ **Complete Gameplay**
- Two-player competitive Pong (left vs right paddles)
- Real-time multiplayer over network
- Score tracking with first to 11 wins
- Automatic game start when both players join
- Ball respawn after each point

✅ **All GameKit Systems**
- **Rendering** (PixiJS) - Hardware-accelerated graphics
- **Physics** (Matter.js) - Ball movement and collisions
- **Input** - Keyboard controls (Arrow keys or W/S)
- **Collision Detection** - Ball bounces off paddles and walls
- **Networking** (Socket.io) - Room-based multiplayer
- **Remote Sprite Rendering** - See other player's paddle in real-time

✅ **Professional UI**
- Waiting room with room code display
- Live score display during gameplay
- Game over screen with winner
- Visual feedback and instructions

## Quick Start

```bash
cd examples/pong
npm run dev
```

This starts both client (http://localhost:5173) and server (port 3000).

### Easy Testing Mode (Default)

**Just open http://localhost:5173 in multiple tabs/windows!**

How it works:
1. **First tab** → Creates a room, saves code to localStorage
2. **Second tab** → Reads code from localStorage, joins automatically
3. Game starts!

Features:
- ✅ No manual room codes needed
- ✅ Auto-assigns names ("Player 1", "Player 2")
- ✅ All tabs on same machine join same room
- ✅ Perfect for rapid development testing

To reset the test room:
```javascript
// In browser console:
localStorage.clear()
// Then refresh all tabs
```

### Production Mode (Custom Rooms)

To create a unique room with a random code:
1. First browser: http://localhost:5173?room=new
2. Second browser: http://localhost:5173?room=ABCD (use the code from first browser)

## How to Play

### Player 1 (Host)
1. Open http://localhost:5173
2. Enter your name
3. Share the room code with Player 2
4. Wait for Player 2 to join
5. Game starts automatically after 2 seconds!

### Player 2 (Guest)
1. Get room code from Player 1
2. Open http://localhost:5173?room=CODE
3. Enter your name
4. Game starts automatically!

### Controls
- **Arrow Keys** or **W/S** - Move paddle up/down
- First to 11 points wins!

## What You Should See

**Player 1 (Host) - Left Side:**
- ✅ WHITE paddle on left (yours - you control it)
- ✅ ORANGE paddle on right (Player 2's - synced from network)
- ✅ White ball bouncing around

**Player 2 (Guest) - Right Side:**
- ✅ WHITE paddle on right (yours - you control it)
- ✅ ORANGE paddle on left (Player 1's - synced from network)
- ✅ Gray ball (position synced from host)

**Console Logs (Both Players):**
```
✅ [Network] ROOM CREATED SUCCESSFULLY! (or JOINED)
📡 [Network] Sprite sync started (20Hz)
📡 Received sprite sync from <playerId>: 1 sprites
📡 Creating remote sprite: <playerId>:<syncId>
  → Creating remote paddle
👋 <Player> joined!
🎮 Game starting!
```

## Architecture

**Host-Authoritative Design:**
- **Host** controls ball physics and scoring (prevents cheating)
- **Guest** receives ball position updates from host
- Both players control their own paddles
- All sprite positions synced at 20Hz (50ms intervals)

**Network Flow:**
1. Host creates room → generates 4-letter code
2. Guest joins with code → both connect via WebSocket
3. Host owns ball + left paddle → syncs to guest
4. Guest owns right paddle → syncs to host
5. Both see remote sprites rendered in real-time
6. Host detects scoring → broadcasts to guest
7. First to 11 wins!

## Testing Checklist

Open two browsers (or two different devices on same network):

- [ ] Player 1 creates room, sees room code on screen
- [ ] Player 2 joins with `?room=CODE`
- [ ] Both players see waiting room
- [ ] Game starts automatically after 2 seconds
- [ ] **Both players see ORANGE paddle from other player** ⭐
- [ ] Ball moves and bounces correctly
- [ ] Paddles respond smoothly to arrow keys/WS
- [ ] Ball bounces off paddles and walls
- [ ] Score increments when ball goes off sides
- [ ] Ball respawns at center after each point
- [ ] Game ends when player reaches 11 points
- [ ] Winner displayed on game over screen

## Troubleshooting

**"Can't see the orange paddle"**
- Check browser console for "📡 Creating remote sprite" messages
- Verify both players are in the same room (check room code)
- Make sure server is running (`npm run dev` starts it automatically)
- Try refreshing both browsers

**"Ball not moving"**
- Only host controls ball physics
- Guest sees ball position synced from host
- Wait a few seconds after game starts for ball to launch

**"Score not updating"**
- Only host detects when ball goes off screen
- Guest receives score updates via network messages
- Check console for "📊 Score update received" messages

**"Connection failed"**
- Make sure server is running on port 3000
- Check browser console for connection errors
- Verify `http://localhost:3000` is accessible

## Development Notes

This example demonstrates the complete GameKit development progression:

**Stage 1-2:** Core structure + rendering (sprites appear on screen)
**Stage 3:** Physics system (ball moves with gravity/bounce)
**Stage 4:** Collision detection (ball bounces off paddles)
**Stage 5:** Input system (paddle controls with keyboard)
**Stage 6:** Game loop (already implemented in earlier stages)
**Stage 7:** Network infrastructure (rooms, sprite sync data transmission)
**Stage 8:** Remote sprite rendering + complete game (what you see NOW!)

The key innovation in Stage 8 is `game.onSpriteSync()` which receives sprite positions from other players and renders them as "remote sprites" (the orange paddles you see).

## Customization Ideas

Want to extend this game? Try:

- Change winning score: `const WINNING_SCORE = 21;`
- Adjust ball speed: `const BALL_SPEED = 15;`
- Add power-ups (make ball faster/slower on collision)
- Add sound effects on collision/scoring
- Change paddle sizes based on score
- Add obstacles in the center
- Support 4 players (top/bottom paddles)

Enjoy building with GameKit! 🎮
