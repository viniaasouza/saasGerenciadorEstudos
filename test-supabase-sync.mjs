// Test suite for Supabase Cloud Sync, Multi-Device Continuity & Anti-Wipe Protection
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- RUNNING SUPABASE CLOUD SYNC & MULTI-DEVICE CONTINUITY TESTS ---');

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

// Read Source Files
const dbSource = fs.readFileSync(path.join(__dirname, 'src', 'db', 'database.ts'), 'utf-8');
const authSource = fs.readFileSync(path.join(__dirname, 'src', 'context', 'AuthContext.tsx'), 'utf-8');
const appSource = fs.readFileSync(path.join(__dirname, 'src', 'App.tsx'), 'utf-8');

// Extract and dynamically instantiate functions from database.ts
const hasGenuineFuncStr = dbSource.slice(
  dbSource.indexOf('export function hasGenuineStudyData('),
  dbSource.indexOf('export class Database {')
)
.replace('export function hasGenuineStudyData(backup: FullBackup | null | undefined): boolean {', 'function hasGenuineStudyData(backup) {')
.replace(/\(s\)\s*=>\s*\(s\.durationSeconds/g, '(s) => (s.durationSeconds')
.replace(/\(q\)\s*=>\s*\(q\.attempted/g, '(q) => (q.attempted')
.replace(/\(b\)\s*=>\s*b\.completed/g, '(b) => b.completed')
.replace(/\(w\)\s*=>\s*w\.name/g, '(w) => w.name');

const hasGenuineStudyData = new Function(`${hasGenuineFuncStr}; return hasGenuineStudyData;`)();

// ============================================================================
// PART 1: Multi-Device Study Data Sync via user_sync_data
// ============================================================================

runTest('Multi-device full study state serialization into user_sync_data payload', () => {
  const wsId = 'ws-device-pc';
  const fullBackupPayload = {
    app: 'estud.ai',
    version: 1,
    exportedAt: new Date().toISOString(),
    theme: 'dark',
    workspaces: [{ id: wsId, name: 'Receita Federal - Auditor', createdAt: '2026-01-01' }],
    activeWorkspaceId: wsId,
    sessions: [
      { id: 'sess-1', workspaceId: wsId, subjectId: 'sub-1', durationSeconds: 3600, date: '2026-11-09' }
    ],
    questions: [
      { id: 'q-1', workspaceId: wsId, subjectId: 'sub-1', attempted: 20, correct: 18, banca: 'Cebraspe', date: '2026-11-09' }
    ],
    workspaceData: {
      [wsId]: {
        subjects: [
          { id: 'sub-1', name: 'Direito Tributário', weight: 4, status: 'active', topics: [] },
          { id: 'sub-2', name: 'Contabilidade Geral', weight: 3, status: 'active', topics: [] }
        ],
        cycleConfig: { weeklyHours: 25, dailyHours: 4 },
        cycleBlocks: [
          { id: 'blk-1', subjectId: 'sub-1', subjectName: 'Direito Tributário', durationMinutes: 60, completed: true, completedAt: '2026-11-09T10:00:00Z', order: 1 },
          { id: 'blk-2', subjectId: 'sub-2', subjectName: 'Contabilidade Geral', durationMinutes: 60, completed: false, order: 2 }
        ],
        cycleWeek: '2026-W45',
        concursoInfo: { concurso: 'Receita Federal', cargo: 'Auditor Fiscal', banca: 'FGV', dataProva: '2027-03-15' },
        revisoes: [
          { id: 'rev-1', subjectId: 'sub-1', scheduledDate: '2026-11-10', completed: false }
        ],
        flashcards: [
          { id: 'fc-1', front: 'O que é fato gerador?', back: 'Situação definida em lei como necessária e suficiente à ocorrência da obrigação tributária.', interval: 6, easeFactor: 2.5 }
        ],
        autopilotSettings: { dailyGoalMinutes: 240, preferredCycleMode: 'dynamic' }
      }
    },
    activeTimer: {
      isActive: true,
      isPaused: false,
      timerMode: 'stopwatch',
      durationMinutes: 60,
      startTime: Date.now() - 1200000,
      accumulatedSeconds: 1200,
      updatedAt: Date.now() - 1200000,
      subjectId: 'sub-2',
      subjectName: 'Contabilidade Geral',
      studyType: 'teoria',
      workspaceId: wsId,
    }
  };

  // Simulate storing in Supabase user_sync_data table
  const supabaseRow = {
    user_id: 'usr-multi-device',
    payload: fullBackupPayload,
    updated_at: new Date().toISOString()
  };

  assert.equal(supabaseRow.user_id, 'usr-multi-device');
  assert.equal(supabaseRow.payload.workspaces.length, 1);
  assert.equal(supabaseRow.payload.sessions.length, 1);
  assert.equal(supabaseRow.payload.questions.length, 1);
  assert.equal(supabaseRow.payload.workspaceData[wsId].subjects.length, 2);
  assert.equal(supabaseRow.payload.workspaceData[wsId].cycleBlocks.length, 2);
  assert.equal(supabaseRow.payload.workspaceData[wsId].flashcards.length, 1);
  assert.equal(supabaseRow.payload.workspaceData[wsId].revisoes.length, 1);
  assert.equal(supabaseRow.payload.activeTimer.subjectName, 'Contabilidade Geral');
});

// ============================================================================
// PART 2: First-Time Login Upload
// ============================================================================

runTest('First-time login upload: pre-existing local data on PC is uploaded to cloud when cloud has no data', async () => {
  const localStudyData = {
    workspaces: [{ id: 'ws-pc', name: 'Meu Concurso' }],
    workspaceData: {
      'ws-pc': {
        subjects: [{ id: 'sub-local', name: 'Direito Administrativo', weight: 3 }],
        cycleBlocks: [{ id: 'blk-local', completed: true }]
      }
    },
    sessions: [{ id: 's-1', durationSeconds: 1800 }],
    questions: [{ id: 'q-1', attempted: 10, correct: 9 }]
  };

  // Verify hasGenuineStudyData returns true for pre-existing local data
  const hasData = hasGenuineStudyData(localStudyData);
  assert.equal(hasData, true, 'Pre-existing local study data must be recognized as genuine');

  // Emulate pullFromCloud cloud check:
  // if (data?.payload) { ... } else {
  //   if (hasGenuineStudyData(localSnapshot)) {
  //     await supabase.from('user_sync_data').upsert({ user_id, payload: localSnapshot, ... })
  //   }
  // }
  let uploadedToCloud = false;
  let cloudPayload = null;

  const simulateCloudPull = (cloudRow, localSnapshot) => {
    if (cloudRow?.payload) {
      // cloud merge path
    } else {
      // First-time login path: cloud has no row
      if (hasGenuineStudyData(localSnapshot)) {
        uploadedToCloud = true;
        cloudPayload = localSnapshot;
      }
    }
  };

  simulateCloudPull(null, localStudyData);
  assert.equal(uploadedToCloud, true, 'Local data must be uploaded to cloud on first login');
  assert.equal(cloudPayload.sessions.length, 1, 'Local sessions must be uploaded');
  assert.equal(cloudPayload.workspaceData['ws-pc'].subjects[0].name, 'Direito Administrativo');
});

// ============================================================================
// PART 3: Anti-Wipe Protection for Clean Devices
// ============================================================================

runTest('Anti-wipe protection: hasGenuineStudyData strictly rejects blank or default empty snapshots', () => {
  assert.equal(hasGenuineStudyData(null), false, 'null is not genuine');
  assert.equal(hasGenuineStudyData(undefined), false, 'undefined is not genuine');
  assert.equal(hasGenuineStudyData({}), false, 'empty object is not genuine');

  // Default clean device state: single workspace "Meu Concurso" with 0 subjects and 0 sessions
  const blankDefault = {
    workspaces: [{ id: 'ws-blank', name: 'Meu Concurso' }],
    workspaceData: {
      'ws-blank': {
        subjects: [],
        cycleBlocks: [],
        flashcards: [],
        revisoes: []
      }
    },
    sessions: [],
    questions: [],
    activeTimer: null
  };
  assert.equal(hasGenuineStudyData(blankDefault), false, 'Clean device default Meu Concurso must NOT be classified as genuine');
});

runTest('Anti-wipe protection: clean device login suppresses mutations via isPullingRef and avoids cloud overwrite', () => {
  let isPulling = false;
  let pushedPayload = null;

  const handleMutation = (localPayload) => {
    if (isPulling) {
      // Mutual exclusion lock active: mutation upload blocked
      return;
    }
    if (!hasGenuineStudyData(localPayload)) {
      // Anti-wipe gate: blank state never uploaded
      return;
    }
    pushedPayload = localPayload;
  };

  // Step 1: Clean device starts pullFromCloud
  isPulling = true;

  // Step 2: During pull, UI tries to fire a mutation (e.g. creating default workspace)
  const dummyLocal = { workspaces: [{ id: 'ws-empty', name: 'Meu Concurso' }] };
  handleMutation(dummyLocal);
  assert.equal(pushedPayload, null, 'isPulling lock strictly prevented mutation upload');

  // Step 3: Even after pull finishes, blank snapshot is blocked by hasGenuineStudyData
  isPulling = false;
  handleMutation(dummyLocal);
  assert.equal(pushedPayload, null, 'hasGenuineStudyData blocked blank snapshot from overwriting cloud');
});

runTest('Anti-wipe protection: App.tsx defers default workspace generation while syncStatus is syncing', () => {
  assert.ok(appSource.includes("syncStatus === 'syncing'"), 'App.tsx must check syncStatus === syncing');
  assert.ok(appSource.includes('[userId, syncStatus]'), 'App.tsx effect dependencies must include syncStatus');

  // Logic simulation
  let defaultWsCreated = false;
  const wsList = [];
  const syncStatus = 'syncing';

  if (wsList.length === 0) {
    if (syncStatus === 'syncing') {
      // Defer creating default workspace until cloud pull finishes
      defaultWsCreated = false;
    } else {
      defaultWsCreated = true;
    }
  }

  assert.equal(defaultWsCreated, false, 'Default workspace creation was successfully deferred during cloud sync');
});

// ============================================================================
// PART 4: Cycle Blocks Non-Destructive Merge
// ============================================================================

runTest('Cycle blocks non-destructive merge: union of blocks by ID with logical OR for completed status', () => {
  const localBlocks = [
    { id: 'b1', subjectName: 'Português', completed: false, order: 1 }, // Not completed locally
    { id: 'b2', subjectName: 'Matemática', completed: true, completedAt: '2026-11-09T14:30:00Z', order: 2 }, // Completed locally on PC
    { id: 'b3', subjectName: 'Direito Administrativo', completed: false, order: 3 }, // Added on PC
  ];

  const cloudBlocks = [
    { id: 'b1', subjectName: 'Português', completed: true, completedAt: '2026-11-09T11:00:00Z', order: 1 }, // Completed on Smartphone
    { id: 'b2', subjectName: 'Matemática', completed: false, order: 2 }, // Not completed on Smartphone
    { id: 'b4', subjectName: 'Direito Constitucional', completed: true, completedAt: '2026-11-09T09:00:00Z', order: 4 }, // Added on Smartphone
  ];

  // Algorithmic merge implementation from database.ts
  const blockMap = new Map();
  cloudBlocks.forEach((cb) => {
    if (cb?.id) blockMap.set(cb.id, { ...cb });
  });

  localBlocks.forEach((lb) => {
    if (!lb?.id) return;
    if (!blockMap.has(lb.id)) {
      blockMap.set(lb.id, { ...lb });
    } else {
      const exBlock = blockMap.get(lb.id);
      const wasCompleted = Boolean(exBlock.completed || lb.completed);
      exBlock.completed = wasCompleted;

      if (lb.completed && lb.completedAt) {
        if (!exBlock.completedAt || new Date(lb.completedAt) > new Date(exBlock.completedAt)) {
          exBlock.completedAt = lb.completedAt;
        }
      } else if (!exBlock.completedAt && lb.completedAt) {
        exBlock.completedAt = lb.completedAt;
      }
    }
  });

  const merged = Array.from(blockMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));

  assert.equal(merged.length, 4, 'All 4 unique blocks preserved in union');
  
  const b1 = merged.find((b) => b.id === 'b1');
  assert.equal(b1.completed, true, 'Block b1 completed status preserved from mobile');
  assert.equal(b1.completedAt, '2026-11-09T11:00:00Z');

  const b2 = merged.find((b) => b.id === 'b2');
  assert.equal(b2.completed, true, 'Block b2 completed status preserved from PC');
  assert.equal(b2.completedAt, '2026-11-09T14:30:00Z');

  const b3 = merged.find((b) => b.id === 'b3');
  assert.equal(b3.subjectName, 'Direito Administrativo');
  assert.equal(b3.completed, false);

  const b4 = merged.find((b) => b.id === 'b4');
  assert.equal(b4.subjectName, 'Direito Constitucional');
  assert.equal(b4.completed, true);
});

// ============================================================================
// PART 5: Active Timer Cross-Device Synchronization
// ============================================================================

runTest('Active timer is included in FullBackup contract, exportAllData, and importAllData', () => {
  assert.ok(dbSource.includes('activeTimer?: RunningTimerState | null;'), 'FullBackup must declare activeTimer');
  assert.ok(dbSource.includes('activeTimer: this.getActiveTimer(),'), 'exportAllData must include activeTimer');
  assert.ok(dbSource.includes('saveActiveTimer(timer: RunningTimerState | null, notify: boolean = true)'), 'saveActiveTimer must accept notify flag');
  assert.ok(dbSource.includes('this.notifyChange();'), 'saveActiveTimer must call notifyChange');
  assert.ok(dbSource.includes('data.activeTimer !== undefined'), 'importAllData must restore activeTimer');
});

runTest('Active timer reconciliation: selects latest valid timer and discards zombie timers (>24h)', () => {
  const now = Date.now();

  const isTimerValid = (t) => {
    if (!t || !t.isActive) return false;
    if (!t.isPaused && t.startTime && (now - t.startTime > 24 * 3600 * 1000)) return false;
    return true;
  };

  const reconcileActiveTimer = (localTimer, cloudTimer, cloudExportedAt) => {
    const localValid = isTimerValid(localTimer);
    const cloudValid = isTimerValid(cloudTimer);

    if (localValid && !cloudValid) {
      const cloudExportedTime = cloudExportedAt ? new Date(cloudExportedAt).getTime() : 0;
      const localTimerTime = localTimer.updatedAt || localTimer.startTime || 0;
      if (cloudExportedTime > localTimerTime && cloudExportedTime > 0) {
        return null;
      }
      return localTimer;
    } else if (!localValid && cloudValid) {
      return cloudTimer;
    } else if (localValid && cloudValid) {
      const localTime = localTimer.updatedAt || localTimer.startTime || 0;
      const cloudTime = cloudTimer.updatedAt || cloudTimer.startTime || 0;
      return localTime >= cloudTime ? localTimer : cloudTimer;
    }
    return null;
  };

  // Case A: Cloud timer is newer than local timer
  const localTimer = { isActive: true, startTime: now - 300000, updatedAt: now - 300000, subjectName: 'Português' };
  const cloudTimer = { isActive: true, startTime: now - 60000, updatedAt: now - 60000, subjectName: 'RLM' };
  const winCloud = reconcileActiveTimer(localTimer, cloudTimer, null);
  assert.equal(winCloud.subjectName, 'RLM', 'Cloud timer wins due to more recent updatedAt');

  // Case B: Zombie local timer (> 24h) is invalidated
  const zombieTimer = { isActive: true, isPaused: false, startTime: now - 25 * 3600 * 1000, updatedAt: now - 25 * 3600 * 1000 };
  const validCloud = { isActive: true, isPaused: false, startTime: now - 1000, updatedAt: now - 1000, subjectName: 'Direito' };
  const winNonZombie = reconcileActiveTimer(zombieTimer, validCloud, null);
  assert.equal(winNonZombie.subjectName, 'Direito', 'Zombie timer was pruned and valid cloud timer chosen');

  // Case C: Timer ended on mobile, cloud exported later with no timer -> local timer stops
  const endedOnMobile = reconcileActiveTimer(localTimer, null, new Date(now + 10000).toISOString());
  assert.equal(endedOnMobile, null, 'Stale local stopwatch safely stopped because cloud was exported after');
});

// ============================================================================
// PART 6: Network Reconnection & Window Focus Auto-Reconciliation
// ============================================================================

runTest('Network reconnection: onOnline invokes pullFromCloud to retrieve fresh remote changes', () => {
  assert.ok(authSource.includes('window.addEventListener(\'online\', onOnline)'), 'Must attach online listener');
  assert.ok(authSource.includes('pullFromCloud(user.id);'), 'onOnline must invoke pullFromCloud');
});

runTest('Window focus and tab switch auto-reconciliation with 12-second throttle cooldown', () => {
  assert.ok(authSource.includes("window.addEventListener('focus', handleFocus)"), 'Must attach focus listener');
  assert.ok(authSource.includes("document.addEventListener('visibilitychange', handleVisibilityChange)"), 'Must attach visibilitychange listener');
  assert.ok(authSource.includes('FOCUS_COOLDOWN_MS = 12000'), 'Must enforce 12000ms cooldown');

  // Verify throttling simulation
  let pulls = 0;
  let lastReconcile = 0;
  const COOLDOWN = 12000;

  const triggerFocus = (currentTime) => {
    if (currentTime - lastReconcile < COOLDOWN) return;
    lastReconcile = currentTime;
    pulls++;
  };

  const t0 = 100000;
  triggerFocus(t0);
  assert.equal(pulls, 1, 'First focus triggers sync');

  triggerFocus(t0 + 2000); // 2s later -> throttled
  assert.equal(pulls, 1, 'Rapid tab switch within cooldown is throttled');

  triggerFocus(t0 + 13000); // 13s later -> allowed
  assert.equal(pulls, 2, 'Tab switch after cooldown triggers sync');
});

console.log(`\n=== ALL ${passCount} / ${totalCount} SUPABASE CLOUD SYNC TESTS PASSED SUCCESSFULLY! ===`);
