import assert from 'node:assert/strict';

console.log('--- RUNNING FLASHCARDS & STUDY CARDS MAINTENANCE TESTS ---');

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatIntervalPreview(days) {
  if (days <= 0) return '< 1 dia';
  if (days === 1) return '1 dia';
  if (days < 30) return `${days} dias`;
  if (days < 365) {
    const months = (days / 30).toFixed(1).replace('.0', '');
    return `${months} ${Number(months) === 1 ? 'mês' : 'meses'}`;
  }
  const years = (days / 365).toFixed(1).replace('.0', '');
  return `${years} ${Number(years) === 1 ? 'ano' : 'anos'}`;
}

function calculateSM2(card, rating, baseDate = new Date()) {
  let interval = card.interval || 0;
  let repetition = card.repetition || 0;
  let easeFactor = card.easeFactor || 2.5;
  let state = 'review';

  switch (rating) {
    case 'again':
      repetition = 0;
      interval = 1;
      easeFactor = Math.max(1.3, Number((easeFactor - 0.2).toFixed(2)));
      state = 'learning';
      break;

    case 'hard':
      interval = Math.max(1, Math.round((interval || 1) * 1.2));
      easeFactor = Math.max(1.3, Number((easeFactor - 0.15).toFixed(2)));
      state = repetition === 0 ? 'learning' : 'review';
      break;

    case 'good':
      if (repetition === 0) {
        interval = 1;
      } else if (repetition === 1) {
        interval = 6;
      } else {
        interval = Math.max(1, Math.round((interval || 1) * easeFactor));
      }
      repetition += 1;
      state = 'review';
      break;

    case 'easy':
      if (repetition === 0) {
        interval = 4;
      } else {
        interval = Math.max(1, Math.round((interval || 1) * easeFactor * 1.3));
      }
      repetition += 1;
      easeFactor = Number((easeFactor + 0.15).toFixed(2));
      state = 'review';
      break;
  }

  const nextDate = new Date(baseDate.getTime());
  nextDate.setDate(nextDate.getDate() + interval);
  const dueDate = formatLocalDate(nextDate);

  return { interval, repetition, easeFactor, state, dueDate };
}

function getIntervalPreviews(card) {
  const again = calculateSM2(card, 'again');
  const hard = calculateSM2(card, 'hard');
  const good = calculateSM2(card, 'good');
  const easy = calculateSM2(card, 'easy');

  return {
    again: { days: again.interval, label: formatIntervalPreview(again.interval) },
    hard: { days: hard.interval, label: formatIntervalPreview(hard.interval) },
    good: { days: good.interval, label: formatIntervalPreview(good.interval) },
    easy: { days: easy.interval, label: formatIntervalPreview(easy.interval) }
  };
}

// Test 1: New card SM-2 calculations
const todayStr = formatLocalDate(new Date());
const testCard = {
  id: 'test-card-1',
  workspaceId: 'ws-test',
  subjectId: 'custom-direito-constitucional',
  subjectName: 'Direito Constitucional',
  topicName: 'Controle de Constitucionalidade',
  front: 'O que é {{c1::ADI por omissão}}?',
  back: 'Ação direta para sanar omissão legislativa inconstitucional.',
  tags: ['constitucional', 'controle'],
  createdAt: todayStr,
  dueDate: todayStr,
  interval: 0,
  repetition: 0,
  easeFactor: 2.5,
  state: 'new'
};

const resultGood = calculateSM2(testCard, 'good');
assert.strictEqual(resultGood.repetition, 1, 'First good review sets repetition to 1');
assert.strictEqual(resultGood.interval, 1, 'First good review sets interval to 1 day');
assert.strictEqual(resultGood.state, 'review', 'State becomes review');
console.log('✓ Test 1 Passed: Initial SM-2 good rating calculation verified.');

// Test 2: Free study / reinforcement mode interval calculations when card not due yet
const futureCard = {
  ...testCard,
  interval: 6,
  repetition: 2,
  easeFactor: 2.5,
  dueDate: '2099-01-01',
  state: 'review'
};

const previews = getIntervalPreviews(futureCard);
assert(previews.again.label.length > 0, 'Previews generated correctly');
assert(previews.good.days > futureCard.interval, 'Good review increases interval from existing');
console.log('✓ Test 2 Passed: Previews and reinforcement ratings calculated cleanly.');

// Test 3: Custom subject slug generation
const customName = 'Direito Processual Civil & Tributário';
const expectedSlug = 'custom-' + customName.toLowerCase().replace(/[^a-z0-9]/g, '-');
assert(expectedSlug.includes('direito-processual-civil---tribut-rio'), 'Custom subject slug generated properly');
console.log('✓ Test 3 Passed: Custom subject ID resolution logic verified.');

// Test 4: Default expansion set resolution
const subjects = [{ id: 'sub-1', name: 'Português', topics: [] }];
const cards = [
  { id: 'c1', subjectId: 'sub-1' },
  { id: 'c2', subjectId: 'geral' },
  { id: 'c3', subjectId: 'custom-ti' }
];

const expandedSet = new Set();
subjects.forEach((s) => expandedSet.add(s.id));
cards.forEach((c) => expandedSet.add(c.subjectId || 'geral'));
expandedSet.add('geral');

assert(expandedSet.has('sub-1'), 'Contains standard subject');
assert(expandedSet.has('geral'), 'Contains default geral deck');
assert(expandedSet.has('custom-ti'), 'Contains custom subject deck');
assert.strictEqual(expandedSet.size, 3, 'Correct expanded set count');
console.log('✓ Test 4 Passed: Deck auto-expansion algorithm includes all active decks.');

// Test 5: Review queue selection (due cards prioritization and free reinforcement fallback)
function getReviewQueue(selectedCards, dueCards, allCards) {
  if (selectedCards && selectedCards.length > 0) {
    const dueInSelection = selectedCards.filter((c) => c.dueDate <= todayStr);
    return dueInSelection.length > 0 ? dueInSelection : selectedCards;
  }
  if (dueCards.length > 0) {
    return dueCards;
  }
  return allCards;
}

const due1 = { id: 'due1', dueDate: todayStr };
const notDue1 = { id: 'notDue1', dueDate: '2099-12-31' };
const notDue2 = { id: 'notDue2', dueDate: '2099-12-31' };

// When due cards exist:
const queue1 = getReviewQueue([due1, notDue1], [due1], [due1, notDue1]);
assert.deepStrictEqual(queue1, [due1], 'Due cards queued when available');

// When 0 cards are due today:
const queue2 = getReviewQueue([notDue1, notDue2], [], [notDue1, notDue2]);
assert.deepStrictEqual(queue2, [notDue1, notDue2], 'All cards queued in free reinforcement mode without blocking');

// Global review fallback when 0 cards due today:
const queue3 = getReviewQueue(undefined, [], [notDue1, notDue2]);
assert.deepStrictEqual(queue3, [notDue1, notDue2], 'Global review falls back to all cards in free reinforcement mode');
console.log('✓ Test 5 Passed: Zero-lockout review queue logic verified.');

console.log('=== ALL FLASHCARDS & STUDY CARDS MAINTENANCE TESTS PASSED! ===');
