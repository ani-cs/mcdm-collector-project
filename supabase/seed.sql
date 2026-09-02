-- Runs automatically after migrations on `supabase start` / `supabase db reset`.
-- Gives anyone who clones the repo a working demo without a real Supabase
-- account: one admin login and one sample MCDM project with real inputs.
--
-- Login: admin@example.com / password123

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated',
  'authenticated',
  'admin@example.com',
  crypt('password123', gen_salt('bf')),
  now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"registration_completed": true}',
  now(), now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  format('{"sub":"%s","email":"%s"}', '11111111-1111-1111-1111-111111111111', 'admin@example.com')::jsonb,
  'email',
  '11111111-1111-1111-1111-111111111111',
  now(), now(), now()
);
-- The above insert fires on_auth_user_created, which creates the matching
-- public.admins row automatically.

-- Ids below rely on a freshly reset database (identity columns start at 1).
insert into public.projects (name, description, admin_id) values
  ('Hospital Imaging Equipment', 'Cost-utility analysis for selecting new diagnostic imaging equipment.', '11111111-1111-1111-1111-111111111111');

insert into public.criteria (label, project_id, max_value) values
  ('Cost Efficiency', 1, 10),
  ('Patient Safety', 1, 10),
  ('Maintenance Complexity', 1, 10);

insert into public.alternatives (name, project_id) values
  ('Scanner A', 1),
  ('Scanner B', 1),
  ('Scanner C', 1);

insert into public.decision_makers (name, is_submitted, project_id, expires_at) values
  ('Dr. Smith', true, 1, now() + interval '7 days'),
  ('Dr. Jones', true, 1, now() + interval '7 days'),
  ('Dr. Lee', false, 1, now() + interval '7 days');

insert into public.criterion_weights (dm_id, criterion_id, value) values
  (1, 1, 0.4), (1, 2, 0.4), (1, 3, 0.2),
  (2, 1, 0.3), (2, 2, 0.5), (2, 3, 0.2);

insert into public.criterion_ratings (dm_id, alternative_id, criterion_id, value) values
  (1, 1, 1, 7), (1, 1, 2, 8), (1, 1, 3, 6),
  (1, 2, 1, 6), (1, 2, 2, 7), (1, 2, 3, 8),
  (1, 3, 1, 9), (1, 3, 2, 6), (1, 3, 3, 5),
  (2, 1, 1, 8), (2, 1, 2, 7), (2, 1, 3, 6),
  (2, 2, 1, 7), (2, 2, 2, 8), (2, 2, 3, 7),
  (2, 3, 1, 6), (2, 3, 2, 9), (2, 3, 3, 6);
