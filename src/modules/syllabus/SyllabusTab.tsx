import React, { useState, useEffect } from 'react';
import { db } from '../../db/database';
import { buildGranQuestoesUrl } from '../../data/tceGoPreset';
import type { Subject, Topic, Subtopic } from '../../types';
import { AiSyllabusImportModal } from './AiSyllabusImportModal';
import { 
  CheckCircle2, Circle, ChevronDown, ChevronUp, ExternalLink, 
  Search, BookOpen, Play, Video, FileText, StickyNote,
  Tv, Edit3, X, Save, Link as LinkIcon, Sparkles
} from 'lucide-react';

const normalizeUrl = (url?: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

interface SyllabusTabProps {
  activeWorkspaceId: string;
  onStartStudy: (subjectId: string, subjectName: string) => void;
}

type FilterMode = 'todos' | 'pendentes' | 'concluidos' | 'videos_pendentes' | 'pdfs_pendentes' | 'com_notas' | 'questoes';

export const SyllabusTab: React.FC<SyllabusTabProps> = ({ activeWorkspaceId, onStartStudy }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [expandedSubjectIds, setExpandedSubjectIds] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBanca, setFilterBanca] = useState(true);
  const [bancaName, setBancaName] = useState('FCC');

  // Modals state
  const [quickNotesModal, setQuickNotesModal] = useState<{
    subjectId: string;
    topicId: string;
    subtopic?: Subtopic;
    title: string;
    notes: string;
  } | null>(null);

  const [courseLinkModal, setCourseLinkModal] = useState<{
    subject: Subject;
    topic?: Topic;
    url: string;
  } | null>(null);

  const [editClassModal, setEditClassModal] = useState<{
    subjectId: string;
    topicId: string;
    subtopic: Subtopic;
    videoWatched: boolean;
    videoLesson: string;
    videoBlock: string;
    videoUrl: string;
    pdfRead: boolean;
    pdfLesson: string;
    pdfPages: string;
    pdfUrl: string;
    notes: string;
  } | null>(null);

  const [isAiImportOpen, setIsAiImportOpen] = useState(false);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const loaded = db.getSubjects(activeWorkspaceId);
    setSubjects(loaded);
    // Expand first 2 subjects by default if any
    if (loaded.length > 0) {
      setExpandedSubjectIds([loaded[0].id, loaded[1]?.id].filter(Boolean) as string[]);
    }
    const info = db.getConcursoInfo(activeWorkspaceId);
    if (info?.banca) {
      const match = info.banca.includes('FCC') ? 'FCC' : info.banca.split(' ')[0];
      setBancaName(match);
    }
  }, [activeWorkspaceId]);

  const handleSaveSubjects = (updated: Subject[]) => {
    setSubjects(updated);
    db.saveSubjects(activeWorkspaceId, updated);
  };

  // Toggle single subtopic completion (overall theory)
  const handleToggleSubtopic = (subjectId: string, topicId: string, subtopicId: string) => {
    const updated = subjects.map((sub) => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        topics: sub.topics.map((t) => {
          if (t.id !== topicId) return t;
          return {
            ...t,
            subtopics: t.subtopics.map((st) => {
              if (st.id !== subtopicId) return st;
              const nextDone = !st.completed;
              return {
                ...st,
                completed: nextDone,
                completedAt: nextDone ? new Date().toLocaleDateString('pt-BR') : undefined
              };
            })
          };
        })
      };
    });
    handleSaveSubjects(updated);
  };

  // Toggle videoaula completed
  const handleToggleVideo = (subjectId: string, topicId: string, subtopicId: string) => {
    const updated = subjects.map((sub) => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        topics: sub.topics.map((t) => {
          if (t.id !== topicId) return t;
          return {
            ...t,
            subtopics: t.subtopics.map((st) => {
              if (st.id !== subtopicId) return st;
              const nextVid = !st.videoWatched;
              return {
                ...st,
                videoWatched: nextVid
              };
            })
          };
        })
      };
    });
    handleSaveSubjects(updated);
  };

  // Toggle PDF read
  const handleTogglePdf = (subjectId: string, topicId: string, subtopicId: string) => {
    const updated = subjects.map((sub) => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        topics: sub.topics.map((t) => {
          if (t.id !== topicId) return t;
          return {
            ...t,
            subtopics: t.subtopics.map((st) => {
              if (st.id !== subtopicId) return st;
              const nextPdf = !st.pdfRead;
              return {
                ...st,
                pdfRead: nextPdf
              };
            })
          };
        })
      };
    });
    handleSaveSubjects(updated);
  };

  // Update question counts on a subtopic
  const handleUpdateQuestions = (
    subjectId: string, 
    topicId: string, 
    subtopicId: string, 
    field: 'acertos' | 'erros', 
    val: number
  ) => {
    const updated = subjects.map((sub) => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        topics: sub.topics.map((t) => {
          if (t.id !== topicId) return t;
          return {
            ...t,
            subtopics: t.subtopics.map((st) => {
              if (st.id !== subtopicId) return st;
              return {
                ...st,
                [field]: Math.max(0, val)
              };
            })
          };
        })
      };
    });
    handleSaveSubjects(updated);
  };

  // Save Quick Notes (subtopic or topic)
  const handleSaveNotes = () => {
    if (!quickNotesModal) return;
    const { subjectId, topicId, subtopic, notes } = quickNotesModal;
    const cleanNotes = notes.trim() || undefined;

    const updated = subjects.map((sub) => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        topics: sub.topics.map((t) => {
          if (t.id !== topicId) return t;
          if (subtopic) {
            return {
              ...t,
              subtopics: t.subtopics.map((st) => {
                if (st.id !== subtopic.id) return st;
                return {
                  ...st,
                  notes: cleanNotes
                };
              })
            };
          } else {
            return {
              ...t,
              notes: cleanNotes
            };
          }
        })
      };
    });
    handleSaveSubjects(updated);
    setQuickNotesModal(null);
  };

  // Save Edit Class Modal
  const handleSaveClassEdit = () => {
    if (!editClassModal) return;
    const {
      subjectId, topicId, subtopic,
      videoWatched, videoLesson, videoBlock, videoUrl,
      pdfRead, pdfLesson, pdfPages, pdfUrl, notes
    } = editClassModal;

    const updated = subjects.map((sub) => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        topics: sub.topics.map((t) => {
          if (t.id !== topicId) return t;
          return {
            ...t,
            subtopics: t.subtopics.map((st) => {
              if (st.id !== subtopic.id) return st;
              return {
                ...st,
                videoWatched,
                videoLesson: videoLesson.trim() || undefined,
                videoBlock: videoBlock.trim() || undefined,
                videoUrl: normalizeUrl(videoUrl) || undefined,
                pdfRead,
                pdfLesson: pdfLesson.trim() || undefined,
                pdfPages: pdfPages.trim() || undefined,
                pdfUrl: normalizeUrl(pdfUrl) || undefined,
                notes: notes.trim() || undefined
              };
            })
          };
        })
      };
    });
    handleSaveSubjects(updated);
    setEditClassModal(null);
  };

  // Save Gran Course Link (Subject or Topic)
  const handleSaveCourseUrl = () => {
    if (!courseLinkModal) return;
    const { subject, topic, url } = courseLinkModal;
    const cleanUrl = normalizeUrl(url) || undefined;

    if (topic) {
      const updated = subjects.map((sub) => {
        if (sub.id !== subject.id) return sub;
        return {
          ...sub,
          topics: sub.topics.map((t) => {
            if (t.id !== topic.id) return t;
            return {
              ...t,
              courseUrl: cleanUrl
            };
          })
        };
      });
      handleSaveSubjects(updated);
    } else {
      const updated = subjects.map((sub) => {
        if (sub.id !== subject.id) return sub;
        return {
          ...sub,
          granCourseUrl: cleanUrl
        };
      });
      handleSaveSubjects(updated);
    }
    setCourseLinkModal(null);
  };

  // Open Gran Course or Prompt to Configure (Fallback: directUrl -> topic.courseUrl -> subject.granCourseUrl)
  const handleOpenCourseLink = (subject: Subject, topic?: Topic, directUrl?: string) => {
    const rawTarget = directUrl || topic?.courseUrl || subject.granCourseUrl;
    if (rawTarget && rawTarget.trim()) {
      window.open(normalizeUrl(rawTarget), '_blank', 'noopener,noreferrer');
    } else {
      setCourseLinkModal({
        subject,
        topic,
        url: topic?.courseUrl || subject.granCourseUrl || 'https://www.grancursosonline.com.br/aluno/espaco/meus-cursos'
      });
    }
  };

  // Toggle accordion item
  const toggleExpand = (id: string) => {
    setExpandedSubjectIds((prev) => 
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const expandAll = () => {
    setExpandedSubjectIds(subjects.map((s) => s.id));
  };

  const collapseAll = () => {
    setExpandedSubjectIds([]);
  };

  // Global statistics calculation
  let totalTopics = 0;
  let completedTopics = 0;
  let totalVideos = 0;
  let completedVideos = 0;
  let totalPdfs = 0;
  let completedPdfs = 0;
  let totalAcertos = 0;
  let totalErros = 0;

  subjects.forEach((s) => {
    s.topics.forEach((t) => {
      t.subtopics.forEach((st) => {
        totalTopics++;
        if (st.completed) completedTopics++;
        totalVideos++;
        if (st.videoWatched) completedVideos++;
        totalPdfs++;
        if (st.pdfRead) completedPdfs++;
        totalAcertos += st.acertos || 0;
        totalErros += st.erros || 0;
      });
    });
  });

  const progressPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
  const videoPct = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;
  const pdfPct = totalPdfs > 0 ? Math.round((completedPdfs / totalPdfs) * 100) : 0;
  const totalQuestions = totalAcertos + totalErros;
  const accuracyPct = totalQuestions > 0 ? Math.round((totalAcertos / totalQuestions) * 100) : 0;

  // Filter subtopics based on current filters and search
  const isSubtopicVisible = (st: Subtopic, subName: string, topName: string, topNotes?: string) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const match = 
        st.name.toLowerCase().includes(term) ||
        subName.toLowerCase().includes(term) ||
        topName.toLowerCase().includes(term);
      if (!match) return false;
    }

    if (filterMode === 'pendentes') return !st.completed;
    if (filterMode === 'concluidos') return st.completed;
    if (filterMode === 'videos_pendentes') return !st.videoWatched;
    if (filterMode === 'pdfs_pendentes') return !st.pdfRead;
    if (filterMode === 'com_notas') return (!!st.notes && st.notes.trim().length > 0) || (!!topNotes && topNotes.trim().length > 0);
    if (filterMode === 'questoes') return ((st.acertos || 0) + (st.erros || 0)) > 0;
    return true;
  };

  return (
    <div className="tab-content syllabus-tab">
      {/* HEADER SECTION */}
      <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen className="text-primary" size={24} />
            Edital Verticalizado & Rastreador de Aulas do Gran
          </h2>
          <p className="section-description">
            Acompanhe o estudo da teoria (videoaulas e PDFs), anote insights de aula e pratique questões diretamente no Gran Questões.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsAiImportOpen(true)}
            className="mock-btn"
            style={{
              padding: '8px 14px',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={16} />
            <span>Importar com IA</span>
          </button>

          {/* GRAN QUESTÕES BANCA TOGGLE */}
          <div className="gran-options" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--card-bg, #ffffff)', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Gran Questões:</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={filterBanca} 
                onChange={(e) => setFilterBanca(e.target.checked)} 
              />
              Filtrar por <strong>{bancaName}</strong>
            </label>
          </div>
        </div>
      </div>

      {/* GLOBAL COVERAGE CARD */}
      <div className="coverage-card" style={{
        background: 'linear-gradient(135deg, #0d134c, #1a2060)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '24px',
        alignItems: 'center',
        boxShadow: '0 8px 24px rgba(13,19,76,0.18)',
        marginBottom: '20px'
      }}>
        <div style={{ flex: '1 1 280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>
              Cobertura Geral do Edital
            </span>
            <span style={{ fontSize: '2rem', fontWeight: 900, color: '#afe8d0' }}>
              {progressPct}%
            </span>
          </div>
          <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              width: `${progressPct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #afe8d0, #baff38)',
              borderRadius: '999px',
              transition: 'width 0.5s ease'
            }} />
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '8px' }}>
            {completedTopics} de {totalTopics} tópicos concluídos
          </div>
        </div>

        {/* METRICS ROW: VIDEOS, PDFS, QUESTIONS */}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', minWidth: '75px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#93c5fd' }}>
              {completedVideos}/{totalVideos}
            </div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.7 }}>🎬 Vídeos ({videoPct}%)</div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '75px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#67e8f9' }}>
              {completedPdfs}/{totalPdfs}
            </div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.7 }}>📄 PDFs ({pdfPct}%)</div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '65px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#afe8d0' }}>{totalAcertos}</div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.7 }}>Acertos</div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '65px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fca5a5' }}>{totalErros}</div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.7 }}>Erros</div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '65px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#baff38' }}>
              {totalQuestions > 0 ? `${accuracyPct}%` : '—'}
            </div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.7 }}>Aproveit.</div>
          </div>
        </div>
      </div>

      {/* CONTROLS BAR: SEARCH, FILTERS & EXPAND/COLLAPSE */}
      <div className="syllabus-controls" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 250px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
          <input 
            type="text"
            placeholder="Pesquisar matéria, grupo ou tópico..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--card-bg, #ffffff)',
              color: 'inherit',
              fontSize: '0.9rem'
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.7 }}>Filtrar:</span>
          {([
            { key: 'todos', label: 'Todos' },
            { key: 'pendentes', label: '⬜ Pendentes' },
            { key: 'concluidos', label: '✅ Concluídos' },
            { key: 'videos_pendentes', label: '🎬 Vídeo Pendente' },
            { key: 'pdfs_pendentes', label: '📄 PDF Pendente' },
            { key: 'com_notas', label: '📝 Com Notas' },
            { key: 'questoes', label: '📊 Com Questões' }
          ] as const).map((m) => (
            <button
              key={m.key}
              onClick={() => setFilterMode(m.key)}
              style={{
                padding: '5px 12px',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid var(--border-color, #cbd5e1)',
                cursor: 'pointer',
                background: filterMode === m.key ? 'var(--primary-color, #0d134c)' : 'var(--card-bg, #ffffff)',
                color: filterMode === m.key ? '#ffffff' : 'inherit'
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Expand / Collapse All */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={expandAll}
            style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', background: 'transparent', cursor: 'pointer' }}
          >
            ↕ Expandir Todos
          </button>
          <button 
            onClick={collapseAll}
            style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', background: 'transparent', cursor: 'pointer' }}
          >
            ↕ Recolher
          </button>
        </div>
      </div>

      {/* SUBJECTS ACCORDION LIST */}
      <div className="subjects-accordion-list" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {subjects.length === 0 ? (
          <div
            className="card-primary"
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <Sparkles size={28} />
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              Nenhuma Disciplina Cadastrada Neste Ciclo
            </h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', maxWidth: '560px', margin: '0 auto 1.75rem', lineHeight: '1.6' }}>
              Importe seu edital verticalizado em 1 clique com nossa IA gratuita para começar a estudar com métricas e cronograma inteligente.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setIsAiImportOpen(true)}
                className="mock-btn"
                style={{
                  padding: '0.8rem 1.6rem',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles size={16} />
                <span>Importar Edital com IA</span>
              </button>
            </div>
          </div>
        ) : (
          subjects.map((sub) => {
            const isExpanded = expandedSubjectIds.includes(sub.id);
            
            // Sub statistics
            let subTotal = 0;
            let subDone = 0;
            let subVidDone = 0;
            let subPdfDone = 0;
            let subAc = 0;
            let subEr = 0;

            sub.topics.forEach((t) => {
              t.subtopics.forEach((st) => {
                subTotal++;
                if (st.completed) subDone++;
                if (st.videoWatched) subVidDone++;
                if (st.pdfRead) subPdfDone++;
                subAc += st.acertos || 0;
                subEr += st.erros || 0;
              });
            });

            const subPct = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0;
            const subQ = subAc + subEr;
            const subAcc = subQ > 0 ? Math.round((subAc / subQ) * 100) : 0;

            return (
              <div 
                key={sub.id} 
                style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1.5px solid var(--border-color, #e2e8f0)',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}
              >
                {/* ACCORDION HEADER */}
                <div 
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    gap: '12px',
                    background: isExpanded ? 'rgba(13,19,76,0.03)' : 'transparent',
                    borderBottom: isExpanded ? '1px solid var(--border-color, #e2e8f0)' : 'none'
                  }}
                  onClick={() => toggleExpand(sub.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 300px' }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: sub.status === 'active' ? '#22c55e' : sub.status === 'maintenance' ? '#f59e0b' : '#94a3b8'
                    }} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'inherit' }}>
                        {sub.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', opacity: 0.7, marginTop: '2px', flexWrap: 'wrap' }}>
                        <span>Peso {sub.weight}</span>
                        <span>•</span>
                        <span>{subDone}/{subTotal} concluídos ({subPct}%)</span>
                        <span>•</span>
                        <span>🎬 {subVidDone}/{subTotal} vídeos</span>
                        <span>•</span>
                        <span>📄 {subPdfDone}/{subTotal} PDFs</span>
                        <span>•</span>
                        <span>{subQ > 0 ? `${subAcc}% acertos (${subQ} q)` : 'Sem questões'}</span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT SIDE OF HEADER */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Mini Progress Bar */}
                    <div style={{ width: '70px', height: '6px', background: 'var(--border-color, #cbd5e1)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${subPct}%`, height: '100%', background: '#22c55e' }} />
                    </div>

                    {/* Gran Course Base Link Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCourseLink(sub);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 9px',
                        background: sub.granCourseUrl ? 'rgba(2, 132, 199, 0.12)' : 'rgba(100, 116, 139, 0.08)',
                        color: sub.granCourseUrl ? '#0284c7' : 'var(--text-muted)',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: sub.granCourseUrl ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid var(--border-color)',
                        cursor: 'pointer'
                      }}
                      title={sub.granCourseUrl ? `Curso configurado: ${sub.granCourseUrl} (clique para abrir)` : "Configurar link do curso Gran para esta matéria"}
                    >
                      <Tv size={12} />
                      <span>{sub.granCourseUrl ? 'Curso Gran' : '+ Link Curso'}</span>
                    </button>

                    {/* Edit Course URL Icon */}
                    {sub.granCourseUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCourseLinkModal({ subject: sub, url: sub.granCourseUrl || '' });
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Editar link do curso Gran"
                      >
                        <Edit3 size={12} />
                      </button>
                    )}

                    {/* Quick Button: Practice in Gran Questoes */}
                    <a
                      href={buildGranQuestoesUrl({
                        assuntoId: sub.assuntoId,
                        disciplinaId: sub.disciplinaId,
                        query: sub.granQuery || sub.name,
                        banca: bancaName,
                        filterBanca
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 10px',
                        background: '#c8102e',
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textDecoration: 'none'
                      }}
                      title={sub.assuntoId
                        ? `Filtro oficial Gran por assunto (ID: ${Array.isArray(sub.assuntoId) ? sub.assuntoId.join(',') : sub.assuntoId})`
                        : "Abrir questões desta matéria no Gran Questões"}
                    >
                      <span>🎯 Gran</span>
                      <ExternalLink size={12} />
                    </a>

                    {/* Quick Start Study */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartStudy(sub.id, sub.name);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 10px',
                        background: 'var(--primary-color, #0d134c)',
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      title="Iniciar cronômetro nesta matéria"
                    >
                      <Play size={12} fill="currentColor" />
                      <span>Estudar</span>
                    </button>

                    {isExpanded ? <ChevronUp size={18} opacity={0.6} /> : <ChevronDown size={18} opacity={0.6} />}
                  </div>
                </div>

                {/* ACCORDION BODY: GROUPS & TOPICS */}
                {isExpanded && (
                  <div style={{ padding: '12px 18px 18px', overflowX: 'auto' }}>
                    {sub.topics.map((top) => {
                      const visibleSubtopics = top.subtopics.filter((st) => 
                        isSubtopicVisible(st, sub.name, top.name, top.notes)
                      );

                      if (visibleSubtopics.length === 0 && (searchTerm || filterMode !== 'todos')) {
                        return null;
                      }

                      return (
                        <div key={top.id} style={{ marginBottom: '20px' }}>
                          <div style={{
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            color: 'var(--text-soft, #64748b)',
                            padding: '6px 0',
                            borderBottom: '1px solid var(--border-color, #e2e8f0)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>📁 {top.name}</span>

                              {/* Topic Notes Preview / Button */}
                              {top.notes && (
                                <span
                                  onClick={() => setQuickNotesModal({ subjectId: sub.id, topicId: top.id, title: `Módulo: ${top.name}`, notes: top.notes || '' })}
                                  style={{
                                    fontSize: '0.72rem',
                                    color: '#d97706',
                                    background: 'rgba(245, 158, 11, 0.12)',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontWeight: 600,
                                    textTransform: 'none'
                                  }}
                                  title={`Anotação do módulo: ${top.notes}`}
                                >
                                  📝 {top.notes.length > 25 ? top.notes.slice(0, 25) + '...' : top.notes}
                                </span>
                              )}

                              <button
                                onClick={() => setQuickNotesModal({ subjectId: sub.id, topicId: top.id, title: `Módulo: ${top.name}`, notes: top.notes || '' })}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  color: top.notes ? '#d97706' : 'var(--text-muted, #94a3b8)',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                title={top.notes ? "Editar notas deste módulo" : "Adicionar anotação para todo este módulo"}
                              >
                                <StickyNote size={13} />
                              </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {/* Gran Module Link Button */}
                              <button
                                onClick={() => handleOpenCourseLink(sub, top, top.courseUrl)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '3px 7px',
                                  background: top.courseUrl ? 'rgba(2, 132, 199, 0.12)' : 'rgba(100, 116, 139, 0.08)',
                                  color: top.courseUrl ? '#0284c7' : 'var(--text-muted)',
                                  borderRadius: '5px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  border: top.courseUrl ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid var(--border-color)',
                                  cursor: 'pointer'
                                }}
                                title={top.courseUrl ? `Link do módulo Gran: ${top.courseUrl}` : "Configurar link direto do Gran para este módulo"}
                              >
                                <Tv size={11} />
                                <span>{top.courseUrl ? 'Módulo Gran' : '+ Link Módulo'}</span>
                              </button>

                              {top.courseUrl && (
                                <button
                                  onClick={() => setCourseLinkModal({ subject: sub, topic: top, url: top.courseUrl || '' })}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                                  title="Editar link do módulo Gran"
                                >
                                  <Edit3 size={11} />
                                </button>
                              )}

                              <a
                                href={buildGranQuestoesUrl({
                                  assuntoId: top.assuntoId || sub.assuntoId,
                                  disciplinaId: top.disciplinaId || sub.disciplinaId,
                                  query: top.granQuery || top.name,
                                  banca: bancaName,
                                  filterBanca
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '0.75rem',
                                  color: '#c8102e',
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                                title={top.assuntoId
                                  ? `Filtro de Alta Precisão Gran (ID: ${Array.isArray(top.assuntoId) ? top.assuntoId.join(',') : top.assuntoId})`
                                  : "Praticar este grupo no Gran Questões"}
                              >
                                <span>Buscar no Gran</span>
                                <ExternalLink size={11} />
                              </a>
                            </div>
                          </div>

                          <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                            <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', marginTop: '6px', fontSize: '0.88rem' }}>
                            <thead>
                              <tr style={{ textAlign: 'left', fontSize: '0.73rem', textTransform: 'uppercase', color: 'var(--text-muted, #94a3b8)', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                                <th style={{ padding: '6px 4px', width: '36px', textAlign: 'center' }}>✓</th>
                                <th style={{ padding: '6px 8px' }}>Tópico do Edital</th>
                                <th style={{ padding: '6px 6px', width: '175px' }}>🎬 Videoaula Gran</th>
                                <th style={{ padding: '6px 6px', width: '165px' }}>📄 PDF Gran</th>
                                <th style={{ padding: '6px 4px', width: '45px', textAlign: 'center' }}>Notas</th>
                                <th style={{ padding: '6px 6px', width: '135px' }}>Questões</th>
                                <th style={{ padding: '6px 6px', width: '75px', textAlign: 'right' }}>Gran</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleSubtopics.map((st) => {
                                const qTot = (st.acertos || 0) + (st.erros || 0);
                                const qPct = qTot > 0 ? Math.round(((st.acertos || 0) / qTot) * 100) : null;

                                return (
                                  <tr 
                                    key={st.id} 
                                    style={{
                                      borderBottom: '1px solid rgba(0,0,0,0.05)',
                                      background: st.completed ? 'rgba(34,197,94,0.05)' : 'transparent'
                                    }}
                                  >
                                    {/* Checkbox Geral */}
                                    <td style={{ width: '36px', textAlign: 'center', padding: '10px 4px' }}>
                                      <button
                                        onClick={() => handleToggleSubtopic(sub.id, top.id, st.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        title={st.completed ? 'Marcar como não concluído' : 'Marcar teoria como concluída'}
                                      >
                                        {st.completed ? (
                                          <CheckCircle2 size={18} color="#22c55e" />
                                        ) : (
                                          <Circle size={18} opacity={0.4} />
                                        )}
                                      </button>
                                    </td>

                                    {/* Topic Name, Date & Notes snippet */}
                                    <td style={{ padding: '10px 8px' }}>
                                      <div style={{
                                        fontWeight: 600,
                                        color: 'inherit',
                                        lineHeight: 1.4
                                      }}>
                                        {st.name}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '3px' }}>
                                        {st.completed && st.completedAt && (
                                          <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>
                                            ✓ Concluído em {st.completedAt}
                                          </span>
                                        )}
                                        {st.notes && (
                                          <span 
                                            onClick={() => setQuickNotesModal({ subjectId: sub.id, topicId: top.id, subtopic: st, title: st.name, notes: st.notes || '' })}
                                            style={{
                                              fontSize: '0.73rem',
                                              color: '#d97706',
                                              background: 'rgba(245, 158, 11, 0.12)',
                                              padding: '1px 6px',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '3px',
                                              fontWeight: 600
                                            }}
                                            title={st.notes}
                                          >
                                            📝 {st.notes.length > 30 ? st.notes.slice(0, 30) + '...' : st.notes}
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Videoaula Gran Tracker */}
                                    <td style={{ width: '175px', padding: '8px 6px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <button
                                          onClick={() => handleToggleVideo(sub.id, top.id, st.id)}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            border: st.videoWatched ? '1px solid #86efac' : '1px solid var(--border-color, #cbd5e1)',
                                            background: st.videoWatched ? 'rgba(34, 197, 94, 0.12)' : 'var(--bg-element, #f1f5f9)',
                                            color: st.videoWatched ? '#16a34a' : 'var(--text-muted, #64748b)',
                                            cursor: 'pointer'
                                          }}
                                          title={st.videoWatched ? 'Videoaula concluída (clique para alternar)' : 'Marcar videoaula como assistida'}
                                        >
                                          <Video size={12} />
                                          <span>{st.videoLesson || 'Aula --'}</span>
                                          {st.videoBlock && <span style={{ opacity: 0.75 }}>({st.videoBlock})</span>}
                                          {st.videoWatched && <span>✓</span>}
                                        </button>

                                        {/* Watch link button */}
                                        <button
                                          onClick={() => handleOpenCourseLink(sub, top, st.videoUrl)}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            color: '#c8102e',
                                            display: 'flex',
                                            alignItems: 'center',
                                            borderRadius: '4px'
                                          }}
                                          title={st.videoUrl ? `Assistir videoaula no link: ${st.videoUrl}` : top.courseUrl ? `Assistir módulo no Gran: ${top.courseUrl}` : sub.granCourseUrl ? `Assistir curso Gran: ${sub.granCourseUrl}` : "Configurar link do curso Gran"}
                                        >
                                          <Tv size={14} />
                                        </button>

                                        {/* Edit Class Details */}
                                        <button
                                          onClick={() => setEditClassModal({
                                            subjectId: sub.id,
                                            topicId: top.id,
                                            subtopic: st,
                                            videoWatched: !!st.videoWatched,
                                            videoLesson: st.videoLesson || '',
                                            videoBlock: st.videoBlock || '',
                                            videoUrl: st.videoUrl || '',
                                            pdfRead: !!st.pdfRead,
                                            pdfLesson: st.pdfLesson || '',
                                            pdfPages: st.pdfPages || '',
                                            pdfUrl: st.pdfUrl || '',
                                            notes: st.notes || ''
                                          })}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            color: 'var(--text-muted, #94a3b8)',
                                            display: 'flex',
                                            alignItems: 'center'
                                          }}
                                          title="Editar aula, bloco e link do vídeo"
                                        >
                                          <Edit3 size={12} />
                                        </button>
                                      </div>
                                    </td>

                                    {/* PDF Gran Tracker */}
                                    <td style={{ width: '165px', padding: '8px 6px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <button
                                          onClick={() => handleTogglePdf(sub.id, top.id, st.id)}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            border: st.pdfRead ? '1px solid #93c5fd' : '1px solid var(--border-color, #cbd5e1)',
                                            background: st.pdfRead ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-element, #f1f5f9)',
                                            color: st.pdfRead ? '#2563eb' : 'var(--text-muted, #64748b)',
                                            cursor: 'pointer'
                                          }}
                                          title={st.pdfRead ? 'PDF lido (clique para alternar)' : 'Marcar PDF como lido'}
                                        >
                                          <FileText size={12} />
                                          <span>{st.pdfLesson || 'PDF --'}</span>
                                          {st.pdfPages && <span style={{ opacity: 0.75 }}>({st.pdfPages})</span>}
                                          {st.pdfRead && <span>✓</span>}
                                        </button>

                                        {/* Open PDF link */}
                                        <button
                                          onClick={() => handleOpenCourseLink(sub, top, st.pdfUrl)}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            color: '#2563eb',
                                            display: 'flex',
                                            alignItems: 'center',
                                            borderRadius: '4px'
                                          }}
                                          title={st.pdfUrl ? `Abrir PDF direto: ${st.pdfUrl}` : top.courseUrl ? `Abrir módulo no Gran: ${top.courseUrl}` : sub.granCourseUrl ? `Abrir curso Gran: ${sub.granCourseUrl}` : "Configurar link do curso Gran"}
                                        >
                                          <ExternalLink size={13} />
                                        </button>

                                        {/* Edit PDF Details */}
                                        <button
                                          onClick={() => setEditClassModal({
                                            subjectId: sub.id,
                                            topicId: top.id,
                                            subtopic: st,
                                            videoWatched: !!st.videoWatched,
                                            videoLesson: st.videoLesson || '',
                                            videoBlock: st.videoBlock || '',
                                            videoUrl: st.videoUrl || '',
                                            pdfRead: !!st.pdfRead,
                                            pdfLesson: st.pdfLesson || '',
                                            pdfPages: st.pdfPages || '',
                                            pdfUrl: st.pdfUrl || '',
                                            notes: st.notes || ''
                                          })}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            color: 'var(--text-muted, #94a3b8)',
                                            display: 'flex',
                                            alignItems: 'center'
                                          }}
                                          title="Editar detalhes do PDF, lição e link"
                                        >
                                          <Edit3 size={12} />
                                        </button>
                                      </div>
                                    </td>

                                    {/* Quick Notes Button */}
                                    <td style={{ width: '45px', textAlign: 'center', padding: '8px 4px' }}>
                                      <button
                                        onClick={() => setQuickNotesModal({
                                          subjectId: sub.id,
                                          topicId: top.id,
                                          subtopic: st,
                                          title: st.name,
                                          notes: st.notes || ''
                                        })}
                                        style={{
                                          background: st.notes ? 'rgba(245, 158, 11, 0.15)' : 'none',
                                          border: st.notes ? '1px solid #fcd34d' : '1px solid transparent',
                                          borderRadius: '6px',
                                          cursor: 'pointer',
                                          padding: '4px 6px',
                                          color: st.notes ? '#d97706' : 'var(--text-muted, #94a3b8)'
                                        }}
                                        title={st.notes ? `Anotação: ${st.notes}` : "Adicionar anotação da aula"}
                                      >
                                        <StickyNote size={15} />
                                      </button>
                                    </td>

                                    {/* In-line Acertos x Erros */}
                                    <td style={{ width: '135px', padding: '6px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <input 
                                          type="number" 
                                          min="0"
                                          placeholder="Ac"
                                          value={st.acertos || ''}
                                          onChange={(e) => handleUpdateQuestions(sub.id, top.id, st.id, 'acertos', parseInt(e.target.value) || 0)}
                                          style={{ width: '38px', padding: '3px', textAlign: 'center', borderRadius: '4px', border: '1px solid #bbf7d0', fontSize: '0.8rem' }}
                                          title="Número de acertos"
                                        />
                                        <span style={{ opacity: 0.4 }}>×</span>
                                        <input 
                                          type="number" 
                                          min="0"
                                          placeholder="Er"
                                          value={st.erros || ''}
                                          onChange={(e) => handleUpdateQuestions(sub.id, top.id, st.id, 'erros', parseInt(e.target.value) || 0)}
                                          style={{ width: '38px', padding: '3px', textAlign: 'center', borderRadius: '4px', border: '1px solid #fca5a5', fontSize: '0.8rem' }}
                                          title="Número de erros"
                                        />
                                        {qPct !== null && (
                                          <span style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            padding: '2px 5px',
                                            borderRadius: '4px',
                                            background: qPct >= 70 ? '#dcfce7' : qPct >= 50 ? '#fef3c7' : '#fee2e2',
                                            color: qPct >= 70 ? '#15803d' : qPct >= 50 ? '#b45309' : '#b91c1c'
                                          }}>
                                            {qPct}%
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Gran Questoes Button */}
                                    <td style={{ width: '75px', textAlign: 'right', padding: '6px' }}>
                                      <a
                                        href={buildGranQuestoesUrl({
                                          assuntoId: st.assuntoId || top.assuntoId || sub.assuntoId,
                                          disciplinaId: st.disciplinaId || top.disciplinaId || sub.disciplinaId,
                                          query: st.granQuery || st.name,
                                          banca: bancaName,
                                          filterBanca
                                        })}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          padding: '4px 7px',
                                          background: st.assuntoId ? 'rgba(200, 16, 46, 0.12)' : 'rgba(200, 16, 46, 0.08)',
                                          color: '#c8102e',
                                          borderRadius: '5px',
                                          fontSize: '0.72rem',
                                          fontWeight: 700,
                                          textDecoration: 'none',
                                          border: st.assuntoId ? '1px solid rgba(200, 16, 46, 0.35)' : '1px solid rgba(200, 16, 46, 0.2)'
                                        }}
                                        title={st.assuntoId
                                          ? `Filtro de Alta Precisão (ID Gran: ${Array.isArray(st.assuntoId) ? st.assuntoId.join(',') : st.assuntoId})`
                                          : `Buscar no Gran: ${st.granQuery || st.name}`}
                                      >
                                        <span>🎯 Gran</span>
                                        <ExternalLink size={10} />
                                      </a>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: QUICK NOTES MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      {quickNotesModal && (
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
        }}>
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            color: 'var(--text-title, #1e293b)',
            borderRadius: '16px',
            padding: '24px',
            width: '90%',
            maxWidth: '540px',
            border: '1.5px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <StickyNote size={20} color="#d97706" />
                  Anotações da Aula & Resumo
                </h3>
                <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: '4px 0 0' }}>
                  {quickNotesModal.title}
                </p>
              </div>
              <button 
                onClick={() => setQuickNotesModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Insights do Professor, Fórmulas, Prazos ou Mnemônicos:
              </label>
              <textarea
                rows={6}
                value={quickNotesModal.notes}
                onChange={(e) => setQuickNotesModal({ ...quickNotesModal, notes: e.target.value })}
                placeholder="Ex: O professor enfatizou a diferença entre anulação e revogação. Lembrar da súmula 473 do STF..."
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--bg-element, #f8fafc)',
                  color: 'inherit',
                  fontSize: '0.9rem',
                  lineHeight: '1.5',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setQuickNotesModal(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNotes}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#22c55e',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Save size={16} />
                <span>Salvar Anotação</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: EDIT CLASS TRACKING (AULA, BLOCO, PDF, LINKS) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {editClassModal && (
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
        }}>
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            color: 'var(--text-title, #1e293b)',
            borderRadius: '16px',
            padding: '24px',
            width: '90%',
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1.5px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Tv size={20} color="#c8102e" />
                  Rastreador de Aulas do Gran
                </h3>
                <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: '4px 0 0' }}>
                  {editClassModal.subtopic.name}
                </p>
              </div>
              <button 
                onClick={() => setEditClassModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* VIDEOAULA SECTION */}
            <div style={{ background: 'rgba(200, 16, 46, 0.04)', border: '1px solid rgba(200, 16, 46, 0.15)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#c8102e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Video size={16} /> Videoaula Gran
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={editClassModal.videoWatched}
                    onChange={(e) => setEditClassModal({ ...editClassModal, videoWatched: e.target.checked })}
                  />
                  Assistida
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nº da Aula</label>
                  <input 
                    type="text"
                    placeholder="Ex: Aula 03"
                    value={editClassModal.videoLesson}
                    onChange={(e) => setEditClassModal({ ...editClassModal, videoLesson: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Bloco / Parte</label>
                  <input 
                    type="text"
                    placeholder="Ex: Bloco 2 ou 02/05"
                    value={editClassModal.videoBlock}
                    onChange={(e) => setEditClassModal({ ...editClassModal, videoBlock: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Link Específico da Videoaula (Opcional)</label>
                <input 
                  type="url"
                  placeholder="https://www.grancursosonline.com.br/aluno/espaco/..."
                  value={editClassModal.videoUrl}
                  onChange={(e) => setEditClassModal({ ...editClassModal, videoUrl: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            {/* PDF SECTION */}
            <div style={{ background: 'rgba(37, 99, 235, 0.04)', border: '1px solid rgba(37, 99, 235, 0.15)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} /> PDF / Material Escrito
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={editClassModal.pdfRead}
                    onChange={(e) => setEditClassModal({ ...editClassModal, pdfRead: e.target.checked })}
                  />
                  Lido
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nº da Aula no PDF</label>
                  <input 
                    type="text"
                    placeholder="Ex: Aula 02"
                    value={editClassModal.pdfLesson}
                    onChange={(e) => setEditClassModal({ ...editClassModal, pdfLesson: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Páginas Lidas</label>
                  <input 
                    type="text"
                    placeholder="Ex: pág. 15/45"
                    value={editClassModal.pdfPages}
                    onChange={(e) => setEditClassModal({ ...editClassModal, pdfPages: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Link Específico do PDF / Lição (Opcional)</label>
                <input 
                  type="url"
                  placeholder="https://..."
                  value={editClassModal.pdfUrl}
                  onChange={(e) => setEditClassModal({ ...editClassModal, pdfUrl: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            {/* NOTES PREVIEW/EDIT */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Anotações / Resumo da Aula</label>
              <textarea
                rows={3}
                value={editClassModal.notes}
                onChange={(e) => setEditClassModal({ ...editClassModal, notes: e.target.value })}
                placeholder="Anotações rápidas sobre a matéria deste tópico..."
                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-element)', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setEditClassModal(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveClassEdit}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#22c55e', color: '#ffffff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={16} />
                <span>Salvar Acompanhamento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: GRAN COURSE LINK CONFIGURATION */}
      {/* ───────────────────────────────────────────────────────────── */}
      {courseLinkModal && (
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
        }}>
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            color: 'var(--text-title, #1e293b)',
            borderRadius: '16px',
            padding: '24px',
            width: '90%',
            maxWidth: '520px',
            border: '1.5px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <LinkIcon size={20} color="#0284c7" />
                  Link do Curso no Gran Cursos Online
                </h3>
                <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: '4px 0 0' }}>
                  {courseLinkModal.topic ? (
                    <>Módulo / Tópico: <strong>{courseLinkModal.topic.name}</strong> ({courseLinkModal.subject.name})</>
                  ) : (
                    <>Disciplina / Matéria: <strong>{courseLinkModal.subject.name}</strong></>
                  )}
                </p>
              </div>
              <button 
                onClick={() => setCourseLinkModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Cole a URL do seu curso ou disciplina na área do aluno do Gran:
              </label>
              <input 
                type="url"
                value={courseLinkModal.url}
                onChange={(e) => setCourseLinkModal({ ...courseLinkModal, url: e.target.value })}
                placeholder="https://www.grancursosonline.com.br/aluno/espaco/meus-cursos/..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--bg-element, #f8fafc)',
                  color: 'inherit',
                  fontSize: '0.88rem'
                }}
              />
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCourseLinkModal({ ...courseLinkModal, url: 'https://www.grancursosonline.com.br/aluno/espaco/meus-cursos' })}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'none',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    opacity: 0.8
                  }}
                >
                  Usar link do painel &quot;Meus Cursos&quot;
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.4, margin: 0 }}>
              💡 Ao configurar o link, os botões <strong>[📺 Assistir Aula]</strong> e <strong>[📄 Abrir PDF]</strong> abrirão instantaneamente o seu curso no Gran em uma nova aba!
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setCourseLinkModal(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              {courseLinkModal.url && (
                <button
                  onClick={() => window.open(normalizeUrl(courseLinkModal.url), '_blank', 'noopener,noreferrer')}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #0284c7', background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Testar Link
                </button>
              )}
              <button
                onClick={handleSaveCourseUrl}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#0284c7', color: '#ffffff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={16} />
                <span>Salvar Link</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Syllabus Import Modal */}
      <AiSyllabusImportModal
        isOpen={isAiImportOpen}
        onClose={() => setIsAiImportOpen(false)}
        onWorkspaceCreated={(wsId) => {
          setSubjects(db.getSubjects(wsId));
        }}
      />
    </div>
  );
};
