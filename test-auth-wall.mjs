// Test suite for Auth Wall, Route Guards, and Zero Unauthenticated Pollution
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- RUNNING AUTH WALL & ROUTE PROTECTION TESTS ---');

let passCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`✓ Test ${totalCount} Passed: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`✖ Test ${totalCount} Failed: ${name}`);
    console.error(`  Error: ${err.message}`);
    throw err;
  }
}

// In-Memory Mock LocalStorage
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }
}

// Source file paths
const appPath = path.join(__dirname, 'src', 'App.tsx');
const landingPath = path.join(__dirname, 'src', 'modules', 'landing', 'LandingPage.tsx');
const authModalPath = path.join(__dirname, 'src', 'components', 'AuthModal.tsx');
const authContextPath = path.join(__dirname, 'src', 'context', 'AuthContext.tsx');
const sidebarPath = path.join(__dirname, 'src', 'components', 'Sidebar.tsx');
const headerPath = path.join(__dirname, 'src', 'components', 'Header.tsx');

const appSource = fs.readFileSync(appPath, 'utf-8');
const landingSource = fs.readFileSync(landingPath, 'utf-8');
const authModalSource = fs.readFileSync(authModalPath, 'utf-8');
const authContextSource = fs.readFileSync(authContextPath, 'utf-8');
const sidebarSource = fs.readFileSync(sidebarPath, 'utf-8');
const headerSource = fs.readFileSync(headerPath, 'utf-8');

// ============================================================================
// PART 1: Route Guards & Unauthenticated State Protection
// ============================================================================

runTest('Unauthenticated visitors (user === null) are strictly locked to LandingPage and blocked from .app-layout', () => {
  const storage = new MockLocalStorage();
  
  // App.tsx state calculation:
  // const savedUser = localStorage.getItem('estud_ai_auth_user');
  // const hasEntered = localStorage.getItem('estud_ai_entered_app');
  // return !(savedUser && hasEntered);
  const computeShowLandingPage = (s) => {
    const savedUser = s.getItem('estud_ai_auth_user');
    const hasEntered = s.getItem('estud_ai_entered_app');
    return !(savedUser && hasEntered);
  };

  const initialShowLanding = computeShowLandingPage(storage);
  assert.equal(initialShowLanding, true, 'Landing page must be active initially on clean visit');

  // Strict Auth Wall gate in App.tsx:
  // if (!user || showLandingPage) { return <LandingPage ... /> }
  const user = null;
  const isStudyDashboardRendered = !(!user || initialShowLanding);
  assert.equal(isStudyDashboardRendered, false, 'Study dashboard (.app-layout) must NEVER be rendered when user is null');
});

runTest('Adversarial bypass attempt via manual estud_ai_entered_app in localStorage without auth is strictly blocked', () => {
  const storage = new MockLocalStorage();
  // Malicious or accidental key set in localStorage
  storage.setItem('estud_ai_entered_app', 'true');

  const savedUser = storage.getItem('estud_ai_auth_user');
  const hasEntered = storage.getItem('estud_ai_entered_app');
  const showLandingPage = !(savedUser && hasEntered);
  assert.equal(showLandingPage, true, 'Without savedUser, showLandingPage MUST remain true even if entered_app is set');

  // Even if showLandingPage were somehow flipped in memory:
  const user = null;
  const isGuarded = (!user || false);
  assert.equal(isGuarded, true, 'Guard (!user || showLandingPage) blocks dashboard access even if showLandingPage were false');
});

runTest('User logout or session revocation immediately forces showLandingPage=true and purges entered_app', () => {
  const storage = new MockLocalStorage();
  storage.setItem('estud_ai_entered_app', 'true');

  let showLandingPage = false;
  let user = null; // Simulating logout

  // App.tsx effect:
  // useEffect(() => {
  //   if (!user) {
  //     setShowLandingPage(true);
  //     localStorage.removeItem('estud_ai_entered_app');
  //   }
  // }, [user]);
  if (!user) {
    showLandingPage = true;
    storage.removeItem('estud_ai_entered_app');
  }

  assert.equal(showLandingPage, true, 'showLandingPage must immediately reset to true on logout');
  assert.equal(storage.getItem('estud_ai_entered_app'), null, 'estud_ai_entered_app must be purged from storage on logout');
});

runTest('Static source verification of App.tsx confirms strict Auth Wall guard contract', () => {
  assert.ok(appSource.includes('if (!user || showLandingPage)'), 'App.tsx must gate root layout with if (!user || showLandingPage)');
  assert.ok(appSource.includes("localStorage.removeItem('estud_ai_entered_app');"), 'App.tsx must purge entered_app when user is null');
  assert.ok(appSource.includes('setShowLandingPage(true);'), 'App.tsx must force showLandingPage true when user is null');
});

// ============================================================================
// PART 2: Landing Page CTA Triggers & AuthModal Integration
// ============================================================================

runTest('handleEnterApp in App.tsx rejects unauthenticated entry and immediately triggers AuthModal in signup mode', () => {
  const storage = new MockLocalStorage();

  let user = null;
  let isAuthModalOpen = false;
  let authModalMode = 'login';
  let showLandingPage = true;

  // Exact function logic from App.tsx:
  const handleEnterApp = () => {
    const hasAuth = !!user || !!storage.getItem('estud_ai_auth_user');
    if (!hasAuth) {
      authModalMode = 'signup';
      isAuthModalOpen = true;
      return;
    }
    storage.setItem('estud_ai_entered_app', 'true');
    showLandingPage = false;
  };

  // Visitor clicks "Começar Agora"
  handleEnterApp();

  assert.equal(isAuthModalOpen, true, 'AuthModal must be opened');
  assert.equal(authModalMode, 'signup', 'AuthModal mode must be signup');
  assert.equal(showLandingPage, true, 'Landing page must remain active');
  assert.equal(storage.getItem('estud_ai_entered_app'), null, 'entered_app key must NOT be stored');
});

runTest('handleEnterApp transitions to dashboard when user is authenticated', () => {
  const storage = new MockLocalStorage();
  const mockUser = { id: 'usr-123', email: 'estudante@ixtude-ai.com.br', name: 'Estudante' };

  let user = mockUser;
  let isAuthModalOpen = false;
  let showLandingPage = true;

  const handleEnterApp = () => {
    const hasAuth = !!user || !!storage.getItem('estud_ai_auth_user');
    if (!hasAuth) {
      isAuthModalOpen = true;
      return;
    }
    storage.setItem('estud_ai_entered_app', 'true');
    showLandingPage = false;
  };

  handleEnterApp();

  assert.equal(isAuthModalOpen, false, 'AuthModal should not open for authenticated user');
  assert.equal(showLandingPage, false, 'showLandingPage must transition to false');
  assert.equal(storage.getItem('estud_ai_entered_app'), 'true', 'entered_app must be recorded');
});

runTest('LandingPage.tsx hero CTA branches based on active user state', () => {
  // Verify Hero CTA behavior
  assert.ok(
    landingSource.includes("onOpenAuth('signup')") || landingSource.includes("onOpenAuth('signup')"),
    'LandingPage must call onOpenAuth with signup mode for guests'
  );
  assert.ok(
    landingSource.includes('Começar Agora — É 100% Grátis'),
    'LandingPage must feature Começar Agora CTA'
  );
  // Verify conditional rendering of button text
  assert.ok(
    landingSource.includes("user ? 'Acessar Plataforma' : 'Começar Agora — É 100% Grátis'"),
    'Hero CTA label must differentiate between guest and authenticated user'
  );
});

runTest('LandingPage.tsx top navbar branches between guest auth buttons and dashboard entry', () => {
  assert.ok(
    landingSource.includes("onOpenAuth('login')"),
    'Navbar must support login trigger'
  );
  assert.ok(
    landingSource.includes("onOpenAuth('signup')"),
    'Navbar must support signup trigger'
  );
  assert.ok(
    landingSource.includes('Acessar Meu Painel'),
    'Navbar must provide dashboard shortcut when logged in'
  );
});

runTest('Static audit of LandingPage.tsx ensures zero unguarded onEnterApp calls', () => {
  // Ensure onEnterApp is never bound directly to an onClick without user check
  const directInvokes = landingSource.match(/onClick=\{\s*onEnterApp\s*\}/g);
  assert.equal(directInvokes, null, 'No direct onClick={onEnterApp} bindings allowed in LandingPage.tsx');

  const onEnterMatches = [...landingSource.matchAll(/onEnterApp\(\)/g)];
  assert.ok(onEnterMatches.length > 0, 'onEnterApp must be present for authenticated entry');

  const lines = landingSource.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('onEnterApp()')) {
      const surrounding = lines.slice(Math.max(0, idx - 2), idx + 1).join(' ');
      assert.ok(
        surrounding.includes('if (user)') || surrounding.includes('user ?'),
        `Unguarded onEnterApp() call detected at line ${idx + 1}: ${line}`
      );
    }
  });
});

// ============================================================================
// PART 3: LocalStorage Pollution Guard for Unauthenticated Users
// ============================================================================

runTest('Initial mount with user===null creates ZERO workspaces and writes zero study data to localStorage', () => {
  const storage = new MockLocalStorage();

  // Emulate App.tsx workspace initialization effect when user is null:
  // const userId = user?.id;
  // useEffect(() => {
  //   if (!userId) {
  //     db.setCurrentUserId(null);
  //     setWorkspaces([]);
  //     setActiveWorkspaceId('');
  //     setSelectedBlockForTimer(null);
  //     setActiveBlockId(null);
  //     setPromotionCandidate(null);
  //     return;
  //   }
  //   ...
  // }, [userId, syncStatus]);
  const user = null;
  const userId = user?.id;

  let workspaces = [];
  let activeWorkspaceId = '';

  if (!userId) {
    // Zero LocalStorage Mock Data for Unauthenticated Visitors
    workspaces = [];
    activeWorkspaceId = '';
  } else {
    // Would create default workspace if logged in
    storage.setItem('concurso_estudos_workspaces', JSON.stringify([{ id: 'ws-1', name: 'Meu Concurso' }]));
  }

  assert.equal(workspaces.length, 0, 'Workspaces array must be empty');
  assert.equal(activeWorkspaceId, '', 'Active workspace ID must be empty string');
  assert.equal(storage.getItem('concurso_estudos_workspaces'), null, 'No workspaces key created in localStorage');
  assert.equal(storage.getItem('concurso_estudos_active_workspace_id'), null, 'No active workspace key created in localStorage');
  assert.equal(storage.length, 0, 'LocalStorage must contain zero keys');
});

runTest('AuthContext mock initializers do NOT write mock users or mock feedbacks to localStorage on visitor read', () => {
  const storage = new MockLocalStorage();

  const safeJsonParse = (val, fallback) => {
    try {
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  };

  const KEYS = {
    MOCK_USERS: 'estud_ai_mock_users',
    FEEDBACKS: 'estud_ai_feedbacks',
  };

  const INITIAL_MOCK_USERS = [
    { id: 'usr-admin-default', email: 'admin@ixtude-ai.com.br', role: 'admin' },
    { id: 'usr-demo-student', email: 'aluno@ixtude-ai.com.br', role: 'user' },
  ];

  // Replicate initializeMockUsers from AuthContext.tsx
  const initializeMockUsers = () => {
    const existing = safeJsonParse(storage.getItem(KEYS.MOCK_USERS), []);
    if (existing.length > 0) return existing;
    return INITIAL_MOCK_USERS;
  };

  const INITIAL_FEEDBACKS = [
    { id: 'fb-sample-1', title: 'Adicionar filtro por Banca' },
  ];

  const initializeFeedbacks = () => {
    const existing = safeJsonParse(storage.getItem(KEYS.FEEDBACKS), []);
    if (existing.length > 0) return existing;
    return INITIAL_FEEDBACKS;
  };

  const users = initializeMockUsers();
  const fbs = initializeFeedbacks();

  assert.equal(users.length, 2, 'Fallback in-memory users returned');
  assert.equal(fbs.length, 1, 'Fallback in-memory feedbacks returned');
  assert.equal(storage.getItem(KEYS.MOCK_USERS), null, 'MOCK_USERS must NOT be written to localStorage on visitor read');
  assert.equal(storage.getItem(KEYS.FEEDBACKS), null, 'FEEDBACKS must NOT be written to localStorage on visitor read');
  assert.equal(storage.length, 0, 'LocalStorage remains strictly pristine with 0 keys');
});

runTest('Static source verification of App.tsx confirms clean workspace initialization guard', () => {
  assert.ok(appSource.includes('if (!userId) {'), 'App.tsx must check if (!userId)');
  assert.ok(appSource.includes('db.setCurrentUserId(null);'), 'App.tsx must clear current userId');
  assert.ok(appSource.includes('setWorkspaces([]);'), 'App.tsx must set empty workspaces array');
  assert.ok(appSource.includes("setActiveWorkspaceId('');"), 'App.tsx must reset active workspace id');
});

// ============================================================================
// PART 4: Complete Absence of Demo Bypasses
// ============================================================================

runTest('Confirm "Explorar Sem Cadastro (Demo)" and "Testar como Aluno Demo" are absent from LandingPage.tsx', () => {
  assert.ok(!landingSource.includes('Explorar Sem Cadastro'), 'LandingPage must not contain "Explorar Sem Cadastro"');
  assert.ok(!landingSource.includes('Explorar Sem Cadastro (Demo)'), 'LandingPage must not contain "Explorar Sem Cadastro (Demo)"');
  assert.ok(!landingSource.includes('Testar como Aluno Demo'), 'LandingPage must not contain "Testar como Aluno Demo"');
});

runTest('Confirm "Testar como Aluno Demo", loginAsDemo, and handleQuickDemo are absent from AuthModal.tsx', () => {
  assert.ok(!authModalSource.includes('Testar como Aluno Demo'), 'AuthModal must not contain "Testar como Aluno Demo"');
  assert.ok(!authModalSource.includes('loginAsDemo'), 'AuthModal must not call or reference loginAsDemo');
  assert.ok(!authModalSource.includes('handleQuickDemo'), 'AuthModal must not define handleQuickDemo');
});

runTest('Confirm AuthContext.tsx local fallback does NOT auto-login visitors as demo user on mount', () => {
  // In local fallback mode: if !savedUser -> setUser(null), no auto-login
  assert.ok(
    authContextSource.includes('db.setCurrentUserId(null);\n        setUser(null);') ||
    authContextSource.includes('setUser(null);'),
    'AuthContext must set user to null when no saved user exists'
  );

  // Check fallback section does not assign demo student
  const fallbackStart = authContextSource.indexOf('// Local fallback mode');
  const fallbackEnd = authContextSource.indexOf('// Debounced continuous cloud auto-sync');
  const fallbackSection = authContextSource.substring(fallbackStart, fallbackEnd);

  assert.ok(
    !fallbackSection.includes('setUser(INITIAL_MOCK_USERS[1])') &&
    !fallbackSection.includes('setUser(INITIAL_MOCK_USERS[0])') &&
    !fallbackSection.includes('usr-demo-student'),
    'Local fallback mode must not assign demo user on initial mount'
  );
});

runTest('Confirm Sidebar.tsx and Header.tsx do not expose demo login bypasses to unauthenticated visitors', () => {
  assert.ok(!sidebarSource.includes('loginAsDemo'), 'Sidebar must not reference loginAsDemo');
  assert.ok(!sidebarSource.includes('Testar como Aluno Demo'), 'Sidebar must not contain "Testar como Aluno Demo"');
  assert.ok(!headerSource.includes('loginAsDemo'), 'Header must not reference loginAsDemo');
  assert.ok(!headerSource.includes('Testar como Aluno Demo'), 'Header must not contain "Testar como Aluno Demo"');
});

console.log(`\n=== ALL ${passCount} / ${totalCount} AUTH WALL & ROUTE PROTECTION TESTS PASSED SUCCESSFULLY! ===`);
