// Smolov Programme Tracker - Main JS
import {
  saveWorkout,
  saveStatistic,
  migrateFromLocalStorage,
  getCurrentUser
} from './db.js';

// Function to round to nearest 0.25kg
function roundToNearestWeight(weight) {
    // Rounds to nearest 0.25kg
    return Math.round(weight * 4) / 4;
}

// Save inline workout
async function saveInlineWorkout(inlineTracker, workout) {
    const workoutId = workout.id;
    
    // Get set data
    const setData = [];
    const setStatusElements = inlineTracker.querySelectorAll('.set-status');
    const setRpeElements = inlineTracker.querySelectorAll('.set-rpe');
    
    setStatusElements.forEach((element, index) => {
        const setNumber = parseInt(element.dataset.set);
        const status = element.value;
        const rpe = setRpeElements[index].value;
        
        setData.push({
            set: setNumber,
            status,
            rpe: rpe ? parseInt(rpe) : null
        });
    });
    
    // Add to completed workouts
    if (!smolovData.completedWorkouts.some(w => w.id === workoutId)) {
        smolovData.completedWorkouts.push({
            id: workoutId,
            date: new Date().toISOString()
        });
    }
    
    // Store set data
    smolovData.workoutData[workoutId] = setData;
    
    // Save to local storage (for backward compatibility)
    saveToLocalStorage();
    
    // Parse workout ID to get phase, week, and day
    const idParts = workoutId.split('-');
    const phase = idParts[0];
    const week = idParts[1]?.substring(1) || '1'; // Extract number after 'w'
    const day = idParts[2] || 'unknown';
    
    // Create workout record for IndexedDB
    const workoutRecord = {
        id: workoutId,
        date: new Date().toISOString(),
        phase: phase,
        week: parseInt(week),
        day: day,
        setData: setData,
        maxSquat: smolovData.maxSquat
    };
    
    // Save to IndexedDB
    await saveWorkout(workoutRecord);
    
    // Update UI
    const workoutCard = document.querySelector(`.workout-card[data-id="${workoutId}"]`);
    if (workoutCard) {
        workoutCard.classList.add('completed');
        workoutCard.querySelector('button')?.remove();
        
        if (!workoutCard.querySelector('.set-complete')) {
            const completedTag = document.createElement('p');
            completedTag.className = 'set-complete';
            completedTag.textContent = '✓ Completed';
            workoutCard.appendChild(completedTag);
        }
        
        // Add set history immediately
        const setHistoryElement = showSetHistory(workoutId);
        if (setHistoryElement && !workoutCard.querySelector('.set-history')) {
            workoutCard.appendChild(setHistoryElement);
        }
    }
    
    // Remove inline tracker
    inlineTracker.remove();
    
    // Show success message
    alert('Workout logged successfully!');
}

// Create inline workout tracker
function createInlineWorkoutTracker(workout) {
    const inlineTracker = document.createElement('div');
    inlineTracker.className = 'inline-workout-tracker';
    inlineTracker.id = 'inline-workout-tracker';
    
    const { day, phase, week, sets, reps, weight, id } = workout;
    
    inlineTracker.innerHTML = `
        <h3>Record your workout</h3>
        <p>${sets} sets × ${reps} reps @ ${weight} kg</p>
        <div class="sets-container"></div>
        <button id="inline-save-workout" data-workout-id="${id}">Complete Workout</button>
    `;
    
    // Add set status input type and rating
    const setsContainer = inlineTracker.querySelector('.sets-container');
    for (let i = 1; i <= sets; i++) {
        const setRow = document.createElement('div');
        setRow.className = 'set-row';
        setRow.innerHTML = `
            <label>Set ${i}:</label>
            <select data-set="${i}" class="set-status">
                <option value="completed">Completed</option>
                <option value="partial">Partial</option>
                <option value="failed">Failed</option>
            </select>
            <div class="set-rating">
                <label for="set-${i}-rpe">RPE:</label>
                <select id="set-${i}-rpe" data-set="${i}" class="set-rpe">
                    <option value="">-</option>
                    <option value="6">6 - Easy</option>
                    <option value="7">7 - Moderate</option>
                    <option value="8">8 - Challenging</option>
                    <option value="9">9 - Hard</option>
                    <option value="10">10 - Max Effort</option>
                </select>
            </div>
        `;
        setsContainer.appendChild(setRow);
    }
    
    return inlineTracker;
}

