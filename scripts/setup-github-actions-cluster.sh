#!/bin/bash

# 🔧 Setup GitHub Actions Cluster Access
# This script configures your cluster for GitHub Actions deployment

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

print_status "🔧 Setting up GitHub Actions cluster access..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster"
    print_error "Make sure your cluster is running and kubectl is configured"
    exit 1
fi

print_success "✅ Kubernetes cluster is accessible"

# Get cluster info
CLUSTER_NAME=$(kubectl config current-context)
print_status "📋 Current cluster: $CLUSTER_NAME"

# Create service account for GitHub Actions
print_status "👤 Creating service account for GitHub Actions..."

kubectl apply -f - << EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: github-actions
  namespace: argocd
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: github-actions-deployer
rules:
- apiGroups: ["argoproj.io"]
  resources: ["applications"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get", "list", "watch", "create"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods", "services", "configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: github-actions-deployer
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: github-actions-deployer
subjects:
- kind: ServiceAccount
  name: github-actions
  namespace: argocd
EOF

print_success "✅ Service account and RBAC created"

# Get the service account token
print_status "🔑 Getting service account token..."

# Create a token secret for the service account
kubectl apply -f - << EOF
apiVersion: v1
kind: Secret
metadata:
  name: github-actions-token
  namespace: argocd
  annotations:
    kubernetes.io/service-account.name: github-actions
type: kubernetes.io/service-account-token
EOF

# Wait for token to be created
print_status "⏳ Waiting for token to be created..."
sleep 5

# Get the token
TOKEN=$(kubectl get secret github-actions-token -n argocd -o jsonpath='{.data.token}' | base64 -d)

if [ -z "$TOKEN" ]; then
    print_error "Failed to get service account token"
    exit 1
fi

print_success "✅ Service account token obtained"

# Get cluster info for kubeconfig
CLUSTER_SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
CLUSTER_CA=$(kubectl config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')

# Generate kubeconfig for GitHub Actions
print_status "📝 Generating kubeconfig for GitHub Actions..."

KUBECONFIG_CONTENT=$(cat << EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: $CLUSTER_CA
    server: $CLUSTER_SERVER
  name: colima-cluster
contexts:
- context:
    cluster: colima-cluster
    user: github-actions
    namespace: argocd
  name: github-actions-context
current-context: github-actions-context
users:
- name: github-actions
  user:
    token: $TOKEN
EOF
)

# Encode kubeconfig for GitHub secrets
KUBECONFIG_B64=$(echo "$KUBECONFIG_CONTENT" | base64 -w 0)

print_success "✅ Kubeconfig generated and encoded"

echo ""
print_success "🎯 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Go to your GitHub repository settings"
echo "2. Navigate to Settings → Secrets and variables → Actions"
echo "3. Add a new repository secret:"
echo "   - Name: KUBE_CONFIG"
echo "   - Value: $KUBECONFIG_B64"
echo ""
echo "🔐 The KUBE_CONFIG secret contains:"
echo "   - Cluster connection details"
echo "   - Service account token with deployment permissions"
echo "   - Access to ArgoCD applications and namespaces"
echo ""
echo "🚀 After adding the secret, your GitHub Actions will be able to:"
echo "   - Connect to your cluster"
echo "   - Create ArgoCD applications"
echo "   - Deploy new Helm charts automatically"
echo ""
print_warning "⚠️  Keep the KUBE_CONFIG secret secure and never commit it to your repository!"

# Test the setup
print_status "🧪 Testing the setup..."
if kubectl auth can-i create applications --as=system:serviceaccount:argocd:github-actions -n argocd; then
    print_success "✅ Service account has correct permissions"
else
    print_warning "⚠️  Service account permissions may need adjustment"
fi
