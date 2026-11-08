import { gradable, type Question } from '@/lib/questions';
import type { AnswerRow, computeResults, Participant, Session } from '@/lib/results';
import { fmtDate } from '@/lib/utils';

type Data = ReturnType<typeof computeResults>;

export async function exportExcel(session: Session, qs: Question[], data: Data, participants: Participant[], answers: AnswerRow[]) {
  const XLSX = await import('xlsx');
  const gq = gradable(qs);
  const who = session.mode === 'group' ? 'المجموعة' : session.mode === 'shared' ? 'المساحة' : 'الطالب';

  const summary = data.results.map((r) => {
    const row: Record<string, any> = { [who]: r.scope.name };
    if (r.scope.members) row['الأعضاء'] = r.scope.members.join('، ');
    gq.forEach((q, i) => (row[`س${i + 1} (${q.points})`] = r.perQ[q.id].score ?? 'بحاجة لتصحيح'));
    row['المجموع'] = r.finalScore;
    row['الدرجة الكاملة'] = r.max;
    row['النسبة %'] = r.pct;
    row['ملاحظة عامة'] = r.overall?.feedback || '';
    return row;
  });

  const detail: Record<string, any>[] = [];
  data.results.forEach((r) => gq.forEach((q, i) => {
    const p = r.perQ[q.id];
    detail.push({ [who]: r.scope.name, 'السؤال': `س${i + 1}`, 'نص السؤال': q.prompt || q.fillText || '', 'الإجابة': p.text, 'الدرجة': p.score ?? '', 'من': q.points, 'الملاحظة': p.grade?.feedback || '' });
  }));

  const questions = data.qStats.map((s, i) => ({
    'السؤال': `س${i + 1}`, 'النص': s.q.prompt || s.q.fillText || '', 'الدرجة': s.q.points,
    'عدد من أجاب': s.answered, 'متوسط الدرجة': s.avg, 'نسبة الإتقان %': Math.round(s.ratio * 100),
  }));

  const contrib: Record<string, number> = {};
  answers.forEach((a) => (contrib[a.author_id] = (contrib[a.author_id] || 0) + 1));
  const people = participants.map((p) => ({ 'الطالب': p.name, 'عدد المشاركات': contrib[p.user_id] || 0, 'وقت الانضمام': new Date(p.joined_at).toLocaleString('ar-QA') }));

  const wb = XLSX.utils.book_new();
  const add = (rows: any[], name: string) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'لا توجد بيانات' }]);
    (ws as any)['!cols'] = Object.keys(rows[0] || { a: 1 }).map((k) => ({ wch: Math.min(60, Math.max(10, k.length + 4)) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add(summary, 'النتائج');
  add(detail, 'الإجابات التفصيلية');
  add(questions, 'تحليل الأسئلة');
  add(people, 'المشاركون');
  (wb as any).Workbook = { Views: [{ RTL: true }] };
  const safe = `${session.title} - ${session.code} - ${fmtDate(session.created_at)}`.replace(/[\\/:*?"<>|]/g, '-');
  XLSX.writeFile(wb, `${safe}.xlsx`);
}
