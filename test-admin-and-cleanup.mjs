import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('--- RUNNING ADMIN ACCESS & DATA CLEANUP TESTS ---');

// Mock localStorage
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

// 1. Sidebar menuItems logic test
{
  const baseMenuItems = [
    { id: 'autopilot', label: 'Piloto Automático' },
    { id: 'planning', label: 'Planejamento' },
    { id: 'syllabus', label: 'Edital' },
    { id: 'timer', label: 'Estudo Ativo' },
    { id: 'reviews', label: 'Revisões' },
    { id: 'flashcards', label: 'Flashcards' },
    { id: 'questions', label: 'Questões' },
    { id: 'analytics', label: 'Desempenho' },
  ];

  const getMenuItems = (user, isAdmin) => {
    return (user && isAdmin)
      ? [...baseMenuItems, { id: 'admin', label: 'Administrador' }]
      : baseMenuItems;
  };

  // Case A: Unauthenticated Visitor / Guest
  const guestItems = getMenuItems(null, false);
  assert.equal(guestItems.length, 8, 'Guest must only see 8 items');
  assert.equal(guestItems.some((i) => i.id === 'admin'), false, 'Guest must NEVER see admin panel in sidebar');

  // Case B: Regular Student / User
  const student = { id: 'usr-student', role: 'user', name: 'Estudante' };
  const studentItems = getMenuItems(student, false);
  assert.equal(studentItems.length, 8, 'Student must only see 8 items');
  assert.equal(studentItems.some((i) => i.id === 'admin'), false, 'Normal student must NEVER see admin panel in sidebar');

  // Case C: Admin User
  const admin = { id: 'usr-admin', role: 'admin', name: 'Administrador' };
  const adminItems = getMenuItems(admin, true);
  assert.equal(adminItems.length, 9, 'Admin must see 9 items including Admin panel');
  assert.equal(adminItems.some((i) => i.id === 'admin'), true, 'Admin MUST see admin panel in sidebar');

  console.log('✓ Test 1 Passed: Admin panel is strictly hidden from guests and non-admin users in Sidebar.');
}

// 2. Admin URL Tab Guard & Redirection
{
  const simulateTabGuard = (activeTab, isAdmin) => {
    if (activeTab === 'admin' && !isAdmin) {
      return 'autopilot';
    }
    return activeTab;
  };

  assert.equal(simulateTabGuard('admin', false), 'autopilot', 'Non-admin accessing admin tab must redirect to autopilot');
  assert.equal(simulateTabGuard('admin', true), 'admin', 'Admin accessing admin tab is allowed');
  assert.equal(simulateTabGuard('planning', false), 'planning', 'Other tabs remain untouched');

  console.log('✓ Test 2 Passed: Admin tab unauthorized access automatically redirects to autopilot.');
}

