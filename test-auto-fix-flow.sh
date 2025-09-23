#!/bin/bash
set -euo pipefail

echo "🚀 Testing Auto-Fix Alert Flow"
echo "================================"

# Start the auto-fix MCP server in background
echo "1. Starting Auto-Fix MCP Server..."
node auto-fix-mcp-server.js &
AUTO_FIX_PID=$!
echo "   Auto-fix server PID: $AUTO_FIX_PID"

# Wait for server to start
sleep 3

# Start the webhook receiver for monitoring
echo "2. Starting Webhook Receiver for monitoring..."
python3 alert-webhook-receiver.py 5002 &
WEBHOOK_PID=$!
echo "   Webhook receiver PID: $WEBHOOK_PID"

# Wait for webhook receiver to start
sleep 2

echo "3. Creating test OOM pod to trigger auto-fix..."
# Create a pod that will consume memory and trigger OOM
kubectl create namespace oom-test --dry-run=client -o yaml | kubectl apply -f -

cat <<EOF | kubectl apply -f -
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
      # Consume memory gradually to trigger high memory alert first
      for i in \$(seq 1 10); do
        dd if=/dev/zero of=/dev/null bs=1M count=50
        echo "Consumed \$((i * 50))MB"
        sleep 2
      done
      # Then consume more aggressively to trigger OOM
      dd if=/dev/zero of=/dev/null bs=1M count=200
    resources:
      limits:
        memory: "128Mi"  # Low limit to trigger OOM
      requests:
        memory: "64Mi"
    restartPolicy: Always
EOF

echo "4. Waiting for pod to start and consume memory..."
kubectl wait --for=condition=ready pod/oom-test-pod -n oom-test --timeout=60s || true

echo "5. Monitoring for alerts and auto-fixes..."
echo "   - Check Prometheus alerts: http://localhost:9090/alerts"
echo "   - Check AlertManager: http://localhost:9090/alertmanager"
echo "   - Watch webhook receiver logs for auto-fix actions"
echo ""
echo "6. The auto-fix system will:"
echo "   - Detect OOM/high memory alerts"
echo "   - Find the corresponding Helm chart"
echo "   - Update memory limits in values.yaml"
echo "   - Commit and push changes to Git"
echo "   - ArgoCD will automatically sync the changes"
echo ""

# Monitor the pod status
echo "7. Monitoring pod status..."
kubectl get pods -n oom-test -w &
MONITOR_PID=$!

# Wait for user to stop
echo ""
echo "Press Ctrl+C to stop monitoring and cleanup..."
trap 'echo "Cleaning up..."; kill $AUTO_FIX_PID $WEBHOOK_PID $MONITOR_PID 2>/dev/null || true; kubectl delete pod oom-test-pod -n oom-test 2>/dev/null || true; exit 0' INT

# Keep script running
wait
