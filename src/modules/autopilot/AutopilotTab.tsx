import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../db/database';
import type {
  Subject,
  StudyBlock,
  SpacedReview,
  Flashcard,
  QuestionSession,
  AutopilotSettings,
  AutopilotDayMission,
  AutopilotTask,
  GamificationProfile,
  GamificationActionType,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  getTodayMission,
  calculateMissionProgress,
  formatLongPortugueseDate,
  getLocalDateString,
} from './autopilotEngine';
import { GamificationWidget } from './GamificationWidget';
import { calculateQuestionXp, XP_CONFIG } from './gamification';
import { FlashcardReviewModal } from '../flashcards/FlashcardReviewModal';
import { AiSyllabusImportModal } from '../syllabus/AiSyllabusImportModal';
import {
  Sparkles,
  CheckCircle2,
  Circle,
  ExternalLink,
  Play,
  Brain,
  Award,
  BookOpen,
  Settings,
  PlusCircle,
  Calendar,
  Clock,
  Video,
  FileText,
  X,
  Target,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface AutopilotTabProps {
  activeWorkspaceId: string;
  onStartStudy: (
    subjectId: string,
    subjectName: string,
    blockId: string,
    topicId?: string,
    subtopicId?: string
  ) => void;
  onRefreshStats?: () => void;
}

export const AutopilotTab: React.FC<AutopilotTabProps> = ({
  activeWorkspaceId,
  onStartStudy,
  onRefreshStats,
}) => {
  const { user } = useAuth();

  // Core loaded state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [cycleBlocks, setCycleBlocks] = useState<StudyBlock[]>([]);
  const [revisoes, setRevisoes] = useState<SpacedReview[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [todayQuestions, setTodayQuestions] = useState<QuestionSession[]>([]);
  const [settings, setSettings] = useState<AutopilotSettings>(() =>
    db.getAutopilotSettings(activeWorkspaceId)
  );
  const [todaySecondsStudied, setTodaySecondsStudied] = useState<number>(0);

  // Gamification state
  const [gamificationProfile, setGamificationProfile] = useState<GamificationProfile>(() =>
    db.getGamificationProfile()
  );
  const [recentXpAward, setRecentXpAward] = useState<{
    amount: number;
    description: string;
    id: number;
  } | null>(null);

  const triggerXpAward = useCallback(
    (type: GamificationActionType, amount: number, description: string) => {
      const res = db.awardXpAction(type, amount, description, activeWorkspaceId);
      setGamificationProfile(res.profile);
      setRecentXpAward({ amount, description, id: Date.now() });
      if (res.levelUp) {
        showToast(`🎉 PARABÉNS! Você subiu de nível! Agora é Nível ${res.newLevel}!`);
      }
    },
    [activeWorkspaceId]
  );

  // Dynamic engine state
  const [extraBlockIds, setExtraBlockIds] = useState<string[]>([]);

  // Flashcards review modal & daily count tracking
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewedFlashcardsToday, setReviewedFlashcardsToday] = useState<number>(() => {
    if (!activeWorkspaceId) return 0;
    const key = `concurso_estudos_fc_reviewed_${activeWorkspaceId}_${getLocalDateString()}`;
    const saved = localStorage.getItem(key);
    return saved ? parseInt(saved, 10) || 0 : 0;
  });

  // Settings modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<AutopilotSettings>(settings);
  const [isAiImportOpen, setIsAiImportOpen] = useState(false);

  // In-place questions logging state mapped by task.id
  const [questionInputs, setQuestionInputs] = useState<
    Record<string, { attempted: number | string; correct: number | string; notes: string; feedback?: string }>
  >({});

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 1. Load Data
  const loadWorkspaceData = useCallback(() => {
    if (!activeWorkspaceId) return;

    const syncRes = db.syncCycleSchedule(activeWorkspaceId);
    if (syncRes.wasReset) {
      showToast('🔄 Nova semana iniciada! O ciclo foi resetado e redistribuído para esta semana.');
    } else if (syncRes.wasReallocated) {
      showToast('⚡ Blocos pendentes de dias anteriores foram automaticamente reagendados para hoje.');
    }

    const subs = db.getSubjects(activeWorkspaceId);
    const blocks = syncRes.blocks;
    const revs = db.getRevisoes(activeWorkspaceId);
    const cards = db.getFlashcards(activeWorkspaceId);
    const stt = db.getAutopilotSettings(activeWorkspaceId);

    const todayStr = getLocalDateString();
    const allQuestions = db.getQuestions();
    const todayQ = allQuestions.filter(
      (q) => q.workspaceId === activeWorkspaceId && q.date.startsWith(todayStr)
    );

    const allSessions = db.getSessions();
    const todayS = allSessions
      .filter((s) => s.workspaceId === activeWorkspaceId && s.date.startsWith(todayStr))
      .reduce((sum, s) => sum + s.durationSeconds, 0);

    const fcKey = `concurso_estudos_fc_reviewed_${activeWorkspaceId}_${todayStr}`;
    const fcSaved = localStorage.getItem(fcKey);
    setReviewedFlashcardsToday(fcSaved ? parseInt(fcSaved, 10) || 0 : 0);

    setSubjects(subs);
    setCycleBlocks(blocks);
    setRevisoes(revs);
    setFlashcards(cards);
    setSettings(stt);
    setTempSettings(stt);
    setTodayQuestions(todayQ);
    setTodaySecondsStudied(todayS);
    setGamificationProfile(db.getGamificationProfile());
  }, [activeWorkspaceId]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // 2. Compute Mission through pure engine
  const mission: AutopilotDayMission = useMemo(() => {
    return getTodayMission(
      activeWorkspaceId,
      subjects,
      cycleBlocks,
      revisoes,
      flashcards,
      settings,
      todayQuestions,
      extraBlockIds
    );
  }, [
    activeWorkspaceId,
    subjects,
    cycleBlocks,
    revisoes,
    flashcards,
    settings,
    todayQuestions,
    extraBlockIds,
  ]);

  // Progress metrics
  const progress = useMemo(
    () => calculateMissionProgress(mission, reviewedFlashcardsToday),
    [mission, reviewedFlashcardsToday]
  );

  // User contest target for leaderboard
  const userConcursoTarget = useMemo(() => {
    if (!activeWorkspaceId) return undefined;
    const info = db.getConcursoInfo(activeWorkspaceId);
    if (!info) return undefined;
    const parts = [info.concurso, info.cargo].filter(Boolean);
    return parts.length > 0 ? parts.join(' • ') : undefined;
  }, [activeWorkspaceId]);

  // Flashcards due today
  const dueFlashcards = useMemo(() => {
    const todayStr = getLocalDateString();
    return flashcards.filter((f) => f.dueDate <= todayStr);
  }, [flashcards]);

  // Handlers
  const handleToggleReviewDone = (reviewId: string) => {
    const todayIso = new Date().toISOString();
    let justCompleted = false;
    let justUndone = false;
    let revTopicName = '';
    const updated = revisoes.map((r) => {
      if (r.id === reviewId) {
        const nextDone = !r.done;
        if (nextDone) {
          justCompleted = true;
          revTopicName = r.topicName;
        } else {
          justUndone = true;
          revTopicName = r.topicName;
        }
        return {
          ...r,
          done: nextDone,
          completedAt: nextDone ? todayIso : undefined,
        };
      }
      return r;
    });
    db.saveRevisoes(activeWorkspaceId, updated);
    setRevisoes(updated);
    if (justCompleted) {
      triggerXpAward('review_completed', XP_CONFIG.REVIEW_COMPLETED, `Revisão concluída: ${revTopicName}`);
      showToast(`✓ Revisão concluída! +${XP_CONFIG.REVIEW_COMPLETED} XP!`);
    } else if (justUndone) {
      triggerXpAward('review_completed', -XP_CONFIG.REVIEW_COMPLETED, `Revisão desfeita: ${revTopicName}`);
      showToast(`Revisão desfeita (-${XP_CONFIG.REVIEW_COMPLETED} XP)`);
    }
    if (onRefreshStats) onRefreshStats();
  };

  const handleMarkTheoryCompleted = (task: AutopilotTask) => {
    if (task.theoryCompleted) return;

    const duration = task.theoryMinutes * 60;
    const { scheduledReview } = db.completeSubtopicAndAdvance(
      activeWorkspaceId,
      task.subjectId,
      task.topicId,
      task.subtopicId,
      duration,
      task.blockId
    );

    triggerXpAward(
      'theory_completed',
      XP_CONFIG.THEORY_COMPLETED,
      `Teoria concluída: ${task.subtopicName}`
    );

    loadWorkspaceData();
    if (onRefreshStats) onRefreshStats();

    if (scheduledReview) {
      showToast(
        `✓ +${XP_CONFIG.THEORY_COMPLETED} XP! Teoria de "${task.subtopicName}" concluída! Revisão de 24h (D+1) programada para amanhã.`
      );
    } else {
      showToast(`✓ +${XP_CONFIG.THEORY_COMPLETED} XP! Teoria de "${task.subtopicName}" marcada como concluída!`);
    }
  };

  const handleSaveQuestions = (task: AutopilotTask) => {
    const input = questionInputs[task.id] || {
      attempted: task.questionsTarget,
      correct: task.questionsTarget,
      notes: '',
    };

    const attemptedNum = Number(input.attempted);
    const correctNum = Number(input.correct);

    if (isNaN(attemptedNum) || attemptedNum <= 0) {
      alert('Informe uma quantidade válida de questões tentadas.');
      return;
    }

    if (isNaN(correctNum) || correctNum < 0 || correctNum > attemptedNum) {
      alert('O número de acertos deve ser um número entre 0 e o total tentado.');
      return;
    }

    db.recordSubtopicQuestions(
      activeWorkspaceId,
      task.subjectId,
      task.topicId,
      task.subtopicId,
      attemptedNum,
      correctNum,
      settings.banca,
      input.notes
    );

    const pct = Math.round((correctNum / attemptedNum) * 100);
    const xpEarned = calculateQuestionXp(attemptedNum, correctNum);

    setQuestionInputs((prev) => ({
      ...prev,
      [task.id]: {
        ...input,
        attempted: attemptedNum,
        correct: correctNum,
        feedback: `✓ Registrado: ${correctNum}/${attemptedNum} (${pct}%) • +${xpEarned} XP`,
      },
    }));

    triggerXpAward(
      'questions_saved',
      xpEarned,
      `${attemptedNum} questões (${correctNum} acertos)`
    );

    loadWorkspaceData();
    if (onRefreshStats) onRefreshStats();
    showToast(`🎯 +${xpEarned} XP! ${attemptedNum} questões registradas (${pct}% de acertos)!`);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    db.saveAutopilotSettings(activeWorkspaceId, tempSettings);
    setSettings(tempSettings);
    setIsSettingsModalOpen(false);
    showToast('⚙ Preferências do Piloto Automático atualizadas!');
  };

  const handlePullNextBlock = () => {
    // Find next block from cycle that is not in today's mission
    const currentBlockIds = new Set(mission.tasks.map((t) => t.blockId));
    const nextBlock = cycleBlocks.find((b) => !currentBlockIds.has(b.id) && !b.completed);

    if (!nextBlock) {
      const anyNext = cycleBlocks.find((b) => !currentBlockIds.has(b.id));
      if (!anyNext) {
        alert('Todos os blocos do seu ciclo já foram incluídos no dia de hoje!');
        return;
      }
      setExtraBlockIds((prev) => [...prev, anyNext.id]);
      showToast(`+ Bloco de "${anyNext.subjectName}" adicionado à missão de hoje!`);
      return;
    }

    setExtraBlockIds((prev) => [...prev, nextBlock.id]);
    showToast(`+ Bloco de "${nextBlock.subjectName}" adicionado à missão de hoje!`);
  };

  const formatStudyTime = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="tab-content autopilot-tab" style={{ maxWidth: '1080px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '0.95rem',
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <Sparkles size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION: ZERO DECISION FATIGUE */}
      <div
        className="placeholder-card"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(56, 189, 248, 0.08))',
          borderColor: 'rgba(99, 102, 241, 0.25)',
          padding: '1.75rem 2rem',
          borderRadius: '18px',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={13} />
                Piloto Automático
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {formatLongPortugueseDate(new Date())}
              </span>
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-title)', letterSpacing: '-0.5px' }}>
              Missão de Hoje
            </h1>
            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
              Siga as tarefas abaixo na ordem indicada. Sem fadiga de decisão, sem dúvida sobre o que fazer.
            </p>
          </div>

          {/* Quick Metrics & Controls */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Estudo Líquido Hoje
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-success)', marginTop: '2px' }}>
                {formatStudyTime(todaySecondsStudied)}
              </div>
            </div>

            <button
              onClick={handlePullNextBlock}
              title="Adicionar mais um bloco de matéria para estudar hoje"
              style={{
                backgroundColor: 'var(--bg-element)',
                color: 'var(--text-title)',
                border: '1px solid var(--border-color)',
                padding: '10px 14px',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <PlusCircle size={16} />
              + Estudar Mais um Bloco Hoje
            </button>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              title="Configurar metas do piloto automático"
              style={{
                backgroundColor: 'var(--bg-element)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                padding: '10px',
                borderRadius: '12px',
                transition: 'all 0.2s',
              }}
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-title)' }}>
              Progresso do Dia: {progress.completedItems} de {progress.totalItems} etapas concluídas
            </span>
            <span style={{ color: progress.percentage === 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>
              {progress.percentage}%
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '10px',
              backgroundColor: 'var(--bg-element)',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                width: `${progress.percentage}%`,
                height: '100%',
                background:
                  progress.percentage === 100
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))',
                borderRadius: '6px',
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
        </div>
      </div>

      {/* EMPTY ONBOARDING BANNER IF NO SUBJECTS */}
      {subjects.length === 0 ? (
        <div
          className="card-primary"
          style={{
            padding: '2.5rem 2rem',
            textAlign: 'center',
            borderRadius: '16px',
            marginBottom: '2rem',
            border: '1px solid var(--border-color)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <Sparkles size={28} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-title)', marginBottom: '0.5rem' }}>
            Configure Seu Primeiro Edital Para Ativar o Piloto Automático
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', maxWidth: '580px', margin: '0 auto 1.5rem', lineHeight: '1.6' }}>
            O Piloto Automático precisa conhecer as disciplinas do seu edital para calcular sua missão diária personalizada. Importe seu edital com IA em 1 minuto para começar.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setIsAiImportOpen(true)}
              className="mock-btn"
              style={{
                padding: '0.8rem 1.6rem',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={16} />
              <span>Importar Edital com IA</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* GAMIFICATION & LEADERBOARD WIDGET */}
          <GamificationWidget
            profile={gamificationProfile}
            userName={user?.name || 'Você'}
            userConcursoTarget={userConcursoTarget}
            todayStr={getLocalDateString()}
            recentXpAward={recentXpAward}
          />

          {/* CARD 1: REVISÕES RÁPIDAS DE HOJE */}
          <section style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.9rem',
            }}
          >
            1
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-title)' }}>
            Revisões Rápidas de Hoje
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            (Faça antes de iniciar matéria nova para fixar na memória)
          </span>
        </div>

        <div className="placeholder-card" style={{ padding: '1.25rem 1.5rem', borderRadius: '16px' }}>
          {/* Anki Flashcards Prompt */}
          {dueFlashcards.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '1rem 1.25rem',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '12px',
                marginBottom: mission.dueReviews.length > 0 ? '1rem' : '0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: '#ffffff',
                    padding: '8px',
                    borderRadius: '10px',
                  }}
                >
                  <Brain size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-title)', fontSize: '0.95rem' }}>
                    {dueFlashcards.length} flashcard{dueFlashcards.length > 1 ? 's' : ''} para revisar no SM-2
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Repetição espaçada algorítmica ativa hoje.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsReviewModalOpen(true)}
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px var(--color-primary-glow)',
                }}
              >
                <Brain size={16} />
                Revisar {dueFlashcards.length} Flashcard{dueFlashcards.length > 1 ? 's' : ''} (+10 XP/card)
              </button>
            </div>
          )}

          {dueFlashcards.length === 0 && reviewedFlashcardsToday > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '10px',
                marginBottom: mission.dueReviews.length > 0 ? '1rem' : '0',
                color: 'var(--color-success)',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} />
                <span>✓ {reviewedFlashcardsToday} flashcard(s) revisados hoje com algoritmo SM-2! Deck em dia.</span>
              </div>
              {flashcards.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(true)}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-title)',
                    border: '1px solid var(--border-color)',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                  title="Praticar todos os cards em modo livre"
                >
                  <Brain size={14} /> Reforço Livre ({flashcards.length})
                </button>
              )}
            </div>
          )}

          {dueFlashcards.length === 0 && reviewedFlashcardsToday === 0 && flashcards.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: 'var(--bg-element)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                marginBottom: mission.dueReviews.length > 0 ? '1rem' : '0',
                color: 'var(--text-title)',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={18} style={{ color: 'var(--color-primary)' }} />
                <span>Você tem <strong>{flashcards.length}</strong> flashcards cadastrados (nenhum vence hoje).</span>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(true)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-title)',
                  border: '1px solid var(--border-color)',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                }}
                title="Praticar todos os cards em modo livre"
              >
                <Brain size={14} /> Praticar em Modo Livre
              </button>
            </div>
          )}

          {/* Spaced Reviews Checklist */}
          {mission.dueReviews.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Revisões Espaçadas Agendadas
              </div>
              {mission.dueReviews.map((rev) => {
                return (
                  <div
                    key={rev.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: rev.done ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-element)',
                      border: `1px solid ${rev.done ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button
                        onClick={() => handleToggleReviewDone(rev.id)}
                        style={{ color: rev.done ? 'var(--color-success)' : 'var(--text-muted)' }}
                      >
                        {rev.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                      </button>
                      <div>
                        <span
                          style={{
                            fontWeight: 700,
                            color: rev.done ? 'var(--text-muted)' : 'var(--text-title)',
                            textDecoration: rev.done ? 'line-through' : 'none',
                            fontSize: '0.9rem',
                          }}
                        >
                          {rev.subjectName} • {rev.topicName}
                        </span>
                        <span
                          style={{
                            marginLeft: '8px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(99, 102, 241, 0.15)',
                            color: 'var(--color-primary)',
                          }}
                        >
                          {rev.days === 1 ? 'D+1 (24h)' : `D+${rev.days}`}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleReviewDone(rev.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        backgroundColor: rev.done ? 'var(--bg-element)' : 'var(--color-success)',
                        color: rev.done ? 'var(--text-muted)' : '#ffffff',
                      }}
                    >
                      {rev.done ? 'Desfazer' : '✓ Concluir (+30 XP)'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : dueFlashcards.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '1.25rem',
                color: 'var(--color-success)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={20} />
              <span>Tudo revisado por hoje! Você está 100% em dia com a curva de retenção. 🎉</span>
            </div>
          ) : null}
        </div>
      </section>

      {/* CARD 2 & 3: TAREFAS DE ESTUDO (TEORIA + BATERIA DE QUESTÕES) */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              color: 'var(--color-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.9rem',
            }}
          >
            2
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-title)' }}>
            Teoria & Bateria Dirigida
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            ({mission.tasks.length} matéria{mission.tasks.length > 1 ? 's' : ''} no cronograma de hoje)
          </span>
        </div>

        {/* All Cycle Blocks Completed Banner */}
        {cycleBlocks.length > 0 && cycleBlocks.every((b) => b.completed) && (
          <div
            style={{
              padding: '1.5rem',
              borderRadius: '16px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}
              >
                <Award size={22} /> Todos os blocos do ciclo foram concluídos!
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Parabéns pelo ritmo! Deseja reiniciar a rotação do ciclo para continuar avançando nos próximos tópicos do edital?
              </p>
            </div>
            <button
              onClick={() => {
                const updated = db.restartCycle(activeWorkspaceId);
                setCycleBlocks(updated);
                showToast('🚀 Ciclo reiniciado com sucesso! Blocos redefinidos e prontos para estudo.');
              }}
              style={{
                backgroundColor: 'var(--color-success)',
                color: '#ffffff',
                padding: '10px 18px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                border: 'none',
              }}
            >
              <RefreshCw size={16} />
              Reiniciar Ciclo Agora (Avançar no Edital)
            </button>
          </div>
        )}

        {mission.tasks.length === 0 ? (
          <div className="placeholder-card" style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Nenhum bloco de estudo programado para hoje. Clique em "+ Mais 1 Bloco" acima para puxar o próximo bloco do ciclo!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {mission.tasks.map((task, idx) => {
              const taskInput = questionInputs[task.id] || {
                attempted: task.questionsTarget,
                correct: task.questionsTarget,
                notes: '',
              };

              return (
                <div
                  key={task.id}
                  className="placeholder-card"
                  style={{
                    padding: '1.5rem',
                    borderRadius: '16px',
                    border: task.theoryCompleted && task.questionsAttempted >= task.questionsTarget
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : '1px solid var(--border-color)',
                  }}
                >
                  {/* Task Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-element)',
                            color: 'var(--color-primary)',
                            textTransform: 'uppercase',
                          }}
                        >
                          Bloco {idx + 1} • {task.subjectName}
                        </span>
                        {task.isRevision && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              color: 'var(--color-warning)',
                            }}
                          >
                            Revisão Profunda (Edital 100%)
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-title)', marginTop: '4px' }}>
                        {task.subtopicName}
                      </h3>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Tópico: {task.topicName}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: 'var(--bg-element)',
                          padding: '6px 10px',
                          borderRadius: '8px',
                        }}
                      >
                        <Clock size={14} />
                        Meta: {task.theoryMinutes} min
                      </span>
                    </div>
                  </div>

                  {/* External Media Links if available */}
                  {(task.videoLesson || task.videoUrl || task.pdfLesson || task.pdfUrl) && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.6rem',
                        flexWrap: 'wrap',
                        marginBottom: '1rem',
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg-element)',
                        borderRadius: '10px',
                      }}
                    >
                      {(task.videoLesson || task.videoUrl) && (
                        <a
                          href={task.videoUrl || '#'}
                          target={task.videoUrl ? '_blank' : '_self'}
                          rel="noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: 'var(--color-secondary)',
                            textDecoration: 'none',
                          }}
                        >
                          <Video size={14} />
                          {task.videoLesson || 'Videoaula Gran'}
                          {task.videoBlock ? ` (${task.videoBlock})` : ''}
                          {task.videoUrl && <ExternalLink size={12} />}
                        </a>
                      )}
                      {(task.pdfLesson || task.pdfUrl) && (
                        <a
                          href={task.pdfUrl || '#'}
                          target={task.pdfUrl ? '_blank' : '_self'}
                          rel="noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: 'var(--color-accent)',
                            textDecoration: 'none',
                          }}
                        >
                          <FileText size={14} />
                          {task.pdfLesson || 'PDF da Aula'}
                          {task.pdfPages ? ` (${task.pdfPages})` : ''}
                          {task.pdfUrl && <ExternalLink size={12} />}
                        </a>
                      )}
                    </div>
                  )}

                  {/* SUBSECTION A: TEORIA */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      backgroundColor: task.theoryCompleted ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-element)',
                      border: `1px solid ${task.theoryCompleted ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
                      marginBottom: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ color: task.theoryCompleted ? 'var(--color-success)' : 'var(--text-muted)' }}>
                        {task.theoryCompleted ? <CheckCircle2 size={22} /> : <BookOpen size={22} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-title)' }}>
                          Etapa 1: Teoria / Videoaula
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {task.theoryCompleted
                            ? '✓ Concluído hoje • Revisão D+1 agendada para amanhã'
                            : `Estude o conteúdo por aproximadamente ${task.theoryMinutes} min.`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {!task.theoryCompleted && (
                        <button
                          onClick={() =>
                            onStartStudy(
                              task.subjectId,
                              task.subjectName,
                              task.blockId,
                              task.topicId,
                              task.subtopicId
                            )
                          }
                          style={{
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-title)',
                            border: '1px solid var(--border-color)',
                            padding: '7px 12px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <Play size={14} />
                          Iniciar no Cronômetro
                        </button>
                      )}

                      <button
                        onClick={() => handleMarkTheoryCompleted(task)}
                        disabled={task.theoryCompleted}
                        style={{
                          backgroundColor: task.theoryCompleted ? 'var(--bg-card)' : 'var(--color-primary)',
                          color: task.theoryCompleted ? 'var(--color-success)' : '#ffffff',
                          border: task.theoryCompleted ? '1px solid rgba(16, 185, 129, 0.3)' : 'none',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          cursor: task.theoryCompleted ? 'default' : 'pointer',
                          opacity: task.theoryCompleted ? 0.9 : 1,
                        }}
                      >
                        <CheckCircle2 size={14} />
                        {task.theoryCompleted ? 'Teoria Concluída (+50 XP) ✓' : 'Marcar Teoria Concluída (+50 XP)'}
                      </button>
                    </div>
                  </div>

                  {/* SUBSECTION B: BATERIA DE QUESTÕES DIRIGIDA */}
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ color: 'var(--color-warning)' }}>
                          <Target size={22} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-title)' }}>
                            Etapa 2: Faça {task.questionsTarget} questões da {settings.banca} sobre "{task.subtopicName}"
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Filtro cirúrgico com assunto oficial cadastrado no Gran Questões.
                          </div>
                        </div>
                      </div>

                      {/* Surgical Gran Questions Link */}
                      <a
                        href={task.granQuestionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          color: '#d97706',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          textDecoration: 'none',
                        }}
                      >
                        <ExternalLink size={15} />
                        Abrir no Gran Questões (Filtro Cirúrgico)
                      </a>
                    </div>

                    {/* In-place quick question registration */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        backgroundColor: 'var(--bg-element)',
                        padding: '10px 14px',
                        borderRadius: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          Acertos:
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={typeof taskInput.attempted === 'number' ? taskInput.attempted : undefined}
                          value={taskInput.correct}
                          onChange={(e) =>
                            setQuestionInputs((prev) => ({
                              ...prev,
                              [task.id]: {
                                ...taskInput,
                                correct: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0),
                              },
                            }))
                          }
                          style={{
                            width: '60px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-title)',
                            fontWeight: 700,
                            textAlign: 'center',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          Total / Tentadas:
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={taskInput.attempted}
                          onChange={(e) =>
                            setQuestionInputs((prev) => ({
                              ...prev,
                              [task.id]: {
                                ...taskInput,
                                attempted: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0),
                              },
                            }))
                          }
                          style={{
                            width: '60px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-title)',
                            fontWeight: 700,
                            textAlign: 'center',
                          }}
                        />
                      </div>

                      <button
                        onClick={() => handleSaveQuestions(task)}
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: '#ffffff',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Award size={14} />
                        Salvar Desempenho (+{calculateQuestionXp(Number(taskInput.attempted) || 0, Number(taskInput.correct) || 0)} XP)
                      </button>

                      {task.questionsAttempted > 0 && (
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={14} />
                          Hoje: {task.questionsCorrect}/{task.questionsAttempted} ({Math.round((task.questionsCorrect / task.questionsAttempted) * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CARD 4: SEU AMANHÃ JÁ PROGRAMADO */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.9rem',
            }}
          >
            3
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-title)' }}>
            Seu Amanhã Já Programado
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            (Previsão calculada automaticamente conforme seu progresso)
          </span>
        </div>

        <div
          className="placeholder-card"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.04), rgba(99, 102, 241, 0.04))',
            border: '1px dashed var(--border-color)',
            padding: '1.5rem',
            borderRadius: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontWeight: 800, color: 'var(--text-title)', fontSize: '0.95rem' }}>
                Amanhã • {mission.tomorrow?.dayName} ({mission.tomorrow?.dateStr})
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Zero planejamento manual necessário
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Upcoming Subjects */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Próximas Matérias & Tópicos
              </div>
              {mission.tomorrow?.tasks && mission.tomorrow.tasks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {mission.tomorrow.tasks.map((tt, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <ArrowRight size={15} style={{ color: 'var(--color-primary)', marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-title)' }}>
                          {tt.subjectName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {tt.subtopicName} • Meta: {tt.questionsTarget} questões {settings.banca}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Aguardando encerramento do dia atual.
                </div>
              )}
            </div>

            {/* Upcoming Reviews */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Revisões Espaçadas & Flashcards Previstos
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {mission.tomorrow?.maturingReviews && mission.tomorrow.maturingReviews.length > 0 ? (
                  mission.tomorrow.maturingReviews.map((mr, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(99, 102, 241, 0.15)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        {mr.days === 1 ? 'D+1' : `D+${mr.days}`}
                      </span>
                      <span style={{ color: 'var(--text-title)', fontWeight: 600 }}>
                        {mr.subjectName} • {mr.topicName}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {settings.autoScheduleD1Review
                      ? 'Revisões D+1 das matérias de hoje serão inseridas aqui ao concluir.'
                      : 'Nenhuma revisão agendada para amanhã.'}
                  </div>
                )}

                {mission.tomorrow?.maturingFlashcardsCount ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600, marginTop: '4px' }}>
                    🧠 {mission.tomorrow.maturingFlashcardsCount} flashcard(s) amadurecem amanhã
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
        </>
      )}

      {/* FLASHCARD REVIEW MODAL */}
      <FlashcardReviewModal
        isOpen={isReviewModalOpen}
        cards={dueFlashcards.length > 0 ? dueFlashcards : flashcards}
        onSaveCard={(card) => {
          const updated = flashcards.map((c) => (c.id === card.id ? card : c));
          db.saveFlashcards(activeWorkspaceId, updated);
          setFlashcards(updated);
          const nextCount = reviewedFlashcardsToday + 1;
          setReviewedFlashcardsToday(nextCount);
          if (activeWorkspaceId) {
            const key = `concurso_estudos_fc_reviewed_${activeWorkspaceId}_${getLocalDateString()}`;
            localStorage.setItem(key, String(nextCount));
          }
          triggerXpAward('flashcard_reviewed', XP_CONFIG.FLASHCARD_REVIEWED, 'Flashcard revisado (SM-2)');
        }}
        onClose={() => {
          setIsReviewModalOpen(false);
          loadWorkspaceData();
          if (onRefreshStats) onRefreshStats();
        }}
      />

      {/* PREFERENCES MODAL */}
      {isSettingsModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="placeholder-card"
            style={{
              width: '90%',
              maxWidth: '480px',
              padding: '2rem',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-title)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} />
                Preferências do Piloto
              </h3>
              <button onClick={() => setIsSettingsModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '6px' }}>
                  Meta de Questões por Bloco
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[10, 15, 20, 30].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setTempSettings((prev) => ({ ...prev, questionsPerBlock: num }))}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        backgroundColor: tempSettings.questionsPerBlock === num ? 'var(--color-primary)' : 'var(--bg-element)',
                        color: tempSettings.questionsPerBlock === num ? '#ffffff' : 'var(--text-main)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {num} qts
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '6px' }}>
                  Duração Estimada da Teoria
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setTempSettings((prev) => ({ ...prev, theoryDurationMinutes: mins }))}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        backgroundColor: tempSettings.theoryDurationMinutes === mins ? 'var(--color-primary)' : 'var(--bg-element)',
                        color: tempSettings.theoryDurationMinutes === mins ? '#ffffff' : 'var(--text-main)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '6px' }}>
                  Banca Alvo Oficial
                </label>
                <select
                  value={tempSettings.banca}
                  onChange={(e) => {
                    const bName = e.target.value;
                    const idMap: Record<string, number> = { FCC: 92, CEBRASPE: 27, FGV: 102, VUNESP: 252 };
                    setTempSettings((prev) => ({
                      ...prev,
                      banca: bName,
                      bancaId: idMap[bName] || 92,
                    }));
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-element)',
                    color: 'var(--text-title)',
                    border: '1px solid var(--border-color)',
                    fontWeight: 600,
                  }}
                >
                  <option value="FCC">FCC (Fundação Carlos Chagas - ID 92)</option>
                  <option value="CEBRASPE">CEBRASPE / CESPE (ID 27)</option>
                  <option value="FGV">FGV (Fundação Getúlio Vargas - ID 102)</option>
                  <option value="VUNESP">VUNESP (ID 252)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="autoD1"
                  checked={tempSettings.autoScheduleD1Review}
                  onChange={(e) =>
                    setTempSettings((prev) => ({ ...prev, autoScheduleD1Review: e.target.checked }))
                  }
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="autoD1" style={{ fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                  Agendar revisão D+1 (24 horas) automaticamente ao concluir teoria
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-element)',
                    color: 'var(--text-muted)',
                    fontWeight: 700,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-primary)',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                >
                  Salvar Preferências
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Syllabus Import Modal */}
      <AiSyllabusImportModal
        isOpen={isAiImportOpen}
        onClose={() => setIsAiImportOpen(false)}
        onWorkspaceCreated={() => {
          loadWorkspaceData();
          if (onRefreshStats) onRefreshStats();
        }}
      />
    </div>
  );
};
