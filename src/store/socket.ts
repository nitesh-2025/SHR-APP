import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../config/env";

/**
 * Single shared Socket.IO connection for the app. `useRealtime` owns its
 * lifecycle (connect on login, disconnect on logout); other modules (e.g. the
 * chat panel for typing relays) just grab it via `getSocket()`.
 */
let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket) return socket;
  socket = io(API_BASE_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
