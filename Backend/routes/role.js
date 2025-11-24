const express = require('express'); 
const { createRole, getRoles } = require('../controllers/role');
const { verifyToken, verifyTokenAndAuthorization } = require('../middlewares/verifyToken');
const router = express.Router() ;

// Create a new role
router.post('/', createRole);

// Get all roles
router.get('/', getRoles);

module.exports = router ;