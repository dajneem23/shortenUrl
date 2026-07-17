#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────
# Quick K6 test runner — requires k6 installed locally.
#
#   chmod +x k6/run.sh
#   ./k6/run.sh          # smoke test (3 VUs, 30s)
#   ./k6/run.sh load     # load test (50 VUs, 5min)
#   ./k6/run.sh stress   # stress test (ramp 0→200 VUs over 10min)
#
# Install k6: brew install k6
# ──────────────────────────────────────────────────────────────────────────

set -euo pipefail
MODE="${1:-smoke}"
BASE_URL="${BASE_URL:-http://localhost}"

case "$MODE" in
  smoke)
    echo "=== Smoke Test (3 VUs, 30s) ==="
    k6 run --vus 3 --duration 30s k6/smoke.js
    ;;
  load)
    echo "=== Load Test (50 VUs, 5min) ==="
    k6 run --vus 50 --duration 5m k6/load.js
    ;;
  stress)
    echo "=== Stress Test (ramp 0→200 VUs, 10min) ==="
    k6 run k6/stress.js
    ;;
  *)
    echo "Usage: $0 {smoke|load|stress}"
    exit 1
    ;;
esac
