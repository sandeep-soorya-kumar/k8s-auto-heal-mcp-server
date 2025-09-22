#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync, spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { Octokit } from "@octokit/rest";
import fetch from "node-fetch";

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "https://your-domain.atlassian.net";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";

// GitHub client
const github = new Octokit({
  auth: GITHUB_TOKEN,
});

// Jira API client
class JiraClient {
  constructor(baseUrl, email, apiToken) {
    this.baseUrl = baseUrl;
    this.email = email;
    this.apiToken = apiToken;
    this.auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}/rest/api/3${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getProjects() {
    return this.makeRequest('/project');
  }

  async getProject(projectKey) {
    return this.makeRequest(`/project/${projectKey}`);
  }

  async getIssues(projectKey, jql = '', maxResults = 50) {
    const jqlQuery = projectKey ? `project = ${projectKey}` : jql;
    return this.makeRequest(`/search?jql=${encodeURIComponent(jqlQuery)}&maxResults=${maxResults}`);
  }

  async getIssue(issueKey) {
    return this.makeRequest(`/issue/${issueKey}`);
  }

  async createIssue(issueData) {
    return this.makeRequest('/issue', {
      method: 'POST',
      body: JSON.stringify(issueData)
    });
  }

  async updateIssue(issueKey, updateData) {
    return this.makeRequest(`/issue/${issueKey}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  async addComment(issueKey, comment) {
    return this.makeRequest(`/issue/${issueKey}/comment`, {
      method: 'POST',
      body: JSON.stringify({ body: comment })
    });
  }

  async getTransitions(issueKey) {
    return this.makeRequest(`/issue/${issueKey}/transitions`);
  }

  async transitionIssue(issueKey, transitionId) {
    return this.makeRequest(`/issue/${issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ transition: { id: transitionId } })
    });
  }

  async getWorkflows() {
    return this.makeRequest('/workflow');
  }

  async getWorkflowScheme(projectKey) {
    return this.makeRequest(`/workflowscheme/project/${projectKey}`);
  }
}

// Initialize Jira client
const jiraClient = new JiraClient(JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN);

// Utility functions
function getGitHubRepoInfo() {
  try {
    const remoteUrl = execSync("git config --get remote.origin.url", { encoding: "utf8" }).trim();
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch (error) {
    // Not a git repo or no remote
  }
  return null;
}

function createGitHubClient() {
  if (!GITHUB_TOKEN) {
    throw new Error("GitHub token not provided. Set GITHUB_TOKEN environment variable.");
  }
  return github;
}

// Git tools
const gitTools = [
  {
    name: "git-status",
    description: "Get the current status of the Git repository",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "git-branch",
    description: "List, create, or switch Git branches",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "create", "switch", "delete"],
          description: "Branch action to perform",
        },
        branchName: {
          type: "string",
          description: "Name of the branch (required for create, switch, delete)",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "git-commit",
    description: "Create a new Git commit",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Commit message",
        },
        addAll: {
          type: "boolean",
          description: "Whether to add all changes before committing",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "git-push",
    description: "Push commits to remote repository",
    inputSchema: {
      type: "object",
      properties: {
        branch: {
          type: "string",
          description: "Branch to push (defaults to current branch)",
        },
        remote: {
          type: "string",
          description: "Remote name (defaults to 'origin')",
        },
        force: {
          type: "boolean",
          description: "Force push (defaults to false)",
        },
      },
      required: [],
    },
  },
  {
    name: "git-pull",
    description: "Pull latest changes from remote repository",
    inputSchema: {
      type: "object",
      properties: {
        branch: {
          type: "string",
          description: "Branch to pull (defaults to current branch)",
        },
        remote: {
          type: "string",
          description: "Remote name (defaults to 'origin')",
        },
      },
      required: [],
    },
  },
  {
    name: "git-log",
    description: "Show commit history",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of commits to show (defaults to 10)",
        },
        branch: {
          type: "string",
          description: "Branch to show log for (defaults to current branch)",
        },
      },
      required: [],
    },
  },
];

