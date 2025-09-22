#!/bin/bash

# Setup GitHub Secrets for Cluster Access
# This script helps you set up the KUBECONFIG secret in GitHub

echo "🔧 Setting up GitHub Secrets for Cluster Access"
echo "================================================"

# Get the current kubeconfig
echo "📋 Getting current kubeconfig..."
KUBECONFIG_CONTENT=$(kubectl config view --raw --minify)

# Encode the kubeconfig to base64
echo "🔐 Encoding kubeconfig to base64..."
KUBECONFIG_B64=$(echo "$KUBECONFIG_CONTENT" | base64 -w 0)

echo ""
echo "✅ KUBECONFIG ready for GitHub Secret!"
echo ""
echo "📝 Next steps:"
echo "1. Go to your GitHub repository: https://github.com/sandeep-soorya-kumar/MCP-For-Beginners"
echo "2. Click on 'Settings' tab"
echo "3. Click on 'Secrets and variables' → 'Actions'"
echo "4. Click 'New repository secret'"
echo "5. Name: KUBECONFIG"
echo "6. Value: (copy the base64 encoded content below)"
echo ""
echo "🔑 Base64 Encoded KUBECONFIG:"
echo "=============================="
echo "$KUBECONFIG_B64"
echo "=============================="
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "- This kubeconfig contains sensitive information"
echo "- Only add it to your private repository"
echo "- Consider using a service account with limited permissions"
echo "- Rotate the credentials regularly"
echo ""
echo "🚀 After adding the secret, your GitHub Actions will be able to deploy to your cluster!"
