# POSITION TRACKING

## Runtime inventory

Inventory / exposure is kept **in memory** while the process runs (same idea as the original Python bot).

## Prometheus

Metrics are served from:

`http://localhost:9305/metrics`

Useful series:

- `pm_mm_inventory`
- `pm_mm_exposure_usd`

If you change `METRICS_HOST` / `METRICS_PORT`, update the URL accordingly.
