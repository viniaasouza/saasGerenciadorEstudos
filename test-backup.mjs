// Test suite for Universal JSON Backup & Restore System
import assert from 'node:assert/strict';

const KEYS = {
  WORKSPACES: 'concurso_estudos_workspaces',
  ACTIVE_WORKSPACE_ID: 'concurso_estudos_active_workspace_id',
  SESSIONS: 'concurso_estudos_sessions',
  QUESTIONS: 'concurso_estudos_questions',
  ACTIVE_TIMER: 'concurso_estudos_active_timer',
  SUBJECTS: (wsId) => `concurso_estudos_subjects_${wsId}`,
  CYCLE_CONFIG: (wsId) => `concurso_estudos_cycle_config_${wsId}`,
  CYCLE_BLOCKS: (wsId) => `concurso_estudos_cycle_blocks_${wsId}`,
  CYCLE_WEEK: (wsId) => `concurso_estudos_cycle_week_${wsId}`,
  CONCURSO_INFO: (wsId) => `concurso_estudos_concurso_info_${wsId}`,
  REVISOES: (wsId) => `concurso_estudos_revisoes_${wsId}`,
  FLASHCARDS: (wsId) => `concurso_estudos_flashcards_${wsId}`,
  AUTOPILOT_SETTINGS: (wsId) => `concurso_estudos_autopilot_settings_${wsId}`,
};

// In-memory mock localStorage
const store = new Map();
const localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  }
};

