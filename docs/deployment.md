# Deploy Canary

## Vercel website

The public [Canary demo](https://canary-jatinjio1212-8258s-projects.vercel.app) runs on the `canary` Vercel project. The project uses Next.js, Node.js 24, the `frontend` root directory, and the `main` production branch. Pushes to `main` trigger production deployments through the Git integration.

The site includes simulated scenarios, on-demand CSV analysis, and live environmental context. The Next.js server needs outbound HTTPS access to `api.open-meteo.com` and `air-quality-api.open-meteo.com`. The public Open-Meteo endpoints need no API key for this demo. Each feed times out independently and the count-analysis workflow continues during an outage. The FastAPI engine runs as a separate service.

## Reviewer walkthrough

1. Open **Analyze site counts** from the surveillance room and select a site and count category.
2. Choose **Load sample**, upload a CSV, or paste data. The format is `date,count` followed by one record per reported Dubai calendar day. Use at least seven prior counts of 5 or more for the first assessment. The example produces an Alert with two elevated days.
3. Choose **Analyze counts**. Inspect the latest count, baseline, threshold explanation and daily evidence table.
4. In **Missing-feed comparison**, withhold the latest count to see the assessment become unavailable. Withhold a current environmental feed to see its effect on review context.
5. Accept the alert for follow-up, dismiss it, or record a structured note. The simulated alert inbox also reflects the decisions made on its examples in the same browser.

The public workflow accepts approved aggregate data only. The server processes a report on request and returns a suppressed, non-cacheable result. It does not write the CSV or derived counts to storage. Browser-local reviews keep a decision or a predefined note, a demo role, a timestamp and an opaque alert identifier. Site analysis is available to the OH Physician and the Site HSE Officer within their demonstration scopes. Use the authenticated FastAPI service for persistent private ingestion. [Data governance](../DATA_GOVERNANCE.md)

For a local production smoke test, run `npm ci`, `npm run build`, and `npm run start -- --port 3100` in `frontend`. In a second terminal, run `node scripts/smoke-surveillance.mjs` from the same directory.

## FastAPI backend

## Local demo

```bash
docker compose up --build --wait
curl --fail http://127.0.0.1:8000/healthz
```

Open Swagger UI at `http://127.0.0.1:8000/docs`. Demo startup generates both site and district snapshots. Wait for the health check before making replay requests. Demo ingest is disabled. GitHub Actions builds the container, checks health and exercises the respiratory replay.

## Hosted demo

The repository includes a [Render Blueprint](../render.yaml) for a free Docker web service running synthetic read-only mode. In a signed-in Render workspace, create a Blueprint and select the Canary repository. The service uses the provider's `PORT` and `/healthz` as its health check. After deploy, open `/docs` and `/replay/respiratory?day=16` on the assigned hostname. The free service's local audit database is ephemeral. [Render Docker setup](https://render.com/docs/docker) · [Blueprint reference](https://render.com/docs/blueprint-spec)

## Authenticated local or private operation

| Setting | Meaning |
| --- | --- |
| `CANARY_DEMO=0` | Start with only ingested counts and cached weather. Require bearer credentials. |
| `CANARY_API_KEYS` | JSON object mapping bearer keys of at least 24 ASCII characters to a unique `subject`, `role` and array of `units`. Set through a secret store or local environment. |
| `CANARY_DATABASE` | SQLite file path. Defaults to `var/canary.sqlite`. Use a restricted persistent volume and a single API worker. |
| `CANARY_WEATHER_CACHE` | Parquet path. Defaults to `var/weather.parquet`. |
| `CANARY_SUPPRESSION_K` | Small-cell threshold. Defaults to 5. |
| `CANARY_CORS_ORIGINS` | Comma-separated frontend origins. Authenticated mode requires explicit origins when serving a cross-origin frontend. |

Credential structure example, using placeholder values.

```json
{
  "replace-with-a-random-hse-secret": {
    "subject": "hse-al-ain-demo",
    "role": "site_hse",
    "units": ["site-07"]
  },
  "replace-with-a-random-feed-secret": {
    "subject": "al-ain-daily-feed",
    "role": "ingest",
    "units": ["site-07", "al-ain"]
  }
}
```

Fetch and cache forecast values. To fetch an archive range, provide both dates, up to 31 days per request.

```bash
uv run python -m backend.app.data.openmeteo
uv run python -m backend.app.data.openmeteo --start 2024-11-01 --end 2024-11-02
```

Schedule the forecast refresh on the same volume as the API. A newer Parquet file is picked up on the next scoped read. The cache includes the forecast horizon. The current scorer uses days through the current Asia/Dubai date. [Data source and retention details](data.md)
