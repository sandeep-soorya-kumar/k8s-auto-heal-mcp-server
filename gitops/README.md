# 🚀 GitOps with ArgoCD

This directory contains ArgoCD application configurations for GitOps deployment.

## 📁 Directory Structure

```
gitops/
├── applications/          # ArgoCD Application definitions
│   └── prometheus-app.yaml
├── projects/             # ArgoCD Project definitions
│   └── default-project.yaml
└── README.md            # This file
```

## 🎯 Applications

### Prometheus Application
- **File**: `applications/prometheus-app.yaml`
- **Source**: GitHub repository
- **Path**: `node-basic-mcp-server/helm/prometheus`
- **Destination**: `monitoring` namespace
- **Sync Policy**: Automated with self-healing

## 🔧 ArgoCD Configuration

### Project Configuration
- **Name**: `default`
- **Source Repositories**: 
  - `https://github.com/sandeep-soorya-kumar/MCP-For-Beginners.git`
- **Destinations**: All namespaces in the cluster
- **Permissions**: Admin access for GitOps operations

## 🚀 Deployment Process

1. **ArgoCD monitors** the GitHub repository
2. **Detects changes** in the Helm chart
3. **Automatically syncs** changes to the cluster
4. **Self-heals** any drift from desired state

## 📊 Access ArgoCD

```bash
# Port forward to ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Access ArgoCD UI
open https://localhost:8080
```

## 🔄 GitOps Workflow

1. **Make changes** to Helm charts in the repository
2. **Commit and push** to GitHub
3. **ArgoCD detects** the changes automatically
4. **ArgoCD syncs** the changes to the cluster
5. **Monitor** the deployment in ArgoCD UI

## 🎯 Benefits

- ✅ **Automated deployments** from Git
- ✅ **Self-healing** applications
- ✅ **Rollback capabilities**
- ✅ **Visual monitoring** of deployments
- ✅ **Multi-environment** support
- ✅ **Audit trail** of all changes
