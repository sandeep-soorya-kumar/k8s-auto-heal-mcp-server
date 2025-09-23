#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

class AlertUIServer {
  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'alert-ui')));
    this.setupRoutes();
  }

  setupRoutes() {
    // Serve the main UI
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'alert-ui', 'index.html'));
    });

    // API endpoint to get cluster information
    this.app.get('/api/cluster/pods', async (req, res) => {
      try {
        const { stdout } = await execAsync('kubectl get pods --all-namespaces -o json');
        const pods = JSON.parse(stdout);
        
        const podList = pods.items.map(pod => ({
          name: pod.metadata.name,
          namespace: pod.metadata.namespace,
          status: pod.status.phase,
          node: pod.spec.nodeName,
          containers: pod.spec.containers.map(c => c.name)
        }));

        res.json({ success: true, pods: podList });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch pods',
          details: error.message 
        });
      }
    });

    // API endpoint to get ArgoCD applications
    this.app.get('/api/argocd/applications', async (req, res) => {
      try {
        const { stdout } = await execAsync('kubectl get applications -n argocd -o json');
        const apps = JSON.parse(stdout);
        
        const appList = apps.items.map(app => ({
          name: app.metadata.name,
          namespace: app.metadata.namespace,
          syncStatus: app.status.sync?.status || 'Unknown',
          healthStatus: app.status.health?.status || 'Unknown',
          revision: app.status.sync?.revision || 'Unknown'
        }));

        res.json({ success: true, applications: appList });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch ArgoCD applications',
          details: error.message 
        });
      }
    });

    // API endpoint to get recent git commits
    this.app.get('/api/git/commits', async (req, res) => {
      try {
        const { stdout } = await execAsync('git log --oneline -10');
        const commits = stdout.trim().split('\n').map(line => {
          const [hash, ...messageParts] = line.split(' ');
          return {
            hash: hash.substring(0, 7),
            message: messageParts.join(' ')
          };
        });

        res.json({ success: true, commits });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch git commits',
          details: error.message 
        });
      }
    });

    // API endpoint to check webhook status
    this.app.get('/api/webhook/status', async (req, res) => {
      try {
        const response = await fetch('http://localhost:5004/health');
        const isOnline = response.ok;
        
        res.json({ 
          success: true, 
          online: isOnline,
          url: 'http://localhost:5004/webhook'
        });
      } catch (error) {
        res.json({ 
          success: true, 
          online: false,
          url: 'http://localhost:5004/webhook',
          error: error.message
        });
      }
    });

    // API endpoint to get alert templates
    this.app.get('/api/alerts/templates', (req, res) => {
      const templates = [
        {
          type: 'PodHighCPUUsage',
          name: 'High CPU Usage',
          description: 'Pod is using high CPU resources',
          severity: 'warning',
          icon: 'fas fa-microchip'
        },
        {
          type: 'PodHighMemoryUsage',
          name: 'High Memory Usage',
          description: 'Pod is using high memory resources',
          severity: 'warning',
          icon: 'fas fa-memory'
        },
        {
          type: 'PodOOMKilled',
          name: 'Out of Memory',
          description: 'Pod was killed due to memory limits',
          severity: 'critical',
          icon: 'fas fa-skull'
        },
        {
          type: 'PodCrashLoopBackOff',
          name: 'Crash Loop',
          description: 'Pod is crashing and restarting repeatedly',
          severity: 'critical',
          icon: 'fas fa-exclamation-triangle'
        },
        {
          type: 'PodVeryHighMemoryUsage',
          name: 'Very High Memory Usage',
          description: 'Pod is using very high memory resources',
          severity: 'critical',
          icon: 'fas fa-memory'
        },
        {
          type: 'TestAlert',
          name: 'Test Alert',
          description: 'Test alert for validation',
          severity: 'info',
          icon: 'fas fa-flask'
        }
      ];

      res.json({ success: true, templates });
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        message: 'Alert UI Server is running',
        timestamp: new Date().toISOString()
      });
    });
  }

  start(port = 3000) {
    this.app.listen(port, () => {
      console.log('🚀 Alert UI Server started');
      console.log(`📱 Frontend: http://localhost:${port}`);
      console.log(`🏥 Health check: http://localhost:${port}/health`);
      console.log(`📊 API endpoints:`);
      console.log(`   - GET /api/cluster/pods`);
      console.log(`   - GET /api/argocd/applications`);
      console.log(`   - GET /api/git/commits`);
      console.log(`   - GET /api/webhook/status`);
      console.log(`   - GET /api/alerts/templates`);
      console.log('======================================================================');
    });
  }
}

// Start the server
const server = new AlertUIServer();
const port = process.env.UI_PORT || 3000;
server.start(port);
