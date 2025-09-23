#!/bin/bash

# Start MCP Auto-Fix Servers with consistent configuration
echo "🚀 Starting MCP Auto-Fix Servers..."

# Kill any existing servers
echo "🔄 Stopping existing servers..."
pkill -f "enhanced-auto-fix-webhook.js" 2>/dev/null || true
pkill -f "alert-ui-server.js" 2>/dev/null || true

# Wait a moment for processes to stop
sleep 2

# Update UI files with correct ports
echo "🔧 Updating UI configuration..."
node update-ui-ports.js

# Start the enhanced auto-fix webhook server
echo "📡 Starting Enhanced Auto-Fix Webhook Server on port 5003..."
node enhanced-auto-fix-webhook.js &
WEBHOOK_PID=$!

# Wait for webhook server to start
sleep 3

# Start the alert UI server
echo "🖥️  Starting Alert UI Server on port 3000..."
node alert-ui-server.js &
UI_PID=$!

# Wait for UI server to start
sleep 3

# Test connections
echo "🧪 Testing server connections..."
if curl -s http://localhost:5003/health > /dev/null; then
    echo "✅ Webhook server is running on http://localhost:5003"
else
    echo "❌ Webhook server failed to start"
fi

if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ UI server is running on http://localhost:3000"
else
    echo "❌ UI server failed to start"
fi

echo ""
echo "🎉 Servers started successfully!"
echo "📡 Webhook endpoint: http://localhost:5003/webhook"
echo "🏥 Webhook health: http://localhost:5003/health"
echo "🖥️  UI dashboard: http://localhost:3000"
echo "📊 UI health: http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop all servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $WEBHOOK_PID 2>/dev/null || true
    kill $UI_PID 2>/dev/null || true
    echo "✅ Servers stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for background processes
wait
