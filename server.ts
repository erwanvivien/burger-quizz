import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import crypto from "crypto";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  RoomState,
  Team,
  TeamColor,
} from "./lib/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const rooms = new Map<string, RoomState>();
const adminSockets = new Map<string, string>(); // roomId -> socketId

function createRoom(roomId: string): RoomState {
  return { roomId, phase: "lobby", teams: [], adminConnected: false };
}

function getOrCreateRoom(roomId: string): RoomState {
  if (!rooms.has(roomId)) rooms.set(roomId, createRoom(roomId));
  return rooms.get(roomId)!;
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url!, true));
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    { cors: { origin: "*", methods: ["GET", "POST"] } }
  );

  function broadcastState(roomId: string): void {
    const state = rooms.get(roomId);
    if (state) io.to(roomId).emit("stateUpdate", state);
  }

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("admin:join", (roomId, callback) => {
      const state = getOrCreateRoom(roomId);
      state.adminConnected = true;
      adminSockets.set(roomId, socket.id);
      socket.join(roomId);
      callback(state);
      broadcastState(roomId);
    });

    socket.on("player:join", (roomId, callback) => {
      const state = getOrCreateRoom(roomId);
      socket.join(roomId);
      callback(state);
    });

    socket.on("team:add", ({ roomId, name, color }) => {
      const state = getOrCreateRoom(roomId);
      if (state.teams.length >= 4) return;
      const team: Team = {
        id: crypto.randomUUID(),
        name,
        color: color as TeamColor,
        score: 0,
      };
      state.teams.push(team);
      broadcastState(roomId);
    });

    socket.on("team:remove", ({ roomId, teamId }) => {
      const state = rooms.get(roomId);
      if (!state) return;
      state.teams = state.teams.filter((t) => t.id !== teamId);
      broadcastState(roomId);
    });

    socket.on("team:rename", ({ roomId, teamId, name }) => {
      const state = rooms.get(roomId);
      if (!state) return;
      const team = state.teams.find((t) => t.id === teamId);
      if (team) team.name = name;
      broadcastState(roomId);
    });

    socket.on("game:start", (roomId) => {
      const state = rooms.get(roomId);
      if (!state || state.teams.length < 2) return;
      state.phase = "playing";
      broadcastState(roomId);
    });

    socket.on("game:end", (roomId) => {
      const state = rooms.get(roomId);
      if (!state) return;
      state.phase = "finished";
      broadcastState(roomId);
    });

    socket.on("score:adjust", ({ roomId, teamId, delta }) => {
      const state = rooms.get(roomId);
      if (!state) return;
      const team = state.teams.find((t) => t.id === teamId);
      if (team) team.score = Math.max(0, team.score + delta);
      broadcastState(roomId);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
      for (const [roomId, adminSocketId] of adminSockets.entries()) {
        if (adminSocketId === socket.id) {
          const state = rooms.get(roomId);
          if (state) {
            state.adminConnected = false;
            broadcastState(roomId);
          }
          adminSockets.delete(roomId);
          break;
        }
      }
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
