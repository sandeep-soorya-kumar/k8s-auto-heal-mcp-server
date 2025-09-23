# 🚀 Automatic Helm Chart Deployment

This repository is configured for **automatic deployment** of any Helm chart to your Kubernetes cluster via ArgoCD.

## How It Works

### 1. **Automatic Detection**
- When you push changes to any `helm/` directory, GitHub Actions automatically detects new or modified Helm charts
- The workflow triggers on pushes to `main` branch that affect `helm/**` files

### 2. **ArgoCD Application Creation**
- GitHub Actions generates ArgoCD Application YAML for each detected chart
- Applications are automatically deployed to your cluster
- Each chart gets its own namespace: `{chart-name}-system`

### 3. **Continuous Management**
- Once deployed, ArgoCD takes over and manages the application
- ArgoCD monitors your Git repository for changes
- Any updates to `values.yaml` or chart files are automatically synced

## Quick Start

### 1. Setup Cluster Access (One-time)
```bash
# Run this script to configure GitHub Actions access to your cluster
./scripts/setup-github-actions-cluster.sh
```

This will:
- Create a service account for GitHub Actions
- Generate a kubeconfig with proper permissions
- Output instructions for adding the `KUBE_CONFIG` secret to GitHub

### 2. Add GitHub Secret
1. Go to your GitHub repository → Settings → Secrets and variables → Actions
2. Add a new repository secret:
   - **Name**: `KUBE_CONFIG`
   - **Value**: (The base64-encoded kubeconfig from step 1)

### 3. Deploy Any Chart
Simply add a Helm chart to the `helm/` directory:

```bash
# Example: Add a new chart
mkdir helm/my-app
# Add Chart.yaml, values.yaml, templates/ etc.
git add helm/my-app/
git commit -m "Add my-app Helm chart"
git push
```

**That's it!** GitHub Actions will automatically:
- ✅ Detect the new chart
- ✅ Create ArgoCD application
- ✅ Deploy to your cluster
- ✅ Set up continuous sync

## Chart Structure

Your Helm charts should follow this structure:
```
helm/
├── my-app/
│   ├── Chart.yaml          # Required
│   ├── values.yaml         # Required
│   └── templates/
│       ├── deployment.yaml
│       ├── service.yaml
│       └── _helpers.tpl
├── nginx/                  # Example chart
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
└── prometheus/             # Existing chart
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
```

## Deployment Details

### Automatic Namespace Creation
- Each chart is deployed to its own namespace: `{chart-name}-system`
- Namespaces are created automatically if they don't exist

### ArgoCD Configuration
Each application gets:
- **Automated sync**: `prune: true`, `selfHeal: true`
- **Namespace creation**: Automatic
- **Retry logic**: 5 retries with exponential backoff
- **Secret ignore**: Ignores differences in Secret data

### Example Generated ArgoCD Application
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/your-repo.git
    path: helm/my-app
    helm:
      valueFiles:
        - values.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: my-app-system
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

## Monitoring Deployments

### ArgoCD UI
```bash
# Port forward to access ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Open https://localhost:8080
```

### Command Line
```bash
# Check all applications
kubectl get applications -n argocd

# Check specific application
kubectl get application my-app -n argocd

# Check application status
kubectl describe application my-app -n argocd

# Check deployed resources
kubectl get pods -n my-app-system
```

## Manual Deployment (Alternative)

If you prefer manual control, you can still use the deployment script:

```bash
# Deploy a specific chart manually
./scripts/deploy-app.sh my-app helm/my-app

# With custom namespace
./scripts/deploy-app.sh my-app helm/my-app custom-namespace

# With custom values file
./scripts/deploy-app.sh my-app helm/my-app my-app-system custom-values.yaml
```

## Troubleshooting

### GitHub Actions Not Triggering
- Ensure you're pushing to the `main` branch
- Check that files are in the `helm/` directory
- Verify the `KUBE_CONFIG` secret is set correctly

### ArgoCD Not Syncing
- Check ArgoCD application status: `kubectl get application -n argocd`
- Verify repository access in ArgoCD UI
- Check ArgoCD logs: `kubectl logs -n argocd deployment/argocd-application-controller`

### Permission Issues
- Re-run the setup script: `./scripts/setup-github-actions-cluster.sh`
- Verify service account permissions: `kubectl auth can-i create applications --as=system:serviceaccount:argocd:github-actions`

## Examples

### Adding a New Application
```bash
# 1. Create chart structure
mkdir helm/redis
cd helm/redis

# 2. Add Chart.yaml
cat > Chart.yaml << EOF
apiVersion: v2
name: redis
description: Redis cache
version: 0.1.0
appVersion: "7.0"
EOF

# 3. Add values.yaml
cat > values.yaml << EOF
replicaCount: 1
image:
  repository: redis
  tag: "7.0"
service:
  port: 6379
EOF

# 4. Add basic templates
mkdir templates
cat > templates/deployment.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7.0
        ports:
        - containerPort: 6379
EOF

# 5. Commit and push
git add helm/redis/
git commit -m "Add Redis chart"
git push
# GitHub Actions will automatically deploy it!
```

## Benefits

✅ **Zero Manual Steps**: Just push your chart, everything else is automatic  
✅ **GitOps Compliant**: Git is the single source of truth  
✅ **Continuous Sync**: ArgoCD monitors and syncs changes automatically  
✅ **Scalable**: Works with any number of charts  
✅ **Secure**: Uses service accounts with minimal required permissions  
✅ **Observable**: Full visibility through ArgoCD UI and kubectl  

This setup gives you a complete GitOps workflow where any Helm chart you add to the `helm/` directory is automatically deployed and managed by ArgoCD!
