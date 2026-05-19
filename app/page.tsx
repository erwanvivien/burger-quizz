"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
  }
  return code;
}

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  function handleCreate() {
    const code = generateRoomCode();
    router.push(`/${code}/admin`);
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) {
      setJoinError("Le code doit comporter 4 caractères.");
      return;
    }
    setJoinError("");
    router.push(`/${code}`);
  }

  return (
    <main
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "var(--bg)",
        gap: "3rem",
      }}
    >
      {/* Title */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "5rem", lineHeight: 1 }}>🍔</div>
        <h1
          style={{
            fontSize: "3.5rem",
            fontWeight: 900,
            color: "var(--secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            textShadow: "0 0 40px rgba(255, 184, 0, 0.5)",
            marginTop: "0.5rem",
          }}
        >
          BURGER QUIZ
        </h1>
        <p
          style={{
            color: "var(--text-muted)",
            marginTop: "0.5rem",
            fontSize: "1.1rem",
          }}
        >
          Le quiz qui donne faim !
        </p>
      </div>

      {/* Cards */}
      <div
        style={{
          display: "flex",
          gap: "2rem",
          flexWrap: "wrap",
          justifyContent: "center",
          width: "100%",
          maxWidth: "800px",
        }}
      >
        {/* Create room */}
        <div
          style={{
            background: "var(--surface)",
            border: "2px solid var(--surface2)",
            borderRadius: "1rem",
            padding: "2rem",
            flex: "1",
            minWidth: "280px",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              color: "var(--text)",
              fontSize: "1.4rem",
              fontWeight: 700,
            }}
          >
            Créer une partie
          </h2>
          <p
            style={{
              color: "var(--text-muted)",
              textAlign: "center",
              fontSize: "0.95rem",
            }}
          >
            Vous êtes l&apos;animateur ? Créez une salle et partagez le code
            avec vos joueurs.
          </p>
          <button
            onClick={handleCreate}
            style={{
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: "0.75rem",
              padding: "1rem 2rem",
              fontSize: "1.1rem",
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              transition: "opacity 0.15s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            🎮 Créer une salle
          </button>
        </div>

        {/* Join room */}
        <div
          style={{
            background: "var(--surface)",
            border: "2px solid var(--surface2)",
            borderRadius: "1rem",
            padding: "2rem",
            flex: "1",
            minWidth: "280px",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              color: "var(--text)",
              fontSize: "1.4rem",
              fontWeight: 700,
            }}
          >
            Rejoindre une partie
          </h2>
          <p
            style={{
              color: "var(--text-muted)",
              textAlign: "center",
              fontSize: "0.95rem",
            }}
          >
            Entrez le code de la salle communiqué par l&apos;animateur.
          </p>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => {
              setJoinError("");
              setJoinCode(e.target.value.toUpperCase().slice(0, 4));
            }}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="CODE"
            maxLength={4}
            style={{
              background: "var(--surface2)",
              border: "2px solid var(--secondary)",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              fontSize: "2rem",
              fontWeight: 700,
              color: "var(--secondary)",
              width: "100%",
              textAlign: "center",
              letterSpacing: "0.2em",
              outline: "none",
            }}
          />
          {joinError && (
            <p style={{ color: "var(--primary)", fontSize: "0.9rem" }}>
              {joinError}
            </p>
          )}
          <button
            onClick={handleJoin}
            style={{
              background: "var(--secondary)",
              color: "#1a0a00",
              border: "none",
              borderRadius: "0.75rem",
              padding: "1rem 2rem",
              fontSize: "1.1rem",
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              transition: "opacity 0.15s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Rejoindre →
          </button>
        </div>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
        Inspiré de l&apos;émission Burger Quiz d&apos;Alain Chabat
      </p>
    </main>
  );
}
