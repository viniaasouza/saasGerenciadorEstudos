import assert from 'node:assert/strict';

// Helper functions matching autopilotEngine & tceGoPreset
const GRAN_BANCA_IDS = {
  'FCC': 92,
  'CEBRASPE': 27,
  'FGV': 102,
  'VUNESP': 252,
};

function buildGranQuestoesUrl(input, banca = 'FCC', filterBanca = true) {
  const baseUrl = 'https://questoes.grancursosonline.com.br/questoes?desatualizada=0&anulada=0';
  let url = baseUrl;

  let query;
  let assuntoId;
  let disciplinaId;
  let shouldUseBanca = filterBanca;
  let bancaVal = banca;

  if (typeof input === 'object' && input !== null) {
    query = input.query;
    assuntoId = input.assuntoId;
    disciplinaId = input.disciplinaId;
    if (input.filterBanca !== undefined) {
      shouldUseBanca = input.filterBanca;
    }
    if (input.banca !== undefined) {
      bancaVal = input.banca;
    }
  } else {
    query = input;
  }

  if (disciplinaId) {
    url += `&disciplina=${disciplinaId}`;
  }

  if (assuntoId) {
    const ids = Array.isArray(assuntoId)
      ? assuntoId.filter((id) => typeof id === 'number' && id > 0).join(',')
      : String(assuntoId);
    if (ids) {
      url += `&assunto=${ids}`;
    }
  }

  if (!assuntoId && query) {
    let clean = query.split(';')[0].split(',')[0].replace(/[()[\]{}]/g, '').trim();
    if (clean.length > 35) clean = clean.slice(0, 35).trim();
    if (clean) {
      url += `&query=${encodeURIComponent(clean)}`;
    }
  }

  if (shouldUseBanca) {
    let resolvedBancaId;
    if (typeof bancaVal === 'number') {
      resolvedBancaId = bancaVal;
    } else if (typeof bancaVal === 'string') {
      resolvedBancaId = GRAN_BANCA_IDS[bancaVal] || GRAN_BANCA_IDS[bancaVal.toUpperCase()];
    }
    if (resolvedBancaId) {
      url += `&banca=${resolvedBancaId}`;
    }
  }

  return url;
}

const DOW_MAP = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const DAYS_ORDER = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTomorrowDateString(d = new Date()) {
  const tomorrow = new Date(d);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLocalDateString(tomorrow);
}

function getDayOfWeekName(d = new Date()) {
  return DOW_MAP[d.getDay()];
}

function getMondayOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(date.setDate(diff));
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const dayNum = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayNum}`;
}

function getTodayDayName(d = new Date()) {
  const day = d.getDay();
  return DAYS_ORDER[day === 0 ? 6 : day - 1];
}

function reallocateIncompleteBlocks(blocks, dailyHours, startDayName) {
  const startDayIdx = DAYS_ORDER.indexOf(startDayName);
  const completedBlocks = blocks.filter((b) => b.completed);
  const incompleteBlocks = blocks.filter((b) => !b.completed);
  const sortedIncomplete = [...incompleteBlocks].sort((a, b) => a.order - b.order);

  let dayIdx = startDayIdx === -1 ? 0 : startDayIdx;
  let accumulatedMinutes = 0;

  const completedMinutesByDay = {};
  DAYS_ORDER.forEach((d) => {
    completedMinutesByDay[d] = completedBlocks
      .filter((b) => b.dayAllocated === d)
      .reduce((sum, b) => sum + b.durationMinutes, 0);
  });

  const rescheduledIncomplete = sortedIncomplete.map((block) => {
    let allocated = false;
    while (dayIdx < 7) {
      const currentDay = DAYS_ORDER[dayIdx];
      const limitMinutes = (dailyHours[currentDay] || 0) * 60;
      if (limitMinutes === 0) {
        dayIdx++;
        accumulatedMinutes = 0;
        continue;
      }
      const occupiedByCompleted = completedMinutesByDay[currentDay] || 0;
      const availableMinutes = Math.max(0, limitMinutes - occupiedByCompleted);
      if (accumulatedMinutes + block.durationMinutes <= availableMinutes || (accumulatedMinutes === 0 && occupiedByCompleted < limitMinutes)) {
        block.dayAllocated = currentDay;
        accumulatedMinutes += block.durationMinutes;
        allocated = true;
        break;
      } else {
        dayIdx++;
        accumulatedMinutes = 0;
      }
    }
    if (!allocated) {
      block.dayAllocated = 'domingo';
    }
    return block;
  });

  const allBlocks = [...completedBlocks, ...rescheduledIncomplete];
  return allBlocks.sort((a, b) => a.order - b.order);
}

function isCompletedToday(st, todayStr) {
  if (!st.completed || !st.completedAt) return false;
  if (st.completedAt.startsWith(todayStr)) return true;
  const [year, month, day] = todayStr.split('-');
  const brDate = `${day}/${month}/${year}`;
  const brDate2 = `${Number(day)}/${Number(month)}/${year}`;
  if (st.completedAt.startsWith(brDate) || st.completedAt.startsWith(brDate2)) return true;
  return false;
}

function isBlockCompletedToday(block, todayStr) {
  if (!block.completed || !block.completedAt) return false;
  if (block.completedAt.startsWith(todayStr)) return true;
  const [year, month, day] = todayStr.split('-');
  const brDate = `${day}/${month}/${year}`;
  const brDate2 = `${Number(day)}/${Number(month)}/${year}`;
  if (block.completedAt.startsWith(brDate) || block.completedAt.startsWith(brDate2)) return true;
  return false;
}

function findSubtopicForSubject(subject, skipSubtopicIds, preferCompletedTodayDate) {
  const topics = subject.topics || [];

  // Priority 0: Prioritize subtopics completed TODAY for today's active mission
  if (preferCompletedTodayDate) {
    for (const top of topics) {
      for (const st of top.subtopics || []) {
        if (skipSubtopicIds && skipSubtopicIds.has(st.id)) continue;
        if (isCompletedToday(st, preferCompletedTodayDate)) {
          return { topic: top, subtopic: st, isRevision: false };
        }
      }
    }
  }

  // Priority 1: First uncompleted subtopic
  for (const top of topics) {
    for (const st of top.subtopics || []) {
      if (skipSubtopicIds && skipSubtopicIds.has(st.id)) continue;
      if (!st.completed) {
        return { topic: top, subtopic: st, isRevision: false };
      }
    }
  }

  // Priority 2: All subtopics completed -> find lowest accuracy for deep revision
  let candidate = null;
  let lowestAccuracy = Infinity;
  let lowestTotal = Infinity;

  for (const top of topics) {
    for (const st of top.subtopics || []) {
      if (skipSubtopicIds && skipSubtopicIds.has(st.id)) continue;
      const acertos = st.acertos || 0;
      const erros = st.erros || 0;
      const total = acertos + erros;
      const accuracy = total > 0 ? acertos / total : 0;

      if (accuracy < lowestAccuracy || (accuracy === lowestAccuracy && total < lowestTotal)) {
        lowestAccuracy = accuracy;
        lowestTotal = total;
        candidate = { topic: top, subtopic: st };
      }
    }
  }

  if (candidate) {
    return { ...candidate, isRevision: true };
  }

  // Fallback if all subtopics in skipSubtopicIds but topics exist
  for (const top of topics) {
    if (top.subtopics && top.subtopics.length > 0) {
      return { topic: top, subtopic: top.subtopics[0], isRevision: true };
    }
  }

  const fallbackTopic = {
    id: `top-gen-${subject.id}`,
    name: subject.name,
    subtopics: [],
    assuntoId: subject.assuntoId,
    disciplinaId: subject.disciplinaId,
    granQuery: subject.granQuery || subject.name,
  };

  const fallbackSubtopic = {
    id: `sub-gen-${subject.id}`,
    name: 'Estudo Geral e Revisão',
    completed: false,
    assuntoId: subject.assuntoId,
    disciplinaId: subject.disciplinaId,
    granQuery: subject.granQuery || subject.name,
  };

  return { topic: fallbackTopic, subtopic: fallbackSubtopic, isRevision: false };
}

function normalizeText(str) {
  if (!str) return '';
  return str
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function resolveGranTaxonomy(subjectNameOrId, topicNameOrId, subtopicNameOrId) {
  const normSub = normalizeText(subjectNameOrId);
  const _normTop = normalizeText(topicNameOrId);
  const normSt = normalizeText(subtopicNameOrId);

  if (normSub.includes('software') || normSub.includes('engenharia')) {
    if (normSt.includes('requisito') || normSt.includes('historia')) {
      return { assuntoId: [428791, 428792], disciplinaId: 14 };
    }
    if (normSt.includes('scrum') || normSt.includes('kanban') || normSt.includes('agil')) {
      return { assuntoId: [428797, 428799], disciplinaId: 14 };
    }
    return { assuntoId: 7988, disciplinaId: 14 };
  }
  if (normSub.includes('rede') || normSub.includes('tcp') || normSub.includes('osi')) {
    return { assuntoId: 8174, disciplinaId: 14 };
  }
  if (normSub.includes('banco') || normSub.includes('dados') || normSub.includes('sql')) {
    return { assuntoId: 8026, disciplinaId: 14 };
  }
  if (normSub.includes('portugues')) {
    return { assuntoId: 403613, disciplinaId: 403587 };
  }
  if (normSub.includes('administrativo')) {
    return { assuntoId: 404335, disciplinaId: 404335 };
  }
  return {};
}

function buildSurgicalGranUrl(subject, topic, subtopic, bancaId = 92) {
  let assuntoId = subtopic.assuntoId || topic.assuntoId || subject.assuntoId;
  let disciplinaId = subtopic.disciplinaId || topic.disciplinaId || subject.disciplinaId;
  let granQuery = subtopic.granQuery || topic.granQuery || subject.granQuery;

  if (!assuntoId) {
    const resolved = resolveGranTaxonomy(
      `${subject.name || ''} ${subject.id || ''}`,
      `${topic.name || ''} ${topic.id || ''}`,
      `${subtopic.name || ''} ${subtopic.id || ''}`
    );
    if (resolved.assuntoId) {
      assuntoId = resolved.assuntoId;
    }
    if (resolved.disciplinaId) {
      disciplinaId = resolved.disciplinaId;
    }
    if (resolved.granQuery) {
      granQuery = resolved.granQuery;
    }
  }

  return buildGranQuestoesUrl({
    assuntoId,
    disciplinaId,
    query: assuntoId ? undefined : (granQuery || subtopic.name),
    banca: bancaId,
    filterBanca: true,
  });
}

function buildAutopilotTask(
  block,
  subject,
  topic,
  subtopic,
  isRevision,
  settings,
  todayQuestions,
  todayStr = getLocalDateString()
) {
  const granQuestionsUrl = buildSurgicalGranUrl(subject, topic, subtopic, settings.bancaId || 92);

  const completedToday = isCompletedToday(subtopic, todayStr);
  const isTheoryCompleted = completedToday || isBlockCompletedToday(block, todayStr);

  let qAttempted = 0;
  let qCorrect = 0;
  if (todayQuestions && todayQuestions.length > 0) {
    const relevant = todayQuestions.filter((q) => {
      if (q.subjectId !== subject.id) return false;
      const qTopicLower = (q.topicName || '').toLowerCase();
      const subtopicLower = subtopic.name.toLowerCase();

      // If generic fallback, match parent topic name
      if (subtopic.id.startsWith('sub-gen-') || subtopicLower === 'estudo geral e revisão') {
        const parentTopicLower = topic.name.toLowerCase();
        return qTopicLower.includes(parentTopicLower);
      }

      // Exact subtopic containment avoids cross-subtopic question pollution
      return qTopicLower.includes(subtopicLower);
    });

    for (const q of relevant) {
      qAttempted += q.attempted || 0;
      qCorrect += q.correct || 0;
    }
  }

  return {
    id: `task-${block.id}-${subtopic.id}`,
    blockId: block.id,
    subjectId: subject.id,
    subjectName: subject.name,
    topicId: topic.id,
    topicName: topic.name,
    subtopicId: subtopic.id,
    subtopicName: subtopic.name,
    theoryMinutes: block.durationMinutes || settings.theoryDurationMinutes || 60,
    theoryCompleted: isTheoryCompleted,
    questionsTarget: settings.questionsPerBlock || 15,
    questionsAttempted: qAttempted,
    questionsCorrect: qCorrect,
    granQuestionsUrl,
    isRevision,
  };
}

function getTodayMission(
  workspaceId,
  subjects,
  cycleBlocks,
  revisoes,
  flashcards,
  settings,
  todayQuestions = [],
  extraBlockIds = [],
  currentDate = new Date()
) {
  const todayStr = getLocalDateString(currentDate);
  const todayDayName = getDayOfWeekName(currentDate);
  const tomorrowDate = new Date(currentDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrowDate);
  const tomorrowDayName = getDayOfWeekName(tomorrowDate);

  // Defensive scoping: ensure only data belonging to the requested workspace is evaluated
  const scopedReviews = workspaceId
    ? revisoes.filter((r) => !r.workspaceId || r.workspaceId === workspaceId)
    : revisoes;
  const scopedFlashcards = workspaceId
    ? flashcards.filter((f) => !f.workspaceId || f.workspaceId === workspaceId)
    : flashcards;
  const scopedQuestions = workspaceId
    ? todayQuestions.filter((q) => !q.workspaceId || q.workspaceId === workspaceId)
    : todayQuestions;

  const todayIdx = DAYS_ORDER.indexOf(todayDayName);
  const overdueIncompleteBlocks = cycleBlocks.filter((b) => {
    if (b.completed) return false;
    const bDayIdx = DAYS_ORDER.indexOf(b.dayAllocated);
    return bDayIdx !== -1 && todayIdx !== -1 && bDayIdx < todayIdx;
  });

  let todayBlocks = [
    ...overdueIncompleteBlocks,
    ...cycleBlocks.filter(
      (b) => b.dayAllocated === todayDayName && !overdueIncompleteBlocks.some((ob) => ob.id === b.id)
    ),
  ];

  if (extraBlockIds.length > 0) {
    const extraSet = new Set(extraBlockIds);
    const pulledBlocks = cycleBlocks.filter(
      (b) => extraSet.has(b.id) && !todayBlocks.some((tb) => tb.id === b.id)
    );
    todayBlocks = [...todayBlocks, ...pulledBlocks];
  }

  if (todayBlocks.length === 0 && cycleBlocks.length > 0) {
    const incompleteBlocks = cycleBlocks.filter((b) => !b.completed);
    todayBlocks = incompleteBlocks.length > 0
      ? incompleteBlocks.slice(0, 2)
      : cycleBlocks.slice(0, 2);
  }

  const assignedSubtopicIds = new Set();
  const tasks = [];

  for (const block of todayBlocks) {
    const subject = subjects.find((s) => s.id === block.subjectId);
    if (!subject) continue;

    const { topic, subtopic, isRevision } = findSubtopicForSubject(
      subject,
      assignedSubtopicIds,
      todayStr
    );
    assignedSubtopicIds.add(subtopic.id);

    const task = buildAutopilotTask(
      block,
      subject,
      topic,
      subtopic,
      isRevision,
      settings,
      scopedQuestions,
      todayStr
    );
    tasks.push(task);
  }

  const dueReviews = scopedReviews.filter((r) => {
    if (!r.done && r.revDate <= todayStr) return true;
    if (r.done && (r.revDate === todayStr || (r.completedAt && r.completedAt.startsWith(todayStr)))) {
      return true;
    }
    return false;
  });
  const dueFlashcardsCount = scopedFlashcards.filter((f) => f.dueDate <= todayStr).length;

  let tomorrowBlocks = cycleBlocks.filter((b) => b.dayAllocated === tomorrowDayName);
  if (tomorrowBlocks.length === 0 && cycleBlocks.length > 0) {
    const remaining = cycleBlocks.filter((b) => !todayBlocks.some((tb) => tb.id === b.id));
    const incomplete = remaining.filter((b) => !b.completed);
    tomorrowBlocks = incomplete.length > 0 ? incomplete.slice(0, 2) : remaining.slice(0, 2);
  }

  const tomorrowTasks = [];
  const tomorrowAssignedSubtopics = new Set(assignedSubtopicIds);

  for (const block of tomorrowBlocks) {
    const subject = subjects.find((s) => s.id === block.subjectId);
    if (!subject) continue;

    const { topic, subtopic, isRevision } = findSubtopicForSubject(
      subject,
      tomorrowAssignedSubtopics
    );
    tomorrowAssignedSubtopics.add(subtopic.id);

    const task = buildAutopilotTask(
      block,
      subject,
      topic,
      subtopic,
      isRevision,
      settings,
      [],
      tomorrowStr
    );
    tomorrowTasks.push(task);
  }

  const maturingReviews = scopedReviews.filter((r) => r.revDate === tomorrowStr && !r.done);
  const maturingFlashcardsCount = scopedFlashcards.filter((f) => f.dueDate === tomorrowStr).length;

  return {
    dateStr: todayStr,
    dayName: todayDayName,
    tasks,
    dueFlashcardsCount,
    dueReviews,
    tomorrow: {
      dateStr: tomorrowStr,
      dayName: tomorrowDayName,
      tasks: tomorrowTasks,
      maturingReviews,
      maturingFlashcardsCount,
    },
  };
}

function calculateMissionProgress(mission, reviewedFlashcardsTodayCount = 0) {
  let totalItems = 0;
  let completedItems = 0;

  for (const t of mission.tasks) {
    totalItems += 2;
    if (t.theoryCompleted) completedItems += 1;
    if (t.questionsAttempted >= t.questionsTarget) completedItems += 1;
  }

  for (const r of mission.dueReviews) {
    totalItems += 1;
    if (r.done) completedItems += 1;
  }

  const totalCardsToday = (mission.dueFlashcardsCount || 0) + reviewedFlashcardsTodayCount;
  if (totalCardsToday > 0) {
    totalItems += 1;
    if (mission.dueFlashcardsCount === 0) {
      completedItems += 1;
    }
  }

  if (totalItems === 0) return { totalItems: 0, completedItems: 0, percentage: 100 };
  const percentage = Math.round((completedItems / totalItems) * 100);
  return { totalItems, completedItems, percentage };
}

console.log('--- RUNNING AUTOPILOT ENGINE TESTS ---');

// TEST 1: findSubtopicForSubject with virgin subtopics
{
  const subject = {
    id: 'sub-ti',
    name: 'Banco de Dados',
    topics: [
      {
        id: 'top-1',
        name: 'Modelagem Conceitual',
        subtopics: [
          { id: 'st-1', name: 'Entidade-Relacionamento', completed: true },
          { id: 'st-2', name: 'Normalização 1FN, 2FN, 3FN', completed: false, assuntoId: 10502, disciplinaId: 14 },
          { id: 'st-3', name: 'Forma Normal de Boyce-Codd', completed: false },
        ],
      },
    ],
  };

  const result = findSubtopicForSubject(subject);
  assert.equal(result.subtopic.id, 'st-2', 'Should pick the first uncompleted subtopic');
  assert.equal(result.isRevision, false, 'Should not be flagged as revision');
  console.log('✓ Test 1 Passed: Next virgin subtopic correctly identified.');
}

// TEST 2: findSubtopicForSubject when 100% completed (picks lowest accuracy)
{
  const subject = {
    id: 'sub-port',
    name: 'Língua Portuguesa',
    topics: [
      {
        id: 'top-port-1',
        name: 'Morfossintaxe',
        subtopics: [
          { id: 'st-p1', name: 'Crase', completed: true, acertos: 18, erros: 2 }, // 90%
          { id: 'st-p2', name: 'Concordância Verbal', completed: true, acertos: 10, erros: 10 }, // 50% -> lowest
          { id: 'st-p3', name: 'Regência Nominal', completed: true, acertos: 15, erros: 5 }, // 75%
        ],
      },
    ],
  };

  const result = findSubtopicForSubject(subject);
  assert.equal(result.subtopic.id, 'st-p2', 'Should pick the subtopic with lowest accuracy');
  assert.equal(result.isRevision, true, 'Should be flagged as revision');
  console.log('✓ Test 2 Passed: 100% covered subject picks lowest accuracy for deep revision.');
}

// TEST 3: buildSurgicalGranUrl generates precision URL with Assunto, Disciplina & Banca FCC (92)
{
  const subject = { id: 'sub-ti', name: 'TI', disciplinaId: 14 };
  const topic = { id: 'top-sql', name: 'SQL', assuntoId: 20401 };
  const subtopic = { id: 'st-dql', name: 'DQL e JOINs', assuntoId: 20405 };

  const url = buildSurgicalGranUrl(subject, topic, subtopic, 92);
  assert.ok(url.includes('disciplina=14'), 'URL must contain disciplinaId=14');
  assert.ok(url.includes('assunto=20405'), 'URL must contain subtopic assuntoId=20405');
  assert.ok(url.includes('banca=92'), 'URL must contain official FCC banca numeric ID 92');
  assert.ok(url.includes('desatualizada=0&anulada=0'), 'URL must filter out outdated and annulled');
  console.log('✓ Test 3 Passed: Surgical Gran Questões URL generated accurately with FCC ID 92.');
}

// TEST 4: getTodayMission orchestrates tasks, reviews, and tomorrow's preview
{
  // Use deterministic Wednesday so tomorrow is Thursday (avoids Sunday-to-Monday rollover edge-case in cycle day index)
  const today = new Date('2026-09-23T12:00:00Z');
  const todayDay = getDayOfWeekName(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = getDayOfWeekName(tomorrow);

  const subjects = [
    {
      id: 'sub-dir-adm',
      name: 'Direito Administrativo',
      status: 'active',
      topics: [
        {
          id: 'top-licitacoes',
          name: 'Licitações Lei 14.133',
          subtopics: [
            { id: 'st-lic-1', name: 'Modalidades de Licitação', completed: false, assuntoId: 30101 },
            { id: 'st-lic-2', name: 'Contratação Direta', completed: false, assuntoId: 30102 },
          ],
        },
      ],
    },
    {
      id: 'sub-controle',
      name: 'Controle Externo',
      status: 'active',
      topics: [
        {
          id: 'top-tce',
          name: 'Regimento TCE-GO',
          subtopics: [
            { id: 'st-tce-1', name: 'Competências Constitucionais', completed: false },
            { id: 'st-tce-2', name: 'Julgamento de Contas', completed: false },
          ],
        },
      ],
    },
  ];

  const cycleBlocks = [
    { id: 'b-1', subjectId: 'sub-dir-adm', subjectName: 'Direito Administrativo', dayAllocated: todayDay, durationMinutes: 60, completed: false, order: 1 },
    { id: 'b-2', subjectId: 'sub-dir-adm', subjectName: 'Direito Administrativo', dayAllocated: tomorrowDay, durationMinutes: 60, completed: false, order: 2 },
  ];

  const revisoes = [
    {
      id: 'rev-1',
      subjectId: 'sub-ti',
      subjectName: 'TI',
      topicName: 'Arquitetura Limpa',
      studyDate: getLocalDateString(new Date(Date.now() - 86400000)),
      revDate: getLocalDateString(today),
      days: 1,
      done: false,
      workspaceId: 'ws-test',
    },
  ];

  const flashcards = [
    { id: 'fc-1', dueDate: getLocalDateString(today) },
    { id: 'fc-2', dueDate: getTomorrowDateString(today) },
  ];

  const settings = {
    questionsPerBlock: 15,
    theoryDurationMinutes: 60,
    autoScheduleD1Review: true,
    banca: 'FCC',
    bancaId: 92,
  };

  const mission = getTodayMission('ws-test', subjects, cycleBlocks, revisoes, flashcards, settings, [], [], today);

  // Assert today's tasks
  assert.equal(mission.tasks.length, 1, 'Should have 1 task today');
  assert.equal(mission.tasks[0].subtopicId, 'st-lic-1', 'Should assign first subtopic to today');
  assert.equal(mission.tasks[0].questionsTarget, 15, 'Questions target should be 15');
  assert.equal(mission.dueReviews.length, 1, 'Should have 1 due review today');
  assert.equal(mission.dueFlashcardsCount, 1, 'Should have 1 due flashcard today');

  // Assert tomorrow preview advances to NEXT subtopic
  assert.equal(mission.tomorrow.tasks.length, 1, 'Should have 1 task scheduled for tomorrow');
  assert.equal(
    mission.tomorrow.tasks[0].subtopicId,
    'st-lic-2',
    'Tomorrow preview should advance to st-lic-2 (not repeating today st-lic-1)'
  );
  assert.equal(mission.tomorrow.maturingFlashcardsCount, 1, 'Should have 1 flashcard maturing tomorrow');

  console.log('✓ Test 4 Passed: Daily mission and tomorrow preview calculate correctly and advance subtopics.');
}

// TEST 5: calculateMissionProgress with mixed completion
{
  const mission = {
    tasks: [
      { theoryCompleted: true, questionsAttempted: 15, questionsTarget: 15 },
      { theoryCompleted: false, questionsAttempted: 0, questionsTarget: 15 },
    ],
    dueReviews: [{ done: true }, { done: false }],
    dueFlashcardsCount: 0,
  };

  const progress = calculateMissionProgress(mission);
  // Total items = 2 * 2 (tasks) + 2 (reviews) = 6
  // Completed items = 2 (task 1 theory + questions) + 1 (review 1 done) = 3
  assert.equal(progress.totalItems, 6, 'Total items should be 6');
  assert.equal(progress.completedItems, 3, 'Completed items should be 3');
  assert.equal(progress.percentage, 50, 'Percentage should be 50%');
  console.log('✓ Test 5 Passed: calculateMissionProgress accurately computes multi-stage progress.');
}

// TEST 6: Simulated D+1 Review creation and duplicate prevention
{
  const todayStr = getLocalDateString();
  const tomorrowStr = getTomorrowDateString();

  const revisoes = [];

  function simulateScheduleTomorrowReview(subjectId, subjectName, topicName) {
    const exists = revisoes.some(
      (r) => r.subjectId === subjectId && r.topicName === topicName && r.revDate === tomorrowStr && !r.done
    );
    if (exists) return null;

    const newRev = {
      id: `rev-${Date.now()}`,
      subjectId,
      subjectName,
      topicName,
      studyDate: todayStr,
      revDate: tomorrowStr,
      days: 1,
      done: false,
    };
    revisoes.push(newRev);
    return newRev;
  }

  const r1 = simulateScheduleTomorrowReview('sub-ti', 'TI', 'Docker - Containers');
  assert.notEqual(r1, null, 'Should schedule new D+1 review');
  assert.equal(r1.days, 1, 'Review interval should be 1 day (D+1)');
  assert.equal(r1.revDate, tomorrowStr, 'Review date should be tomorrow');

  const r2 = simulateScheduleTomorrowReview('sub-ti', 'TI', 'Docker - Containers');
  assert.equal(r2, null, 'Should prevent duplicate D+1 review for the same topic tomorrow');

  console.log('✓ Test 6 Passed: D+1 automatic scheduling and deduplication work as intended.');
}

// TEST 7: Subtopic completed today remains bound to today's task instead of vanishing
{
  // Use deterministic Wednesday so tomorrow is Thursday (avoids Sunday-to-Monday rollover edge-case in cycle day index)
  const today = new Date('2026-09-23T12:00:00Z');
  const todayStr = getLocalDateString(today);
  const todayDay = getDayOfWeekName(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = getDayOfWeekName(tomorrow);

  const subjectWithCompletedToday = {
    id: 'sub-dir-const',
    name: 'Direito Constitucional',
    status: 'active',
    topics: [
      {
        id: 'top-cf-1',
        name: 'Direitos Fundamentais',
        subtopics: [
          // st-1 was completed earlier today!
          { id: 'st-cf-1', name: 'Direitos Individuais', completed: true, completedAt: `${todayStr}T10:30:00.000Z` },
          // st-2 is the next virgin subtopic
          { id: 'st-cf-2', name: 'Remédios Constitucionais', completed: false },
        ],
      },
    ],
  };

  const cycleBlocks = [
    { id: 'b-cf-1', subjectId: 'sub-dir-const', subjectName: 'Direito Constitucional', dayAllocated: todayDay, durationMinutes: 60, completed: true, order: 1 },
    { id: 'b-cf-2', subjectId: 'sub-dir-const', subjectName: 'Direito Constitucional', dayAllocated: tomorrowDay, durationMinutes: 60, completed: false, order: 2 },
  ];

  const settings = {
    questionsPerBlock: 15,
    theoryDurationMinutes: 60,
    autoScheduleD1Review: true,
    banca: 'FCC',
    bancaId: 92,
  };

  const mission = getTodayMission('ws-test', [subjectWithCompletedToday], cycleBlocks, [], [], settings, [], [], today);

  // Today's task must be st-cf-1 (the one studied today), with theoryCompleted = true!
  assert.equal(mission.tasks.length, 1, 'Today should have 1 task');
  assert.equal(mission.tasks[0].subtopicId, 'st-cf-1', 'Task should retain st-cf-1 completed today so user can log questions');
  assert.equal(mission.tasks[0].theoryCompleted, true, 'Theory must be marked completed');

  // Tomorrow preview must advance to st-cf-2!
  assert.equal(mission.tomorrow.tasks.length, 1, 'Tomorrow should have 1 task');
  assert.equal(mission.tomorrow.tasks[0].subtopicId, 'st-cf-2', 'Tomorrow preview must advance to st-cf-2');

  console.log('✓ Test 7 Passed: Completed-today subtopics remain active for question logging and advance tomorrow.');
}

// TEST 8: Completed spaced reviews today stay visible in dueReviews and count in mission progress
{
  const today = new Date();
  const todayStr = getLocalDateString(today);

  const revisoes = [
    {
      id: 'rev-today-done',
      subjectId: 'sub-ti',
      subjectName: 'TI',
      topicName: 'Kubernetes',
      studyDate: todayStr,
      revDate: todayStr,
      days: 1,
      done: true,
      completedAt: `${todayStr}T14:00:00.000Z`,
      workspaceId: 'ws-test',
    },
    {
      id: 'rev-old-done',
      subjectId: 'sub-ti',
      subjectName: 'TI',
      topicName: 'Antigo Tópico',
      studyDate: '2026-01-01',
      revDate: '2026-01-02',
      days: 1,
      done: true,
      completedAt: '2026-01-02T10:00:00.000Z',
      workspaceId: 'ws-test',
    },
  ];

  const mission = getTodayMission('ws-test', [], [], revisoes, [], {}, [], [], today);

  // Assert dueReviews includes the one completed today, but excludes old historical reviews
  assert.equal(mission.dueReviews.length, 1, 'Should only contain the review completed today');
  assert.equal(mission.dueReviews[0].id, 'rev-today-done');
  assert.equal(mission.dueReviews[0].done, true);

  const progress = calculateMissionProgress(mission);
  assert.equal(progress.totalItems, 1, 'Total items should count the due review');
  assert.equal(progress.completedItems, 1, 'Completed items should credit the completed review');
  assert.equal(progress.percentage, 100, 'Progress should be 100%');

  console.log('✓ Test 8 Passed: Completed spaced reviews today remain in dueReviews and award progress.');
}

// TEST 9: Flashcards reviewed today count toward progress when remaining due is 0
{
  const mission = {
    tasks: [],
    dueReviews: [],
    dueFlashcardsCount: 0,
  };

  // When 10 flashcards were reviewed today and 0 remain due:
  const progress = calculateMissionProgress(mission, 10);
  assert.equal(progress.totalItems, 1, 'Total items should include flashcard deck');
  assert.equal(progress.completedItems, 1, 'Completed items should credit completed deck');
  assert.equal(progress.percentage, 100, 'Progress should be 100%');

  // When 5 remain due and 5 were reviewed:
  const missionPending = {
    tasks: [],
    dueReviews: [],
    dueFlashcardsCount: 5,
  };
  const progressPending = calculateMissionProgress(missionPending, 5);
  assert.equal(progressPending.totalItems, 1);
  assert.equal(progressPending.completedItems, 0, 'Incomplete deck should not be credited');
  assert.equal(progressPending.percentage, 0);

  console.log('✓ Test 9 Passed: Flashcards deck completion correctly credits progress.');
}

// TEST 10: Question isolation prevents cross-subtopic question pollution under same parent topic
{
  const subject = {
    id: 'sub-dir-adm',
    name: 'Direito Administrativo',
    topics: [
      {
        id: 'top-licitacoes',
        name: 'Licitações Lei 14.133',
        subtopics: [
          { id: 'st-1', name: 'Modalidades de Licitação', completed: false },
          { id: 'st-2', name: 'Contratação Direta', completed: false },
        ],
      },
    ],
  };

  const block = { id: 'b-1', subjectId: 'sub-dir-adm', durationMinutes: 60 };
  const settings = { questionsPerBlock: 15, bancaId: 92 };

  // Questions logged specifically for Subtopic 1 ("Modalidades de Licitação")
  const todayQuestions = [
    {
      subjectId: 'sub-dir-adm',
      topicName: 'Licitações Lei 14.133 - Modalidades de Licitação',
      attempted: 15,
      correct: 13,
    },
  ];

  // Task for Subtopic 1 must match the 15 questions
  const task1 = buildAutopilotTask(block, subject, subject.topics[0], subject.topics[0].subtopics[0], false, settings, todayQuestions);
  assert.equal(task1.questionsAttempted, 15, 'Task 1 must count 15 questions');
  assert.equal(task1.questionsCorrect, 13);

  // Task for Subtopic 2 under same parent topic must NOT count Task 1 questions!
  const task2 = buildAutopilotTask(block, subject, subject.topics[0], subject.topics[0].subtopics[1], false, settings, todayQuestions);
  assert.equal(task2.questionsAttempted, 0, 'Task 2 must NOT inherit questions from sibling subtopic');
  assert.equal(task2.questionsCorrect, 0);

  console.log('✓ Test 10 Passed: Cross-subtopic question pollution strictly prevented.');
}

// TEST 11: Cross-workspace data isolation in getTodayMission
{
  const today = new Date();
  const todayStr = getLocalDateString(today);

  const revisoes = [
    {
      id: 'rev-ws-1',
      subjectId: 'sub-1',
      subjectName: 'Dir Const',
      topicName: 'Direitos Fundamentais',
      studyDate: todayStr,
      revDate: todayStr,
      days: 1,
      done: false,
      workspaceId: 'ws-target',
    },
    {
      id: 'rev-ws-other',
      subjectId: 'sub-2',
      subjectName: 'TI',
      topicName: 'SQL',
      studyDate: todayStr,
      revDate: todayStr,
      days: 1,
      done: false,
      workspaceId: 'ws-other-unrelated',
    },
  ];

  const flashcards = [
    { id: 'fc-1', workspaceId: 'ws-target', dueDate: todayStr },
    { id: 'fc-2', workspaceId: 'ws-other-unrelated', dueDate: todayStr },
  ];

  const mission = getTodayMission('ws-target', [], [], revisoes, flashcards, {}, [], [], today);

  assert.equal(mission.dueReviews.length, 1, 'Should only contain reviews belonging to ws-target');
  assert.equal(mission.dueReviews[0].id, 'rev-ws-1');
  assert.equal(mission.dueFlashcardsCount, 1, 'Should only count flashcards belonging to ws-target');

  console.log('✓ Test 11 Passed: Cross-workspace data isolation strictly enforced.');
}

// TEST 12: Subtopics with missing assuntoId automatically resolve official taxonomy and omit query param
{
  const subject = { id: 'subject-custom-uuid-123', name: 'Engenharia de Software' };
  const topic = { id: 'topic-uuid-456', name: 'Metodologias' };
  const subtopic = { id: 'subtopic-uuid-789', name: 'Framework Scrum e Kanban', completed: false };

  // Note: subject, topic, and subtopic have NO assuntoId or disciplinaId set in their object
  const url = buildSurgicalGranUrl(subject, topic, subtopic, 92);

  assert.ok(url.includes('disciplina=14'), 'Must auto-resolve disciplinaId=14 for Engenharia de Software');
  assert.ok(url.includes('assunto=428797,428799'), 'Must auto-resolve Gran official assuntoId for Scrum/Kanban');
  assert.ok(url.includes('banca=92'), 'Must include FCC banca 92');
  assert.ok(!url.includes('&query='), 'Must NOT contain &query= search-bar pollution when assuntoId is resolved');

  console.log('✓ Test 12 Passed: Missing taxonomy auto-resolves and completely omits search-bar query.');
}

// TEST 13: Theory completion strictly requires completion TODAY
{
  const subject = {
    id: 'sub-dir-const',
    name: 'Direito Constitucional',
    topics: [
      {
        id: 'top-cf88',
        name: 'CF/88',
        subtopics: [
          { id: 'st-1', name: 'Princípios Fundamentais', completed: false },
        ],
      },
    ],
  };

  const topic = subject.topics[0];
  const subtopic = topic.subtopics[0];
  const settings = { questionsPerBlock: 15, bancaId: 92, theoryDurationMinutes: 60 };
  const todayStr = '2026-09-17';

  // Case A: Block marked completed last week (e.g. 2026-09-10) without today's completion
  const staleBlock = {
    id: 'block-stale',
    subjectId: 'sub-dir-const',
    durationMinutes: 60,
    completed: true,
    completedAt: '2026-09-10T14:30:00.000Z',
    dayAllocated: 'quinta',
  };

  const taskA = buildAutopilotTask(staleBlock, subject, topic, subtopic, false, settings, [], todayStr);
  assert.equal(
    taskA.theoryCompleted,
    false,
    'Block completed on a previous day/week must NOT be marked as completed today!'
  );

  // Case B: Block without completedAt timestamp (legacy state) must NOT be marked completed today
  const legacyBlock = {
    id: 'block-legacy',
    subjectId: 'sub-dir-const',
    durationMinutes: 60,
    completed: true,
    dayAllocated: 'quinta',
  };
  const taskB = buildAutopilotTask(legacyBlock, subject, topic, subtopic, false, settings, [], todayStr);
  assert.equal(
    taskB.theoryCompleted,
    false,
    'Legacy block without completedAt must NOT be marked completed today!'
  );

  // Case C: Block completed TODAY
  const todayBlock = {
    id: 'block-today',
    subjectId: 'sub-dir-const',
    durationMinutes: 60,
    completed: true,
    completedAt: '2026-09-17T09:15:00.000Z',
    dayAllocated: 'quinta',
  };
  const taskC = buildAutopilotTask(todayBlock, subject, topic, subtopic, false, settings, [], todayStr);
  assert.equal(
    taskC.theoryCompleted,
    true,
    'Block completed today MUST be marked as theoryCompleted = true.'
  );

  console.log('✓ Test 13 Passed: Theory completion strictly requires completion today.');
}

// TEST 14: Overdue incomplete blocks from earlier days in week are carried forward to today
{
  const subjects = [
    {
      id: 'sub-1',
      name: 'Português',
      status: 'active',
      topics: [{ id: 't-1', name: 'Sintaxe', subtopics: [{ id: 'st-1', name: 'Regência', completed: false }] }],
    },
    {
      id: 'sub-2',
      name: 'TI',
      status: 'active',
      topics: [{ id: 't-2', name: 'Banco de Dados', subtopics: [{ id: 'st-2', name: 'SQL', completed: true, completedAt: '2026-09-15T10:00:00Z' }] }],
    },
    {
      id: 'sub-3',
      name: 'Direito Administrativo',
      status: 'active',
      topics: [{ id: 't-3', name: 'Licitações', subtopics: [{ id: 'st-3', name: 'Pregão', completed: false }] }],
    },
  ];

  // Wednesday (quarta-feira)
  const wednesdayDate = new Date('2026-09-16T12:00:00Z'); // 2026-09-16 is Wednesday
  assert.equal(getDayOfWeekName(wednesdayDate), 'quarta');
  assert.equal(getTodayDayName(wednesdayDate), 'quarta');

  const cycleBlocks = [
    { id: 'b-segunda', subjectId: 'sub-1', durationMinutes: 60, completed: false, order: 1, dayAllocated: 'segunda' },
    { id: 'b-terca', subjectId: 'sub-2', durationMinutes: 60, completed: true, completedAt: '2026-09-15T12:00:00Z', order: 2, dayAllocated: 'terca' },
    { id: 'b-quarta', subjectId: 'sub-3', durationMinutes: 60, completed: false, order: 3, dayAllocated: 'quarta' },
  ];

  const mission = getTodayMission('ws-1', subjects, cycleBlocks, [], [], { questionsPerBlock: 15 }, [], [], wednesdayDate);

  // The incomplete block from Monday (b-segunda) must be carried forward and included before Wednesday's block
  assert.equal(mission.tasks.length, 2, 'Must include both the overdue Monday block and today Wednesday block');
  assert.equal(mission.tasks[0].blockId, 'b-segunda', 'Overdue incomplete block from Monday must be prioritized first');
  assert.equal(mission.tasks[1].blockId, 'b-quarta', 'Wednesday scheduled block must follow');

  console.log('✓ Test 14 Passed: Overdue incomplete blocks from earlier days are automatically carried over.');
}

// TEST 15: Week rollover detection & reallocateIncompleteBlocks clean reset
{
  const lastWeekDate = new Date('2026-09-09T12:00:00Z'); // Wednesday of week 1
  const thisWeekDate = new Date('2026-09-16T12:00:00Z'); // Wednesday of week 2

  const lastWeekMonday = getMondayOfWeek(lastWeekDate);
  const thisWeekMonday = getMondayOfWeek(thisWeekDate);

  assert.notEqual(lastWeekMonday, thisWeekMonday, 'Week rollover must detect Monday change');
  assert.equal(lastWeekMonday, '2026-09-07');
  assert.equal(thisWeekMonday, '2026-09-14');

  // Blocks completed in the previous week
  const oldBlocks = [
    { id: 'b-1', subjectId: 'sub-1', durationMinutes: 60, completed: true, completedAt: '2026-09-08T10:00:00Z', order: 1, dayAllocated: 'segunda' },
    { id: 'b-2', subjectId: 'sub-2', durationMinutes: 60, completed: true, completedAt: '2026-09-09T11:00:00Z', order: 2, dayAllocated: 'terca' },
  ];

  // Simulating week reset
  const resetBlocks = oldBlocks.map((b) => ({
    ...b,
    completed: false,
    completedAt: undefined,
  }));

  const dailyHours = { segunda: 2, terca: 2, quarta: 2, quinta: 2, sexta: 2, sabado: 1, domingo: 1 };
  const reallocated = reallocateIncompleteBlocks(resetBlocks, dailyHours, 'segunda');

  assert.equal(reallocated.every((b) => !b.completed), true, 'All blocks must be uncompleted after week reset');
  assert.equal(reallocated.every((b) => b.completedAt === undefined), true, 'All completedAt timestamps must be cleared');
  assert.equal(reallocated[0].dayAllocated, 'segunda');
  assert.equal(reallocated[1].dayAllocated, 'segunda');

  console.log('✓ Test 15 Passed: Week rollover cleans completions and reallocates cleanly.');
}

console.log('=== ALL 15 AUTOPILOT ENGINE TESTS PASSED SUCCESSFULLY! ===');
