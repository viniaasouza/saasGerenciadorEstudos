import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const projectRoot = path.resolve(process.cwd());
const tempCompiledDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ixtude-reverify-'));

console.log('====================================================================');
console.log('  IXTUDE.AI — INDEPENDENT RE-VERIFICATION HARNESS (CHALLENGER M4-1 V2)');
console.log('====================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
  }
}

// --------------------------------------------------------------------------
// 1. SETUP MOCK STORAGE IN GLOBAL ENVIRONMENT BEFORE IMPORTING MODULES
// --------------------------------------------------------------------------
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  get length() {
    return this.store.size;
  }
  key(index) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  getItem(key) {
    return this.store.get(key) ?? null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockStorage = new MockLocalStorage();
globalThis.localStorage = mockStorage;
globalThis.window = globalThis;

// --------------------------------------------------------------------------
// 2. TRANSPILATION HELPER FOR NATIVE NODE IMPORTING
// --------------------------------------------------------------------------
function transpileTsToMjs(srcRelPath) {
  const fullSrc = path.join(projectRoot, srcRelPath);
  const outRelPath = srcRelPath.replace(/\.tsx?$/, '.mjs');
  const fullOut = path.join(tempCompiledDir, outRelPath);

  fs.mkdirSync(path.dirname(fullOut), { recursive: true });

  const raw = fs.readFileSync(fullSrc, 'utf8');
  const transpiled = ts.transpileModule(raw, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  let fixedImports = transpiled.replace(/from\s+['"](\.[^'"]+)['"]/g, (match, importPath) => {
    if (importPath.endsWith('.mjs') || importPath.endsWith('.js') || importPath.endsWith('.json')) {
      return match;
    }
    return `from '${importPath}.mjs'`;
  });

  if (srcRelPath.includes('aiSyllabusService')) {
    fixedImports = `if (!import.meta.env) { import.meta.env = { VITE_OPEN_LLM_API_KEY: 'mock-key' }; }\n` + fixedImports;
  }

  fs.writeFileSync(fullOut, fixedImports, 'utf8');
  return fullOut;
}

try {
  // Transpile dependencies
  transpileTsToMjs('src/types/index.ts');
  transpileTsToMjs('src/data/tceGoPreset.ts');
  transpileTsToMjs('src/modules/cycle/cycleGenerator.ts');
  transpileTsToMjs('src/modules/autopilot/gamification.ts');
  transpileTsToMjs('src/modules/autopilot/autopilotEngine.ts');
  transpileTsToMjs('src/lib/security.ts');
  const dbMjsPath = transpileTsToMjs('src/db/database.ts');
  const aiMjsPath = transpileTsToMjs('src/services/aiSyllabusService.ts');

  const { db } = await import(pathToFileURL(dbMjsPath).href);
  const { parseSyllabusFallback, parseSyllabusWithOpenLLM } = await import(pathToFileURL(aiMjsPath).href);

  // --------------------------------------------------------------------------
  // SUITE 1: VULN-1 RE-VERIFICATION (Corrupted JSON in database.ts)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 1: VULN-1 RE-VERIFICATION (CORRUPTED JSON IN DATABASE.TS) ---');

  const dbCode = fs.readFileSync(path.join(projectRoot, 'src/db/database.ts'), 'utf8');

  test('VULN-1.1: Static audit confirms try...catch wraps JSON.parse in getWorkspaces', () => {
    const slice = dbCode.substring(dbCode.indexOf('getWorkspaces():'), dbCode.indexOf('saveWorkspaces('));
    assert.ok(slice.includes('try {'), 'getWorkspaces must include try block');
    assert.ok(slice.includes('catch'), 'getWorkspaces must include catch block');
    assert.ok(slice.includes('return [];'), 'getWorkspaces must return [] on catch');
  });

  test('VULN-1.2: Static audit confirms try...catch wraps JSON.parse in getSessions', () => {
    const slice = dbCode.substring(dbCode.indexOf('getSessions():'), dbCode.indexOf('saveSessions('));
    assert.ok(slice.includes('try {'), 'getSessions must include try block');
    assert.ok(slice.includes('catch'), 'getSessions must include catch block');
    assert.ok(slice.includes('return [];'), 'getSessions must return [] on catch');
  });

  test('VULN-1.3: Static audit confirms try...catch wraps JSON.parse in getQuestions', () => {
    const slice = dbCode.substring(dbCode.indexOf('getQuestions():'), dbCode.indexOf('saveQuestions('));
    assert.ok(slice.includes('try {'), 'getQuestions must include try block');
    assert.ok(slice.includes('catch'), 'getQuestions must include catch block');
    assert.ok(slice.includes('return [];'), 'getQuestions must return [] on catch');
  });

  test('VULN-1.4: Empirical test: corrupted JSON in localStorage does not crash getWorkspaces', () => {
    db.setCurrentUserId(null);
    mockStorage.setItem('concurso_estudos_workspaces', '{ invalid json workspace broken... ');
    assert.doesNotThrow(() => {
      const ws = db.getWorkspaces();
      assert.deepEqual(ws, []);
    });
  });

  test('VULN-1.5: Empirical test: corrupted JSON in localStorage does not crash getSessions', () => {
    mockStorage.setItem('concurso_estudos_sessions', '{{<<malformed-sessions>>}}');
    assert.doesNotThrow(() => {
      const sess = db.getSessions();
      assert.deepEqual(sess, []);
    });
  });

  test('VULN-1.6: Empirical test: corrupted JSON in localStorage does not crash getQuestions', () => {
    mockStorage.setItem('concurso_estudos_questions', '[{ incomplete json');
    assert.doesNotThrow(() => {
      const q = db.getQuestions();
      assert.deepEqual(q, []);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: VULN-2 RE-VERIFICATION (Supabase UUID Account Isolation)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 2: VULN-2 RE-VERIFICATION (SUPABASE UUID ACCOUNT ISOLATION) ---');

  test('VULN-2.1: Static audit confirms !k.startsWith("concurso_estudos_usr-") is removed', () => {
    assert.ok(
      !dbCode.includes("!k.startsWith('concurso_estudos_usr-')"),
      'Vulnerable hardcoded usr- prefix check must be completely removed'
    );
    assert.ok(
      !dbCode.includes('!k.startsWith("concurso_estudos_usr-")'),
      'Vulnerable hardcoded usr- prefix check must be completely removed'
    );
    assert.ok(dbCode.includes('guestKeyPatterns'), 'Must use guestKeyPatterns for explicit guest scoping');
  });

  test('VULN-2.2: Empirical test: User A with Supabase UUID is never migrated into User B', () => {
    mockStorage.clear();
    const userA_id = 'c8b66782-5d98-466d-9799-d5c2105e1975';
    const userB_id = 'e7f86749-9ce7-4fe7-8a43-02f893112d1b';

    // User A data in storage
    mockStorage.setItem(`concurso_estudos_${userA_id}_workspaces`, JSON.stringify([{ id: 'ws-a', name: 'User A Secret Study' }]));
    mockStorage.setItem(`concurso_estudos_${userA_id}_sessions`, JSON.stringify([{ id: 's-a', date: '2026-11-01', durationSeconds: 3600 }]));
    mockStorage.setItem(`concurso_estudos_${userA_id}_questions`, JSON.stringify([{ id: 'q-a', date: '2026-11-01', attempted: 20, correct: 19 }]));

    // Genuine guest data
    mockStorage.setItem('concurso_estudos_workspaces', JSON.stringify([{ id: 'ws-guest', name: 'Guest Study' }]));
    mockStorage.setItem('concurso_estudos_sessions', JSON.stringify([{ id: 's-guest', date: '2026-11-02', durationSeconds: 1200 }]));

    // User B logs in
    db.setCurrentUserId(userB_id);
    db.migrateGuestData(null, userB_id);

    // Check User B data
    const userB_workspaces = db.getWorkspaces();
    const userB_sessions = db.getSessions();

    assert.equal(userB_workspaces.length, 1, 'User B must only have 1 workspace');
    assert.equal(userB_workspaces[0].id, 'ws-guest', 'User B workspace must be the guest workspace');
    assert.ok(!userB_workspaces.some((w) => w.id === 'ws-a'), 'User B must strictly not have User A workspace');

    assert.equal(userB_sessions.length, 1, 'User B must only have 1 session');
    assert.equal(userB_sessions[0].id, 's-guest');
    assert.ok(!userB_sessions.some((s) => s.id === 's-a'), 'User B must strictly not have User A session');

    // Verify User A data remains 100% intact
    db.setCurrentUserId(userA_id);
    const userA_workspaces = db.getWorkspaces();
    const userA_sessions = db.getSessions();
    assert.equal(userA_workspaces.length, 1);
    assert.equal(userA_workspaces[0].id, 'ws-a');
    assert.equal(userA_sessions.length, 1);
    assert.equal(userA_sessions[0].id, 's-a');
  });

  test('VULN-2.3: Empirical test: Dynamic workspace keys for guest are migrated without cross-user leak', () => {
    mockStorage.clear();
    const userA_id = '33333333-3333-4333-8333-333333333333';
    const userB_id = '44444444-4444-4444-8444-444444444444';

    // Guest workspace dynamic keys
    mockStorage.setItem('concurso_estudos_workspaces', JSON.stringify([{ id: 'ws-dyn', name: 'Dynamic Guest WS' }]));
    mockStorage.setItem('concurso_estudos_subjects_ws-dyn', JSON.stringify([{ id: 'sub-g', name: 'Direito Administrativo', topics: [] }]));
    mockStorage.setItem('concurso_estudos_flashcards_ws-dyn', JSON.stringify([{ id: 'fc-g', front: 'Front', back: 'Back' }]));

    // User A already has own dynamic keys
    mockStorage.setItem(`concurso_estudos_${userA_id}_workspaces`, JSON.stringify([{ id: 'ws-userA-dyn', name: 'User A WS' }]));

    // User B logs in
    db.setCurrentUserId(userB_id);
    db.migrateGuestData(null, userB_id);

    assert.ok(mockStorage.getItem(`concurso_estudos_${userB_id}_workspaces`), 'User B got workspaces');
    assert.ok(mockStorage.getItem(`concurso_estudos_${userB_id}_subjects_ws-dyn`), 'User B got dynamic subjects');
    assert.ok(mockStorage.getItem(`concurso_estudos_${userB_id}_flashcards_ws-dyn`), 'User B got dynamic flashcards');

    // User B should NOT have any reference to ws-userA-dyn
    const bWs = JSON.parse(mockStorage.getItem(`concurso_estudos_${userB_id}_workspaces`));
    assert.ok(!bWs.some((w) => w.id === 'ws-userA-dyn'));
  });

  // --------------------------------------------------------------------------
  // SUITE 3: VULN-3 RE-VERIFICATION (concursoInfo Sanitization in aiSyllabusService)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 3: VULN-3 RE-VERIFICATION (CONCURSOINFO SANITIZATION) ---');

  const aiCode = fs.readFileSync(path.join(projectRoot, 'src/services/aiSyllabusService.ts'), 'utf8');

  test('VULN-3.1: Static audit confirms sanitizeObject wraps concursoInfo in LLM and direct JSON mode', () => {
    assert.ok(
      aiCode.includes('sanitizeObject(parsed.data.concursoInfo || {})'),
      'parseSyllabusWithOpenLLM must wrap concursoInfo with sanitizeObject'
    );
    assert.ok(
      aiCode.includes('sanitizeObject(data.concursoInfo || data.concurso_info || {})'),
      'parseSyllabusFallback direct JSON must wrap concursoInfo with sanitizeObject'
    );
  });

  test('VULN-3.2: Empirical test: direct JSON input with XSS payloads in concursoInfo is safely sanitized', () => {
    const maliciousJson = JSON.stringify({
      concursoInfo: {
        concurso: '<script>alert("pwned")</script>Receita Federal',
        cargo: '<img src=x onerror=alert(1)>Auditor Fiscal',
        banca: '<iframe src="javascript:alert(2)">FGV</iframe>',
        dataProva: '2026-11-20" onfocus="alert(3)',
      },
      subjects: [
        {
          name: 'Direito Constitucional',
          weight: 3,
          topics: [
            { name: 'Tópico 1', subtopics: ['Sub 1'] },
          ],
        },
      ],
    });

    const parsed = parseSyllabusFallback(maliciousJson);

    assert.equal(parsed.source, 'json');
    assert.ok(parsed.concursoInfo, 'concursoInfo must exist');
    assert.ok(!parsed.concursoInfo.concurso.includes('<script>'), 'Must escape script tag in concurso');
    assert.ok(parsed.concursoInfo.concurso.includes('&lt;script&gt;'), 'Must encode script tag');
    assert.ok(!parsed.concursoInfo.cargo.includes('<img'), 'Must escape img tag in cargo');
    assert.ok(parsed.concursoInfo.cargo.includes('&lt;img'), 'Must encode img tag');
    assert.ok(!parsed.concursoInfo.banca.includes('<iframe'), 'Must escape iframe tag in banca');
    assert.ok(parsed.concursoInfo.banca.includes('&lt;iframe'), 'Must encode iframe tag');
    assert.ok(!parsed.concursoInfo.dataProva.includes('"'), 'Must escape double quotes in dataProva');
    assert.ok(parsed.concursoInfo.dataProva.includes('&quot;'), 'Must encode double quotes');
  });

  test('VULN-3.3: Empirical test: outline text with malicious headers is sanitized safely', () => {
    const maliciousOutline = `
CONCURSO: <script>bad()</script>TJ-SP
CARGO: <svg/onload=alert(1)>Escrevente
BANCA: <b onmouseover=bad()>VUNESP</b>
DISCIPLINA: Português
- Crase
`;

    const parsed = parseSyllabusFallback(maliciousOutline);
    assert.ok(!parsed.concursoInfo.concurso.includes('<script>'));
    assert.ok(parsed.concursoInfo.concurso.includes('&lt;script&gt;'));
    assert.ok(!parsed.concursoInfo.cargo.includes('<svg'));
    assert.ok(parsed.concursoInfo.cargo.includes('&lt;svg'));
    assert.ok(!parsed.concursoInfo.banca.includes('<b '));
    assert.ok(parsed.concursoInfo.banca.includes('&lt;b '));
  });

  await testAsync('VULN-3.4: Empirical test: mock LLM mode with XSS payload in concursoInfo returns sanitized object', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                concursoInfo: {
                  concurso: '<script>alert("llm-xss")</script>Polícia Federal',
                  cargo: 'Agente<img src=x onerror=alert(1)>',
                  banca: 'Cebraspe',
                },
                subjects: [
                  {
                    name: 'Direito Penal',
                    weight: 4,
                    topics: [{ name: 'Crimes contra a pessoa', subtopics: ['Homicídio'] }],
                  },
                ],
              }),
            },
          },
        ],
      }),
    });

    try {
      const res = await parseSyllabusWithOpenLLM('dummy syllabus text');
      assert.equal(res.source, 'llm');
      assert.ok(!res.concursoInfo.concurso.includes('<script>'), 'LLM concurso must escape <script>');
      assert.ok(res.concursoInfo.concurso.includes('&lt;script&gt;'), 'LLM concurso must encode &lt;script&gt;');
      assert.ok(!res.concursoInfo.cargo.includes('<img'), 'LLM cargo must escape <img');
      assert.ok(res.concursoInfo.cargo.includes('&lt;img'), 'LLM cargo must encode &lt;img');
      assert.equal(res.concursoInfo.banca, 'Cebraspe');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n====================================================================');
  console.log(`  RE-VERIFICATION RESULTS: ${passedTests}/${totalTests} PASSED (Failed: ${failedTests})`);
  console.log('====================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('✔ ALL ADVERSARIAL RE-VERIFICATION TESTS PASSED WITH 100% FIDELITY!');
  }
} finally {
  fs.rmSync(tempCompiledDir, { recursive: true, force: true });
}
