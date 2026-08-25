alter table public.profiles
add column if not exists profile_data jsonb not null default '{}'::jsonb;

comment on column public.profiles.profile_data is
  'Expanded one-time profile questionnaire responses for skin, medical, hormones, lifestyle, nutrition, supplements, procedures, and skincare.';
