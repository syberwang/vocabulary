create extension if not exists pgcrypto;

create type app_level as enum ('A1', 'A2');
create type course_status as enum ('not_started', 'learning', 'learned');
create type content_status as enum ('draft', 'approved', 'needs_review', 'quarantined');
create type review_mode as enum ('zh_to_fr', 'fr_to_zh', 'audio_to_fr');
create type review_rating as enum ('again', 'hard', 'good', 'easy');

create table app_settings (
  id smallint primary key default 1 check (id = 1),
  timezone text not null default 'America/Toronto',
  selected_level app_level not null default 'A1',
  updated_at timestamptz not null default now()
);
insert into app_settings (id) values (1);

create table courses (
  id text primary key,
  level app_level not null,
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

create table vocabulary_entries (
  id text primary key,
  source_row integer not null unique,
  course_id text not null references courses(id) on delete cascade,
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
  content_status content_status not null default 'needs_review',
  content_version integer not null default 1,
  example_source jsonb,
  content_risk text check (content_risk is null or content_risk in ('low', 'medium', 'high')),
  content_review jsonb,
  updated_at timestamptz not null default now()
);
create index vocabulary_entries_course_idx on vocabulary_entries(course_id);
create index vocabulary_entries_status_idx on vocabulary_entries(content_status);

create table content_revisions (
  id uuid primary key default gen_random_uuid(),
  entry_id text not null references vocabulary_entries(id) on delete cascade,
  editor text not null default 'owner',
  before_values jsonb not null,
  after_values jsonb not null,
  note text,
  created_at timestamptz not null default now()
);

create table daily_course_assignments (
  id uuid primary key default gen_random_uuid(),
  local_date date not null unique,
  course_id text not null references courses(id),
  carried_from date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table course_progress (
  course_id text primary key references courses(id) on delete cascade,
  status course_status not null default 'not_started',
  mastered_entry_ids jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table card_states (
  entry_id text primary key references vocabulary_entries(id) on delete cascade,
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
  updated_at timestamptz not null default now()
);
create index card_states_due_idx on card_states(due);

create table review_attempts (
  id uuid primary key,
  entry_id text not null references vocabulary_entries(id) on delete cascade,
  course_id text not null references courses(id),
  mode review_mode not null,
  rating review_rating not null,
  answer text,
  expected text,
  is_primary boolean not null default true,
  updates_schedule boolean not null default false,
  created_at timestamptz not null default now()
);
create index review_attempts_hard_idx on review_attempts(entry_id, created_at desc);

create table hard_word_flags (
  entry_id text primary key references vocabulary_entries(id) on delete cascade,
  manual boolean not null default false,
  automatic boolean not null default false,
  updated_at timestamptz not null default now(),
  check (manual or automatic)
);

comment on column vocabulary_entries.example_source is
  '例句来源：人工讲义校订或本地 Codex 课程内容生成。';
comment on column vocabulary_entries.content_risk is
  '内容风险分级；medium/high 内容需人工复核后才能批准。';
comment on column vocabulary_entries.content_review is
  '人工审核记录和审核时内容哈希；内容变化后必须重新审核。';
