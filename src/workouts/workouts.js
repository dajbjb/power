import { state } from "../state.js";
import { SafeStorage } from "../utils/storage.js";
import { triggerLocalNotification, showPremiumToast, requestNotificationPermissionSafely, escapeHTML } from "../utils/helpers.js";
import { saveFieldToCloud } from "../utils/db.js";
import { getCustomIcon, getCategoryIcon, getLocationIcon, ICONS_MAP } from "../utils/icons.js";

export const GYM_EXERCISES = [
  { name: 'לחיצת חזה עם מוט', category: 'חזה', emoji: '🏋️' },
  { name: 'לחיצת חזה בשיפוע חיובי', category: 'חזה', emoji: '🏋️' },
  { name: 'פרפר בכבלים', category: 'חזה', emoji: '💪' },
  { name: 'לחיצת חזה במכונה', category: 'חזה', emoji: '🏋️' },
  { name: 'דדליפט', category: 'גב', emoji: '🏋️' },
  { name: 'משיכת פולי עליון', category: 'גב', emoji: '💪' },
  { name: 'חתירה בכבלים', category: 'גב', emoji: '💪' },
  { name: 'מתח', category: 'גב', emoji: '💪' },
  { name: 'חתירה עם משקולת יד', category: 'גב', emoji: '💪' },
  { name: 'לחיצת כתפיים עם משקולות', category: 'כתפיים', emoji: '🏋️' },
  { name: 'הרחקת זרועות לצדדים', category: 'כתפיים', emoji: '💪' },
  { name: 'הרמת ידיים לפנים', category: 'כתפיים', emoji: '💪' },
  { name: 'פרפר אחורי במכונה', category: 'כתפיים', emoji: '💪' },
  { name: 'פייס פולס', category: 'כתפיים', emoji: '💪' },
  { name: 'משיכת כתפיים (Shrugs)', category: 'כתפיים', emoji: '💪' },
  { name: 'סקוואט עם מוט', category: 'רגליים', emoji: '🏋️' },
  { name: 'לחיצת רגליים במכונה', category: 'רגליים', emoji: '🏋️' },
  { name: 'פשיטת ברכיים', category: 'רגליים', emoji: '🦵' },
  { name: 'כפיפת ברכיים', category: 'רגליים', emoji: '🦵' },
  { name: 'דדליפט רומני', category: 'רגליים', emoji: '🏋️' },
  { name: 'הרמת עקבים (Calves)', category: 'רגליים', emoji: '🦵' },
  { name: 'כפיפת מרפקים עם מוט', category: 'יד קדמית', emoji: '💪' },
  { name: 'כפיפת מרפקים פטישים', category: 'יד קדמית', emoji: '💪' },
  { name: 'כפיפת מרפקים בכור כומר', category: 'יד קדמית', emoji: '💪' },
  { name: 'פשיטת מרפקים בפולי', category: 'יד אחורית', emoji: '💪' },
  { name: 'פשיטת מרפקים מעל הראש', category: 'יד אחורית', emoji: '💪' },
  { name: 'כפיפות בטן', category: 'בטן וליבה', emoji: '🍫' },
  { name: 'פלאנק', category: 'בטן וליבה', emoji: '🧘' },
  { name: 'הרמת רגליים בתלייה', category: 'בטן וליבה', emoji: '🍫' },
  { name: 'ריצה על הליכון', category: 'אירובי', emoji: '🏃' }
];

export const PARK_EXERCISES = [
  { name: 'מתח רגיל', category: 'גב', emoji: '💪' },
  { name: 'מתח באחיזה הפוכה (Chin-ups)', category: 'גב', emoji: '💪' },
  { name: 'מאסל-אפ (Muscle-ups)', category: 'גב', emoji: '⚡' },
  { name: 'חתירה אוסטרלית', category: 'גב', emoji: '💪' },
  { name: 'מקבילים (Dips)', category: 'חזה', emoji: '🏋️' },
  { name: 'שכיבות שמיכה', category: 'חזה', emoji: '🤸' },
  { name: 'שכיבות שמיכה יהלום', category: 'יד אחורית', emoji: '🤸' },
  { name: 'שכיבות שמיכה בשיפוע שלילי', category: 'חזה', emoji: '🤸' },
  { name: 'שכיבות שמיכה פייק', category: 'כתפיים', emoji: '🤸' },
  { name: 'מקבילים אחוריים על ספסל', category: 'יד אחורית', emoji: '🏋️' },
  { name: 'פיסטול סקוואט', category: 'רגליים', emoji: '🦵' },
  { name: 'סקוואט משקל גוף', category: 'רגליים', emoji: '🦵' },
  { name: 'לאנג׳ים', category: 'רגליים', emoji: '🦵' },
  { name: 'עליות מדרגה', category: 'רגליים', emoji: '🦵' },
  { name: 'הרמת עקבים', category: 'רגליים', emoji: '🦵' },
  { name: 'פלאנק', category: 'בטן וליבה', emoji: '🧘' },
  { name: 'הרמת רגליים על ספסל', category: 'בטן וליבה', emoji: '🍫' },
  { name: 'ברפיז (Burpees)', category: 'אירובי', emoji: '🏃' },
  { name: 'אל-סיט (L-Sit)', category: 'בטן וליבה', emoji: '🧘' },
  { name: 'מטפס הרים', category: 'אירובי', emoji: '🏃' }
];

export const HEBREW_QUOTES = [
  "אין קיצורי דרך למקומות ששווה להגיע אליהם! 🔥",
  "כל חזרה מקרבת אותך לגרסה הטובה ביותר של עצמך. 💪",
  "הכאב של היום הוא הכוח של מחר! ⚡",
  "אל תפסיק כשזה קשה, תפסיק כשסיימת. 🏆",
  "המשמעת העצמית שלך היא המפתח לברזל! 🏋️‍♂️",
  "אתה נלחם נגד עצמך של אתמול, לא נגד אף אחד אחר. 🌟",
  "הפוך את התירוצים שלך לתוצאות בקצה הברזל! 🔥",
  "המנוחה מכינה אותך לסט המושלם הבא. תתרכז! 🎯"
];

// Helper to save active workout state
export function saveActiveWorkoutState() {
  if (state.currentUser && state.activeWorkout) {
    SafeStorage.setItem(`aura-active-workout_${state.currentUser.uid}`, JSON.stringify(state.activeWorkout));
    saveFieldToCloud("activeWorkout", state.activeWorkout);
  }
}

// Exercise Configuration Defaults Helpers
export function getExerciseDefaultsKey() {
  if (!state.currentUser) return null;
  return `aura-exercise-defaults_${state.currentUser.uid}`;
}

export function getExerciseDefaults(exerciseName) {
  const key = getExerciseDefaultsKey();
  if (!key) return null;
  const data = SafeStorage.getItem(key);
  if (!data) return null;
  try {
    const defaults = JSON.parse(data);
    return defaults[exerciseName] || null;
  } catch (e) {
    console.error("Failed to parse exercise defaults:", e);
    return null;
  }
}

export function saveExerciseDefaults(exerciseName, config = {}) {
  const key = getExerciseDefaultsKey();
  if (!key) return;
  const data = SafeStorage.getItem(key);
  let defaults = {};
  if (data) {
    try {
      defaults = JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse exercise defaults for saving:", e);
    }
  }
  if (!config) return;
  defaults[exerciseName] = {
    targetSetsCount: config.targetSetsCount,
    restTime: config.restTime,
    metrics: config.metrics
  };
  SafeStorage.setItem(key, JSON.stringify(defaults));
  saveFieldToCloud("exerciseDefaults", defaults);
}

export function getExerciseMetrics(ex) {
  if (ex.metrics && Array.isArray(ex.metrics)) {
    return ex.metrics;
  }
  // Backward compatibility with metricType
  if (ex.metricType === 'both') {
    return ['weight', 'reps'];
  } else if (ex.metricType === 'weight') {
    return ['weight'];
  } else if (ex.metricType === 'reps') {
    return ['reps'];
  } else if (ex.metricType === 'time') {
    return ['time'];
  }
  return ['weight', 'reps']; // Default fallback
}

export function getMetricLabel(metrics) {
  const parts = [];
  if (metrics.includes('weight')) parts.push('משקל');
  if (metrics.includes('reps')) parts.push('חזרות');
  if (metrics.includes('time')) parts.push('זמן');
  if (parts.length === 3) return '⚖️ משקל, חזרות וזמן';
  if (parts.length === 2) {
    if (metrics.includes('weight') && metrics.includes('reps')) return '⚖️ משקל וחזרות';
    if (metrics.includes('weight') && metrics.includes('time')) return '🏋️‍♂️ משקל וזמן';
    if (metrics.includes('reps') && metrics.includes('time')) return '🔢 חזרות וזמן';
  }
  if (parts.length === 1) {
    if (parts[0] === 'weight') return '🏋️‍♂️ משקל בלבד';
    if (parts[0] === 'reps') return '🔢 חזרות בלבד';
    if (parts[0] === 'time') return '⏱️ זמן בלבד';
  }
  return '💪 מדדים מותאמים';
}

