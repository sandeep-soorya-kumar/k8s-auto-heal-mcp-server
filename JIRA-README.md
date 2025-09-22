# Jira MCP Server

A Model Context Protocol (MCP) server that provides comprehensive Jira integration for project management, issue tracking, and workflow automation.

## 🚀 Features

### **Project Management**
- **Get Projects** - List all Jira projects
- **Get Project Details** - Get specific project information
- **Workflow Schemes** - View project workflow configurations

### **Issue Management**
- **Get Issues** - List issues with JQL support
- **Get Issue Details** - View specific issue information
- **Create Issues** - Create new bugs, tasks, stories, etc.
- **Update Issues** - Modify existing issues
- **Add Comments** - Add comments to issues

### **Workflow Automation**
- **Get Transitions** - View available status transitions
- **Transition Issues** - Move issues through workflow states
- **Get Workflows** - List available workflows
- **Workflow Schemes** - View project workflow configurations

## 📋 Prerequisites

1. **Jira Instance** - Access to a Jira instance (Cloud or Server)
2. **API Token** - Jira API token for authentication
3. **Project Access** - Access to at least one Jira project

## 🔧 Setup

### **1. Get Jira API Token**

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a name (e.g., "MCP Server")
4. Copy the generated token

### **2. Configure Environment Variables**

Create a `.env` file or set environment variables:

```bash
# Jira Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token-here
```

### **3. Install Dependencies**

```bash
npm install
```

## 🚀 Usage

### **STDIO Mode (IDE Integration)**

```bash
# Start the server
npm run start:jira

# Or directly
node jira-mcp-server.js
```

### **HTTP Mode (Web/API Integration)**

```bash
# Start HTTP server
npm run start:jira-http

# Or directly
node jira-http-server.js
```

The HTTP server will run on `http://localhost:3001`

## 🛠️ Available Tools

### **Project Management**

#### `jira-get-projects`
Get list of all Jira projects.

**Parameters:** None

**Example:**
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "jira-get-projects", "arguments": {}}'
```

#### `jira-get-project`
Get details of a specific project.

**Parameters:**
- `projectKey` (string) - Project key (e.g., 'PROJ')

**Example:**
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "jira-get-project", "arguments": {"projectKey": "PROJ"}}'
```

### **Issue Management**

#### `jira-get-issues`
Get issues from a project with optional JQL filtering.

**Parameters:**
- `projectKey` (string) - Project key
- `jql` (string, optional) - JQL query
- `maxResults` (number, optional) - Maximum results (default: 50)

**Example:**
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "jira-get-issues", "arguments": {"projectKey": "PROJ", "maxResults": 10}}'
```

#### `jira-get-issue`
Get details of a specific issue.

**Parameters:**
- `issueKey` (string) - Issue key (e.g., 'PROJ-123')

**Example:**
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "jira-get-issue", "arguments": {"issueKey": "PROJ-123"}}'
```

#### `jira-create-issue`
Create a new Jira issue.

**Parameters:**
- `projectKey` (string) - Project key
- `summary` (string) - Issue summary/title
- `description` (string, optional) - Issue description
- `issueType` (string) - Issue type (e.g., 'Bug', 'Task', 'Story')
- `priority` (string, optional) - Priority (e.g., 'High', 'Medium', 'Low')
- `assignee` (string, optional) - Assignee email

**Example:**
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "jira-create-issue",
    "arguments": {
      "projectKey": "PROJ",
      "summary": "Fix login bug",
      "description": "Users cannot login with special characters",
      "issueType": "Bug",
      "priority": "High",
      "assignee": "user@example.com"
    }
  }'
```

#### `jira-update-issue`
Update an existing issue.

**Parameters:**
- `issueKey` (string) - Issue key
- `summary` (string, optional) - New summary
- `description` (string, optional) - New description
- `priority` (string, optional) - New priority
- `assignee` (string, optional) - New assignee

**Example:**
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "jira-update-issue",
    "arguments": {
      "issueKey": "PROJ-123",
      "summary": "Updated issue title",
      "priority": "Medium"
    }
  }'
```

#### `jira-add-comment`
Add a comment to an issue.

**Parameters:**
- `issueKey` (string) - Issue key
- `comment` (string) - Comment text

**Example:**
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "jira-add-comment",
    "arguments": {
      "issueKey": "PROJ-123",
      "comment": "This issue has been fixed in the latest release"
    }
  }'
