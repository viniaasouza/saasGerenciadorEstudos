import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseConfig } from '../../lib/supabase';
import { 
  Shield, Users, Clock, Award, MessageSquare, Bug, Lightbulb, 
  Heart, HelpCircle, CheckCircle2, Trash2, 
  Download, Lock, Terminal
} from 'lucide-react';

interface AdminTabProps {
  onOpenAuthModal: () => void;
}

export const AdminTab: React.FC<AdminTabProps> = ({ onOpenAuthModal }) => {
  const { 
    user, 
    isAdmin, 
    systemMetrics, 
    feedbacks, 
    updateFeedbackStatus, 
    deleteFeedback, 
    allUsers,
    isDemoMode
  } = useAuth();

  const [filterType, setFilterType] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'overview' | 'feedbacks' | 'users' | 'health'>('overview');

  // If not admin, render an access-restricted gate with prompt to authenticate
  if (!isAdmin) {
    return (
      <div style={{ maxWidth: '640px', margin: '4rem auto', textAlign: 'center', padding: '2rem' }}>
        <div className="card-primary" style={{ padding: '3rem 2rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}
          >
            <Lock size={28} />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
            Painel Restrito ao Administrador
          </h2>

          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '2rem' }}>
            Esta área é reservada para o proprietário do <strong>estud.ai</strong> para acompanhamento de métricas de cadastro, relatórios de bugs e saúde da infraestrutura.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={onOpenAuthModal}
              className="mock-btn"
              style={{
                padding: '0.8rem 1.6rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Lock size={16} />
              <span>Fazer Login como Administrador</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter feedbacks
  const filteredFeedbacks = feedbacks.filter((f) => {
    if (filterType !== 'todos' && f.type !== filterType) return false;
    if (filterStatus !== 'todos' && f.status !== filterStatus) return false;
    return true;
  });

  const getStorageUsage = () => {
    let total = 0;
    for (let x in localStorage) {
      if (localStorage.hasOwnProperty(x)) {
        total += (localStorage[x].length * 2);
      }
    }
    return (total / 1024).toFixed(1); // KB
  };

  const handleExportDiagnostics = () => {
    const report = {
      timestamp: new Date().toISOString(),
      adminUser: user?.email,
      metrics: systemMetrics,
      usersCount: allUsers.length,
      feedbacksCount: feedbacks.length,
      feedbacks,
      storageUsedKB: getStorageUsage(),
      supabaseConfig: getSupabaseConfig(),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estud-ai-relatorio-admin-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeIcons: Record<string, React.ReactNode> = {
    bug: <Bug size={14} color="#ef4444" />,
    sugestao: <Lightbulb size={14} color="#f59e0b" />,
    elogio: <Heart size={14} color="#ec4899" />,
    outro: <HelpCircle size={14} color="#6366f1" />,
  };

  return (
    <div className="admin-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 0' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield size={20} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
              Painel de Controle do Administrador
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Visão gerencial de usuários, bugs reportados, métricas de estudo e saúde do sistema.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={handleExportDiagnostics}
            className="mock-btn text-muted"
            style={{ fontSize: '0.85rem', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} />
            <span>Exportar Relatório</span>
          </button>
        </div>
      </div>

      {/* Admin Sub-Tabs Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        {[
          { id: 'overview', label: 'Visão Geral & Métricas' },
          { id: 'feedbacks', label: `Bugs & Feedbacks (${systemMetrics.openFeedbacks} abertos)` },
          { id: 'users', label: `Usuários (${systemMetrics.totalUsers})` },
          { id: 'health', label: 'Diagnóstico & Segurança' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveAdminSubTab(tab.id as any)}
            className={`mock-btn ${activeAdminSubTab === tab.id ? 'card-primary' : 'text-muted'}`}
            style={{
              padding: '0.6rem 1.2rem',
              fontSize: '0.875rem',
              fontWeight: activeAdminSubTab === tab.id ? 700 : 500,
              borderBottom: activeAdminSubTab === tab.id ? '2px solid var(--color-accent)' : undefined,
              borderRadius: '8px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: OVERVIEW METRICS */}
      {activeAdminSubTab === 'overview' && (
        <div>
          {/* Key Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            <div className="card-primary" style={{ padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total de Usuários</span>
                <Users size={18} color="#3b82f6" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '0.5rem' }}>
                {systemMetrics.totalUsers}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
                Ativos no sistema
              </div>
            </div>

            <div className="card-primary" style={{ padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Horas Estudadas</span>
                <Clock size={18} color="#10b981" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '0.5rem' }}>
                {systemMetrics.totalStudyHours}h
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Horas líquidas reais
              </div>
            </div>

            <div className="card-primary" style={{ padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Questões Resolvidas</span>
                <Award size={18} color="#f59e0b" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '0.5rem' }}>
                {systemMetrics.totalQuestions}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Taxa média: {systemMetrics.averageAccuracy}% acertos
              </div>
            </div>

            <div className="card-primary" style={{ padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Feedbacks & Bugs</span>
                <MessageSquare size={18} color="#ec4899" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '0.5rem' }}>
                {systemMetrics.totalFeedbacks}
              </div>
              <div style={{ fontSize: '0.75rem', color: systemMetrics.openFeedbacks > 0 ? '#ef4444' : '#10b981', marginTop: '0.25rem' }}>
                {systemMetrics.openFeedbacks} aguardando análise
              </div>
            </div>
          </div>

          {/* Quick Status and Recent Activity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
            <div className="card-primary" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>
                Conexão da Plataforma
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status de Nuvem</span>
                  <span style={{ fontWeight: 700, color: !isDemoMode ? '#10b981' : '#f59e0b' }}>
                    {!isDemoMode ? 'Supabase Conectado' : 'Modo Demonstração / Local'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>E-mail de Administrador</span>
                  <span style={{ fontWeight: 600 }}>{user?.email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Armazenamento Local Utilizado</span>
                  <span style={{ fontWeight: 600 }}>{getStorageUsage()} KB</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total de Editais/Ciclos</span>
                  <span style={{ fontWeight: 600 }}>{systemMetrics.totalWorkspaces}</span>
                </div>
              </div>
            </div>

            <div className="card-primary" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>
                Diretrizes de Lançamento Gratuito
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                A plataforma está 100% gratuita para acumular tração e feedbacks. O foco atual é:
              </p>
              <ul style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.5rem', lineHeight: '1.6', paddingLeft: '1.25rem' }}>
                <li>Validar a facilidade de importação de editais com IA por concurseiros leigos.</li>
                <li>Garantir taxa de retenção com o piloto automático diário e SM-2.</li>
                <li>Resolver qualquer bug reportado com alta prioridade no painel de feedbacks.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: FEEDBACKS & BUGS */}
      {activeAdminSubTab === 'feedbacks' && (
        <div>
          {/* Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(['todos', 'bug', 'sugestao', 'elogio', 'outro'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`mock-btn ${filterType === t ? 'card-primary' : 'text-muted'}`}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '20px',
                    borderColor: filterType === t ? 'var(--color-accent)' : undefined,
                    textTransform: 'capitalize',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['todos', 'aberto', 'em_analise', 'resolvido'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`mock-btn ${filterStatus === s ? 'card-primary' : 'text-muted'}`}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '20px',
                    textTransform: 'capitalize',
                  }}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback List */}
          {filteredFeedbacks.length === 0 ? (
            <div className="card-primary" style={{ padding: '3rem', textAlign: 'center', borderRadius: '16px', color: 'var(--text-muted)' }}>
              Nenhum relato encontrado com os filtros atuais.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredFeedbacks.map((item) => (
                <div
                  key={item.id}
                  className="card-primary"
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {typeIcons[item.type]}
                        <span>{item.type}</span>
                      </span>

                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                        {item.title}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select
                        value={item.status}
                        onChange={(e) => updateFeedbackStatus(item.id, e.target.value as any)}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor:
                            item.status === 'resolvido'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : item.status === 'em_analise'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                          color:
                            item.status === 'resolvido'
                              ? '#10b981'
                              : item.status === 'em_analise'
                              ? '#f59e0b'
                              : '#ef4444',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="aberto">Aberto</option>
                        <option value="em_analise">Em Análise</option>
                        <option value="resolvido">Resolvido</option>
                      </select>

                      <button
                        onClick={() => deleteFeedback(item.id)}
                        className="mock-btn text-muted"
                        style={{ padding: '4px 8px', color: '#ef4444' }}
                        title="Excluir Feedback"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5', margin: 0 }}>
                    {item.description}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <div>
                      Por: <strong>{item.userName}</strong> ({item.userEmail})
                    </div>
                    <div>
                      {new Date(item.createdAt).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: USERS DIRECTORY */}
      {activeAdminSubTab === 'users' && (
        <div className="card-primary" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>
            Usuários Cadastrados ({allUsers.length})
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Nome</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>E-mail</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Função</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Origem</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Data de Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{u.name}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>{u.email}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: u.role === 'admin' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: u.role === 'admin' ? '#ef4444' : '#3b82f6',
                        }}
                      >
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>
                      {u.provider === 'supabase' ? 'Nuvem (Supabase)' : 'Local / Demo'}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>
                      {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: HEALTH & SECURITY */}
      {activeAdminSubTab === 'health' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card-primary" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} color="var(--color-accent)" />
              <span>Diagnóstico de Segurança & Políticas RLS</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} />
                  <span>Sanitização Anti-XSS Ativa</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Todas as entradas de usuários (notas, títulos, tópicos e feedbacks) passam por escape de caracteres HTML antes do salvamento e renderização.
                </p>
              </div>

              <div style={{ padding: '1rem', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} />
                  <span>Isolamento por Workspace & Usuário</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Sessões de estudo, histórico de questões e ciclo semanal são isolados por ID de workspace, impedindo poluição cruzada de dados.
                </p>
              </div>

              <div style={{ padding: '1rem', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} />
                  <span>Mascaramento de Erros Internos</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Caminhos de arquivo locais do sistema operacional ou tokens não são vazados na interface gráfica em caso de exceções.
                </p>
              </div>
            </div>
          </div>

          <div className="card-primary" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={18} color="#3b82f6" />
              <span>Instruções para Deploy na Nuvem (Supabase & Hosting)</span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Para conectar um banco Supabase em produção, crie um projeto gratuito no Supabase, execute o script SQL disponibilizado em <code>supabase_schema.sql</code> e configure as variáveis de ambiente na Vercel ou Netlify:
            </p>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.75rem' }}>
              VITE_SUPABASE_URL=https://seu-projeto.supabase.co<br />
              VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui<br />
              VITE_ADMIN_EMAIL=seu-email-admin@estud.ai
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
