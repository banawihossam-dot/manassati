'use client';
import { Loader2, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { errorText, supabase } from '@/lib/supabase';

export default function JoinForm({ initialCode = '' }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    try { setName(localStorage.getItem('student-name') || ''); } catch {}
  }, []);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const c = code.trim().toUpperCase();
    if (c.length < 4) return setErr('اكتب رمز ورقة العمل كما أعطاك إياه المعلم.');
    if (name.trim().length < 2) return setErr('اكتب اسمك (حرفان على الأقل).');
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const u: any = data.session?.user;
      let prev = '';
      try { prev = localStorage.getItem('student-name') || ''; } catch {}
      // على الأجهزة المشتركة: اسم مختلف يعني طالبًا آخر، فنبدأ له هوية جديدة
      if (u?.is_anonymous && prev.trim() !== name.trim()) {
        await supabase.auth.signOut();
      }
      const { data: again } = await supabase.auth.getSession();
      if (!again.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
      }
      const { data: sid, error } = await supabase.rpc('join_session', { p_code: c, p_name: name.trim() });
      if (error) throw error;
      try { localStorage.setItem('student-name', name.trim()); } catch {}
      router.push(`/s/?id=${sid}`);
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={join} className="space-y-4">
      <div>
        <label htmlFor="code" className="label">رمز ورقة العمل</label>
        <input
          id="code" dir="ltr" autoComplete="off" autoCapitalize="characters" maxLength={8}
          className="input h-16 text-center text-3xl font-bold tracking-[0.4em] uppercase"
          value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())} placeholder="ABC123"
        />
      </div>
      <div>
        <label htmlFor="name" className="label">اسمك</label>
        <input id="name" className="input h-12 text-lg" value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الأول واسم العائلة" maxLength={60} />
      </div>
      {err && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{err}</p>}
      <button className="btn-primary h-12 w-full text-base" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />} ادخل إلى ورقة العمل
      </button>
    </form>
  );
}
