#!/bin/bash
# Smoke test for the observability stack (Prometheus, Grafana, Jaeger).
# Checks that each tool is not just "container running" but actually doing
# its job: Prometheus is scraping targets successfully, Grafana's
# datasources auto-provisioned correctly, Jaeger's API responds. Run any
# time after `docker compose -f infra/docker-compose.yml up -d` to confirm
# the stack came up healthy - useful after a host reboot, a version bump,
# or a config change to prometheus.yml / datasources.yml.
set -e

echo "--- Prometheus targets (each should say 'up') ---"
curl -s http://localhost:9090/api/v1/targets \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
for t in d['data']['activeTargets']:
    print(t['labels']['job'], '->', t['health'], t['scrapeUrl'])
"

echo "--- Grafana health ---"
curl -s http://localhost:3001/api/health
echo ""

echo "--- Grafana provisioned datasources ---"
curl -s -u admin:"${GRAFANA_ADMIN_PASSWORD:-admin}" http://localhost:3001/api/datasources \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
for ds in d:
    print(ds['name'], '->', ds['type'], ds['url'])
"

echo "--- Jaeger API (traces list will be empty until a service sends one - see Phase 0 step 7) ---"
curl -s http://localhost:16686/api/services
echo ""
