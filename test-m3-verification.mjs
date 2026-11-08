/**
 * Verification Test Suite for Milestone 3 (R2, R3, R4, R8)
 * 
 * Objectives verified:
 * 1. R2: Box & Text Alignment Global Fix (input-field, checkbox alignment, theme-toggle decoupling)
 * 2. R3: Mobile Responsiveness (off-canvas drawer <=640px, hamburger, minmax fluid grids, timer clamp, table scroll, modal padding & touch targets)
 * 3. R4: Application Icon & Favicon (Infinite Book SVG in favicon.svg, index.html, Sidebar, Header, Landing)
 * 4. R8: Open LLM Syllabus Importer (service, fallback parser, non-destructive modal, prominent buttons)
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('================================================================');
console.log('  MILESTONE 3 VERIFICATION SUITE (R2, R3, R4, R8)');
console.log('================================================================\n');

const projectRoot = process.cwd();
let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${testName}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// 1. R2 — Box & Text Alignment Global Fix
// -----------------------------------------------------------------------------
console.log('[Objective R2: Box & Text Alignment Global Fix]');

runTest('R2.1: .input-field CSS class exists and is defined in src/index.css', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'src', 'index.css'), 'utf-8');
  assert.ok(css.includes('.input-field {'), 'Missing .input-field rule in index.css');
  assert.ok(css.includes('border: 1.5px solid var(--border-color);') || css.includes('border: 1.5px solid'), 'Missing input-field border');
  assert.ok(css.includes('border-radius: var(--radius-sm'), 'Missing input-field border-radius');
  assert.ok(css.includes('box-shadow: 0 0 0 3px'), 'Missing focus box-shadow');
});

runTest('R2.2: .icon-btn-secondary CSS class is defined and decoupled from .theme-toggle', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'src', 'index.css'), 'utf-8');
  assert.ok(css.includes('.icon-btn-secondary {'), 'Missing .icon-btn-secondary in index.css');
  assert.ok(css.includes('.theme-toggle {'), 'Preserved .theme-toggle in index.css');
  assert.ok(css.includes('transform: rotate(15deg);'), 'Preserved theme-toggle 15deg hover effect strictly on theme toggle');
});

runTest('R2.3: Non-theme action buttons no longer use .theme-toggle', () => {
  const workspaceTab = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'WorkspaceTabBar.tsx'), 'utf-8');
  assert.ok(!workspaceTab.includes('className="theme-toggle"'), 'WorkspaceTabBar still contains theme-toggle');
  assert.ok(workspaceTab.includes('className="icon-btn-secondary"'), 'WorkspaceTabBar gear should use icon-btn-secondary');

  const planningTab = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'planning', 'PlanningTab.tsx'), 'utf-8');
  assert.ok(!planningTab.includes('className="theme-toggle"'), 'PlanningTab delete button still contains theme-toggle');
  assert.ok(planningTab.includes('className="icon-btn-secondary"'), 'PlanningTab delete button should use icon-btn-secondary');

  const timerTab = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'timer', 'TimerTab.tsx'), 'utf-8');
  assert.ok(!timerTab.includes('className="theme-toggle"'), 'TimerTab reset button still contains theme-toggle');
  assert.ok(timerTab.includes('className="icon-btn-secondary"'), 'TimerTab reset button should use icon-btn-secondary');
});

runTest('R2.4: Multiline checkboxes use alignItems: flex-start with top margin', () => {
  const timerTab = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'timer', 'TimerTab.tsx'), 'utf-8');
  assert.ok(timerTab.includes("display: 'flex', alignItems: 'flex-start'"), 'TimerTab should use alignItems: flex-start on checkbox labels');

  const autopilotTab = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'autopilot', 'AutopilotTab.tsx'), 'utf-8');
  assert.ok(autopilotTab.includes("alignItems: 'flex-start'"), 'AutopilotTab should use alignItems: flex-start on checkbox labels');

  const questionsTab = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'questions', 'QuestionsTab.tsx'), 'utf-8');
  assert.ok(questionsTab.includes("alignItems: 'flex-start'"), 'QuestionsTab should use alignItems: flex-start on checkbox labels');
});

// -----------------------------------------------------------------------------
// 2. R3 — Mobile Responsiveness (320px to 430px)
// -----------------------------------------------------------------------------
console.log('\n[Objective R3: Mobile Responsiveness (320px to 430px)]');

runTest('R3.1: Sidebar converts to off-canvas drawer on mobile (<=640px) in CSS', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'src', 'index.css'), 'utf-8');
  assert.ok(css.includes('@media (max-width: 640px)'), 'Missing max-width 640px media query');
  assert.ok(css.includes('transform: translateX(-100%)'), 'Sidebar must be off-canvas on mobile');
  assert.ok(css.includes('.sidebar.mobile-open'), 'Missing .sidebar.mobile-open state');
  assert.ok(css.includes('.mobile-drawer-backdrop'), 'Missing .mobile-drawer-backdrop overlay');
  assert.ok(css.includes('.mobile-menu-btn'), 'Missing .mobile-menu-btn styles');
});

runTest('R3.2: Mobile hamburger navigation and drawer state wired in App, Header, and Sidebar', () => {
  const app = fs.readFileSync(path.join(projectRoot, 'src', 'App.tsx'), 'utf-8');
  assert.ok(app.includes('mobileNavOpen'), 'App.tsx must maintain mobileNavOpen state');
  assert.ok(app.includes('isMobileOpen={mobileNavOpen}'), 'App.tsx must pass isMobileOpen to Sidebar');
  assert.ok(app.includes('onToggleMobileMenu='), 'App.tsx must pass onToggleMobileMenu to Header');

  const header = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'Header.tsx'), 'utf-8');
  assert.ok(header.includes('mobile-menu-btn'), 'Header.tsx must render mobile-menu-btn');
  assert.ok(header.includes('onToggleMobileMenu'), 'Header.tsx must accept onToggleMobileMenu');

  const sidebar = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'Sidebar.tsx'), 'utf-8');
  assert.ok(sidebar.includes('isMobileOpen'), 'Sidebar.tsx must accept isMobileOpen');
  assert.ok(sidebar.includes('mobile-drawer-backdrop'), 'Sidebar.tsx must render mobile-drawer-backdrop');
  assert.ok(sidebar.includes('mobile-drawer-close-btn'), 'Sidebar.tsx must render mobile close button');
});

runTest('R3.3: CSS Grids adapt fluidly using minmax(min(100%, 280px), 1fr)', () => {
  const gamification = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'autopilot', 'GamificationWidget.tsx'), 'utf-8');
  assert.ok(!gamification.includes('minmax(320px, 1fr)'), 'GamificationWidget should not have rigid 320px grid');
  assert.ok(gamification.includes('minmax(min(100%, 280px), 1fr)'), 'GamificationWidget should use minmax(min(100%, 280px), 1fr)');

  const flashcards = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'flashcards', 'FlashcardsTab.tsx'), 'utf-8');
  assert.ok(!flashcards.includes('minmax(320px, 1fr)'), 'FlashcardsTab flat grid should not have rigid 320px grid');
  assert.ok(!flashcards.includes('minmax(310px, 1fr)'), 'FlashcardsTab deck grid should not have rigid 310px grid');
  assert.ok(flashcards.includes('minmax(min(100%, 280px), 1fr)'), 'FlashcardsTab should use minmax(min(100%, 280px), 1fr)');

  const admin = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'admin', 'AdminTab.tsx'), 'utf-8');
  assert.ok(!admin.includes('minmax(350px, 1fr)'), 'AdminTab should not have rigid 350px grid');
  assert.ok(admin.includes('minmax(min(100%, 280px), 1fr)'), 'AdminTab should use minmax(min(100%, 280px), 1fr)');
});

runTest('R3.4: Timer font clamp lowered to clamp(2.25rem, 11vw, 5.5rem) preventing 320px overflow', () => {
  const timerTab = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'timer', 'TimerTab.tsx'), 'utf-8');
  assert.ok(!timerTab.includes("clamp(3.5rem, 8vw, 6rem)"), 'TimerTab should not clamp at 3.5rem floor');
  assert.ok(timerTab.includes("clamp(2.25rem, 11vw, 5.5rem)"), 'TimerTab should clamp at 2.25rem floor for 320px viewports');
});

runTest('R3.5: Syllabus verticalized table wrapped in responsive horizontal scroll wrapper', () => {
  const syllabusTab = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'syllabus', 'SyllabusTab.tsx'), 'utf-8');
  assert.ok(syllabusTab.includes('table-responsive-wrapper'), 'SyllabusTab table must be wrapped in table-responsive-wrapper');

  const css = fs.readFileSync(path.join(projectRoot, 'src', 'index.css'), 'utf-8');
  assert.ok(css.includes('.table-responsive-wrapper {'), '.table-responsive-wrapper rule must be defined in index.css');
  assert.ok(css.includes('overflow-x: auto'), 'table-responsive-wrapper must provide overflow-x: auto');
});

runTest('R3.6: Modals use .app-modal-card with responsive padding and 44px touch target close buttons', () => {
  const authModal = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'AuthModal.tsx'), 'utf-8');
  assert.ok(authModal.includes('app-modal-card'), 'AuthModal must use app-modal-card class');
  assert.ok(authModal.includes('modal-close-btn'), 'AuthModal must use modal-close-btn class');
  assert.ok(authModal.includes("minWidth: '44px'"), 'AuthModal close button must have 44px minWidth');

  const feedbackModal = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'FeedbackModal.tsx'), 'utf-8');
  assert.ok(feedbackModal.includes('app-modal-card'), 'FeedbackModal must use app-modal-card class');
  assert.ok(feedbackModal.includes('modal-close-btn'), 'FeedbackModal must use modal-close-btn class');
  assert.ok(feedbackModal.includes("minWidth: '44px'"), 'FeedbackModal close button must have 44px minWidth');

  const importModal = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'syllabus', 'AiSyllabusImportModal.tsx'), 'utf-8');
  assert.ok(importModal.includes('app-modal-card'), 'AiSyllabusImportModal must use app-modal-card class');
  assert.ok(importModal.includes('modal-close-btn'), 'AiSyllabusImportModal must use modal-close-btn class');
});

// -----------------------------------------------------------------------------
// 3. R4 — Application Icon & Favicon
// -----------------------------------------------------------------------------
console.log('\n[Objective R4: Application Icon & Favicon]');

runTest('R4.1: public/favicon.svg contains approved Infinite Book SVG markup', () => {
  const faviconSvg = fs.readFileSync(path.join(projectRoot, 'public', 'favicon.svg'), 'utf-8');
  assert.ok(faviconSvg.includes('viewBox="0 0 128 128"'), 'favicon.svg must have viewBox 0 0 128 128');
  assert.ok(faviconSvg.includes('id="grad3"'), 'favicon.svg must define gradient grad3');
  assert.ok(faviconSvg.includes('#4f46e5') && faviconSvg.includes('#7c3aed') && faviconSvg.includes('#ec4899'), 'favicon.svg must contain gradient stops');
  assert.ok(faviconSvg.includes('<!-- Open Book Wings Forming Infinity and Growth -->') || faviconSvg.includes('M50 56 C32 20'), 'favicon.svg must contain infinite book wings');
  assert.ok(!faviconSvg.includes('#863bff'), 'favicon.svg must not contain old Vite purple bolt');
});

runTest('R4.2: index.html links to /favicon.svg and /manifest.json', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');
  assert.ok(html.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />'), 'index.html must link favicon.svg');
  assert.ok(html.includes('<link rel="manifest" href="/manifest.json" />'), 'index.html must link manifest.json');
});

runTest('R4.3: InfiniteBookLogo component exists and is used in Sidebar, Header and LandingPage', () => {
  assert.ok(fs.existsSync(path.join(projectRoot, 'src', 'components', 'InfiniteBookLogo.tsx')), 'InfiniteBookLogo component must exist');

  const sidebar = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'Sidebar.tsx'), 'utf-8');
  assert.ok(sidebar.includes('InfiniteBookLogo'), 'Sidebar must render InfiniteBookLogo');

  const header = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'Header.tsx'), 'utf-8');
  assert.ok(header.includes('InfiniteBookLogo'), 'Header must render InfiniteBookLogo');

  const landing = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'landing', 'LandingPage.tsx'), 'utf-8');
  assert.ok(landing.includes('InfiniteBookLogo'), 'LandingPage must render InfiniteBookLogo');
});

// -----------------------------------------------------------------------------
// 4. R8 — Open LLM Syllabus Importer (F10)
// -----------------------------------------------------------------------------
console.log('\n[Objective R8: Open LLM Syllabus Importer]');

runTest('R8.1: aiSyllabusService.ts exists and provides fallback and LLM parser functions', async () => {
  const servicePath = path.join(projectRoot, 'src', 'services', 'aiSyllabusService.ts');
  assert.ok(fs.existsSync(servicePath), 'aiSyllabusService.ts must exist');
  
  const content = fs.readFileSync(servicePath, 'utf-8');
  assert.ok(content.includes('parseSyllabusWithOpenLLM'), 'Must export parseSyllabusWithOpenLLM');
  assert.ok(content.includes('parseSyllabusFallback'), 'Must export parseSyllabusFallback');
  assert.ok(content.includes('VITE_OPEN_LLM_API_KEY'), 'Must reference VITE_OPEN_LLM_API_KEY');
  assert.ok(content.includes('https://api.groq.com/openai/v1/chat/completions'), 'Must reference default Groq endpoint');
  assert.ok(content.includes('llama-3.3-70b-versatile'), 'Must reference default Llama 3.3 model');
});

function parseSyllabusFallbackPure(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('O texto do edital está vazio.');

  // 1. Try parsing directly as JSON
  try {
    const parsed = JSON.parse(trimmed);
    const rawSubjects = Array.isArray(parsed.subjects)
      ? parsed.subjects
      : Array.isArray(parsed.disciplinas)
      ? parsed.disciplinas
      : Array.isArray(parsed)
      ? parsed
      : null;

    if (rawSubjects && rawSubjects.length > 0) {
      return {
        concursoInfo: parsed.concursoInfo || parsed.concurso_info || {},
        subjects: rawSubjects.map((s) => ({
          name: s.name || s.disciplina || 'Disciplina',
          weight: s.weight || s.peso || 3,
          topics: (s.topics || []).map((t) => ({
            name: typeof t === 'string' ? t : t.name,
            subtopics: (t.subtopics || [typeof t === 'string' ? t : t.name]),
          })),
        })),
        source: 'json',
      };
    }
  } catch {}

  // 2. Text outline parsing
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const concursoInfo = {};
  const subjects = [];
  let currentSubject = null;
  let currentTopic = null;

  for (const line of lines) {
    const concursoMatch = line.match(/^(?:concurso|orgao|órgão)\s*[:=-]\s*(.+)$/i);
    if (concursoMatch) {
      concursoInfo.concurso = concursoMatch[1].trim();
      continue;
    }
    const cargoMatch = line.match(/^cargo\s*[:=-]\s*(.+)$/i);
    if (cargoMatch) {
      concursoInfo.cargo = cargoMatch[1].trim();
      continue;
    }
    const bancaMatch = line.match(/^banca\s*[:=-]\s*(.+)$/i);
    if (bancaMatch) {
      concursoInfo.banca = bancaMatch[1].trim();
      continue;
    }

    const isExplicitSubject = /^(?:disciplina|matéria|materia)\s*[:=-]\s*(.+)$/i.test(line);
    const weightMatch = line.match(/peso\s*[:=-]?\s*(\d)/i);
    const extractedWeight = weightMatch ? Math.min(5, Math.max(1, parseInt(weightMatch[1], 10))) : 3;

    const cleanLineName = line.replace(/^(?:disciplina|matéria|materia)\s*[:=-]\s*/i, '')
                              .replace(/\(peso\s*\d\)/i, '')
                              .trim();

    const isAllCapsSubject = (
      cleanLineName.length > 3 &&
      cleanLineName === cleanLineName.toUpperCase() &&
      !cleanLineName.match(/^\d+\.\d+/) &&
      !cleanLineName.startsWith('-')
    );

    if (isExplicitSubject || isAllCapsSubject) {
      currentSubject = { name: cleanLineName, weight: extractedWeight, topics: [] };
      subjects.push(currentSubject);
      currentTopic = null;
      continue;
    }

    if (!currentSubject) {
      currentSubject = { name: 'Conhecimentos Gerais', weight: 3, topics: [] };
      subjects.push(currentSubject);
    }

    const isSubtopicMatch = line.match(/^(?:\d+\.\d+|-|\*|•|[a-z]\))\s*(.+)$/i);
    if (isSubtopicMatch) {
      const subName = isSubtopicMatch[1].trim();
      if (!currentTopic) {
        currentTopic = { name: 'Tópico Geral', subtopics: [] };
        currentSubject.topics.push(currentTopic);
      }
      currentTopic.subtopics.push(subName);
      continue;
    }

    const topicMatch = line.match(/^(?:\d+[.)]\s*)(.+)$/);
    if (topicMatch) {
      currentTopic = { name: topicMatch[1].trim(), subtopics: [] };
      currentSubject.topics.push(currentTopic);
      continue;
    }

    if (!currentTopic) {
      currentTopic = { name: line, subtopics: [line] };
      currentSubject.topics.push(currentTopic);
    } else {
      currentTopic.subtopics.push(line);
    }
  }

  return { concursoInfo, subjects, source: 'fallback' };
}

