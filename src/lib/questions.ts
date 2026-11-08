import { round2, shortId, shuffle, shuffleDifferent } from './utils';

export type QType =
  | 'mcq' | 'tf' | 'short' | 'essay' | 'fill' | 'match' | 'order' | 'drag'
  | 'image' | 'long' | 'table' | 'cmap' | 'brainstorm' | 'content';

export interface Marker { id: string; x: number; y: number; answer?: string }
export interface CmapNode { id: string; label: string; x: number; y: number; blank?: boolean; answer?: string }
export interface CmapEdge { id: string; from: string; to: string; label?: string }

export interface Question {
  id: string;
  type: QType;
  prompt: string;
  points: number;
  image?: string;
  video?: string;
  // اختيار من متعدد
  options?: string[];
  correct?: number[];
  multi?: boolean;
  // صح وخطأ
  tfAnswer?: boolean;
  // إجابة قصيرة: بدائل مقبولة مفصولة بـ |
  accepted?: string;
  // للمقالي والتصحيح بالذكاء الاصطناعي
  modelAnswer?: string;
  rubric?: string;
  // إكمال الفراغ: النص مع [[الإجابة|بديل]]
  fillText?: string;
  // توصيل
  pairs?: { left: string; right: string }[];
  // ترتيب
  items?: string[];
  // سحب وإفلات
  categories?: { name: string; items: string[] }[];
  // صورة
  markers?: Marker[];
  // نص طويل
  boxes?: string[];
  // جدول
  cols?: string[];
  rows?: string[];
  cellAnswers?: string[][];
  // خريطة مفاهيم
  nodes?: CmapNode[];
  edges?: CmapEdge[];
  // حقول عامة تُشتق عند الإطلاق (لا تحتوي إجابات)
  segments?: string[];
  blanks?: number;
  lefts?: string[];
  rights?: string[];
  shuffled?: string[];
  catNames?: string[];
  pool?: string[];
}

export interface Ans { value?: any; parts?: Record<string, any> }

export const TYPE_META: Record<QType, { label: string; desc: string; collab?: boolean; graded: 'auto' | 'manual' | 'none' | 'optional' }> = {
  mcq: { label: 'اختيار من متعدد', desc: 'خيار واحد أو أكثر صحيح', graded: 'auto' },
  tf: { label: 'صح أو خطأ', desc: 'عبارة يحكم عليها الطالب', graded: 'auto' },
  short: { label: 'إجابة قصيرة', desc: 'كلمة أو جملة، مع بدائل مقبولة', graded: 'optional' },
  essay: { label: 'إجابة مقالية', desc: 'فقرة يكتبها الطالب', graded: 'manual' },
  fill: { label: 'إكمال الفراغ', desc: 'نص فيه فراغات', graded: 'auto' },
  match: { label: 'توصيل', desc: 'ربط كل عنصر بما يناسبه', graded: 'auto' },
  order: { label: 'ترتيب', desc: 'ترتيب أحداث أو خطوات', graded: 'auto' },
  drag: { label: 'سحب وإفلات', desc: 'تصنيف العناصر في مجموعات', graded: 'auto' },
  image: { label: 'سؤال على صورة', desc: 'تسمية مواضع مرقّمة على صورة', graded: 'auto' },
  long: { label: 'نص طويل بمربعات', desc: 'عدة مربعات كتابة بعناوين', graded: 'manual' },
  table: { label: 'جدول للتعبئة', desc: 'جدول يملؤه الطلاب معًا', graded: 'optional', collab: true },
  cmap: { label: 'خريطة مفاهيم', desc: 'عقد فارغة يملؤها الطلاب', graded: 'optional', collab: true },
  brainstorm: { label: 'تفكير جماعي', desc: 'لوحة أفكار وحلول مشتركة', graded: 'manual', collab: true },
  content: { label: 'نص أو وسائط', desc: 'تعليمات أو قراءة أو فيديو بلا سؤال', graded: 'none' },
};

