#!/usr/bin/env node

import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';

const execAsync = promisify(exec);

class GitMCPAutoFixWebhook {
  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  setupRoutes() {
    // Webhook endpoint for AlertManager
    this.app.post('/webhook', async (req, res) => {
      try {
        console.log('🚨 Received alert webhook:', JSON.stringify(req.body, null, 2));
        
        const result = await this.processAlert(req.body);
        
        res.json({ 
          status: 'success', 
          message: 'Alert processed and auto-fix applied',
          result: result
        });
      } catch (error) {
        console.error('❌ Error processing webhook:', error);
        res.status(500).json({ 
          status: 'error', 
          message: error.message 
        });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', message: 'Git MCP Auto-Fix webhook server is running' });
    });
  }

  async processAlert(alertData) {
    console.log('🔍 Processing alert data...');
    
    const alerts = alertData.alerts || [];
    const results = [];

    for (const alert of alerts) {
      const alertName = alert.labels?.alertname;
      const severity = alert.labels?.severity;
      const podName = alert.labels?.pod;
      const namespace = alert.labels?.namespace;

      console.log(`📋 Processing alert: ${alertName} for pod: ${podName} in namespace: ${namespace}`);

      let fixResult;
      switch (alertName) {
        case 'PodOOMKilled':
          fixResult = await this.autoFixOOM(podName, namespace);
          break;
        
        case 'PodHighMemoryUsage':
        case 'PodVeryHighMemoryUsage':
          fixResult = await this.autoFixHighMemory(podName, namespace);
          break;
        
        case 'PodCrashLoopBackOff':
          fixResult = await this.autoFixCrashLoop(podName, namespace);
          break;

        case 'PodCPUThrottling':
        case 'PodHighCPUUsage':
          fixResult = await this.autoFixCPU(podName, namespace);
          break;
        
        case 'TestAlert':
          fixResult = await this.handleTestAlert(podName, namespace);
          break;
        
        default:
          fixResult = {
            message: `No automatic fix available for alert: ${alertName}`,
            action: 'none'
          };
      }

      results.push({
        alert: alertName,
        pod: podName,
        namespace: namespace,
        fix_result: fixResult
      });
    }

    return results;
  }

  async autoFixCPU(podName, namespace) {
    console.log(`🔧 Auto-fixing CPU issues for pod: ${podName} in namespace: ${namespace}`);
    
    try {
      // Get deployment info
      const deploymentInfo = await this.getDeploymentInfo(podName, namespace);
      if (!deploymentInfo) {
        return {
          message: `Could not find deployment for pod: ${podName}`,
          action: 'error'
        };
      }

      // Find Helm chart path
      const chartPath = await this.findHelmChart(deploymentInfo.appName);
      if (!chartPath) {
        return {
          message: `Could not find Helm chart for: ${deploymentInfo.appName}`,
          action: 'error'
        };
      }

      // Get current CPU limits
      const currentResources = await this.getCurrentResources(podName, namespace);
      const currentCPU = currentResources.limits?.cpu || '50m';
      const newCPU = this.calculateNewCPULimit(currentCPU);

      console.log(`📝 Updating CPU limits: ${currentCPU} → ${newCPU}`);

      // Update Helm values using Git MCP
      const gitResult = await this.updateHelmValuesWithGitMCP(chartPath, {
        'resources.limits.cpu': newCPU,
        'resources.requests.cpu': this.calculateCPURequest(newCPU)
      }, `🔧 Auto-fix CPU: Increase CPU limits for ${podName} (${currentCPU} → ${newCPU})`);

      if (gitResult.success) {
        console.log('✅ CPU fix applied successfully:');
        console.log(`  - Chart: ${chartPath}`);
        console.log(`  - CPU: ${currentCPU} → ${newCPU}`);
        console.log(`  - Git commit: ${gitResult.commitHash}`);
        console.log('  - ArgoCD will auto-sync changes');

        return {
          message: `CPU fix applied for ${podName}`,
          action: 'cpu_increase',
          details: {
            old_limit: currentCPU,
            new_limit: newCPU,
            chart: chartPath,
            committed: true,
            commit_hash: gitResult.commitHash,
            git_operations: gitResult.operations
          }
        };
      } else {
        return {
          message: `Failed to commit CPU fix for ${podName}: ${gitResult.error}`,
          action: 'error'
        };
      }
    } catch (error) {
      return {
        message: `Failed to auto-fix CPU for ${podName}: ${error.message}`,
        action: 'error'
      };
    }
  }

  async autoFixOOM(podName, namespace) {
    console.log(`🔧 Auto-fixing OOM for pod: ${podName} in namespace: ${namespace}`);
    
    try {
      // Get deployment info
      const deploymentInfo = await this.getDeploymentInfo(podName, namespace);
      if (!deploymentInfo) {
        return {
          message: `Could not find deployment for pod: ${podName}`,
          action: 'error'
        };
      }

      // Find Helm chart path
      const chartPath = await this.findHelmChart(deploymentInfo.appName);
      if (!chartPath) {
        return {
          message: `Could not find Helm chart for: ${deploymentInfo.appName}`,
          action: 'error'
        };
      }

      // Get current memory limits
      const currentResources = await this.getCurrentResources(podName, namespace);
      const currentMemory = currentResources.limits?.memory || '128Mi';
      const newMemory = this.calculateNewMemoryLimit(currentMemory, 'oom');

      console.log(`📝 Updating memory limits: ${currentMemory} → ${newMemory}`);

      // Update Helm values using Git MCP
      const gitResult = await this.updateHelmValuesWithGitMCP(chartPath, {
        'resources.limits.memory': newMemory,
        'resources.requests.memory': this.calculateMemoryRequest(newMemory)
      }, `🔧 Auto-fix OOM: Increase memory for ${podName} (${currentMemory} → ${newMemory})`);

      if (gitResult.success) {
        console.log('✅ OOM fix applied successfully:');
        console.log(`  - Chart: ${chartPath}`);
        console.log(`  - Memory: ${currentMemory} → ${newMemory}`);
        console.log(`  - Git commit: ${gitResult.commitHash}`);
        console.log('  - ArgoCD will auto-sync changes');

        return {
          message: `OOM fix applied for ${podName}`,
          action: 'memory_increase',
          details: {
            old_limit: currentMemory,
            new_limit: newMemory,
            chart: chartPath,
            committed: true,
            commit_hash: gitResult.commitHash,
            git_operations: gitResult.operations
          }
        };
      } else {
        return {
          message: `Failed to commit OOM fix for ${podName}: ${gitResult.error}`,
          action: 'error'
        };
      }
    } catch (error) {
      return {
        message: `Failed to auto-fix OOM for ${podName}: ${error.message}`,
        action: 'error'
      };
    }
  }

  async autoFixCrashLoop(podName, namespace) {
    console.log(`🔧 Auto-fixing CrashLoopBackOff for pod: ${podName}`);
    
    try {
      // Get deployment info from pod
      const deploymentInfo = await this.getDeploymentInfo(podName, namespace);
      
      if (!deploymentInfo) {
        console.log('❌ Could not find deployment for pod, trying direct pod restart');
        return await this.restartPod(podName, namespace);
      }

      console.log(`✅ Found deployment: ${deploymentInfo.deploymentName}`);
      
      // Check if it's a resource issue first
      const currentResources = await this.getCurrentResources(podName, namespace);
      const needsResourceFix = await this.analyzeResourceNeeds(currentResources);
      
      if (needsResourceFix.fix_needed) {
        console.log(`🔍 Resource issue detected: ${needsResourceFix.issue}`);
        
        // Find Helm chart and apply resource fix
        const chartPath = await this.findHelmChart(deploymentInfo.appName);
        if (chartPath) {
          const gitResult = await this.updateHelmValuesWithGitMCP(chartPath, needsResourceFix.fixes, 
            `🔧 Auto-fix CrashLoop: Fix ${needsResourceFix.issue} for ${podName}`);
          
          if (gitResult.success) {
            return {
              message: `CrashLoopBackOff fix applied for ${podName} (${needsResourceFix.issue})`,
              action: 'resource_fix',
              details: {
                deployment: deploymentInfo.deploymentName,
                issue: needsResourceFix.issue,
                fixes: needsResourceFix.fixes,
                committed: true,
                commit_hash: gitResult.commitHash,
                git_operations: gitResult.operations
              }
            };
          }
        }
      }

      // Try deployment restart as fallback
      const restartResult = await this.restartDeployment(deploymentInfo.deploymentName, namespace);
      if (restartResult.success) {
        return {
          message: `CrashLoopBackOff fix applied for ${podName} using deployment restart`,
          action: 'restart_deployment',
          details: {
            deployment: deploymentInfo.deploymentName,
            success: true,
            ...restartResult.details
          }
        };
      }

      return {
        message: `All CrashLoopBackOff fix strategies failed for ${podName}`,
        action: 'all_strategies_failed',
        details: {
          deployment: deploymentInfo.deploymentName
        }
      };

    } catch (error) {
      return {
        message: `Failed to auto-fix CrashLoopBackOff for ${podName}: ${error.message}`,
        action: 'error'
      };
    }
  }

  // Git MCP Integration Methods
  async updateHelmValuesWithGitMCP(chartPath, updates, commitMessage) {
    try {
      console.log(`📝 Updating Helm values for ${chartPath}`);
      
      // Read current values.yaml
      const valuesPath = path.join(process.cwd(), chartPath, 'values.yaml');
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
        
        console.log(`  📝 ${key}: ${current[keys[keys.length - 1]]} → ${value}`);
        current[keys[keys.length - 1]] = value;
      }
      
      // Write back to file
      const newContent = yaml.stringify(values, { indent: 2 });
      await fs.writeFile(valuesPath, newContent);
      
      // Use Git MCP server for commit and push
      return await this.gitCommitAndPushWithMCP(valuesPath, commitMessage);
      
    } catch (error) {
      console.error('Error updating Helm values:', error);
      return { success: false, error: error.message };
    }
  }

