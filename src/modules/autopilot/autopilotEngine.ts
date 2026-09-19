import type {
  Subject,
  Topic,
  Subtopic,
  StudyBlock,
  SpacedReview,
  Flashcard,
  QuestionSession,
  AutopilotSettings,
  AutopilotTask,
  AutopilotDayMission,
  AutopilotTomorrowPreview,
} from '../../types';
import { buildGranQuestoesUrl, resolveGranTaxonomy } from '../../data/tceGoPreset';
import { DAYS_ORDER } from '../cycle/cycleGenerator';

export const DOW_MAP = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

export const DAY_DISPLAY_NAMES: Record<string, string> = {
  domingo: 'Domingo',
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
};

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTomorrowDateString(d: Date = new Date()): string {
  const tomorrow = new Date(d);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLocalDateString(tomorrow);
}

export function getDayOfWeekName(d: Date = new Date()): string {
  return DOW_MAP[d.getDay()];
}

export function formatLongPortugueseDate(d: Date = new Date()): string {
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function isCompletedToday(st: Subtopic, todayStr: string): boolean {
  if (!st.completed || !st.completedAt) return false;
  if (st.completedAt.startsWith(todayStr)) return true;
  const [year, month, day] = todayStr.split('-');
  const brDate = `${day}/${month}/${year}`;
  const brDate2 = `${Number(day)}/${Number(month)}/${year}`;
  if (st.completedAt.startsWith(brDate) || st.completedAt.startsWith(brDate2)) return true;
  return false;
}

export function isBlockCompletedToday(block: StudyBlock, todayStr: string): boolean {
  if (!block.completed || !block.completedAt) return false;
  if (block.completedAt.startsWith(todayStr)) return true;
  const [year, month, day] = todayStr.split('-');
  const brDate = `${day}/${month}/${year}`;
  const brDate2 = `${Number(day)}/${Number(month)}/${year}`;
  if (block.completedAt.startsWith(brDate) || block.completedAt.startsWith(brDate2)) return true;
  return false;
}

/**
 * Finds the next candidate subtopic for a subject.
 * Priority 0 (today only): Any subtopic completed TODAY that has not been assigned to a previous block.
 * Priority 1: First uncompleted subtopic (completed === false).
 * Priority 2: If all completed, subtopic with lowest accuracy for deep revision.
 * Fallback: If no subtopics exist, creates a synthetic representation.
 */
export function findSubtopicForSubject(
  subject: Subject,
  skipSubtopicIds?: Set<string>,
  preferCompletedTodayDate?: string
): { topic: Topic; subtopic: Subtopic; isRevision: boolean } {
  const topics = subject.topics || [];

  // Priority 0: Prioritize subtopics worked on/completed TODAY for today's active mission
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
  let candidate: { topic: Topic; subtopic: Subtopic } | null = null;
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

  // Fallback: If all subtopics were in skipSubtopicIds but topics exist
  for (const top of topics) {
    if (top.subtopics && top.subtopics.length > 0) {
      return { topic: top, subtopic: top.subtopics[0], isRevision: true };
    }
  }

  // Fallback: If no subtopics exist in subject
  const fallbackTopic: Topic = {
    id: `top-gen-${subject.id}`,
    name: subject.name,
    subtopics: [],
    assuntoId: subject.assuntoId,
    disciplinaId: subject.disciplinaId,
    granQuery: subject.granQuery || subject.name,
  };

  const fallbackSubtopic: Subtopic = {
    id: `sub-gen-${subject.id}`,
    name: 'Estudo Geral e Revisão',
    completed: false,
    assuntoId: subject.assuntoId,
    disciplinaId: subject.disciplinaId,
    granQuery: subject.granQuery || subject.name,
  };

  return { topic: fallbackTopic, subtopic: fallbackSubtopic, isRevision: false };
}

/**
 * Builds surgical Gran Questões URL using official taxonomy
 */
export function buildSurgicalGranUrl(
  subject: Subject,
  topic: Topic,
  subtopic: Subtopic,
  bancaId: number = 92
): string {
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

/**
 * Builds an AutopilotTask instance from a cycle study block
 */
export function buildAutopilotTask(
  block: StudyBlock,
  subject: Subject,
  topic: Topic,
  subtopic: Subtopic,
  isRevision: boolean,
  settings: AutopilotSettings,
  todayQuestions?: QuestionSession[],
  todayStr: string = getLocalDateString()
): AutopilotTask {
  const granQuestionsUrl = buildSurgicalGranUrl(
    subject,
    topic,
    subtopic,
    settings.bancaId || 92
  );

  const completedToday = isCompletedToday(subtopic, todayStr);
  const isTheoryCompleted = completedToday || isBlockCompletedToday(block, todayStr);

  // Count questions logged today specifically for this subtopic
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
    videoUrl: subtopic.videoUrl || topic.courseUrl || subject.granCourseUrl,
    videoLesson: subtopic.videoLesson,
    videoBlock: subtopic.videoBlock,
    pdfUrl: subtopic.pdfUrl,
    pdfLesson: subtopic.pdfLesson,
    pdfPages: subtopic.pdfPages,
    isRevision,
  };
}

/**
 * Main Engine function to compute today's complete autopilot mission
 */
export function getTodayMission(
  workspaceId: string,
  subjects: Subject[],
  cycleBlocks: StudyBlock[],
  revisoes: SpacedReview[],
  flashcards: Flashcard[],
  settings: AutopilotSettings,
  todayQuestions: QuestionSession[] = [],
  extraBlockIds: string[] = [],
  currentDate: Date = new Date()
): AutopilotDayMission {
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

  // 1. Identify active cycle blocks for today
  // Prioritize overdue incomplete blocks from previous days in the current cycle
  const todayIdx = DAYS_ORDER.indexOf(todayDayName as any);
  const overdueIncompleteBlocks = cycleBlocks.filter((b) => {
    if (b.completed) return false;
    const bDayIdx = DAYS_ORDER.indexOf(b.dayAllocated as any);
    return bDayIdx !== -1 && todayIdx !== -1 && bDayIdx < todayIdx;
  });

  let todayBlocks: StudyBlock[] = [
    ...overdueIncompleteBlocks,
    ...cycleBlocks.filter(
      (b) => b.dayAllocated === todayDayName && !overdueIncompleteBlocks.some((ob) => ob.id === b.id)
    ),
  ];

  // Add any explicitly pulled extra blocks
  if (extraBlockIds.length > 0) {
    const extraSet = new Set(extraBlockIds);
    const pulledBlocks = cycleBlocks.filter(
      (b) => extraSet.has(b.id) && !todayBlocks.some((tb) => tb.id === b.id)
    );
    todayBlocks = [...todayBlocks, ...pulledBlocks];
  }

  // Fallback if no blocks allocated for today
  if (todayBlocks.length === 0 && cycleBlocks.length > 0) {
    const incompleteBlocks = cycleBlocks.filter((b) => !b.completed);
    todayBlocks = incompleteBlocks.length > 0
      ? incompleteBlocks.slice(0, 2)
      : cycleBlocks.slice(0, 2);
  }

  // Fallback if cycleBlocks is completely empty but subjects exist
  if (todayBlocks.length === 0 && subjects.length > 0) {
    const activeSubjects = subjects.filter((s) => s.status === 'active');
    const selectedSubs = activeSubjects.length > 0
      ? activeSubjects.slice(0, 2)
      : subjects.slice(0, 2);

    todayBlocks = selectedSubs.map((sub, idx) => ({
      id: `synthetic-block-${sub.id}-${idx}`,
      subjectId: sub.id,
      subjectName: sub.name,
      durationMinutes: settings.theoryDurationMinutes || 60,
      completed: false,
      order: idx + 1,
      dayAllocated: todayDayName,
    }));
  }

  // 2. Build today's tasks
  const assignedSubtopicIds = new Set<string>();
  const tasks: AutopilotTask[] = [];

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

  // 3. Due Reviews and Flashcards for today
  const dueReviews = scopedReviews.filter((r) => {
    if (!r.done && r.revDate <= todayStr) return true;
    if (r.done && (r.revDate === todayStr || (r.completedAt && r.completedAt.startsWith(todayStr)))) {
      return true;
    }
    return false;
  });
  const dueFlashcardsCount = scopedFlashcards.filter((f) => f.dueDate <= todayStr).length;

  // 4. Calculate Tomorrow's Preview
  let tomorrowBlocks = cycleBlocks.filter(
    (b) => b.dayAllocated === tomorrowDayName
  );

  if (tomorrowBlocks.length === 0 && cycleBlocks.length > 0) {
    // Next blocks in sequence that were not included in today
    const remaining = cycleBlocks.filter(
      (b) => !todayBlocks.some((tb) => tb.id === b.id)
    );
    const incomplete = remaining.filter((b) => !b.completed);
    tomorrowBlocks = incomplete.length > 0
      ? incomplete.slice(0, 2)
      : remaining.slice(0, 2);
  }

  const tomorrowTasks: AutopilotTask[] = [];
  const tomorrowAssignedSubtopics = new Set<string>(assignedSubtopicIds);

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

  const maturingReviews = scopedReviews.filter(
    (r) => r.revDate === tomorrowStr && !r.done
  );
  const maturingFlashcardsCount = scopedFlashcards.filter(
    (f) => f.dueDate === tomorrowStr
  ).length;

  const tomorrowPreview: AutopilotTomorrowPreview = {
    dateStr: tomorrowStr,
    dayName: DAY_DISPLAY_NAMES[tomorrowDayName] || tomorrowDayName,
    tasks: tomorrowTasks,
    maturingReviews,
    maturingFlashcardsCount,
  };

  // 5. Completion status
  const allTasksTheoryDone = tasks.length > 0 && tasks.every((t) => t.theoryCompleted);
  const allTasksQuestionsDone =
    tasks.length > 0 && tasks.every((t) => t.questionsAttempted >= t.questionsTarget);
  const allReviewsDone = dueReviews.length === 0 || dueReviews.every((r) => r.done);
  const allFlashcardsDone = dueFlashcardsCount === 0;

  const isCompleted =
    tasks.length > 0 &&
    allTasksTheoryDone &&
    allTasksQuestionsDone &&
    allReviewsDone &&
    allFlashcardsDone;

  return {
    dateStr: todayStr,
    dayName: DAY_DISPLAY_NAMES[todayDayName] || todayDayName,
    tasks,
    dueFlashcardsCount,
    dueReviews,
    isCompleted,
    tomorrow: tomorrowPreview,
  };
}

/**
 * Calculates mission progress percentage and breakdown
 */
export function calculateMissionProgress(
  mission: AutopilotDayMission,
  reviewedFlashcardsTodayCount: number = 0
): {
  totalItems: number;
  completedItems: number;
  percentage: number;
} {
  let totalItems = 0;
  let completedItems = 0;

  // Each task has 2 checklist items: Theory and Questions target
  for (const t of mission.tasks) {
    totalItems += 2;
    if (t.theoryCompleted) completedItems += 1;
    if (t.questionsAttempted >= t.questionsTarget) completedItems += 1;
  }

  // Reviews checklist items
  for (const r of mission.dueReviews) {
    totalItems += 1;
    if (r.done) completedItems += 1;
  }

  // Flashcards deck item (if any due today or reviewed today)
  const totalCardsToday =
    (mission.dueFlashcardsCount || 0) +
    (reviewedFlashcardsTodayCount || mission.reviewedFlashcardsCount || 0);

  if (totalCardsToday > 0) {
    totalItems += 1;
    if (mission.dueFlashcardsCount === 0) {
      completedItems += 1;
    }
  }

  if (totalItems === 0) {
    return { totalItems: 0, completedItems: 0, percentage: 100 };
  }

  const percentage = Math.round((completedItems / totalItems) * 100);
  return { totalItems, completedItems, percentage };
}