// Display set history if available
function showSetHistory(workoutId) {
    if (smolovData.workoutData && smolovData.workoutData[workoutId]) {
        const historyContainer = document.createElement('div');
        historyContainer.className = 'set-history';
        historyContainer.innerHTML = '<h4>Previous Results:</h4>';
        
        const setList = document.createElement('ul');
        
        smolovData.workoutData[workoutId].forEach(set => {
            const setItem = document.createElement('li');
            setItem.className = `set-status-${set.status}`;
            let setText = `Set ${set.set}: ${set.status.charAt(0).toUpperCase() + set.status.slice(1)}`;
            
            if (set.rpe) {
                setText += ` (RPE: ${set.rpe})`;
            }
            
            setItem.textContent = setText;
            setList.appendChild(setItem);
        });
        
        historyContainer.appendChild(setList);
        return historyContainer;
    }
    return null;
}

// DOM Elements
const maxSquatInput = document.getElementById('max-squat');
const calculateBtn = document.getElementById('calculate-btn');
const setupSection = document.getElementById('setup-section');
const programmeSection = document.getElementById('programme-section');
const workoutTracker = document.getElementById('workout-tracker');
const phaseButtons = document.querySelectorAll('.phase-selector button');
const phaseContents = document.querySelectorAll('.phase-content');
const currentWorkout = document.getElementById('current-workout');
const workoutInputs = document.querySelector('.workout-inputs');
const setsContainer = document.querySelector('.sets-container');
const saveWorkoutBtn = document.getElementById('save-workout');

// Modify the App State to include set data
let smolovData = {
    maxSquat: 0,
    currentPhase: 'intro',
    completedWorkouts: [],
    workoutData: {}, // Store detailed set information here
    startDate: null
};

// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);
calculateBtn.addEventListener('click', calculateProgramme);
phaseButtons.forEach(button => {
    button.addEventListener('click', switchPhase);
});
saveWorkoutBtn.addEventListener('click', saveWorkoutResults);

// Check if running from file system and show warning if needed
function checkStorageWarning() {
    const storageWarning = document.querySelector('.storage-warning');
    if (storageWarning) {
        // If location protocol is 'file:', show the warning
        if (window.location.protocol === 'file:') {
            storageWarning.style.display = 'block';
        } else {
            storageWarning.style.display = 'none';
        }
    }
}

// Initialize App
async function initApp() {
    // App initialization
    
    // Hide setup section initially to prevent flash
    setupSection.classList.add('hidden');
    
    // Check if running from file and show warning accordingly
    checkStorageWarning();
    
    // Create workout containers if they don't exist
    createWorkoutContainers();
    
    // Load data from local storage and IndexedDB
    await loadFromLocalStorage();
    
    // If we have data, show the programme
    if (smolovData.maxSquat > 0) {
        maxSquatInput.value = smolovData.maxSquat;
        
        // Update the 1RM display in the dedicated section
        updateCurrentMaxDisplay();
        
        // Regenerate the program to ensure all workout cards are created
        generateProgramme();
        
        // Show the programme
        showProgramme();
    } else {
        // If no data, show the setup section
        setupSection.classList.remove('hidden');
    }
}

// Update the current 1RM display
function updateCurrentMaxDisplay() {
    // Get the current 1RM section and value element
    const currentMaxSection = document.getElementById('current-1rm-section');
    const currentMaxValue = document.getElementById('current-1rm-value');
    
    if (smolovData.maxSquat > 0) {
        // Update the value
        currentMaxValue.textContent = smolovData.maxSquat;
        
        // Show the section
        currentMaxSection.classList.remove('hidden');
    } else {
        // Hide the section if no 1RM is set
        currentMaxSection.classList.add('hidden');
    }
}

// Create workout containers if they don't exist
function createWorkoutContainers() {
    // Make sure all base phase workout containers exist
    const basePhase = document.getElementById('base-phase');
    if (basePhase) {
        const weeks = basePhase.querySelectorAll('.week');
        weeks.forEach((week, index) => {
            const workoutsContainer = week.querySelector('.workouts');
            if (!workoutsContainer) {
                const newContainer = document.createElement('div');
                newContainer.className = 'workouts';
                week.appendChild(newContainer);
            }
        });
    }
    
    // Make sure all intense phase workout containers exist
    const intensePhase = document.getElementById('intense-phase');
    if (intensePhase) {
        const weeks = intensePhase.querySelectorAll('.week');
        weeks.forEach((week, index) => {
            const workoutsContainer = week.querySelector('.workouts');
            if (!workoutsContainer) {
                const newContainer = document.createElement('div');
                newContainer.className = 'workouts';
                week.appendChild(newContainer);
            }
        });
    }
}

