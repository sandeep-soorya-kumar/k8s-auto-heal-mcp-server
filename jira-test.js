#!/usr/bin/env node

import { spawn } from 'child_process';
import fetch from 'node-fetch';

// Test configuration
const SERVER_URL = 'http://localhost:3001';
const TEST_PROJECT_KEY = 'TEST';
const TEST_ISSUE_KEY = 'TEST-123';

// Test utilities
function logTest(testName, status, details = '') {
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
  console.log(`${statusIcon} ${testName} - ${status}${details ? `: ${details}` : ''}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test functions
async function testHealthCheck() {
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    
    if (data.status === 'healthy') {
      logTest('Health Check', 'PASS');
      return true;
    } else {
      logTest('Health Check', 'FAIL', 'Server not healthy');
      return false;
    }
  } catch (error) {
    logTest('Health Check', 'FAIL', error.message);
    return false;
  }
}

async function testListTools() {
  try {
    const response = await fetch(`${SERVER_URL}/tools`);
    const data = await response.json();
    
    if (data.tools && data.tools.length > 0) {
      logTest('List Tools', 'PASS', `Found ${data.tools.length} tools`);
      return true;
    } else {
      logTest('List Tools', 'FAIL', 'No tools found');
      return false;
    }
  } catch (error) {
    logTest('List Tools', 'FAIL', error.message);
    return false;
  }
}

async function testGetProjects() {
  try {
    const response = await fetch(`${SERVER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'jira-get-projects', arguments: {} })
    });
    
    const data = await response.json();
    
    if (data.success) {
      logTest('Get Projects', 'PASS', `Found ${data.result.count} projects`);
      return true;
    } else {
      logTest('Get Projects', 'FAIL', data.error);
      return false;
    }
  } catch (error) {
    logTest('Get Projects', 'FAIL', error.message);
    return false;
  }
}

async function testGetProject() {
  try {
    const response = await fetch(`${SERVER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tool: 'jira-get-project', 
        arguments: { projectKey: TEST_PROJECT_KEY } 
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      logTest('Get Project', 'PASS', `Project: ${data.result.name}`);
      return true;
    } else {
      logTest('Get Project', 'FAIL', data.error);
      return false;
    }
  } catch (error) {
    logTest('Get Project', 'FAIL', error.message);
    return false;
  }
}

async function testGetIssues() {
  try {
    const response = await fetch(`${SERVER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tool: 'jira-get-issues', 
        arguments: { projectKey: TEST_PROJECT_KEY, maxResults: 10 } 
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      logTest('Get Issues', 'PASS', `Found ${data.result.total} issues`);
      return true;
    } else {
      logTest('Get Issues', 'FAIL', data.error);
      return false;
    }
  } catch (error) {
    logTest('Get Issues', 'FAIL', error.message);
    return false;
  }
}

async function testGetIssue() {
  try {
    const response = await fetch(`${SERVER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tool: 'jira-get-issue', 
        arguments: { issueKey: TEST_ISSUE_KEY } 
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      logTest('Get Issue', 'PASS', `Issue: ${data.result.key}`);
      return true;
    } else {
      logTest('Get Issue', 'FAIL', data.error);
      return false;
    }
  } catch (error) {
    logTest('Get Issue', 'FAIL', error.message);
    return false;
  }
}

async function testCreateIssue() {
  try {
    const response = await fetch(`${SERVER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tool: 'jira-create-issue', 
        arguments: { 
          projectKey: TEST_PROJECT_KEY,
          summary: 'Test Issue from MCP',
          description: 'This is a test issue created by the MCP server',
          issueType: 'Task',
          priority: 'Medium'
        }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      logTest('Create Issue', 'PASS', `Created: ${data.result.key}`);
      return true;
    } else {
      logTest('Create Issue', 'FAIL', data.error);
      return false;
    }
  } catch (error) {
    logTest('Create Issue', 'FAIL', error.message);
    return false;
  }
}

async function testAddComment() {
  try {
    const response = await fetch(`${SERVER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tool: 'jira-add-comment', 
        arguments: { 
          issueKey: TEST_ISSUE_KEY,
          comment: 'Test comment from MCP server'
        }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      logTest('Add Comment', 'PASS', 'Comment added successfully');
      return true;
    } else {
      logTest('Add Comment', 'FAIL', data.error);
      return false;
    }
  } catch (error) {
    logTest('Add Comment', 'FAIL', error.message);
    return false;
  }
}

async function testGetTransitions() {
  try {
    const response = await fetch(`${SERVER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tool: 'jira-get-transitions', 
        arguments: { issueKey: TEST_ISSUE_KEY } 
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      logTest('Get Transitions', 'PASS', `Found ${data.result.transitions.length} transitions`);
      return true;
    } else {
      logTest('Get Transitions', 'FAIL', data.error);
      return false;
    }
  } catch (error) {
    logTest('Get Transitions', 'FAIL', error.message);
    return false;
  }
}

async function testGetWorkflows() {
  try {
    const response = await fetch(`${SERVER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tool: 'jira-get-workflows', 
        arguments: {} 
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      logTest('Get Workflows', 'PASS', `Found ${data.result.workflows.length} workflows`);
      return true;
    } else {
      logTest('Get Workflows', 'FAIL', data.error);
      return false;
    }
  } catch (error) {
    logTest('Get Workflows', 'FAIL', error.message);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🧪 Testing Jira MCP HTTP Server');
  console.log('=' .repeat(50));
  
  const tests = [
    testHealthCheck,
    testListTools,
    testGetProjects,
    testGetProject,
    testGetIssues,
    testGetIssue,
    testCreateIssue,
    testAddComment,
    testGetTransitions,
    testGetWorkflows
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    const result = await test();
    if (result) passed++;
    await sleep(100); // Small delay between tests
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log(`📊 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check your Jira configuration.');
  }
}

// Run tests
runAllTests().catch(console.error);
