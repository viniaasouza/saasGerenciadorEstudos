import type { Subject, StudySession, QuestionSession, StudyBlock, StudyCycleConfig, CicloWorkspace } from '../types';

const KEYS = {
  WORKSPACES: 'concurso_estudos_workspaces',
  ACTIVE_WORKSPACE_ID: 'concurso_estudos_active_workspace_id',
  SESSIONS: 'concurso_estudos_sessions',
  QUESTIONS: 'concurso_estudos_questions',
  // Dynamic template keys
  SUBJECTS: (wsId: string) => `concurso_estudos_subjects_${wsId}`,
  CYCLE_CONFIG: (wsId: string) => `concurso_estudos_cycle_config_${wsId}`,
  CYCLE_BLOCKS: (wsId: string) => `concurso_estudos_cycle_blocks_${wsId}`,
};

export const db = {
  // WORKSPACE METADATA HELPERS
  getWorkspaces(): CicloWorkspace[] {
    const data = localStorage.getItem(KEYS.WORKSPACES);
    return data ? JSON.parse(data) : [];
  },

  saveWorkspaces(workspaces: CicloWorkspace[]): void {
    localStorage.setItem(KEYS.WORKSPACES, JSON.stringify(workspaces));
  },

  getActiveWorkspaceId(): string | null {
    return localStorage.getItem(KEYS.ACTIVE_WORKSPACE_ID);
  },

  setActiveWorkspaceId(id: string): void {
    localStorage.setItem(KEYS.ACTIVE_WORKSPACE_ID, id);
  },

  // WORKSPACE SPECIFIC DATA HELPERS (using workspaceId)
  getSubjects(workspaceId: string): Subject[] {
    if (!workspaceId) return [];
    const data = localStorage.getItem(KEYS.SUBJECTS(workspaceId));
    return data ? JSON.parse(data) : [];
  },

  saveSubjects(workspaceId: string, subjects: Subject[]): void {
    if (!workspaceId) return;
    localStorage.setItem(KEYS.SUBJECTS(workspaceId), JSON.stringify(subjects));
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

  // GLOBAL DATA HELPERS WITH WORKSPACE TAGS
  getSessions(): StudySession[] {
    const data = localStorage.getItem(KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  },

  saveSessions(sessions: StudySession[]): void {
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
  },

  getQuestions(): QuestionSession[] {
    const data = localStorage.getItem(KEYS.QUESTIONS);
    return data ? JSON.parse(data) : [];
  },

  saveQuestions(questions: QuestionSession[]): void {
    localStorage.setItem(KEYS.QUESTIONS, JSON.stringify(questions));
  },

  // WORKSPACE CLEANUP HELPER
  deleteWorkspaceKeys(workspaceId: string): void {
    localStorage.removeItem(KEYS.SUBJECTS(workspaceId));
    localStorage.removeItem(KEYS.CYCLE_CONFIG(workspaceId));
    localStorage.removeItem(KEYS.CYCLE_BLOCKS(workspaceId));
  },

  clearAll(): void {
    const workspaces = this.getWorkspaces();
    workspaces.forEach(ws => this.deleteWorkspaceKeys(ws.id));
    localStorage.removeItem(KEYS.WORKSPACES);
    localStorage.removeItem(KEYS.ACTIVE_WORKSPACE_ID);
    localStorage.removeItem(KEYS.SESSIONS);
    localStorage.removeItem(KEYS.QUESTIONS);
  }
};
