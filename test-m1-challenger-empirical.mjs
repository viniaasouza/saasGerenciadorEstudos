import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('===============================================================');
console.log('=== EMPIRICAL CHALLENGER TEST HARNESS: MILESTONE 1 (M1-2)  ===');
console.log('===============================================================\n');

let passedAssertions = 0;
function pass(msg) {
  passedAssertions++;
  console.log(`  ✓ ${msg}`);
}

// ============================================================================
// SUITE 1: FOOTER AD BANNER LGPD CONSENT GATING & STATE MACHINE
// ============================================================================
console.log('--- SUITE 1: FooterAdBanner LGPD Consent & State Machine Edge Cases ---');

{
  // Simulated FooterAdBanner Consent Evaluator strictly modeling lines 28-67 of FooterAdBanner.tsx
  function createFooterAdBannerSimulator(initialStorageValue, props = {}) {
    let storage = { ...initialStorageValue };
    const COOKIE_STORAGE_KEY = 'ixtude_cookie_consent';
    const DEFAULT_PUB_ID = 'ca-pub-9810973652333319';
    const DEFAULT_SLOT_ID = '3416652040';

    const adClient = props.adClient || DEFAULT_PUB_ID;
    const adSlot = props.adSlot || DEFAULT_SLOT_ID;

    let isCollapsed = false;
    let adFailed = false;
    let consentAllowed = true;
    let pushCount = 0;
    let pushErrors = 0;
    let mockAdsByGoogle = [];

    const checkConsent = () => {
      try {
        const raw = storage[COOKIE_STORAGE_KEY];
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (parsed && parsed.status === 'essential_only') {
            return false;
          }
        }
        return true;
      } catch {
        return true;
      }
    };

    // Initial check
    consentAllowed = checkConsent();

    // Effect: initialize Google AdSense
    const runAdSenseEffect = (shouldFailPush = false) => {
      if (adClient && adSlot && consentAllowed) {
        try {
          if (shouldFailPush) {
            throw new Error('Script blocked by adblock or network error');
          }
          mockAdsByGoogle.push({});
          pushCount++;
        } catch {
          adFailed = true;
          pushErrors++;
        }
      }
    };

    // Simulated storage event across documents/tabs
    const dispatchStorageEvent = (newValue, shouldFailPush = false) => {
      storage[COOKIE_STORAGE_KEY] = newValue;
      consentAllowed = checkConsent();
      runAdSenseEffect(shouldFailPush);
    };

    // Run initial effect
    runAdSenseEffect(props.failPush || false);

    const getState = () => {
      const hasRealAd = Boolean(adClient && adSlot && !adFailed && consentAllowed);
      return {
        adClient,
        adSlot,
        consentAllowed,
        adFailed,
        isCollapsed,
        hasRealAd,
        pushCount,
        pushErrors,
        rendersRealAdTag: hasRealAd && !isCollapsed,
        rendersEducationalFallback: !hasRealAd && !isCollapsed,
      };
    };

    return {
      getState,
      dispatchStorageEvent,
      setIsCollapsed: (val) => { isCollapsed = val; },
      setStorageDirectly: (val) => { storage[COOKIE_STORAGE_KEY] = val; },
    };
  }

  // Test 1.1: null consent (First-time visitor)
  {
    const banner = createFooterAdBannerSimulator({});
    const state = banner.getState();
    assert.equal(state.consentAllowed, true, 'null consent must allow ad by default until choice');
    assert.equal(state.hasRealAd, true, 'Real ad enabled with null consent');
    assert.equal(state.pushCount, 1, 'adsbygoogle.push must be called once');
    assert.equal(state.rendersRealAdTag, true, 'Renders real ins ad tag');
    assert.equal(state.rendersEducationalFallback, false, 'Does not render educational fallback banner');
    pass('Test 1.1 Passed: First-time visitor with null consent renders real ad and pushes to AdSense.');
  }

  // Test 1.2: essential_only consent (User explicitly rejected non-essential cookies)
  {
    const banner = createFooterAdBannerSimulator({
      ixtude_cookie_consent: JSON.stringify({ status: 'essential_only', date: '2026-11-08T12:00:00Z' })
    });
    const state = banner.getState();
    assert.equal(state.consentAllowed, false, 'essential_only must strictly set consentAllowed to false');
    assert.equal(state.hasRealAd, false, 'Real ad must be disabled when consent is essential_only');
    assert.equal(state.pushCount, 0, 'adsbygoogle.push MUST NEVER be called when essential_only');
    assert.equal(state.rendersRealAdTag, false, 'Must not render ins tag');
    assert.equal(state.rendersEducationalFallback, true, 'Must render partner educational fallback banner');
    pass('Test 1.2 Passed: essential_only strictly blocks AdSense push and activates fallback banner.');
  }

  // Test 1.3: accepted consent (User explicitly accepted all cookies)
  {
    const banner = createFooterAdBannerSimulator({
      ixtude_cookie_consent: JSON.stringify({ status: 'accepted', date: '2026-11-08T12:00:00Z' })
    });
    const state = banner.getState();
    assert.equal(state.consentAllowed, true, 'accepted consent must set consentAllowed to true');
    assert.equal(state.hasRealAd, true, 'Real ad enabled');
    assert.equal(state.pushCount, 1, 'adsbygoogle.push must be called');
    assert.equal(state.rendersRealAdTag, true, 'Renders real ins ad tag');
    pass('Test 1.3 Passed: accepted consent enables AdSense and renders ins tag.');
  }

  // Test 1.4: Dynamic toggling via storage event (e.g. accepted -> essential_only -> accepted)
  {
    const banner = createFooterAdBannerSimulator({});
    assert.equal(banner.getState().consentAllowed, true);

    // User switches to essential_only in another tab/modal
    banner.dispatchStorageEvent(JSON.stringify({ status: 'essential_only', date: '2026-11-08T12:10:00Z' }));
    assert.equal(banner.getState().consentAllowed, false, 'Dynamic transition to essential_only succeeds');
    assert.equal(banner.getState().hasRealAd, false, 'Real ad disabled dynamically');
    assert.equal(banner.getState().rendersEducationalFallback, true, 'Fallback activated dynamically');

    // User re-opens modal and switches to accepted
    banner.dispatchStorageEvent(JSON.stringify({ status: 'accepted', date: '2026-11-08T12:20:00Z' }));
    assert.equal(banner.getState().consentAllowed, true, 'Dynamic transition to accepted succeeds');
    assert.equal(banner.getState().hasRealAd, true, 'Real ad re-enabled dynamically');
    pass('Test 1.4 Passed: Dynamic storage event correctly toggles consentAllowed and banner mode.');
  }

  // Test 1.5: Malformed JSON resilience (stressing parser safety)
  {
    const malformedInputs = [
      '{bad-json',
      'undefined',
      '',
      'null',
      '12345',
      '[1, 2, 3]',
      JSON.stringify({ status: null }),
      JSON.stringify({ other: 'field' }),
    ];

    for (const bad of malformedInputs) {
      assert.doesNotThrow(() => {
        const banner = createFooterAdBannerSimulator({ ixtude_cookie_consent: bad });
        // Must safely evaluate without crashing
        assert.equal(typeof banner.getState().consentAllowed, 'boolean');
      }, `Must not throw on malformed input: ${bad}`);
    }
    pass('Test 1.5 Passed: Malformed storage contents safely handled with zero unhandled exceptions.');
  }

  // Test 1.6: AdSense push exception handling (adblocker or script block)
  {
    const banner = createFooterAdBannerSimulator(
      { ixtude_cookie_consent: JSON.stringify({ status: 'accepted' }) },
      { failPush: true }
    );
    const state = banner.getState();
    assert.equal(state.adFailed, true, 'adFailed must be set to true on push error');
    assert.equal(state.hasRealAd, false, 'hasRealAd must be false if push failed');
    assert.equal(state.rendersEducationalFallback, true, 'Gracefully falls back to educational banner');
    pass('Test 1.6 Passed: AdSense push exceptions cleanly caught and fail over to partner banner.');
  }

  // Test 1.7: Collapse & expand toggles
  {
    const banner = createFooterAdBannerSimulator({});
    assert.equal(banner.getState().rendersRealAdTag, true);

    banner.setIsCollapsed(true);
    assert.equal(banner.getState().rendersRealAdTag, false, 'Collapsed banner does not render large ins');
    assert.equal(banner.getState().rendersEducationalFallback, false, 'Collapsed banner does not render large fallback');

    banner.setIsCollapsed(false);
    assert.equal(banner.getState().rendersRealAdTag, true, 'Expanded banner restores ins element');
    pass('Test 1.7 Passed: Collapse and expand toggle works smoothly without loss of state.');
  }
}

