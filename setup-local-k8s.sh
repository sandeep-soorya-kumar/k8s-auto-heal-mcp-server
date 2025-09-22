#!/bin/bash

# 🚀 Local Kubernetes Setup with kubeadm on macOS
# This script sets up a single-node Kubernetes cluster using kubeadm

set -e

echo "🚀 Starting Local Kubernetes Setup with kubeadm"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS. For Linux, use native kubeadm installation."
    exit 1
fi

print_status "Detected macOS system"

# Step 1: Install Docker Desktop
print_status "Step 1: Checking Docker Desktop installation..."

if ! command -v docker &> /dev/null; then
    print_warning "Docker not found. Please install Docker Desktop first:"
    echo "1. Download from: https://www.docker.com/products/docker-desktop/"
    echo "2. Install and start Docker Desktop"
    echo "3. Enable Kubernetes in Docker Desktop settings"
    echo "4. Re-run this script"
    exit 1
fi

if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

print_success "Docker is installed and running"

# Step 2: Install Homebrew if not present
print_status "Step 2: Checking Homebrew installation..."

if ! command -v brew &> /dev/null; then
    print_status "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    print_success "Homebrew is already installed"
fi

# Step 3: Install kubectl
print_status "Step 3: Installing kubectl..."

if ! command -v kubectl &> /dev/null; then
    brew install kubectl
    print_success "kubectl installed"
else
    print_success "kubectl is already installed"
    kubectl version --client
fi

# Step 4: Install kind (Kubernetes in Docker) as alternative to kubeadm on macOS
print_status "Step 4: Installing kind (Kubernetes in Docker)..."

if ! command -v kind &> /dev/null; then
    brew install kind
    print_success "kind installed"
else
    print_success "kind is already installed"
fi

# Step 5: Create kind cluster configuration
print_status "Step 5: Creating kind cluster configuration..."

cat > kind-config.yaml << EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: k8s-auto-heal-cluster
nodes:
- role: control-plane
  image: kindest/node:v1.28.0
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
  - containerPort: 30000
    hostPort: 30000
    protocol: TCP
  - containerPort: 30001
    hostPort: 30001
    protocol: TCP
  - containerPort: 30002
    hostPort: 30002
    protocol: TCP
EOF

print_success "Kind configuration created"

# Step 6: Create Kubernetes cluster
print_status "Step 6: Creating Kubernetes cluster..."

# Check if cluster already exists
if kind get clusters | grep -q "k8s-auto-heal-cluster"; then
    print_warning "Cluster 'k8s-auto-heal-cluster' already exists"
    read -p "Do you want to delete and recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deleting existing cluster..."
        kind delete cluster --name k8s-auto-heal-cluster
    else
        print_status "Using existing cluster"
    fi
fi

if ! kind get clusters | grep -q "k8s-auto-heal-cluster"; then
    print_status "Creating new cluster (this may take a few minutes)..."
    kind create cluster --config kind-config.yaml --wait 300s
    print_success "Kubernetes cluster created successfully!"
else
    print_success "Using existing cluster"
fi

# Step 7: Configure kubectl context
print_status "Step 7: Configuring kubectl context..."
kubectl config use-context kind-k8s-auto-heal-cluster
print_success "kubectl context configured"

# Step 8: Verify cluster
print_status "Step 8: Verifying cluster..."
kubectl cluster-info
kubectl get nodes
kubectl get pods -A

print_success "Cluster verification complete"

# Step 9: Install Helm
print_status "Step 9: Installing Helm..."

if ! command -v helm &> /dev/null; then
    brew install helm
    print_success "Helm installed"
else
    print_success "Helm is already installed"
    helm version
fi

# Step 10: Create monitoring namespace
print_status "Step 10: Creating monitoring namespace..."
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
print_success "Monitoring namespace created"

# Step 11: Install metrics-server for resource monitoring
print_status "Step 11: Installing metrics-server..."
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Patch metrics-server for kind
kubectl patch deployment metrics-server -n kube-system --type='json' -p='[
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/args/-",
    "value": "--kubelet-insecure-tls"
  },
  {
    "op": "add", 
    "path": "/spec/template/spec/containers/0/args/-",
    "value": "--kubelet-preferred-address-types=InternalIP"
  }
]'

print_success "Metrics-server installed and configured for kind"

# Step 12: Create cluster info summary
print_status "Step 12: Creating cluster summary..."

cat > cluster-info.md << EOF
# 🚀 Local Kubernetes Cluster Information

## Cluster Details
- **Name**: k8s-auto-heal-cluster
- **Type**: kind (Kubernetes in Docker)
- **Kubernetes Version**: v1.28.0
- **Nodes**: 1 (control-plane)

## Access Information
- **Context**: kind-k8s-auto-heal-cluster
- **API Server**: $(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')

## Port Mappings
- **HTTP**: localhost:80 → cluster:80
- **HTTPS**: localhost:443 → cluster:443
- **NodePort Range**: localhost:30000-30002 → cluster:30000-30002

## Useful Commands
\`\`\`bash
# Check cluster status
kubectl cluster-info

# View nodes
kubectl get nodes

# View all pods
kubectl get pods -A

# Access cluster dashboard (if installed)
kubectl proxy

# Delete cluster when done
kind delete cluster --name k8s-auto-heal-cluster
\`\`\`

## Next Steps
1. Deploy your K8s Auto-Heal MCP Server
2. Install Prometheus monitoring
3. Test the auto-healing functionality

## Troubleshooting
- If pods are not starting, check: \`kubectl describe pod <pod-name>\`
- If networking issues, restart Docker Desktop
- For metrics issues, wait 2-3 minutes for metrics-server to be ready
EOF

print_success "Cluster info saved to cluster-info.md"

echo ""
echo "🎉 =============================================="
echo "🎉 Kubernetes Cluster Setup Complete!"
echo "🎉 =============================================="
echo ""
print_success "Your local Kubernetes cluster is ready!"
echo ""
echo "📋 Quick Status Check:"
kubectl get nodes
echo ""
echo "🔗 Cluster Info:"
kubectl cluster-info
echo ""
echo "📝 Next steps:"
echo "1. Deploy your K8s Auto-Heal MCP Server: cd k8s-mcp-server && npm install"
echo "2. Install Prometheus: helm repo add prometheus-community https://prometheus-community.github.io/helm-charts"
echo "3. Test the system: kubectl get pods -n monitoring"
echo ""
echo "💡 To delete the cluster later: kind delete cluster --name k8s-auto-heal-cluster"
echo ""
print_success "Happy Kubernetes-ing! 🚀"
EOF