export function setupMetricSelectorModal(title, targetSets, restTime, metrics) {
  const modalTitle = document.querySelector('#metric-selector-modal .modal-title');
  if (modalTitle) modalTitle.textContent = title;

  const display = document.getElementById('metric-sets-display');
  if (display) display.textContent = String(targetSets);

  const setsChipsContainer = document.getElementById('sets-chips-container');
  if (setsChipsContainer) {
    setsChipsContainer.querySelectorAll('.sets-option-chip').forEach(chip => {
      const val = parseInt(chip.getAttribute('data-sets'), 10);
      if (val === targetSets) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  const restChipsContainer = document.getElementById('rest-time-chips-container');
  if (restChipsContainer) {
    restChipsContainer.querySelectorAll('.rest-option-chip').forEach(chip => {
      const val = parseInt(chip.getAttribute('data-rest'), 10);
      if (val === restTime) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  const metricModal = document.getElementById('metric-selector-modal');
  if (metricModal) {
    metricModal.querySelectorAll('.premium-metric-card').forEach(card => {
      const m = card.getAttribute('data-metric');
      if (metrics.includes(m)) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }
}

export function openMetricSelectorForEdit(exIdx) {
  const ex = state.activeWorkout.exercises[exIdx];
  if (!ex) return;
  state.editingActiveExerciseIndex = exIdx;
  state.selectedExerciseForAdding = null;
  state.configuringExerciseDefaults = null;

  const metrics = getExerciseMetrics(ex);
  setupMetricSelectorModal('עריכת הגדרות תרגיל', ex.targetSetsCount || 3, ex.restTime || 90, metrics);

  const inspectorModal = document.getElementById('exercise-inspector-modal');
  if (inspectorModal) inspectorModal.classList.add('hide');

  const metricModal = document.getElementById('metric-selector-modal');
  if (metricModal) {
    const confirmBtnSpan = document.querySelector('#confirm-add-exercise-btn span');
    if (confirmBtnSpan) confirmBtnSpan.textContent = '✓ עדכן הגדרות תרגיל';
    metricModal.classList.remove('hide');
  }
}

export function openMetricSelectorForConfig(exerciseName) {
  state.configuringExerciseDefaults = exerciseName;
  state.selectedExerciseForAdding = null;
  state.editingActiveExerciseIndex = null;

  const defaults = getExerciseDefaults(exerciseName) || { targetSetsCount: 3, restTime: 90, metrics: ['weight', 'reps'] };

  setupMetricSelectorModal(
    `הגדרות ברירת מחדל: ${exerciseName}`,
    defaults.targetSetsCount || 3,
    defaults.restTime || 90,
    defaults.metrics || ['weight', 'reps']
  );

  const inspectorModal = document.getElementById('exercise-inspector-modal');
  if (inspectorModal) inspectorModal.classList.add('hide');

  const metricModal = document.getElementById('metric-selector-modal');
  if (metricModal) {
    const confirmBtnSpan = document.querySelector('#confirm-add-exercise-btn span');
    if (confirmBtnSpan) confirmBtnSpan.textContent = '✓ שמור הגדרות ברירת מחדל';
    metricModal.classList.remove('hide');
  }
}




export function getAllExercises() {
  const combined = [];
  const names = new Set();
  [...GYM_EXERCISES, ...PARK_EXERCISES].forEach(item => {
    if (!names.has(item.name)) {
      names.add(item.name);
      combined.push(item);
    }
  });
  state.customExercises.forEach(item => {
    if (!names.has(item.name)) {
      names.add(item.name);
      combined.push(item);
    }
  });
  return combined;
}

export function isSystemExercise(name) {
  if (!name) return false;
  const normName = name.trim().toLowerCase();
  return [...GYM_EXERCISES, ...PARK_EXERCISES].some(
    ex => ex.name.trim().toLowerCase() === normName
  );
}

// Initialize workouts state on user auth
export function initWorkouts() {
  if (!state.currentUser) return;
  
  // Load History
  const historyData = SafeStorage.getItem(`aura-workout-history_${state.currentUser.uid}`);
  if (historyData) {
    try {
      state.workoutHistory = JSON.parse(historyData);
    } catch (e) {
      console.error("Failed to parse workout history, resetting:", e);
      state.workoutHistory = [];
    }
  } else {
    state.workoutHistory = [];
  }
  
  // Load Custom Locations
  const locsData = SafeStorage.getItem(`aura-custom-locations_${state.currentUser.uid}`);
  if (locsData) {
    try {
      state.customLocations = JSON.parse(locsData);
    } catch (e) {
      console.error("Failed to parse custom locations:", e);
      state.customLocations = [];
    }
  } else {
    state.customLocations = [];
  }
  
  // Load Custom Exercises
  const exsData = SafeStorage.getItem(`aura-custom-exercises_${state.currentUser.uid}`);
  if (exsData) {
    try {
      state.customExercises = JSON.parse(exsData);
      let modified = false;
      state.customExercises.forEach(ex => {
        const oldCat = ex.category;
        if (ex.category === 'בטן' || ex.category === 'ליבה' || ex.category === 'ליבה ואירובי') {
          ex.category = 'בטן וליבה';
        } else if (ex.category === 'מתח') {
          ex.category = 'גב';
        } else if (ex.category === 'דחיפה') {
          ex.category = 'חזה';
        } else if (ex.category === 'ידיים') {
          const nameNorm = ex.name || '';
          if (nameNorm.includes('פשיט') || nameNorm.includes('אחורי') || nameNorm.includes('יהלום') || nameNorm.includes('מקבילים') || nameNorm.includes('טריספס') || nameNorm.includes('tricep')) {
            ex.category = 'יד אחורית';
          } else {
            ex.category = 'יד קדמית';
          }
        }
        if (ex.category !== oldCat) {
          modified = true;
        }
      });
      if (modified) {
        SafeStorage.setItem(`aura-custom-exercises_${state.currentUser.uid}`, JSON.stringify(state.customExercises));
      }
    } catch (e) {
      console.error("Failed to parse custom exercises:", e);
      state.customExercises = [];
    }
  } else {
    state.customExercises = [];
  }
  
  // Load Favorite Exercises
  const favsData = SafeStorage.getItem(`aura-favorite-exercises_${state.currentUser.uid}`);
  if (favsData) {
    try {
      state.favoriteExercises = JSON.parse(favsData);
    } catch (e) {
      console.error("Failed to parse favorite exercises:", e);
      state.favoriteExercises = [];
    }
  } else {
    state.favoriteExercises = [];
  }
  
  // Render History Logs
  if (window.renderWorkoutHistory) window.renderWorkoutHistory();
  
  // Render location grid dynamically
  renderLocationSelectorGrid();
  populateLocationSelects();
  
  // Restore Active Workout if any (anti-data loss on reload)
  const activeData = SafeStorage.getItem(`aura-active-workout_${state.currentUser.uid}`);
  if (activeData) {
    try {
      state.activeWorkout = JSON.parse(activeData);
      if (state.activeWorkout && state.activeWorkout.startTime) {
        if (!state.activeWorkout.exercises || !Array.isArray(state.activeWorkout.exercises)) {
          state.activeWorkout.exercises = [];
        }

        const fourHoursInMs = 4 * 60 * 60 * 1000;
        const isStale = (Date.now() - state.activeWorkout.startTime) > fourHoursInMs;

        if (isStale) {
          const hasCompletedExercises = state.activeWorkout.exercises.some(ex => ex.sets && ex.sets.some(s => s.completed));
          if (!hasCompletedExercises) {
            console.log("Stale and empty active workout detected. Discarding quietly...");
            state.activeWorkout = null;
            SafeStorage.removeItem(`aura-active-workout_${state.currentUser.uid}`);
            saveFieldToCloud("activeWorkout", null);
          } else {
            console.log("Stale active workout with completed exercises detected. Showing stale workout modal...");
            const staleModal = document.getElementById('stale-workout-modal');
            const listContainer = document.getElementById('stale-workout-exercises-list');
            if (listContainer) {
              listContainer.innerHTML = '';
              state.activeWorkout.exercises.forEach(ex => {
                const completedSetsCount = ex.sets ? ex.sets.filter(s => s.completed).length : 0;
                if (completedSetsCount > 0) {
                  const item = document.createElement('div');
                  item.style.padding = '6px 0';
                  item.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                  item.style.color = '#ffffff';
                  item.style.fontSize = '0.9rem';
                  item.textContent = `${ex.emoji || '💪'} ${ex.name} (${completedSetsCount} סטים)`;
                  listContainer.appendChild(item);
                }
              });
            }
            if (staleModal) {
              staleModal.classList.remove('hide');
            }

            let saveBtn = document.getElementById('stale-workout-save-btn');
            let deleteBtn = document.getElementById('stale-workout-delete-btn');

            if (saveBtn) {
              const handleSave = () => {
                if (!state.activeWorkout) return;
                state.activeWorkout.exercises.forEach(ex => {
                  if (!ex.completed && ex.name.trim() !== '') {
                    const sets = Array.isArray(ex.sets) ? ex.sets : [];
                    sets.forEach(set => {
                      if (!set.completed) {
                        const hasReps = set.reps !== '' && Number(set.reps) > 0;
                        const hasWeight = set.weight !== '' && Number(set.weight) >= 0;
                        if (hasReps || hasWeight) {
                          set.completed = true;
                        }
                      }
                    });
                    const hasCompletedSets = sets.some(s => s.completed);
                    if (hasCompletedSets) {
                      ex.completed = true;
                    }
                  }
                });

                const sanitizedExercises = state.activeWorkout.exercises.map(ex => {
                  const clonedEx = JSON.parse(JSON.stringify(ex));
                  const sets = Array.isArray(clonedEx.sets) ? clonedEx.sets : [];
                  const isGpsEx = ['ריצה', 'הליכה', 'ריצה והליכה'].includes(ex.name);
                  clonedEx.sets = sets.filter(s => {
                    if (isGpsEx) {
                      return s.completed && (s.distance !== undefined || s.time !== undefined);
                    } else {
                      const hasReps = s.reps !== null && s.reps !== undefined && String(s.reps).trim() !== '' && Number(s.reps) > 0;
                      const hasWeight = s.weight !== null && s.weight !== undefined && String(s.weight).trim() !== '' && Number(s.weight) >= 0;
                      return s.completed && (hasReps || hasWeight);
                    }
                  });
                  return clonedEx;
                }).filter(ex => ex.name.trim() !== '' && ex.sets.length > 0);

                const workoutLog = {
                  id: Date.now(),
                  date: Date.now(),
                  location: state.activeWorkout.location,
                  locationName: state.activeWorkout.locationName || (state.activeWorkout.location === 'gym' ? 'חדר כושר' : 'פארק'),
                  locationEmoji: state.activeWorkout.locationEmoji || (state.activeWorkout.location === 'gym' ? '🏋️‍♂️' : '🌳'),
                  duration: 3600, // default 60 minutes
                  exercises: sanitizedExercises
                };

                state.workoutHistory.push(workoutLog);
                SafeStorage.setItem(`aura-workout-history_${state.currentUser.uid}`, JSON.stringify(state.workoutHistory));
                saveFieldToCloud("workoutHistory", state.workoutHistory);

                SafeStorage.removeItem(`aura-active-workout_${state.currentUser.uid}`);
                saveFieldToCloud("activeWorkout", null);

                if (state.activeTimerInterval) {
                  clearInterval(state.activeTimerInterval);
                  state.activeTimerInterval = null;
                }
                state.activeWorkout = null;

                if (staleModal) staleModal.classList.add('hide');

                const activeView = document.getElementById('workout-active-view');
                const idleView = document.getElementById('workout-idle-view');
                if (activeView) activeView.classList.add('hide');
                if (idleView) {
                  idleView.classList.add('active');
                  idleView.classList.remove('hide');
                }
                const startBtn = document.getElementById('start-workout-btn');
                const locationGrid = document.getElementById('location-selector-grid');
                if (startBtn) startBtn.classList.remove('hide');
                if (locationGrid) locationGrid.classList.add('hide');

                if (window.renderWorkoutHistory) window.renderWorkoutHistory();
                showPremiumToast("האימון הישן נשמר בהצלחה! 💪", "success");
              };

              if (saveBtn.parentNode) {
                try {
                  const newSaveBtn = saveBtn.cloneNode(true);
                  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
                  newSaveBtn.addEventListener('click', handleSave);
                  saveBtn = newSaveBtn;
                } catch (e) {
                  saveBtn.addEventListener('click', handleSave);
                }
              } else {
                saveBtn.addEventListener('click', handleSave);
              }
            }

            if (deleteBtn) {
              const handleDelete = () => {
                SafeStorage.removeItem(`aura-active-workout_${state.currentUser.uid}`);
                saveFieldToCloud("activeWorkout", null);

                if (state.activeTimerInterval) {
                  clearInterval(state.activeTimerInterval);
                  state.activeTimerInterval = null;
                }
                state.activeWorkout = null;

                if (staleModal) staleModal.classList.add('hide');

                const activeView = document.getElementById('workout-active-view');
                const idleView = document.getElementById('workout-idle-view');
                if (activeView) activeView.classList.add('hide');
                if (idleView) {
                  idleView.classList.add('active');
                  idleView.classList.remove('hide');
                }
                const startBtn = document.getElementById('start-workout-btn');
                const locationGrid = document.getElementById('location-selector-grid');
                if (startBtn) startBtn.classList.remove('hide');
                if (locationGrid) locationGrid.classList.add('hide');

                showPremiumToast("האימון הישן נמחק בהצלחה.", "info");
              };

              if (deleteBtn.parentNode) {
                try {
                  const newDeleteBtn = deleteBtn.cloneNode(true);
                  deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
                  newDeleteBtn.addEventListener('click', handleDelete);
                  deleteBtn = newDeleteBtn;
                } catch (e) {
                  deleteBtn.addEventListener('click', handleDelete);
                }
              } else {
                deleteBtn.addEventListener('click', handleDelete);
              }
            }
          }
        } else {
          console.log("Restored active workout from storage, resuming timer...");
          resumeWorkoutTimer();
        }
      }
    } catch (e) {
      console.error("Failed to parse restored active workout:", e);
      state.activeWorkout = null;
    }
  }

  // Restore active run/walk tracking session if any
  recoverRunSession();
}

// Clear workout session on logout
export function clearWorkoutSession() {
  if (state.activeTimerInterval) {
    clearInterval(state.activeTimerInterval);
    state.activeTimerInterval = null;
  }
  
  stopRestTimer();
  stopSilentAudioBackgroundLoop();

  state.activeWorkout = null;
  state.workoutHistory = [];
  state.editingWorkout = null;
  
  const activeView = document.getElementById('workout-active-view');
  const idleView = document.getElementById('workout-idle-view');
  const locationGrid = document.getElementById('location-selector-grid');
  const startBtn = document.getElementById('start-workout-btn');
  
  if (activeView) activeView.classList.add('hide');
  if (idleView) {
    idleView.classList.add('active');
    idleView.classList.remove('hide');
  }
  if (locationGrid) locationGrid.classList.add('hide');
  if (startBtn) startBtn.classList.remove('hide');
  
  const historyList = document.getElementById('workout-history-list');
  if (historyList) historyList.innerHTML = '';
}

// Dynamic Location Selector Grid Render
export function renderLocationSelectorGrid() {
  const container = document.getElementById('location-tiles-container');
  if (!container) return;
  container.innerHTML = '';
  
  // Default Gym Tile
  const gymTile = document.createElement('button');
  gymTile.className = 'location-tile';
  gymTile.innerHTML = `
    <span class="tile-icon" style="display: flex; align-items: center; justify-content: center; color: var(--electric-blue);">${ICONS_MAP.gym}</span>
    <span class="tile-label">חדר כושר</span>
  `;
  gymTile.addEventListener('click', () => startNewWorkout('gym'));
  container.appendChild(gymTile);

  // Default Park Tile
  const parkTile = document.createElement('button');
  parkTile.className = 'location-tile';
  parkTile.innerHTML = `
    <span class="tile-icon" style="display: flex; align-items: center; justify-content: center; color: #34c759;">${ICONS_MAP.park}</span>
    <span class="tile-label">פארק</span>
  `;
  parkTile.addEventListener('click', () => startNewWorkout('park'));
  container.appendChild(parkTile);

  // Render Custom Locations
  state.customLocations.forEach(loc => {
    const tile = document.createElement('button');
    tile.className = 'location-tile';
    tile.innerHTML = `
      <span class="tile-icon" style="display: flex; align-items: center; justify-content: center; color: var(--electric-blue-light);">${getCustomIcon(loc.emoji || 'gym')}</span>
      <span class="tile-label">${escapeHTML(loc.name)}</span>
    `;
    tile.addEventListener('click', () => startNewWorkout(loc.id, loc.name, loc.emoji));
    container.appendChild(tile);
  });

  // Add Custom Location Tile
  const addTile = document.createElement('button');
  addTile.className = 'location-tile add-custom-location-tile';
  addTile.innerHTML = `
    <span class="tile-icon" style="display: flex; align-items: center; justify-content: center; color: var(--electric-blue);">${ICONS_MAP.plus}</span>
    <span class="tile-label">סוג אימון חדש</span>
  `;
  addTile.addEventListener('click', () => {
    const modal = document.getElementById('custom-location-modal');
    if (modal) modal.classList.remove('hide');
  });
  container.appendChild(addTile);
}

// Dynamic Custom Locations populator for filter & schedule selects
export function populateLocationSelects() {
  const filterSelect = document.getElementById('filter-location-select');
  const scheduleSelect = document.getElementById('schedule-location-select');
  if (filterSelect) {
    filterSelect.innerHTML = `
      <option value="all">כל המיקומים</option>
      <option value="gym">חדר כושר</option>
      <option value="park">פארק</option>
    `;
    state.customLocations.forEach(loc => {
      filterSelect.innerHTML += `<option value="${escapeHTML(loc.id)}">${escapeHTML(loc.name)}</option>`;
    });
  }
  if (scheduleSelect) {
    scheduleSelect.innerHTML = `
      <option value="gym">חדר כושר</option>
      <option value="park">פארק</option>
    `;
    state.customLocations.forEach(loc => {
      scheduleSelect.innerHTML += `<option value="${escapeHTML(loc.id)}">${escapeHTML(loc.name)}</option>`;
    });
    scheduleSelect.innerHTML += `<option value="custom">סוג אימון מותאם אישית...</option>`;
  }
}

export function startNewWorkout(location, name = '', emoji = '') {
  if (!state.currentUser) return;
  
  // Proactively request notification permissions for PWA background tracking support
  requestNotificationPermissionSafely();
  
  let dispName = 'חדר כושר';
  let dispEmoji = '🏋️‍♂️';
  
  if (location === 'gym') {
    dispName = 'חדר כושר';
    dispEmoji = '🏋️‍♂️';
  } else if (location === 'park') {
    dispName = 'פארק';
    dispEmoji = '🌳';
  } else {
    dispName = name || 'אימון מותאם';
    dispEmoji = emoji || '💪';
  }
  
  state.activeWorkout = {
    startTime: Date.now(),
    location: location,
    locationName: dispName,
    locationEmoji: dispEmoji,
    exercises: []
  };
  
  SafeStorage.setItem(`aura-active-workout_${state.currentUser.uid}`, JSON.stringify(state.activeWorkout));
  
  const idleView = document.getElementById('workout-idle-view');
  const activeView = document.getElementById('workout-active-view');
  
  if (idleView) {
    idleView.classList.remove('active');
    idleView.classList.add('hide');
  }
  if (activeView) activeView.classList.remove('hide');
  
  const locationGrid = document.getElementById('location-selector-grid');
  const startWorkoutBtn = document.getElementById('start-workout-btn');
  if (locationGrid) locationGrid.classList.add('hide');
  if (startWorkoutBtn) startWorkoutBtn.classList.remove('hide');
  
  const badgeIcon = document.getElementById('active-location-icon');
  const badgeText = document.getElementById('active-location-text');
  if (badgeIcon) badgeIcon.textContent = dispEmoji;
  if (badgeText) badgeText.textContent = dispName;
  
  const timerDisplay = document.getElementById('active-timer');
  if (timerDisplay) timerDisplay.textContent = '00:00:00';
  
  if (state.activeTimerInterval) clearInterval(state.activeTimerInterval);
  state.activeTimerInterval = setInterval(updateActiveTimer, 1000);
  
  renderExercises();
  
  if (window.collapseNav) window.collapseNav();
}

export function resumeWorkoutTimer() {
  const activeView = document.getElementById('workout-active-view');
  const idleView = document.getElementById('workout-idle-view');
  
  if (idleView) {
    idleView.classList.remove('active');
    idleView.classList.add('hide');
  }
  if (activeView) activeView.classList.remove('hide');
  
  const badgeIcon = document.getElementById('active-location-icon');
  const badgeText = document.getElementById('active-location-text');
  const dispEmoji = state.activeWorkout.locationEmoji || (state.activeWorkout.location === 'gym' ? '🏋️‍♂️' : '🌳');
  const dispName = state.activeWorkout.locationName || (state.activeWorkout.location === 'gym' ? 'חדר כושר' : 'פארק');
  
  if (badgeIcon) badgeIcon.textContent = dispEmoji;
  if (badgeText) badgeText.textContent = dispName;
  
  if (state.activeTimerInterval) clearInterval(state.activeTimerInterval);
  state.activeTimerInterval = setInterval(updateActiveTimer, 1000);
  updateActiveTimer();
  
  renderExercises();
  
  // Restore active rest timer if running
  recoverRestTimer();
}

export function updateActiveTimer() {
  if (!state.activeWorkout || !state.activeWorkout.startTime) return;
  
  const diffMs = Date.now() - state.activeWorkout.startTime;
  const totalSecs = Math.floor(diffMs / 1000);
  
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  
  const pad = (num) => String(num).padStart(2, '0');
  
  const timerDisplay = document.getElementById('active-timer');
  if (timerDisplay) {
    timerDisplay.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
}

export function renderExercisePickerFilters() {
  const container = document.getElementById('exercise-category-filters');
  if (!container || !state.activeWorkout) return;
  container.innerHTML = '';
  
  let categories = ['הכל'];
  if (state.favoriteExercises.length > 0) {
    categories.push('⭐ מועדפים');
  }
  categories.push('חזה', 'גב', 'כתפיים', 'רגליים', 'יד קדמית', 'יד אחורית', 'בטן וליבה', 'אירובי');
  if (state.customExercises.length > 0) {
    categories.push('תרגילים שלי');
  }
  categories.push('אחר');
  
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `category-filter-btn ${state.currentActiveCategoryFilter === cat ? 'active' : ''}`;
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      state.currentActiveCategoryFilter = cat;
      renderExercisePickerFilters();
      renderExercisePickerList();
    });
    container.appendChild(btn);
  });
}

export function renderExercisePickerList() {
  const container = document.getElementById('exercise-picker-list');
  if (!container || !state.activeWorkout) return;
  container.innerHTML = '';
  
  const searchInput = document.getElementById('exercise-search-input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  
  let fullList = getAllExercises();
  
  const seen = new Set();
  fullList = fullList.filter(ex => {
    const k = ex.name.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  
  if (state.currentActiveCategoryFilter === '⭐ מועדפים') {
    fullList = fullList.filter(ex => state.favoriteExercises.includes(ex.name));
  } else if (state.currentActiveCategoryFilter === 'תרגילים שלי') {
    fullList = fullList.filter(ex => state.customExercises.some(c => c.name.trim().toLowerCase() === ex.name.trim().toLowerCase()));
  } else if (state.currentActiveCategoryFilter !== 'הכל') {
    fullList = fullList.filter(ex => ex.category === state.currentActiveCategoryFilter);
  }
  
  if (query) {
    fullList = fullList.filter(ex => ex.name.toLowerCase().includes(query));
  }
  
  if (fullList.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'exercise-picker-empty';
    if (state.isBackgroundSyncing) {
      noResults.innerHTML = '<span class="spin-icon" style="display:inline-block; animation: spin-clockwise 1.2s linear infinite; margin-left: 6px;">⚡</span> טוען תרגילים מהענן...';
    } else {
      noResults.textContent = 'לא נמצאו תרגילים מתאימים';
    }
    container.appendChild(noResults);
    return;
  }
  
  const categoryColors = {
    'חזה':      { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
    'גב':       { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
    'כתפיים':    { bg: 'rgba(168,85,247,0.15)',  color: '#c084fc' },
    'רגליים':    { bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
    'יד קדמית': { bg: 'rgba(251,146,60,0.15)',  color: '#fb923c' },
    'יד אחורית': { bg: 'rgba(251,146,60,0.15)',  color: '#fb923c' },
    'בטן':      { bg: 'rgba(234,179,8,0.15)',   color: '#facc15' },
    'בטן וליבה':{ bg: 'rgba(234,179,8,0.15)',   color: '#facc15' },
    'אירובי':    { bg: 'rgba(20,184,166,0.15)',  color: '#2dd4bf' },
    'ליבה':      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
    'מתח':      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
    'דחיפה':    { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
    'ליבה ואירובי': { bg: 'rgba(20,184,166,0.15)', color: '#2dd4bf' },
    'מותאם אישית': { bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8' },
  };
  
  fullList.forEach(ex => {
    const itemWrapper = document.createElement('div');
    itemWrapper.className = 'exercise-list-item-wrapper';
    itemWrapper.style.cssText = 'position: relative; display: flex; align-items: center; gap: 8px; direction: rtl;';

    const item = document.createElement('button');
    item.className = 'exercise-list-item';
    item.style.flex = '1';
    
    const catStyle = categoryColors[ex.category] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' };
    const iconSvg = `<span class="ex-list-emoji" style="display: flex; align-items: center; justify-content: center; color: ${catStyle.color};">${getCategoryIcon(ex.category)}</span>`;
    const isFav = state.favoriteExercises.includes(ex.name);
    
    item.innerHTML = `
      <div class="ex-list-info">
        ${iconSvg}
        <span class="ex-list-name">${escapeHTML(ex.name)}</span>
      </div>
      <div class="ex-list-right">
        <span class="ex-category-badge" style="background: ${catStyle.bg}; color: ${catStyle.color};">${escapeHTML(ex.category || 'תרגיל')}</span>
        <span class="ex-list-arrow">←</span>
      </div>
    `;
    item.addEventListener('click', () => {
      state.selectedExerciseForAdding = ex.name;
      
      const pickerModal = document.getElementById('exercise-picker-modal');
      if (pickerModal) pickerModal.classList.add('hide');

      const defaults = getExerciseDefaults(ex.name);
      if (defaults) {
        const newExercise = {
          name: ex.name,
          metrics: defaults.metrics || ['weight', 'reps'],
          restTime: defaults.restTime || 90,
          targetSetsCount: defaults.targetSetsCount || 3,
          completed: false,
          sets: []
        };
        state.activeWorkout.exercises.push(newExercise);
        saveActiveWorkoutState();
        state.selectedExerciseForAdding = null;
        renderExercises();
      } else {
        state.editingActiveExerciseIndex = null;
        state.configuringExerciseDefaults = null;
        setupMetricSelectorModal('הגדרות תרגיל', 3, 90, ['weight', 'reps']);

        const confirmBtnSpan = document.querySelector('#confirm-add-exercise-btn span');
        if (confirmBtnSpan) confirmBtnSpan.textContent = 'הוסף תרגיל לאימון';

        const metricModal = document.getElementById('metric-selector-modal');
        if (metricModal) metricModal.classList.remove('hide');

        if (window.checkAndShowPreviousPerformance) {
          window.checkAndShowPreviousPerformance(ex.name);
        }
      }
    });

    const renderStarIcon = (active) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="${active ? '#ffcc00' : 'none'}" stroke="${active ? '#ffcc00' : 'var(--text-muted)'}" stroke-width="2" class="custom-svg-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    const starBtn = document.createElement('button');
    starBtn.className = `ex-fav-star-btn ${isFav ? 'active' : ''}`;
    starBtn.title = isFav ? 'הסר ממועדפים' : 'הוסף למועדפים';
    starBtn.innerHTML = renderStarIcon(isFav);
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = state.favoriteExercises.indexOf(ex.name);
      if (idx > -1) {
        state.favoriteExercises.splice(idx, 1);
        starBtn.innerHTML = renderStarIcon(false);
        starBtn.classList.remove('active');
        starBtn.title = 'הוסף למועדפים';
      } else {
        state.favoriteExercises.push(ex.name);
        starBtn.innerHTML = renderStarIcon(true);
        starBtn.classList.add('active');
        starBtn.title = 'הסר ממועדפים';
      }
      if (state.currentUser) {
        SafeStorage.setItem(`aura-favorite-exercises_${state.currentUser.uid}`, JSON.stringify(state.favoriteExercises));
        saveFieldToCloud("favoriteExercises", state.favoriteExercises);
      }
      renderExercisePickerFilters();
      if (state.currentActiveCategoryFilter === '⭐ מועדפים') {
        renderExercisePickerList();
      }
    });

    itemWrapper.appendChild(starBtn);
    itemWrapper.appendChild(item);
    container.appendChild(itemWrapper);
  });
}

export function renderExercises() {
  const container = document.getElementById('exercises-container');
  if (!container || !state.activeWorkout) return;
  
  container.innerHTML = '';

  if (state.activeWorkout.exercises.length === 0) {
    const shortcutCard = document.createElement('div');
    shortcutCard.className = 'exercise-card shortcut-card';
    shortcutCard.style.cssText = 'padding: 24px; text-align: center; background: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(255, 255, 255, 0.15); border-radius: 20px; display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 1rem;';
    shortcutCard.innerHTML = `
      <span style="font-size: 2rem;">🏃‍♂️</span>
      <h4 style="margin: 0; font-size: 1.2rem; font-weight: 700; color: #ffffff; font-family: var(--font-display);">מעקב ריצה והליכה בחוץ</h4>
      <p style="margin: 0 0 8px 0; font-size: 0.88rem; color: var(--text-muted); line-height: 1.4;">מדוד מרחק, קצב ומסלול בזמן אמת באמצעות GPS</p>
      <button id="start-run-shortcut-btn" class="btn btn-primary" style="padding: 12px 24px; border-radius: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; background: linear-gradient(135deg, var(--electric-blue) 0%, #1e40af 100%); border: none; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);">התחל ריצה / הליכה 🏃‍♂️</button>
    `;
    container.appendChild(shortcutCard);

    const shortcutBtn = shortcutCard.querySelector('#start-run-shortcut-btn');
    if (shortcutBtn) {
      shortcutBtn.addEventListener('click', () => {
        const newEx = {
          name: 'ריצה והליכה',
          targetSetsCount: 1,
          metrics: ['time'],
          completed: false,
          sets: []
        };
        state.activeWorkout.exercises.push(newEx);
        saveActiveWorkoutState();
        renderExercises();
        openRunTrackerModal(newEx);
      });
    }

    const addExerciseBtn = document.getElementById('add-exercise-btn');
    if (addExerciseBtn) {
      addExerciseBtn.classList.remove('hide');
      addExerciseBtn.disabled = false;
      addExerciseBtn.style.opacity = '1';
      addExerciseBtn.style.cursor = 'pointer';
    }
    const finishWorkoutBtn = document.getElementById('finish-workout-btn');
    if (finishWorkoutBtn) {
      finishWorkoutBtn.classList.remove('hide');
    }
    return;
  }
  
  const hasUncompleted = state.activeWorkout.exercises.some(ex => !ex.completed);
  const addExerciseBtn = document.getElementById('add-exercise-btn');
  const finishWorkoutBtn = document.getElementById('finish-workout-btn');
  
  if (hasUncompleted) {
    // Only the "add exercise" action is blocked while an exercise is still open.
    // "Finish workout" must always stay reachable, otherwise a user with an open
    // exercise has no way at all to close the session.
    if (addExerciseBtn) {
      addExerciseBtn.classList.add('hide');
    }
    if (finishWorkoutBtn) {
      finishWorkoutBtn.classList.remove('hide');
    }
  } else {
    if (addExerciseBtn) {
      addExerciseBtn.classList.remove('hide');
      addExerciseBtn.disabled = false;
      addExerciseBtn.style.opacity = '1';
      addExerciseBtn.style.cursor = 'pointer';
    }
    if (finishWorkoutBtn) {
      finishWorkoutBtn.classList.remove('hide');
    }
  }
  
  state.activeWorkout.exercises.forEach((ex, exIdx) => {
    const card = document.createElement('div');
    card.className = `exercise-card ${ex.completed ? 'saved' : ''}`;
    
    const metrics = getExerciseMetrics(ex);
    const completedCount = ex.sets ? ex.sets.filter(s => s.completed).length : 0;
    const targetSets = ex.targetSetsCount || 3;
    const metricLabel = getMetricLabel(metrics);

    // 1. HEADER ROW (Redesigned to be vertical stack with full-width name and compact sub-row)
    const headerRow = document.createElement('div');
    headerRow.className = 'ex-card-header-row';

    const nameRow = document.createElement('div');
    nameRow.className = 'ex-card-name-row';

    const nameContainer = document.createElement('div');
    nameContainer.className = 'ex-card-name-container';

    const nameLabel = document.createElement('span');
    nameLabel.className = 'ex-card-name-label';
    nameLabel.textContent = ex.name;
    nameContainer.appendChild(nameLabel);
    nameRow.appendChild(nameContainer);
    headerRow.appendChild(nameRow);

    // Check if the exercise name overflows and apply marquee effect
    setTimeout(() => {
      if (nameContainer.scrollWidth > nameContainer.clientWidth) {
        nameLabel.classList.add('marquee-scroll');
        const scrollDistance = nameContainer.scrollWidth - nameContainer.clientWidth;
        nameLabel.style.setProperty('--scroll-distance', `${scrollDistance + 15}px`);
      }
    }, 50);

    const subRow = document.createElement('div');
    subRow.className = 'ex-card-sub-row';

    const badgesCol = document.createElement('div');
    badgesCol.className = 'ex-card-badges-col';

    const metricBadge = document.createElement('span');
    metricBadge.className = 'badge-mini';
    metricBadge.style.cssText = 'font-size: 0.75rem; background: rgba(255,255,255,0.06); color: var(--text-muted); padding: 4px 10px; border-radius: 20px; font-weight: 700;';
    metricBadge.textContent = metricLabel;
    badgesCol.appendChild(metricBadge);

    const isGpsEx = ['ריצה', 'הליכה', 'ריצה והליכה'].includes(ex.name);

    if (!isGpsEx) {
      if (!ex.completed) {
        // Compact Stepper: [-] X סטים [+]
        const compactStepper = document.createElement('div');
        compactStepper.className = 'compact-sets-stepper';

        const minusBtn = document.createElement('button');
        minusBtn.type = 'button';
        minusBtn.className = 'compact-stepper-btn';
        minusBtn.textContent = '-';
        minusBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          ex.targetSetsCount = Math.max(1, (ex.targetSetsCount || 3) - 1);
          saveActiveWorkoutState();
          renderExercises();
        });
        compactStepper.appendChild(minusBtn);

        const countVal = document.createElement('span');
        countVal.className = 'compact-stepper-val';
        countVal.textContent = `${targetSets} סטים`;
        compactStepper.appendChild(countVal);

        const plusBtn = document.createElement('button');
        plusBtn.type = 'button';
        plusBtn.className = 'compact-stepper-btn';
        plusBtn.textContent = '+';
        plusBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          ex.targetSetsCount = Math.min(12, (ex.targetSetsCount || 3) + 1);
          saveActiveWorkoutState();
          renderExercises();
        });
        compactStepper.appendChild(plusBtn);

        badgesCol.appendChild(compactStepper);
      } else {
        const progressBadge = document.createElement('span');
        progressBadge.style.cssText = 'font-size: 0.75rem; color: #22c55e; font-weight: 700; background: rgba(34, 197, 94, 0.1); padding: 4px 10px; border-radius: 20px;';
        progressBadge.textContent = `בוצעו: ${completedCount}/${targetSets} סטים`;
        badgesCol.appendChild(progressBadge);
      }
    } else {
      if (ex.completed) {
        const progressBadge = document.createElement('span');
        progressBadge.style.cssText = 'font-size: 0.75rem; color: var(--electric-blue); font-weight: 700; background: rgba(0, 191, 255, 0.1); padding: 4px 10px; border-radius: 20px;';
        const totalDist = ex.sets && ex.sets[0] ? (ex.sets[0].distance / 1000).toFixed(2) : '0.00';
        progressBadge.textContent = `מרחק: ${totalDist} ק״מ`;
        badgesCol.appendChild(progressBadge);
      }
    }

    subRow.appendChild(badgesCol);

    // Actions column (only if not completed)
    if (!ex.completed) {
      const actionsCol = document.createElement('div');
      actionsCol.className = 'ex-card-actions-col';

      if (!isGpsEx) {
        // Settings gear button
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'ex-settings-btn-card';
        settingsBtn.innerHTML = '⚙️';
        settingsBtn.title = 'הגדרות תרגיל';
        settingsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openMetricSelectorForEdit(exIdx);
        });
        actionsCol.appendChild(settingsBtn);
      }

      // Delete trash button
      const removeExBtn = document.createElement('button');
      removeExBtn.className = 'ex-delete-btn-card';
      removeExBtn.innerHTML = '🗑️';
      removeExBtn.title = 'מחק תרגיל';
      removeExBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('האם למחוק תרגיל זה מהאימון?')) {
          state.activeWorkout.exercises.splice(exIdx, 1);
          saveActiveWorkoutState();
          renderExercises();
        }
      });
      actionsCol.appendChild(removeExBtn);

      subRow.appendChild(actionsCol);
    }

    headerRow.appendChild(subRow);
    card.appendChild(headerRow);

    // 2. VISUAL SETS DOTS PROGRESS BAR
    if (!isGpsEx) {
      const dotsRow = document.createElement('div');
      dotsRow.className = 'ex-card-dots-row';
      for (let i = 0; i < targetSets; i++) {
        const dot = document.createElement('div');
        dot.className = 'set-dot';
        if (i < completedCount) {
          dot.classList.add('completed');
        }
        dotsRow.appendChild(dot);
      }
      card.appendChild(dotsRow);
    }

    // 3. SETS AREA
    const setsArea = document.createElement('div');
    setsArea.className = 'sets-area';
    setsArea.style.width = '100%';

    const completedSets = ex.sets.filter(s => s.completed);
    if (completedSets.length > 0) {
      const chipsContainer = document.createElement('div');
      chipsContainer.className = 'completed-sets-chips-container';
      chipsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; direction: rtl;';
      
      completedSets.forEach((set, idx) => {
        const chip = document.createElement('div');
        chip.className = 'completed-set-chip';
        chip.style.cssText = 'display: inline-flex; align-items: center; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); padding: 6px 12px; border-radius: 12px; font-size: 0.88rem; color: #ffffff; gap: 6px;';
        
        let valueStr = '';
        if (set.distance !== undefined) {
          const km = (set.distance / 1000).toFixed(2);
          const hrs = Math.floor(set.time / 3600);
          const mins = Math.floor((set.time % 3600) / 60);
          const secs = set.time % 60;
          const pad = (num) => String(num).padStart(2, '0');
          const timeStr = hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
          valueStr = `🏃 ${km} ק״מ ב-${timeStr}`;
        } else {
          const parts = [];
          if (metrics.includes('weight')) parts.push(`${set.weight || 0} ק״ג`);
          if (metrics.includes('reps')) parts.push(`${set.reps || 0} חזרות`);
          if (metrics.includes('time')) parts.push(`${set.time || 0} ש׳`);
          valueStr = parts.join(' × ');
        }
        
        const realIdx = ex.sets.indexOf(set);
        chip.innerHTML = `
          <span style="font-weight: 700; color: var(--electric-blue);">סט ${realIdx + 1}:</span>
          <span>${valueStr}</span>
        `;
        
        if (!ex.completed && !isGpsEx) {
          chip.style.cursor = 'pointer';
          chip.title = 'לחץ לביטול הסט';
          chip.addEventListener('click', () => {
            if (confirm(`האם ברצונך לבטל את סט ${realIdx + 1}?`)) {
              set.completed = false;
              saveActiveWorkoutState();
              renderExercises();
            }
          });
        }
        chipsContainer.appendChild(chip);
      });
      setsArea.appendChild(chipsContainer);
    }
    card.appendChild(setsArea);

    // 4. BOTTOM ACTIONS BAR
    const bottomActions = document.createElement('div');
    bottomActions.className = 'ex-card-bottom-actions';
    bottomActions.style.width = '100%';
    bottomActions.style.display = 'flex';
    bottomActions.style.gap = '8px';
    bottomActions.style.marginTop = '10px';

    if (isGpsEx) {
      if (!ex.completed) {
        // Active GPS Exercise
        const gpsBtn = document.createElement('button');
        gpsBtn.className = 'btn-gps-track-action';
        gpsBtn.style.cssText = 'flex: 1; background: linear-gradient(135deg, var(--electric-blue) 0%, #0284c7 100%); border: none; color: #fff; padding: 12px; border-radius: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);';
        
        const hasData = ex.sets && ex.sets.length > 0 && ex.sets[0].distance > 0;
        gpsBtn.innerHTML = hasData ? 'המשך מעקב GPS 🗺️' : 'הפעל מעקב GPS 🗺️';
        
        gpsBtn.addEventListener('click', () => {
          openRunTrackerModal(ex);
        });
        bottomActions.appendChild(gpsBtn);
      } else {
        // Completed GPS Exercise
        // Button 1: המשך ריצה
        const resumeBtn = document.createElement('button');
        resumeBtn.style.cssText = 'flex: 1; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #fff; padding: 12px; border-radius: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px;';
        resumeBtn.innerHTML = 'המשך ריצה 🏃‍♂️';
        resumeBtn.addEventListener('click', () => {
          ex.completed = false;
          
          if (state.currentUser && ex.sets && ex.sets[0]) {
            const uid = state.currentUser.uid;
            const savedSet = ex.sets[0];
            
            state.isTrackingRun = true;
            state.runTrackerState = "run";
            state.isRunPaused = false;
            state.runTrackerSegments = savedSet.segments || [];
            
            // Push a new segment to continue fresh
            state.runTrackerSegments.push({
              state: "run",
              coords: [],
              startTime: Date.now(),
              endTime: null
            });
            
            state.runTrackerMetrics = {
              totalDistance: savedSet.distance || 0,
              runDistance: savedSet.runDistance || 0,
              walkDistance: savedSet.walkDistance || 0,
              totalDuration: savedSet.time || 0,
              runDuration: savedSet.runDuration || 0,
              walkDuration: savedSet.walkDuration || 0,
              restDuration: savedSet.restDuration || 0
            };
            
            state.activeRunExerciseIndex = exIdx;
            
            saveRunSessionState();
            startGPSWatcher();
            startTelemetryTimer();
            startSilentAudioBackgroundLoop();
          }
          
          saveActiveWorkoutState();
          renderExercises();
          openRunTrackerModal(ex);
        });
        bottomActions.appendChild(resumeBtn);

        // Button 2: צפה במסלול
        const viewRouteBtn = document.createElement('button');
        viewRouteBtn.style.cssText = 'flex: 1; background: linear-gradient(135deg, var(--electric-blue) 0%, #1e40af 100%); border: none; color: #fff; padding: 12px; border-radius: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);';
        viewRouteBtn.innerHTML = 'צפה במסלול 🗺️';
        viewRouteBtn.addEventListener('click', () => {
          if (ex.sets && ex.sets[0] && ex.sets[0].segments) {
            if (window.openHistoryMapFullscreen) {
              window.openHistoryMapFullscreen(ex.sets[0].segments);
            } else {
              alert('פונקציית המפה אינה זמינה כעת.');
            }
          } else {
            alert('אין נתוני מסלול זמינים.');
          }
        });
        bottomActions.appendChild(viewRouteBtn);

        // Button 3: מחק תרגיל (trash button)
        const deleteBtn = document.createElement('button');
        deleteBtn.style.cssText = 'background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 12px 14px; border-radius: 14px; cursor: pointer; transition: all 0.2s;';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'מחק תרגיל';
        deleteBtn.addEventListener('click', () => {
          if (confirm('האם למחוק תרגיל זה מהאימון?')) {
            state.activeWorkout.exercises.splice(exIdx, 1);
            saveActiveWorkoutState();
            renderExercises();
          }
        });
        bottomActions.appendChild(deleteBtn);
      }
    } else {
      if (!ex.completed) {
        // Deep purple/blue glowing Add Set Button
        const enterSetBtn = document.createElement('button');
        enterSetBtn.className = 'btn-add-set-action';
        
        const nextIncompleteIdx = ex.sets.findIndex(s => !s.completed);
        const activeSetIdx = nextIncompleteIdx !== -1 ? nextIncompleteIdx : ex.sets.length;
        
        enterSetBtn.textContent = `➕ רישום סט ${activeSetIdx + 1}`;
        enterSetBtn.addEventListener('click', () => {
          openSetLoggingModal(ex);
        });
        bottomActions.appendChild(enterSetBtn);

        // Success Green End Exercise Button
        const saveExBtn = document.createElement('button');
        saveExBtn.className = 'btn-finish-ex-action';
        saveExBtn.textContent = 'סיום ✓';
        saveExBtn.addEventListener('click', () => {
          const hasCompletedSets = ex.sets.some(s => s.completed);
          if (!hasCompletedSets) {
            alert('אנא השלם לפחות סט אחד.');
            return;
          }
          ex.completed = true;
          ex.sets = ex.sets.filter(s => s.completed);
          saveActiveWorkoutState();

          // Save its settings as defaults
          saveExerciseDefaults(ex.name, {
            targetSetsCount: ex.targetSetsCount || 3,
            restTime: ex.restTime || 90,
            metrics: getExerciseMetrics(ex)
          });

          renderExercises();
        });
        bottomActions.appendChild(saveExBtn);
      } else {
        // Completed - show a clean Edit button at bottom of card
        bottomActions.style.width = '100%';
        const editExBtn = document.createElement('button');
        editExBtn.className = 'btn-edit-ex-action';
        editExBtn.textContent = 'ערוך תרגיל ✏️';
        editExBtn.addEventListener('click', () => {
          ex.completed = false;
          saveActiveWorkoutState();
          renderExercises();
        });
        bottomActions.appendChild(editExBtn);
      }
    }

    card.appendChild(bottomActions);
    container.appendChild(card);
  });
}

// REST TIMER ENGINE

// Single source of truth for the countdown tick. This logic previously existed as three
// byte-identical copies (start / recover / +30s), which is how they drifted apart.
function beginRestTimerTick() {
  if (state.restTimerInterval) return;
  state.restTimerInterval = setInterval(() => {
    state.restTimerSecondsLeft--;
    if (state.restTimerSecondsLeft <= 0) {
      state.restTimerSecondsLeft = 0;
      updateRestTimerUI();
      handleRestTimerExpiration();
    } else {
      updateRestTimerUI();
    }
  }, 1000);
}

export function startRestTimer(seconds = 90) {
  stopRestTimer();

  // Proactively request permissions when the user begins a rest period
  requestNotificationPermissionSafely();

  state.restTimerSecondsLeft = seconds;
  state.restTimerTotalDuration = seconds;
  
  const bubble = document.getElementById('rest-timer-bubble');
  if (bubble) {
    bubble.classList.remove('hide');
    bubble.classList.remove('expired');
  }

  const quoteEl = document.getElementById('rest-timer-quote');
  if (quoteEl) {
    const randIdx = Math.floor(Math.random() * HEBREW_QUOTES.length);
    quoteEl.textContent = `"${HEBREW_QUOTES[randIdx]}"`;
  }

  updateRestTimerUI();

  // Save the target end timestamp for PWA background freeze recovery
  const endTime = Date.now() + seconds * 1000;
  SafeStorage.setItem('aura-rest-timer-end-time', String(endTime));

  // Schedule background notification via Service Worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      action: 'scheduleRestNotification',
      delayMs: seconds * 1000
    });
  }

  beginRestTimerTick();
}

