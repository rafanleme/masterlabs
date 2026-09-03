const jwt = require('jsonwebtoken');
const config = require('../config');

function unauthorized(res) {
  return res.status(401).json({
    type: 'https://httpstatuses.com/401',
    title: 'Unauthorized',
    status: 401,
  });
}

// Autentica tokens do portal do cliente (scope 'portal'). Tokens de usuários internos são rejeitados.
module.exports = function authenticatePortal(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) return unauthorized(res);

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    if (payload.scope !== 'portal' || !payload.clientId || !payload.tenantId) {
      return unauthorized(res);
    }
    req.portal = {
      clientId: payload.clientId,
      tenantId: payload.tenantId,
    };
    next();
  } catch {
    return unauthorized(res);
  }
};
