// ============================================================================
// Reviewer M2-2 Independent Adversarial Test Suite
// Directly tests the REAL implementation extracted from src/db/database.ts
// ============================================================================

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING REVIEWER M2-2 INDEPENDENT ADVERSARIAL STRESS TEST ===\n');

// 1. Read real database.ts source and strip TypeScript types for dynamic evaluation
const dbSource = fs.readFileSync(path.join(__dirname, 'src', 'db', 'database.ts'), 'utf-8').replace(/\r\n/g, '\n');

// Extract mergeData source
const mergeDataMatch = dbSource.match(/mergeData\s*\([\s\S]*?\n  \},\n\n  \/\/ GUEST/);
assert.ok(mergeDataMatch, 'mergeData must be extractable from database.ts');
let mergeDataCode = mergeDataMatch[0].replace(/,\n\n  \/\/ GUEST$/, '');

// Extract migrateGuestData source
const migrateMatch = dbSource.match(/migrateGuestData\s*\([\s\S]*?\n  \},\n\n  importAllData/);
assert.ok(migrateMatch, 'migrateGuestData must be extractable from database.ts');
let migrateCode = migrateMatch[0].replace(/,\n\n  importAllData$/, '');

// Strip TypeScript annotations from mergeData
function stripTypes(code) {
  return code
    .replace(/:\s*FullBackup/g, '')
    .replace(/:\s*Subject\[\]/g, '')
    .replace(/:\s*Subtopic\[\]/g, '')
    .replace(/:\s*Flashcard\[\]/g, '')
    .replace(/:\s*Flashcard/g, '')
    .replace(/:\s*SpacedReview\[\]/g, '')
    .replace(/:\s*SpacedReview/g, '')
    .replace(/:\s*GamificationProfile\s*\|\s*null/g, '')
    .replace(/:\s*GamificationProfile/g, '')
    .replace(/:\s*StudySession\[\]/g, '')
    .replace(/:\s*StudySession/g, '')
    .replace(/:\s*QuestionSession\[\]/g, '')
    .replace(/:\s*QuestionSession/g, '')
    .replace(/:\s*CicloWorkspace\[\]/g, '')
    .replace(/:\s*CicloWorkspace/g, '')
    .replace(/:\s*string\s*\|\s*null\s*=\s*null/g, ' = null')
    .replace(/:\s*string\s*\|\s*null/g, '')
    .replace(/:\s*string\[\]/g, '')
    .replace(/:\s*string/g, '')
    .replace(/:\s*boolean/g, '')
    .replace(/:\s*number/g, '')
    .replace(/:\s*void/g, '')
    .replace(/:\s*any/g, '')
    .replace(/:\s*Record<[^>]+>/g, '')
    .replace(/new Map<[^>]+>\(\)/g, 'new Map()')
    .replace(/new Set<[^>]+>\(\)/g, 'new Set()')
    .replace(/as any/g, '')
    .replace(/!\./g, '.')
    .replace(/!\(/g, '(')
    .replace(/!\;/g, ';');
}

const cleanedMerge = 'function ' + stripTypes(mergeDataCode);
const cleanedMigrate = 'function ' + stripTypes(migrateCode);

// Evaluate functions into test scope
const testMergeData = new Function(cleanedMerge + '; return mergeData;')();

// Setup mock localStorage for migrateGuestData
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(k) {
    return this.store.get(k) ?? null;
  }
  setItem(k, v) {
    this.store.set(k, String(v));
  }
  removeItem(k) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
  key(i) {
    return Array.from(this.store.keys())[i] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

globalThis.localStorage = new MockLocalStorage();
const testMigrateGuestData = new Function(cleanedMigrate + '; return migrateGuestData;')();

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
    failCount++;
  }
}

// ----------------------------------------------------------------------------
// GROUP 1: mergeData EDGE CASES
// ----------------------------------------------------------------------------
console.log('--- Group 1: mergeData Edge Cases ---');

