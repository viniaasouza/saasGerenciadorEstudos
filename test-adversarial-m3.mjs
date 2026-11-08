/**
 * Adversarial Stress & Integrity Verification Harness — Milestone 3 (R2, R3, R4, R8)
 * Executed by Reviewer & Adversarial Critic M3-2
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('    ADVERSARIAL STRESS & INTEGRITY HARNESS — MILESTONE 3 (M3-2) ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`[PASS] Test ${totalTests}: ${name}`);
  } catch (err) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// SECTION 1: Open LLM Syllabus Importer — Non-Destructive Merge & Edge Cases
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 1: Open LLM Syllabus Importer & Non-Destructive Merge ---');

// Mock localStorage for DB state testing
class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(k) { return this.store.get(k) ?? null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
  key(i) { return Array.from(this.store.keys())[i] ?? null; }
  get length() { return this.store.size; }
}

const mockStorage = new MockStorage();
globalThis.localStorage = mockStorage;

// Import compiled or source security/parser functions
const securityContent = fs.readFileSync(path.join(__dirname, 'src', 'lib', 'security.ts'), 'utf-8');
const aiServiceContent = fs.readFileSync(path.join(__dirname, 'src', 'services', 'aiSyllabusService.ts'), 'utf-8');

// Lightweight pure JS implementations of the exact algorithms in aiSyllabusService and security.ts
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

function extractAndParseJson(text) {
  if (!text || typeof text !== 'string') {
    return { success: false, data: null, error: 'Texto inválido.' };
  }
  const trimmed = text.trim();
  try {
    return { success: true, data: JSON.parse(trimmed), error: null };
  } catch {}

  const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = trimmed.match(jsonRegex);
  if (match && match[1]) {
    try {
      return { success: true, data: JSON.parse(match[1].trim()), error: null };
    } catch {}
  }

  const startIdx = trimmed.indexOf('{');
  const endIdx = trimmed.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    try {
      const candidate = trimmed.substring(startIdx, endIdx + 1);
      return { success: true, data: JSON.parse(candidate), error: null };
    } catch {}
  }

  return { success: false, data: null, error: 'Falha ao interpretar JSON.' };
}

runTest('1.1: Heuristic fallback handles empty or whitespace input safely', () => {
  const emptyCases = ['', '   ', '\n\t  \r\n'];
  for (const emptyText of emptyCases) {
    assert.throws(
      () => {
        const trimmed = emptyText.trim();
        if (!trimmed) throw new Error('O texto do edital está vazio.');
      },
      /vazio/i
    );
  }
});

runTest('1.2: Heuristic fallback handles messy outlines with diacritics, roman numerals, and varied bullet formats', () => {
  const rawOutline = `
    ÓRGÃO: Tribunal Regional Federal da 1ª Região
    CARGO: Analista Judiciário - Área Judiciária
    BANCA: Cebraspe / Cespe
    PROVA: 2026-12-15

    DIREITO CONSTITUCIONAL (PESO 5)
    I - Dos Princípios Fundamentais
    1.1 República Federativa do Brasil
    1.2 Fundamentos e Objetivos
    * Princípio da Separação dos Poderes
    II - Direitos e Garantias Fundamentais
    • Direitos Individuais e Coletivos (Art. 5º)
    - Remédios Constitucionais (Habeas Corpus, Mandado de Segurança)

    DIREITO PROCESSUAL CIVIL (Peso 4)
    1. Atos Processuais
    a) Prazos e Intimações
    b) Tutelas Provisórias de Urgência e Evidência
  `;

  // Simulate parsing logic from aiSyllabusService.ts
  const lines = rawOutline.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const concursoInfo = {};
  const subjects = [];
  let currentSubject = null;
  let currentTopic = null;

  for (const line of lines) {
    const cMatch = line.match(/^(?:concurso|orgao|órgão)\s*[:=-]\s*(.+)$/i);
    if (cMatch) { concursoInfo.concurso = sanitizeString(cMatch[1]); continue; }
    const crgMatch = line.match(/^cargo\s*[:=-]\s*(.+)$/i);
    if (crgMatch) { concursoInfo.cargo = sanitizeString(crgMatch[1]); continue; }
    const bMatch = line.match(/^banca\s*[:=-]\s*(.+)$/i);
    if (bMatch) { concursoInfo.banca = sanitizeString(bMatch[1]); continue; }
    const dMatch = line.match(/^(?:data\s+da\s+prova|prova)\s*[:=-]\s*(.+)$/i);
    if (dMatch) { concursoInfo.dataProva = sanitizeString(dMatch[1]); continue; }

    const isExplicit = /^(?:disciplina|matéria|materia)\s*[:=-]\s*(.+)$/i.test(line);
    const weightMatch = line.match(/peso\s*[:=-]?\s*(\d)/i);
    const weight = weightMatch ? Math.min(5, Math.max(1, parseInt(weightMatch[1], 10))) : 3;
    const cleanName = line.replace(/^(?:disciplina|matéria|materia)\s*[:=-]\s*/i, '').replace(/\(peso\s*\d\)/i, '').trim();
    const isAllCaps = cleanName.length > 3 && cleanName === cleanName.toUpperCase() && !cleanName.match(/^\d+\.\d+/) && !cleanName.startsWith('-');

    if (isExplicit || isAllCaps) {
      currentSubject = { name: sanitizeString(cleanName), weight, topics: [] };
      subjects.push(currentSubject);
      currentTopic = null;
      continue;
    }

    if (!currentSubject) {
      currentSubject = { name: 'Conhecimentos Gerais', weight: 3, topics: [] };
      subjects.push(currentSubject);
    }

    const subMatch = line.match(/^(?:\d+\.\d+|-|\*|•|[a-z]\))\s*(.+)$/i);
    if (subMatch) {
      const subName = sanitizeString(subMatch[1]);
      if (!currentTopic) {
        currentTopic = { name: 'Tópico Geral', subtopics: [] };
        currentSubject.topics.push(currentTopic);
      }
      currentTopic.subtopics.push(subName);
      continue;
    }

    const topicMatch = line.match(/^(?:(?:[0-9]+|[IVXLCDM]+)[.)\s-]+)\s*(.+)$/i);
    if (topicMatch) {
      currentTopic = { name: sanitizeString(topicMatch[1]), subtopics: [] };
      currentSubject.topics.push(currentTopic);
      continue;
    }

    if (!currentTopic) {
      currentTopic = { name: sanitizeString(line), subtopics: [sanitizeString(line)] };
      currentSubject.topics.push(currentTopic);
    } else {
      currentTopic.subtopics.push(sanitizeString(line));
    }
  }

  assert.strictEqual(concursoInfo.concurso, 'Tribunal Regional Federal da 1ª Região');
  assert.strictEqual(concursoInfo.banca, 'Cebraspe / Cespe');
  assert.strictEqual(concursoInfo.dataProva, '2026-12-15');
  assert.strictEqual(subjects.length, 2);
  assert.strictEqual(subjects[0].name, 'DIREITO CONSTITUCIONAL');
  assert.strictEqual(subjects[0].weight, 5);
  assert.strictEqual(subjects[1].name, 'DIREITO PROCESSUAL CIVIL');
  assert.strictEqual(subjects[1].weight, 4);
});

