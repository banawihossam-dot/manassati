'use client';
import { MessageCircle, Send, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { errorText, supabase } from '@/lib/supabase';
import { cls, fmtTime } from '@/lib/utils';

interface Msg { id: string; session_id: string; user_id: string; name: string; body: string; is_teacher: boolean; created_at: string }

export default function Chat({ sessionId, enabled, myName, myId, isTeacher }: {
  sessionId: string; enabled: boolean; myName: string; myId: string; isTeacher?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [unread, setUnread] = useState(0);
  const [err, setErr] = useState('');
  const openRef = useRef(open);
  const listRef = useRef<HTMLDivElement>(null);
  openRef.current = open;

  useEffect(() => {
    let alive = true;
    supabase.from('messages').select('*').eq('session_id', sessionId).order('created_at').limit(300).then(({ data }) => alive && setMsgs((data as any) || []));
    const ch = supabase.channel(`chat-${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `session_id=eq.${sessionId}` }, (p: any) => {
        setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new]));
        if (!openRef.current) setUnread((u) => u + 1);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p: any) => {
        setMsgs((m) => m.filter((x) => x.id !== p.old?.id));
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [sessionId]);

  useEffect(() => {
    if (open) { setUnread(0); setTimeout(() => listRef.current?.scrollTo({ top: 1e9 }), 30); }
  }, [open, msgs.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim().slice(0, 500);
    if (!body) return;
    setText(''); setErr('');
    const { error } = await supabase.from('messages').insert({ session_id: sessionId, name: myName, body, is_teacher: !!isTeacher });
    if (error) { setErr(errorText(error)); setText(body); }
  };

  if (!enabled && !isTeacher && !msgs.length) return null;

  return (
    <>
      <button onClick={() => setOpen(!open)} className="no-print fixed bottom-5 start-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-ink shadow-lift" aria-label="المحادثة">
        {open ? <X /> : <MessageCircle />}
        {unread > 0 && !open && <span className="absolute -top-1 -end-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-[#2a1a00]">{unread}</span>}
      </button>
      {open && (
        <section className="pop no-print fixed bottom-24 start-5 z-40 flex h-[70vh] max-h-[520px] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lift" aria-label="المحادثة الجماعية">
          <header className="border-b border-line px-4 py-3">
            <p className="font-bold">المحادثة الجماعية</p>
            {!enabled && <p className="text-xs text-muted">المحادثة متوقفة حاليًا{isTeacher ? ' للطلاب' : ''}.</p>}
          </header>
          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {msgs.length === 0 && <p className="py-8 text-center text-sm text-muted">لا رسائل بعد.</p>}
            {msgs.map((m) => {
              const mine = m.user_id === myId;
              return (
                <div key={m.id} className={cls('group flex flex-col', mine ? 'items-start' : 'items-end')}>
                  <span className="mb-0.5 text-[11px] text-muted">{m.is_teacher ? `${m.name} (المعلم)` : mine ? 'أنت' : m.name} · {fmtTime(m.created_at)}</span>
                  <div className="flex items-center gap-1">
                    <p className={cls('max-w-[260px] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm', m.is_teacher ? 'bg-accent/25' : mine ? 'bg-primary text-primary-ink' : 'bg-surface2')}>{m.body}</p>
                    {isTeacher && (
                      <button className="icon-btn h-7 w-7 opacity-0 group-hover:opacity-100" aria-label="حذف الرسالة" onClick={() => supabase.from('messages').delete().eq('id', m.id).then(() => setMsgs((x) => x.filter((y) => y.id !== m.id)))}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {(enabled || isTeacher) && (
            <form onSubmit={send} className="flex gap-2 border-t border-line p-2">
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب رسالة…" maxLength={500} aria-label="رسالة" />
              <button className="btn-primary px-3" aria-label="إرسال" disabled={!text.trim()}><Send size={16} className="-scale-x-100" /></button>
            </form>
          )}
          {err && <p className="px-3 pb-2 text-xs text-danger">{err}</p>}
        </section>
      )}
    </>
  );
}
