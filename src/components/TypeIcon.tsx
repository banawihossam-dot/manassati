import { AlignRight, BookOpen, CheckCircle2, FileText, Image as ImageIcon, Lightbulb, Link2, ListChecks, ListOrdered, Move, Network, Table, TextCursorInput, Type } from 'lucide-react';
import type { QType } from '@/lib/questions';

const ICONS: Record<QType, any> = {
  mcq: ListChecks, tf: CheckCircle2, short: Type, essay: AlignRight, fill: TextCursorInput, match: Link2,
  order: ListOrdered, drag: Move, image: ImageIcon, long: FileText, table: Table, cmap: Network,
  brainstorm: Lightbulb, content: BookOpen,
};

export default function TypeIcon({ type, size = 18, className }: { type: QType; size?: number; className?: string }) {
  const I = ICONS[type] || Type;
  return <I size={size} className={className} aria-hidden="true" />;
}