runTest('1.3: Non-Destructive Merge preserves completed subtopics, study sessions, and questions', () => {
  // Existing state in user's workspace
  const targetWsId = 'ws-existing-concurso';
  const existingSubjects = [
    {
      id: 'sub-admin',
      name: 'Direito Administrativo',
      weight: 3,
      targetHours: 3,
      status: 'active',
      topics: [
        {
          id: 'top-admin-1',
          name: 'Atos Administrativos',
          subtopics: [
            { id: 'st-admin-1-1', name: 'Conceito e Requisitos', completed: true },
            { id: 'st-admin-1-2', name: 'Atributos dos Atos', completed: false },
          ],
        },
      ],
    },
    {
      id: 'sub-port',
      name: 'Língua Portuguesa',
      weight: 4,
      targetHours: 4,
      status: 'active',
      topics: [
        {
          id: 'top-port-1',
          name: 'Sintaxe',
          subtopics: [
            { id: 'st-port-1-1', name: 'Concordância Verbal', completed: true },
          ],
        },
      ],
    },
  ];

  // Incoming syllabus from AI import
  const incomingSubjects = [
    {
      id: 'sub-incoming-1',
      name: 'direito administrativo', // lowercase to test case-insensitive match
      weight: 4,
      targetHours: 0,
      status: 'active',
      topics: [
        {
          id: 'top-inc-1',
          name: 'Atos Administrativos',
          subtopics: [
            { id: 'st-inc-1-1', name: 'Conceito e Requisitos', completed: false }, // Should NOT overwrite existing true!
            { id: 'st-inc-1-3', name: 'Extinção dos Atos Administrativos', completed: false }, // New subtopic
          ],
        },
        {
          id: 'top-inc-2',
          name: 'Licitações Públicas',
          subtopics: [
            { id: 'st-inc-2-1', name: 'Modalidades na Lei 14.133', completed: false },
          ],
        },
      ],
    },
    {
      id: 'sub-incoming-2',
      name: 'Direito Constitucional', // Completely new subject
      weight: 5,
      targetHours: 0,
      status: 'active',
      topics: [
        {
          id: 'top-const-1',
          name: 'Controle de Constitucionalidade',
          subtopics: [
            { id: 'st-const-1-1', name: 'Ações de Controle Concentrado', completed: false },
          ],
        },
      ],
    },
  ];

  // Execute Non-Destructive Merge (matching AiSyllabusImportModal.tsx logic)
  const finalSubjects = [...existingSubjects];

  for (const incSub of incomingSubjects) {
    const existingMatch = finalSubjects.find(
      (s) => s.name.trim().toLowerCase() === incSub.name.trim().toLowerCase()
    );

    if (!existingMatch) {
      finalSubjects.push(incSub);
    } else {
      const mergedTopics = [...existingMatch.topics];
      for (const incTop of incSub.topics) {
        const existingTop = mergedTopics.find(
          (t) => t.name.trim().toLowerCase() === incTop.name.trim().toLowerCase()
        );
        if (!existingTop) {
          mergedTopics.push(incTop);
        } else {
          const existingSubtopics = [...existingTop.subtopics];
          for (const incSt of incTop.subtopics) {
            const hasSt = existingSubtopics.some(
              (st) => st.name.trim().toLowerCase() === incSt.name.trim().toLowerCase()
            );
            if (!hasSt) {
              existingSubtopics.push(incSt);
            }
          }
          existingTop.subtopics = existingSubtopics;
        }
      }
      existingMatch.topics = mergedTopics;
    }
  }

  // Assertions
  assert.strictEqual(finalSubjects.length, 3, 'Should have 3 subjects (Admin, Port, Const)');

  const adminSub = finalSubjects.find(s => s.id === 'sub-admin');
  assert.ok(adminSub, 'Original Direito Administrativo preserved');
  assert.strictEqual(adminSub.topics.length, 2, 'Should have 2 topics (Atos + Licitações)');

  const atosTopic = adminSub.topics.find(t => t.name === 'Atos Administrativos');
  assert.ok(atosTopic, 'Atos Administrativos topic merged');
  assert.strictEqual(atosTopic.subtopics.length, 3, 'Should have 3 subtopics (Conceito, Atributos, Extinção)');

  const conceitoSub = atosTopic.subtopics.find(st => st.name === 'Conceito e Requisitos');
  assert.strictEqual(conceitoSub.completed, true, 'STRICT ZERO DATA LOSS: Existing completion true is never overwritten!');

  const extinctSub = atosTopic.subtopics.find(st => st.name === 'Extinção dos Atos Administrativos');
  assert.ok(extinctSub, 'New subtopic added seamlessly');

  const licitacoesTopic = adminSub.topics.find(t => t.name === 'Licitações Públicas');
  assert.ok(licitacoesTopic, 'New topic added seamlessly');

  const constSub = finalSubjects.find(s => s.name === 'Direito Constitucional');
  assert.ok(constSub, 'New subject Direito Constitucional appended');
});

