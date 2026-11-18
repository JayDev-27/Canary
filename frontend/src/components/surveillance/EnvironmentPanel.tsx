'use client';

import { useEffect, useState } from 'react';
import { CloudSun, RefreshCw, Wind } from 'lucide-react';
import { fetchEnvironment } from '@/lib/api/client';
import type { EnvironmentSnapshot } from '@/lib/surveillance/contract';

const validity = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short',
});

export function useEnvironment(locationId: string) {
  const [result, setResult] = useState<{
    locationId: string; refresh: number; snapshot: EnvironmentSnapshot | null;
  } | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    fetchEnvironment(locationId, request.signal)
      .then((snapshot) => {
        if (!request.signal.aborted) setResult({ locationId, refresh, snapshot });
      })
      .catch(() => {
        if (!request.signal.aborted) setResult({ locationId, refresh, snapshot: null });
      });
    return () => request.abort();
  }, [locationId, refresh]);

  const loaded = result?.locationId === locationId && result.refresh === refresh;
  return {
    snapshot: loaded ? result.snapshot : null,
    loading: !loaded,
    refresh: () => setRefresh((current) => current + 1),
  };
}

function feedStatus(feed: EnvironmentSnapshot['weather'] | EnvironmentSnapshot['air'] | undefined, loading: boolean) {
  if (loading) return 'Checking feed…';
  if (!feed || feed.status === 'missing') return 'Feed unavailable';
  if (feed.status === 'stale') return 'Feed stale';
  return 'Current model data';
}

export function EnvironmentPanel({
  snapshot, loading, refresh,
}: ReturnType<typeof useEnvironment>) {
  const weather = snapshot?.weather;
  const air = snapshot?.air;

  return (
    <section className="canary-panel p-5 space-y-3" aria-label="Live environmental feeds">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-canary-text">Live environmental feeds</h2>
        <button type="button" className="workspace-control" disabled={loading} onClick={refresh}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh feeds
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2" role="status">
        <div className="canary-panel-inset p-3 space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-canary-text"><CloudSun size={16} aria-hidden="true" /> Weather</h3>
          <p className="text-xs text-canary-text-2">{feedStatus(weather, loading)}</p>
          {weather?.status === 'current' && <>
            <p className="text-sm font-semibold text-canary-text">{weather.values.temperature} °C · {weather.values.humidity}% RH</p>
            <p className="text-xs text-canary-text-2">Heat stress proxy {weather.values.heatProxy} °C</p>
          </>}
          {weather?.validAt && <p className="text-xs text-canary-text-3">Valid {validity.format(new Date(weather.validAt))} GST</p>}
        </div>
        <div className="canary-panel-inset p-3 space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-canary-text"><Wind size={16} aria-hidden="true" /> Air quality</h3>
          <p className="text-xs text-canary-text-2">{feedStatus(air, loading)}</p>
          {air?.status === 'current' && <>
            <p className="text-sm font-semibold text-canary-text">PM₂.₅ {air.values.pm25} µg/m³</p>
            <p className="text-xs text-canary-text-2">PM₁₀ {air.values.pm10} µg/m³</p>
          </>}
          {air?.validAt && <p className="text-xs text-canary-text-3">Valid {validity.format(new Date(air.validAt))} GST</p>}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-canary-text-3">
        Regional model estimates for this location. The heat stress proxy uses temperature and humidity.
        {' '}<a href="https://open-meteo.com/" className="underline underline-offset-2">Open-Meteo</a>
        {' · '}<a href="https://atmosphere.copernicus.eu/" className="underline underline-offset-2">CAMS</a>
      </p>
    </section>
  );
}

export function LocationEnvironment({ locationId }: { locationId: string }) {
  const environment = useEnvironment(locationId);
  return <EnvironmentPanel {...environment} />;
}
