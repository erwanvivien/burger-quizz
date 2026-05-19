"use client";

import { use, useEffect, useState, useRef, Suspense } from "react";
import Image, { type StaticImageData } from "next/image";
import { io, Socket } from "socket.io-client";
import type {
  RoomState,
  Team,
  ServerToClientEvents,
  ClientToServerEvents,
} from "@/lib/types";
import { COLOR_HEX } from "@/lib/types";

// Burger
import topbread from "@/public/top-bread.png";
import emptytopbread from "@/public/empty-top-bread.png";
import toptomato from "@/public/top-tomato.png";
import emptytoptomato from "@/public/empty-top-tomato.png";
import topmeat from "@/public/top-meat.png";
import emptytopmeat from "@/public/empty-top-meat.png";
import cheese from "@/public/cheese.png";
import emptycheese from "@/public/empty-cheese.png";
import salad from "@/public/salad.png";
import emptysalad from "@/public/empty-salad.png";
import middleburger from "@/public/middle-burger.png";
import emptymiddleburger from "@/public/empty-middle-burger.png";
import basetomato from "@/public/base-tomato.png";
import emptybasetomato from "@/public/empty-base-tomato.png";
import basemeat from "@/public/base-meat.png";
import emptybasemeat from "@/public/empty-base-meat.png";
import baseburger from "@/public/base-burger.png";
import emptybaseburger from "@/public/empty-base-burger.png";

// Cup
import straw from "@/public/straw.png";
import emptystraw from "@/public/empty-straw.png";
import topcup from "@/public/top-cup.png";
import emptytopcup from "@/public/empty-top-cup.png";
import cup from "@/public/cup.png";
import emptycup from "@/public/empty-cup.png";

// Sauces
import tubeketchup from "@/public/tube-ketchup.png";
import tubemayo from "@/public/tube-mayo.png";
import emptymayoketchup from "@/public/empty-mayo-ketchup.png";
import saltpepper from "@/public/salt-pepper.png";
import emptysaltpepper from "@/public/empty-salt-pepper.png";

// Fries
import bucket from "@/public/bucket.png";
import emptybucket from "@/public/empty-bucket.png";
import frie1 from "@/public/frie-1.png";
import emptyfrie1 from "@/public/empty-frie-1.png";
import frie2 from "@/public/frie-2.png";
import emptyfrie2 from "@/public/empty-frie-2.png";
import frie3 from "@/public/frie-3.png";
import emptyfrie3 from "@/public/empty-frie-3.png";
import frie4 from "@/public/frie-4.png";
import emptyfrie4 from "@/public/empty-frie-4.png";

type PageProps = { params: Promise<{ roomId: string }> };

// ── Meal display components ───────────────────────────────────────────────────

const BURGER_LAYERS = [
  { file: topbread, empty: emptytopbread, minScore: 9 },
  { file: toptomato, empty: emptytoptomato, minScore: 8 },
  { file: topmeat, empty: emptytopmeat, minScore: 7 },
  { file: cheese, empty: emptycheese, minScore: 6 },
  { file: salad, empty: emptysalad, minScore: 5 },
  { file: middleburger, empty: emptymiddleburger, minScore: 4 },
  { file: basetomato, empty: emptybasetomato, minScore: 3 },
  { file: basemeat, empty: emptybasemeat, minScore: 2 },
  { file: salad, empty: emptysalad, minScore: 1 },
  { file: baseburger, empty: emptybaseburger, minScore: 0 },
];

function MealImg({ src }: { src: StaticImageData }) {
  return (
    <Image
      src={src}
      alt=""
      width={0}
      height={0}
      sizes="100vw"
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}

function BurgerStack({ score, w }: { score: number; w: number }) {
  return (
    <div style={{ width: w }}>
      {BURGER_LAYERS.map(({ file, empty, minScore }, i) => (
        <div key={i} style={{ marginTop: i === 0 ? 0 : "-3%" }}>
          <MealImg src={score > minScore ? file : empty} />
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
          <MealImg src={score > 12 ? straw : emptystraw} />
        </div>
      </div>
      <MealImg src={score > 11 ? topcup : emptytopcup} />
      <div style={{ marginTop: "-8%" }}>
        <MealImg src={score > 10 ? cup : emptycup} />
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
          <MealImg src={hasKetchup ? tubeketchup : emptymayoketchup} />
        </div>
        <div style={{ flex: 1 }}>
          <MealImg src={hasMayo ? tubemayo : emptymayoketchup} />
        </div>
      </div>
      <MealImg src={hasSaltPepper ? saltpepper : emptysaltpepper} />
    </div>
  );
}

function FriesStack({ score, w }: { score: number; w: number }) {
  const count = Math.min(Math.max(score - 16, 0), 9);
  const images = [frie1, frie2, frie3, frie4];
  const emptyImages = [emptyfrie1, emptyfrie2, emptyfrie3, emptyfrie4];

  return (
    <div style={{ width: w }}>
      <div style={{ display: "flex" }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} style={{ width: "50px" }}>
            <MealImg src={count > 5 + i ? images[i] : emptyImages[i]} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex" }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} style={{ width: "50px" }}>
            <MealImg src={count > 1 + i ? images[i] : emptyImages[i]} />
          </div>
        ))}
      </div>
      <MealImg src={count > 0 ? bucket : emptybucket} />
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

      {state.phase === "finished" && state.teams.length > 0 && (
        <div
          style={{
            background: `${COLOR_HEX[state.teams[0].color]}22`,
            border: `2px solid ${COLOR_HEX[state.teams[0].color]}`,
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
            🏆 {state.teams[0].name} gagne avec {state.teams[0].score} pt
            {state.teams[0].score !== 1 ? "s" : ""} !
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
          {state.teams.map((team) => (
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