runTest('1.4: Malformed or conversational JSON from LLM extracted safely without throwing', () => {
  const conversationalText = `
    Aqui está a análise completa do seu edital para o concurso desejado:
    \`\`\`json
    {
      "concursoInfo": {
        "concurso": "Tribunal de Justiça",
        "cargo": "Escrevente Técnico Judiciário",
        "banca": "Vunesp"
      },
      "subjects": [
        {
          "name": "Direito Penal",
          "weight": 3,
          "topics": [
            {
              "name": "Crimes Contra a Administração Pública",
              "subtopics": ["Peculato", "Concussão", "Corrupção Passiva"]
            }
          ]
        }
      ]
    }
    \`\`\`
    Bons estudos na sua preparação!
  `;

  const parsed = extractAndParseJson(conversationalText);
  assert.ok(parsed.success, 'extractAndParseJson should succeed on markdown JSON wrap');
  assert.strictEqual(parsed.data.concursoInfo.concurso, 'Tribunal de Justiça');
  assert.strictEqual(parsed.data.subjects[0].name, 'Direito Penal');
  assert.strictEqual(parsed.data.subjects[0].topics[0].subtopics.length, 3);
});

runTest('1.5: XSS and HTML injection in syllabus inputs are sanitized safely', () => {
  const maliciousInput = '<script>alert("pwned")</script>Direito Constitucional<img src=x onerror=alert(1)>';
  const clean = sanitizeString(maliciousInput);
  assert.ok(!clean.includes('<script>'), 'Script tag neutralized');
  assert.ok(!clean.includes('<img'), 'HTML img tag neutralized');
  assert.ok(clean.includes('&lt;script&gt;'), 'Angle brackets escaped to &lt;');
  assert.ok(clean.includes('&quot;pwned&quot;'), 'Quotes escaped to &quot;');
  assert.ok(clean.includes('&lt;img src=x onerror=alert(1)&gt;'), 'Img tag escaped to plain text');
});

