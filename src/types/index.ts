export type SubjectStatus = 'backlog' | 'active' | 'maintenance';

export type StudyType = 'teoria' | 'videoaula' | 'pdf' | 'questoes' | 'simulado' | 'lei_seca' | 'jurisprudencia' | 'discursiva';

export interface ConcursoInfo {
  concurso: string;
  cargo: string;
  banca: string;
  dataProva: string; // YYYY-MM-DD
}

export interface SpacedReview {
  id: string;
  subjectId: string;
  subjectName: string;
  topicName: string;
  studyDate: string; // YYYY-MM-DD
  revDate: string; // YYYY-MM-DD
  days: number;
  done: boolean;
  workspaceId: string;
  completedAt?: string;
}

export interface CicloWorkspace {
  id: string;
  name: string;
  createdAt: string;
  concursoInfo?: ConcursoInfo;
}

export interface Subtopic {
  id: string;
  name: string;
  completed: boolean;
  completedAt?: string;
  acertos?: number;
  erros?: number;
  granQuery?: string; // specific search keyword for Gran Questões
  assuntoId?: number | number[]; // Gran Questões topic ID(s)
  disciplinaId?: number; // Gran Questões discipline ID
  
  // Gran Class Tracker fields
  videoWatched?: boolean;
  videoLesson?: string; // e.g. "Aula 03"
  videoBlock?: string;  // e.g. "Bloco 2"
  videoUrl?: string;    // specific direct link for video
  pdfRead?: boolean;
  pdfLesson?: string;   // e.g. "Aula 02"
  pdfPages?: string;    // e.g. "pág. 15/45"
  pdfUrl?: string;      // specific direct link for PDF
  notes?: string;       // Instructor remarks / summary / insights
}

export interface Topic {
  id: string;
  name: string;
  subtopics: Subtopic[];
  granQuery?: string;
  assuntoId?: number | number[];
  disciplinaId?: number;
  courseUrl?: string; // Gran online course link for this topic
  notes?: string;
}

export interface Subject {
  id: string;
  name: string;
  weight: number; // 1 to 5
  targetHours: number; // calculated hours
  status: SubjectStatus; // backlog, active, maintenance
  topics: Topic[];
  granQuery?: string;
  assuntoId?: number | number[];
  disciplinaId?: number;
  granCourseUrl?: string; // Gran course URL (e.g. aluno/espaco/meus-cursos/...)
  notes?: string;
}

export interface StudyBlock {
  id: string;
  subjectId: string;
  subjectName: string;
  durationMinutes: number;
  completed: boolean;
  completedAt?: string; // ISO date string when completed
  order: number;
  dayAllocated?: string; // e.g. 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'
}

export interface StudySession {
  id: string;
  subjectId: string;
  subjectName: string;
  topicName: string;
  subtopicName?: string;
  durationSeconds: number;
  date: string; // ISO string
  notes?: string;
  studyType?: StudyType;
  acertos?: number;
  erros?: number;
  workspaceId?: string; // linked workspace context
  workspaceName?: string; // linked workspace name for filters
  // Gran Tracker Session Details
  playbackSpeed?: number; // e.g. 1.0, 1.25, 1.5, 1.75, 2.0
  grossDurationSeconds?: number; // durationSeconds * playbackSpeed
  videoLesson?: string;
  videoBlock?: string;
  pdfLesson?: string;
  pdfPages?: string;
}

export interface QuestionSession {
  id: string;
  subjectId: string;
  subjectName: string;
  topicName: string;
  attempted: number;
  correct: number;
  banca: string;
  date: string; // ISO string
  adicionarParaRevisao?: boolean; // flag error review caderno de erros
  insightAncoragem?: string; // revision short text
  workspaceId?: string; // linked workspace context
  workspaceName?: string; // linked workspace name for filters
  tipo?: 'treino' | 'simulado'; // tipo de registro
}

export interface StudyCycleConfig {
  weeklyHours: number;
  cycleDurationWeeks: number;
  dailyHours?: { [day: string]: number }; // Monday to Sunday hours allocation
}

export interface RunningTimerState {
  isActive: boolean;
  isPaused: boolean;
  timerMode: 'stopwatch' | 'countdown';
  durationMinutes: number;
  startTime: number | null; // Date.now() when started/resumed
  accumulatedSeconds: number;
  subjectId: string;
  subjectName: string;
  topicId?: string;
  topicName?: string;
  subtopicId?: string;
  subtopicName?: string;
  notes?: string;
  studyType: StudyType;
  workspaceId: string;
  // Gran Tracker additions
  playbackSpeed?: number;
  videoLesson?: string;
  videoBlock?: string;
  pdfLesson?: string;
  pdfPages?: string;
}

export type FlashcardState = 'new' | 'learning' | 'review';

export interface Flashcard {
  id: string;
  workspaceId: string;
  subjectId: string;
  subjectName: string;
  topicName: string;
  subtopicName?: string;
  front: string; // Markdown/formatted text supported
  back: string;  // Markdown/formatted text supported
  tags: string[];
  createdAt: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  interval: number;  // days until next review
  repetition: number; // consecutive successful reviews
  easeFactor: number; // starts at 2.5, minimum 1.3
  state: FlashcardState;
}

export interface AutopilotSettings {
  questionsPerBlock: number; // e.g. 15
  theoryDurationMinutes: number; // e.g. 60
  autoScheduleD1Review: boolean; // default: true
  banca: string; // default: 'FCC'
  bancaId: number; // default: 92
}

export interface AutopilotTask {
  id: string;
  blockId: string;
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  subtopicId: string;
  subtopicName: string;
  theoryMinutes: number;
  theoryCompleted: boolean;
  questionsTarget: number;
  questionsAttempted: number;
  questionsCorrect: number;
  granQuestionsUrl: string;
  videoUrl?: string;
  videoLesson?: string;
  videoBlock?: string;
  pdfUrl?: string;
  pdfLesson?: string;
  pdfPages?: string;
  isRevision?: boolean;
}

export interface AutopilotTomorrowPreview {
  dateStr: string;
  dayName: string;
  tasks: AutopilotTask[];
  maturingReviews: SpacedReview[];
  maturingFlashcardsCount: number;
}

export interface AutopilotDayMission {
  dateStr: string;
  dayName: string;
  tasks: AutopilotTask[];
  dueFlashcardsCount: number;
  dueReviews: SpacedReview[];
  isCompleted: boolean;
  tomorrow?: AutopilotTomorrowPreview;
  reviewedFlashcardsCount?: number;
}

export type GamificationActionType =
  | 'theory_completed'
  | 'questions_saved'
  | 'flashcard_reviewed'
  | 'review_completed'
  | 'streak_bonus';

export interface GamificationAction {
  id: string;
  type: GamificationActionType;
  xpAwarded: number;
  timestamp: string;
  description: string;
  workspaceId?: string;
}

export interface StudentLevel {
  level: number;
  title: string;
  minXp: number;
  maxXp: number;
  badge: string;
}

export interface GamificationProfile {
  totalXp: number;
  dailyXp: Record<string, number>; // 'YYYY-MM-DD' -> points
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: string;
  history?: GamificationAction[];
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar?: string;
  concursoTarget: string;
  pointsToday: number;
  streakDays: number;
  levelTitle: string;
  level: number;
  isCurrentUser: boolean;
  rank?: number;
}
