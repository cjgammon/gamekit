import {
  ServerGame,
  WebSocketServer,
  ServerTransport,
} from "@cjgammon/gamekit-server";

const PORT = 39400;

const game = new ServerGame({ width: 640, height: 480, tickRate: 20 });

const ws = new WebSocketServer();
ws.onConnection.add((conn) => {
  console.log("player connected");
  game.accept(new ServerTransport(conn));
  conn.onClose.add(() => console.log("player disconnected"));
});

ws.listen(PORT, () => console.log(`server on ws://localhost:${PORT}`));
game.start(); // begin ticking + broadcasting snapshots