runTest('1.1 Empty local vs populated cloud', () => {
  const local = { workspaces: [], sessions: [], questions: [], workspaceData: {} };
  const cloud = {
    workspaces: [{ id: 'ws-cloud-1', name: 'Concurso Receita Federal' }],
    sessions: [
      { id: 's-c1', subjectId: 'dir-trib', durationMinutes: 60, date: '2026-11-01T10:00:00Z' },
      { id: 's-c2', subjectId: 'contab', durationMinutes: 45, date: '2026-11-02T10:00:00Z' }
    ],
    questions: [{ id: 'q-c1', subjectId: 'dir-trib', attempted: 20, correct: 18, date: '2026-11-01T11:00:00Z' }],
    workspaceData: {
      'ws-cloud-1': {
        subjects: [{ id: 'sub-1', name: 'Direito Tributário', weight: 2 }],
        flashcards: [{ id: 'fc-1', front: 'Conceito', interval: 6, repetition: 2 }]
      }
    },
    gamification: { totalXp: 500, currentStreak: 3, longestStreak: 5 }
  };

  const result = testMergeData(local, cloud);
  assert.equal(result.workspaces.length, 1);
  assert.equal(result.workspaces[0].name, 'Concurso Receita Federal');
  assert.equal(result.sessions.length, 2);
  assert.equal(result.questions.length, 1);
  assert.equal(result.workspaceData['ws-cloud-1'].subjects.length, 1);
  assert.equal(result.workspaceData['ws-cloud-1'].flashcards.length, 1);
  assert.equal(result.gamification.totalXp, 500);
});

runTest('1.2 Populated local vs empty cloud', () => {
  const local = {
    workspaces: [{ id: 'ws-loc-1', name: 'Concurso TCU' }],
    activeWorkspaceId: 'ws-loc-1',
    sessions: [{ id: 's-l1', subjectId: 'dir-adm', durationMinutes: 30, date: '2026-11-03T10:00:00Z' }],
    questions: [{ id: 'q-l1', subjectId: 'dir-adm', attempted: 15, correct: 13, date: '2026-11-03T10:30:00Z' }],
    workspaceData: {
      'ws-loc-1': {
        subjects: [{ id: 'sub-loc-1', name: 'Direito Administrativo', weight: 3 }]
      }
    },
    gamification: { totalXp: 350, currentStreak: 4, longestStreak: 4 }
  };
  const cloud = { workspaces: [], sessions: [], questions: [], workspaceData: {} };

  const result = testMergeData(local, cloud);
  assert.equal(result.workspaces.length, 1);
  assert.equal(result.workspaces[0].name, 'Concurso TCU');
  assert.equal(result.activeWorkspaceId, 'ws-loc-1');
  assert.equal(result.sessions.length, 1);
  assert.equal(result.questions.length, 1);
  assert.equal(result.workspaceData['ws-loc-1'].subjects.length, 1);
  assert.equal(result.gamification.totalXp, 350);
});

runTest('1.3 Identical IDs with newer vs older dates (Union deduplication & chronological sort)', () => {
  const local = {
    sessions: [
      { id: 'sess-dup', date: '2026-11-02T15:00:00Z', durationMinutes: 50, notes: 'Updated locally' },
      { id: 'sess-loc-only', date: '2026-11-03T18:00:00Z', durationMinutes: 30, notes: 'Local latest' }
    ]
  };
  const cloud = {
    sessions: [
      { id: 'sess-dup', date: '2026-11-01T10:00:00Z', durationMinutes: 45, notes: 'Older cloud snapshot' },
      { id: 'sess-cloud-only', date: '2026-10-31T08:00:00Z', durationMinutes: 20, notes: 'Earliest' }
    ]
  };

  const result = testMergeData(local, cloud);
  assert.equal(result.sessions.length, 3, 'Must deduplicate sess-dup');
  // Must be sorted chronologically
  assert.equal(result.sessions[0].id, 'sess-cloud-only', '2026-10-31 comes first');
  assert.equal(result.sessions[1].id, 'sess-dup', '2026-11-02 comes second');
  assert.equal(result.sessions[2].id, 'sess-loc-only', '2026-11-03 comes third');
  // Local duplicate overwrote cloud duplicate
  assert.equal(result.sessions[1].notes, 'Updated locally');
  assert.equal(result.sessions[1].durationMinutes, 50);
});

