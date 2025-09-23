#!/bin/bash

# 🚀 Deploy Application to Kubernetes via ArgoCD
# Usage: ./scripts/deploy-app.sh <app-name> <helm-path> [namespace] [values-file]

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

# Check if required parameters are provided
if [ $# -lt 2 ]; then
    print_error "Usage: $0 <app-name> <helm-path> [namespace] [values-file]"
    echo ""
    echo "Examples:"
    echo "  $0 nginx helm/nginx"
    echo "  $0 redis helm/redis redis-system"
    echo "  $0 postgres helm/postgres postgres-system custom-values.yaml"
    exit 1
fi

APP_NAME="$1"
HELM_PATH="$2"
NAMESPACE="${3:-${APP_NAME}-system}"
VALUES_FILE="${4:-values.yaml}"

print_status "🚀 Deploying application: $APP_NAME"
print_status "📁 Helm chart path: $HELM_PATH"
print_status "🏠 Target namespace: $NAMESPACE"
print_status "📄 Values file: $VALUES_FILE"

# Verify Helm chart exists
if [ ! -d "$HELM_PATH" ]; then
    print_error "Helm chart directory '$HELM_PATH' not found!"
    exit 1
fi

if [ ! -f "$HELM_PATH/Chart.yaml" ]; then
    print_error "Chart.yaml not found in '$HELM_PATH'!"
    exit 1
fi

if [ ! -f "$HELM_PATH/$VALUES_FILE" ]; then
    print_warning "Values file '$VALUES_FILE' not found in '$HELM_PATH'!"
    print_warning "Will use default values.yaml or chart defaults"
fi

print_success "Helm chart validation passed"

# Generate ArgoCD Application YAML
ARGOCD_APP_FILE="argocd-app-${APP_NAME}.yaml"

print_status "📋 Generating ArgoCD Application YAML..."

cat > "$ARGOCD_APP_FILE" << EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: $APP_NAME
  namespace: argocd
  labels:
    app.kubernetes.io/name: $APP_NAME
    app.kubernetes.io/part-of: argocd
    deployed-by: deploy-script
    deployed-at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
spec:
  project: default
  
  # Source configuration - from your GitHub repository
  source:
    repoURL: https://github.com/sandeep-soorya-kumar/k8s-auto-heal-mcp-server.git
    targetRevision: HEAD
    path: $HELM_PATH
    helm:
      valueFiles:
        - $VALUES_FILE
  
  # Destination configuration - where to deploy
  destination:
    server: https://kubernetes.default.svc
    namespace: $NAMESPACE
  
  # Sync policy configuration
  syncPolicy:
    automated:
      prune: true      # Remove resources that are no longer defined
      selfHeal: true   # Automatically sync when drift is detected
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true  # Create namespace if it doesn't exist
      - PrunePropagationPolicy=foreground
      - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  
  # Ignore differences in certain fields
  ignoreDifferences:
    - group: ""
      kind: Secret
      jsonPointers:
        - /data
EOF

print_success "Generated ArgoCD Application YAML: $ARGOCD_APP_FILE"

# Deploy to ArgoCD
print_status "🚀 Deploying to ArgoCD..."

if kubectl apply -f "$ARGOCD_APP_FILE"; then
    print_success "ArgoCD application created successfully!"
else
    print_error "Failed to create ArgoCD application!"
    exit 1
fi

# Check deployment status
print_status "📊 Checking deployment status..."
kubectl get application "$APP_NAME" -n argocd

echo ""
print_success "🎯 Deployment initiated successfully!"
echo ""
echo "📋 What happens next:"
echo "1. ✅ ArgoCD will automatically detect and sync the application"
echo "2. ✅ The application will be deployed to namespace: $NAMESPACE"
echo "3. ✅ ArgoCD will continue to monitor and sync any future changes"
echo ""
echo "🔗 View in ArgoCD UI: https://localhost:8080 (if port-forwarded)"
echo "📊 Monitor with: kubectl get application $APP_NAME -n argocd"
echo "🏠 Check namespace: kubectl get pods -n $NAMESPACE"

# Cleanup
print_status "🧹 Cleaning up temporary files..."
rm -f "$ARGOCD_APP_FILE"
print_success "Deployment script completed!"
