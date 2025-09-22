#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync, spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { Octokit } from "@octokit/rest";
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

const server = new Server(
  {
    name: "git-cicd-http-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Git Repository Management Tools
const gitTools = [
  {
    name: "git-status",
    description: "Get the current status of a Git repository",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
        },
      },
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
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "git-commit",
    description: "Create a commit with staged changes",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Commit message",
        },
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
        },
        addAll: {
          type: "boolean",
          description: "Whether to add all changes before committing (default: false)",
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
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
        },
        force: {
          type: "boolean",
          description: "Force push (default: false)",
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
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
        },
      },
      required: [],
    },
  },
  {
    name: "git-log",
    description: "Get commit history",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Number of commits to show (default: 10)",
        },
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
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

// CI/CD Workflow Tools
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
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
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
          type: "integer",
          description: "Port to expose (default: 3000)",
        },
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
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
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
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
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
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
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
        },
      },
      required: ["configType"],
    },
  },
];

// GitHub API Tools
const githubTools = [
  {
    name: "create-pull-request",
    description: "Create a pull request on GitHub",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the pull request",
        },
        body: {
          type: "string",
          description: "Description/body of the pull request",
        },
        head: {
          type: "string",
          description: "Source branch name (the branch with your changes)",
        },
        base: {
          type: "string",
          description: "Target branch name (usually 'main' or 'master')",
        },
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
        },
        githubToken: {
          type: "string",
          description: "GitHub personal access token (or set GITHUB_TOKEN environment variable)",
        },
        draft: {
          type: "boolean",
          description: "Create as draft pull request (default: false)",
        },
      },
      required: ["title", "head", "base"],
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
          description: "State of pull requests to fetch (default: 'open')",
        },
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
        },
        githubToken: {
          type: "string",
          description: "GitHub personal access token (or set GITHUB_TOKEN environment variable)",
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
      properties: {
        repoPath: {
          type: "string",
          description: "Path to the Git repository (defaults to current directory)",
        },
        githubToken: {
          type: "string",
          description: "GitHub personal access token (or set GITHUB_TOKEN environment variable)",
        },
      },
      required: [],
    },
  },
];

// Utility functions (same as STDIO version)
function executeGitCommand(command, repoPath = process.cwd()) {
  try {
    const result = execSync(command, {
      cwd: repoPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr?.toString() || "",
    };
  }
}

function ensureDirectoryExists(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getGitHubRepoInfo(repoPath = process.cwd()) {
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      cwd: repoPath,
      encoding: "utf8",
    }).trim();
    
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
      };
    }
    throw new Error("Not a GitHub repository or invalid remote URL");
  } catch (error) {
    throw new Error(`Failed to get GitHub repository info: ${error.message}`);
  }
}

function createGitHubClient(token) {
  const githubToken = token || process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error("GitHub token is required. Set GITHUB_TOKEN environment variable or pass githubToken parameter.");
  }
  
  return new Octokit({
    auth: githubToken,
  });
}

