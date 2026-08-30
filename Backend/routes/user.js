const express = require('express');
const router = express.Router();
const controller = require('../controllers/user');
const { verifyToken } = require('../middlewares/verifyToken');
const { requirePermission } = require('../middlewares/permissions');
const { validateBody } = require('../middlewares/validate');

router.use(verifyToken);

// Self-service endpoints, available to every signed-in user.
router.get('/me', controller.getMe);
router.put('/me/preferences', controller.updatePreferences);

// Everything below manages *other* people's accounts and needs the manageUsers permission
// from tb_roles_and_permission.
router.get('/pending', requirePermission('manageUsers'), controller.getPendingUsers);
router.get('/', requirePermission('manageUsers'), controller.getUsers);

router.post('/', requirePermission('manageUsers'), validateBody({
    firstName: ['required'],
    email: ['required', 'email'],
    phoneNumber: ['required', 'phone'],
    bloodGroup: ['required', 'bloodGroup'],
    password: ['required']
}), controller.createUser);

router.get('/:id', requirePermission('manageUsers'), controller.getUserById);
router.put('/:id', requirePermission('manageUsers'), validateBody({
    email: ['email'], phoneNumber: ['phone'], bloodGroup: ['bloodGroup']
}), controller.updateUser);
router.patch('/:id/status', requirePermission('manageUsers'), controller.setUserStatus);
router.patch('/:id/role', requirePermission('manageUsers'), controller.setUserRole);
router.delete('/:id', requirePermission('manageUsers'), controller.deleteUser);

module.exports = router;
