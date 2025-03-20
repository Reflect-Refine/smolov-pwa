// Login handling for Smolov PWA

// Default admin password (SHA-256 hash of "admin123")
// In a real application, this would be stored on a server
const DEFAULT_ADMIN_HASH = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";

// Check if user is logged in
function isLoggedIn() {
  return localStorage.getItem('adminLoggedIn') === 'true';
}

// Log in with password
async function login(password) {
  try {
    // Hash the password (in a real app, this would be done server-side)
    const hashedPassword = await sha256(password);
    
    // Check if the hash matches
    if (hashedPassword === DEFAULT_ADMIN_HASH) {
      localStorage.setItem('adminLoggedIn', 'true');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error during login:', error);
    return false;
  }
}

// Log out
function logout() {
  localStorage.removeItem('adminLoggedIn');
}

// Show login form
function showLoginForm(container) {
  container.innerHTML = `
    <div class="login-form">
      <h3>Admin Login</h3>
      <p>Please enter the admin password to view analytics data.</p>
      <div class="input-group">
        <input type="password" id="admin-password" placeholder="Password" class="password-input">
      </div>
      <button id="login-btn" class="login-btn">Login</button>
      <p id="login-error" class="login-error hidden">Incorrect password. Please try again.</p>
    </div>
  `;
  
  // Add event listener to login button
  const loginBtn = document.getElementById('login-btn');
  const passwordInput = document.getElementById('admin-password');
  const loginError = document.getElementById('login-error');
  
  loginBtn.addEventListener('click', async () => {
    const password = passwordInput.value;
    
    try {
      if (await login(password)) {
        // Reload the analytics section
        initAnalyticsSection(container);
      } else {
        // Show error message
        loginError.classList.remove('hidden');
        
        // Clear password field
        passwordInput.value = '';
      }
    } catch (error) {
      console.error('Login error:', error);
      loginError.classList.remove('hidden');
      passwordInput.value = '';
    }
  });
  
  // Add event listener for Enter key
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loginBtn.click();
    }
  });
}

// Initialize analytics section
function initAnalyticsSection(container) {
  if (isLoggedIn()) {
    // User is logged in, show analytics
    container.innerHTML = `
      <div class="analytics-section">
        <div class="admin-header">
          <h3>App Analytics</h3>
          <button id="logout-btn" class="logout-btn">Logout</button>
        </div>
        <p>View installation and usage statistics for the app.</p>
        <div id="analytics-data" class="analytics-data">
          <div class="analytics-card">
            <h4>Installations</h4>
            <div id="installations-count">Loading...</div>
          </div>
          <div class="analytics-card">
            <h4>App Opens</h4>
            <div id="app-opens-count">Loading...</div>
          </div>
          <div class="analytics-card">
            <h4>Unique Users</h4>
            <div id="unique-users-count">Loading...</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="usage-chart"></canvas>
        </div>
      </div>
    `;
    
    // Add event listener to logout button
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', () => {
      logout();
      initAnalyticsSection(container);
    });
    
    // Initialize analytics display
    import('./analytics.js').then(analytics => {
      analytics.getAnalyticsData().then(data => {
        updateAnalyticsDisplay(data);
      }).catch(error => {
        console.error('Error getting analytics data:', error);
      });
    }).catch(error => {
      console.error('Error importing analytics module:', error);
    });
  } else {
    // User is not logged in, show login form
    showLoginForm(container);
  }
}

// Update analytics display with data
function updateAnalyticsDisplay(analyticsData) {
  if (!analyticsData) {
    console.error('Failed to get analytics data');
    return;
  }
  
  // Update installations count
  const installationsCount = document.getElementById('installations-count');
  if (installationsCount) {
    installationsCount.textContent = analyticsData.totalInstallations || 0;
  }
  
  // Update app opens count
  const appOpensCount = document.getElementById('app-opens-count');
  if (appOpensCount) {
    appOpensCount.textContent = analyticsData.totalAppOpens || 0;
  }
  
  // Update unique users count
  const uniqueUsersCount = document.getElementById('unique-users-count');
  if (uniqueUsersCount) {
    uniqueUsersCount.textContent = analyticsData.uniqueUsers || 0;
  }
  
  // Create usage chart if Chart.js is available
  const usageChartCanvas = document.getElementById('usage-chart');
  if (usageChartCanvas && typeof Chart !== 'undefined') {
    // Prepare data for the chart
    const appOpensByDate = analyticsData.appOpensByDate || {};
    const labels = Object.keys(appOpensByDate).sort();
    const values = labels.map(date => appOpensByDate[date]);
    
    // Create chart
    new Chart(usageChartCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'App Opens',
          data: values,
          borderColor: '#1a73e8',
          backgroundColor: 'rgba(26, 115, 232, 0.1)',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'App Usage Over Time'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of App Opens'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          }
        }
      }
    });
  } else if (usageChartCanvas) {
    // Load Chart.js dynamically if not available
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => updateAnalyticsDisplay(analyticsData); // Retry after loading
    document.head.appendChild(script);
  }
}

// Simple SHA-256 implementation
// Note: In a production app, use a proper crypto library
async function sha256(message) {
  // Encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message);
  
  // Hash the message
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  
  // Convert ArrayBuffer to hex string
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Export functions
export {
  initAnalyticsSection,
  isLoggedIn,
  login,
  logout
};