export const TYPE_ORDER: QType[] = [
  'mcq', 'tf', 'short', 'essay', 'fill', 'match', 'order', 'drag',
  'image', 'long', 'table', 'cmap', 'brainstorm', 'content',
];

export function isCollab(q: Question) {
  return !!TYPE_META[q.type]?.collab;
}

export function defaultQuestion(type: QType): Question {
  const base: Question = { id: shortId(), type, prompt: '', points: type === 'content' ? 0 : 1 };
  switch (type) {
    case 'mcq':
      return { ...base, options: ['', '', '', ''], correct: [0], multi: false };
    case 'tf':
      return { ...base, tfAnswer: true };
    case 'short':
      return { ...base, accepted: '' };
    case 'essay':
      return { ...base, points: 5, modelAnswer: '', rubric: '' };
    case 'fill':
      return { ...base, prompt: 'أكمل الفراغات التالية:', fillText: 'عاصمة دولة قطر هي [[الدوحة]].', points: 2 };
    case 'match':
      return { ...base, prompt: 'صل كل عنصر بما يناسبه:', points: 3, pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }] };
    case 'order':
      return { ...base, prompt: 'رتّب ما يلي ترتيبًا صحيحًا:', points: 3, items: ['', '', ''] };
    case 'drag':
      return { ...base, prompt: 'اسحب كل عنصر إلى المجموعة المناسبة:', points: 4, categories: [{ name: '', items: [''] }, { name: '', items: [''] }] };
    case 'image':
      return { ...base, prompt: 'اكتب ما يدل عليه كل رقم في الصورة:', points: 3, markers: [] };
    case 'long':
      return { ...base, points: 6, boxes: ['المقدمة', 'العرض', 'الخاتمة'], modelAnswer: '', rubric: '' };
    case 'table':
      return { ...base, prompt: 'املأ الجدول:', points: 4, cols: ['العمود الأول', 'العمود الثاني'], rows: ['الصف الأول', 'الصف الثاني'], cellAnswers: [] };
    case 'cmap':
      return {
        ...base, prompt: 'أكمل خريطة المفاهيم:', points: 3,
        nodes: [
          { id: 'a', label: 'المفهوم الرئيس', x: 50, y: 18 },
          { id: 'b', label: '', x: 20, y: 70, blank: true, answer: '' },
          { id: 'c', label: '', x: 80, y: 70, blank: true, answer: '' },
        ],
        edges: [{ id: 'e1', from: 'a', to: 'b', label: '' }, { id: 'e2', from: 'a', to: 'c', label: '' }],
      };
    case 'brainstorm':
      return { ...base, prompt: 'ما الحلول الممكنة لهذه المشكلة؟', points: 5, rubric: '' };
    case 'content':
      return { ...base, prompt: '' };
  }
}

