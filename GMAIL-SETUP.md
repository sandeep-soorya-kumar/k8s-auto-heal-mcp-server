# Gmail SMTP Setup for AlertManager

## 📧 Email Alert Configuration

Your AlertManager is now configured to send alerts to: **sandeep.opensearch@gmail.com**

## 🔐 Gmail App Password Setup

To enable email alerts, you need to set up a Gmail App Password:

### Step 1: Enable 2-Factor Authentication
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already enabled

### Step 2: Generate App Password
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click on **App passwords**
3. Select **Mail** as the app
4. Select **Other (custom name)** as the device
5. Enter "AlertManager" as the name
6. Click **Generate**
7. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

### Step 3: Update AlertManager Configuration
Replace `your-app-password` in the values.yaml with your actual App Password:

```yaml
smtp_auth_password: 'abcd efgh ijkl mnop'  # Your actual App Password
```

### Step 4: Deploy the Changes
```bash
git add helm/prometheus/values.yaml
git commit -m "Configure Gmail SMTP for alerts"
git push
```

## 📨 Email Alert Features

### Critical Alerts (🚨)
- **Recipient**: sandeep.opensearch@gmail.com
- **Subject**: 🚨 CRITICAL: [Alert Name]
- **Content**: 
  - Alert summary and description
  - All alert labels
  - Runbook and dashboard links
  - **Timing**: 5s group wait, 30m repeat

### Warning Alerts (⚠️)
- **Recipient**: sandeep.opensearch@gmail.com
- **Subject**: ⚠️ WARNING: [Alert Name]
- **Content**: 
  - Alert summary and description
  - All alert labels
  - Runbook and dashboard links
  - **Timing**: 30s group wait, 2h repeat

## 🧪 Testing Email Alerts

1. **Start the OOM test**:
   ```bash
   ./test-oom-alert.sh
   ```

2. **Check your email** for alert notifications

3. **Verify in Prometheus**:
   - http://localhost:9090/alerts
   - http://localhost:9090/alertmanager

## 🔧 Alternative: Use Kubernetes Secret

For production, store the password in a Kubernetes secret:

```bash
kubectl create secret generic alertmanager-smtp \
  --from-literal=password='your-app-password' \
  -n monitoring
```

Then reference it in values.yaml:
```yaml
smtp_auth_password: '{{ .Values.alertmanager.smtpPassword }}'
```

## 📱 Email Alert Examples

### OOM Alert Email:
```
Subject: 🚨 CRITICAL: PodOOMKilled

Alert: 🚨 CRITICAL: Pod oom-test-pod was OOMKilled
Description: Pod oom-test-pod in namespace oom-test was killed due to Out of Memory (OOM).

Labels:
  pod: oom-test-pod
  namespace: oom-test
  container: memory-consumer
  node: worker-node-1

Runbook: https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/
Dashboard: http://localhost:9090/graph?g0.expr=...
```

## 🛡️ Security Notes

- **Never commit** the actual App Password to Git
- Use **Kubernetes secrets** for production deployments
- **Rotate** App Passwords regularly
- Consider using **dedicated service accounts** for production

## 🚀 Next Steps

1. Set up Gmail App Password
2. Update the password in values.yaml
3. Deploy the changes
4. Test with OOM alert
5. Check your email for notifications!

Your email alerts are now ready to keep you informed about critical issues in your Kubernetes cluster! 📧✨
