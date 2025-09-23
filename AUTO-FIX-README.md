# 🤖 Auto-Fix Alert System

This system automatically detects Kubernetes alerts and applies fixes by updating Helm charts and pushing changes to Git, which ArgoCD then syncs to the cluster.

## 🏗️ Architecture

```
Prometheus Alert → AlertManager → Webhook → Auto-Fix MCP Server → Git → ArgoCD → Kubernetes
```

## 🚀 Features

### Automatic Fixes for:
- **OOM (Out of Memory)**: Increases memory limits
- **High Memory Usage**: Scales memory limits by 50%
- **CrashLoopBackOff**: Restarts deployments
- **Custom Alerts**: Extensible for any alert type

### Auto-Fix Process:
1. **Alert Detection**: Prometheus detects issues
2. **Webhook Trigger**: AlertManager sends alert to auto-fix webhook
3. **Analysis**: MCP server analyzes alert and determines fix
4. **Helm Update**: Updates corresponding Helm chart values
5. **Git Commit**: Commits and pushes changes
6. **ArgoCD Sync**: ArgoCD automatically syncs changes to cluster

## 📁 Files

- `auto-fix-mcp-server.js` - Main MCP server with auto-fix logic
- `test-auto-fix-flow.sh` - Test script to demonstrate the flow
- `alert-webhook-receiver.py` - Webhook receiver for monitoring
- `helm/prometheus/values.yaml` - Updated with auto-fix webhook endpoints

## 🛠️ Setup

### 1. Install Dependencies
```bash
npm install express yaml
```

### 2. Start Auto-Fix MCP Server
```bash
node auto-fix-mcp-server.js
```

### 3. Start Webhook Receiver (for monitoring)
```bash
python3 alert-webhook-receiver.py 5002 &
```

### 4. Update AlertManager Configuration
The Prometheus values.yaml has been updated to include auto-fix webhooks:
- Critical alerts → `http://localhost:5003/webhook`
- Warning alerts → `http://localhost:5003/webhook`

## 🧪 Testing

### Run Complete Test Flow
```bash
./test-auto-fix-flow.sh
```

This will:
1. Start the auto-fix MCP server
2. Start webhook receiver
3. Create a test pod that triggers OOM
4. Monitor the auto-fix process

### Manual Test
```bash
# Create OOM test pod
kubectl create namespace oom-test
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
    - dd if=/dev/zero of=/dev/null bs=1M count=200
    resources:
      limits:
        memory: "128Mi"
      requests:
        memory: "64Mi"
EOF
```

## 🔧 MCP Tools

The auto-fix MCP server provides these tools:

### `receive_alert`
Processes Prometheus alerts and triggers appropriate fixes.

### `auto_fix_oom`
Automatically increases memory limits for OOM issues.

### `auto_fix_high_memory`
Increases memory limits for high memory usage.

### `auto_fix_crash_loop`
Restarts deployments experiencing CrashLoopBackOff.

### `get_helm_chart_path`
Finds the Helm chart path for a given application.

### `update_helm_values`
Updates Helm values and commits changes to Git.

## 📊 Monitoring

### Webhook Endpoints
- **Auto-fix**: `http://localhost:5003/webhook`
- **Monitoring**: `http://localhost:5002/webhook`

### Prometheus UI
- **Alerts**: `http://localhost:9090/alerts`
- **AlertManager**: `http://localhost:9090/alertmanager`

### ArgoCD UI
- **Applications**: `http://localhost:8080`

## 🎯 Example Auto-Fix Scenarios

### Scenario 1: OOM Alert
```
1. Pod gets OOMKilled
2. Prometheus fires "PodOOMKilled" alert
3. AlertManager sends webhook to auto-fix server
4. Auto-fix server:
   - Identifies the deployment
   - Finds corresponding Helm chart
   - Updates memory limits (e.g., 128Mi → 512Mi)
   - Commits changes to Git
5. ArgoCD syncs changes
6. Pod gets more memory and runs successfully
```

### Scenario 2: High Memory Usage
```
1. Pod memory usage > 80%
2. Prometheus fires "PodHighMemoryUsage" alert
3. Auto-fix server:
   - Calculates new memory limit (current * 1.5)
   - Updates Helm values
   - Commits and pushes changes
4. ArgoCD syncs changes
5. Pod gets more memory before OOM
```

### Scenario 3: CrashLoopBackOff
```
1. Pod keeps crashing
2. Prometheus fires "PodCrashLoopBackOff" alert
3. Auto-fix server:
   - Restarts the deployment
   - Monitors rollout status
4. Pod starts running normally
```

## 🔒 Security Considerations

- Webhook endpoints are localhost-only
- Git operations use existing credentials
- No sensitive data is logged
- All changes are tracked in Git history

## 🚨 Troubleshooting

### Auto-fix not working?
1. Check if MCP server is running: `ps aux | grep auto-fix-mcp-server`
2. Check webhook connectivity: `curl http://localhost:5003/webhook`
3. Check Git credentials: `git config --list`
4. Check ArgoCD sync status: `kubectl get applications -n argocd`

### Alerts not firing?
1. Check Prometheus rules: `kubectl get prometheusrules -n monitoring`
2. Check AlertManager config: `kubectl get secret alertmanager-prometheus-monitoring-alertmanager -n monitoring -o yaml`
3. Check webhook receiver logs

### Git push failing?
1. Check Git remote: `git remote -v`
2. Check authentication: `git push --dry-run`
3. Check repository permissions

## 🎉 Benefits

- **Zero Downtime**: Automatic fixes without manual intervention
- **GitOps Compliant**: All changes tracked in Git
- **Scalable**: Handles multiple alerts simultaneously
- **Extensible**: Easy to add new alert types and fixes
- **Observable**: Full audit trail of all actions

## 🔮 Future Enhancements

- **Machine Learning**: Learn from successful fixes
- **Cost Optimization**: Balance performance vs cost
- **Multi-Cluster**: Support for multiple Kubernetes clusters
- **Custom Rules**: User-defined auto-fix rules
- **Slack Integration**: Notifications for auto-fix actions