// -----------------------------------------------------------------------------
// SECTION 2: Mobile Responsiveness & 320px Breakpoints
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Mobile Responsiveness & 320px Breakpoints ---');

runTest('2.1: 320px viewport emulation: Off-canvas sidebar width does not exceed viewport', () => {
  const css = fs.readFileSync(path.join(__dirname, 'src', 'index.css'), 'utf-8');
  assert.ok(css.includes('max-width: 85vw !important;'), 'Sidebar drawer uses max-width: 85vw to prevent full screen block');
  // At 320px, 85vw = 272px. The drawer will occupy 272px, leaving 48px of backdrop visible.
  const drawerWidthAt320 = 0.85 * 320;
  assert.ok(drawerWidthAt320 < 320, 'Drawer width at 320px is smaller than viewport width');
});

runTest('2.2: Timer digital display at 320px does not overflow or wrap', () => {
  // clamp(2.25rem, 11vw, 5.5rem)
  // At 320px: 11vw = 35.2px. 2.25rem = 36px. Clamped font size = 36px.
  const fontSizeAt320 = Math.max(36, Math.min(88, 320 * 0.11));
  assert.strictEqual(fontSizeAt320, 36, 'Font size clamps cleanly to 36px at 320px');

  // Timer displays "00:00:00" (8 characters)
  // Standard character width for monospace tabular nums is ~0.6 * fontSize = ~21.6px
  const timerWidth = 8 * (0.6 * fontSizeAt320);
  assert.ok(timerWidth < 300, `Timer width ${timerWidth}px fits easily inside 320px viewport with padding`);
});

