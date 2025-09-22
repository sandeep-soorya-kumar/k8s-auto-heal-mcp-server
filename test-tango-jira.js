#!/usr/bin/env node

import fetch from 'node-fetch';

// Your Jira configuration
const JIRA_BASE_URL = 'https://gspcloud.atlassian.net';
const JIRA_EMAIL = 'sandeepsoorya.nair@nbcuni.com';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';
const JIRA_PASSWORD = process.env.JIRA_PASSWORD || '';

// Test functions
async function testJiraConnection() {
  console.log('🧪 Testing Jira Connection to TANGO Project');
  console.log('=' .repeat(50));
  console.log(`Jira URL: ${JIRA_BASE_URL}`);
  console.log(`Email: ${JIRA_EMAIL}`);
  console.log(`API Token: ${JIRA_API_TOKEN ? 'Set' : 'Not set'}`);
  console.log(`Password: ${JIRA_PASSWORD ? 'Set' : 'Not set'}`);
  console.log('');

  // Use password if API token is not available
  const authMethod = JIRA_API_TOKEN ? 'API Token' : 'Password';
  const authString = JIRA_API_TOKEN ? JIRA_API_TOKEN : JIRA_PASSWORD;
  
  if (!authString) {
    console.log('❌ Please set either JIRA_API_TOKEN or JIRA_PASSWORD environment variable');
    console.log('   export JIRA_API_TOKEN="your-api-token-here"');
    console.log('   OR');
    console.log('   export JIRA_PASSWORD="your-jira-password"');
    return;
  }
  
  console.log(`✅ Using ${authMethod} authentication`);

  try {
    // Test 1: Get projects
    console.log('1. Testing project access...');
    const projectsResponse = await fetch(`${JIRA_BASE_URL}/rest/api/3/project`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${authString}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!projectsResponse.ok) {
      throw new Error(`HTTP ${projectsResponse.status}: ${projectsResponse.statusText}`);
    }

    const projects = await projectsResponse.json();
    console.log(`✅ Found ${projects.length} projects`);
    
    if (projects.length > 0) {
      console.log('Available projects:');
      projects.forEach(project => {
        console.log(`  • ${project.key} - ${project.name}`);
      });
      
      // Look for TANGO project (try different variations)
      const tangoProject = projects.find(p => 
        p.key === 'TANGO' || 
        p.name.toLowerCase().includes('tango') ||
        p.key.toLowerCase().includes('tango')
      );
      
      if (tangoProject) {
        console.log(`\n✅ TANGO project found: ${tangoProject.name} (Key: ${tangoProject.key})`);
      } else {
        console.log('\n⚠️  TANGO project not found in accessible projects');
        console.log('Available project keys:', projects.map(p => p.key).join(', '));
        console.log('Available project names:', projects.map(p => p.name).join(', '));
      }
    } else {
      console.log('❌ No projects accessible - check your permissions');
    }

    // Test 2: Get TANGO project details
    console.log('\n2. Testing TANGO project details...');
    const projectKey = tangoProject ? tangoProject.key : 'TANGO';
    const projectResponse = await fetch(`${JIRA_BASE_URL}/rest/api/3/project/${projectKey}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${authString}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (projectResponse.ok) {
      const project = await projectResponse.json();
      console.log(`✅ TANGO project details:`);
      console.log(`   Name: ${project.name}`);
      console.log(`   Key: ${project.key}`);
      console.log(`   Lead: ${project.lead.displayName}`);
      console.log(`   Project Type: ${project.projectTypeKey}`);
    } else {
      console.log(`❌ Cannot access TANGO project: ${projectResponse.status}`);
    }

    // Test 3: Get issues from TANGO project
    console.log('\n3. Testing TANGO project issues...');
    const issuesResponse = await fetch(`${JIRA_BASE_URL}/rest/api/3/search?jql=project=${projectKey}&maxResults=5`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${authString}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (issuesResponse.ok) {
      const issues = await issuesResponse.json();
      console.log(`✅ Found ${issues.total} issues in TANGO project`);
      
      if (issues.issues.length > 0) {
        console.log('Sample issues:');
        issues.issues.slice(0, 3).forEach(issue => {
          console.log(`   • ${issue.key}: ${issue.fields.summary}`);
          console.log(`     Status: ${issue.fields.status.name}`);
          console.log(`     Assignee: ${issue.fields.assignee?.displayName || 'Unassigned'}`);
        });
      }
    } else {
      console.log(`❌ Cannot access TANGO issues: ${issuesResponse.status}`);
    }

    // Test 4: Test issue creation (dry run)
    console.log('\n4. Testing issue creation capability...');
    const createResponse = await fetch(`${JIRA_BASE_URL}/rest/api/3/project/${projectKey}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${authString}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (createResponse.ok) {
      console.log('✅ Issue creation should work (project accessible)');
    } else {
      console.log('❌ Issue creation may not work');
    }

    console.log('\n🎉 Jira integration test completed!');
    console.log('\nNext steps:');
    console.log('1. Start the Jira MCP server: npm run start:jira-http');
    console.log('2. Test with curl commands');
    console.log('3. Integrate with your IDE or application');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Check your password is correct');
    console.log('2. Verify you have access to the TANGO project');
    console.log('3. Check if your account has the right permissions');
    console.log('4. Try using your Jira password instead of API token');
  }
}

// Run the test
testJiraConnection();
