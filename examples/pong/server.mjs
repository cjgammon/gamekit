// Throwaway netdemo server (milestone 2a). Runs on Node against the built
// dist — Node's http upgrade is what the from-scratch WebSocket server targets.
//   1) npm run build           (build gamekit + gamekit-server dist)
//   2) node examples/netdemo/server.mjs
import {
  ServerGame,
  WebSocketServer,
  ServerTransport,
} from "@cjgammon/gamekit-server";

const PORT = 39400;

const game = new ServerGame({ width: 800, height: 600, tickRate: 20 });
const ws = new WebSocketServer();

ws.onConnection.add((conn) => {
  console.log("[netdemo] client connected");
  game.accept(new ServerTransport(conn));
  conn.onClose.add(() => console.log("[netdemo] client disconnected"));
});

ws.listen(PORT, () => console.log(`[netdemo] server on ws://localhost:${PORT}`));
game.start();
