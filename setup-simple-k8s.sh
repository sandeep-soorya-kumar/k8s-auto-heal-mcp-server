#!/bin/bash

# 🚀 Simple Minikube Setup with containerd (No Docker, No Firewall)
# This script sets up a minimal Kubernetes cluster using containerd

set -e

echo "🚀 Setting up Simple Kubernetes with Minikube + containerd"
echo "========================================================"

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

# Step 4: Clean up any existing minikube cluster
print_status "Cleaning up any existing minikube cluster..."
minikube delete --all || true

# Step 5: Start minikube with containerd (no Docker required)
print_status "Starting minikube with containerd runtime..."
print_warning "This will use VirtualBox or HyperKit - no firewall permissions needed"

# Try different drivers in order of preference
DRIVERS=("virtualbox" "hyperkit" "vmware")
STARTED=false

for driver in "${DRIVERS[@]}"; do
    print_status "Trying driver: $driver"
    
    # Install driver if needed
    case $driver in
        "virtualbox")
            if ! command -v vboxmanage &> /dev/null; then
                print_status "Installing VirtualBox..."
                brew install --cask virtualbox || continue
            fi
            ;;
        "hyperkit")
            if ! command -v hyperkit &> /dev/null; then
                print_status "Installing HyperKit..."
                brew install hyperkit || continue
            fi
            ;;
        "vmware")
            if ! command -v vmrun &> /dev/null; then
                print_warning "VMware Fusion not found, skipping..."
                continue
            fi
            ;;
    esac
    
    # Try to start minikube with this driver
    if minikube start \
        --driver=$driver \
        --container-runtime=containerd \
        --cpus=2 \
        --memory=2048 \
        --disk-size=10g \
        --kubernetes-version=v1.28.3 \
        --extra-config=kubelet.container-runtime=remote \
        --extra-config=kubelet.container-runtime-endpoint=unix:///var/run/containerd/containerd.sock \
        --extra-config=kubelet.image-service-endpoint=unix:///var/run/containerd/containerd.sock; then
        
        print_success "Minikube started successfully with $driver driver and containerd!"
        STARTED=true
        break
    else
        print_warning "Failed to start with $driver driver, trying next..."
        minikube delete || true
    fi
done

if [ "$STARTED" = false ]; then
    print_error "Could not start minikube with any available driver"
    print_status "Trying one more time with auto-detection..."
    
    # Last attempt - let minikube choose the driver
    if minikube start \
        --container-runtime=containerd \
        --cpus=2 \
        --memory=2048 \
        --kubernetes-version=v1.28.3; then
        print_success "Minikube started with auto-selected driver!"
        STARTED=true
    else
        print_error "Failed to start minikube. Please check system requirements."
        exit 1
    fi
fi

# Step 6: Verify cluster
print_status "Verifying cluster..."
kubectl cluster-info
kubectl get nodes -o wide

# Step 7: Enable basic addons
print_status "Enabling essential addons..."
minikube addons enable metrics-server
minikube addons enable dashboard

# Step 8: Create monitoring namespace
print_status "Creating monitoring namespace..."
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Step 9: Test containerd
print_status "Verifying containerd runtime..."
kubectl get nodes -o wide | grep containerd && print_success "containerd runtime confirmed!" || print_warning "Runtime verification inconclusive"

# Step 10: Show cluster info
print_status "Getting cluster information..."
echo ""
echo "📋 Cluster Status:"
kubectl get nodes
echo ""
echo "📦 System Pods:"
kubectl get pods -n kube-system
echo ""
echo "🔧 Runtime Info:"
minikube ssh -- sudo crictl version 2>/dev/null || echo "containerd/crictl not accessible via ssh"

print_success "Kubernetes cluster is ready!"

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📋 Cluster Details:"
echo "• Runtime: containerd"
echo "• Kubernetes Version: v1.28.3"
echo "• CPUs: 2"
echo "• Memory: 2GB"
echo "• Driver: $(minikube profile list | grep minikube | awk '{print $4}' || echo 'auto-selected')"
echo ""
echo "🔗 Useful Commands:"
echo "• kubectl get nodes"
echo "• kubectl get pods -A"
echo "• minikube dashboard"
echo "• minikube ssh"
echo "• minikube stop"
echo "• minikube delete"
echo ""
echo "🚀 Next Steps:"
echo "1. Deploy your K8s Auto-Heal MCP Server"
echo "2. Test with: kubectl apply -f k8s-mcp-server/"
echo "3. Monitor with: minikube dashboard"
echo ""
print_success "Your containerd-based Kubernetes cluster is ready! 🎉"
EOF
