#!/usr/bin/env node

import fetch from 'node-fetch';

// Your Jira configuration
const JIRA_BASE_URL = 'https://gspcloud.atlassian.net';
const JIRA_EMAIL = 'sandeepsoorya.nair@nbcuni.com';
const JIRA_PASSWORD = process.env.JIRA_PASSWORD || '';

console.log('🔍 Debugging Jira API Access');
console.log('=' .repeat(40));
console.log(`Jira URL: ${JIRA_BASE_URL}`);
console.log(`Email: ${JIRA_EMAIL}`);
console.log(`Password: ${JIRA_PASSWORD ? 'Set' : 'Not set'}`);
console.log('');

if (!JIRA_PASSWORD) {
  console.log('❌ Please set JIRA_PASSWORD environment variable');
  console.log('   export JIRA_PASSWORD="your-jira-password"');
  process.exit(1);
}

const authString = Buffer.from(`${JIRA_EMAIL}:${JIRA_PASSWORD}`).toString('base64');

async function testBasicAuth() {
  console.log('1. Testing basic authentication...');
  
  try {
    // Test with a simple endpoint first
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/myself`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const user = await response.json();
      console.log(`   ✅ Authentication successful!`);
      console.log(`   User: ${user.displayName} (${user.emailAddress})`);
      console.log(`   Account ID: ${user.accountId}`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Authentication failed`);
      console.log(`   Error: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`);
    return false;
  }
}

async function testProjectAccess() {
  console.log('\n2. Testing project access...');
  
  try {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/project`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const projects = await response.json();
      console.log(`   ✅ Found ${projects.length} projects`);
      
      if (projects.length > 0) {
        console.log('   Available projects:');
        projects.forEach(project => {
          console.log(`     • ${project.key} - ${project.name}`);
        });
        
        // Look for TANGO
        const tangoProject = projects.find(p => 
          p.key === 'TANGO' || 
          p.name.toLowerCase().includes('tango') ||
          p.key.toLowerCase().includes('tango')
        );
        
        if (tangoProject) {
          console.log(`\n   ✅ TANGO project found: ${tangoProject.name} (Key: ${tangoProject.key})`);
          return tangoProject.key;
        } else {
          console.log('\n   ⚠️  TANGO project not found');
        }
      }
      return null;
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Project access failed`);
      console.log(`   Error: ${errorText}`);
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`);
    return null;
  }
}

async function testIssueSearch(projectKey) {
  if (!projectKey) {
    console.log('\n3. Skipping issue search (no project key)');
    return;
  }
  
  console.log(`\n3. Testing issue search for project ${projectKey}...`);
  
  try {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/search?jql=project=${projectKey}&maxResults=5`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Found ${data.total} issues in project ${projectKey}`);
      
      if (data.issues.length > 0) {
        console.log('   Sample issues:');
        data.issues.forEach(issue => {
          console.log(`     • ${issue.key}: ${issue.fields.summary}`);
        });
      }
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Issue search failed`);
      console.log(`   Error: ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`);
  }
}

async function testPermissions() {
  console.log('\n4. Testing permissions...');
  
  try {
    // Test if we can access user permissions
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/mypermissions`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const permissions = await response.json();
      console.log(`   ✅ Permissions retrieved`);
      
      // Check key permissions
      const keyPerms = [
        'BROWSE_PROJECTS',
        'CREATE_ISSUES',
        'EDIT_ISSUES',
        'WORK_ON_ISSUES'
      ];
      
      console.log('   Key permissions:');
      keyPerms.forEach(perm => {
        const hasPerm = permissions.permissions[perm]?.havePermission || false;
        console.log(`     • ${perm}: ${hasPerm ? '✅' : '❌'}`);
      });
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Permissions check failed`);
      console.log(`   Error: ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`);
  }
}

async function main() {
  const authSuccess = await testBasicAuth();
  
  if (!authSuccess) {
    console.log('\n❌ Authentication failed. Please check:');
    console.log('1. Your password is correct');
    console.log('2. Your account is active');
    console.log('3. You have API access enabled');
    return;
  }
  
  const projectKey = await testProjectAccess();
  await testIssueSearch(projectKey);
  await testPermissions();
  
  console.log('\n' + '=' .repeat(40));
  console.log('🔍 Debug complete!');
  
  if (projectKey) {
    console.log('\n✅ Next steps:');
    console.log('1. Start the Jira MCP server: npm run start:jira-http');
    console.log(`2. Test with project key: ${projectKey}`);
  } else {
    console.log('\n⚠️  Issues found:');
    console.log('1. Check if you have project access');
    console.log('2. Contact your Jira admin');
    console.log('3. Verify your account permissions');
  }
}

main().catch(console.error);








