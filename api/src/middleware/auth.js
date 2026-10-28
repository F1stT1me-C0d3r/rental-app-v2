import jwt from 'jsonwebtoken';

// Two roles: CUSTOMER and ADMIN. Checked on every non-public route, never only in the UI.

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(httpError(401, 'Login required'));
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(httpError(401, 'Invalid or expired session'));
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) {
    try { req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET); } catch { /* ignore */ }
  }
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(httpError(401, 'Login required'));
    if (!roles.includes(req.user.role)) return next(httpError(403, 'Not allowed'));
    next();
  };
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
