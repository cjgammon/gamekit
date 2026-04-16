import { describe, test, expect } from 'bun:test';
import { findAvailablePort } from './port-finder';
import net from 'net';

describe('Port Finder', () => {
  test('finds available port starting from base', async () => {
    const port = await findAvailablePort(9000);
    expect(port).toBeGreaterThanOrEqual(9000);
    expect(port).toBeLessThan(9100);
  });

  test('skips occupied ports', async () => {
    // Occupy port 9001
    const server = net.createServer();
    await new Promise(resolve => server.listen(9001, resolve));

    try {
      const port = await findAvailablePort(9001);
      expect(port).toBeGreaterThan(9001);
    } finally {
      server.close();
    }
  });

  test('throws when no ports available in range', async () => {
    // Occupy ports starting from 50000 to force the function to try 100+ ports
    const servers: net.Server[] = [];
    const basePort = 50000;

    try {
      // Occupy 101 consecutive ports
      for (let i = 0; i < 101; i++) {
        const server = net.createServer();
        await new Promise(resolve => server.listen(basePort + i, resolve));
        servers.push(server);
      }

      // Now trying to find a port from basePort should fail after 100 attempts
      await expect(findAvailablePort(basePort)).rejects.toThrow('No available ports');
    } finally {
      // Clean up all servers
      servers.forEach(server => server.close());
    }
  });
});
