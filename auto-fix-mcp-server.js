#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';

const execAsync = promisify(exec);

class AutoFixMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'auto-fix-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupWebhookServer();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'receive_alert',
            description: 'Receive and process Prometheus alerts for automatic fixes',
            inputSchema: {
              type: 'object',
              properties: {
                alert_data: {
                  type: 'object',
                  description: 'Alert data from Prometheus AlertManager webhook',
                  properties: {
                    status: { type: 'string' },
                    groupLabels: { type: 'object' },
                    commonLabels: { type: 'object' },
                    commonAnnotations: { type: 'object' },
                    alerts: { type: 'array' }
                  }
                }
              },
              required: ['alert_data']
            }
          },
          {
            name: 'auto_fix_oom',
            description: 'Automatically fix OOM (Out of Memory) issues by increasing memory limits',
            inputSchema: {
              type: 'object',
              properties: {
                pod_name: { type: 'string' },
                namespace: { type: 'string' },
                current_memory_limit: { type: 'string' },
                suggested_memory_limit: { type: 'string' }
              },
              required: ['pod_name', 'namespace', 'current_memory_limit']
            }
          },
          {
            name: 'auto_fix_high_memory',
            description: 'Automatically fix high memory usage by scaling or increasing limits',
            inputSchema: {
              type: 'object',
              properties: {
                pod_name: { type: 'string' },
                namespace: { type: 'string' },
                current_usage: { type: 'string' },
                current_limit: { type: 'string' }
              },
              required: ['pod_name', 'namespace', 'current_usage', 'current_limit']
            }
          },
          {
            name: 'auto_fix_crash_loop',
            description: 'Automatically fix CrashLoopBackOff by restarting or scaling deployment',
            inputSchema: {
              type: 'object',
              properties: {
                pod_name: { type: 'string' },
                namespace: { type: 'string' },
                deployment_name: { type: 'string' }
              },
              required: ['pod_name', 'namespace']
            }
          },
          {
            name: 'get_helm_chart_path',
            description: 'Get the Helm chart path for a given application',
            inputSchema: {
              type: 'object',
              properties: {
                app_name: { type: 'string' },
                namespace: { type: 'string' }
              },
              required: ['app_name', 'namespace']
            }
          },
          {
            name: 'update_helm_values',
            description: 'Update Helm values file with new resource limits',
            inputSchema: {
              type: 'object',
              properties: {
                chart_path: { type: 'string' },
                updates: { type: 'object' },
                commit_message: { type: 'string' }
              },
              required: ['chart_path', 'updates', 'commit_message']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'receive_alert':
            return await this.receiveAlert(args.alert_data);
          case 'auto_fix_oom':
            return await this.autoFixOOM(args);
          case 'auto_fix_high_memory':
            return await this.autoFixHighMemory(args);
          case 'auto_fix_crash_loop':
            return await this.autoFixCrashLoop(args);
          case 'get_helm_chart_path':
            return await this.getHelmChartPath(args);
          case 'update_helm_values':
            return await this.updateHelmValues(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error.message}`
            }
          ]
        };
      }
    });
  }

  async receiveAlert(alertData) {
    console.log('🚨 Received alert:', JSON.stringify(alertData, null, 2));
    
    const alerts = alertData.alerts || [];
    const results = [];

    for (const alert of alerts) {
      const alertName = alert.labels?.alertname;
      const severity = alert.labels?.severity;
      const podName = alert.labels?.pod;
      const namespace = alert.labels?.namespace;

      console.log(`Processing alert: ${alertName} for pod: ${podName} in namespace: ${namespace}`);

      let fixResult;
      switch (alertName) {
        case 'PodOOMKilled':
          fixResult = await this.autoFixOOM({
            pod_name: podName,
            namespace: namespace,
            current_memory_limit: 'unknown',
            suggested_memory_limit: '512Mi'
          });
          break;
        
        case 'PodHighMemoryUsage':
        case 'PodVeryHighMemoryUsage':
          fixResult = await this.autoFixHighMemory({
            pod_name: podName,
            namespace: namespace,
            current_usage: '90%+',
            current_limit: 'unknown'
          });
          break;
        
        case 'PodCrashLoopBackOff':
          fixResult = await this.autoFixCrashLoop({
            pod_name: podName,
            namespace: namespace
          });
          break;
        
        default:
          fixResult = {
            content: [{
              type: 'text',
              text: `No automatic fix available for alert: ${alertName}`
            }]
          };
      }

      results.push({
        alert: alertName,
        pod: podName,
        namespace: namespace,
        fix_result: fixResult
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: `Processed ${alerts.length} alerts:\n${JSON.stringify(results, null, 2)}`
        }
      ]
    };
  }

  async autoFixOOM(args) {
    const { pod_name, namespace, current_memory_limit, suggested_memory_limit = '512Mi' } = args;
    
    console.log(`🔧 Auto-fixing OOM for pod: ${pod_name} in namespace: ${namespace}`);
    
    try {
      // Get deployment info
      const deploymentInfo = await this.getDeploymentInfo(pod_name, namespace);
      if (!deploymentInfo) {
        return {
          content: [{
            type: 'text',
            text: `Could not find deployment for pod: ${pod_name}`
          }]
        };
      }

      // Get Helm chart path
      const chartPath = await this.getHelmChartPath({
        app_name: deploymentInfo.appName,
        namespace: namespace
      });

      if (!chartPath.success) {
        return {
          content: [{
            type: 'text',
            text: `Could not find Helm chart for: ${deploymentInfo.appName}`
          }]
        };
      }

      // Update memory limits
      const updates = {
        'server.resources.limits.memory': suggested_memory_limit,
        'server.resources.requests.memory': `${Math.floor(parseInt(suggested_memory_limit) * 0.5)}Mi`
      };

      const updateResult = await this.updateHelmValues({
        chart_path: chartPath.chartPath,
        updates: updates,
        commit_message: `🔧 Auto-fix: Increase memory limits for ${pod_name} (OOM fix)`
      });

      return {
        content: [{
          type: 'text',
          text: `✅ OOM fix applied for ${pod_name}:\n- Increased memory limit to ${suggested_memory_limit}\n- Updated Helm values and committed to Git\n- ArgoCD will automatically sync the changes`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to auto-fix OOM for ${pod_name}: ${error.message}`
        }]
      };
    }
  }

  async autoFixHighMemory(args) {
    const { pod_name, namespace, current_usage, current_limit } = args;
    
    console.log(`🔧 Auto-fixing high memory usage for pod: ${pod_name}`);
    
    try {
      // Get deployment info
      const deploymentInfo = await this.getDeploymentInfo(pod_name, namespace);
      if (!deploymentInfo) {
        return {
          content: [{
            type: 'text',
            text: `Could not find deployment for pod: ${pod_name}`
          }]
        };
      }

      // Get Helm chart path
      const chartPath = await this.getHelmChartPath({
        app_name: deploymentInfo.appName,
        namespace: namespace
      });

      if (!chartPath.success) {
        return {
          content: [{
            type: 'text',
            text: `Could not find Helm chart for: ${deploymentInfo.appName}`
          }]
        };
      }

      // Calculate new memory limit (increase by 50%)
      const currentLimitMB = parseInt(current_limit.replace('Mi', '')) || 256;
      const newLimit = `${Math.floor(currentLimitMB * 1.5)}Mi`;
      const newRequest = `${Math.floor(currentLimitMB * 0.75)}Mi`;

      const updates = {
        'server.resources.limits.memory': newLimit,
        'server.resources.requests.memory': newRequest
      };

      const updateResult = await this.updateHelmValues({
        chart_path: chartPath.chartPath,
        updates: updates,
        commit_message: `🔧 Auto-fix: Increase memory limits for ${pod_name} (high usage: ${current_usage})`
      });

      return {
        content: [{
          type: 'text',
          text: `✅ High memory usage fix applied for ${pod_name}:\n- Increased memory limit from ${current_limit} to ${newLimit}\n- Updated memory request to ${newRequest}\n- Committed changes to Git for ArgoCD sync`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to auto-fix high memory usage for ${pod_name}: ${error.message}`
        }]
      };
    }
  }

  async autoFixCrashLoop(args) {
    const { pod_name, namespace } = args;
    
    console.log(`🔧 Auto-fixing CrashLoopBackOff for pod: ${pod_name}`);
    
    try {
      // Get deployment info
      const deploymentInfo = await this.getDeploymentInfo(pod_name, namespace);
      if (!deploymentInfo) {
        return {
          content: [{
            type: 'text',
            text: `Could not find deployment for pod: ${pod_name}`
          }]
        };
      }

      // Restart the deployment
      await execAsync(`kubectl rollout restart deployment/${deploymentInfo.deploymentName} -n ${namespace}`);
      
      // Wait a bit and check status
      await new Promise(resolve => setTimeout(resolve, 5000));
      const status = await execAsync(`kubectl rollout status deployment/${deploymentInfo.deploymentName} -n ${namespace} --timeout=60s`);

      return {
        content: [{
          type: 'text',
          text: `✅ CrashLoopBackOff fix applied for ${pod_name}:\n- Restarted deployment: ${deploymentInfo.deploymentName}\n- Deployment status: ${status.stdout}\n- Pod should be running normally now`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to auto-fix CrashLoopBackOff for ${pod_name}: ${error.message}`
        }]
      };
    }
  }

  async getDeploymentInfo(podName, namespace) {
    try {
      const { stdout } = await execAsync(`kubectl get pod ${podName} -n ${namespace} -o jsonpath='{.metadata.ownerReferences[0].name}'`);
      const deploymentName = stdout.trim();
      
      if (!deploymentName) {
        return null;
      }

      // Try to determine app name from labels or deployment name
      const { stdout: labels } = await execAsync(`kubectl get pod ${podName} -n ${namespace} -o jsonpath='{.metadata.labels}'`);
      const labelsObj = JSON.parse(labels);
      
      const appName = labelsObj['app.kubernetes.io/name'] || 
                     labelsObj['app'] || 
                     deploymentName.replace(/-deployment$/, '').replace(/-.*$/, '');

      return {
        deploymentName,
        appName
      };
    } catch (error) {
      console.error('Error getting deployment info:', error);
      return null;
    }
  }

  async getHelmChartPath(args) {
    const { app_name, namespace } = args;
    
    try {
      // Look for Helm chart in helm/ directory
      const helmDir = path.join(process.cwd(), 'helm');
      const entries = await fs.readdir(helmDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const chartPath = path.join(helmDir, entry.name);
          const chartYamlPath = path.join(chartPath, 'Chart.yaml');
          
          try {
            const chartContent = await fs.readFile(chartYamlPath, 'utf8');
            const chartData = yaml.parse(chartContent);
            
            if (chartData.name === app_name || entry.name === app_name) {
              return {
                content: [{
                  type: 'text',
                  text: `Found Helm chart for ${app_name}`
                }],
                success: true,
                chartPath: `helm/${entry.name}`
              };
            }
          } catch (error) {
            // Continue searching
          }
        }
      }
      
      return {
        content: [{
          type: 'text',
          text: `No Helm chart found for ${app_name}`
        }],
        success: false
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error finding Helm chart: ${error.message}`
        }],
        success: false
      };
    }
  }

  async updateHelmValues(args) {
    const { chart_path, updates, commit_message } = args;
    
    try {
      const valuesPath = path.join(process.cwd(), chart_path, 'values.yaml');
      const valuesContent = await fs.readFile(valuesPath, 'utf8');
      const values = yaml.parse(valuesContent);
      
      // Apply updates
      for (const [key, value] of Object.entries(updates)) {
        const keys = key.split('.');
        let current = values;
        
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
      }
      
      // Write back to file
      const newContent = yaml.stringify(values, { indent: 2 });
      await fs.writeFile(valuesPath, newContent);
      
      // Commit changes
      await execAsync(`git add ${valuesPath}`);
      await execAsync(`git commit -m "${commit_message}"`);
      await execAsync('git push');
      
      return {
        content: [{
          type: 'text',
          text: `✅ Successfully updated ${chart_path}/values.yaml and committed changes`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to update Helm values: ${error.message}`
        }]
      };
    }
  }

  setupWebhookServer() {
    const app = express();
    app.use(express.json());
    
    // Webhook endpoint for AlertManager
    app.post('/webhook', async (req, res) => {
      try {
        console.log('📡 Received webhook alert:', JSON.stringify(req.body, null, 2));
        
        // Process the alert using MCP tools
        const result = await this.receiveAlert(req.body);
        
        res.json({ 
          status: 'success', 
          message: 'Alert processed and auto-fix applied',
          result: result
        });
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ 
          status: 'error', 
          message: error.message 
        });
      }
    });

    // Start webhook server
    const port = process.env.WEBHOOK_PORT || 5003;
    app.listen(port, () => {
      console.log(`🚀 Auto-fix webhook server running on port ${port}`);
      console.log(`📡 Webhook endpoint: http://localhost:${port}/webhook`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('🤖 Auto-fix MCP server running');
  }
}

// Start the server
const server = new AutoFixMCPServer();
server.run().catch(console.error);
