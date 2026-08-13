alter table public.vocabulary_entries
  add column if not exists example_source jsonb,
  add column if not exists content_risk text
    check (content_risk is null or content_risk in ('low', 'medium', 'high'));

comment on column public.vocabulary_entries.example_source is
  '例句来源。当前仅允许人工讲义校订或本地 Codex 课程草稿，不包含第三方语料。';

comment on column public.vocabulary_entries.content_risk is
  '内容风险分级；high/medium 内容在管理员后台复核后再改为 approved。';
