const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const moviesFile = path.join(dataDir, 'movies.json');
const usersFile = path.join(dataDir, 'users.json');
const statsFile = path.join(dataDir, 'stats.json');

// Initialize files if they don't exist
if (!fs.existsSync(moviesFile)) {
  fs.writeFileSync(moviesFile, JSON.stringify([], null, 2));
}
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
}
if (!fs.existsSync(statsFile)) {
  fs.writeFileSync(statsFile, JSON.stringify({
    totalViews: 0,
    totalSearchQueries: 0,
    dailyUsage: {}
  }, null, 2));
}

// Movies CRUD
function getMovies() {
  try {
    const raw = fs.readFileSync(moviesFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveMovies(movies) {
  try {
    fs.writeFileSync(moviesFile, JSON.stringify(movies, null, 2));
    return true;
  } catch (e) {
    console.error('Error saving movies:', e.message);
    return false;
  }
}

function addMovie(movie) {
  try {
    const movies = getMovies();
    
    // Check if code already exists
    const index = movies.findIndex(m => String(m.code).trim() === String(movie.code).trim());
    const movieData = {
      code: String(movie.code).trim(),
      title: movie.title || 'Noma\'lum film',
      description: movie.description || '',
      fileId: movie.fileId,
      views: 0,
      dateAdded: new Date().toISOString()
    };

    if (index !== -1) {
      // Overwrite existing code
      movies[index] = { ...movies[index], ...movieData };
    } else {
      movies.push(movieData);
    }
    
    saveMovies(movies);
    return movieData;
  } catch (e) {
    console.error('Error adding movie:', e.message);
    return null;
  }
}

function deleteMovie(code) {
  try {
    let movies = getMovies();
    const initialLength = movies.length;
    movies = movies.filter(m => String(m.code).trim() !== String(code).trim());
    if (movies.length < initialLength) {
      saveMovies(movies);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Error deleting movie:', e.message);
    return false;
  }
}

function getMovieByCode(code) {
  try {
    const movies = getMovies();
    return movies.find(m => String(m.code).trim() === String(code).trim()) || null;
  } catch (e) {
    return null;
  }
}

function searchMovies(query) {
  try {
    const movies = getMovies();
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return [];
    return movies.filter(m => 
      m.title.toLowerCase().includes(cleanQuery) || 
      m.description.toLowerCase().includes(cleanQuery)
    );
  } catch (e) {
    return [];
  }
}

// Users CRUD
function getUsers() {
  try {
    const raw = fs.readFileSync(usersFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('Error saving users:', e.message);
  }
}

function addUser(user) {
  try {
    const users = getUsers();
    if (!users.some(u => Number(u.id) === Number(user.id))) {
      users.push({
        id: user.id,
        username: user.username || '',
        first_name: user.first_name || '',
        dateJoined: new Date().toISOString()
      });
      saveUsers(users);
    }
  } catch (e) {
    console.error('Error adding user:', e.message);
  }
}

// Stats & Analytics
function getStats() {
  try {
    const raw = fs.readFileSync(statsFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { totalViews: 0, totalSearchQueries: 0, dailyUsage: {} };
  }
}

function saveStats(stats) {
  try {
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
  } catch (e) {
    console.error('Error saving stats:', e.message);
  }
}

function trackMovieView(code) {
  try {
    // Increment views in movies.json
    const movies = getMovies();
    const movieIdx = movies.findIndex(m => String(m.code).trim() === String(code).trim());
    if (movieIdx !== -1) {
      movies[movieIdx].views = (movies[movieIdx].views || 0) + 1;
      saveMovies(movies);
    }

    // Increment overall statistics
    const stats = getStats();
    stats.totalViews = (stats.totalViews || 0) + 1;

    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { movieViews: 0, searchQueries: 0, activeUsers: [] };
    }
    stats.dailyUsage[today].movieViews = (stats.dailyUsage[today].movieViews || 0) + 1;

    saveStats(stats);
  } catch (e) {
    console.error('Error tracking movie view:', e.message);
  }
}

function trackSearch() {
  try {
    const stats = getStats();
    stats.totalSearchQueries = (stats.totalSearchQueries || 0) + 1;

    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { movieViews: 0, searchQueries: 0, activeUsers: [] };
    }
    stats.dailyUsage[today].searchQueries = (stats.dailyUsage[today].searchQueries || 0) + 1;

    saveStats(stats);
  } catch (e) {
    console.error('Error tracking search:', e.message);
  }
}

function trackActiveUser(userId) {
  try {
    const stats = getStats();
    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { movieViews: 0, searchQueries: 0, activeUsers: [] };
    }
    if (!stats.dailyUsage[today].activeUsers) {
      stats.dailyUsage[today].activeUsers = [];
    }
    if (!stats.dailyUsage[today].activeUsers.includes(userId)) {
      stats.dailyUsage[today].activeUsers.push(userId);
      saveStats(stats);
    }
  } catch (e) {
    console.error('Error tracking active user:', e.message);
  }
}

module.exports = {
  getMovies,
  addMovie,
  deleteMovie,
  getMovieByCode,
  searchMovies,
  getUsers,
  addUser,
  getStats,
  trackMovieView,
  trackSearch,
  trackActiveUser
};