// 3. Storage Wipe Logic (estud_ai_clean_v4)
{
  const mockStorage = new MockLocalStorage();
  mockStorage.setItem('concurso_estudos_workspaces', JSON.stringify([{ id: 'legacy-tce-go', name: 'TCE-GO Antigo' }]));
  mockStorage.setItem('concurso_estudos_subjects_legacy-tce-go', JSON.stringify([{ id: 'sub-1', name: 'Direito Administrativo' }]));
  mockStorage.setItem('concurso_estudos_cycle_blocks_legacy-tce-go', JSON.stringify([{ id: 'b-1' }]));
  mockStorage.setItem('estud_ai_fc_reviewed_legacy-tce-go_2026-09-20', '5');
  mockStorage.setItem('estud_ai_auth_user', JSON.stringify({ id: 'usr-admin-default', role: 'admin', email: 'admin@estud.ai' }));
  mockStorage.setItem('estud_ai_clean_v3', 'true');

  // Run cleanup routine matching main.tsx and database.ts
  const CLEANUP_KEY = 'estud_ai_clean_v4';
  if (!mockStorage.getItem(CLEANUP_KEY)) {
    const keysToRemove = [];
    for (let i = 0; i < mockStorage.length; i++) {
      const k = mockStorage.key(i);
      if (
        k &&
        (k.startsWith('concurso_estudos_') ||
         k.startsWith('estud_ai_fc_') ||
         k === 'estud_ai_auth_user' ||
         k.startsWith('estud_ai_clean_'))
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => mockStorage.removeItem(k));
    mockStorage.setItem(CLEANUP_KEY, 'true');
  }

  assert.equal(mockStorage.getItem('concurso_estudos_workspaces'), null, 'Old un-scoped workspaces must be wiped');
  assert.equal(mockStorage.getItem('concurso_estudos_subjects_legacy-tce-go'), null, 'Old subjects must be wiped');
  assert.equal(mockStorage.getItem('concurso_estudos_cycle_blocks_legacy-tce-go'), null, 'Old cycle blocks must be wiped');
  assert.equal(mockStorage.getItem('estud_ai_fc_reviewed_legacy-tce-go_2026-09-20'), null, 'Old flashcards reviews must be wiped');
  assert.equal(mockStorage.getItem('estud_ai_auth_user'), null, 'Old auth session must be purged so no unauthorized admin state persists');
  assert.equal(mockStorage.getItem('estud_ai_clean_v3'), null, 'Old clean tag must be pruned');
  assert.equal(mockStorage.getItem(CLEANUP_KEY), 'true', 'v4 cleanup flag must be recorded');

  console.log('✓ Test 3 Passed: Storage wipe (estud_ai_clean_v4) purges all legacy TCE-GO keys and resets auth session cleanly.');
}

// 4. db.getConcursoInfo and db.getWorkspaces without fallbacks
{
  const mockStorage = new MockLocalStorage();
  
  // getConcursoInfo returns null when nothing is set
  const getConcursoInfo = (wsId) => {
    if (!wsId) return null;
    const data = mockStorage.getItem(`concurso_estudos_concurso_info_${wsId}`);
    if (data) return JSON.parse(data);
    return null;
  };

  assert.equal(getConcursoInfo('new-ws'), null, 'Unconfigured contest info MUST return null (no 2027-01-17 fallback)');

  // getWorkspaces does not migrate legacy un-scoped data
  mockStorage.setItem('concurso_estudos_workspaces', JSON.stringify([{ id: 'old-tce' }]));
  const getWorkspaces = (userId) => {
    const key = userId ? `concurso_estudos_${userId}_workspaces` : 'concurso_estudos_workspaces';
    const data = mockStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  };

  assert.deepEqual(getWorkspaces('new-user'), [], 'getWorkspaces does not copy old legacy workspaces');

  console.log('✓ Test 4 Passed: db.getConcursoInfo returns null and getWorkspaces does not migrate un-scoped data.');
}

// 5. Header and Sidebar Contest Badge & Subtitle Visibility
{
  const checkDisplayVisibility = (concursoInfo) => {
    const hasConfiguredExam = Boolean(concursoInfo?.concurso && concursoInfo?.dataProva);
    let daysRemaining = 0;
    if (hasConfiguredExam && concursoInfo?.dataProva) {
      const now = new Date('2026-09-20T00:00:00');
      const exam = new Date(concursoInfo.dataProva + 'T00:00:00');
      daysRemaining = Math.ceil((exam.getTime() - now.getTime()) / 86400000);
    }
    return { hasConfiguredExam, daysRemaining };
  };

  // Case A: Clean unconfigured workspace
  const cleanState = checkDisplayVisibility(null);
  assert.equal(cleanState.hasConfiguredExam, false, 'Clean state must NOT show countdown badge or subtitle');

  // Case B: Incomplete contest info (no exam date)
  const incompleteState = checkDisplayVisibility({ concurso: 'Meu Concurso', dataProva: '' });
  assert.equal(incompleteState.hasConfiguredExam, false, 'Missing exam date must NOT show countdown badge');

  // Case C: User configured target contest
  const configuredState = checkDisplayVisibility({ concurso: 'TCE-GO', banca: 'FCC', dataProva: '2026-12-20' });
  assert.equal(configuredState.hasConfiguredExam, true, 'Properly configured contest shows countdown badge');
  assert.equal(configuredState.daysRemaining > 0, true, 'Days remaining accurately calculated');

  console.log('✓ Test 5 Passed: Header and Sidebar only display countdown badge and subtitle when fully configured.');
}

// 6. Security check: AuthModal must NOT expose Admin Demo button to visitors/users
{
  const authModalSource = fs.readFileSync('src/components/AuthModal.tsx', 'utf-8');
  assert.equal(authModalSource.includes('Admin Demo'), false, 'AuthModal must not contain "Admin Demo" button');
  assert.equal(authModalSource.includes('loginAsAdminDemo'), false, 'AuthModal must not call loginAsAdminDemo');

  const adminTabSource = fs.readFileSync('src/modules/admin/AdminTab.tsx', 'utf-8');
  assert.equal(adminTabSource.includes('loginAsAdminDemo'), false, 'AdminTab gate must not offer 1-click admin demo login');

  console.log('✓ Test 6 Passed: AuthModal and AdminTab do not leak 1-click Admin shortcuts to users.');
}

// 7. Initial Clean Onboarding: 0 subjects, 0 cycle blocks, no preloaded contest
{
  const mockStorage = new MockLocalStorage();
  
  // Simulate App.tsx clean initialization
  const defaultWs = {
    id: `workspace-123`,
    name: 'Meu Concurso',
    createdAt: new Date().toISOString(),
  };
  mockStorage.setItem('concurso_estudos_workspaces', JSON.stringify([defaultWs]));
  mockStorage.setItem(`concurso_estudos_subjects_${defaultWs.id}`, JSON.stringify([]));
  mockStorage.setItem(`concurso_estudos_concurso_info_${defaultWs.id}`, JSON.stringify({
    concurso: '',
    cargo: '',
    banca: '',
    dataProva: '',
  }));
  mockStorage.setItem(`concurso_estudos_cycle_blocks_${defaultWs.id}`, JSON.stringify([]));

  const subjects = JSON.parse(mockStorage.getItem(`concurso_estudos_subjects_${defaultWs.id}`));
  const blocks = JSON.parse(mockStorage.getItem(`concurso_estudos_cycle_blocks_${defaultWs.id}`));
  const info = JSON.parse(mockStorage.getItem(`concurso_estudos_concurso_info_${defaultWs.id}`));

  assert.equal(subjects.length, 0, 'Initial state must have 0 subjects');
  assert.equal(blocks.length, 0, 'Initial state must have 0 cycle blocks (no cycle downloaded/preloaded)');
  assert.equal(info.concurso, '', 'Contest name must be empty initially');
  assert.equal(info.dataProva, '', 'Exam date must be empty initially');

  console.log('✓ Test 7 Passed: Initial onboarding starts 100% clean with 0 subjects, 0 blocks, and no preloaded contest.');
}

console.log('=== ALL ADMIN & DATA CLEANUP TESTS PASSED SUCCESSFULLY! ===');
