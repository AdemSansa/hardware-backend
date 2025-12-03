const userSchema = require("./user.schema.js");
const bcrypt = require('bcrypt');
const { getUserStatus, updateUserHeartbeat, emitAllUsersUpdate } = require('../../services/statusTracker');

const create= async (req, res) =>{
    const { name, email, password } = req.body;
    const existingUser = await userSchema.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await userSchema.create({ name, email, password: passwordHash });
    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    // Emit real-time update
    await emitAllUsersUpdate();
    res.status(201).json(userResponse);
};

const getAll= async (req, res) =>{
    const users = await userSchema.find().select('-password');
    // Apply status logic to each user
    const usersWithStatus = users.map(user => getUserStatus(user));
    res.status(200).json(usersWithStatus);
};

const getOne= async (req, res) =>{
    const { id } = req.params;
    const user = await userSchema.findById(id).select('-password');
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    const userWithStatus = getUserStatus(user);
    res.status(200).json(userWithStatus);
};

const update= async (req, res) =>{
    const { id } = req.params;
    const { name, email, password } = req.body;
    const updateData = { name, email };
    if (password) {
        updateData.password = await bcrypt.hash(password, 10);
    }
    const user = await userSchema.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    const userWithStatus = getUserStatus(user);
    // Emit real-time update
    await emitAllUsersUpdate();
    res.status(200).json(userWithStatus);
};

const remove = async (req, res) =>{
    const { id } = req.params;
    await userSchema.findByIdAndDelete(id);
    // Emit real-time update
    await emitAllUsersUpdate();
    res.status(200).json({ message: "User deleted successfully" });
};

// Heartbeat endpoint to track user activity
const heartbeat = async (req, res) => {
    try {
        const userId = req.user.id;
        await updateUserHeartbeat(userId);
        res.status(200).json({ message: 'Heartbeat received', timestamp: new Date() });
    } catch (error) {
        console.error('Error processing heartbeat:', error);
        res.status(500).json({ message: 'Error processing heartbeat' });
    }
};

module.exports = { create, getAll, getOne, update, remove, heartbeat };

