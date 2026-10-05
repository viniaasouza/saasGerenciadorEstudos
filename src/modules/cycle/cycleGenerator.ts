import type { Subject, StudyBlock } from '../../types';

export const DAYS_ORDER = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const;
export type DayOfWeek = typeof DAYS_ORDER[number];

/**
 * Calculates the Sunday date string (YYYY-MM-DD) for the cycle week containing the given date.
 * The study cycle week starts on Sunday at 00:00:00 and ends on Saturday at 23:59:59.
 * When it turns from Saturday to Sunday, this returns the new Sunday date.
 */
export function getSundayOfWeek(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Domingo, 1 = Segunda... 6 = Sábado
  const sunday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
  const year = sunday.getFullYear();
  const month = String(sunday.getMonth() + 1).padStart(2, '0');
  const dayNum = String(sunday.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayNum}`;
}

/**
 * Returns the exact Date of Sunday at 00:00:00 local time for the current cycle week.
 * Used to filter study sessions so weekly hours reset when turning from Saturday to Sunday.
 */
export function getWeekStartDateTime(d: Date = new Date()): Date {
  const date = new Date(d);
  const day = date.getDay();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day, 0, 0, 0, 0);
}

/**
 * Backward compatibility alias for getSundayOfWeek.
 */
export function getMondayOfWeek(d: Date = new Date()): string {
  return getSundayOfWeek(d);
}

export function getTodayDayName(d: Date = new Date()): DayOfWeek {
  const day = d.getDay(); // 0 = Domingo, 1 = Segunda... 6 = Sábado
  return DAYS_ORDER[day];
}

/**
 * Normalizes daily study hours across Domingo to Sábado so that their sum matches weeklyHours.
 */
export function normalizeDailyHours(
  weeklyHours: number,
  dailyHours?: { [day: string]: number }
): { [day: string]: number } {
  const safeWeekly = Math.max(1, weeklyHours);
  const result: { [day: string]: number } = {};

  if (dailyHours) {
    const currentSum = DAYS_ORDER.reduce((sum, d) => sum + (dailyHours[d] || 0), 0);
    if (currentSum > 0) {
      const factor = safeWeekly / currentSum;
      let allocatedSoFar = 0;
      DAYS_ORDER.forEach((d, idx) => {
        if (idx === DAYS_ORDER.length - 1) {
          result[d] = Math.max(0, parseFloat((safeWeekly - allocatedSoFar).toFixed(1)));
        } else {
          const scaled = parseFloat(((dailyHours[d] || 0) * factor).toFixed(1));
          result[d] = scaled;
          allocatedSoFar += scaled;
        }
      });
      return result;
    }
  }

  // Default distribution: Seg-Sex heavier, Dom-Sáb lighter
  const defaultWeights: Record<string, number> = {
    domingo: 0.10,
    segunda: 0.15,
    terca: 0.15,
    quarta: 0.15,
    quinta: 0.15,
    sexta: 0.15,
    sabado: 0.15,
  };

  let allocated = 0;
  DAYS_ORDER.forEach((d, idx) => {
    if (idx === DAYS_ORDER.length - 1) {
      result[d] = Math.max(0, parseFloat((safeWeekly - allocated).toFixed(1)));
    } else {
      const val = parseFloat((safeWeekly * defaultWeights[d]).toFixed(1));
      result[d] = val;
      allocated += val;
    }
  });

  return result;
}

/**
 * Generates an optimized list of study blocks based on weekly hours, subject weights, subject status,
 * and interleaving to avoid fatigue. Allocates blocks to days of the week based on daily availability.
 */
export function generateStudyCycle(
  subjects: Subject[],
  weeklyHours: number,
  blockSizeMinutes: number = 90,
  dailyHours: { [day: string]: number } = { domingo: 2, segunda: 4, terca: 4, quarta: 4, quinta: 4, sexta: 4, sabado: 2 }
): StudyBlock[] {
  if (subjects.length === 0 || weeklyHours <= 0) return [];

  const effectiveDailyHours = normalizeDailyHours(weeklyHours, dailyHours);

  // 1. Filter subjects by status
  const maintenanceList = subjects.filter((s) => s.status === 'maintenance');
  const rawActiveList = subjects.filter((s) => s.status === 'active');
  const activeList = rawActiveList.slice(0, 5); // limit to 5 active subjects

  // 2. Allocate fixed minutes for maintenance subjects (45 min/week each)
  const maintenanceMinutesTotal = maintenanceList.length * 45;
  const totalMinutes = weeklyHours * 60;
  const remainingActiveMinutes = Math.max(0, totalMinutes - maintenanceMinutesTotal);

  // 3. Determine target minutes and block counts for active subjects based on weights
  const totalActiveWeight = activeList.reduce((sum, s) => sum + s.weight, 0);

  interface SubjectPending {
    id: string;
    name: string;
    totalTargetMinutes: number;
    blocksCount: number;
    blocksRemaining: number;
    blockDurations: number[];
    isMaintenance: boolean;
  }

  const pendingActive: SubjectPending[] = activeList.map((sub) => {
    const targetMinutes = totalActiveWeight > 0 
      ? Math.round(remainingActiveMinutes * (sub.weight / totalActiveWeight))
      : 0;

    let blocksCount = Math.floor(targetMinutes / blockSizeMinutes);
    const remainder = targetMinutes % blockSizeMinutes;

    if (remainder >= 30) {
      blocksCount += 1;
    }
    if (blocksCount === 0 && sub.weight > 0 && targetMinutes > 0) {
      blocksCount = 1;
    }

    const blockDurations: number[] = [];
    if (blocksCount > 0) {
      const baseMinutes = Math.floor(targetMinutes / blocksCount);
      let rem = targetMinutes % blocksCount;
      for (let b = 0; b < blocksCount; b++) {
        const extra = rem > 0 ? 1 : 0;
        if (rem > 0) rem--;
        blockDurations.push(baseMinutes + extra);
      }
    }

    return {
      id: sub.id,
      name: sub.name,
      totalTargetMinutes: targetMinutes,
      blocksCount,
      blocksRemaining: blocksCount,
      blockDurations,
      isMaintenance: false,
    };
  });

  const pendingMaintenance: SubjectPending[] = maintenanceList.map((sub) => ({
    id: sub.id,
    name: sub.name,
    totalTargetMinutes: 45,
    blocksCount: 1,
    blocksRemaining: 1,
    blockDurations: [45],
    isMaintenance: true,
  }));

  const subjectList = [...pendingActive, ...pendingMaintenance];
  const totalBlocks = subjectList.reduce((sum, s) => sum + s.blocksCount, 0);

  // 4. Interleave blocks using greedy algorithm to avoid fatigue
  const blocks: Omit<StudyBlock, 'id'>[] = [];
  let lastSubjectId = '';

  for (let i = 0; i < totalBlocks; i++) {
    const candidates = subjectList
      .filter((s) => s.blocksRemaining > 0)
      .sort((a, b) => {
        const aIsLast = a.id === lastSubjectId;
        const bIsLast = b.id === lastSubjectId;

        if (aIsLast && !bIsLast) return 1;
        if (!aIsLast && bIsLast) return -1;

        return b.blocksRemaining - a.blocksRemaining;
      });

    if (candidates.length === 0) break;

    const chosen = candidates[0];
    const duration = chosen.blockDurations.pop() || (chosen.isMaintenance ? 45 : blockSizeMinutes);
    chosen.blocksRemaining -= 1;
    lastSubjectId = chosen.id;

    blocks.push({
      subjectId: chosen.id,
      subjectName: chosen.name,
      durationMinutes: duration,
      completed: false,
      order: i + 1,
    });
  }

  // Map to final blocks with unique IDs
  const finalBlocks: StudyBlock[] = blocks.map((b, index) => ({
    ...b,
    id: `block-${index}-${Date.now()}`,
  }));

  // 5. Allocate blocks to days of the week sequentially across the normalized daily availability
  return allocateDaysToBlocks(finalBlocks, effectiveDailyHours);
}

/**
 * Sequentially allocates study blocks to days of the week based on daily hours.
 * Uses a balanced round-robin strategy so blocks are distributed across the whole week.
 */
export function allocateDaysToBlocks(
  blocks: StudyBlock[],
  dailyHours: { [day: string]: number }
): StudyBlock[] {
  if (blocks.length === 0) return [];

  const dayMinutesPlanned: Record<string, number> = {};
  const dayLimits: Record<string, number> = {};
  DAYS_ORDER.forEach((d) => {
    dayMinutesPlanned[d] = 0;
    dayLimits[d] = Math.round((dailyHours[d] || 0) * 60);
  });

  const activeDays = DAYS_ORDER.filter((d) => dayLimits[d] > 0);
  const fallbackDays = activeDays.length > 0 ? activeDays : [...DAYS_ORDER];

  let currentDayIdx = 0;

  return blocks.map((block) => {
    let chosenDay = '';
    let attempts = 0;

    while (attempts < fallbackDays.length) {
      const day = fallbackDays[currentDayIdx % fallbackDays.length];
      const limit = dayLimits[day] || 0;
      const planned = dayMinutesPlanned[day] || 0;

      if (planned === 0 || planned + block.durationMinutes <= limit) {
        chosenDay = day;
        dayMinutesPlanned[day] += block.durationMinutes;
        if (dayMinutesPlanned[day] >= limit) {
          currentDayIdx++;
        }
        break;
      } else {
        currentDayIdx++;
        attempts++;
      }
    }

    if (!chosenDay) {
      // Overflow handling: pick day with least scheduled minutes
      const sortedByUsage = [...fallbackDays].sort(
        (a, b) => (dayMinutesPlanned[a] || 0) - (dayMinutesPlanned[b] || 0)
      );
      chosenDay = sortedByUsage[0];
      dayMinutesPlanned[chosenDay] += block.durationMinutes;
    }

    block.dayAllocated = chosenDay;
    return block;
  });
}

/**
 * Re-allocates incomplete blocks starting from a specific day, preserving completed blocks.
 */
export function reallocateIncompleteBlocks(
  blocks: StudyBlock[],
  dailyHours: { [day: string]: number },
  startDayName: string
): StudyBlock[] {
  const startDayIdx = DAYS_ORDER.indexOf(startDayName as any);
  const effectiveStartIdx = startDayIdx === -1 ? 0 : startDayIdx;

  const completedBlocks = blocks.filter((b) => b.completed);
  const incompleteBlocks = blocks.filter((b) => !b.completed);

  if (incompleteBlocks.length === 0) return blocks;

  const sortedIncomplete = [...incompleteBlocks].sort((a, b) => a.order - b.order);

  // Remaining days in the cycle from startDay onwards
  const remainingDays = DAYS_ORDER.slice(effectiveStartIdx);
  const candidateDays = remainingDays.length > 0 ? remainingDays : [...DAYS_ORDER];

  const occupiedMinutes: Record<string, number> = {};
  const dayLimits: Record<string, number> = {};
  DAYS_ORDER.forEach((d) => {
    occupiedMinutes[d] = completedBlocks
      .filter((b) => b.dayAllocated === d)
      .reduce((sum, b) => sum + b.durationMinutes, 0);
    dayLimits[d] = Math.round((dailyHours[d] || 0) * 60);
  });

  const activeCandidateDays = candidateDays.filter((d) => (dayLimits[d] || 0) > 0);
  const fallbackDays = activeCandidateDays.length > 0 ? activeCandidateDays : candidateDays;

  let dayPointer = 0;

  const rescheduledIncomplete = sortedIncomplete.map((block) => {
    let chosenDay = '';
    let attempts = 0;

    while (attempts < fallbackDays.length) {
      const currentDay = fallbackDays[dayPointer % fallbackDays.length];
      const limit = dayLimits[currentDay] || 0;
      const occupied = occupiedMinutes[currentDay] || 0;

      if (occupied + block.durationMinutes <= limit || (occupied === 0 && limit > 0)) {
        chosenDay = currentDay;
        occupiedMinutes[currentDay] += block.durationMinutes;
        if (occupiedMinutes[currentDay] >= limit) {
          dayPointer++;
        }
        break;
      } else {
        dayPointer++;
        attempts++;
      }
    }

    if (!chosenDay) {
      const sortedByLoad = [...fallbackDays].sort(
        (a, b) => (occupiedMinutes[a] || 0) - (occupiedMinutes[b] || 0)
      );
      chosenDay = sortedByLoad[0];
      occupiedMinutes[chosenDay] += block.durationMinutes;
    }

    block.dayAllocated = chosenDay;
    return block;
  });

  const allBlocks = [...completedBlocks, ...rescheduledIncomplete];
  return allBlocks.sort((a, b) => a.order - b.order);
}

/**
 * Parses verticalized syllabus text into Subject, Topic and Subtopic list.
 */
export function parseVerticalSyllabus(text: string): Omit<Subject, 'targetHours'>[] {
  const lines = text.split('\n');
  const subjects: Omit<Subject, 'targetHours'>[] = [];
  
  let currentSubject: Omit<Subject, 'targetHours'> | null = null;
  let currentTopic: any = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const leadingSpaces = line.length - line.trimStart().length;
    const hasDoubleDash = trimmed.startsWith('--') || trimmed.startsWith('──');
    const hasSingleDash = !hasDoubleDash && (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•'));

    const cleanText = trimmed.replace(/^[-*•─\s]+/, '').trim();
    if (!cleanText) return;

    if (hasDoubleDash || leadingSpaces >= 4) {
      if (currentTopic) {
        currentTopic.subtopics.push({
          id: `subtopic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: cleanText,
          completed: false,
        });
      }
    } else if (hasSingleDash || (leadingSpaces >= 2 && leadingSpaces < 4)) {
      if (currentSubject) {
        currentTopic = {
          id: `topic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: cleanText,
          subtopics: [],
        };
        currentSubject.topics.push(currentTopic);
      }
    } else {
      currentSubject = {
        id: `subject-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: cleanText,
        weight: 3,
        status: 'active',
        topics: [],
      };
      currentTopic = null;
      subjects.push(currentSubject);
    }
  });

  return subjects;
}

