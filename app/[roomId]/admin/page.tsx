'use client'

import { use, useEffect, useState, useRef, Suspense } from 'react'
import { io, Socket } from 'socket.io-client'
import type { RoomState, Question, ServerToClientEvents, ClientToServerEvents, TeamColor } from '@/lib/types'
import { COLOR_HEX, COLOR_NAMES, TEAM_COLORS } from '@/lib/types'

type PageProps = {
  params: Promise<{ roomId: string }>
}

const DEFAULT_TEAM_NAMES = ['Équipe 1', 'Équipe 2', 'Équipe 3', 'Équipe 4']

function AdminPanel({ roomId }: { roomId: string }) {
  const [state, setState] = useState<RoomState | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [addingTeam, setAddingTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamColor, setNewTeamColor] = useState<TeamColor>('red')
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingTeamName, setEditingTeamName] = useState('')
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io()
    socketRef.current = socket

    socket.emit('admin:join', roomId, (initialState, initialQuestions) => {
      setState(initialState)
      setQuestions(initialQuestions)
    })

    socket.on('stateUpdate', (newState) => {
      setState(newState)
    })

    socket.on('questionsSync', (q) => {
      setQuestions(q)
    })

    return () => {
      socket.disconnect()
    }
  }, [roomId])

  function handleAddTeam() {
    if (!state) return
    const usedColors = state.teams.map(t => t.color)
    const availableColor = TEAM_COLORS.find(c => !usedColors.includes(c)) || 'red'
    const teamNumber = state.teams.length + 1
    setNewTeamName(DEFAULT_TEAM_NAMES[teamNumber - 1] || `Équipe ${teamNumber}`)
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

  function handleRenameStart(teamId: string, currentName: string) {
    setEditingTeamId(teamId)
    setEditingTeamName(currentName)
  }

  function handleRenameConfirm() {
    if (!editingTeamId) return
    const name = editingTeamName.trim()
    if (name) {
      socketRef.current?.emit('team:rename', { roomId, teamId: editingTeamId, name })
    }
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

  const currentQuestion = questions[state.currentQuestionIndex]
  const buzzedTeam = state.buzzedTeamId ? state.teams.find(t => t.id === state.buzzedTeamId) : null
  const isInGame = state.phase !== 'lobby' && state.phase !== 'finished'
  const usedColors = state.teams.map(t => t.color)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial, Helvetica, sans-serif',
    }}>
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

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: 0,
      }}>
        {/* Left panel: Teams */}
        <aside style={{
          background: 'var(--surface)',
          borderRight: '2px solid var(--surface2)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          overflowY: 'auto',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Équipes
          </h2>

          {/* Team list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {state.teams.map(team => (
              <div key={team.id} style={{
                background: 'var(--surface2)',
                borderRadius: '0.75rem',
                border: `2px solid ${COLOR_HEX[team.color]}`,
                padding: '0.75rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
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
                        flex: 1,
                        background: 'var(--bg)',
                        border: `1px solid ${COLOR_HEX[team.color]}`,
                        borderRadius: '0.4rem',
                        padding: '0.2rem 0.5rem',
                        color: 'var(--text)',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => handleRenameStart(team.id, team.name)}
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
                  <span style={{ flex: 1, textAlign: 'center', fontSize: '1.8rem', fontWeight: 900, color: COLOR_HEX[team.color] }}>
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
              <div style={{ background: 'var(--surface2)', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  autoFocus
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConfirmAddTeam()}
                  placeholder="Nom de l'équipe"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--surface2)',
                    borderRadius: '0.4rem',
                    padding: '0.5rem 0.75rem',
                    color: 'var(--text)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    width: '100%',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {TEAM_COLORS.filter(c => !usedColors.includes(c)).map(color => (
                    <button
                      key={color}
                      onClick={() => setNewTeamColor(color)}
                      title={COLOR_NAMES[color]}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        border: `3px solid ${newTeamColor === color ? '#fff' : 'transparent'}`,
                        background: COLOR_HEX[color],
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#fff',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
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
                style={{ ...actionBtnStyle, background: 'var(--surface2)', color: 'var(--text-muted)', border: '2px dashed var(--text-muted)' }}
              >
                + Ajouter une équipe
              </button>
            )
          )}

          {/* Start / End game */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {state.phase === 'lobby' && (
              <button
                onClick={() => socketRef.current?.emit('game:start', roomId)}
                disabled={state.teams.length < 2}
                style={{
                  ...actionBtnStyle,
                  background: state.teams.length >= 2 ? 'var(--success)' : 'var(--surface2)',
                  color: state.teams.length >= 2 ? '#fff' : 'var(--text-muted)',
                  fontSize: '1rem',
                  padding: '0.875rem',
                }}
              >
                {state.teams.length < 2 ? 'Au moins 2 équipes pour commencer' : '▶ Démarrer la partie'}
              </button>
            )}
            {state.phase === 'finished' && (
              <button
                onClick={() => socketRef.current?.emit('game:start', roomId)}
                style={{ ...actionBtnStyle, background: 'var(--success)', color: '#fff', fontSize: '1rem', padding: '0.875rem' }}
              >
                ▶ Rejouer
              </button>
            )}
            {isInGame && (
              <button
                onClick={() => socketRef.current?.emit('game:end', roomId)}
                style={{ ...actionBtnStyle, background: '#7f1d1d', color: '#fff', fontSize: '0.9rem' }}
              >
                ■ Terminer la partie
              </button>
            )}
          </div>
        </aside>

        {/* Right panel: Game */}
        <main style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>

          {/* Question display */}
          {currentQuestion && state.phase !== 'lobby' && (
            <div style={{ background: 'var(--surface)', borderRadius: '1rem', padding: '1.25rem', border: '1px solid var(--surface2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Question {state.currentQuestionIndex + 1} / {state.questionCount}
                  {' '}· <span style={{ color: 'var(--secondary)' }}>{currentQuestion.points} pt{currentQuestion.points > 1 ? 's' : ''}</span>
                </span>
                {/* Phase badge */}
                <span style={{
                  padding: '0.2rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  background: phaseColor(state.phase) + '33',
                  color: phaseColor(state.phase),
                  border: `1px solid ${phaseColor(state.phase)}`,
                }}>
                  {phaseLabel(state.phase)}
                </span>
              </div>
              <p style={{ fontSize: '1.1rem', color: 'var(--text)', lineHeight: 1.5, marginBottom: '1rem', fontWeight: 600 }}>
                {currentQuestion.question}
              </p>
              <div style={{
                background: '#14532d33',
                border: '1px solid var(--success)',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>RÉPONSE (admin only)</span>
                <p style={{ color: 'var(--text)', lineHeight: 1.4 }}>{currentQuestion.answer}</p>
              </div>
            </div>
          )}

          {/* Game controls */}
          {state.phase !== 'lobby' && state.phase !== 'finished' && (
            <>
              {/* Nav + Buzz controls */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => socketRef.current?.emit('game:prev', roomId)}
                  disabled={state.currentQuestionIndex === 0}
                  style={{ ...actionBtnStyle, flex: '0 0 auto', background: 'var(--surface2)', opacity: state.currentQuestionIndex === 0 ? 0.4 : 1 }}
                >
                  ◀ Préc
                </button>
                <button
                  onClick={() => socketRef.current?.emit('game:openBuzz', roomId)}
                  disabled={state.phase === 'buzzing'}
                  style={{
                    ...actionBtnStyle,
                    flex: 1,
                    background: state.phase === 'buzzing' ? '#7f1d1d' : 'var(--primary)',
                    color: '#fff',
                    fontSize: '1rem',
                    fontWeight: 800,
                  }}
                >
                  {state.phase === 'buzzing' ? '🔴 BUZZ OUVERT' : '🔴 OUVRIR BUZZ'}
                </button>
                <button
                  onClick={() => socketRef.current?.emit('game:next', roomId)}
                  disabled={state.currentQuestionIndex >= state.questionCount - 1}
                  style={{ ...actionBtnStyle, flex: '0 0 auto', background: 'var(--surface2)', opacity: state.currentQuestionIndex >= state.questionCount - 1 ? 0.4 : 1 }}
                >
                  Suiv ▶
                </button>
              </div>

              {/* Toggle buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => socketRef.current?.emit('game:toggleQuestion', roomId)}
                  style={{
                    ...actionBtnStyle,
                    flex: 1,
                    background: state.showQuestion ? '#92400e' : 'var(--surface2)',
                    color: state.showQuestion ? 'var(--secondary)' : 'var(--text-muted)',
                    border: `1px solid ${state.showQuestion ? 'var(--secondary)' : 'transparent'}`,
                  }}
                >
                  {state.showQuestion ? '👁 Question visible' : '👁 Montrer question aux joueurs'}
                </button>
                <button
                  onClick={() => socketRef.current?.emit('game:toggleAnswer', roomId)}
                  style={{
                    ...actionBtnStyle,
                    flex: 1,
                    background: state.showAnswer ? '#14532d' : 'var(--surface2)',
                    color: state.showAnswer ? 'var(--success)' : 'var(--text-muted)',
                    border: `1px solid ${state.showAnswer ? 'var(--success)' : 'transparent'}`,
                  }}
                >
                  {state.showAnswer ? '✓ Réponse visible' : '✓ Montrer réponse aux joueurs'}
                </button>
              </div>

              {/* Reset buzz */}
              <button
                onClick={() => socketRef.current?.emit('game:resetBuzz', roomId)}
                disabled={state.phase !== 'buzzing' && state.phase !== 'answering'}
                style={{
                  ...actionBtnStyle,
                  background: 'var(--surface2)',
                  color: 'var(--text-muted)',
                  opacity: (state.phase !== 'buzzing' && state.phase !== 'answering') ? 0.4 : 1,
                }}
              >
                ↺ Réinitialiser le buzz
              </button>

              {/* Manual buzz section */}
              <div style={{ background: 'var(--surface)', borderRadius: '1rem', padding: '1rem', border: '1px solid var(--surface2)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Buzz manuel (buzzer IRL)
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {state.teams.map(team => (
                    <button
                      key={team.id}
                      onClick={() => socketRef.current?.emit('game:manualBuzz', { roomId, teamId: team.id })}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        background: COLOR_HEX[team.color],
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                        transition: 'opacity 0.15s',
                      }}
                      onMouseOver={e => (e.currentTarget.style.opacity = '0.8')}
                      onMouseOut={e => (e.currentTarget.style.opacity = '1')}
                    >
                      {team.name} a buzzé
                    </button>
                  ))}
                </div>
              </div>

              {/* Answer section (when answering) */}
              {state.phase === 'answering' && buzzedTeam && (
                <div style={{
                  background: `${COLOR_HEX[buzzedTeam.color]}22`,
                  border: `2px solid ${COLOR_HEX[buzzedTeam.color]}`,
                  borderRadius: '1rem',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: COLOR_HEX[buzzedTeam.color] }}>
                    🎤 Répondant : {buzzedTeam.name}
                  </p>
                  {state.buzzOrder.length > 1 && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      File d&apos;attente : {state.buzzOrder.slice(1).map(id => state.teams.find(t => t.id === id)?.name).filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => socketRef.current?.emit('game:correct', { roomId, teamId: buzzedTeam.id })}
                      style={{
                        ...actionBtnStyle,
                        flex: 1,
                        background: 'var(--success)',
                        color: '#fff',
                        fontSize: '1rem',
                        fontWeight: 800,
                      }}
                    >
                      ✓ Bonne réponse (+{currentQuestion?.points ?? 1} pt{(currentQuestion?.points ?? 1) > 1 ? 's' : ''})
                    </button>
                    <button
                      onClick={() => socketRef.current?.emit('game:wrong', { roomId, teamId: buzzedTeam.id, penalty: false })}
                      style={{ ...actionBtnStyle, flex: 1, background: '#7f1d1d', color: '#fff', fontSize: '1rem', fontWeight: 800 }}
                    >
                      ✗ Mauvaise réponse
                    </button>
                    <button
                      onClick={() => socketRef.current?.emit('game:wrong', { roomId, teamId: buzzedTeam.id, penalty: true })}
                      style={{ ...actionBtnStyle, flex: 1, background: '#450a0a', color: '#fca5a5', fontSize: '0.9rem', border: '1px solid #7f1d1d' }}
                    >
                      ✗ −1 pt Mauvaise
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Lobby state */}
          {state.phase === 'lobby' && (
            <div style={{ background: 'var(--surface)', borderRadius: '1rem', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>En attente du début de la partie...</p>
              <p style={{ fontSize: '0.9rem' }}>
                {state.teams.length < 2
                  ? `Ajoutez au moins ${2 - state.teams.length} équipe${2 - state.teams.length > 1 ? 's' : ''} pour commencer.`
                  : `${state.teams.length} équipe${state.teams.length > 1 ? 's' : ''} prête${state.teams.length > 1 ? 's' : ''}. Vous pouvez démarrer !`}
              </p>
            </div>
          )}

          {/* Finished state */}
          {state.phase === 'finished' && (
            <div style={{ background: 'var(--surface)', borderRadius: '1rem', padding: '1.5rem', textAlign: 'center' }}>
              <h2 style={{ color: 'var(--secondary)', fontSize: '1.5rem', marginBottom: '1rem' }}>🏆 Partie terminée !</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[...state.teams].sort((a, b) => b.score - a.score).map((team, i) => (
                  <div key={team.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    background: i === 0 ? `${COLOR_HEX[team.color]}33` : 'var(--surface2)',
                    border: `1px solid ${i === 0 ? COLOR_HEX[team.color] : 'transparent'}`,
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '4.'}</span>
                    <span style={{ flex: 1, fontWeight: 700, color: COLOR_HEX[team.color] }}>{team.name}</span>
                    <span style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--text)' }}>{team.score} pt{team.score !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'lobby': return 'Lobby'
    case 'question': return 'Question'
    case 'buzzing': return '🔴 Buzz ouvert'
    case 'answering': return '🎤 Réponse'
    case 'finished': return 'Terminé'
    default: return phase
  }
}

function phaseColor(phase: string): string {
  switch (phase) {
    case 'buzzing': return '#e8392a'
    case 'answering': return '#ffb800'
    case 'finished': return '#22c55e'
    default: return '#c49a6c'
  }
}

// Shared button styles
const actionBtnStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '0.5rem',
  padding: '0.625rem 1rem',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
}

const iconBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: 'none',
  borderRadius: '0.4rem',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: '0.2rem 0.5rem',
  fontSize: '0.75rem',
  transition: 'background 0.15s',
}

const scoreAdjBtnStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '0.5rem',
  padding: '0.35rem 0.75rem',
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
  color: '#fff',
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
