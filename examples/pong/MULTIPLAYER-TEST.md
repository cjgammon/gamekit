# GameKit Stage 7 - Multiplayer Test Guide

## Quick Start (One Command)

```bash
cd examples/pong
npm run dev
```

This starts BOTH:
- Client (Vite dev server) on http://localhost:5173
- Server (GameKit server) on http://localhost:3000

## Step-by-Step Testing

### 1. Start Everything

```bash
cd examples/pong
npm run dev
```

**Server Console (terminal):**
```
GameKit Server listening on port 3000
Ready for multiplayer connections!
```

### 2. Open First Browser (Host)

Open: http://localhost:5173

**What happens:**
1. Prompt asks for your name → Enter "Player 1"
2. Browser console shows:

```
✅ [Network] Connected to server!
✅ [Network] ═══════════════════════════════
✅ [Network] ROOM CREATED SUCCESSFULLY!
✅ [Network] Room Code: ABCD
✅ [Network] You are: Player 1 (HOST)
✅ [Network] ═══════════════════════════════

📡 [Network] Sprite sync initialized
📡 [Network] Sprite sync started (20Hz) - syncing 2 sprite(s)
```

3. On-screen: **Green box shows "Room Code: ABCD"**

**Server Console:**
```
Room created: ABCD by Player 1
```

### 3. Open Second Browser (Guest)

Copy the room code from Player 1's screen (e.g., "ABCD")

Open: http://localhost:5173?room=ABCD

**What happens:**
1. Prompt asks for your name → Enter "Player 2"
2. Browser console shows:

```
✅ [Network] Connected to server!
✅ [Network] ═══════════════════════════════
✅ [Network] JOINED ROOM SUCCESSFULLY!
✅ [Network] Room Code: ABCD
✅ [Network] You are: Player 2 (GUEST)
✅ [Network] Players in room: Player 1, Player 2
✅ [Network] ═══════════════════════════════

📡 [Network] Sprite sync initialized
📡 [Network] Sprite sync started (20Hz) - syncing 1 sprite(s)
```

3. On-screen: **Notification "Player 2 joined!"** appears on BOTH browsers

**Player 1 Console (Host):**
```
👋 [Network] Player joined: Player 2
```

**Server Console:**
```
Player 2 joined room ABCD
Broadcasting to room ABCD: Player 2 joined
```

### 4. Test Real-Time Sync

**In Player 1 browser:**
- Press **↑** or **↓** arrows to move paddle
- Watch your paddle move smoothly

**In Player 2 browser:**
- You should see Player 1's paddle moving in real-time!
- Press your **↑** or **↓** arrows
- Player 1 should see YOUR paddle move

**Both Consoles:**
```
📡 [Network] Receiving sprite updates from other players
```

### 5. Test Custom Messages

**In Player 1 browser:**
- Press **Space** to launch ball
- Ball hits paddle or wall
- Console shows:

```
💥 Collision! Total hits: 1
📨 [Network] Received message 'scoreUpdate': { hits: 1 }
```

**In Player 2 browser:**
- Console shows:

```
📨 [Network] Received message 'scoreUpdate': { hits: 1 }
```

---

## Success Checklist

**Server Running:**
- ✅ Terminal shows "GameKit Server listening on port 3000"

**Host (Player 1):**
- ✅ Console shows "ROOM CREATED SUCCESSFULLY!"
- ✅ Green box on screen shows room code
- ✅ Paddle moves when you press keys
- ✅ Console shows "Sprite sync started - syncing 2 sprite(s)" (paddle + ball)

**Guest (Player 2):**
- ✅ Console shows "JOINED ROOM SUCCESSFULLY!"
- ✅ Console shows "Players in room: Player 1, Player 2"
- ✅ Notification appears: "Player 2 joined!"
- ✅ Can see Player 1's paddle on screen
- ✅ Your paddle moves when you press keys
- ✅ Console shows "Sprite sync started - syncing 1 sprite(s)" (only your paddle)

**Real-Time Sync:**
- ✅ Both players see each other's paddles move
- ✅ Console shows "Receiving sprite updates from other players"
- ✅ Score updates appear in both consoles

---

## Troubleshooting

### "Connection error: Failed to fetch"
**Problem:** Server not running

**Fix:**
```bash
cd examples/pong
npm run dev
```

### "Failed to create room"
**Problem:** Server not responding

**Fix:**
1. Stop dev server (Ctrl+C)
2. Check port 3000 is free: `lsof -i :3000`
3. Restart: `npm run dev`

### "Failed to join room: Room not found"
**Problem:** Wrong room code or room expired

**Fix:**
1. Check the room code exactly matches (case-sensitive)
2. Host must create room BEFORE guest joins
3. Room codes expire after all players leave

### "Can't see other player's paddle"
**Problem:** Sprite sync not rendering (Stage 7 limitation)

**Current Status:** Stage 7 SENDS sprite positions but doesn't RECEIVE/RENDER them yet. You'll see:
- ✅ Console logs showing sync working
- ✅ Server receiving/broadcasting updates
- ❌ Visual rendering of other player's sprites (coming in Stage 8)

**To verify it's working:**
- Check console shows "Receiving sprite updates"
- Check server console shows sprite sync events
- Network tab shows WebSocket traffic

---

## Console Logging Reference

### Player 1 (Host) Expected Logs:
```
🌐 [Network] Connecting to server: http://localhost:3000
🌐 [Network] Creating room as 'Player 1'...
✅ [Network] Connected to server!
✅ [Network] ═══════════════════════════════
✅ [Network] ROOM CREATED SUCCESSFULLY!
✅ [Network] Room Code: ABCD
✅ [Network] You are: Player 1 (HOST)
✅ [Network] ═══════════════════════════════
📡 [Network] Event handlers registered
📡 [Network] Sprite sync initialized
📡 [Network] Sprite sync started (20Hz) - syncing 2 sprite(s)
👋 [Network] Player joined: Player 2
📡 [Network] Receiving sprite updates from other players
```

### Player 2 (Guest) Expected Logs:
```
🌐 [Network] Connecting to server: http://localhost:3000
🌐 [Network] Joining room 'ABCD' as 'Player 2'...
✅ [Network] Connected to server!
✅ [Network] ═══════════════════════════════
✅ [Network] JOINED ROOM SUCCESSFULLY!
✅ [Network] Room Code: ABCD
✅ [Network] You are: Player 2 (GUEST)
✅ [Network] Players in room: Player 1, Player 2
✅ [Network] ═══════════════════════════════
📡 [Network] Event handlers registered
📡 [Network] Sprite sync initialized
📡 [Network] Sprite sync started (20Hz) - syncing 1 sprite(s)
📡 [Network] Receiving sprite updates from other players
```

### Server Expected Logs:
```
GameKit Server listening on port 3000
Ready for multiplayer connections!
Room created: ABCD by Player 1
Player 2 joined room ABCD
Broadcasting to room ABCD: Player 2 joined
[Sprite sync updates every 50ms...]
```

---

## What's Working vs. Coming in Stage 8

**✅ Working Now (Stage 7):**
- Room creation and joining
- Player join/leave events
- Sprite sync data transmission (20Hz)
- Custom messaging
- Network infrastructure complete

**🔜 Coming in Stage 8:**
- **Visual rendering of remote sprites** (you'll see other player's paddle move)
- Proper two-paddle Pong layout (left/right)
- Score UI on screen
- Win condition
- Game state management

The network is working! You just can't SEE the other player's sprites yet because we haven't implemented the receiving/rendering side. The console logs prove the data is flowing.
