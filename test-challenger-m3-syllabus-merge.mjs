/**
 * Challenger M3-2 Empirical Test: Syllabus Import Non-Destructive Merge
 * 
 * Objective:
 * Simulate importing an edital with 5 subjects into a workspace already having 3 subjects
 * with completed subtopics.
 * 
 * Strict Acceptance Criteria:
 * 1. 100% of all existing completed checks retained across all 3 subjects.
 * 2. 100% of all existing acertos and erros retained with exact numbers.
 * 3. 100% of existing completedAt dates and notes retained.
 * 4. Existing topics/subtopics NOT in the incoming edital are 100% retained.
 * 5. Incoming new subtopics and topics are cleanly merged.
 * 6. Completely new subjects are appended without disturbing existing subjects.
 * 7. Pre-existing study sessions, questions, and flashcards remain 100% intact.
 * 8. Second identical import is strictly idempotent (no duplicates).
 */

import assert from 'node:assert/strict';

console.log('================================================================');
console.log('  CHALLENGER M3-2: SYLLABUS NON-DESTRUCTIVE MERGE HARNESS');
console.log('================================================================\n');

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

// In-Memory Database / LocalStorage Mock
class MockDatabase {
  constructor() {
    this.storage = new Map();
  }

  getItem(key) {
    return this.storage.get(key) || null;
  }

