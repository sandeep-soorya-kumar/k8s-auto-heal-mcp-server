#!/usr/bin/env node

/**
 * Test script to deploy Prometheus using K8s MCP Server Helm tools
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

// Test data for MCP calls
const testCalls = [
  {
    name: "helm-repo-add",
    description: "Add Prometheus community repository",
    args: {
      name: "prometheus-community",
      url: "https://prometheus-community.github.io/helm-charts"
    }
  },
  {
    name: "helm-repo-update",
    description: "Update Helm repositories",
    args: {}
  },
  {
    name: "helm-list",
    description: "List current Helm releases",
    args: {
      allNamespaces: true
    }
  },
  {
    name: "helm-install",
    description: "Install Prometheus stack",
    args: {
      releaseName: "prometheus",
      chart: "prometheus-community/kube-prometheus-stack",
      namespace: "monitoring",
      createNamespace: true,
      wait: true,
      timeout: "10m",
      valuesFile: "./helm/prometheus-values.yaml"
    }
  }
];

console.log("🧪 Testing K8s MCP Server Helm Tools");
console.log("=====================================");

// Function to call MCP tools
async function callMCPTool(toolName, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔧 Calling tool: ${toolName}`);
    console.log(`📝 Args:`, JSON.stringify(args, null, 2));
    
    // Create MCP request
    const mcpRequest = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };
    
    // Start K8s MCP server process
    const mcpProcess = spawn('node', ['k8s-mcp-server/k8s-auto-heal-server.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    mcpProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    mcpProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    mcpProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Tool completed successfully`);
        console.log(`📤 Output:`, output);
        resolve(output);
      } else {
        console.log(`❌ Tool failed with code: ${code}`);
        console.log(`📤 Error:`, errorOutput);
        reject(new Error(`Tool failed: ${errorOutput}`));
      }
    });
    
    // Send MCP request
    mcpProcess.stdin.write(JSON.stringify(mcpRequest) + '\n');
    mcpProcess.stdin.end();
    
    // Set timeout
    setTimeout(() => {
      mcpProcess.kill();
      reject(new Error('Timeout'));
    }, 60000); // 60 second timeout
  });
}

// Run tests sequentially
async function runTests() {
  for (const testCall of testCalls) {
    try {
      console.log(`\n🎯 ${testCall.description}`);
      await callMCPTool(testCall.name, testCall.args);
      console.log(`✅ ${testCall.description} - SUCCESS`);
    } catch (error) {
      console.log(`❌ ${testCall.description} - FAILED: ${error.message}`);
      
      // Don't stop on individual failures, continue with next test
      if (testCall.name === 'helm-install') {
        console.log("⚠️  Prometheus installation failed, but continuing...");
      }
    }
    
    // Wait a bit between calls
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log("\n🏁 Test run completed!");
}

// Start tests
runTests().catch(console.error);


