import type { Subject, StudyBlock } from '../../types';

export const DAYS_ORDER = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

/**
 * Calculates the Monday date string (YYYY-MM-DD) for the week containing the given date.
 */
export function getMondayOfWeek(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday, 1 = Monday...
  const diff = date.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(date.setDate(diff));
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const dayNum = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayNum}`;
}

export function getTodayDayName(d: Date = new Date()): string {
  const day = d.getDay(); // 0 = Sunday, 1 = Monday...
  return DAYS_ORDER[day === 0 ? 6 : day - 1];
}

/**
 * Generates an optimized list of study blocks based on weekly hours, subject weights, subject status,
 * and interleaving to avoid fatigue. Allocates blocks to days of the week based on daily availability.
 */
export function generateStudyCycle(
  subjects: Subject[],
  weeklyHours: number,
  blockSizeMinutes: number = 90,
  dailyHours: { [day: string]: number } = { segunda: 4, terca: 4, quarta: 4, quinta: 4, sexta: 4, sabado: 2, domingo: 2 }
): StudyBlock[] {
  if (subjects.length === 0 || weeklyHours <= 0) return [];

  // 1. Filter subjects by status
  const maintenanceList = subjects.filter((s) => s.status === 'maintenance');
  const rawActiveList = subjects.filter((s) => s.status === 'active');
  const activeList = rawActiveList.slice(0, 5); // limit to 5 active

  // 2. Allocate fixed minutes for maintenance subjects
  const maintenanceMinutesTotal = maintenanceList.length * 45;
  const totalMinutes = weeklyHours * 60;
  const remainingActiveMinutes = Math.max(0, totalMinutes - maintenanceMinutesTotal);

  // 3. Determine target minutes and block counts for active subjects
  const totalActiveWeight = activeList.reduce((sum, s) => sum + s.weight, 0);

  interface SubjectPending {
    id: string;
    name: string;
    totalTargetMinutes: number;
    blocksCount: number;
    blocksRemaining: number;
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

    return {
      id: sub.id,
      name: sub.name,
      totalTargetMinutes: targetMinutes,
      blocksCount,
      blocksRemaining: blocksCount,
      isMaintenance: false,
    };
  });

  const pendingMaintenance: SubjectPending[] = maintenanceList.map((sub) => {
    return {
      id: sub.id,
      name: sub.name,
      totalTargetMinutes: 45,
      blocksCount: 1,
      blocksRemaining: 1,
      isMaintenance: true,
    };
  });

  const subjectList = [...pendingActive, ...pendingMaintenance];
  const totalBlocks = subjectList.reduce((sum, s) => sum + s.blocksCount, 0);

  // 4. Interleave blocks using greedy algorithm
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
    chosen.blocksRemaining -= 1;
    lastSubjectId = chosen.id;

    let duration = blockSizeMinutes;
    if (chosen.isMaintenance) {
      duration = 45;
    } else {
      if (chosen.blocksRemaining === 0) {
        const minutesPlannedBefore = (chosen.blocksCount - 1) * blockSizeMinutes;
        const calculatedDuration = chosen.totalTargetMinutes - minutesPlannedBefore;
        duration = Math.max(30, Math.min(150, calculatedDuration));
      }
    }

    blocks.push({
      subjectId: chosen.id,
      subjectName: chosen.name,
      durationMinutes: duration,
      completed: false,
      order: i + 1,
    });
  }

  // Map to final blocks
  const finalBlocks: StudyBlock[] = blocks.map((b, index) => ({
    ...b,
    id: `block-${index}-${Date.now()}`,
  }));

  // 5. Allocate blocks to days of the week sequentially
  return allocateDaysToBlocks(finalBlocks, dailyHours);
}

/**
 * Sequentially allocates study blocks to days of the week based on daily hours.
 */
export function allocateDaysToBlocks(
  blocks: StudyBlock[],
  dailyHours: { [day: string]: number }
): StudyBlock[] {
  let dayIdx = 0;
  let accumulatedMinutes = 0;

  return blocks.map((block) => {
    let allocated = false;
    
    while (dayIdx < 7) {
      const currentDay = DAYS_ORDER[dayIdx];
      const limitMinutes = (dailyHours[currentDay] || 0) * 60;

      if (limitMinutes === 0) {
        dayIdx++;
        accumulatedMinutes = 0;
        continue;
      }

      // Check if it fits on this day, or if it is the first block on this day (always allow at least one block if day has hours)
      if (accumulatedMinutes === 0 || accumulatedMinutes + block.durationMinutes <= limitMinutes) {
        block.dayAllocated = currentDay;
        accumulatedMinutes += block.durationMinutes;
        allocated = true;
        break;
      } else {
        // Move to the next day
        dayIdx++;
        accumulatedMinutes = 0;
      }
    }

    if (!allocated) {
      block.dayAllocated = 'domingo';
    }

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
  const startDayIdx = DAYS_ORDER.indexOf(startDayName);
  
  // Separate completed and incomplete blocks
  const completedBlocks = blocks.filter((b) => b.completed);
  const incompleteBlocks = blocks.filter((b) => !b.completed);

  // Sort incomplete blocks by their original execution order
  const sortedIncomplete = [...incompleteBlocks].sort((a, b) => a.order - b.order);

  let dayIdx = startDayIdx === -1 ? 0 : startDayIdx;
  let accumulatedMinutes = 0;

  // Calculate occupied minutes on each day by completed blocks
  const completedMinutesByDay: { [day: string]: number } = {};
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

      // Place block if it fits, or if the day has hours and we haven't placed anything on it yet
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
  // Find the promoted subject
  const promotedSubject = subjects.find((s) => s.id === promotedSubjectId);
  if (!promotedSubject || promotedSubject.status !== 'active') {
    return { updatedSubjects: subjects };
  }

  // Update its status to maintenance
  const updatedSubjects = subjects.map((s) => {
    if (s.id === promotedSubjectId) {
      return { ...s, status: 'maintenance' as const };
    }
    return s;
  });

  const promotedWeight = promotedSubject.weight;

  // Find all backlog subjects
  const backlogSubjects = updatedSubjects.filter((s) => s.status === 'backlog');
  if (backlogSubjects.length === 0) {
    return { updatedSubjects };
  }

  // Search hierarchy:
  // 1. Same weight
  // 2. Descending weight (promotedWeight - 1 down to 1)
  // 3. Fallback: Any backlog subject
  let subjectToPromote: Subject | undefined = undefined;

  // Search exact weight
  subjectToPromote = backlogSubjects.find((s) => s.weight === promotedWeight);

  // Search descending weights
  if (!subjectToPromote) {
    for (let w = promotedWeight - 1; w >= 1; w--) {
      subjectToPromote = backlogSubjects.find((s) => s.weight === w);
      if (subjectToPromote) break;
    }
  }

  // Fallback: Pick the first backlog subject
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

