import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../db/database';
import type { Subject, StudySession } from '../../types';
import { Play, Pause, Square, RotateCcw, Save, X, BookOpen, AlertCircle } from 'lucide-react';

interface TimerTabProps {
  selectedSubject: { id: string; name: string } | null;
  clearSelectedSubject: () => void;
  onSessionSaved: () => void;
  activeWorkspaceId: string;
}

export const TimerTab: React.FC<TimerTabProps> = ({
  selectedSubject,
  clearSelectedSubject,
  onSessionSaved,
  activeWorkspaceId,
}) => {
  // Load database subjects
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  // Form states
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [subtopicId, setSubtopicId] = useState('');
  const [notes, setNotes] = useState('');
  
  // Timer settings & states
  const [timerMode, setTimerMode] = useState<'stopwatch' | 'countdown'>('countdown');
  const [durationMinutes, setDurationMinutes] = useState(90); // default block size
  const [timeRemaining, setTimeRemaining] = useState(90 * 60); // seconds
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [secondsStudied, setSecondsStudied] = useState(0);

  const timerRef = useRef<any>(null);

  // Sync state with selected subject (redirected from Planning tab)
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const list = db.getSubjects(activeWorkspaceId);
    setSubjects(list);

    if (selectedSubject) {
      setSubjectId(selectedSubject.id);
      const sub = list.find((s) => s.id === selectedSubject.id);
      if (sub && sub.topics.length > 0) {
        setTopicId(sub.topics[0].id);
        if (sub.topics[0].subtopics.length > 0) {
          setSubtopicId(sub.topics[0].subtopics[0].id);
        }
      }
    } else if (list.length > 0 && !subjectId) {
      setSubjectId(list[0].id);
      if (list[0].topics.length > 0) {
        setTopicId(list[0].topics[0].id);
        if (list[0].topics[0].subtopics.length > 0) {
          setSubtopicId(list[0].topics[0].subtopics[0].id);
        }
      }
    }
  }, [selectedSubject, activeWorkspaceId]);

  // Clean up selected block redirect when tab unmounts
  useEffect(() => {
    return () => {
      clearSelectedSubject();
    };
  }, []);

  // Update selected topic/subtopic when subject changes
  const handleSubjectChange = (id: string) => {
    setSubjectId(id);
    setTopicId('');
    setSubtopicId('');
    const sub = subjects.find((s) => s.id === id);
    if (sub && sub.topics.length > 0) {
      setTopicId(sub.topics[0].id);
      if (sub.topics[0].subtopics.length > 0) {
        setSubtopicId(sub.topics[0].subtopics[0].id);
      }
    }
  };

  // Update subtopics when topic changes
  const handleTopicChange = (id: string) => {
    setTopicId(id);
    setSubtopicId('');
    const sub = subjects.find((s) => s.id === subjectId);
    if (sub) {
      const topic = sub.topics.find((t) => t.id === id);
      if (topic && topic.subtopics.length > 0) {
        setSubtopicId(topic.subtopics[0].id);
      }
    }
  };

  // Sync remaining seconds when countdown duration settings are modified
  useEffect(() => {
    if (timerMode === 'countdown' && !isActive) {
      setTimeRemaining(durationMinutes * 60);
    }
  }, [durationMinutes, timerMode, isActive]);

  // Synth beep sound using Web Audio API
  const playAlarmSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
      console.log('AudioCtx blocked: ', e);
    }
  };

  // Core Timer Clock Loop
  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = setInterval(() => {
        if (timerMode === 'countdown') {
          setTimeRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current!);
              setIsActive(false);
              playAlarmSound();
              setSecondsStudied(durationMinutes * 60);
              setShowSaveModal(true);
              return 0;
            }
            return prev - 1;
          });
        } else {
          setSecondsStudied((prev) => prev + 1);
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, isPaused, timerMode, durationMinutes]);

  const handleStart = () => {
    setIsActive(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleReset = () => {
    setIsActive(false);
    setIsPaused(false);
    setSecondsStudied(0);
    if (timerMode === 'countdown') {
      setTimeRemaining(durationMinutes * 60);
    }
  };

  const handleFinish = () => {
    setIsActive(false);
    setIsPaused(false);
    
    if (timerMode === 'countdown') {
      const studied = (durationMinutes * 60) - timeRemaining;
      setSecondsStudied(studied);
    }
    
    if (secondsStudied > 10 || (timerMode === 'countdown' && durationMinutes * 60 - timeRemaining > 10)) {
      setShowSaveModal(true);
    } else {
      alert('Sessão muito curta para ser registrada (mínimo de 10 segundos).');
      handleReset();
    }
  };

  // Save the Session to DB (linking to active workspace)
  const handleSaveSession = () => {
    const sub = subjects.find((s) => s.id === subjectId);
    const top = sub?.topics.find((t) => t.id === topicId);
    const subtop = top?.subtopics.find((s) => s.id === subtopicId);

    if (!sub) return;

    // Get active workspace details for tag
    const wsList = db.getWorkspaces();
    const activeWs = wsList.find(w => w.id === activeWorkspaceId);

    const newSession: StudySession = {
      id: `session-${Date.now()}`,
      subjectId: sub.id,
      subjectName: sub.name,
      topicName: top?.name || 'Tópico Geral',
      subtopicName: subtop?.name,
      durationSeconds: secondsStudied,
      date: new Date().toISOString(),
      notes: notes.trim() || undefined,
      workspaceId: activeWorkspaceId,
      workspaceName: activeWs ? activeWs.name : 'Meu Primeiro Ciclo'
    };

    // Save session record (global)
    const sessions = db.getSessions();
    db.saveSessions([newSession, ...sessions]);

    // Automatically mark the current subject block in the workspace cycle as completed
    const blocks = db.getCycleBlocks(activeWorkspaceId);
    const incompleteBlockIndex = blocks.findIndex((b) => b.subjectId === sub.id && !b.completed);
    if (incompleteBlockIndex !== -1) {
      blocks[incompleteBlockIndex].completed = true;
      db.saveCycleBlocks(activeWorkspaceId, blocks);
    }

    // Mark subtopic as completed in workspace subjects tree if specified
    if (subtop) {
      const updatedSubjects = subjects.map((s) => {
        if (s.id === sub.id) {
          const updatedTopics = s.topics.map((t) => {
            if (t.id === topicId) {
              const updatedSubtopics = t.subtopics.map((st) => {
                if (st.id === subtopicId) {
                  return { ...st, completed: true };
                }
                return st;
              });
              return { ...t, subtopics: updatedSubtopics };
            }
            return t;
          });
          return { ...s, topics: updatedTopics };
        }
        return s;
      });
      db.saveSubjects(activeWorkspaceId, updatedSubjects);
    }

    // Reset UI
    setShowSaveModal(false);
    setNotes('');
    handleReset();
    clearSelectedSubject();
    
    onSessionSaved();
  };

  // Format seconds to HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  const activeSubject = subjects.find((s) => s.id === subjectId);
  const activeTopics = activeSubject?.topics || [];
  const activeTopic = activeTopics.find((t) => t.id === topicId);
  const activeSubtopics = activeTopic?.subtopics || [];

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h2>Cronômetro e Registro de Estudo</h2>
        <p className="tab-description">
          Execute seus blocos de estudo e registre o seu tempo líquido de dedicação. As matérias e subtópicos marcados serão atualizados no seu edital.
        </p>
      </div>

      <div className="placeholder-grid" style={{ gridTemplateColumns: '1fr' }}>
        
        {subjects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <AlertCircle size={40} style={{ color: 'var(--color-warning)' }} />
            <p>Você precisa cadastrar matérias na aba de Planejamento antes de cronometrar seus estudos.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }} className="responsive-split-grid-two">
            
            {/* Left: Study Details Form */}
            <div className="placeholder-card card-primary" style={{ height: 'fit-content' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <BookOpen size={20} style={{ color: 'var(--color-primary)' }} />
                <h3>Foco do Estudo</h3>
              </div>

              {selectedSubject && (
                <div style={{
                  backgroundColor: 'var(--color-primary-glow)',
                  border: '1px solid rgba(129, 140, 248, 0.3)',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  color: 'var(--text-title)',
                  marginBottom: '1rem',
                  fontWeight: '600'
                }}>
                  Direcionado do ciclo: {selectedSubject.name}
                </div>
              )}

              {/* Form Input fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Subject Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Matéria</label>
                  <select
                    value={subjectId}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    disabled={isActive}
                    style={{
                      padding: '0.8rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-element)',
                      color: 'var(--text-title)',
                      width: '100%',
                      fontWeight: '600'
                    }}
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>

                {/* Topic Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Tópico</label>
                  <select
                    value={topicId}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    disabled={isActive || activeTopics.length === 0}
                    style={{
                      padding: '0.8rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-element)',
                      color: 'var(--text-title)',
                      width: '100%'
                    }}
                  >
                    <option value="">-- Selecione o Tópico --</option>
                    {activeTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>{topic.name}</option>
                    ))}
                  </select>
                </div>

                {/* Subtopic Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Subtópico (Opcional)</label>
                  <select
                    value={subtopicId}
                    onChange={(e) => setSubtopicId(e.target.value)}
                    disabled={isActive || activeSubtopics.length === 0}
                    style={{
                      padding: '0.8rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-element)',
                      color: 'var(--text-title)',
                      width: '100%'
                    }}
                  >
                    <option value="">-- Selecione o Subtópico --</option>
                    {activeSubtopics.map((subtop) => (
                      <option key={subtop.id} value={subtop.id}>
                        {subtop.name} {subtop.completed ? '✓' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Timer mode setting */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="timerMode"
                      checked={timerMode === 'countdown'}
                      onChange={() => { setTimerMode('countdown'); handleReset(); }}
                      disabled={isActive}
                    />
                    Cronômetro Regressivo
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="timerMode"
                      checked={timerMode === 'stopwatch'}
                      onChange={() => { setTimerMode('stopwatch'); handleReset(); }}
                      disabled={isActive}
                    />
                    Cronômetro Livre
                  </label>
                </div>

                {/* Countdown Time configuration */}
                {timerMode === 'countdown' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Duração (Minutos)</label>
                    <select
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                      disabled={isActive}
                      style={{
                        padding: '0.8rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-element)',
                        color: 'var(--text-title)',
                        width: '100%'
                      }}
                    >
                      {[15, 30, 45, 60, 90, 120, 150].map((min) => (
                        <option key={min} value={min}>{min} minutos</option>
                      ))}
                    </select>
                  </div>
                )}

              </div>
            </div>

            {/* Right: Clock & Controls */}
            <div className="placeholder-card card-secondary" style={{ justifyContent: 'center', alignItems: 'center', gap: '2rem' }}>
              <div className="mock-timer" style={{ width: '100%', fontSize: '4.5rem', padding: '2.5rem 0', display: 'flex', justifyContent: 'center' }}>
                {timerMode === 'countdown' ? formatTime(timeRemaining) : formatTime(secondsStudied)}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                {!isActive ? (
                  <button onClick={handleStart} className="mock-btn" style={{ flex: 1, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', justifyContent: 'center' }}>
                    <Play size={20} /> Iniciar Estudo
                  </button>
                ) : (
                  <>
                    <button onClick={handlePause} className="mock-btn text-muted" style={{ flex: 1, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', justifyContent: 'center' }}>
                      <Pause size={20} /> {isPaused ? 'Retomar' : 'Pausar'}
                    </button>
                    <button onClick={handleFinish} className="mock-btn" style={{ flex: 1, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', backgroundColor: 'var(--color-success)', justifyContent: 'center' }}>
                      <Square size={20} /> Finalizar
                    </button>
                  </>
                )}
                
                <button
                  onClick={handleReset}
                  disabled={!isActive && (timerMode === 'countdown' ? timeRemaining === durationMinutes * 60 : secondsStudied === 0)}
                  className="theme-toggle"
                  style={{ width: '3.5rem', height: '3.5rem', borderRadius: '12px' }}
                >
                  <RotateCcw size={20} />
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="placeholder-card card-primary" style={{ width: '90%', maxWidth: '500px', gap: '1.5rem', padding: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Registrar Sessão de Estudo</h3>
              <button onClick={() => setShowSaveModal(false)} style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            <div style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
              <p>Parabéns por concluir seu estudo! Veja os dados abaixo:</p>
              <div style={{
                backgroundColor: 'var(--bg-element)',
                padding: '1rem',
                borderRadius: '8px',
                marginTop: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div><strong>Matéria:</strong> {subjects.find(s => s.id === subjectId)?.name}</div>
                <div><strong>Tópico:</strong> {activeTopics.find(t => t.id === topicId)?.name || 'Geral'}</div>
                {subtopicId && <div><strong>Subtópico:</strong> {activeSubtopics.find(s => s.id === subtopicId)?.name}</div>}
                <div><strong>Tempo Líquido:</strong> {formatTime(secondsStudied)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Notas / Revisão</label>
              <textarea
                rows={3}
                placeholder="Insira anotações, fórmulas ou termos-chave para revisões futuras..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-element)',
                  color: 'var(--text-title)',
                  resize: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button onClick={() => setShowSaveModal(false)} className="mock-btn text-muted" style={{ flex: 1, padding: '0.8rem' }}>
                Descartar
              </button>
              <button onClick={handleSaveSession} className="mock-btn" style={{ flex: 1, padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Save size={18} /> Salvar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
