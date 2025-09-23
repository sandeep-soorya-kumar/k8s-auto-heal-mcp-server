// Configuration file for MCP Auto-Fix Server
export const config = {
  // Server ports
  webhook: {
    port: process.env.WEBHOOK_PORT || 5003,
    host: process.env.WEBHOOK_HOST || 'localhost'
  },
  
  // UI server
  ui: {
    port: process.env.UI_PORT || 3000,
    host: process.env.UI_HOST || 'localhost'
  },
  
  // Git configuration
  git: {
    repository: process.env.GIT_REPOSITORY || 'https://github.com/sandeep-soorya-kumar/k8s-auto-heal-mcp-server.git',
    branch: process.env.GIT_BRANCH || 'main'
  },
  
  // Auto-fix settings
  autoFix: {
    enabled: process.env.AUTO_FIX_ENABLED !== 'false',
    maxRetries: parseInt(process.env.AUTO_FIX_MAX_RETRIES) || 3,
    timeout: parseInt(process.env.AUTO_FIX_TIMEOUT) || 30000
  },
  
  // Resource limits for auto-fix
  resourceLimits: {
    cpu: {
      default: process.env.DEFAULT_CPU_LIMIT || '200m',
      max: process.env.MAX_CPU_LIMIT || '1000m',
      increment: process.env.CPU_INCREMENT || '200m'
    },
    memory: {
      default: process.env.DEFAULT_MEMORY_LIMIT || '256Mi',
      max: process.env.MAX_MEMORY_LIMIT || '2Gi',
      increment: process.env.MEMORY_INCREMENT || '128Mi'
    }
  }
};

// Helper function to get webhook URL
export const getWebhookUrl = () => {
  return `http://${config.webhook.host}:${config.webhook.port}`;
};

// Helper function to get UI URL
export const getUiUrl = () => {
  return `http://${config.ui.host}:${config.ui.port}`;
};

export default config;
