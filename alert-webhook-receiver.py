#!/usr/bin/env python3
"""
Simple webhook receiver for Prometheus AlertManager
This script receives alerts and displays them in a user-friendly format
"""

import json
import sys
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import time

class AlertWebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            alert_data = json.loads(post_data.decode('utf-8'))
            self.handle_alert(alert_data)
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing JSON: {e}")
            self.send_response(400)
            self.end_headers()
            return
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"status": "success"}')
    
    def handle_alert(self, alert_data):
        """Process and display alert data"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        print(f"\n{'='*80}")
        print(f"🚨 ALERT RECEIVED - {timestamp}")
        print(f"{'='*80}")
        
        # Extract alert information
        status = alert_data.get('status', 'unknown')
        group_labels = alert_data.get('groupLabels', {})
        common_labels = alert_data.get('commonLabels', {})
        common_annotations = alert_data.get('commonAnnotations', {})
        alerts = alert_data.get('alerts', [])
        
        # Display group information
        if group_labels:
            print(f"📋 Group: {group_labels.get('alertname', 'Unknown')}")
            if 'cluster' in group_labels:
                print(f"🏢 Cluster: {group_labels['cluster']}")
            if 'service' in group_labels:
                print(f"🔧 Service: {group_labels['service']}")
        
        # Display common information
        if common_labels:
            severity = common_labels.get('severity', 'unknown')
            category = common_labels.get('category', 'unknown')
            print(f"⚡ Severity: {severity.upper()}")
            print(f"📂 Category: {category}")
        
        # Display each alert
        for i, alert in enumerate(alerts, 1):
            print(f"\n🔔 Alert #{i}:")
            
            # Alert status
            alert_status = alert.get('status', 'unknown')
            status_emoji = "🚨" if alert_status == "firing" else "✅"
            print(f"   Status: {status_emoji} {alert_status.upper()}")
            
            # Alert labels
            labels = alert.get('labels', {})
            if labels:
                print(f"   📍 Labels:")
                for key, value in labels.items():
                    if key not in ['alertname', 'severity', 'category', 'service']:
                        print(f"      {key}: {value}")
            
            # Alert annotations
            annotations = alert.get('annotations', {})
            if annotations:
                print(f"   📝 Details:")
                for key, value in annotations.items():
                    if key == 'summary':
                        print(f"      Summary: {value}")
                    elif key == 'description':
                        # Format description nicely
                        desc_lines = value.split('\n')
                        print(f"      Description:")
                        for line in desc_lines:
                            if line.strip():
                                print(f"        {line.strip()}")
                    elif key == 'runbook_url':
                        print(f"      Runbook: {value}")
                    elif key == 'dashboard_url':
                        print(f"      Dashboard: {value}")
            
            # Alert timing
            if 'startsAt' in alert:
                print(f"   ⏰ Started: {alert['startsAt']}")
            if 'endsAt' in alert and alert['endsAt'] != '0001-01-01T00:00:00Z':
                print(f"   ⏹️  Ended: {alert['endsAt']}")
        
        print(f"{'='*80}")
        print(f"📊 Total alerts in group: {len(alerts)}")
        print(f"{'='*80}\n")
    
    def log_message(self, format, *args):
        # Suppress default logging
        pass

def start_webhook_server(port=5001):
    """Start the webhook server"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, AlertWebhookHandler)
    
    print(f"🚀 Alert Webhook Receiver started on port {port}")
    print(f"📡 Listening for alerts at:")
    print(f"   - http://localhost:{port}/webhook")
    print(f"   - http://localhost:{port}/critical")
    print(f"   - http://localhost:{port}/warning")
    print(f"\n💡 Press Ctrl+C to stop the server")
    print(f"{'='*80}")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"\n🛑 Server stopped by user")
        httpd.server_close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
    start_webhook_server(port)
