const errorHandler = (err, req, res, next) => {
  console.error('Error:', err)

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    })
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
    })
  }

  // Twilio errors
  if (err.code && err.code.toString().startsWith('2')) {
    return res.status(400).json({
      error: 'Twilio API error',
      code: 'TWILIO_ERROR',
      details: {
        twilioCode: err.code,
        message: err.message,
      },
    })
  }

  // Rate limiting errors
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Please try again later',
    })
  }

  // Custom application errors
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({
      error: err.message,
      code: err.code || 'APPLICATION_ERROR',
    })
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
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'APPLICATION_ERROR') {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}

// Async error wrapper to catch async errors in route handlers
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export { errorHandler, AppError, asyncHandler }
