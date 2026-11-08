'use client';
import { useEffect, useState } from 'react';

/** يقرأ قيمة من رابط الصفحة (?id=...) بعد التحميل في المتصفح */
export function useQueryParam(name: string) {
  const [v, setV] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setV(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  return v;
}