export function stopRestTimer() {
  if (state.restTimerInterval) {
    clearInterval(state.restTimerInterval);
    state.restTimerInterval = null;
  }
  SafeStorage.removeItem('aura-rest-timer-end-time');
  
  // Cancel background notification via Service Worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ action: 'cancelRestNotification' });
  }

  const bubble = document.getElementById('rest-timer-bubble');
  if (bubble) {
    bubble.style.transform = ''; // Reset transform so PWA transition works cleanly
    bubble.classList.add('hide');
    bubble.classList.remove('expired');
  }
}

export function updateRestTimerUI() {
  const countdownDisplay = document.getElementById('rest-timer-countdown');
  if (!countdownDisplay) return;

  const mins = Math.floor(state.restTimerSecondsLeft / 60);
  const secs = state.restTimerSecondsLeft % 60;
  countdownDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const progressCircle = document.getElementById('rest-timer-progress-circle');
  if (progressCircle) {
    const pct = state.restTimerTotalDuration > 0 ? state.restTimerSecondsLeft / state.restTimerTotalDuration : 0;
    const offset = Math.max(0, Math.min(283, 283 * (1 - pct)));
    progressCircle.style.strokeDashoffset = offset;
  }
}

export function recoverRestTimer() {
  if (!state.activeWorkout) {
    if (state.restTimerInterval) {
      stopRestTimer();
    } else {
      SafeStorage.removeItem('aura-rest-timer-end-time');
    }
    return;
  }

  const endTimeStr = SafeStorage.getItem('aura-rest-timer-end-time');
  if (!endTimeStr) return;

  const endTime = parseInt(endTimeStr, 10);
  const remaining = Math.round((endTime - Date.now()) / 1000);

  const bubble = document.getElementById('rest-timer-bubble');

  if (remaining > 0) {
    if (bubble) {
      bubble.classList.remove('hide');
      bubble.classList.remove('expired');
    }
    state.restTimerSecondsLeft = remaining;
    state.restTimerTotalDuration = Math.max(state.restTimerTotalDuration || 90, remaining);
    updateRestTimerUI();

    if (!state.restTimerInterval) {
      const quoteEl = document.getElementById('rest-timer-quote');
      if (quoteEl && !quoteEl.textContent) {
        const randIdx = Math.floor(Math.random() * HEBREW_QUOTES.length);
        quoteEl.textContent = `"${HEBREW_QUOTES[randIdx]}"`;
      }

      beginRestTimerTick();
    }
  } else {
    // Timer expired while app was closed / backgrounded
    const timeSinceExpiry = -remaining;
    if (timeSinceExpiry < 300) { // less than 5 minutes ago
      if (bubble) {
        bubble.classList.remove('hide');
        bubble.classList.add('expired');
      }
      state.restTimerSecondsLeft = 0;
      updateRestTimerUI();
      handleRestTimerExpiration();
    } else {
      stopRestTimer();
    }
  }
}

