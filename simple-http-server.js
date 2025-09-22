#!/usr/bin/env node

/**
 * Simple HTTP MCP Server for Git CI/CD
 * A simplified HTTP version that works without complex MCP transport
 */

import express from "express";
import cors from "cors";
import { execSync, spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { Octokit } from "@octokit/rest";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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

// Available tools
const tools = [
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
];

// Tool execution function
async function executeTool(toolName, args) {
  const repoPath = args.repoPath || process.cwd();

  try {
    switch (toolName) {
      case "git-status": {
        const result = executeGitCommand("git status --porcelain", repoPath);
        const branchResult = executeGitCommand("git branch --show-current", repoPath);
        
        return {
          success: true,
          result: {
            currentBranch: branchResult.success ? branchResult.output : "unknown",
            status: result.success ? result.output : result.error,
            hasChanges: result.success && result.output.length > 0,
          }
        };
      }

      case "git-branch": {
        const { action, branchName } = args;
        
        switch (action) {
          case "list": {
            const result = executeGitCommand("git branch -a", repoPath);
            return {
              success: true,
              result: {
                output: result.success ? result.output : result.error
              }
            };
          }
          case "create": {
            if (!branchName) {
              throw new Error("Branch name is required for create action");
            }
            const result = executeGitCommand(`git checkout -b ${branchName}`, repoPath);
            return {
              success: true,
              result: {
                output: result.success ? `Created and switched to branch: ${branchName}` : result.error
              }
            };
          }
          case "switch": {
            if (!branchName) {
              throw new Error("Branch name is required for switch action");
            }
            const result = executeGitCommand(`git checkout ${branchName}`, repoPath);
            return {
              success: true,
              result: {
                output: result.success ? `Switched to branch: ${branchName}` : result.error
              }
            };
          }
          case "delete": {
            if (!branchName) {
              throw new Error("Branch name is required for delete action");
            }
            const result = executeGitCommand(`git branch -d ${branchName}`, repoPath);
            return {
              success: true,
              result: {
                output: result.success ? `Deleted branch: ${branchName}` : result.error
              }
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
          success: true,
          result: {
            output: result.success ? `Commit created: ${message}` : result.error
          }
        };
      }

      case "git-push": {
        const { branch, remote = "origin", force = false } = args;
        const currentBranch = branch || executeGitCommand("git branch --show-current", repoPath).output;
        const forceFlag = force ? " --force" : "";
        
        const result = executeGitCommand(`git push${forceFlag} ${remote} ${currentBranch}`, repoPath);
        return {
          success: true,
          result: {
            output: result.success ? `Pushed to ${remote}/${currentBranch}` : result.error
          }
        };
      }

      case "git-pull": {
        const { branch, remote = "origin" } = args;
        const currentBranch = branch || executeGitCommand("git branch --show-current", repoPath).output;
        
        const result = executeGitCommand(`git pull ${remote} ${currentBranch}`, repoPath);
        return {
          success: true,
          result: {
            output: result.success ? `Pulled from ${remote}/${currentBranch}` : result.error
          }
        };
      }

      case "git-log": {
        const { limit = 10, branch } = args;
        const branchArg = branch ? ` ${branch}` : "";
        
        const result = executeGitCommand(`git log --oneline -n ${limit}${branchArg}`, repoPath);
        return {
          success: true,
          result: {
            output: result.success ? result.output : result.error
          }
        };
      }

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
          success: true,
          result: {
            output: `Pull request created successfully!\n\nTitle: ${response.data.title}\nNumber: #${response.data.number}\nURL: ${response.data.html_url}\nState: ${response.data.state}`
          }
        };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// HTTP Routes
app.get('/', (req, res) => {
  res.json({
    name: "Git CI/CD HTTP Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      tools: "/tools",
      health: "/health",
      execute: "/execute"
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/tools', (req, res) => {
  res.json({
    success: true,
    tools: tools
  });
});

app.post('/execute', async (req, res) => {
  try {
    const { tool, arguments: args } = req.body;
    
    if (!tool) {
      return res.status(400).json({ error: 'Tool name is required' });
    }

    const result = await executeTool(tool, args || {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Git CI/CD HTTP Server running on port ${PORT}`);
  console.log(`📡 Tools endpoint: http://localhost:${PORT}/tools`);
  console.log(`🔧 Execute endpoint: http://localhost:${PORT}/execute`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});









