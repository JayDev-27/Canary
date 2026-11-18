import type { RiskTier } from '@/lib/types/domain';

export const REPORT_CATEGORIES = {
  respiratory: 'Respiratory clinic visits',
  gastrointestinal: 'Gastrointestinal clinic visits',
  heat: 'Heat-related first-aid visits',
  absence: 'Workplace absences',
} as const;

export type ReportCategory = keyof typeof REPORT_CATEGORIES;
export const MAX_CSV_BYTES = 16 * 1024;
export const MAX_REPORT_DAYS = 366;
export const SMALL_CELL_THRESHOLD = 5;
export const BASELINE_DAYS = 28;
export const MIN_BASELINE_DAYS = 7;
const DAY_MS = 86_400_000;
const dubaiCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dubai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function dubaiDate(now = new Date()) {
  const parts = dubaiCalendar.formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return [part('year'), part('month'), part('day')].join('-');
}

export function addDays(day: string, delta: number) {
  return new Date(Date.parse(day) + delta * DAY_MS).toISOString().slice(0, 10);
}

export function isReportDate(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day)
    && Number.isFinite(Date.parse(day)) && addDays(day, 0) === day;
}

export function isReportCategory(value: unknown): value is ReportCategory {
  return typeof value === 'string' && Object.hasOwn(REPORT_CATEGORIES, value);
}

export type CountStatus = 'reported' | 'suppressed' | 'missing';
export type AnalysisTier = RiskTier | 'NOMINAL' | 'UNAVAILABLE';

export interface DailyEvidence {
  date: string;
  status: CountStatus;
  observed: number | null;
  expected: number | null;
  watchThreshold: number | null;
  actionThreshold: number | null;
  baselineDays: number;
  recentElevations: number;
  tier: AnalysisTier;
  reason: string;
}

export interface CountAnalysis {
  unitId: string;
  category: ReportCategory;
  baseFrom: string;
  baseTo: string;
  latest: DailyEvidence;
  withoutLatestCount: DailyEvidence;
  trend: DailyEvidence[];
  reviewId: string;
}

interface FeedUnavailable {
  status: 'missing' | 'stale';
  validAt: string | null;
}

interface CurrentFeed<Values> {
  status: 'current';
  validAt: string;
  values: Values;
}

export type WeatherFeed = FeedUnavailable | CurrentFeed<{
  temperature: number;
  humidity: number;
  heatProxy: number;
}>;

export type AirFeed = FeedUnavailable | CurrentFeed<{
  pm25: number;
  pm10: number;
}>;

export interface EnvironmentSnapshot {
  locationId: string;
  fetchedAt: string;
  weather: WeatherFeed;
  air: AirFeed;
}

export function sampleCounts() {
  const today = dubaiDate();
  const history = Array.from({ length: BASELINE_DAYS }, (_, index) => 7 + index % 3);
  return [
    'date,count',
    ...[...history, 17, 18].map((count, index, values) =>
      `${addDays(today, index - values.length)},${count}`
    ),
  ].join('\n');
}
