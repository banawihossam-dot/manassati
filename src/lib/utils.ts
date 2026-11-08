export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function uid(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function shortId(): string {
  return Math.random().toString(36).slice(2, 9);
}

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function makeCode(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** خلط يضمن ألا يبقى الترتيب كما هو */
export function shuffleDifferent<T>(arr: T[]): T[] {
  if (arr.length < 2) return [...arr];
  for (let t = 0; t < 8; t++) {
    const s = shuffle(arr);
    if (s.some((x, i) => x !== arr[i])) return s;
  }
  return [...arr].reverse();
}

export const GROUP_COLORS = ['#0E7C7B', '#C2413A', '#6B4FBB', '#D48A1F', '#2F855A', '#2B6CB0', '#B83280', '#5F6B2E'];
export function groupColor(i: number | null | undefined) {
  return GROUP_COLORS[Math.abs(i ?? 0) % GROUP_COLORS.length];
}

export function fmtDate(s?: string | null) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('ar-QA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
}

export function fmtTime(s?: string | null) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleTimeString('ar-QA', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

export function cls(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ');
}
