/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { sanitizeString, isValidEmail, formatSafeError, safeJsonParse } from '../lib/security';
import { db, hasGenuineStudyData, type FullBackup } from '../db/database';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
  isAnonymous?: boolean;
  provider: 'supabase' | 'local';
}

export interface FeedbackItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: 'bug' | 'sugestao' | 'elogio' | 'outro';
  title: string;
  description: string;
  status: 'aberto' | 'em_analise' | 'resolvido';
  createdAt: string;
}

export interface SystemMetrics {
  totalUsers: number;
  totalStudyHours: number;
  totalQuestions: number;
  averageAccuracy: number;
  totalWorkspaces: number;
  totalFeedbacks: number;
  openFeedbacks: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  isDemoMode: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  loginAsDemo: () => Promise<void>;
  loginAsAdminDemo: () => Promise<void>;
  feedbacks: FeedbackItem[];
  submitFeedback: (feedback: {
    type: FeedbackItem['type'];
    title: string;
    description: string;
    contactEmail?: string;
  }) => Promise<{ success: boolean; message: string }>;
  updateFeedbackStatus: (id: string, status: FeedbackItem['status']) => void;
  deleteFeedback: (id: string) => void;
  allUsers: AppUser[];
  systemMetrics: SystemMetrics;
  syncWithCloud: () => Promise<{ success: boolean; message: string }>;
  syncStatus: SyncStatus;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const KEYS = {
  CURRENT_USER: 'estud_ai_auth_user',
  MOCK_USERS: 'estud_ai_mock_users',
  FEEDBACKS: 'estud_ai_feedbacks',
};

const DEFAULT_ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@ixtude-ai.com.br').toLowerCase().trim();

const INITIAL_MOCK_USERS: AppUser[] = [
  {
    id: 'usr-admin-default',
    email: DEFAULT_ADMIN_EMAIL,
    name: 'Administrador ixtude.ai',
    role: 'admin',
    createdAt: new Date().toISOString(),
    provider: 'local',
  },
  {
    id: 'usr-demo-student',
    email: 'aluno@ixtude-ai.com.br',
    name: 'Concurseiro Focado',
    role: 'user',
    createdAt: new Date().toISOString(),
    provider: 'local',
  },
];

// Read mock users without eagerly writing to localStorage on unauthenticated visits
const initializeMockUsers = (): AppUser[] => {
  const existing = safeJsonParse<AppUser[]>(localStorage.getItem(KEYS.MOCK_USERS), []);
  if (existing.length > 0) return existing;
  return INITIAL_MOCK_USERS;
};

const INITIAL_FEEDBACKS: FeedbackItem[] = [
  {
    id: 'fb-sample-1',
    userId: 'usr-demo-student',
    userName: 'Concurseiro Focado',
    userEmail: 'aluno@ixtude-ai.com.br',
    type: 'sugestao',
    title: 'Adicionar filtro por Banca no Edital Verticalizado',
    description: 'Adorei a importação automática do edital com IA! Seria ótimo ter filtro rápido por banca Cebraspe/FCC nas questões.',
    status: 'resolvido',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'fb-sample-2',
    userId: 'usr-demo-student',
    userName: 'Concurseiro Focado',
    userEmail: 'aluno@ixtude-ai.com.br',
    type: 'bug',
    title: 'Pequena inconsistência de cores no modo escuro',
    description: 'Em telas menores, o badge de dias restantes estava com contraste baixo no modo escuro.',
    status: 'resolvido',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

// Read feedbacks without eagerly writing to localStorage on unauthenticated visits
const initializeFeedbacks = (): FeedbackItem[] => {
  const existing = safeJsonParse<FeedbackItem[]>(localStorage.getItem(KEYS.FEEDBACKS), []);
  if (existing.length > 0) return existing;
  return INITIAL_FEEDBACKS;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const isPullingRef = useRef<boolean>(false);
  const lastFocusReconcileRef = useRef<number>(0);

  const isDemoMode = !isSupabaseConfigured();

  // Helper to pull cloud sync data for authenticated user (non-destructive merge)
  const pullFromCloud = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      setSyncStatus('idle');
      return;
    }
    isPullingRef.current = true;
    try {
      setSyncStatus('syncing');
      db.migrateGuestData(null, userId);
      db.setCurrentUserId(userId);
      db.notifyChange();

      const { data, error } = await supabase
        .from('user_sync_data')
        .select('payload, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        // Table may not be created yet in Supabase or network failed
        console.warn('Supabase sync notice:', error.message);
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
        db.notifyChange();
        return;
      }

      const localSnapshot: FullBackup = JSON.parse(db.exportAllData());

      if (data?.payload) {
        // Non-destructive merge of local cache and cloud snapshot
        const merged = db.mergeData(localSnapshot, data.payload);
        db.importAllData(JSON.stringify(merged));

        // Push merged state back to cloud to guarantee convergence
        const { error: pushError } = await supabase
          .from('user_sync_data')
          .upsert({
            user_id: userId,
            payload: merged,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (pushError) {
          setSyncStatus('error');
        } else {
          setSyncStatus('synced');
        }
      } else {
        // Brand new user or no cloud row yet: push existing local state ONLY if genuine study data exists
        if (hasGenuineStudyData(localSnapshot)) {
          const { error: initialPushError } = await supabase
            .from('user_sync_data')
            .upsert({
              user_id: userId,
              payload: localSnapshot,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

          if (initialPushError) {
            console.warn('Supabase initial upload error:', initialPushError.message);
            setSyncStatus('error');
            return;
          }
        }
        setSyncStatus('synced');
      }
    } catch {
      // Fallback silently to local cache if network is unavailable
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      isPullingRef.current = false;
    }
  }, []);

  // Helper to fetch cloud feedbacks for admin and users
  const fetchCloudFeedbacks = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: FeedbackItem[] = data.map((f: any) => ({
          id: f.id,
          userId: f.user_id || 'anon',
          userName: f.user_name || 'Visitante',
          userEmail: f.user_email,
          type: f.type,
          title: f.title,
          description: f.description,
          status: f.status,
          createdAt: f.created_at,
        }));
        setFeedbacks(mapped);
        localStorage.setItem(KEYS.FEEDBACKS, JSON.stringify(mapped));
      }
    } catch {}
  }, []);