// Save data to local storage (for backward compatibility)
function saveToLocalStorage() {
    localStorage.setItem('smolovData', JSON.stringify(smolovData));
}

// Load data from local storage and IndexedDB
async function loadFromLocalStorage() {
    // First try to load from localStorage for backward compatibility
    const savedData = localStorage.getItem('smolovData');
    if (savedData) {
        smolovData = JSON.parse(savedData);
        
        // Attempt to migrate data to IndexedDB if needed
        await migrateFromLocalStorage();
    }
    
    // Now check if we have data in IndexedDB
    try {
        // Get user workouts from IndexedDB
        const workouts = await getUserWorkouts();
        
        // If we have workouts but no maxSquat, try to get it from the first workout
        if (workouts.length > 0 && (!smolovData.maxSquat || smolovData.maxSquat <= 0)) {
            smolovData.maxSquat = workouts[0].maxSquat || 0;
            
            // If we found a maxSquat, regenerate the program
            if (smolovData.maxSquat > 0) {
                // Update completedWorkouts array from IndexedDB data
                smolovData.completedWorkouts = workouts.map(workout => ({
                    id: workout.id,
                    date: workout.date
                }));
                
                // Update workoutData object from IndexedDB data
                smolovData.workoutData = {};
                workouts.forEach(workout => {
                    if (workout.setData) {
                        smolovData.workoutData[workout.id] = workout.setData;
                    }
                });
                
                // Save the updated data to localStorage for backward compatibility
                saveToLocalStorage();
            }
        }
    } catch (error) {
        console.error('Error loading data from IndexedDB:', error);
    }
}

// Calculate the Smolov programme based on 1RM
async function calculateProgramme() {
    const maxSquat = parseFloat(maxSquatInput.value);
    
    if (!maxSquat || maxSquat <= 0) {
        alert('Please enter a valid 1RM squat weight.');
        return;
    }
    
    smolovData.maxSquat = maxSquat;
    smolovData.startDate = new Date().toISOString();
    smolovData.completedWorkouts = [];
    smolovData.workoutData = {}; // Reset workout data
    
    // Make sure workout containers exist
    createWorkoutContainers();
    
    // Update the 1RM display
    updateCurrentMaxDisplay();
    
    generateProgramme();
    saveToLocalStorage();
    
    // Save program start to statistics
    await saveStatistic({
        type: 'program_start',
        date: smolovData.startDate,
        maxSquat: smolovData.maxSquat
    });
    
    showProgramme();
}

// Generate the complete Smolov programme
function generateProgramme() {
    // Intro Microcycle
    generateIntroPhase();
    
    // Base Mesocycle
    generateBasePhase();
    
    // Intense Mesocycle
    generateIntensePhase();
}

// Generate the Intro Microcycle
function generateIntroPhase() {
    const introPhase = document.querySelector('#intro-phase .workouts');
    if (!introPhase) {
        console.error("Intro phase workouts container not found");
        return;
    }
    
    introPhase.innerHTML = '';
    
    // Week 1-2: 3 times per week
    const introWeights = {
        day1: {
            percent: 0.65,
            sets: 6,
            reps: 6
        },
        day2: {
            percent: 0.7,
            sets: 6,
            reps: 6
        },
        day3: {
            percent: 0.75,
            sets: 6,
            reps: 6
        }
    };
    
    // Create intro phase workout cards
    ['Monday', 'Wednesday', 'Friday'].forEach((day, index) => {
        const dayKey = `day${index + 1}`;
        const dayData = introWeights[dayKey];
        const weight = roundToNearestWeight(smolovData.maxSquat * dayData.percent);
        
        const workoutCard = createWorkoutCard({
            day,
            phase: 'intro',
            week: 1,
            sets: dayData.sets,
            reps: dayData.reps,
            weight,
            id: `intro-w1-${day.toLowerCase()}`
        });
        
        introPhase.appendChild(workoutCard);
    });
    
    // Repeat for week 2
    ['Monday', 'Wednesday', 'Friday'].forEach((day, index) => {
        const dayKey = `day${index + 1}`;
        const dayData = introWeights[dayKey];
        const weight = roundToNearestWeight(smolovData.maxSquat * (dayData.percent + 0.05));
        
        const workoutCard = createWorkoutCard({
            day,
            phase: 'intro',
            week: 2,
            sets: dayData.sets,
            reps: dayData.reps,
            weight,
            id: `intro-w2-${day.toLowerCase()}`
        });
        
        introPhase.appendChild(workoutCard);
    });
}

