# Canary detection engine model card

## Intended use

Canary is a prototype for occupational health, site safety, and public health teams reviewing aggregate respiratory, gastrointestinal, and heat-stress signals. An alert shows evidence and uncertainty so a qualified reviewer can decide whether to investigate. Individual diagnosis, employment decisions, and automated dispatch fall outside its intended use.

## Methods

The engine uses a negative-binomial baseline fitted on prior outcome counts, capped and weighted evidence terms, and a capped environmental prior for respiratory and heat scenarios. Correlated environmental inputs contribute a single maximum prior. Missing inputs contribute no term. Persistent evidence can raise the tier, while a spatial scan describes eligible areas and time windows. [Detection methods and evaluation protocol](docs/validation.md)

## Held-out simulation

| Detector | Event sensitivity | Alert precision | False alerts per site-month |
| --- | ---: | ---: | ---: |
| Canary fusion | 88.9% | 92.3% | 0.032 |
| Absence EARS C2 | 66.0% | 35.2% | 0.588 |
| Clinic CUSUM | 98.6% | 88.9% | 0.107 |
| Fixed exposure | 49.3% | 53.5% | 0.577 |

The evaluation uses 144 injected events across three held-out seeds. On events both methods detected, Canary led absence EARS C2 by one median day and trailed clinic CUSUM by one median day. These figures characterize a simulation. Clinical effectiveness and operational value require a prospective pilot. [Checked-in results](eval/reports/summary.json)

## Assumptions and pilot decisions

- Exposure-to-outcome relationships and reporting lags vary by scenario. The simulator uses generated patterns at daily resolution. A pilot needs actual data arrival timestamps and independent event labels.
- Clinic and workplace outcomes are synthetic. Environmental context can come from Open-Meteo CAMS and ECMWF feeds. Check location coverage and feed completeness before use.
- Impact estimates depend on the uptake and effectiveness values selected in the estimator. Treat them as scenario assumptions.
- The public website provides seeded scenarios and on-demand analysis under user-selectable demo roles. Sensitive deployments require authenticated organization and site scope, reviewed access rules, and a defined alert budget. [Deployment modes](docs/deployment.md)
- Set clinical and operational thresholds with reviewers before a shadow pilot. Document site definitions, expected reporting delays, and the review process. [Data and privacy](DATA_GOVERNANCE.md)

## On-demand site count analysis

The public workflow uses the previous 28 Dubai calendar days, with at least seven published counts of five or more. Counts under five and missing dates are excluded from fitting and scoring. The baseline is the mean of eligible prior counts. The spread is the maximum of the sample standard deviation, the square root of the mean and one count. Watch begins at the ceiling of the mean plus twice the spread. Alert requires the current day and at least one of the two previous calendar days to reach their own Watch thresholds. Action begins at the ceiling of the mean plus five times the spread.

This short-window method conditions on counts of at least five and can overstate the baseline for sparse series. It assumes comparable reporting scope and cannot adjust for changes in denominators, reporting practices or seasonality. Current regional weather and air-model values are displayed as review context. A missing latest count leaves the tier unavailable, with the historical baseline shown when available. The held-out fusion results above apply to the separate FastAPI detector. [Reviewer walkthrough](docs/deployment.md#reviewer-walkthrough)
