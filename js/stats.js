// Statistics handling for Smolov PWA
import {
  getUserWorkouts,
  getAllUserStatistics,
  migrateFromLocalStorage
} from './db.js';

// DOM Elements
const programSummary = document.getElementById('program-summary');
const historyList = document.getElementById('history-list');
const phaseFilter = document.getElementById('phase-filter');
const sortOrder = document.getElementById('sort-order');
const exportDataBtn = document.getElementById('export-data');
const rpeChartCanvas = document.getElementById('rpe-chart');
const completionChartCanvas = document.getElementById('completion-chart');

// Chart instances
let rpeChart = null;
let completionChart = null;

// Initialize statistics page
async function initStatsPage() {
  // Try to migrate data from localStorage if needed
  await migrateFromLocalStorage();
  
  // Load data
  const workouts = await getUserWorkouts();
  
  if (workouts.length === 0) {
    showNoDataMessage();
    return;
  }
  
  // Initialize UI components
  renderProgramSummary(workouts);
  renderWorkoutHistory(workouts);
  initCharts(workouts);
  
  // Add event listeners
  phaseFilter.addEventListener('change', () => filterWorkoutHistory(workouts));
  sortOrder.addEventListener('change', () => filterWorkoutHistory(workouts));
  exportDataBtn.addEventListener('click', () => exportWorkoutData(workouts));
}

// Show message when no data is available
function showNoDataMessage() {
  programSummary.innerHTML = `
    <div class="no-data-message">
      <p>No workout data available yet. Complete some workouts to see your statistics.</p>
    </div>
  `;
  
  historyList.innerHTML = `
    <div class="no-data-message">
      <p>No workout history available. Start logging your workouts to track your progress.</p>
    </div>
  `;
  
  // Hide chart containers
  document.querySelectorAll('.chart-container').forEach(container => {
    container.style.display = 'none';
  });
}

// Render program summary statistics
function renderProgramSummary(workouts) {
  // Calculate summary statistics
  const totalWorkouts = workouts.length;
  
  // Count completed sets
  let totalSets = 0;
  let completedSets = 0;
  let partialSets = 0;
  let failedSets = 0;
  
  // Calculate average RPE
  let totalRpe = 0;
  let rpeCount = 0;
  
  // Get phases completed
  const phases = new Set();
  
  // Get program duration
  let firstWorkoutDate = null;
  let lastWorkoutDate = null;
  
  workouts.forEach(workout => {
    phases.add(workout.phase);
    
    // Track dates for duration calculation
    const workoutDate = new Date(workout.date);
    if (!firstWorkoutDate || workoutDate < firstWorkoutDate) {
      firstWorkoutDate = workoutDate;
    }
    if (!lastWorkoutDate || workoutDate > lastWorkoutDate) {
      lastWorkoutDate = workoutDate;
    }
    
    // Count sets
    if (workout.setData && workout.setData.length > 0) {
      totalSets += workout.setData.length;
      
      workout.setData.forEach(set => {
        if (set.status === 'completed') completedSets++;
        else if (set.status === 'partial') partialSets++;
        else if (set.status === 'failed') failedSets++;
        
        if (set.rpe) {
          totalRpe += parseInt(set.rpe);
          rpeCount++;
        }
      });
    }
  });
  
  // Calculate program duration in days
  const durationDays = firstWorkoutDate && lastWorkoutDate 
    ? Math.ceil((lastWorkoutDate - firstWorkoutDate) / (1000 * 60 * 60 * 24)) + 1
    : 0;
  
  // Calculate completion rate
  const completionRate = totalSets > 0 
    ? Math.round((completedSets / totalSets) * 100) 
    : 0;
  
  // Calculate average RPE
  const avgRpe = rpeCount > 0 
    ? (totalRpe / rpeCount).toFixed(1) 
    : 'N/A';
  
  // Render summary
  programSummary.innerHTML = `
    <div class="stat-item">
      <div class="stat-value">${totalWorkouts}</div>
      <div class="stat-label">Workouts Completed</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${completionRate}%</div>
      <div class="stat-label">Set Completion Rate</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${avgRpe}</div>
      <div class="stat-label">Average RPE</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${durationDays}</div>
      <div class="stat-label">Days in Program</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${phases.size}</div>
      <div class="stat-label">Phases Worked</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${totalSets}</div>
      <div class="stat-label">Total Sets</div>
    </div>
  `;
}

