import type { AirFeed, EnvironmentSnapshot, WeatherFeed } from './contract';

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const HOUR_MS = 3_600_000;

function number(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

async function getCurrent<Values>(
  endpoint: string,
  fields: string[],
  location: readonly [number, number],
  now: Date,
  readValues: (current: Record<string, unknown>) => Values | null,
): Promise<{ status: 'current'; validAt: string; values: Values } | {
  status: 'missing' | 'stale'; validAt: string | null;
}> {
  const params = new URLSearchParams({
    latitude: String(location[0]),
    longitude: String(location[1]),
    current: fields.join(','),
    timezone: 'GMT',
    timeformat: 'unixtime',
  });
  if (endpoint === AIR_QUALITY_URL) params.set('domains', 'cams_global');

  try {
    const response = await fetch(`${endpoint}?${params}`, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { status: 'missing', validAt: null };
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('current' in payload)
        || !payload.current || typeof payload.current !== 'object') {
      return { status: 'missing', validAt: null };
    }

    const current = payload.current as Record<string, unknown>;
    if (!number(current.time, 0, 4_102_444_800)) return { status: 'missing', validAt: null };
    const validAt = new Date(current.time * 1_000).toISOString();
    const age = now.getTime() - current.time * 1_000;
    if (age > 3 * HOUR_MS || age < -HOUR_MS) return { status: 'stale', validAt };
    const values = readValues(current);
    return values === null ? { status: 'missing', validAt } : { status: 'current', validAt, values };
  } catch {
    return { status: 'missing', validAt: null };
  }
}

function weatherValues({ temperature_2m: temperature, relative_humidity_2m: humidity }: Record<string, unknown>) {
  if (!number(temperature, -90, 70) || !number(humidity, 0, 100)) return null;
  // Same simplified temperature/humidity proxy as the FastAPI weather adapter.
  const vaporPressure = humidity / 100 * 6.105 * Math.exp(17.27 * temperature / (237.7 + temperature));
  const heatProxy = 0.567 * temperature + 0.393 * vaporPressure + 3.94;
  return { temperature, humidity, heatProxy: Number(heatProxy.toFixed(1)) };
}

function airValues({ pm2_5: pm25, pm10 }: Record<string, unknown>) {
  if (!number(pm25, 0, 10_000) || !number(pm10, 0, 10_000)) return null;
  return { pm25, pm10 };
}

export async function getEnvironment(locationId: string, location: readonly [number, number]): Promise<EnvironmentSnapshot> {
  const now = new Date();
  const [weather, air]: [WeatherFeed, AirFeed] = await Promise.all([
    getCurrent(WEATHER_URL, ['temperature_2m', 'relative_humidity_2m'], location, now, weatherValues),
    getCurrent(AIR_QUALITY_URL, ['pm2_5', 'pm10'], location, now, airValues),
  ]);
  return { locationId, fetchedAt: now.toISOString(), weather, air };
}