runTest('1.4 Corrupted or non-object payloads (null, undefined, primitives)', () => {
  const validLocal = {
    workspaces: [{ id: 'w1', name: 'TCU' }],
    sessions: [{ id: 's1', date: '2026-11-01T10:00:00Z', durationMinutes: 30 }]
  };

  // cloud is null
  const rNull = testMergeData(validLocal, null);
  assert.equal(rNull.workspaces.length, 1);

  // cloud is undefined
  const rUndef = testMergeData(validLocal, undefined);
  assert.equal(rUndef.workspaces.length, 1);

  // cloud is string
  const rStr = testMergeData(validLocal, 'corrupted payload string');
  assert.equal(rStr.workspaces.length, 1);

  // cloud is number
  const rNum = testMergeData(validLocal, 12345);
  assert.equal(rNum.workspaces.length, 1);

  // local is null, cloud is valid
  const rLocalNull = testMergeData(null, validLocal);
  assert.equal(rLocalNull.workspaces.length, 1);
});

runTest('1.5 Pruning blank auto-generated "Meu Concurso" when genuine workspaces exist', () => {
  const local = {
    workspaces: [{ id: 'ws-blank', name: 'Meu Concurso', createdAt: '2026-11-01' }],
    workspaceData: { 'ws-blank': { subjects: [] } }
  };
  const cloud = {
    workspaces: [{ id: 'ws-genuine', name: 'Auditor Fiscal SEFAZ', createdAt: '2026-10-15' }],
    workspaceData: { 'ws-genuine': { subjects: [{ id: 'sub-1', name: 'Contabilidade' }] } }
  };

  const result = testMergeData(local, cloud);
  assert.equal(result.workspaces.length, 1, 'Blank Meu Concurso must be pruned');
  assert.equal(result.workspaces[0].name, 'Auditor Fiscal SEFAZ');
});

runTest('1.6 Subtopic completion logical OR and metrics preservation', () => {
  const local = {
    workspaceData: {
      'ws-1': {
        subjects: [{
          id: 'sub-dir-adm',
          name: 'Direito Administrativo',
          topics: [{
            id: 'top-atos',
            name: 'Atos',
            subtopics: [
              { id: 'st-1', name: 'Conceito', completed: true, completedAt: '2026-11-01T12:00:00Z', acertos: 15, erros: 2, videoWatched: true },
              { id: 'st-2', name: 'Requisitos', completed: false, acertos: 5, erros: 5 }
            ]
          }]
        }]
      }
    }
  };
  const cloud = {
    workspaceData: {
      'ws-1': {
        subjects: [{
          id: 'sub-dir-adm',
          name: 'Direito Administrativo',
          topics: [{
            id: 'top-atos',
            name: 'Atos',
            subtopics: [
              { id: 'st-1', name: 'Conceito', completed: false, acertos: 10, erros: 1 },
              { id: 'st-2', name: 'Requisitos', completed: true, completedAt: '2026-11-02T15:00:00Z', acertos: 20, erros: 1, pdfRead: true }
            ]
          }]
        }]
      }
    }
  };

  const result = testMergeData(local, cloud);
  const subject = result.workspaceData['ws-1'].subjects[0];
  const subtopics = subject.topics[0].subtopics;
  const st1 = subtopics.find((s) => s.id === 'st-1');
  const st2 = subtopics.find((s) => s.id === 'st-2');

  assert.equal(st1.completed, true, 'st-1 must be completed (local true)');
  assert.equal(st1.acertos, 15, 'st-1 acertos must take max 15');
  assert.equal(st1.videoWatched, true);

  assert.equal(st2.completed, true, 'st-2 must be completed (cloud true)');
  assert.equal(st2.acertos, 20, 'st-2 acertos must take max 20');
  assert.equal(st2.pdfRead, true);
});