// Render workout history
function renderWorkoutHistory(workouts, filter = 'all', order = 'newest') {
  // Filter workouts by phase if needed
  let filteredWorkouts = workouts;
  if (filter !== 'all') {
    filteredWorkouts = workouts.filter(workout => workout.phase === filter);
  }
  
  // Sort workouts by date
  filteredWorkouts.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return order === 'newest' ? dateB - dateA : dateA - dateB;
  });
  
  // Clear history list
  historyList.innerHTML = '';
  
  if (filteredWorkouts.length === 0) {
    historyList.innerHTML = `
      <div class="no-data-message">
        <p>No workouts found matching the selected filters.</p>
      </div>
    `;
    return;
  }
  
  // Render each workout
  filteredWorkouts.forEach(workout => {
    const workoutDate = new Date(workout.date);
    const formattedDate = workoutDate.toLocaleDateString(undefined, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Parse workout ID to get day and week
    const idParts = workout.id.split('-');
    const day = idParts[2] ? idParts[2].charAt(0).toUpperCase() + idParts[2].slice(1) : 'Unknown';
    const week = idParts[1] ? idParts[1].replace('w', 'Week ') : '';
    const phase = workout.phase;
    const weekNum = workout.week || (idParts[1] ? idParts[1].replace('w', '') : '');
    
    // Create workout history item
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    // Create header with date and phase
    const header = document.createElement('div');
    header.className = 'history-item-header';
    
    const dateElement = document.createElement('div');
    dateElement.className = 'history-item-date';
    dateElement.textContent = formattedDate;
    
    const phaseElement = document.createElement('div');
    phaseElement.className = `history-item-phase ${phase}`;
    phaseElement.textContent = phase.charAt(0).toUpperCase() + phase.slice(1);
    
    header.appendChild(dateElement);
    header.appendChild(phaseElement);
    
    // Create workout details
    const details = document.createElement('div');
    details.className = 'history-item-details';
    
    // Try to determine sets, reps, and weight from the workout ID
    let workoutDetails = '';
    
    // For intro and base phases, we can extract from the workout object
    if (phase === 'intro' || phase === 'base') {
      // Find the corresponding workout card in the DOM to get sets/reps/weight
      const workoutCard = document.querySelector(`.workout-card[data-id="${workout.id}"]`);
      if (workoutCard) {
        const workoutText = workoutCard.querySelector('p')?.textContent;
        if (workoutText) {
          workoutDetails = workoutText;
        }
      }
    }
    
    // If we couldn't get details from the DOM, show a generic message with the max squat
    if (!workoutDetails) {
      workoutDetails = `Max Squat: ${workout.maxSquat} kg`;
    }
    
    details.innerHTML = `
      <h4>${day} - ${week}</h4>
      <p>${workoutDetails}</p>
    `;
    
    // Create set data display
    if (workout.setData && workout.setData.length > 0) {
      const setsContainer = document.createElement('div');
      setsContainer.className = 'history-item-sets';
      
      workout.setData.forEach(set => {
        const setElement = document.createElement('span');
        setElement.className = `history-set ${set.status}`;
        
        let setText = `Set ${set.set}: ${set.status.charAt(0).toUpperCase() + set.status.slice(1)}`;
        if (set.rpe) {
          setText += ` (RPE: ${set.rpe})`;
        }
        
        setElement.textContent = setText;
        setsContainer.appendChild(setElement);
      });
      
      details.appendChild(setsContainer);
    }
    
    // Assemble history item
    historyItem.appendChild(header);
    historyItem.appendChild(details);
    
    // Add to history list
    historyList.appendChild(historyItem);
  });
}