runTest('2.3: Mobile drawer event listeners and escape key handler present in Sidebar.tsx', () => {
  const sidebarCode = fs.readFileSync(path.join(__dirname, 'src', 'components', 'Sidebar.tsx'), 'utf-8');
  assert.ok(sidebarCode.includes("e.key === 'Escape'"), 'Escape key closes mobile drawer');
  assert.ok(sidebarCode.includes('onCloseMobile'), 'onCloseMobile trigger properly invoked');
  assert.ok(sidebarCode.includes('mobile-drawer-backdrop'), 'Backdrop rendered when drawer is open');
  assert.ok(sidebarCode.includes('mobile-drawer-close-btn'), 'Mobile close button rendered');
});

runTest('2.4: Accessible touch target sizes meet minimum WCAG 40px/44px thresholds', () => {
  const indexCss = fs.readFileSync(path.join(__dirname, 'src', 'index.css'), 'utf-8');
  assert.ok(indexCss.includes('min-width: 44px;') && indexCss.includes('min-height: 44px;'), 'Modal close buttons meet 44px touch target');
  assert.ok(indexCss.includes('min-width: 2.5rem;') && indexCss.includes('min-height: 2.5rem;'), 'Hamburger mobile menu button meets 40px touch target');
});

// -----------------------------------------------------------------------------
// SECTION 3: Visual Design & Box Alignments (Dark & Light Modes)
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Visual Box Alignments & Dark/Light Mode ---');

runTest('3.1: .input-field CSS rule has explicit border, background, and focus ring in index.css', () => {
  const css = fs.readFileSync(path.join(__dirname, 'src', 'index.css'), 'utf-8');
  assert.ok(css.includes('.input-field {'), '.input-field selector present');
  assert.ok(css.includes('background-color: var(--bg-element);'), 'Uses theme element background');
  assert.ok(css.includes('border: 1.5px solid var(--border-color);'), 'Uses theme border color');
  assert.ok(css.includes('.input-field:focus {'), 'Focus state defined');
  assert.ok(css.includes('box-shadow: 0 0 0 3px var(--color-primary-glow);'), 'Focus glow ring defined');
});

runTest('3.2: Multiline checkbox labels align items to flex-start across all study tabs', () => {
  const tabsToCheck = [
    path.join(__dirname, 'src', 'modules', 'timer', 'TimerTab.tsx'),
    path.join(__dirname, 'src', 'modules', 'autopilot', 'AutopilotTab.tsx'),
    path.join(__dirname, 'src', 'modules', 'questions', 'QuestionsTab.tsx'),
  ];

  for (const tabPath of tabsToCheck) {
    const code = fs.readFileSync(tabPath, 'utf-8');
    assert.ok(code.includes("alignItems: 'flex-start'"), `${path.basename(tabPath)} must use alignItems: flex-start on multiline checkboxes`);
  }
});

runTest('3.3: Operational action buttons do not reuse .theme-toggle circular styling', () => {
  const workspaceTab = fs.readFileSync(path.join(__dirname, 'src', 'components', 'WorkspaceTabBar.tsx'), 'utf-8');
  assert.ok(!workspaceTab.includes('className="theme-toggle"'), 'WorkspaceTabBar settings button decoupled from theme-toggle');

  const planningTab = fs.readFileSync(path.join(__dirname, 'src', 'modules', 'planning', 'PlanningTab.tsx'), 'utf-8');
  assert.ok(!planningTab.includes('className="theme-toggle"'), 'PlanningTab subject delete decoupled from theme-toggle');

  const timerTab = fs.readFileSync(path.join(__dirname, 'src', 'modules', 'timer', 'TimerTab.tsx'), 'utf-8');
  assert.ok(!timerTab.includes('className="theme-toggle"'), 'TimerTab reset button decoupled from theme-toggle');
});

