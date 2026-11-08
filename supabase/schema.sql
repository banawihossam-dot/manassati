-- =====================================================================
--  منصتي – أوراق العمل التفاعلية الجماعية
--  شغّل هذا الملف مرة واحدة كاملًا في: Supabase > SQL Editor > New query
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- الجداول ----------

create table if not exists public.worksheets (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'ورقة عمل جديدة',
  objective text not null default '',
  subject text not null default '',
  grade text not null default '',
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  worksheet_id uuid references public.worksheets(id) on delete set null,
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null unique,
  title text not null default '',
  subject text not null default '',
  grade text not null default '',
  objective text not null default '',
  questions_public jsonb not null default '[]'::jsonb,   -- الأسئلة بدون الإجابات
  mode text not null default 'individual' check (mode in ('individual','shared','group')),
  group_size int not null default 4,
  auto_groups boolean not null default true,
  show_peers boolean not null default false,
  chat_enabled boolean not null default false,
  show_results boolean not null default true,
  show_answers boolean not null default false,
  status text not null default 'live' check (status in ('live','ended')),
  results_released boolean not null default false,
  reveal jsonb,                                         -- الإجابات الصحيحة تُكشف بعد الانتهاء فقط
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- نسخة الإجابات النموذجية الخاصة بالجلسة (للمعلم فقط)
create table if not exists public.session_keys (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  questions jsonb not null
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  name text not null,
  color int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  name text not null,
  group_id uuid references public.groups(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (session_id, user_id)
);

-- scope_key: معرّف الطالب (فردي) أو معرّف المجموعة أو 'all' (مساحة مشتركة)
-- part_key: '' للإجابة الكاملة، أو خلية جدول / عقدة خريطة / بطاقة عصف ذهني
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  question_id text not null,
  scope_key text not null,
  part_key text not null default '',
  value jsonb,
  author_id uuid not null default auth.uid(),
  author_name text not null default '',
  updated_at timestamptz not null default now(),
  unique (session_id, question_id, scope_key, part_key)
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  question_id text not null,            -- '_overall' للدرجة النهائية والملاحظة العامة
  scope_key text not null,
  score numeric,
  max_score numeric,
  feedback text,
  source text,                          -- auto | manual | ai
  ai_score numeric,
  ai_reason text,
  ai_feedback text,
  ai_pending boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (session_id, question_id, scope_key)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  name text not null,
  body text not null check (char_length(body) between 1 and 500),
  is_teacher boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists answers_session_idx on public.answers(session_id);
create index if not exists participants_session_idx on public.participants(session_id);
create index if not exists grades_session_idx on public.grades(session_id);
create index if not exists messages_session_idx on public.messages(session_id);

-- ---------- دوال مساعدة للصلاحيات ----------

create or replace function public.is_anon() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

create or replace function public.is_teacher_of(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from sessions where id = sid and teacher_id = auth.uid())
$$;

create or replace function public.is_participant(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from participants where session_id = sid and user_id = auth.uid())
$$;

-- هل هذا النطاق هو نطاق الطالب الحالي (إجابته أو مجموعته أو المساحة المشتركة)؟
create or replace function public.is_my_scope(sid uuid, scope text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from sessions s
    join participants p on p.session_id = s.id and p.user_id = auth.uid()
    where s.id = sid and (
      (s.mode = 'individual' and scope = auth.uid()::text) or
      (s.mode = 'shared' and scope = 'all') or
      (s.mode = 'group' and p.group_id is not null and scope = p.group_id::text)
    ))
$$;

create or replace function public.can_write_scope(sid uuid, scope text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_my_scope(sid, scope)
     and exists(select 1 from sessions where id = sid and status = 'live')
$$;

create or replace function public.can_read_scope(sid uuid, scope text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_teacher_of(sid)
      or public.is_my_scope(sid, scope)
      or (public.is_participant(sid) and exists(select 1 from sessions where id = sid and show_peers))
$$;

create or replace function public.peers_visible(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from sessions where id = sid and (mode <> 'individual' or show_peers))
$$;

-- ---------- انضمام الطالب بالاسم والرمز ----------

create or replace function public.join_session(p_code text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s sessions;
  gid uuid;
  gcount int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'name_required'; end if;

  select * into s from sessions where code = upper(trim(p_code));
  if not found then raise exception 'code_not_found'; end if;

  if exists(select 1 from participants where session_id = s.id and user_id = auth.uid()) then
    update participants set name = left(trim(p_name), 60) where session_id = s.id and user_id = auth.uid();
    return s.id;
  end if;

  if s.status <> 'live' then raise exception 'session_ended'; end if;

  if s.mode = 'group' and s.auto_groups then
    select g.id into gid
    from groups g left join participants p on p.group_id = g.id
    where g.session_id = s.id
    group by g.id, g.created_at
    having count(p.id) < greatest(s.group_size, 1)
    order by count(p.id), g.created_at
    limit 1;

    if gid is null then
      select count(*) into gcount from groups where session_id = s.id;
      insert into groups(session_id, name, color)
      values (s.id, 'المجموعة ' || (gcount + 1), gcount)
      returning id into gid;
    end if;
  end if;

  insert into participants(session_id, user_id, name, group_id)
  values (s.id, auth.uid(), left(trim(p_name), 60), gid);
  return s.id;
end $$;

grant execute on function public.join_session(text, text) to authenticated;

-- ---------- تفعيل الحماية (RLS) ----------

alter table public.worksheets enable row level security;
alter table public.sessions enable row level security;
alter table public.session_keys enable row level security;
alter table public.groups enable row level security;
alter table public.participants enable row level security;
alter table public.answers enable row level security;
alter table public.grades enable row level security;
alter table public.messages enable row level security;

-- أوراق العمل: للمعلم صاحبها فقط
drop policy if exists ws_owner on public.worksheets;
create policy ws_owner on public.worksheets for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and not public.is_anon());

-- الجلسات
drop policy if exists ses_teacher on public.sessions;
create policy ses_teacher on public.sessions for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and not public.is_anon());
drop policy if exists ses_student_read on public.sessions;
create policy ses_student_read on public.sessions for select
  using (public.is_participant(id));

-- مفاتيح الإجابات: للمعلم فقط
drop policy if exists keys_teacher on public.session_keys;
create policy keys_teacher on public.session_keys for all
  using (public.is_teacher_of(session_id))
  with check (public.is_teacher_of(session_id));

-- المجموعات
drop policy if exists grp_teacher on public.groups;
create policy grp_teacher on public.groups for all
  using (public.is_teacher_of(session_id))
  with check (public.is_teacher_of(session_id));
drop policy if exists grp_student_read on public.groups;
create policy grp_student_read on public.groups for select
  using (public.is_participant(session_id));

-- المشاركون: الطالب يرى نفسه، ويرى زملاءه فقط إذا سمح المعلم أو كان العمل جماعيًا
drop policy if exists par_teacher on public.participants;
create policy par_teacher on public.participants for all
  using (public.is_teacher_of(session_id))
  with check (public.is_teacher_of(session_id));
drop policy if exists par_student_read on public.participants;
create policy par_student_read on public.participants for select
  using (user_id = auth.uid() or (public.is_participant(session_id) and public.peers_visible(session_id)));

-- الإجابات
drop policy if exists ans_read on public.answers;
create policy ans_read on public.answers for select
  using (public.can_read_scope(session_id, scope_key));
drop policy if exists ans_insert on public.answers;
create policy ans_insert on public.answers for insert
  with check (author_id = auth.uid() and public.can_write_scope(session_id, scope_key));
drop policy if exists ans_update on public.answers;
create policy ans_update on public.answers for update
  using (public.can_write_scope(session_id, scope_key))
  with check (author_id = auth.uid() and public.can_write_scope(session_id, scope_key));
drop policy if exists ans_delete on public.answers;
create policy ans_delete on public.answers for delete
  using ((author_id = auth.uid() and public.can_write_scope(session_id, scope_key)) or public.is_teacher_of(session_id));

-- الدرجات: المعلم يكتب، والطالب يقرأ نتيجته فقط بعد نشر النتائج
drop policy if exists gr_teacher on public.grades;
create policy gr_teacher on public.grades for all
  using (public.is_teacher_of(session_id))
  with check (public.is_teacher_of(session_id));
drop policy if exists gr_student_read on public.grades;
create policy gr_student_read on public.grades for select
  using (public.is_my_scope(session_id, scope_key)
         and exists(select 1 from sessions where id = session_id and results_released and show_results));

-- المحادثة
drop policy if exists msg_read on public.messages;
create policy msg_read on public.messages for select
  using (public.is_teacher_of(session_id) or public.is_participant(session_id));
drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert
  with check (
    user_id = auth.uid() and (
      public.is_teacher_of(session_id) or (
        public.is_participant(session_id) and is_teacher = false and
        exists(select 1 from sessions where id = session_id and chat_enabled and status = 'live')
      )
    ));
drop policy if exists msg_delete on public.messages;
create policy msg_delete on public.messages for delete
  using (public.is_teacher_of(session_id));

-- ---------- المزامنة الفورية ----------
do $$
declare t text;
begin
  foreach t in array array['sessions','groups','participants','answers','grades','messages'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- تخزين الصور والفيديو ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select using (bucket_id = 'media');
drop policy if exists media_upload on storage.objects;
create policy media_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and not public.is_anon());
drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and owner = auth.uid());

-- ---------- تشديد صلاحيات الدوال ----------
alter function public.is_anon() set search_path = public;
revoke execute on function public.is_teacher_of(uuid) from public, anon;
revoke execute on function public.is_participant(uuid) from public, anon;
revoke execute on function public.is_my_scope(uuid, text) from public, anon;
revoke execute on function public.can_write_scope(uuid, text) from public, anon;
revoke execute on function public.can_read_scope(uuid, text) from public, anon;
revoke execute on function public.peers_visible(uuid) from public, anon;
revoke execute on function public.join_session(text, text) from public, anon;
grant execute on function public.is_teacher_of(uuid) to authenticated;
grant execute on function public.is_participant(uuid) to authenticated;
grant execute on function public.is_my_scope(uuid, text) to authenticated;
grant execute on function public.can_write_scope(uuid, text) to authenticated;
grant execute on function public.can_read_scope(uuid, text) to authenticated;
grant execute on function public.peers_visible(uuid) to authenticated;
grant execute on function public.join_session(text, text) to authenticated;
