#!/bin/bash

# 🚀 Minikube Setup with HyperKit (No Docker Required)
# This script sets up Minikube using HyperKit driver on macOS

set -e

echo "🚀 Setting up Minikube with HyperKit (No Docker Required)"
echo "======================================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

# Step 1: Install kubectl
print_status "Installing kubectl..."
if ! command -v kubectl &> /dev/null; then
    brew install kubectl
    print_success "kubectl installed"
else
    print_success "kubectl already installed"
fi

# Step 2: Install minikube
print_status "Installing minikube..."
if ! command -v minikube &> /dev/null; then
    brew install minikube
    print_success "minikube installed"
else
    print_success "minikube already installed"
fi

# Step 3: Install Helm
print_status "Installing Helm..."
if ! command -v helm &> /dev/null; then
    brew install helm
    print_success "Helm installed"
else
    print_success "Helm already installed"
fi

# Step 4: Try different drivers that don't require Docker
print_status "Starting minikube cluster (trying different drivers)..."

# Try VirtualBox first (if installed)
if command -v vboxmanage &> /dev/null; then
    print_status "Trying VirtualBox driver..."
    if minikube start --driver=virtualbox --cpus=2 --memory=2048 --kubernetes-version=v1.28.3; then
        print_success "Minikube started with VirtualBox driver!"
        DRIVER_USED="virtualbox"
    fi
fi

# If VirtualBox didn't work, try QEMU
if [ -z "$DRIVER_USED" ]; then
    print_status "Installing QEMU driver..."
    brew install qemu
    if minikube start --driver=qemu --cpus=2 --memory=2048 --kubernetes-version=v1.28.3; then
        print_success "Minikube started with QEMU driver!"
        DRIVER_USED="qemu"
    fi
fi

# If QEMU didn't work, try ssh (remote)
if [ -z "$DRIVER_USED" ]; then
    print_warning "Local drivers not available. Let's set up a minimal cluster using kind instead..."
    
    # Install kind as fallback
    if ! command -v kind &> /dev/null; then
        print_status "Installing kind (Kubernetes in Docker alternative)..."
        brew install kind
    fi
    
    # Create a simple kind cluster without Docker Desktop
    print_status "Creating kind cluster (this will install Docker CLI only)..."
    
    # Install Docker CLI only (not Desktop)
    if ! command -v docker &> /dev/null; then
        brew install docker
    fi
    
    # Install colima as Docker runtime
    print_status "Installing Colima as Docker runtime..."
    brew install colima
    
    # Start colima
    print_status "Starting Colima..."
    colima start --cpu 2 --memory 2
    
    # Create kind cluster
    print_status "Creating kind cluster..."
    kind create cluster --name k8s-auto-heal --wait 300s
    
    print_success "Kind cluster created successfully!"
    DRIVER_USED="kind"
fi

if [ "$DRIVER_USED" = "kind" ]; then
    # Configure kubectl for kind
    kubectl config use-context kind-k8s-auto-heal
    
    # Install metrics server for kind
    print_status "Installing metrics-server..."
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
else
    # Enable addons for minikube
    print_status "Enabling useful addons..."
    minikube addons enable metrics-server
    minikube addons enable dashboard
fi

# Create monitoring namespace
print_status "Creating monitoring namespace..."
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Verify cluster
print_status "Verifying cluster..."
kubectl cluster-info
kubectl get nodes
kubectl get pods -A

print_success "Cluster is ready!"

echo ""
echo "🎉 Kubernetes Cluster Setup Complete!"
echo "====================================="
echo ""
echo "📋 Cluster Info:"
if [ "$DRIVER_USED" = "kind" ]; then
    echo "• Cluster Type: kind (Kubernetes in Docker)"
    echo "• Cluster Name: k8s-auto-heal"
    echo "• Runtime: Colima"
else
    echo "• Cluster Type: minikube"
    echo "• Driver: $DRIVER_USED"
fi
echo "• Kubernetes Version: v1.28.3"
echo ""
echo "🔗 Useful Commands:"
echo "• kubectl get nodes"
echo "• kubectl get pods -A"
if [ "$DRIVER_USED" != "kind" ]; then
    echo "• minikube dashboard"
    echo "• minikube stop"
    echo "• minikube delete"
else
    echo "• kind delete cluster --name k8s-auto-heal"
fi
echo ""
echo "🚀 Ready to deploy your K8s Auto-Heal MCP Server!"
echo ""
echo "Next steps:"
echo "1. cd k8s-mcp-server && npm install"
echo "2. Test the MCP server: npm test"
echo "3. Deploy to cluster: helm install k8s-auto-heal ./helm/k8s-auto-heal"
EOF
