# 🚀 Kubernetes Auto-Heal MCP Server

## Overview

This is an **AI-powered Kubernetes cluster auto-healing and optimization system** built as a Model Context Protocol (MCP) server. It continuously monitors your Kubernetes cluster for issues like pod crashes, OOM events, and resource constraints, then automatically heals them by updating configurations and redeploying applications.

## 🎯 Key Features

### 🔍 **Intelligent Monitoring**
- **Pod Crash Detection**: Identifies pods with frequent restarts
- **OOM Event Tracking**: Monitors Out-of-Memory kills and patterns  
- **Resource Analysis**: Analyzes CPU/memory usage vs limits
- **Health Scanning**: Comprehensive cluster health assessments

### 🔧 **Auto-Healing Capabilities**
- **Dynamic Resource Updates**: Automatically increases memory/CPU limits
- **Helm Chart Updates**: Modifies Helm values and redeploys
- **Smart Scaling**: Adjusts resource limits based on usage patterns
- **Deployment Healing**: Fixes unhealthy deployments automatically

### 🤖 **AI Integration**
- **Natural Language Interface**: Talk to your cluster in plain English
- **Intelligent Recommendations**: AI-powered optimization suggestions
- **Pattern Recognition**: Learns from historical issues
- **Contextual Decisions**: Makes smart choices based on cluster state

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Assistant  │◄──►│  MCP Server      │◄──►│  Kubernetes     │
│   (Cursor/VS)   │    │  (Auto-Heal)     │    │  Cluster        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Prometheus     │
                       │   + Grafana      │
                       └──────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- **Kubernetes cluster** (Minikube, EKS, GKE, etc.)
- **Node.js 18+**
- **Helm 3+**
- **kubectl** configured
- **Docker** (for building images)

### 1. Install Dependencies

```bash
cd k8s-mcp-server
npm install
```

### 2. Configure Kubernetes Access

```bash
# Ensure kubectl is working
kubectl cluster-info

# Create monitoring namespace
kubectl create namespace monitoring
```

### 3. Deploy with GitHub Actions

The included GitHub Actions workflow will:
1. **Build** the Docker image and push to ECR
2. **Install** Prometheus stack for monitoring
3. **Deploy** the auto-heal server to Kubernetes
4. **Configure** monitoring and alerting
5. **Run** integration tests

```yaml
# Set these secrets in your GitHub repository:
AWS_ACCESS_KEY_ID: your-aws-access-key
AWS_SECRET_ACCESS_KEY: your-aws-secret-key
```

### 4. Manual Deployment (Alternative)

```bash
# Build Docker image
docker build -t k8s-auto-heal:latest -f k8s-mcp-server/Dockerfile .

# Deploy Prometheus
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values helm/prometheus-values.yaml

# Deploy Auto-Heal Server
helm install k8s-auto-heal ./helm/k8s-auto-heal \
  --namespace monitoring \
  --set image.repository=k8s-auto-heal \
  --set image.tag=latest
```

## 🛠️ MCP Tools Available

### 🔍 **Monitoring Tools**

#### `scan-cluster-health`
Comprehensive cluster health scan
```json
{
  "namespace": "default",
  "timeRange": "1h"
}
```

#### `get-pod-crashes`
Detailed pod crash analysis
```json
{
  "namespace": "default",
  "podName": "my-app-pod"
}
```

#### `get-oom-events`
OOMKilled events analysis
```json
{
  "namespace": "default",
  "timeRange": "24h"
}
```

#### `analyze-resource-usage`
Resource usage vs limits analysis
```json
{
  "namespace": "default",
  "resourceType": "both"
}
```

### 🔧 **Healing Tools**

#### `auto-heal-deployment`
Automatically heal deployment with resource updates
```json
{
  "deploymentName": "my-app",
  "namespace": "default",
  "resourceUpdates": {
    "memory": "512Mi",
    "cpu": "500m"
  },
  "dryRun": false
}
```

#### `update-helm-values`
Update Helm chart values
```json
{
  "chartPath": "./helm/my-app",
  "values": {
    "resources": {
      "limits": {
        "memory": "1Gi"
      }
    }
  },
  "dryRun": false
}
```

### 📊 **Analysis Tools**

#### `get-healing-history`
View auto-healing action history
```json
{
  "limit": 10
}
```

#### `get-cluster-recommendations`
AI-powered optimization recommendations
```json
{
  "namespace": "default",
  "focusArea": "resources"
}
```

## 🎮 Usage Examples

### With Cursor/VS Code + MCP

