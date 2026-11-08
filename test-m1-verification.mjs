import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- RUNNING MILESTONE 1 VERIFICATION SUITE ---');

// 1. Verify public/ads.txt
{
  const adsTxtPath = path.join(__dirname, 'public', 'ads.txt');
  assert.ok(fs.existsSync(adsTxtPath), 'public/ads.txt must exist on disk');
  const content = fs.readFileSync(adsTxtPath, 'utf-8').trim();
  const expectedLine = 'google.com, pub-9810973652333319, DIRECT, f08c47fec0942fa0';
  assert.equal(content, expectedLine, 'public/ads.txt must contain the exact Google AdSense directive');
  console.log('✓ Test M1-1 Passed: public/ads.txt exists and matches exact specification.');
}

// 2. Verify index.html AdSense script tag
{
  const indexPath = path.join(__dirname, 'index.html');
  assert.ok(fs.existsSync(indexPath), 'index.html must exist');
  const content = fs.readFileSync(indexPath, 'utf-8');
  assert.ok(
    content.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9810973652333319'),
    'index.html must include the official Google AdSense script tag with client ca-pub-9810973652333319'
  );
  assert.ok(
    content.includes('crossorigin="anonymous"'),
    'index.html AdSense script tag must include crossorigin="anonymous"'
  );
  console.log('✓ Test M1-2 Passed: index.html contains official AdSense script tag.');
}

// 3. Verify FooterAdBanner default configuration and LGPD consent check
{
  const footerAdPath = path.join(__dirname, 'src', 'components', 'FooterAdBanner.tsx');
  assert.ok(fs.existsSync(footerAdPath), 'FooterAdBanner.tsx must exist');
  const content = fs.readFileSync(footerAdPath, 'utf-8');
  assert.ok(content.includes('ca-pub-9810973652333319'), 'FooterAdBanner must reference default pub id ca-pub-9810973652333319');
  assert.ok(content.includes('3416652040'), 'FooterAdBanner must reference default slot id 3416652040');
  assert.ok(content.includes('ixtude_cookie_consent'), 'FooterAdBanner must check ixtude_cookie_consent storage key');
  assert.ok(content.includes('overflowX: \'hidden\'') || content.includes('overflow-x'), 'FooterAdBanner must have overflow constraints');
  console.log('✓ Test M1-3 Passed: FooterAdBanner has default props, LGPD gating, and responsive constraints.');
}

// 4. Verify database.ts recordFlashcardStudySession default 30s
{
  const dbPath = path.join(__dirname, 'src', 'db', 'database.ts');
  const content = fs.readFileSync(dbPath, 'utf-8');
  assert.ok(
    content.includes('durationSeconds: number = 30'),
    'database.ts recordFlashcardStudySession must default to durationSeconds = 30'
  );
  assert.ok(
    content.includes("notes: 'Revisão de flashcard (30s)'"),
    'database.ts recordFlashcardStudySession note must specify (30s)'
  );
  console.log('✓ Test M1-4 Passed: database.ts sets flashcard duration default to 30s.');
}

// 5. Verify TimerTab countdown and manual study liquid seconds computation
{
  const timerPath = path.join(__dirname, 'src', 'modules', 'timer', 'TimerTab.tsx');
  const content = fs.readFileSync(timerPath, 'utf-8');
  assert.ok(
    content.includes('setModalDurationMinutes(liquidMinutes)'),
    'TimerTab must set modalDurationMinutes on countdown completion'
  );
  assert.ok(
    !content.includes('useState<number>(45)'),
    'TimerTab modalDurationMinutes must not be statically hardcoded to 45'
  );
  assert.ok(
    content.includes("const isVideoStudy = studyType === 'videoaula';"),
    'TimerTab must only apply video playback speed to videoaula, not teoria'
  );
  console.log('✓ Test M1-5 Passed: TimerTab correctly calculates liquid study minutes without 45m inflation.');
}

console.log('=== ALL MILESTONE 1 VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
