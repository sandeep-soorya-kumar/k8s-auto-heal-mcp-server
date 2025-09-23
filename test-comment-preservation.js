#!/usr/bin/env node

import fs from 'fs/promises';
import yaml from 'yaml';
import path from 'path';

// Test the comment preservation functionality
async function testCommentPreservation() {
  console.log('🧪 Testing Comment Preservation in YAML Updates');
  console.log('================================================');
  
  // Read the current values.yaml
  const valuesPath = path.join(process.cwd(), 'helm/cpu-stress-app/values.yaml');
  const originalContent = await fs.readFile(valuesPath, 'utf8');
  
  console.log('📄 Original file with comments:');
  console.log('--------------------------------');
  console.log(originalContent);
  console.log('');
  
  // Parse the YAML
  const values = yaml.parse(originalContent);
  
  // Simulate an auto-fix update
  console.log('🔧 Simulating auto-fix update...');
  values.resources.limits.memory = '256Mi';  // Increase memory limit
  values.resources.requests.memory = '128Mi';  // Increase memory request
  
  // Test the comment preservation
  const preservedContent = preserveCommentsYamlStringify(values, originalContent);
  
  console.log('📄 Updated file with preserved comments:');
  console.log('----------------------------------------');
  console.log(preservedContent);
  console.log('');
  
  // Write the test result
  const testPath = path.join(process.cwd(), 'helm/cpu-stress-app/values-test.yaml');
  await fs.writeFile(testPath, preservedContent);
  console.log('✅ Test result written to values-test.yaml');
}

// Copy of the comment preservation method from the webhook
function preserveCommentsYamlStringify(values, originalContent) {
  try {
    // Use a more sophisticated approach to preserve comments
    const lines = originalContent.split('\n');
    const updatedContent = yaml.stringify(values, { indent: 2 });
    const updatedLines = updatedContent.split('\n');
    
    // Find all comment lines and their positions
    const commentMap = new Map();
    lines.forEach((line, index) => {
      if (line.trim().startsWith('#') && !line.trim().startsWith('# ')) {
        commentMap.set(index, line);
      }
    });
    
    // If no comments, return standard stringify
    if (commentMap.size === 0) {
      return updatedContent;
    }
    
    // Try to preserve comments in their original context
    const result = [];
    const commentLines = Array.from(commentMap.values());
    
    // Add a header comment explaining the auto-fix
    result.push('# Auto-fix applied by Kubernetes Alert Manager');
    result.push('# Original comments preserved below:');
    result.push('');
    
    // Add the updated content
    result.push(...updatedLines);
    
    // Add original comments at the end
    if (commentLines.length > 0) {
      result.push('');
      result.push('# Original comments:');
      result.push(...commentLines);
    }
    
    return result.join('\n');
  } catch (error) {
    console.warn('Could not preserve comments, using standard stringify:', error.message);
    return yaml.stringify(values, { indent: 2 });
  }
}

// Run the test
testCommentPreservation().catch(console.error);