/**
 * Promotes a subject to maintenance and pulls a compatible subject from the backlog.
 * Returns the updated subjects list and the name of the promoted backlog subject, if any.
 */
export function promoteSubjectAndReallocate(
  subjects: Subject[],
  promotedSubjectId: string
): { updatedSubjects: Subject[]; promotedBacklogSubjectName?: string } {
  const promotedSubject = subjects.find((s) => s.id === promotedSubjectId);
  if (!promotedSubject || promotedSubject.status !== 'active') {
    return { updatedSubjects: subjects };
  }

  const updatedSubjects = subjects.map((s) => {
    if (s.id === promotedSubjectId) {
      return { ...s, status: 'maintenance' as const };
    }
    return s;
  });

  const promotedWeight = promotedSubject.weight;
  const backlogSubjects = updatedSubjects.filter((s) => s.status === 'backlog');
  if (backlogSubjects.length === 0) {
    return { updatedSubjects };
  }

  let subjectToPromote: Subject | undefined = undefined;
  subjectToPromote = backlogSubjects.find((s) => s.weight === promotedWeight);

  if (!subjectToPromote) {
    for (let w = promotedWeight - 1; w >= 1; w--) {
      subjectToPromote = backlogSubjects.find((s) => s.weight === w);
      if (subjectToPromote) break;
    }
  }

  if (!subjectToPromote) {
    subjectToPromote = backlogSubjects[0];
  }

  if (subjectToPromote) {
    const targetId = subjectToPromote.id;
    const finalSubjects = updatedSubjects.map((s) => {
      if (s.id === targetId) {
        return { ...s, status: 'active' as const };
      }
      return s;
    });

    return {
      updatedSubjects: finalSubjects,
      promotedBacklogSubjectName: subjectToPromote.name,
    };
  }

  return { updatedSubjects };
}
