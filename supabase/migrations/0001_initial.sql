create extension if not exists pgcrypto;

create type public.app_level as enum ('A1', 'A2');
create type public.course_status as enum ('not_started', 'learning', 'learned');
create type public.content_status as enum ('draft', 'approved', 'needs_review', 'quarantined');
create type public.review_mode as enum ('zh_to_fr', 'fr_to_zh', 'audio_to_fr');
create type public.review_rating as enum ('again', 'hard', 'good', 'easy');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  timezone text not null default 'America/Toronto',
  selected_level public.app_level not null default 'A1',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id text primary key,
  level public.app_level not null,
  unit_no integer not null check (unit_no between 1 and 9),
  lesson_no integer not null check (lesson_no between 1 and 36),
  code text not null,
  title text not null,
  sort_order integer not null,
  word_count integer not null default 0,
  source_start_page integer not null,
  source_end_page integer not null,
  unique (level, code)
);

create table public.vocabulary_entries (
  id text primary key,
  source_row integer not null unique,
  course_id text not null references public.courses(id) on delete cascade,
  word text not null,
  part_of_speech text not null,
  translation_zh text not null,
  accepted_answers jsonb not null default '[]'::jsonb,
  example_fr text not null,
  example_zh text not null,
  usage_note text not null,
  source_page integer not null,
  source_method text not null,
  raw_values jsonb not null,
  content_status public.content_status not null default 'needs_review',
  content_version integer not null default 1,
  updated_at timestamptz not null default now()
);
create index vocabulary_entries_course_idx on public.vocabulary_entries(course_id);
create index vocabulary_entries_status_idx on public.vocabulary_entries(content_status);

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  entry_id text not null references public.vocabulary_entries(id) on delete cascade,
  editor_id uuid not null references auth.users(id),
  before_values jsonb not null,
  after_values jsonb not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.daily_course_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  course_id text not null references public.courses(id),
  carried_from date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);

create table public.course_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  status public.course_status not null default 'not_started',
  mastered_entry_ids jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table public.card_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null references public.vocabulary_entries(id) on delete cascade,
  due timestamptz not null,
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state integer not null default 0,
  last_review timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);
create index card_states_due_idx on public.card_states(user_id, due);

create table public.review_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null references public.vocabulary_entries(id) on delete cascade,
  course_id text not null references public.courses(id),
  mode public.review_mode not null,
  rating public.review_rating not null,
  answer text,
  expected text,
  is_primary boolean not null default true,
  updates_schedule boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, id)
);
create index review_attempts_hard_idx on public.review_attempts(user_id, entry_id, created_at desc);

create table public.hard_word_flags (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null references public.vocabulary_entries(id) on delete cascade,
  manual boolean not null default false,
  automatic boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_id),
  check (manual or automatic)
);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.vocabulary_entries enable row level security;
alter table public.content_revisions enable row level security;
alter table public.daily_course_assignments enable row level security;
alter table public.course_progress enable row level security;
alter table public.card_states enable row level security;
alter table public.review_attempts enable row level security;
alter table public.hard_word_flags enable row level security;

create policy "authenticated users read courses" on public.courses for select to authenticated using (true);
create policy "authenticated users read approved content" on public.vocabulary_entries for select to authenticated using (
  content_status in ('approved', 'needs_review')
);
create policy "users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "users own daily assignments" on public.daily_course_assignments for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own course progress" on public.course_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own card states" on public.card_states for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own review attempts" on public.review_attempts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own hard flags" on public.hard_word_flags for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admins read revisions" on public.content_revisions for select to authenticated using ((select is_admin from public.profiles where id = auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'name');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
