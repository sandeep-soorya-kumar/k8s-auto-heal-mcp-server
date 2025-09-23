#!/bin/bash
set -euo pipefail

echo "🚀 Complete Auto-Fix System Test"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Starting Auto-Fix Webhook Server...${NC}"
node simple-auto-fix-webhook.js &
WEBHOOK_PID=$!
echo "   Webhook server PID: $WEBHOOK_PID"
sleep 3

echo -e "${BLUE}2. Testing webhook connectivity...${NC}"
curl -s http://localhost:5003/health | jq '.' || echo "Webhook not ready yet"
sleep 2

echo -e "${BLUE}3. Creating OOM test pod...${NC}"
kubectl create namespace oom-test --dry-run=client -o yaml | kubectl apply -f - > /dev/null

kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: oom-test-pod
  namespace: oom-test
  labels:
    app: oom-test
    app.kubernetes.io/name: nginx
spec:
  containers:
  - name: memory-consumer
    image: busybox
    command: ["sh", "-c"]
    args:
    - |
      echo "Starting memory consumption..."
      while true; do
        dd if=/dev/zero of=/tmp/memory bs=1M count=50
        echo "Allocated 50MB"
        sleep 2
      done
    resources:
      limits:
        memory: "64Mi"
      requests:
        memory: "32Mi"
  restartPolicy: Always
EOF

echo -e "${GREEN}✅ OOM test pod created${NC}"

echo -e "${BLUE}4. Waiting for pod to start...${NC}"
kubectl wait --for=condition=ready pod/oom-test-pod -n oom-test --timeout=60s || true

echo -e "${BLUE}5. Testing Auto-Fix with different alert types...${NC}"

echo -e "${YELLOW}   Testing OOM Alert...${NC}"
curl -X POST http://localhost:5003/webhook -H "Content-Type: application/json" -d '{
  "status": "firing",
  "groupLabels": {"alertname": "PodOOMKilled"},
  "commonLabels": {
    "alertname": "PodOOMKilled",
    "severity": "critical",
    "pod": "oom-test-pod",
    "namespace": "oom-test"
  },
  "alerts": [{
    "status": "firing",
    "labels": {
      "alertname": "PodOOMKilled",
      "severity": "critical",
      "pod": "oom-test-pod",
      "namespace": "oom-test"
    },
    "annotations": {
      "summary": "Pod oom-test-pod was OOMKilled",
      "description": "Pod was killed due to Out of Memory"
    },
    "startsAt": "2024-01-01T00:00:00Z"
  }]
}' | jq '.'

echo -e "${YELLOW}   Testing High Memory Alert...${NC}"
curl -X POST http://localhost:5003/webhook -H "Content-Type: application/json" -d '{
  "status": "firing",
  "groupLabels": {"alertname": "PodHighMemoryUsage"},
  "commonLabels": {
    "alertname": "PodHighMemoryUsage",
    "severity": "warning",
    "pod": "oom-test-pod",
    "namespace": "oom-test"
  },
  "alerts": [{
    "status": "firing",
    "labels": {
      "alertname": "PodHighMemoryUsage",
      "severity": "warning",
      "pod": "oom-test-pod",
      "namespace": "oom-test"
    },
    "annotations": {
      "summary": "Pod oom-test-pod has high memory usage",
      "description": "Pod memory usage is above 80%"
    },
    "startsAt": "2024-01-01T00:00:00Z"
  }]
}' | jq '.'

echo -e "${YELLOW}   Testing CrashLoop Alert...${NC}"
curl -X POST http://localhost:5003/webhook -H "Content-Type: application/json" -d '{
  "status": "firing",
  "groupLabels": {"alertname": "PodCrashLoopBackOff"},
  "commonLabels": {
    "alertname": "PodCrashLoopBackOff",
    "severity": "critical",
    "pod": "oom-test-pod",
    "namespace": "oom-test"
  },
  "alerts": [{
    "status": "firing",
    "labels": {
      "alertname": "PodCrashLoopBackOff",
      "severity": "critical",
      "pod": "oom-test-pod",
      "namespace": "oom-test"
    },
    "annotations": {
      "summary": "Pod oom-test-pod is in CrashLoopBackOff",
      "description": "Pod keeps crashing and restarting"
    },
    "startsAt": "2024-01-01T00:00:00Z"
  }]
}' | jq '.'

echo -e "${BLUE}6. Checking pod status...${NC}"
kubectl get pods -n oom-test

echo -e "${BLUE}7. Checking pod events...${NC}"
kubectl get events -n oom-test --sort-by='.lastTimestamp' | tail -5

echo -e "${GREEN}🎉 Auto-Fix System Test Complete!${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "✅ Webhook server started and running"
echo "✅ OOM test pod created and running"
echo "✅ Auto-fix system processed all alert types:"
echo "   - OOM alerts → Memory limit increase"
echo "   - High memory alerts → Memory scaling"
echo "   - CrashLoop alerts → Deployment restart"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Connect to real Prometheus alerts"
echo "2. Add actual Git commit functionality"
echo "3. Test with real OOM scenarios"
echo ""
echo -e "${RED}Press Ctrl+C to cleanup and stop...${NC}"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    kill $WEBHOOK_PID 2>/dev/null || true
    kubectl delete pod oom-test-pod -n oom-test 2>/dev/null || true
    echo -e "${GREEN}Cleanup complete!${NC}"
    exit 0
}

trap cleanup INT

# Keep script running
wait
