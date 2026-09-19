import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../db/database';
import type { Subject, StudySession, StudyType, SpacedReview, QuestionSession, RunningTimerState } from '../../types';
import { buildGranQuestoesUrl } from '../../data/tceGoPreset';
import { 
  Play, Pause, Square, RotateCcw, Save, X, BookOpen, 
  ExternalLink, Clock, Edit3, CheckCircle2
} from 'lucide-react';

interface TimerTabProps {
  selectedSubject: { id: string; name: string; topicId?: string; subtopicId?: string } | null;
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
  // Mode: live stopwatch/countdown OR manual entry
  const [activeMode, setActiveMode] = useState<'live' | 'manual'>('live');

  // Load database subjects
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  // Form states for Live Timer
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [subtopicId, setSubtopicId] = useState('');
  const [notes, setNotes] = useState('');
  const [studyType, setStudyType] = useState<StudyType>('teoria');
  const [sessionAcertos, setSessionAcertos] = useState(0);
  const [sessionErros, setSessionErros] = useState(0);
  const [scheduledIntervals, setScheduledIntervals] = useState<number[]>([]);
  
  // Gran Tracker states for Live Timer
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [videoLesson, setVideoLesson] = useState('');
  const [videoBlock, setVideoBlock] = useState('');
  const [pdfLesson, setPdfLesson] = useState('');
  const [pdfPages, setPdfPages] = useState('');
  const [markVideoWatched, setMarkVideoWatched] = useState(true);
  const [markPdfRead, setMarkPdfRead] = useState(true);
  const [markSubtopicCompleted, setMarkSubtopicCompleted] = useState(true);
  
