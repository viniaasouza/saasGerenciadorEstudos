import type { Subject, Subtopic, StudySession, QuestionSession, StudyBlock, StudyCycleConfig, CicloWorkspace, ConcursoInfo, SpacedReview, RunningTimerState, Flashcard, AutopilotSettings, GamificationProfile, GamificationActionType } from '../types';
import { resolveGranTaxonomy } from '../data/tceGoPreset';
import { DAYS_ORDER, getSundayOfWeek, getTodayDayName, reallocateIncompleteBlocks, allocateDaysToBlocks } from '../modules/cycle/cycleGenerator';
import { awardXp, calculateStreakFromDates } from '../modules/autopilot/gamification';
import { getLocalDateString, toLocalDateString } from '../modules/autopilot/autopilotEngine';

// Legacy wipe disarmed to preserve existing user data strictly (Zero Data Loss)
const CLEANUP_KEY = 'estud_ai_clean_v4';
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    if (!localStorage.getItem(CLEANUP_KEY)) {
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
  GAMIFICATION: 'concurso_estudos_gamification_profile',
};

export interface FullBackup {
  app?: string;
  version?: number;
  exportedAt?: string;
  theme?: string;
  workspaces?: CicloWorkspace[];
  activeWorkspaceId?: string | null;
  sessions?: StudySession[];
  questions?: QuestionSession[];
  workspaceData?: Record<string, {
    subjects?: Subject[];
    cycleConfig?: StudyCycleConfig | null;
    cycleBlocks?: StudyBlock[];
    cycleWeek?: string | null;
    concursoInfo?: ConcursoInfo | null;
    revisoes?: SpacedReview[];
    flashcards?: Flashcard[];
    autopilotSettings?: AutopilotSettings | null;
  }>;
  gamification?: GamificationProfile | null;
  rawKeys?: Record<string, string>;
}

type DataChangeListener = () => void;
const changeListeners = new Set<DataChangeListener>();

let currentUserId: string | null = null;