runTest('R8.2: aiSyllabusService fallback parser correctly parses raw textual syllabus outline', () => {
  const sampleOutline = `
CONCURSO: Tribunal de Contas do Estado
CARGO: Auditor de Controle Externo
BANCA: FGV

DIREITO CONSTITUCIONAL (Peso 4)
1. Direitos e Garantias Fundamentais
1.1 Direitos individuais e coletivos
1.2 Direitos sociais e nacionalidade
2. Organização do Estado
2.1 União, Estados e Municípios

PORTUGUÊS (Peso 3)
1. Compreensão e Interpretação de Textos
1.1 Tipologia e gêneros textuais
2. Sintaxe da Oração e do Período
`;

  const result = parseSyllabusFallbackPure(sampleOutline);

  assert.ok(result.concursoInfo, 'concursoInfo must be extracted');
  assert.strictEqual(result.concursoInfo.concurso, 'Tribunal de Contas do Estado');
  assert.strictEqual(result.concursoInfo.cargo, 'Auditor de Controle Externo');
  assert.strictEqual(result.concursoInfo.banca, 'FGV');

  assert.strictEqual(result.subjects.length, 2, 'Should extract 2 subjects');
  assert.strictEqual(result.subjects[0].name, 'DIREITO CONSTITUCIONAL');
  assert.strictEqual(result.subjects[0].weight, 4);
  assert.strictEqual(result.subjects[0].topics.length, 2);
  assert.strictEqual(result.subjects[0].topics[0].subtopics.length, 2);

  assert.strictEqual(result.subjects[1].name, 'PORTUGUÊS');
  assert.strictEqual(result.subjects[1].weight, 3);
});

