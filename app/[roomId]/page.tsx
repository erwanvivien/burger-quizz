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
import { COLOR_HEX } from "@/lib/types";

type PageProps = { params: Promise<{ roomId: string }> };

// ── Meal display components ───────────────────────────────────────────────────

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
  { file: "base-burger", minScore: 0 },
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

function FriesStack({ score, w }: { score: number; w: number }) {
  const count = Math.min(Math.max(score - 16, 0), 9);
  return (
    <div style={{ width: w }}>
      <div style={{ display: "flex" }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} style={{ width: "50px" }}>
            <MealImg
              src={
                count > 5 + i
                  ? `/frie-${i + 1}.png`
                  : `/empty-frie-${i + 1}.png`
              }
              w={w}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex" }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} style={{ width: "50px" }}>
            <MealImg
              src={
                count > 1 + i
                  ? `/frie-${i + 1}.png`
                  : `/empty-frie-${i + 1}.png`
              }
              w={w}
            />
          </div>
        ))}
      </div>
      <MealImg src={count > 0 ? "/bucket.png" : "/empty-bucket.png"} w={w} />
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  const color = COLOR_HEX[team.color];
  return (
    <div
      style={{
        background: "var(--surface)",
        border: `3px solid ${color}`,
        borderRadius: "1.25rem",
        padding: "0.875rem 0.75rem 0.75rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem",
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

// ── Player view ───────────────────────────────────────────────────────────────

function PlayerGame({ roomId }: { roomId: string }) {
  const [state, setState] = useState<RoomState | null>(null);
  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
    socketRef.current = socket;
    socket.emit("player:join", roomId, setState);
    socket.on("stateUpdate", setState);
    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  if (!state) {
    return (
      <main style={centeredMain}>
        <p style={{ color: "var(--text-muted)", fontSize: "1.2rem" }}>
          Connexion...
        </p>
      </main>
    );
  }

  const sorted = [...state.teams].sort((a, b) => b.score - a.score);

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
      <h1 style={titleStyle}>🍔 BURGER QUIZ</h1>

      {state.phase === "finished" && sorted.length > 0 && (
        <div
          style={{
            background: `${COLOR_HEX[sorted[0].color]}22`,
            border: `2px solid ${COLOR_HEX[sorted[0].color]}`,
            borderRadius: "1rem",
            padding: "0.75rem 1.5rem",
            textAlign: "center",
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
            🏆 {sorted[0].name} gagne avec {sorted[0].score} pt
            {sorted[0].score !== 1 ? "s" : ""} !
          </p>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              state.teams.length <= 2
                ? `repeat(${state.teams.length || 1}, 1fr)`
                : "repeat(2, 1fr)",
            gap: "0.875rem",
            width: "100%",
          }}
        >
          {sorted.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      </div>

      <p
        style={{
          color: "var(--text-muted)",
          fontSize: "0.82rem",
          marginTop: "auto",
        }}
      >
        Salle : <strong style={{ color: "var(--secondary)" }}>{roomId}</strong>
      </p>
    </main>
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
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg)",
            color: "var(--text-muted)",
          }}
        >
          Chargement...
        </div>
      }
    >
      <PlayerPageInner params={params} />
    </Suspense>
  );
}