export const db = {
  subscribe(listener: DataChangeListener): () => void {
    changeListeners.add(listener);
    return () => {
      changeListeners.delete(listener);
    };
  },

  notifyChange(): void {
    changeListeners.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  },

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
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveWorkspaces(workspaces: CicloWorkspace[]): void {
    const key = this.getUserScopedKey('workspaces');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(workspaces));
    }
    this.notifyChange();
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
    this.notifyChange();
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
    this.notifyChange();
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
        domingo: 2,
        segunda: 4,
        terca: 4,
        quarta: 4,
        quinta: 4,
        sexta: 4,
        sabado: 2
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
    this.notifyChange();
  },

  getCycleBlocks(workspaceId: string): StudyBlock[] {
    if (!workspaceId) return [];
    const data = localStorage.getItem(KEYS.CYCLE_BLOCKS(workspaceId));
    return data ? JSON.parse(data) : [];
  },

  saveCycleBlocks(workspaceId: string, blocks: StudyBlock[]): void {
    if (!workspaceId) return;
    localStorage.setItem(KEYS.CYCLE_BLOCKS(workspaceId), JSON.stringify(blocks));
    this.notifyChange();
  },

  getCycleWeek(workspaceId: string): string | null {
    if (!workspaceId) return null;
    return localStorage.getItem(KEYS.CYCLE_WEEK(workspaceId));
  },

  saveCycleWeek(workspaceId: string, weekSunday: string): void {
    if (!workspaceId) return;
    localStorage.setItem(KEYS.CYCLE_WEEK(workspaceId), weekSunday);
    this.notifyChange();
  },

  /**
   * Marks a cycle block completed.
   * If blockId is provided, matches by ID.
   * Otherwise matches the first uncompleted block for the given subject (prioritizing today's day).
   */
  markBlockCompleted(workspaceId: string, blockId?: string, subjectId?: string, subjectName?: string): boolean {
    if (!workspaceId) return false;
    const blocks = this.getCycleBlocks(workspaceId);
    if (blocks.length === 0) return false;

    let targetIdx = -1;
    if (blockId) {
      targetIdx = blocks.findIndex((b) => b.id === blockId);
    }

    if (targetIdx === -1 && (subjectId || subjectName)) {
      const todayDayName = getTodayDayName();
      // First try to find uncompleted block on today
      targetIdx = blocks.findIndex((b) => {
        if (b.completed) return false;
        const matchesSub = (subjectId && b.subjectId === subjectId) ||
          (subjectName && b.subjectName.toLowerCase() === subjectName.toLowerCase());
        return matchesSub && b.dayAllocated === todayDayName;
      });

      // Otherwise find the first uncompleted block for this subject in the whole cycle
      if (targetIdx === -1) {
        targetIdx = blocks.findIndex((b) => {
          if (b.completed) return false;
          return (subjectId && b.subjectId === subjectId) ||
            (subjectName && b.subjectName.toLowerCase() === subjectName.toLowerCase());
        });
      }
    }

    if (targetIdx !== -1) {
      blocks[targetIdx].completed = true;
      blocks[targetIdx].completedAt = new Date().toISOString();
      this.saveCycleBlocks(workspaceId, blocks);
      return true;
    }

    return false;
  },

  /**
   * Synchronizes the study cycle schedule:
   * 1. Detects if a new study week (Sunday to Saturday) has started:
   *    - Resets all cycle blocks to completed: false, completedAt: undefined
   *    - Updates CYCLE_WEEK to current Sunday
   *    - Reallocates blocks cleanly according to cycleConfig.dailyHours starting from Sunday
   * 2. If same week: detects if there are incomplete blocks from days before today (Monday-Saturday):
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
    const currentSunday = getSundayOfWeek(currentDate);
    const savedSunday = this.getCycleWeek(workspaceId);
    const todayDayName = getTodayDayName(currentDate);
    const todayIdx = DAYS_ORDER.indexOf(todayDayName as any);

    let wasReset = false;
    let wasReallocated = false;

    // Case 1: First time initializing week key
    if (!savedSunday) {
      this.saveCycleWeek(workspaceId, currentSunday);
    }
    // Case 2: Week rolled over (turned from Saturday to Sunday)
    else if (savedSunday !== currentSunday) {
      wasReset = true;
      // Reset all blocks completions
      const resetBlocks: StudyBlock[] = blocks.map((b) => ({
        ...b,
        completed: false,
        completedAt: undefined,
      }));
      // Reallocate all blocks across the new week starting from Sunday (Domingo a Sábado)
      const reallocated = allocateDaysToBlocks(resetBlocks, config.dailyHours || {});
      this.saveCycleBlocks(workspaceId, reallocated);
      this.saveCycleWeek(workspaceId, currentSunday);
      return { wasReset: true, wasReallocated: true, blocks: reallocated };
    }

    // Case 3: Same week - check for incomplete blocks assigned to days before today (only Monday to Saturday)
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
   * Keeps subject sequence, resets completed flags and reallocates from Sunday.
   */
  restartCycle(workspaceId: string, currentDate: Date = new Date()): StudyBlock[] {
    if (!workspaceId) return [];
    const blocks = this.getCycleBlocks(workspaceId);
    if (blocks.length === 0) return [];

    const config = this.getCycleConfig(workspaceId);
    const currentSunday = getSundayOfWeek(currentDate);

    const resetBlocks: StudyBlock[] = blocks.map((b) => ({
      ...b,
      completed: false,
      completedAt: undefined,
    }));

    const reallocated = allocateDaysToBlocks(resetBlocks, config.dailyHours || {});
    this.saveCycleBlocks(workspaceId, reallocated);
    this.saveCycleWeek(workspaceId, currentSunday);
    return reallocated;
  },

  // GLOBAL DATA HELPERS WITH WORKSPACE TAGS & USER SCOPING
  getSessions(): StudySession[] {
    const key = this.getUserScopedKey('sessions');
    const data = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveSessions(sessions: StudySession[]): void {
    const key = this.getUserScopedKey('sessions');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(sessions));
    }
    this.notifyChange();
  },

  deleteSession(sessionId: string): void {
    const sessions = this.getSessions().filter((s) => s.id !== sessionId);
    this.saveSessions(sessions);
  },

  getQuestions(): QuestionSession[] {
    const key = this.getUserScopedKey('questions');
    const data = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveQuestions(questions: QuestionSession[]): void {
    const key = this.getUserScopedKey('questions');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(questions));
    }
    this.notifyChange();
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
    this.notifyChange();
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
    this.notifyChange();
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
    this.notifyChange();
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
      autoScheduleD1Review: false,
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
    this.notifyChange();
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
    blockId?: string,
    scheduleD1?: boolean
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
    const shouldScheduleD1 = scheduleD1 !== undefined ? scheduleD1 : settings.autoScheduleD1Review;
    let scheduledReview: SpacedReview | null = null;
    if (shouldScheduleD1) {
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

  /**
   * Records study session for completed spaced review (leitura de resumo).
   * Adds fixed average time (default 10 minutes = 600s).
   */
  recordReviewStudySession(
    workspaceId: string,
    review: SpacedReview,
    durationMinutes: number = 10
  ): StudySession | null {
    if (!workspaceId || !review) return null;

    const wsList = this.getWorkspaces();
    const currentWs = wsList.find((w) => w.id === workspaceId);
    const workspaceName = currentWs ? currentWs.name : undefined;

    const sessionId = `session-rev-${review.id}`;
    const sessions = this.getSessions();
    const existingIdx = sessions.findIndex((s) => s.id === sessionId);

    const revSession: StudySession = {
      id: sessionId,
      subjectId: review.subjectId,
      subjectName: review.subjectName,
      topicName: review.topicName,
      durationSeconds: durationMinutes * 60,
      date: new Date().toISOString(),
      studyType: 'revisao',
      workspaceId,
      workspaceName,
      notes: `Leitura de resumo / Revisão espaçada (${review.days ? `D+${review.days}` : 'Resumo'}) concluída (${durationMinutes} min)`,
    };

    if (existingIdx !== -1) {
      sessions[existingIdx] = revSession;
      this.saveSessions(sessions);
    } else {
      this.saveSessions([revSession, ...sessions]);
    }

    return revSession;
  },

  /**
   * Removes study session associated with an undone review.
   */
  removeReviewStudySession(workspaceId: string, reviewId: string): void {
    if (!workspaceId || !reviewId) return;
    const sessionId = `session-rev-${reviewId}`;
    const sessions = this.getSessions();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    if (filtered.length !== sessions.length) {
      this.saveSessions(filtered);
    }
  },

  /**
   * Records study session for completed flashcard review.
   * Adds fixed average time (default 30s per card).
   */
  recordFlashcardStudySession(
    workspaceId: string,
    card: Flashcard,
    durationSeconds: number = 30
  ): StudySession | null {
    if (!workspaceId || !card) return null;

    const wsList = this.getWorkspaces();
    const currentWs = wsList.find((w) => w.id === workspaceId);
    const workspaceName = currentWs ? currentWs.name : undefined;

    const fcSession: StudySession = {
      id: `session-fc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      subjectId: card.subjectId || 'flashcards',
      subjectName: card.subjectName || 'Flashcards',
      topicName: card.topicName || 'Revisão Anki SM-2',
      durationSeconds,
      date: new Date().toISOString(),
      studyType: 'revisao',
      workspaceId,
      workspaceName,
      notes: 'Revisão de flashcard (30s)',
    };

    const sessions = this.getSessions();
    this.saveSessions([fcSession, ...sessions]);
    return fcSession;
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

    const payload: FullBackup = {
      app: 'ixtude.ai',
      version: 2,
      exportedAt: new Date().toISOString(),
      theme: theme || 'dark',
      workspaces,
      activeWorkspaceId,
      sessions,
      questions,
      workspaceData,
      gamification: this.getGamificationProfile(),
      rawKeys,
    };

    return JSON.stringify(payload, null, 2);
  },

  // THREE-WAY NON-DESTRUCTIVE MERGE ENGINE (Zero Data Loss)
  mergeData(localData: FullBackup, cloudData: FullBackup): FullBackup {
    if (!cloudData || typeof cloudData !== 'object') {
      return localData || { workspaces: [], sessions: [], questions: [], workspaceData: {} };
    }
    if (!localData || typeof localData !== 'object') {
      return cloudData;
    }

    // 1. Sessions: Union deduplicated by ID, sorted chronologically
    const sessionMap = new Map<string, StudySession>();
    (cloudData.sessions || []).forEach((s) => {
      if (s && s.id) sessionMap.set(s.id, s);
    });
    (localData.sessions || []).forEach((s) => {
      if (s && s.id) sessionMap.set(s.id, s);
    });
    const mergedSessions = Array.from(sessionMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // 2. Questions: Union deduplicated by ID, sorted chronologically
    const questionMap = new Map<string, QuestionSession>();
    (cloudData.questions || []).forEach((q) => {
      if (q && q.id) questionMap.set(q.id, q);
    });
    (localData.questions || []).forEach((q) => {
      if (q && q.id) questionMap.set(q.id, q);
    });
    const mergedQuestions = Array.from(questionMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // 3. Workspaces: Preserve all unique workspaces; prune blank auto-generated "Meu Concurso" if genuine exist
    const wsMap = new Map<string, CicloWorkspace>();
    const allWs = [...(cloudData.workspaces || []), ...(localData.workspaces || [])];
    allWs.forEach((w) => {
      if (w && w.id) wsMap.set(w.id, w);
    });
    let mergedWorkspaces = Array.from(wsMap.values());
    const genuineWs = mergedWorkspaces.filter((w) => {
      if (w.name !== 'Meu Concurso') return true;
      const wsData = localData.workspaceData?.[w.id] || cloudData.workspaceData?.[w.id];
      return Boolean(wsData?.subjects && wsData.subjects.length > 0);
    });
    if (genuineWs.length > 0) {
      mergedWorkspaces = genuineWs;
    }

    // 4. Workspace Data (Subjects, Subtopics OR logic, Flashcards SM-2)
    const mergedWsData: Record<string, any> = {};
    const allWsIds = new Set([
      ...Object.keys(cloudData.workspaceData || {}),
      ...Object.keys(localData.workspaceData || {}),
    ]);

    allWsIds.forEach((wsId) => {
      const cloudWs = cloudData.workspaceData?.[wsId] || {};
      const localWs = localData.workspaceData?.[wsId] || {};

      // Subjects and Subtopics: Combine completion with logical OR (local.completed || remote.completed)
      const localSubjects: Subject[] = localWs.subjects || [];
      const cloudSubjects: Subject[] = cloudWs.subjects || [];
      const subjectMap = new Map<string, Subject>();

      cloudSubjects.forEach((sub) => {
        if (sub?.id) subjectMap.set(sub.id, JSON.parse(JSON.stringify(sub)));
      });

      localSubjects.forEach((lSub) => {
        if (!lSub?.id) return;
        if (!subjectMap.has(lSub.id)) {
          subjectMap.set(lSub.id, JSON.parse(JSON.stringify(lSub)));
        } else {
          const existing = subjectMap.get(lSub.id)!;
          existing.name = lSub.name || existing.name;
          existing.weight = lSub.weight || existing.weight;
          existing.targetHours = lSub.targetHours || existing.targetHours;
          existing.status = lSub.status || existing.status;
          existing.granCourseUrl = lSub.granCourseUrl || existing.granCourseUrl;
          existing.granQuery = lSub.granQuery || existing.granQuery;
          existing.assuntoId = lSub.assuntoId || existing.assuntoId;
          existing.disciplinaId = lSub.disciplinaId || existing.disciplinaId;
          existing.notes = lSub.notes || existing.notes;

          const localTopics = lSub.topics || [];
          const existingTopics = existing.topics || [];
          const topMap = new Map<string, any>();

          existingTopics.forEach((t) => topMap.set(t.id, t));
          localTopics.forEach((lt) => {
            if (!topMap.has(lt.id)) {
              existingTopics.push(lt);
            } else {
              const exTop = topMap.get(lt.id);
              const exSubtopics: Subtopic[] = exTop.subtopics || [];
              const lSubtopics: Subtopic[] = lt.subtopics || [];
              const stMap = new Map<string, Subtopic>();

              exSubtopics.forEach((st) => stMap.set(st.id, st));
              lSubtopics.forEach((lst) => {
                if (!stMap.has(lst.id)) {
                  exSubtopics.push(lst);
                } else {
                  const exSt = stMap.get(lst.id)!;
                  exSt.completed = Boolean(exSt.completed || lst.completed);
                  if (lst.completedAt && (!exSt.completedAt || new Date(lst.completedAt) < new Date(exSt.completedAt))) {
                    exSt.completedAt = lst.completedAt;
                  }
                  if ((lst as any).questionsAttempted) {
                    (exSt as any).questionsAttempted = Math.max((exSt as any).questionsAttempted || 0, (lst as any).questionsAttempted);
                  }
                  if (lst.acertos !== undefined) {
                    exSt.acertos = Math.max(exSt.acertos || 0, lst.acertos || 0);
                  }
                  if (lst.erros !== undefined) {
                    exSt.erros = Math.max(exSt.erros || 0, lst.erros || 0);
                  }
                  if (lst.videoWatched) exSt.videoWatched = true;
                  if (lst.pdfRead) exSt.pdfRead = true;
                  if (lst.notes && !exSt.notes) exSt.notes = lst.notes;
                  if (lst.videoLesson && !exSt.videoLesson) exSt.videoLesson = lst.videoLesson;
                  if (lst.pdfLesson && !exSt.pdfLesson) exSt.pdfLesson = lst.pdfLesson;
                }
              });
              exTop.subtopics = exSubtopics;
            }
          });
          existing.topics = existingTopics;
        }
      });

      // Flashcards: Union deduplicated by ID, prioritize highest SM-2 interval & repetition count
      const cardMap = new Map<string, Flashcard>();
      (cloudWs.flashcards || []).forEach((c: Flashcard) => {
        if (c?.id) cardMap.set(c.id, c);
      });
      (localWs.flashcards || []).forEach((c: Flashcard) => {
        if (!c?.id) return;
        if (!cardMap.has(c.id)) {
          cardMap.set(c.id, c);
        } else {
          const cloudCard = cardMap.get(c.id)!;
          const bestCard = (c.interval || 0) > (cloudCard.interval || 0)
            ? c
            : (c.interval || 0) === (cloudCard.interval || 0) && (c.repetition || 0) >= (cloudCard.repetition || 0)
            ? c
            : cloudCard;
          cardMap.set(c.id, bestCard);
        }
      });

      // Spaced Reviews (Revisoes): Union deduplicated by ID, logical OR on done
      const revMap = new Map<string, SpacedReview>();
      (cloudWs.revisoes || []).forEach((r: SpacedReview) => {
        if (r?.id) revMap.set(r.id, { ...r });
      });
      (localWs.revisoes || []).forEach((r: SpacedReview) => {
        if (!r?.id) return;
        if (!revMap.has(r.id)) {
          revMap.set(r.id, { ...r });
        } else {
          const exRev = revMap.get(r.id)!;
          exRev.done = Boolean(exRev.done || r.done);
          if (r.completedAt && !exRev.completedAt) exRev.completedAt = r.completedAt;
        }
      });

      mergedWsData[wsId] = {
        ...cloudWs,
        ...localWs,
        subjects: Array.from(subjectMap.values()),
        flashcards: Array.from(cardMap.values()),
        revisoes: Array.from(revMap.values()),
        cycleConfig: localWs.cycleConfig || cloudWs.cycleConfig || null,
        cycleBlocks: (localWs.cycleBlocks && localWs.cycleBlocks.length > 0) ? localWs.cycleBlocks : (cloudWs.cycleBlocks || []),
        cycleWeek: localWs.cycleWeek || cloudWs.cycleWeek || null,
        concursoInfo: (localWs.concursoInfo?.concurso && localWs.concursoInfo?.dataProva)
          ? localWs.concursoInfo
          : (cloudWs.concursoInfo || localWs.concursoInfo || null),
        autopilotSettings: localWs.autopilotSettings || cloudWs.autopilotSettings || null,
      };
    });

    // 5. Gamification: Maximum streak, total XP, and all earned badges
    let mergedGamification: GamificationProfile | null = null;
    const localGam = localData.gamification;
    const cloudGam = cloudData.gamification;
    if (localGam || cloudGam) {
      const dailyXp: Record<string, number> = { ...(cloudGam?.dailyXp || {}) };
      if (localGam?.dailyXp) {
        Object.entries(localGam.dailyXp).forEach(([date, xp]) => {
          dailyXp[date] = Math.max(dailyXp[date] || 0, xp);
        });
      }

      const historyIds = new Set<string>();
      const combinedHistory = [
        ...(cloudGam?.history || []),
        ...(localGam?.history || []),
      ].filter((item) => {
        if (!item) return false;
        const key = item.id || `${item.timestamp || (item as any).date}_${item.type}_${item.description}`;
        if (historyIds.has(key)) return false;
        historyIds.add(key);
        return true;
      });

      mergedGamification = {
        totalXp: Math.max(localGam?.totalXp || 0, cloudGam?.totalXp || 0),
        dailyXp,
        currentStreak: Math.max(localGam?.currentStreak || 0, cloudGam?.currentStreak || 0),
        longestStreak: Math.max(localGam?.longestStreak || 0, cloudGam?.longestStreak || 0),
        lastActiveDate: localGam?.lastActiveDate || cloudGam?.lastActiveDate,
        history: combinedHistory,
      };
    }

    return {
      app: 'ixtude.ai',
      version: 2,
      exportedAt: new Date().toISOString(),
      theme: localData.theme || cloudData.theme || 'dark',
      workspaces: mergedWorkspaces,
      activeWorkspaceId: localData.activeWorkspaceId || cloudData.activeWorkspaceId || (mergedWorkspaces[0]?.id ?? null),
      sessions: mergedSessions,
      questions: mergedQuestions,
      workspaceData: mergedWsData,
      gamification: mergedGamification,
    };
  },

  // GUEST ACCOUNT MIGRATION ON LOGIN (Zero Data Loss)
  migrateGuestData(_guestUserId: string | null = null, targetUserId: string): void {
    if (!targetUserId || typeof localStorage === 'undefined') return;

    try {
      const prefix = 'concurso_estudos_';
      const userPrefix = `concurso_estudos_${targetUserId}_`;
      const guestKeys: string[] = [];

      const guestKeyPatterns = [
        'concurso_estudos_workspaces',
        'concurso_estudos_active_workspace_id',
        'concurso_estudos_sessions',
        'concurso_estudos_questions',
        'concurso_estudos_gamification_profile',
        'concurso_estudos_active_timer',
      ];

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(prefix) || k.includes(`_${targetUserId}_`)) continue;

        const isExactGuestBase = guestKeyPatterns.includes(k);
        const isGuestDynamic =
          k.startsWith('concurso_estudos_subjects_') ||
          k.startsWith('concurso_estudos_cycle_config_') ||
          k.startsWith('concurso_estudos_cycle_blocks_') ||
          k.startsWith('concurso_estudos_cycle_week_') ||
          k.startsWith('concurso_estudos_concurso_info_') ||
          k.startsWith('concurso_estudos_revisoes_') ||
          k.startsWith('concurso_estudos_flashcards_') ||
          k.startsWith('concurso_estudos_autopilot_settings_');

        if (isExactGuestBase || isGuestDynamic) {
          guestKeys.push(k);
        }
      }

      guestKeys.forEach((guestKey) => {
        const val = localStorage.getItem(guestKey);
        if (val === null) return;

        const suffix = guestKey.substring(prefix.length);
        const userKey = `${userPrefix}${suffix}`;
        const existingUserVal = localStorage.getItem(userKey);

        if (!existingUserVal) {
          localStorage.setItem(userKey, val);
        } else {
          try {
            if (suffix === 'workspaces') {
              const guestWs: CicloWorkspace[] = JSON.parse(val);
              const userWs: CicloWorkspace[] = JSON.parse(existingUserVal);
              const wsMap = new Map<string, CicloWorkspace>();
              userWs.forEach((w) => wsMap.set(w.id, w));
              guestWs.forEach((w) => {
                if (!wsMap.has(w.id)) wsMap.set(w.id, w);
              });
              let merged = Array.from(wsMap.values());
              const genuine = merged.filter((w) => w.name !== 'Meu Concurso');
              if (genuine.length > 0) merged = genuine;
              localStorage.setItem(userKey, JSON.stringify(merged));
            } else if (suffix === 'sessions') {
              const guestSess: StudySession[] = JSON.parse(val);
              const userSess: StudySession[] = JSON.parse(existingUserVal);
              const sessMap = new Map<string, StudySession>();
              userSess.forEach((s) => sessMap.set(s.id, s));
              guestSess.forEach((s) => sessMap.set(s.id, s));
              const merged = Array.from(sessMap.values()).sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              );
              localStorage.setItem(userKey, JSON.stringify(merged));
            } else if (suffix === 'questions') {
              const guestQ: QuestionSession[] = JSON.parse(val);
              const userQ: QuestionSession[] = JSON.parse(existingUserVal);
              const qMap = new Map<string, QuestionSession>();
              userQ.forEach((q) => qMap.set(q.id, q));
              guestQ.forEach((q) => qMap.set(q.id, q));
              const merged = Array.from(qMap.values()).sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              );
              localStorage.setItem(userKey, JSON.stringify(merged));
            } else if (suffix === 'gamification_profile') {
              const guestGam: GamificationProfile = JSON.parse(val);
              const userGam: GamificationProfile = JSON.parse(existingUserVal);
              const mergedGam: GamificationProfile = {
                totalXp: Math.max(guestGam.totalXp || 0, userGam.totalXp || 0),
                currentStreak: Math.max(guestGam.currentStreak || 0, userGam.currentStreak || 0),
                longestStreak: Math.max(guestGam.longestStreak || 0, userGam.longestStreak || 0),
                dailyXp: { ...(userGam.dailyXp || {}), ...(guestGam.dailyXp || {}) },
                history: [...(userGam.history || []), ...(guestGam.history || [])],
              };
              localStorage.setItem(userKey, JSON.stringify(mergedGam));
            }
          } catch {
            // Keep existing on parse failure
          }
        }
      });
    } catch {
      // Non-fatal
    }
  },

  importAllData(jsonStr: string, options: { merge?: boolean } = { merge: true }): { success: boolean; message: string } {
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

      // If merge mode is enabled (default), execute non-destructive merge with current state
      if (options?.merge !== false) {
        try {
          const currentLocal = JSON.parse(this.exportAllData());
          data = this.mergeData(currentLocal, data);
        } catch {}
      }

      // 1. If rawKeys exists and merge is disabled, restore them directly
      if (hasRawKeys && options?.merge === false) {
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

      if (data.gamification) {
        this.saveGamificationProfile(data.gamification);
      }

      this.notifyChange();

      return {
        success: true,
        message: `Backup restaurado com sucesso! ${importedWsCount} ciclo(s), ${importedSessionsCount} sessões e ${importedQuestionsCount} questões recuperados sem perda de dados.`,
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

  getGamificationProfile(): GamificationProfile {
    const key = this.getUserScopedKey('gamification_profile');
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.totalXp === 'number') {
            return parsed;
          }
        }
      } catch {}
    }

    // Default initialization based on existing study activity
    const todayStr = getLocalDateString();
    const sessions = this.getSessions();
    const questions = this.getQuestions();

    const activeDates = Array.from(
      new Set([
        ...sessions.map((s) => toLocalDateString(s.date)).filter(Boolean),
        ...questions.map((q) => toLocalDateString(q.date)).filter(Boolean),
      ])
    );

    const calculatedStreak = calculateStreakFromDates(activeDates, todayStr);

    let initialXp = 0;
    const initialDailyXp: Record<string, number> = {};

    questions.forEach((q) => {
      const qDate = toLocalDateString(q.date);
      if (!qDate) return;
      const xp = (q.attempted || 0) * 5 + (q.correct || 0) * 5;
      initialXp += xp;
      initialDailyXp[qDate] = (initialDailyXp[qDate] || 0) + xp;
    });

    sessions.forEach((s) => {
      const sDate = toLocalDateString(s.date);
      if (!sDate) return;
      const xp = s.studyType === 'teoria' ? 50 : 30;
      initialXp += xp;
      initialDailyXp[sDate] = (initialDailyXp[sDate] || 0) + xp;
    });

    const defaultProfile: GamificationProfile = {
      totalXp: initialXp,
      dailyXp: initialDailyXp,
      currentStreak: calculatedStreak,
      longestStreak: Math.max(calculatedStreak, activeDates.length > 0 ? 1 : 0),
      lastActiveDate: activeDates.includes(todayStr) ? todayStr : activeDates[0] || undefined,
      history: [],
    };

    return defaultProfile;
  },

  saveGamificationProfile(profile: GamificationProfile): void {
    const key = this.getUserScopedKey('gamification_profile');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(profile));
    }
    this.notifyChange();
  },

  awardXpAction(
    actionType: GamificationActionType,
    xpAwarded: number,
    description: string,
    workspaceId?: string
  ): { profile: GamificationProfile; levelUp: boolean; oldLevel: number; newLevel: number } {
    const currentProfile = this.getGamificationProfile();
    const todayStr = getLocalDateString();
    const { updatedProfile, levelUp, oldLevel, newLevel } = awardXp(
      currentProfile,
      {
        type: actionType,
        xpAwarded,
        description,
        workspaceId,
      },
      todayStr
    );
    this.saveGamificationProfile(updatedProfile);
    return { profile: updatedProfile, levelUp, oldLevel, newLevel };
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
      localStorage.removeItem(this.getUserScopedKey('gamification_profile'));
      if (!this.getCurrentUserId() || this.getCurrentUserId() === 'usr-demo-student') {
        localStorage.removeItem(KEYS.WORKSPACES);
        localStorage.removeItem(KEYS.ACTIVE_WORKSPACE_ID);
        localStorage.removeItem(KEYS.SESSIONS);
        localStorage.removeItem(KEYS.QUESTIONS);
        localStorage.removeItem(KEYS.ACTIVE_TIMER);
        localStorage.removeItem(KEYS.GAMIFICATION);
      }
    }
  }
};
