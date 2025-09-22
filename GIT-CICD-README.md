# Git CI/CD MCP Server

A comprehensive Model Context Protocol (MCP) server that provides Git repository management and CI/CD workflow automation tools. This server enables AI assistants to interact with Git repositories and automate CI/CD pipeline creation and management.

## Features

### Git Repository Management
- **git-status**: Get current repository status and branch information
- **git-branch**: List, create, switch, or delete Git branches
- **git-commit**: Create commits with staged changes
- **git-push**: Push commits to remote repositories
- **git-pull**: Pull latest changes from remote repositories
- **git-log**: View commit history with customizable limits

### CI/CD Workflow Automation
- **create-github-workflow**: Generate GitHub Actions workflow files
- **create-dockerfile**: Create Dockerfiles for containerization
- **create-docker-compose**: Generate docker-compose.yml files
- **create-env-file**: Create environment configuration files
- **validate-ci-config**: Validate CI/CD configuration files

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Running the Server

```bash
# Start the Git CI/CD MCP server
npm run start:git-cicd

# Or directly
node git-cicd-server.js
```

### Running Tests

```bash
# Run the comprehensive test suite
npm run test:git-cicd

# Or directly
node git-cicd-test.js
```

## Tool Reference

### Git Repository Management Tools

#### git-status
Get the current status of a Git repository.

**Parameters:**
- `repoPath` (optional): Path to the Git repository (defaults to current directory)

**Example:**
```json
{
  "name": "git-status",
  "arguments": {
    "repoPath": "/path/to/your/repo"
  }
}
```

**Response:**
```json
{
  "currentBranch": "main",
  "status": "",
  "hasChanges": false
}
```

#### git-branch
List, create, switch, or delete Git branches.

**Parameters:**
- `action` (required): "list", "create", "switch", or "delete"
- `branchName` (required for create/switch/delete): Name of the branch
- `repoPath` (optional): Path to the Git repository

**Examples:**
```json
// List branches
{
  "name": "git-branch",
  "arguments": {
    "action": "list",
    "repoPath": "/path/to/your/repo"
  }
}

// Create new branch
{
  "name": "git-branch",
  "arguments": {
    "action": "create",
    "branchName": "feature/new-feature",
    "repoPath": "/path/to/your/repo"
  }
}
```

#### git-commit
Create a commit with staged changes.

**Parameters:**
- `message` (required): Commit message
- `addAll` (optional): Whether to add all changes before committing (default: false)
- `repoPath` (optional): Path to the Git repository

**Example:**
```json
{
  "name": "git-commit",
  "arguments": {
    "message": "Add new feature implementation",
    "addAll": true,
    "repoPath": "/path/to/your/repo"
  }
}
```

#### git-push
Push commits to remote repository.

**Parameters:**
- `branch` (optional): Branch to push (defaults to current branch)
- `remote` (optional): Remote name (defaults to "origin")
- `force` (optional): Force push (default: false)
- `repoPath` (optional): Path to the Git repository

**Example:**
```json
{
  "name": "git-push",
  "arguments": {
    "branch": "main",
    "remote": "origin",
    "force": false,
    "repoPath": "/path/to/your/repo"
  }
}
```

#### git-pull
Pull latest changes from remote repository.

**Parameters:**
- `branch` (optional): Branch to pull (defaults to current branch)
- `remote` (optional): Remote name (defaults to "origin")
- `repoPath` (optional): Path to the Git repository

**Example:**
```json
{
  "name": "git-pull",
  "arguments": {
    "branch": "main",
    "remote": "origin",
    "repoPath": "/path/to/your/repo"
  }
}
```

#### git-log
Get commit history.

**Parameters:**
- `limit` (optional): Number of commits to show (default: 10)
- `branch` (optional): Branch to show log for (defaults to current branch)
- `repoPath` (optional): Path to the Git repository

**Example:**
```json
{
  "name": "git-log",
  "arguments": {
    "limit": 20,
    "branch": "main",
    "repoPath": "/path/to/your/repo"
  }
}
```

### CI/CD Workflow Tools

#### create-github-workflow
Create a GitHub Actions workflow file.

**Parameters:**
- `workflowName` (required): Name of the workflow file (without .yml extension)
- `triggers` (required): Array of trigger events ["push", "pull_request", "schedule", "workflow_dispatch"]
- `branches` (optional): Array of branch names for push/PR triggers
- `jobs` (required): Array of job definitions
- `repoPath` (optional): Path to the Git repository

**Example:**
```json
{
  "name": "create-github-workflow",
  "arguments": {
    "workflowName": "ci-cd-pipeline",
    "triggers": ["push", "pull_request"],
    "branches": ["main", "develop"],
    "jobs": [
      {
        "name": "test",
        "runsOn": "ubuntu-latest",
        "steps": [
          {
            "name": "Checkout",
            "uses": "actions/checkout@v3"
          },
          {
            "name": "Setup Node.js",
            "uses": "actions/setup-node@v3",
            "with": {
              "node-version": "18"
            }
          },
          {
            "name": "Install dependencies",
            "run": "npm install"
          },
          {
            "name": "Run tests",
            "run": "npm test"
          }
        ]
      }
    ],
    "repoPath": "/path/to/your/repo"
  }
}
```