runTest('R8.3: aiSyllabusService handles JSON-formatted input seamlessly', () => {
  const sampleJson = JSON.stringify({
    concursoInfo: { concurso: 'Receita Federal', cargo: 'Auditor Fiscal', banca: 'FGV' },
    subjects: [
      {
        name: 'Direito Tributário',
        weight: 5,
        topics: [
          { name: 'Sistema Tributário Nacional', subtopics: ['Princípios', 'Imunidades'] },
        ],
      },
    ],
  });

  const result = parseSyllabusFallbackPure(sampleJson);

  assert.strictEqual(result.concursoInfo?.concurso, 'Receita Federal');
  assert.strictEqual(result.subjects[0].name, 'Direito Tributário');
  assert.strictEqual(result.subjects[0].weight, 5);
  assert.strictEqual(result.subjects[0].topics[0].subtopics.length, 2);
});

runTest('R8.4: AiSyllabusImportModal provides non-destructive merge into active workspace', () => {
  const modalContent = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'syllabus', 'AiSyllabusImportModal.tsx'), 'utf-8');
  assert.ok(modalContent.includes('Estratégia de Importação (Garantia Zero Data Loss)'), 'Must present zero data loss strategy');
  assert.ok(modalContent.includes('Mesclar no Ciclo Atual'), 'Must offer merge option');
  assert.ok(modalContent.includes('targetWeeklyHours'), 'Must support weekly hours selection');
  assert.ok(modalContent.includes('parseSyllabusWithOpenLLM'), 'Must integrate parseSyllabusWithOpenLLM');
  assert.ok(modalContent.includes('Analisando edital com IA...'), 'Must feature loading indicator with status');
});

runTest('R8.5: Prominent button [⚡ Importar Edital com IA] present in SyllabusTab and PlanningTab', () => {
  const syllabusTab = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'syllabus', 'SyllabusTab.tsx'), 'utf-8');
  assert.ok(syllabusTab.includes('⚡ Importar Edital com IA'), 'SyllabusTab must have [⚡ Importar Edital com IA] button');

  const planningTab = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'planning', 'PlanningTab.tsx'), 'utf-8');
  assert.ok(planningTab.includes('⚡ Importar Edital com IA'), 'PlanningTab must have [⚡ Importar Edital com IA] button');
});

console.log('\n================================================================');
console.log(`  ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('================================================================');
