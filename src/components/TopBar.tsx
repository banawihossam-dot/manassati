'use client';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

export default function TopBar({ children, logoHref = '/' }: { children?: React.ReactNode; logoHref?: string }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Logo href={logoHref} />
        <div className="flex flex-1 items-center justify-end gap-2">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