// Generate the Base Mesocycle
function generateBasePhase() {
    // Base mesocycle structure
    const baseStructure = {
        week1: {
            monday: { percent: 0.70, sets: 4, reps: 9 },
            wednesday: { percent: 0.75, sets: 5, reps: 7 },
            friday: { percent: 0.80, sets: 7, reps: 5 },
            saturday: { percent: 0.85, sets: 10, reps: 3 }
        },
        week2: {
            monday: { percent: 0.725, sets: 4, reps: 9 },
            wednesday: { percent: 0.775, sets: 5, reps: 7 },
            friday: { percent: 0.825, sets: 7, reps: 5 },
            saturday: { percent: 0.875, sets: 10, reps: 3 }
        },
        week3: {
            monday: { percent: 0.75, sets: 4, reps: 9 },
            wednesday: { percent: 0.80, sets: 5, reps: 7 },
            friday: { percent: 0.85, sets: 7, reps: 5 },
            saturday: { percent: 0.90, sets: 10, reps: 3 }
        },
        week4: {
            monday: { percent: 0.775, sets: 4, reps: 9 },
            wednesday: { percent: 0.825, sets: 5, reps: 7 },
            friday: { percent: 0.875, sets: 7, reps: 5 },
            saturday: { percent: 0.925, sets: 10, reps: 3 }
        }
    };
    
    // Loop through each week
    for (let week = 1; week <= 4; week++) {
        const weekKey = `week${week}`;
        
        // Changed the selector to target directly by index
        const allWeeks = document.querySelectorAll('#base-phase .week');
        if (week <= allWeeks.length) {
            const weekContainer = allWeeks[week-1].querySelector('.workouts');
            
            if (!weekContainer) {
                continue;
            }
            
            weekContainer.innerHTML = '';
            
            // Loop through each day in the week
            Object.entries(baseStructure[weekKey]).forEach(([day, workout]) => {
                const weight = roundToNearestWeight(smolovData.maxSquat * workout.percent);
                
                const workoutCard = createWorkoutCard({
                    day: day.charAt(0).toUpperCase() + day.slice(1),
                    phase: 'base',
                    week,
                    sets: workout.sets,
                    reps: workout.reps,
                    weight,
                    id: `base-w${week}-${day}`
                });
                
                weekContainer.appendChild(workoutCard);
            });
        }
    }
}

