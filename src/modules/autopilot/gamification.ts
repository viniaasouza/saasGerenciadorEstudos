import type {
  GamificationActionType,
  GamificationAction,
  StudentLevel,
  GamificationProfile,
  LeaderboardEntry,
} from '../../types';

export const XP_CONFIG = {
  THEORY_COMPLETED: 50,
  QUESTION_ATTEMPT: 5,
  QUESTION_CORRECT: 5,
  FLASHCARD_REVIEWED: 10,
  REVIEW_COMPLETED: 30,
  STREAK_BONUS: 20,
} as const;

export const STUDENT_LEVELS: StudentLevel[] = [
  { level: 1, title: 'Aspirante', minXp: 0, maxXp: 299, badge: '🌱' },
  { level: 2, title: 'Focado', minXp: 300, maxXp: 799, badge: '⚡' },
  { level: 3, title: 'Imparável', minXp: 800, maxXp: 1499, badge: '🚀' },
  { level: 4, title: 'Mestre da Aprovação', minXp: 1500, maxXp: 2499, badge: '👑' },
  { level: 5, title: 'Gabaritando Geral', minXp: 2500, maxXp: 3999, badge: '🏆' },
  { level: 6, title: 'Lenda dos Concursos', minXp: 4000, maxXp: Infinity, badge: '🌟' },
];

/**
 * Calculates XP for a question session: +5 XP per question attempted + 5 XP per correct question.
 */
export function calculateQuestionXp(attempted: number, correct: number): number {
  const safeAttempted = Math.max(0, attempted || 0);
  const safeCorrect = Math.max(0, Math.min(safeAttempted, correct || 0));
  return safeAttempted * XP_CONFIG.QUESTION_ATTEMPT + safeCorrect * XP_CONFIG.QUESTION_CORRECT;
}

export interface LevelInfo {
  level: number;
  title: string;
  badge: string;
  currentXp: number;
  minXp: number;
  maxXp: number;
  progressPct: number;
  xpForNextLevel: number;
}

/**
 * Returns detailed level and progression data based on total XP.
 */
export function getLevelInfo(totalXp: number): LevelInfo {
  const safeXp = Math.max(0, totalXp || 0);
  
  // Find current level tier
  let tier = STUDENT_LEVELS[0];
  for (let i = STUDENT_LEVELS.length - 1; i >= 0; i--) {
    if (safeXp >= STUDENT_LEVELS[i].minXp) {
      tier = STUDENT_LEVELS[i];
      break;
    }
  }

  const isMaxTier = tier.level === STUDENT_LEVELS[STUDENT_LEVELS.length - 1].level;

  let progressPct = 100;
  let xpForNextLevel = 0;

  if (!isMaxTier) {
    const range = tier.maxXp - tier.minXp + 1;
    const gainedInRange = safeXp - tier.minXp;
    progressPct = Math.min(100, Math.max(0, Math.round((gainedInRange / range) * 100)));
    xpForNextLevel = tier.maxXp + 1 - safeXp;
  }

  return {
    level: tier.level,
    title: tier.title,
    badge: tier.badge,
    currentXp: safeXp,
    minXp: tier.minXp,
    maxXp: tier.maxXp,
    progressPct,
    xpForNextLevel,
  };
}

/**
 * Calculates consecutive study days (streak) from a list of active YYYY-MM-DD dates.
 */
