#!/usr/bin/env node

/**
 * 🧪 Test Suite for K8s Auto-Heal MCP Server
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';

console.log('🧪 K8s Auto-Heal MCP Server Test Suite\n');

// Test configuration
const tests = [
  {
    name: 'Scan Cluster Health',
    tool: 'scan-cluster-health',
    args: { timeRange: '1h' }
  },
  {
    name: 'Get Pod Crashes',
    tool: 'get-pod-crashes',
    args: {}
  },
  {
    name: 'Get OOM Events',
    tool: 'get-oom-events',
    args: { timeRange: '24h' }
  },
  {
    name: 'Analyze Resource Usage',
    tool: 'analyze-resource-usage',
    args: { resourceType: 'both' }
  },
  {
    name: 'Get Cluster Recommendations',
    tool: 'get-cluster-recommendations',
    args: { focusArea: 'all' }
  },
  {
    name: 'Get Healing History',
    tool: 'get-healing-history',
    args: { limit: 5 }
  }
];

// Test results
let passed = 0;
let failed = 0;

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`🔍 Testing: ${test.name}`);
    
    const mcpProcess = spawn('node', ['k8s-auto-heal-server.js'], {
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

    // Send MCP request
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: test.tool,
        arguments: test.args
      }
    };

    mcpProcess.stdin.write(JSON.stringify(request) + '\n');

    setTimeout(() => {
      mcpProcess.kill();
      
      if (output.includes('error') || errorOutput.length > 0) {
        console.log(`❌ FAILED: ${test.name}`);
        console.log(`   Error: ${errorOutput || 'Unknown error'}\n`);
        failed++;
      } else if (output.includes('result') || output.includes('content')) {
        console.log(`✅ PASSED: ${test.name}\n`);
        passed++;
      } else {
        console.log(`⚠️  TIMEOUT: ${test.name}\n`);
        failed++;
      }
      
      resolve();
    }, 5000); // 5 second timeout
  });
}

async function runAllTests() {
  console.log('Starting test suite...\n');
  
  // Check if Kubernetes is accessible
  try {
    const { execSync } = await import('child_process');
    execSync('kubectl cluster-info', { stdio: 'pipe' });
    console.log('✅ Kubernetes cluster is accessible\n');
  } catch (error) {
    console.log('❌ Kubernetes cluster is not accessible');
    console.log('   Make sure kubectl is configured and cluster is running\n');
    process.exit(1);
  }

  // Run all tests
  for (const test of tests) {
    await runTest(test);
  }

  // Print summary
  console.log('📊 Test Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed. Check the output above.');
    process.exit(1);
  }
}

// HTTP Server Tests
async function testHttpServer() {
  console.log('🌐 Testing HTTP Server...\n');
  
  try {
    const fetch = (await import('node-fetch')).default;
    
    // Test health endpoint
    const healthResponse = await fetch('http://localhost:8080/health');
    if (healthResponse.ok) {
      console.log('✅ Health endpoint working');
    } else {
      console.log('❌ Health endpoint failed');
    }

    // Test metrics endpoint
    const metricsResponse = await fetch('http://localhost:8080/metrics');
    if (metricsResponse.ok) {
      console.log('✅ Metrics endpoint working');
    } else {
      console.log('❌ Metrics endpoint failed');
    }

    // Test cluster scan API
    const scanResponse = await fetch('http://localhost:8080/api/scan-cluster-health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeRange: '1h' })
    });
    
    if (scanResponse.ok) {
      console.log('✅ Cluster scan API working');
    } else {
      console.log('❌ Cluster scan API failed');
    }

  } catch (error) {
    console.log('❌ HTTP server not running or not accessible');
    console.log('   Start it with: npm run start:http');
  }
}

// Main execution
if (process.argv.includes('--http')) {
  testHttpServer();
} else {
  runAllTests();
}
