import type { Subject, Subtopic, StudySession, QuestionSession, StudyBlock, StudyCycleConfig, CicloWorkspace, ConcursoInfo, SpacedReview, RunningTimerState, Flashcard, AutopilotSettings } from '../types';
import { resolveGranTaxonomy } from '../data/tceGoPreset';
import { DAYS_ORDER, getMondayOfWeek, getTodayDayName, reallocateIncompleteBlocks } from '../modules/cycle/cycleGenerator';

// Version-tagged automatic storage wipe for port 5174 (estud_ai_clean_v4)
// Purges any legacy keys in localStorage containing old TCE-GO data or un-scoped cycles
const CLEANUP_KEY = 'estud_ai_clean_v4';
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    if (!localStorage.getItem(CLEANUP_KEY)) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith('concurso_estudos_') ||
           k.startsWith('estud_ai_fc_') ||
           k === 'estud_ai_auth_user' ||
           k.startsWith('estud_ai_clean_'))
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(CLEANUP_KEY, 'true');
    }
  } catch {}
}

const KEYS = {
  WORKSPACES: 'concurso_estudos_workspaces',
  ACTIVE_WORKSPACE_ID: 'concurso_estudos_active_workspace_id',
  SESSIONS: 'concurso_estudos_sessions',
  QUESTIONS: 'concurso_estudos_questions',
  ACTIVE_TIMER: 'concurso_estudos_active_timer',
  // Dynamic template keys
  SUBJECTS: (wsId: string) => `concurso_estudos_subjects_${wsId}`,
  CYCLE_CONFIG: (wsId: string) => `concurso_estudos_cycle_config_${wsId}`,
  CYCLE_BLOCKS: (wsId: string) => `concurso_estudos_cycle_blocks_${wsId}`,
  CYCLE_WEEK: (wsId: string) => `concurso_estudos_cycle_week_${wsId}`,
  CONCURSO_INFO: (wsId: string) => `concurso_estudos_concurso_info_${wsId}`,
  REVISOES: (wsId: string) => `concurso_estudos_revisoes_${wsId}`,
  FLASHCARDS: (wsId: string) => `concurso_estudos_flashcards_${wsId}`,
  AUTOPILOT_SETTINGS: (wsId: string) => `concurso_estudos_autopilot_settings_${wsId}`,
};

let currentUserId: string | null = null;

