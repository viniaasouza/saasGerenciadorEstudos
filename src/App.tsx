import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { WorkspaceTabBar } from './components/WorkspaceTabBar';
import { PlanningTab } from './modules/planning/PlanningTab';
import { TimerTab } from './modules/timer/TimerTab';
import { QuestionsTab } from './modules/questions/QuestionsTab';
import { AnalyticsTab } from './modules/analytics/AnalyticsTab';
import { db } from './db/database';
import type { CicloWorkspace } from './types';
import './index.css';

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('concurso_estudos_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [activeTab, setActiveTab] = useState<string>('planning');

  // Multi-Workspace States
  const [workspaces, setWorkspaces] = useState<CicloWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');

  // State to pass study context between Planning and Timer tabs
  const [selectedBlockForTimer, setSelectedBlockForTimer] = useState<{ id: string; name: string } | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

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
        name: 'Meu Primeiro Ciclo',
        createdAt: new Date().toISOString()
      };
      wsList = [defaultWs];
      db.saveWorkspaces(wsList);
      activeId = defaultWs.id;
      db.setActiveWorkspaceId(defaultWs.id);
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
    // Trigger refresh of stats (in case workspaceName is displayed or cached)
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

  const handleStartStudy = (subjectId: string, subjectName: string, blockId: string) => {
    setSelectedBlockForTimer({ id: subjectId, name: subjectName });
    setActiveBlockId(blockId);
    setActiveTab('timer');
  };

  const handleClearSelectedSubject = () => {
    setSelectedBlockForTimer(null);
    setActiveBlockId(null);
  };

  const handleSessionSaved = () => {
    if (activeBlockId && activeWorkspaceId) {
      const blocks = db.getCycleBlocks(activeWorkspaceId);
      const idx = blocks.findIndex(b => b.id === activeBlockId);
      if (idx !== -1) {
        blocks[idx].completed = true;
        db.saveCycleBlocks(activeWorkspaceId, blocks);
      }
    }
    
    setActiveBlockId(null);
    setSelectedBlockForTimer(null);
    setRefreshStatsTrigger((prev) => prev + 1);
  };

  const renderActiveTab = () => {
    if (!activeWorkspaceId) return null;
    
    switch (activeTab) {
      case 'planning':
        return (
          <PlanningTab
            key={activeWorkspaceId}
            activeWorkspaceId={activeWorkspaceId}
            onStartStudy={handleStartStudy}
            activeBlockId={activeBlockId}
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
      case 'questions':
        return <QuestionsTab key={activeWorkspaceId} activeWorkspaceId={activeWorkspaceId} />;
      case 'analytics':
        return <AnalyticsTab key={activeWorkspaceId} activeWorkspaceId={activeWorkspaceId} />;
      default:
        return (
          <PlanningTab
            key={activeWorkspaceId}
            activeWorkspaceId={activeWorkspaceId}
            onStartStudy={handleStartStudy}
            activeBlockId={activeBlockId}
          />
        );
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
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
        />
        <main className="content-area">
          <div className="fade-in-tab">
            {renderActiveTab()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
