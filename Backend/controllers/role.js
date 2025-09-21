const Role = require('../models/Roles');    

const createRole = async (req, res) => {
    const newRole = new Role(req.body);
    try {
        const savedRole = await newRole.save();
        res.status(201).json(savedRole);
    } catch (error) {
        res.status(500).json(error);
    }
};

const getRoles = async (req, res) => {
    try {
        const roles = await Role.find();
        res.status(200).json(roles);
    } catch (error) {
        res.status(500).json(error);
    }
};

module.exports = { createRole, getRoles };