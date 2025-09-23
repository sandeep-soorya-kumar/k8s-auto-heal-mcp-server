#!/bin/bash

# Test script to demonstrate the complete alert flow
# This script shows how alerts flow from Prometheus -> AlertManager -> Webhook

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "🧪 Testing Complete Alert Flow"
echo ""

print_status "📋 Alert Flow Overview:"
echo "   1. Prometheus evaluates alert rules"
echo "   2. AlertManager receives firing alerts"
echo "   3. AlertManager routes alerts based on severity"
echo "   4. AlertManager sends notifications to configured receivers"
echo ""

print_status "🔧 Current Alert Configuration:"
echo "   • Critical alerts → http://localhost:5001/critical"
echo "   • Warning alerts → http://localhost:5001/warning"
echo "   • All alerts → http://localhost:5001/webhook"
echo ""

print_status "📊 Alert Types Configured:"
echo "   🚨 CRITICAL:"
echo "      - PodOOMKilled (immediate)"
echo "      - PodVeryHighMemoryUsage (95%+ memory)"
echo ""
echo "   ⚠️  WARNING:"
echo "      - PodHighMemoryUsage (90%+ memory)"
echo "      - PodCrashLoopBackOff"
echo "      - PodFrequentRestarts"
echo "      - NodeMemoryPressure"
echo "      - NodeDiskPressure"
echo ""

print_status "🚀 To test the alert flow:"
echo ""
echo "1. Start the webhook receiver:"
echo "   python3 alert-webhook-receiver.py"
echo ""
echo "2. In another terminal, run the OOM test:"
echo "   ./test-oom-alert.sh"
echo ""
echo "3. Watch for alerts in the webhook receiver output"
echo ""

print_status "🔍 Alternative Notification Methods:"
echo ""
echo "📧 Email Alerts (uncomment in values.yaml):"
echo "   - Configure SMTP settings"
echo "   - Uncomment email_configs sections"
echo "   - Alerts will be sent to specified email addresses"
echo ""
echo "💬 Slack Integration:"
echo "   - Create Slack webhook URL"
echo "   - Replace webhook URLs with Slack webhook"
echo "   - Format: https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
echo ""
echo "📱 Microsoft Teams:"
echo "   - Create Teams webhook URL"
echo "   - Replace webhook URLs with Teams webhook"
echo "   - Format: https://outlook.office.com/webhook/YOUR/TEAMS/WEBHOOK"
echo ""

print_status "📈 Monitoring Alert Status:"
echo ""
echo "• Prometheus Alerts: http://localhost:9090/alerts"
echo "• AlertManager UI: http://localhost:9090/alertmanager"
echo "• Alert Rules: http://localhost:9090/rules"
echo ""

print_success "Alert flow test setup complete!"
print_warning "Remember to start the webhook receiver before testing alerts!"
