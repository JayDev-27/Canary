'use client';

import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RiskTierBadge } from '@/components/shared/RiskTierBadge';
import { AlertReview } from './AlertReview';
import {
  BASELINE_DAYS, MIN_BASELINE_DAYS, REPORT_CATEGORIES, SMALL_CELL_THRESHOLD,
  type AnalysisTier, type CountAnalysis, type DailyEvidence, type EnvironmentSnapshot,
} from '@/lib/surveillance/contract';

function Tier({ tier }: { tier: AnalysisTier }) {
  if (tier === 'NOMINAL' || tier === 'UNAVAILABLE') {
    return <span className="rounded-badge border border-border bg-panel-inset px-2.5 py-1 text-xs font-semibold text-canary-text-2">
      {tier === 'NOMINAL' ? 'Nominal' : 'No assessment'}
    </span>;
  }
  return <RiskTierBadge tier={tier} />;
}

function Observed({ point }: { point: DailyEvidence }) {
  if (point.status === 'suppressed') return <>Withheld (&lt;{SMALL_CELL_THRESHOLD})</>;
  return <>{point.observed ?? 'Missing'}</>;
}

const omittedOptions = {
  counts: 'Latest daily count',
  weather: 'Weather feed',
  air: 'Air-quality feed',
} as const;

function FeedComparison({ result, environment, loading }: {
  result: CountAnalysis;
  environment: EnvironmentSnapshot | null;
  loading: boolean;
}) {
  const [omitted, setOmitted] = useState<keyof typeof omittedOptions>('counts');
  const actualPoint = result.latest;
  const alteredPoint = omitted === 'counts' ? result.withoutLatestCount : actualPoint;
  const current = (feed: 'weather' | 'air') => environment?.[feed].status === 'current';
  const available = Number(current('weather')) + Number(current('air'));
  const remaining = available - (omitted !== 'counts' && current(omitted) ? 1 : 0);
  const explanation = omitted === 'counts'
    ? 'Without the latest count, Canary keeps the historical baseline and cannot assign a tier for this day.'
    : current(omitted)
      ? 'Removing this feed reduces current environmental coverage. The reported-count tier stays the same because it uses the site’s count history.'
      : 'This feed already lacks a current value. The reported-count tier and available context stay the same.';

  return (
    <section className="canary-panel p-5 space-y-3" aria-labelledby="outage-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="outage-title" className="text-lg font-semibold text-canary-text">Missing-feed comparison</h2>
        <label className="review-label">
          Withhold a feed
          <select className="review-input" value={omitted} onChange={(event) => setOmitted(event.target.value as keyof typeof omittedOptions)}>
            {Object.entries(omittedOptions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { title: 'As reported', point: actualPoint, feeds: available },
          { title: 'With feed missing', point: alteredPoint, feeds: remaining },
        ].map(({ title, point, feeds }) => (
          <div key={title} className="canary-panel-inset p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-canary-text">{title}</h3>
              <Tier tier={point.tier} />
            </div>
            <div className="text-xs text-canary-text-2">Latest count · <Observed point={point} /></div>
            <div className="text-xs text-canary-text-2">Current environmental feeds · {loading ? 'Checking…' : `${feeds} of 2`}</div>
          </div>
        ))}
      </div>
      <p aria-live="polite" className="text-sm text-canary-text-2">{explanation}</p>
    </section>
  );
}

