#!/bin/bash

# 🚀 Simple Minikube Setup for K8s Auto-Heal Testing
# This script sets up Minikube - easier than kubeadm on macOS

set -e

echo "🚀 Setting up Minikube for K8s Auto-Heal Testing"
echo "==============================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
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

# Step 4: Start minikube
print_status "Starting minikube cluster..."
minikube start --driver=docker --cpus=4 --memory=4096 --disk-size=20g --kubernetes-version=v1.28.3

print_success "Minikube cluster started!"

# Step 5: Enable addons
print_status "Enabling useful addons..."
minikube addons enable metrics-server
minikube addons enable dashboard
minikube addons enable ingress

print_success "Addons enabled"

# Step 6: Create monitoring namespace
print_status "Creating monitoring namespace..."
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Step 7: Verify cluster
print_status "Verifying cluster..."
kubectl cluster-info
kubectl get nodes
kubectl get pods -A

print_success "Cluster is ready!"

echo ""
echo "🎉 Minikube Setup Complete!"
echo "=========================="
echo ""
echo "📋 Cluster Info:"
echo "• Cluster Name: minikube"
echo "• Kubernetes Version: v1.28.3"
echo "• CPUs: 4"
echo "• Memory: 4GB"
echo "• Driver: Docker"
echo ""
echo "🔗 Useful Commands:"
echo "• kubectl get nodes"
echo "• kubectl get pods -A"
echo "• minikube dashboard"
echo "• minikube stop"
echo "• minikube delete"
echo ""
echo "🚀 Ready to deploy your K8s Auto-Heal MCP Server!"
EOF
