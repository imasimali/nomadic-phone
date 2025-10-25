import express, { Response } from 'express'
import { body, validationResult } from 'express-validator'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, authenticateToken } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import config from '../config.js'
import { AuthenticatedRequest, LoginRequest, RefreshTokenRequest } from '../types/index.js'

const router = express.Router()

// Validation middleware
const validateLogin = [body('password').notEmpty().withMessage('Password is required')]

// Simple login - no registration needed
router.post(
  '/login',
  validateLogin,
  asyncHandler(async (req: express.Request<{}, {}, LoginRequest>, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
      return
    }

    const { password } = req.body

    // Check password against configuration
    const appPassword = config.APP_PASSWORD
    if (!appPassword) {
      throw new AppError('Application not configured', 500, 'APP_NOT_CONFIGURED')
    }

    if (password !== appPassword) {
      throw new AppError('Invalid password', 401, 'INVALID_CREDENTIALS')
    }

    // Generate tokens
    const accessToken = generateAccessToken()
    const refreshToken = generateRefreshToken()

    res.json({
      message: 'Login successful',
      user: {
        id: 1,
        username: 'admin',
        email: 'admin@nomadicphone.com',
        twilio_client_name: 'nomadic_client',
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    })
  }),
)

// Refresh token
router.post(
  '/refresh',
  asyncHandler(async (req: express.Request<{}, {}, RefreshTokenRequest>, res: Response) => {
    const { refreshToken } = req.body

    if (!refreshToken) {
      throw new AppError('Refresh token required', 400, 'MISSING_REFRESH_TOKEN')
    }

    try {
      verifyRefreshToken(refreshToken)

      const newAccessToken = generateAccessToken()
      const newRefreshToken = generateRefreshToken()

      res.json({
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      })
    } catch (error) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN')
    }
  }),
)

// Get current user profile
router.get(
  '/profile',
  authenticateToken,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json({
      user: {
        id: 1,
        username: 'admin',
        email: 'admin@nomadicphone.com',
        twilio_client_name: 'nomadic_client',
      },
    })
  }),
)

// Logout (client-side token invalidation)
router.post(
  '/logout',
  authenticateToken,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    // In a production app, you might want to maintain a blacklist of tokens
    // For now, we'll just return success and let the client handle token removal
    res.json({
      message: 'Logout successful',
    })
  }),
)

export default router
