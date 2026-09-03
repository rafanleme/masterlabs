const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      type: 'https://httpstatuses.com/401',
      title: 'Unauthorized',
      status: 401,
    });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    // Tokens do portal do cliente (scope 'portal') não valem para rotas internas
    if (payload.scope === 'portal' || !payload.userId) {
      return res.status(401).json({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
      });
    }
    req.user = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
    };
    next();
  } catch {
    return res.status(401).json({
      type: 'https://httpstatuses.com/401',
      title: 'Unauthorized',
      status: 401,
    });
  }
};
