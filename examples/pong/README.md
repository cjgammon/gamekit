# GameKit Pong - Multiplayer Example

A multiplayer Pong game demonstrating GameKit's real-time networking capabilities.

## Quick Start (One Command)

```bash
cd examples/pong
npm run dev
```

This starts BOTH:
- **Client** on http://localhost:5173 (Vite dev server)
- **Server** on http://localhost:3000 (GameKit server)

---

## Testing Multiplayer

### Quick Test (2 minutes)
See **[TEST-QUICK.md](./TEST-QUICK.md)** for a simple checklist

### Detailed Guide
See **[MULTIPLAYER-TEST.md](./MULTIPLAYER-TEST.md)** for complete walkthrough with expected console logs

### TL;DR - Does it work?

1. Run `npm run dev`
2. Open http://localhost:5173 → creates room, note code
3. Open http://localhost:5173?room=CODE in another browser → joins
4. Both consoles show "Receiving sprite updates" = **working!** ✅

---

## How to Play

### Controls
- **Arrow Keys** or **W/S** - Move paddle up/down
- **Space** - Launch ball
- **R** - Reset ball position
- **Click** - Teleport paddle to mouse Y

### Single Player
1. Open http://localhost:5173
2. Use controls to play solo

### Multiplayer

**Player 1 (Host):**
1. Open http://localhost:5173
2. Enter your name (e.g., "Alice")
3. Green box shows room code (e.g., "ABCD")
4. Share code with Player 2

**Player 2 (Guest):**
1. Get room code from Player 1
2. Open http://localhost:5173?room=ABCD
3. Enter your name (e.g., "Bob")
4. See "Player 2 joined!" notification

Both players control paddles in real-time!

---

## What's Working (Stage 7)

✅ **Network Infrastructure:**
- Room creation with 4-letter codes
- Room joining with validation
- Player join/leave events
- WebSocket connection (Socket.io)

✅ **Data Transmission:**
- Sprite position sync (20Hz)
- Custom messages between players
- Score updates

✅ **Console Logs:**
- Clear success/failure messages
- Connection status
- Sprite sync confirmation
- Player events

❌ **Not Yet Implemented (Coming in Stage 8):**
- Visual rendering of remote player sprites
- Proper two-paddle Pong layout
- Score UI on screen
- Win conditions
- Game states

**The network is working** - you just can't SEE other player's paddles yet because rendering remote sprites comes in Stage 8. Check the console logs to verify data is flowing!

---

## Console Log Quick Reference

### Success States

**Server Started:**
```
GameKit Server listening on port 3000
```

**Host Created Room:**
```
✅ [Network] ROOM CREATED SUCCESSFULLY!
✅ [Network] Room Code: ABCD
📡 [Network] Sprite sync started (20Hz) - syncing 2 sprite(s)
```

**Guest Joined:**
```
✅ [Network] JOINED ROOM SUCCESSFULLY!
✅ [Network] Players in room: Player 1, Player 2
👋 [Network] Player joined: Player 2
```

**Sync Working:**
```
📡 [Network] Receiving sprite updates from other players
```

---

## Troubleshooting

**"Connection error"**
- Server not running → Run `npm run dev`

**"Failed to join room"**
- Wrong code or room doesn't exist
- Host must create room first

**"Can't see other player"**
- This is expected! Visual rendering comes in Stage 8
- Check console for "Receiving sprite updates" to verify it's working

**Port already in use**
```bash
lsof -i :3000  # Check what's using port 3000
kill -9 <PID>  # Kill the process
npm run dev    # Restart
```

---

## Architecture

**Client → Server → Client:**
1. Client sends sprite positions every 50ms
2. Server broadcasts to all players in room
3. Clients receive updates (Stage 8 will render them)

**Ownership Model:**
- Host owns ball physics (authoritative)
- Each player owns their paddle
- Only owned sprites sync over network

---

## Next Steps

**Stage 8** will add:
- Remote sprite rendering (you'll SEE other players!)
- Proper Pong layout (left/right paddles)
- Score UI on screen
- Win condition (first to 11)
- Game state management

For now, check the console logs to verify multiplayer is working!