// MCP Server Handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [...gitTools, ...cicdTools, ...githubTools],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const repoPath = args.repoPath || process.cwd();

  try {
    switch (name) {
      // Git Repository Management (same as STDIO version)
      case "git-status": {
        const result = executeGitCommand("git status --porcelain", repoPath);
        const branchResult = executeGitCommand("git branch --show-current", repoPath);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                currentBranch: branchResult.success ? branchResult.output : "unknown",
                status: result.success ? result.output : result.error,
                hasChanges: result.success && result.output.length > 0,
              }, null, 2),
            },
          ],
        };
      }

      case "git-branch": {
        const { action, branchName } = args;
        
        switch (action) {
          case "list": {
            const result = executeGitCommand("git branch -a", repoPath);
            return {
              content: [
                {
                  type: "text",
                  text: result.success ? result.output : result.error,
                },
              ],
            };
          }
          case "create": {
            if (!branchName) {
              throw new Error("Branch name is required for create action");
            }
            const result = executeGitCommand(`git checkout -b ${branchName}`, repoPath);
            return {
              content: [
                {
                  type: "text",
                  text: result.success ? `Created and switched to branch: ${branchName}` : result.error,
                },
              ],
            };
          }
          case "switch": {
            if (!branchName) {
              throw new Error("Branch name is required for switch action");
            }
            const result = executeGitCommand(`git checkout ${branchName}`, repoPath);
            return {
              content: [
                {
                  type: "text",
                  text: result.success ? `Switched to branch: ${branchName}` : result.error,
                },
              ],
            };
          }
          case "delete": {
            if (!branchName) {
              throw new Error("Branch name is required for delete action");
            }
            const result = executeGitCommand(`git branch -d ${branchName}`, repoPath);
            return {
              content: [
                {
                  type: "text",
                  text: result.success ? `Deleted branch: ${branchName}` : result.error,
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
          const addResult = executeGitCommand("git add .", repoPath);
          if (!addResult.success) {
            throw new Error(`Failed to add files: ${addResult.error}`);
          }
        }
        
        const result = executeGitCommand(`git commit -m "${message}"`, repoPath);
        return {
          content: [
            {
              type: "text",
              text: result.success ? `Commit created: ${message}` : result.error,
            },
          ],
        };
      }

      case "git-push": {
        const { branch, remote = "origin", force = false } = args;
        const currentBranch = branch || executeGitCommand("git branch --show-current", repoPath).output;
        const forceFlag = force ? " --force" : "";
        
        const result = executeGitCommand(`git push${forceFlag} ${remote} ${currentBranch}`, repoPath);
        return {
          content: [
            {
              type: "text",
              text: result.success ? `Pushed to ${remote}/${currentBranch}` : result.error,
            },
          ],
        };
      }

      case "git-pull": {
        const { branch, remote = "origin" } = args;
        const currentBranch = branch || executeGitCommand("git branch --show-current", repoPath).output;
        
        const result = executeGitCommand(`git pull ${remote} ${currentBranch}`, repoPath);
        return {
          content: [
            {
              type: "text",
              text: result.success ? `Pulled from ${remote}/${currentBranch}` : result.error,
            },
          ],
        };
      }

      case "git-log": {
        const { limit = 10, branch } = args;
        const branchArg = branch ? ` ${branch}` : "";
        
        const result = executeGitCommand(`git log --oneline -n ${limit}${branchArg}`, repoPath);
        return {
          content: [
            {
              type: "text",
              text: result.success ? result.output : result.error,
            },
          ],
        };
      }

      // CI/CD Workflow Tools (same as STDIO version)
      case "create-github-workflow": {
        const { workflowName, triggers, branches, jobs } = args;
        
        const workflowContent = {
          name: workflowName,
          on: {},
        };

        triggers.forEach(trigger => {
          if (trigger === "push" || trigger === "pull_request") {
            workflowContent.on[trigger] = branches ? { branches } : {};
          } else if (trigger === "schedule") {
            workflowContent.on[trigger] = [{ cron: "0 0 * * *" }];
          } else {
            workflowContent.on[trigger] = {};
          }
        });

        workflowContent.jobs = {};
        jobs.forEach(job => {
          workflowContent.jobs[job.name] = {
            "runs-on": job.runsOn || "ubuntu-latest",
            steps: job.steps.map(step => {
              const stepObj = { name: step.name };
              if (step.uses) stepObj.uses = step.uses;
              if (step.run) stepObj.run = step.run;
              if (step.with) stepObj.with = step.with;
              return stepObj;
            }),
          };
        });

        const workflowPath = join(repoPath, ".github", "workflows", `${workflowName}.yml`);
        ensureDirectoryExists(workflowPath);
        
        const yamlContent = `name: ${workflowName}
on:
${triggers.map(trigger => {
  if (trigger === "push" || trigger === "pull_request") {
    return `  ${trigger}:${branches ? `\n    branches: [${branches.map(b => `"${b}"`).join(", ")}]` : ""}`;
  } else if (trigger === "schedule") {
    return `  ${trigger}:\n    - cron: "0 0 * * *"`;
  } else {
    return `  ${trigger}:`;
  }
}).join("\n")}

jobs:
${jobs.map(job => `  ${job.name}:
    runs-on: ${job.runsOn || "ubuntu-latest"}
    steps:
${job.steps.map(step => {
  let stepYaml = `      - name: ${step.name}`;
  if (step.uses) stepYaml += `\n        uses: ${step.uses}`;
  if (step.run) stepYaml += `\n        run: ${step.run}`;
  if (step.with) {
    stepYaml += `\n        with:`;
    Object.entries(step.with).forEach(([key, value]) => {
      stepYaml += `\n          ${key}: ${typeof value === "string" ? `"${value}"` : value}`;
    });
  }
  return stepYaml;
}).join("\n")}`).join("\n")}`;

        writeFileSync(workflowPath, yamlContent);
        
        return {
          content: [
            {
              type: "text",
              text: `GitHub Actions workflow created at: ${workflowPath}`,
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
          port = 3000,
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

        const dockerfilePath = join(repoPath, "Dockerfile");
        writeFileSync(dockerfilePath, dockerfileContent);
        
        return {
          content: [
            {
              type: "text",
              text: `Dockerfile created at: ${dockerfilePath}`,
            },
          ],
        };
      }

      case "create-docker-compose": {
        const { services } = args;

        const composeContent = `version: '3.8'

services:
${services.map(service => {
  let serviceYaml = `  ${service.name}:`;
  if (service.image) serviceYaml += `\n    image: ${service.image}`;
  if (service.build) serviceYaml += `\n    build: ${service.build}`;
  if (service.ports) {
    serviceYaml += `\n    ports:`;
    service.ports.forEach(port => {
      serviceYaml += `\n      - "${port}"`;
    });
  }
  if (service.environment) {
    serviceYaml += `\n    environment:`;
    Object.entries(service.environment).forEach(([key, value]) => {
      serviceYaml += `\n      - ${key}=${value}`;
    });
  }
  if (service.volumes) {
    serviceYaml += `\n    volumes:`;
    service.volumes.forEach(volume => {
      serviceYaml += `\n      - ${volume}`;
    });
  }
  if (service.dependsOn) {
    serviceYaml += `\n    depends_on:`;
    service.dependsOn.forEach(dep => {
      serviceYaml += `\n      - ${dep}`;
    });
  }
  return serviceYaml;
}).join("\n")}`;

        const composePath = join(repoPath, "docker-compose.yml");
        writeFileSync(composePath, composeContent);
        
        return {
          content: [
            {
              type: "text",
              text: `Docker Compose file created at: ${composePath}`,
            },
          ],
        };
      }

      case "create-env-file": {
        const { environments, variables } = args;
        const results = [];

        environments.forEach(env => {
          const envContent = Object.entries(variables)
            .map(([key, value]) => `${key}=${value}`)
            .join("\n");
          
          const envPath = join(repoPath, `.env.${env}`);
          writeFileSync(envPath, envContent);
          results.push(`Environment file created: ${envPath}`);
        });

        return {
          content: [
            {
              type: "text",
              text: results.join("\n"),
            },
          ],
        };
      }

      case "validate-ci-config": {
        const { configType } = args;
        const results = [];

        switch (configType) {
          case "github-actions": {
            const workflowsDir = join(repoPath, ".github", "workflows");
            if (existsSync(workflowsDir)) {
              const files = require("fs").readdirSync(workflowsDir).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
              results.push(`Found ${files.length} workflow files: ${files.join(", ")}`);
            } else {
              results.push("No .github/workflows directory found");
            }
            break;
          }
          case "docker": {
            const dockerfilePath = join(repoPath, "Dockerfile");
            if (existsSync(dockerfilePath)) {
              results.push("Dockerfile found and appears valid");
            } else {
              results.push("No Dockerfile found");
            }
            break;
          }
          case "docker-compose": {
            const composePath = join(repoPath, "docker-compose.yml");
            if (existsSync(composePath)) {
              results.push("docker-compose.yml found and appears valid");
            } else {
              results.push("No docker-compose.yml found");
            }
            break;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: results.join("\n"),
            },
          ],
        };
      }

      // GitHub API Tools (same as STDIO version)
      case "create-pull-request": {
        const { title, body, head, base, githubToken, draft = false } = args;
        
        const repoInfo = getGitHubRepoInfo(repoPath);
        const octokit = createGitHubClient(githubToken);
        
        const prData = {
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          title,
          head,
          base,
          draft,
        };
        
        if (body) {
          prData.body = body;
        }
        
        const response = await octokit.rest.pulls.create(prData);
        
        return {
          content: [
            {
              type: "text",
              text: `Pull request created successfully!\n\nTitle: ${response.data.title}\nNumber: #${response.data.number}\nURL: ${response.data.html_url}\nState: ${response.data.state}`,
            },
          ],
        };
      }

      case "get-pull-requests": {
        const { state = "open", githubToken } = args;
        
        const repoInfo = getGitHubRepoInfo(repoPath);
        const octokit = createGitHubClient(githubToken);
        
        const response = await octokit.rest.pulls.list({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          state,
        });
        
        const prs = response.data.map(pr => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author: pr.user.login,
          created_at: pr.created_at,
          url: pr.html_url,
        }));
        
        return {
          content: [
            {
              type: "text",
              text: `Found ${prs.length} ${state} pull requests:\n\n${prs.map(pr => `#${pr.number}: ${pr.title} (by ${pr.author}) - ${pr.url}`).join('\n')}`,
            },
          ],
        };
      }

      case "get-repository-info": {
        const { githubToken } = args;
        
        const repoInfo = getGitHubRepoInfo(repoPath);
        const octokit = createGitHubClient(githubToken);
        
        const response = await octokit.rest.repos.get({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
        });
        
        const repo = response.data;
        
        return {
          content: [
            {
              type: "text",
              text: `Repository Information:\n\nName: ${repo.name}\nFull Name: ${repo.full_name}\nDescription: ${repo.description || 'No description'}\nLanguage: ${repo.language || 'Unknown'}\nStars: ${repo.stargazers_count}\nForks: ${repo.forks_count}\nOpen Issues: ${repo.open_issues_count}\nURL: ${repo.html_url}`,
            },
          ],
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

// HTTP Routes
app.get('/', (req, res) => {
  res.json({
    name: "Git CI/CD HTTP MCP Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      mcp: "/mcp",
      health: "/health",
      tools: "/tools"
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/tools', async (req, res) => {
  try {
    // Create a mock request for tools/list
    const mockRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    };
    
    // Handle the request directly
    const response = await server.requestHandler(ListToolsRequestSchema, mockRequest);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MCP endpoint using Server-Sent Events
app.get('/mcp', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const transport = new SSEServerTransport('/mcp', res);
  await server.connect(transport);
});

// Handle MCP requests via POST
app.post('/mcp', async (req, res) => {
  try {
    const { method, params } = req.body;
    
    let response;
    if (method === "tools/list") {
      const mockRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {}
      };
      response = await server.requestHandler(ListToolsRequestSchema, mockRequest);
    } else if (method === "tools/call") {
      const mockRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: params.name, arguments: params.arguments }
      };
      response = await server.requestHandler(CallToolRequestSchema, mockRequest);
    } else {
      throw new Error(`Unknown method: ${method}`);
    }
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
async function main() {
  try {
    app.listen(PORT, () => {
      console.log(`🚀 Git CI/CD HTTP MCP Server running on port ${PORT}`);
      console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
      console.log(`🔧 Tools endpoint: http://localhost:${PORT}/tools`);
      console.log(`❤️  Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("Server error:", error);
    process.exit(1);
  }
}

main();