// Filter workout history based on user selections
function filterWorkoutHistory(workouts) {
  const phase = phaseFilter.value;
  const order = sortOrder.value;
  renderWorkoutHistory(workouts, phase, order);
}

// Initialize charts
function initCharts(workouts) {
  // Only proceed if Chart.js is available
  if (typeof Chart === 'undefined') {
    // Load Chart.js dynamically
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => createCharts(workouts);
    document.head.appendChild(script);
  } else {
    createCharts(workouts);
  }
}

// Create charts with workout data
function createCharts(workouts) {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded');
    return;
  }
  
  // Prepare data for RPE chart
  const rpeData = prepareRpeChartData(workouts);
  
  // Create RPE chart
  if (rpeChartCanvas) {
    if (rpeChart) rpeChart.destroy();
    
    rpeChart = new Chart(rpeChartCanvas, {
      type: 'line',
      data: {
        labels: rpeData.labels,
        datasets: [{
          label: 'Average RPE',
          data: rpeData.values,
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
            text: 'RPE Trend Over Time'
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            min: 5,
            max: 10,
            title: {
              display: true,
              text: 'RPE'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Workout'
            }
          }
        }
      }
    });
  }
  
  // Prepare data for completion rate chart
  const completionData = prepareCompletionChartData(workouts);
  
  // Create completion rate chart
  if (completionChartCanvas) {
    if (completionChart) completionChart.destroy();
    
    completionChart = new Chart(completionChartCanvas, {
      type: 'bar',
      data: {
        labels: ['Completed', 'Partial', 'Failed'],
        datasets: [{
          data: [
            completionData.completed,
            completionData.partial,
            completionData.failed
          ],
          backgroundColor: [
            'rgba(52, 168, 83, 0.7)',
            'rgba(251, 188, 4, 0.7)',
            'rgba(234, 67, 53, 0.7)'
          ],
          borderColor: [
            'rgb(52, 168, 83)',
            'rgb(251, 188, 4)',
            'rgb(234, 67, 53)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Set Completion Status'
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Sets'
            }
          }
        }
      }
    });
  }
}

// Prepare data for RPE chart
function prepareRpeChartData(workouts) {
  // Sort workouts by date
  const sortedWorkouts = [...workouts].sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });
  
  const labels = [];
  const values = [];
  
  sortedWorkouts.forEach((workout, index) => {
    // Skip workouts without set data
    if (!workout.setData || workout.setData.length === 0) return;
    
    // Calculate average RPE for this workout
    let totalRpe = 0;
    let rpeCount = 0;
    
    workout.setData.forEach(set => {
      if (set.rpe) {
        totalRpe += parseInt(set.rpe);
        rpeCount++;
      }
    });
    
    if (rpeCount > 0) {
      const avgRpe = totalRpe / rpeCount;
      labels.push(`Workout ${index + 1}`);
      values.push(avgRpe);
    }
  });
  
  return { labels, values };
}

// Prepare data for completion chart
function prepareCompletionChartData(workouts) {
  let completed = 0;
  let partial = 0;
  let failed = 0;
  
  workouts.forEach(workout => {
    if (!workout.setData) return;
    
    workout.setData.forEach(set => {
      if (set.status === 'completed') completed++;
      else if (set.status === 'partial') partial++;
      else if (set.status === 'failed') failed++;
    });
  });
  
  return { completed, partial, failed };
}

// Export workout data as JSON file
function exportWorkoutData(workouts) {
  // Create a JSON blob
  const dataStr = JSON.stringify(workouts, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  
  // Create download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smolov-workout-data-${new Date().toISOString().split('T')[0]}.json`;
  
  // Trigger download
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// Initialize stats page when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the stats page
  const statsPhase = document.getElementById('stats-phase');
  if (statsPhase) {
    initStatsPage();
  }
});

// Export functions
export {
  initStatsPage,
  renderProgramSummary,
  renderWorkoutHistory,
  filterWorkoutHistory
};
