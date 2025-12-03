const User = require('../modules/user/user.schema');

// Time window in milliseconds - user is considered online if last heartbeat was within this time
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get user status with computed online state
 * @param {Object} user - User document
 * @returns {Object} User with computed isOnline status
 */
const getUserStatus = (user) => {
  if (!user) return null;
  
  const now = new Date();
  const lastOnline = new Date(user.lastOnline);
  const timeSinceLastOnline = now - lastOnline;
  
  // User is online if explicitly marked as online AND last heartbeat was within threshold
  const isActuallyOnline = user.isOnline && timeSinceLastOnline < ONLINE_THRESHOLD_MS;
  
  return {
    ...user.toObject(),
    isOnline: isActuallyOnline,
    lastOnline: user.lastOnline
  };
};

/**
 * Emit user status update to all connected clients
 * @param {Object} user - User object with updated status
 */
const emitUserStatusUpdate = (user) => {
  if (global.io) {
    const userStatus = getUserStatus(user);
    global.io.emit('userStatusUpdate', userStatus);
  }
};

/**
 * Emit all users update to all connected clients
 */
const emitAllUsersUpdate = async () => {
  if (global.io) {
    try {
      const users = await User.find().select('-password');
      const usersWithStatus = users.map(user => getUserStatus(user));
      global.io.emit('allUsersUpdate', usersWithStatus);
    } catch (error) {
      console.error('Error emitting all users update:', error);
    }
  }
};

/**
 * Update user's online status based on heartbeat
 * @param {string} userId - User ID
 */
const updateUserHeartbeat = async (userId) => {
  try {
    const user = await User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastOnline: new Date()
    }, { new: true });
    if (user) {
      emitUserStatusUpdate(user);
    }
  } catch (error) {
    console.error('Error updating user heartbeat:', error);
  }
};

/**
 * Mark user as offline
 * @param {string} userId - User ID
 */
const markUserOffline = async (userId) => {
  try {
    const user = await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastOnline: new Date()
    }, { new: true });
    if (user) {
      emitUserStatusUpdate(user);
    }
  } catch (error) {
    console.error('Error marking user offline:', error);
  }
};

/**
 * Mark user as online (used on login)
 * @param {string} userId - User ID
 */
const markUserOnline = async (userId) => {
  try {
    const user = await User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastOnline: new Date()
    }, { new: true });
    if (user) {
      emitUserStatusUpdate(user);
    }
  } catch (error) {
    console.error('Error marking user online:', error);
  }
};

/**
 * Check and update online status based on lastOnline timestamp
 * This can be called periodically to mark users as offline if they haven't sent heartbeats
 */
const checkAndUpdateOnlineStatus = async () => {
  try {
    const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);
    // Mark users as offline if their lastOnline is older than threshold
    const result = await User.updateMany(
      {
        isOnline: true,
        lastOnline: { $lt: threshold }
      },
      {
        $set: { isOnline: false }
      }
    );
    
    // If any users were updated, emit all users update
    if (result.modifiedCount > 0) {
      await emitAllUsersUpdate();
    }
  } catch (error) {
    console.error('Error checking online status:', error);
  }
};

module.exports = {
  updateUserHeartbeat,
  markUserOffline,
  markUserOnline,
  checkAndUpdateOnlineStatus,
  getUserStatus,
  emitUserStatusUpdate,
  emitAllUsersUpdate,
  ONLINE_THRESHOLD_MS
};

