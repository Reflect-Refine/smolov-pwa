// Analytics handling for Smolov PWA

import { openDatabase, getCurrentUser, saveStatistic, getStatisticsByType } from './db.js';
import { isLoggedIn } from './login.js';

// Analytics event types
const ANALYTICS_EVENTS = {
  INSTALLATION: 'installation',
  APP_OPEN: 'app_open',
  FEATURE_USAGE: 'feature_usage'
};

// Track installation event
async function trackInstallation() {
  try {
    // Check if this is a new installation
    const installEvents = await getStatisticsByType(ANALYTICS_EVENTS.INSTALLATION);
    
    // If we already have an installation record, don't track again
    if (installEvents && installEvents.length > 0) {
      console.log('Installation already tracked');
      return false;
    }
    
    // Get device info
    const deviceInfo = getDeviceInfo();
    
    // Save installation event
    await saveStatistic({
      type: ANALYTICS_EVENTS.INSTALLATION,
      date: new Date().toISOString(),
      deviceInfo
    });
    
    console.log('Installation tracked successfully');
    return true;
  } catch (error) {
    console.error('Error tracking installation:', error);
    return false;
  }
}

// Track app open event
async function trackAppOpen() {
  try {
    // Don't track app opens if the user is logged in as admin
    if (isLoggedIn()) {
      console.log('Admin usage not tracked in analytics');
      return false;
    }
    
    // Get device info
    const deviceInfo = getDeviceInfo();
    
    // Add a flag to mark this as a non-admin user
    deviceInfo.isAdmin = false;
    
    // Save app open event
    await saveStatistic({
      type: ANALYTICS_EVENTS.APP_OPEN,
      date: new Date().toISOString(),
      deviceInfo
    });
    
    return true;
  } catch (error) {
    console.error('Error tracking app open:', error);
    return false;
  }
}

// Track feature usage
async function trackFeatureUsage(featureName, additionalData = {}) {
  try {
    // Don't track feature usage if the user is logged in as admin
    if (isLoggedIn()) {
      console.log('Admin feature usage not tracked in analytics');
      return false;
    }
    
    // Save feature usage event
    await saveStatistic({
      type: ANALYTICS_EVENTS.FEATURE_USAGE,
      feature: featureName,
      date: new Date().toISOString(),
      data: additionalData,
      isAdmin: false
    });
    
    return true;
  } catch (error) {
    console.error(`Error tracking feature usage (${featureName}):`, error);
    return false;
  }
}

// Get device information
function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    displayMode: getDisplayMode(),
    referrer: document.referrer || 'direct',
    isAdmin: isLoggedIn() // Flag to identify admin usage
  };
}

// Get the current display mode (standalone, browser, etc.)
function getDisplayMode() {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  if (window.navigator.standalone === true) {
    return 'standalone-ios';
  }
  return 'browser';
}

// Get analytics data for admin dashboard
async function getAnalyticsData() {
  try {
    // Get all analytics events
    const installEvents = await getStatisticsByType(ANALYTICS_EVENTS.INSTALLATION);
    const appOpenEvents = await getStatisticsByType(ANALYTICS_EVENTS.APP_OPEN);
    const featureUsageEvents = await getStatisticsByType(ANALYTICS_EVENTS.FEATURE_USAGE);
    
    // Process installation data
    const totalInstallations = installEvents.length;
    
    // Filter out admin usage
    const nonAdminAppOpenEvents = appOpenEvents.filter(event => 
      !(event.deviceInfo && event.deviceInfo.isAdmin)
    );
    
    // Process app open data (excluding admin usage)
    const totalAppOpens = nonAdminAppOpenEvents.length;
    
    // Calculate unique users (based on unique device info, excluding admin)
    const uniqueDevices = new Set();
    [...installEvents, ...nonAdminAppOpenEvents].forEach(event => {
      if (event.deviceInfo && event.deviceInfo.userAgent && !event.deviceInfo.isAdmin) {
        uniqueDevices.add(event.deviceInfo.userAgent);
      }
    });
    
    // Calculate installations by display mode
    const installationsByDisplayMode = {};
    installEvents.forEach(event => {
      if (event.deviceInfo && event.deviceInfo.displayMode) {
        const mode = event.deviceInfo.displayMode;
        installationsByDisplayMode[mode] = (installationsByDisplayMode[mode] || 0) + 1;
      }
    });
    
    // Calculate app opens by date (last 30 days, excluding admin usage)
    const appOpensByDate = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    nonAdminAppOpenEvents.forEach(event => {
      const date = new Date(event.date);
      if (date >= thirtyDaysAgo) {
        const dateString = date.toISOString().split('T')[0];
        appOpensByDate[dateString] = (appOpensByDate[dateString] || 0) + 1;
      }
    });
    
    // Filter out admin feature usage
    const nonAdminFeatureUsageEvents = featureUsageEvents.filter(event => 
      !event.isAdmin
    );
    
    // Calculate feature usage (excluding admin usage)
    const featureUsageCounts = {};
    nonAdminFeatureUsageEvents.forEach(event => {
      if (event.feature) {
        featureUsageCounts[event.feature] = (featureUsageCounts[event.feature] || 0) + 1;
      }
    });
    
    return {
      totalInstallations,
      totalAppOpens,
      uniqueUsers: uniqueDevices.size,
      installationsByDisplayMode,
      appOpensByDate,
      featureUsageCounts
    };
  } catch (error) {
    console.error('Error getting analytics data:', error);
    return null;
  }
}

// Export functions
export {
  ANALYTICS_EVENTS,
  trackInstallation,
  trackAppOpen,
  trackFeatureUsage,
  getAnalyticsData
};
