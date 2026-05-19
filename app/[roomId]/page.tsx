"use client";

import { use, useEffect, useState, useRef, Suspense } from "react";
import Image from "next/image";
import { io, Socket } from "socket.io-client";
import type {
  RoomState,
  Team,
  ServerToClientEvents,
  ClientToServerEvents,
} from "@/lib/types";
import { COLOR_HEX, COLOR_NAMES } from "@/lib/types";

type PageProps = { params: Promise<{ roomId: string }> };

// Burger layers rendered top→bottom; minScore = points needed to fill
const BURGER_LAYERS = [
  { file: "top-bread", minScore: 9 },
  { file: "top-tomato", minScore: 8 },
  { file: "top-meat", minScore: 7 },
  { file: "cheese", minScore: 6 },
  { file: "salad", minScore: 5 },
  { file: "middle-burger", minScore: 4 },
  { file: "base-tomato", minScore: 3 },
  { file: "base-meat", minScore: 2 },
  { file: "salad", minScore: 1 },
  { file: "base-burger", minScore: 0 }, // always filled
];

function MealImg({ src, w }: { src: string; w: number }) {
  return (
    <Image
      src={src}
      alt=""
      width={w}
      height={w}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}

function BurgerStack({ score, w }: { score: number; w: number }) {
  return (
    <div style={{ width: w }}>
      {BURGER_LAYERS.map(({ file, minScore }, i) => (
        <div key={file + i} style={{ marginTop: i === 0 ? 0 : "-3%" }}>
          <MealImg
            src={score > minScore ? `/${file}.png` : `/empty-${file}.png`}
            w={w}
          />
        </div>
      ))}
    </div>
  );
}

// Drink: cup always shown, lid at score≥9, straw at score≥10
function DrinkStack({ score, w }: { score: number; w: number }) {
  return (
    <div style={{ width: w }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "15%",
        }}
      >
        <div style={{ width: "78%" }}>
          <MealImg src={score > 12 ? "/straw.png" : "/empty-straw.png"} w={w} />
        </div>
      </div>
      <MealImg src={score > 11 ? "/top-cup.png" : "/empty-top-cup.png"} w={w} />
      <div style={{ marginTop: "-8%" }}>
        <MealImg src={score > 10 ? "/cup.png" : "/empty-cup.png"} w={w} />
      </div>
    </div>
  );
}