// Generate the Intense Mesocycle
function generateIntensePhase() {
    // Intense mesocycle structure
    const intenseStructure = {
        week1: {
            monday: { percent: 0.80, setReps: [[3, 5], [4, 4], [5, 3]] },
            wednesday: { percent: 0.85, setReps: [[3, 5], [4, 4], [5, 3]] },
            friday: { percent: 0.90, setReps: [[3, 5], [4, 4], [5, 3]] },
            saturday: { percent: 0.95, setReps: [[3, 5], [4, 4], [5, 3]] }
        },
        week2: {
            monday: { percent: 0.825, setReps: [[3, 4], [4, 3], [5, 2]] },
            wednesday: { percent: 0.875, setReps: [[3, 4], [4, 3], [5, 2]] },
            friday: { percent: 0.925, setReps: [[3, 4], [4, 3], [5, 2]] },
            saturday: { percent: 0.975, setReps: [[3, 4], [4, 3], [5, 2]] }
        },
        week3: {
            monday: { percent: 0.85, setReps: [[2, 3], [3, 2], [4, 1]] },
            wednesday: { percent: 0.90, setReps: [[2, 3], [3, 2], [4, 1]] },
            friday: { percent: 0.95, setReps: [[2, 3], [3, 2], [4, 1]] },
            saturday: { percent: 1.00, setReps: [[2, 3], [3, 2], [4, 1]] }
        },
        week4: {
            monday: { testWeight: 1.02 },
            wednesday: { testWeight: 1.04 },
            friday: { testWeight: 1.05 }
        }
    };
    
    // Loop through each week
    for (let week = 1; week <= 4; week++) {
        const weekKey = `week${week}`;
        
        // Changed the selector to target directly by index
        const allWeeks = document.querySelectorAll('#intense-phase .week');
        if (week <= allWeeks.length) {
            const weekContainer = allWeeks[week-1].querySelector('.workouts');
            
            if (!weekContainer) {
                continue;
            }
            
            weekContainer.innerHTML = '';
            
            // Loop through each day in the week
            Object.entries(intenseStructure[weekKey]).forEach(([day, workout]) => {
                // Week 4 is testing week
                if (week === 4) {
                    // Calculate test weight
                    const rawWeight = smolovData.maxSquat * workout.testWeight;
                    
                    // Special handling for 105% (Friday test)
                    let testWeight;
                    if (workout.testWeight === 1.05) {
                        // Force Friday's test to be exactly 105% of 1RM with no rounding
                        testWeight = rawWeight;
                    } else {
                        // Round to nearest 0.25kg
                        testWeight = roundToNearestWeight(rawWeight);
                    }
                    
                    // Use createWorkoutCard for testing week
                    const workoutCard = createWorkoutCard({
                        day: day.charAt(0).toUpperCase() + day.slice(1),
                        phase: 'intense',
                        week,
                        sets: 1, // Just one set for testing
                        reps: 1, // Just one rep for testing
                        weight: testWeight,
                        id: `intense-w${week}-${day}`,
                        isTest: true // Flag to indicate this is a test workout
                    });
                    
                    // Replace the default text with test-specific text
                    const weightText = workoutCard.querySelector('p');
                    if (weightText) {
                        weightText.textContent = `New 1RM Test: ${testWeight} kg`;
                    }
                    
                    weekContainer.appendChild(workoutCard);
                } else {
                    // Regular workout weeks with multiple set/rep schemes
                    const weight = roundToNearestWeight(smolovData.maxSquat * workout.percent);
                    
                    // Calculate total sets for the workout (sum of all set schemes)
                    const totalSets = workout.setReps.reduce((sum, [sets, reps]) => sum + sets, 0);
                    
                    // Use the first set/rep scheme for the card creation
                    const firstScheme = workout.setReps[0];
                    
                    // Create the workout card
                    const workoutCard = createWorkoutCard({
                        day: day.charAt(0).toUpperCase() + day.slice(1),
                        phase: 'intense',
                        week,
                        sets: totalSets, // Total sets across all schemes
                        reps: firstScheme[1], // Use reps from first scheme
                        weight,
                        id: `intense-w${week}-${day}`
                    });
                    
                    // Replace the default text with the detailed set/rep schemes
                    const weightText = workoutCard.querySelector('p');
                    if (weightText) {
                        let setsRepsHtml = '<ul>';
                        workout.setReps.forEach(([sets, reps]) => {
                            setsRepsHtml += `<li>${sets} sets × ${reps} reps @ ${weight} kg</li>`;
                        });
                        setsRepsHtml += '</ul>';
                        
                        weightText.outerHTML = setsRepsHtml;
                    }
                    
                    weekContainer.appendChild(workoutCard);
                }
            });
        }
    }
}

