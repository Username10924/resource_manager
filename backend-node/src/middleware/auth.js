const jwt = require('jsonwebtoken');
const User = require('../models/user');

// JWT settings
const SECRET_KEY = "68729ea65bf0e8ef73f74bebb3ba545e";
const ALGORITHM = "HS256";
const ACCESS_TOKEN_EXPIRE_MINUTES = 480; // 8 hours

function createAccessToken(data) {
  const payload = {
    ...data,
    exp: Math.floor(Date.now() / 1000) + (ACCESS_TOKEN_EXPIRE_MINUTES * 60)
  };
  return jwt.sign(payload, SECRET_KEY, { algorithm: ALGORITHM });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET_KEY, { algorithms: [ALGORITHM] });
  } catch (e) {
    return null;
  }
}

// Express middleware for authentication
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      detail: "Could not validate credentials"
    });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload || !payload.sub) {
    return res.status(401).json({
      detail: "Could not validate credentials"
    });
  }

  const user = User.getByUsername(payload.sub);
  if (!user) {
    return res.status(401).json({
      detail: "Could not validate credentials"
    });
  }

  req.currentUser = user;
  next();
}

// Optional authentication - doesn't fail if no token
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload && payload.sub) {
      const user = User.getByUsername(payload.sub);
      if (user) {
        req.currentUser = user;
      }
    }
  }

  next();
}

module.exports = {
  SECRET_KEY,
  ALGORITHM,
  ACCESS_TOKEN_EXPIRE_MINUTES,
  createAccessToken,
  verifyToken,
  authenticate,
  optionalAuth
};
