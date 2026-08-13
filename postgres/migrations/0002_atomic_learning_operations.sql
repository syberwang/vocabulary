create or replace function assign_daily_course_transaction(
  p_requested_course_id text,
  p_local_date date
)
returns jsonb
language plpgsql
as $$
declare
  v_course_id text;
  v_carried_from date;
  v_assignment daily_course_assignments%rowtype;
begin
  select * into v_assignment from daily_course_assignments where local_date = p_local_date;
  if found then return to_jsonb(v_assignment); end if;

  select course_id into v_course_id
  from course_progress
  where status = 'learning'
  order by started_at nulls last
  limit 1;
  v_course_id := coalesce(v_course_id, p_requested_course_id);

  if not exists (
    select 1 from courses c
    where c.id = v_course_id
      and exists (
        select 1 from vocabulary_entries v
        where v.course_id = c.id and v.content_status = 'approved'
      )
  ) then
    raise exception 'Invalid or unpublished course';
  end if;

  select max(local_date) into v_carried_from
  from daily_course_assignments
  where course_id = v_course_id and local_date < p_local_date and completed_at is null;

  insert into daily_course_assignments (local_date, course_id, carried_from)
  values (p_local_date, v_course_id, v_carried_from)
  on conflict (local_date) do nothing;

  select * into v_assignment from daily_course_assignments where local_date = p_local_date;

  insert into course_progress (course_id, status, mastered_entry_ids, started_at)
  values (v_course_id, 'learning', '[]'::jsonb, now())
  on conflict (course_id) do nothing;

  return to_jsonb(v_assignment);
end;
$$;

create or replace function submit_review_attempt_transaction(
  p_attempt_id uuid,
  p_entry_id text,
  p_course_id text,
  p_mode review_mode,
  p_rating review_rating,
  p_answer text,
  p_expected text,
  p_is_primary boolean,
  p_updates_schedule boolean,
  p_expected_reps integer,
  p_expected_last_review timestamptz,
  p_due timestamptz,
  p_stability double precision,
  p_difficulty double precision,
  p_elapsed_days integer,
  p_scheduled_days integer,
  p_learning_steps integer,
  p_reps integer,
  p_lapses integer,
  p_state integer,
  p_last_review timestamptz
)
returns jsonb
language plpgsql
as $$
declare
  v_inserted integer;
  v_card_exists boolean := false;
  v_card_reps integer;
  v_card_last_review timestamptz;
  v_mastered jsonb;
  v_total integer;
  v_mastered_total integer;
  v_course_status course_status;
  v_ratings text[];
  v_rating_count integer;
  v_difficult_count integer;
  v_recent_three_strong boolean := false;
  v_add_automatic boolean := false;
  v_release_automatic boolean := false;
  v_was_automatic boolean := false;
  v_automatic boolean := false;
