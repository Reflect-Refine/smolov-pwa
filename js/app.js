// Smolov Programme Tracker - Main JS

// Function to round to nearest 0.25kg
function roundToNearestWeight(weight) {
    // Rounds to nearest 0.25kg
    return Math.round(weight * 4) / 4;
}

// Save inline workout
function saveInlineWorkout(inlineTracker, workout) {
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
    
    // Save to local storage
    saveToLocalStorage();
    
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
function initApp() {
    // App initialization
    
    // Check if running from file and show warning accordingly
    checkStorageWarning();
    
    // Create workout containers if they don't exist
    createWorkoutContainers();
    
    // Load data from local storage
    loadFromLocalStorage();
    
    // If we have data, show the programme
    if (smolovData.maxSquat > 0) {
        maxSquatInput.value = smolovData.maxSquat;
        showProgramme();
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

// Save data to local storage
function saveToLocalStorage() {
    localStorage.setItem('smolovData', JSON.stringify(smolovData));
}

// Load data from local storage
function loadFromLocalStorage() {
    const savedData = localStorage.getItem('smolovData');
    if (savedData) {
        smolovData = JSON.parse(savedData);
    }
}

// Calculate the Smolov programme based on 1RM
function calculateProgramme() {

    
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
    
    generateProgramme();
    saveToLocalStorage();
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
                    
                    const workoutCard = document.createElement('div');
                    workoutCard.className = 'workout-card';
                    workoutCard.dataset.id = `intense-w${week}-${day}`;
                    
                    workoutCard.innerHTML = `
                        <h4>${day.charAt(0).toUpperCase() + day.slice(1)}</h4>
                        <p>New 1RM Test: ${testWeight} kg</p>
                        <button class="log-workout-btn" data-id="${`intense-w${week}-${day}`}">
                            Log Workout
                        </button>
                    `;
                    
                    weekContainer.appendChild(workoutCard);
                    // No return here so all days are processed
                } else {
                    // Regular workout weeks
                    const workoutCard = document.createElement('div');
                    workoutCard.className = 'workout-card';
                    workoutCard.dataset.id = `intense-w${week}-${day}`;
                    
                    const weight = roundToNearestWeight(smolovData.maxSquat * workout.percent);
                    
                    let setsRepsHtml = '<ul>';
                    workout.setReps.forEach(([sets, reps]) => {
                        setsRepsHtml += `<li>${sets} sets × ${reps} reps @ ${weight} kg</li>`;
                    });
                    setsRepsHtml += '</ul>';
                    
                    workoutCard.innerHTML = `
                        <h4>${day.charAt(0).toUpperCase() + day.slice(1)}</h4>
                        ${setsRepsHtml}
                        <button class="log-workout-btn" data-id="${`intense-w${week}-${day}`}">
                            Log Workout
                        </button>
                    `;
                    
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
    
    workoutCard.innerHTML = `
        <h4>${day}</h4>
        <p>${sets} sets × ${reps} reps @ ${weight} kg</p>
        ${isCompleted ? 
            '<p class="set-complete">✓ Completed</p>' : 
            `<button class="log-workout-btn" data-id="${id}">Log Workout</button>`
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
function saveWorkoutResults() {
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
    
    // Save to local storage
    saveToLocalStorage();
    
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
}

// Show the programme
function showProgramme() {
    setupSection.classList.add('hidden');
    programmeSection.classList.remove('hidden');
    
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
function resetApp() {
    localStorage.removeItem('smolovData');
    location.reload();
}

// Add reset button at the bottom
const footer = document.querySelector('footer');
const resetBtn = document.createElement('button');
resetBtn.textContent = 'Reset Programme';
resetBtn.style.marginTop = '20px';
resetBtn.style.backgroundColor = '#e74c3c';
resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
        resetApp();
    }
});
footer.appendChild(resetBtn);