// Database handling for Smolov PWA

// IndexedDB database name and version
const DB_NAME = 'smolov-db';
const DB_VERSION = 1;

// Database schema
const DB_STORES = {
  USERS: 'users',
  WORKOUTS: 'workouts',
  STATS: 'statistics'
};

// Open database connection
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    // Handle database upgrade (called when DB is created or version changes)
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create users store if it doesn't exist
      if (!db.objectStoreNames.contains(DB_STORES.USERS)) {
        const userStore = db.createObjectStore(DB_STORES.USERS, { keyPath: 'id', autoIncrement: true });
        userStore.createIndex('lastActive', 'lastActive', { unique: false });
      }
      
      // Create workouts store if it doesn't exist
      if (!db.objectStoreNames.contains(DB_STORES.WORKOUTS)) {
        const workoutStore = db.createObjectStore(DB_STORES.WORKOUTS, { keyPath: 'id' });
        workoutStore.createIndex('userId', 'userId', { unique: false });
        workoutStore.createIndex('date', 'date', { unique: false });
        workoutStore.createIndex('phase', 'phase', { unique: false });
      }
      
      // Create statistics store if it doesn't exist
      if (!db.objectStoreNames.contains(DB_STORES.STATS)) {
        const statsStore = db.createObjectStore(DB_STORES.STATS, { keyPath: 'id', autoIncrement: true });
        statsStore.createIndex('userId', 'userId', { unique: false });
        statsStore.createIndex('date', 'date', { unique: false });
        statsStore.createIndex('type', 'type', { unique: false });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };
    
    request.onerror = (event) => {
      reject(`Database error: ${event.target.error}`);
    };
  });
}

// Get current user or create a default one
async function getCurrentUser() {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(DB_STORES.USERS, 'readwrite');
    const userStore = transaction.objectStore(DB_STORES.USERS);
    
    // Get all users
    const users = await new Promise((resolve, reject) => {
      const request = userStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // If no users exist, create a default one
    if (users.length === 0) {
      const newUser = {
        name: 'Default User',
        created: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };
      
      const userId = await new Promise((resolve, reject) => {
        const request = userStore.add(newUser);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      newUser.id = userId;
      return newUser;
    }
    
    // Return the first user (we're not implementing multi-user yet)
    const user = users[0];
    
    // Update last active timestamp
    user.lastActive = new Date().toISOString();
    await new Promise((resolve, reject) => {
      const request = userStore.put(user);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Save workout data to IndexedDB
async function saveWorkout(workoutData) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user found');
    
    const db = await openDatabase();
    const transaction = db.transaction([DB_STORES.WORKOUTS], 'readwrite');
    const workoutStore = transaction.objectStore(DB_STORES.WORKOUTS);
    
    // Add user ID to workout data
    workoutData.userId = user.id;
    
    // Save workout
    await new Promise((resolve, reject) => {
      const request = workoutStore.put(workoutData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return true;
  } catch (error) {
    console.error('Error saving workout:', error);
    return false;
  }
}

// Get all workouts for the current user
async function getUserWorkouts() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user found');
    
    const db = await openDatabase();
    const transaction = db.transaction([DB_STORES.WORKOUTS], 'readonly');
    const workoutStore = transaction.objectStore(DB_STORES.WORKOUTS);
    const userIndex = workoutStore.index('userId');
    
    // Get all workouts for this user
    const workouts = await new Promise((resolve, reject) => {
      const request = userIndex.getAll(user.id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return workouts;
  } catch (error) {
    console.error('Error getting user workouts:', error);
    return [];
  }
}

// Save a statistics record
async function saveStatistic(statData) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user found');
    
    const db = await openDatabase();
    const transaction = db.transaction([DB_STORES.STATS], 'readwrite');
    const statsStore = transaction.objectStore(DB_STORES.STATS);
    
    // Add user ID and date to stat data
    statData.userId = user.id;
    if (!statData.date) {
      statData.date = new Date().toISOString();
    }
    
    // Save statistic
    const statId = await new Promise((resolve, reject) => {
      const request = statsStore.add(statData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return statId;
  } catch (error) {
    console.error('Error saving statistic:', error);
    return null;
  }
}

// Get statistics by type
async function getStatisticsByType(type) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user found');
    
    const db = await openDatabase();
    const transaction = db.transaction([DB_STORES.STATS], 'readonly');
    const statsStore = transaction.objectStore(DB_STORES.STATS);
    const typeIndex = statsStore.index('type');
    
    // Get all stats of this type for this user
    const stats = await new Promise((resolve, reject) => {
      const request = typeIndex.getAll(type);
      request.onsuccess = () => {
        // Filter by user ID (since the index doesn't have a compound key)
        const allStats = request.result;
        const userStats = allStats.filter(stat => stat.userId === user.id);
        resolve(userStats);
      };
      request.onerror = () => reject(request.error);
    });
    
    return stats;
  } catch (error) {
    console.error(`Error getting statistics for type ${type}:`, error);
    return [];
  }
}

// Get all statistics for the current user
async function getAllUserStatistics() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user found');
    
    const db = await openDatabase();
    const transaction = db.transaction([DB_STORES.STATS], 'readonly');
    const statsStore = transaction.objectStore(DB_STORES.STATS);
    const userIndex = statsStore.index('userId');
    
    // Get all stats for this user
    const stats = await new Promise((resolve, reject) => {
      const request = userIndex.getAll(user.id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return stats;
  } catch (error) {
    console.error('Error getting user statistics:', error);
    return [];
  }
}

// Migrate data from localStorage to IndexedDB
async function migrateFromLocalStorage() {
  try {
    // Get data from localStorage
    const savedData = localStorage.getItem('smolovData');
    if (!savedData) return false;
    
    const smolovData = JSON.parse(savedData);
    const user = await getCurrentUser();
    
    // Migrate completed workouts
    if (smolovData.completedWorkouts && smolovData.completedWorkouts.length > 0) {
      for (const workout of smolovData.completedWorkouts) {
        // Get workout data if available
        const setData = smolovData.workoutData[workout.id] || [];
        
        // Parse workout ID to get phase, week, and day
        const idParts = workout.id.split('-');
        const phase = idParts[0];
        const week = idParts[1]?.substring(1) || '1'; // Extract number after 'w'
        const day = idParts[2] || 'unknown';
        
        // Create workout record
        const workoutRecord = {
          id: workout.id,
          userId: user.id,
          date: workout.date,
          phase: phase,
          week: parseInt(week),
          day: day,
          setData: setData,
          maxSquat: smolovData.maxSquat
        };
        
        // Save to IndexedDB
        await saveWorkout(workoutRecord);
      }
    }
    
    // Create a program start statistic
    if (smolovData.startDate) {
      await saveStatistic({
        type: 'program_start',
        date: smolovData.startDate,
        maxSquat: smolovData.maxSquat
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error migrating from localStorage:', error);
    return false;
  }
}

// Export functions
export {
  openDatabase,
  getCurrentUser,
  saveWorkout,
  getUserWorkouts,
  saveStatistic,
  getStatisticsByType,
  getAllUserStatistics,
  migrateFromLocalStorage
};
