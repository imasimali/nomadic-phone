const jwt = require('jsonwebtoken');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Simple check - just verify the token is valid and contains our app identifier
    if (!decoded.app || decoded.app !== 'nomadic-phone') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    // Set a simple user object for compatibility
    req.user = {
      id: 1,
      username: 'admin',
      twilio_client_name: 'nomadic_client'
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

const generateAccessToken = () => {
  return jwt.sign(
    {
      app: 'nomadic-phone',
      username: 'admin'
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '24h',
      issuer: 'nomadic-phone',
      audience: 'nomadic-phone-client'
    }
  );
};

const generateRefreshToken = () => {
  return jwt.sign(
    {
      app: 'nomadic-phone',
      type: 'refresh'
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d',
      issuer: 'nomadic-phone',
      audience: 'nomadic-phone-client'
    }
  );
};

const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'refresh' || decoded.app !== 'nomadic-phone') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  authenticateToken,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
};
