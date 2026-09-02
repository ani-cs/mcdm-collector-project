-- Local mirror of the production schema (reconstructed from the real
-- Supabase project's information_schema + function definitions, since no
-- migrations were tracked in git before this). Column types, defaults and
-- RPC bodies match production exactly as of 2026-09-02.

create table public.admins (
  id uuid primary key references auth.users (id) on delete cascade,
  username text
);

create table public.projects (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  description text,
  admin_id uuid references public.admins (id)
);

create table public.criteria (
  id bigint generated always as identity primary key,
  label text,
  project_id bigint references public.projects (id) on delete cascade,
  max_value bigint
);

create table public.alternatives (
  id bigint generated always as identity primary key,
  name text not null,
  project_id bigint references public.projects (id) on delete cascade
);

create table public.decision_makers (
  id bigint generated always as identity primary key,
  name text not null,
  token uuid not null default gen_random_uuid(),
  is_submitted boolean not null default false,
  project_id bigint references public.projects (id) on delete cascade,
  expires_at timestamp without time zone
);

create table public.criterion_weights (
  id bigint generated always as identity primary key,
  value real,
  dm_id bigint references public.decision_makers (id) on delete cascade,
  criterion_id bigint references public.criteria (id) on delete cascade
);

create table public.criterion_ratings (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  dm_id bigint references public.decision_makers (id) on delete cascade,
  criterion_id bigint references public.criteria (id) on delete cascade,
  alternative_id bigint references public.alternatives (id) on delete cascade,
  value real
);

-- Mirrors production: RLS is not enabled on these tables today. This local
-- schema intentionally matches that so the demo behaves the same way. See
-- the README security note before deploying this publicly.

-- Auto-create an admins row whenever a new Supabase Auth user is created,
-- same as production's on_auth_user_created trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.admins (id, username)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.get_dm_inputs(p_id bigint)
returns json
language sql
stable
as $$
  select json_object_agg(dm_id, dm_data)
  from (
    select
      dm.id as dm_id,
      json_build_object(
        'weights', (
          select json_object_agg(cw.criterion_id, cw.value)
          from criterion_weights cw
          where cw.dm_id = dm.id
        ),
        'ratings', (
          select json_agg(json_build_object(
            'alternative_id', cr.alternative_id,
            'criterion_id', cr.criterion_id,
            'value', cr.value
          ))
          from criterion_ratings cr
          where cr.dm_id = dm.id
        )
      ) as dm_data
    from decision_makers dm
    where dm.project_id = p_id
  ) sub;
$$;

create or replace function public.get_min_and_max_inputs_by_project(p_id bigint)
returns json
language sql
stable
as $$
  select json_build_object(
    'weights', (
      select json_object_agg(criterion_id, bounds)
      from (
        select cw.criterion_id, json_build_object(
          'min', min(cw.value),
          'max', max(cw.value)
        ) as bounds
        from criterion_weights cw
        join criteria c on cw.criterion_id = c.id
        where c.project_id = p_id
        group by cw.criterion_id
      ) sub
    ),
    'ratings', (
      select json_object_agg(alternative_id, criteria_bounds)
      from (
        select cr.alternative_id, json_object_agg(criterion_id, bounds) as criteria_bounds
        from (
          select cr.alternative_id, cr.criterion_id, json_build_object(
            'min', min(cr.value),
            'max', max(cr.value)
          ) as bounds
          from criterion_ratings cr
          join decision_makers dm on cr.dm_id = dm.id
          where dm.project_id = p_id
          group by cr.alternative_id, cr.criterion_id
        ) cr
        group by cr.alternative_id
      ) sub
    )
  );
$$;

create or replace function public.get_user_rating_by_project(p_id bigint)
returns json
language sql
stable
as $$
  select json_agg(
    json_build_object(
      'alternative_id', cr.alternative_id,
      'criterion_id', cr.criterion_id,
      'user_id', cr.dm_id,
      'value', cr.value
    )
  )
  from criterion_ratings cr
  join decision_makers dm on cr.dm_id = dm.id
  where dm.project_id = p_id;
$$;

create or replace function public.get_user_score_avg_by_alternative(p_id bigint, a_id bigint[])
returns json
language sql
stable
as $$
  select json_object_agg(alternative_id, avg_values)
  from (
    select cr.alternative_id, avg(cr.value) as avg_values
    from criterion_ratings cr
    join alternatives alt on cr.alternative_id = alt.id
    where alt.project_id = p_id
      and cr.alternative_id = any(a_id)
    group by cr.alternative_id
  ) sub;
$$;

create or replace function public.get_user_score_avg_by_project(p_id bigint)
returns json
language sql
stable
as $$
  select json_object_agg(alternative_id, avg_values)
  from (
    select cr.alternative_id, avg(cr.value) as avg_values
    from criterion_ratings cr
    join alternatives alt on cr.alternative_id = alt.id
    where alt.project_id = p_id
    group by cr.alternative_id
  ) subquery;
$$;

create or replace function public.get_weight_values_by_project(p_id bigint)
returns json
language sql
stable
as $$
  select coalesce(json_agg(
    json_build_object(
      'criterion_id', cw.criterion_id,
      'value', cw.value
    )
  ), '[]'::json)
  from criterion_weights cw
  join decision_makers dm on cw.dm_id = dm.id
  where dm.project_id = p_id;
$$;

create or replace function public.get_weight_avg_by_project(p_id bigint)
returns json
language sql
stable
as $$
  select json_object_agg(criterion_id, avg_values)
  from (
    select cw.criterion_id, avg(cw.value) as avg_values
    from criterion_weights cw
    join criteria on cw.criterion_id = criteria.id
    where criteria.project_id = p_id
    group by cw.criterion_id
  ) subquery;
$$;

create or replace function public.get_weight_avg_by_criterion(p_id bigint, c_id bigint[])
returns json
language sql
stable
as $$
  select json_object_agg(criterion_id, avg_values)
  from (
    select cw.criterion_id, avg(cw.value) as avg_values
    from criterion_weights cw
    join criteria on cw.criterion_id = criteria.id
    where criteria.project_id = p_id
      and cw.criterion_id = any(c_id)
    group by cw.criterion_id
  ) subquery;
$$;

-- PostgREST only exposes functions/tables it can see at boot; make sure it
-- picks up everything created above.
notify pgrst, 'reload schema';
