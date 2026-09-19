import React, { useState, useEffect } from 'react';
import { db } from '../../db/database';
import type { StudySession, QuestionSession, Subject } from '../../types';
import { Calendar, Award, Clock, FileText, AlertCircle, CheckCircle, Video, Zap } from 'lucide-react';

interface AnalyticsTabProps {
  activeWorkspaceId: string;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ activeWorkspaceId }) => {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [questions, setQuestions] = useState<QuestionSession[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    
    // Load all historical sessions & questions globally
    const allSessions = db.getSessions();
    const allQuestions = db.getQuestions();
    
    // Filter to active workspace context
    const wsSessions = allSessions.filter(s => s.workspaceId === activeWorkspaceId);
    const wsQuestions = allQuestions.filter(q => q.workspaceId === activeWorkspaceId);
    
    setSessions(wsSessions);
    setQuestions(wsQuestions);
    setSubjects(db.getSubjects(activeWorkspaceId));
  }, [activeWorkspaceId]);

  // 1. General Metrics based on workspace-filtered data
  const totalSecondsStudied = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const totalHoursStudied = (totalSecondsStudied / 3600).toFixed(1);
  
  // Gran Videoaula Specific Metrics (isolate video from questions and non-video sessions)
  const videoSessions = sessions.filter(
    s => s.studyType === 'videoaula' || (s.playbackSpeed && s.playbackSpeed > 1)
  );
  const totalVideoLiquidSeconds = videoSessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const totalVideoGrossSeconds = videoSessions.reduce((sum, s) => sum + (s.grossDurationSeconds || s.durationSeconds), 0);
  const totalVideoGrossHours = (totalVideoGrossSeconds / 3600).toFixed(1);
  const totalVideoLiquidHours = (totalVideoLiquidSeconds / 3600).toFixed(1);
  const videoHoursSaved = Math.max(0, (totalVideoGrossSeconds - totalVideoLiquidSeconds) / 3600).toFixed(1);

  let totalSubtopics = 0;
  let completedSubtopics = 0;
  let completedVideos = 0;
  let completedPdfs = 0;
  let totalNotesCount = 0;

  subjects.forEach(sub => {
    sub.topics.forEach(t => {
      t.subtopics.forEach(st => {
        totalSubtopics++;
        if (st.completed) completedSubtopics++;
        if (st.videoWatched) completedVideos++;
        if (st.pdfRead) completedPdfs++;
        if (st.notes && st.notes.trim().length > 0) totalNotesCount++;
      });
    });
  });

  const videoCoveragePct = totalSubtopics > 0 ? Math.round((completedVideos / totalSubtopics) * 100) : 0;
  const pdfCoveragePct = totalSubtopics > 0 ? Math.round((completedPdfs / totalSubtopics) * 100) : 0;
  const theoryCoveragePct = totalSubtopics > 0 ? Math.round((completedSubtopics / totalSubtopics) * 100) : 0;
  
  const totalQuestionsAttempted = questions.reduce((sum, q) => sum + q.attempted, 0);
  const totalQuestionsCorrect = questions.reduce((sum, q) => sum + q.correct, 0);
  const totalRate = totalQuestionsAttempted > 0 ? (totalQuestionsCorrect / totalQuestionsAttempted) * 100 : 0;

  // 2. Filter active errors (Caderno de Erros ativos)
  const activeErrors = questions.filter((q) => q.adicionarParaRevisao);

  const handleMarkErrorReviewed = (id: string) => {
    // Modify in the global db.getQuestions() array
    const allQuestions = db.getQuestions();
    const updatedGlobal = allQuestions.map((q) => {
      if (q.id === id) {
        return { ...q, adicionarParaRevisao: false };
      }
      return q;
    });
    db.saveQuestions(updatedGlobal);
    
    // Update local state
    setQuestions(updatedGlobal.filter(q => q.workspaceId === activeWorkspaceId));
  };

  // 3. Heatmap data preparation (Last 12 weeks = 84 days)
  const getHeatmapData = () => {
    const today = new Date();
    const days: { dateStr: string; label: string; hours: number }[] = [];
    
    const sessionsByDate: { [key: string]: number } = {};
    sessions.forEach((s) => {
      if (s.date) {
        const dateKey = s.date.split('T')[0];
        sessionsByDate[dateKey] = (sessionsByDate[dateKey] || 0) + s.durationSeconds;
      }
    });

    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const seconds = sessionsByDate[dateStr] || 0;
      const hours = parseFloat((seconds / 3600).toFixed(2));
      
      const formattedLabel = d.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'short',
      });

      days.push({
        dateStr,
        label: `${formattedLabel}: ${hours}h estudadas`,
        hours,
      });
    }

    return days;
  };

  const heatmapDays = getHeatmapData();

  // 4. Dynamic metrics per Subject (including Gran Theory Tracker)
  const getSubjectMetrics = () => {
    const metrics: {
      [id: string]: {
        name: string;
        studySeconds: number;
        grossSeconds: number;
        questionsAttempted: number;
        questionsCorrect: number;
        totalSubtopics: number;
        completedSubtopics: number;
        completedVideos: number;
        completedPdfs: number;
      };
    } = {};

    subjects.forEach((s) => {
      let tot = 0;
      let comp = 0;
      let vids = 0;
      let pdfs = 0;
      s.topics.forEach(t => {
        t.subtopics.forEach(st => {
          tot++;
          if (st.completed) comp++;
          if (st.videoWatched) vids++;
          if (st.pdfRead) pdfs++;
        });
      });

      metrics[s.id] = {
        name: s.name,
        studySeconds: 0,
        grossSeconds: 0,
        questionsAttempted: 0,
        questionsCorrect: 0,
        totalSubtopics: tot,
        completedSubtopics: comp,
        completedVideos: vids,
        completedPdfs: pdfs,
      };
    });

    sessions.forEach((s) => {
      const isVideo = s.studyType === 'videoaula' || (s.playbackSpeed && s.playbackSpeed > 1);
      const gross = isVideo ? (s.grossDurationSeconds || s.durationSeconds) : s.durationSeconds;
      if (metrics[s.subjectId]) {
        metrics[s.subjectId].studySeconds += s.durationSeconds;
        metrics[s.subjectId].grossSeconds += gross;
      } else {
        metrics[s.subjectId] = {
          name: s.subjectName,
          studySeconds: s.durationSeconds,
          grossSeconds: gross,
          questionsAttempted: 0,
          questionsCorrect: 0,
          totalSubtopics: 0,
          completedSubtopics: 0,
          completedVideos: 0,
          completedPdfs: 0,
        };
      }
    });

    questions.forEach((q) => {
      if (metrics[q.subjectId]) {
        metrics[q.subjectId].questionsAttempted += q.attempted;
        metrics[q.subjectId].questionsCorrect += q.correct;
      } else {
        metrics[q.subjectId] = {
          name: q.subjectName,
          studySeconds: 0,
          grossSeconds: 0,
          questionsAttempted: q.attempted,
          questionsCorrect: q.correct,
          totalSubtopics: 0,
          completedSubtopics: 0,
          completedVideos: 0,
          completedPdfs: 0,
        };
      }
    });

    return Object.values(metrics);
  };

  const subjectMetrics = getSubjectMetrics();

  const formatSecondsToText = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    if (hrs === 0) return `${mins}m`;
    return `${hrs}h ${mins}m`;
  };

  const revisionNotes = sessions.filter((s) => s.notes && s.notes.trim().length > 0).slice(0, 5);

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h2>Dashboards de Evolução & Rastreador Gran</h2>
        <p className="tab-description">
          Analise o tempo acumulado, evolução nos exercícios, acompanhamento de videoaulas/PDFs e administre seu Caderno de Erros ativos.
        </p>
      </div>

      {/* OVERVIEW CARDS: 4-COLUMN GRID */}
      <div className="placeholder-grid" style={{ marginBottom: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {/* Horas Líquidas */}
        <div className="placeholder-card card-primary" style={{ padding: '1.5rem', minHeight: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-primary-glow)', borderRadius: '12px' }}>
              <Clock size={24} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                Horas Líquidas
              </span>
              <h3 style={{ fontSize: '1.8rem', marginTop: '0.1rem', color: 'var(--text-title)' }}>{totalHoursStudied}h</h3>
              {parseFloat(videoHoursSaved) > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#c8102e', fontWeight: 700, marginTop: '2px' }}>
                  ⚡ +{videoHoursSaved}h economizadas no Gran
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Taxa de Acertos */}
        <div className="placeholder-card card-secondary" style={{ padding: '1.5rem', minHeight: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-secondary-glow)', borderRadius: '12px' }}>
              <Award size={24} style={{ color: 'var(--color-secondary)' }} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                Taxa de Acertos
              </span>
              <h3 style={{ fontSize: '1.8rem', marginTop: '0.1rem', color: 'var(--text-title)' }}>
                {totalRate > 0 ? `${totalRate.toFixed(1)}%` : '0.0%'}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {totalQuestionsCorrect} de {totalQuestionsAttempted} questões
              </div>
            </div>
          </div>
        </div>

        {/* Videoaulas Gran */}
        <div className="placeholder-card card-primary" style={{ padding: '1.5rem', minHeight: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(200, 16, 46, 0.1)', borderRadius: '12px' }}>
              <Video size={24} style={{ color: '#c8102e' }} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                Videoaulas Gran
              </span>
              <h3 style={{ fontSize: '1.8rem', marginTop: '0.1rem', color: '#c8102e' }}>
                {completedVideos} <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>/ {totalSubtopics}</span>
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {videoCoveragePct}% das videoaulas assistidas
              </div>
            </div>
          </div>
        </div>

        {/* PDFs Gran */}
        <div className="placeholder-card card-secondary" style={{ padding: '1.5rem', minHeight: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderRadius: '12px' }}>
              <FileText size={24} style={{ color: '#2563eb' }} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                PDFs Gran Lidos
              </span>
              <h3 style={{ fontSize: '1.8rem', marginTop: '0.1rem', color: '#2563eb' }}>
                {completedPdfs} <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>/ {totalSubtopics}</span>
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {pdfCoveragePct}% dos PDFs lidos
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SPECIAL GRAN PRODUCTIVITY BANNER */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(200, 16, 46, 0.08), rgba(2, 132, 199, 0.08))',
        border: '1.5px solid rgba(200, 16, 46, 0.2)',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 300px' }}>
          <div style={{ padding: '12px', background: '#c8102e', color: '#ffffff', borderRadius: '12px' }}>
            <Zap size={24} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-title)' }}>
              Rendimento de Videoaulas Gran (Playback Acelerado)
            </h4>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              {parseFloat(videoHoursSaved) > 0 ? (
                <>
                  Graças ao reprodutor acelerado do Gran (1.25x a 2.0x), você absorveu <strong>{totalVideoGrossHours}h de videoaulas</strong> em apenas <strong>{totalVideoLiquidHours}h de estudo líquido</strong> ({completedVideos}/{totalSubtopics} videoaulas assistidas · {theoryCoveragePct}% do edital coberto).
                </>
              ) : (
                <>
                  Acompanhe a economia de tempo das videoaulas assistidas com velocidade de reprodução (1.25x a 2.0x). Até o momento: <strong>{completedVideos}/{totalSubtopics}</strong> videoaulas assistidas ({videoCoveragePct}% das videoaulas · {theoryCoveragePct}% do edital coberto).
                </>
              )}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', background: 'var(--card-bg)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>+{videoHoursSaved}h</div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Tempo Economizado</div>
          </div>
          <div style={{ textAlign: 'center', background: 'var(--card-bg)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>{totalNotesCount}</div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Notas de Aula Salvas</div>
          </div>
        </div>
      </div>

      {/* Caderno de Erros Ativos */}
      <div className="placeholder-card card-primary" style={{
        padding: '1.5rem',
        marginBottom: '1.5rem',
        borderColor: activeErrors.length > 0 ? 'rgba(239, 68, 68, 0.2)' : 'var(--border-color)',
        boxShadow: activeErrors.length > 0 ? '0 4px 20px rgba(239, 68, 68, 0.05)' : 'var(--box-shadow)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <AlertCircle size={20} style={{ color: 'var(--color-danger)' }} />
          <h3>Caderno de Erros Ativos ({activeErrors.length})</h3>
        </div>

        {activeErrors.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>
            Nenhum erro ativo no momento para este ciclo. Bons estudos!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
            {activeErrors.map((errorLog) => (
              <div key={errorLog.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'rgba(239, 68, 68, 0.03)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderLeft: '4px solid var(--color-danger)',
                padding: '1rem',
                borderRadius: '10px',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-title)' }}>{errorLog.subjectName}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{errorLog.topicName}</span>
                    <span style={{
                      fontSize: '0.65rem',
                      backgroundColor: 'var(--bg-element)',
                      color: 'var(--text-title)',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontWeight: 'bold'
                    }}>{errorLog.banca}</span>
                  </div>
                  {errorLog.insightAncoragem ? (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-title)', fontStyle: 'italic', lineHeight: '1.4' }}>
                      &ldquo;{errorLog.insightAncoragem}&rdquo;
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sem insight de ancoragem.</p>
                  )}
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Desempenho: {errorLog.correct} acertos de {errorLog.attempted} questões ({((errorLog.correct/errorLog.attempted)*100).toFixed(0)}%) · {new Date(errorLog.date).toLocaleDateString('pt-BR')}
                  </div>
                </div>

                <button
                  onClick={() => handleMarkErrorReviewed(errorLog.id)}
                  className="mock-btn"
                  style={{
                    backgroundColor: 'var(--color-success)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}
                >
                  <CheckCircle size={16} /> Resolvido
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Heatmap Section */}
      <div className="placeholder-card card-primary" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Calendar size={20} style={{ color: 'var(--color-primary)' }} />
          <h3>Constância nos Estudos deste Ciclo</h3>
        </div>
        
        <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateRows: 'repeat(7, 12px)',
            gridAutoFlow: 'column',
            gap: '4px',
            width: 'max-content',
            padding: '0.5rem 0'
          }}>
            {heatmapDays.map((day) => (
              <div
                key={day.dateStr}
                title={day.label}
                className="heatmap-cell"
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  backgroundColor: day.hours > 0 && day.hours < 1
                    ? 'rgba(52, 211, 153, 0.25)'
                    : day.hours >= 1 && day.hours < 2.5
                    ? 'rgba(52, 211, 153, 0.55)'
                    : day.hours >= 2.5
                    ? 'var(--color-success)'
                    : 'var(--bg-element)',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', alignItems: 'center' }}>
          <span>Sem registros</span>
          <div style={{ display: 'flex', gap: '3px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '1px', backgroundColor: 'var(--bg-element)' }}></div>
            <div style={{ width: '10px', height: '10px', borderRadius: '1px', backgroundColor: 'rgba(52, 211, 153, 0.25)' }}></div>
            <div style={{ width: '10px', height: '10px', borderRadius: '1px', backgroundColor: 'rgba(52, 211, 153, 0.55)' }}></div>
            <div style={{ width: '10px', height: '10px', borderRadius: '1px', backgroundColor: 'var(--color-success)' }}></div>
          </div>
          <span>Mais de 2.5h</span>
        </div>
      </div>

      {/* Detail Analytics Grid */}
      <div className="responsive-split-grid-four">
        
        {/* Left: Study hours & Gran Class progress per subject */}
        <div className="placeholder-card card-primary" style={{ height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Clock size={18} style={{ color: 'var(--color-primary)' }} />
            <h3>Horas Estudadas & Acompanhamento Gran</h3>
          </div>

          {subjectMetrics.filter(m => m.studySeconds > 0 || m.completedVideos > 0 || m.completedPdfs > 0).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>
              Nenhum dado de estudo disponível. Complete sessões no cronômetro ou marque aulas no Edital.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {subjectMetrics
                .filter((m) => m.studySeconds > 0 || m.completedVideos > 0 || m.completedPdfs > 0)
                .sort((a, b) => b.studySeconds - a.studySeconds)
                .map((m) => {
                  const maxSeconds = Math.max(...subjectMetrics.map((x) => x.studySeconds), 1);
                  const widthPercent = maxSeconds > 0 ? (m.studySeconds / maxSeconds) * 100 : 0;
                  return (
                    <div key={m.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '6px' }}>
                        <span>{m.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                          <span style={{ color: '#c8102e', fontWeight: 700 }}>🎬 {m.completedVideos}/{m.totalSubtopics}</span>
                          <span style={{ color: '#2563eb', fontWeight: 700 }}>📄 {m.completedPdfs}/{m.totalSubtopics}</span>
                          <span>{formatSecondsToText(m.studySeconds)}</span>
                        </div>
                      </div>
                      <div style={{ height: '10px', backgroundColor: 'var(--bg-element)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${widthPercent}%`,
                          background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))',
                          borderRadius: '5px'
                        }}></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Right: Accuracy per Subject */}
        <div className="placeholder-card card-secondary" style={{ height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Award size={18} style={{ color: 'var(--color-secondary)' }} />
            <h3>Taxa de Acertos por Matéria</h3>
          </div>

          {subjectMetrics.filter(m => m.questionsAttempted > 0).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>
              Nenhum dado de questões disponível. Registre na aba de Questões.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {subjectMetrics
                .filter((m) => m.questionsAttempted > 0)
                .sort((a, b) => {
                  const rateB = b.questionsCorrect / b.questionsAttempted;
                  const rateA = a.questionsCorrect / a.questionsAttempted;
                  return rateB - rateA;
                })
                .map((m) => {
                  const rate = (m.questionsCorrect / m.questionsAttempted) * 100;
                  return (
                    <div key={m.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)', marginBottom: '0.4rem' }}>
                        <span>{m.name}</span>
                        <span>{rate.toFixed(1)}% ({m.questionsCorrect}/{m.questionsAttempted})</span>
                      </div>
                      <div style={{ height: '10px', backgroundColor: 'var(--bg-element)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${rate}%`,
                          background: 'linear-gradient(90deg, var(--color-secondary), var(--color-accent))',
                          borderRadius: '5px'
                        }}></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

      </div>

      {/* Revision notes logger list */}
      <div className="placeholder-card card-primary" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <FileText size={20} style={{ color: 'var(--color-accent)' }} />
          <h3>Anotações de Estudo Recentes</h3>
        </div>

        {revisionNotes.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>
            Nenhuma anotação de revisão salva ainda para este ciclo. Adicione notas no cronômetro ou no edital verticalizado.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {revisionNotes.map((note) => (
              <div key={note.id} style={{
                backgroundColor: 'var(--bg-element)',
                padding: '1rem',
                borderRadius: '10px',
                borderLeft: '4px solid var(--color-accent)',
                fontSize: '0.9rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>{note.subjectName} · {note.topicName}</span>
                  <span>{new Date(note.date).toLocaleDateString('pt-BR')}</span>
                </div>
                <p style={{ color: 'var(--text-title)', lineHeight: '1.4' }}>{note.notes}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
