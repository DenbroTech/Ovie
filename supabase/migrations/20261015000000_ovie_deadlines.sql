-- Ovie: deadlines and calendar repeats.
-- * Calendar events repeat every N weeks / months / years (repeat_every, default 1).
-- * A job's deadline can have a time, can show on the calendar (in_calendar), and can set off an alarm (remind):
--   ovie.alarms gets one alarm per such job (task_id), kept in step by a trigger and removed when the job is done
--   or deleted. The alarm rings on the wall and on the devices of the person it's for.
-- Touches only the `ovie` schema.

alter table ovie.events add column repeat_every smallint not null default 1 check (repeat_every between 1 and 52);

alter table ovie.tasks
  add column due_time    time,
  add column in_calendar boolean not null default false,
  add column remind      boolean not null default false;

alter table ovie.alarms add column task_id uuid unique references ovie.tasks(id) on delete cascade;

create or replace function ovie.complete_task(p_task_id uuid, p_by uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t ovie.tasks%rowtype;
  v_next date;
  v_today date;
  v_step interval;
  v_new uuid;
begin
  select * into t from ovie.tasks where id = p_task_id for update;
  if not found or not ovie.is_member(t.household_id) then
    raise exception 'task not found' using errcode = '42501';
  end if;
  if not ovie.member_in(t.household_id, p_by) then
    raise exception 'that person is not in this household' using errcode = '23503';
  end if;
  if t.completed_at is not null then
    return null; -- already done: retrying changes nothing
  end if;

  update ovie.tasks set completed_at = now(), completed_by = p_by where id = p_task_id;

  if t.repeat_unit is null then
    return null;
  end if;

  v_step := make_interval(
    days   => case when t.repeat_unit = 'day'   then t.repeat_every else 0 end,
    weeks  => case when t.repeat_unit = 'week'  then t.repeat_every else 0 end,
    months => case when t.repeat_unit = 'month' then t.repeat_every else 0 end);
  v_today := ovie.household_today(t.household_id);
  v_next := (t.due_on + v_step)::date;
  while v_next <= v_today loop          -- done late: skip ahead to the next future date
    v_next := (v_next + v_step)::date;
  end loop;

  insert into ovie.tasks (household_id, title, notes, assignee_id, priority, due_on,
                          repeat_every, repeat_unit, series_id, created_by, reward_points, reward_text,
                          due_time, in_calendar, remind)
  values (t.household_id, t.title, t.notes, t.assignee_id, t.priority, v_next,
          t.repeat_every, t.repeat_unit, t.series_id, t.created_by, t.reward_points, t.reward_text,
          t.due_time, t.in_calendar, t.remind)
  on conflict (series_id, due_on) where series_id is not null do nothing
  returning id into v_new;

  return v_new;
end;
$$;

create or replace function ovie.task_alarm_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.remind and new.due_on is not null and new.completed_at is null then
    insert into ovie.alarms (household_id, label, at_time, days, on_date, member_id, enabled, task_id, created_by)
    values (new.household_id, left('Due: ' || new.title, 60), coalesce(new.due_time, time '09:00'), '{}', new.due_on,
            new.assignee_id, true, new.id, new.created_by)
    on conflict (task_id) do update
      set label = excluded.label, at_time = excluded.at_time, on_date = excluded.on_date,
          member_id = excluded.member_id,
          enabled = case when ovie.alarms.on_date is distinct from excluded.on_date
                           or ovie.alarms.at_time is distinct from excluded.at_time
                         then true else ovie.alarms.enabled end,
          last_dismissed_for = case when ovie.alarms.on_date is distinct from excluded.on_date
                                      or ovie.alarms.at_time is distinct from excluded.at_time
                                    then null else ovie.alarms.last_dismissed_for end,
          snoozed_until = case when ovie.alarms.on_date is distinct from excluded.on_date
                                 or ovie.alarms.at_time is distinct from excluded.at_time
                               then null else ovie.alarms.snoozed_until end;
  else
    delete from ovie.alarms where task_id = new.id;
  end if;
  return null;
end;
$$;
revoke all on function ovie.task_alarm_sync() from public, anon, authenticated;
create trigger tasks_alarm_sync after insert or update of title, due_on, due_time, remind, assignee_id, completed_at
  on ovie.tasks for each row execute function ovie.task_alarm_sync();
