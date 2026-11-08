import type { Question } from '@/lib/questions';
import type { AnswerRow, GradeRow, Group, Participant, Scope, Session } from '@/lib/results';

export interface Ctx {
  session: Session;
  keyQs: Question[];
  participants: Participant[];
  groups: Group[];
  answers: AnswerRow[];
  grades: GradeRow[];
  scopes: Scope[];
  online: Set<string>;
  teacherId?: string;
  toast: (t: string, tone?: 'ok' | 'err') => void;
  reloadGrades: () => Promise<void>;
  reloadPeople: () => Promise<void>;
  patchSession: (p: Partial<Session>) => Promise<void>;
}
