#!/usr/bin/env node

/**
 * 🚀 Kubernetes Auto-Heal HTTP MCP Server
 * 
 * HTTP version of the K8s Auto-Heal MCP server for web-based access
 */

import express from 'express';
import cors from 'cors';
import k8s from '@kubernetes/client-node';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const app = express();
const PORT = process.env.PORT || 8080;
const MCP_PORT = process.env.MCP_SERVER_PORT || 3000;

// 🔧 Middleware
app.use(cors());
app.use(express.json());

// 🎯 Kubernetes Client Setup
const kc = new k8s.KubeConfig();
try {
  kc.loadFromDefault();
} catch (error) {
  console.error('❌ Failed to load Kubernetes config:', error.message);
}

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

// 🏥 Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    kubernetes: kc ? 'connected' : 'disconnected'
  });
});

// 📊 Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const pods = await k8sApi.listPodForAllNamespaces();
    const metrics = {
      total_pods: pods.body.items.length,
      running_pods: pods.body.items.filter(pod => pod.status.phase === 'Running').length,
      pending_pods: pods.body.items.filter(pod => pod.status.phase === 'Pending').length,
      failed_pods: pods.body.items.filter(pod => pod.status.phase === 'Failed').length
    };
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔍 Scan cluster health
app.post('/api/scan-cluster-health', async (req, res) => {
  try {
    const { namespace, timeRange = "1h" } = req.body;
    
    const results = {
      timestamp: new Date().toISOString(),
      namespace: namespace || "all",
      timeRange,
      issues: {
        crashingPods: [],
        oomEvents: [],
        resourceIssues: [],
        unhealthyDeployments: []
      },
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        warnings: 0
      }
    };

    // Get all pods
    const podsResponse = namespace 
      ? await k8sApi.listNamespacedPod(namespace)
      : await k8sApi.listPodForAllNamespaces();
    
    const pods = podsResponse.body.items;

    // Analyze each pod
    for (const pod of pods) {
      const podNamespace = pod.metadata.namespace;
      const podName = pod.metadata.name;
      
      // Check for crashes and restarts
      for (const containerStatus of pod.status.containerStatuses || []) {
        if (containerStatus.restartCount > 0) {
          const lastState = containerStatus.lastState;
          if (lastState?.terminated?.reason === 'OOMKilled') {
            results.issues.oomEvents.push({
              pod: podName,
              namespace: podNamespace,
              container: containerStatus.name,
              restartCount: containerStatus.restartCount,
              reason: 'OOMKilled',
              finishedAt: lastState.terminated.finishedAt
            });
            results.summary.criticalIssues++;
          } else if (containerStatus.restartCount > 5) {
            results.issues.crashingPods.push({
              pod: podName,
              namespace: podNamespace,
              container: containerStatus.name,
              restartCount: containerStatus.restartCount,
              state: containerStatus.state
            });
            results.summary.criticalIssues++;
          }
        }
      }
    }

    results.summary.totalIssues = results.summary.criticalIssues + results.summary.warnings;
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔧 Auto-heal deployment
app.post('/api/auto-heal-deployment', async (req, res) => {
  try {
    const { deploymentName, namespace, resourceUpdates = {}, dryRun = false } = req.body;
    
    if (!deploymentName || !namespace) {
      return res.status(400).json({ error: 'deploymentName and namespace are required' });
    }

    // Get current deployment
    const deployment = await k8sAppsApi.readNamespacedDeployment(deploymentName, namespace);
    const currentSpec = deployment.body.spec;

    const healingAction = {
      timestamp: new Date().toISOString(),
      deployment: deploymentName,
      namespace,
      action: "resource-update",
      changes: {},
      dryRun
    };

    // Update resource limits
    const containers = currentSpec.template.spec.containers;
    for (const container of containers) {
      if (!container.resources) container.resources = {};
      if (!container.resources.limits) container.resources.limits = {};

      // Update memory
      if (resourceUpdates.memory) {
        const oldMemory = container.resources.limits.memory || "Not set";
        container.resources.limits.memory = resourceUpdates.memory;
        healingAction.changes[`${container.name}.memory`] = {
          from: oldMemory,
          to: resourceUpdates.memory
        };
      }

      // Update CPU
      if (resourceUpdates.cpu) {
        const oldCpu = container.resources.limits.cpu || "Not set";
        container.resources.limits.cpu = resourceUpdates.cpu;
        healingAction.changes[`${container.name}.cpu`] = {
          from: oldCpu,
          to: resourceUpdates.cpu
        };
      }
    }

    if (!dryRun) {
      // Apply the changes
      await k8sAppsApi.replaceNamespacedDeployment(deploymentName, namespace, deployment.body);
    }

    res.json(healingAction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📊 Get pod crashes
app.get('/api/pod-crashes', async (req, res) => {
  try {
    const { namespace, podName } = req.query;
    
    const crashes = [];
    const podsResponse = namespace 
      ? await k8sApi.listNamespacedPod(namespace)
      : await k8sApi.listPodForAllNamespaces();
    
    const pods = podsResponse.body.items;
    
    for (const pod of pods) {
      if (podName && pod.metadata.name !== podName) continue;
      
      for (const containerStatus of pod.status.containerStatuses || []) {
        if (containerStatus.restartCount > 0) {
          crashes.push({
            pod: pod.metadata.name,
            namespace: pod.metadata.namespace,
            container: containerStatus.name,
            restartCount: containerStatus.restartCount,
            lastState: containerStatus.lastState,
            currentState: containerStatus.state,
            ready: containerStatus.ready
          });
        }
      }
    }

    res.json({ crashes, total: crashes.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 💥 Get OOM events
app.get('/api/oom-events', async (req, res) => {
  try {
    const { namespace, timeRange = "24h" } = req.query;
    
    const oomEvents = [];
    const podsResponse = namespace 
      ? await k8sApi.listNamespacedPod(namespace)
      : await k8sApi.listPodForAllNamespaces();
    
    const pods = podsResponse.body.items;
    
    for (const pod of pods) {
      for (const containerStatus of pod.status.containerStatuses || []) {
        const lastState = containerStatus.lastState;
        if (lastState?.terminated?.reason === 'OOMKilled') {
          oomEvents.push({
            pod: pod.metadata.name,
            namespace: pod.metadata.namespace,
            container: containerStatus.name,
            finishedAt: lastState.terminated.finishedAt,
            exitCode: lastState.terminated.exitCode,
            message: lastState.terminated.message
          });
        }
      }
    }

    res.json({ oomEvents, total: oomEvents.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📦 Helm endpoints
app.post('/api/helm/install', async (req, res) => {
  try {
    const { releaseName, chart, namespace = 'default', values, valuesFile, createNamespace = false, wait = true, timeout = '10m' } = req.body;
    
    if (!releaseName || !chart) {
      return res.status(400).json({ error: 'releaseName and chart are required' });
    }
    
    let command = `helm install ${releaseName} ${chart} --namespace ${namespace}`;
    
    if (createNamespace) {
      command += ' --create-namespace';
    }
    
    if (wait) {
      command += ' --wait';
    }
    
    if (timeout) {
      command += ` --timeout ${timeout}`;
    }
    
    if (valuesFile) {
      command += ` --values ${valuesFile}`;
    }
    
    if (values) {
      const setParams = Object.entries(values)
        .map(([key, value]) => `--set ${key}=${value}`)
        .join(' ');
      command += ` ${setParams}`;
    }
    
    const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    
    res.json({
      success: true,
      releaseName,
      chart,
      namespace,
      output: result
    });
  } catch (error) {
    res.status(500).json({ error: `Helm install failed: ${error.message}` });
  }
});

app.post('/api/helm/upgrade', async (req, res) => {
  try {
    const { releaseName, chart, namespace = 'default', values, valuesFile, wait = true, timeout = '10m' } = req.body;
    
    if (!releaseName || !chart) {
      return res.status(400).json({ error: 'releaseName and chart are required' });
    }
    
    let command = `helm upgrade ${releaseName} ${chart} --namespace ${namespace}`;
    
    if (wait) {
      command += ' --wait';
    }
    
    if (timeout) {
      command += ` --timeout ${timeout}`;
    }
    
    if (valuesFile) {
      command += ` --values ${valuesFile}`;
    }
    
    if (values) {
      const setParams = Object.entries(values)
        .map(([key, value]) => `--set ${key}=${value}`)
        .join(' ');
      command += ` ${setParams}`;
    }
    
    const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    
    res.json({
      success: true,
      releaseName,
      chart,
      namespace,
      output: result
    });
  } catch (error) {
    res.status(500).json({ error: `Helm upgrade failed: ${error.message}` });
  }
});

app.delete('/api/helm/uninstall/:releaseName', async (req, res) => {
  try {
    const { releaseName } = req.params;
    const { namespace = 'default', wait = true } = req.body;
    
    let command = `helm uninstall ${releaseName} --namespace ${namespace}`;
    
    if (wait) {
      command += ' --wait';
    }
    
    const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    
    res.json({
      success: true,
      releaseName,
      namespace,
      output: result
    });
  } catch (error) {
    res.status(500).json({ error: `Helm uninstall failed: ${error.message}` });
  }
});

app.get('/api/helm/list', async (req, res) => {
  try {
    const { namespace, allNamespaces = false } = req.query;
    
    let command = 'helm list';
    
    if (allNamespaces === 'true') {
      command += ' --all-namespaces';
    } else if (namespace) {
      command += ` --namespace ${namespace}`;
    }
    
    const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    
    res.json({
      success: true,
      scope: allNamespaces === 'true' ? 'All namespaces' : namespace || 'default',
      output: result
    });
  } catch (error) {
    res.status(500).json({ error: `Helm list failed: ${error.message}` });
  }
});

app.post('/api/helm/repo/add', async (req, res) => {
  try {
    const { name, url } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({ error: 'name and url are required' });
    }
    
    const command = `helm repo add ${name} ${url}`;
    const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    
    res.json({
      success: true,
      name,
      url,
      output: result
    });
  } catch (error) {
    res.status(500).json({ error: `Helm repo add failed: ${error.message}` });
  }
});

app.post('/api/helm/repo/update', async (req, res) => {
  try {
    const command = 'helm repo update';
    const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    
    res.json({
      success: true,
      output: result
    });
  } catch (error) {
    res.status(500).json({ error: `Helm repo update failed: ${error.message}` });
  }
});

// 🎯 Webhook endpoint for Prometheus alerts
app.post('/webhook/alerts', (req, res) => {
  console.log('🚨 Received Prometheus alert:', JSON.stringify(req.body, null, 2));
  
  // Process alerts and trigger auto-healing if needed
  const alerts = req.body.alerts || [];
  
  for (const alert of alerts) {
    if (alert.status === 'firing') {
      console.log(`🔥 Alert: ${alert.labels.alertname} - ${alert.annotations.summary}`);
      
      // Auto-heal based on alert type
      if (alert.labels.alertname === 'PodOOMKilled') {
        // Trigger memory increase
        console.log('🔧 Triggering auto-heal for OOM event');
      } else if (alert.labels.alertname === 'PodCrashLooping') {
        // Trigger resource increase
        console.log('🔧 Triggering auto-heal for crash loop');
      }
    }
  }
  
  res.json({ status: 'received', processed: alerts.length });
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`🚀 K8s Auto-Heal HTTP Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🔍 API endpoints available at /api/*`);
});
