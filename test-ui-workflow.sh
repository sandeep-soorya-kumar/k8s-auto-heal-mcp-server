#!/bin/bash

echo "🚀 Testing Kubernetes Alert UI Workflow"
echo "========================================"

# Check if services are running
echo "📡 Checking services..."

# Check webhook server
if curl -s http://localhost:5004/health > /dev/null; then
    echo "✅ Webhook server (port 5004) is running"
else
    echo "❌ Webhook server (port 5004) is not running"
    echo "   Start it with: WEBHOOK_PORT=5004 node enhanced-auto-fix-webhook.js &"
fi

# Check UI server
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ UI server (port 3000) is running"
else
    echo "❌ UI server (port 3000) is not running"
    echo "   Start it with: UI_PORT=3000 node alert-ui-server.js &"
fi

echo ""
echo "🌐 Access the UI at:"
echo "   - Main UI: http://localhost:3000"
echo "   - Dashboard: http://localhost:3000/dashboard.html"
echo ""

# Test manual alert trigger
echo "🧪 Testing manual alert trigger..."
ALERT_RESPONSE=$(curl -s -X POST http://localhost:5004/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "receiver": "critical-alerts",
    "status": "firing",
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "TestAlert",
          "severity": "info",
          "pod": "test-pod",
          "namespace": "test-namespace",
          "container": "test-container",
          "service": "kubernetes"
        },
        "annotations": {
          "summary": "Test alert from UI workflow",
          "description": "This is a test alert triggered from the UI workflow script.",
          "runbook_url": "https://kubernetes.io/docs/"
        },
        "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
      }
    ]
  }')

if echo "$ALERT_RESPONSE" | grep -q "success"; then
    echo "✅ Manual alert trigger test successful"
    echo "📋 Response: $(echo "$ALERT_RESPONSE" | jq -r '.message' 2>/dev/null || echo 'Alert processed')"
else
    echo "❌ Manual alert trigger test failed"
    echo "📋 Response: $ALERT_RESPONSE"
fi

echo ""
echo "🎯 Next steps:"
echo "   1. Open http://localhost:3000 in your browser"
echo "   2. Select an alert type (e.g., PodHighCPUUsage)"
echo "   3. Choose a target pod from the dropdown"
echo "   4. Click 'Trigger Alert'"
echo "   5. Watch the auto-fix process in the background"
echo "   6. Check ArgoCD for Git changes and deployments"
echo ""
echo "💡 The UI will show:"
echo "   - Real-time cluster status"
echo "   - ArgoCD application health"
echo "   - Recent Git commits"
echo "   - Alert history and auto-fix results"