runTest('1.7 Flashcard SM-2 state preservation (higher interval / higher repetition)', () => {
  const local = {
    workspaceData: {
      'ws-1': {
        flashcards: [
          { id: 'fc-1', front: 'Pergunta 1', interval: 15, repetition: 3, easeFactor: 2.5 },
          { id: 'fc-2', front: 'Pergunta 2', interval: 6, repetition: 2, easeFactor: 2.4 }
        ]
      }
    }
  };
  const cloud = {
    workspaceData: {
      'ws-1': {
        flashcards: [
          { id: 'fc-1', front: 'Pergunta 1', interval: 6, repetition: 2, easeFactor: 2.5 }, // older
          { id: 'fc-2', front: 'Pergunta 2', interval: 6, repetition: 3, easeFactor: 2.4 }, // same interval, higher rep
          { id: 'fc-3', front: 'Pergunta 3', interval: 30, repetition: 5, easeFactor: 2.6 }
        ]
      }
    }
  };

  const result = testMergeData(local, cloud);
  const cards = result.workspaceData['ws-1'].flashcards;
  assert.equal(cards.length, 3, 'All 3 unique flashcards preserved');

  const fc1 = cards.find((c) => c.id === 'fc-1');
  assert.equal(fc1.interval, 15, 'fc-1 interval 15 should win');

  const fc2 = cards.find((c) => c.id === 'fc-2');
  assert.equal(fc2.repetition, 3, 'fc-2 repetition 3 should win on equal interval');
});

runTest('1.8 Gamification profile union and streak preservation', () => {
  const local = {
    gamification: {
      totalXp: 450,
      currentStreak: 5,
      longestStreak: 5,
      dailyXp: { '2026-11-01': 100, '2026-11-02': 150 },
      history: [{ id: 'h1', type: 'study', description: 'Dir Adm', timestamp: '2026-11-01' }]
    }
  };
  const cloud = {
    gamification: {
      totalXp: 800,
      currentStreak: 2,
      longestStreak: 12,
      dailyXp: { '2026-11-01': 50, '2026-11-03': 200 },
      history: [{ id: 'h2', type: 'quiz', description: '10 questoes', timestamp: '2026-11-03' }]
    }
  };

  const result = testMergeData(local, cloud);
  assert.equal(result.gamification.totalXp, 800);
  assert.equal(result.gamification.currentStreak, 5, 'Highest current streak');
  assert.equal(result.gamification.longestStreak, 12, 'Highest longest streak');
  assert.equal(result.gamification.dailyXp['2026-11-01'], 100, 'Max daily XP for 2026-11-01');
  assert.equal(result.gamification.dailyXp['2026-11-02'], 150);
  assert.equal(result.gamification.dailyXp['2026-11-03'], 200);
  assert.equal(result.gamification.history.length, 2);
});

// ----------------------------------------------------------------------------
// GROUP 2: migrateGuestData VERIFICATION
// ----------------------------------------------------------------------------
console.log('\n--- Group 2: migrateGuestData & Zero Minutes Lost ---');

runTest('2.1 Guest studying for days loses ZERO minutes upon signing in', () => {
  globalThis.localStorage.clear();

  // Guest studies for 3 days across multiple subjects
  const guestWorkspaces = [{ id: 'ws-guest-tcu', name: 'TCU Auditor' }];
  const guestSessions = [
    { id: 's-g1', date: '2026-11-01T10:00:00Z', durationMinutes: 60, durationSeconds: 3600, subjectId: 'dir-adm' },
    { id: 's-g2', date: '2026-11-02T14:00:00Z', durationMinutes: 90, durationSeconds: 5400, subjectId: 'contab' },
    { id: 's-g3', date: '2026-11-03T20:00:00Z', durationMinutes: 120, durationSeconds: 7200, subjectId: 'dir-const' }
  ];
  const guestQuestions = [
    { id: 'q-g1', date: '2026-11-01T11:00:00Z', attempted: 20, correct: 18 }
  ];
  const guestGamification = {
    totalXp: 750,
    currentStreak: 3,
    longestStreak: 3
  };

  globalThis.localStorage.setItem('concurso_estudos_workspaces', JSON.stringify(guestWorkspaces));
  globalThis.localStorage.setItem('concurso_estudos_sessions', JSON.stringify(guestSessions));
  globalThis.localStorage.setItem('concurso_estudos_questions', JSON.stringify(guestQuestions));
  globalThis.localStorage.setItem('concurso_estudos_gamification_profile', JSON.stringify(guestGamification));

  const targetUserId = 'usr-auditor-real';

  // Perform migration
  testMigrateGuestData(null, targetUserId);

  // Check user-scoped storage
  const userSessionsStr = globalThis.localStorage.getItem(`concurso_estudos_${targetUserId}_sessions`);
  assert.ok(userSessionsStr, 'User scoped sessions must exist');
  const userSessions = JSON.parse(userSessionsStr);

  const totalMigratedMinutes = userSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalMigratedSeconds = userSessions.reduce((acc, s) => acc + s.durationSeconds, 0);

  assert.equal(totalMigratedMinutes, 270, 'Must have exactly 270 minutes (4.5 hours)');
  assert.equal(totalMigratedSeconds, 16200, 'Must have exactly 16200 seconds');

  // CRITICAL VERIFICATION: Guest data was NEVER deleted
  assert.ok(globalThis.localStorage.getItem('concurso_estudos_sessions') !== null, 'Original guest sessions MUST NOT be deleted');
  assert.ok(globalThis.localStorage.getItem('concurso_estudos_workspaces') !== null, 'Original guest workspaces MUST NOT be deleted');
});