// Create a workout card element
function createWorkoutCard(workout) {
    const { day, phase, week, sets, reps, weight, id } = workout;
    
    const workoutCard = document.createElement('div');
    workoutCard.className = 'workout-card';
    workoutCard.dataset.id = id;
    
    // Check if workout is completed
    const isCompleted = smolovData.completedWorkouts.some(w => w.id === id);
    if (isCompleted) {
        workoutCard.classList.add('completed');
    }
    
    // Check if this workout is available (previous day completed)
    const isAvailable = checkIfWorkoutIsAvailable(id);
    
    workoutCard.innerHTML = `
        <h4>${day}</h4>
        <p>${sets} sets × ${reps} reps @ ${weight} kg</p>
        ${isCompleted ? 
            '<p class="set-complete">✓ Completed</p>' : 
            isAvailable ?
                `<button class="log-workout-btn" data-id="${id}">Log Workout</button>` :
                `<button class="log-workout-btn disabled" disabled title="Complete previous workouts first">Log Workout</button>`
        }
    `;
    
    // Add set history if available
    if (isCompleted && smolovData.workoutData && smolovData.workoutData[id]) {
        const setHistoryElement = showSetHistory(id);
        if (setHistoryElement) {
            workoutCard.appendChild(setHistoryElement);
        }
    }
    
    // Add event listener to log workout button
    setTimeout(() => {
        const logBtn = workoutCard.querySelector('.log-workout-btn');
        if (logBtn) {
            logBtn.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove any existing inline trackers
                const existingTracker = document.getElementById('inline-workout-tracker');
                if (existingTracker) {
                    existingTracker.remove();
                }
                
                // Create inline tracker and add it after this card
                const inlineTracker = createInlineWorkoutTracker(workout);
                workoutCard.after(inlineTracker);
                
                // Add event listener to save button
                const saveBtn = inlineTracker.querySelector('#inline-save-workout');
                saveBtn.addEventListener('click', () => saveInlineWorkout(inlineTracker, workout));
                
                // Scroll to inline tracker
                inlineTracker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        }
    }, 0);
    
    return workoutCard;
}

// Show the workout logger
function showWorkoutLogger(workout) {
    workoutTracker.classList.remove('hidden');
    
    // Populate workout details
    const { day, phase, week, sets, reps, weight, id } = workout;
    
    currentWorkout.innerHTML = `
        <h3>${day} - Week ${week} (${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase)</h3>
        <p>${sets} sets × ${reps} reps @ ${weight} kg</p>
    `;
    
    // Add set status input type and rating
    setsContainer.innerHTML = '';
    for (let i = 1; i <= sets; i++) {
        const setRow = document.createElement('div');
        setRow.className = 'set-row';
        setRow.innerHTML = `
            <label>Set ${i}:</label>
            <select data-set="${i}" class="set-status">
                <option value="completed">Completed</option>
                <option value="partial">Partial</option>
                <option value="failed">Failed</option>
            </select>
            <div class="set-rating">
                <label for="set-${i}-rpe">RPE:</label>
                <select id="set-${i}-rpe" data-set="${i}" class="set-rpe">
                    <option value="">-</option>
                    <option value="6">6 - Easy</option>
                    <option value="7">7 - Moderate</option>
                    <option value="8">8 - Challenging</option>
                    <option value="9">9 - Hard</option>
                    <option value="10">10 - Max Effort</option>
                </select>
            </div>
        `;
        setsContainer.appendChild(setRow);
    }
    
    // Store current workout ID for saving
    saveWorkoutBtn.dataset.workoutId = id;
    workoutInputs.classList.remove('hidden');
    
    // Scroll to workout tracker
    workoutTracker.scrollIntoView({ behavior: 'smooth' });
}

// Save workout results
async function saveWorkoutResults() {
    const workoutId = saveWorkoutBtn.dataset.workoutId;
    
    // Get set data
    const setData = [];
    const setStatusElements = setsContainer.querySelectorAll('.set-status');
    const setRpeElements = setsContainer.querySelectorAll('.set-rpe');
    
    setStatusElements.forEach((element, index) => {
        const setNumber = parseInt(element.dataset.set);
        const status = element.value;
        const rpe = setRpeElements[index].value;
        
        setData.push({
            set: setNumber,
            status,
            rpe: rpe ? parseInt(rpe) : null
        });
    });
    
    // Add to completed workouts
    smolovData.completedWorkouts.push({
        id: workoutId,
        date: new Date().toISOString()
    });
    
    // Store set data
    smolovData.workoutData[workoutId] = setData;
    
    // Save to local storage (for backward compatibility)
    saveToLocalStorage();
    
    // Parse workout ID to get phase, week, and day
    const idParts = workoutId.split('-');
    const phase = idParts[0];
    const week = idParts[1]?.substring(1) || '1'; // Extract number after 'w'
    const day = idParts[2] || 'unknown';
    
    // Create workout record for IndexedDB
    const workoutRecord = {
        id: workoutId,
        date: new Date().toISOString(),
        phase: phase,
        week: parseInt(week),
        day: day,
        setData: setData,
        maxSquat: smolovData.maxSquat
    };
    
    // Save to IndexedDB
    await saveWorkout(workoutRecord);
    
    // Update UI
    const workoutCard = document.querySelector(`.workout-card[data-id="${workoutId}"]`);
    if (workoutCard) {
        workoutCard.classList.add('completed');
        workoutCard.querySelector('button')?.remove();
        const completedTag = document.createElement('p');
        completedTag.className = 'set-complete';
        completedTag.textContent = '✓ Completed';
        workoutCard.appendChild(completedTag);
        
        // Add set history immediately
        const setHistoryElement = showSetHistory(workoutId);
        if (setHistoryElement) {
            workoutCard.appendChild(setHistoryElement);
        }
    }
    
    // Reset workout tracker
    workoutTracker.classList.add('hidden');
    workoutInputs.classList.add('hidden');
    
    // Show success message
    alert('Workout logged successfully!');
}

