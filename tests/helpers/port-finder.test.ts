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
    await expect(findAvailablePort(65535)).rejects.toThrow('No available ports');
  });
});