export function updateRestTimerRecoveryState() {
  if (state.restTimerSecondsLeft > 0) {
    const newEndTime = Date.now() + state.restTimerSecondsLeft * 1000;
    SafeStorage.setItem('aura-rest-timer-end-time', String(newEndTime));
    
    // Update Service Worker notification
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        action: 'scheduleRestNotification',
        delayMs: state.restTimerSecondsLeft * 1000
      });
    }
  } else {
    SafeStorage.removeItem('aura-rest-timer-end-time');
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ action: 'cancelRestNotification' });
    }
  }
}

export function playRestAlarmSynth() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const startTime = ctx.currentTime;
    
    // Play 4 beautiful double beeps (987Hz B5)
    for (let i = 0; i < 4; i++) {
      const timeOffset = i * 0.7;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, startTime + timeOffset);
      gain1.gain.setValueAtTime(0, startTime + timeOffset);
      gain1.gain.linearRampToValueAtTime(0.35, startTime + timeOffset + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, startTime + timeOffset + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(startTime + timeOffset);
      osc1.stop(startTime + timeOffset + 0.25);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, startTime + timeOffset + 0.25);
      gain2.gain.setValueAtTime(0, startTime + timeOffset + 0.25);
      gain2.gain.linearRampToValueAtTime(0.35, startTime + timeOffset + 0.25 + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + timeOffset + 0.25 + 0.22);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(startTime + timeOffset + 0.25);
      osc2.stop(startTime + timeOffset + 0.25 + 0.25);
    }
  } catch (e) {
    console.error("Failed to play dynamic synthesized rest alarm:", e);
  }
}

export function handleRestTimerExpiration() {
  if (state.restTimerInterval) {
    clearInterval(state.restTimerInterval);
    state.restTimerInterval = null;
  }
  SafeStorage.removeItem('aura-rest-timer-end-time');

  const bubble = document.getElementById('rest-timer-bubble');
  if (bubble) {
    bubble.classList.add('expired');
  }

  // Play alarm sound synthesize
  playRestAlarmSynth();

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    triggerLocalNotification("המנוחה נגמרה! ⏱️💪", "הגיע הזמן לסט הבא. קדימה, לעבודה!");
  }

  // Fallback / Reinforcement visual toast to guarantee visibility
  showPremiumToast("המנוחה נגמרה! הגיע הזמן לסט הבא! ⏱️💪", "success");

  if (navigator.vibrate) {
    navigator.vibrate([300, 150, 300, 150, 300]);
  }

  // Automatically dismiss the rest timer bubble and return to the workout screen after 5 seconds
  setTimeout(() => {
    const currentBubble = document.getElementById('rest-timer-bubble');
    if (currentBubble && currentBubble.classList.contains('expired')) {
      stopRestTimer();
    }
  }, 5000);
}

// SET LOGGING MODAL
export function openSetLoggingModal(ex) {
  state.currentLoggingExercise = ex;

  const nextIncompleteIdx = ex.sets.findIndex(s => !s.completed);
  state.currentLoggingSetIndex = nextIncompleteIdx !== -1 ? nextIncompleteIdx : ex.sets.length;

  const nameDisplay = document.getElementById('set-log-exercise-name');
  const setNumDisplay = document.getElementById('set-log-set-number');
  if (nameDisplay) nameDisplay.textContent = ex.name;
  if (setNumDisplay) setNumDisplay.textContent = `סט ${state.currentLoggingSetIndex + 1}`;

  const weightGroup = document.getElementById('set-log-weight-group');
  const repsGroup = document.getElementById('set-log-reps-group');
  const timeGroup = document.getElementById('set-log-time-group');
  const metrics = getExerciseMetrics(ex);

  if (weightGroup) {
    if (metrics.includes('weight')) {
      weightGroup.classList.remove('slider-group-hidden');
    } else {
      weightGroup.classList.add('slider-group-hidden');
    }
  }
  if (repsGroup) {
    if (metrics.includes('reps')) {
      repsGroup.classList.remove('slider-group-hidden');
    } else {
      repsGroup.classList.add('slider-group-hidden');
    }
  }
  if (timeGroup) {
    if (metrics.includes('time')) {
      timeGroup.classList.remove('slider-group-hidden');
    } else {
      timeGroup.classList.add('slider-group-hidden');
    }
  }

  const completedSets = ex.sets.filter(s => s.completed);
  const previousSet = completedSets[completedSets.length - 1];

  let initialWeight = 60;
  let initialReps = 10;
  let initialTime = 30;

  if (previousSet) {
    initialWeight = parseFloat(previousSet.weight) || 60;
    initialReps = parseInt(previousSet.reps, 10) || 10;
    initialTime = parseInt(previousSet.time, 10) || 30;
  }

  const weightSlider = document.getElementById('weight-range-slider');
  const weightValueText = document.getElementById('weight-slider-value');
  const repsSlider = document.getElementById('reps-range-slider');
  const repsValueText = document.getElementById('reps-slider-value');
  const timeSlider = document.getElementById('time-range-slider');
  const timeValueText = document.getElementById('time-slider-value');

  if (weightSlider) {
    weightSlider.value = initialWeight;
    if (weightValueText) weightValueText.textContent = initialWeight;
  }
  if (repsSlider) {
    repsSlider.value = initialReps;
    if (repsValueText) repsValueText.textContent = initialReps;
  }
  if (timeSlider) {
    timeSlider.value = initialTime;
    if (timeValueText) timeValueText.textContent = initialTime;
  }

  const setLogModal = document.getElementById('set-log-modal');
  if (setLogModal) {
    setLogModal.classList.remove('hide');
  }
}

// PLATE CALCULATOR
export function calculatePlates(targetWeight) {
  const displayTarget = document.getElementById('plate-calc-target-weight');
  if (displayTarget) displayTarget.textContent = targetWeight;

  const stack = document.getElementById('plates-stack-left');
  const list = document.getElementById('plates-list-needed');

  if (stack) stack.innerHTML = '';
  if (list) list.innerHTML = '';

  const bar = 20;
  if (targetWeight <= bar) {
    if (list) list.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">מוט ריק בלבד (20 ק״ג) 🏋️‍♂️</span>';
    return;
  }

  let weightPerSide = (targetWeight - bar) / 2;
  const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
  const needed = [];

  let temp = weightPerSide;
  for (const p of plates) {
    const count = Math.floor(temp / p);
    if (count > 0) {
      needed.push({ weight: p, count: count });
      temp = Math.round((temp - p * count) * 100) / 100;
    }
  }

  if (needed.length === 0) {
    if (list) list.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">אין שילוב פלטות מתאים</span>';
    return;
  }

  needed.forEach(item => {
    const chip = document.createElement('span');
    chip.className = 'plate-chip';
    chip.textContent = `${item.weight} ק״ג × ${item.count}`;
    if (list) list.appendChild(chip);
  });

  const colors = {
    25: '#dc2626',
    20: '#2563eb',
    15: '#eab308',
    10: '#16a34a',
    5: '#94a3b8',
    2.5: '#475569',
    1.25: '#1e293b'
  };

  const heights = { 25: 86, 20: 80, 15: 72, 10: 62, 5: 50, 2.5: 42, 1.25: 34 };
  const widths = { 25: 18, 20: 16, 15: 14, 10: 12, 5: 10, 2.5: 8, 1.25: 6 };

  needed.forEach(item => {
    for (let i = 0; i < item.count; i++) {
      const plate = document.createElement('div');
      const h = heights[item.weight] || 40;
      const w = widths[item.weight] || 8;
      const c = colors[item.weight] || '#ffffff';

      plate.style.cssText = `
        width: ${w}px;
        height: ${h}px;
        background: ${c};
        border-radius: 4px;
        box-shadow: 0 0 8px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.25);
        border: 1px solid rgba(0, 0, 0, 0.4);
        transition: transform 0.2s ease;
      `;
      plate.title = `${item.weight} ק״ג`;
      if (stack) stack.appendChild(plate);
    }
  });
}

// ACCORDION HISTORIC LOG EDITOR SYSTEM
export function openEditModal(workoutId) {
  const original = state.workoutHistory.find(w => String(w.id) === String(workoutId));
  const editModal = document.getElementById('workout-edit-modal');
  if (!original || !editModal) return;
  
  state.editingWorkout = JSON.parse(JSON.stringify(original));
  
  const metaContainer = document.getElementById('modal-workout-meta');
  if (metaContainer) {
    const dateObj = new Date(state.editingWorkout.date);
    const dateText = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
    
    let durationText = '';
    if (state.editingWorkout.duration < 60) {
      durationText = 'פחות מדקה';
    } else if (state.editingWorkout.duration < 3600) {
      durationText = `${Math.floor(state.editingWorkout.duration / 60)} דקות`;
    } else {
      const hrs = Math.floor(state.editingWorkout.duration / 3600);
      const mins = Math.floor((state.editingWorkout.duration % 3600) / 60);
      durationText = `${hrs} שעות ו-${mins} דק׳`;
    }
    
    const dispName = state.editingWorkout.locationName || (state.editingWorkout.location === 'gym' ? 'חדר כושר' : 'פארק');
    const dispEmoji = state.editingWorkout.locationEmoji || (state.editingWorkout.location === 'gym' ? '🏋️‍♂️' : '🌳');
    metaContainer.innerHTML = `
      <div>📍 <strong>${escapeHTML(dispEmoji)} ${escapeHTML(dispName)}</strong></div>
      <div>⏱️ משך: <strong>${durationText}</strong></div>
      <div>📅 תאריך: <strong>${dateText}</strong></div>
    `;
  }
  
  renderModalExercises();
  
  editModal.classList.remove('hide');
}

