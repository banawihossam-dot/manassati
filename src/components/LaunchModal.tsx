'use client';
import { Loader2, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { validate } from '@/lib/questions';
import { launchSession, type LaunchSettings, type Worksheet } from '@/lib/results';
import { errorText } from '@/lib/supabase';
import { cls } from '@/lib/utils';
import Modal from './Modal';

const MODES: { v: LaunchSettings['mode']; t: string; d: string }[] = [
  { v: 'individual', t: 'كل طالب مستقل', d: 'لكل طالب مساحته وإجابته الخاصة' },
  { v: 'group', t: 'مجموعات', d: 'كل مجموعة تعمل معًا في مساحة واحدة' },
  { v: 'shared', t: 'مساحة مشتركة', d: 'الصف كله يكتب في الورقة نفسها' },
];

export default function LaunchModal({ ws, open, onClose }: { ws: Worksheet | null; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [s, setS] = useState<LaunchSettings>({ mode: 'individual', group_size: 4, auto_groups: true, show_peers: false, chat_enabled: false, show_results: true, show_answers: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!ws) return null;
  const issues = validate(ws.questions || []);
  const set = (p: Partial<LaunchSettings>) => setS((x) => ({ ...x, ...p }));

  const go = async () => {
    setBusy(true); setErr('');
    try {
      const id = await launchSession(ws, s);
      router.push(`/teacher/session/?id=${id}`);
    } catch (e) { setErr(errorText(e)); setBusy(false); }
  };

  const toggle = (k: keyof LaunchSettings, t: string, d: string) => (
    <label key={k} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 hover:bg-surface2/50">
      <input type="checkbox" className="mt-1.5 h-4 w-4 accent-[rgb(var(--primary))]" checked={!!s[k]} onChange={(e) => set({ [k]: e.target.checked } as any)} />
      <span><span className="block font-semibold">{t}</span><span className="hint">{d}</span></span>
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} title={`بدء نشاط: ${ws.title}`} wide>
      {(ws.questions || []).length === 0 ? (
        <p className="text-muted">أضف سؤالًا واحدًا على الأقل قبل بدء النشاط.</p>
      ) : (
        <div className="space-y-5">
          {issues.length > 0 && (
            <div className="rounded-xl bg-accent/15 p-3 text-sm">
              <p className="mb-1 font-bold">ملاحظات قبل البدء:</p>
              <ul className="list-disc space-y-0.5 ps-5">{issues.slice(0, 6).map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          )}
          <div>
            <span className="label">نمط العمل</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => (
                <button key={m.v} type="button" onClick={() => set({ mode: m.v })}
                  className={cls('rounded-xl border-2 p-3 text-start transition', s.mode === m.v ? 'border-primary bg-primary/10' : 'border-line hover:border-primary/40')}>
                  <span className="block font-bold">{m.t}</span><span className="hint">{m.d}</span>
                </button>
              ))}
            </div>
          </div>
          {s.mode === 'group' && (
            <div className="grid gap-3 rounded-xl bg-surface2/60 p-3 sm:grid-cols-2">
              <div>
                <label className="label">عدد الطلاب في كل مجموعة</label>
                <input type="number" min={2} max={12} className="input" value={s.group_size} onChange={(e) => set({ group_size: Math.min(12, Math.max(2, Number(e.target.value) || 2)) })} />
              </div>
              <div>
                <span className="label">التوزيع</span>
                <div className="flex gap-2">
                  {[[true, 'تلقائي عند الدخول'], [false, 'يدوي من لوحتي']].map(([v, t]) => (
                    <button key={String(v)} type="button" onClick={() => set({ auto_groups: v as boolean })} className={cls('btn-sm btn flex-1 border-2', s.auto_groups === v ? 'border-primary bg-primary/10' : 'border-line')}>{t as string}</button>
                  ))}
                </div>
                <p className="hint mt-1">يمكنك التوزيع العشوائي أو نقل أي طالب يدويًا أثناء النشاط.</p>
              </div>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {toggle("show_peers", "إظهار إجابات الزملاء", "يرى الطلاب إجابات بقية الصف أو المجموعات")}
            {toggle("chat_enabled", "المحادثة الجماعية", "يمكنك إيقافها في أي وقت أثناء النشاط")}
            {toggle("show_results", "إظهار النتيجة للطالب", "بعد أن تنشر النتائج")}
            {toggle("show_answers", "إظهار الإجابات الصحيحة", "بعد انتهاء النشاط")}
          </div>
          {err && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{err}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>إلغاء</button>
            <button className="btn-primary" onClick={go} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} ابدأ النشاط</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
