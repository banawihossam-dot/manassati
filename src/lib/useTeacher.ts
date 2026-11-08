'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getTeacher, supabase } from './supabase';

export function useTeacher() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    getTeacher().then((u) => {
      if (!alive) return;
      if (!u) router.replace('/login');
      else { setUser(u); setReady(true); }
    });
    return () => { alive = false; };
  }, [router]);
  const signOut = async () => { await supabase.auth.signOut(); router.replace('/login'); };
  const displayName = user?.user_metadata?.full_name || user?.email || 'المعلم';
  return { user, ready, signOut, displayName };
}
