# Data Governance & Privacy Architecture: Canary

**Document Version:** 1.0  
**Effective Date:** 6 November 2026  
**Applicability:** Ingestion contracts, storage schemas, API boundaries, and UI presentation  

---

## 1. Aggregate-Only Ingestion Boundary

Canary enforces an uncompromising aggregate-only ingestion contract:
- **Approved Canonical Ingestion Fields:**
  - `unit_id`: Approved facility, zone, or district identifier string.
  - `date`: ISO 8601 calendar date (`YYYY-MM-DD`).
  - `category`: Approved syndromic or hazard category identifier.
  - `count`: Non-negative integer count.
- **Approved Non-Identifying Metadata:** `stream`, `source`, `is_synthetic`.
- **Prohibited Fields (Hard API Rejection):** Any field resembling person-level identity (`name`, `patient_id`, `employee_id`, `emirates_id`, `national_id`, `dob`, `phone`, `clinical_notes`, etc.) is rejected with HTTP 400 Bad Request at the API gateway prior to persistence.

---

## 2. Statistical Disclosure Control

Canary uses small-cell and secondary suppression to reduce disclosure risk in low-density monitoring units.
1. **Primary Small-Cell Suppression:** Any published aggregate cell where count $< k$ (default $k=5$) is masked with `< 5`.
2. **Secondary Suppression:** Where row or column totals could permit mathematical deduction of a suppressed cell by subtraction, secondary non-sensitive cells are suppressed or parent district roll-up is enforced.
3. **No Raw Leakage:** Suppressed values are stripped server-side prior to serialization; the client receives only the masked token.

---

## 3. Role-Based Access Scoping (RBAC)

Access boundaries are enforced strictly on the server:
- **Site HSE Officer:** Scoped strictly to assigned operational site (Site 04). Access attempts to other sites return HTTP 403 Forbidden.
- **Occupational Health Lead:** Multi-site operational access permitted.
- **District Public Health Officer:** District-level aggregates.
- **Regulator View:** Compliance metrics, reporting health, and playbooks only. Granular syndromic health counts are masked across all endpoints.

---

## 4. Audit Events

The governance view demonstrates audit events for alert access and role switching. Example entries include:
- `timestamp`: UTC ISO 8601 timestamp.
- `actorRole`: Active session role.
- `eventType`: `VIEW_ALERT`, `VIEW_PROTECTED_UNIT`, `ROLE_SWITCH`, etc.
- `resourceId`: Targeted entity.
- `ipMasked`: Anonymized subnet IP address.

## 5. Public site count analysis

The public workspace accepts only a known site, a fixed count category, and a CSV of dates and daily totals. The server rejects extra fields and removes counts below five before calculating baselines, thresholds and evidence. It returns neither report totals nor breakdowns that could reconstruct a withheld value. The report and evidence are held on the page until cleared or closed. Environmental provider requests include only configured site coordinates.

Accept, dismiss and structured note actions are stored in the reviewer’s browser. A saved entry contains the disposition or note code, a demonstration role, a timestamp and an alert key. The imported alert key is derived from already-suppressed evidence. Demo review entries have no shared audit store. Use the authenticated service and approved data controls for persistent operational ingestion. [Deployment modes](docs/deployment.md)
