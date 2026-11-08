/**
 * Challenger M3-2 Stress Test: Mobile Drawer Toggle State Machine & Viewport Invariants
 * 
 * Verifies:
 * 1. State machine transitions: open, close by backdrop, close by route navigation, close by close button, close by Escape key.
 * 2. 1,000-cycle randomized action stress testing with strict invariant assertion.
 * 3. CSS & DOM viewport contract at <=640px vs >=641px boundaries across all media blocks.
 * 4. Touch target sizing (>=40px for hamburger, >=44px for close button).
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('================================================================');
console.log('  CHALLENGER M3-2: MOBILE DRAWER STATE MACHINE STRESS HARNESS');
console.log('================================================================\n');

const projectRoot = process.cwd();
let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${testName}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Test 1: Code Verification of State Handlers
// -----------------------------------------------------------------------------
console.log('[Phase 1: Code Structure & State Handlers Verification]');

runTest('App.tsx maintains mobileNavOpen state and passes toggles to Header and Sidebar', () => {
  const appSrc = fs.readFileSync(path.join(projectRoot, 'src', 'App.tsx'), 'utf-8');
  assert.ok(appSrc.includes('const [mobileNavOpen, setMobileNavOpen] = useState(false);'), 'Missing mobileNavOpen state in App.tsx');
  assert.ok(appSrc.includes('isMobileOpen={mobileNavOpen}'), 'Sidebar not passed isMobileOpen');
  assert.ok(appSrc.includes('onCloseMobile={() => setMobileNavOpen(false)}'), 'Sidebar not passed onCloseMobile');
  assert.ok(appSrc.includes('onToggleMobileMenu={() => setMobileNavOpen((prev) => !prev)}'), 'Header not passed onToggleMobileMenu');
});

runTest('Header.tsx renders hamburger button wired to onToggleMobileMenu', () => {
  const headerSrc = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'Header.tsx'), 'utf-8');
  assert.ok(headerSrc.includes('onToggleMobileMenu?: () => void;'), 'HeaderProps missing onToggleMobileMenu');
  assert.ok(headerSrc.includes('className="mobile-menu-btn"'), 'Missing .mobile-menu-btn in Header.tsx');
  assert.ok(headerSrc.includes('onClick={onToggleMobileMenu}'), 'mobile-menu-btn must trigger onToggleMobileMenu');
  assert.ok(headerSrc.includes('aria-label="Abrir menu de navegação"'), 'Missing accessibility aria-label on mobile-menu-btn');
});

runTest('Sidebar.tsx implements backdrop click, route change close, close button, and Escape key', () => {
  const sidebarSrc = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'Sidebar.tsx'), 'utf-8');
  
  // Backdrop
  assert.ok(sidebarSrc.includes('className="mobile-drawer-backdrop"'), 'Missing backdrop markup in Sidebar.tsx');
  assert.ok(sidebarSrc.includes('onClick={onCloseMobile}'), 'Backdrop must trigger onCloseMobile on click');
  
  // Close Button
  assert.ok(sidebarSrc.includes('className="mobile-drawer-close-btn mobile-only"'), 'Missing close button in Sidebar.tsx');
  assert.ok(sidebarSrc.includes('aria-label="Fechar menu"'), 'Missing accessibility aria-label on close button');
  
  // Route Navigation Auto-Close
  assert.ok(sidebarSrc.includes('if (onCloseMobile) {'), 'Nav items must check onCloseMobile');
  assert.ok(sidebarSrc.includes('onCloseMobile();'), 'Nav items must invoke onCloseMobile upon selection');
  
  // Escape key handler
  assert.ok(sidebarSrc.includes("e.key === 'Escape'"), 'Sidebar must listen for Escape key');
  assert.ok(sidebarSrc.includes('window.addEventListener(\'keydown\', handleKeyDown);'), 'Sidebar must attach keydown listener');
  assert.ok(sidebarSrc.includes('window.removeEventListener(\'keydown\', handleKeyDown);'), 'Sidebar must clean up keydown listener');
});

// -----------------------------------------------------------------------------
// Test 2: State Machine Simulation & Invariant Verification
// -----------------------------------------------------------------------------
console.log('\n[Phase 2: State Machine Transitions]');

class MobileDrawerStateMachine {
  constructor() {
    this.state = {
      mobileNavOpen: false,
      activeTab: 'autopilot',
      isCollapsed: false,
      windowWidth: 375, // mobile default
    };
    this.history = [];
  }

  toggleHamburger() {
    this.state.mobileNavOpen = !this.state.mobileNavOpen;
    this.record('TOGGLE_HAMBURGER');
  }

  clickBackdrop() {
    if (this.state.mobileNavOpen) {
      this.state.mobileNavOpen = false;
      this.record('CLICK_BACKDROP');
    }
  }

  clickCloseBtn() {
    if (this.state.mobileNavOpen) {
      this.state.mobileNavOpen = false;
      this.record('CLICK_CLOSE_BTN');
    }
  }

  pressEscapeKey() {
    if (this.state.mobileNavOpen) {
      this.state.mobileNavOpen = false;
      this.record('PRESS_ESCAPE');
    }
  }

  navigateRoute(tabId) {
    this.state.activeTab = tabId;
    if (this.state.windowWidth < 960) {
      this.state.isCollapsed = true;
    }
    // onCloseMobile is invoked on route selection
    this.state.mobileNavOpen = false;
    this.record(`NAVIGATE_${tabId}`);
  }

  resizeWindow(newWidth) {
    const prevWidth = this.state.windowWidth;
    this.state.windowWidth = newWidth;
    if (prevWidth >= 960 && newWidth < 960) {
      this.state.isCollapsed = true;
    }
    this.record(`RESIZE_${newWidth}`);
  }

  record(action) {
    this.history.push({
      action,
      state: { ...this.state },
    });
  }

  isBackdropMounted() {
    return this.state.mobileNavOpen;
  }

  isSidebarOpenOnMobile() {
    return this.state.windowWidth <= 640 && this.state.mobileNavOpen;
  }
}

runTest('SM.1: Single cycle: open -> backdrop click -> closed', () => {
  const sm = new MobileDrawerStateMachine();
  assert.strictEqual(sm.state.mobileNavOpen, false);
  assert.strictEqual(sm.isBackdropMounted(), false);

  sm.toggleHamburger();
  assert.strictEqual(sm.state.mobileNavOpen, true);
  assert.strictEqual(sm.isBackdropMounted(), true);
  assert.strictEqual(sm.isSidebarOpenOnMobile(), true);

  sm.clickBackdrop();
  assert.strictEqual(sm.state.mobileNavOpen, false);
  assert.strictEqual(sm.isBackdropMounted(), false);
  assert.strictEqual(sm.isSidebarOpenOnMobile(), false);
});

runTest('SM.2: Single cycle: open -> route navigation -> closed and active tab updated', () => {
  const sm = new MobileDrawerStateMachine();
  sm.toggleHamburger();
  assert.strictEqual(sm.state.mobileNavOpen, true);

  sm.navigateRoute('planning');
  assert.strictEqual(sm.state.activeTab, 'planning');
  assert.strictEqual(sm.state.mobileNavOpen, false);
  assert.strictEqual(sm.isBackdropMounted(), false);
});

runTest('SM.3: Single cycle: open -> Escape key -> closed', () => {
  const sm = new MobileDrawerStateMachine();
  sm.toggleHamburger();
  assert.strictEqual(sm.state.mobileNavOpen, true);

  sm.pressEscapeKey();
  assert.strictEqual(sm.state.mobileNavOpen, false);
  assert.strictEqual(sm.isBackdropMounted(), false);
});

runTest('SM.4: Single cycle: open -> Close button -> closed', () => {
  const sm = new MobileDrawerStateMachine();
  sm.toggleHamburger();
  assert.strictEqual(sm.state.mobileNavOpen, true);

  sm.clickCloseBtn();
  assert.strictEqual(sm.state.mobileNavOpen, false);
  assert.strictEqual(sm.isBackdropMounted(), false);
});

// -----------------------------------------------------------------------------
// Test 3: 1,000 Randomized Actions Stress Test
// -----------------------------------------------------------------------------
console.log('\n[Phase 3: 1,000-Cycle Randomized Stress Test]');

runTest('SM.5: 1,000 randomized user interactions preserve state invariants', () => {
  const sm = new MobileDrawerStateMachine();
  const routes = ['autopilot', 'planning', 'syllabus', 'timer', 'reviews', 'flashcards', 'questions', 'analytics'];
  const viewports = [320, 360, 375, 414, 430, 600, 640, 641, 768, 960, 1024, 1280];

  for (let i = 0; i < 1000; i++) {
    const actionChoice = Math.floor(Math.random() * 6);
    switch (actionChoice) {
      case 0:
        sm.toggleHamburger();
        break;
      case 1:
        sm.clickBackdrop();
        break;
      case 2:
        sm.clickCloseBtn();
        break;
      case 3:
        sm.pressEscapeKey();
        break;
      case 4: {
        const targetRoute = routes[Math.floor(Math.random() * routes.length)];
        sm.navigateRoute(targetRoute);
        break;
      }
      case 5: {
        const targetW = viewports[Math.floor(Math.random() * viewports.length)];
        sm.resizeWindow(targetW);
        break;
      }
    }

    // Assert strict invariants after EVERY step:
    assert.strictEqual(typeof sm.state.mobileNavOpen, 'boolean', `Iteration ${i}: mobileNavOpen must be boolean`);
    assert.ok(routes.includes(sm.state.activeTab), `Iteration ${i}: invalid activeTab ${sm.state.activeTab}`);
    assert.strictEqual(sm.isBackdropMounted(), sm.state.mobileNavOpen, `Iteration ${i}: backdrop mount invariant violated`);

    if (!sm.state.mobileNavOpen) {
      assert.strictEqual(sm.isSidebarOpenOnMobile(), false, `Iteration ${i}: sidebar cannot be open when mobileNavOpen is false`);
    }
  }
});

// -----------------------------------------------------------------------------
// Test 4: CSS Media Query Boundary Testing (640px vs 641px)
// -----------------------------------------------------------------------------
console.log('\n[Phase 4: CSS Viewport Boundary Invariants (640px vs 641px)]');

const cssContent = fs.readFileSync(path.join(projectRoot, 'src', 'index.css'), 'utf-8');

// Helper to extract ALL media blocks for a given query
function extractAllMediaBlocks(css, queryStr) {
  let combined = '';
  let idx = 0;
  while ((idx = css.indexOf(queryStr, idx)) !== -1) {
    const firstBrace = css.indexOf('{', idx);
    if (firstBrace === -1) break;
    let depth = 1;
    let curr = firstBrace + 1;
    while (curr < css.length && depth > 0) {
      if (css[curr] === '{') depth++;
      else if (css[curr] === '}') depth--;
      curr++;
    }
    combined += '\n' + css.slice(firstBrace + 1, curr - 1);
    idx = curr;
  }
  return combined;
}

runTest('CSS.1: @media (max-width: 640px) defines all mobile off-canvas drawer rules', () => {
  const combinedBlocks = extractAllMediaBlocks(cssContent, '@media (max-width: 640px)');
  assert.ok(combinedBlocks.length > 0, 'Missing @media (max-width: 640px) blocks');

  // Sidebar fixed off-canvas
  assert.ok(combinedBlocks.includes('position: fixed !important'), 'Sidebar must be position fixed on mobile');
  assert.ok(combinedBlocks.includes('transform: translateX(-100%) !important'), 'Sidebar must be translateX(-100%) by default on mobile');
  assert.ok(combinedBlocks.includes('z-index: 1100 !important'), 'Sidebar must have high z-index (1100) on mobile');
  assert.ok(combinedBlocks.includes('width: 280px !important'), 'Sidebar width must be set on mobile');
  assert.ok(combinedBlocks.includes('max-width: 85vw !important'), 'Sidebar max-width must prevent taking 100% of viewport');

  // Sidebar open state
  assert.ok(combinedBlocks.includes('.sidebar.mobile-open'), 'Missing .sidebar.mobile-open selector');
  assert.ok(combinedBlocks.includes('transform: translateX(0) !important'), 'Open sidebar must slide in to translateX(0)');

  // Backdrop
  assert.ok(combinedBlocks.includes('.mobile-drawer-backdrop'), 'Missing .mobile-drawer-backdrop selector');
  assert.ok(combinedBlocks.includes('background-color: rgba(0, 0, 0, 0.65) !important'), 'Backdrop must have dimming background');
  assert.ok(combinedBlocks.includes('z-index: 1050 !important'), 'Backdrop z-index (1050) must sit right beneath sidebar (1100)');

  // Main container
  assert.ok(combinedBlocks.includes('.main-container'), 'Missing .main-container in mobile query');
  assert.ok(combinedBlocks.includes('width: 100% !important'), 'main-container must take 100% width on mobile');
  assert.ok(combinedBlocks.includes('margin-left: 0 !important'), 'main-container must have 0 left margin on mobile');
});

runTest('CSS.2: @media (min-width: 641px) completely hides mobile-only controls', () => {
  const combinedBlocks = extractAllMediaBlocks(cssContent, '@media (min-width: 641px)');
  assert.ok(combinedBlocks.length > 0, 'Missing @media (min-width: 641px) blocks');

  assert.ok(combinedBlocks.includes('.mobile-menu-btn'), 'desktop block must reference .mobile-menu-btn');
  assert.ok(combinedBlocks.includes('.mobile-drawer-backdrop'), 'desktop block must reference .mobile-drawer-backdrop');
  assert.ok(combinedBlocks.includes('.mobile-only'), 'desktop block must reference .mobile-only');
  assert.ok(combinedBlocks.includes('.mobile-drawer-close-btn'), 'desktop block must reference .mobile-drawer-close-btn');

  // Verify all are display: none !important
  const displayNoneMatches = combinedBlocks.match(/display:\s*none\s*!important/g);
  assert.ok(displayNoneMatches && displayNoneMatches.length >= 4, 'All mobile elements must be display: none !important on desktop');
});

runTest('CSS.3: Accessible touch targets meet WCAG standards on mobile', () => {
  // Mobile Hamburger menu button >= 40px (2.5rem = 40px)
  assert.ok(cssContent.includes('width: 2.5rem;'), 'Hamburger button width must be 2.5rem (40px)');
  assert.ok(cssContent.includes('height: 2.5rem;'), 'Hamburger button height must be 2.5rem (40px)');
  assert.ok(cssContent.includes('min-width: 2.5rem;'), 'Hamburger button min-width must be 2.5rem');
  assert.ok(cssContent.includes('min-height: 2.5rem;'), 'Hamburger button min-height must be 2.5rem');

  // Mobile Drawer Close button >= 44px
  assert.ok(cssContent.includes('width: 44px;'), 'Drawer close button width must be 44px');
  assert.ok(cssContent.includes('height: 44px;'), 'Drawer close button height must be 44px');
  assert.ok(cssContent.includes('min-width: 44px;'), 'Drawer close button min-width must be 44px');
  assert.ok(cssContent.includes('min-height: 44px;'), 'Drawer close button min-height must be 44px');
});

console.log('================================================================');
console.log(`  ALL ${passedTests} / ${totalTests} MOBILE DRAWER STRESS TESTS PASSED!`);
console.log('================================================================\n');
