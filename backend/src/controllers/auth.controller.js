const authService = require('../services/auth.service');

const respond = (res, status, data) => res.status(status).json({ success: true, ...data });

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    respond(res, 201, {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    respond(res, 200, {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) { next(err); }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshTokens(refreshToken);
    respond(res, 200, tokens);
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.user._id.toString());
    respond(res, 200, { message: 'Logged out successfully' });
  } catch (err) { next(err); }
}

async function me(req, res) {
  res.json({ success: true, user: req.user });
}

module.exports = { register, login, refresh, logout, me };
