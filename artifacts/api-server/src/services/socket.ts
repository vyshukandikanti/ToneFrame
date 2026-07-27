import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import { logger } from "../lib/logger";
import { getRedisClient, getRedisOptions } from "./redis";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-for-dev";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let io: SocketServer | null = null;
let pubsubSubscribed = false;

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

  // Setup Redis PubSub Subscription (only on backend api-server)
  if (!pubsubSubscribed) {
    try {
      const subClient = new Redis(REDIS_URL, getRedisOptions());
      subClient.subscribe("job_updates", (err) => {
        if (err) {
          logger.error(err, "Failed to subscribe to Redis job_updates channel");
        } else {
          logger.info("Successfully subscribed to Redis job_updates channel");
          pubsubSubscribed = true;
        }
      });

      subClient.on("message", (channel, message) => {
        if (channel === "job_updates") {
          try {
            const { projectId, event, data } = JSON.parse(message);
            if (io) {
              const roomName = `project:${projectId}`;
              io.to(roomName).emit(event, data);
              logger.debug(`Broadcasted Redis pubsub event ${event} to room ${roomName}`);
            }
          } catch (err) {
            logger.error(err, "Error parsing Redis pubsub message");
          }
        }
      });
    } catch (err) {
      logger.error(err, "Error setting up Redis PubSub socket broker");
    }
  }

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
  // If we have local Socket.io server initialized, emit directly
  if (io) {
    const roomName = `project:${projectId}`;
    io.to(roomName).emit(event, data);
    logger.debug(`Broadcasted local event ${event} to room ${roomName}`);
  }

  // Always publish to Redis so that other processes (worker/api-server instances) sync up
  try {
    const redis = getRedisClient();
    redis.publish("job_updates", JSON.stringify({ projectId, event, data })).catch((err) => {
      logger.error(err, "Failed to publish job update to Redis");
    });
  } catch (err) {
    logger.error(err, "Redis publish failed in broadcastJobUpdate");
  }
}