// Switch between phases
function switchPhase() {
    const phase = this.dataset.phase;
    
    // Update active button
    phaseButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    this.classList.add('active');
    
    // Update active phase content
    phaseContents.forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${phase}-phase`).classList.add('active');
    
    // Update state
    smolovData.currentPhase = phase;
    saveToLocalStorage();
    
    // Show/hide sections based on the selected phase
    if (phase === 'stats') {
        // For stats view, hide the programme section
        programmeSection.classList.add('hidden');
        
        // Show the setup section with only the current-max-display
        // if (smolovData.maxSquat > 0) {
        //     setupSection.classList.remove('hidden');
            
        //     // Hide all children except the current-max-display
        //     Array.from(setupSection.children).forEach(child => {
        //         if (!child.classList.contains('current-max-display')) {
        //             child.classList.add('hidden');
        //         }
        //     });
        // }
    } else {
        // For workout phases, show the programme section
        programmeSection.classList.remove('hidden');
        
        // Show the setup section with only the current-max-display
        // if (smolovData.maxSquat > 0) {
        //     setupSection.classList.remove('hidden');
            
        //     // Hide all children except the current-max-display
        //     Array.from(setupSection.children).forEach(child => {
        //         if (!child.classList.contains('current-max-display')) {
        //             child.classList.add('hidden');
        //         }
        //     });
        // } else {
        //     // If no 1RM set, show the full setup section
        //     setupSection.classList.remove('hidden');
        //     Array.from(setupSection.children).forEach(child => {
        //         child.classList.remove('hidden');
        //     });
        // }
    }
}

// Show the programme
function showProgramme() {
    // Hide the setup section
    setupSection.classList.add('hidden');
    
    // Show the programme section
    programmeSection.classList.remove('hidden');
    
    // Make sure the current 1RM display is visible if we have a 1RM
    if (smolovData.maxSquat > 0) {
        updateCurrentMaxDisplay();
    }
    
    // Set active phase
    phaseButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.phase === smolovData.currentPhase) {
            btn.classList.add('active');
        }
    });
    
    phaseContents.forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${smolovData.currentPhase}-phase`).classList.add('active');
    
    // Mark completed workouts
    smolovData.completedWorkouts.forEach(workout => {
        const workoutCard = document.querySelector(`.workout-card[data-id="${workout.id}"]`);
        if (workoutCard) {
            workoutCard.classList.add('completed');
            workoutCard.querySelector('button')?.remove();
            
            if (!workoutCard.querySelector('.set-complete')) {
                const completedTag = document.createElement('p');
                completedTag.className = 'set-complete';
                completedTag.textContent = '✓ Completed';
                workoutCard.appendChild(completedTag);
                
                // Add set history if available
                const setHistoryElement = showSetHistory(workout.id);
                if (setHistoryElement) {
                    workoutCard.appendChild(setHistoryElement);
                }
            }
        }
    });
}

// Reset app data
async function resetApp() {
    // Clear IndexedDB data
    try {
        const request = indexedDB.deleteDatabase('smolov-db');
        request.onsuccess = () => {
            console.log('Database deleted successfully');
        };
        request.onerror = () => {
            console.error('Error deleting database');
        };
    } catch (error) {
        console.error('Error resetting IndexedDB:', error);
    }
    
    // Clear localStorage
    localStorage.removeItem('smolovData');
    
    // Reload the page
    location.reload();
}

