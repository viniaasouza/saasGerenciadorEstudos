import React, { useState } from 'react';
import type { CicloWorkspace } from '../types';
import { Plus, Settings, X, Edit3, Trash2, Check } from 'lucide-react';

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
  const [showSettingsDropdown, setShowSettingsDropdown] = useState<string | null>(null);
  
  // Renaming state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    onCreateWorkspace(newWorkspaceName.trim());
    setNewWorkspaceName('');
    setShowAddModal(false);
  };

  const handleStartRename = (ws: CicloWorkspace) => {
    setRenamingId(ws.id);
    setRenameValue(ws.name);
    setShowSettingsDropdown(null);
  };

  const handleSaveRename = (id: string) => {
    if (!renameValue.trim()) return;
    onRenameWorkspace(id, renameValue.trim());
    setRenamingId(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja excluir o ciclo "${name}"? Todos os editais e cronogramas específicos deste ciclo serão permanentemente apagados.`)) {
      onDeleteWorkspace(id);
      setShowSettingsDropdown(null);
    }
  };

  return (
    <div className="workspace-tab-bar" style={{
      display: 'flex',
      alignItems: 'center',
      backgroundColor: 'var(--bg-sidebar)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0.5rem 1rem 0',
      gap: '0.5rem',
      overflowX: 'auto',
      position: 'sticky',
      top: 0,
      zIndex: 20
    }}>
      {/* Workspace Tabs */}
      {workspaces.map((ws) => {
        const isActive = ws.id === activeWorkspaceId;
        const isRenaming = ws.id === renamingId;

        return (
          <div
            key={ws.id}
            onClick={() => !isRenaming && onSelectWorkspace(ws.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isActive ? 'var(--bg-app)' : 'transparent',
              border: '1px solid',
              borderColor: isActive ? 'var(--border-color)' : 'transparent',
              borderBottom: isActive ? '1px solid var(--bg-app)' : 'transparent',
              marginBottom: '-1px',
              padding: '0.5rem 1rem',
              borderRadius: '8px 8px 0 0',
              cursor: isRenaming ? 'default' : 'pointer',
              gap: '0.5rem',
              position: 'relative',
              transition: 'all 0.2s',
              minWidth: '140px',
              maxWidth: '220px'
            }}
          >
            {isRenaming ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: '100%' }} onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(ws.id)}
                  autoFocus
                  style={{
                    padding: '0.2rem',
                    border: '1px solid var(--color-primary)',
                    backgroundColor: 'var(--bg-element)',
                    color: 'var(--text-title)',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    width: '80%'
                  }}
                />
                <button onClick={() => handleSaveRename(ws.id)} style={{ color: 'var(--color-success)' }}><Check size={14} /></button>
              </div>
            ) : (
              <>
                <span style={{
                  fontWeight: isActive ? 'bold' : '500',
                  fontSize: '0.85rem',
                  color: isActive ? 'var(--text-title)' : 'var(--text-main)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1
                }}>
                  {ws.name}
                </span>

                {/* Settings Trigger Icon */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettingsDropdown(showSettingsDropdown === ws.id ? null : ws.id);
                  }}
                  style={{
                    color: 'var(--text-muted)',
                    opacity: isActive ? 1 : 0.4,
                    padding: '0.2rem',
                    borderRadius: '4px'
                  }}
                  className="theme-toggle"
                >
                  <Settings size={12} />
                </button>

                {/* Inline Settings Dropdown */}
                {showSettingsDropdown === ws.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: '0.5rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      boxShadow: 'var(--box-shadow-hover)',
                      padding: '0.4rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      zIndex: 30,
                      minWidth: '120px'
                    }}
                  >
                    <button
                      onClick={() => handleStartRename(ws)}
                      className="workspace-dropdown-item"
                    >
                      <Edit3 size={12} /> Renomear
                    </button>
                    <button
                      onClick={() => handleDelete(ws.id, ws.name)}
                      disabled={workspaces.length <= 1}
                      className="workspace-dropdown-item danger"
                    >
                      <Trash2 size={12} /> Excluir
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Add Workspace Button */}
      <button
        onClick={() => setShowAddModal(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.4rem 0.8rem',
          borderRadius: '6px',
          backgroundColor: 'var(--bg-element)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-title)',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          marginBottom: '0.25rem'
        }}
        className="theme-toggle"
      >
        <Plus size={14} /> Novo Ciclo
      </button>

      {/* Add Workspace Modal */}
      {showAddModal && (
        <div style={{
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
          zIndex: 9999
        }} onClick={() => setShowAddModal(false)}>
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="placeholder-card card-primary"
            style={{ width: '90%', maxWidth: '400px', gap: '1.25rem', padding: '2rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Criar Novo Ciclo de Estudos</h3>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-title)' }}>Nome do Ciclo</label>
              <input
                type="text"
                placeholder="Ex: Pós-Edital TCDF"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                autoFocus
                style={{
                  padding: '0.8rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-element)',
                  color: 'var(--text-title)',
                  width: '100%'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => setShowAddModal(false)} className="mock-btn text-muted" style={{ flex: 1, padding: '0.8rem' }}>
                Cancelar
              </button>
              <button type="submit" className="mock-btn" style={{ flex: 1, padding: '0.8rem' }}>
                Criar Ciclo
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
