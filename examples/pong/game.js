// ============================================================
//  GameKit Stage 7 Test - Multiplayer Network
//  Testing: Socket.io room system, sprite sync, messaging
// ============================================================

import { Game, GKBox, GKCircle } from "gamekit";

console.log('=== GameKit Stage 7 Test ===');
console.log('Testing: Multiplayer network with Socket.io\n');

// Create game
console.log('Test 1: Creating Game...');
const game = new Game({
  width: 800,
  height: 600,
  gravity: 1,
  background: 0x111111,
  server: 'http://localhost:3000'  // GameKit server
});

// Score tracking
let hits = 0;
const updateScore = () => console.log(`💥 Collision! Total hits: ${++hits}`);

// Test 2: Create static floor
console.log('\nTest 2: Creating static floor...');
const floor = new GKBox({
  x: 400,
  y: 580,
  width: 800,
  height: 40,
  color: 0x444444,
  isStatic: true
});
game.add(floor);

// Test 3: Create static walls
console.log('\nTest 3: Creating walls...');
const leftWall = new GKBox({
  x: 10,
  y: 300,
  width: 20,
  height: 600,
  color: 0x444444,
  isStatic: true
});
game.add(leftWall);

const rightWall = new GKBox({
  x: 790,
  y: 300,
  width: 20,
  height: 600,
  color: 0x444444,
  isStatic: true
});
game.add(rightWall);

// Test 4: Create controllable paddle
console.log('\nTest 4: Creating controllable paddle...');
const paddle = new GKBox({
  x: 100,
  y: 300,
  width: 20,
  height: 100,
  color: 0xffffff,
  isStatic: true
});
game.add(paddle);

// Test 5: Keyboard controls
console.log('\nTest 5: Setting up keyboard controls...');
const paddleSpeed = 8;

game.onUpdate(() => {
  // Arrow keys or WASD
  if (game.isKeyDown('ArrowUp') || game.isKeyDown('w') || game.isKeyDown('W')) {
    paddle.moveUp(paddleSpeed);
  }
  if (game.isKeyDown('ArrowDown') || game.isKeyDown('s') || game.isKeyDown('S')) {
    paddle.moveDown(paddleSpeed);
  }

  // Keep paddle on screen (accounting for paddle height)
  const paddleHalfHeight = 50; // paddle height is 100, so half is 50
  if (paddle.y < paddleHalfHeight) paddle.y = paddleHalfHeight;
  if (paddle.y > 560 - paddleHalfHeight) paddle.y = 560 - paddleHalfHeight; // floor top is at 560
});

// Test 6: Create ball
console.log('\nTest 6: Creating ball...');
const ball = new GKCircle({
  x: 400,
  y: 100,
  radius: 15,
  color: 0xff0000,  // Red
  isStatic: false,
  bounce: 0.9,
  friction: 0.01
});
game.add(ball);

// Ball collision detection
ball.onCollide(floor, () => {
  console.log('🔴 Ball hit floor!');
  updateScore();
});

ball.onCollide(paddle, () => {
  console.log('🏓 Ball hit paddle!');
  updateScore();
});

ball.onCollide(leftWall, () => {
  console.log('⬅️  Ball hit left wall!');
  updateScore();
});

ball.onCollide(rightWall, () => {
  console.log('➡️  Ball hit right wall!');
  updateScore();
});

// Test 7: Key press events
console.log('\nTest 7: Setting up key press events...');
let ballLaunched = false;

game.onKey(' ', () => {
  if (!ballLaunched) {
    console.log('🚀 Space pressed - launching ball!');
    ballLaunched = true;
    ball.setVelocity(10, -5);
  }
});

game.onKey('r', () => {
  console.log('🔄 R pressed - resetting ball');
  ball.x = 400;
  ball.y = 100;
  ball.setVelocity(0, 0);
  ballLaunched = false;
});

game.onKey('R', () => {
  console.log('🔄 R pressed - resetting ball');
  ball.x = 400;
  ball.y = 100;
  ball.setVelocity(0, 0);
  ballLaunched = false;
});

// Test 8: Mouse/tap events
console.log('\nTest 8: Setting up mouse click events...');
game.onTap((x, y) => {
  console.log(`🖱️  Click at (${x}, ${y}) - moving paddle`);
  paddle.y = y;

  const paddleHalfHeight = 50;
  if (paddle.y < paddleHalfHeight) paddle.y = paddleHalfHeight;
  if (paddle.y > 560 - paddleHalfHeight) paddle.y = 560 - paddleHalfHeight;
});

// Test 9: MULTIPLAYER (NEW - Stage 7)
console.log('\n=== TEST 9: MULTIPLAYER SETUP (NEW) ===');

// Check URL parameters for room code
const urlParams = new URLSearchParams(window.location.search);
const roomCodeParam = urlParams.get('room');