export function renderModalExercises() {
  const container = document.getElementById('modal-exercises-container');
  if (!container || !state.editingWorkout) return;
  
  container.innerHTML = '';
  
  state.editingWorkout.exercises.forEach((ex, exIdx) => {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.style.background = 'rgba(255, 255, 255, 0.03)';
    
    const header = document.createElement('div');
    header.className = 'exercise-card-header';
    
    const titleContainer = document.createElement('div');
    titleContainer.className = 'exercise-title-container';
    
    const removeExBtn = document.createElement('button');
    removeExBtn.className = 'remove-exercise-btn';
    removeExBtn.innerHTML = '🗑️';
    removeExBtn.addEventListener('click', () => {
      state.editingWorkout.exercises.splice(exIdx, 1);
      renderModalExercises();
    });
    titleContainer.appendChild(removeExBtn);
    
    // Create a beautiful select dropdown to swap exercises
    const nameSelect = document.createElement('select');
    nameSelect.className = 'exercise-name-select';
    
    const allExs = getAllExercises();
    const uniqueNames = Array.from(new Set(allExs.map(item => item.name)));
    
    // Ensure the current name is in the list
    if (!uniqueNames.includes(ex.name)) {
      uniqueNames.unshift(ex.name);
    }
    
    uniqueNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === ex.name) opt.selected = true;
      nameSelect.appendChild(opt);
    });
    
    // Custom option
    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '✍️ שם מותאם אישית...';
    nameSelect.appendChild(customOpt);
    
    // Create hidden text input for custom name
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'exercise-name-input';
    nameInput.placeholder = 'הזן שם מותאם אישית';
    nameInput.value = ex.name;
    nameInput.style.cssText = 'flex: 1; padding: 8px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #fff; font-size: 0.95rem; outline: none; display: none;';
    
    nameSelect.addEventListener('change', (e) => {
      if (e.target.value === '__custom__') {
        nameInput.style.display = 'block';
        nameInput.value = '';
        nameInput.focus();
      } else {
        nameInput.style.display = 'none';
        ex.name = e.target.value;
        const found = allExs.find(item => item.name === ex.name);
        if (found) {
          ex.category = found.category || ex.category;
          ex.emoji = found.emoji || ex.emoji;
        }
      }
    });
    
    nameInput.addEventListener('input', (e) => {
      ex.name = e.target.value;
    });
    
    titleContainer.appendChild(nameSelect);
    titleContainer.appendChild(nameInput);
    header.appendChild(titleContainer);
    
    card.appendChild(header);
    
    const setsArea = document.createElement('div');
    setsArea.className = 'sets-area';
    
    const metrics = getExerciseMetrics(ex);
    const gridStyle = `display: grid; grid-template-columns: 36px repeat(${metrics.length}, 1fr) 48px; gap: 8px; align-items: center; justify-items: center; text-align: center;`;

    const setsHeader = document.createElement('div');
    setsHeader.className = 'sets-header-row';
    setsHeader.style.cssText = gridStyle;
    
    let headerHtml = '<div>מחק</div>';
    if (metrics.includes('weight')) headerHtml += '<div>משקל</div>';
    if (metrics.includes('reps')) headerHtml += '<div>חזרות</div>';
    if (metrics.includes('time')) headerHtml += '<div>זמן</div>';
    headerHtml += '<div>סט</div>';
    setsHeader.innerHTML = headerHtml;
    setsArea.appendChild(setsHeader);
    
    ex.sets.forEach((set, setIdx) => {
      const setRow = document.createElement('div');
      setRow.className = 'set-row completed';
      setRow.style.cssText = gridStyle;
      
      const removeSetBtn = document.createElement('button');
      removeSetBtn.className = 'remove-set-btn';
      removeSetBtn.innerHTML = '✕';
      removeSetBtn.addEventListener('click', () => {
        if (ex.sets.length > 1) {
          ex.sets.splice(setIdx, 1);
          renderModalExercises();
        } else {
          alert('תרגיל חייב להכיל לפחות סט אחד.');
        }
      });
      setRow.appendChild(removeSetBtn);
      
      if (metrics.includes('weight')) {
        const weightWrapper = document.createElement('div');
        weightWrapper.className = 'set-input-wrapper';
        const weightInput = document.createElement('input');
        weightInput.type = 'number';
        weightInput.className = 'set-input';
        weightInput.value = set.weight;
        weightInput.addEventListener('input', (e) => {
          set.weight = e.target.value;
        });
        weightWrapper.appendChild(weightInput);
        setRow.appendChild(weightWrapper);
      }
      
      if (metrics.includes('reps')) {
        const repsWrapper = document.createElement('div');
        repsWrapper.className = 'set-input-wrapper';
        const repsInput = document.createElement('input');
        repsInput.type = 'number';
        repsInput.className = 'set-input';
        repsInput.value = set.reps;
        repsInput.addEventListener('input', (e) => {
          set.reps = e.target.value;
        });
        repsWrapper.appendChild(repsInput);
        setRow.appendChild(repsWrapper);
      }

      if (metrics.includes('time')) {
        const timeWrapper = document.createElement('div');
        timeWrapper.className = 'set-input-wrapper';
        const timeInput = document.createElement('input');
        timeInput.type = 'number';
        timeInput.className = 'set-input';
        timeInput.value = set.time || '';
        timeInput.addEventListener('input', (e) => {
          set.time = e.target.value;
        });
        timeWrapper.appendChild(timeInput);
        setRow.appendChild(timeWrapper);
      }
      
      const setLabelWrapper = document.createElement('div');
      setLabelWrapper.className = 'set-input-wrapper';
      const setLabel = document.createElement('span');
      setLabel.className = 'set-number-label';
      setLabel.textContent = String(setIdx + 1);
      setLabelWrapper.appendChild(setLabel);
      setRow.appendChild(setLabelWrapper);
      
      setsArea.appendChild(setRow);
    });
    
    const addSetBtn = document.createElement('button');
    addSetBtn.className = 'add-set-btn';
    addSetBtn.textContent = '➕ הוסף סט';
    addSetBtn.addEventListener('click', () => {
      const lastSet = ex.sets[ex.sets.length - 1];
      ex.sets.push({
        reps: lastSet ? lastSet.reps : '',
        weight: lastSet ? lastSet.weight : '',
        time: lastSet ? lastSet.time : '',
        completed: true
      });
      renderModalExercises();
    });
    setsArea.appendChild(addSetBtn);
    
    card.appendChild(setsArea);
    container.appendChild(card);
  });
  
  const addExBtn = document.createElement('button');
  addExBtn.className = 'btn btn-secondary';
  addExBtn.style.width = '100%';
  addExBtn.style.marginTop = '10px';
  addExBtn.textContent = '➕ הוסף תרגיל חדש';
  addExBtn.addEventListener('click', () => {
    state.editingWorkout.exercises.push({
      id: Date.now(),
      name: '',
      completed: true,
      sets: [{ reps: '', weight: '', completed: true }]
    });
    renderModalExercises();
  });
  container.appendChild(addExBtn);
}

export function deleteWorkoutFromHistory(workoutId) {
  if (!state.currentUser) return;
  
  state.workoutHistory = state.workoutHistory.filter(w => String(w.id) !== String(workoutId));
  SafeStorage.setItem(`aura-workout-history_${state.currentUser.uid}`, JSON.stringify(state.workoutHistory));
  saveFieldToCloud("workoutHistory", state.workoutHistory);
  
  if (window.renderWorkoutHistory) window.renderWorkoutHistory();
  
  const editModal = document.getElementById('workout-edit-modal');
  if (editModal) editModal.classList.add('hide');
  state.editingWorkout = null;
}

// ==========================================================================
// Location-Based GPS Run/Walk Tracker Logic
// ==========================================================================

let runTrackerMap = null;
let runPolylines = [];
let userMarker = null;
let gpsWatchId = null;
let telemetryTimerId = null;
let telemetryLastTickAt = null;
let telemetryCarryMs = 0;
let wakeLock = null;

// Readings less accurate than this (in metres) are treated as drift and discarded.
const GPS_ACCURACY_LIMIT_M = 50;
let silentAudioPlayer = null;

function showGPSDiagnosticModal() {
  const modal = document.getElementById('gps-diagnostic-modal');
  if (modal) {
    modal.classList.remove('hide');
    modal.classList.add('active');
  }
}

async function triggerGPSAlertInbox(title, content) {
  const uid = state.currentUser ? state.currentUser.uid : 'guest';
  const localMessages = JSON.parse(SafeStorage.getItem(`aura-messages_${uid}`) || "[]");
  
  const alertId = 'gps-error-alert';
  // Check if there is already an unread GPS error message in localMessages
  const hasUnread = localMessages.some(m => m.id === alertId && !m.read);
  if (hasUnread) return; // Don't spam the inbox
  
  const newMessage = {
    id: alertId,
    title: `⚠️ ${title}`,
    content: `${content}\n\nהנחיות לפתרון:\n1. באייפון: הגדרות ➔ פרטיות ➔ שירותי מיקום ➔ אתרי Safari ➔ אפשר בעת השימוש.\n2. באנדרואיד: הגדרות ➔ יישומים ➔ כרום ➔ הרשאות ➔ מיקום ➔ אפשר.`,
    date: Date.now(),
    read: false
  };
  
  // Prepend the message
  const updated = [newMessage, ...localMessages.filter(m => m.id !== alertId)]; // Remove old to keep only one fresh one
  state.userMessages = updated;
  SafeStorage.setItem(`aura-messages_${uid}`, JSON.stringify(updated));
  
  if (state.currentUser && state.cloudSyncEnabled && state.cloudSyncToggles?.messages !== false) {
    const { saveFieldToCloud } = await import("../utils/db.js");
    await saveFieldToCloud('messages', updated);
  }
  
  // Update UI
  if (window.updateAdminUI) window.updateAdminUI();
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
}

function startSilentAudioBackgroundLoop() {
  if (silentAudioPlayer) {
    silentAudioPlayer.play().catch(e => {
      console.warn("silentAudioPlayer play error:", e);
    });
    return;
  }
  const silenceBase64 = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
  silentAudioPlayer = new Audio(silenceBase64);
  silentAudioPlayer.loop = true;
  silentAudioPlayer.play().catch(e => {
    console.warn("Silent audio autoplay blocked. Adding one-time interaction listener.", e);
    const playOnGesture = () => {
      if (silentAudioPlayer) {
        silentAudioPlayer.play().catch(err => console.warn("Interactive play failed:", err));
      }
      document.removeEventListener('click', playOnGesture);
      document.removeEventListener('touchstart', playOnGesture);
    };
    document.addEventListener('click', playOnGesture);
    document.addEventListener('touchstart', playOnGesture);
  });
}

function stopSilentAudioBackgroundLoop() {
  if (silentAudioPlayer) {
    silentAudioPlayer.pause();
    silentAudioPlayer = null;
  }
}

// Haversine formula to compute distance in meters between two coordinates
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Request screen wake lock to keep screen active during tracking
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      // The OS drops the lock silently when the page is hidden. Without this listener
      // the sentinel stays non-null forever and it is never re-acquired.
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
        console.log('Wake Lock was released by the system');
      });
      console.log('Wake Lock acquired');
    }
  } catch (err) {
    console.warn(`Wake Lock error: ${err.name}, ${err.message}`);
  }
}

// The OS silently releases the wake lock whenever the page is hidden, so re-acquire
// it when the user comes back while a run is still being tracked.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.isTrackingRun && wakeLock === null) {
    requestWakeLock();
  }
});

// Release screen wake lock
function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      wakeLock = null;
      console.log('Wake Lock released');
    }).catch(err => {
      wakeLock = null;
      console.warn('Wake Lock release failed:', err);
    });
  }
}

// Initialize Leaflet Map
function initTrackerMap() {
  const mapContainer = document.getElementById('run-tracker-map');
  if (!mapContainer) return;

  if (typeof L === 'undefined') {
    console.warn("Leaflet.js is not loaded - the run map will stay empty, tracking still works.");
    mapContainer.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-muted); font-size:0.85rem; text-align:center; padding:12px; direction:rtl;">המפה לא נטענה (אין חיבור לרשת). המעקב ממשיך לפעול כרגיל.</div>';
    return;
  }

  if (!runTrackerMap) {
    // Center map on Israel [31.5, 34.8] with zoom level 8
    runTrackerMap = L.map('run-tracker-map', {
      zoomControl: true
    }).setView([31.5, 34.8], 8);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(runTrackerMap);
  }

  // Quick location fetch to center the map on the user's neighborhood immediately if no segments coords recorded yet
  const hasNoCoords = !state.runTrackerSegments || state.runTrackerSegments.length === 0 || !state.runTrackerSegments.some(s => s.coords && s.coords.length > 0);
  if (hasNoCoords && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (runTrackerMap && hasNoCoords) {
          runTrackerMap.setView([latitude, longitude], 16);
        }
      },
      (error) => {
        console.warn("Quick location fetch failed:", error);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
    );
  }

  // Invalidate map size so it renders correctly inside the visible modal (multiple intervals to cover modal animation)
  setTimeout(() => {
    if (runTrackerMap) runTrackerMap.invalidateSize();
  }, 100);
  setTimeout(() => {
    if (runTrackerMap) runTrackerMap.invalidateSize();
  }, 300);
  setTimeout(() => {
    if (runTrackerMap) runTrackerMap.invalidateSize();
  }, 600);
}

// Draw all segments as polylines on the map and update the user's location marker
function drawSegmentsOnMap() {
  if (!runTrackerMap) return;

  // Clear existing polylines
  runPolylines.forEach(layer => runTrackerMap.removeLayer(layer));
  runPolylines = [];

  // Draw segments
  state.runTrackerSegments.forEach(segment => {
    if (segment.coords && segment.coords.length > 1) {
      let color = '#ef4444'; // Run - Red
      if (segment.state === 'walk') color = '#10b981'; // Walk - Green
      else if (segment.state === 'rest') color = '#f59e0b'; // Rest - Yellow

      const polyline = L.polyline(segment.coords, {
        color: color,
        weight: 6,
        opacity: 0.85,
        lineJoin: 'round'
      }).addTo(runTrackerMap);
      
      runPolylines.push(polyline);
    }
  });

  // Update user marker
  if (userMarker) {
    runTrackerMap.removeLayer(userMarker);
    userMarker = null;
  }

  const lastCoord = getLastCoordinate();
  if (lastCoord) {
    // Pulsing user marker in AuraApp's electric blue theme
    const gpsIcon = L.divIcon({
      className: 'gps-pulse-marker-container',
      html: '<div class="gps-pulse-marker"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    userMarker = L.marker(lastCoord, { icon: gpsIcon }).addTo(runTrackerMap);
  }
}

// Find the last coordinate of the tracking session
function getLastCoordinate() {
  for (let i = state.runTrackerSegments.length - 1; i >= 0; i--) {
    const coords = state.runTrackerSegments[i].coords;
    if (coords && coords.length > 0) {
      return coords[coords.length - 1];
    }
  }
  return null;
}

// Start GPS watching
function startGPSWatcher() {
  if (gpsWatchId) {
    navigator.geolocation.clearWatch(gpsWatchId);
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  };

  gpsWatchId = navigator.geolocation.watchPosition(
    (position) => {
      handleGPSReading(position);
    },
    (error) => {
      console.warn("watchPosition error:", error);
      if (error.code === 1) { // PERMISSION_DENIED
        triggerGPSAlertInbox("גישת GPS נדחתה על ידי המשתמש", "האפליקציה ניסתה לגשת למיקומך אך הבקשה נדחתה. יש לאפשר גישה בהגדרות הדפדפן או המכשיר.");
        showGPSDiagnosticModal();
      } else if (error.code === 2) { // POSITION_UNAVAILABLE
        triggerGPSAlertInbox("אות GPS לא זמין", "רכיב המיקום במכשיר אינו מצליח לקבל קליטת לוויינים תקינה. ודא שאתה תחת שמיים פתוחים ושירותי המיקום מופעלים במכשיר.");
        showGPSDiagnosticModal();
      }
    },
    options
  );

  state.runWatchPositionId = gpsWatchId;
}

// Stop GPS watching
function stopGPSWatcher() {
  if (gpsWatchId) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
    state.runWatchPositionId = null;
  }
}

// Handle new coordinate reading from GPS
function handleGPSReading(position) {
  const { latitude, longitude, accuracy } = position.coords;

  // Filter GPS drift. 20m rejected almost every reading on a normal phone in a city
  // (typical urban accuracy is 20-65m), so distance stayed at 0 for most users.
  if (accuracy > GPS_ACCURACY_LIMIT_M) {
    console.log("GPS accuracy too poor, ignoring:", accuracy);
    return;
  }

  if (state.isTrackingRun && !state.isRunPaused) {
    const lat = latitude;
    const lng = longitude;
    const newCoord = [lat, lng];

    let activeSegment = state.runTrackerSegments[state.runTrackerSegments.length - 1];
    if (!activeSegment || activeSegment.endTime !== null) {
      activeSegment = {
        state: state.runTrackerState,
        coords: [],
        startTime: Date.now(),
        endTime: null
      };
      state.runTrackerSegments.push(activeSegment);
    }

    const lastCoord = getLastCoordinate();
    let dist = 0;
    let shouldAccumulate = false;

    if (lastCoord) {
      dist = haversine(lastCoord[0], lastCoord[1], lat, lng);
      // Filter GPS noise: only accumulate if distance >= 2.5m
      if (dist >= 2.5) {
        shouldAccumulate = true;
      }
    } else {
      // First point is always saved
      shouldAccumulate = true;
    }

    if (shouldAccumulate) {
      activeSegment.coords.push(newCoord);

      if (lastCoord) {
        // Accumulate distance in metrics (meters)
        state.runTrackerMetrics.totalDistance += dist;
        if (state.runTrackerState === "run") {
          state.runTrackerMetrics.runDistance += dist;
        } else if (state.runTrackerState === "walk") {
          state.runTrackerMetrics.walkDistance += dist;
        }
      }

      // Draw map segments
      drawSegmentsOnMap();

      // Center map on new coordinate
      if (runTrackerMap) {
        runTrackerMap.setView(newCoord, 16);
      }

      // Save run state to LocalStorage for data loss prevention
      saveRunSessionState();

      // Refresh telemetry UI
      updateTrackerUI();
    }
  }
}

// Switch between Run / Walk / Rest states
export function switchTrackerState(newState) {
  if (!state.isTrackingRun) return;
  if (state.runTrackerState === newState) return;

  // End current segment
  const activeSegment = state.runTrackerSegments[state.runTrackerSegments.length - 1];
  if (activeSegment) {
    activeSegment.endTime = Date.now();
  }

  // Set new state
  state.runTrackerState = newState;

  // Start new segment
  const newSegment = {
    state: newState,
    coords: [],
    startTime: Date.now(),
    endTime: null
  };
  state.runTrackerSegments.push(newSegment);

  // Speech syntheses voice announcement in Hebrew
  speakStateHebrew(newState);

  // Haptic feedback
  if (navigator.vibrate) {
    navigator.vibrate([200]);
  }

  // Update classes
  updateSwitcherUI();

  // Save tracking state
  saveRunSessionState();
}

// Speech syntheses helper
function speakStateHebrew(stateName) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    
    let text = "";
    if (stateName === "run") text = "ריצה";
    else if (stateName === "walk") text = "הליכה";
    else if (stateName === "rest") text = "מנוחה";

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'he-IL';
    
    const voices = window.speechSynthesis.getVoices();
    const heVoice = voices.find(v => v.lang.includes('he') || v.lang.includes('HE'));
    if (heVoice) {
      utterance.voice = heVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  }
}

