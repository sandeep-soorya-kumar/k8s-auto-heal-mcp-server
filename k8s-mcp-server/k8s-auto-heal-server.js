#!/usr/bin/env node

/**
 * 🚀 Kubernetes Auto-Heal MCP Server
 * 
 * This MCP server monitors Kubernetes clusters for:
 * - Pod crashes and restarts
 * - OOMKilled events
 * - Resource limit breaches
 * - Unhealthy deployments
 * 
 * When issues are detected, it automatically:
 * - Updates Helm chart values with increased resources
 * - Redeploys applications with better configurations
 * - Sends alerts and recommendations
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import k8s from '@kubernetes/client-node';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { Octokit } from '@octokit/rest';
import fetch from 'node-fetch';

// 🔧 Configuration
const CONFIG = {
  MONITORING_INTERVAL: parseInt(process.env.MONITORING_INTERVAL) || 30, // seconds
  RESOURCE_MULTIPLIER: parseFloat(process.env.RESOURCE_MULTIPLIER) || 1.5,
  MAX_RESOURCE_INCREASE: parseFloat(process.env.MAX_RESOURCE_INCREASE) || 5.0,
  NAMESPACE: process.env.KUBE_NAMESPACE || 'default',
  HELM_CHART_PATH: process.env.HELM_CHART_PATH || './helm/k8s-auto-heal',
  AUTO_HEAL_ENABLED: process.env.AUTO_HEAL_ENABLED !== 'false',
  PROMETHEUS_URL: process.env.PROMETHEUS_URL || 'http://prometheus:9090',
  
  // 🐙 GitHub Configuration
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GITHUB_OWNER: process.env.GITHUB_OWNER || 'your-org',
  GITHUB_REPO: process.env.GITHUB_REPO || 'k8s-manifests',
  GITHUB_BRANCH: process.env.GITHUB_BRANCH || 'main',
  GITHUB_BASE_PATH: process.env.GITHUB_BASE_PATH || 'helm/k8s-auto-heal/values.yaml'
};

// 🎯 Kubernetes Client Setup
const kc = new k8s.KubeConfig();
try {
  kc.loadFromDefault();
} catch (error) {
  console.error('❌ Failed to load Kubernetes config:', error.message);
  process.exit(1);
}

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
const k8sMetricsApi = kc.makeApiClient(k8s.Metrics);

// 🐙 GitHub API Client
const octokit = CONFIG.GITHUB_TOKEN ? new Octokit({
  auth: CONFIG.GITHUB_TOKEN,
}) : null;

// 📊 In-memory storage for monitoring data
const monitoringState = {
  podCrashes: new Map(),
  oomEvents: new Map(),
  resourceUsage: new Map(),
  healingHistory: [],
  lastScan: null
};

class KubernetesAutoHealServer {
  constructor() {
    this.server = new Server(
      {
        name: "kubernetes-auto-heal-server",
        version: "1.0.0",
        description: "🚀 AI-powered Kubernetes cluster auto-healing and optimization"
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.startMonitoring();
  }

  setupToolHandlers() {
    // 📋 List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "scan-cluster-health",
          description: "🔍 Scan entire Kubernetes cluster for pod crashes, OOM events, and resource issues",
          inputSchema: {
            type: "object",
            properties: {
              namespace: {
                type: "string",
                description: "Kubernetes namespace to scan (default: all namespaces)"
              },
              timeRange: {
                type: "string",
                description: "Time range for scanning (e.g., '1h', '24h', '7d')",
                default: "1h"
              }
            }
          }
        },
        {
          name: "get-pod-crashes",
          description: "📊 Get detailed information about pod crashes and restart patterns",
          inputSchema: {
            type: "object",
            properties: {
              namespace: { type: "string", description: "Kubernetes namespace" },
              podName: { type: "string", description: "Specific pod name (optional)" }
            }
          }
        },
        {
          name: "get-oom-events",
          description: "💥 Get OOMKilled events and memory usage patterns",
          inputSchema: {
            type: "object",
            properties: {
              namespace: { type: "string", description: "Kubernetes namespace" },
              timeRange: { type: "string", description: "Time range to analyze", default: "24h" }
            }
          }
        },
        {
          name: "analyze-resource-usage",
          description: "📈 Analyze current resource usage vs limits across the cluster",
          inputSchema: {
            type: "object",
            properties: {
              namespace: { type: "string", description: "Kubernetes namespace" },
              resourceType: { 
                type: "string", 
                description: "Resource type (cpu, memory, or both)",
                enum: ["cpu", "memory", "both"],
                default: "both"
              }
            }
          }
        },
        {
          name: "create-gitops-fix-pr",
          description: "🔧 Create GitHub PR with resource fixes for detected issues (GitOps approach)",
          inputSchema: {
            type: "object",
            properties: {
              issues: {
                type: "array",
                description: "Array of issues to fix",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["oom", "crash", "resource"] },
                    pod: { type: "string", description: "Pod name" },
                    namespace: { type: "string", description: "Namespace" },
                    currentLimit: { type: "string", description: "Current resource limit" },
                    recommendedLimit: { type: "string", description: "Recommended resource limit" },
                    resourceType: { type: "string", enum: ["memory", "cpu"] }
                  }
                }
              },
              prTitle: { type: "string", description: "PR title", default: "🔧 Auto-fix: Update resource limits" },
              dryRun: { type: "boolean", description: "Show changes without creating PR", default: false }
            },
            required: ["issues"]
          }
        },
        {
          name: "update-github-values",
          description: "📝 Update Helm values in GitHub repository",
          inputSchema: {
            type: "object",
            properties: {
              filePath: { type: "string", description: "Path to values file in repo", default: "helm/k8s-auto-heal/values.yaml" },
              updates: {
                type: "object",
                description: "YAML path updates to apply",
                properties: {
                  path: { type: "string", description: "YAML path (e.g., 'resources.limits.memory')" },
                  value: { type: "string", description: "New value" }
                }
              },
              commitMessage: { type: "string", description: "Commit message" },
              createPR: { type: "boolean", description: "Create PR instead of direct commit", default: true }
            },
            required: ["updates"]
          }
        },
        {
          name: "trigger-github-workflow",
          description: "🚀 Trigger GitHub Actions workflow to deploy changes",
          inputSchema: {
            type: "object",
            properties: {
              workflowName: { type: "string", description: "Workflow filename", default: "k8s-auto-heal.yml" },
              ref: { type: "string", description: "Branch or tag to run workflow on", default: "main" },
              inputs: {
                type: "object",
                description: "Workflow inputs",
                properties: {
                  force_deploy: { type: "boolean", description: "Force deployment", default: true }
                }
              }
            }
          }
        },
        {
          name: "get-healing-history",
          description: "📚 Get history of auto-healing actions performed",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Number of recent actions to return", default: 10 }
            }
          }
        },
        {
          name: "get-cluster-recommendations",
          description: "💡 Get AI-powered recommendations for cluster optimization",
          inputSchema: {
            type: "object",
            properties: {
              namespace: { type: "string", description: "Kubernetes namespace" },
              focusArea: {
                type: "string",
                description: "Area to focus recommendations on",
                enum: ["resources", "reliability", "cost", "performance", "all"],
                default: "all"
              }
            }
          }
        }
      ]
    }));

    // 🔧 Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "scan-cluster-health":
            return await this.scanClusterHealth(args);
          case "get-pod-crashes":
            return await this.getPodCrashes(args);
          case "get-oom-events":
            return await this.getOOMEvents(args);
          case "analyze-resource-usage":
            return await this.analyzeResourceUsage(args);
          case "create-gitops-fix-pr":
            return await this.createGitOpsFix(args);
          case "update-github-values":
            return await this.updateGitHubValues(args);
          case "trigger-github-workflow":
            return await this.triggerGitHubWorkflow(args);
          case "get-healing-history":
            return await this.getHealingHistory(args);
          case "get-cluster-recommendations":
            return await this.getClusterRecommendations(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error executing ${name}: ${error.message}`
            }
          ]
        };
      }
    });
  }

  // 🔍 Scan entire cluster for health issues
  async scanClusterHealth(args = {}) {
    const { namespace, timeRange = "1h" } = args;
    
    try {
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

        // Check resource usage vs limits
        const containers = pod.spec.containers || [];
        for (const container of containers) {
          if (container.resources?.limits) {
            const memoryLimit = container.resources.limits.memory;
            const cpuLimit = container.resources.limits.cpu;
            
            if (memoryLimit && this.parseMemory(memoryLimit) < 128 * 1024 * 1024) { // Less than 128Mi
              results.issues.resourceIssues.push({
                pod: podName,
                namespace: podNamespace,
                container: container.name,
                issue: 'Low memory limit',
                current: memoryLimit,
                recommended: '256Mi'
              });
              results.summary.warnings++;
            }
          }
        }
      }

      results.summary.totalIssues = results.summary.criticalIssues + results.summary.warnings;
      monitoringState.lastScan = results;

      return {
        content: [
          {
            type: "text",
            text: `🔍 **Cluster Health Scan Complete**\n\n` +
                  `**Summary:**\n` +
                  `• Total Issues: ${results.summary.totalIssues}\n` +
                  `• Critical Issues: ${results.summary.criticalIssues}\n` +
                  `• Warnings: ${results.summary.warnings}\n\n` +
                  `**Issues Found:**\n` +
                  `• Crashing Pods: ${results.issues.crashingPods.length}\n` +
                  `• OOM Events: ${results.issues.oomEvents.length}\n` +
                  `• Resource Issues: ${results.issues.resourceIssues.length}\n` +
                  `• Unhealthy Deployments: ${results.issues.unhealthyDeployments.length}\n\n` +
                  `**Details:**\n${JSON.stringify(results.issues, null, 2)}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to scan cluster health: ${error.message}`);
    }
  }

  // 📊 Get pod crash information
  async getPodCrashes(args = {}) {
    const { namespace, podName } = args;
    
    try {
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

      return {
        content: [
          {
            type: "text",
            text: `📊 **Pod Crash Analysis**\n\n` +
                  `Found ${crashes.length} containers with restarts:\n\n` +
                  crashes.map(crash => 
                    `• **${crash.pod}/${crash.container}** (${crash.namespace})\n` +
                    `  - Restarts: ${crash.restartCount}\n` +
                    `  - Ready: ${crash.ready}\n` +
                    `  - Last State: ${JSON.stringify(crash.lastState, null, 2)}\n`
                  ).join('\n')
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get pod crashes: ${error.message}`);
    }
  }

  // 💥 Get OOM events
  async getOOMEvents(args = {}) {
    const { namespace, timeRange = "24h" } = args;
    
    try {
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
              message: lastState.terminated.message,
              currentMemoryLimit: this.getContainerMemoryLimit(pod, containerStatus.name)
            });
          }
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `💥 **OOM Events Analysis**\n\n` +
                  `Found ${oomEvents.length} OOMKilled events:\n\n` +
                  oomEvents.map(event => 
                    `• **${event.pod}/${event.container}** (${event.namespace})\n` +
                    `  - Killed At: ${event.finishedAt}\n` +
                    `  - Current Memory Limit: ${event.currentMemoryLimit || 'Not set'}\n` +
                    `  - Recommended: ${this.calculateRecommendedMemory(event.currentMemoryLimit)}\n`
                  ).join('\n')
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get OOM events: ${error.message}`);
    }
  }

  // 📈 Analyze resource usage
  async analyzeResourceUsage(args = {}) {
    const { namespace, resourceType = "both" } = args;
    
    try {
      const analysis = {
        timestamp: new Date().toISOString(),
        namespace: namespace || "all",
        resourceType,
        pods: [],
        recommendations: []
      };

      const podsResponse = namespace 
        ? await k8sApi.listNamespacedPod(namespace)
        : await k8sApi.listPodForAllNamespaces();
      
      const pods = podsResponse.body.items;

      for (const pod of pods) {
        const podAnalysis = {
          name: pod.metadata.name,
          namespace: pod.metadata.namespace,
          containers: []
        };

        for (const container of pod.spec.containers || []) {
          const containerAnalysis = {
            name: container.name,
            resources: {
              requests: container.resources?.requests || {},
              limits: container.resources?.limits || {}
            },
            recommendations: []
          };

          // Analyze memory
          if (resourceType === "memory" || resourceType === "both") {
            const memoryLimit = container.resources?.limits?.memory;
            if (memoryLimit) {
              const memoryBytes = this.parseMemory(memoryLimit);
              if (memoryBytes < 128 * 1024 * 1024) { // Less than 128Mi
                containerAnalysis.recommendations.push({
                  type: "memory",
                  current: memoryLimit,
                  recommended: "256Mi",
                  reason: "Very low memory limit may cause OOM"
                });
              }
            } else {
              containerAnalysis.recommendations.push({
                type: "memory",
                current: "Not set",
                recommended: "256Mi",
                reason: "No memory limit set"
              });
            }
          }

          // Analyze CPU
          if (resourceType === "cpu" || resourceType === "both") {
            const cpuLimit = container.resources?.limits?.cpu;
            if (!cpuLimit) {
              containerAnalysis.recommendations.push({
                type: "cpu",
                current: "Not set",
                recommended: "500m",
                reason: "No CPU limit set"
              });
            }
          }

          podAnalysis.containers.push(containerAnalysis);
        }

        analysis.pods.push(podAnalysis);
      }

      // Generate cluster-wide recommendations
      const totalRecommendations = analysis.pods.reduce((acc, pod) => 
        acc + pod.containers.reduce((acc2, container) => acc2 + container.recommendations.length, 0), 0);

      return {
        content: [
          {
            type: "text",
            text: `📈 **Resource Usage Analysis**\n\n` +
                  `**Summary:**\n` +
                  `• Analyzed Pods: ${analysis.pods.length}\n` +
                  `• Total Recommendations: ${totalRecommendations}\n\n` +
                  `**Detailed Analysis:**\n${JSON.stringify(analysis, null, 2)}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to analyze resource usage: ${error.message}`);
    }
  }

  // 🔧 Create GitOps fix PR
  async createGitOpsFix(args) {
    const { issues, prTitle = "🔧 Auto-fix: Update resource limits", dryRun = false } = args;
    
    if (!octokit) {
      throw new Error("GitHub token not configured. Set GITHUB_TOKEN environment variable.");
    }

    try {
      const fixes = [];
      const branchName = `auto-fix-${Date.now()}`;
      
      // Analyze issues and create fixes
      for (const issue of issues) {
        const fix = {
          type: issue.type,
          pod: issue.pod,
          namespace: issue.namespace,
          resourceType: issue.resourceType,
          from: issue.currentLimit,
          to: issue.recommendedLimit,
          yamlPath: this.getYamlPathForPod(issue.pod, issue.resourceType)
        };
        fixes.push(fix);
      }

      if (dryRun) {
        return {
          content: [
            {
              type: "text",
              text: `🔧 **GitOps Fix PR (DRY RUN)**\n\n` +
                    `**Branch:** ${branchName}\n` +
                    `**PR Title:** ${prTitle}\n\n` +
                    `**Fixes to Apply:**\n` +
                    fixes.map(fix => 
                      `• **${fix.pod}** (${fix.namespace})\n` +
                      `  - Type: ${fix.type}\n` +
                      `  - Resource: ${fix.resourceType}\n` +
                      `  - Change: ${fix.from} → ${fix.to}\n` +
                      `  - YAML Path: ${fix.yamlPath}\n`
                    ).join('\n') +
                    `\n**No PR created (dry run mode)**`
            }
          ]
        };
      }

      // Get current values file
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: CONFIG.GITHUB_OWNER,
        repo: CONFIG.GITHUB_REPO,
        path: CONFIG.GITHUB_BASE_PATH,
        ref: CONFIG.GITHUB_BRANCH
      });

      // Parse current YAML
      const currentContent = Buffer.from(currentFile.content, 'base64').toString();
      const currentValues = yaml.load(currentContent);

      // Apply fixes
      let updatedValues = { ...currentValues };
      for (const fix of fixes) {
        updatedValues = this.setNestedValue(updatedValues, fix.yamlPath, fix.to);
      }

      // Create new branch
      const { data: ref } = await octokit.rest.git.getRef({
        owner: CONFIG.GITHUB_OWNER,
        repo: CONFIG.GITHUB_REPO,
        ref: `heads/${CONFIG.GITHUB_BRANCH}`
      });

      await octokit.rest.git.createRef({
        owner: CONFIG.GITHUB_OWNER,
        repo: CONFIG.GITHUB_REPO,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha
      });

      // Update file in new branch
      const newContent = yaml.dump(updatedValues, { indent: 2 });
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: CONFIG.GITHUB_OWNER,
        repo: CONFIG.GITHUB_REPO,
        path: CONFIG.GITHUB_BASE_PATH,
        message: `🔧 Auto-fix: Update resource limits for ${fixes.length} issues`,
        content: Buffer.from(newContent).toString('base64'),
        sha: currentFile.sha,
        branch: branchName
      });

      // Create PR
      const prBody = this.generatePRBody(fixes);
      const { data: pr } = await octokit.rest.pulls.create({
        owner: CONFIG.GITHUB_OWNER,
        repo: CONFIG.GITHUB_REPO,
        title: prTitle,
        head: branchName,
        base: CONFIG.GITHUB_BRANCH,
        body: prBody
      });

      // Record the healing action
      const healingAction = {
        timestamp: new Date().toISOString(),
        action: "gitops-fix-pr",
        prNumber: pr.number,
        prUrl: pr.html_url,
        branch: branchName,
        fixes: fixes
      };

      monitoringState.healingHistory.push(healingAction);
      if (monitoringState.healingHistory.length > 100) {
        monitoringState.healingHistory = monitoringState.healingHistory.slice(-100);
      }

      return {
        content: [
          {
            type: "text",
            text: `🔧 **GitOps Fix PR Created**\n\n` +
                  `**PR #${pr.number}:** ${prTitle}\n` +
                  `**URL:** ${pr.html_url}\n` +
                  `**Branch:** ${branchName}\n\n` +
                  `**Fixes Applied:**\n` +
                  fixes.map(fix => 
                    `• **${fix.pod}** (${fix.namespace}): ${fix.resourceType} ${fix.from} → ${fix.to}`
                  ).join('\n') + '\n\n' +
                  `**✅ PR created! Merge to deploy fixes.**`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to create GitOps fix PR: ${error.message}`);
    }
  }

  // 📝 Update GitHub values
  async updateGitHubValues(args) {
    const { 
      filePath = CONFIG.GITHUB_BASE_PATH, 
      updates, 
      commitMessage = "🔧 Update resource limits",
      createPR = true 
    } = args;
    
    if (!octokit) {
      throw new Error("GitHub token not configured. Set GITHUB_TOKEN environment variable.");
    }

    try {
      // Get current file
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: CONFIG.GITHUB_OWNER,
        repo: CONFIG.GITHUB_REPO,
        path: filePath,
        ref: CONFIG.GITHUB_BRANCH
      });

      // Parse and update YAML
      const currentContent = Buffer.from(currentFile.content, 'base64').toString();
      const currentValues = yaml.load(currentContent);
      const updatedValues = this.setNestedValue(currentValues, updates.path, updates.value);
      const newContent = yaml.dump(updatedValues, { indent: 2 });

      if (createPR) {
        // Create PR workflow
        const branchName = `update-values-${Date.now()}`;
        
        // Create branch
        const { data: ref } = await octokit.rest.git.getRef({
          owner: CONFIG.GITHUB_OWNER,
          repo: CONFIG.GITHUB_REPO,
          ref: `heads/${CONFIG.GITHUB_BRANCH}`
        });

        await octokit.rest.git.createRef({
          owner: CONFIG.GITHUB_OWNER,
          repo: CONFIG.GITHUB_REPO,
          ref: `refs/heads/${branchName}`,
          sha: ref.object.sha
        });

        // Update file
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: CONFIG.GITHUB_OWNER,
          repo: CONFIG.GITHUB_REPO,
          path: filePath,
          message: commitMessage,
          content: Buffer.from(newContent).toString('base64'),
          sha: currentFile.sha,
          branch: branchName
        });

        // Create PR
        const { data: pr } = await octokit.rest.pulls.create({
          owner: CONFIG.GITHUB_OWNER,
          repo: CONFIG.GITHUB_REPO,
          title: commitMessage,
          head: branchName,
          base: CONFIG.GITHUB_BRANCH,
          body: `🤖 **Automated Resource Update**\n\n` +
                `**File:** \`${filePath}\`\n` +
                `**Path:** \`${updates.path}\`\n` +
                `**Value:** \`${updates.value}\`\n\n` +
                `This PR was automatically created by the K8s Auto-Heal system.`
        });

        return {
          content: [
            {
              type: "text",
              text: `📝 **GitHub Values Update PR**\n\n` +
                    `**PR #${pr.number}:** ${commitMessage}\n` +
                    `**URL:** ${pr.html_url}\n` +
                    `**File:** ${filePath}\n` +
                    `**Update:** ${updates.path} = ${updates.value}\n\n` +
                    `**✅ PR created! Merge to deploy changes.**`
            }
          ]
        };
      } else {
        // Direct commit
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: CONFIG.GITHUB_OWNER,
          repo: CONFIG.GITHUB_REPO,
          path: filePath,
          message: commitMessage,
          content: Buffer.from(newContent).toString('base64'),
          sha: currentFile.sha,
          branch: CONFIG.GITHUB_BRANCH
        });

        return {
          content: [
            {
              type: "text",
              text: `📝 **GitHub Values Updated**\n\n` +
                    `**File:** ${filePath}\n` +
                    `**Update:** ${updates.path} = ${updates.value}\n` +
                    `**Commit:** ${commitMessage}\n\n` +
                    `**✅ Changes committed directly to ${CONFIG.GITHUB_BRANCH}**`
            }
          ]
        };
      }
    } catch (error) {
      throw new Error(`Failed to update GitHub values: ${error.message}`);
    }
  }

  // 🚀 Trigger GitHub workflow
  async triggerGitHubWorkflow(args) {
    const { 
      workflowName = "k8s-auto-heal.yml", 
      ref = CONFIG.GITHUB_BRANCH, 
      inputs = { force_deploy: true } 
    } = args;
    
    if (!octokit) {
      throw new Error("GitHub token not configured. Set GITHUB_TOKEN environment variable.");
    }

    try {
      // Trigger workflow
      await octokit.rest.actions.createWorkflowDispatch({
        owner: CONFIG.GITHUB_OWNER,
        repo: CONFIG.GITHUB_REPO,
        workflow_id: workflowName,
        ref: ref,
        inputs: inputs
      });

      return {
        content: [
          {
            type: "text",
            text: `🚀 **GitHub Workflow Triggered**\n\n` +
                  `**Workflow:** ${workflowName}\n` +
                  `**Ref:** ${ref}\n` +
                  `**Inputs:** ${JSON.stringify(inputs, null, 2)}\n\n` +
                  `**✅ Deployment pipeline started!**\n` +
                  `Check progress at: https://github.com/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/actions`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to trigger GitHub workflow: ${error.message}`);
    }
  }

  // 📚 Get healing history
  async getHealingHistory(args = {}) {
    const { limit = 10 } = args;
    
    const recentHistory = monitoringState.healingHistory.slice(-limit).reverse();
    
    return {
      content: [
        {
          type: "text",
          text: `📚 **Auto-Healing History**\n\n` +
                `Showing ${recentHistory.length} recent actions:\n\n` +
                recentHistory.map(action => 
                  `• **${action.timestamp}**\n` +
                  `  - Deployment: ${action.deployment} (${action.namespace})\n` +
                  `  - Action: ${action.action}\n` +
                  `  - Changes: ${Object.keys(action.changes).length}\n` +
                  `  - Dry Run: ${action.dryRun}\n`
                ).join('\n')
        }
      ]
    };
  }

  // 💡 Get cluster recommendations
  async getClusterRecommendations(args = {}) {
    const { namespace, focusArea = "all" } = args;
    
    try {
      const recommendations = {
        timestamp: new Date().toISOString(),
        namespace: namespace || "all",
        focusArea,
        recommendations: []
      };

      // Analyze recent scan data
      if (monitoringState.lastScan) {
        const scan = monitoringState.lastScan;
        
        // Resource recommendations
        if (focusArea === "resources" || focusArea === "all") {
          scan.issues.oomEvents.forEach(event => {
            recommendations.recommendations.push({
              type: "resource",
              priority: "high",
              title: `Increase memory for ${event.pod}/${event.container}`,
              description: `Pod has been OOMKilled. Current limit may be too low.`,
              action: `Increase memory limit to at least 512Mi`,
              automation: `auto-heal-deployment with memory: "512Mi"`
            });
          });

          scan.issues.resourceIssues.forEach(issue => {
            recommendations.recommendations.push({
              type: "resource",
              priority: "medium",
              title: `${issue.issue} for ${issue.pod}/${issue.container}`,
              description: `Current: ${issue.current}, Recommended: ${issue.recommended}`,
              action: `Update resource limits`,
              automation: `update-helm-values or auto-heal-deployment`
            });
          });
        }

        // Reliability recommendations
        if (focusArea === "reliability" || focusArea === "all") {
          scan.issues.crashingPods.forEach(crash => {
            recommendations.recommendations.push({
              type: "reliability",
              priority: "high",
              title: `Investigate frequent restarts for ${crash.pod}`,
              description: `Pod has restarted ${crash.restartCount} times`,
              action: `Check logs, add health checks, increase resource limits`,
              automation: `scan-cluster-health with detailed analysis`
            });
          });
        }
      }

      // General best practices
      if (focusArea === "all") {
        recommendations.recommendations.push({
          type: "monitoring",
          priority: "medium",
          title: "Enable continuous monitoring",
          description: "Set up regular cluster health scans",
          action: "Schedule periodic scans every 30 seconds",
          automation: "Built-in monitoring loop"
        });
      }

      return {
        content: [
          {
            type: "text",
            text: `💡 **Cluster Optimization Recommendations**\n\n` +
                  `**Focus Area:** ${focusArea}\n` +
                  `**Total Recommendations:** ${recommendations.recommendations.length}\n\n` +
                  recommendations.recommendations.map(rec => 
                    `### ${rec.priority.toUpperCase()}: ${rec.title}\n` +
                    `**Type:** ${rec.type}\n` +
                    `**Description:** ${rec.description}\n` +
                    `**Action:** ${rec.action}\n` +
                    `**Automation:** ${rec.automation}\n`
                  ).join('\n')
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get recommendations: ${error.message}`);
    }
  }

  // 🔄 Start continuous monitoring
  startMonitoring() {
    console.log(`🔍 Starting continuous monitoring (interval: ${CONFIG.MONITORING_INTERVAL}s)`);
    
    const monitoringLoop = async () => {
      try {
        // Perform background health scan
        await this.scanClusterHealth({ timeRange: "5m" });
        
        // Auto-heal if enabled and issues found (GitOps approach)
        if (CONFIG.AUTO_HEAL_ENABLED && monitoringState.lastScan && octokit) {
          const scan = monitoringState.lastScan;
          const issues = [];
          
          // Collect OOM issues
          for (const oomEvent of scan.issues.oomEvents) {
            const recommendedMemory = this.calculateRecommendedMemory(oomEvent.currentMemoryLimit);
            issues.push({
              type: "oom",
              pod: oomEvent.pod,
              namespace: oomEvent.namespace,
              currentLimit: oomEvent.currentMemoryLimit || "Not set",
              recommendedLimit: recommendedMemory,
              resourceType: "memory"
            });
          }

          // Collect crash issues
          for (const crashEvent of scan.issues.crashingPods) {
            issues.push({
              type: "crash",
              pod: crashEvent.pod,
              namespace: crashEvent.namespace,
              currentLimit: "Unknown",
              recommendedLimit: "512Mi", // Default increase
              resourceType: "memory"
            });
          }

          // Create GitOps fix PR if issues found
          if (issues.length > 0) {
            try {
              await this.createGitOpsFix({
                issues: issues,
                prTitle: `🤖 Auto-fix: Resolve ${issues.length} cluster issues`,
                dryRun: false
              });
              console.log(`🔧 Created GitOps fix PR for ${issues.length} issues`);
            } catch (error) {
              console.error(`❌ Failed to create GitOps fix PR:`, error.message);
            }
          }
        }
      } catch (error) {
        console.error('❌ Monitoring loop error:', error.message);
      }
    };

    // Run initial scan
    monitoringLoop();
    
    // Schedule periodic scans
    setInterval(monitoringLoop, CONFIG.MONITORING_INTERVAL * 1000);
  }

  // 🧮 Helper methods
  parseMemory(memoryString) {
    if (!memoryString) return 0;
    const units = { 'Ki': 1024, 'Mi': 1024*1024, 'Gi': 1024*1024*1024 };
    const match = memoryString.match(/^(\d+)(\w+)?$/);
    if (!match) return 0;
    const value = parseInt(match[1]);
    const unit = match[2] || '';
    return value * (units[unit] || 1);
  }

  getContainerMemoryLimit(pod, containerName) {
    const container = pod.spec.containers?.find(c => c.name === containerName);
    return container?.resources?.limits?.memory || null;
  }

  calculateRecommendedMemory(currentLimit) {
    if (!currentLimit) return "256Mi";
    const currentBytes = this.parseMemory(currentLimit);
    const recommendedBytes = Math.min(
      currentBytes * CONFIG.RESOURCE_MULTIPLIER,
      currentBytes * CONFIG.MAX_RESOURCE_INCREASE
    );
    return `${Math.ceil(recommendedBytes / (1024 * 1024))}Mi`;
  }

  mergeDeep(target, source) {
    const output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target))
            Object.assign(output, { [key]: source[key] });
          else
            output[key] = this.mergeDeep(target[key], source[key]);
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  // 🔧 GitOps Helper Methods
  getYamlPathForPod(podName, resourceType) {
    // Simple mapping - in real scenario, you'd need more sophisticated logic
    // to map pod names to their corresponding Helm values paths
    const appName = podName.split('-')[0]; // Assume first part is app name
    return `${appName}.resources.limits.${resourceType}`;
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    return obj;
  }

  generatePRBody(fixes) {
    return `🤖 **Automated Cluster Healing**\n\n` +
           `This PR contains automated fixes for detected cluster issues.\n\n` +
           `## 🔍 Issues Detected\n\n` +
           fixes.map(fix => 
             `### ${fix.type.toUpperCase()}: ${fix.pod} (${fix.namespace})\n` +
             `- **Resource**: ${fix.resourceType}\n` +
             `- **Current**: ${fix.from}\n` +
             `- **Recommended**: ${fix.to}\n` +
             `- **YAML Path**: \`${fix.yamlPath}\`\n`
           ).join('\n') + '\n\n' +
           `## 🚀 Deployment\n\n` +
           `Merging this PR will trigger the deployment pipeline to apply these fixes.\n\n` +
           `---\n` +
           `*This PR was automatically created by the K8s Auto-Heal system at ${new Date().toISOString()}*`;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("🚀 Kubernetes Auto-Heal MCP Server running on stdio");
  }
}

// 🚀 Start the server
const server = new KubernetesAutoHealServer();
server.run().catch(console.error);
