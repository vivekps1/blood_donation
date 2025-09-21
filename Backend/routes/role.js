const express = require('express'); 
const { createRole, getRoles } = require('../controllers/role');
const { verifyToken, verifyTokenAndAuthorization } = require('../middlewares/verifyToken');
const router = express.Router() ;

// Create a new role
router.post('/', verifyTokenAndAuthorization, createRole);

// Get all roles
router.get('/', verifyToken, getRoles);

module.exports = router ;