```

### **Workflow Management**

#### `jira-get-transitions`
Get available transitions for an issue.

**Parameters:**
- `issueKey` (string) - Issue key

**Example:**
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "jira-get-transitions", "arguments": {"issueKey": "PROJ-123"}}'
```

#### `jira-transition-issue`
Transition an issue to a new status.

**Parameters:**
- `issueKey` (string) - Issue key
- `transitionId` (string) - Transition ID (from get-transitions)

**Example:**
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "jira-transition-issue",
    "arguments": {
      "issueKey": "PROJ-123",
      "transitionId": "31"
    }
  }'
```

#### `jira-get-workflows`
Get available workflows.

**Parameters:** None

**Example:**
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "jira-get-workflows", "arguments": {}}'
```

#### `jira-get-workflow-scheme`
Get workflow scheme for a project.

**Parameters:**
- `projectKey` (string) - Project key

**Example:**
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "jira-get-workflow-scheme", "arguments": {"projectKey": "PROJ"}}'
```

## 🧪 Testing

Run the test suite:

```bash
npm run test:jira
```

This will test all Jira functionality (requires valid Jira credentials).

## 🔗 Integration Examples

### **VS Code Integration**

Add to your VS Code settings:

```json
{
  "mcp.servers": {
    "jira-mcp-server": {
      "command": "node",
      "args": ["./jira-mcp-server.js"],
      "env": {
        "JIRA_BASE_URL": "https://your-domain.atlassian.net",
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### **Web Application Integration**

```javascript
// List projects
const projects = await fetch('http://localhost:3001/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tool: 'jira-get-projects', arguments: {} })
}).then(r => r.json());

// Create issue
const newIssue = await fetch('http://localhost:3001/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tool: 'jira-create-issue',
    arguments: {
      projectKey: 'PROJ',
      summary: 'New feature request',
      issueType: 'Story',
      priority: 'Medium'
    }
  })
}).then(r => r.json());
```

## 🔒 Security

- **API Token Authentication** - Uses Jira API tokens for secure access
- **Environment Variables** - Sensitive data stored in environment variables
- **HTTPS Support** - Works with HTTPS Jira instances
- **CORS Enabled** - For web application integration

## 🚨 Troubleshooting

### **Common Issues**

1. **Authentication Failed**
   - Check your Jira email and API token
   - Verify the Jira base URL is correct
   - Ensure your account has access to the project

2. **Project Not Found**
   - Verify the project key exists
   - Check your account has access to the project
   - Ensure the project is not archived

3. **Issue Creation Failed**
   - Check required fields (projectKey, summary, issueType)
   - Verify the issue type exists in the project
   - Check assignee email is valid

4. **Transition Failed**
   - Use `jira-get-transitions` to see available transitions
   - Check the issue is in the correct state
   - Verify you have permission to transition the issue

### **Debug Mode**

Set environment variable for detailed logging:

```bash
DEBUG=jira-mcp node jira-mcp-server.js
```

## 📚 JQL Examples

Use JQL queries with `jira-get-issues`:

```bash
# Get all open bugs
{"tool": "jira-get-issues", "arguments": {"jql": "project = PROJ AND type = Bug AND status = Open"}}

# Get issues assigned to me
{"tool": "jira-get-issues", "arguments": {"jql": "assignee = currentUser()"}}

# Get issues created this week
{"tool": "jira-get-issues", "arguments": {"jql": "created >= -1w"}}

# Get high priority issues
{"tool": "jira-get-issues", "arguments": {"jql": "priority = High"}}
```

## 🎯 Use Cases

- **Project Management** - Track project progress and issues
- **Bug Tracking** - Create, update, and manage bug reports
- **Feature Development** - Manage user stories and tasks
- **Workflow Automation** - Automate issue status transitions
- **Team Collaboration** - Add comments and assign issues
- **Reporting** - Generate issue reports and metrics
- **Integration** - Connect with other tools and systems

## 🔄 Workflow Examples

### **Bug Fix Workflow**
1. Create bug issue
2. Assign to developer
3. Add comments during development
4. Transition to "In Review"
5. Transition to "Done"

### **Feature Development Workflow**
1. Create user story
2. Break down into tasks
3. Assign tasks to team members
4. Track progress through status transitions
5. Close when complete

This Jira MCP server provides comprehensive project management capabilities that can be integrated into any MCP-compatible system! 🚀
