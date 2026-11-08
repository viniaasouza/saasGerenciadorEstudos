import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('  EMPIRICAL RE-VERIFICATION HARNESS (Milestone 4 Challenger)');
console.log('================================================================\n');

// ----------------------------------------------------------------------
// 1. Mock LocalStorage and DOM Environment
// ----------------------------------------------------------------------
class MockLocalStorage {
  constructor() {
    this._store = new Map();
  }
  getItem(key) {
    return this._store.has(key) ? this._store.get(key) : null;
  }
  setItem(key, value) {
    this._store.set(String(key), String(value));
  }
  removeItem(key) {
    this._store.delete(key);
  }
  clear() {
    this._store.clear();
  }
  key(index) {
    const keys = Array.from(this._store.keys());
    return keys[index] || null;
  }
  get length() {
    return this._store.size;
  }
}

globalThis.localStorage = new MockLocalStorage();
globalThis.window = globalThis;

// ----------------------------------------------------------------------
// 2. Load and Transpile Actual Source Modules
// ----------------------------------------------------------------------
function transpileTs(filePath) {
  const code = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
  return ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

// Transpile dependencies
const secTrans = transpileTs('src/lib/security.ts');
const secUri = 'data:text/javascript;base64,' + Buffer.from(secTrans).toString('base64');

// Transpile aiSyllabusService
let aiTrans = transpileTs('src/services/aiSyllabusService.ts');
aiTrans = aiTrans.replace(/['"]\.\.\/lib\/security['"]/g, JSON.stringify(secUri));
const aiUri = 'data:text/javascript;base64,' + Buffer.from(aiTrans).toString('base64');
const { parseSyllabusFallback, parseSyllabusWithOpenLLM } = await import(aiUri);

// Transpile database.ts dependencies
const presetTrans = transpileTs('src/data/tceGoPreset.ts');
const presetUri = 'data:text/javascript;base64,' + Buffer.from(presetTrans).toString('base64');

const cycleGenTrans = transpileTs('src/modules/cycle/cycleGenerator.ts');
const cycleGenUri = 'data:text/javascript;base64,' + Buffer.from(cycleGenTrans).toString('base64');

const gamifTrans = transpileTs('src/modules/autopilot/gamification.ts');
const gamifUri = 'data:text/javascript;base64,' + Buffer.from(gamifTrans).toString('base64');

const engineTrans = transpileTs('src/modules/autopilot/autopilotEngine.ts');
const engineUri = 'data:text/javascript;base64,' + Buffer.from(engineTrans).toString('base64');

let dbTrans = transpileTs('src/db/database.ts');
dbTrans = dbTrans
  .replace(/['"]\.\.\/data\/tceGoPreset['"]/g, JSON.stringify(presetUri))
  .replace(/['"]\.\.\/modules\/cycle\/cycleGenerator['"]/g, JSON.stringify(cycleGenUri))
  .replace(/['"]\.\.\/modules\/autopilot\/gamification['"]/g, JSON.stringify(gamifUri))
  .replace(/['"]\.\.\/modules\/autopilot\/autopilotEngine['"]/g, JSON.stringify(engineUri));

const dbUri = 'data:text/javascript;base64,' + Buffer.from(dbTrans).toString('base64');
const { db } = await import(dbUri);

// ======================================================================
// TEST SUITE 1: VULN-1 Safe JSON Parsing in getWorkspaces, getSessions, getQuestions
// ======================================================================
console.log('--- TEST SUITE 1: SAFE JSON PARSE IN DATABASE.TS ---');

// Corrupted JSON inputs to test
const corruptedPayloads = [
  '{ "broken": json',
  '[1, 2, unclosed',
  'undefined',
  '<html>Not JSON</html>',
  '{"unclosed_string": "',
];

for (const badJson of corruptedPayloads) {
  // Test getWorkspaces
  localStorage.setItem('concurso_estudos_workspaces', badJson);
  assert.doesNotThrow(() => {
    const ws = db.getWorkspaces();
    assert.deepEqual(ws, [], 'Corrupted workspaces JSON must return []');
  }, `getWorkspaces threw on: ${badJson}`);

  // Test getSessions
  localStorage.setItem('concurso_estudos_sessions', badJson);
  assert.doesNotThrow(() => {
    const sess = db.getSessions();
    assert.deepEqual(sess, [], 'Corrupted sessions JSON must return []');
  }, `getSessions threw on: ${badJson}`);

  // Test getQuestions
  localStorage.setItem('concurso_estudos_questions', badJson);
  assert.doesNotThrow(() => {
    const q = db.getQuestions();
    assert.deepEqual(q, [], 'Corrupted questions JSON must return []');
  }, `getQuestions threw on: ${badJson}`);
}

console.log('  ✓ VULN-1 PASSED: getWorkspaces, getSessions, and getQuestions never throw SyntaxError on corrupted storage.');

// ======================================================================
// TEST SUITE 2: VULN-2 Guest Key Isolation for Supabase UUID Accounts
// ======================================================================
console.log('\n--- TEST SUITE 2: MULTI-USER ISOLATION (SUPABASE UUIDS) IN MIGRATE_GUEST_DATA ---');

localStorage.clear();

const userA_uuid = '11111111-aaaa-4111-8111-111111111111';
const userB_uuid = '22222222-bbbb-4222-8222-222222222222';

// 1. Seed User A's data (Supabase UUID account on shared machine)
const userA_ws = [{ id: 'ws-user-A', name: 'User A Private Concurso' }];
const userA_sessions = [{ id: 'sess-user-A-1', date: '2026-11-01T10:00:00Z', durationMinutes: 45 }];
const userA_questions = [{ id: 'q-user-A-1', date: '2026-11-01T10:00:00Z', attempted: 10, correct: 9 }];
const userA_subjects = [{ id: 'sub-A', name: 'User A Secret Subject', topics: [] }];

localStorage.setItem(`concurso_estudos_${userA_uuid}_workspaces`, JSON.stringify(userA_ws));
localStorage.setItem(`concurso_estudos_${userA_uuid}_sessions`, JSON.stringify(userA_sessions));
localStorage.setItem(`concurso_estudos_${userA_uuid}_questions`, JSON.stringify(userA_questions));
localStorage.setItem(`concurso_estudos_${userA_uuid}_subjects_ws-user-A`, JSON.stringify(userA_subjects));

// 2. Seed genuine Guest data (un-scoped keys created by logged-out user)
const guest_ws = [{ id: 'ws-guest', name: 'Guest Public Concurso' }];
const guest_sessions = [{ id: 'sess-guest-1', date: '2026-11-05T10:00:00Z', durationMinutes: 20 }];
const guest_questions = [{ id: 'q-guest-1', date: '2026-11-05T10:00:00Z', attempted: 5, correct: 5 }];
const guest_subjects = [{ id: 'sub-guest', name: 'Guest Public Subject', topics: [] }];

localStorage.setItem('concurso_estudos_workspaces', JSON.stringify(guest_ws));
localStorage.setItem('concurso_estudos_sessions', JSON.stringify(guest_sessions));
localStorage.setItem('concurso_estudos_questions', JSON.stringify(guest_questions));
localStorage.setItem('concurso_estudos_subjects_ws-guest', JSON.stringify(guest_subjects));

// 3. User B (Supabase UUID) has some existing data
const userB_ws = [{ id: 'ws-user-B', name: 'User B Existing Concurso' }];
localStorage.setItem(`concurso_estudos_${userB_uuid}_workspaces`, JSON.stringify(userB_ws));

// 4. Execute actual db.migrateGuestData for User B
db.migrateGuestData(null, userB_uuid);

// 5. Verification 2.1: User A's data was NOT migrated into User B
const userB_migratedWs = JSON.parse(localStorage.getItem(`concurso_estudos_${userB_uuid}_workspaces`));
const userB_migratedSessions = JSON.parse(localStorage.getItem(`concurso_estudos_${userB_uuid}_sessions`) || '[]');
const userB_migratedQuestions = JSON.parse(localStorage.getItem(`concurso_estudos_${userB_uuid}_questions`) || '[]');
const userB_leakSubject = localStorage.getItem(`concurso_estudos_${userB_uuid}_subjects_ws-user-A`);

assert.ok(
  !userB_migratedWs.some((w) => w.id === 'ws-user-A'),
  'CRITICAL: User A private workspace MUST NOT be migrated into User B!'
);
assert.ok(
  !userB_migratedSessions.some((s) => s.id === 'sess-user-A-1'),
  'CRITICAL: User A private sessions MUST NOT be migrated into User B!'
);
assert.ok(
  !userB_migratedQuestions.some((q) => q.id === 'q-user-A-1'),
  'CRITICAL: User A private questions MUST NOT be migrated into User B!'
);
assert.equal(userB_leakSubject, null, 'User A subjects must not be copied to User B!');

// 6. Verification 2.2: Genuine guest data WAS migrated into User B
assert.ok(
  userB_migratedWs.some((w) => w.id === 'ws-guest'),
  'Genuine guest workspace must be migrated into User B'
);
assert.ok(
  userB_migratedWs.some((w) => w.id === 'ws-user-B'),
  'User B existing workspace must be preserved'
);
assert.ok(
  userB_migratedSessions.some((s) => s.id === 'sess-guest-1'),
  'Genuine guest sessions must be migrated into User B'
);
assert.ok(
  userB_migratedQuestions.some((q) => q.id === 'q-guest-1'),
  'Genuine guest questions must be migrated into User B'
);
assert.ok(
  localStorage.getItem(`concurso_estudos_${userB_uuid}_subjects_ws-guest`) !== null,
  'Guest subjects must be migrated into User B scoped storage'
);

// 7. Verification 2.3: User A's storage remained completely untouched
assert.equal(
  localStorage.getItem(`concurso_estudos_${userA_uuid}_workspaces`),
  JSON.stringify(userA_ws),
  "User A's storage must remain intact"
);

console.log('  ✓ VULN-2 PASSED: Supabase UUID accounts are strictly isolated; zero cross-account data leak on shared browsers.');

// ======================================================================
// TEST SUITE 3: VULN-3 Sanitization of concursoInfo in aiSyllabusService.ts
// ======================================================================
console.log('\n--- TEST SUITE 3: CONCURSOINFO SANITIZATION IN AISYLLABUSSERVICE.TS ---');

// 3.1: Fallback JSON Mode
const maliciousJson = JSON.stringify({
  concursoInfo: {
    concurso: '<script>alert("hack-concurso")</script>',
    cargo: 'Auditor <img src=x onerror=alert("hack-cargo")>',
    banca: 'FGV & CESPE <iframe src=javascript:alert(1)>',
    dataProva: '2026-12-01 <svg onload=alert(1)>',
  },
  subjects: [{ name: 'Direito Constitucional', weight: 4 }],
});

const resJson = parseSyllabusFallback(maliciousJson);
assert.equal(
  resJson.concursoInfo.concurso,
  '&lt;script&gt;alert(&quot;hack-concurso&quot;)&lt;/script&gt;',
  'Script tag in concurso must be escaped'
);
assert.equal(
  resJson.concursoInfo.cargo,
  'Auditor &lt;img src=x onerror=alert(&quot;hack-cargo&quot;)&gt;',
  'Img tag in cargo must be escaped'
);
assert.equal(
  resJson.concursoInfo.banca,
  'FGV &amp; CESPE &lt;iframe src=javascript:alert(1)&gt;',
  'Ampersand and iframe in banca must be escaped'
);
assert.equal(
  resJson.concursoInfo.dataProva,
  '2026-12-01 &lt;svg onload=alert(1)&gt;',
  'Svg tag in dataProva must be escaped'
);
console.log('  ✓ VULN-3.1 PASSED: JSON fallback mode thoroughly sanitizes all concursoInfo fields.');

// 3.2: Fallback Outline Mode
const maliciousOutline = `
CONCURSO: <script>alert("hack")</script> TCE-GO
CARGO: Auditor <img src=x onerror=1>
BANCA: FGV & FCC
DATA DA PROVA: 2026-11-20 <svg onload=1>

1. Direito Administrativo
- Atos Administrativos
`;

const resOutline = parseSyllabusFallback(maliciousOutline);
assert.equal(
  resOutline.concursoInfo.concurso,
  '&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt; TCE-GO'
);
assert.equal(
  resOutline.concursoInfo.cargo,
  'Auditor &lt;img src=x onerror=1&gt;'
);
assert.equal(
  resOutline.concursoInfo.banca,
  'FGV &amp; FCC'
);
assert.equal(
  resOutline.concursoInfo.dataProva,
  '2026-11-20 &lt;svg onload=1&gt;'
);
console.log('  ✓ VULN-3.2 PASSED: Outline fallback mode thoroughly sanitizes all concursoInfo fields.');

// 3.3: LLM Mode Simulation with Mock Fetch
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              concursoInfo: {
                concurso: '<script>alert("LLM injection")</script>',
                cargo: 'Analista <img src=x>',
                banca: 'Cebraspe & Vunesp',
              },
              subjects: [
                {
                  name: 'Língua Portuguesa',
                  weight: 3,
                  topics: [{ name: 'Ortografia', subtopics: ['Acentuação'] }],
                },
              ],
            }),
          },
        },
      ],
    }),
  };
};

try {
  // Pass dummy key so it attempts the LLM request
  const resLlm = await parseSyllabusWithOpenLLM('dummy text', 'fake-key-123');
  assert.equal(resLlm.source, 'llm', 'Source must be llm');
  assert.equal(
    resLlm.concursoInfo.concurso,
    '&lt;script&gt;alert(&quot;LLM injection&quot;)&lt;/script&gt;',
    'LLM response concursoInfo.concurso must be escaped'
  );
  assert.equal(
    resLlm.concursoInfo.cargo,
    'Analista &lt;img src=x&gt;',
    'LLM response concursoInfo.cargo must be escaped'
  );
  assert.equal(
    resLlm.concursoInfo.banca,
    'Cebraspe &amp; Vunesp',
    'LLM response concursoInfo.banca must be escaped'
  );
  console.log('  ✓ VULN-3.3 PASSED: Open LLM parser strictly sanitizes concursoInfo before returning.');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('\n================================================================');
console.log('  ALL EMPIRICAL RE-VERIFICATION ASSERTIONS PASSED (100%)');
console.log('================================================================');
