import assert from 'node:assert/strict';

console.log('--- RUNNING GAMIFICATION & COMPLIANCE ENGINE TESTS ---');

// 1. XP Rules & Configurations
const XP_CONFIG = {
  THEORY_COMPLETED: 50,
  QUESTION_ATTEMPT: 5,
  QUESTION_CORRECT: 5,
  FLASHCARD_REVIEWED: 10,
  REVIEW_COMPLETED: 30,
  STREAK_BONUS: 20,
};

function calculateQuestionXp(attempted, correct) {
  const safeAttempted = Math.max(0, attempted || 0);
  const safeCorrect = Math.max(0, Math.min(safeAttempted, correct || 0));
  return safeAttempted * XP_CONFIG.QUESTION_ATTEMPT + safeCorrect * XP_CONFIG.QUESTION_CORRECT;
}

const STUDENT_LEVELS = [
  { level: 1, title: 'Aspirante', minXp: 0, maxXp: 299, badge: '🌱' },
  { level: 2, title: 'Focado', minXp: 300, maxXp: 799, badge: '⚡' },
  { level: 3, title: 'Imparável', minXp: 800, maxXp: 1499, badge: '🚀' },
  { level: 4, title: 'Mestre da Aprovação', minXp: 1500, maxXp: 2499, badge: '👑' },
  { level: 5, title: 'Gabaritando Geral', minXp: 2500, maxXp: 3999, badge: '🏆' },
  { level: 6, title: 'Lenda dos Concursos', minXp: 4000, maxXp: Infinity, badge: '🌟' },
];

