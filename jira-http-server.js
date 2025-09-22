#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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

// Routes
app.get('/', (req, res) => {
  res.json({
    name: 'Jira MCP HTTP Server',
    version: '1.0.0',
    description: 'Jira integration via HTTP API',
    endpoints: {
      health: '/health',
      tools: '/tools',
      execute: '/execute'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    jira: {
      baseUrl: JIRA_BASE_URL,
      configured: !!(JIRA_EMAIL && JIRA_API_TOKEN)
    }
  });
});

app.get('/tools', (req, res) => {
  const tools = [
    {
      name: "jira-get-projects",
      description: "Get list of Jira projects",
      parameters: {}
    },
    {
      name: "jira-get-project",
      description: "Get details of a specific Jira project",
      parameters: {
        projectKey: { type: "string", description: "Project key (e.g., 'PROJ')" }
      }
    },
    {
      name: "jira-get-issues",
      description: "Get issues from a Jira project",
      parameters: {
        projectKey: { type: "string", description: "Project key (e.g., 'PROJ')" },
        jql: { type: "string", description: "JQL query (optional)" },
        maxResults: { type: "number", description: "Maximum number of results (default: 50)" }
      }
    },
    {
      name: "jira-get-issue",
      description: "Get details of a specific Jira issue",
      parameters: {
        issueKey: { type: "string", description: "Issue key (e.g., 'PROJ-123')" }
      }
    },
    {
      name: "jira-create-issue",
      description: "Create a new Jira issue",
      parameters: {
        projectKey: { type: "string", description: "Project key (e.g., 'PROJ')" },
        summary: { type: "string", description: "Issue summary/title" },
        description: { type: "string", description: "Issue description" },
        issueType: { type: "string", description: "Issue type (e.g., 'Bug', 'Task', 'Story')" },
        priority: { type: "string", description: "Priority (e.g., 'High', 'Medium', 'Low')" },
        assignee: { type: "string", description: "Assignee email or account ID" }
      }
    },
    {
      name: "jira-update-issue",
      description: "Update an existing Jira issue",
      parameters: {
        issueKey: { type: "string", description: "Issue key (e.g., 'PROJ-123')" },
        summary: { type: "string", description: "New issue summary/title" },
        description: { type: "string", description: "New issue description" },
        priority: { type: "string", description: "New priority (e.g., 'High', 'Medium', 'Low')" },
        assignee: { type: "string", description: "New assignee email or account ID" }
      }
    },
    {
      name: "jira-add-comment",
      description: "Add a comment to a Jira issue",
      parameters: {
        issueKey: { type: "string", description: "Issue key (e.g., 'PROJ-123')" },
        comment: { type: "string", description: "Comment text" }
      }
    },
    {
      name: "jira-get-transitions",
      description: "Get available transitions for a Jira issue",
      parameters: {
        issueKey: { type: "string", description: "Issue key (e.g., 'PROJ-123')" }
      }
    },
    {
      name: "jira-transition-issue",
      description: "Transition a Jira issue to a new status",
      parameters: {
        issueKey: { type: "string", description: "Issue key (e.g., 'PROJ-123')" },
        transitionId: { type: "string", description: "Transition ID" }
      }
    },
    {
      name: "jira-get-workflows",
      description: "Get available workflows in Jira",
      parameters: {}
    },
    {
      name: "jira-get-workflow-scheme",
      description: "Get workflow scheme for a project",
      parameters: {
        projectKey: { type: "string", description: "Project key (e.g., 'PROJ')" }
      }
    }
  ];

  res.json({ tools });
});

app.post('/execute', async (req, res) => {
  const { tool, arguments: args } = req.body;

  if (!tool) {
    return res.status(400).json({ error: 'Tool name is required' });
  }

  try {
    let result;

    switch (tool) {
      case "jira-get-projects": {
        const projects = await jiraClient.getProjects();
        result = {
          success: true,
          result: {
            count: projects.length,
            projects: projects.map(p => ({
              key: p.key,
              name: p.name,
              description: p.description || 'No description',
              lead: p.lead.displayName
            }))
          }
        };
        break;
      }

      case "jira-get-project": {
        if (!args.projectKey) {
          throw new Error('projectKey is required');
        }
        const project = await jiraClient.getProject(args.projectKey);
        result = {
          success: true,
          result: {
            key: project.key,
            name: project.name,
            description: project.description || 'No description',
            lead: project.lead.displayName,
            projectType: project.projectTypeKey,
            archived: project.archived
          }
        };
        break;
      }

      case "jira-get-issues": {
        if (!args.projectKey) {
          throw new Error('projectKey is required');
        }
        const issues = await jiraClient.getIssues(args.projectKey, args.jql, args.maxResults);
        result = {
          success: true,
          result: {
            total: issues.total,
            issues: issues.issues.map(issue => ({
              key: issue.key,
              summary: issue.fields.summary,
              status: issue.fields.status.name,
              priority: issue.fields.priority.name,
              assignee: issue.fields.assignee?.displayName || 'Unassigned'
            }))
          }
        };
        break;
      }

      case "jira-get-issue": {
        if (!args.issueKey) {
          throw new Error('issueKey is required');
        }
        const issue = await jiraClient.getIssue(args.issueKey);
        result = {
          success: true,
          result: {
            key: issue.key,
            summary: issue.fields.summary,
            description: issue.fields.description || 'No description',
            status: issue.fields.status.name,
            priority: issue.fields.priority.name,
            assignee: issue.fields.assignee?.displayName || 'Unassigned',
            reporter: issue.fields.reporter.displayName,
            created: issue.fields.created,
            updated: issue.fields.updated
          }
        };
        break;
      }

      case "jira-create-issue": {
        if (!args.projectKey || !args.summary || !args.issueType) {
          throw new Error('projectKey, summary, and issueType are required');
        }
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
        result = {
          success: true,
          result: {
            key: newIssue.key,
            id: newIssue.id,
            url: `${JIRA_BASE_URL}/browse/${newIssue.key}`
          }
        };
        break;
      }

      case "jira-update-issue": {
        if (!args.issueKey) {
          throw new Error('issueKey is required');
        }
        const updateData = {
          fields: {}
        };
        if (args.summary) updateData.fields.summary = args.summary;
        if (args.description) updateData.fields.description = args.description;
        if (args.priority) updateData.fields.priority = { name: args.priority };
        if (args.assignee) updateData.fields.assignee = { emailAddress: args.assignee };

        await jiraClient.updateIssue(args.issueKey, updateData);
        result = {
          success: true,
          result: { message: `Issue ${args.issueKey} updated successfully!` }
        };
        break;
      }

      case "jira-add-comment": {
        if (!args.issueKey || !args.comment) {
          throw new Error('issueKey and comment are required');
        }
        await jiraClient.addComment(args.issueKey, args.comment);
        result = {
          success: true,
          result: { message: `Comment added to issue ${args.issueKey} successfully!` }
        };
        break;
      }

      case "jira-get-transitions": {
        if (!args.issueKey) {
          throw new Error('issueKey is required');
        }
        const transitions = await jiraClient.getTransitions(args.issueKey);
        result = {
          success: true,
          result: {
            transitions: transitions.transitions.map(t => ({
              id: t.id,
              name: t.name,
              to: t.to.name,
              description: t.description || 'No description'
            }))
          }
        };
        break;
      }

      case "jira-transition-issue": {
        if (!args.issueKey || !args.transitionId) {
          throw new Error('issueKey and transitionId are required');
        }
        await jiraClient.transitionIssue(args.issueKey, args.transitionId);
        result = {
          success: true,
          result: { message: `Issue ${args.issueKey} transitioned successfully!` }
        };
        break;
      }

      case "jira-get-workflows": {
        const workflows = await jiraClient.getWorkflows();
        result = {
          success: true,
          result: {
            workflows: workflows.map(w => ({
              name: w.name,
              description: w.description || 'No description',
              status: w.status
            }))
          }
        };
        break;
      }

      case "jira-get-workflow-scheme": {
        if (!args.projectKey) {
          throw new Error('projectKey is required');
        }
        const scheme = await jiraClient.getWorkflowScheme(args.projectKey);
        result = {
          success: true,
          result: {
            name: scheme.name,
            description: scheme.description || 'No description',
            defaultWorkflow: scheme.defaultWorkflow
          }
        };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${tool}`);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Jira MCP HTTP Server running on port ${PORT}`);
  console.log(`📡 Tools endpoint: http://localhost:${PORT}/tools`);
  console.log(`🔧 Execute endpoint: http://localhost:${PORT}/execute`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`\n🔑 Jira Configuration:`);
  console.log(`   Base URL: ${JIRA_BASE_URL}`);
  console.log(`   Email: ${JIRA_EMAIL || 'Not set'}`);
  console.log(`   API Token: ${JIRA_API_TOKEN ? 'Set' : 'Not set'}`);
});
