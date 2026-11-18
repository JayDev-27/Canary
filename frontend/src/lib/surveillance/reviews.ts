'use client';

import { useSyncExternalStore } from 'react';
import type { DemoRole, TierStatus } from '@/lib/types/domain';

export const REVIEW_NOTES = [
  'Verify the submitted counts',
  'Check for a delayed or incomplete feed',
  'Compare against another aggregate source',
  'Escalate to the designated reviewer',
] as const;
export type ReviewNote = typeof REVIEW_NOTES[number];
type Decision = 'accepted' | 'dismissed';
type Entry<Value> = { value: Value; role: DemoRole; recordedAt: string };
const prefix = 'canary-review.v1.';
let revision = 0;
const listeners = new Set<() => void>();

function notify() {
  revision++;
  for (const listener of listeners) listener();
}

function handleStorage(event: StorageEvent) {
  if (event.key === null || event.key.startsWith(prefix)) notify();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('storage', handleStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', handleStorage);
  };
}

function read<Value>(id: string, field: 'decision' | 'note'): Entry<Value> | null {
  try {
    return JSON.parse(localStorage.getItem(`${prefix}${id}.${field}`) ?? 'null');
  } catch {
    return null;
  }
}

export function useAlertReviews() {
  const currentRevision = useSyncExternalStore(subscribe, () => revision, () => -1);
  return {
    decision: (id: string) => currentRevision < 0 ? null : read<Decision>(id, 'decision'),
    note: (id: string) => currentRevision < 0 ? null : read<ReviewNote>(id, 'note'),
  };
}

export function saveReview(
  id: string,
  role: DemoRole,
  review: { field: 'decision'; value: Decision } | { field: 'note'; value: ReviewNote },
) {
  try {
    localStorage.setItem(`${prefix}${id}.${review.field}`, JSON.stringify({
      value: review.value,
      role,
      recordedAt: new Date().toISOString(),
    }));
    notify();
    return true;
  } catch {
    return false;
  }
}

export const REVIEW_LABELS: Record<TierStatus | Decision, string> = {
  active: 'Active',
  under_review: 'Under review',
  resolved: 'Resolved',
  accepted: 'Accepted',
  dismissed: 'Dismissed',
};