// Add reset button at the bottom
const footer = document.querySelector('footer');
const resetBtn = document.createElement('button');
resetBtn.textContent = 'Reset Programme';
resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
        resetApp();
    }
});
footer.appendChild(resetBtn);

// Check if a workout is available (previous workouts completed)
function checkIfWorkoutIsAvailable(workoutId) {
    // First workout is always available
    if (workoutId === 'intro-w1-monday') {
        return true;
    }
    
    // Parse the workout ID
    const idParts = workoutId.split('-');
    const phase = idParts[0];
    const weekPart = idParts[1]; // e.g., "w1"
    const day = idParts[2];
    
    // Extract week number
    const week = parseInt(weekPart.substring(1));
    
    // Get the previous workout ID based on the current one
    let previousWorkoutId;
    
    // For intro phase
    if (phase === 'intro') {
        if (day === 'monday') {
            if (week === 1) {
                // First workout, no previous
                return true;
            } else {
                // Previous week's Friday
                previousWorkoutId = `intro-w${week-1}-friday`;
            }
        } else if (day === 'wednesday') {
            // Monday of the same week
            previousWorkoutId = `intro-w${week}-monday`;
        } else if (day === 'friday') {
            // Wednesday of the same week
            previousWorkoutId = `intro-w${week}-wednesday`;
        }
    }
    // For base phase
    else if (phase === 'base') {
        if (day === 'monday') {
            if (week === 1) {
                // First base workout should check the last intro workout
                previousWorkoutId = 'intro-w2-friday';
            } else {
                // Previous week's Saturday
                previousWorkoutId = `base-w${week-1}-saturday`;
            }
        } else if (day === 'wednesday') {
            // Monday of the same week
            previousWorkoutId = `base-w${week}-monday`;
        } else if (day === 'friday') {
            // Wednesday of the same week
            previousWorkoutId = `base-w${week}-wednesday`;
        } else if (day === 'saturday') {
            // Friday of the same week
            previousWorkoutId = `base-w${week}-friday`;
        }
    }
    // For intense phase
    else if (phase === 'intense') {
        if (day === 'monday') {
            if (week === 1) {
                // First intense workout should check the last base workout
                previousWorkoutId = 'base-w4-saturday';
            } else {
                // Previous week's Saturday
                previousWorkoutId = `intense-w${week-1}-saturday`;
            }
        } else if (day === 'wednesday') {
            // Monday of the same week
            previousWorkoutId = `intense-w${week}-monday`;
        } else if (day === 'friday') {
            // Wednesday of the same week
            previousWorkoutId = `intense-w${week}-wednesday`;
        } else if (day === 'saturday') {
            // Friday of the same week
            previousWorkoutId = `intense-w${week}-friday`;
        }
    }
    
    // If we couldn't determine a previous workout, allow it
    if (!previousWorkoutId) {
        return true;
    }
    
    // Check if the previous workout is completed
    return smolovData.completedWorkouts.some(w => w.id === previousWorkoutId);
}

// Add event listeners for UI elements
document.addEventListener('DOMContentLoaded', () => {
    // Install notice handling
    const installNotice = document.getElementById('installNotice');
    const closeButton = installNotice.querySelector('.close-notice');

    // Check if the notice was previously dismissed
    if (localStorage.getItem('installNoticeDismissed')) {
        installNotice.classList.add('hidden');
    }

    closeButton.addEventListener('click', () => {
        installNotice.classList.add('hidden');
        // Save the dismissal in localStorage
        localStorage.setItem('installNoticeDismissed', 'true');
    });
    
    // Refresh button handling
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            // Add rotating animation
            refreshBtn.classList.add('rotating');
            
            // Show a message to indicate refresh is happening
            const refreshMessage = document.createElement('div');
            refreshMessage.textContent = 'Refreshing...';
            refreshMessage.style.position = 'fixed';
            refreshMessage.style.top = '50%';
            refreshMessage.style.left = '50%';
            refreshMessage.style.transform = 'translate(-50%, -50%)';
            refreshMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            refreshMessage.style.color = 'white';
            refreshMessage.style.padding = '1rem 2rem';
            refreshMessage.style.borderRadius = '4px';
            refreshMessage.style.zIndex = '9999';
            document.body.appendChild(refreshMessage);
            
            // Reload the page after a short delay to show the animation
            setTimeout(() => {
                window.location.reload();
            }, 500);
        });
    }
});
