'use client'

import { use, useEffect, useState, useRef, Suspense } from 'react'
import { io, Socket } from 'socket.io-client'
import type { RoomState, ServerToClientEvents, ClientToServerEvents, TeamColor } from '@/lib/types'
import { COLOR_HEX, COLOR_NAMES, TEAM_COLORS } from '@/lib/types'

type PageProps = { params: Promise<{ roomId: string }> }

const DEFAULT_TEAM_NAMES = ['Équipe 1', 'Équipe 2', 'Équipe 3', 'Équipe 4']

function AdminPanel({ roomId }: { roomId: string }) {
  const [state, setState] = useState<RoomState | null>(null)
  const [addingTeam, setAddingTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamColor, setNewTeamColor] = useState<TeamColor>('red')
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingTeamName, setEditingTeamName] = useState('')
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io()
    socketRef.current = socket
    socket.emit('admin:join', roomId, setState)
    socket.on('stateUpdate', setState)
    return () => { socket.disconnect() }
  }, [roomId])

  function handleAddTeam() {
    if (!state) return
    const usedColors = state.teams.map(t => t.color)
    const availableColor = TEAM_COLORS.find(c => !usedColors.includes(c)) || 'red'
    setNewTeamName(DEFAULT_TEAM_NAMES[state.teams.length] || `Équipe ${state.teams.length + 1}`)
    setNewTeamColor(availableColor)
    setAddingTeam(true)
  }

  function handleConfirmAddTeam() {
    if (!state) return
    const name = newTeamName.trim() || DEFAULT_TEAM_NAMES[state.teams.length] || `Équipe ${state.teams.length + 1}`
    socketRef.current?.emit('team:add', { roomId, name, color: newTeamColor })
    setAddingTeam(false)
    setNewTeamName('')
  }

  function handleRenameConfirm() {
    if (!editingTeamId) return
    const name = editingTeamName.trim()
    if (name) socketRef.current?.emit('team:rename', { roomId, teamId: editingTeamId, name })
    setEditingTeamId(null)
    setEditingTeamName('')
  }

  if (!state) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-muted)' }}>
        Connexion à la salle {roomId}...
      </div>
    )
  }

  const usedColors = state.teams.map(t => t.color)
  const isPlaying = state.phase === 'playing'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Arial, Helvetica, sans-serif' }}>

      {/* Header */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '2px solid var(--surface2)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--secondary)', margin: 0 }}>
          🍔 BURGER QUIZ ADMIN
        </h1>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Salle : <strong style={{ color: 'var(--secondary)' }}>{roomId}</strong>
        </span>
        <span style={{
          marginLeft: 'auto',
          padding: '0.25rem 0.75rem',
          borderRadius: '999px',
          fontSize: '0.8rem',
          fontWeight: 600,
          background: state.adminConnected ? '#15803d' : '#7f1d1d',
          color: '#fff',
        }}>
          {state.adminConnected ? '● Connecté' : '○ Déconnecté'}
        </span>
      </header>

      {/* Content */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Teams */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {state.teams.map(team => (
            <div key={team.id} style={{
              background: 'var(--surface)',
              borderRadius: '0.75rem',
              border: `2px solid ${COLOR_HEX[team.color]}`,
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}>
              {/* Name row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: COLOR_HEX[team.color], flexShrink: 0 }} />
                {editingTeamId === team.id ? (
                  <input
                    autoFocus
                    value={editingTeamName}
                    onChange={e => setEditingTeamName(e.target.value)}
                    onBlur={handleRenameConfirm}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setEditingTeamId(null) }}
                    style={{
                      flex: 1, background: 'var(--bg)', border: `1px solid ${COLOR_HEX[team.color]}`,
                      borderRadius: '0.4rem', padding: '0.2rem 0.5rem', color: 'var(--text)',
                      fontSize: '0.95rem', fontWeight: 600, outline: 'none',
                    }}
                  />
                ) : (
                  <span
                    onClick={() => { setEditingTeamId(team.id); setEditingTeamName(team.name) }}
                    title="Cliquer pour renommer"
                    style={{ flex: 1, fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
                  >
                    {team.name}
                  </span>
                )}
                <button
                  onClick={() => socketRef.current?.emit('team:remove', { roomId, teamId: team.id })}
                  style={iconBtnStyle}
                  title="Supprimer l'équipe"
                >
                  ✕
                </button>
              </div>

              {/* Score row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => socketRef.current?.emit('score:adjust', { roomId, teamId: team.id, delta: -1 })}
                  style={{ ...scoreAdjBtnStyle, background: '#7f1d1d' }}
                >−1</button>
                <span style={{ flex: 1, textAlign: 'center', fontSize: '2rem', fontWeight: 900, color: COLOR_HEX[team.color] }}>
                  {team.score}
                </span>
                <button
                  onClick={() => socketRef.current?.emit('score:adjust', { roomId, teamId: team.id, delta: 1 })}
                  style={{ ...scoreAdjBtnStyle, background: '#14532d' }}
                >+1</button>
              </div>
            </div>
          ))}
        </div>

        {/* Add team */}
        {state.teams.length < 4 && state.phase === 'lobby' && (
          addingTeam ? (
            <div style={{ background: 'var(--surface)', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--surface2)' }}>
              <input
                autoFocus
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirmAddTeam()}
                placeholder="Nom de l'équipe"
                style={{
                  background: 'var(--bg)', border: '1px solid var(--surface2)', borderRadius: '0.4rem',
                  padding: '0.5rem 0.75rem', color: 'var(--text)', fontSize: '0.95rem', outline: 'none', width: '100%',
                }}
              />
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {TEAM_COLORS.filter(c => !usedColors.includes(c)).map(color => (
                  <button
                    key={color}
                    onClick={() => setNewTeamColor(color)}
                    title={COLOR_NAMES[color]}
                    style={{
                      flex: 1, padding: '0.5rem', borderRadius: '0.5rem',
                      border: `3px solid ${newTeamColor === color ? '#fff' : 'transparent'}`,
                      background: COLOR_HEX[color], cursor: 'pointer',
                      fontSize: '0.75rem', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    }}
                  >
                    {COLOR_NAMES[color]}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleConfirmAddTeam} style={{ ...actionBtnStyle, flex: 1, background: 'var(--success)', color: '#fff' }}>
                  Ajouter
                </button>
                <button onClick={() => setAddingTeam(false)} style={{ ...actionBtnStyle, flex: 1, background: 'var(--surface)', color: 'var(--text-muted)' }}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleAddTeam}
              style={{ ...actionBtnStyle, background: 'var(--surface)', color: 'var(--text-muted)', border: '2px dashed var(--text-muted)' }}
            >
              + Ajouter une équipe
            </button>
          )
        )}

        {/* Game controls */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {state.phase === 'lobby' && (
            <button
              onClick={() => socketRef.current?.emit('game:start', roomId)}
              disabled={state.teams.length < 2}
              style={{
                ...actionBtnStyle, flex: 1,
                background: state.teams.length >= 2 ? 'var(--success)' : 'var(--surface)',
                color: state.teams.length >= 2 ? '#fff' : 'var(--text-muted)',
                fontSize: '1rem', padding: '0.875rem',
                opacity: state.teams.length < 2 ? 0.5 : 1,
              }}
            >
              {state.teams.length < 2 ? 'Ajoutez 2 équipes min.' : '▶ Démarrer la partie'}
            </button>
          )}
          {state.phase === 'finished' && (
            <button
              onClick={() => socketRef.current?.emit('game:start', roomId)}
              style={{ ...actionBtnStyle, flex: 1, background: 'var(--success)', color: '#fff', fontSize: '1rem', padding: '0.875rem' }}
            >
              ▶ Rejouer
            </button>
          )}
          {isPlaying && (
            <button
              onClick={() => socketRef.current?.emit('game:end', roomId)}
              style={{ ...actionBtnStyle, flex: 1, background: '#7f1d1d', color: '#fff', fontSize: '0.9rem' }}
            >
              ■ Terminer la partie
            </button>
          )}
        </div>

        {/* Finished leaderboard */}
        {state.phase === 'finished' && (
          <div style={{ background: 'var(--surface)', borderRadius: '1rem', padding: '1.5rem', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--secondary)', fontSize: '1.5rem', marginBottom: '1rem' }}>🏆 Partie terminée !</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[...state.teams].sort((a, b) => b.score - a.score).map((team, i) => (
                <div key={team.id} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.75rem 1rem', borderRadius: '0.5rem',
                  background: i === 0 ? `${COLOR_HEX[team.color]}33` : 'var(--surface2)',
                  border: `1px solid ${i === 0 ? COLOR_HEX[team.color] : 'transparent'}`,
                }}>
                  <span style={{ fontSize: '1.2rem' }}>{['🥇', '🥈', '🥉', '4.'][i]}</span>
                  <span style={{ flex: 1, fontWeight: 700, color: COLOR_HEX[team.color] }}>{team.name}</span>
                  <span style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--text)' }}>{team.score} pt{team.score !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const actionBtnStyle: React.CSSProperties = {
  border: 'none', borderRadius: '0.5rem', padding: '0.625rem 1rem',
  fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s',
}

const iconBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '0.4rem',
  color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem 0.5rem',
  fontSize: '0.75rem', transition: 'background 0.15s',
}

const scoreAdjBtnStyle: React.CSSProperties = {
  border: 'none', borderRadius: '0.5rem', padding: '0.35rem 0.75rem',
  fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', color: '#fff',
}

function AdminPageInner({ params }: PageProps) {
  const { roomId } = use(params)
  return <AdminPanel roomId={roomId} />
}

export default function AdminPage({ params }: PageProps) {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-muted)' }}>
        Chargement...
      </div>
    }>
      <AdminPageInner params={params} />
    </Suspense>
  )
}
