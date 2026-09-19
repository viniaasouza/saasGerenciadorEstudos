import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { WorkspaceTabBar } from './components/WorkspaceTabBar';
import { AutopilotTab } from './modules/autopilot/AutopilotTab';
import { PlanningTab } from './modules/planning/PlanningTab';
import { SyllabusTab } from './modules/syllabus/SyllabusTab';
import { TimerTab } from './modules/timer/TimerTab';
import { ReviewsTab } from './modules/reviews/ReviewsTab';
import { FlashcardsTab } from './modules/flashcards/FlashcardsTab';
import { QuestionsTab } from './modules/questions/QuestionsTab';
import { AnalyticsTab } from './modules/analytics/AnalyticsTab';
import { db } from './db/database';
import { promoteSubjectAndReallocate, generateStudyCycle } from './modules/cycle/cycleGenerator';
import { TCE_GO_SUBJECTS_PRESET, TCE_GO_CONCURSO_INFO } from './data/tceGoPreset';
import type { CicloWorkspace, ConcursoInfo } from './types';
import './index.css';

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('concurso_estudos_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [activeTab, setActiveTab] = useState<string>('autopilot');

  // Multi-Workspace States
  const [workspaces, setWorkspaces] = useState<CicloWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [concursoInfo, setConcursoInfo] = useState<ConcursoInfo | null>(null);

  // State to pass study context between Planning/Autopilot and Timer tabs
  const [selectedBlockForTimer, setSelectedBlockForTimer] = useState<{
    id: string;
    name: string;
    topicId?: string;
    subtopicId?: string;
  } | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  // States for promotion triggers
  const [promotionCandidate, setPromotionCandidate] = useState<{ id: string; name: string } | null>(null);

  // States for header stats
  const [weeklyHoursCompleted, setWeeklyHoursCompleted] = useState(0);
  const [weeklyHoursTarget, setWeeklyHoursTarget] = useState(20);
  const [refreshStatsTrigger, setRefreshStatsTrigger] = useState(0);

  // Theme configuration effect
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('concurso_estudos_theme', theme);
  }, [theme]);

  // Workspace Initialization effect
  useEffect(() => {
    let wsList = db.getWorkspaces();
    let activeId = db.getActiveWorkspaceId();

    if (wsList.length === 0) {
      const defaultWs: CicloWorkspace = {
        id: `workspace-${Date.now()}`,
        name: 'TCE-GO (Analista TI)',
        createdAt: new Date().toISOString()
      };
      wsList = [defaultWs];
      db.saveWorkspaces(wsList);
      activeId = defaultWs.id;
      db.setActiveWorkspaceId(defaultWs.id);

      // Clean onboarding: populate default TCE-GO syllabus preset and auto-generated study cycle
      // without leaking personal study sessions or question logs
      db.saveSubjects(defaultWs.id, TCE_GO_SUBJECTS_PRESET);
      db.saveConcursoInfo(defaultWs.id, TCE_GO_CONCURSO_INFO);
      const defaultBlocks = generateStudyCycle(
        TCE_GO_SUBJECTS_PRESET,
        20,
        90
      );
      db.saveCycleBlocks(defaultWs.id, defaultBlocks);
    }

    if (!activeId || !wsList.some(w => w.id === activeId)) {
      activeId = wsList[0].id;
      db.setActiveWorkspaceId(activeId);
    }

    setWorkspaces(wsList);
    setActiveWorkspaceId(activeId);
  }, []);

  // Recalculate study stats for the active workspace in the header badge
  useEffect(() => {
    if (!activeWorkspaceId) return;
    
    const config = db.getCycleConfig(activeWorkspaceId);
    setWeeklyHoursTarget(config.weeklyHours);

    const sessions = db.getSessions();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentSeconds = sessions
      .filter((s) => s.workspaceId === activeWorkspaceId && new Date(s.date) >= oneWeekAgo)
      .reduce((sum, s) => sum + s.durationSeconds, 0);

    setWeeklyHoursCompleted(parseFloat((recentSeconds / 3600).toFixed(1)));
  }, [refreshStatsTrigger, activeTab, activeWorkspaceId]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Workspace actions
  const handleSelectWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    db.setActiveWorkspaceId(id);
    setSelectedBlockForTimer(null);
    setActiveBlockId(null);
    setPromotionCandidate(null);
  };

  const handleCreateWorkspace = (name: string) => {
    const newWs: CicloWorkspace = {
      id: `workspace-${Date.now()}`,
      name,
      createdAt: new Date().toISOString()
    };
    const updated = [...workspaces, newWs];
    setWorkspaces(updated);
    db.saveWorkspaces(updated);
    handleSelectWorkspace(newWs.id);
  };

  const handleRenameWorkspace = (id: string, name: string) => {
    const updated = workspaces.map((w) => {
      if (w.id === id) {
        return { ...w, name };
      }
      return w;
    });
    setWorkspaces(updated);
    db.saveWorkspaces(updated);
    setRefreshStatsTrigger(prev => prev + 1);
  };

  const handleDeleteWorkspace = (id: string) => {
    if (workspaces.length <= 1) return;

    // Delete workspace keys from local storage
    db.deleteWorkspaceKeys(id);

    const updated = workspaces.filter(w => w.id !== id);
    setWorkspaces(updated);
    db.saveWorkspaces(updated);

    // If the active one was deleted, select another active workspace
    if (id === activeWorkspaceId) {
      handleSelectWorkspace(updated[0].id);
    }
  };

  const handleStartStudy = (
    subjectId: string,
    subjectName: string,
    blockId: string,
    topicId?: string,
    subtopicId?: string
  ) => {
    setSelectedBlockForTimer({ id: subjectId, name: subjectName, topicId, subtopicId });
    setActiveBlockId(blockId);
    setActiveTab('timer');
  };

  const handleClearSelectedSubject = useCallback(() => {
    setSelectedBlockForTimer(null);
    setActiveBlockId(null);
  }, []);

  const handleSessionSaved = () => {
    if (activeBlockId && activeWorkspaceId) {
      const blocks = db.getCycleBlocks(activeWorkspaceId);
      const idx = blocks.findIndex(b => b.id === activeBlockId);
      if (idx !== -1) {
        blocks[idx].completed = true;
        blocks[idx].completedAt = new Date().toISOString();
        db.saveCycleBlocks(activeWorkspaceId, blocks);
      }
    }
    
    setActiveBlockId(null);
    setSelectedBlockForTimer(null);
    setRefreshStatsTrigger((prev) => prev + 1);
  };

  // Performance Promotion Handler
  const handleTriggerPromotion = (subjectId: string, subjectName: string) => {
    setPromotionCandidate({ id: subjectId, name: subjectName });
  };

  const handleAcceptPromotion = (candidateId: string) => {
    if (!activeWorkspaceId) return;

    const list = db.getSubjects(activeWorkspaceId);
    const { updatedSubjects, promotedBacklogSubjectName } = promoteSubjectAndReallocate(list, candidateId);

    // Save status modifications
    db.saveSubjects(activeWorkspaceId, updatedSubjects);

    // Recalculate schedule blocks dynamically
    const config = db.getCycleConfig(activeWorkspaceId);
    const newBlocks = generateStudyCycle(updatedSubjects, config.weeklyHours, 90, config.dailyHours);
    db.saveCycleBlocks(activeWorkspaceId, newBlocks);

    let msg = `A matéria foi promovida para o Modo de Manutenção (45 min/semana).`;
    if (promotedBacklogSubjectName) {
      msg += ` A matéria "${promotedBacklogSubjectName}" foi ativada do Backlog e adicionada ao seu ciclo!`;
    } else {
      msg += ` Não havia matérias elegíveis no Backlog para serem ativadas.`;
    }

    alert(msg);
    setPromotionCandidate(null);
    setRefreshStatsTrigger(p => p + 1); // trigger updates
  };

  // Load concursoInfo for active workspace
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const info = db.getConcursoInfo(activeWorkspaceId);
    setConcursoInfo(info);
  }, [activeWorkspaceId]);

  const renderActiveTab = () => {
    if (!activeWorkspaceId) return null;
    
    switch (activeTab) {
      case 'autopilot':
        return (
          <AutopilotTab
            key={activeWorkspaceId}
            activeWorkspaceId={activeWorkspaceId}
            onStartStudy={handleStartStudy}
            onRefreshStats={() => setRefreshStatsTrigger((prev) => prev + 1)}
          />
        );
      case 'planning':
        return (
          <PlanningTab
            key={activeWorkspaceId}
            activeWorkspaceId={activeWorkspaceId}
            onStartStudy={handleStartStudy}
            activeBlockId={activeBlockId}
          />
        );
      case 'syllabus':
        return (
          <SyllabusTab
            key={activeWorkspaceId}
            activeWorkspaceId={activeWorkspaceId}
            onStartStudy={(subId, subName) => {
              setSelectedBlockForTimer({ id: subId, name: subName });
              setActiveTab('timer');
            }}
          />
        );
      case 'timer':
        return (
          <TimerTab
            key={activeWorkspaceId}
            activeWorkspaceId={activeWorkspaceId}
            selectedSubject={selectedBlockForTimer}
            clearSelectedSubject={handleClearSelectedSubject}
            onSessionSaved={handleSessionSaved}
          />
        );
      case 'reviews':
        return (
          <ReviewsTab
            key={activeWorkspaceId}
            activeWorkspaceId={activeWorkspaceId}
            onStartStudy={(subId, subName) => {
              setSelectedBlockForTimer({ id: subId, name: subName });
              setActiveTab('timer');
            }}
          />
        );
      case 'flashcards':
        return (
          <FlashcardsTab
            key={activeWorkspaceId}
            activeWorkspaceId={activeWorkspaceId}
          />
        );
      case 'questions':
        return (
          <QuestionsTab
            key={activeWorkspaceId}
            activeWorkspaceId={activeWorkspaceId}
            onTriggerPromotion={handleTriggerPromotion}
          />
        );
      case 'analytics':
        return <AnalyticsTab key={activeWorkspaceId} activeWorkspaceId={activeWorkspaceId} />;
      default:
        return (
          <AutopilotTab
            key={activeWorkspaceId}
            activeWorkspaceId={activeWorkspaceId}
            onStartStudy={handleStartStudy}
            onRefreshStats={() => setRefreshStatsTrigger((prev) => prev + 1)}
          />
        );
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} concursoInfo={concursoInfo} />
      <div className="main-container">
        {workspaces.length > 0 && (
          <WorkspaceTabBar
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelectWorkspace={handleSelectWorkspace}
            onCreateWorkspace={handleCreateWorkspace}
            onRenameWorkspace={handleRenameWorkspace}
            onDeleteWorkspace={handleDeleteWorkspace}
          />
        )}
        <Header
          theme={theme}
          toggleTheme={toggleTheme}
          weeklyHoursCompleted={weeklyHoursCompleted}
          weeklyHoursTarget={weeklyHoursTarget}
          concursoInfo={concursoInfo}
          activeTab={activeTab}
          onNavigateToTimer={() => setActiveTab('timer')}
        />
        <main className="content-area">
          <div className="fade-in-tab">
            {renderActiveTab()}
          </div>
        </main>
      </div>

      {/* Promotion Dialog / Modal */}
      {promotionCandidate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="placeholder-card card-primary modal-dialog" style={{ width: '90%', maxWidth: '500px', gap: '1.5rem', padding: '2.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', fontSize: '1.4rem' }}>
              🎉 Consistência Atingida!
            </h3>

            <div style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
              <p>
                Você concluiu <strong>3 simulados com acertos &ge; 85%</strong> na matéria <strong>{promotionCandidate.name}</strong>.
              </p>
              <p style={{ marginTop: '0.75rem' }}>
                Deseja migrar esta matéria para o <strong>Modo de Revisão (Manutenção)</strong> com carga reduzida (45 min) e ativar uma nova disciplina compatível do seu Backlog?
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button onClick={() => setPromotionCandidate(null)} className="mock-btn text-muted" style={{ flex: 1, padding: '0.8rem' }}>
                Manter Ativa
              </button>
              <button onClick={() => handleAcceptPromotion(promotionCandidate.id)} className="mock-btn" style={{ flex: 1, padding: '0.8rem', fontWeight: 'bold' }}>
                Migrar e Ativar Backlog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
