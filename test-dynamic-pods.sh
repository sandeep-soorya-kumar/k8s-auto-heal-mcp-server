#!/bin/bash

echo "🧪 Testing Dynamic Pod Loading in Alert UI"
echo "=========================================="

# Check if UI server is running
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ UI server is running"
else
    echo "❌ UI server is not running"
    exit 1
fi

# Check if webhook server is running
if curl -s http://localhost:5004/health > /dev/null; then
    echo "✅ Webhook server is running"
else
    echo "❌ Webhook server is not running"
    exit 1
fi

echo ""
echo "📊 Current pods in cluster:"
curl -s "http://localhost:3000/api/cluster/pods" | jq -r '.pods[] | "  - \(.name) (\(.namespace)) - \(.status)"'

echo ""
echo "🎯 Testing pod selection workflow:"

# Get the current CPU stress pod
CPU_POD=$(curl -s "http://localhost:3000/api/cluster/pods" | jq -r '.pods[] | select(.namespace == "cpu-stress-system") | .name')
CPU_NAMESPACE=$(curl -s "http://localhost:3000/api/cluster/pods" | jq -r '.pods[] | select(.namespace == "cpu-stress-system") | .namespace')

if [ "$CPU_POD" != "null" ] && [ -n "$CPU_POD" ]; then
    echo "✅ Found CPU stress pod: $CPU_POD in namespace: $CPU_NAMESPACE"
    
    echo ""
    echo "🚨 Testing alert trigger with dynamic pod:"
    
    # Test alert trigger
    ALERT_RESPONSE=$(curl -s -X POST http://localhost:5004/webhook \
      -H "Content-Type: application/json" \
      -H "Origin: http://localhost:3000" \
      -d "{
        \"receiver\": \"critical-alerts\",
        \"status\": \"firing\",
        \"alerts\": [
          {
            \"status\": \"firing\",
            \"labels\": {
              \"alertname\": \"TestAlert\",
              \"severity\": \"info\",
              \"pod\": \"$CPU_POD\",
              \"namespace\": \"$CPU_NAMESPACE\",
              \"container\": \"cpu-stress\",
              \"service\": \"kubernetes\"
            },
            \"annotations\": {
              \"summary\": \"Test alert for dynamic pod loading\",
              \"description\": \"Testing alert trigger with dynamically loaded pod: $CPU_POD\",
              \"runbook_url\": \"https://kubernetes.io/docs/\"
            },
            \"startsAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
          }
        ]
      }")
    
    if echo "$ALERT_RESPONSE" | grep -q "success"; then
        echo "✅ Alert trigger test successful with dynamic pod"
        echo "📋 Response: $(echo "$ALERT_RESPONSE" | jq -r '.message' 2>/dev/null || echo 'Alert processed')"
    else
        echo "❌ Alert trigger test failed"
        echo "📋 Response: $ALERT_RESPONSE"
    fi
else
    echo "❌ No CPU stress pod found in cluster"
fi

echo ""
echo "🌐 UI Features:"
echo "  - Dynamic pod loading from Kubernetes API"
echo "  - Auto-refresh every 30 seconds"
echo "  - Manual refresh button"
echo "  - Namespace auto-fill when pod is selected"
echo "  - Real-time pod status updates"
echo ""
echo "💡 Access the updated UI at:"
echo "  - Main UI: http://localhost:3000"
echo "  - Dashboard: http://localhost:3000/dashboard.html"
echo ""
echo "🎯 The UI now automatically:"
echo "  1. Fetches current running pods from the cluster"
echo "  2. Updates the dropdown with live pod names"
echo "  3. Auto-fills namespace when pod is selected"
echo "  4. Refreshes pod list every 30 seconds"
echo "  5. Shows loading indicators and pod counts"