// Condiments: salt-pepper at score≥11, tubes at score≥12
function CondimentsStack({ score, w }: { score: number; w: number }) {
  const hasSaltPepper = score > 13;
  const hasKetchup = score > 14;
  const hasMayo = score > 15;
  return (
    <div
      style={{
        width: w,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <div style={{ display: "flex", gap: "2px", width: "100%" }}>
        <div style={{ flex: 1 }}>
          <MealImg
            src={hasKetchup ? "/tube-ketchup.png" : "/empty-mayo-ketchup.png"}
            w={w / 2}
          />
        </div>
        <div style={{ flex: 1 }}>
          <MealImg
            src={hasMayo ? "/tube-mayo.png" : "/empty-mayo-ketchup.png"}
            w={w / 2}
          />
        </div>
      </div>

      <MealImg
        src={hasSaltPepper ? "/salt-pepper.png" : "/empty-salt-pepper.png"}
        w={w}
      />
    </div>
  );
}

// Fries: bucket always shown; frie-N added at score≥11–14
function FriesStack({ score, w }: { score: number; w: number }) {
  const count = Math.min(Math.max(score - 16, 0), 9);

  return (
    <div style={{ width: w }}>
      <div style={{ display: "flex" }}>
        {new Array(4).fill(null).map((_, index) => {
          const frieSrc =
            count > 5 + index
              ? `/frie-${index + 1}.png`
              : `/empty-frie-${index + 1}.png`;

          return (
            <>
              <div style={{ width: "50px" }}>
                <MealImg src={frieSrc} w={w} />
              </div>
            </>
          );
        })}
      </div>

      <div style={{ display: "flex" }}>
        {new Array(4).fill(null).map((_, index) => {
          const frieSrc =
            count > 1 + index
              ? `/frie-${index + 1}.png`
              : `/empty-frie-${index + 1}.png`;

          return (
            <>
              <div style={{ width: "50px" }}>
                <MealImg src={frieSrc} w={w} />
              </div>
            </>
          );
        })}
      </div>

      <MealImg src={count > 0 ? "/bucket.png" : "/empty-bucket.png"} w={w} />
    </div>
  );
}

function TeamCard({ team, highlighted }: { team: Team; highlighted: boolean }) {
  const color = COLOR_HEX[team.color];
  return (
    <div
      style={{
        background: highlighted ? `${color}18` : "var(--surface)",
        border: `3px solid ${color}`,
        borderRadius: "1.25rem",
        padding: "0.875rem 0.75rem 0.75rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem",
        boxShadow: highlighted ? `0 0 32px ${color}88` : "none",
        transition: "box-shadow 0.3s, background 0.3s",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "6px",
          alignItems: "flex-end",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <BurgerStack score={team.score} w={72} />
        <DrinkStack score={team.score} w={52} />
        <CondimentsStack score={team.score} w={52} />
        <FriesStack score={team.score} w={60} />
      </div>
      <div
        style={{
          fontWeight: 800,
          color,
          fontSize: "0.85rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {team.name}
      </div>
      <div
        style={{
          fontWeight: 900,
          color: "var(--text)",
          fontSize: "1.8rem",
          lineHeight: 1,
        }}
      >
        {team.score}
        <span
          style={{
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            fontWeight: 600,
          }}
        >
          {" "}
          pt{team.score !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

function ScoreChip({ team, buzzed }: { team: Team; buzzed: boolean }) {
  const color = COLOR_HEX[team.color];
  return (
    <div
      style={{
        background: buzzed ? color : "var(--surface2)",
        border: `2px solid ${color}`,
        borderRadius: "0.5rem",
        padding: "0.25rem 0.75rem",
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        transition: "all 0.3s",
        boxShadow: buzzed ? `0 0 16px ${color}` : "none",
      }}
    >
      <span
        style={{
          fontWeight: 700,
          color: buzzed ? "#fff" : color,
          fontSize: "0.85rem",
        }}
      >
        {team.name}
      </span>
      <span
        style={{
          fontWeight: 900,
          color: buzzed ? "#fff" : "var(--text)",
          fontSize: "1rem",
        }}
      >
        {team.score}
      </span>
    </div>
  );
}

function PlayerGame({ roomId }: { roomId: string }) {
  const [state, setState] = useState<RoomState | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem(`burger-quiz-team-${roomId}`)
      : null
  );
  const [teamChosen, setTeamChosen] = useState(
    () =>
      typeof window !== "undefined" &&
      !!localStorage.getItem(`burger-quiz-team-${roomId}`)
  );
  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
    socketRef.current = socket;
    socket.emit("player:join", roomId, (s) => setState(s));
    socket.on("stateUpdate", setState);
    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  function chooseTeam(teamId: string | null) {
    setSelectedTeamId(teamId);
    setTeamChosen(true);
    if (teamId) localStorage.setItem(`burger-quiz-team-${roomId}`, teamId);
    else localStorage.removeItem(`burger-quiz-team-${roomId}`);
  }

  function handleBuzz() {
    if (!socketRef.current || !selectedTeamId || state?.phase !== "buzzing")
      return;
    socketRef.current.emit("buzz", { roomId, teamId: selectedTeamId });
  }

  if (!state) {
    return (
      <main style={centeredMain}>
        <p style={{ color: "var(--text-muted)", fontSize: "1.2rem" }}>
          Connexion...
        </p>
      </main>
    );
  }

  const myTeam = selectedTeamId
    ? state.teams.find((t) => t.id === selectedTeamId) ?? null
    : null;
  const actualTeamId = myTeam ? selectedTeamId : null;

  // Team selection screen
  if (!teamChosen || (selectedTeamId && !myTeam)) {
    return (
      <main style={centeredMain}>
        <h1 style={titleStyle}>🍔 BURGER QUIZ</h1>
        <p style={{ color: "var(--secondary)", fontSize: "1rem" }}>
          Salle : <strong>{roomId}</strong>
        </p>
        <h2
          style={{
            color: "var(--text)",
            fontSize: "1.4rem",
            marginTop: "0.5rem",
          }}
        >
          Choisissez votre équipe
        </h2>

        {state.teams.length === 0 ? (
          <p style={{ color: "var(--text-muted)", marginTop: "1rem" }}>
            Aucune équipe créée. Attendez l&apos;animateur...
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "1rem",
              width: "100%",
              maxWidth: "480px",
              marginTop: "1.5rem",
            }}
          >
            {state.teams.map((team) => (
              <button
                key={team.id}
                onClick={() => chooseTeam(team.id)}
                style={{
                  background: COLOR_HEX[team.color],
                  color: "#fff",
                  border: "none",
                  borderRadius: "1rem",
                  padding: "1.25rem 1rem",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  textShadow: "0 1px 3px rgba(0,0,0,0.4)",
                }}
              >
                {team.name}
                <div
                  style={{
                    fontSize: "0.8rem",
                    opacity: 0.85,
                    marginTop: "0.2rem",
                  }}
                >
                  {COLOR_NAMES[team.color]}
                </div>
              </button>
            ))}
            <button
              onClick={() => chooseTeam(null)}
              style={{
                background: "var(--surface2)",
                color: "var(--text-muted)",
                border: "2px dashed var(--text-muted)",
                borderRadius: "1rem",
                padding: "1.25rem 1rem",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Spectateur
            </button>
          </div>
        )}
      </main>
    );
  }

  const isBuzzMode = state.phase === "buzzing" || state.phase === "answering";
  const buzzedTeam = state.buzzedTeamId
    ? state.teams.find((t) => t.id === state.buzzedTeamId) ?? null
    : null;
  const isMyBuzz =
    state.phase === "answering" && state.buzzedTeamId === actualTeamId;
  const canBuzz = state.phase === "buzzing" && !!actualTeamId;
  const myTeamColor = myTeam ? COLOR_HEX[myTeam.color] : "var(--primary)";

  // ── BUZZ MODE ────────────────────────────────────────────────────────────
  if (isBuzzMode) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
          padding: "1rem",
          gap: "0.75rem",
        }}
      >
        {/* Compact score chips */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {state.teams.map((team) => (
            <ScoreChip
              key={team.id}
              team={team}
              buzzed={team.id === state.buzzedTeamId}
            />
          ))}
        </div>

        {/* Phase label */}
        <div style={{ textAlign: "center" }}>
          {state.phase === "buzzing" ? (
            <p
              style={{
                fontSize: "1.5rem",
                fontWeight: 900,
                color: "var(--primary)",
              }}
            >
              🔴 BUZZ !
            </p>
          ) : (
            <p
              style={{
                fontSize: "1.5rem",
                fontWeight: 900,
                color: buzzedTeam ? COLOR_HEX[buzzedTeam.color] : "var(--text)",
              }}
            >
              🎤 {buzzedTeam?.name ?? "???"} répond !
            </p>
          )}
        </div>

        {/* Question / Answer if revealed */}
        {state.currentQuestionText && (
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              fontSize: "1rem",
              color: "var(--text)",
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            {state.currentQuestionText}
          </div>
        )}
        {state.currentAnswerText && (
          <div
            style={{
              background: "#14532d",
              border: "1px solid var(--success)",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
            }}
          >
            <p
              style={{
                color: "var(--success)",
                fontWeight: 700,
                fontSize: "0.75rem",
              }}
            >
              RÉPONSE
            </p>
            <p style={{ color: "#fff", fontWeight: 600 }}>
              {state.currentAnswerText}
            </p>
          </div>
        )}

        {/* Big buzz button — grows to fill remaining space */}
        <button
          onClick={handleBuzz}
          disabled={!canBuzz}
          style={{
            flex: 1,
            minHeight: "160px",
            border: "none",
            borderRadius: "1.5rem",
            fontSize: "2.2rem",
            fontWeight: 900,
            letterSpacing: "0.08em",
            cursor: canBuzz ? "pointer" : "default",
            background: isMyBuzz
              ? myTeamColor
              : canBuzz
              ? myTeamColor
              : "var(--surface2)",
            color: canBuzz || isMyBuzz ? "#fff" : "var(--text-muted)",
            animation: canBuzz
              ? "pulse-buzz 1.2s ease-in-out infinite"
              : "none",
            boxShadow: isMyBuzz
              ? `0 0 60px ${myTeamColor}`
              : canBuzz
              ? `0 0 24px ${myTeamColor}55`
              : "none",
            textShadow:
              canBuzz || isMyBuzz ? "0 2px 8px rgba(0,0,0,0.4)" : "none",
            transition: "background 0.3s, box-shadow 0.3s",
          }}
        >
          {isMyBuzz
            ? "🎤 VOUS RÉPONDEZ !"
            : canBuzz
            ? "BUZZER !"
            : "En attente..."}
        </button>

        {!actualTeamId && state.phase === "buzzing" && (
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.85rem",
              textAlign: "center",
            }}
          >
            Sélectionnez une équipe pour buzzer.
          </p>
        )}

        <Footer
          roomId={roomId}
          myTeam={myTeam}
          onChangeTeam={() => {
            setTeamChosen(false);
            setSelectedTeamId(null);
            localStorage.removeItem(`burger-quiz-team-${roomId}`);
          }}
        />
      </main>
    );
  }

  // ── SCOREBOARD MODE ───────────────────────────────────────────────────────
  const sortedTeams = [...state.teams].sort((a, b) => b.score - a.score);

  function phaseLabel() {
    switch (state!.phase) {
      case "lobby":
        return "En attente du début...";
      case "question":
        return `Question ${state!.currentQuestionIndex + 1} / ${
          state!.questionCount
        }`;
      case "finished":
        return "🏆 Partie terminée !";
      default:
        return "";
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "var(--bg)",
        padding: "1.25rem 1rem",
        gap: "1rem",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <h1 style={titleStyle}>🍔 BURGER QUIZ</h1>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "0.95rem",
            marginTop: "0.25rem",
          }}
        >
          {phaseLabel()}
        </p>
      </div>

      {/* Question / Answer if revealed */}
      {state.currentQuestionText && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--surface2)",
            borderRadius: "0.75rem",
            padding: "0.875rem 1.25rem",
            fontSize: "1rem",
            color: "var(--text)",
            fontWeight: 600,
            lineHeight: 1.5,
            width: "100%",
            maxWidth: "600px",
          }}
        >
          {state.currentQuestionText}
        </div>
      )}
      {state.currentAnswerText && (
        <div
          style={{
            background: "#14532d",
            border: "1px solid var(--success)",
            borderRadius: "0.75rem",
            padding: "0.875rem 1.25rem",
            width: "100%",
            maxWidth: "600px",
          }}
        >
          <p
            style={{
              color: "var(--success)",
              fontWeight: 700,
              fontSize: "0.75rem",
            }}
          >
            RÉPONSE
          </p>
          <p style={{ color: "#fff", fontWeight: 600 }}>
            {state.currentAnswerText}
          </p>
        </div>
      )}

      {/* Team grid with burger stacks */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            state.teams.length <= 2
              ? `repeat(${state.teams.length}, 1fr)`
              : "repeat(2, 1fr)",
          gap: "0.875rem",
          width: "100%",
          maxWidth: "480px",
        }}
      >
        {sortedTeams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            highlighted={team.id === state.buzzedTeamId}
          />
        ))}
      </div>

      {/* Winner banner */}
      {state.phase === "finished" && sortedTeams.length > 0 && (
        <div
          style={{
            background: `${COLOR_HEX[sortedTeams[0].color]}22`,
            border: `2px solid ${COLOR_HEX[sortedTeams[0].color]}`,
            borderRadius: "1rem",
            padding: "1rem 1.5rem",
            textAlign: "center",
            maxWidth: "480px",
            width: "100%",
          }}
        >
          <p
            style={{
              color: "var(--secondary)",
              fontSize: "1.3rem",
              fontWeight: 900,
            }}
          >
            🏆 {sortedTeams[0].name} gagne avec {sortedTeams[0].score} pt
            {sortedTeams[0].score !== 1 ? "s" : ""} !
          </p>
        </div>
      )}

      <div style={{ flex: 1 }} />

      <Footer
        roomId={roomId}
        myTeam={myTeam}
        onChangeTeam={() => {
          setTeamChosen(false);
          setSelectedTeamId(null);
          localStorage.removeItem(`burger-quiz-team-${roomId}`);
        }}
      />
    </main>
  );
}

function Footer({
  roomId,
  myTeam,
  onChangeTeam,
}: {
  roomId: string;
  myTeam: Team | null;
  onChangeTeam: () => void;
}) {
  return (
    <p
      style={{
        color: "var(--text-muted)",
        fontSize: "0.82rem",
        textAlign: "center",
      }}
    >
      Salle : <strong style={{ color: "var(--secondary)" }}>{roomId}</strong>
      {myTeam && (
        <>
          {" · "}
          <button
            onClick={onChangeTeam}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "0.82rem",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Changer d&apos;équipe
          </button>
        </>
      )}
    </p>
  );
}

const centeredMain: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  background: "var(--bg)",
};

const titleStyle: React.CSSProperties = {
  fontSize: "2rem",
  fontWeight: 900,
  color: "var(--secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

function PlayerPageInner({ params }: PageProps) {
  const { roomId } = use(params);
  return <PlayerGame roomId={roomId} />;
}

export default function PlayerPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <main style={centeredMain}>
          <p style={{ color: "var(--text-muted)" }}>Chargement...</p>
        </main>
      }
    >
      <PlayerPageInner params={params} />
    </Suspense>
  );
}
