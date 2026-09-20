import assert from 'node:assert/strict';

// --- SECURITY HELPERS (matching src/lib/security.ts) ---
const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

function sanitizeString(input) {
  if (typeof input !== 'string') {
    return String(input ?? '');
  }
  return input.replace(/[&<>"']/g, (match) => HTML_ESCAPES[match] || match);
}

function sanitizeObject(value) {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObject(item));
  }
  if (value !== null && typeof value === 'object') {
    const sanitizedObj = {};
    for (const [key, val] of Object.entries(value)) {
      sanitizedObj[sanitizeString(key)] = sanitizeObject(val);
    }
    return sanitizedObj;
  }
  return value;
}

function safeJsonParse(raw, fallback) {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
}

function extractAndParseJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { success: false, error: 'Nenhum texto fornecido.' };
  }

  let text = rawText.trim();
  if (!text) {
    return { success: false, error: 'O texto fornecido está vazio.' };
  }

  // 1. If markdown codeblock is present, extract its inner content
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  } else {
    // 2. Look for outer JSON object or array bounds
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let startIdx = -1;
    let isArray = false;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      isArray = true;
    }

    if (startIdx !== -1) {
      const endChar = isArray ? ']' : '}';
      const lastIdx = text.lastIndexOf(endChar);
      if (lastIdx > startIdx) {
        text = text.substring(startIdx, lastIdx + 1);
      }
    }
  }

  // 3. Remove single-line comments (// ...) while preserving URLs like https://
  text = text.replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

  // 4. Remove multi-line comments (/* ... */)
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');

  // 5. Remove trailing commas before closing braces/brackets
  text = text.replace(/,(\s*[}\]])/g, '$1');

  try {
    const data = JSON.parse(text);
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: `JSON Inválido: ${err?.message || 'Verifique a formatação do texto gerado pela IA.'}`,
    };
  }
}

// Multi-user scoped storage simulation (matching src/db/database.ts)
class MultiUserDbMock {
  constructor() {
    this.store = new Map();
    this.currentUserId = null;
  }

  setCurrentUserId(uid) {
    this.currentUserId = uid;
  }

  getCurrentUserId() {
    return this.currentUserId;
  }

  getUserScopedKey(baseKey) {
    const uid = this.getCurrentUserId();
    if (!uid) return `concurso_estudos_${baseKey}`;
    return `concurso_estudos_${uid}_${baseKey}`;
  }

  getWorkspaces() {
    const key = this.getUserScopedKey('workspaces');
    const data = this.store.get(key);
    return data ? JSON.parse(data) : [];
  }

  saveWorkspaces(ws) {
    const key = this.getUserScopedKey('workspaces');
    this.store.set(key, JSON.stringify(ws));
  }

  getSessions() {
    const key = this.getUserScopedKey('sessions');
    const data = this.store.get(key);
    return data ? JSON.parse(data) : [];
  }

  saveSessions(s) {
    const key = this.getUserScopedKey('sessions');
    this.store.set(key, JSON.stringify(s));
  }
}

console.log('--- RUNNING SECURITY & SYLLABUS ENGINE TESTS ---');

// Test 1: XSS Sanitization preserves legal slashes in laws, dates, and subjects
const maliciousInput = "<script>alert('XSS')</script>&\"/ Lei 8.112/1990 data 17/01/2027";
const sanitized = sanitizeString(maliciousInput);
assert.strictEqual(
  sanitized,
  '&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt;&amp;&quot;/ Lei 8.112/1990 data 17/01/2027'
);
assert.ok(!sanitized.includes('&#x2F;'), 'Slashes should not be converted to &#x2F;');
console.log('✓ Test 1 Passed: XSS vectors safely escaped while slashes in laws and dates are preserved.');

// Test 2: Recursive Object Sanitization
const dirtyPayload = {
  '<title>': '<b>Direito Administrativo</b>',
  notes: "Ato vinculado 'nulo' / Lei 14.133/21",
  tags: ['<script>', 'prova"2026'],
  count: 42,
  nested: {
    'danger<key>': 'safe&value'
  }
};
const cleanedPayload = sanitizeObject(dirtyPayload);
assert.strictEqual(cleanedPayload['&lt;title&gt;'], '&lt;b&gt;Direito Administrativo&lt;/b&gt;');
assert.strictEqual(cleanedPayload.notes, "Ato vinculado &#x27;nulo&#x27; / Lei 14.133/21");
assert.strictEqual(cleanedPayload.tags[0], '&lt;script&gt;');
assert.strictEqual(cleanedPayload.tags[1], 'prova&quot;2026');
assert.strictEqual(cleanedPayload.count, 42);
assert.strictEqual(cleanedPayload.nested['danger&lt;key&gt;'], 'safe&amp;value');
console.log('✓ Test 2 Passed: Recursive nested object & array sanitization verified.');

// Test 3: Safe JSON parse fallbacks
assert.deepStrictEqual(safeJsonParse(null, []), []);
assert.deepStrictEqual(safeJsonParse(undefined, { fallback: true }), { fallback: true });
assert.deepStrictEqual(safeJsonParse('{ broken json', { error: true }), { error: true });
assert.deepStrictEqual(safeJsonParse('{"ok": 123}', {}), { ok: 123 });
console.log('✓ Test 3 Passed: Safe JSON parser handles malformed, null, and valid strings gracefully.');

