alter table public.environment_snapshots
add column if not exists elevation_m numeric;

comment on column public.environment_snapshots.elevation_m is
  'Open-Meteo elevation in meters for the selected weather grid cell.';
