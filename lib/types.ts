export type TeamColor = "red" | "blue" | "green" | "yellow";

export const TEAM_COLORS: TeamColor[] = ["red", "blue", "green", "yellow"];

export const COLOR_HEX: Record<TeamColor, string> = {
  red: "#e8392a",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
};

export const COLOR_NAMES: Record<TeamColor, string> = {
  red: "Rouge",
  blue: "Bleu",
  green: "Vert",
  yellow: "Jaune",
};

export interface Team {
  id: string;
  name: string;
  color: TeamColor;
  score: number;
}

export type GamePhase = "lobby" | "playing" | "finished";

export interface RoomState {
  roomId: string;
  phase: GamePhase;
  teams: Team[];
  adminConnected: boolean;
}

export interface ServerToClientEvents {
  stateUpdate: (state: RoomState) => void;
}

export interface ClientToServerEvents {
  "admin:join": (roomId: string, callback: (state: RoomState) => void) => void;
  "player:join": (roomId: string, callback: (state: RoomState) => void) => void;
  "team:add": (data: { roomId: string; name: string; color: TeamColor }) => void;
  "team:remove": (data: { roomId: string; teamId: string }) => void;
  "team:rename": (data: {
    roomId: string;
    teamId: string;
    name: string;
  }) => void;
  "game:start": (roomId: string) => void;
  "game:end": (roomId: string) => void;
  "score:adjust": (data: {
    roomId: string;
    teamId: string;
    delta: number;
  }) => void;
}
