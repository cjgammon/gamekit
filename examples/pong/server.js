import { createServer } from "gamekit-server";

const server = createServer({
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  testMode: process.env.TEST_MODE === 'true',
});

server.start();
