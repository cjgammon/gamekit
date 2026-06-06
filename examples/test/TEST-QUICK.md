# Quick Test - Does Multiplayer Work?

## Start Server & Client (One Command)

```bash
cd examples/pong
npm run dev
```

**✅ Success = Terminal shows:**
```
GameKit Server listening on port 3000
```

---

## Test 1: Host Creates Room

**Open:** http://localhost:5173
**Enter name:** Player 1

**✅ Success = Browser console shows:**
```
✅ [Network] ROOM CREATED SUCCESSFULLY!
✅ [Network] Room Code: ABCD
📡 [Network] Sprite sync started (20Hz) - syncing 2 sprite(s)
```

**✅ Success = On screen:**
- Green box displays "Room Code: ABCD"

---

## Test 2: Guest Joins Room

**Copy room code** from Player 1 (e.g., "ABCD")

**Open:** http://localhost:5173?room=ABCD
**Enter name:** Player 2

**✅ Success = Browser console shows:**
```
✅ [Network] JOINED ROOM SUCCESSFULLY!
✅ [Network] Players in room: Player 1, Player 2
📡 [Network] Sprite sync started (20Hz) - syncing 1 sprite(s)
```

**✅ Success = On screen:**
- Notification "Player 2 joined!" appears

**✅ Success = Player 1 console shows:**
```
👋 [Network] Player joined: Player 2
📡 [Network] Receiving sprite updates from other players
```

---

## Test 3: Real-Time Sync Working?

**In both browsers:**
- Move paddle with arrow keys
- Check console for:

```
📡 [Network] Receiving sprite updates from other players
```

**If you see that** → Multiplayer is working! ✅

(You won't see other player's paddle visually yet - that's Stage 8)

---

## Quick Checklist

- [ ] Server started (port 3000)
- [ ] Player 1 creates room, sees room code
- [ ] Player 2 joins with `?room=CODE`
- [ ] Both see "Player joined" in console
- [ ] Both see "Receiving sprite updates"
- [ ] Custom messages work (press Space, check console)

**If all checked** → Stage 7 complete! 🎉
