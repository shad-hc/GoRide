/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile management
 */
const router = require('express').Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

router.use(authenticate);

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *   patch:
 *     summary: Update current user profile
 *     tags: [Users]
 */
router.route('/profile')
  .get(async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, user });
  })
  .patch(async (req, res, next) => {
    try {
      const allowed = ['name', 'phone', 'vehicleInfo'];
      const updates = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true }).select('-password');
      res.json({ success: true, user });
    } catch (err) { next(err); }
  });

/**
 * @swagger
 * /users/change-password:
 *   patch:
 *     summary: Change user password
 *     tags: [Users]
 */
router.patch('/change-password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      throw new AppError('Current password is incorrect', 400);
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { next(err); }
});

module.exports = router;
