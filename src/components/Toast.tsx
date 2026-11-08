'use client';
import { useCallback, useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const show = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    setMsg({ text, tone });
    setTimeout(() => setMsg(null), 3200);
  }, []);
  const node = msg ? (
    <div role="status" className={`pop fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lift ${msg.tone === 'ok' ? 'bg-ink text-bg' : 'bg-danger text-white'}`}>
      {msg.text}
    </div>
  ) : null;
  return { show, node };
}
