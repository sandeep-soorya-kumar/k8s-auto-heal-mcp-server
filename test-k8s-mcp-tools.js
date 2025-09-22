#!/usr/bin/env node

/**
 * Test K8s MCP Server Tools
 * This script demonstrates using the K8s MCP server tools directly
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

console.log("🧪 Testing K8s MCP Server Tools");
console.log("===============================");

// Function to call MCP tools via stdin/stdout
async function callMCPTool(toolName, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔧 Calling: ${toolName}`);
    console.log(`📝 Args:`, JSON.stringify(args, null, 2));
    
    const child = spawn('node', ['k8s-mcp-server/k8s-auto-heal-server.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      // Look for MCP response
      if (text.includes('"content"')) {
        try {
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.trim() && line.includes('"content"')) {
              const response = JSON.parse(line);
              if (response.result && response.result.content) {
                console.log(`✅ ${toolName} completed`);
                console.log(`📤 Response:`, response.result.content[0].text);
                child.kill();
                resolve(response.result);
                return;
              }
            }
          }
        } catch (e) {
          // Continue processing
        }
      }
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    child.on('close', (code) => {
      if (code !== 0 && !output.includes('"content"')) {
        console.log(`❌ ${toolName} failed with code: ${code}`);
        console.log(`📤 Error:`, errorOutput);
        reject(new Error(`Tool failed: ${errorOutput}`));
      }
    });
    
    // Send MCP request
    const request = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };
    
    child.stdin.write(JSON.stringify(request) + '\n');
    
    // Set timeout
    setTimeout(() => {
      child.kill();
      reject(new Error('Timeout'));
    }, 30000);
  });
}

// Test sequence
async function runTests() {
  const tests = [
    // Basic kubectl commands
    {
      name: "kubectl-get",
      args: { resource: "nodes", output: "wide" },
      description: "Get cluster nodes"
    },
    {
      name: "kubectl-get",
      args: { resource: "pods", allNamespaces: true },
      description: "Get all pods"
    },
    {
      name: "kubectl-config",
      args: { action: "current-context" },
      description: "Get current context"
    },
    
    // Helm commands
    {
      name: "helm-repo-add",
      args: {
        name: "prometheus-community",
        url: "https://prometheus-community.github.io/helm-charts"
      },
      description: "Add Prometheus Helm repository"
    },
    {
      name: "helm-repo-update",
      args: {},
      description: "Update Helm repositories"
    },
    {
      name: "helm-list",
      args: { allNamespaces: true },
      description: "List all Helm releases"
    },
    
    // Deploy Prometheus
    {
      name: "helm-install",
      args: {
        releaseName: "prometheus",
        chart: "prometheus-community/kube-prometheus-stack",
        namespace: "monitoring",
        createNamespace: true,
        wait: false, // Don't wait to avoid timeout
        timeout: "15m",
        valuesFile: "../helm/prometheus-values.yaml"
      },
      description: "Install Prometheus stack"
    }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n🎯 ${test.description}`);
      await callMCPTool(test.name, test.args);
      console.log(`✅ ${test.description} - SUCCESS`);
    } catch (error) {
      console.log(`❌ ${test.description} - FAILED: ${error.message}`);
      
      // Continue with other tests even if one fails
      if (test.name !== 'helm-install') {
        continue;
      } else {
        console.log("⚠️  Prometheus installation may be running in background...");
      }
    }
    
    // Wait between calls
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Final status check
  console.log(`\n🔍 Final Status Check`);
  try {
    await callMCPTool("kubectl-get", {
      resource: "pods",
      namespace: "monitoring"
    });
  } catch (error) {
    console.log("ℹ️  Monitoring namespace may not be ready yet");
  }
  
  console.log("\n🏁 Test sequence completed!");
  console.log("\n📋 Next steps:");
  console.log("   • Check Prometheus deployment: kubectl get pods -n monitoring");
  console.log("   • Access Grafana: kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80");
  console.log("   • Access Prometheus: kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090");
}

// Start tests
runTests().catch(error => {
  console.error("💥 Test execution failed:", error.message);
  process.exit(1);
});
