# Use Node.js 20 LTS as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nomadic -u 1001

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install all dependencies (needed for building)
RUN npm ci --ignore-scripts
RUN cd client && npm ci --ignore-scripts

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies and clean up
RUN npm ci --only=production --ignore-scripts && \
    cd client && npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Set ownership
RUN chown -R nomadic:nodejs /app

# Switch to non-root user
USER nomadic

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