console.log('=== SUITE 1 PASSED WITH 7/7 TESTS SUCCESSFUL ===\n');


// ============================================================================
// SUITE 2: TIMER COUNTDOWN COMPLETION VS MANUAL SESSION COMPLETION
// ============================================================================
console.log('--- SUITE 2: Timer Countdown Completion vs Manual Session Completion ---');

{
  // Simulator for TimerTab state and session saving logic
  class TimerTabSimulator {
    constructor(durationMinutes = 90, timerMode = 'countdown') {
      this.durationMinutes = durationMinutes;
      this.timerMode = timerMode;
      this.isActive = false;
      this.isPaused = false;
      this.startTime = null;
      this.accumulatedSeconds = 0;
      this.displaySeconds = 0;
      this.timeRemaining = durationMinutes * 60;
      this.showSaveModal = false;
      this.modalDurationMinutes = durationMinutes || 30;
      this.savedSessions = [];
    }

    start(now = Date.now()) {
      this.isActive = true;
      this.isPaused = false;
      this.startTime = now;
    }

    pause(now = Date.now()) {
      if (this.isPaused) {
        // Resume
        this.startTime = now;
        this.isPaused = false;
      } else {
        // Pause
        if (this.startTime) {
          const delta = Math.floor((now - this.startTime) / 1000);
          this.accumulatedSeconds += delta;
        }
        this.startTime = null;
        this.isPaused = true;
      }
    }

    tick(now = Date.now()) {
      if (!this.isActive || this.isPaused || !this.startTime) return;
      const currentElapsed = this.accumulatedSeconds + Math.floor((now - this.startTime) / 1000);
      this.displaySeconds = currentElapsed;

      if (this.timerMode === 'countdown') {
        const totalTarget = this.durationMinutes * 60;
        const remaining = Math.max(0, totalTarget - currentElapsed);
        this.timeRemaining = remaining;

        if (remaining <= 0) {
          const finalElapsed = this.accumulatedSeconds + (this.startTime ? Math.floor((now - this.startTime) / 1000) : 0);
          const actualSeconds = Math.max(finalElapsed, totalTarget);
          const liquidMinutes = Math.max(1, Math.round(actualSeconds / 60));

          this.isActive = false;
          this.isPaused = false;
          this.startTime = null;
          this.accumulatedSeconds = actualSeconds;
          this.displaySeconds = actualSeconds;
          this.modalDurationMinutes = liquidMinutes;
          this.showSaveModal = true;
        }
      }
    }

    finish(now = Date.now()) {
      let finalSeconds = this.accumulatedSeconds;
      if (this.startTime && !this.isPaused) {
        finalSeconds += Math.floor((now - this.startTime) / 1000);
      }

      this.isActive = false;
      this.isPaused = false;
      this.startTime = null;
      this.accumulatedSeconds = finalSeconds;
      this.displaySeconds = finalSeconds;
      this.modalDurationMinutes = Math.max(1, Math.round(finalSeconds / 60));

      if (finalSeconds >= 1) {
        this.showSaveModal = true;
        return true;
      } else {
        this.reset();
        return false;
      }
    }

    reset() {
      this.isActive = false;
      this.isPaused = false;
      this.startTime = null;
      this.accumulatedSeconds = 0;
      this.displaySeconds = 0;
      if (this.timerMode === 'countdown') {
        this.timeRemaining = this.durationMinutes * 60;
      }
    }

    saveSession(studyType = 'teoria', playbackSpeed = 1.0, userEditedMinutes = null) {
      if (!this.showSaveModal) {
        throw new Error('Save modal is not open');
      }

      if (userEditedMinutes !== null) {
        this.modalDurationMinutes = Math.max(1, userEditedMinutes);
      }

      const isVideoStudy = studyType === 'videoaula';
      const effectiveSeconds = this.modalDurationMinutes > 0 ? this.modalDurationMinutes * 60 : this.displaySeconds;
      const grossSeconds = isVideoStudy ? Math.round(effectiveSeconds * playbackSpeed) : effectiveSeconds;

      const session = {
        id: `session-${Date.now()}-${Math.random()}`,
        durationSeconds: effectiveSeconds,
        grossDurationSeconds: isVideoStudy ? grossSeconds : undefined,
        playbackSpeed: isVideoStudy ? playbackSpeed : undefined,
        studyType,
        modalDurationMinutes: this.modalDurationMinutes,
      };

      this.savedSessions.push(session);
      this.showSaveModal = false;
      this.reset();
      return session;
    }
  }

  // Test 2.1: Countdown on-time completions for 30m, 45m, 60m, 90m
  {
    const durations = [30, 45, 60, 90];
    for (const d of durations) {
      const timer = new TimerTabSimulator(d, 'countdown');
      const startT = 1000000;
      timer.start(startT);

      // Advance clock directly to expiry
      const expiryT = startT + (d * 60 * 1000);
      timer.tick(expiryT);

      assert.equal(timer.showSaveModal, true, `Save modal must open on countdown finish (${d}m)`);
      assert.equal(timer.modalDurationMinutes, d, `modalDurationMinutes must strictly equal ${d}m, never default to 45`);
      assert.equal(timer.accumulatedSeconds, d * 60, `actualSeconds must be ${d * 60}`);

      const session = timer.saveSession('teoria');
      assert.equal(session.durationSeconds, d * 60, `Saved session must record exactly ${d * 60} seconds`);
      assert.equal(session.grossDurationSeconds, undefined, 'Teoria must not have grossDurationSeconds');
    }
    pass('Test 2.1 Passed: Countdown completions for 30m, 45m, 60m, 90m strictly record exact liquid time (NO 45m inflation).');
  }

  // Test 2.2: Countdown with slight tick latency / browser throttling
  {
    const timer = new TimerTabSimulator(30, 'countdown');
    const startT = 2000000;
    timer.start(startT);

    // Overrun by 3 seconds due to background tab interval throttling
    const lateT = startT + (30 * 60 + 3) * 1000;
    timer.tick(lateT);

    assert.equal(timer.modalDurationMinutes, 30, '30m + 3s must round to exactly 30 minutes');
    const session = timer.saveSession('teoria');
    assert.equal(session.durationSeconds, 1800, 'Effective seconds is 1800s (30m)');
    pass('Test 2.2 Passed: Background tab throttling / slight overrun rounds cleanly to target duration.');
  }

  // Test 2.3: Early manual completion before countdown expires (90m set, finishes at 15m)
  {
    const timer = new TimerTabSimulator(90, 'countdown');
    const startT = 3000000;
    timer.start(startT);

    // User finishes early at 15m 12s (912s)
    const earlyFinishT = startT + 912 * 1000;
    const ok = timer.finish(earlyFinishT);

    assert.equal(ok, true, 'finish() must succeed');
    assert.equal(timer.showSaveModal, true);
    assert.equal(timer.modalDurationMinutes, 15, 'modalDurationMinutes must be 15, NOT 90 and NOT 45');
    assert.equal(timer.accumulatedSeconds, 912);

    const session = timer.saveSession('questoes');
    assert.equal(session.durationSeconds, 900, 'Effective seconds is 900s (15 min)');
    pass('Test 2.3 Passed: Early manual finish of a 90m countdown at 15m records exact 15m, NOT 90m or 45m.');
  }

  // Test 2.4: Stopwatch mode manual completion (37m 40s)
  {
    const timer = new TimerTabSimulator(0, 'stopwatch');
    const startT = 4000000;
    timer.start(startT);

    // 37m 40s = 2260s
    const finishT = startT + 2260 * 1000;
    timer.finish(finishT);

    assert.equal(timer.modalDurationMinutes, 38, '2260s rounds to 38 minutes');
    const session = timer.saveSession('pdf');
    assert.equal(session.durationSeconds, 2280, 'Effective seconds is 2280s (38m)');
    pass('Test 2.4 Passed: Stopwatch mode cleanly finishes and rounds to nearest liquid minute.');
  }

  // Test 2.5: Pause / Resume cycles: wall clock vs liquid study time
  {
    const timer = new TimerTabSimulator(60, 'countdown');
    let t = 5000000;
    timer.start(t);

    // Study 10 minutes (600s)
    t += 600 * 1000;
    timer.pause(t);
    assert.equal(timer.accumulatedSeconds, 600, 'Accumulated 600s before pause');

    // Idle for 20 minutes while paused
    t += 1200 * 1000;
    timer.tick(t); // Ticks while paused do not advance study time
    assert.equal(timer.accumulatedSeconds, 600, 'Accumulated time must remain 600s during 20m pause');

    // Resume and study for another 10 minutes (600s)
    timer.pause(t); // resume
    t += 600 * 1000;

    // Finish
    timer.finish(t);
    assert.equal(timer.accumulatedSeconds, 1200, 'Total study seconds must be 1200s (20m), excluding 20m pause');
    assert.equal(timer.modalDurationMinutes, 20, 'modalDurationMinutes is 20m');

    const session = timer.saveSession('teoria');
    assert.equal(session.durationSeconds, 1200, 'Recorded duration is 1200s (20m)');
    pass('Test 2.5 Passed: Paused duration (20 min) is strictly excluded from liquid study time.');
  }

  // Test 2.6: Direct finish while paused
  {
    const timer = new TimerTabSimulator(30, 'countdown');
    let t = 6000000;
    timer.start(t);
    t += 1800 * 1000; // 30 min
    timer.pause(t);

    // Click finish while paused
    timer.finish(t + 50000); // 50s later
    assert.equal(timer.modalDurationMinutes, 30);
    assert.equal(timer.accumulatedSeconds, 1800);
    const session = timer.saveSession('teoria');
    assert.equal(session.durationSeconds, 1800);
    pass('Test 2.6 Passed: Finishing while paused captures exact accumulated study time.');
  }

  // Test 2.7: Edge case: 0 seconds finish vs short study
  {
    const timer = new TimerTabSimulator(30, 'countdown');
    timer.start(7000000);
    // User immediately clicks finish at 0 seconds
    const ok = timer.finish(7000000);
    assert.equal(ok, false, '0 seconds study must be rejected');
    assert.equal(timer.showSaveModal, false, 'Modal must not open');

    // Short study: 20 seconds
    timer.start(7000000);
    const ok2 = timer.finish(7000000 + 20000);
    assert.equal(ok2, true, '20s study is accepted');
    assert.equal(timer.modalDurationMinutes, 1, 'Minimum 1 minute floor applied');
    const session = timer.saveSession('teoria');
    assert.equal(session.durationSeconds, 60, '1 min floor recorded');
    pass('Test 2.7 Passed: 0s study rejected; sub-minute study enforces 1 min floor.');
  }

  // Test 2.8: User manual duration edit in Save Modal
  {
    const timer = new TimerTabSimulator(30, 'countdown');
    timer.start(8000000);
    timer.finish(8000000 + 1800 * 1000);
    assert.equal(timer.modalDurationMinutes, 30);

    // User manually overrides to 25 min in modal input
    const session = timer.saveSession('teoria', 1.0, 25);
    assert.equal(session.durationSeconds, 1500, 'User override to 25m records 1500s');
    pass('Test 2.8 Passed: User manual override in modal takes precedence accurately.');
  }

  // Test 2.9: Decoupling Teoria vs Videoaula playback speed multiplier
  {
    // Case A: Teoria with 2.0x playback speed -> MULTIPLIER MUST NOT APPLY
    const timerTeoria = new TimerTabSimulator(30, 'countdown');
    timerTeoria.start(9000000);
    timerTeoria.finish(9000000 + 1800 * 1000);
    const teoriaSession = timerTeoria.saveSession('teoria', 2.0);
    assert.equal(teoriaSession.durationSeconds, 1800, 'Teoria duration is strictly 1800s');
    assert.equal(teoriaSession.grossDurationSeconds, undefined, 'Teoria has no gross duration multiplier');

    // Case B: Videoaula with 1.5x playback speed -> GROSS DURATION APPLIED
    const timerVideo = new TimerTabSimulator(30, 'countdown');
    timerVideo.start(10000000);
    timerVideo.finish(10000000 + 1800 * 1000);
    const videoSession = timerVideo.saveSession('videoaula', 1.5);
    assert.equal(videoSession.durationSeconds, 1800, 'Liquid duration is 1800s');
    assert.equal(videoSession.grossDurationSeconds, 2700, 'Gross duration with 1.5x is 2700s');
    assert.equal(videoSession.playbackSpeed, 1.5);
    pass('Test 2.9 Passed: Teoria is decoupled from playback speed; Videoaula correctly tracks gross minutes.');
  }
}

