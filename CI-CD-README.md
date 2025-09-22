# 🚀 CI/CD Workflow Documentation

This repository contains GitHub Actions workflows for automated deployment of Prometheus monitoring stack to minikube clusters.

## 📋 Available Workflows

### 1. 🚀 Deploy to Minikube (`minikube-deploy.yml`)

**Triggers:**
- Push to `main` branch (when Helm chart files change)
- Pull requests to `main` branch
- Manual trigger with options

**Features:**
- ✅ Helm chart validation and linting
- ✅ Kubernetes manifest generation
- ✅ Automated deployment to minikube
- ✅ Health checks and verification
- ✅ Automatic cleanup on failure
- ✅ Service URL generation

**Usage:**
```bash
# Automatic deployment on push to main
git push origin main

# Manual deployment with options
# Go to GitHub Actions → Deploy to Minikube → Run workflow
```

### 2. 🏠 Local Development Deploy (`local-deploy.yml`)

**Triggers:**
- Manual trigger only (`workflow_dispatch`)

**Features:**
- 🎯 Environment-specific deployments (dev/staging/prod)
- 🎯 Custom namespace selection
- 🎯 Force reinstall option
- 🎯 Detailed deployment information

**Usage:**
```bash
# Go to GitHub Actions → Local Development Deploy → Run workflow
# Select your options:
# - Environment: development/staging/production
# - Namespace: default (or custom)
# - Force reinstall: true/false
```

### 3. 📦 Basic Prometheus Deploy (`prometheus-deploy.yml`)

**Triggers:**
- Push to `main` branch
- Pull requests to `main` branch

**Features:**
- ✅ Simple deployment workflow
- ✅ Basic validation
- ✅ Quick deployment

## 🔧 Workflow Configuration

### Environment Variables

All workflows use these environment variables:
- `HELM_CHART_PATH`: `./helm/prometheus`
- `NAMESPACE`: `default` (configurable in local-deploy)
- `RELEASE_NAME`: `prometheus`

### Helm Chart Configuration

The Prometheus Helm chart is configured to deploy to the `default` namespace:
```yaml
# helm/prometheus/values.yaml
forceNamespace: "default"
```

## 🚀 How to Use

### Automatic Deployment

1. **Make changes** to the Helm chart in `helm/prometheus/`
2. **Commit and push** to the `main` branch:
   ```bash
   git add helm/prometheus/values.yaml
   git commit -m "Update Prometheus configuration"
   git push origin main
   ```
3. **Monitor the workflow** in GitHub Actions tab
4. **Access your services** using the URLs provided in the workflow output

### Manual Deployment

1. **Go to GitHub Actions** in your repository
2. **Select the workflow** you want to run
3. **Click "Run workflow"**
4. **Configure options** (for local-deploy workflow)
5. **Monitor the execution**

### Accessing Deployed Services

After successful deployment, you can access:

```bash
# Prometheus UI
minikube service prometheus-server -n default

# Grafana Dashboard  
minikube service prometheus-grafana -n default

# Check pod status
kubectl get pods -n default

# Check services
kubectl get services -n default
```

## 🔍 Workflow Steps

### Validation Phase
1. **Checkout code** from repository
2. **Setup Helm** (v3.12.0)
3. **Lint Helm chart** for syntax errors
4. **Generate Kubernetes manifests** for validation

### Deployment Phase
1. **Setup kubectl** (v1.28.0)
2. **Install and start minikube** with Docker driver
3. **Configure kubectl** to use minikube context
4. **Create namespace** if it doesn't exist
5. **Deploy Prometheus** using Helm
6. **Verify deployment** and check pod status
7. **Run health checks** on deployed services

### Cleanup Phase
- **Automatic cleanup** of minikube cluster on failure
- **Artifact upload** of generated manifests

## 📊 Monitoring and Troubleshooting

### Check Workflow Status
1. Go to **Actions** tab in GitHub
2. Click on the specific workflow run
3. Check individual job status and logs

### Common Issues

**Helm Chart Validation Failed:**
- Check `helm/prometheus/values.yaml` syntax
- Run `helm lint ./helm/prometheus` locally

**Deployment Timeout:**
- Increase timeout in workflow (currently 10m)
- Check minikube resources (memory/CPU)

**Pod Not Ready:**
- Check pod logs: `kubectl logs <pod-name> -n default`
- Verify resource requirements

### Logs and Debugging

```bash
# Check workflow logs in GitHub Actions
# Or run locally for debugging:

# Start minikube
minikube start --driver=docker

# Deploy manually
helm upgrade --install prometheus ./helm/prometheus --namespace default --create-namespace --wait

# Check status
kubectl get pods -n default
kubectl get services -n default
```

## 🔄 GitOps Workflow

This setup implements a basic GitOps workflow:

1. **Code Changes** → Push to GitHub
2. **GitHub Actions** → Validates and deploys
3. **Minikube Cluster** → Receives updated configuration
4. **Monitoring** → Prometheus/Grafana available

## 🎯 Next Steps

To enhance this CI/CD setup, consider:

1. **ArgoCD Integration** for advanced GitOps
2. **Multi-environment** support (dev/staging/prod)
3. **Security scanning** in the pipeline
4. **Notification** integration (Slack/Teams)
5. **Rollback** capabilities
6. **Performance testing** in the pipeline

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Helm Documentation](https://helm.sh/docs/)
- [Minikube Documentation](https://minikube.sigs.k8s.io/docs/)
- [Prometheus Helm Chart](https://github.com/prometheus-community/helm-charts)
