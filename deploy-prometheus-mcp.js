#!/usr/bin/env node

/**
 * Deploy Prometheus using K8s MCP Server Helm tools
 */

import { execSync } from 'child_process';

console.log("🚀 Deploying Prometheus using K8s MCP Server");
console.log("===========================================");

// Helper function to run helm commands directly (since MCP server wraps them)
function runHelmCommand(description, command) {
  console.log(`\n🔧 ${description}`);
  console.log(`📝 Command: ${command}`);
  
  try {
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: ['pipe', 'pipe', 'pipe'] 
    });
    console.log(`✅ ${description} - SUCCESS`);
    console.log(`📤 Output:\n${result}`);
    return result;
  } catch (error) {
    console.log(`❌ ${description} - FAILED`);
    console.log(`📤 Error: ${error.message}`);
    if (error.stdout) console.log(`📤 Stdout: ${error.stdout}`);
    if (error.stderr) console.log(`📤 Stderr: ${error.stderr}`);
    throw error;
  }
}

async function deployPrometheus() {
  try {
    // Step 1: Add Prometheus repository
    runHelmCommand(
      "Add Prometheus community repository",
      "helm repo add prometheus-community https://prometheus-community.github.io/helm-charts"
    );
    
    // Step 2: Update repositories
    runHelmCommand(
      "Update Helm repositories",
      "helm repo update"
    );
    
    // Step 3: List current releases
    runHelmCommand(
      "List current Helm releases",
      "helm list --all-namespaces"
    );
    
    // Step 4: Install Prometheus stack
    const prometheusCommand = [
      "helm install prometheus prometheus-community/kube-prometheus-stack",
      "--namespace monitoring",
      "--values ./helm/prometheus-values.yaml", 
      "--create-namespace",
      "--wait",
      "--timeout 10m"
    ].join(' ');
    
    runHelmCommand(
      "Install Prometheus stack",
      prometheusCommand
    );
    
    // Step 5: Verify installation
    runHelmCommand(
      "Verify Prometheus installation",
      "helm list --namespace monitoring"
    );
    
    runHelmCommand(
      "Check Prometheus pods",
      "kubectl get pods -n monitoring"
    );
    
    console.log("\n🎉 Prometheus deployment completed successfully!");
    console.log("\n📋 Next steps:");
    console.log("   1. Access Grafana: kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80");
    console.log("   2. Access Prometheus: kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090");
    console.log("   3. Access AlertManager: kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-alertmanager 9093:9093");
    
  } catch (error) {
    console.log("\n💥 Deployment failed!");
    console.log(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Start deployment
deployPrometheus();

