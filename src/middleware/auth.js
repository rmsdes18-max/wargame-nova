module.exports = function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return next(); // dev mode: no secret configured = open
  if (req.headers['x-admin-secret'] === secret) return next();
  return res.status(401).json({ error: 'Unauthorized' });
};