begin
  if not exists (
    select 1 from vocabulary_entries
    where id = p_entry_id and course_id = p_course_id and content_status = 'approved'
  ) then
    raise exception 'Invalid or unpublished vocabulary entry';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_entry_id, 0));
  if p_updates_schedule then
    select reps, last_review into v_card_reps, v_card_last_review
    from card_states where entry_id = p_entry_id for update;
    v_card_exists := found;
    if (v_card_exists and (v_card_reps <> p_expected_reps or v_card_last_review is distinct from p_expected_last_review))
      or (not v_card_exists and (p_expected_reps <> 0 or p_expected_last_review is not null)) then
      raise exception 'Card state changed; retry the review' using errcode = '40001';
    end if;
  end if;

  insert into review_attempts (
    id, entry_id, course_id, mode, rating, answer, expected, is_primary, updates_schedule
  ) values (
    p_attempt_id, p_entry_id, p_course_id, p_mode, p_rating,
    p_answer, p_expected, p_is_primary, p_updates_schedule
  ) on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return jsonb_build_object('duplicate', true); end if;

  if p_updates_schedule then
    insert into card_states (
      entry_id, due, stability, difficulty, elapsed_days, scheduled_days,
      learning_steps, reps, lapses, state, last_review, updated_at
    ) values (
      p_entry_id, p_due, p_stability, p_difficulty, p_elapsed_days,
      p_scheduled_days, p_learning_steps, p_reps, p_lapses, p_state, p_last_review, now()
    ) on conflict (entry_id) do update set
      due = excluded.due,
      stability = excluded.stability,
      difficulty = excluded.difficulty,
      elapsed_days = excluded.elapsed_days,
      scheduled_days = excluded.scheduled_days,
      learning_steps = excluded.learning_steps,
      reps = excluded.reps,
      lapses = excluded.lapses,
      state = excluded.state,
      last_review = excluded.last_review,
      updated_at = now();
  end if;

  if p_rating in ('good', 'easy') then
    insert into course_progress (course_id, status, mastered_entry_ids, started_at)
    values (p_course_id, 'learning', jsonb_build_array(p_entry_id), now())
    on conflict (course_id) do nothing;

    select mastered_entry_ids into v_mastered
    from course_progress where course_id = p_course_id for update;
    v_mastered := coalesce(v_mastered, '[]'::jsonb);
    if not (v_mastered ? p_entry_id) then
      v_mastered := v_mastered || jsonb_build_array(p_entry_id);
    end if;

    select count(*) into v_total
    from vocabulary_entries
    where course_id = p_course_id and content_status = 'approved';
    select count(*) into v_mastered_total
    from vocabulary_entries
    where course_id = p_course_id and content_status = 'approved' and v_mastered ? id;
    v_course_status := case
      when v_total > 0 and v_mastered_total >= v_total then 'learned'
      else 'learning'
    end;

    update course_progress set
      status = v_course_status,
      mastered_entry_ids = v_mastered,
      started_at = coalesce(started_at, now()),
      completed_at = case when v_course_status = 'learned' then coalesce(completed_at, now()) else completed_at end,
      updated_at = now()
    where course_id = p_course_id;

    if v_course_status = 'learned' then
      update daily_course_assignments
      set completed_at = coalesce(completed_at, now())
      where course_id = p_course_id and completed_at is null;
    end if;
  end if;

  select coalesce(automatic, false) into v_was_automatic
  from hard_word_flags where entry_id = p_entry_id;
  v_was_automatic := coalesce(v_was_automatic, false);

  select array_agg(recent.rating::text order by recent.created_at desc, recent.id desc)
  into v_ratings
  from (
    select id, rating, created_at
    from review_attempts
    where entry_id = p_entry_id and is_primary = true
    order by created_at desc, id desc
    limit 10
  ) recent;
  v_rating_count := coalesce(array_length(v_ratings, 1), 0);
  select count(*) into v_difficult_count
  from unnest(coalesce(v_ratings, array[]::text[])) as values_table(rating_value)
  where rating_value in ('again', 'hard');
  if v_rating_count >= 3 then
    v_recent_three_strong := v_ratings[1] in ('good', 'easy')
      and v_ratings[2] in ('good', 'easy')
      and v_ratings[3] in ('good', 'easy');
  end if;
  v_add_automatic := (v_rating_count >= 2 and v_ratings[1] = 'again' and v_ratings[2] = 'again')
    or (v_rating_count >= 5 and v_difficult_count::double precision / v_rating_count >= 0.4);
  v_release_automatic := v_rating_count >= 5
    and v_difficult_count::double precision / v_rating_count <= 0.2
    and v_recent_three_strong;
  v_automatic := v_add_automatic or (v_was_automatic and not v_release_automatic);

  if v_automatic then
    insert into hard_word_flags (entry_id, manual, automatic, updated_at)
    values (p_entry_id, false, true, now())
    on conflict (entry_id) do update set automatic = true, updated_at = now();
  else
    update hard_word_flags set automatic = false, updated_at = now()
    where entry_id = p_entry_id and manual = true;
    delete from hard_word_flags where entry_id = p_entry_id and manual = false;
  end if;

  return jsonb_build_object(
    'duplicate', false,
    'automaticHard', v_automatic,
    'courseStatus', v_course_status,
    'masteredEntryIds', v_mastered
  );
end;
$$;