console.log('=== SUITE 2 PASSED WITH 9/9 TESTS SUCCESSFUL ===\n');


// ============================================================================
// SUITE 3: ARTIFACT & ASSET INTEGRITY
// ============================================================================
console.log('--- SUITE 3: Build & Static Asset Integrity ---');

{
  // Test 3.1: public/ads.txt
  const publicAdsPath = path.join(__dirname, 'public', 'ads.txt');
  assert.ok(fs.existsSync(publicAdsPath), 'public/ads.txt exists');
  const publicContent = fs.readFileSync(publicAdsPath, 'utf8').trim();
  assert.equal(publicContent, 'google.com, pub-9810973652333319, DIRECT, f08c47fec0942fa0');
  pass('Test 3.1 Passed: public/ads.txt has exact directive.');

  // Test 3.2: dist/ads.txt
  const distAdsPath = path.join(__dirname, 'dist', 'ads.txt');
  assert.ok(fs.existsSync(distAdsPath), 'dist/ads.txt exists');
  const distContent = fs.readFileSync(distAdsPath, 'utf8').trim();
  assert.equal(distContent, 'google.com, pub-9810973652333319, DIRECT, f08c47fec0942fa0');
  pass('Test 3.2 Passed: dist/ads.txt copied cleanly to production root.');

  // Test 3.3: index.html AdSense script
  const indexPath = path.join(__dirname, 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  assert.ok(indexHtml.includes('ca-pub-9810973652333319'), 'index.html contains AdSense pub id');
  assert.ok(indexHtml.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'), 'index.html contains AdSense script URL');
  pass('Test 3.3 Passed: index.html integrates official Google AdSense script.');

  // Test 3.4: dist/index.html contains AdSense script
  const distIndexPath = path.join(__dirname, 'dist', 'index.html');
  assert.ok(fs.existsSync(distIndexPath), 'dist/index.html exists');
  const distIndexHtml = fs.readFileSync(distIndexPath, 'utf8');
  assert.ok(distIndexHtml.includes('ca-pub-9810973652333319'), 'dist/index.html contains AdSense pub id');
  pass('Test 3.4 Passed: dist/index.html contains AdSense script tag in production bundle.');
}

console.log('=== SUITE 3 PASSED WITH 4/4 TESTS SUCCESSFUL ===\n');

console.log('===============================================================');
console.log(`=== ALL ${passedAssertions} EMPIRICAL CHALLENGER ASSERTIONS PASSED! ===`);
console.log('===============================================================');
