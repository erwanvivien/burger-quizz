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

export type GamePhase =
  | "lobby"
  | "question"
  | "buzzing"
  | "answering"
  | "finished";

export interface Question {
  id: number;
  question: string;
  answer: string;
  points: number;
}

export interface RoomState {
  roomId: string;
  phase: GamePhase;
  teams: Team[];
  currentQuestionIndex: number;
  buzzedTeamId: string | null;
  buzzOrder: string[];
  showQuestion: boolean;
  showAnswer: boolean;
  adminConnected: boolean;
  questionCount: number;
  currentQuestionText: string | null;
  currentAnswerText: string | null;
}

export interface ServerToClientEvents {
  stateUpdate: (state: RoomState) => void;
  questionsSync: (questions: Question[]) => void;
}

export interface ClientToServerEvents {
  "admin:join": (
    roomId: string,
    callback: (state: RoomState, questions: Question[]) => void
  ) => void;
  "player:join": (roomId: string, callback: (state: RoomState) => void) => void;
  "team:add": (data: {
    roomId: string;
    name: string;
    color: TeamColor;
  }) => void;
  "team:remove": (data: { roomId: string; teamId: string }) => void;
  "team:rename": (data: {
    roomId: string;
    teamId: string;
    name: string;
  }) => void;
  "game:start": (roomId: string) => void;
  "game:end": (roomId: string) => void;
  "game:next": (roomId: string) => void;
  "game:prev": (roomId: string) => void;
  "game:openBuzz": (roomId: string) => void;
  "game:resetBuzz": (roomId: string) => void;
  "game:manualBuzz": (data: { roomId: string; teamId: string }) => void;
  "game:correct": (data: { roomId: string; teamId: string }) => void;
  "game:wrong": (data: {
    roomId: string;
    teamId: string;
    penalty: boolean;
  }) => void;
  "game:toggleQuestion": (roomId: string) => void;
  "game:toggleAnswer": (roomId: string) => void;
  "score:adjust": (data: {
    roomId: string;
    teamId: string;
    delta: number;
  }) => void;
  buzz: (data: { roomId: string; teamId: string }) => void;
}
