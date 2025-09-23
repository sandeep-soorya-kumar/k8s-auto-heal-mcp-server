#!/bin/bash

# Test script for OOM alerts
# This script creates a test pod that will consume memory and potentially trigger OOM alerts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "🧪 Testing OOM Alert Rules"

# Create a test namespace
print_status "Creating test namespace..."
kubectl create namespace oom-test --dry-run=client -o yaml | kubectl apply -f -

# Create a test pod that will consume memory and potentially get OOMKilled
print_status "Creating test pod with low memory limit..."
cat << EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: oom-test-pod
  namespace: oom-test
  labels:
    app: oom-test
    prometheus.io/scrape: "true"
spec:
  containers:
  - name: memory-consumer
    image: busybox
    command: ["/bin/sh"]
    args: ["-c", "while true; do echo 'Consuming memory...'; dd if=/dev/zero of=/tmp/memory bs=1M count=100; sleep 1; done"]
    resources:
      requests:
        memory: "64Mi"
        cpu: "100m"
      limits:
        memory: "128Mi"  # Very low limit to trigger OOM
        cpu: "200m"
    ports:
    - containerPort: 8080
      name: http
  restartPolicy: Never
EOF

print_success "Test pod created successfully!"

print_status "📊 Monitoring the test pod..."
echo ""
echo "You can monitor the pod with these commands:"
echo "  kubectl get pods -n oom-test -w"
echo "  kubectl logs oom-test-pod -n oom-test -f"
echo "  kubectl describe pod oom-test-pod -n oom-test"
echo ""
echo "🔍 Check Prometheus alerts at: http://localhost:9090/alerts"
echo "📈 Check Prometheus targets at: http://localhost:9090/targets"
echo ""

# Wait a bit and check pod status
print_status "Waiting 30 seconds for pod to start..."
sleep 30

# Check pod status
POD_STATUS=$(kubectl get pod oom-test-pod -n oom-test -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")

if [ "$POD_STATUS" = "Running" ]; then
    print_success "Pod is running and consuming memory..."
    print_warning "The pod should eventually get OOMKilled due to low memory limit (128Mi)"
elif [ "$POD_STATUS" = "Failed" ]; then
    print_warning "Pod has failed - this might be due to OOMKilled!"
    print_status "Checking pod events..."
    kubectl describe pod oom-test-pod -n oom-test | grep -A 10 "Events:"
else
    print_status "Pod status: $POD_STATUS"
fi

echo ""
print_status "🧹 To clean up the test resources, run:"
echo "  kubectl delete namespace oom-test"
echo ""
print_status "📋 To check if alerts are firing, visit:"
echo "  http://localhost:9090/alerts"
echo ""
print_success "OOM alert test setup complete!"
