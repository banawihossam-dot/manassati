'use client';
import { ArrowRight, Check, Copy, Loader2, MonitorUp, Radio, Square, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Chat from '@/components/Chat';
import Modal from '@/components/Modal';
import GradingPanel from '@/components/teacher/GradingPanel';
import LivePanel from '@/components/teacher/LivePanel';
import ResultsPanel from '@/components/teacher/ResultsPanel';
import type { Ctx } from '@/components/teacher/types';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import type { Question } from '@/lib/questions';
import { MODE_LABEL, scopesFor, type AnswerRow, type GradeRow, type Group, type Participant, type Session } from '@/lib/results';
import { errorText, supabase } from '@/lib/supabase';
import { useTeacher } from '@/lib/useTeacher';
import { BASE_PATH, cls } from '@/lib/utils';

export default function SessionMonitor({ params }: { params: { id: string } }) {
  const sid = params.id;
  const { ready, user, displayName } = useTeacher();
  const toast = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [keyQs, setKeyQs] = useState<Question[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [rows, setRows] = useState<Record<string, AnswerRow>>({});
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'live' | 'grade' | 'results'>('live');
  const [err, setErr] = useState('');
  const [projector, setProjector] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadPeople = useCallback(async () => {
    const [p, g] = await Promise.all([
      supabase.from('participants').select('*').eq('session_id', sid).order('joined_at'),
      supabase.from('groups').select('*').eq('session_id', sid).order('created_at'),
    ]);
    setParticipants((p.data as any) || []);
    setGroups((g.data as any) || []);
  }, [sid]);

  const loadAnswers = useCallback(async () => {
    const { data } = await supabase.from('answers').select('*').eq('session_id', sid);
    const m: Record<string, AnswerRow> = {};
    ((data as any as AnswerRow[]) || []).forEach((r) => (m[r.id] = r));
    setRows(m);
  }, [sid]);

  const loadGrades = useCallback(async () => {
    const { data } = await supabase.from('grades').select('*').eq('session_id', sid);
    setGrades((data as any) || []);
  }, [sid]);

  useEffect(() => {
    if (!ready) return;
    let ch: any;
    (async () => {
      const [s, k] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', sid).single(),
        supabase.from('session_keys').select('questions').eq('session_id', sid).single(),
      ]);
      if (s.error) { setErr(errorText(s.error)); return; }
      setSession(s.data as any);
      setKeyQs(((k.data as any)?.questions as Question[]) || (s.data as any).questions_public || []);
      await Promise.all([loadPeople(), loadAnswers(), loadGrades()]);

      ch = supabase.channel(`s-${sid}`, { config: { presence: { key: 'teacher' } } })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers', filter: `session_id=eq.${sid}` }, (p: any) => setRows((m) => ({ ...m, [p.new.id]: p.new })))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'answers', filter: `session_id=eq.${sid}` }, (p: any) => setRows((m) => ({ ...m, [p.new.id]: p.new })))
        // أحداث الحذف لا تقبل التصفية في Supabase، لذا نستقبلها كلها ونطابق بالمعرّف
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'answers' }, (p: any) => setRows((m) => {
          if (!p.old?.id || !m[p.old.id]) return m;
          const n = { ...m }; delete n[p.old.id]; return n;
        }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `session_id=eq.${sid}` }, loadPeople)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `session_id=eq.${sid}` }, loadPeople)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'grades', filter: `session_id=eq.${sid}` }, loadGrades)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sid}` }, (p: any) => setSession((o) => ({ ...(o as any), ...p.new })))
        .on('presence', { event: 'sync' }, () => {
          const st = ch.presenceState();
          setOnline(new Set(Object.keys(st).filter((x) => x !== 'teacher')));
        })
        .subscribe();
    })();
    const resync = () => { loadAnswers(); loadPeople(); };
    window.addEventListener('online', resync);
    return () => { if (ch) supabase.removeChannel(ch); window.removeEventListener('online', resync); };
  }, [ready, sid, loadPeople, loadAnswers, loadGrades]);

  const patchSession = async (patch: Partial<Session>) => {
    setSession((s) => ({ ...(s as any), ...patch }));
    const { error } = await supabase.from('sessions').update(patch).eq('id', sid);
    if (error) toast.show(errorText(error), 'err');
  };

  const answerList = useMemo(() => Object.values(rows), [rows]);
  const scopes = useMemo(() => (session ? scopesFor(session, participants, groups) : []), [session, participants, groups]);

  if (err) return <><TopBar logoHref="/teacher" /><p className="p-10 text-center text-danger">{err}</p></>;
  if (!session) return <><TopBar logoHref="/teacher" /><div className="flex justify-center py-24"><Loader2 className="animate-spin text-muted" /></div></>;

  const link = typeof window !== 'undefined' ? `${window.location.origin}${BASE_PATH}/j/?code=${session.code}` : `${BASE_PATH}/j/?code=${session.code}`;
  const live = session.status === 'live';
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { toast.show('انسخ الرابط يدويًا: ' + link); }
  };
  const endSession = async () => {
    if (!confirm('إنهاء النشاط؟ لن يتمكن الطلاب من تعديل إجاباتهم بعد ذلك.')) return;
    await patchSession({ status: 'ended', ended_at: new Date().toISOString() as any, reveal: session.show_answers ? keyQs : null } as any);
    toast.show('انتهى النشاط');
  };
  const reopen = () => patchSession({ status: 'live', reveal: null } as any);

  const ctx: Ctx = {
    session, keyQs, participants, groups, answers: answerList, grades, scopes, online,
    teacherId: user?.id, toast: toast.show, reloadGrades: loadGrades, reloadPeople: loadPeople, patchSession,
  };

  const toggle = (k: 'show_peers' | 'chat_enabled' | 'show_answers' | 'show_results', label: string) => (
    <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--primary))]" checked={!!session[k]} onChange={(e) => patchSession({ [k]: e.target.checked } as any)} />
      {label}
    </label>
  );

  return (
    <>
      <TopBar logoHref="/teacher">
        <span className="hidden text-sm text-muted md:inline">{displayName}</span>
      </TopBar>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Link href="/teacher" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowRight size={15} /> لوحة المعلم</Link>

        <section className="panel mb-5 grid gap-5 p-5 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {live ? <span className="chip bg-success/15 text-success"><Radio size={12} className="live-dot" /> جارٍ الآن</span> : <span className="chip bg-surface2 text-muted">منتهٍ</span>}
              <span className="chip bg-surface2">{MODE_LABEL[session.mode]}</span>
              {session.results_released && <span className="chip bg-primary/10 text-primary">النتائج منشورة</span>}
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">{session.title}</h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {toggle("show_peers", "إظهار إجابات الزملاء")}
              {toggle("chat_enabled", "المحادثة")}
              {toggle("show_results", "إظهار النتيجة للطالب")}
              {toggle("show_answers", "كشف الإجابات الصحيحة عند الانتهاء")}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 rounded-2xl bg-surface2/70 p-4 lg:min-w-[260px]">
            <span className="text-xs font-semibold text-muted">رمز الدخول</span>
            <span dir="ltr" className="text-center font-mono text-4xl font-bold tracking-[0.3em] text-primary">{session.code}</span>
            <div className="flex gap-2">
              <button className="btn-outline btn-sm flex-1" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'نُسخ' : 'نسخ الرابط'}</button>
              <button className="btn-outline btn-sm flex-1" onClick={() => setProjector(true)}><MonitorUp size={14} /> عرض للصف</button>
            </div>
            {live ? (
              <button className="btn-danger btn-sm" onClick={endSession}><Square size={14} /> إنهاء النشاط</button>
            ) : (
              <button className="btn-ghost btn-sm" onClick={reopen}><Undo2 size={14} /> إعادة فتح النشاط</button>
            )}
          </div>
        </section>

        <div className="no-print mb-5 inline-flex rounded-xl bg-surface2 p-1">
          {([['live', 'المتابعة المباشرة'], ['grade', 'التصحيح'], ['results', 'النتائج والتقارير']] as const).map(([k, l]) => (
            <button key={k} className={cls('tab', tab === k && 'tab-active')} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'live' && <LivePanel ctx={ctx} />}
        {tab === 'grade' && <GradingPanel ctx={ctx} />}
        {tab === 'results' && <ResultsPanel ctx={ctx} />}
      </main>

      {user && <Chat sessionId={sid} enabled={!!session.chat_enabled} myName={displayName} myId={user.id} isTeacher />}

      <Modal open={projector} onClose={() => setProjector(false)} title="انضموا إلى ورقة العمل" wide>
        <div className="space-y-6 py-6 text-center">
          <p className="text-xl">افتحوا الموقع واكتبوا الرمز:</p>
          <p dir="ltr" className="font-mono text-7xl font-bold tracking-[0.25em] text-primary sm:text-8xl">{session.code}</p>
          <p dir="ltr" className="break-all text-lg text-muted">{link}</p>
          <p className="text-lg"><b>{participants.length}</b> طالبًا انضموا</p>
        </div>
      </Modal>
      {toast.node}
    </>
  );
}
