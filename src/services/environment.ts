import { supabase } from '@/lib/supabase';
import type { Database, EnvironmentSnapshot } from '@/types/database';

type EnvironmentSnapshotRow = Database['public']['Tables']['environment_snapshots']['Row'];

type Coordinates = {
  latitude: number;
  longitude: number;
  label?: string;
};

type OpenMeteoCurrentWeather = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
  };
};

type OpenMeteoAirQuality = {
  current?: {
    us_aqi?: number;
    pm2_5?: number;
    pm10?: number;
    ozone?: number;
    uv_index?: number;
  };
};

type OpenMeteoGeocodeResult = {
  results?: Array<{
    name: string;
    admin1?: string;
    country?: string;
    latitude: number;
    longitude: number;
  }>;
};

export async function geocodeLocation(query: string) {
  const trimmed = query.trim();

  if (!trimmed) {
    return { data: null, error: new Error('Enter a ZIP code or city.') };
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=en&format=json`;
  let response: Response;

  try {
    response = await fetch(url);
  } catch {
    return { data: null, error: new Error('Location lookup failed. Check your connection and try again.') };
  }

  if (!response.ok) {
    return { data: null, error: new Error('Location lookup failed. Try a nearby city or ZIP code.') };
  }

  const body = (await response.json()) as OpenMeteoGeocodeResult;
  const result = body.results?.[0];

  if (!result) {
    return { data: null, error: new Error('No matching location found.') };
  }

  return {
    data: {
      latitude: result.latitude,
      longitude: result.longitude,
      label: [result.name, result.admin1, result.country].filter(Boolean).join(', '),
    },
    error: null,
  };
}

export async function captureEnvironmentSnapshot(userId: string, dailyEntryId: string, coordinates: Coordinates) {
  const fetched = await fetchOpenMeteoEnvironment(coordinates.latitude, coordinates.longitude);

  if (fetched.error || !fetched.data) {
    return { data: null, error: fetched.error ?? new Error('Environment lookup failed.') };
  }

  const snapshot = fetched.data;

  return supabase
    .from('environment_snapshots')
    .upsert(
      {
        user_id: userId,
        daily_entry_id: dailyEntryId,
        provider: 'open-meteo',
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        location_label: coordinates.label ?? null,
        temperature_f: snapshot.temperatureF ?? null,
        humidity: snapshot.humidity ?? null,
        uv_index: snapshot.uvIndex ?? null,
        us_aqi: snapshot.usAqi ?? null,
        pm2_5: snapshot.pm25 ?? null,
        pm10: snapshot.pm10 ?? null,
        ozone: snapshot.ozone ?? null,
        captured_at: new Date().toISOString(),
        raw_response: snapshot.rawResponse,
      },
      { onConflict: 'daily_entry_id' }
    )
    .select('*')
    .single();
}

export async function getEnvironmentSnapshot(userId: string, dailyEntryId: string) {
  return supabase
    .from('environment_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('daily_entry_id', dailyEntryId)
    .maybeSingle();
}

export function toEnvironmentSnapshot(row: EnvironmentSnapshotRow | null | undefined): EnvironmentSnapshot | undefined {
  if (!row) {
    return undefined;
  }

  return {
    temperatureF: toNumber(row.temperature_f),
    humidity: toNumber(row.humidity),
    uvIndex: toNumber(row.uv_index),
    usAqi: toNumber(row.us_aqi),
    pm25: toNumber(row.pm2_5),
    pm10: toNumber(row.pm10),
    ozone: toNumber(row.ozone),
    locationLabel: row.location_label ?? undefined,
    provider: row.provider,
  };
}

async function fetchOpenMeteoEnvironment(latitude: number, longitude: number) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m&temperature_unit=fahrenheit&timezone=auto`;
  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm2_5,pm10,ozone,uv_index&timezone=auto`;

  let weatherResponse: Response;
  let airResponse: Response;

  try {
    [weatherResponse, airResponse] = await Promise.all([fetch(weatherUrl), fetch(airUrl)]);
  } catch {
    return { data: null, error: new Error('Environment lookup failed. Check your connection and try again.') };
  }

  if (!weatherResponse.ok || !airResponse.ok) {
    return { data: null, error: new Error('Open-Meteo did not return environment data.') };
  }

  const weather = (await weatherResponse.json()) as OpenMeteoCurrentWeather;
  const air = (await airResponse.json()) as OpenMeteoAirQuality;

  return {
    data: {
      temperatureF: weather.current?.temperature_2m,
      humidity: weather.current?.relative_humidity_2m,
      uvIndex: air.current?.uv_index,
      usAqi: air.current?.us_aqi,
      pm25: air.current?.pm2_5,
      pm10: air.current?.pm10,
      ozone: air.current?.ozone,
      rawResponse: { weather, airQuality: air },
    },
    error: null,
  };
}

function toNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined;
}