// CI/CD tools
const cicdTools = [
  {
    name: "create-github-workflow",
    description: "Create a GitHub Actions workflow file",
    inputSchema: {
      type: "object",
      properties: {
        workflowName: {
          type: "string",
          description: "Name of the workflow file (without .yml extension)",
        },
        triggers: {
          type: "array",
          items: {
            type: "string",
            enum: ["push", "pull_request", "schedule", "workflow_dispatch"],
          },
          description: "Events that trigger the workflow",
        },
        branches: {
          type: "array",
          items: { type: "string" },
          description: "Branches to trigger on (for push/PR events)",
        },
        jobs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              runsOn: { type: "string", default: "ubuntu-latest" },
              steps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    uses: { type: "string" },
                    run: { type: "string" },
                    with: { type: "object" },
                  },
                },
              },
            },
            required: ["name", "steps"],
          },
          description: "Jobs to run in the workflow",
        },
      },
      required: ["workflowName", "triggers", "jobs"],
    },
  },
  {
    name: "create-dockerfile",
    description: "Create a Dockerfile for containerization",
    inputSchema: {
      type: "object",
      properties: {
        baseImage: {
          type: "string",
          description: "Base Docker image (default: node:18-alpine)",
        },
        workingDir: {
          type: "string",
          description: "Working directory in container (default: /app)",
        },
        packageManager: {
          type: "string",
          enum: ["npm", "yarn", "pnpm"],
          description: "Package manager to use (default: npm)",
        },
        buildCommand: {
          type: "string",
          description: "Build command (default: npm run build)",
        },
        startCommand: {
          type: "string",
          description: "Start command (default: npm start)",
        },
        port: {
          type: "number",
          description: "Port to expose (default: 3000)",
        },
      },
      required: [],
    },
  },
  {
    name: "create-docker-compose",
    description: "Create a docker-compose.yml file",
    inputSchema: {
      type: "object",
      properties: {
        services: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              image: { type: "string" },
              build: { type: "string" },
              ports: {
                type: "array",
                items: { type: "string" },
              },
              environment: { type: "object" },
              volumes: {
                type: "array",
                items: { type: "string" },
              },
              dependsOn: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["name"],
          },
          description: "Services to define in docker-compose",
        },
      },
      required: ["services"],
    },
  },
  {
    name: "create-env-file",
    description: "Create environment configuration files",
    inputSchema: {
      type: "object",
      properties: {
        environments: {
          type: "array",
          items: {
            type: "string",
            enum: ["development", "staging", "production"],
          },
          description: "Environments to create files for",
        },
        variables: {
          type: "object",
          description: "Environment variables to include",
        },
      },
      required: ["environments", "variables"],
    },
  },
  {
    name: "validate-ci-config",
    description: "Validate CI/CD configuration files",
    inputSchema: {
      type: "object",
      properties: {
        configType: {
          type: "string",
          enum: ["github-actions", "docker", "docker-compose"],
          description: "Type of configuration to validate",
        },
      },
      required: ["configType"],
    },
  },
];