export const db = {
  // MULTI-USER ISOLATION HELPERS
  setCurrentUserId(userId: string | null): void {
    currentUserId = userId;
  },

  getCurrentUserId(): string | null {
    if (currentUserId) return currentUserId;
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('estud_ai_auth_user');
        if (saved) {
          const u = JSON.parse(saved);
          if (u?.id) {
            currentUserId = u.id;
            return u.id;
          }
        }
      } catch {}
    }
    return null;
  },

  getUserScopedKey(baseKey: string): string {
    const uid = this.getCurrentUserId();
    if (!uid) return `concurso_estudos_${baseKey}`;
    return `concurso_estudos_${uid}_${baseKey}`;
  },

  // WORKSPACE METADATA HELPERS
  getWorkspaces(): CicloWorkspace[] {
    const key = this.getUserScopedKey('workspaces');
    const data = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return data ? JSON.parse(data) : [];
  },

  saveWorkspaces(workspaces: CicloWorkspace[]): void {
    const key = this.getUserScopedKey('workspaces');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(workspaces));
    }
  },

  getActiveWorkspaceId(): string | null {
    const key = this.getUserScopedKey('active_workspace_id');
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  },

  setActiveWorkspaceId(id: string): void {
    const key = this.getUserScopedKey('active_workspace_id');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, id);
    }
  },

  // WORKSPACE SPECIFIC DATA HELPERS (using workspaceId)
  getSubjects(workspaceId: string): Subject[] {
    if (!workspaceId) return [];
    const data = localStorage.getItem(KEYS.SUBJECTS(workspaceId));
    if (!data) return [];
    try {
      const subjects: Subject[] = JSON.parse(data);
      let wasEnriched = false;

      // Seamlessly merge and auto-heal Gran Questões official taxonomy if not present in saved state
      const enrichedSubjects = subjects.map((sub) => {
        const subTaxonomy = resolveGranTaxonomy(sub.id || sub.name);
        const subAssunto = sub.assuntoId || subTaxonomy.assuntoId;
        const subDisc = sub.disciplinaId || subTaxonomy.disciplinaId;
        const subQuery = sub.granQuery || subTaxonomy.granQuery;

        if (subAssunto !== sub.assuntoId || subDisc !== sub.disciplinaId) {
          wasEnriched = true;
        }

        return {
          ...sub,
          assuntoId: subAssunto,
          disciplinaId: subDisc,
          granQuery: subQuery,
          topics: (sub.topics || []).map((top) => {
            const topTaxonomy = resolveGranTaxonomy(sub.id || sub.name, top.id || top.name);
            const topAssunto = top.assuntoId || topTaxonomy.assuntoId || subAssunto;
            const topDisc = top.disciplinaId || topTaxonomy.disciplinaId || subDisc;
            const topQuery = top.granQuery || topTaxonomy.granQuery || subQuery;

            if (topAssunto !== top.assuntoId || topDisc !== top.disciplinaId) {
              wasEnriched = true;
            }

            return {
              ...top,
              assuntoId: topAssunto,
              disciplinaId: topDisc,
              granQuery: topQuery,
              subtopics: (top.subtopics || []).map((st) => {
                const stTaxonomy = resolveGranTaxonomy(sub.id || sub.name, top.id || top.name, st.id || st.name);
                const stAssunto = st.assuntoId || stTaxonomy.assuntoId || topAssunto;
                const stDisc = st.disciplinaId || stTaxonomy.disciplinaId || topDisc;
                const stQuery = st.granQuery || stTaxonomy.granQuery || topQuery;

                if (stAssunto !== st.assuntoId || stDisc !== st.disciplinaId) {
                  wasEnriched = true;
                }

                return {
                  ...st,
                  assuntoId: stAssunto,
                  disciplinaId: stDisc,
                  granQuery: stQuery,
                };
              }),
            };
          }),
        };
      });

      if (wasEnriched) {
        localStorage.setItem(KEYS.SUBJECTS(workspaceId), JSON.stringify(enrichedSubjects));
      }

      return enrichedSubjects;
    } catch {
      return [];
    }
  },

  saveSubjects(workspaceId: string, subjects: Subject[]): void {
    if (!workspaceId) return;
    localStorage.setItem(KEYS.SUBJECTS(workspaceId), JSON.stringify(subjects));
  },

  updateSubtopic(
    workspaceId: string,
    subjectId: string,
    topicId: string,
    subtopicId: string,
    patch: Partial<Subtopic>
  ): Subject[] {
    const subjects = this.getSubjects(workspaceId);
    const updated = subjects.map((sub) => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        topics: sub.topics.map((top) => {
          if (top.id !== topicId) return top;
          return {
            ...top,
            subtopics: top.subtopics.map((st) => {
              if (st.id !== subtopicId) return st;
              return { ...st, ...patch };
            }),
          };
        }),
      };
    });
    this.saveSubjects(workspaceId, updated);
    return updated;
  },

  updateTopic(
    workspaceId: string,
    subjectId: string,
    topicId: string,
    patch: Partial<import('../types').Topic>
  ): Subject[] {
    const subjects = this.getSubjects(workspaceId);
    const updated = subjects.map((sub) => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        topics: sub.topics.map((top) => {
          if (top.id !== topicId) return top;
          return { ...top, ...patch };
        }),
      };
    });
    this.saveSubjects(workspaceId, updated);
    return updated;
  },

  updateSubject(workspaceId: string, subjectId: string, patch: Partial<Subject>): Subject[] {
    const subjects = this.getSubjects(workspaceId);
    const updated = subjects.map((sub) => {
      if (sub.id !== subjectId) return sub;
      return { ...sub, ...patch };
    });
    this.saveSubjects(workspaceId, updated);
    return updated;
  },

  getCycleConfig(workspaceId: string): StudyCycleConfig {
    const defaultConfig = {
      weeklyHours: 20,
      cycleDurationWeeks: 1,
      dailyHours: {
        segunda: 4,
        terca: 4,
        quarta: 4,
        quinta: 4,
        sexta: 4,
        sabado: 2,
        domingo: 2
      }
    };
    if (!workspaceId) return defaultConfig;
    const data = localStorage.getItem(KEYS.CYCLE_CONFIG(workspaceId));
    if (!data) return defaultConfig;
    const parsed = JSON.parse(data);
    if (!parsed.dailyHours) {
      parsed.dailyHours = defaultConfig.dailyHours;
    }
    return parsed;
  },

  saveCycleConfig(workspaceId: string, config: StudyCycleConfig): void {
    if (!workspaceId) return;
    localStorage.setItem(KEYS.CYCLE_CONFIG(workspaceId), JSON.stringify(config));
  },

  getCycleBlocks(workspaceId: string): StudyBlock[] {
    if (!workspaceId) return [];
    const data = localStorage.getItem(KEYS.CYCLE_BLOCKS(workspaceId));
    return data ? JSON.parse(data) : [];
  },

  saveCycleBlocks(workspaceId: string, blocks: StudyBlock[]): void {
    if (!workspaceId) return;
    localStorage.setItem(KEYS.CYCLE_BLOCKS(workspaceId), JSON.stringify(blocks));
  },

  getCycleWeek(workspaceId: string): string | null {
    if (!workspaceId) return null;
    return localStorage.getItem(KEYS.CYCLE_WEEK(workspaceId));
  },

  saveCycleWeek(workspaceId: string, weekMonday: string): void {
    if (!workspaceId) return;
    localStorage.setItem(KEYS.CYCLE_WEEK(workspaceId), weekMonday);
  },

  /**
   * Synchronizes the study cycle schedule:
   * 1. Detects if a new calendar week (Monday to Sunday) has started:
   *    - Resets all cycle blocks to completed: false, completedAt: undefined
   *    - Updates CYCLE_WEEK to current Monday
   *    - Reallocates blocks cleanly according to cycleConfig.dailyHours starting from Monday
   * 2. If same week: detects if there are incomplete blocks from days before today:
   *    - Reallocates incomplete past blocks forward starting from today
   * Returns { wasReset: boolean, wasReallocated: boolean, blocks: StudyBlock[] }
   */
  syncCycleSchedule(workspaceId: string, currentDate: Date = new Date()): {
    wasReset: boolean;
    wasReallocated: boolean;
    blocks: StudyBlock[];
  } {
    if (!workspaceId) return { wasReset: false, wasReallocated: false, blocks: [] };

    const blocks = this.getCycleBlocks(workspaceId);
    if (blocks.length === 0) return { wasReset: false, wasReallocated: false, blocks: [] };

    const config = this.getCycleConfig(workspaceId);
    const currentMonday = getMondayOfWeek(currentDate);
    const savedMonday = this.getCycleWeek(workspaceId);
    const todayDayName = getTodayDayName(currentDate);
    const todayIdx = DAYS_ORDER.indexOf(todayDayName as any);

    let wasReset = false;
    let wasReallocated = false;

    // Case 1: First time initializing week key
    if (!savedMonday) {
      this.saveCycleWeek(workspaceId, currentMonday);
    }
    // Case 2: Week rolled over (new calendar week started)
    else if (savedMonday !== currentMonday) {
      wasReset = true;
      // Reset all blocks completions
      const resetBlocks: StudyBlock[] = blocks.map((b) => ({
        ...b,
        completed: false,
        completedAt: undefined,
      }));
      // Reallocate all blocks across the new week starting from monday
      const reallocated = reallocateIncompleteBlocks(resetBlocks, config.dailyHours || {}, 'segunda');
      this.saveCycleBlocks(workspaceId, reallocated);
      this.saveCycleWeek(workspaceId, currentMonday);
      return { wasReset: true, wasReallocated: true, blocks: reallocated };
    }

    // Case 3: Same week - check for incomplete blocks assigned to days before today
    if (todayIdx > 0) {
      const hasOverdueIncomplete = blocks.some((b) => {
        if (b.completed) return false;
        const bDayIdx = DAYS_ORDER.indexOf(b.dayAllocated as any);
        return bDayIdx !== -1 && bDayIdx < todayIdx;
      });

      if (hasOverdueIncomplete) {
        const reallocated = reallocateIncompleteBlocks(blocks, config.dailyHours || {}, todayDayName);
        this.saveCycleBlocks(workspaceId, reallocated);
        wasReallocated = true;
        return { wasReset: false, wasReallocated: true, blocks: reallocated };
      }
    }

    return { wasReset, wasReallocated, blocks };
  },

  /**
   * Restarts the current cycle blocks when all blocks are completed or user manually requests restart.
   * Keeps subject sequence, resets completed flags and reallocates from today.
   */
  restartCycle(workspaceId: string, currentDate: Date = new Date()): StudyBlock[] {
    if (!workspaceId) return [];
    const blocks = this.getCycleBlocks(workspaceId);
    if (blocks.length === 0) return [];

    const config = this.getCycleConfig(workspaceId);
    const todayDayName = getTodayDayName(currentDate);
    const currentMonday = getMondayOfWeek(currentDate);

    const resetBlocks: StudyBlock[] = blocks.map((b) => ({
      ...b,
      completed: false,
      completedAt: undefined,
    }));

    const reallocated = reallocateIncompleteBlocks(resetBlocks, config.dailyHours || {}, todayDayName);
    this.saveCycleBlocks(workspaceId, reallocated);
    this.saveCycleWeek(workspaceId, currentMonday);
    return reallocated;
  },

  // GLOBAL DATA HELPERS WITH WORKSPACE TAGS & USER SCOPING
  getSessions(): StudySession[] {
    const key = this.getUserScopedKey('sessions');
    const data = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return data ? JSON.parse(data) : [];
  },

  saveSessions(sessions: StudySession[]): void {
    const key = this.getUserScopedKey('sessions');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(sessions));
    }
  },

  getQuestions(): QuestionSession[] {
    const key = this.getUserScopedKey('questions');
    const data = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return data ? JSON.parse(data) : [];
  },

  saveQuestions(questions: QuestionSession[]): void {
    const key = this.getUserScopedKey('questions');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(questions));
    }
  },

  // CONCURSO INFO HELPERS
  getConcursoInfo(workspaceId: string): ConcursoInfo | null {
    if (!workspaceId) return null;
    const data = localStorage.getItem(KEYS.CONCURSO_INFO(workspaceId));
    if (data) return JSON.parse(data);
    return null;
  },

  saveConcursoInfo(workspaceId: string, info: ConcursoInfo): void {
    if (!workspaceId) return;
    localStorage.setItem(KEYS.CONCURSO_INFO(workspaceId), JSON.stringify(info));
  },

  // SPACED REPETITION REVIEWS HELPERS
  getRevisoes(workspaceId: string): SpacedReview[] {
    if (!workspaceId) return [];
    const data = localStorage.getItem(KEYS.REVISOES(workspaceId));
    return data ? JSON.parse(data) : [];
  },

  saveRevisoes(workspaceId: string, revisoes: SpacedReview[]): void {
    if (!workspaceId) return;
    localStorage.setItem(KEYS.REVISOES(workspaceId), JSON.stringify(revisoes));
  },

  // FLASHCARDS HELPERS
  getFlashcards(workspaceId: string): Flashcard[] {
    if (!workspaceId) return [];
    try {
      const data = localStorage.getItem(KEYS.FLASHCARDS(workspaceId));
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveFlashcards(workspaceId: string, cards: Flashcard[]): void {
    if (!workspaceId) return;
    localStorage.setItem(KEYS.FLASHCARDS(workspaceId), JSON.stringify(cards));
  },

  getDueFlashcards(workspaceId: string): Flashcard[] {
    const cards = this.getFlashcards(workspaceId);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return cards.filter((c) => c.dueDate <= todayStr);
  },

  // PERSISTENT ACTIVE TIMER HELPERS
  getActiveTimer(): RunningTimerState | null {
    try {
      const key = this.getUserScopedKey('active_timer');
      const data = typeof localStorage !== 'undefined' ? (localStorage.getItem(key) || localStorage.getItem(KEYS.ACTIVE_TIMER)) : null;
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveActiveTimer(timer: RunningTimerState | null): void {
    const key = this.getUserScopedKey('active_timer');
    if (typeof localStorage !== 'undefined') {
      if (!timer) {
        localStorage.removeItem(key);
        localStorage.removeItem(KEYS.ACTIVE_TIMER);
      } else {
        localStorage.setItem(key, JSON.stringify(timer));
      }
    }
  },

  // AUTOPILOT HELPERS & WORKFLOW
  getAutopilotSettings(workspaceId: string): AutopilotSettings {
    const defaultSettings: AutopilotSettings = {
      questionsPerBlock: 15,
      theoryDurationMinutes: 60,
      autoScheduleD1Review: true,
      banca: 'FCC',
      bancaId: 92,
    };
    if (!workspaceId) return defaultSettings;
    try {
      const data = localStorage.getItem(KEYS.AUTOPILOT_SETTINGS(workspaceId));
      if (!data) return defaultSettings;
      const parsed = JSON.parse(data);
      return { ...defaultSettings, ...parsed };
    } catch {
      return defaultSettings;
    }
  },

  saveAutopilotSettings(workspaceId: string, settings: AutopilotSettings): void {
    if (!workspaceId) return;
    localStorage.setItem(KEYS.AUTOPILOT_SETTINGS(workspaceId), JSON.stringify(settings));
  },

  scheduleTomorrowReview(
    workspaceId: string,
    subjectId: string,
    subjectName: string,
    topicName: string
  ): SpacedReview | null {
    if (!workspaceId) return null;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    const existing = this.getRevisoes(workspaceId);
    const alreadyExists = existing.some(
      (r) => r.subjectId === subjectId && r.topicName === topicName && r.revDate === tomorrowStr && !r.done
    );
    if (alreadyExists) return null;

    const newRev: SpacedReview = {
      id: `rev-d1-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      subjectId,
      subjectName,
      topicName,
      studyDate: todayStr,
      revDate: tomorrowStr,
      days: 1,
      done: false,
      workspaceId,
    };

    this.saveRevisoes(workspaceId, [newRev, ...existing]);
    return newRev;
  },

  completeSubtopicAndAdvance(
    workspaceId: string,
    subjectId: string,
    topicId: string,
    subtopicId: string,
    durationSeconds: number = 0,
    blockId?: string
  ): { updatedSubjects: Subject[]; scheduledReview: SpacedReview | null } {
    if (!workspaceId) return { updatedSubjects: [], scheduledReview: null };

    const subjects = this.getSubjects(workspaceId);
    let matchedSubjectName = '';
    let matchedTopicName = '';
    let matchedSubtopicName = '';

    const updatedSubjects = subjects.map((sub) => {
      if (sub.id !== subjectId) return sub;
      matchedSubjectName = sub.name;
      return {
        ...sub,
        topics: (sub.topics || []).map((top) => {
          if (topicId && top.id !== topicId) return top;
          const stMatch = (top.subtopics || []).some((st) => st.id === subtopicId);
          if (!stMatch) return top;

          matchedTopicName = top.name;
          return {
            ...top,
            subtopics: (top.subtopics || []).map((st) => {
              if (st.id !== subtopicId) return st;
              matchedSubtopicName = st.name;
              return {
                ...st,
                completed: true,
                completedAt: new Date().toISOString(),
              };
            }),
          };
        }),
      };
    });

    this.saveSubjects(workspaceId, updatedSubjects);

    if (blockId) {
      const blocks = this.getCycleBlocks(workspaceId);
      const bIdx = blocks.findIndex((b) => b.id === blockId);
      if (bIdx !== -1) {
        blocks[bIdx].completed = true;
        blocks[bIdx].completedAt = new Date().toISOString();
        this.saveCycleBlocks(workspaceId, blocks);
      }
    }

    const wsList = this.getWorkspaces();
    const currentWs = wsList.find((w) => w.id === workspaceId);
    const workspaceName = currentWs ? currentWs.name : undefined;

    if (durationSeconds > 0) {
      const newSession: StudySession = {
        id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        subjectId,
        subjectName: matchedSubjectName || 'Geral',
        topicName: matchedTopicName || 'Geral',
        subtopicName: matchedSubtopicName || undefined,
        durationSeconds,
        date: new Date().toISOString(),
        studyType: 'teoria',
        workspaceId,
        workspaceName,
      };
      this.saveSessions([newSession, ...this.getSessions()]);
    }

    const settings = this.getAutopilotSettings(workspaceId);
    let scheduledReview: SpacedReview | null = null;
    if (settings.autoScheduleD1Review) {
      const fullTopicName = matchedSubtopicName
        ? `${matchedTopicName} - ${matchedSubtopicName}`
        : matchedTopicName;
      scheduledReview = this.scheduleTomorrowReview(
        workspaceId,
        subjectId,
        matchedSubjectName || 'Geral',
        fullTopicName
      );
    }

    return { updatedSubjects, scheduledReview };
  },

  recordSubtopicQuestions(
    workspaceId: string,
    subjectId: string,
    topicId: string,
    subtopicId: string,
    attempted: number,
    correct: number,
    banca: string = 'FCC',
    notes?: string
  ): { updatedSubjects: Subject[]; newQuestionSession: QuestionSession } {
    if (!workspaceId) return { updatedSubjects: [], newQuestionSession: null as any };

    const subjects = this.getSubjects(workspaceId);
    let matchedSubjectName = '';
    let matchedTopicName = '';
    let matchedSubtopicName = '';

    const safeAttempted = Math.max(0, attempted);
    const safeCorrect = Math.max(0, Math.min(safeAttempted, correct));
    const erros = safeAttempted - safeCorrect;

    const updatedSubjects = subjects.map((sub) => {
      if (sub.id !== subjectId) return sub;
      matchedSubjectName = sub.name;
      return {
        ...sub,
        topics: (sub.topics || []).map((top) => {
          if (topicId && top.id !== topicId) return top;
          const stMatch = (top.subtopics || []).some((st) => st.id === subtopicId);
          if (!stMatch) return top;

          matchedTopicName = top.name;
          return {
            ...top,
            subtopics: (top.subtopics || []).map((st) => {
              if (st.id !== subtopicId) return st;
              matchedSubtopicName = st.name;
              return {
                ...st,
                acertos: (st.acertos || 0) + safeCorrect,
                erros: (st.erros || 0) + erros,
              };
            }),
          };
        }),
      };
    });

    this.saveSubjects(workspaceId, updatedSubjects);

    const fullTopicName = matchedSubtopicName
      ? `${matchedTopicName} - ${matchedSubtopicName}`
      : (matchedTopicName || 'Geral');

    const wsList = this.getWorkspaces();
    const currentWs = wsList.find((w) => w.id === workspaceId);
    const workspaceName = currentWs ? currentWs.name : undefined;

    const newQuestionSession: QuestionSession = {
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      subjectId,
      subjectName: matchedSubjectName || 'Geral',
      topicName: fullTopicName,
      attempted: safeAttempted,
      correct: safeCorrect,
      banca: banca || 'FCC',
      date: new Date().toISOString(),
      workspaceId,
      workspaceName,
      tipo: 'treino',
      insightAncoragem: notes,
    };

    this.saveQuestions([newQuestionSession, ...this.getQuestions()]);

    return { updatedSubjects, newQuestionSession };
  },

  // IMPORT GRAN CONCURSOS BACKUP JSON
  importGranBackup(workspaceId: string, granData: any): { importedTopics: number; importedSessions: number } {
    if (!workspaceId || !granData) return { importedTopics: 0, importedSessions: 0 };
    
    let importedTopics = 0;
    let importedSessions = 0;

    // 1. Update subtopics completion & question counts from Gran 'state'
    if (granData.state && typeof granData.state === 'object') {
      const currentSubjects = this.getSubjects(workspaceId);
      const updatedSubjects = currentSubjects.map(sub => {
        const updatedTopics = sub.topics.map(top => {
          const updatedSubtopics = top.subtopics.map(st => {
            // Check if any state key matches subtopic by ID or name
            const matchedKey = Object.keys(granData.state).find(k => {
              const normK = k.toLowerCase().trim();
              const normStName = st.name.toLowerCase().trim();
              const normStId = st.id.toLowerCase().trim();
              return normK === normStId ||
                     (normStName.length >= 4 && normK.includes(normStName.slice(0, 15))) ||
                     (normK.length >= 4 && normStName.includes(normK.slice(0, 15)));
            });

            if (matchedKey) {
              const sItem = granData.state[matchedKey];
              if (sItem.done) {
                importedTopics++;
                return {
                  ...st,
                  completed: true,
                  completedAt: sItem.datetime || new Date().toISOString(),
                  acertos: (st.acertos || 0) + (parseInt(sItem.acertos) || 0),
                  erros: (st.erros || 0) + (parseInt(sItem.erros) || 0),
                  videoWatched: sItem.video !== undefined ? !!sItem.video : (st.videoWatched || true),
                  videoLesson: sItem.videoAula || sItem.aula || st.videoLesson,
                  pdfRead: sItem.pdf !== undefined ? !!sItem.pdf : st.pdfRead,
                  notes: sItem.notes || sItem.obs || st.notes
                };
              }
            }
            return st;
          });
          return { ...top, subtopics: updatedSubtopics };
        });
        return { ...sub, topics: updatedTopics };
      });
      this.saveSubjects(workspaceId, updatedSubjects);
    }

    // 2. Import Gran 'revisoes'
    if (Array.isArray(granData.revisoes) && granData.revisoes.length > 0) {
      const existing = this.getRevisoes(workspaceId);
      const newRevs: SpacedReview[] = granData.revisoes.map((r: any) => ({
        id: `gran-rev-${r.id || Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        subjectId: `sub-${r.disc || 'geral'}`,
        subjectName: r.disc || 'Geral',
        topicName: r.topic || 'Tópico',
        studyDate: r.studyDate || new Date().toISOString().split('T')[0],
        revDate: r.revDate || new Date().toISOString().split('T')[0],
        days: r.days || 7,
        done: !!r.done,
        workspaceId
      }));
      this.saveRevisoes(workspaceId, [...newRevs, ...existing]);
    }

    // 3. Import Gran 'historico' into QuestionSession & StudySession
    if (Array.isArray(granData.historico) && granData.historico.length > 0) {
      const qSessions: QuestionSession[] = [];
      const sSessions: StudySession[] = [];

      granData.historico.forEach((h: any) => {
        importedSessions++;
        const dateIso = h.date ? new Date(h.date + 'T12:00:00').toISOString() : new Date().toISOString();
        if ((h.questoes || 0) > 0 || (h.acertos || 0) > 0 || (h.erros || 0) > 0) {
          qSessions.push({
            id: `gran-q-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            subjectId: `sub-${h.disc || 'geral'}`,
            subjectName: h.disc || 'Geral',
            topicName: h.topic || 'Geral',
            attempted: h.questoes || (h.acertos || 0) + (h.erros || 0),
            correct: h.acertos || 0,
            banca: 'FCC',
            date: dateIso,
            workspaceId,
            tipo: h.tipo === 'Simulado' ? 'simulado' : 'treino'
          });
        }
        if ((h.horas || 0) > 0) {
          sSessions.push({
            id: `gran-s-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            subjectId: `sub-${h.disc || 'geral'}`,
            subjectName: h.disc || 'Geral',
            topicName: h.topic || 'Geral',
            durationSeconds: Math.round(h.horas * 3600),
            date: dateIso,
            notes: h.obs,
            workspaceId
          });
        }
      });

      if (qSessions.length > 0) {
        this.saveQuestions([...qSessions, ...this.getQuestions()]);
      }
      if (sSessions.length > 0) {
        this.saveSessions([...sSessions, ...this.getSessions()]);
      }
    }

    return { importedTopics, importedSessions };
  },

  // UNIVERSAL BACKUP & RESTORE SYSTEM
  exportAllData(): string {
    const workspaces = this.getWorkspaces();
    const activeWorkspaceId = this.getActiveWorkspaceId();
    const sessions = this.getSessions();
    const questions = this.getQuestions();
    const theme = typeof localStorage !== 'undefined' ? localStorage.getItem('concurso_estudos_theme') : null;

    const workspaceData: Record<string, {
      subjects?: Subject[];
      cycleConfig?: StudyCycleConfig | null;
      cycleBlocks?: StudyBlock[];
      cycleWeek?: string | null;
      concursoInfo?: ConcursoInfo | null;
      revisoes?: SpacedReview[];
      flashcards?: Flashcard[];
      autopilotSettings?: AutopilotSettings | null;
    }> = {};

    workspaces.forEach((ws) => {
      workspaceData[ws.id] = {
        subjects: this.getSubjects(ws.id),
        cycleConfig: this.getCycleConfig(ws.id),
        cycleBlocks: this.getCycleBlocks(ws.id),
        cycleWeek: this.getCycleWeek(ws.id),
        concursoInfo: this.getConcursoInfo(ws.id),
        revisoes: this.getRevisoes(ws.id),
        flashcards: this.getFlashcards(ws.id),
        autopilotSettings: this.getAutopilotSettings(ws.id),
      };
    });

    // Collect raw entries excluding sensitive auth session keys
    const rawKeys: Record<string, string> = {};
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          key.startsWith('concurso_estudos_') &&
          !key.includes('auth') &&
          !key.includes('mock_users')
        ) {
          const val = localStorage.getItem(key);
          if (val !== null) {
            rawKeys[key] = val;
          }
        }
      }
    }

    const payload = {
      app: 'estud.ai',
      version: 1,
      exportedAt: new Date().toISOString(),
      theme: theme || 'dark',
      workspaces,
      activeWorkspaceId,
      sessions,
      questions,
      workspaceData,
      rawKeys,
    };

    return JSON.stringify(payload, null, 2);
  },

  importAllData(jsonStr: string): { success: boolean; message: string } {
    try {
      if (!jsonStr || typeof jsonStr !== 'string') {
        return { success: false, message: 'Conteúdo do arquivo vazio ou inválido.' };
      }

      let data: any;
      try {
        data = JSON.parse(jsonStr);
      } catch {
        return { success: false, message: 'Arquivo não contém um JSON válido.' };
      }

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { success: false, message: 'Formato de backup inválido (esperado objeto JSON).' };
      }

      const hasWorkspaces = Array.isArray(data.workspaces) && data.workspaces.length > 0;
      const hasRawKeys = Boolean(data.rawKeys && typeof data.rawKeys === 'object' && Object.keys(data.rawKeys).length > 0);
      const hasWorkspaceData = Boolean(data.workspaceData && typeof data.workspaceData === 'object' && Object.keys(data.workspaceData).length > 0);

      if (!hasWorkspaces && !hasRawKeys && !hasWorkspaceData) {
        return { success: false, message: 'Estrutura de backup incompatível ou vazia (nenhum ciclo ou dado reconhecido).' };
      }

      // Clean up previous workspaces and active timer to prevent orphaned phantom keys
      try {
        const currentWs = this.getWorkspaces();
        currentWs.forEach((ws) => this.deleteWorkspaceKeys(ws.id));
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(KEYS.ACTIVE_TIMER);
        }
      } catch {
        // Non-fatal if cleanup encounters environment restriction
      }

      // 1. If rawKeys exists, restore them directly to preserve full fidelity
      if (hasRawKeys) {
        Object.entries(data.rawKeys).forEach(([k, v]) => {
          if (typeof v === 'string') {
            localStorage.setItem(k, v);
          }
        });
      }

      // 2. Restore global theme if present
      if (data.theme && typeof data.theme === 'string') {
        localStorage.setItem('concurso_estudos_theme', data.theme);
      }

      // 3. Structured restoration (guarantees consistency)
      let importedWsCount = 0;
      if (Array.isArray(data.workspaces)) {
        this.saveWorkspaces(data.workspaces);
        importedWsCount = data.workspaces.length;
      }

      if (data.activeWorkspaceId && typeof data.activeWorkspaceId === 'string') {
        this.setActiveWorkspaceId(data.activeWorkspaceId);
      } else if (Array.isArray(data.workspaces) && data.workspaces.length > 0) {
        this.setActiveWorkspaceId(data.workspaces[0].id);
      }

      let importedSessionsCount = 0;
      if (Array.isArray(data.sessions)) {
        this.saveSessions(data.sessions);
        importedSessionsCount = data.sessions.length;
      }

      let importedQuestionsCount = 0;
      if (Array.isArray(data.questions)) {
        this.saveQuestions(data.questions);
        importedQuestionsCount = data.questions.length;
      }

      if (data.workspaceData && typeof data.workspaceData === 'object') {
        Object.entries(data.workspaceData).forEach(([wsId, wsPayload]: [string, any]) => {
          if (!wsPayload || typeof wsPayload !== 'object') return;
          if (Array.isArray(wsPayload.subjects)) {
            this.saveSubjects(wsId, wsPayload.subjects);
          }
          if (wsPayload.cycleConfig) {
            this.saveCycleConfig(wsId, wsPayload.cycleConfig);
          }
          if (Array.isArray(wsPayload.cycleBlocks)) {
            this.saveCycleBlocks(wsId, wsPayload.cycleBlocks);
          }
          if (wsPayload.cycleWeek) {
            this.saveCycleWeek(wsId, wsPayload.cycleWeek);
          }
          if (wsPayload.concursoInfo) {
            this.saveConcursoInfo(wsId, wsPayload.concursoInfo);
          }
          if (Array.isArray(wsPayload.revisoes)) {
            this.saveRevisoes(wsId, wsPayload.revisoes);
          }
          if (Array.isArray(wsPayload.flashcards)) {
            this.saveFlashcards(wsId, wsPayload.flashcards);
          }
          if (wsPayload.autopilotSettings) {
            this.saveAutopilotSettings(wsId, wsPayload.autopilotSettings);
          }
        });
      }

      return {
        success: true,
        message: `Backup restaurado com sucesso! ${importedWsCount} ciclo(s), ${importedSessionsCount} sessões e ${importedQuestionsCount} questões recuperados.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao importar dados: ${err?.message || String(err)}`,
      };
    }
  },

  // WORKSPACE CLEANUP HELPER
  deleteWorkspaceKeys(workspaceId: string): void {
    localStorage.removeItem(KEYS.SUBJECTS(workspaceId));
    localStorage.removeItem(KEYS.CYCLE_CONFIG(workspaceId));
    localStorage.removeItem(KEYS.CYCLE_BLOCKS(workspaceId));
    localStorage.removeItem(KEYS.CYCLE_WEEK(workspaceId));
    localStorage.removeItem(KEYS.CONCURSO_INFO(workspaceId));
    localStorage.removeItem(KEYS.REVISOES(workspaceId));
    localStorage.removeItem(KEYS.FLASHCARDS(workspaceId));
    localStorage.removeItem(KEYS.AUTOPILOT_SETTINGS(workspaceId));
  },

  clearAll(): void {
    const workspaces = this.getWorkspaces();
    workspaces.forEach((ws) => this.deleteWorkspaceKeys(ws.id));
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.getUserScopedKey('workspaces'));
      localStorage.removeItem(this.getUserScopedKey('active_workspace_id'));
      localStorage.removeItem(this.getUserScopedKey('sessions'));
      localStorage.removeItem(this.getUserScopedKey('questions'));
      localStorage.removeItem(this.getUserScopedKey('active_timer'));
      if (!this.getCurrentUserId() || this.getCurrentUserId() === 'usr-demo-student') {
        localStorage.removeItem(KEYS.WORKSPACES);
        localStorage.removeItem(KEYS.ACTIVE_WORKSPACE_ID);
        localStorage.removeItem(KEYS.SESSIONS);
        localStorage.removeItem(KEYS.QUESTIONS);
        localStorage.removeItem(KEYS.ACTIVE_TIMER);
      }
    }
  }
};