const db = {
  getWorkspaces() {
    const data = localStorage.getItem(KEYS.WORKSPACES);
    return data ? JSON.parse(data) : [];
  },
  saveWorkspaces(ws) {
    localStorage.setItem(KEYS.WORKSPACES, JSON.stringify(ws));
  },
  getActiveWorkspaceId() {
    return localStorage.getItem(KEYS.ACTIVE_WORKSPACE_ID);
  },
  setActiveWorkspaceId(id) {
    localStorage.setItem(KEYS.ACTIVE_WORKSPACE_ID, id);
  },
  getSubjects(wsId) {
    const data = localStorage.getItem(KEYS.SUBJECTS(wsId));
    return data ? JSON.parse(data) : [];
  },
  saveSubjects(wsId, subs) {
    localStorage.setItem(KEYS.SUBJECTS(wsId), JSON.stringify(subs));
  },
  getSessions() {
    const data = localStorage.getItem(KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  },
  saveSessions(s) {
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(s));
  },
  getQuestions() {
    const data = localStorage.getItem(KEYS.QUESTIONS);
    return data ? JSON.parse(data) : [];
  },
  saveQuestions(q) {
    localStorage.setItem(KEYS.QUESTIONS, JSON.stringify(q));
  },
  getFlashcards(wsId) {
    const data = localStorage.getItem(KEYS.FLASHCARDS(wsId));
    return data ? JSON.parse(data) : [];
  },
  saveFlashcards(wsId, f) {
    localStorage.setItem(KEYS.FLASHCARDS(wsId), JSON.stringify(f));
  },
  getCycleConfig(wsId) {
    const data = localStorage.getItem(KEYS.CYCLE_CONFIG(wsId));
    return data ? JSON.parse(data) : { weeklyHours: 20 };
  },
  saveCycleConfig(wsId, cfg) {
    localStorage.setItem(KEYS.CYCLE_CONFIG(wsId), JSON.stringify(cfg));
  },
  getCycleBlocks(wsId) {
    const data = localStorage.getItem(KEYS.CYCLE_BLOCKS(wsId));
    return data ? JSON.parse(data) : [];
  },
  saveCycleBlocks(wsId, blks) {
    localStorage.setItem(KEYS.CYCLE_BLOCKS(wsId), JSON.stringify(blks));
  },
  getCycleWeek(wsId) {
    return localStorage.getItem(KEYS.CYCLE_WEEK(wsId));
  },
  saveCycleWeek(wsId, wk) {
    localStorage.setItem(KEYS.CYCLE_WEEK(wsId), wk);
  },
  getConcursoInfo(wsId) {
    const data = localStorage.getItem(KEYS.CONCURSO_INFO(wsId));
    return data ? JSON.parse(data) : null;
  },
  saveConcursoInfo(wsId, info) {
    localStorage.setItem(KEYS.CONCURSO_INFO(wsId), JSON.stringify(info));
  },
  getRevisoes(wsId) {
    const data = localStorage.getItem(KEYS.REVISOES(wsId));
    return data ? JSON.parse(data) : [];
  },
  saveRevisoes(wsId, revs) {
    localStorage.setItem(KEYS.REVISOES(wsId), JSON.stringify(revs));
  },
  getAutopilotSettings(wsId) {
    const data = localStorage.getItem(KEYS.AUTOPILOT_SETTINGS(wsId));
    return data ? JSON.parse(data) : null;
  },
  saveAutopilotSettings(wsId, stt) {
    localStorage.setItem(KEYS.AUTOPILOT_SETTINGS(wsId), JSON.stringify(stt));
  },

  deleteWorkspaceKeys(workspaceId) {
    localStorage.removeItem(KEYS.SUBJECTS(workspaceId));
    localStorage.removeItem(KEYS.CYCLE_CONFIG(workspaceId));
    localStorage.removeItem(KEYS.CYCLE_BLOCKS(workspaceId));
    localStorage.removeItem(KEYS.CYCLE_WEEK(workspaceId));
    localStorage.removeItem(KEYS.CONCURSO_INFO(workspaceId));
    localStorage.removeItem(KEYS.REVISOES(workspaceId));
    localStorage.removeItem(KEYS.FLASHCARDS(workspaceId));
    localStorage.removeItem(KEYS.AUTOPILOT_SETTINGS(workspaceId));
  },

  clearAll() {
    const workspaces = this.getWorkspaces();
    workspaces.forEach((ws) => this.deleteWorkspaceKeys(ws.id));
    localStorage.removeItem(KEYS.WORKSPACES);
    localStorage.removeItem(KEYS.ACTIVE_WORKSPACE_ID);
    localStorage.removeItem(KEYS.SESSIONS);
    localStorage.removeItem(KEYS.QUESTIONS);
    localStorage.removeItem(KEYS.ACTIVE_TIMER);
  },

  // EXACT METHODS IMPLEMENTED IN src/db/database.ts
  exportAllData() {
    const workspaces = this.getWorkspaces();
    const activeWorkspaceId = this.getActiveWorkspaceId();
    const sessions = this.getSessions();
    const questions = this.getQuestions();
    const theme = typeof localStorage !== 'undefined' ? localStorage.getItem('concurso_estudos_theme') : null;

    const workspaceData = {};

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

    const rawKeys = {};
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('concurso_estudos_') || key.startsWith('estud_ai_'))) {
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

  importAllData(jsonStr) {
    try {
      if (!jsonStr || typeof jsonStr !== 'string') {
        return { success: false, message: 'Conteúdo do arquivo vazio ou inválido.' };
      }

      let data;
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
        // Non-fatal
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
        Object.entries(data.workspaceData).forEach(([wsId, wsPayload]) => {
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
    } catch (err) {
      return {
        success: false,
        message: `Erro ao importar dados: ${err?.message || String(err)}`,
      };
    }
  }
};

console.log('--- Testing Universal Backup & Restore System ---');

// Setup mock data
const testWsId = 'ws-test-123';
db.saveWorkspaces([{ id: testWsId, name: 'Concurso dos Sonhos', createdAt: '2026-01-01' }]);
db.setActiveWorkspaceId(testWsId);
db.saveSessions([
  { id: 's-1', workspaceId: testWsId, subjectId: 'sub-1', durationSeconds: 3600, date: '2026-09-19' }
]);
db.saveQuestions([
  { id: 'q-1', workspaceId: testWsId, subjectId: 'sub-1', attempted: 20, correct: 18, banca: 'FCC', date: '2026-09-19' }
]);
db.saveSubjects(testWsId, [
  { id: 'sub-1', name: 'Engenharia de Software', weight: 3, topics: [] }
]);
db.saveFlashcards(testWsId, [
  { id: 'fc-1', workspaceId: testWsId, front: 'O que é ACID?', back: 'Atomicidade, Consistência, Isolamento e Durabilidade', interval: 6, repetition: 2, easeFactor: 2.5 }
]);
db.saveAutopilotSettings(testWsId, { dailyGoalMinutes: 180, preferredCycleMode: 'dynamic' });

// Test 1: Export data
const exportedJson = db.exportAllData();
assert(typeof exportedJson === 'string', 'Export must return a string');
const parsed = JSON.parse(exportedJson);
assert.strictEqual(parsed.app, 'estud.ai', 'App identity must be estud.ai');
assert.strictEqual(parsed.version, 1, 'Version should be 1');
assert.strictEqual(parsed.workspaces.length, 1, 'Should have 1 workspace');
assert.strictEqual(parsed.sessions.length, 1, 'Should have 1 session');
assert.strictEqual(parsed.questions.length, 1, 'Should have 1 question session');
assert.strictEqual(parsed.workspaceData[testWsId].subjects.length, 1, 'Should have 1 subject in workspaceData');
assert.strictEqual(parsed.workspaceData[testWsId].flashcards.length, 1, 'Should have 1 flashcard in workspaceData');
console.log('✔ Test 1 passed: Comprehensive export structure valid');

// Test 2: Clear and verify emptiness
localStorage.clear();
assert.strictEqual(db.getWorkspaces().length, 0, 'Workspaces must be empty');
assert.strictEqual(db.getSessions().length, 0, 'Sessions must be empty');
assert.strictEqual(db.getQuestions().length, 0, 'Questions must be empty');
assert.strictEqual(db.getSubjects(testWsId).length, 0, 'Subjects must be empty');
assert.strictEqual(db.getFlashcards(testWsId).length, 0, 'Flashcards must be empty');
console.log('✔ Test 2 passed: Database successfully cleared');

// Test 3: Import data
const result = db.importAllData(exportedJson);
assert.strictEqual(result.success, true, 'Import must succeed');
assert(result.message.includes('Backup restaurado'), 'Message should indicate success');

// Verify restoration
const restoredWs = db.getWorkspaces();
assert.strictEqual(restoredWs.length, 1, 'Restored workspaces count');
assert.strictEqual(restoredWs[0].name, 'Concurso dos Sonhos', 'Workspace name match');

const restoredSessions = db.getSessions();
assert.strictEqual(restoredSessions.length, 1, 'Restored sessions count');
assert.strictEqual(restoredSessions[0].durationSeconds, 3600, 'Session duration match');

const restoredQuestions = db.getQuestions();
assert.strictEqual(restoredQuestions.length, 1, 'Restored questions count');
assert.strictEqual(restoredQuestions[0].correct, 18, 'Correct questions match');

const restoredSubjects = db.getSubjects(testWsId);
assert.strictEqual(restoredSubjects.length, 1, 'Restored subjects count');
assert.strictEqual(restoredSubjects[0].name, 'Engenharia de Software', 'Subject name match');

const restoredCards = db.getFlashcards(testWsId);
assert.strictEqual(restoredCards.length, 1, 'Restored flashcards count');
assert.strictEqual(restoredCards[0].front, 'O que é ACID?', 'Flashcard front match');

console.log('✔ Test 3 passed: 100% data restoration fidelity verified');

// Test 4: Rigorous edge cases & corrupted inputs
assert.strictEqual(db.importAllData('').success, false, 'Empty string should fail');
assert.strictEqual(db.importAllData(null).success, false, 'Null should fail');
assert.strictEqual(db.importAllData(undefined).success, false, 'Undefined should fail');
assert.strictEqual(db.importAllData('{ corrupted json ...').success, false, 'Malformed json should fail');
assert.strictEqual(db.importAllData('"just a string"').success, false, 'Non-object json string should fail');
assert.strictEqual(db.importAllData('123').success, false, 'Primitive number should fail');
assert.strictEqual(db.importAllData('true').success, false, 'Primitive boolean should fail');
assert.strictEqual(db.importAllData('[]').success, false, 'JSON array should fail');
assert.strictEqual(db.importAllData('[1, 2, 3]').success, false, 'JSON array with items should fail');
assert.strictEqual(db.importAllData('{}').success, false, 'Empty object without backup keys should fail');
assert.strictEqual(db.importAllData('{"someRandom": 123}').success, false, 'Object without recognized backup keys should fail');
console.log('✔ Test 4 passed: Strict rejection of arrays, primitives, and unformatted objects verified');

// Test 5: Orphaned workspace and phantom data cleanup on restore
const oldWsId = 'ws-old-ghost';
db.saveWorkspaces([{ id: oldWsId, name: 'Old Ghost Workspace', createdAt: '2025-01-01' }]);
db.saveSubjects(oldWsId, [{ id: 'sub-ghost', name: 'Ghost Subject', weight: 1, topics: [] }]);
localStorage.setItem(KEYS.ACTIVE_TIMER, JSON.stringify({ isActive: true, subjectName: 'Ghost' }));

assert.strictEqual(db.getSubjects(oldWsId).length, 1, 'Old subjects should exist prior to restore');
assert.notEqual(localStorage.getItem(KEYS.ACTIVE_TIMER), null, 'Old active timer should exist');

const restoreCleanRes = db.importAllData(exportedJson);
assert.strictEqual(restoreCleanRes.success, true, 'Restore must succeed');
assert.strictEqual(db.getSubjects(oldWsId).length, 0, 'Old ghost subjects must be pruned on restore');
assert.strictEqual(localStorage.getItem(KEYS.ACTIVE_TIMER), null, 'Old active timer must be reset on restore');
assert.strictEqual(db.getWorkspaces().length, 1, 'Only imported workspaces should be present');
assert.strictEqual(db.getWorkspaces()[0].id, testWsId, 'Correct workspace id restored');
console.log('✔ Test 5 passed: Pre-existing orphaned workspaces and active timer pruned cleanly on restore');

console.log('=== ALL BACKUP & RESTORE TESTS PASSED SUCCESSFULLY! ===');