// GitHub API tools
const githubTools = [
  {
    name: "create-pull-request",
    description: "Create a pull request on GitHub",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Pull request title",
        },
        body: {
          type: "string",
          description: "Pull request description",
        },
        head: {
          type: "string",
          description: "Source branch name",
        },
        base: {
          type: "string",
          description: "Target branch name (default: main)",
        },
      },
      required: ["title", "head"],
    },
  },
  {
    name: "get-pull-requests",
    description: "Get list of pull requests for a repository",
    inputSchema: {
      type: "object",
      properties: {
        state: {
          type: "string",
          enum: ["open", "closed", "all"],
          description: "Filter by PR state (default: open)",
        },
        limit: {
          type: "number",
          description: "Number of PRs to return (default: 10)",
        },
      },
      required: [],
    },
  },
  {
    name: "get-repository-info",
    description: "Get information about the GitHub repository",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// Jira tools
const jiraTools = [
  {
    name: "jira-get-projects",
    description: "Get list of Jira projects",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "jira-get-project",
    description: "Get details of a specific Jira project",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: {
          type: "string",
          description: "Project key (e.g., 'PROJ')"
        }
      },
      required: ["projectKey"]
    }
  },
  {
    name: "jira-get-issues",
    description: "Get issues from a Jira project",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: {
          type: "string",
          description: "Project key (e.g., 'PROJ')"
        },
        jql: {
          type: "string",
          description: "JQL query (optional)"
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results (default: 50)"
        }
      },
      required: ["projectKey"]
    }
  },
  {
    name: "jira-get-issue",
    description: "Get details of a specific Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key (e.g., 'PROJ-123')"
        }
      },
      required: ["issueKey"]
    }
  },
  {
    name: "jira-create-issue",
    description: "Create a new Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: {
          type: "string",
          description: "Project key (e.g., 'PROJ')"
        },
        summary: {
          type: "string",
          description: "Issue summary/title"
        },
        description: {
          type: "string",
          description: "Issue description"
        },
        issueType: {
          type: "string",
          description: "Issue type (e.g., 'Bug', 'Task', 'Story')"
        },
        priority: {
          type: "string",
          description: "Priority (e.g., 'High', 'Medium', 'Low')"
        },
        assignee: {
          type: "string",
          description: "Assignee email or account ID"
        }
      },
      required: ["projectKey", "summary", "issueType"]
    }
  },
  {
    name: "jira-update-issue",
    description: "Update an existing Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key (e.g., 'PROJ-123')"
        },
        summary: {
          type: "string",
          description: "New issue summary/title"
        },
        description: {
          type: "string",
          description: "New issue description"
        },
        priority: {
          type: "string",
          description: "New priority (e.g., 'High', 'Medium', 'Low')"
        },
        assignee: {
          type: "string",
          description: "New assignee email or account ID"
        }
      },
      required: ["issueKey"]
    }
  },
  {
    name: "jira-add-comment",
    description: "Add a comment to a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key (e.g., 'PROJ-123')"
        },
        comment: {
          type: "string",
          description: "Comment text"
        }
      },
      required: ["issueKey", "comment"]
    }
  },
  {
    name: "jira-get-transitions",
    description: "Get available transitions for a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key (e.g., 'PROJ-123')"
        }
      },
      required: ["issueKey"]
    }
  },
  {
    name: "jira-transition-issue",
    description: "Transition a Jira issue to a new status",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key (e.g., 'PROJ-123')"
        },
        transitionId: {
          type: "string",
          description: "Transition ID (use jira-get-transitions to find available transitions)"
        }
      },
      required: ["issueKey", "transitionId"]
    }
  },
  {
    name: "jira-get-workflows",
    description: "Get available workflows in Jira",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "jira-get-workflow-scheme",
    description: "Get workflow scheme for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: {
          type: "string",
          description: "Project key (e.g., 'PROJ')"
        }
      },
      required: ["projectKey"]
    }
  }
];

