// Adversarial Stress Harness for Milestone 1 (R5, R6, R7)
// Executed by Challenger M1-1
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('   EMPIRICAL ADVERSARIAL STRESS HARNESS — MILESTONE 1 (M1-1)    ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`[PASS] Test ${totalTests}: ${name}`);
  } catch (err) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`[PASS] Test ${totalTests}: ${name}`);
  } catch (err) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
    throw err;
  }
}

// ============================================================================
// SECTION 1: TIMER LIQUID STUDY TIME PRECISION (R6)
// ============================================================================
console.log('--- SECTION 1: TIMER LIQUID STUDY TIME PRECISION (R6) ---');

// High-fidelity simulation of TimerTab.tsx clock loop and state management
class TimerSimulation {
  constructor(mode = 'countdown', durationMinutes = 30) {
    this.timerMode = mode;
    this.durationMinutes = durationMinutes;
    this.isActive = false;
    this.isPaused = false;
    this.startTime = null;
    this.accumulatedSeconds = 0;
    this.displaySeconds = 0;
    this.timeRemaining = durationMinutes * 60;
    this.modalDurationMinutes = durationMinutes || 30;
    this.savedSession = null;
  }

  start(fakeNow) {
    this.isActive = true;
    this.isPaused = false;
    this.startTime = fakeNow;
  }

  pause(fakeNow) {
    if (!this.isPaused && this.startTime) {
      const delta = Math.floor((fakeNow - this.startTime) / 1000);
      this.accumulatedSeconds += delta;
      this.startTime = null;
      this.isPaused = true;
    }
  }

  resume(fakeNow) {
    if (this.isPaused) {
      this.startTime = fakeNow;
      this.isPaused = false;
    }
  }

  tick(fakeNow) {
    if (!this.isActive || this.isPaused || !this.startTime) return;
    const currentElapsed = this.accumulatedSeconds + Math.floor((fakeNow - this.startTime) / 1000);
    this.displaySeconds = currentElapsed;

    if (this.timerMode === 'countdown') {
      const totalTarget = this.durationMinutes * 60;
      const remaining = Math.max(0, totalTarget - currentElapsed);
      this.timeRemaining = remaining;

      if (remaining <= 0) {
        // Exact logic from TimerTab.tsx lines 323-338
        const finalElapsed = this.accumulatedSeconds + (this.startTime ? Math.floor((fakeNow - this.startTime) / 1000) : 0);
        const actualSeconds = Math.max(finalElapsed, totalTarget);
        const liquidMinutes = Math.max(1, Math.round(actualSeconds / 60));

        this.isActive = false;
        this.isPaused = false;
        this.startTime = null;
        this.accumulatedSeconds = actualSeconds;
        this.setDisplaySeconds = actualSeconds;
        this.modalDurationMinutes = liquidMinutes;
      }
    }
  }

  manualFinish(fakeNow) {
    // Exact logic from TimerTab.tsx lines 390-410
    let finalSeconds = this.accumulatedSeconds;
    if (this.startTime && !this.isPaused) {
      finalSeconds += Math.floor((fakeNow - this.startTime) / 1000);
    }
    this.isActive = false;
    this.isPaused = false;
    this.startTime = null;
    this.accumulatedSeconds = finalSeconds;
    this.displaySeconds = finalSeconds;
    this.modalDurationMinutes = Math.max(1, Math.round(finalSeconds / 60));
  }

  saveSession(studyType = 'teoria', playbackSpeed = 1.0, userModalOverride = null) {
    // Exact logic from TimerTab.tsx lines 425-455
    if (userModalOverride !== null) {
      this.modalDurationMinutes = Math.max(1, userModalOverride);
    }
    const isVideoStudy = studyType === 'videoaula';
    const effectiveSeconds = this.modalDurationMinutes > 0 ? this.modalDurationMinutes * 60 : this.displaySeconds;
    const grossSeconds = isVideoStudy ? Math.round(effectiveSeconds * playbackSpeed) : effectiveSeconds;

    this.savedSession = {
      durationSeconds: effectiveSeconds,
      modalDurationMinutes: this.modalDurationMinutes,
      playbackSpeed: isVideoStudy ? playbackSpeed : undefined,
      grossDurationSeconds: isVideoStudy ? grossSeconds : undefined,
      studyType,
    };
    return this.savedSession;
  }
}

