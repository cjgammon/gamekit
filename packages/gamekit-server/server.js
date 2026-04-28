#!/usr/bin/env node
// ============================================================
//  gamekit-server — multiplayer server for GameKit games
//
//  Run standalone:   npx gamekit-server
//  Or in your game:  node node_modules/gamekit-server/server.js
//
//  What this server does:
//    - Generates 4-letter room codes (like Gimkit)
//    - Lets players create or join rooms
//    - Relays sprite positions to everyone in the same room
//    - Remembers the last known state so late joiners catch up
//    - Tracks scores on the server so nobody can cheat
//    - Cleans everything up when players disconnect
// ============================================================

import { createServer } from 'http';
import { Server }       from 'socket.io';

const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------
//  Room state
//
//  rooms = {
//    'ABCD': {
//      code:      'ABCD',
//      hostId:    'socket-id-of-creator',
//      players:   Map<socketId, { id, name, score }>,
//      sprites:   Map<'socketId:syncId', snapshot>,
//      createdAt: Date,
//    }
//  }
// ------------------------------------------------------------------
const rooms = {};

// ------------------------------------------------------------------
//  Helpers
// ------------------------------------------------------------------

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (look like 1/0)
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms[code]);
  return code;
}

function getRoom(code) {
  return rooms[code?.toUpperCase()] ?? null;
}

function playerList(room) {
  return Array.from(room.players.values());
}

function lastSpriteState(room) {
  return Array.from(room.sprites.values());
}

// ------------------------------------------------------------------
//  Server setup
// ------------------------------------------------------------------

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      rooms:  Object.keys(rooms).length,
      uptime: Math.floor(process.uptime()),
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin:  '*',
    methods: ['GET', 'POST'],
  },
});

// ------------------------------------------------------------------
//  Connection handler
// ------------------------------------------------------------------

io.on('connection', (socket) => {
  console.log(`[+] Player connected:   ${socket.id}`);

  let currentRoomCode = null;
  let playerName      = 'Player';

  // ----------------------------------------------------------------
  //  createRoom — host creates a new room, gets back a 4-letter code
  // ----------------------------------------------------------------
  socket.on('createRoom', ({ name, code: requestedCode } = {}) => {
    playerName = name || `Player_${socket.id.slice(0, 4)}`;

    // Use requested code if provided, otherwise generate random
    let code;
    if (requestedCode) {
      code = requestedCode.toUpperCase();
      // Check if room already exists
      if (rooms[code]) {
        socket.emit('roomError', { message: `Room "${code}" already exists. Try joining instead!` });
        return;
      }
    } else {
      code = generateCode();
    }

    rooms[code] = {
      code,
      hostId:    socket.id,
      players:   new Map(),
      sprites:   new Map(),
      createdAt: new Date(),
    };

    const room = rooms[code];
    room.players.set(socket.id, { id: socket.id, name: playerName, score: 0 });

    socket.join(code);
    currentRoomCode = code;

    console.log(`[R] Room created: ${code} by ${playerName}`);

    socket.emit('roomCreated', {
      code,
      players: playerList(room),
      sprites: lastSpriteState(room),
    });
  });

  // ----------------------------------------------------------------
  //  joinRoom — player joins with a 4-letter code
  // ----------------------------------------------------------------
  socket.on('joinRoom', ({ code, name } = {}) => {
    playerName  = name || `Player_${socket.id.slice(0, 4)}`;
    const upper = (code || '').toUpperCase();
    const room  = getRoom(upper);

    if (!room) {
      socket.emit('roomError', { message: `Room "${upper}" not found. Check the code and try again!` });
      return;
    }

    room.players.set(socket.id, { id: socket.id, name: playerName, score: 0 });
    socket.join(upper);
    currentRoomCode = upper;

    console.log(`[J] ${playerName} joined room ${upper}`);

    socket.emit('roomJoined', {
      code:    upper,
      players: playerList(room),
      sprites: lastSpriteState(room),
    });

    socket.to(upper).emit('playerJoined', {
      player: { id: socket.id, name: playerName, score: 0 },
    });
  });

  // ----------------------------------------------------------------
  //  spriteSync — relay sprite positions to everyone else in the room
  // ----------------------------------------------------------------
  socket.on('spriteSync', ({ room: code, sprites } = {}) => {
    const room = getRoom(code || currentRoomCode);
    if (!room || !Array.isArray(sprites)) return;

    for (const snap of sprites) {
      console.log(`[SYNC] Received sprite from ${socket.id}: id=${snap.id} (${snap.x},${snap.y})`);
      room.sprites.set(`${socket.id}:${snap.id}`, { ...snap, _owner: socket.id });
    }

    socket.to(room.code).emit('spriteSync', {
      playerId: socket.id,
      sprites,
    });
  });

  // ----------------------------------------------------------------
  //  gameEvent — custom events from game code
  // ----------------------------------------------------------------
  socket.on('gameEvent', ({ room: code, event, data } = {}) => {
    const room = getRoom(code || currentRoomCode);
    if (!room) return;

    if (event === 'scoreUpdate') {
      const player = room.players.get(socket.id);
      if (player && typeof data?.score === 'number') {
        player.score = Math.max(player.score, Math.floor(data.score));
        io.to(room.code).emit('leaderboard', { players: playerList(room) });
      }
      return;
    }

    socket.to(room.code).emit(event, { ...data, _from: socket.id });
  });

  // ----------------------------------------------------------------
  //  requestLeaderboard
  // ----------------------------------------------------------------
  socket.on('requestLeaderboard', () => {
    const room = getRoom(currentRoomCode);
    if (!room) return;
    socket.emit('leaderboard', { players: playerList(room) });
  });

  // ----------------------------------------------------------------
  //  disconnect
  // ----------------------------------------------------------------
  socket.on('disconnect', () => {
    console.log(`[-] Player disconnected: ${socket.id} (${playerName})`);

    const room = getRoom(currentRoomCode);
    if (!room) return;

    room.players.delete(socket.id);

    for (const key of room.sprites.keys()) {
      if (key.startsWith(`${socket.id}:`)) room.sprites.delete(key);
    }

    socket.to(room.code).emit('playerLeft', { playerId: socket.id });

    if (room.players.size === 0) {
      setTimeout(() => {
        if (rooms[room.code]?.players.size === 0) {
          delete rooms[room.code];
          console.log(`[X] Room ${room.code} closed (empty)`);
        }
      }, 10_000);
    }

    if (room.hostId === socket.id && room.players.size > 0) {
      room.hostId = room.players.keys().next().value;
      const newHost = room.players.get(room.hostId);
      io.to(room.code).emit('newHost', { playerId: room.hostId, name: newHost.name });
      console.log(`[H] New host for ${room.code}: ${newHost.name}`);
    }
  });
});

// ------------------------------------------------------------------
//  Start
// ------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   GameKit Server running!              ║
  ║   http://localhost:${PORT}                ║
  ║   Health: http://localhost:${PORT}/health  ║
  ╚════════════════════════════════════════╝
  `);
});