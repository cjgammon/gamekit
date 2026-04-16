import net from 'net';

/**
 * Find an available port starting from basePort
 * @param basePort - Starting port to check
 * @returns First available port
 * @throws Error if no ports available within 100 attempts
 */
export async function findAvailablePort(basePort: number): Promise<number> {
  const maxPort = 65535;
  const maxAttempts = 100;

  // Check if we have enough room to search
  if (basePort + maxAttempts > maxPort) {
    throw new Error(`No available ports found in range ${basePort}-${maxPort}`);
  }

  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false); // Port in use
      });

      server.once('listening', () => {
        server.close();
        resolve(true); // Port available
      });

      server.listen(port);
    });
  };

  let port = basePort;

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    if (await isPortAvailable(port)) {
      return port;
    }

    port++;
  }

  throw new Error(`No available ports found in range ${basePort}-${port - 1}`);
}
