import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import type { Services } from '../services/container';

export function setupRealtime(server: HttpServer, services: Services): SocketServer {
  const { config } = services;
  const io = new SocketServer(server, {
    path: '/socket.io',
    cors: { origin: config.origins, methods: ['GET', 'POST'] },
    serveClient: false,
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });

  const namespace = io.of(config.realtimeNamespace);

  namespace.use((socket, next) => {
    const requested =
      (socket.handshake.auth?.environment as string | undefined) ??
      (socket.handshake.query.environment as string | undefined);
    if (requested !== config.appEnvironment) {
      next(new Error('ENVIRONMENT_MISMATCH'));
      return;
    }
    socket.data.environment = requested;
    next();
  });

  namespace.on('connection', (socket) => {
    const environment = socket.data.environment as string;
    const room = `environment:${environment}`;
    socket.join(room);
    socket.emit('ledger:ready', {
      environment,
      transport: 'socket.io',
      demoMode: config.DEMO_MODE,
      serverTime: new Date().toISOString(),
    });
    services.logger.debug({ socketId: socket.id, environment }, 'Realtime client connected');

    // Clients may not emit financial mutations. Only a liveness ping is allowed.
    socket.on('ledger:ping', (ack?: unknown) => {
      if (typeof ack === 'function') ack({ serverTime: new Date().toISOString() });
    });
  });

  services.bus.subscribe((event) => {
    namespace.to(`environment:${event.environment}`).emit('ledger:event', event);
  });

  return io;
}