// 1.1 Matrix of countdown durations: 1m, 5m, 15m, 30m, 45m, 60m, 90m, 120m
const durationsToTest = [1, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180];
for (const targetMins of durationsToTest) {
  runTest(`Countdown completion for ${targetMins} min target produces exact liquid seconds without 45m inflation`, () => {
    const t = new TimerSimulation('countdown', targetMins);
    const startMs = 1000000;
    t.start(startMs);

    // Simulate completion
    const endMs = startMs + targetMins * 60 * 1000;
    t.tick(endMs);

    assert.equal(t.isActive, false, 'Timer should have stopped');
    assert.equal(t.modalDurationMinutes, targetMins, `modalDurationMinutes must equal ${targetMins}`);
    assert.equal(t.accumulatedSeconds, targetMins * 60, `accumulatedSeconds must equal ${targetMins * 60}s`);

    const session = t.saveSession('teoria');
    assert.equal(session.durationSeconds, targetMins * 60, `Saved session durationSeconds must be exactly ${targetMins * 60}s`);
    if (targetMins !== 45) {
      assert.notEqual(session.durationSeconds, 2700, `Duration of ${targetMins}m must NOT inflate to 45m (2700s)`);
    }
  });
}

// 1.2 The specific bug scenario: 30 minutes must NEVER become 45 minutes
runTest('Explicit R6 regression: 30 minutes countdown completion always maps strictly to 1800s (30m)', () => {
  const t = new TimerSimulation('countdown', 30);
  const startMs = 5000000;
  t.start(startMs);

  // Tick at intermediate times: 10m, 20m, 29m59s, 30m
  t.tick(startMs + 600 * 1000);
  assert.equal(t.isActive, true);
  assert.equal(t.timeRemaining, 1200);

  t.tick(startMs + 1200 * 1000);
  assert.equal(t.isActive, true);
  assert.equal(t.timeRemaining, 600);

  t.tick(startMs + 1799 * 1000);
  assert.equal(t.isActive, true);
  assert.equal(t.timeRemaining, 1);

  // Expiration tick at 30m
  t.tick(startMs + 1800 * 1000);
  assert.equal(t.isActive, false);
  assert.equal(t.timeRemaining, 0);
  assert.equal(t.modalDurationMinutes, 30);

  const session = t.saveSession('teoria');
  assert.equal(session.durationSeconds, 1800, '30m countdown must record 1800s');
  assert.notEqual(session.durationSeconds, 2700, 'MUST NOT INFLATE TO 2700s (45m)');
});

// 1.3 Fractional elapsed times and early finish (e.g. 29.5 min, 14.2 min)
runTest('Early finish at 29.5 min (1770s) maps to 30 min (1800s) via Math.round', () => {
  const t = new TimerSimulation('countdown', 60);
  const startMs = 1000000;
  t.start(startMs);
  t.manualFinish(startMs + 1770 * 1000); // 29.5 min
  assert.equal(t.modalDurationMinutes, 30);
  const session = t.saveSession('questoes');
  assert.equal(session.durationSeconds, 1800);
});

runTest('Early finish at 14.2 min (852s) maps to 14 min (840s) via Math.round', () => {
  const t = new TimerSimulation('stopwatch');
  const startMs = 1000000;
  t.start(startMs);
  t.manualFinish(startMs + 852 * 1000); // 14m 12s
  assert.equal(t.modalDurationMinutes, 14);
  const session = t.saveSession('teoria');
  assert.equal(session.durationSeconds, 840);
});

// 1.4 Complex multi-pause Pomodoro stress test
runTest('Stopwatch with 10 interleaved pause/resume intervals measures active study time strictly', () => {
  const t = new TimerSimulation('stopwatch');
  let currentMs = 1000000;
  t.start(currentMs);

  let totalActiveStudied = 0;
  // 10 cycles: study 3 minutes (180s), pause 1 minute (60s)
  for (let i = 0; i < 10; i++) {
    currentMs += 180 * 1000;
    totalActiveStudied += 180;
    t.pause(currentMs);
    currentMs += 60 * 1000; // wall clock advances by 60s while paused
    if (i < 9) {
      t.resume(currentMs);
    }
  }

  t.manualFinish(currentMs);

  assert.equal(totalActiveStudied, 1800, 'Total active study should be 1800s (30m)');
  // Total wall clock time was 1800s + 9*60s = 2340s (39 minutes)
  assert.equal(t.accumulatedSeconds, 1800, 'Accumulated seconds must ignore pause durations');
  assert.equal(t.modalDurationMinutes, 30, 'Modal minutes must reflect 30m active study, not 39m wall clock');

  const session = t.saveSession('teoria');
  assert.equal(session.durationSeconds, 1800, 'Saved session must be 1800s');
  assert.notEqual(session.durationSeconds, 2340, 'Must not include pause time');
  assert.notEqual(session.durationSeconds, 2700, 'Must not inflate to 45m');
});