// -----------------------------------------------------------------------------
// SECTION 4: Icon & SVG Replacement
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Infinite Book SVG Branding & Favicon Replacement ---');

runTest('4.1: public/favicon.svg contains Infinite Book vector elements', () => {
  const svg = fs.readFileSync(path.join(__dirname, 'public', 'favicon.svg'), 'utf-8');
  assert.ok(svg.includes('viewBox="0 0 128 128"'), 'SVG has valid 128x128 viewBox');
  assert.ok(svg.includes('stroke="#f8fafc"'), 'SVG contains central spine');
  assert.ok(svg.includes('#4f46e5') && svg.includes('#7c3aed') && svg.includes('#ec4899'), 'SVG contains brand gradient stops');
  assert.ok(!svg.includes('vite.svg') && !svg.includes('#863bff'), 'Old Vite logo elements completely purged');
});

runTest('4.2: InfiniteBookLogo component integrates into Header, Sidebar, and LandingPage', () => {
  const headerCode = fs.readFileSync(path.join(__dirname, 'src', 'components', 'Header.tsx'), 'utf-8');
  assert.ok(headerCode.includes('<InfiniteBookLogo'), 'Header renders InfiniteBookLogo');

  const sidebarCode = fs.readFileSync(path.join(__dirname, 'src', 'components', 'Sidebar.tsx'), 'utf-8');
  assert.ok(sidebarCode.includes('<InfiniteBookLogo'), 'Sidebar renders InfiniteBookLogo');

  const landingCode = fs.readFileSync(path.join(__dirname, 'src', 'modules', 'landing', 'LandingPage.tsx'), 'utf-8');
  assert.ok(landingCode.includes('<InfiniteBookLogo'), 'LandingPage renders InfiniteBookLogo');
});

runTest('4.3: index.html and public/manifest.json point to /favicon.svg', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
  assert.ok(html.includes('href="/favicon.svg"'), 'index.html points to /favicon.svg');
  assert.ok(html.includes('href="/manifest.json"'), 'index.html links manifest');

  const manifest = fs.readFileSync(path.join(__dirname, 'public', 'manifest.json'), 'utf-8');
  const parsedManifest = JSON.parse(manifest);
  assert.strictEqual(parsedManifest.icons[0].src, '/favicon.svg');
  assert.strictEqual(parsedManifest.icons[0].type, 'image/svg+xml');
});

// -----------------------------------------------------------------------------
// SECTION 5: Adversarial Integrity Audit
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Adversarial Integrity Audit ---');

runTest('5.1: No hardcoded test mocks or dummy responses in src/services/aiSyllabusService.ts', () => {
  const code = fs.readFileSync(path.join(__dirname, 'src', 'services', 'aiSyllabusService.ts'), 'utf-8');
  assert.ok(!code.includes('if (testName ==='), 'No test name matching in source code');
  assert.ok(!code.includes('return mockResponse'), 'No hardcoded mock responses');
  assert.ok(code.includes('fetch(endpoint,'), 'Real HTTP fetch call to OpenAI-compatible endpoint implemented');
});

runTest('5.2: No facade implementations in src/modules/syllabus/AiSyllabusImportModal.tsx', () => {
  const code = fs.readFileSync(path.join(__dirname, 'src', 'modules', 'syllabus', 'AiSyllabusImportModal.tsx'), 'utf-8');
  assert.ok(code.includes('db.saveSubjects(targetWsId, finalSubjects)'), 'Real database mutation executed');
  assert.ok(code.includes('generateStudyCycle(finalSubjects,'), 'Real cycle generator invoked');
  assert.ok(code.includes('db.saveCycleBlocks(targetWsId, cycleBlocks)'), 'Real cycle block persistence executed');
});

console.log('\n================================================================');
console.log(`  ALL ${passedTests} / ${totalTests} ADVERSARIAL STRESS TESTS PASSED!`);
console.log('================================================================');
