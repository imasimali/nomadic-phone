import jwt, { JwtPayload } from 'jsonwebtoken'
import { Response, NextFunction } from 'express'
import config from '../config.js'
import { AuthenticatedRequest } from '../types/index.js'

interface TokenPayload extends JwtPayload {
  app?: string
  username?: string
  type?: string
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: 'Access token required',
        code: 'MISSING_TOKEN',
      })
      return
    }

    if (!config.JWT_SECRET) {
      res.status(500).json({
        error: 'JWT secret not configured',
        code: 'CONFIG_ERROR',
      })
      return
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as TokenPayload

    // Simple check - just verify the token is valid and contains our app identifier
    if (!decoded.app || decoded.app !== 'nomadic-phone') {
      res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      })
      return
    }

    // Set a simple user object for compatibility
    req.user = {
      id: 1,
      username: 'admin',
      twilio_client_name: 'nomadic_client',
    }

    next()
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      })
      return
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      })
      return
    }

    console.error('Auth middleware error:', error)
    res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR',
    })
  }
}

const generateAccessToken = (): string => {
  if (!config.JWT_SECRET) {
    throw new Error('JWT secret not configured')
  }

  return jwt.sign(
    {
      app: 'nomadic-phone',
      username: 'admin',
    },
    config.JWT_SECRET,
    {
      expiresIn: '24h',
      issuer: 'nomadic-phone',
      audience: 'nomadic-phone-client',
    },
  )
}

const generateRefreshToken = (): string => {
  if (!config.JWT_SECRET) {
    throw new Error('JWT secret not configured')
  }

  return jwt.sign(
    {
      app: 'nomadic-phone',
      type: 'refresh',
    },
    config.JWT_SECRET,
    {
      expiresIn: '7d',
      issuer: 'nomadic-phone',
      audience: 'nomadic-phone-client',
    },
  )
}

const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    if (!config.JWT_SECRET) {
      throw new Error('JWT secret not configured')
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as TokenPayload
    if (decoded.type !== 'refresh' || decoded.app !== 'nomadic-phone') {
      throw new Error('Invalid token type')
    }
    return decoded
  } catch (error) {
    throw error
  }
}

export { authenticateToken, generateAccessToken, generateRefreshToken, verifyRefreshToken }
