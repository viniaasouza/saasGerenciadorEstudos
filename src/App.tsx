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
import { AdminTab } from './modules/admin/AdminTab';
import { LandingPage } from './modules/landing/LandingPage';
import { AuthModal } from './components/AuthModal';
import { FeedbackModal } from './components/FeedbackModal';
import { AiSyllabusImportModal } from './modules/syllabus/AiSyllabusImportModal';
import { useAuth } from './context/AuthContext';
import { db } from './db/database';
import { promoteSubjectAndReallocate, generateStudyCycle } from './modules/cycle/cycleGenerator';
import type { CicloWorkspace, ConcursoInfo } from './types';
import './index.css';

function App() {
  const { user, isAdmin } = useAuth();

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('concurso_estudos_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Landing Page toggle state
  const [showLandingPage, setShowLandingPage] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (window.location.hash === '#landing') return true;
    const hasEntered = localStorage.getItem('estud_ai_entered_app');
    return !hasEntered;
  });

  const [activeTab, setActiveTab] = useState<string>('autopilot');

  // Guard admin tab: redirect to autopilot if user is not admin
  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      setActiveTab('autopilot');
    }
  }, [activeTab, isAdmin]);

  // Modals states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isAiImportOpen, setIsAiImportOpen] = useState(false);

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

  // Clean Workspace Initialization effect — reacts to logged-in user changes for multi-user isolation
  const userId = user?.id;
  useEffect(() => {
    db.setCurrentUserId(userId || null);
    let wsList = db.getWorkspaces();
    let activeId = db.getActiveWorkspaceId();

    if (wsList.length === 0) {
      const defaultWs: CicloWorkspace = {
        id: `workspace-${Date.now()}`,
        name: 'Meu Concurso',
        createdAt: new Date().toISOString(),
      };
      wsList = [defaultWs];
      db.saveWorkspaces(wsList);
      activeId = defaultWs.id;
      db.setActiveWorkspaceId(defaultWs.id);

      // Clean onboarding: empty subjects so user starts fresh with clean data
      db.saveSubjects(defaultWs.id, []);
      db.saveConcursoInfo(defaultWs.id, {
        concurso: '',
        cargo: '',
        banca: '',
        dataProva: '',
      });
      db.saveCycleBlocks(defaultWs.id, []);
    }

    if (!activeId || !wsList.some((w) => w.id === activeId)) {
      activeId = wsList[0].id;
      db.setActiveWorkspaceId(activeId);
    }

    setWorkspaces(wsList);
    setActiveWorkspaceId(activeId);
    setSelectedBlockForTimer(null);
    setActiveBlockId(null);
    setPromotionCandidate(null);
    setRefreshStatsTrigger((p) => p + 1);
  }, [userId]);

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

  const handleEnterApp = () => {
    localStorage.setItem('estud_ai_entered_app', 'true');
    setShowLandingPage(false);
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
      createdAt: new Date().toISOString(),
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
    setRefreshStatsTrigger((prev) => prev + 1);
  };

  const handleDeleteWorkspace = (id: string) => {
    if (workspaces.length <= 1) return;

    db.deleteWorkspaceKeys(id);

    const updated = workspaces.filter((w) => w.id !== id);
    setWorkspaces(updated);
    db.saveWorkspaces(updated);

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
      const idx = blocks.findIndex((b) => b.id === activeBlockId);
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

    db.saveSubjects(activeWorkspaceId, updatedSubjects);

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
    setRefreshStatsTrigger((p) => p + 1);
  };

  // Load concursoInfo for active workspace
  useEffect(() => {
    if (!activeWorkspaceId) {
      setConcursoInfo(null);
      return;
    }
    const info = db.getConcursoInfo(activeWorkspaceId);
    setConcursoInfo(info);
  }, [activeWorkspaceId, refreshStatsTrigger]);

  // If user opens Landing Page view
  if (showLandingPage) {
    return (
      <div className={`app-root ${theme}`}>
        <LandingPage
          onEnterApp={handleEnterApp}
          onOpenAuth={(mode) => {
            setAuthModalMode(mode || 'login');
            setIsAuthModalOpen(true);
          }}
          onOpenFeedback={() => setIsFeedbackModalOpen(true)}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialMode={authModalMode}
          onSuccess={handleEnterApp}
        />

        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
        />
      </div>
    );
  }

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
      case 'admin':
        if (!isAdmin) {
          return null;
        }
        return (
          <AdminTab
            key={activeWorkspaceId}
            onOpenAuthModal={() => {
              setAuthModalMode('login');
              setIsAuthModalOpen(true);
            }}
          />
        );
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
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        concursoInfo={concursoInfo}
        onOpenFeedback={() => setIsFeedbackModalOpen(true)}
        onToggleLandingPage={() => setShowLandingPage(true)}
        onOpenAuth={() => {
          setAuthModalMode('login');
          setIsAuthModalOpen(true);
        }}
      />
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
          onOpenAuth={() => {
            setAuthModalMode('login');
            setIsAuthModalOpen(true);
          }}
          onOpenFeedback={() => setIsFeedbackModalOpen(true)}
          onOpenAiImport={() => setIsAiImportOpen(true)}
          onToggleLandingPage={() => setShowLandingPage(true)}
        />
        <main className="content-area">
          <div className="fade-in-tab">{renderActiveTab()}</div>
        </main>
      </div>

      {/* Promotion Dialog / Modal */}
      {promotionCandidate && (
        <div
          style={{
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
            zIndex: 9999,
          }}
        >
          <div
            className="placeholder-card card-primary modal-dialog"
            style={{ width: '90%', maxWidth: '500px', gap: '1.5rem', padding: '2.5rem' }}
          >
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
              <button
                onClick={() => setPromotionCandidate(null)}
                className="mock-btn text-muted"
                style={{ flex: 1, padding: '0.8rem' }}
              >
                Manter Ativa
              </button>
              <button
                onClick={() => handleAcceptPromotion(promotionCandidate.id)}
                className="mock-btn"
                style={{ flex: 1, padding: '0.8rem', fontWeight: 'bold' }}
              >
                Migrar e Ativar Backlog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />

      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />

      <AiSyllabusImportModal
        isOpen={isAiImportOpen}
        onClose={() => setIsAiImportOpen(false)}
        onWorkspaceCreated={(wsId) => {
          const updated = db.getWorkspaces();
          setWorkspaces(updated);
          handleSelectWorkspace(wsId);
        }}
      />
    </div>
  );
}

export default App;
