import React, { useState, useEffect } from 'react';
import type { CicloWorkspace } from '../types';
import { Plus, Settings, X, Trash2, Check, AlertTriangle } from 'lucide-react';

interface WorkspaceTabBarProps {
  workspaces: CicloWorkspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string) => void;
}

export const WorkspaceTabBar: React.FC<WorkspaceTabBarProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  
  // Managing workspace modal state
  const [managingWorkspace, setManagingWorkspace] = useState<CicloWorkspace | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (managingWorkspace) {
          setManagingWorkspace(null);
        } else if (showAddModal) {
          setShowAddModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [managingWorkspace, showAddModal]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    onCreateWorkspace(newWorkspaceName.trim());
    setNewWorkspaceName('');
    setShowAddModal(false);
  };

  const handleSaveRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!managingWorkspace || !renameInput.trim()) return;
    onRenameWorkspace(managingWorkspace.id, renameInput.trim());
    setManagingWorkspace(null);
  };

  const handleDeleteConfirmed = () => {
    if (!managingWorkspace) return;
    onDeleteWorkspace(managingWorkspace.id);
    setManagingWorkspace(null);
    setShowDeleteConfirm(false);
  };

  return (
    <div
      className="workspace-tab-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0.4rem 1rem',
        gap: '0.5rem',
        overflowX: 'auto',
        overflowY: 'hidden',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        minHeight: '46px',
      }}
    >
      {/* Workspace Tabs */}
      {workspaces.map((ws) => {
        const isActive = ws.id === activeWorkspaceId;

        return (
          <div
            key={ws.id}
            onClick={() => onSelectWorkspace(ws.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isActive ? 'var(--bg-app)' : 'var(--bg-element)',
              border: '1px solid',
              borderColor: isActive ? 'var(--border-color)' : 'transparent',
              padding: '0.35rem 0.75rem',
              borderRadius: '8px',
              cursor: 'pointer',
              gap: '0.5rem',
              position: 'relative',
              transition: 'all 0.15s ease',
              minWidth: '120px',
              maxWidth: '220px',
              height: '34px',
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.84rem',
                color: isActive ? 'var(--text-title)' : 'var(--text-main)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
              }}
            >
              {ws.name}
            </span>

            {/* Settings Trigger Icon (Opens visible modal) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setManagingWorkspace(ws);
                setRenameInput(ws.name);
                setShowDeleteConfirm(false);
              }}
              style={{
                color: isActive ? 'var(--text-title)' : 'var(--text-muted)',
                opacity: isActive ? 0.9 : 0.5,
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                transition: 'all 0.15s ease',
              }}
              className="theme-toggle"
              title={`Configurações do ciclo "${ws.name}"`}
            >
              <Settings size={14} />
            </button>
          </div>
        );
      })}

      {/* Add Workspace Button */}
      <button
        type="button"
        onClick={() => {
          setNewWorkspaceName('');
          setShowAddModal(true);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.35rem 0.75rem',
          borderRadius: '8px',
          backgroundColor: 'transparent',
          border: '1px dashed var(--border-color)',
          color: 'var(--text-muted)',
          fontSize: '0.82rem',
          fontWeight: 600,
          height: '34px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
        className="theme-toggle"
      >
        <Plus size={14} /> Novo Ciclo
      </button>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. VISIBLE POP-UP MODAL: MANAGE WORKSPACE (SETTINGS GEAR)    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {managingWorkspace && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '1rem',
            animation: 'fadeInTab 0.15s ease-out',
          }}
          onClick={() => setManagingWorkspace(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1.5px solid var(--border-color, #e2e8f0)',
              borderRadius: '20px',
              padding: '24px',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--color-primary-glow, rgba(129, 140, 248, 0.15))',
                    color: 'var(--color-primary, #818cf8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Settings size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-title)' }}>
                    Gerenciar Ciclo de Estudos
                  </h3>
                  <p style={{ fontSize: '0.82rem', margin: '2px 0 0 0', opacity: 0.75 }}>
                    Personalize o nome ou gerencie as opções deste ciclo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManagingWorkspace(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                }}
                title="Fechar (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Status Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-element)',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                fontSize: '0.84rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    backgroundColor: managingWorkspace.id === activeWorkspaceId ? '#22c55e' : 'var(--text-muted)',
                    boxShadow: managingWorkspace.id === activeWorkspaceId ? '0 0 8px rgba(34, 197, 94, 0.6)' : 'none',
                  }}
                />
                <span style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                  {managingWorkspace.id === activeWorkspaceId ? 'Ciclo Ativo no Momento' : 'Ciclo Secundário'}
                </span>
              </div>
              {managingWorkspace.id !== activeWorkspaceId && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectWorkspace(managingWorkspace.id);
                    setManagingWorkspace(null);
                  }}
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  Ativar Este Ciclo
                </button>
              )}
            </div>

            {/* Rename Form */}
            <form onSubmit={handleSaveRename} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-title)' }}>
                Nome do Ciclo
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  placeholder="Ex: Concurso TCE-GO"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border-color)',
                    backgroundColor: 'var(--bg-element)',
                    color: 'var(--text-title)',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!renameInput.trim() || renameInput.trim() === managingWorkspace.name}
                  style={{
                    padding: '0 16px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor:
                      !renameInput.trim() || renameInput.trim() === managingWorkspace.name
                        ? 'var(--bg-element)'
                        : 'var(--color-primary)',
                    color:
                      !renameInput.trim() || renameInput.trim() === managingWorkspace.name
                        ? 'var(--text-muted)'
                        : '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor:
                      !renameInput.trim() || renameInput.trim() === managingWorkspace.name
                        ? 'not-allowed'
                        : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Check size={16} /> Salvar
                </button>
              </div>
            </form>

            {/* Danger Zone: Delete */}
            <div
              style={{
                borderTop: '1px solid var(--border-color)',
                paddingTop: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Gerenciamento Avançado
              </div>

              {workspaces.length <= 1 ? (
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-element)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  Este é o único ciclo cadastrado e não pode ser excluído. Para excluí-lo, crie outro ciclo primeiro.
                </div>
              ) : !showDeleteConfirm ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Excluir este ciclo e apagar todo o cronograma e sessões vinculadas a ele.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--color-danger, #ef4444)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Trash2 size={14} /> Excluir Ciclo
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1.5px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-title)', fontWeight: 600 }}>
                      Tem certeza que deseja apagar o ciclo <strong>"{managingWorkspace.name}"</strong>? Todas as matérias, sessões e cronogramas vinculados serão permanentemente apagados.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        color: 'var(--text-main)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteConfirmed}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Trash2 size={14} /> Sim, Excluir Definitivamente
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Close Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setManagingWorkspace(null)}
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-element)',
                  color: 'var(--text-title)',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. MODAL: ADICIONAR NOVO CICLO                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '1rem',
            animation: 'fadeInTab 0.15s ease-out',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1.5px solid var(--border-color, #e2e8f0)',
              borderRadius: '20px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--color-primary-glow, rgba(129, 140, 248, 0.15))',
                    color: 'var(--color-primary, #818cf8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={20} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-title)' }}>
                  Criar Novo Ciclo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
                title="Fechar (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-title)' }}>
                Nome do Ciclo de Estudos
              </label>
              <input
                type="text"
                placeholder="Ex: Pós-Edital TCDF, Concurso TJ-SP..."
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                autoFocus
                style={{
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border-color)',
                  backgroundColor: 'var(--bg-element)',
                  color: 'var(--text-title)',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  width: '100%',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!newWorkspaceName.trim()}
                style={{
                  flex: 1.2,
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: newWorkspaceName.trim() ? 'var(--color-primary)' : 'var(--bg-element)',
                  color: newWorkspaceName.trim() ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: 700,
                  cursor: newWorkspaceName.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Plus size={16} /> Criar Ciclo
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