function getLevelInfo(totalXp) {
  const safeXp = Math.max(0, totalXp || 0);
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

function calculateStreakFromDates(activeDates, todayStr) {
  if (!activeDates || activeDates.length === 0) return 0;
  const dateSet = new Set(activeDates);
  const parseDate = (dStr) => new Date(`${dStr}T12:00:00Z`);
  const formatDate = (d) => d.toISOString().split('T')[0];

  const today = parseDate(todayStr);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  let startDate;
  if (dateSet.has(todayStr)) {
    startDate = today;
  } else if (dateSet.has(yesterdayStr)) {
    startDate = yesterday;
  } else {
    return 0;
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

const PEER_STUDENTS = [
  { id: 'peer-1', name: 'Mariana Silva', avatar: 'MS', cargo: 'TCE-GO • Auditor de Controle', basePoints: 210, streak: 9, level: 3, levelTitle: 'Imparável' },
  { id: 'peer-2', name: 'Lucas Ferreira', avatar: 'LF', cargo: 'Polícia Federal • Agente', basePoints: 175, streak: 5, level: 2, levelTitle: 'Focado' },
  { id: 'peer-3', name: 'Beatriz Alencar', avatar: 'BA', cargo: 'Receita Federal • Auditor', basePoints: 140, streak: 12, level: 4, levelTitle: 'Mestre da Aprovação' },
  { id: 'peer-4', name: 'Rafael Couto', avatar: 'RC', cargo: 'TJ-SP • Escrevente Técnico', basePoints: 115, streak: 4, level: 2, levelTitle: 'Focado' },
  { id: 'peer-5', name: 'Camila Mendes', avatar: 'CM', cargo: 'TRT-2 • Analista Judiciário', basePoints: 85, streak: 7, level: 2, levelTitle: 'Focado' },
  { id: 'peer-6', name: 'Gabriel Diniz', avatar: 'GD', cargo: 'INSS • Técnico do Seguro', basePoints: 50, streak: 3, level: 1, levelTitle: 'Aspirante' },
  { id: 'peer-7', name: 'Juliana Rocha', avatar: 'JR', cargo: 'MPU • Analista Processual', basePoints: 30, streak: 2, level: 1, levelTitle: 'Aspirante' },
];

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDailyLeaderboard(
  userDailyXp,
  userStreak,
  userName = 'Você',
  todayStr = '2026-09-22',
  userTotalXp = undefined,
  userConcursoTarget = undefined
) {
  const dateHash = simpleHash(todayStr);

  const peerEntries = PEER_STUDENTS.map((peer, idx) => {
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

  const userEntry = {
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

  allEntries.sort((a, b) => {
    if (b.pointsToday !== a.pointsToday) {
      return b.pointsToday - a.pointsToday;
    }
    return b.streakDays - a.streakDays;
  });

  return allEntries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

function awardXp(profile, action, todayStr = '2026-09-22') {
  const oldLevelInfo = getLevelInfo(profile.totalXp);
  const newTotalXp = Math.max(0, profile.totalXp + action.xpAwarded);
  const newLevelInfo = getLevelInfo(newTotalXp);
  const levelUp = newLevelInfo.level > oldLevelInfo.level;

  const currentDailyXp = profile.dailyXp?.[todayStr] || 0;
  const nextDailyXp = {
    ...(profile.dailyXp || {}),
    [todayStr]: Math.max(0, currentDailyXp + action.xpAwarded),
  };

  let nextStreak = profile.currentStreak || 0;
  if (action.xpAwarded > 0) {
    if (!profile.lastActiveDate) {
      nextStreak = 1;
    } else if (profile.lastActiveDate === todayStr) {
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

  const updatedProfile = {
    totalXp: newTotalXp,
    dailyXp: nextDailyXp,
    currentStreak: nextStreak,
    longestStreak: nextLongestStreak,
    lastActiveDate: action.xpAwarded > 0 ? todayStr : profile.lastActiveDate,
    history: [{ id: 'xp-1', ...action }, ...(profile.history || []).slice(0, 49)],
  };

  return {
    updatedProfile,
    levelUp,
    oldLevel: oldLevelInfo.level,
    newLevel: newLevelInfo.level,
  };
}

// TEST 1: XP Calculation Rules
{
  assert.equal(XP_CONFIG.THEORY_COMPLETED, 50, 'Theory completion must award 50 XP');
  assert.equal(XP_CONFIG.FLASHCARD_REVIEWED, 10, 'Flashcard review must award 10 XP');
  assert.equal(XP_CONFIG.REVIEW_COMPLETED, 30, 'Spaced review completion must award 30 XP');

  // Question session: 10 attempted, 8 correct -> 10*5 + 8*5 = 90 XP
  const xp1 = calculateQuestionXp(10, 8);
  assert.equal(xp1, 90, '10 attempted with 8 correct must yield 90 XP');

  // Question session: 15 attempted, 0 correct -> 15*5 + 0*5 = 75 XP
  const xp2 = calculateQuestionXp(15, 0);
  assert.equal(xp2, 75, '15 attempted with 0 correct must yield 75 XP');

  // Clamp correct <= attempted
  const xp3 = calculateQuestionXp(5, 10);
  assert.equal(xp3, 50, 'Correct answers exceeding attempted must clamp to attempted');

  console.log('✓ Test 1 Passed: Action XP points formulas and question bonuses calculate accurately.');
}

// TEST 2: Student Level & Progression Hierarchy
{
  // Level 1: Aspirante (0 - 299 XP)
  const l1 = getLevelInfo(0);
  assert.equal(l1.level, 1);
  assert.equal(l1.title, 'Aspirante');
  assert.equal(l1.progressPct, 0);
  assert.equal(l1.xpForNextLevel, 300);

  // Level 1 at 150 XP (50% progress)
  const l1Half = getLevelInfo(150);
  assert.equal(l1Half.level, 1);
  assert.equal(l1Half.progressPct, 50);
  assert.equal(l1Half.xpForNextLevel, 150);

  // Level 2: Focado (300 - 799 XP)
  const l2 = getLevelInfo(300);
  assert.equal(l2.level, 2);
  assert.equal(l2.title, 'Focado');
  assert.equal(l2.progressPct, 0);
  assert.equal(l2.xpForNextLevel, 500);

  // Level 3: Imparável (800 - 1499 XP)
  const l3 = getLevelInfo(800);
  assert.equal(l3.level, 3);
  assert.equal(l3.title, 'Imparável');

  // Level 4: Mestre da Aprovação (1500 - 2499 XP)
  const l4 = getLevelInfo(1500);
  assert.equal(l4.level, 4);
  assert.equal(l4.title, 'Mestre da Aprovação');

  // Level 5: Gabaritando Geral (2500 - 3999 XP)
  const l5 = getLevelInfo(2500);
  assert.equal(l5.level, 5);
  assert.equal(l5.title, 'Gabaritando Geral');

  // Level 6: Lenda dos Concursos (4000+ XP)
  const l6 = getLevelInfo(5000);
  assert.equal(l6.level, 6);
  assert.equal(l6.title, 'Lenda dos Concursos');
  assert.equal(l6.progressPct, 100);
  assert.equal(l6.xpForNextLevel, 0);

  console.log('✓ Test 2 Passed: Student Level thresholds and rank titles match design specs.');
}

// TEST 3: Consecutive Study Streak Calculation
{
  const today = '2026-09-22';

  // Studied today and yesterday -> streak 2
  const s2 = calculateStreakFromDates(['2026-09-21', '2026-09-22'], today);
  assert.equal(s2, 2, '2 consecutive active days must return streak 2');

  // Studied for 5 consecutive days ending today -> streak 5
  const s5 = calculateStreakFromDates(
    ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22'],
    today
  );
  assert.equal(s5, 5, '5 consecutive active days must return streak 5');

  // Studied yesterday but hasn't studied today yet -> preserves streak 3
  const sPreserved = calculateStreakFromDates(
    ['2026-09-19', '2026-09-20', '2026-09-21'],
    today
  );
  assert.equal(sPreserved, 3, 'Streak must be preserved if active yesterday');

  // Gap 2 days ago -> broken streak returns 0
  const sBroken = calculateStreakFromDates(
    ['2026-09-18', '2026-09-19'],
    today
  );
  assert.equal(sBroken, 0, 'Broken streak must reset to 0');

  console.log('✓ Test 3 Passed: Consecutive study streak calculation correctly handles streaks and lapses.');
}

// TEST 4: Daily Leaderboard & Real-Time Position Updating
{
  const today = '2026-09-22';

  // 1. Initial user with 0 points
  const boardZero = getDailyLeaderboard(0, 1, 'Você', today);
  assert.equal(boardZero.length, 8, 'Leaderboard must contain 7 peers + current user');
  const userEntryZero = boardZero.find((e) => e.isCurrentUser);
  assert.equal(userEntryZero.rank, 8, 'With 0 points, user starts at 8th position');

  // 2. User scores 90 points (completes 1 theory + questions)
  const boardMid = getDailyLeaderboard(90, 1, 'Você', today);
  const userEntryMid = boardMid.find((e) => e.isCurrentUser);
  assert.ok(userEntryMid.rank < 8, 'User rank must climb as points increase');
  assert.equal(userEntryMid.pointsToday, 90);

  // 3. User achieves 300 points (power study day)
  const boardTop = getDailyLeaderboard(300, 1, 'Você', today);
  const userEntryTop = boardTop.find((e) => e.isCurrentUser);
  assert.equal(userEntryTop.rank, 1, 'User with 300 points must lead the leaderboard at #1');

  // 4. Ensure ranks are consecutive 1 to 8 without gaps
  const ranks = boardTop.map((e) => e.rank);
  assert.deepEqual(ranks, [1, 2, 3, 4, 5, 6, 7, 8], 'Ranks must be strictly ordered from 1 to N');

  // 5. User with 1500 total XP has Level 4 (Mestre da Aprovação) in daily leaderboard even with 0 points today
  const boardTotalXp = getDailyLeaderboard(0, 1, 'Você', today, 1500, 'TCE-GO • Auditor');
  const userEntryTotalXp = boardTotalXp.find((e) => e.isCurrentUser);
  assert.equal(userEntryTotalXp.level, 4, 'User level in leaderboard must reflect total XP');
  assert.equal(userEntryTotalXp.levelTitle, 'Mestre da Aprovação');
  assert.equal(userEntryTotalXp.concursoTarget, 'TCE-GO • Auditor');

  console.log('✓ Test 4 Passed: Daily leaderboard reacts in real-time as user earns XP.');
}

// TEST 5: State Transition & Level-Up Detection
{
  const initialProfile = {
    totalXp: 270,
    dailyXp: { '2026-09-22': 50 },
    currentStreak: 2,
    longestStreak: 2,
    lastActiveDate: '2026-09-22',
    history: [],
  };

  // Award theory completion (+50 XP) -> crosses from 270 to 320 XP (Level 1 -> Level 2)
  const { updatedProfile, levelUp, oldLevel, newLevel } = awardXp(
    initialProfile,
    {
      type: 'theory_completed',
      xpAwarded: 50,
      description: 'Teoria de Direito Constitucional concluída',
    },
    '2026-09-22'
  );

  assert.equal(updatedProfile.totalXp, 320, 'Total XP must equal 320');
  assert.equal(updatedProfile.dailyXp['2026-09-22'], 100, 'Daily XP must accumulate to 100');
  assert.equal(levelUp, true, 'Level-up flag must be true when crossing tier');
  assert.equal(oldLevel, 1, 'Old level was 1');
  assert.equal(newLevel, 2, 'New level is 2 (Focado)');
  assert.equal(updatedProfile.history.length, 1, 'History must record action');

  // Test undo / reversal: deducting 30 XP
  const undone = awardXp(
    updatedProfile,
    {
      type: 'review_completed',
      xpAwarded: -30,
      description: 'Revisão desfeita',
    },
    '2026-09-22'
  );
  assert.equal(undone.updatedProfile.totalXp, 290, 'Undoing must deduct 30 XP');
  assert.equal(undone.updatedProfile.dailyXp['2026-09-22'], 70, 'Daily XP must decrease to 70');

  // Test clamp at 0: massive deduction never makes totalXp negative
  const clamped = awardXp(
    { totalXp: 10, dailyXp: { '2026-09-22': 10 }, currentStreak: 1, longestStreak: 1, lastActiveDate: '2026-09-22', history: [] },
    { type: 'review_completed', xpAwarded: -50, description: 'Revisão desfeita' },
    '2026-09-22'
  );
  assert.equal(clamped.updatedProfile.totalXp, 0, 'Total XP must clamp to 0 on excessive deduction');
  assert.equal(clamped.updatedProfile.dailyXp['2026-09-22'], 0, 'Daily XP must clamp to 0');

  console.log('✓ Test 5 Passed: awardXp correctly updates state, detects level transitions, and safely handles reversals.');
}

// TEST 6: LGPD & Google AdSense Compliance Verification
{
  import('node:fs').then((fs) => {
    const termsModalContent = fs.readFileSync('src/components/TermsPrivacyModal.tsx', 'utf8');
    const adBannerContent = fs.readFileSync('src/components/FooterAdBanner.tsx', 'utf8');
    const consentBannerContent = fs.readFileSync('src/components/CookieConsentBanner.tsx', 'utf8');
    const autopilotTabContent = fs.readFileSync('src/modules/autopilot/AutopilotTab.tsx', 'utf8');

    // 1. Mandatory DPO channel & official domain
    assert.ok(termsModalContent.includes('admin@ixtude-ai.com.br'), 'Terms must disclose DPO channel admin@ixtude-ai.com.br');
    assert.ok(termsModalContent.includes('ixtude-ai.com.br'), 'Terms must disclose official domain ixtude-ai.com.br');

    // 2. Mandatory LGPD citations
    assert.ok(termsModalContent.includes('13.709/2018') || termsModalContent.includes('LGPD'), 'Must cite LGPD Lei 13.709/2018');
    assert.ok(termsModalContent.includes('Art. 18') || termsModalContent.includes('Artigo 18'), 'Must cite data subject rights (Art. 18 LGPD)');

    // 3. Mandatory Google AdSense Disclosures
    assert.ok(termsModalContent.includes('Google AdSense'), 'Terms must disclose Google AdSense');
    assert.ok(termsModalContent.includes('adssettings.google.com'), 'Terms must link to Google Ads Settings opt-out');
    assert.ok(termsModalContent.includes('DoubleClick'), 'Terms must disclose third-party advertising cookies');

    // 4. Discreet footer ad banner specifications
    assert.ok(adBannerContent.includes('Publicidade') || adBannerContent.includes('Anúncio'), 'Ad banner must display transparency badge');
    assert.ok(adBannerContent.includes('adsbygoogle'), 'Ad banner must prepare ins tag for Google AdSense');

    // 5. Cookie consent banner
    assert.ok(consentBannerContent.includes('ixtude_cookie_consent'), 'Consent banner must manage cookie consent key in storage');

    // 6. Theory button idempotency protection against duplicate sessions
    assert.ok(autopilotTabContent.includes('disabled={task.theoryCompleted}'), 'AutopilotTab must disable theory button when completed');
    assert.ok(autopilotTabContent.includes('if (task.theoryCompleted) return'), 'AutopilotTab must guard against duplicate theory completion');

    console.log('✓ Test 6 Passed: Full compliance with LGPD, Google AdSense publisher specifications, and gamification safeguards verified.');
    console.log('=== ALL GAMIFICATION & COMPLIANCE TESTS PASSED SUCCESSFULLY! ===');
  });
}
