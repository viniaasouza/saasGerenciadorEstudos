import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../db/database';
import { buildGranQuestoesUrl } from '../../data/tceGoPreset';
import type { SpacedReview, Subject } from '../../types';
import { 
  RotateCcw, CheckCircle2, 
  Trash2, Plus, ExternalLink, Play, Sparkles
} from 'lucide-react';

interface ReviewsTabProps {
  activeWorkspaceId: string;
  onStartStudy?: (subjectId: string, subjectName: string) => void;
}

export const ReviewsTab: React.FC<ReviewsTabProps> = ({ activeWorkspaceId, onStartStudy }) => {
  const [revisoes, setRevisoes] = useState<SpacedReview[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  // Manual add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [newIntervalDays, setNewIntervalDays] = useState(7);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = useCallback(() => {
    if (!activeWorkspaceId) return;
    setRevisoes(db.getRevisoes(activeWorkspaceId));
    setSubjects(db.getSubjects(activeWorkspaceId));
  }, [activeWorkspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveReviews = (updated: SpacedReview[]) => {
    setRevisoes(updated);
    db.saveRevisoes(activeWorkspaceId, updated);
  };

  const handleToggleDone = (id: string) => {
    const todayIso = new Date().toISOString();
    const updated = revisoes.map((r) => {
      if (r.id === id) {
        const nextDone = !r.done;
        return {
          ...r,
          done: nextDone,
          completedAt: nextDone ? todayIso : undefined,
        };
      }
      return r;
    });
    handleSaveReviews(updated);
  };

  const handleDelete = (id: string) => {
    const updated = revisoes.filter((r) => r.id !== id);
    handleSaveReviews(updated);
  };

  const getReviewGranUrl = (r: SpacedReview) => {
    const matchSub = subjects.find((s) => s.id === r.subjectId);
    let matchAssuntoId = matchSub?.assuntoId;
    let matchDisciplinaId = matchSub?.disciplinaId;
    let granQuery = r.topicName;

    if (matchSub) {
      for (const t of matchSub.topics || []) {
        if (
          t.name.toLowerCase().includes(r.topicName.toLowerCase()) ||
          r.topicName.toLowerCase().includes(t.name.toLowerCase())
        ) {
          if (t.assuntoId) matchAssuntoId = t.assuntoId;
          if (t.disciplinaId) matchDisciplinaId = t.disciplinaId;
          if (t.granQuery) granQuery = t.granQuery;
        }
        for (const st of t.subtopics || []) {
          if (
            st.name.toLowerCase().includes(r.topicName.toLowerCase()) ||
            r.topicName.toLowerCase().includes(st.name.toLowerCase())
          ) {
            if (st.assuntoId) matchAssuntoId = st.assuntoId;
            if (st.disciplinaId) matchDisciplinaId = st.disciplinaId;
            if (st.granQuery) granQuery = st.granQuery;
          }
        }
      }
    }

    return buildGranQuestoesUrl({
      assuntoId: matchAssuntoId,
      disciplinaId: matchDisciplinaId,
      query: granQuery,
      banca: 'FCC',
      filterBanca: true
    });
  };

  const handleCreateReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    const sub = subjects.find((s) => s.id === newSubjectId);
    const revDate = new Date();
    revDate.setDate(revDate.getDate() + newIntervalDays);

    const newRev: SpacedReview = {
      id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      subjectId: sub?.id || 'geral',
      subjectName: sub?.name || 'Geral',
      topicName: newTopicName.trim(),
      studyDate: todayStr,
      revDate: revDate.toISOString().split('T')[0],
      days: newIntervalDays,
      done: false,
      workspaceId: activeWorkspaceId
    };

    handleSaveReviews([newRev, ...revisoes]);
    setNewTopicName('');
    setShowAddForm(false);
  };

  // Group classification
  const groups = {
    overdue: [] as SpacedReview[],
    today: [] as SpacedReview[],
    week: [] as SpacedReview[],
    later: [] as SpacedReview[],
    done: [] as SpacedReview[],
  };

  revisoes.forEach((r) => {
    if (r.done) {
      groups.done.push(r);
      return;
    }

    const diffDays = Math.ceil(
      (new Date(r.revDate + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000
    );

    if (diffDays < 0) {
      groups.overdue.push(r);
    } else if (diffDays === 0) {
      groups.today.push(r);
    } else if (diffDays <= 7) {
      groups.week.push(r);
    } else {
      groups.later.push(r);
    }
  });

  const groupConfigs = [
    { key: 'overdue', label: 'Atrasadas', icon: '🔴', items: groups.overdue, badgeColor: '#fee2e2', textColor: '#b91c1c' },
    { key: 'today', label: 'Revisar Hoje', icon: '🟡', items: groups.today, badgeColor: '#fef3c7', textColor: '#b45309' },
    { key: 'week', label: 'Esta Semana', icon: '🔵', items: groups.week, badgeColor: '#dbeafe', textColor: '#1d4ed8' },
    { key: 'later', label: 'Próximas', icon: '⚪', items: groups.later, badgeColor: '#f1f5f9', textColor: '#64748b' },
    { key: 'done', label: 'Concluídas', icon: '🟢', items: groups.done, badgeColor: '#dcfce7', textColor: '#15803d' },
  ];

  return (
    <div className="tab-content reviews-tab">
      <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '20px' }}>
        <div>
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw className="text-primary" size={24} />
            Cronograma de Revisões Espaçadas
          </h2>
          <p className="section-description">
            Retenha até 90% do conteúdo estudado com revisões programadas (7d, 15d, 21d, 30d).
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            background: 'var(--primary-color, #0d134c)',
            color: '#ffffff',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <Plus size={16} />
          <span>Agendar Revisão Manual</span>
        </button>
      </div>

      {/* ADD REVISION FORM MODAL / COLLAPSE */}
      {showAddForm && (
        <form 
          onSubmit={handleCreateReview}
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1.5px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>➕ Nova Revisão Programada</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Disciplina</label>
              <select 
                value={newSubjectId}
                onChange={(e) => setNewSubjectId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--card-bg, #ffffff)', color: 'inherit' }}
              >
                <option value="">— Selecione a disciplina —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tópico / Assunto</label>
              <input 
                type="text" 
                placeholder="Ex: Padrões de Projeto, Dockerfile, Crase..."
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--card-bg, #ffffff)', color: 'inherit' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Prazo de Revisão</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[7, 15, 21, 30].map((days) => (
                  <button
                    type="button"
                    key={days}
                    onClick={() => setNewIntervalDays(days)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      background: newIntervalDays === days ? 'var(--primary-color, #0d134c)' : 'transparent',
                      color: newIntervalDays === days ? '#ffffff' : 'inherit',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', background: 'transparent', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#22c55e', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
            >
              Salvar Revisão
            </button>
          </div>
        </form>
      )}

      {/* REVISION GROUPS */}
      <div className="review-groups-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {revisoes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '16px',
            border: '1.5px dashed var(--border-color, #cbd5e1)'
          }}>
            <Sparkles size={40} opacity={0.4} style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Nenhuma revisão agendada ainda</h3>
            <p style={{ fontSize: '0.85rem', opacity: 0.7, maxWidth: '400px', margin: '6px auto 16px' }}>
              Ao finalizar suas sessões no Cronômetro, selecione "Agendar Revisão" para reter o aprendizado de forma científica.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--primary-color, #0d134c)', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
            >
              Agendar Primeira Revisão
            </button>
          </div>
        ) : (
          groupConfigs.map((group) => {
            if (group.items.length === 0) return null;

            return (
              <div 
                key={group.key}
                style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1.5px solid var(--border-color, #e2e8f0)',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}
              >
                {/* GROUP HEADER */}
                <div style={{
                  padding: '12px 18px',
                  background: 'rgba(0,0,0,0.02)',
                  borderBottom: '1px solid var(--border-color, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                    <span>{group.icon}</span>
                    <span>{group.label}</span>
                  </div>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: group.badgeColor,
                    color: group.textColor
                  }}>
                    {group.items.length} {group.items.length === 1 ? 'tópico' : 'tópicos'}
                  </span>
                </div>

                {/* GROUP ITEMS LIST */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {group.items.map((r) => {
                    const [ry, rm, rd] = r.revDate.split('-');
                    const formattedRevDate = `${rd}/${rm}/${ry}`;

                    return (
                      <div 
                        key={r.id}
                        style={{
                          padding: '12px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px',
                          borderBottom: '1px solid var(--border-color, #f1f5f9)',
                          background: r.done ? 'rgba(34,197,94,0.03)' : 'transparent'
                        }}
                      >
                        <div style={{ flex: '1 1 250px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: 'var(--border-color, #e2e8f0)',
                              color: 'inherit'
                            }}>
                              {r.subjectName}
                            </span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                              Prazo: {formattedRevDate} ({r.days}d)
                            </span>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '4px', textDecoration: r.done ? 'line-through' : 'none', opacity: r.done ? 0.6 : 1 }}>
                            {r.topicName}
                          </div>
                        </div>

                        {/* ACTIONS */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {/* Gran Questoes Button */}
                          <a
                            href={getReviewGranUrl(r)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              background: 'rgba(200, 16, 46, 0.08)',
                              color: '#c8102e',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textDecoration: 'none',
                              border: '1px solid rgba(200, 16, 46, 0.2)'
                            }}
                            title="Resolver questões sobre este tópico no Gran Questões (Filtro Inteligente)"
                          >
                            <span>🎯 Gran</span>
                            <ExternalLink size={12} />
                          </a>

                          {/* Quick Study Button */}
                          {onStartStudy && (
                            <button
                              onClick={() => onStartStudy(r.subjectId, r.subjectName)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 10px',
                                background: 'transparent',
                                border: '1px solid var(--border-color, #cbd5e1)',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              title="Iniciar cronômetro para revisar"
                            >
                              <Play size={11} fill="currentColor" />
                              <span>Revisar</span>
                            </button>
                          )}

                          {/* Toggle Done Button */}
                          <button
                            onClick={() => handleToggleDone(r.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: r.done ? '#f1f5f9' : '#22c55e',
                              color: r.done ? '#475569' : '#ffffff'
                            }}
                          >
                            <CheckCircle2 size={13} />
                            <span>{r.done ? 'Reabrir' : 'Concluir'}</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDelete(r.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              opacity: 0.5,
                              padding: '4px'
                            }}
                            title="Excluir revisão"
                          >
                            <Trash2 size={15} color="#ef4444" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
