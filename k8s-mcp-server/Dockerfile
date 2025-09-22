# 🚀 Kubernetes Auto-Heal MCP Server Dockerfile
FROM node:18-alpine

# 📋 Metadata
LABEL maintainer="AI DevOps Team"
LABEL description="🤖 AI-powered Kubernetes cluster auto-healing and optimization"
LABEL version="1.0.0"

# 🔧 Install system dependencies
RUN apk add --no-cache \
    curl \
    ca-certificates \
    bash \
    git \
    && rm -rf /var/cache/apk/*

# 👤 Create non-root user
RUN addgroup -g 1001 -S k8s-heal && \
    adduser -S -D -H -u 1001 -s /sbin/nologin -G k8s-heal k8s-heal

# 📁 Set working directory
WORKDIR /app

# 📦 Copy package files
COPY k8s-mcp-server/package*.json ./

# 🔧 Install Node.js dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# 📄 Copy application code
COPY k8s-mcp-server/ ./

# 🔐 Set ownership and permissions
RUN chown -R k8s-heal:k8s-heal /app && \
    chmod +x k8s-auto-heal-server.js

# 👤 Switch to non-root user
USER k8s-heal

# 🌐 Expose ports
EXPOSE 3000 8080

# 🏥 Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 📊 Environment variables
ENV NODE_ENV=production
ENV MONITORING_INTERVAL=30
ENV AUTO_HEAL_ENABLED=true
ENV KUBE_NAMESPACE=monitoring
ENV MCP_SERVER_PORT=3000

# 🚀 Start command
CMD ["node", "k8s-auto-heal-server.js"]