// Update UI classes for switcher
function updateSwitcherUI() {
  const btnRun = document.getElementById('run-state-btn-run');
  const btnWalk = document.getElementById('run-state-btn-walk');
  const btnRest = document.getElementById('run-state-btn-rest');

  if (btnRun) btnRun.classList.remove('run-state-active-run');
  if (btnWalk) btnWalk.classList.remove('run-state-active-walk');
  if (btnRest) btnRest.classList.remove('run-state-active-rest');

  if (state.runTrackerState === "run" && btnRun) {
    btnRun.classList.add('run-state-active-run');
  } else if (state.runTrackerState === "walk" && btnWalk) {
    btnWalk.classList.add('run-state-active-walk');
  } else if (state.runTrackerState === "rest" && btnRest) {
    btnRest.classList.add('run-state-active-rest');
  }
}

// Start telemetry counter interval
function startTelemetryTimer() {
  if (telemetryTimerId) {
    clearInterval(telemetryTimerId);
  }

  // Measure elapsed wall-clock time rather than counting ticks: browsers throttle
  // timers heavily once the app is backgrounded or the screen is off, which used to
  // make recorded durations (and therefore pace) far shorter than reality.
  telemetryLastTickAt = Date.now();
  telemetryCarryMs = 0;

  telemetryTimerId = setInterval(() => {
    const now = Date.now();
    let deltaMs = now - telemetryLastTickAt;
    telemetryLastTickAt = now;

    if (deltaMs < 0) deltaMs = 0; // clock moved backwards (NTP correction)

    if (!state.isTrackingRun || state.isRunPaused) {
      telemetryCarryMs = 0;
      return;
    }

    // Carry the sub-second remainder forward instead of rounding it away, otherwise a
    // consistently late timer (busy main thread, backgrounded tab) loses ~30% of the
    // elapsed time and the derived pace comes out wrong.
    telemetryCarryMs += deltaMs;
    const elapsed = Math.floor(telemetryCarryMs / 1000);
    if (elapsed <= 0) return;
    telemetryCarryMs -= elapsed * 1000;

    state.runTrackerMetrics.totalDuration += elapsed;

    if (state.runTrackerState === "run") {
      state.runTrackerMetrics.runDuration += elapsed;
    } else if (state.runTrackerState === "walk") {
      state.runTrackerMetrics.walkDuration += elapsed;
    } else if (state.runTrackerState === "rest") {
      state.runTrackerMetrics.restDuration += elapsed;
    }

    updateTrackerUI();
    saveRunSessionState();
  }, 1000);
}

// Stop telemetry counter interval
function stopTelemetryTimer() {
  if (telemetryTimerId) {
    clearInterval(telemetryTimerId);
    telemetryTimerId = null;
  }
  telemetryLastTickAt = null;
  telemetryCarryMs = 0;
}

// Helper to format Pace (min/km)
function formatPace(totalDurationSeconds, totalDistanceMeters) {
  if (!totalDistanceMeters || totalDistanceMeters < 5) return "--:--";
  const distanceKm = totalDistanceMeters / 1000;
  const totalMinutes = totalDurationSeconds / 60;
  const paceDec = totalMinutes / distanceKm;

  const mins = Math.floor(paceDec);
  const secs = Math.floor((paceDec - mins) * 60);

  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Helper to calculate Speed (km/h)
function calculateSpeed(totalDurationSeconds, totalDistanceMeters) {
  if (!totalDurationSeconds || !totalDistanceMeters) return "0.0";
  const distanceKm = totalDistanceMeters / 1000;
  const hours = totalDurationSeconds / 3600;
  const speed = distanceKm / hours;
  return speed.toFixed(1);
}

// Format duration to HH:MM:SS
function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (num) => String(num).padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

// Sync all telemetry displays in the run tracker modal
function updateTrackerUI() {
  const totalDistEl = document.getElementById('run-metric-total-dist');
  const paceEl = document.getElementById('run-metric-pace');
  const speedEl = document.getElementById('run-metric-speed');
  const runDistEl = document.getElementById('run-metric-run-dist');
  const walkDistEl = document.getElementById('run-metric-walk-dist');
  
  const totalTimeEl = document.getElementById('run-metric-total-time');
  const runTimeEl = document.getElementById('run-metric-run-time');
  const walkTimeEl = document.getElementById('run-metric-walk-time');
  const restTimeEl = document.getElementById('run-metric-rest-time');

  const metrics = state.runTrackerMetrics;

  if (totalDistEl) totalDistEl.textContent = (metrics.totalDistance / 1000).toFixed(2);
  if (paceEl) paceEl.textContent = formatPace(metrics.totalDuration, metrics.totalDistance);
  if (speedEl) speedEl.textContent = calculateSpeed(metrics.totalDuration, metrics.totalDistance);
  if (runDistEl) runDistEl.textContent = (metrics.runDistance / 1000).toFixed(2);
  if (walkDistEl) walkDistEl.textContent = (metrics.walkDistance / 1000).toFixed(2);

  if (totalTimeEl) totalTimeEl.textContent = formatDuration(metrics.totalDuration);
  if (runTimeEl) runTimeEl.textContent = formatDuration(metrics.runDuration);
  if (walkTimeEl) walkTimeEl.textContent = formatDuration(metrics.walkDuration);
  if (restTimeEl) restTimeEl.textContent = formatDuration(metrics.restDuration);

  updateSwitcherUI();

  const pauseBtn = document.getElementById('run-control-pause');
  const resumeBtn = document.getElementById('run-control-resume');

  if (pauseBtn && resumeBtn) {
    if (state.isRunPaused) {
      pauseBtn.classList.add('hide');
      resumeBtn.classList.remove('hide');
    } else {
      pauseBtn.classList.remove('hide');
      resumeBtn.classList.add('hide');
    }
  }
}

// Start a new tracking session
export function startTrackingSession() {
  if (state.currentUser) {
    state.isTrackingRun = true;
    state.runTrackerState = "run";
    state.isRunPaused = false;
    state.runTrackerSegments = [{
      state: "run",
      coords: [],
      startTime: Date.now(),
      endTime: null
    }];
    state.runTrackerMetrics = {
      totalDistance: 0,
      runDistance: 0,
      walkDistance: 0,
      totalDuration: 0,
      runDuration: 0,
      walkDuration: 0,
      restDuration: 0
    };

    saveRunSessionState();
    startGPSWatcher();
    startTelemetryTimer();
    updateTrackerUI();
    drawSegmentsOnMap();
    startSilentAudioBackgroundLoop();
  }
}

// Save active session tracking parameters to localStorage
function saveRunSessionState() {
  if (state.currentUser) {
    const uid = state.currentUser.uid;
    const session = {
      isTrackingRun: state.isTrackingRun,
      runTrackerState: state.runTrackerState,
      runTrackerSegments: state.runTrackerSegments,
      runTrackerMetrics: state.runTrackerMetrics,
      activeRunExerciseIndex: state.activeRunExerciseIndex,
      isRunPaused: state.isRunPaused
    };
    SafeStorage.setItem(`aura-active-run-session_${uid}`, JSON.stringify(session));
  }
}

// Pause tracking session
export function pauseTracking() {
  state.isRunPaused = true;
  stopTelemetryTimer();

  const activeSegment = state.runTrackerSegments[state.runTrackerSegments.length - 1];
  if (activeSegment) {
    activeSegment.endTime = Date.now();
  }

  saveRunSessionState();
  updateTrackerUI();
  stopSilentAudioBackgroundLoop();
}

// Resume tracking session
export function resumeTracking() {
  state.isRunPaused = false;

  const newSegment = {
    state: state.runTrackerState,
    coords: [],
    startTime: Date.now(),
    endTime: null
  };
  state.runTrackerSegments.push(newSegment);

  startTelemetryTimer();
  saveRunSessionState();
  updateTrackerUI();
  startSilentAudioBackgroundLoop();
}

// Save run session details to current active exercise sets and exit modal
export function finishAndSaveRun() {
  stopGPSWatcher();
  releaseWakeLock();
  stopTelemetryTimer();
  stopSilentAudioBackgroundLoop();

  if (state.activeWorkout && state.activeWorkout.exercises && state.activeRunExerciseIndex !== null) {
    const ex = state.activeWorkout.exercises[state.activeRunExerciseIndex];
    if (ex) {
      const specializedSet = {
        completed: true,
        distance: state.runTrackerMetrics.totalDistance,
        time: state.runTrackerMetrics.totalDuration,
        runDistance: state.runTrackerMetrics.runDistance,
        walkDistance: state.runTrackerMetrics.walkDistance,
        runDuration: state.runTrackerMetrics.runDuration,
        walkDuration: state.runTrackerMetrics.walkDuration,
        restDuration: state.runTrackerMetrics.restDuration,
        segments: JSON.parse(JSON.stringify(state.runTrackerSegments))
      };

      ex.sets = ex.sets || [];
      ex.sets = [specializedSet];
      ex.completed = true;

      saveActiveWorkoutState();
    }
  }

  state.isTrackingRun = false;
  state.isRunPaused = false;
  state.activeRunExerciseIndex = null;
  state.runTrackerSegments = [];

  if (userMarker) {
    if (runTrackerMap) runTrackerMap.removeLayer(userMarker);
    userMarker = null;
  }
  state.runTrackerMetrics = {
    totalDistance: 0,
    runDistance: 0,
    walkDistance: 0,
    totalDuration: 0,
    runDuration: 0,
    walkDuration: 0,
    restDuration: 0
  };

  if (state.currentUser) {
    const uid = state.currentUser.uid;
    SafeStorage.removeItem(`aura-active-run-session_${uid}`);
  }

  const closeBtn = document.getElementById('close-run-tracker-btn');
  if (closeBtn) {
    closeBtn.style.display = 'block';
  }

  const modal = document.getElementById('run-tracker-modal');
  if (modal) {
    modal.classList.add('hide');
    modal.classList.remove('active');
  }

  renderExercises();
}

// Open Run Tracker Modal
export async function openRunTrackerModal(exercise) {
  // Check if Geolocation is supported
  if (!navigator.geolocation) {
    triggerGPSAlertInbox("רכיב מיקום (GPS) אינו נתמך בדפדפן זה.", "הדפדפן שלך אינו תומך בגישה לשירותי מיקום. אנא פתח את האפליקציה בדפדפן מודרני (Chrome באנדרואיד או Safari ב-iOS).");
    showGPSDiagnosticModal();
    return;
  }

  // Try to check using Permissions API if available (Chrome/Firefox/Safari 16+)
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
      if (permissionStatus.state === 'denied') {
        triggerGPSAlertInbox("גישת GPS חסומה", "חסמת את הרשאת הגישה למיקום עבור Aura. כדי להשתמש במעקב הריצה, אנא פעל לפי ההוראות בהגדרות המכשיר לאישור הגישה למיקום.");
        showGPSDiagnosticModal();
        return;
      }
    } catch (err) {
      console.warn("Permissions API query failed:", err);
    }
  }

  const modal = document.getElementById('run-tracker-modal');
  if (!modal) return;

  if (state.activeWorkout && exercise) {
    const idx = state.activeWorkout.exercises.indexOf(exercise);
    state.activeRunExerciseIndex = idx;
  }

  modal.classList.remove('hide');
  modal.classList.add('active');

  initTrackerMap();
  requestWakeLock();

  if (state.isTrackingRun) {
    drawSegmentsOnMap();
    updateTrackerUI();
    const lastCoord = getLastCoordinate();
    if (lastCoord && runTrackerMap) {
      runTrackerMap.setView(lastCoord, 16);
    }
  } else {
    startTrackingSession();
  }

  // Update close button visibility (hide when tracking, show when not)
  const closeBtn = document.getElementById('close-run-tracker-btn');
  if (closeBtn) {
    closeBtn.style.display = state.isTrackingRun ? 'none' : 'block';
  }
}

// Close Run Tracker Modal
export function closeRunTrackerModal() {
  if (state.isTrackingRun) {
    console.log("Cannot close modal: tracking is active.");
    return;
  }
  const modal = document.getElementById('run-tracker-modal');
  if (!modal) return;

  modal.classList.add('hide');
  modal.classList.remove('active');
}

// Recover previous active run session if app reloaded
export function recoverRunSession() {
  if (!state.currentUser) return;
  const uid = state.currentUser.uid;
  const sessionData = SafeStorage.getItem(`aura-active-run-session_${uid}`);
  if (sessionData) {
    try {
      const recovered = JSON.parse(sessionData);
      console.log("Restoring active run session:", recovered);

      state.isTrackingRun = recovered.isTrackingRun;
      state.runTrackerState = recovered.runTrackerState || "run";
      state.runTrackerSegments = recovered.runTrackerSegments || [];
      state.runTrackerMetrics = recovered.runTrackerMetrics || {
        totalDistance: 0,
        runDistance: 0,
        walkDistance: 0,
        totalDuration: 0,
        runDuration: 0,
        walkDuration: 0,
        restDuration: 0
      };
      state.activeRunExerciseIndex = recovered.activeRunExerciseIndex !== undefined ? recovered.activeRunExerciseIndex : null;
      state.isRunPaused = recovered.isRunPaused || false;

      if (state.isTrackingRun) {
        let ex = null;
        if (state.activeWorkout && state.activeWorkout.exercises && state.activeRunExerciseIndex !== null) {
          ex = state.activeWorkout.exercises[state.activeRunExerciseIndex];
        }

        openRunTrackerModal(ex);
        startGPSWatcher();
        startTelemetryTimer();
        startSilentAudioBackgroundLoop();
      }
    } catch (e) {
      console.error("Failed to recover run session:", e);
      SafeStorage.removeItem(`aura-active-run-session_${uid}`);
    }
  }
}

// Initialize run tracker elements click event bindings
export function initRunTrackerBindings() {
  const btnRun = document.getElementById('run-state-btn-run');
  const btnWalk = document.getElementById('run-state-btn-walk');
  const btnRest = document.getElementById('run-state-btn-rest');

  if (btnRun) btnRun.addEventListener('click', () => switchTrackerState('run'));
  if (btnWalk) btnWalk.addEventListener('click', () => switchTrackerState('walk'));
  if (btnRest) btnRest.addEventListener('click', () => switchTrackerState('rest'));

  const btnPause = document.getElementById('run-control-pause');
  const btnResume = document.getElementById('run-control-resume');
  const btnFinish = document.getElementById('run-control-finish');

  if (btnPause) btnPause.addEventListener('click', () => pauseTracking());
  if (btnResume) btnResume.addEventListener('click', () => resumeTracking());
  if (btnFinish) {
    btnFinish.addEventListener('click', () => {
      if (confirm('האם לסיים את המעקב ולשמור את הנתונים?')) {
        finishAndSaveRun();
      }
    });
  }

  const btnClose = document.getElementById('close-run-tracker-btn');
  if (btnClose) btnClose.addEventListener('click', () => closeRunTrackerModal());

  const expandBtn = document.getElementById('run-map-expand-btn');
  const mapElement = document.getElementById('run-tracker-map');

  if (expandBtn && mapElement) {
    const toggleMapExpand = (e) => {
      e.stopPropagation();
      mapElement.classList.toggle('expanded');
      setTimeout(() => {
        if (runTrackerMap) {
          runTrackerMap.invalidateSize();
        }
      }, 300);
    };

    expandBtn.addEventListener('click', toggleMapExpand);
    mapElement.addEventListener('click', toggleMapExpand);
  }
}

