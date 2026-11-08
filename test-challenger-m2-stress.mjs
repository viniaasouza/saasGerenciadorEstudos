// ============================================================================
// EMPIRICAL CHALLENGER M2-2: ADVERSARIAL STRESS TEST HARNESS
// ============================================================================
// Tests:
// 1. Hostile / corrupt / truncated / null payload stress on importAllData
// 2. 50-update rapid burst debouncing & cloud push verification on db.subscribe
// 3. Guest <-> Authenticated login / logout lifecycle with multi-account isolation
// 4. Supabase UUID multi-user cross-contamination stress
// ============================================================================

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory mock localStorage with full storage interface
class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(k) {
    return this.store.get(String(k)) ?? null;
  }
  setItem(k, v) {
    this.store.set(String(k), String(v));
  }
  removeItem(k) {
    this.store.delete(String(k));
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
  dump() {
    const obj = {};
    for (const [k, v] of this.store.entries()) {
      obj[k] = v;
    }
    return obj;
  }
  restore(dumpObj) {
    this.store.clear();
    for (const [k, v] of Object.entries(dumpObj)) {
      this.store.set(k, v);
    }
  }
}

// Setup runtime globals for database module
const mockStorage = new MockStorage();
globalThis.localStorage = mockStorage;
globalThis.window = globalThis;
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    writable: true,
    configurable: true,
  });
} catch {}

// Ensure bundled database.js exists (auto-compile on demand)
const dbModulePath = path.join(__dirname, '.test_dist', 'database.js');
if (!fs.existsSync(dbModulePath)) {
  execSync('npx rolldown src/db/database.ts --dir .test_dist --format esm', { stdio: 'pipe' });
}
assert.ok(fs.existsSync(dbModulePath), 'Bundled database.js must exist in .test_dist');

const { db } = await import(`file://${dbModulePath.replace(/\\/g, '/')}`);

