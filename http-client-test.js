#!/usr/bin/env node

/**
 * HTTP Client Test for the Git CI/CD MCP Server
 * This demonstrates how to use the HTTP version of the MCP server
 */

import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:3000';

class HTTPMCPClient {
  constructor(baseUrl = SERVER_URL) {
    this.baseUrl = baseUrl;
  }

  async listTools() {
    try {
      const response = await fetch(`${this.baseUrl}/tools`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error listing tools:', error.message);
      throw error;
    }
  }

  async callTool(toolName, arguments = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: arguments
          }
        })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error calling tool ${toolName}:`, error.message);
      throw error;
    }
  }

  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking health:', error.message);
      throw error;
    }
  }
}

async function testHTTPMCP() {
  console.log('🧪 Testing HTTP MCP Server');
  console.log('=' .repeat(40));

  const client = new HTTPMCPClient();

  try {
    // Test health
    console.log('1. Testing health endpoint...');
    const health = await client.checkHealth();
    console.log('✅ Health:', health);

    // Test tools list
    console.log('\n2. Testing tools list...');
    const tools = await client.listTools();
    console.log(`✅ Found ${tools.result.tools.length} tools:`);
    tools.result.tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });

    // Test git status
    console.log('\n3. Testing git-status tool...');
    const status = await client.callTool('git-status', {
      repoPath: process.cwd()
    });
    console.log('✅ Git Status:', status.result.content[0].text);

    // Test git branch list
    console.log('\n4. Testing git-branch tool...');
    const branches = await client.callTool('git-branch', {
      action: 'list',
      repoPath: process.cwd()
    });
    console.log('✅ Branches:', branches.result.content[0].text);

    console.log('\n🎉 All HTTP MCP tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testHTTPMCP().catch(console.error);
}

export default HTTPMCPClient;

