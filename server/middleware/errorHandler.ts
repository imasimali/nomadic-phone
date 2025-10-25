import { Request, Response, NextFunction } from 'express'
import { AppError as IAppError } from '../types/index.js'

interface TwilioError extends Error {
  code?: string | number
  status?: number
}

interface RateLimitError extends Error {
  status?: number
}

interface CustomError extends Error {
  statusCode?: number
  code?: string
  isOperational?: boolean
}

const errorHandler = (err: TwilioError | RateLimitError | CustomError | Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Error:', err)

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    })
    return
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
    })
    return
  }

  // Twilio errors
  const twilioErr = err as TwilioError
  if (twilioErr.code && twilioErr.code.toString().startsWith('2')) {
    res.status(400).json({
      error: 'Twilio API error',
      code: 'TWILIO_ERROR',
      details: {
        twilioCode: twilioErr.code,
        message: twilioErr.message,
      },
    })
    return
  }

  // Rate limiting errors
  const rateLimitErr = err as RateLimitError
  if (rateLimitErr.status === 429) {
    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Please try again later',
    })
    return
  }

  // Custom application errors
  const customErr = err as CustomError
  if (customErr.isOperational) {
    res.status(customErr.statusCode || 400).json({
      error: customErr.message,
      code: customErr.code || 'APPLICATION_ERROR',
    })
    return
  }

  // Default server error
  const isDevelopment = process.env.NODE_ENV === 'development'

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDevelopment && {
      stack: err.stack,
      details: err.message,
    }),
  })
}

// Custom error class for application-specific errors
class AppError extends Error implements IAppError {
  public statusCode: number
  public code: string
  public isOperational: boolean

  constructor(message: string, statusCode: number = 400, code: string = 'APPLICATION_ERROR') {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}

// Async error wrapper to catch async errors in route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export { errorHandler, AppError, asyncHandler }