console.log('================================================================');
console.log('  CHALLENGER M2-2: EMPIRICAL ADVERSARIAL STRESS TEST SUITE      ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ Passed [${totalTests}]: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAILED [${totalTests}]: ${name}`);
    console.error(err);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ Passed [${totalTests}]: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAILED [${totalTests}]: ${name}`);
    console.error(err);
    throw err;
  }
}

// ============================================================================
// SUITE 1: ADVERSARIAL STRESS TESTING ON importAllData
// ============================================================================
console.log('--- SUITE 1: HOSTILE / CORRUPT PAYLOAD STRESS ON importAllData ---');

// Helper to seed database with authentic rich student data
function seedAuthenticStudentData() {
  db.setCurrentUserId(null);
  mockStorage.clear();

  const ws = [
    { id: 'ws-rfb-01', name: 'Receita Federal - Auditor', createdAt: '2026-11-01T08:00:00Z' },
    { id: 'ws-tcu-02', name: 'TCU - Auditor Federal', createdAt: '2026-11-02T08:00:00Z' }
  ];
  db.saveWorkspaces(ws);
  db.setActiveWorkspaceId('ws-rfb-01');

  const subjects = [
    {
      id: 'sub-trib',
      name: 'Direito Tributário',
      weight: 3,
      targetHours: 30,
      topics: [
        {
          id: 'top-1',
          name: 'Impostos Federais',
          subtopics: [
            { id: 'st-ir', name: 'Imposto de Renda', completed: true, acertos: 15, erros: 2, completedAt: '2026-11-05T12:00:00Z' },
            { id: 'st-ipi', name: 'IPI', completed: false, acertos: 5, erros: 3 }
          ]
        }
      ]
    }
  ];
  db.saveSubjects('ws-rfb-01', subjects);

  const sessions = [
    { id: 'sess-01', workspaceId: 'ws-rfb-01', subjectId: 'sub-trib', subjectName: 'Direito Tributário', durationMinutes: 45, durationSeconds: 2700, date: '2026-11-05T10:00:00Z' },
    { id: 'sess-02', workspaceId: 'ws-rfb-01', subjectId: 'sub-trib', subjectName: 'Direito Tributário', durationMinutes: 30, durationSeconds: 1800, date: '2026-11-06T11:00:00Z' }
  ];
  db.saveSessions(sessions);

  const questions = [
    { id: 'q-01', workspaceId: 'ws-rfb-01', subjectId: 'sub-trib', attempted: 20, correct: 18, date: '2026-11-05T11:00:00Z' }
  ];
  db.saveQuestions(questions);

  const flashcards = [
    { id: 'fc-01', front: 'Fato gerador do IR?', back: 'Aquisição da disponibilidade econômica ou jurídica', interval: 15, repetition: 3 }
  ];
  db.saveFlashcards('ws-rfb-01', flashcards);

  db.saveGamificationProfile({
    totalXp: 850,
    currentStreak: 5,
    longestStreak: 5,
    lastActiveDate: '2026-11-06',
    dailyXp: { '2026-11-05': 450, '2026-11-06': 400 },
    history: []
  });
}

function verifyStudentDataIntact(baselineBackupJson) {
  const currentBackupJson = db.exportAllData();
  const current = JSON.parse(currentBackupJson);
  const baseline = JSON.parse(baselineBackupJson);

  assert.equal(current.workspaces.length, baseline.workspaces.length, 'Workspaces count must remain intact');
  assert.equal(current.workspaces[0].name, 'Receita Federal - Auditor');
  assert.equal(current.sessions.length, baseline.sessions.length, 'Sessions count must remain intact');
  assert.equal(current.sessions[0].id, 'sess-01');
  assert.equal(current.sessions[1].id, 'sess-02');
  assert.equal(current.questions.length, baseline.questions.length, 'Questions count must remain intact');
  assert.equal(current.workspaceData['ws-rfb-01'].subjects.length, 1);
  assert.equal(current.workspaceData['ws-rfb-01'].subjects[0].topics[0].subtopics[0].completed, true);
  assert.equal(current.workspaceData['ws-rfb-01'].flashcards[0].interval, 15);
  assert.equal(current.gamification.totalXp, 850);
}

runTest('importAllData preserves 100% data on null, undefined, empty, or whitespace inputs', () => {
  seedAuthenticStudentData();
  const baselineBackup = db.exportAllData();

  const hostileInputs = [null, undefined, '', '   ', '\n\t\r'];
  for (const input of hostileInputs) {
    const res = db.importAllData(input);
    assert.equal(res.success, false, `Should reject input: ${input}`);
    verifyStudentDataIntact(baselineBackup);
  }
});

runTest('importAllData preserves 100% data on non-string primitives and malformed JSON text', () => {
  seedAuthenticStudentData();
  const baselineBackup = db.exportAllData();

  const hostileInputs = [
    12345,
    true,
    false,
    { raw: 'object' }, // not string
    'not a json string',
    '{ truncated json...',
    '{"app": "ixtude.ai", "workspaces": [',
    '{"workspaces": [{"id": "ws-1", "name": "Broken"}',
    '<xml><not-json></not-json></xml>'
  ];

  for (const input of hostileInputs) {
    const res = db.importAllData(input);
    assert.equal(res.success, false, `Should reject input: ${input}`);
    verifyStudentDataIntact(baselineBackup);
  }
});

runTest('importAllData preserves 100% data on JSON arrays or primitive JSON values', () => {
  seedAuthenticStudentData();
  const baselineBackup = db.exportAllData();

  const hostileInputs = [
    '[]',
    '[1, 2, 3]',
    '["hello", "world"]',
    '[{"id": "array-item"}]',
    '123.45',
    '"plain string in json"',
    'null',
    'true'
  ];

  for (const input of hostileInputs) {
    const res = db.importAllData(input);
    assert.equal(res.success, false, `Should reject input: ${input}`);
    verifyStudentDataIntact(baselineBackup);
  }
});

runTest('importAllData preserves 100% data on empty or unrecognized JSON objects', () => {
  seedAuthenticStudentData();
  const baselineBackup = db.exportAllData();

  const hostileInputs = [
    '{}',
    '{"version": 2}',
    '{"unrelated": true, "randomField": 9999}',
    '{"workspaces": null}',
    '{"workspaces": []}',
    '{"workspaces": "not-an-array"}',
    '{"workspaceData": null}'
  ];

  for (const input of hostileInputs) {
    const res = db.importAllData(input);
    assert.equal(res.success, false, `Should reject input: ${input}`);
    verifyStudentDataIntact(baselineBackup);
  }
});

runTest('importAllData with 100KB truncated payload gracefully rejects without data corruption', () => {
  seedAuthenticStudentData();
  const baselineBackup = db.exportAllData();

  // Create a giant valid JSON payload, then truncate it midway
  const giant = {
    workspaces: [{ id: 'ws-giant', name: 'Giant Test' }],
    sessions: Array.from({ length: 500 }, (_, i) => ({
      id: `giant-sess-${i}`,
      durationMinutes: 60,
      date: new Date().toISOString()
    }))
  };
  const fullJson = JSON.stringify(giant);
  const truncatedHalfway = fullJson.substring(0, Math.floor(fullJson.length / 2));

  const res = db.importAllData(truncatedHalfway);
  assert.equal(res.success, false, 'Truncated giant payload must be rejected');
  verifyStudentDataIntact(baselineBackup);
});

runTest('importAllData with merge=true safely merges valid external payload into existing state', () => {
  seedAuthenticStudentData();

  // New incoming payload with a 2nd workspace and 1 new session
  const incoming = {
    app: 'ixtude.ai',
    version: 2,
    workspaces: [{ id: 'ws-incoming', name: 'Novo Concurso Polícia Civil' }],
    sessions: [
      { id: 'sess-new-03', subjectId: 'sub-penal', subjectName: 'Direito Penal', durationMinutes: 60, durationSeconds: 3600, date: '2026-11-07T10:00:00Z' }
    ],
    workspaceData: {
      'ws-incoming': {
        subjects: [{ id: 'sub-penal', name: 'Direito Penal', weight: 2, topics: [] }]
      }
    }
  };

  const res = db.importAllData(JSON.stringify(incoming), { merge: true });
  assert.equal(res.success, true, 'Valid merge import must succeed');

  const after = JSON.parse(db.exportAllData());
  // Pre-existing workspaces + incoming workspace
  assert.equal(after.workspaces.length, 3, 'Both original workspaces + new workspace must be retained');
  // Pre-existing sessions (2) + incoming session (1)
  assert.equal(after.sessions.length, 3, 'Both original sessions + new session must be retained');
  assert.ok(after.sessions.some(s => s.id === 'sess-01'));
  assert.ok(after.sessions.some(s => s.id === 'sess-new-03'));
});


// ============================================================================
// SUITE 2: DEBOUNCED AUTO-SYNC & BURST MUTATION HARNESS
// ============================================================================
console.log('\n--- SUITE 2: RAPID BURST DEBOUNCE VERIFICATION (db.subscribe) ---');

await runAsyncTest('Rapid burst of 50 saves triggers db.subscribe 50 times and debounces to 1 single push', async () => {
  seedAuthenticStudentData();

  let subscribeTriggerCount = 0;
  const pushCalls = [];

  // Emulate the debounced cloud sync engine from AuthContext.tsx
  let timer = null;
  const DEBOUNCE_MS = 1500;

  const handleMutation = () => {
    subscribeTriggerCount++;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const payload = JSON.parse(db.exportAllData());
      pushCalls.push({
        timestamp: Date.now(),
        sessionCount: payload.sessions.length,
        questionCount: payload.questions.length,
        payload
      });
    }, DEBOUNCE_MS);
  };

  const unsubscribe = db.subscribe(handleMutation);

  // Execute 50 rapid mutations within a tight loop (simulating rapid study, question logging, timer stops)
  for (let i = 1; i <= 50; i++) {
    const currentSessions = db.getSessions();
    currentSessions.push({
      id: `burst-sess-${i}`,
      subjectId: 'sub-trib',
      subjectName: 'Direito Tributário',
      durationMinutes: i,
      durationSeconds: i * 60,
      date: new Date(Date.now() + i * 1000).toISOString()
    });
    db.saveSessions(currentSessions);
  }

  // Verify subscribe was notified for all 50 mutations immediately
  assert.equal(subscribeTriggerCount, 50, 'All 50 mutations must notify change listeners');

  // At 500ms into the debounce window, NO push should have executed yet
  await new Promise(r => setTimeout(r, 500));
  assert.equal(pushCalls.length, 0, 'No cloud push should occur prior to debounce window expiration');

  // Wait for the remainder of the debounce window (1500ms + 200ms margin)
  await new Promise(r => setTimeout(r, 1200));

  // Verify EXACTLY 1 push was dispatched!
  assert.equal(pushCalls.length, 1, 'Exactly 1 cloud push must be executed for 50 rapid bursts');

  // Verify the single push contained ALL 50 newly added sessions (2 original + 50 burst = 52 total)
  assert.equal(pushCalls[0].sessionCount, 52, 'The single cloud push must contain cumulative state of all 50 mutations');

  unsubscribe();
});

await runAsyncTest('Continuous streaming updates every 200ms keep delaying the push until quiet period', async () => {
  seedAuthenticStudentData();

  let pushCalls = 0;
  let timer = null;
  const DEBOUNCE_MS = 1000; // 1s for test speed

  const unsubscribe = db.subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      pushCalls++;
    }, DEBOUNCE_MS);
  });

  // Stream 6 updates spaced by 200ms (total span: 1200ms, each spacing < 1000ms debounce)
  for (let i = 0; i < 6; i++) {
    const questions = db.getQuestions();
    questions.push({
      id: `stream-q-${i}`,
      subjectId: 'sub-trib',
      attempted: 1,
      correct: 1,
      date: new Date().toISOString()
    });
    db.saveQuestions(questions);
    await new Promise(r => setTimeout(r, 200));
  }

  // During the active stream, no push should have completed
  assert.equal(pushCalls, 0, 'No push should trigger while mutations continue arriving faster than debounce window');

  // Wait for quiet window (1000ms + 200ms margin)
  await new Promise(r => setTimeout(r, 1200));

  assert.equal(pushCalls, 1, 'Exactly 1 push triggered after stream quiet period');

  unsubscribe();
});


// ============================================================================
// SUITE 3: GUEST <-> AUTHENTICATED LOGIN / LOGOUT DATA PRESERVATION
// ============================================================================
console.log('\n--- SUITE 3: GUEST LOGIN / LOGOUT MULTI-ACCOUNT ISOLATION ---');

runTest('Guest user data is non-destructively migrated to account on login and preserved on logout', () => {
  mockStorage.clear();
  db.setCurrentUserId(null);

  // 1. Guest studies and creates rich data
  const guestWs = [{ id: 'ws-guest', name: 'Concurso Guest Inicial' }];
  db.saveWorkspaces(guestWs);
  db.setActiveWorkspaceId('ws-guest');

  const guestSessions = [
    { id: 'sess-g1', subjectId: 's1', subjectName: 'Direito Constitucional', durationMinutes: 30, durationSeconds: 1800, date: '2026-11-01T10:00:00Z' }
  ];
  db.saveSessions(guestSessions);

  const guestGam = { totalXp: 300, currentStreak: 2, longestStreak: 2, dailyXp: {}, history: [] };
  db.saveGamificationProfile(guestGam);

  // Verify guest storage keys exist
  assert.notEqual(mockStorage.getItem('concurso_estudos_workspaces'), null);
  assert.notEqual(mockStorage.getItem('concurso_estudos_sessions'), null);

  // 2. User logs in (AuthContext: migrateGuestData -> setCurrentUserId)
  const userId = 'usr-student-alpha';
  db.migrateGuestData(null, userId);
  db.setCurrentUserId(userId);

  // Verify User Alpha has the guest data
  const userAlphaWs = db.getWorkspaces();
  const userAlphaSessions = db.getSessions();
  const userAlphaGam = db.getGamificationProfile();

  assert.equal(userAlphaWs.length, 1);
  assert.equal(userAlphaWs[0].name, 'Concurso Guest Inicial');
  assert.equal(userAlphaSessions.length, 1);
  assert.equal(userAlphaSessions[0].id, 'sess-g1');
  assert.equal(userAlphaGam.totalXp, 300);

  // CRITICAL: Verify original guest storage keys were NOT deleted
  assert.notEqual(mockStorage.getItem('concurso_estudos_workspaces'), null, 'Guest workspaces must remain in unscoped storage');
  assert.notEqual(mockStorage.getItem('concurso_estudos_sessions'), null, 'Guest sessions must remain in unscoped storage');

  // 3. User Alpha records new sessions under their account
  userAlphaSessions.push({
    id: 'sess-alpha-private',
    subjectId: 's1',
    subjectName: 'Direito Constitucional',
    durationMinutes: 45,
    durationSeconds: 2700,
    date: '2026-11-02T10:00:00Z'
  });
  db.saveSessions(userAlphaSessions);
  assert.equal(db.getSessions().length, 2);

  // 4. User Alpha logs out (AuthContext: setCurrentUserId(null))
  db.setCurrentUserId(null);

  // Verify Guest environment has original 1 session (not Alpha's private 2nd session)
  const guestAfterLogoutSessions = db.getSessions();
  assert.equal(guestAfterLogoutSessions.length, 1, 'Guest should have their original 1 session');
  assert.equal(guestAfterLogoutSessions[0].id, 'sess-g1');

  // 5. User Alpha logs back in
  db.setCurrentUserId(userId);
  const userAlphaRestoredSessions = db.getSessions();
  assert.equal(userAlphaRestoredSessions.length, 2, 'User Alpha must have both sessions preserved');
  assert.ok(userAlphaRestoredSessions.some(s => s.id === 'sess-alpha-private'));
});

runTest('Multi-user account isolation strictly prevents Account B from leaking into Account A', () => {
  mockStorage.clear();

  const userA = 'usr-student-A';
  const userB = 'usr-student-B';

  // User A studies
  db.setCurrentUserId(userA);
  db.saveWorkspaces([{ id: 'ws-A', name: 'Carreiras Jurídicas A' }]);
  db.saveSessions([{ id: 'sess-A', subjectId: 'sA', subjectName: 'Processo Civil', durationMinutes: 60, durationSeconds: 3600, date: '2026-11-01T10:00:00Z' }]);

  // User A logs out
  db.setCurrentUserId(null);

  // User B logs in and studies
  db.setCurrentUserId(userB);
  db.saveWorkspaces([{ id: 'ws-B', name: 'Carreiras Policiais B' }]);
  db.saveSessions([{ id: 'sess-B', subjectId: 'sB', subjectName: 'Legislação Especial', durationMinutes: 90, durationSeconds: 5400, date: '2026-11-02T10:00:00Z' }]);

  // Verify User B only sees B
  assert.equal(db.getWorkspaces().length, 1);
  assert.equal(db.getWorkspaces()[0].name, 'Carreiras Policiais B');
  assert.equal(db.getSessions().length, 1);
  assert.equal(db.getSessions()[0].id, 'sess-B');

  // User B logs out, User A logs back in
  db.setCurrentUserId(userA);
  assert.equal(db.getWorkspaces().length, 1);
  assert.equal(db.getWorkspaces()[0].name, 'Carreiras Jurídicas A');
  assert.equal(db.getSessions().length, 1);
  assert.equal(db.getSessions()[0].id, 'sess-A');
});

runTest('Supabase UUID users: migrateGuestData does not corrupt another UUID user account', () => {
  mockStorage.clear();

  const user1Uuid = '11111111-2222-3333-4444-555555555555';
  const user2Uuid = '99999999-8888-7777-6666-555555555555';

  // Seed User 1 data
  db.setCurrentUserId(user1Uuid);
  db.saveWorkspaces([{ id: 'ws-uuid-1', name: 'User 1 Workspace' }]);
  db.saveSessions([{ id: 'sess-uuid-1', subjectId: 's1', subjectName: 'User 1 Subject', durationMinutes: 30, durationSeconds: 1800, date: '2026-11-01T10:00:00Z' }]);

  // User 1 logs out
  db.setCurrentUserId(null);

  // Seed genuine guest data
  mockStorage.setItem('concurso_estudos_workspaces', JSON.stringify([{ id: 'ws-guest', name: 'Guest WS' }]));
  mockStorage.setItem('concurso_estudos_sessions', JSON.stringify([{ id: 'sess-guest', subjectId: 'sg', subjectName: 'Guest Subject', durationMinutes: 20, durationSeconds: 1200, date: '2026-11-02T10:00:00Z' }]));

  // User 2 logs in
  db.migrateGuestData(null, user2Uuid);
  db.setCurrentUserId(user2Uuid);

  // User 2 should have guest data
  const u2Ws = db.getWorkspaces();
  assert.ok(u2Ws.some(w => w.name === 'Guest WS'));

  // Switch back to User 1
  db.setCurrentUserId(user1Uuid);
  const u1Ws = db.getWorkspaces();
  const u1Sessions = db.getSessions();

  assert.equal(u1Ws.length, 1);
  assert.equal(u1Ws[0].name, 'User 1 Workspace');
  assert.equal(u1Sessions.length, 1);
  assert.equal(u1Sessions[0].id, 'sess-uuid-1');
});


// ============================================================================
// SUITE 4: THREE-WAY MERGE NON-DESTRUCTIVE PROPERTY PROOFS
// ============================================================================
console.log('\n--- SUITE 4: THREE-WAY MERGE NON-DESTRUCTIVE MATHEMATICAL PROOFS ---');

runTest('Merge idempotency: mergeData(A, A) === A', () => {
  const datasetA = {
    app: 'ixtude.ai',
    version: 2,
    workspaces: [{ id: 'ws-1', name: 'Test' }],
    sessions: [
      { id: 's-1', date: '2026-11-01T10:00:00Z', durationMinutes: 30 },
      { id: 's-2', date: '2026-11-02T10:00:00Z', durationMinutes: 45 }
    ],
    questions: [{ id: 'q-1', date: '2026-11-01T11:00:00Z', attempted: 10, correct: 9 }],
    workspaceData: {
      'ws-1': {
        subjects: [{ id: 'sub-1', name: 'Português', topics: [] }],
        flashcards: [{ id: 'fc-1', interval: 10, repetition: 2 }]
      }
    },
    gamification: { totalXp: 500, currentStreak: 3, longestStreak: 3 }
  };

  const merged = db.mergeData(datasetA, datasetA);
  assert.equal(merged.workspaces.length, 1);
  assert.equal(merged.sessions.length, 2);
  assert.equal(merged.questions.length, 1);
  assert.equal(merged.workspaceData['ws-1'].subjects.length, 1);
  assert.equal(merged.workspaceData['ws-1'].flashcards.length, 1);
  assert.equal(merged.gamification.totalXp, 500);
});

runTest('Merge commutativity for disjoint sets: mergeData(A, B) yields same union as mergeData(B, A)', () => {
  const datasetA = {
    workspaces: [{ id: 'ws-A', name: 'A' }],
    sessions: [{ id: 's-A', date: '2026-11-01T10:00:00Z', durationMinutes: 30 }],
    questions: [{ id: 'q-A', date: '2026-11-01T11:00:00Z', attempted: 10, correct: 8 }],
    workspaceData: { 'ws-A': { flashcards: [{ id: 'fc-A', interval: 6, repetition: 1 }] } }
  };
  const datasetB = {
    workspaces: [{ id: 'ws-B', name: 'B' }],
    sessions: [{ id: 's-B', date: '2026-11-02T10:00:00Z', durationMinutes: 40 }],
    questions: [{ id: 'q-B', date: '2026-11-02T11:00:00Z', attempted: 15, correct: 14 }],
    workspaceData: { 'ws-B': { flashcards: [{ id: 'fc-B', interval: 15, repetition: 2 }] } }
  };

  const ab = db.mergeData(datasetA, datasetB);
  const ba = db.mergeData(datasetB, datasetA);

  assert.equal(ab.workspaces.length, 2);
  assert.equal(ba.workspaces.length, 2);
  assert.equal(ab.sessions.length, 2);
  assert.equal(ba.sessions.length, 2);
  assert.equal(ab.questions.length, 2);
  assert.equal(ba.questions.length, 2);
});

runTest('Merge subtopics logical OR: completion is monotonic (never un-completes a studied topic)', () => {
  const local = {
    workspaces: [{ id: 'ws-1', name: 'WS' }],
    workspaceData: {
      'ws-1': {
        subjects: [{
          id: 'sub-dir',
          name: 'Direito',
          topics: [{
            id: 'top-1',
            name: 'Tópico 1',
            subtopics: [
              { id: 'st-1', name: 'Sub 1', completed: true, acertos: 10, erros: 2 },
              { id: 'st-2', name: 'Sub 2', completed: false, acertos: 0, erros: 0 }
            ]
          }]
        }]
      }
    }
  };

  const remote = {
    workspaces: [{ id: 'ws-1', name: 'WS' }],
    workspaceData: {
      'ws-1': {
        subjects: [{
          id: 'sub-dir',
          name: 'Direito',
          topics: [{
            id: 'top-1',
            name: 'Tópico 1',
            subtopics: [
              { id: 'st-1', name: 'Sub 1', completed: false, acertos: 5, erros: 5 }, // remote didn't finish st-1
              { id: 'st-2', name: 'Sub 2', completed: true, acertos: 8, erros: 1 }  // remote finished st-2
            ]
          }]
        }]
      }
    }
  };

  const merged = db.mergeData(local, remote);
  const mergedSubtopics = merged.workspaceData['ws-1'].subjects[0].topics[0].subtopics;

  const st1 = mergedSubtopics.find(s => s.id === 'st-1');
  const st2 = mergedSubtopics.find(s => s.id === 'st-2');

  assert.equal(st1.completed, true, 'Subtopic 1 must remain completed (logical OR)');
  assert.equal(st2.completed, true, 'Subtopic 2 must remain completed (logical OR)');
  assert.equal(st1.acertos, 10, 'Max acertos preserved');
  assert.equal(st2.acertos, 8, 'Max acertos preserved');
});

runTest('Merge flashcards chooses strictly superior SM-2 repetition progression', () => {
  const local = {
    workspaceData: {
      'ws-1': {
        flashcards: [{ id: 'fc-1', interval: 1, repetition: 1 }] // Card reviewed once on phone
      }
    }
  };
  const remote = {
    workspaceData: {
      'ws-1': {
        flashcards: [{ id: 'fc-1', interval: 6, repetition: 2 }] // Card reviewed twice on desktop
      }
    }
  };

  const merged = db.mergeData(local, remote);
  const card = merged.workspaceData['ws-1'].flashcards[0];

  assert.equal(card.interval, 6, 'Highest interval SM-2 interval must be retained');
  assert.equal(card.repetition, 2, 'Highest repetition count must be retained');
});

// ============================================================================
// SUITE 5: ADVERSARIAL EDGE CASE RESILIENCE (NULLS, ROGUE LISTENERS, CORRUPT ARRAYS)
// ============================================================================
console.log('\n--- SUITE 5: ADVERSARIAL EDGE CASES & RESILIENCE ---');

runTest('db.notifyChange survives rogue listener exceptions without breaking other listeners', () => {
  let goodListenerCalled = false;
  const badListener = () => {
    throw new Error('Explosive rogue listener exception');
  };
  const goodListener = () => {
    goodListenerCalled = true;
  };

  const unsubBad = db.subscribe(badListener);
  const unsubGood = db.subscribe(goodListener);

  assert.doesNotThrow(() => {
    db.notifyChange();
  }, 'notifyChange must never throw even if a listener throws');

  assert.equal(goodListenerCalled, true, 'Subsequent listeners must execute despite prior listener crash');

  unsubBad();
  unsubGood();
});

runTest('mergeData gracefully sanitizes arrays containing nulls, undefined, and missing IDs', () => {
  const localWithNulls = {
    workspaces: [null, { id: 'ws-1', name: 'Valid WS' }, undefined, { id: '' }],
    sessions: [null, { id: 'sess-1', date: '2026-11-01', durationMinutes: 30 }, undefined],
    questions: [null, { id: 'q-1', date: '2026-11-01', attempted: 10, correct: 10 }],
    workspaceData: {
      'ws-1': {
        subjects: [
          null,
          {
            id: 'sub-1',
            name: 'Direito',
            topics: [
              null,
              {
                id: 'top-1',
                name: 'Tópico 1',
                subtopics: [null, { id: 'st-1', name: 'Sub 1', completed: true }]
              }
            ]
          }
        ],
        flashcards: [null, { id: 'fc-1', interval: 5, repetition: 1 }]
      }
    }
  };

  const remoteWithNulls = {
    workspaces: [null, { id: 'ws-1', name: 'Valid WS' }],
    sessions: [{ id: 'sess-2', date: '2026-11-02', durationMinutes: 45 }],
    questions: [null],
    workspaceData: {
      'ws-1': {
        flashcards: [{ id: 'fc-1', interval: 10, repetition: 2 }]
      }
    }
  };

  const result = db.mergeData(localWithNulls, remoteWithNulls);

  assert.equal(result.workspaces.length, 1);
  assert.equal(result.workspaces[0].id, 'ws-1');
  assert.equal(result.sessions.length, 2);
  assert.equal(result.questions.length, 1);
  assert.equal(result.workspaceData['ws-1'].subjects.length, 1);
  assert.equal(result.workspaceData['ws-1'].flashcards.length, 1);
  assert.equal(result.workspaceData['ws-1'].flashcards[0].interval, 10);
});

runTest('QuotaExceededError simulation during backup import fails gracefully without dropping state', () => {
  seedAuthenticStudentData();

  // Temporarily force setItem to throw QuotaExceededError
  const originalSetItem = mockStorage.setItem.bind(mockStorage);
  mockStorage.setItem = (k, v) => {
    if (k.includes('sessions')) {
      const err = new Error('QuotaExceededError: DOM Exception 22');
      err.name = 'QuotaExceededError';
      throw err;
    }
    originalSetItem(k, v);
  };

  try {
    const validImport = JSON.stringify({
      workspaces: [{ id: 'ws-quota', name: 'Quota WS' }],
      sessions: [{ id: 'sess-quota', durationMinutes: 10, date: new Date().toISOString() }]
    });

    // importAllData should either fail or catch quota safely
    db.importAllData(validImport, { merge: true });
    // Restore setItem
    mockStorage.setItem = originalSetItem;

    // Verify existing pre-quota sessions are intact
    const after = db.getSessions();
    assert.ok(after.some(s => s.id === 'sess-01'), 'Original session 1 must still exist');
    assert.ok(after.some(s => s.id === 'sess-02'), 'Original session 2 must still exist');
  } finally {
    mockStorage.setItem = originalSetItem;
  }
});

console.log('\n================================================================');
console.log(`  EMPIRICAL CHALLENGER M2-2 VERDICT: ALL ${passedTests}/${totalTests} TESTS PASSED!`);
console.log('================================================================\n');