  async gitCommitAndPushWithMCP(filePath, commitMessage) {
    try {
      console.log(`📤 Using Git MCP server for commit and push...`);
      
      const operations = [];
      
      // Add file to git
      console.log(`  📝 git add ${filePath}`);
      await execAsync(`git add ${filePath}`);
      operations.push('git add');
      
      // Commit changes
      console.log(`  📝 git commit -m "${commitMessage}"`);
      const { stdout: commitResult } = await execAsync(`git commit -m "${commitMessage}"`);
      const commitHash = commitResult.match(/\[[\w\s-]+\s([a-f0-9]+)\]/)?.[1] || 'unknown';
      operations.push('git commit');
      
      // Push to remote
      console.log(`  📝 git push`);
      await execAsync('git push');
      operations.push('git push');
      
      console.log(`✅ Git MCP operations completed successfully: ${commitHash}`);
      
      return {
        success: true,
        commitHash: commitHash,
        message: commitMessage,
        operations: operations
      };
      
    } catch (error) {
      console.error('Error with Git MCP operations:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper Methods
  async findHelmChart(appName) {
    try {
      const helmDir = path.join(process.cwd(), 'helm');
      const entries = await fs.readdir(helmDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const chartYamlPath = path.join(helmDir, entry.name, 'Chart.yaml');
          
          try {
            const chartContent = await fs.readFile(chartYamlPath, 'utf8');
            const chartData = yaml.parse(chartContent);
            
            if (chartData.name === appName || entry.name === appName) {
              return `helm/${entry.name}`;
            }
          } catch (error) {
            // Continue searching
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding Helm chart:', error);
      return null;
    }
  }

  async getDeploymentInfo(podName, namespace) {
    try {
      const { stdout } = await execAsync(`kubectl get pod ${podName} -n ${namespace} -o jsonpath='{.metadata.ownerReferences[0].name}'`);
      const ownerName = stdout.trim();
      
      if (!ownerName) {
        return null;
      }

      // Check if it's a ReplicaSet (from Deployment)
      try {
        const { stdout: deploymentName } = await execAsync(`kubectl get replicaset ${ownerName} -n ${namespace} -o jsonpath='{.metadata.ownerReferences[0].name}'`);
        if (deploymentName.trim()) {
          const { stdout: labels } = await execAsync(`kubectl get pod ${podName} -n ${namespace} -o jsonpath='{.metadata.labels}'`);
          const labelsObj = JSON.parse(labels);
          
          const appName = labelsObj['app.kubernetes.io/name'] || 
                         labelsObj['app'] || 
                         deploymentName.trim().replace(/-deployment$/, '');

          return {
            deploymentName: deploymentName.trim(),
            appName
          };
        }
      } catch (error) {
        // Not a deployment, might be direct pod
      }

      return null;
    } catch (error) {
      console.error('Error getting deployment info:', error);
      return null;
    }
  }

  async getCurrentResources(podName, namespace) {
    try {
      const { stdout } = await execAsync(`kubectl get pod ${podName} -n ${namespace} -o jsonpath='{.spec.containers[0].resources}'`);
      return JSON.parse(stdout) || {};
    } catch (error) {
      console.error('Error getting current resources:', error);
      return {};
    }
  }

  calculateNewMemoryLimit(currentMemory, reason = 'general') {
    const memoryValue = parseInt(currentMemory.replace(/Mi|Gi/, ''));
    const unit = currentMemory.includes('Gi') ? 'Gi' : 'Mi';
    
    let multiplier;
    switch (reason) {
      case 'oom':
        multiplier = 3; // Triple memory for OOM
        break;
      case 'high_usage':
        multiplier = 1.5; // 50% increase for high usage
        break;
      default:
        multiplier = 2; // Double by default
    }
    
    const newValue = Math.ceil(memoryValue * multiplier);
    return `${newValue}${unit}`;
  }

  calculateMemoryRequest(memoryLimit) {
    const memoryValue = parseInt(memoryLimit.replace(/Mi|Gi/, ''));
    const unit = memoryLimit.includes('Gi') ? 'Gi' : 'Mi';
    const requestValue = Math.ceil(memoryValue * 0.5); // 50% of limit
    return `${requestValue}${unit}`;
  }

  calculateNewCPULimit(currentCPU) {
    const cpuValue = parseInt(currentCPU.replace('m', ''));
    const newValue = Math.max(cpuValue * 3, 200); // Triple CPU or minimum 200m
    return `${newValue}m`;
  }

  calculateCPURequest(cpuLimit) {
    const cpuValue = parseInt(cpuLimit.replace('m', ''));
    const requestValue = Math.ceil(cpuValue * 0.3); // 30% of limit
    return `${requestValue}m`;
  }

  async analyzeResourceNeeds(resources) {
    const limits = resources.limits || {};
    const requests = resources.requests || {};
    
    // Check CPU limits
    if (limits.cpu) {
      const cpuValue = parseInt(limits.cpu.replace('m', ''));
      if (cpuValue < 100) {
        return {
          fix_needed: true,
          issue: 'low_cpu_limits',
          fixes: {
            'resources.limits.cpu': this.calculateNewCPULimit(limits.cpu),
            'resources.requests.cpu': this.calculateCPURequest(this.calculateNewCPULimit(limits.cpu))
          }
        };
      }
    }
    
    // Check memory limits
    if (limits.memory) {
      const memoryValue = parseInt(limits.memory.replace(/Mi|Gi/, ''));
      if (memoryValue < 128) {
        return {
          fix_needed: true,
          issue: 'low_memory_limits',
          fixes: {
            'resources.limits.memory': this.calculateNewMemoryLimit(limits.memory),
            'resources.requests.memory': this.calculateMemoryRequest(this.calculateNewMemoryLimit(limits.memory))
          }
        };
      }
    }
    
    return { fix_needed: false };
  }

  async restartDeployment(deploymentName, namespace) {
    try {
      console.log(`🔄 Restarting deployment: ${deploymentName}`);
      await execAsync(`kubectl rollout restart deployment/${deploymentName} -n ${namespace}`);
      
      // Wait and check status
      await new Promise(resolve => setTimeout(resolve, 5000));
      const { stdout } = await execAsync(`kubectl rollout status deployment/${deploymentName} -n ${namespace} --timeout=60s`);
      
      return {
        success: true,
        details: {
          restart_completed: true,
          status: stdout.trim()
        }
      };
    } catch (error) {
      console.error('Error restarting deployment:', error);
      return { success: false, error: error.message };
    }
  }

  async restartPod(podName, namespace) {
    try {
      console.log(`🔄 Restarting pod directly: ${podName}`);
      await execAsync(`kubectl delete pod ${podName} -n ${namespace}`);
      
      return {
        message: `Pod ${podName} restarted directly`,
        action: 'direct_pod_restart',
        details: {
          pod_restarted: true,
          method: 'direct_delete'
        }
      };
    } catch (error) {
      return {
        message: `Failed to restart pod ${podName}: ${error.message}`,
        action: 'error'
      };
    }
  }

  async handleTestAlert(podName, namespace) {
    console.log(`🧪 Handling test alert for pod: ${podName} in namespace: ${namespace}`);
    
    return {
      message: `Test alert processed for ${podName}`,
      action: 'test_processed',
      details: {
        test_mode: true,
        timestamp: new Date().toISOString()
      }
    };
  }

  start(port = 5003) {
    this.app.listen(port, () => {
      console.log('🚀 Git MCP Auto-Fix Webhook Server started');
      console.log(`📡 Webhook endpoint: http://localhost:${port}/webhook`);
      console.log(`🏥 Health check: http://localhost:${port}/health`);
      console.log('💡 Ready to receive alerts and apply auto-fixes with Git MCP integration!');
      console.log('='.repeat(70));
    });
  }
}

// Start the server
const server = new GitMCPAutoFixWebhook();
const port = process.env.WEBHOOK_PORT || 5003;
server.start(port);
