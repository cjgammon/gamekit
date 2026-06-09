# netdemo (throwaway)

Manual validation for multiplayer milestone 2a: authoritative server →
snapshot broadcast → client interpolation. **Not** the real renderer — it draws
boxes to a 2D canvas. Expect to delete this once the WebGPU renderer lands.

## Run

```bash
# 1. Build the packages (server runs against dist; client loads dist in the browser)
npm run build

# 2. Start the authoritative server on Node (port 39400)
node examples/netdemo/server.mjs

# 3. In another terminal, serve the repo root statically so the browser can load
#    the dist ESM via relative paths:
python3 -m http.server 8080

# 4. Open two browser tabs:
open http://localhost:8080/examples/netdemo/
```

Move with arrow keys / WASD in one tab. Your box is blue, others are orange.
The server is authoritative at 20Hz; remote boxes are interpolated ~100ms behind
real time, so motion stays smooth between snapshots.

> The server must run on **Node**, not Bun — the from-scratch WebSocket server
> targets Node's `http` upgrade (a Bun `node:http` upgrade quirk drops the
> handshake to browser clients).