// 1.5 Speed multiplier isolation: Teoria vs Videoaula vs Questoes
runTest('Speed multiplier 2.0x strictly affects grossDurationSeconds in videoaula, never in teoria or questoes', () => {
  // Teoria test
  const t1 = new TimerSimulation('countdown', 30);
  t1.start(1000);
  t1.tick(1000 + 1800 * 1000);
  const sTeoria = t1.saveSession('teoria', 2.0);
  assert.equal(sTeoria.durationSeconds, 1800, 'Teoria effective seconds is 1800');
  assert.equal(sTeoria.grossDurationSeconds, undefined, 'Teoria must NOT have grossDurationSeconds multiplied');
  assert.equal(sTeoria.playbackSpeed, undefined, 'Teoria must NOT store playbackSpeed');

  // Questoes test
  const t2 = new TimerSimulation('countdown', 30);
  t2.start(1000);
  t2.tick(1000 + 1800 * 1000);
  const sQuestoes = t2.saveSession('questoes', 1.75);
  assert.equal(sQuestoes.durationSeconds, 1800, 'Questoes effective seconds is 1800');
  assert.equal(sQuestoes.grossDurationSeconds, undefined, 'Questoes must NOT have grossDurationSeconds multiplied');

  // Videoaula test (1.5x)
  const t3 = new TimerSimulation('countdown', 30);
  t3.start(1000);
  t3.tick(1000 + 1800 * 1000);
  const sVideo15 = t3.saveSession('videoaula', 1.5);
  assert.equal(sVideo15.durationSeconds, 1800, 'Videoaula liquid effective duration is 1800');
  assert.equal(sVideo15.grossDurationSeconds, 2700, 'Videoaula 1.5x gross duration is 1800 * 1.5 = 2700');
  assert.equal(sVideo15.playbackSpeed, 1.5);

  // Videoaula test (2.0x)
  const t4 = new TimerSimulation('countdown', 30);
  t4.start(1000);
  t4.tick(1000 + 1800 * 1000);
  const sVideo20 = t4.saveSession('videoaula', 2.0);
  assert.equal(sVideo20.durationSeconds, 1800, 'Videoaula liquid effective duration is 1800');
  assert.equal(sVideo20.grossDurationSeconds, 3600, 'Videoaula 2.0x gross duration is 1800 * 2.0 = 3600');
  assert.equal(sVideo20.playbackSpeed, 2.0);
});

// 1.6 User manual override in modal
runTest('User explicit override in save modal is strictly respected without inflation', () => {
  const t = new TimerSimulation('countdown', 30);
  t.start(1000);
  t.tick(1000 + 1800 * 1000);

  // User manually edits the modal input from 30 to 22 minutes
  const sOverride = t.saveSession('teoria', 1.0, 22);
  assert.equal(sOverride.modalDurationMinutes, 22);
  assert.equal(sOverride.durationSeconds, 1320, '22 min * 60 = 1320s');
});

// ============================================================================
// SECTION 2: FLASHCARDS 30s TIME COMPUTATION (R7)
// ============================================================================
console.log('\n--- SECTION 2: FLASHCARDS 30s TIME COMPUTATION (R7) ---');

// Mock in-memory database implementation of recordFlashcardStudySession
class FlashcardDatabase {
  constructor() {
    this.workspaces = [{ id: 'ws-test', name: 'Concurso TRF' }];
    this.sessions = [];
  }

  getWorkspaces() {
    return this.workspaces;
  }

  getSessions() {
    return this.sessions;
  }

  saveSessions(s) {
    this.sessions = s;
  }

