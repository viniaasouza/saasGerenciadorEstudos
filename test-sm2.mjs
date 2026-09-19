import assert from 'node:assert/strict';

// Replicate or import sm2 logic in pure JS for automated node testing
function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

console.log('--- Testing SM-2 Spaced Repetition Engine ---');

// Test 1: Brand New Card rated "Errei" (Again)
{
  const newCard = {
    id: 'test-1',
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    state: 'new'
  };
  const res = calculateSM2(newCard, 'again', new Date('2026-09-12T12:00:00'));
  assert.equal(res.interval, 1, 'Again on new card must have interval 1');
  assert.equal(res.repetition, 0, 'Again reset repetition to 0');
  assert.equal(res.easeFactor, 2.3, 'Ease factor drops by 0.2');
  assert.equal(res.state, 'learning', 'State transitions to learning');
  assert.equal(res.dueDate, '2026-09-13', 'Due date is tomorrow');
  console.log('✔ Test 1 passed: New card Again rating');
}

// Test 2: Ease factor floor at 1.3
{
  const lowCard = {
    id: 'test-2',
    interval: 1,
    repetition: 0,
    easeFactor: 1.4,
    state: 'learning'
  };
  const res = calculateSM2(lowCard, 'again', new Date('2026-09-12T12:00:00'));
  assert.equal(res.easeFactor, 1.3, 'Ease factor must not drop below 1.3');
  console.log('✔ Test 2 passed: Ease factor minimum floor 1.3');
}

// Test 3: New Card rated "Bom" (Good) progression
{
  const newCard = {
    id: 'test-3',
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    state: 'new'
  };
  // 1st review: Good
  const rev1 = calculateSM2(newCard, 'good', new Date('2026-09-12T12:00:00'));
  assert.equal(rev1.interval, 1, 'First good review sets interval 1');
  assert.equal(rev1.repetition, 1, 'First good review increments repetition to 1');
  assert.equal(rev1.state, 'review');

  // 2nd review: Good
  const card2 = { ...newCard, ...rev1 };
  const rev2 = calculateSM2(card2, 'good', new Date('2026-09-13T12:00:00'));
  assert.equal(rev2.interval, 6, 'Second good review sets interval 6');
  assert.equal(rev2.repetition, 2, 'Second good review increments repetition to 2');

  // 3rd review: Good -> interval = Math.round(6 * 2.5) = 15
  const card3 = { ...card2, ...rev2 };
  const rev3 = calculateSM2(card3, 'good', new Date('2026-09-19T12:00:00'));
  assert.equal(rev3.interval, 15, 'Third good review sets interval 15 (6 * 2.5)');
  assert.equal(rev3.repetition, 3);
  console.log('✔ Test 3 passed: SM-2 Good review progression (1 -> 6 -> 15)');
}

// Test 4: New Card rated "Fácil" (Easy)
{
  const newCard = {
    id: 'test-4',
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    state: 'new'
  };
  const res = calculateSM2(newCard, 'easy', new Date('2026-09-12T12:00:00'));
  assert.equal(res.interval, 4, 'Easy on new card sets interval 4');
  assert.equal(res.repetition, 1);
  assert.equal(res.easeFactor, 2.65, 'Easy increases easeFactor by 0.15');
  assert.equal(res.state, 'review');
  console.log('✔ Test 4 passed: Easy rating on new card');
}

// Test 5: Mature card rated "Difícil" (Hard)
{
  const matureCard = {
    id: 'test-5',
    interval: 10,
    repetition: 3,
    easeFactor: 2.5,
    state: 'review'
  };
  const res = calculateSM2(matureCard, 'hard', new Date('2026-09-12T12:00:00'));
  assert.equal(res.interval, 12, 'Hard multiplies interval by 1.2 (10 * 1.2 = 12)');
  assert.equal(res.repetition, 3, 'Hard does not increment repetition');
  assert.equal(res.easeFactor, 2.35, 'Hard decreases easeFactor by 0.15');
  console.log('✔ Test 5 passed: Hard rating on mature card');
}

// Test 6: Anki Markdown to HTML conversion
function formatMarkdownToAnkiHtml(text) {
  if (!text) return '';
  return text
    .replace(/\t/g, '    ')
    .replace(/^###\s+(.*)$/gm, '<h4>$1</h4>')
    .replace(/^##\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^#\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^[-*]\s+(.*)$/gm, '• $1<br>')
    .replace(/^(\d+)\.\s+(.*)$/gm, '<b>$1.</b> $2<br>')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\r\n/g, '<br>')
    .replace(/\n/g, '<br>');
}

{
  const input = '# Título\n**Importante**: *Atenção*\n`const x = 1;`\n1. Primeiro\n2. Segundo';
  const html = formatMarkdownToAnkiHtml(input);
  assert.ok(html.includes('<h2>Título</h2>'), 'Must convert # to <h2>');
  assert.ok(html.includes('<b>Importante</b>'), 'Must convert ** to <b>');
  assert.ok(html.includes('<i>Atenção</i>'), 'Must convert * to <i>');
  assert.ok(html.includes('<code>const x = 1;</code>'), 'Must convert ` to <code>');
  assert.ok(html.includes('<b>1.</b> Primeiro'), 'Must convert numbered list');
  console.log('✔ Test 6 passed: Anki Markdown to HTML conversion');
}

// Test 7: Interval previews formatting
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

{
  assert.equal(formatIntervalPreview(0), '< 1 dia');
  assert.equal(formatIntervalPreview(1), '1 dia');
  assert.equal(formatIntervalPreview(6), '6 dias');
  assert.equal(formatIntervalPreview(30), '1 mês');
  assert.equal(formatIntervalPreview(60), '2 meses');
  assert.equal(formatIntervalPreview(365), '1 ano');
  assert.equal(formatIntervalPreview(730), '2 anos');
  console.log('✔ Test 7 passed: Interval preview string formatting');
}

// Test 8: Cloze deletion regex
{
  const clozeRegex = /\{\{c\d+::(.*?)(?:::([^}]*))?\}\}/g;
  const sample = 'O princípio da {{c1::legalidade}} e {{c2::impessoalidade::dica}} são da CF.';
  const matches = [...sample.matchAll(clozeRegex)];
  assert.equal(matches.length, 2);
  assert.equal(matches[0][1], 'legalidade');
  assert.equal(matches[1][1], 'impessoalidade');
  assert.equal(matches[1][2], 'dica');
  console.log('✔ Test 8 passed: Cloze deletion parser matches multiple clozes');
}

console.log('--- ALL SM-2 TESTS PASSED SUCCESSFULLY! ---');