  // Helper to fetch cloud registered profiles for admin
  const fetchCloudProfiles = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: AppUser[] = data.map((p: any) => ({
          id: p.id,
          email: p.email,
          name: p.name || p.email.split('@')[0],
          role: p.role || 'user',
          createdAt: p.created_at,
          provider: 'supabase',
        }));
        setAllUsers(mapped);
      }
    } catch {}
  }, []);

  // Load initial state
  useEffect(() => {
    const loadedUsers = initializeMockUsers();
    setAllUsers(loadedUsers);

    const loadedFeedbacks = initializeFeedbacks();
    setFeedbacks(loadedFeedbacks);

    // Check existing session
    if (isSupabaseConfigured() && supabase) {
      supabase.auth.getSession().then(async ({ data: { session }, error }) => {
        if (!error && session?.user) {
          const email = session.user.email || '';
          const role: 'admin' | 'user' =
            email.toLowerCase() === DEFAULT_ADMIN_EMAIL ||
            session.user.user_metadata?.role === 'admin'
              ? 'admin'
              : 'user';

          const appUser: AppUser = {
            id: session.user.id,
            email,
            name: session.user.user_metadata?.name || email.split('@')[0],
            role,
            createdAt: session.user.created_at || new Date().toISOString(),
            provider: 'supabase',
          };
          db.migrateGuestData(null, appUser.id);
          db.setCurrentUserId(appUser.id);
          setUser(appUser);
          localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(appUser));
          await pullFromCloud(appUser.id);
          fetchCloudFeedbacks();
          fetchCloudProfiles();
        } else {
          // Mandatory Auth Wall: Supabase session is null -> user must be null, purge stale local session
          db.setCurrentUserId(null);
          setUser(null);
          localStorage.removeItem(KEYS.CURRENT_USER);
        }
        setIsLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const email = session.user.email || '';
          const role: 'admin' | 'user' =
            email.toLowerCase() === DEFAULT_ADMIN_EMAIL ||
            session.user.user_metadata?.role === 'admin'
              ? 'admin'
              : 'user';

          const appUser: AppUser = {
            id: session.user.id,
            email,
            name: session.user.user_metadata?.name || email.split('@')[0],
            role,
            createdAt: session.user.created_at || new Date().toISOString(),
            provider: 'supabase',
          };
          db.migrateGuestData(null, appUser.id);
          db.setCurrentUserId(appUser.id);
          setUser(appUser);
          localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(appUser));
          await pullFromCloud(appUser.id);
          fetchCloudFeedbacks();
          fetchCloudProfiles();
        } else {
          db.setCurrentUserId(null);
          setUser(null);
          setSyncStatus('idle');
          localStorage.removeItem(KEYS.CURRENT_USER);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Local fallback mode (offline / unconfigured Supabase)
      // Strict database-only access: purge unverified local sessions when Supabase is not configured
      db.setCurrentUserId(null);
      setUser(null);
      localStorage.removeItem(KEYS.CURRENT_USER);
      setIsLoading(false);
    }
  }, [pullFromCloud, fetchCloudFeedbacks, fetchCloudProfiles]);

  // Debounced continuous cloud auto-sync (1500ms) on local mutations
  useEffect(() => {
    if (!user || user.provider === 'local' || !isSupabaseConfigured() || !supabase) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleMutation = () => {
      if (isPullingRef.current) return;
      setSyncStatus('syncing');
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (isPullingRef.current) return;
        try {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setSyncStatus('offline');
            return;
          }

          const client = supabase;
          if (!client) return;

          const backupJson = db.exportAllData();
          const payload: FullBackup = JSON.parse(backupJson);

          // Anti-Wipe Protection: Do not push blank state over cloud
          if (!hasGenuineStudyData(payload)) {
            setSyncStatus('synced');
            return;
          }

          const { error } = await client
            .from('user_sync_data')
            .upsert({
              user_id: user.id,
              payload,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

          if (error) {
            setSyncStatus('error');
          } else {
            setSyncStatus('synced');
          }
        } catch {
          setSyncStatus(typeof navigator !== 'undefined' && navigator.onLine ? 'error' : 'offline');
        }
      }, 1500);
    };

    const unsubscribe = db.subscribe(handleMutation);

    const onOnline = () => {
      // When coming back online, pull latest cloud state rather than pushing potentially stale local cache
      pullFromCloud(user.id);
    };
    const onOffline = () => {
      setSyncStatus('offline');
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
    }

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
    };
  }, [user, pullFromCloud]);

  // Window Focus / Tab Switch Auto-Reconciliation with 12s throttling
  useEffect(() => {
    if (!user || user.provider === 'local' || !isSupabaseConfigured() || !supabase) {
      return;
    }

    const FOCUS_COOLDOWN_MS = 12000; // 12 seconds cooldown between focus syncs

    const triggerFocusReconciliation = () => {
      const now = Date.now();
      if (now - lastFocusReconcileRef.current < FOCUS_COOLDOWN_MS) {
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }
      if (isPullingRef.current) {
        return;
      }

      lastFocusReconcileRef.current = now;
      pullFromCloud(user.id);
    };

    const handleFocus = () => {
      triggerFocusReconciliation();
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        triggerFocusReconciliation();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [user, pullFromCloud]);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return user.role === 'admin' || user.email.toLowerCase() === DEFAULT_ADMIN_EMAIL;
  }, [user]);

  // Sign In
  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return { success: false, error: 'Por favor, informe um e-mail válido.' };
    }
    if (!password) {
      return { success: false, error: 'Por favor, informe sua senha.' };
    }

    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          return { success: false, error: formatSafeError(error.message) };
        }

        if (data.user) {
          const role: 'admin' | 'user' =
            cleanEmail === DEFAULT_ADMIN_EMAIL || data.user.user_metadata?.role === 'admin'
              ? 'admin'
              : 'user';

          const appUser: AppUser = {
            id: data.user.id,
            email: cleanEmail,
            name: data.user.user_metadata?.name || cleanEmail.split('@')[0],
            role,
            createdAt: data.user.created_at || new Date().toISOString(),
            provider: 'supabase',
          };
          db.migrateGuestData(null, appUser.id);
          db.setCurrentUserId(appUser.id);
          setUser(appUser);
          localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(appUser));
          await pullFromCloud(appUser.id);
          fetchCloudFeedbacks();
          fetchCloudProfiles();
          return { success: true };
        }
        return { success: false, error: 'Não foi possível autenticar sua conta no Supabase.' };
      }

      return {
        success: false,
        error: 'Banco de dados Supabase não conectado neste dispositivo/servidor. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente da Vercel e faça Redeploy.',
      };
    } catch (err: unknown) {
      return { success: false, error: formatSafeError(err) };
    }
  }, [pullFromCloud, fetchCloudFeedbacks, fetchCloudProfiles]);

  // Sign Up
  const signUp = useCallback(async (
    email: string,
    password: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = sanitizeString(name.trim()) || cleanEmail.split('@')[0];

    if (!isValidEmail(cleanEmail)) {
      return { success: false, error: 'Por favor, informe um e-mail válido.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'A senha deve ter no mínimo 6 caracteres.' };
    }

    try {
      if (isSupabaseConfigured() && supabase) {
        const role: 'admin' | 'user' = cleanEmail === DEFAULT_ADMIN_EMAIL ? 'admin' : 'user';
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { name: cleanName, role },
          },
        });

        if (error) {
          return { success: false, error: formatSafeError(error.message) };
        }

        if (data.user && !data.session) {
          return {
            success: false,
            error: 'Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar (ou desative "Confirm email" no painel do Supabase).',
          };
        }

        if (data.user) {
          const appUser: AppUser = {
            id: data.user.id,
            email: cleanEmail,
            name: cleanName,
            role,
            createdAt: data.user.created_at || new Date().toISOString(),
            provider: 'supabase',
          };
          db.migrateGuestData(null, appUser.id);
          db.setCurrentUserId(appUser.id);
          setUser(appUser);
          localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(appUser));
          fetchCloudProfiles();
          await pullFromCloud(appUser.id);
          return { success: true };
        }
      }

      return {
        success: false,
        error: 'Banco de dados Supabase não conectado neste dispositivo/servidor. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente da Vercel e faça Redeploy.',
      };
    } catch (err: unknown) {
      return { success: false, error: formatSafeError(err) };
    }
  }, [fetchCloudProfiles, pullFromCloud]);

  // Sign Out
  const signOut = useCallback(async () => {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    db.setCurrentUserId(null);
    setUser(null);
    setSyncStatus('idle');
    localStorage.removeItem(KEYS.CURRENT_USER);
  }, []);

  // One-click demo login
  const loginAsDemo = useCallback(async () => {
    const demoUser: AppUser = {
      id: 'usr-demo-student',
      email: 'aluno@estud.ai',
      name: 'Concurseiro Focado',
      role: 'user',
      createdAt: new Date().toISOString(),
      provider: 'local',
    };
    db.migrateGuestData(null, demoUser.id);
    db.setCurrentUserId(demoUser.id);
    setUser(demoUser);
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(demoUser));
  }, []);

  // One-click admin login
  const loginAsAdminDemo = useCallback(async () => {
    const adminUser: AppUser = {
      id: 'usr-admin-default',
      email: DEFAULT_ADMIN_EMAIL,
      name: 'Administrador estud.ai',
      role: 'admin',
      createdAt: new Date().toISOString(),
      provider: 'local',
    };
    db.migrateGuestData(null, adminUser.id);
    db.setCurrentUserId(adminUser.id);
    setUser(adminUser);
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(adminUser));
  }, []);

  // Submit Feedback / Bug Report
  const submitFeedback = useCallback(async (feedback: {
    type: FeedbackItem['type'];
    title: string;
    description: string;
    contactEmail?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const cleanTitle = sanitizeString(feedback.title.trim());
    const cleanDesc = sanitizeString(feedback.description.trim());
    const contactEmail = feedback.contactEmail?.trim() || user?.email || 'anonimo@estud.ai';

    if (!cleanTitle || !cleanDesc) {
      return { success: false, message: 'Por favor preencha o título e a descrição do feedback.' };
    }

    const newItem: FeedbackItem = {
      id: `fb-${Date.now()}`,
      userId: user?.id || 'anon',
      userName: user?.name || 'Visitante',
      userEmail: contactEmail,
      type: feedback.type,
      title: cleanTitle,
      description: cleanDesc,
      status: 'aberto',
      createdAt: new Date().toISOString(),
    };

    // Save locally
    const currentList = safeJsonParse<FeedbackItem[]>(localStorage.getItem(KEYS.FEEDBACKS), []);
    const updated = [newItem, ...currentList];
    localStorage.setItem(KEYS.FEEDBACKS, JSON.stringify(updated));
    setFeedbacks(updated);

    // If Supabase configured, attempt cloud write
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('feedbacks').insert({
          id: newItem.id,
          user_id: user?.id || null,
          user_email: contactEmail,
          user_name: newItem.userName,
          type: newItem.type,
          title: newItem.title,
          description: newItem.description,
          status: 'aberto',
          created_at: newItem.createdAt,
        });
      } catch {
        // Fallback: already safely saved in localStorage
      }
    }

    return {
      success: true,
      message: 'Obrigado! Seu feedback foi enviado diretamente à equipe do estud.ai e nos ajudará muito!',
    };
  }, [user]);

  const updateFeedbackStatus = useCallback((id: string, status: FeedbackItem['status']) => {
    setFeedbacks((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, status } : f));
      localStorage.setItem(KEYS.FEEDBACKS, JSON.stringify(updated));
      return updated;
    });

    if (isSupabaseConfigured() && supabase) {
      supabase.from('feedbacks').update({ status }).eq('id', id).then(() => {});
    }
  }, []);

  const deleteFeedback = useCallback((id: string) => {
    setFeedbacks((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      localStorage.setItem(KEYS.FEEDBACKS, JSON.stringify(updated));
      return updated;
    });

    if (isSupabaseConfigured() && supabase) {
      supabase.from('feedbacks').delete().eq('id', id).then(() => {});
    }
  }, []);

  // System usage metrics for owner/admin
  const systemMetrics = useMemo<SystemMetrics>(() => {
    const sessions = db.getSessions();
    const questions = db.getQuestions();
    const workspaces = db.getWorkspaces();

    const totalSeconds = sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
    const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;

    const totalAttempted = questions.reduce((acc, q) => acc + (q.attempted || 0), 0);
    const totalCorrect = questions.reduce((acc, q) => acc + (q.correct || 0), 0);
    const avgAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

    const openCount = feedbacks.filter((f) => f.status === 'aberto').length;

    return {
      totalUsers: Math.max(allUsers.length, 1),
      totalStudyHours: totalHours,
      totalQuestions: totalAttempted,
      averageAccuracy: avgAccuracy,
      totalWorkspaces: workspaces.length,
      totalFeedbacks: feedbacks.length,
      openFeedbacks: openCount,
    };
  }, [allUsers, feedbacks]);

  // Cloud Sync helper for logged in users
  const syncWithCloud = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!isSupabaseConfigured() || !supabase || !user) {
      return {
        success: false,
        message: 'Modo Local ativo. Para sincronizar na nuvem, configure o Supabase nas variáveis de ambiente.',
      };
    }

    try {
      setSyncStatus('syncing');
      db.migrateGuestData(null, user.id);
      db.setCurrentUserId(user.id);
      const backupJson = db.exportAllData();
      const payload = JSON.parse(backupJson);

      const { error } = await supabase
        .from('user_sync_data')
        .upsert({
          user_id: user.id,
          payload,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        setSyncStatus('error');
        return { success: false, message: `Erro na sincronização: ${error.message}` };
      }

      setSyncStatus('synced');
      return { success: true, message: 'Dados sincronizados com a nuvem com sucesso!' };
    } catch (err: unknown) {
      setSyncStatus('error');
      return { success: false, message: formatSafeError(err) };
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isDemoMode,
      isAdmin,
      signIn,
      signUp,
      signOut,
      loginAsDemo,
      loginAsAdminDemo,
      feedbacks,
      submitFeedback,
      updateFeedbackStatus,
      deleteFeedback,
      allUsers,
      systemMetrics,
      syncWithCloud,
      syncStatus,
    }),
    [
      user,
      isLoading,
      isDemoMode,
      isAdmin,
      signIn,
      signUp,
      signOut,
      loginAsDemo,
      loginAsAdminDemo,
      feedbacks,
      submitFeedback,
      updateFeedbackStatus,
      deleteFeedback,
      allUsers,
      systemMetrics,
      syncWithCloud,
      syncStatus,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