export function CountResults({ result, site, isSample, environment, loading }: {
  result: CountAnalysis;
  site: string;
  isSample: boolean;
  environment: EnvironmentSnapshot | null;
  loading: boolean;
}) {
  const { latest, baseFrom, baseTo, trend } = result;
  const isAlert = ['WATCH', 'ALERT', 'ACTION'].includes(latest.tier);

  return (
    <div className="space-y-4">
      <section className="canary-panel p-5 space-y-4" aria-labelledby="analysis-result">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-canary-text-3">{site} · {isSample ? 'Simulated sample' : 'Uploaded or pasted aggregate data'}</p>
            <h2 id="analysis-result" className="text-xl font-semibold text-canary-text">{REPORT_CATEGORIES[result.category]}</h2>
            <p className="text-xs text-canary-text-2">Latest report · <time dateTime={latest.date}>{latest.date}</time> GST</p>
          </div>
          <Tier tier={latest.tier} />
        </div>
        <dl className="grid gap-2 sm:grid-cols-3">
          {[
            ['Reported count', <Observed key="latest" point={latest} />],
            ['Expected count', latest.expected?.toFixed(1) ?? 'Unavailable'],
            ['Baseline coverage', `${latest.baselineDays} / ${BASELINE_DAYS} days`],
          ].map(([label, value], index) => (
            <div className="canary-panel-inset p-3" key={index}>
              <dt className="text-xs text-canary-text-3">{label}</dt>
              <dd className="text-base font-semibold text-canary-text mt-1">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-control border border-border bg-panel-inset p-3">
          <h3 className="text-sm font-semibold text-canary-text">Why this tier</h3>
          <p className="mt-1 text-sm text-canary-text-2">{latest.reason}</p>
          {latest.watchThreshold !== null && <p className="mt-2 text-xs text-canary-text-3">
            Latest thresholds · Watch ≥ {latest.watchThreshold} · Action ≥ {latest.actionThreshold}
          </p>}
        </div>
        <h3 className="text-sm font-semibold text-canary-text">Daily counts and rolling baseline</h3>
        <div className="h-56" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={(date: string) => date.slice(5)} tick={{ fill: 'var(--text-3)', fontSize: 10 }} minTickGap={28} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)' }} />
              <Legend />
              <Line type="linear" name="Reported" dataKey="observed" stroke="var(--amber)" strokeWidth={2.5} dot={{ r: 2 }} isAnimationActive={false} />
              <Line type="linear" name="Expected" dataKey="expected" stroke="var(--text-3)" strokeDasharray="4 3" dot={{ r: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <details className="text-xs text-canary-text-2">
          <summary className="cursor-pointer font-semibold text-canary-text">View daily evidence table</summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full min-w-[320px] text-left">
              <thead><tr className="border-b border-border">
                {['Date (GST)', 'Reported', 'Expected', 'Tier'].map((column) => <th scope="col" key={column} className="p-2">{column}</th>)}
              </tr></thead>
              <tbody>
                {[...trend].reverse().map((point) => <tr key={point.date} className="border-b border-border">
                  <th scope="row" className="p-2 font-medium">{point.date}</th>
                  <td className="p-2"><Observed point={point} /></td>
                  <td className="p-2">{point.expected?.toFixed(1) ?? 'Unavailable'}</td>
                  <td className="p-2"><Tier tier={point.tier} /></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </details>
        <details className="text-xs text-canary-text-2">
          <summary className="cursor-pointer font-semibold text-canary-text">How the baseline and thresholds are calculated</summary>
          <p className="mt-2 leading-relaxed">
            The baseline uses the mean of counts of {SMALL_CELL_THRESHOLD} or higher from the prior {BASELINE_DAYS} calendar days.
            At least {MIN_BASELINE_DAYS} eligible days are required. The latest baseline window runs from {baseFrom} through {baseTo}.
            Watch begins at the mean plus two times the spread, rounded up. Action begins at five times the spread above the mean.
            Spread is the larger of the sample standard deviation, the square root of the mean, and one count.
            Alert requires a Watch-level exceedance today and on at least one of the prior two days, each against its own baseline.
            The thresholds are prototype review rules. Current environmental readings provide separate context for review.
          </p>
        </details>
      </section>
      <FeedComparison result={result} environment={environment} loading={loading} />
      {isAlert && <AlertReview id={result.reviewId} owner="Occupational health or site safety reviewer" />}
    </div>
  );
}