  setItem(key, value) {
    this.storage.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  getSubjects(wsId) {
    const raw = this.getItem(`concurso_estudos_subjects_${wsId}`);
    return raw ? JSON.parse(raw) : [];
  }

  saveSubjects(wsId, subjects) {
    this.setItem(`concurso_estudos_subjects_${wsId}`, JSON.stringify(subjects));
  }

  getSessions(wsId) {
    const raw = this.getItem('concurso_estudos_sessions');
    const all = raw ? JSON.parse(raw) : [];
    return all.filter((s) => s.workspaceId === wsId);
  }

  saveSession(wsId, session) {
    const raw = this.getItem('concurso_estudos_sessions');
    const all = raw ? JSON.parse(raw) : [];
    all.push({ ...session, workspaceId: wsId });
    this.setItem('concurso_estudos_sessions', JSON.stringify(all));
  }

  getQuestions(wsId) {
    const raw = this.getItem('concurso_estudos_questions');
    const all = raw ? JSON.parse(raw) : [];
    return all.filter((q) => q.workspaceId === wsId);
  }

  saveQuestion(wsId, q) {
    const raw = this.getItem('concurso_estudos_questions');
    const all = raw ? JSON.parse(raw) : [];
    all.push({ ...q, workspaceId: wsId });
    this.setItem('concurso_estudos_questions', JSON.stringify(all));
  }

  getFlashcards(wsId) {
    const raw = this.getItem(`concurso_estudos_flashcards_${wsId}`);
    return raw ? JSON.parse(raw) : [];
  }

  saveFlashcards(wsId, cards) {
    this.setItem(`concurso_estudos_flashcards_${wsId}`, JSON.stringify(cards));
  }
}

// Pure function replicating the exact non-destructive merge algorithm of AiSyllabusImportModal.tsx
function executeSyllabusMerge(db, targetWsId, parsedSubjects) {
  const timestamp = 1700000000000;

  // Format incoming subjects
  const incomingFormatted = parsedSubjects.map((s, sIdx) => {
    const subId = `sub-${timestamp}-${sIdx + 1}`;
    const subName = String(s.name || s.disciplina || s.materia || s.titulo || `Disciplina ${sIdx + 1}`).trim();
    const rawWeight = s.weight ?? s.peso;
    const weight = typeof rawWeight === 'number' && rawWeight >= 1 && rawWeight <= 5 ? rawWeight : 3;
    const status = s.status === 'backlog' || s.status === 'maintenance' ? s.status : 'active';

    const rawTopics = Array.isArray(s.topics)
      ? s.topics
      : Array.isArray(s.topicos)
      ? s.topicos
      : Array.isArray(s.conteudo)
      ? s.conteudo
      : [];

    const formattedTopics = rawTopics.map((t, tIdx) => {
      const topId = `top-${timestamp}-${sIdx + 1}-${tIdx + 1}`;
      const isTopicString = typeof t === 'string';
      const topName = String(isTopicString ? t : (t.name || t.topico || t.titulo || t.nome || `Tópico ${tIdx + 1}`)).trim();

      const rawSubtopics = !isTopicString && Array.isArray(t.subtopics)
        ? t.subtopics
        : !isTopicString && Array.isArray(t.subtopicos)
        ? t.subtopicos
        : !isTopicString && Array.isArray(t.itens)
        ? t.itens
        : [];

      const formattedSubtopics = rawSubtopics.map((st, stIdx) => {
        const stId = `st-${timestamp}-${sIdx + 1}-${tIdx + 1}-${stIdx + 1}`;
        const isSubString = typeof st === 'string';
        const stName = String(isSubString ? st : (st.name || st.subtopico || st.item || st.titulo || st.nome || `Item ${stIdx + 1}`)).trim();
        return {
          id: stId,
          name: stName,
          completed: false,
        };
      });

      if (formattedSubtopics.length === 0) {
        formattedSubtopics.push({
          id: `st-${timestamp}-${sIdx + 1}-${tIdx + 1}-1`,
          name: topName,
          completed: false,
        });
      }

      return {
        id: topId,
        name: topName,
        subtopics: formattedSubtopics,
      };
    });

    if (formattedTopics.length === 0) {
      formattedTopics.push({
        id: `top-${timestamp}-${sIdx + 1}-1`,
        name: subName,
        subtopics: [{ id: `st-${timestamp}-${sIdx + 1}-1-1`, name: subName, completed: false }],
      });
    }

    return {
      id: subId,
      name: subName,
      weight,
      targetHours: 0,
      status,
      topics: formattedTopics,
    };
  });

  // NON-DESTRUCTIVE MERGE LOGIC (verbatim from AiSyllabusImportModal.tsx lines 269-308)
  const existingSubjects = db.getSubjects(targetWsId);
  const finalSubjects = [...existingSubjects];

  for (const incSub of incomingFormatted) {
    const existingMatch = finalSubjects.find(
      (s) => s.name.trim().toLowerCase() === incSub.name.trim().toLowerCase()
    );

    if (!existingMatch) {
      finalSubjects.push(incSub);
    } else {
      // Merge topics and subtopics non-destructively
      const mergedTopics = [...existingMatch.topics];
      for (const incTop of incSub.topics) {
        const existingTop = mergedTopics.find(
          (t) => t.name.trim().toLowerCase() === incTop.name.trim().toLowerCase()
        );
        if (!existingTop) {
          mergedTopics.push(incTop);
        } else {
          // Merge subtopics
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

  db.saveSubjects(targetWsId, finalSubjects);
  return finalSubjects;
}

// -----------------------------------------------------------------------------
// SETUP INITIAL WORKSPACE WITH 3 SUBJECTS & COMPLETED PROGRESS
// -----------------------------------------------------------------------------
const wsId = 'workspace-adversarial-audit';
const db = new MockDatabase();

const initialSubjects = [
  {
    id: 'sub-const',
    name: 'Direito Constitucional',
    weight: 4,
    targetHours: 8,
    status: 'active',
    topics: [
      {
        id: 'top-const-1',
        name: 'Direitos Fundamentais',
        subtopics: [
          {
            id: 'st-const-1-1',
            name: 'Art. 5º - Direitos Individuais e Coletivos',
            completed: true,
            completedAt: '2026-11-01T14:30:00Z',
            acertos: 42,
            erros: 8,
            notes: 'Focar em remédios constitucionais na revisão',
          },
          {
            id: 'st-const-1-2',
            name: 'Remédios Constitucionais',
            completed: false,
            acertos: 15,
            erros: 5,
          },
        ],
      },
      {
        id: 'top-const-2',
        name: 'Organização do Estado',
        subtopics: [
          {
            id: 'st-const-2-1',
            name: 'Competências Privativas da União',
            completed: true,
            completedAt: '2026-11-02T10:15:00Z',
            acertos: 30,
            erros: 2,
          },
        ],
      },
    ],
  },
  {
    id: 'sub-admin',
    name: 'Direito Administrativo',
    weight: 3,
    targetHours: 6,
    status: 'active',
    topics: [
      {
        id: 'top-admin-1',
        name: 'Atos Administrativos',
        subtopics: [
          {
            id: 'st-admin-1-1',
            name: 'Requisitos e Atributos do Ato',
            completed: true,
            completedAt: '2026-11-03T16:00:00Z',
            acertos: 38,
            erros: 4,
          },
        ],
      },
    ],
  },
  {
    id: 'sub-port',
    name: 'Língua Portuguesa',
    weight: 5,
    targetHours: 10,
    status: 'active',
    topics: [
      {
        id: 'top-port-1',
        name: 'Interpretação e Compreensão de Texto',
        subtopics: [
          {
            id: 'st-port-1-1',
            name: 'Tipologia Textual e Coesão',
            completed: true,
            completedAt: '2026-11-04T11:45:00Z',
            acertos: 60,
            erros: 3,
          },
        ],
      },
      {
        id: 'top-port-2',
        name: 'Sintaxe da Oração e do Período',
        subtopics: [
          {
            id: 'st-port-2-1',
            name: 'Concordância Verbal e Nominal',
            completed: true,
            completedAt: '2026-11-05T09:30:00Z',
            acertos: 45,
            erros: 7,
          },
        ],
      },
    ],
  },
];

db.saveSubjects(wsId, initialSubjects);

// Populate historical sessions, questions, flashcards
for (let i = 1; i <= 5; i++) {
  db.saveSession(wsId, {
    id: `sess-${i}`,
    subjectId: 'sub-const',
    subjectName: 'Direito Constitucional',
    topicName: 'Direitos Fundamentais',
    durationSeconds: 1800,
    date: '2026-11-01T15:00:00Z',
  });
}
for (let i = 1; i <= 10; i++) {
  db.saveQuestion(wsId, {
    id: `q-${i}`,
    subjectId: 'sub-admin',
    subjectName: 'Direito Administrativo',
    topicName: 'Atos Administrativos',
    isCorrect: i % 2 === 0,
    date: '2026-11-03T17:00:00Z',
  });
}
db.saveFlashcards(wsId, [
  { id: 'fc-1', front: 'Conceito de Ato', back: 'Manifestação unilateral de vontade', interval: 6, repetitions: 2 },
  { id: 'fc-2', front: 'Autoexecutoriedade', back: 'Execução direta sem ordem judicial', interval: 15, repetitions: 3 },
]);

// -----------------------------------------------------------------------------
// INCOMING EDITAL WITH 5 SUBJECTS (3 Overlapping + 2 Brand New)
// -----------------------------------------------------------------------------
const incoming5Subjects = [
  {
    name: '  DIREITO CONSTITUCIONAL  ', // Case and whitespace variation
    weight: 4,
    topics: [
      {
        name: 'Direitos Fundamentais', // Exact topic match
        subtopics: [
          // Overlapping subtopic - incoming has completed: false
          { name: 'Art. 5º - Direitos Individuais e Coletivos' },
          // Brand new subtopic in existing topic
          { name: 'Direitos Sociais (Art. 6º ao 11)' },
        ],
      },
      {
        // Brand new topic in existing subject
        name: 'Poder Executivo',
        subtopics: [
          { name: 'Atribuições e Responsabilidade do Presidente' },
        ],
      },
    ],
  },
  {
    name: 'Direito Administrativo', // Exact subject match
    weight: 3,
    topics: [
      {
        name: 'Atos Administrativos', // Exact topic match
        subtopics: [
          // Overlapping subtopic
          { name: 'Requisitos e Atributos do Ato' },
          // Brand new subtopic
          { name: 'Extinção e Revogação dos Atos' },
        ],
      },
    ],
  },
  {
    name: 'Língua Portuguesa', // Exact subject match
    weight: 5,
    topics: [
      {
        name: 'Interpretação e Compreensão de Texto', // Exact topic match
        subtopics: [
          // Overlapping subtopic
          { name: 'Tipologia Textual e Coesão' },
        ],
      },
      {
        // Brand new topic
        name: 'Pontuação',
        subtopics: [
          { name: 'Emprego da Vírgula e Ponto e Vírgula' },
        ],
      },
    ],
  },
  {
    // Completely new subject 4
    name: 'Raciocínio Lógico-Matemático',
    weight: 3,
    topics: [
      {
        name: 'Lógica Proposicional',
        subtopics: [
          { name: 'Tabelas Verdade e Conectivos' },
          { name: 'Equivalências Lógicas' },
        ],
      },
    ],
  },
  {
    // Completely new subject 5
    name: 'Direito Tributário',
    weight: 3,
    topics: [
      {
        name: 'Sistema Tributário Nacional',
        subtopics: [
          { name: 'Princípios Constitucionais Tributários' },
          { name: 'Imunidades Tributárias' },
        ],
      },
    ],
  },
];

// -----------------------------------------------------------------------------
// EXECUTE MERGE
// -----------------------------------------------------------------------------
console.log('[Executing Non-Destructive Merge: 5 Subjects into 3 Existing Subjects]');
const merged = executeSyllabusMerge(db, wsId, incoming5Subjects);

// -----------------------------------------------------------------------------
// ASSERTIONS
// -----------------------------------------------------------------------------
console.log('\n[Phase 1: Subject Count & Identity Integrity]');

runTest('Merge retains existing subjects and appends new ones (total 5 subjects)', () => {
  assert.strictEqual(merged.length, 5, `Expected 5 subjects, got ${merged.length}`);
  const names = merged.map((s) => s.name.trim().toLowerCase());
  assert.ok(names.includes('direito constitucional'));
  assert.ok(names.includes('direito administrativo'));
  assert.ok(names.includes('língua portuguesa'));
  assert.ok(names.includes('raciocínio lógico-matemático'));
  assert.ok(names.includes('direito tributário'));
});

runTest('Existing subjects preserve their original IDs, weights, and statuses', () => {
  const constSub = merged.find((s) => s.name.trim().toLowerCase() === 'direito constitucional');
  assert.strictEqual(constSub.id, 'sub-const');
  assert.strictEqual(constSub.weight, 4);
  assert.strictEqual(constSub.status, 'active');

  const adminSub = merged.find((s) => s.name.trim().toLowerCase() === 'direito administrativo');
  assert.strictEqual(adminSub.id, 'sub-admin');
  assert.strictEqual(adminSub.weight, 3);

  const portSub = merged.find((s) => s.name.trim().toLowerCase() === 'língua portuguesa');
  assert.strictEqual(portSub.id, 'sub-port');
  assert.strictEqual(portSub.weight, 5);
});

console.log('\n[Phase 2: 100% Data Preservation of Completed Checks, Acertos, and Erros]');

runTest('Direito Constitucional retains 100% of completed checks, acertos, and erros', () => {
  const constSub = merged.find((s) => s.name.trim().toLowerCase() === 'direito constitucional');
  
  // Topic 1
  const t1 = constSub.topics.find((t) => t.name.trim().toLowerCase() === 'direitos fundamentais');
  assert.ok(t1, 'Topic "Direitos Fundamentais" must exist');

  // Subtopic 1.1: Art. 5º
  const st1 = t1.subtopics.find((st) => st.name.includes('Art. 5º'));
  assert.ok(st1, 'Subtopic "Art. 5º" must exist');
  assert.strictEqual(st1.id, 'st-const-1-1', 'Must retain original ID');
  assert.strictEqual(st1.completed, true, 'CRITICAL: completed must remain TRUE (zero data loss)');
  assert.strictEqual(st1.completedAt, '2026-11-01T14:30:00Z', 'completedAt timestamp must be preserved');
  assert.strictEqual(st1.acertos, 42, 'CRITICAL: acertos must strictly remain 42');
  assert.strictEqual(st1.erros, 8, 'CRITICAL: erros must strictly remain 8');
  assert.strictEqual(st1.notes, 'Focar em remédios constitucionais na revisão', 'notes must be preserved');

  // Subtopic 1.2: Remédios
  const st2 = t1.subtopics.find((st) => st.name.includes('Remédios'));
  assert.ok(st2, 'Subtopic "Remédios" must exist');
  assert.strictEqual(st2.completed, false);
  assert.strictEqual(st2.acertos, 15);
  assert.strictEqual(st2.erros, 5);

  // Topic 2: Organização do Estado (was NOT in incoming edital, MUST be preserved!)
  const t2 = constSub.topics.find((t) => t.name.trim().toLowerCase() === 'organização do estado');
  assert.ok(t2, 'Topic "Organização do Estado" must NOT be dropped');
  const st21 = t2.subtopics.find((st) => st.name.includes('Competências Privativas'));
  assert.ok(st21, 'Subtopic "Competências Privativas" must exist');
  assert.strictEqual(st21.completed, true);
  assert.strictEqual(st21.acertos, 30);
  assert.strictEqual(st21.erros, 2);
});

runTest('Direito Administrativo retains 100% of completed checks, acertos, and erros', () => {
  const adminSub = merged.find((s) => s.name.trim().toLowerCase() === 'direito administrativo');
  const t1 = adminSub.topics.find((t) => t.name.trim().toLowerCase() === 'atos administrativos');
  assert.ok(t1, 'Topic "Atos Administrativos" must exist');

  const st1 = t1.subtopics.find((st) => st.name.includes('Requisitos e Atributos'));
  assert.ok(st1, 'Subtopic "Requisitos e Atributos" must exist');
  assert.strictEqual(st1.id, 'st-admin-1-1');
  assert.strictEqual(st1.completed, true, 'CRITICAL: completed must remain TRUE');
  assert.strictEqual(st1.acertos, 38, 'CRITICAL: acertos must strictly remain 38');
  assert.strictEqual(st1.erros, 4, 'CRITICAL: erros must strictly remain 4');
  assert.strictEqual(st1.completedAt, '2026-11-03T16:00:00Z');
});

runTest('Língua Portuguesa retains 100% of completed checks, acertos, and erros across all topics', () => {
  const portSub = merged.find((s) => s.name.trim().toLowerCase() === 'língua portuguesa');
  
  // Topic 1
  const t1 = portSub.topics.find((t) => t.name.trim().toLowerCase() === 'interpretação e compreensão de texto');
  assert.ok(t1);
  const st1 = t1.subtopics.find((st) => st.name.includes('Tipologia Textual'));
  assert.ok(st1);
  assert.strictEqual(st1.completed, true, 'CRITICAL: completed must remain TRUE');
  assert.strictEqual(st1.acertos, 60, 'CRITICAL: acertos must strictly remain 60');
  assert.strictEqual(st1.erros, 3, 'CRITICAL: erros must strictly remain 3');

  // Topic 2: Sintaxe (NOT in incoming edital, MUST be preserved!)
  const t2 = portSub.topics.find((t) => t.name.trim().toLowerCase() === 'sintaxe da oração e do período');
  assert.ok(t2, 'Topic "Sintaxe" must NOT be dropped');
  const st2 = t2.subtopics.find((st) => st.name.includes('Concordância Verbal'));
  assert.ok(st2);
  assert.strictEqual(st2.completed, true, 'CRITICAL: completed must remain TRUE');
  assert.strictEqual(st2.acertos, 45, 'CRITICAL: acertos must strictly remain 45');
  assert.strictEqual(st2.erros, 7, 'CRITICAL: erros must strictly remain 7');
});

console.log('\n[Phase 3: New Topics & Subtopics Merging]');

runTest('New subtopics and topics are cleanly merged into existing subjects', () => {
  const constSub = merged.find((s) => s.name.trim().toLowerCase() === 'direito constitucional');
  const t1 = constSub.topics.find((t) => t.name.trim().toLowerCase() === 'direitos fundamentais');
  
  // New subtopic added
  const newSt = t1.subtopics.find((st) => st.name.includes('Direitos Sociais'));
  assert.ok(newSt, 'New subtopic "Direitos Sociais" must be added');
  assert.strictEqual(newSt.completed, false, 'New subtopic should default to incomplete');

  // New topic added
  const newTopic = constSub.topics.find((t) => t.name.trim().toLowerCase() === 'poder executivo');
  assert.ok(newTopic, 'New topic "Poder Executivo" must be added');
  assert.ok(newTopic.subtopics.some((st) => st.name.includes('Presidente')));

  // Direito Administrativo new subtopic
  const adminSub = merged.find((s) => s.name.trim().toLowerCase() === 'direito administrativo');
  const adminT1 = adminSub.topics.find((t) => t.name.trim().toLowerCase() === 'atos administrativos');
  assert.ok(adminT1.subtopics.some((st) => st.name.includes('Extinção e Revogação')));

  // Língua Portuguesa new topic
  const portSub = merged.find((s) => s.name.trim().toLowerCase() === 'língua portuguesa');
  assert.ok(portSub.topics.some((t) => t.name.trim().toLowerCase() === 'pontuação'));
});

runTest('Completely new subjects (RLM and Direito Tributário) are fully populated', () => {
  const rlmSub = merged.find((s) => s.name.trim().toLowerCase() === 'raciocínio lógico-matemático');
  assert.ok(rlmSub, 'RLM must exist');
  assert.strictEqual(rlmSub.topics.length, 1);
  assert.strictEqual(rlmSub.topics[0].subtopics.length, 2);

  const tribSub = merged.find((s) => s.name.trim().toLowerCase() === 'direito tributário');
  assert.ok(tribSub, 'Direito Tributário must exist');
  assert.strictEqual(tribSub.topics.length, 1);
  assert.strictEqual(tribSub.topics[0].subtopics.length, 2);
});

console.log('\n[Phase 4: Non-Subject Persistent Data Integrity]');

runTest('Pre-existing study sessions remain 100% intact', () => {
  const sessions = db.getSessions(wsId);
  assert.strictEqual(sessions.length, 5, 'All 5 pre-existing sessions must remain intact');
});

runTest('Pre-existing question logs remain 100% intact', () => {
  const questions = db.getQuestions(wsId);
  assert.strictEqual(questions.length, 10, 'All 10 pre-existing question logs must remain intact');
});

runTest('Pre-existing flashcards remain 100% intact', () => {
  const flashcards = db.getFlashcards(wsId);
  assert.strictEqual(flashcards.length, 2, 'All 2 pre-existing flashcards must remain intact');
  assert.strictEqual(flashcards[0].interval, 6);
  assert.strictEqual(flashcards[1].interval, 15);
});

console.log('\n[Phase 5: Idempotency Verification]');

runTest('Executing the exact same import a second time produces identical output (idempotent)', () => {
  const secondMerge = executeSyllabusMerge(db, wsId, incoming5Subjects);
  assert.strictEqual(secondMerge.length, 5, 'Subject count must remain 5');

  const constSub = secondMerge.find((s) => s.name.trim().toLowerCase() === 'direito constitucional');
  const t1 = constSub.topics.find((t) => t.name.trim().toLowerCase() === 'direitos fundamentais');
  
  // Assert subtopics were NOT duplicated
  const art5Count = t1.subtopics.filter((st) => st.name.includes('Art. 5º')).length;
  assert.strictEqual(art5Count, 1, 'Art. 5º must not be duplicated');

  const socCount = t1.subtopics.filter((st) => st.name.includes('Direitos Sociais')).length;
  assert.strictEqual(socCount, 1, 'Direitos Sociais must not be duplicated');

  // Verify completion and scores STILL 100% retained after second import
  const st1 = t1.subtopics.find((st) => st.name.includes('Art. 5º'));
  assert.strictEqual(st1.completed, true);
  assert.strictEqual(st1.acertos, 42);
  assert.strictEqual(st1.erros, 8);
});

console.log('================================================================');
console.log(`  ALL ${passedTests} / ${totalTests} SYLLABUS MERGE STRESS TESTS PASSED!`);
console.log('================================================================\n');
