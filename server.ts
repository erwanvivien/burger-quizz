import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import crypto from "crypto";
import { QUESTIONS } from "./lib/questions";
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

// In-memory room state
const rooms = new Map<string, RoomState>();
// Track which socket is the admin for a room
const adminSockets = new Map<string, string>(); // roomId -> socketId

function createRoom(roomId: string): RoomState {
  return {
    roomId,
    phase: "lobby",
    teams: [],
    currentQuestionIndex: 0,
    buzzedTeamId: null,
    buzzOrder: [],
    showQuestion: false,
    showAnswer: false,
    adminConnected: false,
    questionCount: QUESTIONS.length,
    currentQuestionText: null,
    currentAnswerText: null,
  };
}

function getOrCreateRoom(roomId: string): RoomState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createRoom(roomId));
  }
  return rooms.get(roomId)!;
}

function resetBuzz(state: RoomState): void {
  state.buzzedTeamId = null;
  state.buzzOrder = [];
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    }
  );

  function broadcastState(roomId: string): void {
    const state = rooms.get(roomId);
    if (!state) return;
    const q = QUESTIONS[state.currentQuestionIndex];
    const broadcast: RoomState = {
      ...state,
      currentQuestionText: state.showQuestion && q ? q.question : null,
      currentAnswerText: state.showAnswer && q ? q.answer : null,
    };
    io.to(roomId).emit("stateUpdate", broadcast);
  }

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("admin:join", (roomId, callback) => {
      const state = getOrCreateRoom(roomId);
      state.adminConnected = true;
      adminSockets.set(roomId, socket.id);
      socket.join(roomId);
      callback(state, QUESTIONS);
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
      if (!state) return;
      if (state.teams.length < 2) return;
      state.phase = "question";
      state.currentQuestionIndex = 0;
      state.showQuestion = false;
      state.showAnswer = false;
      resetBuzz(state);
      broadcastState(roomId);
    });

    socket.on("game:end", (roomId) => {
      const state = rooms.get(roomId);
      if (!state) return;
      state.phase = "finished";
      broadcastState(roomId);
    });

    socket.on("game:next", (roomId) => {
      const state = rooms.get(roomId);
      if (!state) return;
      if (state.currentQuestionIndex >= QUESTIONS.length - 1) return;
      state.currentQuestionIndex++;
      state.phase = "question";
      state.showQuestion = false;
      state.showAnswer = false;
      resetBuzz(state);
      broadcastState(roomId);
    });

    socket.on("game:prev", (roomId) => {
      const state = rooms.get(roomId);
      if (!state) return;
      if (state.currentQuestionIndex <= 0) return;
      state.currentQuestionIndex--;
      state.phase = "question";
      state.showQuestion = false;
      state.showAnswer = false;
      resetBuzz(state);
      broadcastState(roomId);
    });

    socket.on("game:openBuzz", (roomId) => {
      const state = rooms.get(roomId);
      if (!state) return;
      state.phase = "buzzing";
      state.buzzedTeamId = null;
      state.buzzOrder = [];
      broadcastState(roomId);
    });

    socket.on("game:resetBuzz", (roomId) => {
      const state = rooms.get(roomId);
      if (!state) return;
      state.phase = "question";
      resetBuzz(state);
      broadcastState(roomId);
    });

    socket.on("game:manualBuzz", ({ roomId, teamId }) => {
      const state = rooms.get(roomId);
      if (!state) return;
      state.phase = "answering";
      state.buzzedTeamId = teamId;
      state.buzzOrder = [teamId];
      broadcastState(roomId);
    });

    socket.on("buzz", ({ roomId, teamId }) => {
      const state = rooms.get(roomId);
      if (!state) return;
      if (state.phase !== "buzzing") return;
      if (state.buzzOrder.includes(teamId)) return;
      state.buzzOrder.push(teamId);
      if (state.buzzOrder.length === 1) {
        state.buzzedTeamId = teamId;
        state.phase = "answering";
      }
      broadcastState(roomId);
    });

    socket.on("game:correct", ({ roomId, teamId }) => {
      const state = rooms.get(roomId);
      if (!state) return;
      const team = state.teams.find((t) => t.id === teamId);
      if (team) {
        team.score += QUESTIONS[state.currentQuestionIndex].points;
      }
      state.phase = "question";
      state.showQuestion = false;
      state.showAnswer = false;
      resetBuzz(state);
      broadcastState(roomId);
    });

    socket.on("game:wrong", ({ roomId, teamId, penalty }) => {
      const state = rooms.get(roomId);
      if (!state) return;
      if (penalty) {
        const team = state.teams.find((t) => t.id === teamId);
        if (team) {
          team.score = Math.max(0, team.score - 1);
        }
      }
      // Remove this team from buzzOrder
      state.buzzOrder = state.buzzOrder.filter((id) => id !== teamId);
      if (state.buzzOrder.length > 0) {
        // Next team in buzz order answers
        state.buzzedTeamId = state.buzzOrder[0];
        state.phase = "answering";
      } else {
        // Nobody left to answer — reopen buzz
        state.phase = "buzzing";
        state.buzzedTeamId = null;
      }
      broadcastState(roomId);
    });

    socket.on("game:toggleQuestion", (roomId) => {
      const state = rooms.get(roomId);
      if (!state) return;
      state.showQuestion = !state.showQuestion;
      if (!state.showQuestion) {
        state.showAnswer = false;
      }
      broadcastState(roomId);
    });

    socket.on("game:toggleAnswer", (roomId) => {
      const state = rooms.get(roomId);
      if (!state) return;
      state.showAnswer = !state.showAnswer;
      if (state.showAnswer) {
        state.showQuestion = true;
      }
      broadcastState(roomId);
    });

    socket.on("score:adjust", ({ roomId, teamId, delta }) => {
      const state = rooms.get(roomId);
      if (!state) return;
      const team = state.teams.find((t) => t.id === teamId);
      if (team) {
        team.score = Math.max(0, team.score + delta);
      }
      broadcastState(roomId);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
      // Check if this was an admin socket
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
    console.log(`> Local: http://localhost:${port}`);
  });
});
