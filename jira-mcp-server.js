#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";

// Jira configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "https://your-domain.atlassian.net";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";

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
    name: "jira-mcp-server",
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
    tools: jiraTools,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
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
  console.error("Jira MCP server running on stdio");
}

main().catch(console.error);
