/**
 * auth.controller.js
 * Controller handling user authentication, login, registration, profile, and logout endpoints.
 */

const authService = require('../services/auth/auth.service');
const { successResponse } = require('../utils/response');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return successResponse(res, result, 200, 'Login successful');
  } catch (err) {
    next(err);
  }
};

const register = async (req, res, next) => {
  try {
    const { email, name, password, role, accessLevel } = req.body;
    const result = await authService.register({ email, name, password, role, accessLevel });
    return successResponse(res, result, 201, 'User registered successfully');
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.userId);
    return successResponse(res, user, 200, 'User profile retrieved successfully');
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const result = await authService.logout(req.userId);
    return successResponse(res, result, 200, 'Logout successful');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  register,
  getMe,
  logout
};