export function calculateStreakFromDates(
  activeDates: string[],
  todayStr: string = new Date().toISOString().split('T')[0]
): number {
  if (!activeDates || activeDates.length === 0) return 0;

  const dateSet = new Set(activeDates);
  const parseDate = (dStr: string) => new Date(`${dStr}T12:00:00Z`);
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const today = parseDate(todayStr);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  let startDate: Date;
  if (dateSet.has(todayStr)) {
    startDate = today;
  } else if (dateSet.has(yesterdayStr)) {
    startDate = yesterday;
  } else {
    return 0; // Streak broken
  }

  let streak = 0;
  const cursor = new Date(startDate);

  while (true) {
    const currentStr = formatDate(cursor);
    if (dateSet.has(currentStr)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Peer concurseiro profiles for daily leaderboard simulation
 */
const PEER_STUDENTS = [
  { id: 'peer-1', name: 'Mariana Silva', avatar: 'MS', cargo: 'TCE-GO • Auditor de Controle', basePoints: 210, streak: 9, level: 3, levelTitle: 'Imparável' },
  { id: 'peer-2', name: 'Lucas Ferreira', avatar: 'LF', cargo: 'Polícia Federal • Agente', basePoints: 175, streak: 5, level: 2, levelTitle: 'Focado' },
  { id: 'peer-3', name: 'Beatriz Alencar', avatar: 'BA', cargo: 'Receita Federal • Auditor', basePoints: 140, streak: 12, level: 4, levelTitle: 'Mestre da Aprovação' },
  { id: 'peer-4', name: 'Rafael Couto', avatar: 'RC', cargo: 'TJ-SP • Escrevente Técnico', basePoints: 115, streak: 4, level: 2, levelTitle: 'Focado' },
  { id: 'peer-5', name: 'Camila Mendes', avatar: 'CM', cargo: 'TRT-2 • Analista Judiciário', basePoints: 85, streak: 7, level: 2, levelTitle: 'Focado' },
  { id: 'peer-6', name: 'Gabriel Diniz', avatar: 'GD', cargo: 'INSS • Técnico do Seguro', basePoints: 50, streak: 3, level: 1, levelTitle: 'Aspirante' },
  { id: 'peer-7', name: 'Juliana Rocha', avatar: 'JR', cargo: 'MPU • Analista Processual', basePoints: 30, streak: 2, level: 1, levelTitle: 'Aspirante' },
];

/**
 * Simple pseudo-random hash generator for deterministic daily scores based on date string
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Builds the daily leaderboard ranking with the current user inserted in real-time.
 */
export function getDailyLeaderboard(
  userDailyXp: number,
  userStreak: number,
  userName: string = 'Você',
  todayStr: string = new Date().toISOString().split('T')[0],
  userTotalXp?: number,
  userConcursoTarget?: string
): LeaderboardEntry[] {
  const dateHash = simpleHash(todayStr);

  const peerEntries: LeaderboardEntry[] = PEER_STUDENTS.map((peer, idx) => {
    // Slight deterministic daily variance of +/- 25 points based on date
    const variance = ((dateHash + idx * 37) % 51) - 25;
    const finalPoints = Math.max(20, peer.basePoints + variance);
    return {
      id: peer.id,
      name: peer.name,
      avatar: peer.avatar,
      concursoTarget: peer.cargo,
      pointsToday: finalPoints,
      streakDays: peer.streak,
      levelTitle: peer.levelTitle,
      level: peer.level,
      isCurrentUser: false,
    };
  });

  const xpForLevel = typeof userTotalXp === 'number' && userTotalXp >= 0 ? userTotalXp : userDailyXp;
  const currentUserLevel = getLevelInfo(xpForLevel);

  const cleanConcursoTarget =
    userConcursoTarget && userConcursoTarget.trim()
      ? userConcursoTarget.trim()
      : 'Seu Concurso Alvo';

  const userEntry: LeaderboardEntry = {
    id: 'user-current',
    name: userName && userName !== 'Visitante' ? userName : 'Você (Concurseiro)',
    avatar: userName && userName !== 'Visitante' && userName !== 'Você' ? userName.slice(0, 2).toUpperCase() : 'EU',
    concursoTarget: cleanConcursoTarget,
    pointsToday: Math.max(0, userDailyXp || 0),
    streakDays: Math.max(1, userStreak || 1),
    levelTitle: currentUserLevel.title,
    level: currentUserLevel.level,
    isCurrentUser: true,
  };

  const allEntries = [...peerEntries, userEntry];

  // Sort descending by points, break ties with streak
  allEntries.sort((a, b) => {
    if (b.pointsToday !== a.pointsToday) {
      return b.pointsToday - a.pointsToday;
    }
    return b.streakDays - a.streakDays;
  });

  // Assign ranks
  return allEntries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

/**
 * Helper to compute user's rank and distance to the student ahead.
 */
export function getUserLeaderboardStanding(leaderboard: LeaderboardEntry[]): {
  userEntry: LeaderboardEntry | undefined;
  rank: number;
  totalUsers: number;
  diffToNext: number;
  aheadUser?: LeaderboardEntry;
} {
  const userIdx = leaderboard.findIndex((e) => e.isCurrentUser);
  if (userIdx === -1) {
    return { userEntry: undefined, rank: 0, totalUsers: leaderboard.length, diffToNext: 0 };
  }

  const userEntry = leaderboard[userIdx];
  const rank = userIdx + 1;
  const aheadUser = userIdx > 0 ? leaderboard[userIdx - 1] : undefined;
  const diffToNext = aheadUser ? Math.max(0, aheadUser.pointsToday - userEntry.pointsToday + 5) : 0;

  return {
    userEntry,
    rank,
    totalUsers: leaderboard.length,
    diffToNext,
    aheadUser,
  };
}

/**
 * Pure state transition function to award XP and update streak and level.
 */
export function awardXp(
  profile: GamificationProfile,
  action: {
    type: GamificationActionType;
    xpAwarded: number;
    description: string;
    workspaceId?: string;
  },
  todayStr: string = new Date().toISOString().split('T')[0]
): {
  updatedProfile: GamificationProfile;
  levelUp: boolean;
  oldLevel: number;
  newLevel: number;
} {
  const oldLevelInfo = getLevelInfo(profile.totalXp);
  const newTotalXp = Math.max(0, profile.totalXp + action.xpAwarded);
  const newLevelInfo = getLevelInfo(newTotalXp);
  const levelUp = newLevelInfo.level > oldLevelInfo.level;

  const currentDailyXp = profile.dailyXp?.[todayStr] || 0;
  const nextDailyXp = {
    ...(profile.dailyXp || {}),
    [todayStr]: Math.max(0, currentDailyXp + action.xpAwarded),
  };

  // Streak logic (only increment on positive XP gain)
  let nextStreak = profile.currentStreak || 0;
  if (action.xpAwarded > 0) {
    if (!profile.lastActiveDate) {
      nextStreak = 1;
    } else if (profile.lastActiveDate === todayStr) {
      // Already active today, streak doesn't increase multiple times on the same day
      nextStreak = Math.max(1, profile.currentStreak);
    } else {
      const lastDate = new Date(`${profile.lastActiveDate}T12:00:00Z`);
      const todayDate = new Date(`${todayStr}T12:00:00Z`);
      const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        nextStreak = (profile.currentStreak || 0) + 1;
      } else {
        nextStreak = 1;
      }
    }
  } else {
    nextStreak = Math.max(0, profile.currentStreak || 0);
  }

  const nextLongestStreak = Math.max(profile.longestStreak || 0, nextStreak);

  const newAction: GamificationAction = {
    id: `xp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: action.type,
    xpAwarded: action.xpAwarded,
    timestamp: new Date().toISOString(),
    description: action.description,
    workspaceId: action.workspaceId,
  };

  const updatedProfile: GamificationProfile = {
    totalXp: newTotalXp,
    dailyXp: nextDailyXp,
    currentStreak: nextStreak,
    longestStreak: nextLongestStreak,
    lastActiveDate: action.xpAwarded > 0 ? todayStr : profile.lastActiveDate,
    history: [newAction, ...(profile.history || []).slice(0, 49)], // keep last 50 actions
  };

  return {
    updatedProfile,
    levelUp,
    oldLevel: oldLevelInfo.level,
    newLevel: newLevelInfo.level,
  };
}
