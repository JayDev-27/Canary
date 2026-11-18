import assert from 'node:assert/strict';

const base = process.argv[2] ?? 'http://127.0.0.1:3100';
const asDubaiDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit',
});
const today = Date.parse(asDubaiDay.format(new Date()));
const date = (daysAgo) => new Date(today - daysAgo * 86_400_000).toISOString().slice(0, 10);
const history = Array.from({ length: 28 }, (_, index) => `${date(30 - index)},8`);
const report = (penultimate, latest, fromHistory = history) => [
  'date,count', ...fromHistory, `${date(2)},${penultimate}`, `${date(1)},${latest}`,
].join('\r\n');

async function post(path, payload) {
  const response = await fetch(`${base}/api/v1/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return [response.status, await response.json()];
}

const analyze = (csv, params = {}) => post('analyze', {
  unitId: 'site-04', role: 'oh_lead', category: 'respiratory', csv, ...params,
});

const [valid, result] = await analyze(report(16, 17));
assert.equal(valid, 200);
assert.equal(result.latest.tier, 'ALERT');
assert.equal(result.latest.observed, 17);
assert.equal(result.latest.expected, 8.3);
assert.equal(result.latest.baselineDays, 28);
assert.equal(result.latest.recentElevations, 2);
assert.match(result.latest.reason, /daily thresholds/);
assert.equal(result.withoutLatestCount.tier, 'UNAVAILABLE');
assert.equal(result.withoutLatestCount.observed, null);
assert.equal(result.withoutLatestCount.expected, result.latest.expected);
assert.notEqual((await analyze(report(16, 18)))[1].reviewId, result.reviewId);
assert.equal((await analyze(report(8, 17)))[1].latest.tier, 'WATCH');
assert.equal((await analyze(report(8, 100)))[1].latest.tier, 'ACTION');
assert.equal((await analyze(report(8, 8)))[1].latest.tier, 'NOMINAL');

const lowCount = (result) => result.replace(/,17$/, ',2');
const suppressed = (await analyze(lowCount(report(16, 17))))[1];
assert.equal(suppressed.latest.status, 'suppressed');
assert.equal(suppressed.latest.observed, null);
assert.equal(suppressed.latest.tier, 'UNAVAILABLE');
assert.deepEqual((await analyze(report(16, 4)))[1], suppressed);
const gapped = (await analyze(report(16, 17, history.filter((_, index) => index !== 17))))[1];
assert.equal(gapped.latest.baselineDays, 27);
assert.equal(gapped.trend.find((point) => point.date === date(13)).status, 'missing');
assert.equal((await analyze(report(16, 17, history.slice(0, 4))))[1].latest.tier, 'UNAVAILABLE');

for (const input of [
  'date,count,identifier\r\n2000-01-01,10,do-not-display',
  `date,count\n${date(1)},12\n${date(1)},9`,
  `date,count\n${date(-1)},12`,
  'date,count\n2026-02-30,12',
  `date,count\n${date(1)},-2`,
  `date,count\n${date(1)},1.5`,
]) {
  const [status, body] = await analyze(input);
  assert.equal(status, 422);
  assert(!body.error.includes('do-not-display'));
}
assert.equal((await analyze(report(8, 8), { role: 'regulator' }))[0], 403);
assert.equal((await analyze(report(8, 8), { role: 'hse_officer', unitId: 'site-05' }))[0], 403);
assert.equal((await analyze(report(8, 8), { role: 'hse_officer' }))[0], 200);
assert.equal((await analyze('x'.repeat(40_000)))[0], 413);
assert.equal((await analyze(report(8, 8), { category: 'constructor' }))[0], 400);

const contractSample = { unit_id: 'site-04', date: date(1), category: 'respiratory_clinic_visits', count: 14 };
assert.equal((await post('ingest', contractSample))[1].recordsValidated, 1);
assert.equal((await post('ingest', { ...contractSample, count: -1 }))[0], 400);
const invalidSample = (await post('ingest', { ...contractSample, 'do-not-display': 'private' }))[1];
assert(!invalidSample.error.includes('do-not-display'));

const alert = await fetch(`${base}/api/v1/alerts/ALT-2026-001?role=regulator`).then((response) => response.json());
assert.equal(alert.observedVsExpected.length, 0);
assert.equal(alert.contributions.length, 0);
assert.equal(alert.recommendation.evidence.length, 0);
assert.equal(alert.summary, 'Simulated alert in the compliance view.');
assert.equal((await fetch(`${base}/api/v1/environment?location=unknown`)).status, 404);

console.log('Surveillance smoke checks passed.');
