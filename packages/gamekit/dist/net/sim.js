/**
 * Shared, deterministic player simulation. The server and the client's
 * prediction MUST advance the local player with the exact same step or
 * prediction drifts from authority — so both call this one function.
 *
 * Direct velocity from input (no acceleration/drag), integrate, clamp to the
 * world. Kept minimal and allocation-free.
 */
/** Default player movement speed, px/s. */
export const PLAYER_SPEED = 200;
/** Default player box size, px. */
export const PLAYER_SIZE = 32;
export function simulatePlayer(e, input, dt, o) {
    e.velocity.x = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * o.speed;
    e.velocity.y = ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * o.speed;
    e.x += e.velocity.x * dt;
    e.y += e.velocity.y * dt;
    if (e.x < 0)
        e.x = 0;
    else if (e.x + e.width > o.worldW)
        e.x = o.worldW - e.width;
    if (e.y < 0)
        e.y = 0;
    else if (e.y + e.height > o.worldH)
        e.y = o.worldH - e.height;
}
