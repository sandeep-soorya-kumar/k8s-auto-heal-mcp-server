# Kubernetes Alert Manager UI

A modern web interface for manually triggering Kubernetes alerts and monitoring auto-fix workflows.

## 🚀 Features

### Frontend UI
- **Modern Dashboard**: Clean, responsive interface built with Tailwind CSS and Alpine.js
- **Real-time Monitoring**: Live cluster status, ArgoCD applications, and Git commits
- **Manual Alert Triggering**: Easy-to-use form to trigger various alert types
- **Activity History**: Track recent alerts and auto-fix results
- **Auto-refresh**: Updates every 30 seconds to show current status

### Backend API
- **Cluster Integration**: Fetches live pod and application data from Kubernetes
- **ArgoCD Integration**: Monitors application sync and health status
- **Git Integration**: Shows recent commits and changes
- **Webhook Status**: Monitors auto-fix webhook availability

### Auto-Fix Workflow
- **Pull Request Creation**: Creates PRs for auto-fixes (with GitHub CLI fallback)
- **Git Integration**: Commits changes and pushes to repository
- **ArgoCD Sync**: Automatic deployment after PR merge
- **Multiple Alert Types**: CPU, Memory, OOM, Crash Loop, and Test alerts

## 🛠️ Setup

### Prerequisites
- Node.js 18+
- Kubernetes cluster with kubectl access
- ArgoCD installed and configured
- Git repository with auto-fix webhook

### Installation

1. **Start the Enhanced Auto-Fix Webhook**:
   ```bash
   WEBHOOK_PORT=5004 node enhanced-auto-fix-webhook.js &
   ```

2. **Start the UI Server**:
   ```bash
   UI_PORT=3000 node alert-ui-server.js &
   ```

3. **Access the UI**:
   - Main UI: http://localhost:3000
   - Dashboard: http://localhost:3000/dashboard.html

### Quick Test
```bash
./test-ui-workflow.sh
```

## 📱 UI Components

### Main Dashboard (`/`)
- Alert trigger form with pod selection
- Recent alerts history
- Webhook status indicator
- Real-time cluster information

### Advanced Dashboard (`/dashboard.html`)
- Statistics cards (pods, apps, alerts, fixes)
- ArgoCD applications table
- Recent Git commits
- Quick alert trigger panel
- Recent activity feed

## 🔧 API Endpoints

### Core APIs
- `GET /api/cluster/pods` - List all pods in cluster
- `GET /api/argocd/applications` - ArgoCD application status
- `GET /api/git/commits` - Recent Git commits
- `GET /api/webhook/status` - Webhook server status
- `GET /api/alerts/templates` - Available alert types

### Health Checks
- `GET /health` - UI server health
- `GET /api/webhook/status` - Webhook connectivity

## 🚨 Alert Types

| Alert Type | Description | Severity | Auto-Fix Action |
|------------|-------------|----------|-----------------|
| `PodHighCPUUsage` | High CPU usage detected | Warning | Increase CPU limits (3x) |
| `PodHighMemoryUsage` | High memory usage detected | Warning | Increase memory limits (2x) |
| `PodOOMKilled` | Out of memory killed | Critical | Increase memory limits (2x) |
| `PodCrashLoopBackOff` | Pod crashing repeatedly | Critical | Restart deployment |
| `PodVeryHighMemoryUsage` | Very high memory usage | Critical | Increase memory limits (2x) |
| `TestAlert` | Test alert for validation | Info | Log and acknowledge |

## 🔄 Auto-Fix Workflow

1. **Alert Triggered**: User triggers alert via UI or system detects issue
2. **Webhook Processing**: Enhanced webhook receives and processes alert
3. **Resource Analysis**: Determines current resource limits and calculates new values
4. **Git Operations**: 
   - Creates new branch for auto-fix
   - Updates Helm values.yaml
   - Commits changes with descriptive message
   - Attempts to create PR (falls back to direct commit if GitHub CLI unavailable)
5. **ArgoCD Sync**: Automatically detects changes and syncs deployment
6. **Verification**: UI shows updated status and commit information

## 🎯 Usage Examples

### Trigger CPU Alert
1. Open http://localhost:3000
2. Select "High CPU Usage" from alert type dropdown
3. Choose target pod from the list
4. Set severity (Warning/Critical/Info)
5. Click "Trigger Alert"
6. Watch auto-fix process in background

### Monitor Cluster Health
1. Open http://localhost:3000/dashboard.html
2. View real-time statistics
3. Check ArgoCD application status
4. Review recent Git commits
5. Monitor recent activity feed

## 🔍 Troubleshooting

### Webhook Not Responding
```bash
# Check if webhook is running
curl http://localhost:5004/health

# Restart webhook if needed
pkill -f "enhanced-auto-fix-webhook"
WEBHOOK_PORT=5004 node enhanced-auto-fix-webhook.js &
```

### UI Server Issues
```bash
# Check UI server status
curl http://localhost:3000/health

# Restart UI server if needed
pkill -f "alert-ui-server"
UI_PORT=3000 node alert-ui-server.js &
```

### Git/PR Issues
- Ensure GitHub CLI is installed: `gh --version`
- Check Git credentials and permissions
- Verify repository access and push permissions

## 📊 Monitoring

### Key Metrics
- **Total Pods**: Number of pods in cluster
- **Healthy Apps**: ArgoCD applications in healthy state
- **Alerts Triggered**: Total alerts processed
- **Auto-Fixes**: Successful auto-fix operations

### Logs
- Webhook logs: Check terminal output for webhook server
- UI logs: Check browser console for frontend issues
- Kubernetes logs: `kubectl logs -f <pod-name>`

## 🔐 Security Considerations

- UI runs on localhost by default (not exposed externally)
- Webhook endpoints should be secured in production
- Git operations use local credentials
- Consider authentication for production deployments

## 🚀 Production Deployment

For production use:
1. Add authentication/authorization
2. Use HTTPS with proper certificates
3. Implement rate limiting
4. Add comprehensive logging
5. Set up monitoring and alerting
6. Use proper secrets management
7. Implement backup and recovery procedures

## 📝 Development

### Adding New Alert Types
1. Add alert type to `alertTemplates` in `alert-ui-server.js`
2. Implement handler in `enhanced-auto-fix-webhook.js`
3. Add UI components if needed
4. Test with manual trigger

### Customizing Auto-Fix Logic
1. Modify calculation methods in webhook
2. Update resource limits and scaling factors
3. Add new Git operations as needed
4. Test with various alert scenarios

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes and test thoroughly
4. Submit pull request with description
5. Ensure all tests pass

## 📄 License

This project is part of the MCP For Beginners tutorial series.
