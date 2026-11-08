'use client';
import { Archive, Copy, FilePlus2, Loader2, LogOut, Pencil, Play, Radio, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import LaunchModal from '@/components/LaunchModal';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import { gradable } from '@/lib/questions';
import { MODE_LABEL, type Session, type Worksheet } from '@/lib/results';
import { errorText, supabase } from '@/lib/supabase';
import { useTeacher } from '@/lib/useTeacher';
import { cls, fmtDate } from '@/lib/utils';

type SessionRow = Session & { participants: { count: number }[] };

export default function TeacherHome() {
  const router = useRouter();
  const { ready, signOut, displayName } = useTeacher();
  const toast = useToast();
  const [tab, setTab] = useState<'ws' | 'archive'>('ws');
  const [sheets, setSheets] = useState<Worksheet[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [launch, setLaunch] = useState<Worksheet | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [w, s] = await Promise.all([
      supabase.from('worksheets').select('*').order('updated_at', { ascending: false }),
      supabase.from('sessions').select('id,code,title,subject,grade,mode,status,created_at,ended_at,worksheet_id,participants(count)').order('created_at', { ascending: false }),
    ]);
    if (w.error) toast.show(errorText(w.error), 'err');
    setSheets((w.data as any) || []);
    setSessions((s.data as any) || []);
    setLoading(false);
  }, [toast.show]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const create = async () => {
    setCreating(true);
    const { data, error } = await supabase.from('worksheets').insert({ title: 'ورقة عمل جديدة' }).select('id').single();
    if (error) { toast.show(errorText(error), 'err'); setCreating(false); return; }
    router.push(`/teacher/worksheet/?id=${data.id}`);
  };

  const duplicate = async (w: Worksheet) => {
    const { error } = await supabase.from('worksheets').insert({ title: `${w.title} (نسخة)`, objective: w.objective, subject: w.subject, grade: w.grade, questions: w.questions });
    if (error) return toast.show(errorText(error), 'err');
    toast.show('نُسخت ورقة العمل');
    load();
  };

  const remove = async (w: Worksheet) => {
    if (!confirm(`حذف «${w.title}»؟ تبقى نتائج الأنشطة السابقة في الأرشيف.`)) return;
    const { error } = await supabase.from('worksheets').delete().eq('id', w.id);
    if (error) return toast.show(errorText(error), 'err');
    setSheets((x) => x.filter((y) => y.id !== w.id));
  };

  const removeSession = async (s: SessionRow) => {
    if (!confirm(`حذف نشاط «${s.title}» (${s.code}) وجميع إجاباته ونتائجه نهائيًا؟`)) return;
    const { error } = await supabase.from('sessions').delete().eq('id', s.id);
    if (error) return toast.show(errorText(error), 'err');
    setSessions((x) => x.filter((y) => y.id !== s.id));
  };

  const live = sessions.filter((s) => s.status === 'live');

  return (
    <>
      <TopBar logoHref="/teacher">
        <span className="hidden text-sm text-muted sm:inline">{displayName}</span>
        <button className="icon-btn" onClick={signOut} aria-label="تسجيل الخروج" title="تسجيل الخروج"><LogOut size={18} /></button>
      </TopBar>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">أوراق العمل</h1>
            <p className="text-muted">صمّم ورقة، ثم ابدأ نشاطًا وشارك رمزه مع طلابك.</p>
          </div>
          <button className="btn-primary" onClick={create} disabled={creating}>
            {creating ? <Loader2 size={16} className="animate-spin" /> : <FilePlus2 size={16} />} ورقة عمل جديدة
          </button>
        </div>

        {live.length > 0 && (
          <div className="mb-6 rounded-2xl border-2 border-primary/40 bg-primary/5 p-4">
            <p className="mb-2 flex items-center gap-2 font-bold"><Radio size={16} className="live-dot text-primary" /> أنشطة جارية الآن</p>
            <div className="flex flex-wrap gap-2">
              {live.map((s) => (
                <Link key={s.id} href={`/teacher/session/?id=${s.id}`} className="btn-outline btn-sm">
                  {s.title} <span dir="ltr" className="font-mono tracking-widest text-primary">{s.code}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mb-5 inline-flex rounded-xl bg-surface2 p-1">
          <button className={cls('tab', tab === 'ws' && 'tab-active')} onClick={() => setTab('ws')}>أوراقي ({sheets.length})</button>
          <button className={cls('tab', tab === 'archive' && 'tab-active')} onClick={() => setTab('archive')}><Archive size={14} className="me-1 inline" />الأرشيف والنتائج ({sessions.length})</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted" /></div>
        ) : tab === 'ws' ? (
          sheets.length === 0 ? (
            <div className="panel flex flex-col items-center gap-3 p-12 text-center">
              <p className="text-lg font-bold">لا توجد أوراق عمل بعد</p>
              <p className="max-w-md text-muted">ابدأ بورقة جديدة وأضف إليها الأسئلة والأنشطة، ثم شاركها مع طلابك برمز.</p>
              <button className="btn-primary mt-2" onClick={create}><FilePlus2 size={16} /> أنشئ ورقتك الأولى</button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sheets.map((w) => (
                <article key={w.id} className="panel flex flex-col p-5">
                  <div className="mb-1 flex flex-wrap gap-1.5 text-xs">
                    {w.subject && <span className="chip bg-primary/10 text-primary">{w.subject}</span>}
                    {w.grade && <span className="chip bg-accent/15 text-ink">{w.grade}</span>}
                  </div>
                  <h2 className="text-lg font-bold">{w.title}</h2>
                  {w.objective && <p className="mt-1 line-clamp-2 text-sm text-muted">{w.objective}</p>}
                  <p className="mt-3 text-xs text-muted">{gradable(w.questions || []).length} سؤال، آخر تعديل {fmtDate(w.updated_at)}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-line pt-3">
                    <button className="btn-primary btn-sm" onClick={() => setLaunch(w)}><Play size={14} /> ابدأ نشاطًا</button>
                    <Link href={`/teacher/worksheet/?id=${w.id}`} className="btn-ghost btn-sm"><Pencil size={14} /> تعديل</Link>
                    <span className="flex-1" />
                    <button className="icon-btn" onClick={() => duplicate(w)} aria-label="نسخ" title="نسخ"><Copy size={16} /></button>
                    <button className="icon-btn hover:text-danger" onClick={() => remove(w)} aria-label="حذف" title="حذف"><Trash2 size={16} /></button>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : sessions.length === 0 ? (
          <div className="panel p-12 text-center text-muted">لم تبدأ أي نشاط بعد. تُحفظ هنا كل الأنشطة ونتائجها.</div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface2 text-start">
                <tr>
                  {['النشاط', 'الرمز', 'النمط', 'المشاركون', 'التاريخ', 'الحالة', ''].map((h) => <th key={h} className="p-3 text-start font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t border-line hover:bg-surface2/40">
                    <td className="p-3 font-semibold"><Link href={`/teacher/session/?id=${s.id}`} className="hover:text-primary hover:underline">{s.title}</Link></td>
                    <td className="p-3 font-mono tracking-widest" dir="ltr">{s.code}</td>
                    <td className="p-3">{MODE_LABEL[s.mode]}</td>
                    <td className="p-3"><Users size={14} className="me-1 inline text-muted" />{s.participants?.[0]?.count ?? 0}</td>
                    <td className="p-3 text-muted">{fmtDate(s.created_at)}</td>
                    <td className="p-3">{s.status === 'live' ? <span className="chip bg-success/15 text-success">جارٍ</span> : <span className="chip bg-surface2 text-muted">منتهٍ</span>}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Link href={`/teacher/session/?id=${s.id}`} className="btn-outline btn-sm">فتح</Link>
                        <button className="icon-btn hover:text-danger" onClick={() => removeSession(s)} aria-label="حذف النشاط"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <LaunchModal ws={launch} open={!!launch} onClose={() => setLaunch(null)} />
      {toast.node}
    </>
  );
}