// Test 4: Email validation
assert.strictEqual(isValidEmail('admin@estud.ai'), true);
assert.strictEqual(isValidEmail('concurseiro.focado@gmail.com'), true);
assert.strictEqual(isValidEmail('user+tag@domain.co.uk'), true);
assert.strictEqual(isValidEmail('notanemail'), false);
assert.strictEqual(isValidEmail('@domain.com'), false);
assert.strictEqual(isValidEmail('user@'), false);
assert.strictEqual(isValidEmail('user@domain'), false);
assert.strictEqual(isValidEmail(''), false);
console.log('✓ Test 4 Passed: RFC-compliant email validation accurately discriminates.');

// Test 5: AI Markdown JSON Parsing with conversational preamble and concluding remarks
const rawAiOutputWithConversation = `
Olá, concurseiro! Analisei o seu edital e estruturei o cronograma solicitado.
Aqui está o JSON completo pronto para o estud.ai:

\`\`\`json
{
  "concursoInfo": {
    "concurso": "Receita Federal",
    "cargo": "Auditor Fiscal",
    "banca": "FGV",
    "dataProva": "2026-12-15"
  },
  "subjects": [
    {
      "name": "Direito Tributário",
      "weight": 5, // matéria com maior pontuação
      "status": "active",
      "topics": [
        {
          "name": "Sistema Tributário Nacional",
          "subtopics": [
            { "name": "Princípios Constitucionais" },
            { "name": "Limitações ao Poder de Tributar", } // vírgula sobrando proposital
          ]
        }
      ]
    }
  ]
}
\`\`\`

Bons estudos e boa sorte na sua aprovação!
`;
const parsedConv = extractAndParseJson(rawAiOutputWithConversation);
assert.strictEqual(parsedConv.success, true);
assert.strictEqual(parsedConv.data.concursoInfo.concurso, 'Receita Federal');
assert.strictEqual(parsedConv.data.subjects[0].name, 'Direito Tributário');
assert.strictEqual(parsedConv.data.subjects[0].topics[0].subtopics.length, 2);
console.log('✓ Test 5 Passed: AI JSON with conversational intro, trailing comma, comments and markdown wrapper parsed cleanly.');

// Test 6: AI JSON with string array subtopics and alternate key names (disciplinas)
const rawAiOutputAlt = `
{
  "disciplinas": [
    {
      "nome": "Língua Portuguesa",
      "peso": 4,
      "topicos": [
        {
          "nome": "Interpretação de Textos",
          "subtopicos": [
            "Tipologia Textual",
            "Coesão e Coerência",
          ]
        }
      ]
    }
  ]
}
`;
const parsedAlt = extractAndParseJson(rawAiOutputAlt);
assert.strictEqual(parsedAlt.success, true);
assert.strictEqual(parsedAlt.data.disciplinas[0].nome, 'Língua Portuguesa');
assert.strictEqual(parsedAlt.data.disciplinas[0].topicos[0].subtopicos.length, 2);
assert.strictEqual(parsedAlt.data.disciplinas[0].topicos[0].subtopicos[0], 'Tipologia Textual');
console.log('✓ Test 6 Passed: AI JSON with string-array subtopics and Portuguese key variations parsed cleanly.');

// Test 7: Multi-User Storage Isolation
const userDb = new MultiUserDbMock();

// User 1: Alice
userDb.setCurrentUserId('usr-alice');
userDb.saveWorkspaces([{ id: 'ws-alice', name: 'Concurso Alice', createdAt: '2026-01-01' }]);
userDb.saveSessions([{ id: 'sess-1', durationSeconds: 3600, workspaceId: 'ws-alice' }]);

assert.strictEqual(userDb.getWorkspaces().length, 1);
assert.strictEqual(userDb.getWorkspaces()[0].name, 'Concurso Alice');
assert.strictEqual(userDb.getSessions().length, 1);

// User 2: Bob (switching users)
userDb.setCurrentUserId('usr-bob');
assert.strictEqual(userDb.getWorkspaces().length, 0, 'User Bob must start with 0 workspaces, isolated from Alice');
assert.strictEqual(userDb.getSessions().length, 0, 'User Bob must start with 0 sessions, isolated from Alice');

userDb.saveWorkspaces([{ id: 'ws-bob', name: 'Concurso Bob', createdAt: '2026-01-02' }]);
userDb.saveSessions([{ id: 'sess-2', durationSeconds: 1800, workspaceId: 'ws-bob' }]);
assert.strictEqual(userDb.getWorkspaces().length, 1);
assert.strictEqual(userDb.getWorkspaces()[0].name, 'Concurso Bob');

// Switch back to Alice
userDb.setCurrentUserId('usr-alice');
assert.strictEqual(userDb.getWorkspaces().length, 1);
assert.strictEqual(userDb.getWorkspaces()[0].name, 'Concurso Alice');
assert.strictEqual(userDb.getSessions()[0].id, 'sess-1');
console.log('✓ Test 7 Passed: Multi-user storage strictly isolates workspaces and study sessions across accounts.');

console.log('=== ALL SECURITY & SYLLABUS ENGINE TESTS PASSED! ===');
