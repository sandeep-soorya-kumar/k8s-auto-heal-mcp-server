import * as vscode from 'vscode';
import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:3000';

class MCPClient {
  async callTool(toolName: string, args: any = {}) {
    try {
      const response = await fetch(`${SERVER_URL}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: toolName,
          arguments: args
        })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`Failed to call ${toolName}: ${error}`);
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  const mcpClient = new MCPClient();
  
  // Git Status Command
  const statusCommand = vscode.commands.registerCommand('git-cicd-mcp.status', async () => {
    try {
      const result = await mcpClient.callTool('git-status');
      if (result.success) {
        const status = result.result;
        const message = `Current Branch: ${status.currentBranch}\nHas Changes: ${status.hasChanges}`;
        vscode.window.showInformationMessage(message);
        
        // Show detailed status in output channel
        const outputChannel = vscode.window.createOutputChannel('Git CI/CD MCP');
        outputChannel.show();
        outputChannel.appendLine('Git Status:');
        outputChannel.appendLine(`Current Branch: ${status.currentBranch}`);
        outputChannel.appendLine(`Has Changes: ${status.hasChanges}`);
        if (status.status) {
          outputChannel.appendLine('Changes:');
          outputChannel.appendLine(status.status);
        }
      } else {
        vscode.window.showErrorMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to get git status: ${error}`);
    }
  });

  // Git Branch Command
  const branchCommand = vscode.commands.registerCommand('git-cicd-mcp.branch', async () => {
    try {
      const result = await mcpClient.callTool('git-branch', { action: 'list' });
      if (result.success) {
        const outputChannel = vscode.window.createOutputChannel('Git CI/CD MCP');
        outputChannel.show();
        outputChannel.appendLine('Git Branches:');
        outputChannel.appendLine(result.result.output);
      } else {
        vscode.window.showErrorMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to list branches: ${error}`);
    }
  });

  // Git Commit Command
  const commitCommand = vscode.commands.registerCommand('git-cicd-mcp.commit', async () => {
    const message = await vscode.window.showInputBox({
      prompt: 'Enter commit message',
      placeHolder: 'Your commit message here'
    });
    
    if (message) {
      try {
        const result = await mcpClient.callTool('git-commit', { 
          message, 
          addAll: true 
        });
        if (result.success) {
          vscode.window.showInformationMessage(`Commit created: ${message}`);
        } else {
          vscode.window.showErrorMessage(`Error: ${result.error}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to commit: ${error}`);
      }
    }
  });

  // Git Push Command
  const pushCommand = vscode.commands.registerCommand('git-cicd-mcp.push', async () => {
    try {
      const result = await mcpClient.callTool('git-push');
      if (result.success) {
        vscode.window.showInformationMessage(result.result.output);
      } else {
        vscode.window.showErrorMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to push: ${error}`);
    }
  });

  // Create Pull Request Command
  const pullRequestCommand = vscode.commands.registerCommand('git-cicd-mcp.pullRequest', async () => {
    const title = await vscode.window.showInputBox({
      prompt: 'Enter PR title',
      placeHolder: 'Pull request title'
    });
    
    if (title) {
      const body = await vscode.window.showInputBox({
        prompt: 'Enter PR description (optional)',
        placeHolder: 'Pull request description'
      });
      
      const head = await vscode.window.showInputBox({
        prompt: 'Enter source branch',
        placeHolder: 'feature/my-branch'
      });
      
      const base = await vscode.window.showInputBox({
        prompt: 'Enter target branch',
        placeHolder: 'main',
        value: 'main'
      });
      
      if (head && base) {
        try {
          const result = await mcpClient.callTool('create-pull-request', {
            title,
            body: body || '',
            head,
            base
          });
          if (result.success) {
            vscode.window.showInformationMessage('Pull request created successfully!');
            const outputChannel = vscode.window.createOutputChannel('Git CI/CD MCP');
            outputChannel.show();
            outputChannel.appendLine('Pull Request Created:');
            outputChannel.appendLine(result.result.output);
          } else {
            vscode.window.showErrorMessage(`Error: ${result.error}`);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to create PR: ${error}`);
        }
      }
    }
  });

  context.subscriptions.push(
    statusCommand,
    branchCommand,
    commitCommand,
    pushCommand,
    pullRequestCommand
  );
}

export function deactivate() {}