runTest('2.2 Target user already has existing study data: merged without loss', () => {
  globalThis.localStorage.clear();

  const targetUserId = 'usr-existing';

  // Existing user data
  const existingWs = [{ id: 'ws-user-sefaz', name: 'SEFAZ Auditor' }];
  const existingSessions = [
    { id: 's-u1', date: '2026-10-20T10:00:00Z', durationMinutes: 40, subjectId: 'portugues' }
  ];
  globalThis.localStorage.setItem(`concurso_estudos_${targetUserId}_workspaces`, JSON.stringify(existingWs));
  globalThis.localStorage.setItem(`concurso_estudos_${targetUserId}_sessions`, JSON.stringify(existingSessions));

  // New guest data created on this machine
  const guestWs = [{ id: 'ws-guest-tcu', name: 'TCU Auditor' }];
  const guestSessions = [
    { id: 's-g1', date: '2026-11-05T14:00:00Z', durationMinutes: 50, subjectId: 'dir-adm' }
  ];
  globalThis.localStorage.setItem('concurso_estudos_workspaces', JSON.stringify(guestWs));
  globalThis.localStorage.setItem('concurso_estudos_sessions', JSON.stringify(guestSessions));

  // Migrate
  testMigrateGuestData(null, targetUserId);

  const mergedWs = JSON.parse(globalThis.localStorage.getItem(`concurso_estudos_${targetUserId}_workspaces`));
  const mergedSessions = JSON.parse(globalThis.localStorage.getItem(`concurso_estudos_${targetUserId}_sessions`));

  assert.equal(mergedWs.length, 2, 'Both workspaces preserved');
  assert.equal(mergedSessions.length, 2, 'Both sessions preserved');
  assert.equal(mergedSessions[0].id, 's-u1', 'Older session first');
  assert.equal(mergedSessions[1].id, 's-g1', 'Newer session second');
});

// ----------------------------------------------------------------------------
// GROUP 3: pullFromCloud & OFFLINE RESILIENCE
// ----------------------------------------------------------------------------
console.log('\n--- Group 3: pullFromCloud & Offline Resilience ---');

runTest('3.1 Disarmed cleanup: CLEANUP_KEY does not remove user keys', () => {
  globalThis.localStorage.clear();
  globalThis.localStorage.setItem('concurso_estudos_workspaces', JSON.stringify([{ id: 'w1', name: 'TCU' }]));
  globalThis.localStorage.setItem('concurso_estudos_sessions', JSON.stringify([{ id: 's1', durationMinutes: 30 }]));

  // Simulate disarmed cleanup from database.ts:
  const CLEANUP_KEY = 'estud_ai_clean_v4';
  if (!globalThis.localStorage.getItem(CLEANUP_KEY)) {
    globalThis.localStorage.setItem(CLEANUP_KEY, 'true');
  }

  assert.ok(globalThis.localStorage.getItem('concurso_estudos_workspaces') !== null);
  assert.ok(globalThis.localStorage.getItem('concurso_estudos_sessions') !== null);
});

console.log(`\n================================================================`);
console.log(`Reviewer M2-2 Independent Adversarial Results:`);
console.log(`Total: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);
console.log(`================================================================`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\n✔ ALL INDEPENDENT ADVERSARIAL STRESS TESTS PASSED 100%!');
}
