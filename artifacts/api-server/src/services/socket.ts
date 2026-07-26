import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-for-dev";

let io: SocketServer | null = null;

export function initializeSocketServer(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: "*", // Adjust CORS configuration in production
      methods: ["GET", "POST"],
    },
  });

  // Auth middleware for sockets
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Authentication error: Token not provided"));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      // Attach user details to socket
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user;
    logger.info(`WebSocket client connected: ${socket.id} (user: ${user?.email})`);

    // Allow subscribing to specific projects
    socket.on("subscribe", (data: { projectId: string }) => {
      if (data?.projectId) {
        const roomName = `project:${data.projectId}`;
        socket.join(roomName);
        logger.debug(`Socket ${socket.id} joined room: ${roomName}`);
      }
    });

    socket.on("unsubscribe", (data: { projectId: string }) => {
      if (data?.projectId) {
        const roomName = `project:${data.projectId}`;
        socket.leave(roomName);
        logger.debug(`Socket ${socket.id} left room: ${roomName}`);
      }
    });

    socket.on("disconnect", () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getSocketServer(): SocketServer {
  if (!io) {
    throw new Error("Socket.io server has not been initialized yet!");
  }
  return io;
}

// Broadcast helpers
export function broadcastJobUpdate(
  projectId: string,
  event:
    | "job:started"
    | "job:progress"
    | "job:stage_changed"
    | "job:completed"
    | "job:failed"
    | "job:cancelled"
    | "render:started"
    | "render:progress"
    | "render:completed"
    | "render:failed"
    | "export:started"
    | "export:progress"
    | "export:completed"
    | "export:failed",
  data: any
): void {
  if (!io) {
    logger.warn(`Cannot broadcast ${event} - socket server not initialized`);
    return;
  }

  const roomName = `project:${projectId}`;
  io.to(roomName).emit(event, data);
  logger.debug(`Broadcasted ${event} to room ${roomName}`);
}
