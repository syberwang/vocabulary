-- Content management: levels are data, not a closed A1/A2 enum.
alter table app_settings alter column selected_level drop default;
alter table courses alter column level type text using level::text;
alter table app_settings alter column selected_level type text using selected_level::text;
alter table app_settings alter column selected_level set default 'A1';
drop type app_level;

alter table courses drop constraint if exists courses_unit_no_check;
alter table courses drop constraint if exists courses_lesson_no_check;
alter table courses add constraint courses_unit_no_positive check (unit_no >= 1);
alter table courses add constraint courses_lesson_no_positive check (lesson_no >= 1);

create table content_levels (
  code text primary key check (code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$'),
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into content_levels (code, title, sort_order)
values ('A1', 'A1 基础', 1), ('A2', 'A2 基础', 2)
on conflict (code) do nothing;

alter table courses
  add constraint courses_level_fk foreign key (level) references content_levels(code);
alter table app_settings
  add constraint app_settings_selected_level_fk foreign key (selected_level) references content_levels(code);