// BIND ALL GENERAL ACTIONS & INTERACTIVE ELEMENTS
export function initWorkoutsModule() {
  // Bind global compatibility triggers
  window.initWorkouts = initWorkouts;
  window.clearWorkoutSession = clearWorkoutSession;
  window.startRestTimer = startRestTimer;
  window.stopRestTimer = stopRestTimer;
  window.recoverRestTimer = recoverRestTimer;
  window.updateRestTimerRecoveryState = updateRestTimerRecoveryState;
  window.renderExercises = renderExercises;
  window.openEditModal = openEditModal;
  window.renderModalExercises = renderModalExercises;
  window.deleteWorkoutFromHistory = deleteWorkoutFromHistory;
  window.exercisesList = getAllExercises();
  window.renderExercisePickerList = renderExercisePickerList;
  window.openMetricSelectorForConfig = openMetricSelectorForConfig;
  window.openMetricSelectorForEdit = openMetricSelectorForEdit;
  window.setupMetricSelectorModal = setupMetricSelectorModal;
  
  // GPS Run Tracker Compatibility bindings
  window.openRunTrackerModal = openRunTrackerModal;
  window.closeRunTrackerModal = closeRunTrackerModal;
  window.switchTrackerState = switchTrackerState;
  window.pauseTracking = pauseTracking;
  window.resumeTracking = resumeTracking;
  window.finishAndSaveRun = finishAndSaveRun;
  window.recoverRunSession = recoverRunSession;

  initRunTrackerBindings();

  // Setup click bindings on DOM
  const startWorkoutBtn = document.getElementById('start-workout-btn');
  const cancelLocationBtn = document.getElementById('cancel-location-btn');
  const locationGrid = document.getElementById('location-selector-grid');

  if (startWorkoutBtn && locationGrid) {
    startWorkoutBtn.addEventListener('click', () => {
      startWorkoutBtn.classList.add('hide');
      locationGrid.classList.remove('hide');
    });
  }

  if (cancelLocationBtn && startWorkoutBtn && locationGrid) {
    cancelLocationBtn.addEventListener('click', () => {
      locationGrid.classList.add('hide');
      startWorkoutBtn.classList.remove('hide');
    });
  }

  const pickerModal = document.getElementById('exercise-picker-modal');
  if (pickerModal) {
    pickerModal.addEventListener('click', (e) => {
      if (e.target === pickerModal) pickerModal.classList.add('hide');
    });
  }

  const searchInput = document.getElementById('exercise-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderExercisePickerList();
    });
  }

  const metricModal = document.getElementById('metric-selector-modal');
  if (metricModal) {
    metricModal.addEventListener('click', (e) => {
      if (e.target === metricModal) {
        metricModal.classList.add('hide');
        state.selectedExerciseForAdding = null;
      }
    });
  }

  // Estimated Sets Selection Event Listeners inside metric selector modal
  const setsChipsContainer = document.getElementById('sets-chips-container');
  const metricSetsDisplay = document.getElementById('metric-sets-display');
  const metricSetsMinus = document.getElementById('metric-sets-minus');
  const metricSetsPlus = document.getElementById('metric-sets-plus');

  function updateSetsUI(value) {
    const targetSets = Math.max(1, Math.min(12, value));
    if (metricSetsDisplay) {
      metricSetsDisplay.textContent = targetSets;
    }
    
    // Sync chips
    if (setsChipsContainer) {
      setsChipsContainer.querySelectorAll('.sets-option-chip').forEach(chip => {
        const val = parseInt(chip.getAttribute('data-sets'), 10);
        if (val === targetSets) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });
    }
  }

  if (setsChipsContainer) {
    setsChipsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.sets-option-chip');
      if (!chip) return;
      const val = parseInt(chip.getAttribute('data-sets'), 10);
      updateSetsUI(val);
    });
  }

  if (metricSetsMinus) {
    metricSetsMinus.addEventListener('click', () => {
      const currentSets = metricSetsDisplay ? parseInt(metricSetsDisplay.textContent, 10) || 3 : 3;
      updateSetsUI(currentSets - 1);
    });
  }

  if (metricSetsPlus) {
    metricSetsPlus.addEventListener('click', () => {
      const currentSets = metricSetsDisplay ? parseInt(metricSetsDisplay.textContent, 10) || 3 : 3;
      updateSetsUI(currentSets + 1);
    });
  }
  
  const closePickerBtn = document.getElementById('close-exercise-picker-btn');
  if (closePickerBtn) {
    closePickerBtn.addEventListener('click', () => {
      if (pickerModal) pickerModal.classList.add('hide');
    });
  }

  const closeCustomLocBtn = document.getElementById('close-custom-location-btn');
  if (closeCustomLocBtn) {
    closeCustomLocBtn.addEventListener('click', () => {
      const modal = document.getElementById('custom-location-modal');
      if (modal) modal.classList.add('hide');
    });
  }

  const closeMetricBtn = document.getElementById('close-metric-selector-btn');
  if (closeMetricBtn) {
    closeMetricBtn.addEventListener('click', () => {
      if (metricModal) metricModal.classList.add('hide');
      state.selectedExerciseForAdding = null;
    });
  }

  const saveCustomLocBtn = document.getElementById('save-custom-location-btn');
  if (saveCustomLocBtn) {
    saveCustomLocBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('custom-location-name-input');
      const emojiInput = document.getElementById('custom-location-emoji-input');
      
      if (!nameInput || nameInput.value.trim() === '') {
        alert('אנא הזן שם לסוג האימון.');
        return;
      }
      
      const newLoc = {
        id: 'custom_' + Date.now(),
        name: nameInput.value.trim(),
        emoji: emojiInput ? emojiInput.value.trim() || '💪' : '💪'
      };
      
      state.customLocations.push(newLoc);
      if (state.currentUser) {
        SafeStorage.setItem(`aura-custom-locations_${state.currentUser.uid}`, JSON.stringify(state.customLocations));
        saveFieldToCloud("customLocations", state.customLocations);
      }
      
      nameInput.value = '';
      if (emojiInput) emojiInput.value = '';
      
      const modal = document.getElementById('custom-location-modal');
      if (modal) modal.classList.add('hide');
      
      renderLocationSelectorGrid();
      populateLocationSelects();
    });
  }

  const openCustomExModalBtn = document.getElementById('open-custom-exercise-modal-btn');
  if (openCustomExModalBtn) {
    openCustomExModalBtn.addEventListener('click', () => {
      const customExModal = document.getElementById('custom-exercise-modal');
      if (customExModal) {
        const nameInput = document.getElementById('new-custom-exercise-name-input');
        if (nameInput) nameInput.value = '';
        
        document.querySelectorAll('#custom-ex-category-selector .muscle-card').forEach(btn => {
          btn.classList.remove('active');
          if (btn.dataset.category === 'חזה') btn.classList.add('active');
        });
        
        document.querySelectorAll('#custom-ex-emoji-selector .emoji-pick-btn').forEach(btn => {
          btn.classList.remove('active');
          if (btn.dataset.emoji === '') btn.classList.add('active');
        });
        
        customExModal.classList.remove('hide');
        setTimeout(() => { if (nameInput) nameInput.focus(); }, 100);
      }
    });
  }

  const categoryPillContainer = document.getElementById('custom-ex-category-selector');
  if (categoryPillContainer) {
    categoryPillContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.muscle-card');
      if (!pill) return;
      categoryPillContainer.querySelectorAll('.muscle-card').forEach(b => b.classList.remove('active'));
      pill.classList.add('active');
    });
  }

  const emojiSelectorContainer = document.getElementById('custom-ex-emoji-selector');
  if (emojiSelectorContainer) {
    emojiSelectorContainer.addEventListener('click', (e) => {
      const emojiBtn = e.target.closest('.emoji-pick-btn');
      if (!emojiBtn) return;
      emojiSelectorContainer.querySelectorAll('.emoji-pick-btn').forEach(b => b.classList.remove('active'));
      emojiBtn.classList.add('active');
    });
  }

  const closeCustomExModalBtn = document.getElementById('close-custom-exercise-modal-btn');
  if (closeCustomExModalBtn) {
    closeCustomExModalBtn.addEventListener('click', () => {
      const customExModal = document.getElementById('custom-exercise-modal');
      if (customExModal) customExModal.classList.add('hide');
    });
  }

  const customExModal = document.getElementById('custom-exercise-modal');
  if (customExModal) {
    customExModal.addEventListener('click', (e) => {
      if (e.target === customExModal) customExModal.classList.add('hide');
    });
  }

  const saveCustomExBtn = document.getElementById('save-custom-exercise-btn');
  if (saveCustomExBtn) {
    saveCustomExBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('new-custom-exercise-name-input');
      if (!nameInput || nameInput.value.trim() === '') {
        alert('אנא הזן שם לתרגיל המותאם אישית.');
        if (nameInput) nameInput.focus();
        return;
      }
      
      const exName = nameInput.value.trim();
      const activeCatPill = document.querySelector('#custom-ex-category-selector .muscle-card.active');
      const selectedCategory = activeCatPill ? activeCatPill.dataset.category : 'מותאם אישית';
      const activeEmojiBtn = document.querySelector('#custom-ex-emoji-selector .emoji-pick-btn.active');
      const selectedEmoji = activeEmojiBtn ? activeEmojiBtn.dataset.emoji : '';
      
      const newEx = {
        name: exName,
        category: selectedCategory,
        locationType: state.activeWorkout ? state.activeWorkout.location : 'custom',
        emoji: selectedEmoji || ''
      };
      
      state.customExercises.push(newEx);
      // metrics.js memoises name -> exercise; this in-place push must invalidate it
      if (window.invalidateExerciseLookupCache) window.invalidateExerciseLookupCache();
      if (state.currentUser) {
        SafeStorage.setItem(`aura-custom-exercises_${state.currentUser.uid}`, JSON.stringify(state.customExercises));
        saveFieldToCloud("customExercises", state.customExercises);
      }
      
      if (customExModal) customExModal.classList.add('hide');
      
      state.selectedExerciseForAdding = exName;
      
      if (pickerModal) pickerModal.classList.add('hide');
      if (metricModal) metricModal.classList.remove('hide');
      
      renderExercisePickerList();
      if (window.renderExercisesManager) window.renderExercisesManager();
    });
  }

  // Handle click on premium metric selector cards to make them statefully selectable (toggling for multi-selection)
  const metricCards = document.querySelectorAll('#metric-selector-modal .premium-metric-card');
  metricCards.forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('active');
    });
  });

  // Handle click on confirm add exercise button
  const confirmAddExerciseBtn = document.getElementById('confirm-add-exercise-btn');
  if (confirmAddExerciseBtn) {
    confirmAddExerciseBtn.addEventListener('click', () => {
      const metricModal = document.getElementById('metric-selector-modal');
      console.log("Confirm add exercise clicked. Selected exercise:", state.selectedExerciseForAdding, "Edit index:", state.editingActiveExerciseIndex, "Config exercise:", state.configuringExerciseDefaults);
      
      // Extract active metrics
      const activeCards = document.querySelectorAll('#metric-selector-modal .premium-metric-card.active');
      const metrics = Array.from(activeCards).map(card => card.getAttribute('data-metric'));
      
      if (metrics.length === 0) {
        alert('יש לבחור לפחות מדד אחד.');
        return;
      }
      
      // Extract rest time
      const activeRestChip = document.querySelector('#rest-time-chips-container .rest-option-chip.active');
      const seconds = activeRestChip ? parseInt(activeRestChip.getAttribute('data-rest'), 10) : 90;

      // Extract target sets count
      const metricSetsDisplay = document.getElementById('metric-sets-display');
      const targetSets = metricSetsDisplay ? parseInt(metricSetsDisplay.textContent, 10) || 3 : 3;

      if (state.editingActiveExerciseIndex !== null && state.editingActiveExerciseIndex !== undefined && state.editingActiveExerciseIndex >= 0) {
        // Edit mode
        if (!state.activeWorkout) return;
        const ex = state.activeWorkout.exercises[state.editingActiveExerciseIndex];
        if (ex) {
          ex.targetSetsCount = targetSets;
          ex.restTime = seconds;
          ex.metrics = metrics;
          
          saveActiveWorkoutState();
          
          // Save defaults
          saveExerciseDefaults(ex.name, {
            targetSetsCount: targetSets,
            restTime: seconds,
            metrics: metrics
          });
        }
        state.editingActiveExerciseIndex = null;
        if (metricModal) metricModal.classList.add('hide');
        renderExercises();

      } else if (state.configuringExerciseDefaults) {
        // Configuration mode
        const exName = state.configuringExerciseDefaults;
        saveExerciseDefaults(exName, {
          targetSetsCount: targetSets,
          restTime: seconds,
          metrics: metrics
        });
        state.configuringExerciseDefaults = null;
        if (metricModal) metricModal.classList.add('hide');
        
        if (window.renderExercisesManager) window.renderExercisesManager();

      } else {
        // Normal add mode
        if (!state.selectedExerciseForAdding) {
          alert('שגיאה: לא נבחר תרגיל. אנא בחר תרגיל שוב.');
          return;
        }
        
        if (!state.activeWorkout) return;

        const newExercise = {
          name: state.selectedExerciseForAdding,
          metrics: metrics,
          restTime: seconds,
          targetSetsCount: targetSets,
          completed: false,
          sets: []
        };

        state.activeWorkout.exercises.push(newExercise);
        saveActiveWorkoutState();
        
        // Save defaults
        saveExerciseDefaults(state.selectedExerciseForAdding, {
          targetSetsCount: targetSets,
          restTime: seconds,
          metrics: metrics
        });

        if (metricModal) metricModal.classList.add('hide');
        state.selectedExerciseForAdding = null;
        
        renderExercises();
      }
    });
  }

  const restChipsContainer = document.getElementById('rest-time-chips-container');
  if (restChipsContainer) {
    restChipsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.rest-option-chip');
      if (!chip) return;
      restChipsContainer.querySelectorAll('.rest-option-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  }

  const addExerciseBtn = document.getElementById('add-exercise-btn');
  if (addExerciseBtn) {
    addExerciseBtn.addEventListener('click', () => {
      if (!state.activeWorkout) return;

      // Do NOT silently drop exercises that have no completed set yet — the user may
      // simply not have logged the first set. Just ask them to close the open one.
      const hasActive = state.activeWorkout.exercises.some(ex => !ex.completed);
      if (hasActive) {
        showPremiumToast('נא לסיים את התרגיל הנוכחי לפני הוספת תרגיל חדש.', 'info');
        return;
      }

      if (pickerModal) {
        pickerModal.classList.remove('hide');
        const searchInput = document.getElementById('exercise-search-input');
        if (searchInput) searchInput.value = '';
        state.currentActiveCategoryFilter = 'הכל';
        renderExercisePickerFilters();
        renderExercisePickerList();
      }
    });
  }

  const finishWorkoutBtn = document.getElementById('finish-workout-btn');
  if (finishWorkoutBtn) {
    finishWorkoutBtn.addEventListener('click', () => {
      if (!state.activeWorkout) return;
      
      state.activeWorkout.exercises.forEach(ex => {
        if (!ex.completed && ex.name.trim() !== '') {
          ex.sets.forEach(set => {
            if (!set.completed) {
              const hasReps = set.reps !== '' && Number(set.reps) > 0;
              const hasWeight = set.weight !== '' && Number(set.weight) >= 0;
              if (hasReps || hasWeight) {
                set.completed = true;
              }
            }
          });
          const hasCompletedSets = ex.sets.some(s => s.completed);
          if (hasCompletedSets) {
            ex.completed = true;
          }
        }
      });

      const sanitizedExercises = state.activeWorkout.exercises.map(ex => {
        const clonedEx = JSON.parse(JSON.stringify(ex));
        const isGpsEx = ['ריצה', 'הליכה', 'ריצה והליכה'].includes(ex.name);
        clonedEx.sets = clonedEx.sets.filter(s => {
          if (isGpsEx) {
            return s.completed && (s.distance !== undefined || s.time !== undefined);
          } else {
            const hasReps = s.reps !== null && s.reps !== undefined && String(s.reps).trim() !== '' && Number(s.reps) > 0;
            const hasWeight = s.weight !== null && s.weight !== undefined && String(s.weight).trim() !== '' && Number(s.weight) >= 0;
            return s.completed && (hasReps || hasWeight);
          }
        });
        return clonedEx;
      }).filter(ex => ex.name.trim() !== '' && ex.sets.length > 0);

      if (sanitizedExercises.length === 0) {
        if (confirm('אין תרגילים תקפים שהושלמו באימון זה. האם ברצונך לבטל את האימון ולחזור למסך הראשי?')) {
          if (state.activeTimerInterval) {
            clearInterval(state.activeTimerInterval);
            state.activeTimerInterval = null;
          }
          stopRestTimer();
          state.activeWorkout = null;
          if (state.currentUser) {
            SafeStorage.removeItem(`aura-active-workout_${state.currentUser.uid}`);
          }
          const activeView = document.getElementById('workout-active-view');
          const idleView = document.getElementById('workout-idle-view');
          if (activeView) activeView.classList.add('hide');
          if (idleView) {
            idleView.classList.add('active');
            idleView.classList.remove('hide');
          }
        }
        return;
      }
      
      const durationSeconds = Math.floor((Date.now() - state.activeWorkout.startTime) / 1000);
      
      const workoutLog = {
        id: Date.now(),
        date: Date.now(),
        location: state.activeWorkout.location,
        locationName: state.activeWorkout.locationName || (state.activeWorkout.location === 'gym' ? 'חדר כושר' : 'פארק'),
        locationEmoji: state.activeWorkout.locationEmoji || (state.activeWorkout.location === 'gym' ? '🏋️‍♂️' : '🌳'),
        duration: durationSeconds,
        exercises: sanitizedExercises
      };
      
      state.workoutHistory.push(workoutLog);
      SafeStorage.setItem(`aura-workout-history_${state.currentUser.uid}`, JSON.stringify(state.workoutHistory));
      saveFieldToCloud("workoutHistory", state.workoutHistory);
      
      SafeStorage.removeItem(`aura-active-workout_${state.currentUser.uid}`);
      saveFieldToCloud("activeWorkout", null);
      stopRestTimer();

      if (state.activeTimerInterval) {
        clearInterval(state.activeTimerInterval);
        state.activeTimerInterval = null;
      }
      state.activeWorkout = null;
      
      const activeView = document.getElementById('workout-active-view');
      const idleView = document.getElementById('workout-idle-view');
      if (activeView) activeView.classList.add('hide');
      if (idleView) {
        idleView.classList.add('active');
        idleView.classList.remove('hide');
      }
      
      if (window.renderWorkoutHistory) window.renderWorkoutHistory();
      
      const analyticsTabBtn = document.querySelector('.ios-bottom-nav .nav-tab[data-tab="analytics"]');
      if (analyticsTabBtn) {
        analyticsTabBtn.click();
      }
      
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        triggerLocalNotification("אימון נשמר בהצלחה! 💪", "הנתונים שלך מוגנים ומאובטחים לצמיתות במכשיר.");
      }
    });
  }

  // Edit Modal Event Handlers
  const editModal = document.getElementById('workout-edit-modal');
  const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
  const saveEditedWorkoutBtn = document.getElementById('save-edited-workout-btn');
  const deleteWorkoutBtn = document.getElementById('delete-workout-btn');

  if (closeEditModalBtn && editModal) {
    closeEditModalBtn.addEventListener('click', () => {
      editModal.classList.add('hide');
      state.editingWorkout = null;
    });
    
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) {
        editModal.classList.add('hide');
        state.editingWorkout = null;
      }
    });
  }

  if (saveEditedWorkoutBtn) {
    saveEditedWorkoutBtn.addEventListener('click', () => {
      if (!state.editingWorkout || !state.currentUser) return;
      
      if (state.editingWorkout.exercises.length === 0) {
        if (confirm('לא נותרו תרגילים באימון זה. האם ברצונך למחוק אותו לגמרי מההיסטוריה?')) {
          deleteWorkoutFromHistory(state.editingWorkout.id);
        }
        return;
      }
      
      for (let i = 0; i < state.editingWorkout.exercises.length; i++) {
        const ex = state.editingWorkout.exercises[i];
        if (!ex.name.trim()) {
          alert('אנא ודא שלכל התרגילים יש שם.');
          return;
        }
        
        const isGpsEx = ['ריצה', 'הליכה', 'ריצה והליכה'].includes(ex.name);
        ex.sets = ex.sets.filter(s => {
          if (isGpsEx) {
            return s.distance !== undefined || s.time !== undefined;
          } else {
            const hasReps = s.reps !== null && s.reps !== undefined && String(s.reps).trim() !== '' && Number(s.reps) > 0;
            const hasWeight = s.weight !== null && s.weight !== undefined && String(s.weight).trim() !== '' && Number(s.weight) >= 0;
            return hasReps || hasWeight;
          }
        });
        
        if (ex.sets.length === 0) {
          alert(`התרגיל "${ex.name}" חייב להכיל לפחות סט אחד בעל ערכים תקינים.`);
          return;
        }
        
        ex.sets.forEach(s => s.completed = true);
        ex.completed = true;
      }
      
      const originalIdx = state.workoutHistory.findIndex(w => w.id === state.editingWorkout.id);
      if (originalIdx !== -1) {
        state.workoutHistory[originalIdx] = state.editingWorkout;
        SafeStorage.setItem(`aura-workout-history_${state.currentUser.uid}`, JSON.stringify(state.workoutHistory));
        saveFieldToCloud("workoutHistory", state.workoutHistory);
        
        if (window.renderWorkoutHistory) window.renderWorkoutHistory();
        
        if (editModal) editModal.classList.add('hide');
        state.editingWorkout = null;
      }
    });
  }

  if (deleteWorkoutBtn) {
    deleteWorkoutBtn.addEventListener('click', () => {
      if (!state.editingWorkout) return;
      if (confirm('האם אתה בטוח שברצונך למחוק את האימון הזה לצמיתות מההיסטוריה? פעולה זו אינה ניתנת לביטול.')) {
        deleteWorkoutFromHistory(state.editingWorkout.id);
      }
    });
  }

  // Rest Timer Interactive Elements
  const plus30Btn = document.getElementById('rest-timer-plus-30');
  const minus30Btn = document.getElementById('rest-timer-minus-30');

  // NOTE: #close-rest-timer-btn is bound once in initRestTimerInteraction() below.

  if (plus30Btn) {
    plus30Btn.addEventListener('click', () => {
      state.restTimerSecondsLeft += 30;
      state.restTimerTotalDuration = Math.max(state.restTimerTotalDuration, state.restTimerSecondsLeft);
      
      updateRestTimerRecoveryState();
      
      if (state.restTimerSecondsLeft > 0 && !state.restTimerInterval) {
        const bubble = document.getElementById('rest-timer-bubble');
        if (bubble) bubble.classList.remove('expired');
        
        beginRestTimerTick();
      }
      updateRestTimerUI();
    });
  }

  if (minus30Btn) {
    minus30Btn.addEventListener('click', () => {
      state.restTimerSecondsLeft = Math.max(0, state.restTimerSecondsLeft - 30);
      
      updateRestTimerRecoveryState();
      
      updateRestTimerUI();
      if (state.restTimerSecondsLeft === 0) {
        handleRestTimerExpiration();
      }
    });
  }

  // Set Logging Micro adjustments
  const setLogModal = document.getElementById('set-log-modal');
  const weightSlider = document.getElementById('weight-range-slider');
  const weightValueText = document.getElementById('weight-slider-value');
  const repsSlider = document.getElementById('reps-range-slider');
  const repsValueText = document.getElementById('reps-slider-value');
  const timeSlider = document.getElementById('time-range-slider');
  const timeValueText = document.getElementById('time-slider-value');

  const weightMinusBtn = document.getElementById('weight-minus-btn');
  const weightPlusBtn = document.getElementById('weight-plus-btn');
  const repsMinusBtn = document.getElementById('reps-minus-btn');
  const repsPlusBtn = document.getElementById('reps-plus-btn');
  const timeMinusBtn = document.getElementById('time-minus-btn');
  const timePlusBtn = document.getElementById('time-plus-btn');

  const confirmSetBtn = document.getElementById('set-log-confirm-btn');
  const cancelSetBtn = document.getElementById('set-log-cancel-btn');

  if (weightSlider && weightValueText) {
    weightSlider.addEventListener('input', () => {
      weightValueText.textContent = weightSlider.value;
    });
  }
  if (repsSlider && repsValueText) {
    repsSlider.addEventListener('input', () => {
      repsValueText.textContent = repsSlider.value;
    });
  }
  if (timeSlider && timeValueText) {
    timeSlider.addEventListener('input', () => {
      timeValueText.textContent = timeSlider.value;
    });
  }

  if (weightMinusBtn && weightSlider && weightValueText) {
    weightMinusBtn.addEventListener('click', () => {
      let val = parseFloat(weightSlider.value) || 0;
      val = Math.max(0, val - 2.5);
      val = parseFloat(val.toFixed(1));
      weightSlider.value = val;
      weightValueText.textContent = val;
      weightSlider.dispatchEvent(new Event('input', { bubbles: true }));
      if (navigator.vibrate) navigator.vibrate([15]);
    });
  }
  if (weightPlusBtn && weightSlider && weightValueText) {
    weightPlusBtn.addEventListener('click', () => {
      let val = parseFloat(weightSlider.value) || 0;
      val = Math.min(250, val + 2.5);
      val = parseFloat(val.toFixed(1));
      weightSlider.value = val;
      weightValueText.textContent = val;
      weightSlider.dispatchEvent(new Event('input', { bubbles: true }));
      if (navigator.vibrate) navigator.vibrate([15]);
    });
  }

  if (repsMinusBtn && repsSlider && repsValueText) {
    repsMinusBtn.addEventListener('click', () => {
      let val = parseInt(repsSlider.value, 10) || 0;
      val = Math.max(1, val - 1);
      repsSlider.value = val;
      repsValueText.textContent = val;
      repsSlider.dispatchEvent(new Event('input', { bubbles: true }));
      if (navigator.vibrate) navigator.vibrate([15]);
    });
  }
  if (repsPlusBtn && repsSlider && repsValueText) {
    repsPlusBtn.addEventListener('click', () => {
      let val = parseInt(repsSlider.value, 10) || 0;
      val = Math.min(50, val + 1);
      repsSlider.value = val;
      repsValueText.textContent = val;
      repsSlider.dispatchEvent(new Event('input', { bubbles: true }));
      if (navigator.vibrate) navigator.vibrate([15]);
    });
  }

  if (timeMinusBtn && timeSlider && timeValueText) {
    timeMinusBtn.addEventListener('click', () => {
      let val = parseInt(timeSlider.value, 10) || 0;
      val = Math.max(0, val - 5);
      timeSlider.value = val;
      timeValueText.textContent = val;
      timeSlider.dispatchEvent(new Event('input', { bubbles: true }));
      if (navigator.vibrate) navigator.vibrate([15]);
    });
  }
  if (timePlusBtn && timeSlider && timeValueText) {
    timePlusBtn.addEventListener('click', () => {
      let val = parseInt(timeSlider.value, 10) || 0;
      val = Math.min(300, val + 5);
      timeSlider.value = val;
      timeValueText.textContent = val;
      timeSlider.dispatchEvent(new Event('input', { bubbles: true }));
      if (navigator.vibrate) navigator.vibrate([15]);
    });
  }

  // Bind quick stepper chips
  const weightChips = document.querySelectorAll('#set-log-weight-group .stepper-chip');
  weightChips.forEach(chip => {
    chip.removeAttribute('onclick');
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const offset = parseFloat(chip.textContent) || 0;
      if (weightSlider && weightValueText) {
        let val = parseFloat(weightSlider.value) || 0;
        val += offset;
        val = Math.max(0, val);
        val = Math.min(250, val);
        val = parseFloat(val.toFixed(1));
        weightSlider.value = val;
        weightValueText.textContent = val;
        weightSlider.dispatchEvent(new Event('input', { bubbles: true }));
        if (navigator.vibrate) navigator.vibrate([15]);
      }
    });
  });

  const repsChips = document.querySelectorAll('#set-log-reps-group .stepper-chip');
  repsChips.forEach(chip => {
    chip.removeAttribute('onclick');
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const offset = parseInt(chip.textContent, 10) || 0;
      if (repsSlider && repsValueText) {
        let val = parseInt(repsSlider.value, 10) || 0;
        val += offset;
        val = Math.max(1, val);
        val = Math.min(50, val);
        repsSlider.value = val;
        repsValueText.textContent = val;
        repsSlider.dispatchEvent(new Event('input', { bubbles: true }));
        if (navigator.vibrate) navigator.vibrate([15]);
      }
    });
  });

  if (setLogModal) {
    setLogModal.addEventListener('click', (e) => {
      if (e.target === setLogModal) {
        setLogModal.classList.add('hide');
        state.currentLoggingExercise = null;
        state.currentLoggingSetIndex = -1;
      }
    });
  }

  if (confirmSetBtn) {
    confirmSetBtn.addEventListener('click', () => {
      if (!state.currentLoggingExercise) return;

      const metrics = getExerciseMetrics(state.currentLoggingExercise);
      let repsVal = '';
      let weightVal = '';
      let timeVal = '';

      if (metrics.includes('reps')) {
        repsVal = repsSlider ? repsSlider.value : '10';
      }
      if (metrics.includes('weight')) {
        weightVal = weightSlider ? weightSlider.value : '60';
      }
      if (metrics.includes('time')) {
        timeVal = timeSlider ? timeSlider.value : '30';
      }

      const loggedSet = {
        reps: repsVal,
        weight: weightVal,
        time: timeVal,
        completed: true
      };

      if (!state.currentLoggingExercise.sets) {
        state.currentLoggingExercise.sets = [];
      }

      state.currentLoggingExercise.sets = state.currentLoggingExercise.sets.filter(s => s.completed);
      state.currentLoggingExercise.sets.push(loggedSet);

      saveActiveWorkoutState();

      const completedSetsCount = state.currentLoggingExercise.sets.filter(s => s.completed).length;
      const targetSetsCount = state.currentLoggingExercise.targetSetsCount || 3;

      if (completedSetsCount >= targetSetsCount) {
        state.currentLoggingExercise.completed = true;
        // Clean up any remaining uncompleted sets
        state.currentLoggingExercise.sets = state.currentLoggingExercise.sets.filter(s => s.completed);
        
        saveActiveWorkoutState();
        
        if (setLogModal) setLogModal.classList.add('hide');
        
        // Start 2-minute transition rest timer
        startRestTimer(120);
        
        // Premium toast notification indicating completion
        showPremiumToast(`התרגיל הושלם בהצלחה! מעבר לתרגיל הבא בעוד 2 דקות מנוחה ⏱️💪`, "success");
      } else {
        if (setLogModal) setLogModal.classList.add('hide');
        const restSeconds = state.currentLoggingExercise.restTime || 90;
        startRestTimer(restSeconds);
      }

      state.currentLoggingExercise = null;
      state.currentLoggingSetIndex = -1;

      renderExercises();
    });
  }

  if (cancelSetBtn) {
    cancelSetBtn.addEventListener('click', () => {
      if (setLogModal) setLogModal.classList.add('hide');
      state.currentLoggingExercise = null;
      state.currentLoggingSetIndex = -1;
    });
  }

  // Plate Calculator bindings
  const calcTrigger = document.getElementById('trigger-plate-calc-btn');
  const calcModal = document.getElementById('plate-calculator-modal');
  const calcClose = document.getElementById('close-plate-calc-btn');

  if (calcTrigger && calcModal) {
    calcTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const slider = document.getElementById('weight-range-slider');
      const target = slider ? parseFloat(slider.value) || 60 : 60;
      calculatePlates(target);
      calcModal.classList.remove('hide');
    });
  }

  const dismissCalc = () => {
    if (calcModal) calcModal.classList.add('hide');
  };

  if (calcClose) calcClose.addEventListener('click', dismissCalc);
  if (calcModal) {
    calcModal.addEventListener('click', (e) => {
      if (e.target === calcModal) dismissCalc();
    });
  }

  // GPS Diagnostic bindings
  const gpsDiagModal = document.getElementById('gps-diagnostic-modal');
  const gpsDiagClose = document.getElementById('close-gps-diagnostic-btn');
  const gpsDiagOk = document.getElementById('gps-diagnostic-ok-btn');

  const dismissGpsDiag = () => {
    if (gpsDiagModal) {
      gpsDiagModal.classList.add('hide');
      gpsDiagModal.classList.remove('active');
    }
  };

  if (gpsDiagClose) gpsDiagClose.addEventListener('click', dismissGpsDiag);
  if (gpsDiagOk) gpsDiagOk.addEventListener('click', dismissGpsDiag);
  if (gpsDiagModal) {
    gpsDiagModal.addEventListener('click', (e) => {
      if (e.target === gpsDiagModal) dismissGpsDiag();
    });
  }

  // Initialize premium interactive Rest Timer gestures & alarms
  initRestTimerInteraction();
}

