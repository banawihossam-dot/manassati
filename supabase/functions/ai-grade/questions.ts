// نسخة مختصرة من src/lib/questions.ts تكفي لتحويل الإجابات إلى نص
export interface Question {
  id: string; type: string; prompt: string; points: number;
  options?: string[]; fillText?: string; boxes?: string[]; modelAnswer?: string; rubric?: string;
  pairs?: { left: string; right: string }[]; lefts?: string[];
  categories?: { name: string; items: string[] }[]; catNames?: string[];
  markers?: { id: string }[]; rows?: string[]; cols?: string[];
  nodes?: { id: string; blank?: boolean }[];
}
export interface Ans { value?: any; parts?: Record<string, any> }

const COLLAB = new Set(['table', 'cmap', 'brainstorm']);

export function isAnswered(q: Question, a?: Ans): boolean {
  if (!a) return false;
  const v = a.value;
  if (COLLAB.has(q.type)) return Object.values(a.parts || {}).some((x: any) => (typeof x === 'string' ? x.trim() : x?.text?.trim?.()));
  if (v === undefined || v === null) return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'string') return !!v.trim();
  if (Array.isArray(v)) return v.some((x) => (typeof x === 'string' ? x.trim() : x !== null && x !== undefined));
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

export function answerToText(q: Question, a?: Ans): string {
  if (!a) return '';
  const v = a.value;
  const parts = a.parts || {};
  const arr = (x: any) => (Array.isArray(x) ? x : []);
  switch (q.type) {
    case 'mcq': return arr(v).map((i: number) => q.options?.[i] ?? '').filter(Boolean).join('، ');
    case 'tf': return v === true ? 'صح' : v === false ? 'خطأ' : '';
    case 'short': case 'essay': return String(v ?? '');
    case 'fill': return arr(v).map((x: string, i: number) => `(${i + 1}) ${x || '—'}`).join('  ');
    case 'match': return (q.lefts || (q.pairs || []).map((p) => p.left)).map((l, i) => `${l} ← ${arr(v)[i] || '—'}`).join('\n');
    case 'order': return arr(v).map((x: string, i: number) => `${i + 1}. ${x}`).join('\n');
    case 'drag': {
      const placed: Record<string, number> = v && typeof v === 'object' ? v : {};
      return (q.catNames || (q.categories || []).map((c) => c.name)).map((n, ci) => `${n}: ${Object.keys(placed).filter((k) => placed[k] === ci).join('، ') || '—'}`).join('\n');
    }
    case 'image': return (q.markers || []).map((_, i) => `(${i + 1}) ${arr(v)[i] || '—'}`).join('  ');
    case 'long': return (q.boxes || []).map((b, i) => `${b}:\n${arr(v)[i] || '—'}`).join('\n\n');
    case 'table': return (q.rows || []).map((r, ri) => `${r}: ` + (q.cols || []).map((c, ci) => `${c} = ${parts[`r${ri}c${ci}`] || '—'}`).join('، ')).join('\n');
    case 'cmap': return (q.nodes || []).filter((n) => n.blank).map((n) => `• ${parts[`n${n.id}`] || '—'}`).join('\n');
    case 'brainstorm': return Object.values(parts).map((p: any) => `• ${p?.text || ''}`).join('\n');
    default: return '';
  }
}
