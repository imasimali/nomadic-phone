// Load environment variables and config
import config from './config.js'

import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import express, { Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import authRoutes from './routes/auth.js'
import voiceRoutes from './routes/voice.js'
import smsRoutes from './routes/sms.js'
import webhookRoutes from './routes/webhooks.js'
import { errorHandler } from './middleware/errorHandler.js'
import { authenticateToken } from './middleware/auth.js'
import apiKeyService from './services/apiKeyService.js'

const app = express()
const PORT = config.PORT

// Trust proxy for rate limiting
app.set('trust proxy', 1)

// Basic security with permissive CSP for Twilio
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:', 'http:'],
        connectSrc: ["'self'", 'https:', 'http:', 'ws:', 'wss:'],
        mediaSrc: ["'self'", 'https:', 'http:', 'blob:', 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:', 'http:'],
        fontSrc: ["'self'", 'https:', 'http:', 'data:'],
        imgSrc: ["'self'", 'https:', 'http:', 'data:', 'blob:'],
        frameSrc: ["'self'", 'https:', 'http:'],
        objectSrc: ["'none'"],
      },
    },
  }),
)

// Simple rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests, please try again later.',
})
app.use('/api/', limiter)

// Simple CORS
app.use(
  cors({
    origin: config.NODE_ENV === 'production' ? config.APP_URL : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  }),
)

// Basic middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(compression())

// Simple logging
if (config.NODE_ENV !== 'test') {
  app.use(morgan('combined'))
}

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/voice', authenticateToken, voiceRoutes)
app.use('/api/sms', authenticateToken, smsRoutes)
app.use('/webhooks', webhookRoutes) // Webhooks don't need auth token

// Serve static files from React build in production
if (config.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/build')))

  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../../client/build/index.html'))
  })
}

// Error handling middleware
app.use(errorHandler)

// Server startup
async function startServer(): Promise<void> {
  try {
    // Initialize API key service on startup
    if (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN) {
      console.log('Initializing API key service...')
      await apiKeyService.initialize()
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      console.log(`Environment: ${config.NODE_ENV}`)
      if (config.NODE_ENV === 'development') {
        console.log(`API available at: http://localhost:${PORT}/api`)
        console.log(`Health check: http://localhost:${PORT}/health`)
      }
    })
  } catch (error) {
    console.error('Unable to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully')
  process.exit(0)
})

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
}

export default app