```
You: "My app keeps crashing, can you help?"

AI: *scans cluster* 
"I found your app has been OOMKilled 5 times. The current memory limit is 128Mi. Let me increase it to 256Mi and redeploy."

*auto-heals deployment*

"✅ Fixed! Memory increased to 256Mi and pod is now stable."
```

### HTTP API Usage

```bash
# Scan cluster health
curl -X POST http://localhost:8080/api/scan-cluster-health \
  -H "Content-Type: application/json" \
  -d '{"namespace": "default"}'

# Auto-heal a deployment
curl -X POST http://localhost:8080/api/auto-heal-deployment \
  -H "Content-Type: application/json" \
  -d '{
    "deploymentName": "my-app",
    "namespace": "default",
    "resourceUpdates": {"memory": "512Mi"}
  }'
```

## ⚙️ Configuration

### Environment Variables

```bash
# Monitoring settings
MONITORING_INTERVAL=30          # Scan interval in seconds
AUTO_HEAL_ENABLED=true         # Enable auto-healing
RESOURCE_MULTIPLIER=1.5        # Resource increase multiplier
MAX_RESOURCE_INCREASE=5.0      # Maximum increase factor

# Kubernetes settings
KUBE_NAMESPACE=monitoring      # Default namespace
PROMETHEUS_URL=http://prometheus:9090

# Server settings
MCP_SERVER_PORT=3000          # MCP server port
NODE_ENV=production           # Environment
```

### Helm Values

Key configuration options in `helm/k8s-auto-heal/values.yaml`:

```yaml
# Auto-healing policies
config:
  autoHeal:
    oomKilled:
      enabled: true
      memoryMultiplier: 1.5
    crashLoopBackOff:
      enabled: true
      restartThreshold: 5

# Resource limits
resources:
  limits:
    cpu: 1000m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

# Monitoring
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
```

## 📊 Monitoring & Dashboards

### Prometheus Metrics

The server exposes metrics at `/metrics`:
- `k8s_autoheal_scans_total` - Total health scans
- `k8s_autoheal_issues_found` - Issues detected
- `k8s_autoheal_actions_taken` - Healing actions performed
- `k8s_autoheal_success_rate` - Success rate of healing

### Grafana Dashboards

Pre-configured dashboards for:
- **Cluster Health Overview**
- **Pod Crash Analysis** 
- **Resource Usage Trends**
- **Auto-Healing Actions**

Access: `http://<minikube-ip>:3000` (admin/admin)

### Alerts

Configured Prometheus alerts:
- **PodCrashLooping** - Pod restarting frequently
- **PodOOMKilled** - Pod killed due to OOM
- **PodPending** - Pod stuck in pending state
- **HighMemoryUsage** - Memory usage > 80%
- **HighCPUUsage** - CPU usage > 80%

## 🔧 Development

### Running Locally

```bash
# Start STDIO MCP server
npm run start

# Start HTTP server
npm run start:http

# Development with auto-reload
npm run dev

# Run tests
npm test
```

### Testing

```bash
# Test cluster scanning
node test-k8s-server.js

# Create test OOM scenario
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: oom-test
spec:
  containers:
  - name: memory-hog
    image: busybox
    command: ["sh", "-c", "while true; do dd if=/dev/zero of=/tmp/memory bs=1M count=100; sleep 1; done"]
    resources:
      limits:
        memory: "50Mi"
EOF
```

## 🚨 Troubleshooting

### Common Issues

#### "Failed to load Kubernetes config"
```bash
# Check kubectl access
kubectl cluster-info

# Verify kubeconfig
echo $KUBECONFIG
```

#### "Permission denied" errors
```bash
# Check RBAC permissions
kubectl auth can-i get pods
kubectl auth can-i update deployments
```

#### "Auto-healing not working"
```bash
# Check if auto-heal is enabled
kubectl get configmap k8s-auto-heal-config -o yaml

# Verify environment variables
kubectl describe pod -l app=k8s-auto-heal
```

### Debug Mode

```bash
# Enable debug logging
export DEBUG=k8s-auto-heal:*

# Check server logs
kubectl logs -l app=k8s-auto-heal -f
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch
3. **Add** tests for new functionality
4. **Submit** a pull request

### Development Setup

```bash
git clone <your-fork>
cd k8s-auto-heal-mcp-server
npm install
npm run dev
```

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Kubernetes community** for the amazing ecosystem
- **Prometheus** team for monitoring excellence  
- **Helm** team for package management
- **MCP community** for the protocol specification

---

**🚀 Ready to make your Kubernetes cluster self-healing? Let's go!**
