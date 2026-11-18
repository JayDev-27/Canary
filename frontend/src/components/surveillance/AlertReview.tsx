'use client';

import { useState } from 'react';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { useDemoRole } from '@/context/RoleContext';
import { DEMO_ROLES } from '@/lib/data/seededData';
import { REVIEW_LABELS, REVIEW_NOTES, saveReview, useAlertReviews, type ReviewNote } from '@/lib/surveillance/reviews';

export function AlertReview({ id, owner }: { id: string; owner?: string }) {
  const { activeRole, roleInfo } = useDemoRole();
  const reviews = useAlertReviews();
  const decision = reviews.decision(id);
  const note = reviews.note(id);
  const [topic, setTopic] = useState<ReviewNote | ''>('');
  const [error, setError] = useState(false);
  const roleName = DEMO_ROLES.find((role) => role.id === decision?.role)?.shortName;
  if (!roleInfo.hasHealthDetail) return null;

  return (
    <section id="review" className="canary-panel p-5 space-y-3 scroll-mt-5" aria-label="Human review">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={18} className="text-canary-amber" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-canary-text">Human review</h2>
      </div>
      <p className="text-sm text-canary-text-2">
        Record your decision for this alert. Decisions and notes stay in this browser.
        {owner && <span className="block mt-1">Suggested owner · {owner}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="workspace-control" aria-pressed={decision?.value === 'accepted'}
          onClick={() => setError(!saveReview(id, activeRole, { field: 'decision', value: 'accepted' }))}>
          <Check size={16} aria-hidden="true" /> Accept for follow-up
        </button>
        <button type="button" className="workspace-control" aria-pressed={decision?.value === 'dismissed'}
          onClick={() => setError(!saveReview(id, activeRole, { field: 'decision', value: 'dismissed' }))}>
          <X size={16} aria-hidden="true" /> Dismiss alert
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="review-label">
          Reviewer note
          <select className="review-input" value={topic} onChange={(event) => setTopic(event.target.value as ReviewNote | '')}>
            <option value="">Choose a note</option>
            {REVIEW_NOTES.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <button type="button" className="workspace-control" disabled={!topic}
          onClick={() => { if (topic) setError(!saveReview(id, activeRole, { field: 'note', value: topic })); }}>
          Save note
        </button>
      </div>
      <div className="text-xs text-canary-text-2 space-y-1" role="status">
        <p>{decision ? `${REVIEW_LABELS[decision.value]} · ${roleName} · ${new Date(decision.recordedAt).toLocaleString()}` : 'Awaiting review'}</p>
        {note && <p>Saved note · {note.value}</p>}
      </div>
      {error && <p role="alert" className="text-sm text-tier-action-text">This browser could not save the review. Check its storage settings and try again.</p>}
    </section>
  );
}
