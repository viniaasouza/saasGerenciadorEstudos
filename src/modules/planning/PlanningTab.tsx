import React, { useState, useEffect } from 'react';
import { db } from '../../db/database';
import { generateStudyCycle, parseVerticalSyllabus, reallocateIncompleteBlocks, DAYS_ORDER } from '../cycle/cycleGenerator';
import type { Subject, StudyBlock, SubjectStatus, StudyCycleConfig } from '../../types';
import { AiSyllabusImportModal } from '../syllabus/AiSyllabusImportModal';
import { Plus, Trash2, RefreshCw, Upload, CheckCircle2, Circle, ChevronDown, ChevronUp, AlertTriangle, Calendar, Play, Settings, FileText, Sparkles } from 'lucide-react';

interface PlanningTabProps {
  onStartStudy: (subjectId: string, subjectName: string, blockId: string) => void;
  activeBlockId: string | null;
  activeWorkspaceId: string;
}

export const PlanningTab: React.FC<PlanningTabProps> = ({ onStartStudy, activeBlockId, activeWorkspaceId }) => {
  // Load initial state from LocalStorage based on activeWorkspaceId
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [cycleConfig, setCycleConfig] = useState<StudyCycleConfig>({ 
    weeklyHours: 20, 
    cycleDurationWeeks: 1, 
    dailyHours: { segunda: 4, terca: 4, quarta: 4, quinta: 4, sexta: 4, sabado: 2, domingo: 2 } 
  });
  const [cycleBlocks, setCycleBlocks] = useState<StudyBlock[]>([]);
  
  // UI states
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectWeight, setNewSubjectWeight] = useState(3);
  const [newSubjectStatus, setNewSubjectStatus] = useState<SubjectStatus>('active');
  const [syllabusText, setSyllabusText] = useState('');
  const [showImportArea, setShowImportArea] = useState(false);
  const [showAvailabilityPanel, setShowAvailabilityPanel] = useState(false);
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [isAiImportOpen, setIsAiImportOpen] = useState(false);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setSubjects(db.getSubjects(activeWorkspaceId));
    const config = db.getCycleConfig(activeWorkspaceId);
    setCycleConfig({
      weeklyHours: config.weeklyHours,
      cycleDurationWeeks: config.cycleDurationWeeks,
      dailyHours: config.dailyHours || { segunda: 4, terca: 4, quarta: 4, quinta: 4, sexta: 4, sabado: 2, domingo: 2 }
    });
    const syncRes = db.syncCycleSchedule(activeWorkspaceId);
    setCycleBlocks(syncRes.blocks);
  }, [activeWorkspaceId]);

  const handleSaveSubjects = (updatedSubjects: Subject[]) => {
    setSubjects(updatedSubjects);
    db.saveSubjects(activeWorkspaceId, updatedSubjects);
  };

  const handleSaveConfig = (updatedConfig: typeof cycleConfig) => {
    setCycleConfig(updatedConfig);
    db.saveCycleConfig(activeWorkspaceId, updatedConfig);
  };

  const handleSaveBlocks = (updatedBlocks: StudyBlock[]) => {
    setCycleBlocks(updatedBlocks);
    db.saveCycleBlocks(activeWorkspaceId, updatedBlocks);
  };

  // Import Gran Questoes JSON backup
  const handleImportGranJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const res = db.importGranBackup(activeWorkspaceId, data);
        setSubjects(db.getSubjects(activeWorkspaceId));
        alert(`Backup Gran importado com sucesso! ${res.importedTopics} tópicos atualizados e ${res.importedSessions} registros sincronizados.`);
      } catch {
        alert('Erro ao processar o arquivo de backup JSON do Gran.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Update specific day hours availability
  const handleDailyHoursChange = (day: string, hours: number) => {
    const updatedDailyHours = {
      ...(cycleConfig.dailyHours || {}),
      [day]: Math.max(0, hours)
    };

    // Calculate sum of daily hours to keep weeklyHours in sync
    const sumWeeklyHours = Object.values(updatedDailyHours).reduce((sum, h) => sum + h, 0);

    handleSaveConfig({
      ...cycleConfig,
      dailyHours: updatedDailyHours,
      weeklyHours: sumWeeklyHours
    });
  };

  // Add a single subject manually
  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    const newSubject: Subject = {
      id: `subject-${Date.now()}`,
      name: newSubjectName.trim(),
      weight: newSubjectWeight,
      targetHours: 0,
      status: newSubjectStatus,
      topics: []
    };

    const updated = [...subjects, newSubject];
    handleSaveSubjects(updated);
    setNewSubjectName('');
    setNewSubjectWeight(3);
    setNewSubjectStatus('active');
  };

  // Import verticalized syllabus from pasted text
  const handleImportSyllabus = () => {
    if (!syllabusText.trim()) return;
    const parsed = parseVerticalSyllabus(syllabusText);
    
    const parsedSubjects: Subject[] = parsed.map((s) => ({
      ...s,
      weight: 3,
      status: 'active',
      targetHours: 0
    }));

    const updated = [...subjects, ...parsedSubjects];
    handleSaveSubjects(updated);
    setSyllabusText('');
    setShowImportArea(false);
  };

  // Update subject weight
  const handleWeightChange = (id: string, weight: number) => {
    const updated = subjects.map((s) => {
      if (s.id === id) {
        return { ...s, weight: Math.max(1, Math.min(5, weight)) };
      }
      return s;
    });
    handleSaveSubjects(updated);
  };

  // Update subject status
  const handleStatusChange = (id: string, status: SubjectStatus) => {
    const updated = subjects.map((s) => {
      if (s.id === id) {
        return { ...s, status };
      }
      return s;
    });
    handleSaveSubjects(updated);
  };

  // Delete subject
  const handleDeleteSubject = (id: string) => {
    const updated = subjects.filter((s) => s.id !== id);
    handleSaveSubjects(updated);
    const updatedBlocks = cycleBlocks.filter((b) => b.subjectId !== id);
    handleSaveBlocks(updatedBlocks);
  };

  // Generate / Regenerate Cycle Blocks based on weights and status rules
  const handleGenerateCycle = () => {
    if (subjects.length === 0) return;
    
    const blocks = generateStudyCycle(subjects, cycleConfig.weeklyHours, 90, cycleConfig.dailyHours || undefined);
    handleSaveBlocks(blocks);

    // Calculate individual target hours for display
    const maintenanceList = subjects.filter((s) => s.status === 'maintenance');
    const rawActiveList = subjects.filter((s) => s.status === 'active');
    const activeList = rawActiveList.slice(0, 5); // top 5 active

    const maintenanceMinutesTotal = maintenanceList.length * 45;
    const totalMinutes = cycleConfig.weeklyHours * 60;
    const remainingActiveMinutes = Math.max(0, totalMinutes - maintenanceMinutesTotal);

    const totalActiveWeight = activeList.reduce((sum, s) => sum + s.weight, 0);

    const updatedSubjects = subjects.map((s) => {
      if (s.status === 'maintenance') {
        return { ...s, targetHours: 0.75 };
      } else if (s.status === 'active') {
        const isActiveInCycle = activeList.some((a) => a.id === s.id);
        if (isActiveInCycle && totalActiveWeight > 0) {
          const minutes = remainingActiveMinutes * (s.weight / totalActiveWeight);
          return { ...s, targetHours: parseFloat((minutes / 60).toFixed(1)) };
        }
        return { ...s, targetHours: 0 };
      } else {
        return { ...s, targetHours: 0 };
      }
    });

    handleSaveSubjects(updatedSubjects);
  };

  // Re-schedule incomplete blocks starting from today
  const handleRescheduleOverdue = () => {
    if (cycleBlocks.length === 0) return;

    const jsDayMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const todayName = jsDayMap[new Date().getDay()];

    const updated = reallocateIncompleteBlocks(cycleBlocks, cycleConfig.dailyHours || {}, todayName);
    handleSaveBlocks(updated);
  };

  // Toggle study block completion
  const handleToggleBlock = (blockId: string) => {
    const updated = cycleBlocks.map((b) => {
      if (b.id === blockId) {
        const nextCompleted = !b.completed;
        return {
          ...b,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
        };
      }
      return b;
    });
    handleSaveBlocks(updated);
  };

  // Toggle subject accordion to view topics
  const toggleSubjectExpand = (id: string) => {
    setExpandedSubjectId(expandedSubjectId === id ? null : id);
  };

  const activeSubjectsCount = subjects.filter(s => s.status === 'active').length;

  // Calculate day states for display
  const jsDayMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const todayName = jsDayMap[new Date().getDay()];
  const todayIdx = DAYS_ORDER.indexOf(todayName);

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h2>Planejamento e Fila de Estudos</h2>
        <p className="tab-description">
          Gerencie o edital verticalizado, ajuste os pesos e defina o status de cada matéria.
          O ciclo básico limita o estudo simultâneo a 5 matérias ativas. Matérias em manutenção recebem tempos fixos.
        </p>
      </div>

      {/* Warning banner if exceeding 5 active subjects */}
      {activeSubjectsCount > 5 && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid var(--color-warning)',
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          color: 'var(--text-title)',
          marginBottom: '1rem',
          animation: 'fadeInTab 0.3s ease-out'
        }}>
          <AlertTriangle size={24} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '0.1rem' }} />
          <div>
            <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.2rem' }}>Ciclo Básico Excedido!</strong>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
              Você possui <strong>{activeSubjectsCount}</strong> matérias ativas. O ciclo distribuirá o tempo proporcional apenas entre as <strong>5 primeiras matérias ativas</strong> cadastradas na lista para evitar a pulverização de horas.
            </p>
          </div>
        </div>
      )}

      {/* Configuration & Actions Dashboard */}
      <div className="placeholder-grid" style={{ marginBottom: '1rem' }}>
        <div className="placeholder-card card-primary" style={{ minHeight: 'auto', padding: '1.5rem' }}>
          <h3>Horas Semanais Totais</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-title)' }}>
              {cycleConfig.weeklyHours}h
            </span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.2' }}>
              Calculadas com base na carga diária
            </span>
          </div>
          <button 
            onClick={() => setShowAvailabilityPanel(!showAvailabilityPanel)}
            className="mock-btn text-muted" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem', marginTop: '0.5rem', alignSelf: 'flex-start' }}
          >
            <Settings size={14} />
            {showAvailabilityPanel ? 'Fechar Horas Diárias' : 'Ajustar Horas Diárias'}
          </button>
        </div>

        <div className="placeholder-card card-secondary" style={{ minHeight: 'auto', padding: '1.5rem', justifyContent: 'center' }}>
          <button onClick={handleGenerateCycle} className="mock-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center', fontWeight: 'bold' }}>
            <RefreshCw size={18} />
            Gerar Fila do Ciclo
          </button>
          <p className="card-notes" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            Recalcula e aloca blocos proporcionalmente no calendário.
          </p>
        </div>

        <div className="placeholder-card" style={{ minHeight: 'auto', padding: '1.5rem', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(56, 189, 248, 0.08))', border: '1.5px solid rgba(16, 185, 129, 0.3)' }}>
          <button 
            onClick={() => setIsAiImportOpen(true)} 
            className="mock-btn" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center', fontWeight: 'bold' }}
          >
            <Sparkles size={18} />
            Importar com IA (1 Clique)
          </button>
          <p className="card-notes" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            Transforme qualquer edital em PDF com IA gratuita.
          </p>
        </div>

        <div className="placeholder-card card-highlight" style={{ minHeight: 'auto', padding: '1.5rem', justifyContent: 'center' }}>
          <button 
            onClick={() => setShowImportArea(!showImportArea)} 
            className="mock-btn text-muted" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center', fontWeight: 'bold' }}
          >
            <Upload size={18} />
            {showImportArea ? 'Fechar Importação' : 'Importar Texto Manual'}
          </button>
          <p className="card-notes" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            Cole o edital verticalizado estruturado.
          </p>
        </div>

        {/* GRAN BACKUP CARD */}
        <div className="placeholder-card" style={{
          minHeight: 'auto',
          padding: '1.5rem',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(13, 19, 76, 0.08))',
          border: '1.5px solid rgba(59, 130, 246, 0.25)'
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 14px',
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            textAlign: 'center',
            color: 'var(--text-main)'
          }}>
            <FileText size={16} />
            <span>Importar JSON Gran</span>
            <input type="file" accept=".json" onChange={handleImportGranJson} style={{ display: 'none' }} />
          </label>
          <p className="card-notes" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            Sincronize tópicos e resoluções do Gran Questões.
          </p>
        </div>
      </div>

      {/* Daily Availability Input Panel */}
      {showAvailabilityPanel && (
        <div className="availability-panel animate-fade-in-tab" style={{ animation: 'fadeInTab 0.3s ease-out' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-title)', marginBottom: '0.25rem' }}>
            Configurar Disponibilidade de Estudo Diário
          </h3>
          <p className="card-notes" style={{ marginBottom: '1rem' }}>
            Defina quantas horas você pode se dedicar em cada dia da semana. O total semanal será recalculado automaticamente.
          </p>
          <div className="availability-grid">
            {DAYS_ORDER.map((day) => (
              <div key={day} className="availability-day-input">
                <label>{day.replace('terca', 'terça').replace('sabado', 'sábado').replace('domingo', 'domingo')}</label>
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={cycleConfig.dailyHours ? (cycleConfig.dailyHours[day] || 0) : 0}
                  onChange={(e) => handleDailyHoursChange(day, parseInt(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Syllabus Area */}
      {showImportArea && (
        <div className="placeholder-card card-primary" style={{ padding: '1.5rem' }}>
          <h3>Importar Edital Verticalizado</h3>
          <p className="card-notes">
            Cole a estrutura do edital. Use endentação ou hífen para separar Matéria, Tópico e Subtópico.
          </p>
          <textarea
            value={syllabusText}
            onChange={(e) => setSyllabusText(e.target.value)}
            placeholder="Cole seu edital aqui..."
            rows={6}
            style={{
              width: '100%',
              padding: '0.8rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-element)',
              color: 'var(--text-title)',
              resize: 'vertical'
            }}
          />
          <button onClick={handleImportSyllabus} className="mock-btn" style={{ alignSelf: 'flex-start' }}>
            Confirmar Importação
          </button>
        </div>
      )}

      {/* Calendar Grid View (Dual View) */}
      <div className="calendar-section">
        <div className="calendar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={22} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '1.3rem', color: 'var(--text-title)' }}>Grade do Calendário Semanal</h3>
          </div>
          {cycleBlocks.length > 0 && (
            <button
              onClick={handleRescheduleOverdue}
              className="mock-btn"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
                fontWeight: 'bold',
                padding: '0.5rem 1rem',
                fontSize: '0.85rem'
              }}
            >
              Reorganizar Cronograma (Atrasos)
            </button>
          )}
        </div>

        {cycleBlocks.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            Fila vazia. Configure as matérias e clique em "Gerar Fila do Ciclo" acima.
          </p>
        ) : (
          <div className="calendar-grid">
            {DAYS_ORDER.map((day) => {
              const isToday = day === todayName;
              const dayLimit = cycleConfig.dailyHours ? (cycleConfig.dailyHours[day] || 0) : 0;
              const dayBlocks = cycleBlocks.filter((b) => b.dayAllocated === day);
              const dayIdx = DAYS_ORDER.indexOf(day);

              return (
                <div key={day} className={`calendar-column ${isToday ? 'is-today' : ''}`}>
                  <div className="calendar-day-header">
                    <span className="calendar-day-name">
                      {day.replace('terca', 'terça').replace('sabado', 'sábado')}
                    </span>
                    <span className="calendar-day-hours">Limite: {dayLimit}h</span>
                  </div>

                  {dayBlocks.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '1rem' }}>
                      Sem matérias alocadas
                    </span>
                  ) : (
                    dayBlocks.map((block) => {
                      let statusText = 'Pendente';
                      let badgeClass = 'badge-pending';
                      
                      const blockIsOverdue = !block.completed && dayIdx < todayIdx;

                      if (block.completed) {
                        statusText = 'Concluído';
                        badgeClass = 'badge-completed';
                      } else if (activeBlockId === block.id) {
                        statusText = 'Em Execução';
                        badgeClass = 'badge-running';
                      } else if (blockIsOverdue) {
                        statusText = 'Atrasado';
                        badgeClass = 'badge-overdue';
                      }

                      return (
                        <div key={block.id} className="calendar-block-card">
                          <span className="calendar-block-title">{block.subjectName}</span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="calendar-block-time">{block.durationMinutes} min</span>
                            <span className={`calendar-block-badge ${badgeClass}`}>{statusText}</span>
                          </div>

                          {!block.completed && (
                            <div className="calendar-block-action">
                              <button
                                onClick={() => onStartStudy(block.subjectId, block.subjectName, block.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  color: '#fff',
                                  fontWeight: 'bold',
                                  fontSize: '0.8rem',
                                  backgroundColor: 'var(--color-primary)',
                                  padding: '0.4rem 0.8rem',
                                  borderRadius: '6px'
                                }}
                              >
                                <Play size={12} fill="#fff" /> Estudar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Grid: Subjects Manager (Left) and Study Cycle Queue (Right) */}
      <div className="responsive-split-grid" style={{ marginTop: '1.5rem' }}>
        
        {/* Subjects List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-title)' }}>Matérias Cadastradas ({subjects.length})</h3>
          </div>

          {/* Quick Manual Add */}
          <form onSubmit={handleAddSubject} style={{
            display: 'flex',
            gap: '0.75rem',
            backgroundColor: 'var(--bg-card)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            flexWrap: 'wrap'
          }}>
            <input
              type="text"
              placeholder="Nova Matéria (ex: Auditoria)"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              style={{
                flex: '2 1 200px',
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-element)',
                color: 'var(--text-title)'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 120px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Peso:</span>
              <select
                value={newSubjectWeight}
                onChange={(e) => setNewSubjectWeight(parseInt(e.target.value))}
                style={{
                  padding: '0.6rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-element)',
                  color: 'var(--text-title)',
                  width: '100%'
                }}
              >
                {[1, 2, 3, 4, 5].map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 140px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Status:</span>
              <select
                value={newSubjectStatus}
                onChange={(e) => setNewSubjectStatus(e.target.value as SubjectStatus)}
                style={{
                  padding: '0.6rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-element)',
                  color: 'var(--text-title)',
                  width: '100%'
                }}
              >
                <option value="active">Ativa</option>
                <option value="maintenance">Manutenção</option>
                <option value="backlog">Backlog</option>
              </select>
            </div>
            <button type="submit" className="mock-btn" style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Plus size={16} /> Add
            </button>
          </form>

          {/* List of Subjects */}
          {subjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
              <p>Nenhuma matéria cadastrada ainda. Use a importação de edital ou adicione manualmente.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {subjects.map((sub) => {
                const isExpanded = expandedSubjectId === sub.id;
                const totalTopics = sub.topics.length;
                const totalSubtopics = sub.topics.reduce((acc, t) => acc + t.subtopics.length, 0);

                let statusBadgeColor = 'var(--text-muted)';
                let statusBgColor = 'var(--bg-element)';
                if (sub.status === 'active') {
                  statusBadgeColor = 'var(--color-primary)';
                  statusBgColor = 'var(--color-primary-glow)';
                } else if (sub.status === 'maintenance') {
                  statusBadgeColor = 'var(--color-warning)';
                  statusBgColor = 'rgba(245, 158, 11, 0.15)';
                }

                return (
                  <div key={sub.id} style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s'
                  }}>
                    <div style={{
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      cursor: 'pointer'
                    }} onClick={() => toggleSubjectExpand(sub.id)}>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        <div>
                          <h4 style={{ fontWeight: '700', color: 'var(--text-title)' }}>{sub.name}</h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {totalTopics} tópicos · {totalSubtopics} subtópicos
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                        
                        <select
                          value={sub.status}
                          onChange={(e) => handleStatusChange(sub.id, e.target.value as SubjectStatus)}
                          style={{
                            padding: '0.35rem 0.5rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: statusBgColor,
                            color: statusBadgeColor,
                            fontWeight: 'bold',
                            fontSize: '0.8rem'
                          }}
                        >
                          <option value="active">Ativa</option>
                          <option value="maintenance">Manutenção</option>
                          <option value="backlog">Backlog</option>
                        </select>

                        {sub.status === 'active' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Peso:</span>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              value={sub.weight}
                              onChange={(e) => handleWeightChange(sub.id, parseInt(e.target.value) || 1)}
                              style={{
                                width: '45px',
                                padding: '0.3rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-element)',
                                color: 'var(--text-title)',
                                textAlign: 'center',
                                fontWeight: 'bold'
                              }}
                            />
                          </div>
                        )}

                        {sub.status !== 'backlog' && (
                          <span style={{
                            fontSize: '0.8rem',
                            backgroundColor: 'var(--color-primary-glow)',
                            color: 'var(--color-primary)',
                            padding: '0.3rem 0.6rem',
                            borderRadius: '8px',
                            fontWeight: 'bold'
                          }}>
                            {sub.targetHours || 0}h / sem
                          </span>
                        )}

                        <button onClick={() => handleDeleteSubject(sub.id)} style={{ color: 'var(--color-danger)', padding: '0.4rem', borderRadius: '6px' }} className="theme-toggle">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '0 1rem 1rem 2.5rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.05)' }}>
                        {sub.topics.length === 0 ? (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingTop: '1rem' }}>
                            Sem tópicos cadastrados. Cole um edital para estruturar a matéria de forma automática.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem' }}>
                            {sub.topics.map((topic) => (
                              <div key={topic.id}>
                                <h5 style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-title)' }}>{topic.name}</h5>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                                  {topic.subtopics.map((subtopic) => (
                                    <span key={subtopic.id} style={{
                                      fontSize: '0.75rem',
                                      backgroundColor: 'var(--bg-element)',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '6px',
                                      color: 'var(--text-main)',
                                      border: '1px solid var(--border-color)'
                                    }}>
                                      {subtopic.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Study Cycle Blocks Queue (Sequential List View) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-title)' }}>Progresso Geral do Ciclo</h3>

          {cycleBlocks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <p>O ciclo de estudos não foi gerado ou está vazio.</p>
              <button onClick={handleGenerateCycle} className="mock-btn" style={{ padding: '0.6rem 1.2rem' }}>
                Gerar Ciclo Inicial
              </button>
            </div>
          ) : (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: 'var(--box-shadow)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                  Progresso: {cycleBlocks.filter(b => b.completed).length} / {cycleBlocks.length} Blocos
                </span>
                <span style={{
                  fontSize: '0.85rem',
                  color: 'var(--color-primary)',
                  fontWeight: 'bold'
                }}>
                  {Math.round((cycleBlocks.filter(b => b.completed).length / cycleBlocks.length) * 100)}% concluído
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height: '8px', backgroundColor: 'var(--bg-element)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                <div style={{
                  height: '100%',
                  width: `${(cycleBlocks.filter(b => b.completed).length / cycleBlocks.length) * 100}%`,
                  background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))',
                  transition: 'width 0.3s ease-out'
                }}></div>
              </div>

              {/* Blocks list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {cycleBlocks.map((block) => (
                  <div key={block.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.8rem 1rem',
                    backgroundColor: block.completed ? 'rgba(52, 211, 153, 0.05)' : 'var(--bg-element)',
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: block.completed ? 'rgba(52, 211, 153, 0.2)' : 'var(--border-color)',
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button onClick={() => handleToggleBlock(block.id)} style={{ color: block.completed ? 'var(--color-success)' : 'var(--text-muted)' }}>
                        {block.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                      </button>
                      <div>
                        <span style={{
                          fontWeight: 'bold',
                          color: block.completed ? 'var(--text-muted)' : 'var(--text-title)',
                          textDecoration: block.completed ? 'line-through' : 'none'
                        }}>
                          {block.subjectName}
                        </span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Bloco {block.order} · {block.durationMinutes} minutos · <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{block.dayAllocated || 'Não alocado'}</span>
                          {block.durationMinutes === 45 && (
                            <span style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.65rem',
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              color: 'var(--color-warning)',
                              padding: '0.1rem 0.3rem',
                              borderRadius: '4px',
                              fontWeight: 'bold'
                            }}>
                              Manutenção
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!block.completed && (
                      <button
                        onClick={() => onStartStudy(block.subjectId, block.subjectName, block.id)}
                        className="mock-btn"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      >
                        Estudar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      <AiSyllabusImportModal
        isOpen={isAiImportOpen}
        onClose={() => setIsAiImportOpen(false)}
        onWorkspaceCreated={(wsId) => {
          setSubjects(db.getSubjects(wsId));
          const syncRes = db.syncCycleSchedule(wsId);
          setCycleBlocks(syncRes.blocks);
        }}
      />
    </div>
  );
};
