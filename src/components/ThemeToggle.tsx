'use client';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  };
  return (
    <button className="icon-btn" onClick={toggle} aria-label={dark ? 'الوضع النهاري' : 'الوضع الليلي'} title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