// ---------- تطبيع النص العربي للمقارنة ----------
export function normalizeAr(s: any): string {
  return String(s ?? '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[.,،؛;:!؟?"'«»()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function alternatives(s?: string): string[] {
  return String(s ?? '').split('|').map((x) => x.trim()).filter(Boolean);
}

function matchesAny(value: any, alts: string[]) {
  const v = normalizeAr(value);
  if (!v) return false;
  return alts.some((a) => normalizeAr(a) === v);
}

export function parseFill(text?: string) {
  const segs: string[] = [];
  const ans: string[][] = [];
  const re = /\[\[(.+?)\]\]/g;
  const t = text || '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    segs.push(t.slice(last, m.index));
    ans.push(alternatives(m[1]));
    last = m.index + m[0].length;
  }
  segs.push(t.slice(last));
  return { segs, ans };
}

// ---------- إزالة الإجابات قبل إرسال الأسئلة للطلاب ----------
export function sanitize(q: Question): Question {
  const p: Question = JSON.parse(JSON.stringify(q));
  switch (q.type) {
    case 'mcq':
      delete p.correct;
      break;
    case 'tf':
      delete p.tfAnswer;
      break;
    case 'short':
      delete p.accepted;
      break;
    case 'fill': {
      const { segs, ans } = parseFill(q.fillText);
      p.segments = segs;
      p.blanks = ans.length;
      delete p.fillText;
      break;
    }
    case 'match':
      p.lefts = (q.pairs || []).map((x) => x.left);
      p.rights = shuffleDifferent((q.pairs || []).map((x) => x.right));
      delete p.pairs;
      break;
    case 'order':
      p.shuffled = shuffleDifferent(q.items || []);
      delete p.items;
      break;
    case 'drag':
      p.catNames = (q.categories || []).map((c) => c.name);
      p.pool = shuffle((q.categories || []).flatMap((c) => c.items.filter(Boolean)));
      delete p.categories;
      break;
    case 'image':
      p.markers = (q.markers || []).map((m) => ({ id: m.id, x: m.x, y: m.y }));
      break;
    case 'table':
      delete p.cellAnswers;
      break;
    case 'cmap':
      p.nodes = (q.nodes || []).map((n) => (n.blank ? { id: n.id, label: '', x: n.x, y: n.y, blank: true } : { id: n.id, label: n.label, x: n.x, y: n.y }));
      break;
  }
  delete p.modelAnswer;
  delete p.rubric;
  return p;
}

/** يعيد درجة السؤال تلقائيًا، أو null إذا كان السؤال يحتاج تصحيحًا يدويًا */
export function autograde(q: Question, a: Ans): number | null {
  const pts = Number(q.points) || 0;
  const v = a?.value;
  const parts = a?.parts || {};
  const frac = (ok: number, total: number) => (total ? round2((ok / total) * pts) : 0);

  switch (q.type) {
    case 'mcq': {
      if (!q.correct || !q.correct.length) return null;
      const sel: number[] = Array.isArray(v) ? v : [];
      const a1 = [...sel].sort().join(',');
      const a2 = [...q.correct].sort().join(',');
      return a1 === a2 ? pts : 0;
    }
    case 'tf':
      if (typeof q.tfAnswer !== 'boolean') return null;
      return v === q.tfAnswer ? pts : 0;
    case 'short': {
      const alts = alternatives(q.accepted);
      if (!alts.length) return null;
      return matchesAny(v, alts) ? pts : 0;
    }
    case 'fill': {
      const { ans } = parseFill(q.fillText);
      if (!ans.length) return null;
      const vals: string[] = Array.isArray(v) ? v : [];
      return frac(ans.filter((alts, i) => matchesAny(vals[i], alts)).length, ans.length);
    }
    case 'match': {
      const pairs = q.pairs || [];
      if (!pairs.length) return null;
      const vals: string[] = Array.isArray(v) ? v : [];
      return frac(pairs.filter((p, i) => vals[i] && normalizeAr(vals[i]) === normalizeAr(p.right)).length, pairs.length);
    }
    case 'order': {
      const items = q.items || [];
      if (items.length < 2) return null;
      const vals: string[] = Array.isArray(v) ? v : [];
      if (!vals.length) return 0;
      return frac(items.filter((it, i) => vals[i] === it).length, items.length);
    }
    case 'drag': {
      const cats = q.categories || [];
      const all = cats.flatMap((c, ci) => c.items.filter(Boolean).map((it) => ({ it, ci })));
      if (!all.length) return null;
      const placed: Record<string, number> = v && typeof v === 'object' ? v : {};
      return frac(all.filter((x) => placed[x.it] === x.ci).length, all.length);
    }
    case 'image': {
      const ms = (q.markers || []).filter((m) => alternatives(m.answer).length);
      if (!ms.length) return null;
      const vals: string[] = Array.isArray(v) ? v : [];
      const idx = (id: string) => (q.markers || []).findIndex((m) => m.id === id);
      return frac(ms.filter((m) => matchesAny(vals[idx(m.id)], alternatives(m.answer))).length, ms.length);
    }
    case 'table': {
      const cells: { k: string; alts: string[] }[] = [];
      (q.rows || []).forEach((_, r) => (q.cols || []).forEach((__, c) => {
        const alts = alternatives(q.cellAnswers?.[r]?.[c]);
        if (alts.length) cells.push({ k: `r${r}c${c}`, alts });
      }));
      if (!cells.length) return null;
      return frac(cells.filter((c) => matchesAny(parts[c.k], c.alts)).length, cells.length);
    }
    case 'cmap': {
      const blanks = (q.nodes || []).filter((n) => n.blank && alternatives(n.answer).length);
      if (!blanks.length) return null;
      return frac(blanks.filter((n) => matchesAny(parts[`n${n.id}`], alternatives(n.answer))).length, blanks.length);
    }
    default:
      return null;
  }
}

export function isAutoGradable(q: Question) {
  return autograde(q, {}) !== null;
}

export function isAnswered(q: Question, a?: Ans): boolean {
  if (!a) return false;
  const v = a.value;
  if (isCollab(q)) return Object.values(a.parts || {}).some((x) => (typeof x === 'string' ? x.trim() : x?.text?.trim?.()));
  if (v === undefined || v === null) return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'string') return !!v.trim();
  if (Array.isArray(v)) return v.some((x) => (typeof x === 'string' ? x.trim() : x !== null && x !== undefined));
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

const lefts = (q: Question) => q.lefts || (q.pairs || []).map((p) => p.left);
const catNames = (q: Question) => q.catNames || (q.categories || []).map((c) => c.name);

/** تحويل الإجابة إلى نص مقروء (للمعلم والتقارير والذكاء الاصطناعي) */
export function answerToText(q: Question, a?: Ans): string {
  if (!a) return '';
  const v = a.value;
  const parts = a.parts || {};
  switch (q.type) {
    case 'mcq':
      return (Array.isArray(v) ? v : []).map((i: number) => q.options?.[i] ?? '').filter(Boolean).join('، ');
    case 'tf':
      return v === true ? 'صح' : v === false ? 'خطأ' : '';
    case 'short':
    case 'essay':
      return String(v ?? '');
    case 'fill':
      return (Array.isArray(v) ? v : []).map((x: string, i: number) => `(${i + 1}) ${x || '—'}`).join('  ');
    case 'match':
      return lefts(q).map((l, i) => `${l} ← ${(Array.isArray(v) && v[i]) || '—'}`).join('\n');
    case 'order':
      return (Array.isArray(v) ? v : []).map((x: string, i: number) => `${i + 1}. ${x}`).join('\n');
    case 'drag': {
      const placed: Record<string, number> = v && typeof v === 'object' ? v : {};
      return catNames(q).map((n, ci) => `${n}: ${Object.keys(placed).filter((k) => placed[k] === ci).join('، ') || '—'}`).join('\n');
    }
    case 'image':
      return (q.markers || []).map((m, i) => `(${i + 1}) ${(Array.isArray(v) && v[i]) || '—'}`).join('  ');
    case 'long':
      return (q.boxes || []).map((b, i) => `${b}:\n${(Array.isArray(v) && v[i]) || '—'}`).join('\n\n');
    case 'table':
      return (q.rows || []).map((r, ri) => `${r}: ` + (q.cols || []).map((c, ci) => `${c} = ${parts[`r${ri}c${ci}`] || '—'}`).join('، ')).join('\n');
    case 'cmap':
      return (q.nodes || []).filter((n) => n.blank).map((n) => `• ${parts[`n${n.id}`] || '—'}`).join('\n');
    case 'brainstorm':
      return Object.values(parts).map((p: any) => `• ${p?.text || ''}`).join('\n');
    default:
      return '';
  }
}

/** وصف الإجابة الصحيحة (يُعرض للطالب بعد الانتهاء إن سمح المعلم) */
export function describeCorrect(q: Question): string {
  switch (q.type) {
    case 'mcq':
      return (q.correct || []).map((i) => q.options?.[i]).filter(Boolean).join('، ');
    case 'tf':
      return q.tfAnswer === undefined ? '' : q.tfAnswer ? 'صح' : 'خطأ';
    case 'short':
      return alternatives(q.accepted).join(' أو ') || q.modelAnswer || '';
    case 'essay':
    case 'long':
    case 'brainstorm':
      return q.modelAnswer || '';
    case 'fill':
      return parseFill(q.fillText).ans.map((a, i) => `(${i + 1}) ${a[0] || ''}`).join('  ');
    case 'match':
      return (q.pairs || []).map((p) => `${p.left} ← ${p.right}`).join('\n');
    case 'order':
      return (q.items || []).map((x, i) => `${i + 1}. ${x}`).join('\n');
    case 'drag':
      return (q.categories || []).map((c) => `${c.name}: ${c.items.filter(Boolean).join('، ')}`).join('\n');
    case 'image':
      return (q.markers || []).map((m, i) => `(${i + 1}) ${alternatives(m.answer)[0] || ''}`).join('  ');
    case 'table':
      return (q.rows || []).map((r, ri) => `${r}: ` + (q.cols || []).map((c, ci) => `${c} = ${alternatives(q.cellAnswers?.[ri]?.[ci])[0] || '—'}`).join('، ')).join('\n');
    case 'cmap':
      return (q.nodes || []).filter((n) => n.blank).map((n) => `• ${alternatives(n.answer)[0] || ''}`).join('\n');
    default:
      return '';
  }
}

export function gradable(qs: Question[]) {
  return qs.filter((q) => q.type !== 'content');
}

export function totalPoints(qs: Question[]) {
  return gradable(qs).reduce((s, q) => s + (Number(q.points) || 0), 0);
}

/** فحص جاهزية ورقة العمل قبل إطلاقها */
export function validate(qs: Question[]): string[] {
  const issues: string[] = [];
  qs.forEach((q, i) => {
    const n = `السؤال ${i + 1}`;
    if (q.type !== 'content' && q.type !== 'fill' && !q.prompt.trim()) issues.push(`${n}: نص السؤال فارغ.`);
    if (q.type === 'mcq' && (q.options || []).filter((o) => o.trim()).length < 2) issues.push(`${n}: أضف خيارين على الأقل.`);
    if (q.type === 'fill' && !parseFill(q.fillText).ans.length) issues.push(`${n}: ضع الفراغات بين [[ ]].`);
    if (q.type === 'match' && (q.pairs || []).some((p) => !p.left.trim() || !p.right.trim())) issues.push(`${n}: أكمل جميع أزواج التوصيل.`);
    if (q.type === 'order' && (q.items || []).filter((x) => x.trim()).length < 2) issues.push(`${n}: أضف عنصرين على الأقل للترتيب.`);
    if (q.type === 'drag' && (q.categories || []).some((c) => !c.name.trim())) issues.push(`${n}: سمِّ جميع المجموعات.`);
    if (q.type === 'image' && !q.image) issues.push(`${n}: ارفع صورة للسؤال.`);
  });
  return issues;
}

/** تنظيف العناصر الفارغة قبل الإطلاق */
export function cleanQuestion(q: Question): Question {
  const c: Question = JSON.parse(JSON.stringify(q));
  if (c.items) c.items = c.items.map((x) => x.trim()).filter(Boolean);
  if (c.pairs) c.pairs = c.pairs.filter((p) => p.left.trim() && p.right.trim());
  if (c.categories) c.categories = c.categories.map((k) => ({ ...k, items: k.items.map((x) => x.trim()).filter(Boolean) }));
  if (c.boxes) c.boxes = c.boxes.filter((b) => b.trim());
  return c;
}