// ⏱️ Premium Interactive Rest Timer Gesture & Drag Controller
export function initRestTimerInteraction() {
  const bubble = document.getElementById('rest-timer-bubble');
  if (!bubble) return;

  let isDragging = false;
  let startX = 0, startY = 0;
  let currentX = 0, currentY = 0;
  let scale = 1;
  let initialDistance = 0;
  let initialScale = 1;

  // Touch handlers for mobile dragging & pinch-to-size
  bubble.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX - currentX;
      startY = e.touches[0].clientY - currentY;
      bubble.style.transition = 'none'; // absolute raw tracking
    } else if (e.touches.length === 2) {
      isDragging = false;
      initialDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialScale = scale;
    }
  }, { passive: true });

  bubble.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) {
      e.preventDefault(); // Stop mobile rubber banding
      currentX = e.touches[0].clientX - startX;
      currentY = e.touches[0].clientY - startY;
      updateBubbleTransform();
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (initialDistance > 0) {
        const factor = currentDistance / initialDistance;
        scale = Math.max(0.6, Math.min(1.8, initialScale * factor)); // safety scaling caps
        updateBubbleTransform();
      }
    }
  }, { passive: false });

  bubble.addEventListener('touchend', () => {
    isDragging = false;
    bubble.style.transition = 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.1)';
  });

  // Mouse drag handlers for desktop accessibility
  bubble.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // only left click
    if (e.target.closest('button')) return; // do not drag on button clicks

    isDragging = true;
    startX = e.clientX - currentX;
    startY = e.clientY - currentY;
    bubble.style.transition = 'none';
    bubble.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    currentX = e.clientX - startX;
    currentY = e.clientY - startY;
    updateBubbleTransform();
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      bubble.style.transition = 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.1)';
      bubble.style.cursor = 'grab';
    }
  });

  // Mouse wheel scroll to resize on desktop
  bubble.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    scale = Math.max(0.6, Math.min(1.8, scale + delta));
    updateBubbleTransform();
  }, { passive: false });

  // PWA Background rest timer recovery logic
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      recoverRestTimer();
    }
  });

  // Ensure close button is bound
  const closeBtn = document.getElementById('close-rest-timer-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stopRestTimer();
    });
  }

  function updateBubbleTransform() {
    bubble.style.transform = `translate(calc(-50% + ${currentX}px), ${currentY}px) scale(${scale})`;
  }
}
