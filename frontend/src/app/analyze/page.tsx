'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, FileSpreadsheet } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { CountResults } from '@/components/surveillance/CountResults';
import { EnvironmentPanel, useEnvironment } from '@/components/surveillance/EnvironmentPanel';
import { useDemoRole } from '@/context/RoleContext';
import { runCountAnalysis } from '@/lib/api/client';
import { DEMO_ROLES, MONITORING_UNITS } from '@/lib/data/seededData';
import { MAX_CSV_BYTES, REPORT_CATEGORIES, sampleCounts, type CountAnalysis, type ReportCategory } from '@/lib/surveillance/contract';
import { parseCounts } from '@/lib/surveillance/parseCounts';

function SiteAnalysis({ role }: { role: 'oh_lead' | 'hse_officer' }) {
  const permittedSites = DEMO_ROLES.find(({ id }) => role === id)?.permittedUnitIds;
  const sites = MONITORING_UNITS.filter(({ id }) => permittedSites === 'all' || permittedSites?.includes(id));
  const [siteId, setSiteId] = useState(sites.find(({ id }) => id === 'site-04')?.id ?? sites[0].id);
  const site = sites.find(({ id }) => id === siteId)!;
  const [category, setCategory] = useState<ReportCategory>('respiratory');
  const [csv, setCsv] = useState('');
  const [isSample, setIsSample] = useState(false);
  const [result, setResult] = useState<{ data: CountAnalysis; isSample: boolean } | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileRevision = useRef(0);
  const resultRegion = useRef<HTMLDivElement>(null);
  const environment = useEnvironment(siteId);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!result) return;
    resultRegion.current?.focus({ preventScroll: true });
    resultRegion.current?.scrollIntoView({ block: 'nearest' });
  }, [result]);

  function updateCsv(value: string, sample = false) {
    fileRevision.current++;
    setCsv(value);
    setIsSample(sample);
    setError('');
    setResult(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError('');
    setResult(null);
    try {
      parseCounts(csv);
      const data = await runCountAnalysis({ csv, category, unitId: siteId, role }, controller.signal);
      if (!controller.signal.aborted) setResult({ data, isSample });
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Analysis is unavailable.');
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return (
    <div className="review-grid">
      <div className="space-y-4 min-w-0">
        <form onSubmit={submit} className="canary-panel p-5 space-y-4" aria-labelledby="import-heading">
          <h2 id="import-heading" className="text-lg font-semibold text-canary-text">Report input</h2>
          <fieldset className="space-y-3 min-w-0" disabled={pending}>
            <label className="review-label">
              Monitoring site
              <select className="review-input" value={siteId} onChange={(event) => {
                setSiteId(event.target.value);
                setResult(null);
              }}>
                {sites.map(({ id, name }) => <option value={id} key={id}>{name}</option>)}
              </select>
            </label>
            <label className="review-label">
              Count category
              <select className="review-input" value={category} onChange={(event) => {
                setCategory(event.target.value as ReportCategory);
                setResult(null);
              }}>
                {Object.entries(REPORT_CATEGORIES).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <input ref={fileInput} type="file" hidden accept=".csv,text/csv" aria-label="Select a CSV file" onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (!file) return;
                updateCsv('');
                const revision = fileRevision.current;
                try {
                  if (file.size > MAX_CSV_BYTES) throw new Error('Use a CSV file of 16 KB or less.');
                  const contents = await file.text();
                  if (revision === fileRevision.current) updateCsv(contents);
                } catch (failure) {
                  if (revision === fileRevision.current) setError(failure instanceof Error ? failure.message : 'The CSV could not be read.');
                }
              }} />
              <button type="button" className="workspace-control" onClick={() => fileInput.current?.click()}><FileSpreadsheet size={15} /> Upload CSV</button>
              <button type="button" className="workspace-control" onClick={() => updateCsv(sampleCounts(), true)}>Load sample</button>
              {csv && <button type="button" className="workspace-control" onClick={() => updateCsv('')}>Clear report</button>}
              {isSample && <span className="self-center text-xs font-semibold text-canary-text-3">Simulated sample</span>}
            </div>
            <label className="review-label">
              Daily-count CSV
              <textarea className="review-input font-mono resize-y" rows={8} value={csv}
                spellCheck={false} autoComplete="off" maxLength={MAX_CSV_BYTES}
                onChange={(event) => updateCsv(event.target.value)}
                aria-describedby="csv-format" placeholder={'date,count\nYYYY-MM-DD,12'} />
            </label>
            <p id="csv-format" className="text-xs leading-relaxed text-canary-text-2">
              Use the header <code>date,count</code> and one row per Dubai calendar day. Include only daily totals. Up to 366 calendar days per report.
            </p>
          </fieldset>
          {error && <p role="alert" className="rounded-control border border-tier-action/40 bg-tier-action/10 p-3 text-sm text-tier-action-text">{error}</p>}
          <button type="submit" disabled={pending || !csv.trim()} className="review-primary">
            {pending ? 'Analyzing…' : 'Analyze counts'} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>
        <EnvironmentPanel {...environment} />
      </div>
      <div ref={resultRegion} className="min-w-0" tabIndex={-1} aria-label="Count analysis result">
        {result ? (
          <CountResults key={result.data.reviewId} result={result.data} site={site.name}
            isSample={result.isSample} environment={environment.snapshot} loading={environment.loading} />
        ) : (
          <section className="canary-panel p-5 space-y-2">
            <h2 className="text-lg font-semibold text-canary-text">Baseline and alert evidence</h2>
            <p className="text-sm text-canary-text-2" role="status">
              {pending ? 'Calculating the baseline and latest tier…' : 'Load the sample, upload a file, or paste counts to calculate the latest tier.'}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  const { activeRole } = useDemoRole();
  return (
    <AppShell title="Site count analysis" description="Review a site’s daily aggregate counts alongside current weather and air quality.">
      <p className="review-privacy">
        Submit approved aggregate counts only. Canary processes each report on request. Use Clear report to remove it from this page.
      </p>
      {activeRole === 'oh_lead' || activeRole === 'hse_officer' ? <SiteAnalysis key={activeRole} role={activeRole} /> : (
        <section className="canary-panel p-5 space-y-2">
          <h2 className="text-lg font-semibold text-canary-text">Site analysis requires a site-level role</h2>
          <p className="text-sm text-canary-text-2">Choose the OH Physician or Site HSE Officer demo role to continue.</p>
        </section>
      )}
    </AppShell>
  );
}
