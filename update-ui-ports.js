#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { config, getWebhookUrl } from './config.js';

const WEBHOOK_URL = getWebhookUrl();
const UI_URL = `http://${config.ui.host}:${config.ui.port}`;

console.log(`🔧 Updating UI files with webhook URL: ${WEBHOOK_URL}`);
console.log(`🔧 Updating UI files with UI URL: ${UI_URL}`);

// Files to update
const uiFiles = [
  'alert-ui/index.html',
  'alert-ui/dashboard.html'
];

async function updateUIFiles() {
  for (const filePath of uiFiles) {
    try {
      console.log(`📝 Updating ${filePath}...`);
      
      // Read the file
      const content = await fs.readFile(filePath, 'utf8');
      
      // Replace hardcoded URLs with config values
      let updatedContent = content
        .replace(/http:\/\/localhost:5003/g, WEBHOOK_URL)
        .replace(/http:\/\/localhost:5004/g, WEBHOOK_URL)
        .replace(/http:\/\/localhost:3000/g, UI_URL);
      
      // Write back the updated content
      await fs.writeFile(filePath, updatedContent);
      
      console.log(`✅ Updated ${filePath}`);
    } catch (error) {
      console.error(`❌ Error updating ${filePath}:`, error.message);
    }
  }
  
  console.log('🎉 UI files updated successfully!');
  console.log(`📡 Webhook URL: ${WEBHOOK_URL}`);
  console.log(`🖥️  UI URL: ${UI_URL}`);
}

// Run the update
updateUIFiles().catch(console.error);