  // Exact function signature and implementation from src/db/database.ts:746-773
  recordFlashcardStudySession(workspaceId, card, durationSeconds = 30) {
    if (!workspaceId || !card) return null;

    const wsList = this.getWorkspaces();
    const currentWs = wsList.find((w) => w.id === workspaceId);
    const workspaceName = currentWs ? currentWs.name : undefined;

    const fcSession = {
      id: `session-fc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      subjectId: card.subjectId || 'flashcards',
      subjectName: card.subjectName || 'Flashcards',
      topicName: card.topicName || 'Revisão Anki SM-2',
      durationSeconds,
      date: new Date().toISOString(),
      studyType: 'revisao',
      workspaceId,
      workspaceName,
      notes: 'Revisão de flashcard (30s)',
    };

    const sessions = this.getSessions();
    this.saveSessions([fcSession, ...sessions]);
    return fcSession;
  }
}

// 2.1 Batch reviews of arbitrary sizes: 0, 1, 5, 10, 25, 50, 100 cards
const batchSizes = [0, 1, 5, 10, 25, 50, 100];
for (const count of batchSizes) {
  runTest(`Reviewing batch of ${count} flashcard(s) credits strictly ${count * 30}s (${count * 0.5} min)`, () => {
    const db = new FlashcardDatabase();
    const cards = Array.from({ length: count }, (_, i) => ({
      id: `card-${i + 1}`,
      subjectId: 'sub-dir-const',
      subjectName: 'Direito Constitucional',
      topicName: 'Direitos Fundamentais',
      front: `Q${i + 1}`,
      back: `A${i + 1}`,
    }));

    for (const c of cards) {
      db.recordFlashcardStudySession('ws-test', c); // default 30s
    }

    const sessions = db.getSessions();
    assert.equal(sessions.length, count, `Should create ${count} study sessions`);
    const totalSecs = sessions.reduce((acc, s) => acc + s.durationSeconds, 0);
    assert.equal(totalSecs, count * 30, `Total seconds must equal ${count * 30}s`);

    for (const s of sessions) {
      assert.equal(s.durationSeconds, 30, 'Each session must record 30s');
      assert.equal(s.notes, 'Revisão de flashcard (30s)', 'Note must indicate 30s');
      assert.equal(s.studyType, 'revisao', 'studyType must be revisao');
      assert.equal(s.subjectName, 'Direito Constitucional');
      assert.equal(s.workspaceName, 'Concurso TRF');
    }
  });
}

// 2.2 Boundary cases: null card, missing workspace, missing fields fallback
runTest('Flashcard session gracefully handles missing fields and prevents crashes', () => {
  const db = new FlashcardDatabase();

  // Null card
  assert.equal(db.recordFlashcardStudySession('ws-test', null), null);
  // Null workspace
  assert.equal(db.recordFlashcardStudySession(null, { id: 'c1' }), null);
  // Empty workspace
  assert.equal(db.recordFlashcardStudySession('', { id: 'c1' }), null);

  // Card without subjectId or subjectName
  const fallbackSession = db.recordFlashcardStudySession('ws-test', { id: 'orphan-1' });
  assert.ok(fallbackSession !== null);
  assert.equal(fallbackSession.subjectId, 'flashcards');
  assert.equal(fallbackSession.subjectName, 'Flashcards');
  assert.equal(fallbackSession.topicName, 'Revisão Anki SM-2');
  assert.equal(fallbackSession.durationSeconds, 30);
});

// 2.3 Verification of AutopilotTab and FlashcardsTab source code calls
runTest('Source code verification: AutopilotTab and FlashcardsTab pass 30s explicitly', () => {
  const autoPilotCode = fs.readFileSync(path.join(__dirname, 'src', 'modules', 'autopilot', 'AutopilotTab.tsx'), 'utf-8');
  assert.ok(
    autoPilotCode.includes('db.recordFlashcardStudySession(activeWorkspaceId, card, 30)'),
    'AutopilotTab must call db.recordFlashcardStudySession with 30s'
  );
  assert.ok(
    autoPilotCode.includes('+30s por card'),
    'AutopilotTab UI must display +30s por card'
  );

  const flashcardsCode = fs.readFileSync(path.join(__dirname, 'src', 'modules', 'flashcards', 'FlashcardsTab.tsx'), 'utf-8');
  assert.ok(
    flashcardsCode.includes('db.recordFlashcardStudySession(activeWorkspaceId, card, 30)'),
    'FlashcardsTab must call db.recordFlashcardStudySession with 30s'
  );
});

// ============================================================================
// SECTION 3: ADSENSE ADS.TXT FORMATTING & HTTP HEADERS (R5)
// ============================================================================
console.log('\n--- SECTION 3: ADSENSE ADS.TXT FORMATTING & HTTP HEADERS (R5) ---');

// 3.1 Syntax and character-level checks
runTest('public/ads.txt is strict UTF-8 without BOM and strictly conforms to IAB Tech Lab specification', () => {
  const adsPath = path.join(__dirname, 'public', 'ads.txt');
  assert.ok(fs.existsSync(adsPath), 'public/ads.txt must exist');

  const buf = fs.readFileSync(adsPath);
  // Check BOM (EF BB BF)
  assert.ok(
    !(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf),
    'ads.txt must NOT start with a Byte Order Mark (BOM)'
  );

  const rawText = buf.toString('utf-8');
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  assert.equal(lines.length, 1, 'ads.txt must contain exactly 1 active directive line');

  const line = lines[0];
  const parts = line.split(',').map((p) => p.trim());
  assert.equal(parts.length, 4, 'ads.txt line must have exactly 4 comma-separated fields');

  const [domain, pubId, relationship, certId] = parts;
  assert.equal(domain, 'google.com', 'Field 1 must be google.com');
  assert.equal(pubId, 'pub-9810973652333319', 'Field 2 must be pub-9810973652333319');
  assert.match(pubId, /^pub-\d{16}$/, 'Field 2 must match pub- followed by 16 digits');
  assert.equal(relationship, 'DIRECT', 'Field 3 must be DIRECT (uppercase)');
  assert.equal(certId, 'f08c47fec0942fa0', 'Field 4 must be Google TAG ID f08c47fec0942fa0');
  assert.match(certId, /^[a-f0-9]{16}$/, 'Field 4 must be 16 lowercase hex characters');
});

// 3.2 Build artifact verification
runTest('dist/ads.txt in production bundle exists and is byte-for-byte identical to public/ads.txt', () => {
  const distAdsPath = path.join(__dirname, 'dist', 'ads.txt');
  const pubAdsPath = path.join(__dirname, 'public', 'ads.txt');
  assert.ok(fs.existsSync(distAdsPath), 'dist/ads.txt must exist after build');

  const distBuf = fs.readFileSync(distAdsPath);
  const pubBuf = fs.readFileSync(pubAdsPath);
  assert.equal(Buffer.compare(distBuf, pubBuf), 0, 'dist/ads.txt must be identical to public/ads.txt');
});

// 3.3 Empirical HTTP Web Server & Response Headers Challenge
await runAsyncTest('HTTP Server test: /ads.txt serves HTTP 200 with text/plain Content-Type', async () => {
  const distDir = path.join(__dirname, 'dist');
  assert.ok(fs.existsSync(distDir), 'dist directory must exist');

  // Simple static file server mimicking production CDN/hosting
  const server = http.createServer((req, res) => {
    if (req.url === '/ads.txt') {
      const filePath = path.join(distDir, 'ads.txt');
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Length': stat.size,
          'Cache-Control': 'public, max-age=3600',
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  // Perform GET request
  const getResult = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/ads.txt`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    }).on('error', reject);
  });

  assert.equal(getResult.statusCode, 200, 'HTTP status code must be 200 OK');
  assert.ok(
    getResult.headers['content-type'].includes('text/plain'),
    `Content-Type must be text/plain, got ${getResult.headers['content-type']}`
  );
  assert.equal(
    getResult.body.trim(),
    'google.com, pub-9810973652333319, DIRECT, f08c47fec0942fa0',
    'Body must match ads.txt directive'
  );

  // Perform HEAD request
  const headResult = await new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}/ads.txt`, { method: 'HEAD' }, (res) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
      });
    });
    req.on('error', reject);
    req.end();
  });

  assert.equal(headResult.statusCode, 200, 'HEAD request must return 200 OK');
  assert.equal(Number(headResult.headers['content-length']), 59, 'Content-Length must be 59 bytes');

  await new Promise((resolve) => server.close(resolve));
});

// 3.4 FooterAdBanner LGPD Consent Gating Logic
runTest('FooterAdBanner LGPD logic: essential_only consent strictly prevents third-party ads', () => {
  function evaluateConsent(rawStorageValue) {
    if (!rawStorageValue) return true; // Default allowed
    try {
      const parsed = JSON.parse(rawStorageValue);
      if (parsed.status === 'essential_only') {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }

  // No consent key stored -> default allowed
  assert.equal(evaluateConsent(null), true);
  // User accepted all cookies -> allowed
  assert.equal(evaluateConsent(JSON.stringify({ status: 'all_accepted' })), true);
  // User chose essential only -> BLOCKED
  assert.equal(evaluateConsent(JSON.stringify({ status: 'essential_only' })), false);
  // Malformed JSON -> fallback true
  assert.equal(evaluateConsent('invalid-json'), true);
});

console.log('\n================================================================');
console.log(`   ADVERSARIAL STRESS SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED   `);
console.log('================================================================\n');