#### create-dockerfile
Create a Dockerfile for containerization.

**Parameters:**
- `baseImage` (optional): Base Docker image (default: "node:18-alpine")
- `workingDir` (optional): Working directory in container (default: "/app")
- `packageManager` (optional): Package manager to use ["npm", "yarn", "pnpm"] (default: "npm")
- `buildCommand` (optional): Build command (default: "npm run build")
- `startCommand` (optional): Start command (default: "npm start")
- `port` (optional): Port to expose (default: 3000)
- `repoPath` (optional): Path to the Git repository

**Example:**
```json
{
  "name": "create-dockerfile",
  "arguments": {
    "baseImage": "node:18-alpine",
    "workingDir": "/app",
    "packageManager": "npm",
    "buildCommand": "npm run build",
    "startCommand": "npm start",
    "port": 3000,
    "repoPath": "/path/to/your/repo"
  }
}
```

#### create-docker-compose
Create a docker-compose.yml file.

**Parameters:**
- `services` (required): Array of service definitions
- `repoPath` (optional): Path to the Git repository

**Example:**
```json
{
  "name": "create-docker-compose",
  "arguments": {
    "services": [
      {
        "name": "app",
        "build": ".",
        "ports": ["3000:3000"],
        "environment": {
          "NODE_ENV": "production"
        }
      },
      {
        "name": "database",
        "image": "postgres:13",
        "environment": {
          "POSTGRES_DB": "myapp",
          "POSTGRES_USER": "user",
          "POSTGRES_PASSWORD": "password"
        }
      }
    ],
    "repoPath": "/path/to/your/repo"
  }
}
```

#### create-env-file
Create environment configuration files.

**Parameters:**
- `environments` (required): Array of environment names ["development", "staging", "production"]
- `variables` (required): Object of environment variables
- `repoPath` (optional): Path to the Git repository

**Example:**
```json
{
  "name": "create-env-file",
  "arguments": {
    "environments": ["development", "production"],
    "variables": {
      "NODE_ENV": "development",
      "PORT": "3000",
      "DATABASE_URL": "postgresql://localhost:5432/myapp",
      "API_KEY": "your-api-key"
    },
    "repoPath": "/path/to/your/repo"
  }
}
```

#### validate-ci-config
Validate CI/CD configuration files.

**Parameters:**
- `configType` (required): Type of configuration ["github-actions", "docker", "docker-compose"]
- `repoPath` (optional): Path to the Git repository

**Example:**
```json
{
  "name": "validate-ci-config",
  "arguments": {
    "configType": "github-actions",
    "repoPath": "/path/to/your/repo"
  }
}
```

## Use Cases

### 1. Automated Git Workflow
```json
// Check status
{"name": "git-status", "arguments": {"repoPath": "/my/project"}}

// Create feature branch
{"name": "git-branch", "arguments": {"action": "create", "branchName": "feature/new-api", "repoPath": "/my/project"}}

// Commit changes
{"name": "git-commit", "arguments": {"message": "Implement new API endpoint", "addAll": true, "repoPath": "/my/project"}}

// Push to remote
{"name": "git-push", "arguments": {"branch": "feature/new-api", "repoPath": "/my/project"}}
```

### 2. Complete CI/CD Setup
```json
// Create GitHub Actions workflow
{"name": "create-github-workflow", "arguments": {
  "workflowName": "deploy",
  "triggers": ["push"],
  "branches": ["main"],
  "jobs": [{"name": "deploy", "runsOn": "ubuntu-latest", "steps": [...]}]
}}

// Create Dockerfile
{"name": "create-dockerfile", "arguments": {
  "baseImage": "node:18-alpine",
  "port": 8080
}}

// Create docker-compose for local development
{"name": "create-docker-compose", "arguments": {
  "services": [
    {"name": "app", "build": ".", "ports": ["8080:8080"]},
    {"name": "db", "image": "postgres:13"}
  ]
}}

// Create environment files
{"name": "create-env-file", "arguments": {
  "environments": ["development", "production"],
  "variables": {"NODE_ENV": "development", "PORT": "8080"}
}}
```

## Error Handling

The server provides comprehensive error handling:

- **Git Command Errors**: Returns detailed error messages from Git commands
- **File System Errors**: Handles missing directories and permission issues
- **Validation Errors**: Validates input parameters and provides clear error messages
- **Unknown Tools**: Returns appropriate error for unsupported tool names

## Security Considerations

- The server executes Git commands in the specified directory
- File operations are restricted to the repository path
- No remote code execution beyond Git operations
- Environment variables are handled securely

## Testing

The server includes a comprehensive test suite that:

- Creates a temporary test repository
- Tests all Git operations
- Validates CI/CD file generation
- Tests error handling scenarios
- Cleans up test artifacts

Run tests with:
```bash
npm run test:git-cicd
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

ISC License - see package.json for details.