  // Real Timestamp-based Live Timer states (immune to tab switching & throttling)
  const [timerMode, setTimerMode] = useState<'stopwatch' | 'countdown'>('countdown');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(0);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(90 * 60);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Manual Entry Form States
  const todayStr = new Date().toISOString().split('T')[0];
  const [manualDate, setManualDate] = useState(todayStr);
  const [manualHours, setManualHours] = useState<number | ''>('');
  const [manualMinutes, setManualMinutes] = useState<number | ''>(45);
  const [manualSubjectId, setManualSubjectId] = useState('');
  const [manualTopicId, setManualTopicId] = useState('');
  const [manualSubtopicId, setManualSubtopicId] = useState('');
  const [manualStudyType, setManualStudyType] = useState<StudyType>('teoria');
  const [manualAcertos, setManualAcertos] = useState<number | ''>('');
  const [manualErros, setManualErros] = useState<number | ''>('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualScheduledIntervals, setManualScheduledIntervals] = useState<number[]>([7]);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);

  // Gran Tracker states for Manual Entry
  const [manualPlaybackSpeed, setManualPlaybackSpeed] = useState<number>(1.0);
  const [manualVideoLesson, setManualVideoLesson] = useState('');
  const [manualVideoBlock, setManualVideoBlock] = useState('');
  const [manualPdfLesson, setManualPdfLesson] = useState('');
  const [manualPdfPages, setManualPdfPages] = useState('');
  const [manualMarkVideoWatched, setManualMarkVideoWatched] = useState(true);
  const [manualMarkPdfRead, setManualMarkPdfRead] = useState(true);
  const [manualMarkCompleted, setManualMarkCompleted] = useState(true);

  const timerRef = useRef<any>(null);
  const manualSubmitContainerRef = useRef<HTMLDivElement>(null);

  // 1. Load subjects & restore active timer from localStorage if present
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const list = db.getSubjects(activeWorkspaceId);
    setSubjects(list);

    // Check if there is an active timer running in the background for this workspace
    const savedTimer = db.getActiveTimer();
    if (savedTimer && savedTimer.workspaceId === activeWorkspaceId && savedTimer.isActive) {
      setSubjectId(savedTimer.subjectId);
      setTopicId(savedTimer.topicId || '');
      setSubtopicId(savedTimer.subtopicId || '');
      setTimerMode(savedTimer.timerMode);
      setDurationMinutes(savedTimer.durationMinutes);
      setStudyType(savedTimer.studyType);
      if (savedTimer.playbackSpeed) setPlaybackSpeed(savedTimer.playbackSpeed);
      if (savedTimer.videoLesson) setVideoLesson(savedTimer.videoLesson);
      if (savedTimer.videoBlock) setVideoBlock(savedTimer.videoBlock);
      if (savedTimer.pdfLesson) setPdfLesson(savedTimer.pdfLesson);
      if (savedTimer.pdfPages) setPdfPages(savedTimer.pdfPages);
      if (savedTimer.notes) setNotes(savedTimer.notes);
      setIsActive(savedTimer.isActive);
      setIsPaused(savedTimer.isPaused);
      setStartTime(savedTimer.startTime);
      setAccumulatedSeconds(savedTimer.accumulatedSeconds);

      // Compute elapsed immediately from timestamps
      let elapsed = savedTimer.accumulatedSeconds;
      if (!savedTimer.isPaused && savedTimer.startTime) {
        elapsed += Math.floor((Date.now() - savedTimer.startTime) / 1000);
      }
      setDisplaySeconds(elapsed);
      if (savedTimer.timerMode === 'countdown') {
        setTimeRemaining(Math.max(0, savedTimer.durationMinutes * 60 - elapsed));
      }
    } else if (selectedSubject) {
      setSubjectId(selectedSubject.id);
      const sub = list.find((s) => s.id === selectedSubject.id);
      if (sub && sub.topics.length > 0) {
        const targetTopic = selectedSubject.topicId
          ? sub.topics.find((t) => t.id === selectedSubject.topicId) || sub.topics[0]
          : sub.topics[0];
        setTopicId(targetTopic.id);
        if (targetTopic.subtopics.length > 0) {
          const targetSubtopic = selectedSubject.subtopicId
            ? targetTopic.subtopics.find((st) => st.id === selectedSubject.subtopicId) || targetTopic.subtopics[0]
            : targetTopic.subtopics[0];
          setSubtopicId(targetSubtopic.id);
        }
      }
    } else if (list.length > 0 && (!subjectId || !list.some(s => s.id === subjectId))) {
      setSubjectId(list[0].id);
      if (list[0].topics.length > 0) {
        setTopicId(list[0].topics[0].id);
        if (list[0].topics[0].subtopics.length > 0) {
          setSubtopicId(list[0].topics[0].subtopics[0].id);
        }
      }
    }

    if (list.length > 0 && (!manualSubjectId || !list.some(s => s.id === manualSubjectId))) {
      setManualSubjectId(list[0].id);
      if (list[0].topics.length > 0) {
        setManualTopicId(list[0].topics[0].id);
        if (list[0].topics[0].subtopics.length > 0) {
          setManualSubtopicId(list[0].topics[0].subtopics[0].id);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, activeWorkspaceId]);

  // Clean up selected block redirect when tab unmounts
  useEffect(() => {
    return () => {
      clearSelectedSubject();
    };
  }, [clearSelectedSubject]);

  // 2. Synchronize active timer to localStorage whenever timer state changes
  useEffect(() => {
    if (!activeWorkspaceId) return;

    if (isActive) {
      const sub = subjects.find(s => s.id === subjectId);
      const timerState: RunningTimerState = {
        isActive,
        isPaused,
        timerMode,
        durationMinutes,
        startTime,
        accumulatedSeconds,
        subjectId,
        subjectName: sub?.name || 'Estudo',
        topicId,
        subtopicId,
        studyType,
        notes: notes.trim() || undefined,
        workspaceId: activeWorkspaceId,
        playbackSpeed,
        videoLesson,
        videoBlock,
        pdfLesson,
        pdfPages
      };
      db.saveActiveTimer(timerState);
    } else {
      db.saveActiveTimer(null);
    }
  }, [isActive, isPaused, startTime, accumulatedSeconds, subjectId, topicId, subtopicId, timerMode, durationMinutes, studyType, notes, activeWorkspaceId, subjects, playbackSpeed, videoLesson, videoBlock, pdfLesson, pdfPages]);

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

  // Manual form subject/topic changes
  const handleManualSubjectChange = (id: string) => {
    setManualSubjectId(id);
    setManualTopicId('');
    setManualSubtopicId('');
    const sub = subjects.find((s) => s.id === id);
    if (sub && sub.topics.length > 0) {
      setManualTopicId(sub.topics[0].id);
      if (sub.topics[0].subtopics.length > 0) {
        setManualSubtopicId(sub.topics[0].subtopics[0].id);
      }
    }
  };

  const handleManualTopicChange = (id: string) => {
    setManualTopicId(id);
    setManualSubtopicId('');
    const sub = subjects.find((s) => s.id === manualSubjectId);
    if (sub) {
      const topic = sub.topics.find((t) => t.id === id);
      if (topic && topic.subtopics.length > 0) {
        setManualSubtopicId(topic.subtopics[0].id);
      }
    }
  };

  // Sync remaining seconds when countdown duration settings are modified (when not running)
  useEffect(() => {
    if (timerMode === 'countdown' && !isActive) {
      setTimeRemaining(durationMinutes * 60);
      setDisplaySeconds(0);
    }
  }, [durationMinutes, timerMode, isActive]);

  // Synth beep sound using Web Audio API
  const playAlarmSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
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

  // 3. Robust High-Precision Clock Loop using Date.now()
  useEffect(() => {
    if (isActive && !isPaused && startTime) {
      const tick = () => {
        const now = Date.now();
        const currentElapsed = accumulatedSeconds + Math.floor((now - startTime) / 1000);
        setDisplaySeconds(currentElapsed);

        if (timerMode === 'countdown') {
          const totalTarget = durationMinutes * 60;
          const remaining = Math.max(0, totalTarget - currentElapsed);
          setTimeRemaining(remaining);

          if (remaining <= 0) {
            clearInterval(timerRef.current!);
            setIsActive(false);
            setStartTime(null);
            playAlarmSound();
            setShowSaveModal(true);
            db.saveActiveTimer(null);
          }
        }
      };

      tick();
      timerRef.current = setInterval(tick, 500);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, isPaused, startTime, accumulatedSeconds, timerMode, durationMinutes]);

  const handleStart = () => {
    const now = Date.now();
    setIsActive(true);
    setIsPaused(false);
    setStartTime(now);
  };

  const handlePause = () => {
    if (isPaused) {
      // Resume
      setStartTime(Date.now());
      setIsPaused(false);
    } else {
      // Pause: add elapsed delta into accumulatedSeconds
      if (startTime) {
        const delta = Math.floor((Date.now() - startTime) / 1000);
        setAccumulatedSeconds((prev) => prev + delta);
      }
      setStartTime(null);
      setIsPaused(true);
    }
  };

  const handleReset = () => {
    setIsActive(false);
    setIsPaused(false);
    setStartTime(null);
    setAccumulatedSeconds(0);
    setDisplaySeconds(0);
    if (timerMode === 'countdown') {
      setTimeRemaining(durationMinutes * 60);
    }
    db.saveActiveTimer(null);
  };

  const handleFinish = () => {
    // Accumulate final seconds
    let finalSeconds = accumulatedSeconds;
    if (startTime && !isPaused) {
      finalSeconds += Math.floor((Date.now() - startTime) / 1000);
    }

    setIsActive(false);
    setIsPaused(false);
    setStartTime(null);
    setAccumulatedSeconds(finalSeconds);
    setDisplaySeconds(finalSeconds);
    db.saveActiveTimer(null);

    if (finalSeconds >= 10) {
      setShowSaveModal(true);
    } else {
      alert('Sessão muito curta para ser registrada (mínimo de 10 segundos).');
      handleReset();
    }
  };

  // 4. Save Session after Live Timer finishes
  const handleSaveSession = () => {
    const sub = subjects.find((s) => s.id === subjectId);
    const top = sub?.topics.find((t) => t.id === topicId);
    const subtop = top?.subtopics.find((s) => s.id === subtopicId);

    if (!sub) return;

    const wsList = db.getWorkspaces();
    const activeWs = wsList.find(w => w.id === activeWorkspaceId);

    const isVideoStudy = studyType === 'videoaula' || studyType === 'teoria';
    const isPdfStudy = studyType === 'pdf';
    const grossSeconds = isVideoStudy ? Math.round(displaySeconds * playbackSpeed) : displaySeconds;

    const newSession: StudySession = {
      id: `session-${Date.now()}`,
      subjectId: sub.id,
      subjectName: sub.name,
      topicName: top?.name || 'Tópico Geral',
      subtopicName: subtop?.name,
      durationSeconds: displaySeconds,
      date: new Date().toISOString(),
      notes: notes.trim() || undefined,
      studyType,
      acertos: sessionAcertos > 0 ? sessionAcertos : undefined,
      erros: sessionErros > 0 ? sessionErros : undefined,
      workspaceId: activeWorkspaceId,
      workspaceName: activeWs ? activeWs.name : 'Meu Primeiro Ciclo',
      playbackSpeed: isVideoStudy ? playbackSpeed : undefined,
      grossDurationSeconds: isVideoStudy ? grossSeconds : undefined,
      videoLesson: isVideoStudy ? videoLesson.trim() || undefined : undefined,
      videoBlock: isVideoStudy ? videoBlock.trim() || undefined : undefined,
      pdfLesson: isPdfStudy ? pdfLesson.trim() || undefined : undefined,
      pdfPages: isPdfStudy ? pdfPages.trim() || undefined : undefined,
    };

    // Save session record (global)
    const sessions = db.getSessions();
    db.saveSessions([newSession, ...sessions]);

    // If questions were solved, record QuestionSession
    if (sessionAcertos > 0 || sessionErros > 0) {
      const qSession: QuestionSession = {
        id: `q-session-${Date.now()}`,
        subjectId: sub.id,
        subjectName: sub.name,
        topicName: top?.name || 'Geral',
        attempted: sessionAcertos + sessionErros,
        correct: sessionAcertos,
        banca: 'FCC',
        date: new Date().toISOString(),
        tipo: studyType === 'simulado' ? 'simulado' : 'treino',
        workspaceId: activeWorkspaceId,
        workspaceName: activeWs ? activeWs.name : 'Meu Primeiro Ciclo'
      };
      db.saveQuestions([qSession, ...db.getQuestions()]);
    }

    // Schedule Spaced Reviews if selected or if Autopilot D+1 is active
    const autopilotSettings = db.getAutopilotSettings(activeWorkspaceId);
    const intervalsToSchedule = [...scheduledIntervals];
    if (autopilotSettings.autoScheduleD1Review && !intervalsToSchedule.includes(1)) {
      intervalsToSchedule.push(1);
    }

    if (intervalsToSchedule.length > 0) {
      const existingReviews = db.getRevisoes(activeWorkspaceId);
      const today = new Date().toISOString().split('T')[0];
      const newReviews: SpacedReview[] = intervalsToSchedule.map(days => {
        const revDate = new Date();
        revDate.setDate(revDate.getDate() + days);
        return {
          id: `rev-${Date.now()}-${days}-${Math.random().toString(36).substr(2, 5)}`,
          subjectId: sub.id,
          subjectName: sub.name,
          topicName: subtop?.name || top?.name || sub.name,
          studyDate: today,
          revDate: revDate.toISOString().split('T')[0],
          days,
          done: false,
          workspaceId: activeWorkspaceId
        };
      });
      db.saveRevisoes(activeWorkspaceId, [...newReviews, ...existingReviews]);
    }

    // Automatically mark the current subject block in the workspace cycle as completed
    const blocks = db.getCycleBlocks(activeWorkspaceId);
    const incompleteBlockIndex = blocks.findIndex((b) => b.subjectId === sub.id && !b.completed);
    if (incompleteBlockIndex !== -1) {
      blocks[incompleteBlockIndex].completed = true;
      blocks[incompleteBlockIndex].completedAt = new Date().toISOString();
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
                  return {
                    ...st,
                    completed: markSubtopicCompleted ? true : st.completed,
                    completedAt: markSubtopicCompleted ? (st.completedAt || new Date().toISOString()) : st.completedAt,
                    acertos: (st.acertos || 0) + sessionAcertos,
                    erros: (st.erros || 0) + sessionErros,
                    videoWatched: (isVideoStudy && markVideoWatched) ? true : st.videoWatched,
                    videoLesson: (isVideoStudy && videoLesson) ? videoLesson.trim() : st.videoLesson,
                    videoBlock: (isVideoStudy && videoBlock) ? videoBlock.trim() : st.videoBlock,
                    pdfRead: (isPdfStudy && markPdfRead) ? true : st.pdfRead,
                    pdfLesson: (isPdfStudy && pdfLesson) ? pdfLesson.trim() : st.pdfLesson,
                    pdfPages: (isPdfStudy && pdfPages) ? pdfPages.trim() : st.pdfPages,
                    notes: notes.trim() ? (st.notes ? `${st.notes}\n${notes.trim()}` : notes.trim()) : st.notes
                  };
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
      setSubjects(updatedSubjects);
    }

    // Reset UI
    setShowSaveModal(false);
    setNotes('');
    setVideoLesson('');
    setVideoBlock('');
    setPdfLesson('');
    setPdfPages('');
    setSessionAcertos(0);
    setSessionErros(0);
    setScheduledIntervals([]);
    setStudyType('teoria');
    handleReset();
    clearSelectedSubject();
    
    onSessionSaved();
  };

  // 5. Manual Study Logging Form Submission
  const handleSaveManualStudy = (e: React.FormEvent) => {
    e.preventDefault();

    const h = typeof manualHours === 'number' ? manualHours : 0;
    const m = typeof manualMinutes === 'number' ? manualMinutes : 0;
    const totalSecs = (h * 3600) + (m * 60);

    if (totalSecs <= 0) {
      alert('Por favor, informe um tempo válido de estudo (horas e/ou minutos).');
      return;
    }

    const sub = subjects.find(s => s.id === manualSubjectId);
    if (!sub) {
      alert('Por favor, selecione uma disciplina.');
      return;
    }

    const top = sub.topics.find(t => t.id === manualTopicId);
    const subtop = top?.subtopics.find(st => st.id === manualSubtopicId);

    const wsList = db.getWorkspaces();
    const activeWs = wsList.find(w => w.id === activeWorkspaceId);

    // Save study session
    const studyDateIso = manualDate ? new Date(manualDate + 'T12:00:00').toISOString() : new Date().toISOString();
    const ac = typeof manualAcertos === 'number' ? manualAcertos : 0;
    const er = typeof manualErros === 'number' ? manualErros : 0;

    const isVideoStudy = manualStudyType === 'videoaula' || manualStudyType === 'teoria';
    const isPdfStudy = manualStudyType === 'pdf';
    const grossSeconds = isVideoStudy ? Math.round(totalSecs * manualPlaybackSpeed) : totalSecs;

    const newSession: StudySession = {
      id: `session-manual-${Date.now()}`,
      subjectId: sub.id,
      subjectName: sub.name,
      topicName: top?.name || 'Tópico Geral',
      subtopicName: subtop?.name,
      durationSeconds: totalSecs,
      date: studyDateIso,
      notes: manualNotes.trim() || undefined,
      studyType: manualStudyType,
      acertos: ac > 0 ? ac : undefined,
      erros: er > 0 ? er : undefined,
      workspaceId: activeWorkspaceId,
      workspaceName: activeWs ? activeWs.name : 'Meu Primeiro Ciclo',
      playbackSpeed: isVideoStudy ? manualPlaybackSpeed : undefined,
      grossDurationSeconds: isVideoStudy ? grossSeconds : undefined,
      videoLesson: isVideoStudy ? manualVideoLesson.trim() || undefined : undefined,
      videoBlock: isVideoStudy ? manualVideoBlock.trim() || undefined : undefined,
      pdfLesson: isPdfStudy ? manualPdfLesson.trim() || undefined : undefined,
      pdfPages: isPdfStudy ? manualPdfPages.trim() || undefined : undefined,
    };

    db.saveSessions([newSession, ...db.getSessions()]);

    // Save question session if acertos/erros provided
    if (ac > 0 || er > 0) {
      const qSession: QuestionSession = {
        id: `q-manual-${Date.now()}`,
        subjectId: sub.id,
        subjectName: sub.name,
        topicName: top?.name || 'Geral',
        attempted: ac + er,
        correct: ac,
        banca: 'FCC',
        date: studyDateIso,
        tipo: manualStudyType === 'simulado' ? 'simulado' : 'treino',
        workspaceId: activeWorkspaceId,
        workspaceName: activeWs ? activeWs.name : 'Meu Primeiro Ciclo'
      };
      db.saveQuestions([qSession, ...db.getQuestions()]);
    }

    // Schedule Spaced Reviews if selected or if Autopilot D+1 is active
    const autopilotSettings = db.getAutopilotSettings(activeWorkspaceId);
    const intervalsToSchedule = [...manualScheduledIntervals];
    if (autopilotSettings.autoScheduleD1Review && !intervalsToSchedule.includes(1)) {
      intervalsToSchedule.push(1);
    }

    if (intervalsToSchedule.length > 0) {
      const existingReviews = db.getRevisoes(activeWorkspaceId);
      const newReviews: SpacedReview[] = intervalsToSchedule.map(days => {
        const revDate = new Date(manualDate + 'T00:00:00');
        revDate.setDate(revDate.getDate() + days);
        return {
          id: `rev-man-${Date.now()}-${days}-${Math.random().toString(36).substr(2, 5)}`,
          subjectId: sub.id,
          subjectName: sub.name,
          topicName: subtop?.name || top?.name || sub.name,
          studyDate: manualDate,
          revDate: revDate.toISOString().split('T')[0],
          days,
          done: false,
          workspaceId: activeWorkspaceId
        };
      });
      db.saveRevisoes(activeWorkspaceId, [...newReviews, ...existingReviews]);
    }

    // Mark cycle block as completed
    const blocks = db.getCycleBlocks(activeWorkspaceId);
    const incompleteBlockIndex = blocks.findIndex((b) => b.subjectId === sub.id && !b.completed);
    if (incompleteBlockIndex !== -1) {
      blocks[incompleteBlockIndex].completed = true;
      blocks[incompleteBlockIndex].completedAt = new Date().toISOString();
      db.saveCycleBlocks(activeWorkspaceId, blocks);
    }

    // Mark subtopic as completed in subjects tree
    if (subtop) {
      const updatedSubjects = subjects.map((s) => {
        if (s.id === sub.id) {
          const updatedTopics = s.topics.map((t) => {
            if (t.id === manualTopicId) {
              const updatedSubtopics = t.subtopics.map((st) => {
                if (st.id === manualSubtopicId) {
                  return {
                    ...st,
                    completed: manualMarkCompleted ? true : st.completed,
                    completedAt: manualMarkCompleted ? (st.completedAt || (manualDate ? new Date(manualDate + 'T12:00:00').toISOString() : new Date().toISOString())) : st.completedAt,
                    acertos: (st.acertos || 0) + ac,
                    erros: (st.erros || 0) + er,
                    videoWatched: (isVideoStudy && manualMarkVideoWatched) ? true : st.videoWatched,
                    videoLesson: (isVideoStudy && manualVideoLesson) ? manualVideoLesson.trim() : st.videoLesson,
                    videoBlock: (isVideoStudy && manualVideoBlock) ? manualVideoBlock.trim() : st.videoBlock,
                    pdfRead: (isPdfStudy && manualMarkPdfRead) ? true : st.pdfRead,
                    pdfLesson: (isPdfStudy && manualPdfLesson) ? manualPdfLesson.trim() : st.pdfLesson,
                    pdfPages: (isPdfStudy && manualPdfPages) ? manualPdfPages.trim() : st.pdfPages,
                    notes: manualNotes.trim() ? (st.notes ? `${st.notes}\n${manualNotes.trim()}` : manualNotes.trim()) : st.notes
                  };
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
      setSubjects(updatedSubjects);
    }

    // Show confirmation
    const formattedHours = `${h > 0 ? `${h}h ` : ''}${m}min`;
    const extraInfo = isVideoStudy && manualPlaybackSpeed > 1.0 
      ? ` (equivale a ${((totalSecs * manualPlaybackSpeed) / 3600).toFixed(1)}h de videoaula a ${manualPlaybackSpeed}x)`
      : '';
    const topicInfo = top ? ` • Tópico: ${top.name}` : '';
    setManualSuccessMsg(`${formattedHours}${extraInfo} de estudo em "${sub.name}"${topicInfo} registrados com sucesso!`);
    setTimeout(() => setManualSuccessMsg(null), 6000);

    // Reset manual form fields
    setManualHours('');
    setManualMinutes('');
    setManualNotes('');
    setManualAcertos('');
    setManualErros('');
    setManualVideoLesson('');
    setManualVideoBlock('');
    setManualPdfLesson('');
    setManualPdfPages('');
    onSessionSaved();

    setTimeout(() => {
      manualSubmitContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  // Format seconds to HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  const activeTopics = subjects.find((s) => s.id === subjectId)?.topics || [];
  const activeSubtopics = activeTopics.find((t) => t.id === topicId)?.subtopics || [];

  const manualActiveTopics = subjects.find((s) => s.id === manualSubjectId)?.topics || [];
  const manualActiveSubtopics = manualActiveTopics.find((t) => t.id === manualTopicId)?.subtopics || [];

  return (
    <div className="tab-content timer-tab">
      {/* SECTION HEADER & MODE TOGGLE */}
      <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '20px' }}>
        <div>
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock className="text-primary" size={24} />
            Estudo Ativo & Registro
          </h2>
          <p className="section-description">
            Acompanhe o foco em tempo real com o cronômetro contínuo ou lance horas estudadas manualmente.
          </p>
        </div>

        {/* MODE TABS TOGGLE */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-element, #f1f5f9)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #e2e8f0)'
        }}>
          <button
            onClick={() => setActiveMode('live')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeMode === 'live' ? 'var(--card-bg, #ffffff)' : 'transparent',
              color: activeMode === 'live' ? 'var(--primary-color, #0d134c)' : 'var(--text-muted, #64748b)',
              boxShadow: activeMode === 'live' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <Clock size={16} />
            <span>Cronômetro Ao Vivo</span>
            {isActive && (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', marginLeft: '4px', animation: 'pulse 1.5s infinite' }} />
            )}
          </button>

          <button
            onClick={() => setActiveMode('manual')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeMode === 'manual' ? 'var(--card-bg, #ffffff)' : 'transparent',
              color: activeMode === 'manual' ? 'var(--primary-color, #0d134c)' : 'var(--text-muted, #64748b)',
              boxShadow: activeMode === 'manual' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <Edit3 size={16} />
            <span>Inserir Manualmente</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODE 1: LIVE CONTINUOUS CHRONOMETER */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeMode === 'live' && (
        <div className="timer-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {subjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
              <BookOpen size={48} className="text-muted" style={{ margin: '0 auto 1rem' }} />
              <p>Você precisa cadastrar matérias no Planejamento antes de cronometrar seus estudos.</p>
            </div>
          ) : (
            <div className="responsive-split-grid">
              
              {/* Left Column: Subject & Topic Details */}
              <div className="placeholder-card card-primary" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', padding: '2rem' }}>
                <h3>Contexto do Bloco de Estudo</h3>
                
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
                      <option key={sub.id} value={sub.id}>{sub.name} (Peso {sub.weight})</option>
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

                {/* Gran Questoes Direct Shortcut */}
                {subjectId && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '0.2rem',
                    background: 'rgba(200, 16, 46, 0.07)',
                    border: '1px solid rgba(200, 16, 46, 0.25)',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#c8102e' }}>
                      Praticar questões deste tema:
                    </span>
                    <a
                      href={(() => {
                        const curSub = subjects.find(s => s.id === subjectId);
                        const curTopic = activeTopics.find(t => t.id === topicId);
                        const curSubtop = activeSubtopics.find(s => s.id === subtopicId);

                        const targetAssunto = curSubtop?.assuntoId || curTopic?.assuntoId || curSub?.assuntoId;
                        const targetDisc = curSubtop?.disciplinaId || curTopic?.disciplinaId || curSub?.disciplinaId;
                        const targetQ = curSubtop?.granQuery || curSubtop?.name || curTopic?.granQuery || curTopic?.name || curSub?.granQuery || curSub?.name || '';

                        return buildGranQuestoesUrl({
                          assuntoId: targetAssunto,
                          disciplinaId: targetDisc,
                          query: targetQ,
                          banca: 'FCC',
                          filterBanca: true
                        });
                      })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        background: '#c8102e',
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textDecoration: 'none'
                      }}
                      title="Abrir no Gran Questões com filtro de alta precisão"
                    >
                      <span>🎯 Gran Questões</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* Modalidade de Estudo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Modalidade de Estudo</label>
                  <select
                    value={studyType}
                    onChange={(e) => setStudyType(e.target.value as StudyType)}
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
                    <option value="teoria">📖 Teoria Geral</option>
                    <option value="videoaula">🎬 Videoaula Gran</option>
                    <option value="pdf">📄 Leitura de PDF</option>
                    <option value="questoes">📝 Questões</option>
                    <option value="simulado">🎯 Simulado</option>
                    <option value="lei_seca">⚖️ Lei Seca</option>
                    <option value="jurisprudencia">🏛️ Jurisprudência</option>
                    <option value="discursiva">✍️ Discursiva</option>
                  </select>
                </div>

                {/* Gran Video Playback Speed Selector */}
                {(studyType === 'videoaula' || studyType === 'teoria') && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    background: 'rgba(200, 16, 46, 0.04)',
                    border: '1px solid rgba(200, 16, 46, 0.2)',
                    padding: '10px 12px',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c8102e' }}>
                        ⚡ Velocidade de Reprodução Gran:
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#c8102e' }}>
                        {playbackSpeed}x
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[1.0, 1.25, 1.5, 1.75, 2.0].map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => setPlaybackSpeed(spd)}
                          style={{
                            flex: 1,
                            padding: '6px 0',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            border: playbackSpeed === spd ? '1.5px solid #c8102e' : '1px solid var(--border-color)',
                            background: playbackSpeed === spd ? '#c8102e' : 'var(--card-bg)',
                            color: playbackSpeed === spd ? '#ffffff' : 'inherit',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                    <input
                      type="number"
                      min="5"
                      max="240"
                      step="5"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 90)}
                      disabled={isActive}
                      style={{
                        padding: '0.8rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-element)',
                        color: 'var(--text-title)',
                        width: '100%'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Right Column: Timer Display & Controls */}
              <div className="placeholder-card card-secondary" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '2rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                    {timerMode === 'countdown' ? 'Tempo Restante' : 'Tempo Líquido Estudado'}
                  </span>
                  <div style={{
                    fontSize: 'clamp(3.5rem, 8vw, 6rem)',
                    fontWeight: '900',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '2px',
                    color: isActive && !isPaused ? '#22c55e' : isPaused ? '#f59e0b' : 'var(--text-title)',
                    transition: 'color 0.3s ease'
                  }}>
                    {timerMode === 'countdown' ? formatTime(timeRemaining) : formatTime(displaySeconds)}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {isActive && !isPaused ? '🟢 Cronômetro em execução (continua se mudar de aba)' : isPaused ? '🟡 Cronômetro Pausado' : '⚪ Pronto para iniciar'}
                  </div>
                  {(studyType === 'videoaula' || studyType === 'teoria') && playbackSpeed > 1.0 && (
                    <div style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#c8102e',
                      background: 'rgba(200, 16, 46, 0.08)',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '6px'
                    }}>
                      <span>⚡ Bruto Assistido: {formatTime(Math.round(displaySeconds * playbackSpeed))} ({playbackSpeed}x)</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '350px' }}>
                  {!isActive ? (
                    <button onClick={handleStart} className="mock-btn" style={{ flex: 1, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', justifyContent: 'center', backgroundColor: '#22c55e', color: '#ffffff' }}>
                      <Play size={20} fill="currentColor" /> Iniciar
                    </button>
                  ) : (
                    <>
                      <button onClick={handlePause} className="mock-btn" style={{ flex: 1, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', backgroundColor: isPaused ? '#22c55e' : '#f59e0b', color: '#ffffff', justifyContent: 'center' }}>
                        {isPaused ? <><Play size={20} fill="currentColor" /> Retomar</> : <><Pause size={20} /> Pausar</>}
                      </button>
                      <button onClick={handleFinish} className="mock-btn" style={{ flex: 1, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', backgroundColor: '#c8102e', color: '#ffffff', justifyContent: 'center' }}>
                        <Square size={20} /> Finalizar
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={handleReset}
                    disabled={!isActive && displaySeconds === 0}
                    className="theme-toggle"
                    style={{ width: '3.5rem', height: '3.5rem', borderRadius: '12px' }}
                    title="Reiniciar cronômetro"
                  >
                    <RotateCcw size={20} />
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODE 2: MANUAL STUDY ENTRY FORM */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeMode === 'manual' && (
        <form onSubmit={handleSaveManualStudy} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>

          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1.5px solid var(--border-color, #e2e8f0)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={20} className="text-primary" />
              Lançamento Manual de Horas Estudadas
            </h3>
            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '-8px' }}>
              Utilize para registrar estudos realizados offline, videoaulas, leitura de PDF ou revisões anteriores.
            </p>

            {/* Grid 1: Data e Tempo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  📅 Data do Estudo
                </label>
                <input 
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-element)', color: 'inherit', fontWeight: 600 }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  ⏱️ Horas
                </label>
                <input 
                  type="number"
                  min="0"
                  max="24"
                  placeholder="0"
                  value={manualHours}
                  onChange={(e) => setManualHours(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-element)', color: 'inherit', fontWeight: 700, textAlign: 'center' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  ⏱️ Minutos
                </label>
                <input 
                  type="number"
                  min="0"
                  max="59"
                  placeholder="45"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-element)', color: 'inherit', fontWeight: 700, textAlign: 'center' }}
                />
              </div>
            </div>

            {/* Grid 2: Matéria, Tópico e Tipo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Matéria
                </label>
                <select
                  value={manualSubjectId}
                  onChange={(e) => handleManualSubjectChange(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-element)', color: 'inherit', fontWeight: 600 }}
                  required
                >
                  <option value="">-- Selecione a Matéria --</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Tópico
                </label>
                <select
                  value={manualTopicId}
                  onChange={(e) => handleManualTopicChange(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-element)', color: 'inherit' }}
                >
                  <option value="">-- Selecione o Tópico (Opcional) --</option>
                  {manualActiveTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>{topic.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Modalidade de Estudo
                </label>
                <select
                  value={manualStudyType}
                  onChange={(e) => setManualStudyType(e.target.value as StudyType)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-element)', color: 'inherit', fontWeight: 600 }}
                >
                  <option value="teoria">📖 Teoria Geral</option>
                  <option value="videoaula">🎬 Videoaula Gran</option>
                  <option value="pdf">📄 Leitura de PDF</option>
                  <option value="questoes">📝 Questões</option>
                  <option value="simulado">🎯 Simulado</option>
                  <option value="lei_seca">⚖️ Lei Seca</option>
                  <option value="jurisprudencia">🏛️ Jurisprudência</option>
                  <option value="discursiva">✍️ Discursiva</option>
                </select>
              </div>
            </div>

            {/* Gran Video Speed & Inputs in Manual Form */}
            {(manualStudyType === 'videoaula' || manualStudyType === 'teoria') && (
              <div style={{ background: 'rgba(200, 16, 46, 0.04)', border: '1px solid rgba(200, 16, 46, 0.2)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c8102e' }}>
                    ⚡ Velocidade Assistida Gran:
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1.0, 1.25, 1.5, 1.75, 2.0].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setManualPlaybackSpeed(spd)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          border: manualPlaybackSpeed === spd ? '1.5px solid #c8102e' : '1px solid var(--border-color)',
                          background: manualPlaybackSpeed === spd ? '#c8102e' : 'var(--card-bg)',
                          color: manualPlaybackSpeed === spd ? '#ffffff' : 'inherit',
                          cursor: 'pointer'
                        }}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Nº da Aula</label>
                    <input 
                      type="text"
                      placeholder="Ex: Aula 03"
                      value={manualVideoLesson}
                      onChange={(e) => setManualVideoLesson(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Bloco / Parte</label>
                    <input 
                      type="text"
                      placeholder="Ex: Bloco 2"
                      value={manualVideoBlock}
                      onChange={(e) => setManualVideoBlock(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                    />
                  </div>
                </div>

                {manualSubtopicId && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', marginTop: '2px' }}>
                    <input 
                      type="checkbox"
                      checked={manualMarkVideoWatched}
                      onChange={(e) => setManualMarkVideoWatched(e.target.checked)}
                    />
                    Marcar videoaula como assistida no Edital Verticalizado
                  </label>
                )}
              </div>
            )}

            {/* Gran PDF Inputs in Manual Form */}
            {manualStudyType === 'pdf' && (
              <div style={{ background: 'rgba(37, 99, 235, 0.04)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Nº da Aula PDF</label>
                    <input 
                      type="text"
                      placeholder="Ex: Aula 02"
                      value={manualPdfLesson}
                      onChange={(e) => setManualPdfLesson(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Páginas Lidas</label>
                    <input 
                      type="text"
                      placeholder="Ex: pág. 10 a 35"
                      value={manualPdfPages}
                      onChange={(e) => setManualPdfPages(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                    />
                  </div>
                </div>

                {manualSubtopicId && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', marginTop: '2px' }}>
                    <input 
                      type="checkbox"
                      checked={manualMarkPdfRead}
                      onChange={(e) => setManualMarkPdfRead(e.target.checked)}
                    />
                    Marcar PDF como lido no Edital Verticalizado
                  </label>
                )}
              </div>
            )}

            {/* Subtópico se houver */}
            {manualActiveSubtopics.length > 0 && (
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Subtópico específico do Edital
                </label>
                <select
                  value={manualSubtopicId}
                  onChange={(e) => setManualSubtopicId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-element)', color: 'inherit' }}
                >
                  <option value="">-- Opcional --</option>
                  {manualActiveSubtopics.map((st) => (
                    <option key={st.id} value={st.id}>{st.name} {st.completed ? '✓' : ''}</option>
                  ))}
                </select>
                {manualSubtopicId && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', marginTop: '6px' }}>
                    <input 
                      type="checkbox"
                      checked={manualMarkCompleted}
                      onChange={(e) => setManualMarkCompleted(e.target.checked)}
                    />
                    Marcar subtópico geral como concluído no Edital Verticalizado
                  </label>
                )}
              </div>
            )}

            {/* Grid 3: Questões Resolvidas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', background: 'rgba(0,0,0,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#16a34a', display: 'block', marginBottom: '4px' }}>
                  Acertos em Questões (opcional)
                </label>
                <input 
                  type="number"
                  min="0"
                  placeholder="0"
                  value={manualAcertos}
                  onChange={(e) => setManualAcertos(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #bbf7d0', textAlign: 'center', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', display: 'block', marginBottom: '4px' }}>
                  Erros em Questões (opcional)
                </label>
                <input 
                  type="number"
                  min="0"
                  placeholder="0"
                  value={manualErros}
                  onChange={(e) => setManualErros(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #fca5a5', textAlign: 'center', fontWeight: 700 }}
                />
              </div>
            </div>

            {/* Agendar Revisão */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                🔁 Agendar Revisão Espaçada a partir desta data
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[7, 15, 21, 30].map((days) => (
                  <button
                    type="button"
                    key={days}
                    onClick={() => setManualScheduledIntervals(prev => prev.includes(days) ? prev.filter(d => d !== days) : [...prev, days])}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '999px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: manualScheduledIntervals.includes(days) ? '#f59e0b' : 'transparent',
                      color: manualScheduledIntervals.includes(days) ? '#ffffff' : 'inherit'
                    }}
                  >
                    {days} dias {manualScheduledIntervals.includes(days) ? '✓' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Observações */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Anotações / Resumo
              </label>
              <textarea 
                rows={2}
                placeholder="Ex: aula 03 finalizada, revisar pontos de atenção..."
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-element)', color: 'inherit', resize: 'none' }}
              />
            </div>

            {/* Pop-up Alert Feedback directly above the green button */}
            <div ref={manualSubmitContainerRef} style={{ position: 'relative', marginTop: '14px' }}>
              {manualSuccessMsg && (
                <div
                  role="alert"
                  className="manual-save-popup"
                  style={{
                    position: 'relative',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '14px 18px',
                    borderRadius: '14px',
                    backgroundColor: 'var(--bg-card)',
                    border: '2px solid #22c55e',
                    boxShadow: '0 8px 24px rgba(34, 197, 94, 0.25)',
                    animation: 'fadeInTab 0.25s ease-out',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: '#22c55e',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 2px 10px rgba(34, 197, 94, 0.45)',
                      }}
                    >
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-title)' }}>
                        Estudo Adicionado com Sucesso!
                      </div>
                      <div style={{ fontSize: '0.86rem', color: 'var(--text-main)', marginTop: '2px', fontWeight: 500 }}>
                        {manualSuccessMsg}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setManualSuccessMsg(null)}
                    style={{
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Fechar notificação"
                  >
                    <X size={18} />
                  </button>

                  {/* Speech bubble pointer caret pointing directly down at the green button */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-8px',
                      left: '50%',
                      transform: 'translateX(-50%) rotate(45deg)',
                      width: '14px',
                      height: '14px',
                      backgroundColor: 'var(--bg-card)',
                      borderRight: '2px solid #22c55e',
                      borderBottom: '2px solid #22c55e',
                    }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={Boolean(manualSuccessMsg)}
                style={{
                  width: '100%',
                  padding: '13px',
                  background: manualSuccessMsg ? '#16a34a' : '#22c55e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  cursor: manualSuccessMsg ? 'default' : 'pointer',
                  opacity: manualSuccessMsg ? 0.92 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: manualSuccessMsg
                    ? '0 0 0 3px rgba(34, 197, 94, 0.35), 0 6px 16px rgba(34, 197, 94, 0.3)'
                    : '0 4px 12px rgba(34, 197, 94, 0.25)',
                  transition: 'all 0.2s ease',
                }}
              >
                {manualSuccessMsg ? <CheckCircle2 size={20} /> : <Save size={20} />}
                <span>{manualSuccessMsg ? 'Estudo Gravado com Sucesso!' : 'Salvar Estudo Manual'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SAVE MODAL FOR LIVE TIMER */}
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
          <div className="placeholder-card card-primary modal-dialog" style={{ width: '90%', maxWidth: '520px', gap: '1.2rem', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Registrar Sessão de Estudo</h3>
              <button onClick={() => setShowSaveModal(false)} style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            <div style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
              <div style={{
                backgroundColor: 'var(--bg-element)',
                padding: '1rem',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}>
                <div><strong>Matéria:</strong> {subjects.find(s => s.id === subjectId)?.name}</div>
                <div><strong>Tópico:</strong> {activeTopics.find(t => t.id === topicId)?.name || 'Geral'}</div>
                {subtopicId && <div><strong>Subtópico:</strong> {activeSubtopics.find(s => s.id === subtopicId)?.name}</div>}
                <div><strong>Tempo Líquido:</strong> {formatTime(displaySeconds)}</div>
              </div>
            </div>

            {/* Tipo de Estudo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Modalidade</label>
              <select
                value={studyType}
                onChange={(e) => setStudyType(e.target.value as StudyType)}
                style={{
                  padding: '0.7rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-element)',
                  color: 'var(--text-title)',
                  width: '100%',
                  fontWeight: 600
                }}
              >
                <option value="teoria">📖 Teoria Geral</option>
                <option value="videoaula">🎬 Videoaula Gran</option>
                <option value="pdf">📄 Leitura de PDF</option>
                <option value="questoes">📝 Questões</option>
                <option value="simulado">🎯 Simulado</option>
                <option value="lei_seca">⚖️ Lei Seca</option>
                <option value="jurisprudencia">🏛️ Jurisprudência</option>
                <option value="discursiva">✍️ Discursiva</option>
              </select>
            </div>

            {subtopicId && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                <input 
                  type="checkbox"
                  checked={markSubtopicCompleted}
                  onChange={(e) => setMarkSubtopicCompleted(e.target.checked)}
                />
                Marcar subtópico geral como concluído no Edital Verticalizado
              </label>
            )}

            {/* Gran Tracker Videoaula Controls in Save Modal */}
            {(studyType === 'videoaula' || studyType === 'teoria') && (
              <div style={{ background: 'rgba(200, 16, 46, 0.04)', border: '1px solid rgba(200, 16, 46, 0.2)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c8102e' }}>
                    ⚡ Velocidade de Reprodução Gran:
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1.0, 1.25, 1.5, 1.75, 2.0].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setPlaybackSpeed(spd)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          border: playbackSpeed === spd ? '1px solid #c8102e' : '1px solid var(--border-color)',
                          background: playbackSpeed === spd ? '#c8102e' : 'var(--card-bg)',
                          color: playbackSpeed === spd ? '#ffffff' : 'inherit',
                          cursor: 'pointer'
                        }}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                  🎬 <strong>Tempo Bruto de Aula:</strong> {formatTime(Math.round(displaySeconds * playbackSpeed))}
                  {playbackSpeed > 1.0 && <span style={{ opacity: 0.8, color: '#16a34a' }}> (economizou {formatTime(Math.round(displaySeconds * playbackSpeed) - displaySeconds)})</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Nº da Aula</label>
                    <input 
                      type="text"
                      placeholder="Ex: Aula 03"
                      value={videoLesson}
                      onChange={(e) => setVideoLesson(e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Bloco / Parte</label>
                    <input 
                      type="text"
                      placeholder="Ex: Bloco 2"
                      value={videoBlock}
                      onChange={(e) => setVideoBlock(e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                    />
                  </div>
                </div>

                {subtopicId && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginTop: '2px' }}>
                    <input 
                      type="checkbox"
                      checked={markVideoWatched}
                      onChange={(e) => setMarkVideoWatched(e.target.checked)}
                    />
                    Marcar videoaula como assistida no Edital Verticalizado
                  </label>
                )}
              </div>
            )}

            {/* Gran Tracker PDF Controls in Save Modal */}
            {studyType === 'pdf' && (
              <div style={{ background: 'rgba(37, 99, 235, 0.04)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Nº da Aula PDF</label>
                    <input 
                      type="text"
                      placeholder="Ex: Aula 02"
                      value={pdfLesson}
                      onChange={(e) => setPdfLesson(e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Páginas Lidas</label>
                    <input 
                      type="text"
                      placeholder="Ex: pág. 10 a 35"
                      value={pdfPages}
                      onChange={(e) => setPdfPages(e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                    />
                  </div>
                </div>

                {subtopicId && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginTop: '2px' }}>
                    <input 
                      type="checkbox"
                      checked={markPdfRead}
                      onChange={(e) => setMarkPdfRead(e.target.checked)}
                    />
                    Marcar PDF como lido no Edital Verticalizado
                  </label>
                )}
              </div>
            )}

            {/* Questões Resolvidas na Sessão */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#16a34a' }}>Acertos em Questões</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={sessionAcertos || ''}
                  onChange={(e) => setSessionAcertos(parseInt(e.target.value) || 0)}
                  style={{
                    padding: '0.6rem',
                    textAlign: 'center',
                    borderRadius: '6px',
                    border: '1px solid #bbf7d0',
                    backgroundColor: 'var(--bg-element)',
                    color: 'var(--text-title)',
                    fontWeight: 700
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ef4444' }}>Erros em Questões</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={sessionErros || ''}
                  onChange={(e) => setSessionErros(parseInt(e.target.value) || 0)}
                  style={{
                    padding: '0.6rem',
                    textAlign: 'center',
                    borderRadius: '6px',
                    border: '1px solid #fca5a5',
                    backgroundColor: 'var(--bg-element)',
                    color: 'var(--text-title)',
                    fontWeight: 700
                  }}
                />
              </div>
            </div>

            {/* Agendar Revisão Espaçada */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Agendar Revisão Espaçada</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[7, 15, 21, 30].map((days) => (
                  <button
                    type="button"
                    key={days}
                    onClick={() => setScheduledIntervals(prev => prev.includes(days) ? prev.filter(d => d !== days) : [...prev, days])}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '999px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: scheduledIntervals.includes(days) ? '#f59e0b' : 'transparent',
                      color: scheduledIntervals.includes(days) ? '#ffffff' : 'inherit'
                    }}
                  >
                    {days} dias {scheduledIntervals.includes(days) ? '✓' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Notas / Revisão</label>
              <textarea
                rows={2}
                placeholder="Insira anotações, fórmulas ou termos-chave..."
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
              <button onClick={handleSaveSession} className="mock-btn" style={{ flex: 1, padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#22c55e', color: '#ffffff', fontWeight: 700 }}>
                <Save size={18} /> Salvar Sessão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