// Create MCP server
const server = new Server(
  {
    name: "combined-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [...gitTools, ...cicdTools, ...githubTools, ...jiraTools],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Git tools
      case "git-status": {
        const status = execSync("git status --porcelain", { encoding: "utf8" });
        const currentBranch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
        const hasChanges = status.trim().length > 0;
        
        return {
          content: [
            {
              type: "text",
              text: `Current branch: ${currentBranch}\nHas changes: ${hasChanges}\n\nStatus:\n${status || "No changes"}`,
            },
          ],
        };
      }

      case "git-branch": {
        const { action, branchName } = args;
        
        switch (action) {
          case "list": {
            const branches = execSync("git branch -a", { encoding: "utf8" });
            return {
              content: [
                {
                  type: "text",
                  text: `Available branches:\n${branches}`,
                },
              ],
            };
          }
          case "create": {
            if (!branchName) {
              throw new Error("Branch name is required for create action");
            }
            execSync(`git checkout -b ${branchName}`, { stdio: "inherit" });
            return {
              content: [
                {
                  type: "text",
                  text: `Created and switched to branch: ${branchName}`,
                },
              ],
            };
          }
          case "switch": {
            if (!branchName) {
              throw new Error("Branch name is required for switch action");
            }
            execSync(`git checkout ${branchName}`, { stdio: "inherit" });
            return {
              content: [
                {
                  type: "text",
                  text: `Switched to branch: ${branchName}`,
                },
              ],
            };
          }
          case "delete": {
            if (!branchName) {
              throw new Error("Branch name is required for delete action");
            }
            execSync(`git branch -d ${branchName}`, { stdio: "inherit" });
            return {
              content: [
                {
                  type: "text",
                  text: `Deleted branch: ${branchName}`,
                },
              ],
            };
          }
          default:
            throw new Error(`Unknown branch action: ${action}`);
        }
      }

      case "git-commit": {
        const { message, addAll = false } = args;
        
        if (addAll) {
          execSync("git add .", { stdio: "inherit" });
        }
        
        execSync(`git commit -m "${message}"`, { stdio: "inherit" });
        
        return {
          content: [
            {
              type: "text",
              text: `Commit created: ${message}`,
            },
          ],
        };
      }

      case "git-push": {
        const { branch, remote = "origin", force = false } = args;
        const currentBranch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
        const targetBranch = branch || currentBranch;
        const forceFlag = force ? " --force" : "";
        
        execSync(`git push${forceFlag} ${remote} ${targetBranch}`, { stdio: "inherit" });
        
        return {
          content: [
            {
              type: "text",
              text: `Pushed ${targetBranch} to ${remote}`,
            },
          ],
        };
      }

      case "git-pull": {
        const { branch, remote = "origin" } = args;
        const currentBranch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
        const targetBranch = branch || currentBranch;
        
        execSync(`git pull ${remote} ${targetBranch}`, { stdio: "inherit" });
        
        return {
          content: [
            {
              type: "text",
              text: `Pulled latest changes from ${remote}/${targetBranch}`,
            },
          ],
        };
      }

      case "git-log": {
        const { limit = 10, branch } = args;
        const targetBranch = branch || "";
        const log = execSync(`git log --oneline -n ${limit} ${targetBranch}`, { encoding: "utf8" });
        
        return {
          content: [
            {
              type: "text",
              text: `Recent commits:\n${log}`,
            },
          ],
        };
      }

      // CI/CD tools
      case "create-github-workflow": {
        const { workflowName, triggers, branches, jobs } = args;
        
        const workflowContent = {
          name: workflowName,
          on: triggers.reduce((acc, trigger) => {
            if (trigger === "push" || trigger === "pull_request") {
              acc[trigger] = { branches: branches || ["main"] };
            } else {
              acc[trigger] = true;
            }
            return acc;
          }, {}),
          jobs: jobs.reduce((acc, job) => {
            acc[job.name] = {
              "runs-on": job.runsOn || "ubuntu-latest",
              steps: job.steps.map(step => {
                const stepObj = { name: step.name };
                if (step.uses) stepObj.uses = step.uses;
                if (step.run) stepObj.run = step.run;
                if (step.with) stepObj.with = step.with;
                return stepObj;
              })
            };
            return acc;
          }, {})
        };
        
        const workflowDir = ".github/workflows";
        if (!existsSync(workflowDir)) {
          mkdirSync(workflowDir, { recursive: true });
        }
        
        const workflowPath = join(workflowDir, `${workflowName}.yml`);
        writeFileSync(workflowPath, `# Generated by MCP Server\n${JSON.stringify(workflowContent, null, 2)}`);
        
        return {
          content: [
            {
              type: "text",
              text: `GitHub workflow created: ${workflowPath}`,
            },
          ],
        };
      }

      case "create-dockerfile": {
        const {
          baseImage = "node:18-alpine",
          workingDir = "/app",
          packageManager = "npm",
          buildCommand = "npm run build",
          startCommand = "npm start",
          port = 3000
        } = args;
        
        const dockerfileContent = `FROM ${baseImage}

WORKDIR ${workingDir}

# Copy package files
COPY package*.json ./

# Install dependencies
RUN ${packageManager} install

# Copy source code
COPY . .

# Build the application
RUN ${buildCommand}

# Expose port
EXPOSE ${port}

# Start the application
CMD ["${startCommand}"]`;
        
        writeFileSync("Dockerfile", dockerfileContent);
        
        return {
          content: [
            {
              type: "text",
              text: `Dockerfile created with base image: ${baseImage}`,
            },
          ],
        };
      }

      case "create-docker-compose": {
        const { services } = args;
        
        const composeContent = {
          version: "3.8",
          services: services.reduce((acc, service) => {
            acc[service.name] = {};
            if (service.image) acc[service.name].image = service.image;
            if (service.build) acc[service.name].build = service.build;
            if (service.ports) acc[service.name].ports = service.ports;
            if (service.environment) acc[service.name].environment = service.environment;
            if (service.volumes) acc[service.name].volumes = service.volumes;
            if (service.dependsOn) acc[service.name].depends_on = service.dependsOn;
            return acc;
          }, {})
        };
        
        writeFileSync("docker-compose.yml", `# Generated by MCP Server\n${JSON.stringify(composeContent, null, 2)}`);
        
        return {
          content: [
            {
              type: "text",
              text: `Docker Compose file created with ${services.length} services`,
            },
          ],
        };
      }

      case "create-env-file": {
        const { environments, variables } = args;
        
        environments.forEach(env => {
          const envContent = Object.entries(variables)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
          writeFileSync(`.env.${env}`, envContent);
        });
        
        return {
          content: [
            {
              type: "text",
              text: `Environment files created for: ${environments.join(', ')}`,
            },
          ],
        };
      }

      case "validate-ci-config": {
        const { configType } = args;
        
        let isValid = false;
        let message = "";
        
        switch (configType) {
          case "github-actions":
            if (existsSync(".github/workflows")) {
              const files = execSync("find .github/workflows -name '*.yml' -o -name '*.yaml'", { encoding: "utf8" });
              isValid = files.trim().length > 0;
              message = isValid ? `Found workflow files: ${files.trim().split('\n').join(', ')}` : "No workflow files found";
            } else {
              message = "No .github/workflows directory found";
            }
            break;
          case "docker":
            isValid = existsSync("Dockerfile");
            message = isValid ? "Dockerfile found" : "No Dockerfile found";
            break;
          case "docker-compose":
            isValid = existsSync("docker-compose.yml");
            message = isValid ? "docker-compose.yml found" : "No docker-compose.yml found";
            break;
        }
        
        return {
          content: [
            {
              type: "text",
              text: `CI/CD Config Validation (${configType}): ${isValid ? 'Valid' : 'Invalid'}\n${message}`,
            },
          ],
        };
      }

      // GitHub API tools
      case "create-pull-request": {
        const { title, body = "", head, base = "main" } = args;
        const repoInfo = getGitHubRepoInfo();
        
        if (!repoInfo) {
          throw new Error("Not in a GitHub repository");
        }
        
        const githubClient = createGitHubClient();
        const pr = await githubClient.pulls.create({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          title,
          body,
          head,
          base,
        });
        
        return {
          content: [
            {
              type: "text",
              text: `Pull request created: ${pr.data.html_url}`,
            },
          ],
        };
      }

      case "get-pull-requests": {
        const { state = "open", limit = 10 } = args;
        const repoInfo = getGitHubRepoInfo();
        
        if (!repoInfo) {
          throw new Error("Not in a GitHub repository");
        }
        
        const githubClient = createGitHubClient();
        const prs = await githubClient.pulls.list({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          state,
          per_page: limit,
        });
        
        const prList = prs.data.map(pr => 
          `• ${pr.title} (#${pr.number})\n  State: ${pr.state}\n  Author: ${pr.user.login}\n  URL: ${pr.html_url}`
        ).join('\n\n');
        
        return {
          content: [
            {
              type: "text",
              text: `Found ${prs.data.length} pull requests:\n\n${prList}`,
            },
          ],
        };
      }

      case "get-repository-info": {
        const repoInfo = getGitHubRepoInfo();
        
        if (!repoInfo) {
          throw new Error("Not in a GitHub repository");
        }
        
        const githubClient = createGitHubClient();
        const repo = await githubClient.repos.get({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
        });
        
        return {
          content: [
            {
              type: "text",
              text: `Repository: ${repo.data.full_name}\nDescription: ${repo.data.description || 'No description'}\nStars: ${repo.data.stargazers_count}\nForks: ${repo.data.forks_count}\nLanguage: ${repo.data.language || 'Unknown'}\nURL: ${repo.data.html_url}`,
            },
          ],
        };
      }

      // Jira tools
      case "jira-get-projects": {
        const projects = await jiraClient.getProjects();
        return {
          content: [
            {
              type: "text",
              text: `Found ${projects.length} projects:\n\n${projects.map(p => 
                `• ${p.key} - ${p.name}\n  Description: ${p.description || 'No description'}\n  Lead: ${p.lead.displayName}`
              ).join('\n\n')}`
            }
          ]
        };
      }

      case "jira-get-project": {
        const project = await jiraClient.getProject(args.projectKey);
        return {
          content: [
            {
              type: "text",
              text: `Project: ${project.name} (${project.key})\n\nDescription: ${project.description || 'No description'}\nLead: ${project.lead.displayName}\nProject Type: ${project.projectTypeKey}\nArchived: ${project.archived}`
            }
          ]
        };
      }

      case "jira-get-issues": {
        const issues = await jiraClient.getIssues(args.projectKey, args.jql, args.maxResults);
        return {
          content: [
            {
              type: "text",
              text: `Found ${issues.total} issues in project ${args.projectKey}:\n\n${issues.issues.map(issue => 
                `• ${issue.key} - ${issue.fields.summary}\n  Status: ${issue.fields.status.name}\n  Priority: ${issue.fields.priority.name}\n  Assignee: ${issue.fields.assignee?.displayName || 'Unassigned'}`
              ).join('\n\n')}`
            }
          ]
        };
      }

      case "jira-get-issue": {
        const issue = await jiraClient.getIssue(args.issueKey);
        return {
          content: [
            {
              type: "text",
              text: `Issue: ${issue.key}\n\nSummary: ${issue.fields.summary}\nDescription: ${issue.fields.description || 'No description'}\nStatus: ${issue.fields.status.name}\nPriority: ${issue.fields.priority.name}\nAssignee: ${issue.fields.assignee?.displayName || 'Unassigned'}\nReporter: ${issue.fields.reporter.displayName}\nCreated: ${issue.fields.created}\nUpdated: ${issue.fields.updated}`
            }
          ]
        };
      }

      case "jira-create-issue": {
        const issueData = {
          fields: {
            project: { key: args.projectKey },
            summary: args.summary,
            description: args.description || '',
            issuetype: { name: args.issueType },
            priority: args.priority ? { name: args.priority } : undefined,
            assignee: args.assignee ? { emailAddress: args.assignee } : undefined
          }
        };

        const newIssue = await jiraClient.createIssue(issueData);
        return {
          content: [
            {
              type: "text",
              text: `Issue created successfully!\n\nKey: ${newIssue.key}\nID: ${newIssue.id}\nURL: ${JIRA_BASE_URL}/browse/${newIssue.key}`
            }
          ]
        };
      }

      case "jira-update-issue": {
        const updateData = {
          fields: {}
        };

        if (args.summary) updateData.fields.summary = args.summary;
        if (args.description) updateData.fields.description = args.description;
        if (args.priority) updateData.fields.priority = { name: args.priority };
        if (args.assignee) updateData.fields.assignee = { emailAddress: args.assignee };

        await jiraClient.updateIssue(args.issueKey, updateData);
        return {
          content: [
            {
              type: "text",
              text: `Issue ${args.issueKey} updated successfully!`
            }
          ]
        };
      }

      case "jira-add-comment": {
        await jiraClient.addComment(args.issueKey, args.comment);
        return {
          content: [
            {
              type: "text",
              text: `Comment added to issue ${args.issueKey} successfully!`
            }
          ]
        };
      }

      case "jira-get-transitions": {
        const transitions = await jiraClient.getTransitions(args.issueKey);
        return {
          content: [
            {
              type: "text",
              text: `Available transitions for ${args.issueKey}:\n\n${transitions.transitions.map(t => 
                `• ${t.name} (ID: ${t.id})\n  To: ${t.to.name}\n  Description: ${t.description || 'No description'}`
              ).join('\n\n')}`
            }
          ]
        };
      }

      case "jira-transition-issue": {
        await jiraClient.transitionIssue(args.issueKey, args.transitionId);
        return {
          content: [
            {
              type: "text",
              text: `Issue ${args.issueKey} transitioned successfully!`
            }
          ]
        };
      }

      case "jira-get-workflows": {
        const workflows = await jiraClient.getWorkflows();
        return {
          content: [
            {
              type: "text",
              text: `Available workflows:\n\n${workflows.map(w => 
                `• ${w.name}\n  Description: ${w.description || 'No description'}\n  Status: ${w.status}`
              ).join('\n\n')}`
            }
          ]
        };
      }

      case "jira-get-workflow-scheme": {
        const scheme = await jiraClient.getWorkflowScheme(args.projectKey);
        return {
          content: [
            {
              type: "text",
              text: `Workflow scheme for project ${args.projectKey}:\n\nScheme: ${scheme.name}\nDescription: ${scheme.description || 'No description'}\nDefault Workflow: ${scheme.defaultWorkflow}`
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Combined MCP server running on stdio");
}

main().catch(console.error);








