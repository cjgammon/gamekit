import net from 'net';

/**
 * Find an available port starting from basePort
 * @param basePort - Starting port to check
 * @returns First available port
 * @throws Error if no ports available within 100 attempts
 */
export async function findAvailablePort(basePort: number): Promise<number> {
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
  const maxAttempts = 100;

  while (!(await isPortAvailable(port))) {
    port++;
    if (port > basePort + maxAttempts) {
      throw new Error(`No available ports found in range ${basePort}-${port}`);
    }
  }

  return port;
}