if (roomCodeParam) {
  // Join existing room
  console.log(`\n🌐 Joining room: ${roomCodeParam}`);
  const playerName = prompt('Enter your name:', 'Player 2') || 'Player 2';

  game.joinRoom(roomCodeParam, playerName)
    .then(() => {
      console.log('✅ Successfully joined room!');
      console.log(`Room code: ${game.getRoomCode()}`);
      console.log(`You are: ${game.getPlayer()?.name}`);

      // As guest, you don't own the ball
      // Mark your paddle as owned (will be synced)
      game.setOwner(paddle);
      console.log('📡 Your paddle will be synced to other players');
    })
    .catch(err => {
      console.error('❌ Failed to join room:', err);
      alert('Failed to join room. Make sure the server is running!');
    });
} else {
  // Create new room
  console.log('\n🌐 Creating new room...');
  const playerName = prompt('Enter your name:', 'Player 1') || 'Player 1';

  game.createRoom(playerName)
    .then(({ code }) => {
      console.log('✅ Room created successfully!');
      console.log(`📋 Room code: ${code}`);
      console.log(`🔗 Share this URL: ${window.location.href}?room=${code}`);
      console.log(`You are: ${game.getPlayer()?.name} (HOST)`);

      // As host, you own the ball and paddle
      game.setOwner(paddle);
      game.setOwner(ball);
      console.log('📡 Your paddle and ball will be synced to other players');

      // Show room code on screen
      const roomDisplay = document.createElement('div');
      roomDisplay.style.cssText = `
        position: fixed;
        top: 60px;
        left: 20px;
        background: #2a6;
        color: #fff;
        padding: 12px 20px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 16px;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      `;
      roomDisplay.textContent = `Room Code: ${code}`;
      document.body.appendChild(roomDisplay);
    })
    .catch(err => {
      console.error('❌ Failed to create room:', err);
      alert('Failed to create room. Make sure the server is running on port 3000!');
    });
}

// Test 10: Player join/leave events (NEW - Stage 7)
console.log('\nTest 10: Registering player events...');

game.onPlayerJoin((player) => {
  console.log(`👋 ${player.name} joined the game!`);

  // Show notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4a8;
    color: #fff;
    padding: 12px 20px;
    border-radius: 6px;
    font-family: monospace;
    font-size: 14px;
    z-index: 1000;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  `;
  notification.textContent = `${player.name} joined!`;
  document.body.appendChild(notification);

  setTimeout(() => notification.remove(), 3000);
});

game.onPlayerLeave((player) => {
  console.log(`👋 ${player.name} left the game`);
});

// Test 11: Custom messaging (NEW - Stage 7)
console.log('\nTest 11: Setting up custom messaging...');

// Send score updates to other players
let lastScore = 0;
game.onUpdate(() => {
  if (hits > lastScore) {
    lastScore = hits;
    game.send('scoreUpdate', { hits });
  }
});

// Receive score updates
game.onMessage('scoreUpdate', (data) => {
  console.log(`📨 Received score update from other player: ${data.hits} hits`);
});

// Extra bouncing objects
const greenBox = new GKBox({
  x: 200,
  y: 50,
  width: 40,
  height: 40,
  color: 0x00ff00,
  isStatic: false,
  bounce: 0.6
});
game.add(greenBox);

const blueBox = new GKBox({
  x: 600,
  y: 150,
  width: 40,
  height: 40,
  color: 0x0000ff,
  isStatic: false,
  bounce: 0.7
});
game.add(blueBox);

console.log('\n=== Stage 7 Test Instructions ===');
console.log('✓ Visual elements:');
console.log('  - Gray floor and walls');
console.log('  - White paddle on left (controllable)');
console.log('  - Red ball in center');
console.log('  - Green and blue boxes falling');
console.log('');
console.log('✓ Single player controls:');
console.log('  - Arrow Up/Down or W/S → Move paddle');
console.log('  - Space → Launch ball');
console.log('  - R → Reset ball');
console.log('  - Click → Teleport paddle');
console.log('');
console.log('✓ MULTIPLAYER (NEW):');
console.log('  - First player creates room → gets room code');
console.log('  - Second player joins with ?room=CODE in URL');
console.log('  - Host controls ball physics');
console.log('  - Each player controls their own paddle');
console.log('  - Sprite positions sync automatically (20Hz)');
console.log('  - Custom messages: score updates sent between players');
console.log('  - Player join/leave events fire');
console.log('');
console.log('✓ To test multiplayer:');
console.log('  1. Start server: cd packages/gamekit-server && node server.js');
console.log('  2. Open first browser → creates room');
console.log('  3. Copy room code from console');
console.log('  4. Open second browser with ?room=CODE');
console.log('  5. Both players see each other\'s paddles move!');
console.log('');
console.log('✓ Previous features still work:');
console.log('  - Rendering, physics, collisions, input');
console.log('\nNext: Stage 8 will build complete multiplayer Pong game');
