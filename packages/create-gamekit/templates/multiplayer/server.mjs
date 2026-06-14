import {
  ServerGame,
  WebSocketServer,
  ServerTransport,
} from "@cjgammon/gamekit-server";

const PORT = 39400;

// The server runs the same fixed-timestep loop headlessly and is authoritative:
// it simulates every player and broadcasts world snapshots ~20×/second.
const game = new ServerGame({ width: 640, height: 480, tickRate: 20 });

const ws = new WebSocketServer();
ws.onConnection.add((conn) => {
  console.log("player connected");
  game.accept(new ServerTransport(conn)); // spawns a player for this connection
  conn.onClose.add(() => console.log("player disconnected"));
});

ws.listen(PORT, () => console.log(`server on ws://localhost:${PORT}`));
game.start();
