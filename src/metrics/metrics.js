import { state } from "../state.js";
import { SafeStorage } from "../utils/storage.js";
import { triggerLocalNotification, showAuraToast, safeFormatDate, requestNotificationPermissionSafely, escapeHTML } from "../utils/helpers.js";
import { getAllExercises, isSystemExercise, GYM_EXERCISES, PARK_EXERCISES, openEditModal, saveActiveWorkoutState, getExerciseDefaults, saveExerciseDefaults } from "../workouts/workouts.js";
import { saveFieldToCloud } from "../utils/db.js";
import { getCustomIcon, ICONS_MAP } from "../utils/icons.js";

// DOM Elements & Configurations
const HEBREW_QUOTES = [
  "אין קיצורי דרך למקומות ששווה להגיע אליהם! 🔥",
  "כל חזרה מקרבת אותך לגרסה הטובה ביותר של עצמך. 💪",
  "הכאב של היום הוא הכוח של מחר! ⚡",
  "אל תפסיק כשזה קשה, תפסיק כשסיימת. 🏆",
  "המשמעת העצמית שלך היא המפתח לברזל! 🏋️‍♂️",
  "אתה נלחם נגד עצמך של אתמול, לא נגד אף אחד אחר. 🌟",
  "הפוך את התירוצים שלך לתוצאות בקצה הברזל! 🔥",
  "המנוחה מכינה אותך לסט המושלם הבא. תתרכז! 🎯"
];

// getAllExercises() rebuilds a Set and a merged array on every call, and the render
// paths below call it once per exercise per workout. Memoise the name lookup, keyed off
// the identity of the custom-exercise array so it self-invalidates when that changes.
let _exerciseLookupCache = null;
let _exerciseLookupRef = null;
let _exerciseLookupVersion = -1;

function getExerciseByName(name) {
  // Keyed on BOTH the array identity (covers reassignment, e.g. after a cloud merge)
  // and an explicit version counter (covers in-place push/rename, which leaves the
  // identity untouched). Getting this wrong silently reports every custom exercise
  // as category 'אחר', so the invalidation must be conservative.
  if (_exerciseLookupCache === null ||
      _exerciseLookupRef !== state.customExercises ||
      _exerciseLookupVersion !== window.__auraExerciseVersion) {
    _exerciseLookupRef = state.customExercises;
    _exerciseLookupVersion = window.__auraExerciseVersion;
    _exerciseLookupCache = new Map();
    getAllExercises().forEach(ex => _exerciseLookupCache.set(ex.name, ex));
  }
  return _exerciseLookupCache.get(name) || null;
}

// Must be called by anything that mutates state.customExercises in place.
// Exposed on window because workouts.js also mutates the list and importing
// metrics.js from workouts.js would close an import cycle.
export function invalidateExerciseLookupCache() {
  window.__auraExerciseVersion = (window.__auraExerciseVersion || 0) + 1;
  _exerciseLookupCache = null;
  _exerciseLookupRef = null;
}
window.__auraExerciseVersion = 0;
window.invalidateExerciseLookupCache = invalidateExerciseLookupCache;

// Future Workouts LocalStorage Handlers
export function getFutureWorkouts() {
  if (!state.currentUser) return [];
  const key = `aura-future-workouts_${state.currentUser.uid}`;
  try {
    const data = SafeStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error reading future workouts", e);
    return [];
  }
}

export function saveFutureWorkouts(workouts) {
  if (!state.currentUser) return;
  const key = `aura-future-workouts_${state.currentUser.uid}`;
  try {
    SafeStorage.setItem(key, JSON.stringify(workouts));
    saveFieldToCloud("futureWorkouts", workouts);
  } catch (e) {
    console.error("Error saving future workouts", e);
  }
}

// Start periodic background reminder checking
export function startFutureWorkoutReminderChecker() {
  console.log("Starting periodic background checker for scheduled workouts...");
  setInterval(() => {
    if (!state.currentUser) return;
    const futureWorkouts = getFutureWorkouts();
    let updated = false;

    futureWorkouts.forEach(workout => {
      if (workout.reminderSent) return;

      const targetDateTimeStr = `${workout.date}T${workout.time}:00`;
      const targetTimeMs = new Date(targetDateTimeStr).getTime();
      if (isNaN(targetTimeMs)) return;

      const thresholdTimeMs = targetTimeMs - (workout.reminderMinutes * 60 * 1000);
      const nowMs = Date.now();

      if (nowMs >= thresholdTimeMs && nowMs < targetTimeMs + 60 * 60 * 1000) {
        workout.reminderSent = true;
        updated = true;

        const displayLoc = workout.location === 'gym' ? 'חדר כושר' : (workout.location === 'park' ? 'פארק' : workout.location);
        const title = `תזכורת לאימון: אימון ${displayLoc} מתוזמן לשעה ${workout.time}! 🏋️‍♂️`;
        const body = "אימון עתידי בפתח! 🏋️‍♂️";

        triggerLocalNotification(title, body, true);
        console.log(`Notification sent for future workout ${workout.id}`);
      } else if (nowMs >= targetTimeMs + 60 * 60 * 1000) {
        workout.reminderSent = true;
        updated = true;
      }
    });

    if (updated) {
      saveFutureWorkouts(futureWorkouts);
      // Only the repaint is skipped while backgrounded - the notification above is the
      // whole point of this checker and must still fire.
      if (state.activeSubTab === 'calendar' && document.visibilityState === 'visible') {
        renderCalendarView();
      }
    }
  }, 60000);
}

// History Filters Manager
export function getFilteredHistory(ignoreFilters = false) {
  if (ignoreFilters) {
    return [...state.workoutHistory].sort((a, b) => b.date - a.date);
  }
  let result = [...state.workoutHistory];

  const now = new Date();
  if (state.filterTimeSelection === '7') {
    const limit = new Date();
    limit.setDate(now.getDate() - 7);
    result = result.filter(w => new Date(w.date) >= limit);
  } else if (state.filterTimeSelection === '30') {
    const limit = new Date();
    limit.setDate(now.getDate() - 30);
    result = result.filter(w => new Date(w.date) >= limit);
  } else if (state.filterTimeSelection === 'custom') {
    if (state.filterStartDate) {
      result = result.filter(w => new Date(w.date) >= state.filterStartDate);
    }
    if (state.filterEndDate) {
      const endLimit = new Date(state.filterEndDate);
      endLimit.setHours(23, 59, 59, 999);
      result = result.filter(w => new Date(w.date) <= endLimit);
    }
  }

  if (state.filterLocation !== 'all') {
    result = result.filter(w => w.location === state.filterLocation);
  }

  if (state.filterMuscleGroup !== 'all') {
    result = result.filter(w => {
      return w.exercises && w.exercises.some(ex => {
        let cat = 'אחר';
        const matched = getExerciseByName(ex.name);
        if (matched) cat = matched.category || 'אחר';
        return cat === state.filterMuscleGroup;
      });
    });
  }

  return result.sort((a, b) => b.date - a.date);
}

// NOTE: renderExerciseAnalyticsDashboard() was removed in v1.9.0 — it targeted
// #bezier-chart-svg / #chart-* / #dashboard-* which no longer exist in index.html.

// Calendar View
export function renderCalendarView() {
  const container = document.getElementById('calendar-days-grid');
  const monthLabel = document.getElementById('calendar-month-label');

  if (!container || !monthLabel) return;

  container.innerHTML = '';
  const year = state.currentCalendarDate.getFullYear();
  const month = state.currentCalendarDate.getMonth();

  const monthsHebrew = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  monthLabel.textContent = `${monthsHebrew[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const filtered = getFilteredHistory(true);
  const workoutsByDay = {};

  filtered.forEach(w => {
    const d = new Date(w.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const dayNum = d.getDate();
      if (!workoutsByDay[dayNum]) workoutsByDay[dayNum] = [];
      workoutsByDay[dayNum].push(w);
    }
  });

  const futureWorkouts = getFutureWorkouts();
  const futureWorkoutsByDay = {};

  futureWorkouts.forEach(w => {
    const parts = w.date.split('-');
    if (parts.length === 3) {
      const wYear = parseInt(parts[0], 10);
      const wMonth = parseInt(parts[1], 10) - 1;
      const wDay = parseInt(parts[2], 10);

      if (wYear === year && wMonth === month) {
        if (!futureWorkoutsByDay[wDay]) futureWorkoutsByDay[wDay] = [];
        futureWorkoutsByDay[wDay].push(w);
      }
    }
  });

  for (let i = 0; i < firstDayIndex; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day-empty';
    container.appendChild(empty);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day-cell';
    dayCell.textContent = day;

    const today = new Date();
    if (today.getDate() === day && today.getMonth() === month && today.getFullYear() === year) {
      dayCell.classList.add('today');
    }

    const sessions = workoutsByDay[day] || [];
    const futures = futureWorkoutsByDay[day] || [];

    const dotsContainer = document.createElement('div');
    dotsContainer.style.cssText = 'display: flex; gap: 3px; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); justify-content: center; width: 100%;';
    dayCell.appendChild(dotsContainer);

    if (sessions.length > 0) {
      dayCell.classList.add('has-workout');
      sessions.forEach(w => {
        const dot = document.createElement('span');
        const loc = (w.location || '').toLowerCase();
        let dotClass = 'workout-dot gym';
        if (loc === 'park') dotClass = 'workout-dot park';
        else if (loc === 'home') dotClass = 'workout-dot home';
        dot.className = dotClass;
        dotsContainer.appendChild(dot);
      });
    }

    if (futures.length > 0) {
      dayCell.classList.add('has-future-workout');
      futures.forEach(f => {
        const dot = document.createElement('span');
        // Scheduled workouts store the Hebrew display name (e.g. 'פארק'), not the 'gym'/'park' key
        const loc = (f.location || '').toLowerCase();
        let dotClass = 'workout-dot gym';
        if (loc === 'park' || loc.indexOf('פארק') !== -1) dotClass = 'workout-dot park';
        else if (loc === 'home' || loc.indexOf('בית') !== -1) dotClass = 'workout-dot home';
        dot.className = dotClass;
        dot.style.border = '1px solid rgba(255, 255, 255, 0.4)';
        dotsContainer.appendChild(dot);
      });
    }

    if (sessions.length > 0 || futures.length > 0) {
      dayCell.addEventListener('click', (e) => {
        e.stopPropagation();
        
        let detailsHtml = '';

        if (sessions.length > 0) {
          sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
          detailsHtml += `<h5 style="color: #fca5a5; text-align: right; margin: 4px 0 8px 0; font-size: 0.9rem; font-weight: 700;">אימוני עבר:</h5>`;
          detailsHtml += sessions.map(w => {
            const duration = w.duration ? Math.round(w.duration / 60) : 0;
            const wDate = new Date(w.date);
            const timeStr = wDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            return `
              <div style="padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 8px; direction: rtl; text-align: right;">
                <div style="display: flex; justify-content: space-between; font-weight: 700; color: #fff;">
                  <span>${escapeHTML(w.locationEmoji || '🏋️')} ${escapeHTML(w.locationName || 'אימון')}</span>
                  <span style="font-size: 0.8rem; color: var(--text-muted);">${timeStr} • ${duration} דק׳</span>
                </div>
                <button class="btn btn-secondary edit-past-workout-btn" data-id="${escapeHTML(w.id)}" style="width: 100%; margin-top: 8px; padding: 6px !important; font-size: 0.75rem !important;">🛠️ ערוך אימון</button>
              </div>
            `;
          }).join('');
        }

        if (futures.length > 0) {
          futures.sort((a, b) => a.time.localeCompare(b.time));
          detailsHtml += `<h5 style="color: #fdba74; text-align: right; margin: 12px 0 8px 0; font-size: 0.9rem; font-weight: 700;">אימונים עתידיים מתוכננים:</h5>`;
          detailsHtml += futures.map(f => {
            const displayLoc = f.location === 'gym' ? 'חדר כושר 🏋️‍♂️' : (f.location === 'park' ? 'פארק 🌳' : f.location);
            return `
              <div class="future-workout-card">
                <div class="future-header">
                  <span>📅 אימון עתידי</span>
                  <span class="future-badge">${f.time}</span>
                </div>
                <div style="color: #e2e8f0; font-size: 0.85rem; margin-top: 4px;">
                  מיקום: <strong>${escapeHTML(displayLoc)}</strong>
                </div>
                <div style="color: var(--text-muted); font-size: 0.78rem; margin-top: 2px;">
                  תזכורת: ${f.reminderMinutes === 0 ? 'בדיוק בזמן' : (f.reminderMinutes === 60 ? 'שעה לפני' : (f.reminderMinutes === 180 ? '3 שעות לפני' : f.reminderMinutes + ' דקות לפני'))}
                </div>
                <button class="btn btn-secondary cancel-future-btn" data-id="${escapeHTML(f.id)}" style="width: 100%; margin-top: 8px; padding: 6px !important; font-size: 0.75rem !important; background: rgba(220,38,38,0.1) !important; border-color: rgba(220,38,38,0.2) !important; color: #fca5a5 !important;">❌ ביטול אימון</button>
              </div>
            `;
          }).join('');
        }

        const summaryAlert = document.createElement('div');
        summaryAlert.className = 'custom-calendar-alert-overlay';
        summaryAlert.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1600;';
        summaryAlert.innerHTML = `
          <div class="workout-modal-card glass-modal-card" style="max-width: 320px; width: 90%; border-radius: 20px; padding: 1.2rem; text-align: center; border: 1px solid rgba(255,255,255,0.08);">
            <h4 style="margin: 0 0 12px 0; font-size: 1.1rem; color: #fff; direction: rtl;">אימונים ב-${day}/${month + 1}/${year}</h4>
            <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
              ${detailsHtml}
            </div>
            <button class="btn btn-primary close-calendar-alert" style="width: 100%; padding: 10px; margin-top: 10px; border-radius: 10px;">סגור</button>
          </div>
        `;

        summaryAlert.querySelector('.close-calendar-alert').addEventListener('click', () => {
          summaryAlert.remove();
        });

        summaryAlert.querySelectorAll('.edit-past-workout-btn').forEach(btn => {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const wId = btn.dataset.id;
            openEditModal(wId);
            summaryAlert.remove();
          });
        });

        summaryAlert.querySelectorAll('.cancel-future-btn').forEach(btn => {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const fId = btn.dataset.id;
            let currentFutures = getFutureWorkouts();
            currentFutures = currentFutures.filter(x => x.id !== fId);
            saveFutureWorkouts(currentFutures);
            summaryAlert.remove();
            renderCalendarView();
          });
        });

        document.body.appendChild(summaryAlert);
      });
    }
    container.appendChild(dayCell);
  }
}

// GitHub Style Heatmap
export function renderHeatmapView() {
  const svg = document.getElementById('heatmap-svg');
  if (!svg) return;

  svg.innerHTML = '';

  const filtered = getFilteredHistory(true);
  const workoutsByDateStr = {};

  filtered.forEach(w => {
    const d = new Date(w.date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!workoutsByDateStr[dateStr]) workoutsByDateStr[dateStr] = 0;
    workoutsByDateStr[dateStr]++;
  });

  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 364);

  const startDay = startDate.getDay();
  startDate.setDate(startDate.getDate() - startDay);

  const rectSize = 10;
  const gap = 3;

  for (let week = 0; week < 53; week++) {
    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + (week * 7) + day);

      if (currentDate > now) continue;

      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      const count = workoutsByDateStr[dateStr] || 0;

      let color = 'rgba(255, 255, 255, 0.05)';
      if (count === 1) color = '#fca5a5';
      else if (count === 2) color = '#f87171';
      else if (count >= 3) color = '#dc2626';

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(week * (rectSize + gap)));
      rect.setAttribute('y', String(day * (rectSize + gap)));
      rect.setAttribute('width', String(rectSize));
      rect.setAttribute('height', String(rectSize));
      rect.setAttribute('rx', '2');
      rect.setAttribute('fill', color);
      
      // SVG ignores a `title` attribute; a <title> child element is what shows a tooltip.
      const formattedDate = currentDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
      const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      tooltip.textContent = `${formattedDate}: ${count} אימונים`;
      rect.appendChild(tooltip);

      rect.addEventListener('mouseover', () => {
        rect.setAttribute('stroke', '#ffffff');
        rect.setAttribute('stroke-width', '1');
      });
      rect.addEventListener('mouseout', () => {
        rect.removeAttribute('stroke');
      });

      svg.appendChild(rect);
    }
  }
}

// Muscle Splits Bar Graph
export function renderMuscleSplitView() {
  const container = document.getElementById('muscle-splits-container');
  const adviceEl = document.getElementById('muscle-recommendation-box');

  if (!container || !adviceEl) return;

  container.innerHTML = '';

  const filtered = getFilteredHistory(true);
  const volumeByMuscle = {
    'חזה': 0, 'גב': 0, 'כתפיים': 0, 'רגליים': 0, 'יד קדמית': 0, 'יד אחורית': 0, 'בטן וליבה': 0, 'אירובי': 0, 'אחר': 0
  };

  let totalOverallVolume = 0;

  filtered.forEach(w => {
    if (!w.exercises) return;
    w.exercises.forEach(ex => {
      let cat = 'אחר';
      const matched = getExerciseByName(ex.name);
      if (matched) cat = matched.category || 'אחר';

      if (!Array.isArray(ex.sets)) return;
      ex.sets.forEach(s => {
        if (s.completed) {
          const w = parseFloat(s.weight) || 0;
          const r = parseInt(s.reps, 10) || 0;
          const vol = w * r;

          if (volumeByMuscle[cat] !== undefined) {
            volumeByMuscle[cat] += vol;
            totalOverallVolume += vol;
          } else {
            volumeByMuscle['אחר'] += vol;
            totalOverallVolume += vol;
          }
        }
      });
    });
  });

  if (totalOverallVolume === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px; font-size: 0.9rem;">אין נתוני נפח שרירים מסוננים עדיין.</div>';
    adviceEl.textContent = 'בצע אימונים ורשום סטים כדי לקבל המלצות לאיזון שרירי.';
    return;
  }

  Object.keys(volumeByMuscle).forEach(muscle => {
    const vol = volumeByMuscle[muscle];
    if (vol === 0) return;

    const pct = Math.round((vol / totalOverallVolume) * 100);
    const barRow = document.createElement('div');
    barRow.className = 'muscle-split-row';
    barRow.style.cssText = 'margin-bottom: 12px;';

    barRow.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: #fff; margin-bottom: 4px; direction: rtl;">
        <span>${escapeHTML(muscle)}</span>
        <span>${pct}% (${vol.toLocaleString()} ק״ג)</span>
      </div>
      <div class="progress-bar-track" style="width: 100%; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
        <div class="progress-bar-fill" style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #ef4444, #dc2626); box-shadow: 0 0 8px rgba(220, 38, 38, 0.4); border-radius: 4px;"></div>
      </div>
    `;
    container.appendChild(barRow);
  });

  const legsPct = (volumeByMuscle['רגליים'] / totalOverallVolume) * 100;
  const chestPct = (volumeByMuscle['חזה'] / totalOverallVolume) * 100;
  const backPct = (volumeByMuscle['גב'] / totalOverallVolume) * 100;

  if (legsPct < 15) {
    adviceEl.innerHTML = `⚠️ <strong>הנחיית איזון:</strong> נפח אימוני הרגליים שלך נמוך יחסית לתא המותניים (${Math.round(legsPct)}%). מומלץ להוסיף סקוואט או מכרעים כדי למנוע חוסר איזון פיזיולוגי! 🦵`;
  } else if (Math.abs(chestPct - backPct) > 20) {
    adviceEl.innerHTML = '⚠️ <strong>הנחיית איזון:</strong> יש פער משמעותי בין נפח החזה לגב. הקפד על יחס שווה של לחיצות ומשיכות למניעת פציעות כתפיים ויציבה כפופה! 🦅🍒';
  } else {
    adviceEl.innerHTML = '✨ <strong>הנחיית איזון:</strong> כל הכבוד! חלוקת העומסים והנפח שלך מאוזנת ומקצועית ביותר. המשך ככה! 🏋️‍♂️🏆';
  }
}

export function renderAerobicAnalyticsCard(timeframe = '30') {
  const container = document.getElementById('analytics-aerobic-summary-view');
  if (!container) return;

  const now = new Date();
  let limitDate = null;
  let timeframeLabel = "כל הזמן";

  if (timeframe === '7') {
    limitDate = new Date();
    limitDate.setDate(now.getDate() - 7);
    timeframeLabel = "שבועי (7 ימים)";
  } else if (timeframe === '30') {
    limitDate = new Date();
    limitDate.setDate(now.getDate() - 30);
    timeframeLabel = "חודשי (30 ימים)";
  }

  // Filter workouts by date limit
  const workouts = state.workoutHistory.filter(w => {
    if (!limitDate) return true;
    return new Date(w.date) >= limitDate;
  });

  let totalRunDist = 0;
  let totalWalkDist = 0;
  let totalRunSec = 0;
  let totalWalkSec = 0;
  let totalRestSec = 0;

  workouts.forEach(w => {
    if (!w.exercises) return;
    w.exercises.forEach(ex => {
      if (ex.sets) {
        ex.sets.forEach(s => {
          if (s.completed && s.segments) {
            // It is a GPS-tracked exercise set
            totalRunDist += (s.runDistance || 0);
            totalWalkDist += (s.walkDistance || 0);
            totalRunSec += (s.runDuration || 0);
            totalWalkSec += (s.walkDuration || 0);
            totalRestSec += (s.restDuration || 0);
          }
        });
      }
    });
  });

  const totalDist = totalRunDist + totalWalkDist;
  const totalSec = totalRunSec + totalWalkSec + totalRestSec;

  const totalDistKm = (totalDist / 1000).toFixed(2);
  const runDistKm = (totalRunDist / 1000).toFixed(2);
  const walkDistKm = (totalWalkDist / 1000).toFixed(2);

  const formatHrsMins = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs} ש׳ ${mins} דק׳`;
    }
    return `${mins} דק׳`;
  };

  const totalTimeStr = formatHrsMins(totalSec);
  const runTimeStr = formatHrsMins(totalRunSec);
  const walkTimeStr = formatHrsMins(totalWalkSec);
  const restTimeStr = formatHrsMins(totalRestSec);

  // Percentages for splits
  const runPct = totalDist > 0 ? Math.round((totalRunDist / totalDist) * 100) : 0;
  const walkPct = totalDist > 0 ? Math.round((totalWalkDist / totalDist) * 100) : 0;

  const runTimePct = totalSec > 0 ? Math.round((totalRunSec / totalSec) * 100) : 0;
  const walkTimePct = totalSec > 0 ? Math.round((totalWalkSec / totalSec) * 100) : 0;
  const restTimePct = totalSec > 0 ? Math.round((totalRestSec / totalSec) * 100) : 0;

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; direction: rtl;">
      <h3 style="margin: 0; font-size: 1rem; font-weight: 800; color: #ffffff;">🏃‍♂️ סיכום פעילות אירובית (${timeframeLabel})</h3>
      
      <!-- Timeframe Toggle Pills -->
      <div style="display: flex; gap: 4px; background: rgba(255,255,255,0.05); padding: 2px; border-radius: 8px;">
        <button class="aerobic-tf-btn ${timeframe === '7' ? 'active' : ''}" data-tf="7" style="padding: 4px 8px; font-size: 0.7rem; border-radius: 6px; border: none; background: ${timeframe === '7' ? 'var(--electric-blue-light)' : 'transparent'}; color: #fff; cursor: pointer; font-weight: bold; font-family: var(--font-sans);">7 ימים</button>
        <button class="aerobic-tf-btn ${timeframe === '30' ? 'active' : ''}" data-tf="30" style="padding: 4px 8px; font-size: 0.7rem; border-radius: 6px; border: none; background: ${timeframe === '30' ? 'var(--electric-blue-light)' : 'transparent'}; color: #fff; cursor: pointer; font-weight: bold; font-family: var(--font-sans);">30 ימים</button>
        <button class="aerobic-tf-btn ${timeframe === 'all' ? 'active' : ''}" data-tf="all" style="padding: 4px 8px; font-size: 0.7rem; border-radius: 6px; border: none; background: ${timeframe === 'all' ? 'var(--electric-blue-light)' : 'transparent'}; color: #fff; cursor: pointer; font-weight: bold; font-family: var(--font-sans);">הכל</button>
      </div>
    </div>

    ${totalDist === 0 && totalSec === 0 ? `
      <div style="color: var(--text-muted); text-align: center; padding: 20px; font-size: 0.85rem; direction: rtl;">
        אין נתוני פעילות אירובית מתועדת ב-GPS בטווח זמן זה.
      </div>
    ` : `
      <div style="direction: rtl; text-align: right; display: flex; flex-direction: column; gap: 14px;">
        <!-- Overview Stats Row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: rgba(255,255,255,0.02); padding: 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.04);">
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">מרחק מצטבר</span>
            <div style="font-size: 1.25rem; font-weight: 900; color: var(--electric-blue-light);">${totalDistKm} ק״מ</div>
          </div>
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">זמן אירובי כולל</span>
            <div style="font-size: 1.25rem; font-weight: 900; color: #fff;">${totalTimeStr}</div>
          </div>
        </div>

        <!-- Splits / Percentages Bars -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <span style="font-size: 0.78rem; font-weight: 700; color: #fff;">חלוקת מרחקים:</span>
          
          <!-- Run Split -->
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #e2e8f0; margin-bottom: 2px;">
              <span>🏃‍♂️ ריצה: ${runDistKm} ק״מ</span>
              <span>${runPct}%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
              <div style="width: ${runPct}%; height: 100%; background: #ef4444; border-radius: 3px;"></div>
            </div>
          </div>

          <!-- Walk Split -->
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #e2e8f0; margin-bottom: 2px;">
              <span>🚶‍♂️ הליכה: ${walkDistKm} ק״מ</span>
              <span>${walkPct}%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
              <div style="width: ${walkPct}%; height: 100%; background: #10b981; border-radius: 3px;"></div>
            </div>
          </div>
        </div>

        <!-- Time distribution breakdown -->
        <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
          <span style="font-size: 0.78rem; font-weight: 700; color: #fff;">חלוקת זמנים (ריצה/הליכה/מנוחה):</span>
          
          <div style="display: flex; width: 100%; height: 10px; background: rgba(255,255,255,0.05); border-radius: 5px; overflow: hidden; margin-bottom: 6px;">
            <div style="width: ${runTimePct}%; height: 100%; background: #ef4444;" title="ריצה"></div>
            <div style="width: ${walkTimePct}%; height: 100%; background: #10b981;" title="הליכה"></div>
            <div style="width: ${restTimePct}%; height: 100%; background: #f59e0b;" title="מנוחה"></div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; text-align: center; font-size: 0.7rem;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ef4444;"></span>
              <span style="color: var(--text-muted);">ריצה:</span> <strong style="color: #fff;">${runTimeStr}</strong>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span>
              <span style="color: var(--text-muted);">הליכה:</span> <strong style="color: #fff;">${walkTimeStr}</strong>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #f59e0b;"></span>
              <span style="color: var(--text-muted);">מנוחה:</span> <strong style="color: #fff;">${restTimeStr}</strong>
            </div>
          </div>
        </div>
      </div>
    `}
  `;

  // Attach click listeners to timeframe toggle buttons inside the card
  container.querySelectorAll('.aerobic-tf-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tf = btn.getAttribute('data-tf');
      state.aerobicTimeSelection = tf;
      renderAerobicAnalyticsCard(tf);
    });
  });
}

window.renderAerobicAnalyticsCard = renderAerobicAnalyticsCard;

// NOTE: renderAccordionHistoryView() + formatExerciseSetsText() were removed in v1.9.0 —
// they targeted #accordion-history-container, which no longer exists in index.html.

// Leaflet History Maps Logic
let fullscreenMapInstance = null;

export function initHistoryMaps(container) {
  const mapElements = container.querySelectorAll('.history-map-element');
  mapElements.forEach(el => {
    if (el._leaflet_map) {
      el._leaflet_map.invalidateSize();
      return;
    }

    const segmentsData = el.getAttribute('data-segments');
    if (!segmentsData) return;

    let segments = [];
    try {
      segments = JSON.parse(segmentsData);
    } catch (e) {
      console.error("Failed to parse map segments", e);
      return;
    }

    if (typeof L === 'undefined') {
      console.warn("Leaflet.js is not loaded");
      return;
    }

    const map = L.map(el.id, {
      zoomControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      dragging: false,
      touchZoom: false,
      boxZoom: false
    });

    el._leaflet_map = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    const bounds = [];
    segments.forEach(segment => {
      if (segment.coords && segment.coords.length > 1) {
        let color = '#ef4444'; // default run (Molten Red)
        if (segment.state === 'walk') color = '#10b981'; // Green
        else if (segment.state === 'rest') color = '#f59e0b'; // Amber/Yellow

        L.polyline(segment.coords, {
          color: color,
          weight: 4,
          opacity: 0.9,
          lineJoin: 'round'
        }).addTo(map);

        segment.coords.forEach(coord => {
          bounds.push(coord);
        });
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [10, 10] });
    } else {
      map.setView([31.5, 34.8], 8);
    }

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openHistoryMapFullscreen(segments);
    });
  });
}

export function openHistoryMapFullscreen(segments) {
  let overlay = document.getElementById('history-fullscreen-map-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'history-fullscreen-map-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); display: flex; flex-direction: column; z-index: 2000;';
    overlay.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(20,20,24,0.9); border-bottom: 1px solid rgba(255,255,255,0.05); direction: rtl; flex-shrink: 0;">
        <span style="font-weight: 800; color: #fff; font-size: 1rem;">מסלול אימון</span>
        <button id="close-history-fullscreen-map" style="background: none; border: none; color: #ef4444; font-size: 1.5rem; cursor: pointer; padding: 4px 10px; font-weight: bold;">✕</button>
      </div>
      <div id="history-fullscreen-map" style="flex: 1; width: 100%;"></div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById('close-history-fullscreen-map').addEventListener('click', () => {
      closeHistoryMapFullscreen();
    });
  }

  overlay.style.display = 'flex';

  if (typeof L === 'undefined') {
    console.warn("Leaflet.js is not loaded");
    return;
  }

  if (fullscreenMapInstance) {
    fullscreenMapInstance.remove();
  }

  fullscreenMapInstance = L.map('history-fullscreen-map', {
    zoomControl: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    dragging: true
  }).setView([31.5, 34.8], 8);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(fullscreenMapInstance);

  const bounds = [];
  segments.forEach(segment => {
    if (segment.coords && segment.coords.length > 1) {
      let color = '#ef4444';
      if (segment.state === 'walk') color = '#10b981';
      else if (segment.state === 'rest') color = '#f59e0b';

      L.polyline(segment.coords, {
        color: color,
        weight: 6,
        opacity: 0.9,
        lineJoin: 'round'
      }).addTo(fullscreenMapInstance);

      segment.coords.forEach(coord => {
        bounds.push(coord);
      });
    }
  });

  if (bounds.length > 0) {
    fullscreenMapInstance.fitBounds(bounds, { padding: [20, 20] });
  }

  setTimeout(() => {
    if (fullscreenMapInstance) {
      fullscreenMapInstance.invalidateSize();
      if (bounds.length > 0) {
        fullscreenMapInstance.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, 150);
}

export function closeHistoryMapFullscreen() {
  const overlay = document.getElementById('history-fullscreen-map-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
  if (fullscreenMapInstance) {
    fullscreenMapInstance.remove();
    fullscreenMapInstance = null;
  }
}

window.initHistoryMaps = initHistoryMaps;
window.openHistoryMapFullscreen = openHistoryMapFullscreen;
window.closeHistoryMapFullscreen = closeHistoryMapFullscreen;

const CSS_STYLES = `
/* Premium Glassmorphic Workout Cards Styles */
.premium-workout-card {
  background: rgba(20, 20, 24, 0.65) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  border-radius: 20px !important;
  padding: 1.25rem !important;
  cursor: pointer !important;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease !important;
  direction: rtl !important;
  text-align: right !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
  backdrop-filter: blur(12px) !important;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.03), 0 8px 32px rgba(0, 0, 0, 0.4) !important;
}

.premium-workout-card:hover {
  background: rgba(255, 255, 255, 0.04) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  transform: translateY(-2px) !important;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 12px 40px rgba(0, 0, 0, 0.5) !important;
}

.premium-workout-card.expanded {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.03), 0 16px 48px rgba(0, 0, 0, 0.6) !important;
}

.premium-workout-card.expanded:hover {
  transform: none !important;
}

.premium-compact-info-bar {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  border-radius: 12px !important;
  padding: 8px 12px !important;
  font-size: 0.8rem !important;
  font-weight: 600 !important;
  color: var(--text-main) !important;
  direction: rtl !important;
  backdrop-filter: blur(8px) !important;
  flex-wrap: wrap !important;
  gap: 8px 12px !important;
}

.premium-info-item {
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
}

.premium-info-icon {
  opacity: 0.85 !important;
}

.premium-info-text {
  color: #e2e8f0 !important;
}

.premium-info-divider {
  width: 1px !important;
  height: 12px !important;
  background: rgba(255, 255, 255, 0.1) !important;
}

.premium-muscle-badge {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 3px 10px !important;
  border-radius: 20px !important;
  font-size: 0.72rem !important;
  font-weight: 800 !important;
  color: #ffffff !important;
  cursor: pointer !important;
  transition: all 0.2s ease, box-shadow 0.2s ease !important;
  backdrop-filter: blur(6px) !important;
  white-space: nowrap !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
}

.premium-muscle-badge:hover {
  transform: scale(1.05) !important;
}

/* Premium Exercise Card inside Expanded details */
.premium-exercise-card {
  background: rgba(255, 255, 255, 0.015) !important;
  border: 1px solid rgba(255, 255, 255, 0.04) !important;
  border-radius: 16px !important;
  padding: 14px 16px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
  backdrop-filter: blur(10px) !important;
  transition: all 0.3s ease !important;
  cursor: pointer !important;
}

.premium-exercise-card:hover {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.07) !important;
}

.premium-exercise-header {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
  padding-bottom: 8px !important;
}

.premium-exercise-info {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.premium-exercise-name {
  font-size: 0.95rem !important;
  font-weight: 800 !important;
  color: #ffffff !important;
}

.premium-exercise-cat-badge {
  font-size: 0.68rem !important;
  font-weight: 800 !important;
  padding: 2px 6px !important;
  border-radius: 6px !important;
}

.premium-exercise-stats-grid {
  display: grid !important;
  grid-template-columns: auto 1fr !important;
  gap: 16px !important;
  align-items: center !important;
}

@media (max-width: 380px) {
  .premium-exercise-stats-grid {
    grid-template-columns: 1fr !important;
  }
}

.premium-exercise-rings-panel {
  display: flex !important;
  gap: 16px !important;
  justify-content: center !important;
  align-items: center !important;
}

.premium-ring-wrapper {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 4px !important;
}

.premium-ring-svg {
  overflow: visible !important;
}

.premium-ring-label-text {
  font-size: 0.68rem !important;
  font-weight: 700 !important;
  color: var(--text-muted) !important;
}

.premium-ring-pr-text {
  font-size: 0.62rem !important;
  font-weight: 600 !important;
  color: var(--text-muted) !important;
  opacity: 0.8 !important;
}

.premium-exercise-comparison-panel {
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
}

/* Horizontal line graph comparison */
.premium-comparison-bar-row {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
}

.premium-comparison-meta {
  display: flex !important;
  justify-content: space-between !important;
  font-size: 0.76rem !important;
  font-weight: 700 !important;
}

.premium-comparison-label {
  color: #cbd5e1 !important;
}

.premium-comparison-delta {
  font-size: 0.72rem !important;
  font-weight: 800 !important;
  padding: 1px 6px !important;
  border-radius: 6px !important;
}

.premium-comparison-delta.delta-plus {
  background: rgba(48, 209, 88, 0.15) !important;
  color: #30d158 !important;
}

.premium-comparison-delta.delta-minus {
  background: rgba(255, 69, 58, 0.15) !important;
  color: #ff453a !important;
}

.premium-comparison-delta.delta-neutral {
  background: rgba(59, 130, 246, 0.15) !important;
  color: #60a5fa !important;
}

.premium-comparison-track {
  position: relative !important;
  width: 100% !important;
  height: 8px !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border-radius: 4px !important;
  overflow: visible !important;
}

.premium-comparison-fill {
  height: 100% !important;
  border-radius: 4px !important;
  transition: width 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
}

.premium-comparison-marker {
  position: absolute !important;
  top: -2px;
  width: 4px !important;
  height: 12px !important;
  background: #ffffff !important;
  border-radius: 2px !important;
  box-shadow: 0 0 6px #ffffff !important;
  transform: translateX(-50%) !important;
  z-index: 2 !important;
}

.premium-comparison-values {
  display: flex !important;
  justify-content: space-between !important;
  font-size: 0.7rem !important;
  color: var(--text-muted) !important;
  font-weight: 600 !important;
  margin-top: 2px !important;
}

/* Stylized sets capsule container */
.premium-exercise-sets-section {
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
  border-top: 1px solid rgba(255, 255, 255, 0.04) !important;
  padding-top: 10px !important;
}

.premium-exercise-sets-title {
  font-size: 0.76rem !important;
  font-weight: 700 !important;
  color: var(--text-muted) !important;
}

.premium-exercise-sets-container {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 8px !important;
  direction: rtl !important;
}

.premium-set-capsule {
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  border-radius: 30px !important;
  padding: 4px 10px 4px 12px !important;
  font-size: 0.8rem !important;
  font-weight: 700 !important;
  backdrop-filter: blur(8px) !important;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 2px 4px rgba(0, 0, 0, 0.2) !important;
  transition: all 0.2s ease !important;
}

.premium-set-capsule:hover {
  transform: translateY(-1px) !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.premium-set-badge {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 18px !important;
  height: 18px !important;
  border-radius: 50% !important;
  color: #ffffff !important;
  font-size: 0.68rem !important;
  font-weight: 900 !important;
}

.premium-set-content {
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
  color: #f1f5f9 !important;
}

.premium-set-val-neon {
  font-weight: 800 !important;
}

.premium-set-unit {
  font-size: 0.72rem !important;
  color: var(--text-muted) !important;
  font-weight: 600 !important;
}

/* Bottom Muscle Splits breakdown */
.premium-muscle-breakdown-card {
  background: rgba(255, 255, 255, 0.02) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  border-radius: 16px !important;
  padding: 14px 16px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
  backdrop-filter: blur(8px) !important;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05) !important;
  margin-top: 8px !important;
}

.premium-muscle-breakdown-title {
  font-size: 0.88rem !important;
  font-weight: 800 !important;
  color: #ffffff !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
  padding-bottom: 8px !important;
}

.premium-muscle-breakdown-grid {
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
}

.premium-muscle-split-row {
  display: flex !important;
  flex-direction: column !important;
  gap: 6px !important;
}

.premium-muscle-split-meta {
  display: flex !important;
  justify-content: space-between !important;
  font-size: 0.8rem !important;
  align-items: center !important;
}

.premium-muscle-split-track {
  width: 100% !important;
  height: 6px !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border-radius: 3px !important;
  overflow: hidden !important;
}

.premium-muscle-split-fill {
  height: 100% !important;
  border-radius: 3px !important;
  transition: width 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
}

/* Accordion Active Filter Pill Glow */
.filter-pill-btn.active-filter {
  background: rgba(0, 240, 255, 0.05) !important;
  border-color: rgba(0, 240, 255, 0.25) !important;
  color: #00f0ff !important;
}

/* Exercise Accordion layout */
.premium-exercise-card {
  padding: 0 !important;
  overflow: hidden !important;
  transition: border-color 0.25s ease !important;
}

.premium-exercise-accordion-header {
  padding: 12px 16px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  background: rgba(255, 255, 255, 0.015) !important;
  transition: background 0.2s ease !important;
  user-select: none !important;
  cursor: pointer !important;
}

.premium-exercise-accordion-header:hover {
  background: rgba(255, 255, 255, 0.035) !important;
}

.premium-exercise-accordion-info {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
  flex-grow: 1 !important;
  text-align: right !important;
}

.premium-exercise-name-row {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  flex-wrap: wrap !important;
}

.premium-exercise-sets-summary-row {
  font-size: 0.74rem !important;
  color: var(--text-muted) !important;
  font-weight: 600 !important;
  direction: rtl !important;
  text-align: right !important;
  line-height: 1.3 !important;
}

.premium-exercise-chevron {
  font-size: 0.75rem !important;
  color: var(--text-muted) !important;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
  margin-left: 4px !important;
}

.premium-exercise-card.accordion-expanded .premium-exercise-chevron {
  transform: rotate(180deg) !important;
  color: var(--electric-blue-light) !important;
}

.premium-exercise-details-collapse {
  max-height: 0 !important;
  opacity: 0 !important;
  overflow: hidden !important;
  transition: max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease !important;
  border-top: 1px dashed rgba(255, 255, 255, 0.04) !important;
}

.premium-exercise-card.accordion-expanded .premium-exercise-details-collapse {
  max-height: 1200px !important;
  opacity: 1 !important;
}

.premium-exercise-details-content {
  padding: 14px 16px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
}
`;



const categoryColorMap = {
  'חזה': { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
  'דחיפה': { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
  'גב': { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  'מתח': { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  'כתפיים': { color: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
  'רגליים': { color: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)' },
  'יד קדמית': { color: '#fb923c', glow: 'rgba(251, 146, 60, 0.4)' },
  'יד אחורית': { color: '#fb923c', glow: 'rgba(251, 146, 60, 0.4)' },
  'ידיים': { color: '#fb923c', glow: 'rgba(251, 146, 60, 0.4)' },
  'בטן': { color: '#facc15', glow: 'rgba(250, 204, 21, 0.4)' },
  'ליבה': { color: '#facc15', glow: 'rgba(250, 204, 21, 0.4)' },
  'בטן וליבה': { color: '#facc15', glow: 'rgba(250, 204, 21, 0.4)' },
  'ליבה ואירובי': { color: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.4)' },
  'אירובי': { color: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.4)' },
  'מותאם אישית': { color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)' },
  'אחר': { color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.4)' }
};

export function getMuscleCategoryStyle(cat) {
  const norm = (cat || '').trim();
  if (categoryColorMap[norm]) {
    return categoryColorMap[norm];
  }
  if (norm.includes('חזה') || norm.includes('דחיפה')) return categoryColorMap['חזה'];
  if (norm.includes('גב') || norm.includes('מתח')) return categoryColorMap['גב'];
  if (norm.includes('כתף') || norm.includes('כתפיים')) return categoryColorMap['כתפיים'];
  if (norm.includes('רגל') || norm.includes('רגליים')) return categoryColorMap['רגליים'];
  if (norm.includes('יד קדמית')) return categoryColorMap['יד קדמית'];
  if (norm.includes('יד אחורית')) return categoryColorMap['יד אחורית'];
  if (norm.includes('יד') || norm.includes('ידיים')) return categoryColorMap['יד קדמית'];
  if (norm.includes('בטן') || norm.includes('ליבה')) return categoryColorMap['בטן וליבה'];
  if (norm.includes('אירובי') || norm.includes('סיבולת')) return categoryColorMap['אירובי'];
  return categoryColorMap['אחר'];
}

export function renderProgressRing(pct, peakVal, unit, label, allTimePR, color, glow) {
  const r = 22;
  const c = 2 * Math.PI * r; // 138.23
  const strokeDashoffset = c - (c * Math.min(100, Math.max(0, pct))) / 100;
  return `
    <div class="premium-ring-wrapper">
      <svg class="premium-ring-svg" width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r="${r}" fill="none" stroke="rgba(255, 255, 255, 0.05)" stroke-width="3.5" />
        <circle cx="30" cy="30" r="${r}" fill="none" stroke="${color}" stroke-width="3.5" 
          stroke-dasharray="${c}" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round"
          transform="rotate(-90 30 30)" style="filter: drop-shadow(0 0 5px ${glow}); transition: stroke-dashoffset 0.6s ease-in-out;" />
        <text x="30" y="31" font-family="var(--font-sans)" font-size="11" font-weight="900" text-anchor="middle" fill="#ffffff">${peakVal}</text>
        <text x="30" y="42" font-family="var(--font-sans)" font-size="7" font-weight="700" text-anchor="middle" fill="var(--text-muted)">${unit}</text>
      </svg>
      <div class="premium-ring-label-text">${label}</div>
      <div class="premium-ring-pr-text">שיא: ${allTimePR} ${unit}</div>
    </div>
  `;
}

export function renderComparisonBar(currentVal, prevVal, allTimePR, unit, label, color, glow, hasPrev) {
  let deltaText = 'חדש! 🔥';
  let deltaClass = 'delta-neutral';
  let barColor = '#00F0FF';
  let barGlow = 'rgba(0, 240, 255, 0.4)';
  let diff = 0;

  if (hasPrev) {
    diff = currentVal - prevVal;
    if (diff > 0) {
      deltaText = `+${diff} ${unit} 📈`;
      deltaClass = 'delta-plus';
      barColor = '#22c55e'; // Green
      barGlow = 'rgba(34, 197, 94, 0.4)';
    } else if (diff < 0) {
      deltaText = `${diff} ${unit} 📉`;
      deltaClass = 'delta-minus';
      barColor = '#ef4444'; // Red
      barGlow = 'rgba(239, 68, 68, 0.4)';
    } else {
      deltaText = 'ללא שינוי';
      deltaClass = 'delta-neutral';
      barColor = '#3b82f6'; // Blue / neutral
      barGlow = 'rgba(59, 130, 246, 0.4)';
    }
  }

  // Percentages relative to all-time PR
  const currentPct = allTimePR > 0 ? Math.min(100, Math.round((currentVal / allTimePR) * 100)) : 100;
  const previousPct = allTimePR > 0 && hasPrev ? Math.min(100, Math.round((prevVal / allTimePR) * 100)) : 0;

  const markerHtml = (hasPrev && previousPct > 0) ? `
    <div class="premium-comparison-marker" style="left: ${previousPct}%;" title="אימון קודם: ${prevVal} ${unit}"></div>
  ` : '';

  const prevText = hasPrev ? `${prevVal} ${unit}` : '--';

  return `
    <div class="premium-comparison-bar-row">
      <div class="premium-comparison-meta">
        <span class="premium-comparison-label">${label}</span>
        <span class="premium-comparison-delta ${deltaClass}">${deltaText}</span>
      </div>
      <div class="premium-comparison-track">
        <div class="premium-comparison-fill" style="width: ${currentPct}%; background-color: ${barColor}; box-shadow: 0 0 8px ${barGlow};"></div>
        ${markerHtml}
      </div>
      <div class="premium-comparison-values">
        <span>קודם: ${prevText}</span>
        <span>נוכחי: ${currentVal} ${unit}</span>
      </div>
    </div>
  `;
}

// Helper to update filter pills text on workouts tab
export function updateFilterPillsText() {
  const pillLoc = document.getElementById('pill-location');
  const pillDate = document.getElementById('pill-date');
  const pillMuscle = document.getElementById('pill-muscle');
  const pillSort = document.getElementById('pill-sort');

  if (pillLoc) {
    const label = pillLoc.querySelector('.pill-label');
    if (label) {
      if (state.filterLocation === 'all') {
        label.textContent = '📍 מיקום: הכל';
        pillLoc.classList.remove('active-filter');
      } else if (state.filterLocation === 'gym') {
        label.textContent = '🏋️‍♂️ חדר כושר';
        pillLoc.classList.add('active-filter');
      } else if (state.filterLocation === 'park') {
        label.textContent = '🌳 פארק';
        pillLoc.classList.add('active-filter');
      } else {
        const found = state.customLocations.find(l => l.id === state.filterLocation);
        label.textContent = found ? `${found.emoji || '💪'} ${found.name}` : '📍 מיקום מותאם';
        pillLoc.classList.add('active-filter');
      }
    }
  }

  if (pillDate) {
    const label = pillDate.querySelector('.pill-label');
    if (label) {
      if (state.filterTimeSelection === 'all') {
        label.textContent = '📅 תאריך: הכל';
        pillDate.classList.remove('active-filter');
      } else if (state.filterTimeSelection === '7') {
        label.textContent = '📅 7 ימים אחרונים';
        pillDate.classList.add('active-filter');
      } else if (state.filterTimeSelection === '30') {
        label.textContent = '📅 30 ימים אחרונים';
        pillDate.classList.add('active-filter');
      } else if (state.filterTimeSelection === 'custom') {
        const startVal = state.filterStartDate ? `${state.filterStartDate.getDate()}/${state.filterStartDate.getMonth() + 1}` : 'התחלה';
        const endVal = state.filterEndDate ? `${state.filterEndDate.getDate()}/${state.filterEndDate.getMonth() + 1}` : 'סוף';
        label.textContent = `📅 ${startVal} - ${endVal}`;
        pillDate.classList.add('active-filter');
      }
    }
  }

  if (pillMuscle) {
    const label = pillMuscle.querySelector('.pill-label');
    if (label) {
      if (state.filterMuscleGroup === 'all') {
        label.textContent = '💪 שריר: הכל';
        pillMuscle.classList.remove('active-filter');
      } else {
        label.textContent = `💪 שריר: ${state.filterMuscleGroup}`;
        pillMuscle.classList.add('active-filter');
      }
    }
  }

  if (pillSort) {
    const label = pillSort.querySelector('.pill-label');
    if (label) {
      if (state.filterSortSelection === 'date-desc') {
        label.textContent = '⏱️ כרונולוגי';
        pillSort.classList.remove('active-filter');
      } else if (state.filterSortSelection === 'prs-first') {
        label.textContent = '🏆 שיאים אישיים';
        pillSort.classList.add('active-filter');
      } else if (state.filterSortSelection === 'volume-desc') {
        label.textContent = '📊 נפח עבודה';
        pillSort.classList.add('active-filter');
      }
    }
  }
}

// Helper to populate custom dropdown options
export function populateFilterDropdown(category, container, pill) {
  if (category === 'location') {
    const originalSelect = document.getElementById('filter-location-select');
    if (!originalSelect) return;
    
    Array.from(originalSelect.options).forEach(opt => {
      const optionEl = document.createElement('div');
      optionEl.className = `filter-dropdown-option ${state.filterLocation === opt.value ? 'selected' : ''}`;
      optionEl.innerHTML = `
        <span>${escapeHTML(opt.text)}</span>
        ${state.filterLocation === opt.value ? '<span class="filter-dropdown-option-check">✓</span>' : ''}
      `;
      optionEl.addEventListener('click', () => {
        state.filterLocation = opt.value;
        originalSelect.value = opt.value;
        originalSelect.dispatchEvent(new Event('change'));
        container.classList.add('hide');
        pill.classList.remove('active');
      });
      container.appendChild(optionEl);
    });
  } else if (category === 'date') {
    const options = [
      { value: 'all', text: 'הכל 📅' },
      { value: '7', text: '7 ימים אחרונים ⏱️' },
      { value: '30', text: '30 ימים אחרונים ⏱️' },
      { value: 'custom', text: 'טווח מותאם אישית... 📅' }
    ];

    options.forEach(opt => {
      const optionEl = document.createElement('div');
      optionEl.className = `filter-dropdown-option ${state.filterTimeSelection === opt.value ? 'selected' : ''}`;
      optionEl.innerHTML = `
        <span>${escapeHTML(opt.text)}</span>
        ${state.filterTimeSelection === opt.value ? '<span class="filter-dropdown-option-check">✓</span>' : ''}
      `;
      optionEl.addEventListener('click', (e) => {
        if (opt.value === 'custom') {
          e.stopPropagation();
          renderCustomDateSelectors(container, pill);
        } else {
          state.filterTimeSelection = opt.value;
          renderAnalytics();
          container.classList.add('hide');
          pill.classList.remove('active');
        }
      });
      container.appendChild(optionEl);
    });
  } else if (category === 'muscle') {
    const originalSelect = document.getElementById('filter-muscle-select');
    if (!originalSelect) return;
    
    Array.from(originalSelect.options).forEach(opt => {
      const optionEl = document.createElement('div');
      optionEl.className = `filter-dropdown-option ${state.filterMuscleGroup === opt.value ? 'selected' : ''}`;
      optionEl.innerHTML = `
        <span>${escapeHTML(opt.text)}</span>
        ${state.filterMuscleGroup === opt.value ? '<span class="filter-dropdown-option-check">✓</span>' : ''}
      `;
      optionEl.addEventListener('click', () => {
        state.filterMuscleGroup = opt.value;
        originalSelect.value = opt.value;
        originalSelect.dispatchEvent(new Event('change'));
        container.classList.add('hide');
        pill.classList.remove('active');
      });
      container.appendChild(optionEl);
    });
  } else if (category === 'sort') {
    const originalSelect = document.getElementById('filter-sort-select');
    if (!originalSelect) return;
    
    Array.from(originalSelect.options).forEach(opt => {
      const optionEl = document.createElement('div');
      optionEl.className = `filter-dropdown-option ${state.filterSortSelection === opt.value ? 'selected' : ''}`;
      optionEl.innerHTML = `
        <span>${escapeHTML(opt.text)}</span>
        ${state.filterSortSelection === opt.value ? '<span class="filter-dropdown-option-check">✓</span>' : ''}
      `;
      optionEl.addEventListener('click', () => {
        state.filterSortSelection = opt.value;
        originalSelect.value = opt.value;
        renderAnalytics();
        container.classList.add('hide');
        pill.classList.remove('active');
      });
      container.appendChild(optionEl);
    });
  }
}

export function populateExercisesFilterDropdown(category, container, pill) {
  let originalSelectId = '';
  let selectedValue = '';
  
  if (category === 'muscle') {
    originalSelectId = 'exercises-muscle-filter-tab3';
  } else if (category === 'type') {
    originalSelectId = 'exercises-type-filter-tab3';
  } else if (category === 'usage') {
    originalSelectId = 'exercises-usage-filter-tab3';
  } else if (category === 'favorite') {
    originalSelectId = 'exercises-favorite-filter-tab3';
  }

  const originalSelect = document.getElementById(originalSelectId);
  if (!originalSelect) return;

  selectedValue = originalSelect.value;

  Array.from(originalSelect.options).forEach(opt => {
    const optionEl = document.createElement('div');
    optionEl.className = `filter-dropdown-option ${selectedValue === opt.value ? 'selected' : ''}`;
    optionEl.innerHTML = `
      <span>${escapeHTML(opt.text)}</span>
      ${selectedValue === opt.value ? '<span class="filter-dropdown-option-check">✓</span>' : ''}
    `;
    optionEl.addEventListener('click', () => {
      originalSelect.value = opt.value;
      originalSelect.dispatchEvent(new Event('change'));
      
      const pillLabel = pill.querySelector('.pill-label');
      if (pillLabel) {
        let prefix = '💪 שריר: ';
        if (category === 'type') prefix = '🧩 סוג: ';
        if (category === 'usage') prefix = '🔄 שימוש: ';
        if (category === 'favorite') prefix = '⭐ מועדפים: ';
        
        let cleanedText = opt.text;
        if (category === 'muscle') {
          if (opt.value === 'all') cleanedText = 'הכל';
          else cleanedText = cleanedText.replace(/[💪🍒🦅🛡️🦵🧘‍♂️🏃‍♂️🧩]/g, '').trim();
        } else if (category === 'type') {
          if (opt.value === 'all') cleanedText = 'הכל';
          else cleanedText = cleanedText.replace(/[🧩🏛️✨]/g, '').trim();
        } else if (category === 'usage') {
          if (opt.value === 'all') cleanedText = 'הכל';
          else cleanedText = cleanedText.replace(/[🔄🏋️‍♂️⏱️💤]/g, '').trim();
        } else if (category === 'favorite') {
          if (opt.value === 'all') cleanedText = 'הכל';
          else cleanedText = cleanedText.replace(/[⭐]/g, '').trim();
        }
        
        pillLabel.textContent = `${prefix}${cleanedText}`;
      }
      
      container.classList.add('hide');
      pill.classList.remove('active');
    });
    container.appendChild(optionEl);
  });
}

// Helper to render custom date selectors inside dropdown
export function renderCustomDateSelectors(container, pill) {
  container.innerHTML = '';

  const title = document.createElement('div');
  title.style.cssText = 'font-size: 0.85rem; font-weight: bold; padding: 6px 12px; color: var(--text-muted); text-align: right; direction: rtl;';
  title.textContent = 'בחר טווח תאריכים:';
  container.appendChild(title);

  const form = document.createElement('div');
  form.className = 'filter-dropdown-custom-dates';
  form.style.cssText = 'direction: rtl;';

  const startD = document.getElementById('filter-start-date');
  const endD = document.getElementById('filter-end-date');
  
  const startVal = startD ? startD.value : '';
  const endVal = endD ? endD.value : '';

  form.innerHTML = `
    <div class="filter-dropdown-custom-dates-inputs">
      <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; text-align: right;">
        <span style="font-size: 0.75rem; color: var(--text-muted);">מתאריך:</span>
        <input type="date" id="dropdown-start-date" value="${startVal}">
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; text-align: right;">
        <span style="font-size: 0.75rem; color: var(--text-muted);">עד תאריך:</span>
        <input type="date" id="dropdown-end-date" value="${endVal}">
      </div>
    </div>
    <button class="filter-dropdown-apply-btn" style="margin-top: 8px;">החל סינון</button>
  `;

  form.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  const applyBtn = form.querySelector('.filter-dropdown-apply-btn');
  applyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const inputStart = document.getElementById('dropdown-start-date');
    const inputEnd = document.getElementById('dropdown-end-date');

    if (startD) {
      startD.value = inputStart.value;
      state.filterStartDate = inputStart.value ? new Date(inputStart.value) : null;
    }
    if (endD) {
      endD.value = inputEnd.value;
      state.filterEndDate = inputEnd.value ? new Date(inputEnd.value) : null;
    }

    state.filterTimeSelection = 'custom';
    renderAnalytics();
    container.classList.add('hide');
    pill.classList.remove('active');
  });

  container.appendChild(form);
}

// Workouts Chronological Card list
export function renderWorkoutsLog() {
  const container = document.getElementById('workouts-log-container');
  if (!container) return;

  // Update filter pill labels
  updateFilterPillsText();

  container.innerHTML = '';

  // Inject CSS Styles if not already present
  if (!document.getElementById('premium-workout-log-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'premium-workout-log-styles';
    styleEl.textContent = CSS_STYLES;
    document.head.appendChild(styleEl);
  }

  let filtered = getFilteredHistory();

  // Compute all-time PR values (max weights, max reps, and max times)
  const maxWeights = {};
  const maxReps = {};
  const maxTimes = {};
  state.workoutHistory.forEach(w => {
    if (!w.exercises) return;
    w.exercises.forEach(ex => {
      if (!ex.sets) return;
      ex.sets.forEach(s => {
        if (s.completed) {
          const weight = parseFloat(s.weight) || 0;
          if (!maxWeights[ex.name] || weight > maxWeights[ex.name]) {
            maxWeights[ex.name] = weight;
          }
          const reps = parseInt(s.reps, 10) || 0;
          if (!maxReps[ex.name] || reps > maxReps[ex.name]) {
            maxReps[ex.name] = reps;
          }
          const time = parseInt(s.time, 10) || 0;
          if (!maxTimes[ex.name] || time > maxTimes[ex.name]) {
            maxTimes[ex.name] = time;
          }
        }
      });
    });
  });

  const workoutMetrics = filtered.map(w => {
    let totalVolume = 0;
    let totalSets = 0;
    let prCount = 0;

    if (w.exercises) {
      w.exercises.forEach(ex => {
        const maxW = maxWeights[ex.name] || 0;
        const maxR = maxReps[ex.name] || 0;
        const maxT = maxTimes[ex.name] || 0;
        let exerciseHasPR = false;

        if (!Array.isArray(ex.sets)) return;
        ex.sets.forEach(s => {
          if (s.completed) {
            totalSets++;
            const wVal = parseFloat(s.weight) || 0;
            totalVolume += wVal * (parseInt(s.reps, 10) || 0);

            const showWeight = ex.metrics ? ex.metrics.includes('weight') : (ex.metricType === 'both' || ex.metricType === 'weight' || !ex.metricType);
            const showReps = ex.metrics ? ex.metrics.includes('reps') : (ex.metricType === 'both' || ex.metricType === 'reps' || !ex.metricType);
            const showTime = ex.metrics ? ex.metrics.includes('time') : (ex.metricType === 'time');

            if (showWeight && maxW > 0 && wVal === maxW) {
              exerciseHasPR = true;
            }
            if (showReps && maxR > 0 && (parseInt(s.reps, 10) || 0) === maxR) {
              exerciseHasPR = true;
            }
            if (showTime && maxT > 0 && (parseInt(s.time, 10) || 0) === maxT) {
              exerciseHasPR = true;
            }
          }
        });
        if (exerciseHasPR) prCount++;
      });
    }

    return {
      workout: w,
      totalVolume,
      totalSets,
      prCount
    };
  });

  if (state.filterSortSelection === 'volume-desc') {
    workoutMetrics.sort((a, b) => {
      if (b.totalVolume !== a.totalVolume) {
        return b.totalVolume - a.totalVolume;
      }
      return b.workout.date - a.workout.date;
    });
  } else if (state.filterSortSelection === 'prs-first') {
    workoutMetrics.sort((a, b) => {
      if (b.prCount !== a.prCount) {
        return b.prCount - a.prCount;
      }
      return b.workout.date - a.workout.date;
    });
  } else {
    workoutMetrics.sort((a, b) => b.workout.date - a.workout.date);
  }

  if (workoutMetrics.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 30px; font-size: 0.95rem; direction: rtl;">לא נמצאו אימונים התואמים את סינוני החיפוש.</div>';
    return;
  }

  workoutMetrics.forEach(item => {
    const w = item.workout;
    const duration = w.duration ? Math.round(w.duration / 60) : 0;
    const dateObj = new Date(w.date);
    
    // Format date as DD/MM/YYYY
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    const formattedDate = `${dd}/${mm}/${yyyy}`;

    // Extract start time HH:MM
    const startHours = String(dateObj.getHours()).padStart(2, '0');
    const startMinutes = String(dateObj.getMinutes()).padStart(2, '0');
    const startTimeStr = `${startHours}:${startMinutes}`;

    const card = document.createElement('div');
    card.className = 'premium-workout-card'; // Redesigned class with premium styling

    const prBadgeHtml = item.prCount > 0 ? `<span class="workout-log-pr-badge">🏆 שיא אישי x${item.prCount}</span>` : '';
    const dispName = w.locationName || (w.location === 'gym' ? 'חדר כושר' : 'פארק');
    const dispEmoji = w.locationEmoji || (w.location === 'gym' ? '🏋️‍♂️' : '🌳');

    // 1. Calculate Single Workout Muscle Splits (חלוקת אזורי גוף לאימון הנוכחי)
    const muscleCounts = {};
    const muscleGroupsTrained = new Set();

    (w.exercises || []).forEach(ex => {
      const compSetsCount = (ex.sets || []).filter(s => s.completed).length;
      if (compSetsCount > 0) {
        let cat = 'אחר';
        const matched = getExerciseByName(ex.name);
        if (matched) cat = matched.category || 'אחר';
        
        muscleCounts[cat] = (muscleCounts[cat] || 0) + compSetsCount;
        muscleGroupsTrained.add(cat);
      }
    });

    // Calculate total completed sets in this workout
    const totalCompSetsInW = Object.values(muscleCounts).reduce((sum, v) => sum + v, 0);

    // 2. Generate Muscle Badges for Collapsed State with percentages
    const muscleDotsHtml = Array.from(muscleGroupsTrained).map(cat => {
      const style = getMuscleCategoryStyle(cat);
      const count = muscleCounts[cat] || 0;
      const pct = totalCompSetsInW > 0 ? Math.round((count / totalCompSetsInW) * 100) : 0;
      return `
        <span class="premium-muscle-badge" style="background: ${style.glow}; border: 1px solid ${style.color}; box-shadow: 0 0 10px ${style.glow};" title="${escapeHTML(cat)} (${pct}%)">
          ${escapeHTML(cat)} (${pct}%)
        </span>
      `;
    }).join('');

    // 3. Compact Info Bar inside/right below header
    const compactInfoBarHtml = `
      <div class="premium-compact-info-bar">
        <div class="premium-info-item">
          <span class="premium-info-icon">${escapeHTML(dispEmoji)}</span>
          <span class="premium-info-text">${escapeHTML(dispName)}</span>
        </div>
        <div class="premium-info-divider"></div>
        <div class="premium-info-item">
          <span class="premium-info-icon">📅</span>
          <span class="premium-info-text">${formattedDate}</span>
        </div>
        <div class="premium-info-divider"></div>
        <div class="premium-info-item">
          <span class="premium-info-icon">🕒</span>
          <span class="premium-info-text">${startTimeStr}</span>
        </div>
        <div class="premium-info-divider"></div>
        <div class="premium-info-item">
          <span class="premium-info-icon">⏱️</span>
          <span class="premium-info-text">${duration} דק׳</span>
        </div>
        <div style="flex-grow: 1;"></div>
        <div class="premium-muscle-dots-container" style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
          ${muscleDotsHtml}
        </div>
      </div>
    `;

    // 4. Calculate Muscle Splits percentages breakdown
    const totalCompSets = Object.values(muscleCounts).reduce((sum, v) => sum + v, 0);
    let muscleSplitHtml = '';
    if (totalCompSets > 0) {
      const splitRowsHtml = Object.entries(muscleCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([muscle, count]) => {
          const pct = Math.round((count / totalCompSets) * 100);
          const style = getMuscleCategoryStyle(muscle);
          return `
            <div class="premium-muscle-split-row">
              <div class="premium-muscle-split-meta">
                <span class="premium-muscle-split-name" style="color: #ffffff; font-weight: 800;">${escapeHTML(muscle)}</span>
                <span class="premium-muscle-split-pct" style="color: ${style.color}; text-shadow: 0 0 5px ${style.glow}; font-weight: 800;">${pct}% <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">(${count} סטים)</span></span>
              </div>
              <div class="premium-muscle-split-track">
                <div class="premium-muscle-split-fill" style="width: ${pct}%; background-color: ${style.color}; box-shadow: 0 0 8px 1px ${style.glow};"></div>
              </div>
            </div>
          `;
        }).join('');

      muscleSplitHtml = `
        <div class="premium-muscle-breakdown-card">
          <div class="premium-muscle-breakdown-title">
            <span style="font-size: 1.1rem; filter: drop-shadow(0 0 4px var(--electric-blue-glow));">📊</span>
            <span>חלוקת עומסי שרירים באימון</span>
          </div>
          <div class="premium-muscle-breakdown-grid">
            ${splitRowsHtml}
          </div>
        </div>
      `;
    }

    // 5. Render premium exercise sub-cards
    const premiumExercisesHtml = (w.exercises || []).map(ex => {
      let cat = 'אחר';
      const matched = getExerciseByName(ex.name);
      if (matched) cat = matched.category || 'אחר';

      const muscleStyle = getMuscleCategoryStyle(cat);

      // Look back for a previous workout containing this exercise
      const pastWorkouts = state.workoutHistory
        .filter(w2 => w2.id !== w.id && w2.date < w.date)
        .sort((a, b) => b.date - a.date);

      const prevW = pastWorkouts.find(w2 => 
        w2.exercises && w2.exercises.some(e => e.name === ex.name && e.sets && e.sets.some(s => s.completed))
      );

      const completedSets = (ex.sets || []).filter(s => s.completed);
      const peakWeight = completedSets.length > 0 ? Math.max(...completedSets.map(s => parseFloat(s.weight) || 0)) : 0;
      const peakReps = completedSets.length > 0 ? Math.max(...completedSets.map(s => parseInt(s.reps, 10) || 0)) : 0;
      const peakTime = completedSets.length > 0 ? Math.max(...completedSets.map(s => parseInt(s.time, 10) || 0)) : 0;

      const allTimePRWeight = maxWeights[ex.name] || 0;
      const allTimePRReps = maxReps[ex.name] || 0;
      const allTimePRTime = maxTimes ? (maxTimes[ex.name] || 0) : 0;

      const weightPct = allTimePRWeight > 0 ? Math.min(100, Math.round((peakWeight / allTimePRWeight) * 100)) : 0;
      const repsPct = allTimePRReps > 0 ? Math.min(100, Math.round((peakReps / allTimePRReps) * 100)) : 0;
      const timePct = allTimePRTime > 0 ? Math.min(100, Math.round((peakTime / allTimePRTime) * 100)) : 0;

      const metricType = ex.metricType || 'both';
      const showWeight = ex.metrics ? ex.metrics.includes('weight') : (metricType === 'both' || metricType === 'weight');
      const showReps = ex.metrics ? ex.metrics.includes('reps') : (metricType === 'both' || metricType === 'reps');
      const showTime = ex.metrics ? ex.metrics.includes('time') : (metricType === 'time');

      // Find previous max weight, reps & time
      let prevMaxW = 0;
      let prevMaxR = 0;
      let prevMaxT = 0;
      if (prevW) {
        const prevEx = prevW.exercises.find(e => e.name === ex.name);
        const prevCompleted = (prevEx && Array.isArray(prevEx.sets)) ? prevEx.sets.filter(s => s.completed) : [];
        prevMaxW = prevCompleted.length > 0 ? Math.max(...prevCompleted.map(s => parseFloat(s.weight) || 0)) : 0;
        prevMaxR = prevCompleted.length > 0 ? Math.max(...prevCompleted.map(s => parseInt(s.reps, 10) || 0)) : 0;
        prevMaxT = prevCompleted.length > 0 ? Math.max(...prevCompleted.map(s => parseInt(s.time, 10) || 0)) : 0;
      }

      // Generate Progress Rings (Mini Gauges)
      let ringsHtml = '';
      const ringParts = [];
      if (showWeight) {
        ringParts.push(renderProgressRing(weightPct, peakWeight, 'ק״ג', 'משקל שיא', allTimePRWeight, muscleStyle.color, muscleStyle.glow));
      }
      if (showReps) {
        ringParts.push(renderProgressRing(repsPct, peakReps, 'חזרות', 'חזרות שיא', allTimePRReps, muscleStyle.color, muscleStyle.glow));
      }
      if (showTime) {
        ringParts.push(renderProgressRing(timePct, peakTime, 'שניות', 'זמן שיא', allTimePRTime, muscleStyle.color, muscleStyle.glow));
      }
      ringsHtml = ringParts.join('');

      // Generate Previous Workout Progress Comparison (Horizontal Single Line Graph)
      let comparisonBarsHtml = '';
      const compParts = [];
      if (showWeight) {
        compParts.push(renderComparisonBar(peakWeight, prevMaxW, allTimePRWeight, 'ק״ג', 'השוואת משקל', muscleStyle.color, muscleStyle.glow, prevW !== undefined));
      }
      if (showReps) {
        compParts.push(renderComparisonBar(peakReps, prevMaxR, allTimePRReps, 'חזרות', 'השוואת חזרות', muscleStyle.color, muscleStyle.glow, prevW !== undefined));
      }
      if (showTime) {
        compParts.push(renderComparisonBar(peakTime, prevMaxT, allTimePRTime, 'שניות', 'השוואת זמן', muscleStyle.color, muscleStyle.glow, prevW !== undefined));
      }
      comparisonBarsHtml = compParts.join('');

      // Format sets as premium stylized bubbles/capsules
      const setBubblesHtml = completedSets.map((s, idx) => {
        const parts = [];
        if (showWeight) {
          parts.push(`<span class="premium-set-val-neon" style="color: ${muscleStyle.color}; text-shadow: 0 0 5px ${muscleStyle.glow};">${s.weight || 0}</span> <span class="premium-set-unit">ק״ג</span>`);
        }
        if (showReps) {
          parts.push(`<span class="premium-set-val-neon" style="color: ${muscleStyle.color}; text-shadow: 0 0 5px ${muscleStyle.glow};">${s.reps || 0}</span> <span class="premium-set-unit">חזרות</span>`);
        }
        if (showTime) {
          parts.push(`<span class="premium-set-val-neon" style="color: ${muscleStyle.color}; text-shadow: 0 0 5px ${muscleStyle.glow};">${s.time || 0}</span> <span class="premium-set-unit">ש׳</span>`);
        }
        const valText = parts.join(' × ');
        return `
          <div class="premium-set-capsule">
            <div class="premium-set-badge" style="background-color: ${muscleStyle.color}; box-shadow: 0 0 6px ${muscleStyle.glow};">${idx + 1}</div>
            <div class="premium-set-content">${valText}</div>
          </div>
        `;
      }).join('');

      // Format a compact summary of sets (e.g. 60 ק״ג × 10, 65 ק״ג × 8)
      const summaryParts = completedSets.map(s => {
        const parts = [];
        if (showWeight) parts.push(`${s.weight || 0}ק״ג`);
        if (showReps) parts.push(`${s.reps || 0}`);
        if (showTime) parts.push(`${s.time || 0}ש׳`);
        return parts.join('×');
      });
      const setsCountText = `${completedSets.length} סטים`;
      const setsSummaryText = summaryParts.length > 0 ? ` | ${summaryParts.join(', ')}` : '';
      const fullSummary = `${setsCountText}${setsSummaryText}`;

      return `
        <div class="premium-exercise-card" style="border-left: 3.5px solid ${muscleStyle.color}; box-shadow: inset 5px 0 15px -5px ${muscleStyle.glow};">
          <div class="premium-exercise-accordion-header">
            <div class="premium-exercise-accordion-info">
              <div class="premium-exercise-name-row">
                <span class="premium-exercise-name" style="font-size: 0.95rem; font-weight: 800; color: #ffffff;">${escapeHTML(ex.name)}</span>
                <span class="premium-exercise-cat-badge" style="background-color: ${muscleStyle.glow}; color: ${muscleStyle.color}; border: 1px solid rgba(255,255,255,0.08); font-size: 0.68rem; font-weight: 800; padding: 2px 6px; border-radius: 6px;">${escapeHTML(cat)}</span>
              </div>
              <div class="premium-exercise-sets-summary-row">${fullSummary}</div>
            </div>
            <span class="premium-exercise-chevron">▼</span>
          </div>
          
          <div class="premium-exercise-details-collapse">
            <div class="premium-exercise-details-content">
              <div class="premium-exercise-stats-grid">
                <div class="premium-exercise-rings-panel">
                  ${ringsHtml}
                </div>
                <div class="premium-exercise-comparison-panel">
                  ${comparisonBarsHtml}
                </div>
              </div>
              
              <div class="premium-exercise-sets-section">
                <div class="premium-exercise-sets-title">סטים שבוצעו:</div>
                <div class="premium-exercise-sets-container">
                  ${setBubblesHtml}
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
                <span class="premium-exercise-inspector-link" data-name="${escapeHTML(ex.name)}" style="color: var(--electric-blue-light); font-size: 0.78rem; font-weight: 700; cursor: pointer; text-decoration: underline; text-underline-offset: 3px;">
                  ניתוח גרפים והיסטוריית PR 📈
                </span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="workout-log-header">
        <div class="workout-log-location">
          <span class="workout-log-emoji">${escapeHTML(dispEmoji)}</span>
          <div>
            <h4 class="workout-log-name">${escapeHTML(dispName)}</h4>
          </div>
        </div>
        <div class="workout-log-stats">
          <span class="workout-log-volume">${item.totalVolume.toLocaleString()} ק״ג</span>
          ${prBadgeHtml}
          <span class="workout-log-chevron">▼</span>
        </div>
      </div>
      
      <!-- Redesigned High-end info bar replacing old chips preview -->
      ${compactInfoBarHtml}
 
      <!-- Expanded detailed information sheet -->
      <div class="workout-log-expanded-details">
        <div class="workout-log-exercises-premium">
          ${premiumExercisesHtml}
        </div>
        
        <!-- Stunning Muscle split percentages breakdown at the bottom of expanded card -->
        ${muscleSplitHtml}
        
        <button class="workout-log-edit-btn">
          <span>✏️</span> ערוך פרטי אימון
        </button>
      </div>
    `;

    // Collapsible toggle on clicking card (excluding the edit button or interactions inside expanded card)
    card.addEventListener('click', (e) => {
      if (e.target.closest('.workout-log-edit-btn') || e.target.closest('.premium-exercise-card') || e.target.closest('.premium-muscle-breakdown-card')) return;
      card.classList.toggle('expanded');
    });

    const editBtn = card.querySelector('.workout-log-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(w.id);
      });
    }

    container.appendChild(card);

    // Bind click events on premium exercise accordion headers & links
    const exCards = card.querySelectorAll('.premium-exercise-card');
    exCards.forEach(exCard => {
      const headerEl = exCard.querySelector('.premium-exercise-accordion-header');
      if (headerEl) {
        headerEl.addEventListener('click', (e) => {
          e.stopPropagation(); // prevent parent card toggling
          exCard.classList.toggle('accordion-expanded');
        });
      }

      const inspectorLink = exCard.querySelector('.premium-exercise-inspector-link');
      if (inspectorLink) {
        inspectorLink.addEventListener('click', (e) => {
          e.stopPropagation(); // prevent parent card toggling
          const exName = inspectorLink.dataset.name;
          openExerciseInspector(exName);
        });
      }
    });
  });
}

// Compute individual stats for exercises leaderboards
export function getExerciseStats(exerciseName) {
  let timesPerformed = 0;
  let totalSets = 0;
  let maxWeight = 0;
  let max1RM = 0;
  let peakVolume = 0;

  state.workoutHistory.forEach(w => {
    if (!w.exercises) return;
    const ex = w.exercises.find(e => e.name === exerciseName);
    if (ex && ex.sets) {
      const completedSets = ex.sets.filter(s => s.completed);
      if (completedSets.length > 0) {
        timesPerformed++;
        totalSets += completedSets.length;
        
        let sessionVolume = 0;
        completedSets.forEach(s => {
          const wVal = parseFloat(s.weight) || 0;
          const rVal = parseInt(s.reps, 10) || 0;

          if (wVal > maxWeight) maxWeight = wVal;
          const oneRM = rVal === 1 ? wVal : wVal * (1 + rVal / 30);
          if (oneRM > max1RM) max1RM = oneRM;
          sessionVolume += (wVal * rVal);
        });

        if (sessionVolume > peakVolume) peakVolume = sessionVolume;
      }
    }
  });

  return { timesPerformed, totalSets, maxWeight, max1RM, peakVolume };
}

// Exercises Top 3 Leaderboard Widget
export function renderExercisesLeaderboardModal() {
  const container = document.getElementById('leaderboard-modal-body');
  if (!container) return;

  const allExs = getAllExercises();
  const listWithStats = allExs.map(ex => {
    const stats = getExerciseStats(ex.name);
    return { ex, stats };
  }).filter(item => item.stats.timesPerformed > 0);

  listWithStats.sort((a, b) => {
    if (b.stats.timesPerformed !== a.stats.timesPerformed) {
      return b.stats.timesPerformed - a.stats.timesPerformed;
    }
    return b.stats.totalSets - a.stats.totalSets;
  });

  if (listWithStats.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px; font-size: 0.95rem; direction: rtl;">עוד לא ביצעת תרגילים. בצע אימון כדי לראות נתונים! 🏋️‍♂️</div>`;
    return;
  }

  container.innerHTML = '';

  const maxPerformed = listWithStats[0].stats.timesPerformed || 1;
  const ranks = ['🥇', '🥈', '🥉'];
  const tierClasses = ['gold-tier', 'silver-tier', 'bronze-tier'];
  const gradientClasses = ['gold-gradient', 'silver-gradient', 'bronze-gradient'];

  listWithStats.forEach((item, idx) => {
    const isTop3 = idx < 3;
    const rankStr = isTop3 ? ranks[idx] : `<span style="font-size: 1.1rem; font-weight: 800; color: var(--text-muted); width: 24px; text-align: center; display: inline-block;">${idx + 1}</span>`;
    const pct = Math.round((item.stats.timesPerformed / maxPerformed) * 100);
    const emojiStr = item.ex.emoji ? `<span style="font-size: 1.2rem; margin-left: 6px;">${escapeHTML(item.ex.emoji)}</span>` : '💪';
    
    const leaderItem = document.createElement('div');
    leaderItem.className = `modal-leader-item ${isTop3 ? tierClasses[idx] : ''}`;
    
    // Clicking an item opens inspector and closes modal
    leaderItem.addEventListener('click', () => {
      const lbModal = document.getElementById('exercises-leaderboard-modal');
      if (lbModal) {
        lbModal.classList.add('hide');
        lbModal.style.display = 'none';
      }
      openExerciseInspector(item.ex.name);
    });

    leaderItem.innerHTML = `
      <div class="leader-rank" style="min-width: 30px; display: flex; justify-content: center; align-items: center;">${rankStr}</div>
      <div class="leader-info" style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
        <span class="leader-name" style="font-size: 0.95rem; font-weight: 800; color: #ffffff; display: flex; align-items: center; gap: 4px;">
          ${emojiStr} ${escapeHTML(item.ex.name)}
        </span>
        <span class="leader-sub" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
          בוצע ${item.stats.timesPerformed} פעמים | ${item.stats.totalSets} סטים | שיא: ${item.stats.maxWeight > 0 ? item.stats.maxWeight + ' ק״ג' : '--'}
        </span>
        <div class="progress-bar-container" style="width: 100%; height: 6px; background: rgba(255, 255, 255, 0.06); border-radius: 3px; overflow: hidden; margin-top: 4px;">
          <div class="progress-bar-fill ${isTop3 ? gradientClasses[idx] : 'blue-gradient'}" style="width: ${pct}%; height: 100%; border-radius: 3px; transition: width 1s ease-in-out;"></div>
        </div>
      </div>
    `;

    container.appendChild(leaderItem);
  });
}

// Exercises Top 3 Leaderboard Widget (stubs for backwards-compatibility)
export function renderExercisesLeaderboard() {
  renderExercisesLeaderboardModal();
}

// Exercises List Manager inside Analytics Subtab
const categoryColorsTab3 = {
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
  'מותאם אישית': { bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8' }
};

export function renderExercisesManager() {
  renderExercisesLeaderboard();

  const gridContainer = document.getElementById('exercises-list-grid-tab3');
  if (!gridContainer) return;
  gridContainer.innerHTML = '';

  const searchInput = document.getElementById('exercises-search-input-tab3');
  const muscleFilter = document.getElementById('exercises-muscle-filter-tab3');
  const typeFilter = document.getElementById('exercises-type-filter-tab3');
  const usageFilter = document.getElementById('exercises-usage-filter-tab3');
  const favoriteFilter = document.getElementById('exercises-favorite-filter-tab3');

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const selectedMuscle = muscleFilter ? muscleFilter.value : 'all';
  const selectedType = typeFilter ? typeFilter.value : 'all';
  const selectedUsage = usageFilter ? usageFilter.value : 'all';
  const selectedFavorite = favoriteFilter ? favoriteFilter.value : 'all';

  let allExs = getAllExercises();

  if (query) {
    allExs = allExs.filter(ex => ex.name.toLowerCase().includes(query));
  }
  if (selectedMuscle !== 'all') {
    allExs = allExs.filter(ex => ex.category === selectedMuscle);
  }
  if (selectedType !== 'all') {
    const standardNames = new Set([...GYM_EXERCISES, ...PARK_EXERCISES].map(e => e.name.trim().toLowerCase()));
    if (selectedType === 'standard') {
      allExs = allExs.filter(ex => standardNames.has(ex.name.trim().toLowerCase()));
    } else if (selectedType === 'custom') {
      allExs = allExs.filter(ex => !standardNames.has(ex.name.trim().toLowerCase()));
    }
  }

  if (selectedFavorite === 'favorites') {
    allExs = allExs.filter(ex => state.favoriteExercises.includes(ex.name));
  }

  if (selectedUsage !== 'all') {
    if (selectedUsage === 'used') {
      allExs = allExs.filter(ex => {
        const stats = getExerciseStats(ex.name);
        return stats.timesPerformed > 0;
      });
    } else if (selectedUsage === 'unused') {
      allExs = allExs.filter(ex => {
        const stats = getExerciseStats(ex.name);
        return stats.timesPerformed === 0;
      });
    } else if (selectedUsage === 'recent') {
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - 30);
      
      allExs = allExs.filter(ex => {
        return state.workoutHistory.some(w => {
          if (new Date(w.date) < limitDate) return false;
          if (!w.exercises) return false;
          return w.exercises.some(e => {
            if (e.name !== ex.name) return false;
            return e.sets && e.sets.some(s => s.completed);
          });
        });
      });
    }
  }

  if (allExs.length === 0) {
    gridContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 20px; direction: rtl;">אין תרגילים העונים על סינון זה</div>';
    return;
  }

  allExs.forEach(ex => {
    const stats = getExerciseStats(ex.name);
    
    const card = document.createElement('div');
    card.className = 'exercise-manage-card-tab3';
    
    const catStyle = categoryColorsTab3[ex.category] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' };
    const emojiStr = ex.emoji ? `<span class="ex-card-emoji-tab3">${escapeHTML(ex.emoji)}</span>` : '💪';
    const isFav = state.favoriteExercises.includes(ex.name);
    
    card.innerHTML = `
      <div class="ex-card-info-tab3" style="text-align: right; direction: rtl; flex: 1;">
        <div class="ex-card-title-row">
          ${emojiStr}
          <span class="ex-card-name-tab3">${escapeHTML(ex.name)}</span>
        </div>
        <div class="ex-card-stats-tab3" style="margin-top: 4px;">
          בוצע ${stats.timesPerformed} פעמים • ${stats.totalSets} סטים
        </div>
      </div>
      <div class="ex-card-actions-tab3" style="display: flex; align-items: center; gap: 10px;">
        <span class="ex-card-badge-tab3" style="background: ${catStyle.bg}; color: ${catStyle.color}; margin-left: 4px;">${escapeHTML(ex.category || 'אחר')}</span>
      </div>
    `;

    const actionsContainer = card.querySelector('.ex-card-actions-tab3');
    const starBtn = document.createElement('button');
    starBtn.className = `ex-fav-star-btn ${isFav ? 'active' : ''}`;
    starBtn.style.cssText = 'width: 32px !important; height: 32px !important; font-size: 0.95rem !important; margin: 0 !important; border: 1.5px solid rgba(255, 255, 255, 0.07) !important;';
    starBtn.title = isFav ? 'הסר ממועדפים' : 'הוסף למועדפים';
    starBtn.innerHTML = isFav ? '⭐' : '☆';
    
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = state.favoriteExercises.indexOf(ex.name);
      if (idx > -1) {
        state.favoriteExercises.splice(idx, 1);
        starBtn.innerHTML = '☆';
        starBtn.classList.remove('active');
        starBtn.title = 'הוסף למועדפים';
      } else {
        state.favoriteExercises.push(ex.name);
        starBtn.innerHTML = '⭐';
        starBtn.classList.add('active');
        starBtn.title = 'הסר ממועדפים';
      }
      if (state.currentUser) {
        SafeStorage.setItem(`aura-favorite-exercises_${state.currentUser.uid}`, JSON.stringify(state.favoriteExercises));
        saveFieldToCloud("favoriteExercises", state.favoriteExercises);
      }
      renderExercisesManager();
      if (typeof window.renderExercisePickerList === 'function') window.renderExercisePickerList();
    });
    
    actionsContainer.appendChild(starBtn);

    const configBtn = document.createElement('button');
    configBtn.className = 'ex-settings-btn-manager';
    configBtn.innerHTML = '⚙️';
    configBtn.title = 'הגדרות ברירת מחדל לאימון';
    configBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof window.openMetricSelectorForConfig === 'function') {
        window.openMetricSelectorForConfig(ex.name);
      }
    });
    actionsContainer.appendChild(configBtn);

    card.addEventListener('click', (e) => {
      if (e.target.closest('.ex-settings-btn-manager') || e.target.closest('.ex-fav-star-btn')) {
        return;
      }
      openExerciseInspector(ex.name);
    });

    gridContainer.appendChild(card);
  });
}

// Dynamic helper to update inspector statistics
export function updateInspectorStatistics(exerciseName) {
  const prVal = document.getElementById('inspector-pr-val');
  const rmVal = document.getElementById('inspector-1rm-val');
  const volVal = document.getElementById('inspector-vol-val');
  const performedVal = document.getElementById('inspector-performed-val');

  const prCard = prVal ? prVal.closest('.stat-mini-card') : null;
  const rmCard = rmVal ? rmVal.closest('.stat-mini-card') : null;
  const volCard = volVal ? volVal.closest('.stat-mini-card') : null;
  
  const isReps = (state.activeInspectorMetric === 'reps');
  const isTime = (state.activeInspectorMetric === 'time');

  const chronological = [...state.workoutHistory]
    .filter(w => w.date && w.exercises)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let timesPerformed = 0;
  let totalSets = 0;
  let maxWeight = 0;
  let max1RM = 0;
  let peakVolume = 0;
  
  let maxReps = 0;
  let totalRepsCompleted = 0;
  let latestPeakReps = 0;

  let maxTime = 0;
  let totalTimeCompleted = 0;
  let latestPeakTime = 0;

  chronological.forEach(w => {
    const ex = w.exercises.find(e => e.name === exerciseName);
    if (ex && ex.sets) {
      const completedSets = ex.sets.filter(s => s.completed);
      if (completedSets.length > 0) {
        timesPerformed++;
        totalSets += completedSets.length;
        
        let sessionVolume = 0;
        let sessionMaxReps = 0;
        let sessionMaxTime = 0;
        completedSets.forEach(s => {
          const wVal = parseFloat(s.weight) || 0;
          const rVal = parseInt(s.reps, 10) || 0;
          const tVal = parseInt(s.time, 10) || 0;

          if (wVal > maxWeight) maxWeight = wVal;
          const oneRM = rVal === 1 ? wVal : wVal * (1 + rVal / 30);
          if (oneRM > max1RM) max1RM = oneRM;
          sessionVolume += (wVal * rVal);

          if (rVal > maxReps) maxReps = rVal;
          if (rVal > sessionMaxReps) sessionMaxReps = rVal;
          totalRepsCompleted += rVal;

          if (tVal > maxTime) maxTime = tVal;
          if (tVal > sessionMaxTime) sessionMaxTime = tVal;
          totalTimeCompleted += tVal;
        });

        if (sessionVolume > peakVolume) peakVolume = sessionVolume;
        latestPeakReps = sessionMaxReps;
        latestPeakTime = sessionMaxTime;
      }
    }
  });

  if (isTime) {
    if (prCard) {
      const prLbl = prCard.querySelector('.stat-label');
      if (prLbl) prLbl.textContent = 'שיא אישי (PR) ⏱️';
      prVal.textContent = maxTime > 0 ? `${maxTime} שניות` : '--';
    }
    if (rmCard) {
      const rmLbl = rmCard.querySelector('.stat-label');
      if (rmLbl) rmLbl.textContent = 'אימון אחרון 🏆';
      rmVal.textContent = latestPeakTime > 0 ? `${latestPeakTime} שניות` : '--';
    }
    if (volCard) {
      const volLbl = volCard.querySelector('.stat-label');
      if (volLbl) volLbl.textContent = 'סה״כ זמן 📊';
      volVal.textContent = totalTimeCompleted > 0 ? `${totalTimeCompleted} שניות` : '--';
    }
  } else if (isReps) {
    if (prCard) {
      const prLbl = prCard.querySelector('.stat-label');
      if (prLbl) prLbl.textContent = 'שיא אישי (PR) 🔢';
      prVal.textContent = maxReps > 0 ? `${maxReps} חזרות` : '--';
    }
    if (rmCard) {
      const rmLbl = rmCard.querySelector('.stat-label');
      if (rmLbl) rmLbl.textContent = 'אימון אחרון 🏆';
      rmVal.textContent = latestPeakReps > 0 ? `${latestPeakReps} חזרות` : '--';
    }
    if (volCard) {
      const volLbl = volCard.querySelector('.stat-label');
      if (volLbl) volLbl.textContent = 'סה״כ חזרות 📊';
      volVal.textContent = totalRepsCompleted > 0 ? `${totalRepsCompleted} חזרות` : '--';
    }
  } else {
    if (prCard) {
      const prLbl = prCard.querySelector('.stat-label');
      if (prLbl) prLbl.textContent = 'שיא אישי (PR) 🏋️‍♂️';
      prVal.textContent = maxWeight > 0 ? `${maxWeight} ק״ג` : '--';
    }
    if (rmCard) {
      const rmLbl = rmCard.querySelector('.stat-label');
      if (rmLbl) rmLbl.textContent = '1RM משוער 🏆';
      rmVal.textContent = max1RM > 0 ? `${Math.round(max1RM)} ק״ג` : '--';
    }
    if (volCard) {
      const volLbl = volCard.querySelector('.stat-label');
      if (volLbl) volLbl.textContent = 'נפח אימון שיא 📊';
      volVal.textContent = peakVolume > 0 ? `${peakVolume} ק״ג` : '--';
    }
  }

  if (performedVal) {
    performedVal.textContent = `${timesPerformed} פעמים • ${totalSets} סטים`;
  }
}

// Dynamic helper to update inspector timeline
export function updateInspectorTimeline(exerciseName) {
  const timelineContainer = document.getElementById('pr-history-timeline-tab3');
  if (!timelineContainer) return;
  timelineContainer.innerHTML = '';
  
  const chronological = [...state.workoutHistory]
    .filter(w => w.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const brokenPRs = [];
  const isReps = (state.activeInspectorMetric === 'reps');
  const isTime = (state.activeInspectorMetric === 'time');

  if (isTime) {
    let runningMaxTime = 0;
    chronological.forEach(w => {
      if (!w.exercises) return;
      const ex = w.exercises.find(e => e.name === exerciseName);
      if (ex && ex.sets) {
        const completedSets = ex.sets.filter(s => s.completed);
        if (completedSets.length > 0) {
          const sessionMaxTime = Math.max(...completedSets.map(s => parseInt(s.time, 10) || 0));
          if (sessionMaxTime > runningMaxTime) {
            runningMaxTime = sessionMaxTime;
            brokenPRs.push({
              date: new Date(w.date),
              value: sessionMaxTime,
              unit: 'שניות'
            });
          }
        }
      }
    });
  } else if (isReps) {
    let runningMaxReps = 0;
    chronological.forEach(w => {
      if (!w.exercises) return;
      const ex = w.exercises.find(e => e.name === exerciseName);
      if (ex && ex.sets) {
        const completedSets = ex.sets.filter(s => s.completed);
        if (completedSets.length > 0) {
          const sessionMaxReps = Math.max(...completedSets.map(s => parseInt(s.reps, 10) || 0));
          if (sessionMaxReps > runningMaxReps) {
            runningMaxReps = sessionMaxReps;
            brokenPRs.push({
              date: new Date(w.date),
              value: sessionMaxReps,
              unit: 'חזרות'
            });
          }
        }
      }
    });
  } else {
    let runningMaxWeight = 0;
    chronological.forEach(w => {
      if (!w.exercises) return;
      const ex = w.exercises.find(e => e.name === exerciseName);
      if (ex && ex.sets) {
        const completedSets = ex.sets.filter(s => s.completed);
        if (completedSets.length > 0) {
          const sessionMaxWeight = Math.max(...completedSets.map(s => parseFloat(s.weight) || 0));
          if (sessionMaxWeight > runningMaxWeight) {
            runningMaxWeight = sessionMaxWeight;
            brokenPRs.push({
              date: new Date(w.date),
              value: sessionMaxWeight,
              unit: 'ק״ג'
            });
          }
        }
      }
    });
  }

  if (brokenPRs.length === 0) {
    timelineContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.82rem; text-align: center; padding: 10px;">לא נרשמו שיאים אישיים עדיין</div>';
  } else {
    [...brokenPRs].reverse().forEach(pr => {
      const item = document.createElement('div');
      item.className = 'pr-timeline-item';
      const dateStr = pr.date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="pr-timeline-badge">PR שבור!</span>
          <span class="pr-timeline-val">${pr.value} ${pr.unit}</span>
        </div>
        <span class="pr-timeline-date">${dateStr}</span>
      `;
      timelineContainer.appendChild(item);
    });
  }
}

// Open exercise detailed overlay (Inspector)
export function openExerciseInspector(exerciseName) {
  state.currentInspectorExercise = exerciseName;
  
  const allExs = getAllExercises();
  const exDetails = allExs.find(ex => ex.name === exerciseName) || { name: exerciseName, category: 'אחר', emoji: '💪' };

  const nameEl = document.getElementById('inspector-exercise-name');
  const catBadge = document.getElementById('inspector-exercise-category');
  const inspectorFavBtn = document.getElementById('inspector-exercise-fav-btn');
  
  if (nameEl) {
    nameEl.textContent = (exDetails.emoji ? `${exDetails.emoji} ` : '') + exDetails.name;
  }
  
  if (catBadge) {
    catBadge.textContent = exDetails.category || 'אחר';
    const catStyle = categoryColorsTab3[exDetails.category] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' };
    catBadge.style.cssText = `background: ${catStyle.bg}; color: ${catStyle.color}; margin-top: 4px; display: inline-block;`;
  }

  if (inspectorFavBtn) {
    const isFav = state.favoriteExercises.includes(exerciseName);
    inspectorFavBtn.className = `ex-fav-star-btn ${isFav ? 'active' : ''}`;
    inspectorFavBtn.title = isFav ? 'הסר ממועדפים' : 'הוסף למועדפים';
    inspectorFavBtn.innerHTML = isFav ? '⭐' : '☆';
  }

  // Smart-detect which metrics have ACTUAL DATA in history
  const defaults = getExerciseDefaults(exerciseName);
  let configuredMetrics = ['weight', 'reps', 'time']; // fallback: show all
  if (defaults && defaults.metrics && defaults.metrics.length > 0) {
    configuredMetrics = [...defaults.metrics];
  }
  
  // Scan history for metrics that have real data
  const metricsWithData = new Set();
  state.workoutHistory.forEach(workout => {
    if (!workout.exercises) return;
    const foundEx = workout.exercises.find(e => e.name === exerciseName);
    if (foundEx && foundEx.sets) {
      foundEx.sets.forEach(set => {
        if (set.completed) {
          if (set.weight !== undefined && set.weight !== null && set.weight > 0) metricsWithData.add('weight');
          if (set.reps !== undefined && set.reps !== null && set.reps > 0) metricsWithData.add('reps');
          if (set.time !== undefined && set.time !== null && set.time > 0) metricsWithData.add('time');
        }
      });
    }
  });
  
  // Merge: show tab if configured OR has historical data
  const activeMetrics = [...new Set([...configuredMetrics, ...metricsWithData])];

  // Update tabs visibility dynamically
  const btnWeight = document.getElementById('inspector-toggle-weight');
  const btnReps = document.getElementById('inspector-toggle-reps');
  const btnTime = document.getElementById('inspector-toggle-time');
  
  if (btnWeight) btnWeight.style.display = activeMetrics.includes('weight') ? 'flex' : 'none';
  if (btnReps) btnReps.style.display = activeMetrics.includes('reps') ? 'flex' : 'none';
  if (btnTime) btnTime.style.display = activeMetrics.includes('time') ? 'flex' : 'none';

  // Determine starting active tab - prefer configured defaults first
  let defaultMetric = 'weight';
  if (configuredMetrics.includes('weight')) {
    defaultMetric = 'weight';
  } else if (configuredMetrics.includes('reps')) {
    defaultMetric = 'reps';
  } else if (configuredMetrics.includes('time')) {
    defaultMetric = 'time';
  }
  
  state.activeInspectorMetric = defaultMetric;

  if (btnWeight) btnWeight.classList.toggle('active', defaultMetric === 'weight');
  if (btnReps) btnReps.classList.toggle('active', defaultMetric === 'reps');
  if (btnTime) btnTime.classList.toggle('active', defaultMetric === 'time');

  // Render Full Workout History List
  const historyList = document.getElementById('inspector-full-history-list');
  if (historyList) {
    historyList.innerHTML = '';
    
    const exerciseHistory = [];
    state.workoutHistory.forEach(workout => {
      if (!workout.exercises) return;
      const foundEx = workout.exercises.find(e => e.name === exerciseName);
      if (foundEx && foundEx.sets && foundEx.sets.some(s => s.completed)) {
        exerciseHistory.push({
          date: workout.date,
          workoutName: workout.name || 'אימון ללא שם',
          sets: foundEx.sets.filter(s => s.completed),
          metrics: foundEx.metrics || ['weight', 'reps']
        });
      }
    });
    
    // Sort descending by date
    exerciseHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (exerciseHistory.length === 0) {
      historyList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 12px; direction: rtl;">אין היסטוריית ביצועים לתרגיל זה</div>';
    } else {
      exerciseHistory.forEach(session => {
        const dateStr = safeFormatDate(session.date);
        
        const sessionItem = document.createElement('div');
        sessionItem.className = 'history-session-item';
        sessionItem.style.cssText = 'padding: 10px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 6px;';
        
        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; font-weight: 700; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 4px; direction: rtl;';
        headerRow.innerHTML = `
          <span>${escapeHTML(session.workoutName)}</span>
          <span style="color: var(--text-muted); font-weight: 600; font-size: 0.8rem;">${dateStr}</span>
        `;
        sessionItem.appendChild(headerRow);
        
        const setsRow = document.createElement('div');
        setsRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; direction: rtl;';
        
        session.sets.forEach((set, sIdx) => {
          let parts = [];
          if (session.metrics.includes('weight') && set.weight !== undefined && set.weight !== null) {
            parts.push(`${set.weight} ק״ג`);
          }
          if (session.metrics.includes('reps') && set.reps !== undefined && set.reps !== null) {
            parts.push(`${set.reps} חזרות`);
          }
          if (session.metrics.includes('time') && set.time !== undefined && set.time !== null) {
            parts.push(`${set.time} ש׳`);
          }
          
          // Fallback if parts is empty but they completed it
          if (parts.length === 0) {
            if (set.weight !== undefined && set.weight !== null) parts.push(`${set.weight} ק״ג`);
            if (set.reps !== undefined && set.reps !== null) parts.push(`${set.reps} חזרות`);
            if (set.time !== undefined && set.time !== null) parts.push(`${set.time} ש׳`);
          }
          
          const setChip = document.createElement('span');
          setChip.className = 'history-set-chip';
          setChip.style.cssText = 'font-size: 0.78rem; padding: 4px 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; color: var(--text-muted); font-weight: 600;';
          setChip.textContent = `סט ${sIdx + 1}: ${parts.join(' × ')}`;
          setsRow.appendChild(setChip);
        });
        
        sessionItem.appendChild(setsRow);
        historyList.appendChild(sessionItem);
      });
    }
  }

  // Update statistics
  updateInspectorStatistics(exerciseName);

  // Update timeline
  updateInspectorTimeline(exerciseName);

  state.activeChartTypeTab3 = '1rm';
  const tabs = document.querySelectorAll('[data-chart-tab3]');
  tabs.forEach(t => {
    t.classList.remove('active');
    if (t.dataset.chartTab3 === '1rm') t.classList.add('active');
  });

  renderExerciseInspectorChart();

  const modal = document.getElementById('exercise-inspector-modal');
  if (modal) modal.classList.remove('hide');
}

export function renderExerciseInspectorChart() {
  const exerciseName = state.currentInspectorExercise;
  if (!exerciseName) return;

  const noDataEl = document.getElementById('chart-no-data-tab3');
  const fillPath = document.getElementById('gauge-fill');
  const valueDisplay = document.getElementById('gauge-value-display');
  const subtextDisplay = document.getElementById('gauge-subtext-display');
  const limitLeft = document.getElementById('gauge-limit-left');
  const limitRight = document.getElementById('gauge-limit-right');

  const exerciseSessions = [];
  const chronological = [...state.workoutHistory]
    .filter(w => w.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  chronological.forEach(w => {
    if (!w.exercises) return;
    const ex = w.exercises.find(e => e.name === exerciseName);
    if (ex && ex.sets && ex.sets.some(s => s.completed)) {
      exerciseSessions.push({
        date: new Date(w.date),
        sets: ex.sets.filter(s => s.completed)
      });
    }
  });

  // Toggle visibility of weight-based progression chart tabs in reps/time mode
  const chartTabsContainer = document.querySelector('.chart-tabs-tab3');
  const isReps = (state.activeInspectorMetric === 'reps');
  const isTime = (state.activeInspectorMetric === 'time');
  if (chartTabsContainer) {
    if (isReps || isTime) {
      chartTabsContainer.style.display = 'none';
    } else {
      chartTabsContainer.style.display = 'flex';
    }
  }

  if (exerciseSessions.length === 0) {
    if (noDataEl) noDataEl.style.display = 'flex';
    if (fillPath) fillPath.setAttribute('stroke-dashoffset', '251.3');
    if (valueDisplay) valueDisplay.textContent = '--';
    if (subtextDisplay) subtextDisplay.textContent = 'אין נתונים';
    if (limitLeft) limitLeft.textContent = isReps ? 'בסיס: -- חזרות' : (isTime ? 'בסיס: -- שניות' : 'בסיס: -- ק״ג');
    if (limitRight) limitRight.textContent = isReps ? 'שיא: -- חזרות' : (isTime ? 'שיא: -- שניות' : 'שיא: -- ק״ג');
    
    const premiumPanel = document.getElementById('inspector-premium-panel');
    if (premiumPanel) premiumPanel.style.display = 'none';
    return;
  }

  if (noDataEl) noDataEl.style.display = 'none';

  const values = [];
  exerciseSessions.forEach(session => {
    if (isTime) {
      const sessionMaxTime = Math.max(...session.sets.map(s => parseInt(s.time, 10) || 0));
      values.push(sessionMaxTime);
    } else if (isReps) {
      // Find peak reps in a single completed set in this session
      const sessionMaxReps = Math.max(...session.sets.map(s => parseInt(s.reps, 10) || 0));
      values.push(sessionMaxReps);
    } else {
      let sessionMaxWeight = 0;
      let sessionMax1RM = 0;
      let sessionVolume = 0;

      session.sets.forEach(s => {
        const w = parseFloat(s.weight) || 0;
        const r = parseInt(s.reps, 10) || 0;

        if (w > sessionMaxWeight) sessionMaxWeight = w;
        const oneRM = r === 1 ? w : w * (1 + r / 30);
        if (oneRM > sessionMax1RM) sessionMax1RM = oneRM;
        sessionVolume += (w * r);
      });

      let yValue = 0;
      if (state.activeChartTypeTab3 === '1rm') {
        yValue = sessionMax1RM;
      } else if (state.activeChartTypeTab3 === 'weight') {
        yValue = sessionMaxWeight;
      } else {
        yValue = sessionVolume;
      }
      values.push(yValue);
    }
  });

  const baseVal = Math.round(values[0]);
  const maxVal = Math.round(Math.max(...values));
  const currentVal = Math.round(values[values.length - 1]);

  const percentage = maxVal > 0 ? (currentVal / maxVal) : 0;
  const strokeDashoffset = 251.3 * (1 - percentage);

  if (fillPath) {
    fillPath.setAttribute('stroke-dashoffset', strokeDashoffset.toFixed(1));
  }

  let unit = ' ק״ג';
  if (isTime) {
    unit = ' שניות';
  } else if (isReps) {
    unit = ' חזרות';
  } else if (state.activeChartTypeTab3 === 'volume') {
    unit = ' ק״ג';
  }

  if (valueDisplay) {
    valueDisplay.textContent = `${currentVal}${unit}`;
  }

  if (subtextDisplay) {
    const diffVal = currentVal - baseVal;
    const diffPct = baseVal > 0 ? ((diffVal / baseVal) * 100) : 0;
    if (diffVal >= 0) {
      subtextDisplay.textContent = `+${diffPct.toFixed(1)}% מתחילת הדרך 📈`;
      subtextDisplay.style.color = '#00ff87';
    } else {
      subtextDisplay.textContent = `${diffPct.toFixed(1)}% מתחילת הדרך 📉`;
      subtextDisplay.style.color = '#ea580c';
    }
  }

  if (limitLeft) {
    limitLeft.textContent = isTime ? `בסיס: ${baseVal} שניות` : (isReps ? `בסיס: ${baseVal} חזרות` : `בסיס: ${baseVal} ק״ג`);
  }
  if (limitRight) {
    limitRight.textContent = isTime ? `שיא אישי: ${maxVal} שניות` : (isReps ? `שיא אישי: ${maxVal} חזרות` : `שיא אישי: ${maxVal} ק״ג`);
  }

  // Premium record progression (previous PRs + visual other sets)
  const chronologicalPRs = [];
  if (isTime) {
    let runningMax = 0;
    chronological.forEach(w => {
      if (!w.exercises) return;
      const ex = w.exercises.find(e => e.name === exerciseName);
      if (ex && ex.sets) {
        const completedSets = ex.sets.filter(s => s.completed);
        if (completedSets.length > 0) {
          const sessionMax = Math.max(...completedSets.map(s => parseInt(s.time, 10) || 0));
          if (sessionMax > runningMax) {
            runningMax = sessionMax;
            chronologicalPRs.push({
              date: new Date(w.date),
              val: sessionMax
            });
          }
        }
      }
    });
  } else if (isReps) {
    let runningMax = 0;
    chronological.forEach(w => {
      if (!w.exercises) return;
      const ex = w.exercises.find(e => e.name === exerciseName);
      if (ex && ex.sets) {
        const completedSets = ex.sets.filter(s => s.completed);
        if (completedSets.length > 0) {
          const sessionMax = Math.max(...completedSets.map(s => parseInt(s.reps, 10) || 0));
          if (sessionMax > runningMax) {
            runningMax = sessionMax;
            chronologicalPRs.push({
              date: new Date(w.date),
              val: sessionMax
            });
          }
        }
      }
    });
  } else {
    let runningMax = 0;
    chronological.forEach(w => {
      if (!w.exercises) return;
      const ex = w.exercises.find(e => e.name === exerciseName);
      if (ex && ex.sets) {
        const completedSets = ex.sets.filter(s => s.completed);
        if (completedSets.length > 0) {
          const sessionMax = Math.max(...completedSets.map(s => parseFloat(s.weight) || 0));
          if (sessionMax > runningMax) {
            runningMax = sessionMax;
            chronologicalPRs.push({
              date: new Date(w.date),
              val: sessionMax
            });
          }
        }
      }
    });
  }

  const unitLabel = isTime ? 'שניות' : (isReps ? 'חזרות' : 'ק״ג');

  let peaksHtml = '';
  if (chronologicalPRs.length > 1) {
    const peaksToShow = [];
    if (chronologicalPRs.length >= 2) {
      peaksToShow.push(chronologicalPRs[chronologicalPRs.length - 2]);
    }
    if (chronologicalPRs.length >= 3) {
      peaksToShow.push(chronologicalPRs[chronologicalPRs.length - 3]);
    }
    
    peaksHtml = `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted);">⏮️ שיאים קודמים:</span>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${peaksToShow.map((p, idx) => {
            const dStr = p.date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
            return `
              <div style="flex: 1; min-width: 100px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 8px; border-radius: 10px; text-align: center; font-size: 0.78rem;">
                <span style="display: block; color: var(--text-muted); font-size: 0.7rem; font-weight: 600;">שיא קודם ${idx + 1}</span>
                <strong style="color: #fb7185; font-size: 0.88rem;">${p.val} ${unitLabel}</strong>
                <span style="display: block; font-size: 0.68rem; color: rgba(255,255,255,0.4); margin-top: 2px;">${dStr}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Extract sets of the latest session
  const latestSession = exerciseSessions[exerciseSessions.length - 1];
  let setsHtml = '';
  if (latestSession && latestSession.sets && latestSession.sets.length > 0) {
    let peakSetIdx = -1;
    let maxSetVal = -1;
    latestSession.sets.forEach((s, idx) => {
      const val = isTime ? (parseInt(s.time, 10) || 0) : (isReps ? (parseInt(s.reps, 10) || 0) : (parseFloat(s.weight) || 0));
      if (val > maxSetVal) {
        maxSetVal = val;
        peakSetIdx = idx;
      }
    });

    setsHtml = `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted);">⚡ סטים מאימון אחרון:</span>
        <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; direction: rtl;">
          ${latestSession.sets.map((s, idx) => {
            const isPeak = (idx === peakSetIdx);
            let val = '';
            if (isTime) {
              val = `${s.time || 0} ש׳`;
            } else if (isReps) {
              val = `${s.reps || 0} חזרות`;
            } else {
              val = `${s.weight || 0} ק״ג × ${s.reps || 0}`;
            }
            
            const bg = isPeak ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.15) 0%, rgba(0, 255, 135, 0.15) 100%)' : 'rgba(255,255,255,0.03)';
            const border = isPeak ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(255,255,255,0.06)';
            const textColor = isPeak ? '#00FF87' : 'var(--text-muted)';
            const shadow = isPeak ? 'box-shadow: 0 0 8px rgba(0, 240, 255, 0.15);' : '';
            const labelColor = isPeak ? '#00F0FF' : 'rgba(255,255,255,0.3)';

            return `
              <div style="flex: 0 0 auto; min-width: 80px; background: ${bg}; border: ${border}; ${shadow} padding: 6px 8px; border-radius: 10px; text-align: center;">
                <span style="display: block; font-size: 0.65rem; color: ${labelColor}; font-weight: 700; margin-bottom: 2px;">סט ${idx + 1}${isPeak ? ' 🏆' : ''}</span>
                <strong style="color: ${textColor}; font-size: 0.82rem; white-space: nowrap;">${val}</strong>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  const premiumPanel = document.getElementById('inspector-premium-panel');
  if (premiumPanel) {
    if (peaksHtml || setsHtml) {
      premiumPanel.style.display = 'flex';
      premiumPanel.innerHTML = `
        ${peaksHtml}
        ${peaksHtml && setsHtml ? '<div style="height: 1px; background: rgba(255,255,255,0.05); margin: 4px 0;"></div>' : ''}
        ${setsHtml}
      `;
    } else {
      premiumPanel.style.display = 'none';
    }
  }
}

export function deleteGlobalExercise(exerciseName) {
  if (isSystemExercise(exerciseName)) {
    alert("תרגילי מערכת הם קבועים ולא ניתן למחוק אותם. תוכל למחוק רק תרגילים מותאמים אישית שיצרת.");
    return;
  }

  if (!confirm(`האם אתה בטוח שברצונך למחוק את "${exerciseName}" לצמיתות?\nפעולה זו תסיר את התרגיל מרשימות הבחירה בעתיד, אך תשמור אותו בהיסטוריית האימונים הישנים שלך כדי לשמור על הסטטיסטיקות.`)) {
    return;
  }

  if (state.currentUser) {
    state.customExercises = state.customExercises.filter(ex => ex.name.trim().toLowerCase() !== exerciseName.trim().toLowerCase());
    invalidateExerciseLookupCache();
    SafeStorage.setItem(`aura-custom-exercises_${state.currentUser.uid}`, JSON.stringify(state.customExercises));
    saveFieldToCloud("customExercises", state.customExercises);
  }

  const modal = document.getElementById('exercise-inspector-modal');
  if (modal) modal.classList.add('hide');

  renderExercisesManager();
  if (typeof window.renderExercisePickerList === 'function') window.renderExercisePickerList();
  
  alert(`התרגיל "${exerciseName}" נמחק לנצח! 🗑️`);
}

export function addGlobalExercise() {
  const nameInput = document.getElementById('new-global-exercise-name');

  if (!nameInput || !nameInput.value.trim()) {
    alert('אנא הזן שם לתרגיל החדש.');
    if (nameInput) nameInput.focus();
    return;
  }

  const name = nameInput.value.trim();
  
  const activeMuscleCard = document.querySelector('#new-global-exercise-muscle-selector .muscle-card.active');
  const category = activeMuscleCard ? activeMuscleCard.dataset.category : 'אחר';
  
  const activeEmojiBtn = document.querySelector('#new-global-exercise-emoji-selector .emoji-pick-btn.active');
  const emoji = activeEmojiBtn ? activeEmojiBtn.dataset.emoji : '';

  let allExs = getAllExercises();

  if (allExs.some(ex => ex.name.trim().toLowerCase() === name.toLowerCase())) {
    alert('תרגיל בשם זה כבר קיים במערכת!');
    return;
  }

  const newEx = {
    name,
    category,
    emoji: emoji || '💪'
  };



  if (state.currentUser) {
    state.customExercises.push(newEx);
    invalidateExerciseLookupCache();
    SafeStorage.setItem(`aura-custom-exercises_${state.currentUser.uid}`, JSON.stringify(state.customExercises));
    saveFieldToCloud("customExercises", state.customExercises);
  }

  // --- SAVE THE DEFAULTS CONFIGURED IN THE MODAL ---
  const setsDisplay = document.getElementById('new-global-sets-display');
  const targetSetsCount = setsDisplay ? parseInt(setsDisplay.textContent, 10) || 3 : 3;

  const activeRestChip = document.querySelector('#new-global-rest-chips .new-global-rest-chip.active');
  const restTime = activeRestChip ? parseInt(activeRestChip.dataset.rest, 10) || 90 : 90;

  const activeMetricCards = document.querySelectorAll('#add-global-exercise-modal .new-global-metric-card.active');
  const metrics = Array.from(activeMetricCards).map(card => card.dataset.metric || 'weight');
  const finalMetrics = metrics.length > 0 ? metrics : ['weight', 'reps'];

  saveExerciseDefaults(name, {
    targetSetsCount,
    restTime,
    metrics: finalMetrics
  });

  // --- RESET INPUTS ---
  nameInput.value = '';
  if (setsDisplay) setsDisplay.textContent = '3';
  
  const addSetsChips = document.querySelectorAll('#new-global-sets-chips .new-global-sets-chip');
  addSetsChips.forEach(c => {
    c.classList.remove('active');
    if (parseInt(c.dataset.sets, 10) === 3) c.classList.add('active');
  });

  const addRestChips = document.querySelectorAll('#new-global-rest-chips .new-global-rest-chip');
  addRestChips.forEach(c => {
    c.classList.remove('active');
    if (parseInt(c.dataset.rest, 10) === 90) c.classList.add('active');
  });

  const addMetricCards = document.querySelectorAll('#add-global-exercise-modal .new-global-metric-card');
  addMetricCards.forEach(c => {
    c.classList.remove('active');
    if (c.dataset.metric === 'weight' || c.dataset.metric === 'reps') c.classList.add('active');
  });

  const modal = document.getElementById('add-global-exercise-modal');
  if (modal) modal.classList.add('hide');

  renderExercisesManager();
  if (typeof window.renderExercisePickerList === 'function') window.renderExercisePickerList();
}

export function saveEditedGlobalExercise(oldName) {
  const nameInput = document.getElementById('edit-global-exercise-name');
  if (!nameInput || !nameInput.value.trim()) {
    alert('אנא הזן שם לתרגיל.');
    if (nameInput) nameInput.focus();
    return;
  }

  const newName = nameInput.value.trim();
  
  const activeMuscleCard = document.querySelector('#edit-global-exercise-muscle-selector .muscle-card.active');
  const category = activeMuscleCard ? activeMuscleCard.dataset.category : 'אחר';
  
  const activeEmojiBtn = document.querySelector('#edit-global-exercise-emoji-selector .emoji-pick-btn.active');
  const emoji = activeEmojiBtn ? activeEmojiBtn.dataset.emoji : '';

  let allExs = getAllExercises();

  // If the name changed, check for conflict with other exercises
  if (oldName.trim().toLowerCase() !== newName.trim().toLowerCase()) {
    if (allExs.some(ex => ex.name.trim().toLowerCase() === newName.toLowerCase())) {
      alert('תרגיל בשם זה כבר קיים במערכת!');
      return;
    }
  }

  // 1. Update in state.customExercises
  if (state.currentUser) {
    let customFound = false;
    state.customExercises.forEach(ex => {
      if (ex.name.trim().toLowerCase() === oldName.trim().toLowerCase()) {
        ex.name = newName;
        ex.category = category;
        ex.emoji = emoji || '💪';
        customFound = true;
      }
    });
    if (customFound) {
      invalidateExerciseLookupCache();
      SafeStorage.setItem(`aura-custom-exercises_${state.currentUser.uid}`, JSON.stringify(state.customExercises));
      saveFieldToCloud("customExercises", state.customExercises);
    }
  }

  // 3. Update in state.favoriteExercises
  const favIdx = state.favoriteExercises.indexOf(oldName);
  if (favIdx > -1) {
    state.favoriteExercises[favIdx] = newName;
    if (state.currentUser) {
      SafeStorage.setItem(`aura-favorite-exercises_${state.currentUser.uid}`, JSON.stringify(state.favoriteExercises));
      saveFieldToCloud("favoriteExercises", state.favoriteExercises);
    }
  }

  // 4. Update in state.workoutHistory (renaming all occurrences to preserve log history/PR graphs)
  if (state.currentUser && state.workoutHistory) {
    let historyModified = false;
    state.workoutHistory.forEach(w => {
      if (w.exercises) {
        w.exercises.forEach(ex => {
          if (ex.name === oldName) {
            ex.name = newName;
            historyModified = true;
          }
        });
      }
    });
    if (historyModified) {
      SafeStorage.setItem(`aura-workout-history_${state.currentUser.uid}`, JSON.stringify(state.workoutHistory));
      saveFieldToCloud("workoutHistory", state.workoutHistory);
      if (typeof window.renderWorkoutHistory === 'function') {
        window.renderWorkoutHistory();
      }
    }
  }

  // 5. Update in activeWorkout if it contains this exercise
  if (state.activeWorkout && state.activeWorkout.exercises) {
    let activeModified = false;
    state.activeWorkout.exercises.forEach(ex => {
      if (ex.name === oldName) {
        ex.name = newName;
        activeModified = true;
      }
    });
    if (activeModified) {
      saveActiveWorkoutState();
      if (typeof window.renderExercises === 'function') {
        window.renderExercises();
      }
    }
  }

  // --- SAVE THE DEFAULTS CONFIGURED IN THE EDIT MODAL ---
  const setsDisplay = document.getElementById('edit-global-sets-display');
  const targetSetsCount = setsDisplay ? parseInt(setsDisplay.textContent, 10) || 3 : 3;

  const activeRestChip = document.querySelector('#edit-global-rest-chips .edit-global-rest-chip.active');
  const restTime = activeRestChip ? parseInt(activeRestChip.dataset.rest, 10) || 90 : 90;

  const activeMetricCards = document.querySelectorAll('#edit-global-exercise-modal .edit-global-metric-card.active');
  const metrics = Array.from(activeMetricCards).map(card => card.dataset.metric || 'weight');
  const finalMetrics = metrics.length > 0 ? metrics : ['weight', 'reps'];

  // If the name changed, rename/delete old defaults key in the parsed storage dictionary
  if (state.currentUser) {
    const defaultsKey = `aura-exercise-defaults_${state.currentUser.uid}`;
    const defaultsData = SafeStorage.getItem(defaultsKey);
    if (defaultsData) {
      try {
        const defaults = JSON.parse(defaultsData);
        if (oldName in defaults) {
          delete defaults[oldName];
          SafeStorage.setItem(defaultsKey, JSON.stringify(defaults));
        }
      } catch (e) {
        console.error("Failed to clean up old exercise name defaults entry:", e);
      }
    }
  }

  saveExerciseDefaults(newName, {
    targetSetsCount,
    restTime,
    metrics: finalMetrics
  });

  // 6. Close edit modal
  const editModal = document.getElementById('edit-global-exercise-modal');
  if (editModal) editModal.classList.add('hide');

  // 7. Refresh UIs
  renderExercisesManager();
  if (typeof window.renderExercisePickerList === 'function') window.renderExercisePickerList();

  // 8. Update inspector context if displaying the renamed exercise
  if (state.currentInspectorExercise === oldName) {
    state.currentInspectorExercise = newName;
    openExerciseInspector(newName);
  }

  alert(`התרגיל "${newName}" עודכן בהצלחה! ✏️`);
}

// Orchestrator for subtab rendering
export function renderAnalytics() {
  console.log("Refreshing Analytics view with active filters...", state.activeSubTab);
  
  if (state.activeSubTab === 'workouts') {
    renderWorkoutsLog();
  } else if (state.activeSubTab === 'calendar') {
    renderCalendarView();
    renderMuscleSplitView();
    renderAerobicAnalyticsCard(state.aerobicTimeSelection || '30');
  } else if (state.activeSubTab === 'exercises') {
    renderExercisesManager();
  } else if (state.activeSubTab === 'ai') {
    console.log("Aura AI Coach segment active.");
  }
}

// coming soon Coach Orb Card interactions
export function initAICoach() {
  const card = document.querySelector('#sub-tab-ai .aura-ai-card');
  if (!card) return;

  card.addEventListener('click', (e) => {
    e.preventDefault();

    const ripple = document.createElement('span');
    ripple.className = 'ai-ripple';

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    card.appendChild(ripple);

    if (navigator.vibrate) {
      navigator.vibrate(15);
    }

    showAuraToast("המאמן האישי שלך בהכנה... 🤖🔥");

    setTimeout(() => {
      ripple.remove();
    }, 800);
  });
}

// Setup Analytics Event Binders on DOM ready
export function initAnalyticsTab() {
  // Dynamic Horizontal Filters Bar listeners for Workouts
  const pills = document.querySelectorAll('#pill-location, #pill-date, #pill-muscle, #pill-sort');
  const dropdownPanel = document.getElementById('filter-dropdown-panel');

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.premium-filter-bar-container')) {
      if (dropdownPanel) dropdownPanel.classList.add('hide');
      pills.forEach(p => p.classList.remove('active'));
    }
  });

  pills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const category = pill.dataset.category;
      
      if (pill.classList.contains('active')) {
        pill.classList.remove('active');
        if (dropdownPanel) dropdownPanel.classList.add('hide');
        return;
      }

      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      if (dropdownPanel) {
        dropdownPanel.innerHTML = '';
        dropdownPanel.classList.remove('hide');
        populateFilterDropdown(category, dropdownPanel, pill);
      }
    });
  });

  // Exercises sub-tab filter pills dynamic bindings
  const exPills = document.querySelectorAll('#pill-ex-muscle, #pill-ex-type, #pill-ex-usage, #pill-ex-favorite');
  const exDropdownPanel = document.getElementById('exercises-filter-dropdown-panel');

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#sub-tab-exercises .premium-filter-bar-container')) {
      if (exDropdownPanel) exDropdownPanel.classList.add('hide');
      exPills.forEach(p => p.classList.remove('active'));
    }
  });

  exPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const category = pill.dataset.category;
      
      if (pill.classList.contains('active')) {
        pill.classList.remove('active');
        if (exDropdownPanel) exDropdownPanel.classList.add('hide');
        return;
      }

      exPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      if (exDropdownPanel) {
        exDropdownPanel.innerHTML = '';
        exDropdownPanel.classList.remove('hide');
        populateExercisesFilterDropdown(category, exDropdownPanel, pill);
      }
    });
  });

  // Exercises Leaderboard Modal dynamic bindings
  const showLeaderboardBtn = document.getElementById('show-exercises-leaderboard-btn');
  const leaderboardModal = document.getElementById('exercises-leaderboard-modal');
  const closeLeaderboardModalBtn = document.getElementById('close-leaderboard-modal-btn');

  if (showLeaderboardBtn && leaderboardModal) {
    showLeaderboardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      renderExercisesLeaderboardModal();
      leaderboardModal.classList.remove('hide');
      leaderboardModal.style.display = 'flex';
    });
  }

  if (closeLeaderboardModalBtn && leaderboardModal) {
    closeLeaderboardModalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      leaderboardModal.classList.add('hide');
      leaderboardModal.style.display = 'none';
    });
  }

  if (leaderboardModal) {
    leaderboardModal.addEventListener('click', (e) => {
      if (e.target === leaderboardModal) {
        leaderboardModal.classList.add('hide');
        leaderboardModal.style.display = 'none';
      }
    });
  }

  // Metrics Sub-Navigation Bar Tab Switcher
  const subNavTabs = document.querySelectorAll('#metrics-sub-nav .nav-tab[data-sub-tab]');
  subNavTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      const subTab = tab.dataset.subTab;
      if (!subTab) return;

      state.activeSubTab = subTab;

      // Update active class on sub-nav tabs
      subNavTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active sub-tab panes and adjust inline display styles
      const subPanes = document.querySelectorAll('#tab-analytics .sub-tab-pane');
      subPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `sub-tab-${subTab}`) {
          pane.classList.add('active');
          pane.style.display = 'flex';
          pane.scrollTop = 0;
          
          // Reset internal scrollable wrappers
          const innerScrolls = pane.querySelectorAll('.ios-analytics-scroll-container, .exercises-list-container, .workout-history-list');
          innerScrolls.forEach(c => c.scrollTop = 0);
        } else {
          pane.style.display = 'none';
        }
      });

      console.log(`Switched to metrics sub-tab: ${subTab}`);
      renderAnalytics();
    });
  });

  // Metrics Sub-Navigation Back Button Handler
  const subNavBackBtn = document.getElementById('sub-nav-back-btn');
  if (subNavBackBtn) {
    subNavBackBtn.onclick = (e) => {
      e.stopPropagation();
      if (window.goBackNav) {
        window.goBackNav();
      } else if (window.switchTab) {
        window.switchTab('settings');
      }
    };
  }

  // Time filter chips listener removed (replaced by horizontal filters bar)

  const startD = document.getElementById('filter-start-date');
  const endD = document.getElementById('filter-end-date');

  const onDateChange = () => {
    state.filterStartDate = startD && startD.value ? new Date(startD.value) : null;
    state.filterEndDate = endD && endD.value ? new Date(endD.value) : null;
    renderAnalytics();
  };

  if (startD) startD.addEventListener('change', onDateChange);
  if (endD) endD.addEventListener('change', onDateChange);

  // Dropdowns filters
  const locationSelect = document.getElementById('filter-location-select');
  const muscleSelect = document.getElementById('filter-muscle-select');

  if (locationSelect) {
    locationSelect.addEventListener('change', () => {
      state.filterLocation = locationSelect.value;
      renderAnalytics();
    });
  }

  if (muscleSelect) {
    muscleSelect.addEventListener('change', () => {
      state.filterMuscleGroup = muscleSelect.value;
      renderAnalytics();
    });
  }

  // Calendar monthly navigations
  const prevMonthBtn = document.getElementById('calendar-prev-month');
  const nextMonthBtn = document.getElementById('calendar-next-month');

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() - 1);
      renderCalendarView();
    });
  }
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() + 1);
      renderCalendarView();
    });
  }

  // Future scheduling system
  const scheduleTriggerBtn = document.getElementById('schedule-workout-trigger-btn');
  const scheduleModal = document.getElementById('schedule-workout-modal');
  const closeScheduleBtn = document.getElementById('close-schedule-workout-btn');
  const scheduleForm = document.getElementById('schedule-workout-form');
  const scheduleLocationSelect = document.getElementById('schedule-location-select');
  const scheduleCustomLocation = document.getElementById('schedule-custom-location');

  if (scheduleTriggerBtn && scheduleModal) {
    scheduleTriggerBtn.addEventListener('click', () => {
      requestNotificationPermissionSafely();
      
      scheduleModal.classList.remove('hide');
      scheduleModal.style.display = 'flex';
      
      const todayStr = new Date().toISOString().split('T')[0];
      const dateInput = document.getElementById('schedule-date');
      if (dateInput) dateInput.value = todayStr;
    });
  }

  if (closeScheduleBtn && scheduleModal) {
    closeScheduleBtn.addEventListener('click', () => {
      scheduleModal.classList.add('hide');
      scheduleModal.style.display = 'none';
    });
  }

  if (scheduleLocationSelect && scheduleCustomLocation) {
    scheduleLocationSelect.addEventListener('change', () => {
      if (scheduleLocationSelect.value === 'custom') {
        scheduleCustomLocation.style.display = 'block';
        scheduleCustomLocation.setAttribute('required', 'true');
      } else {
        scheduleCustomLocation.style.display = 'none';
        scheduleCustomLocation.removeAttribute('required');
      }
    });
  }

  if (scheduleForm && scheduleModal) {
    scheduleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const locVal = scheduleLocationSelect.value;
      let finalLoc = '';
      let emoji = '🏋️‍♂️';

      if (locVal === 'custom') {
        finalLoc = scheduleCustomLocation.value.trim();
        emoji = '✨';
      } else if (locVal === 'gym') {
        finalLoc = 'חדר כושר';
        emoji = '🏋️‍♂️';
      } else if (locVal === 'park') {
        finalLoc = 'פארק';
        emoji = '🌳';
      } else {
        const matched = state.customLocations.find(l => l.id === locVal);
        if (matched) {
          finalLoc = matched.name;
          emoji = matched.emoji || '💪';
        }
      }

      const dateVal = document.getElementById('schedule-date').value;
      const timeVal = document.getElementById('schedule-time').value;
      const reminderSelect = document.getElementById('schedule-reminder-select');
      const reminderMinutes = parseInt(reminderSelect.value, 10);

      if (!finalLoc || !dateVal || !timeVal) {
        alert("נא למלא את כל השדות החיוניים");
        return;
      }

      const newFutureWorkout = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        location: finalLoc,
        locationEmoji: emoji,
        date: dateVal,
        time: timeVal,
        reminderMinutes: reminderMinutes,
        reminderSent: false
      };

      const currentFutures = getFutureWorkouts();
      currentFutures.push(newFutureWorkout);
      saveFutureWorkouts(currentFutures);

      scheduleModal.classList.add('hide');
      scheduleModal.style.display = 'none';

      scheduleForm.reset();
      if (scheduleCustomLocation) {
        scheduleCustomLocation.style.display = 'none';
        scheduleCustomLocation.removeAttribute('required');
      }

      requestNotificationPermissionSafely();
      renderCalendarView();

      alert(`אימון עתידי מסוג "${finalLoc}" מתוזמן בהצלחה! 🏋️‍♂️`);
    });
  }

  // EXERCISES MANAGER SUBTAB EVENTS BINDINGS
  const addExGlobalBtn = document.getElementById('add-new-global-exercise-btn');
  const addExGlobalModal = document.getElementById('add-global-exercise-modal');
  const closeAddExGlobalModalBtn = document.getElementById('close-add-global-exercise-modal-btn');
  
  if (addExGlobalBtn && addExGlobalModal) {
    addExGlobalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Reset inputs & selectors on open
      const nameInput = document.getElementById('new-global-exercise-name');
      if (nameInput) nameInput.value = '';
      
      const muscleSelector = document.getElementById('new-global-exercise-muscle-selector');
      if (muscleSelector) {
        muscleSelector.querySelectorAll('.muscle-card').forEach(btn => {
          btn.classList.remove('active');
          if (btn.dataset.category === 'חזה') btn.classList.add('active');
        });
      }
      
      const emojiSelector = document.getElementById('new-global-exercise-emoji-selector');
      if (emojiSelector) {
        emojiSelector.querySelectorAll('.emoji-pick-btn').forEach(btn => {
          btn.classList.remove('active');
          if (btn.dataset.emoji === '') btn.classList.add('active');
        });
      }
      
      addExGlobalModal.classList.remove('hide');
      if (nameInput) setTimeout(() => nameInput.focus(), 100);
    });
  }

  // Setup click bindings for muscle cards in global modal
  const globalMuscleSelector = document.getElementById('new-global-exercise-muscle-selector');
  if (globalMuscleSelector) {
    globalMuscleSelector.addEventListener('click', (e) => {
      const pill = e.target.closest('.muscle-card');
      if (!pill) return;
      globalMuscleSelector.querySelectorAll('.muscle-card').forEach(b => b.classList.remove('active'));
      pill.classList.add('active');
    });
  }

  // Setup click bindings for emoji picker in global modal
  const globalEmojiSelector = document.getElementById('new-global-exercise-emoji-selector');
  if (globalEmojiSelector) {
    globalEmojiSelector.addEventListener('click', (e) => {
      const emojiBtn = e.target.closest('.emoji-pick-btn');
      if (!emojiBtn) return;
      globalEmojiSelector.querySelectorAll('.emoji-pick-btn').forEach(b => b.classList.remove('active'));
      emojiBtn.classList.add('active');
    });
  }

  if (closeAddExGlobalModalBtn && addExGlobalModal) {
    closeAddExGlobalModalBtn.addEventListener('click', () => {
      addExGlobalModal.classList.add('hide');
    });
    addExGlobalModal.addEventListener('click', (e) => {
      if (e.target === addExGlobalModal) addExGlobalModal.classList.add('hide');
    });
  }

  const saveExGlobalBtn = document.getElementById('save-new-global-exercise-btn');
  if (saveExGlobalBtn) {
    saveExGlobalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addGlobalExercise();
    });
  }

  const closeInspectorBtn = document.getElementById('close-exercise-inspector-btn');
  const inspectorModal = document.getElementById('exercise-inspector-modal');
  
  if (closeInspectorBtn && inspectorModal) {
    closeInspectorBtn.addEventListener('click', () => {
      inspectorModal.classList.add('hide');
    });
    inspectorModal.addEventListener('click', (e) => {
      if (e.target === inspectorModal) inspectorModal.classList.add('hide');
    });
  }

  // Handle inspector metric toggle click events
  const btnWeight = document.getElementById('inspector-toggle-weight');
  const btnReps = document.getElementById('inspector-toggle-reps');
  const btnTime = document.getElementById('inspector-toggle-time');
  if (btnWeight || btnReps || btnTime) {
    const handleMetricChange = (metric) => {
      if (state.activeInspectorMetric === metric) return;
      state.activeInspectorMetric = metric;
      
      if (btnWeight) btnWeight.classList.toggle('active', metric === 'weight');
      if (btnReps) btnReps.classList.toggle('active', metric === 'reps');
      if (btnTime) btnTime.classList.toggle('active', metric === 'time');
      
      const exName = state.currentInspectorExercise;
      if (exName) {
        updateInspectorStatistics(exName);
        updateInspectorTimeline(exName);
        renderExerciseInspectorChart();
      }
    };

    if (btnWeight) {
      btnWeight.addEventListener('click', (e) => {
        e.stopPropagation();
        handleMetricChange('weight');
      });
    }
    if (btnReps) {
      btnReps.addEventListener('click', (e) => {
        e.stopPropagation();
        handleMetricChange('reps');
      });
    }
    if (btnTime) {
      btnTime.addEventListener('click', (e) => {
        e.stopPropagation();
        handleMetricChange('time');
      });
    }
  }

  const deleteExGlobalBtn = document.getElementById('delete-global-exercise-btn');
  if (deleteExGlobalBtn) {
    deleteExGlobalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentInspectorExercise) {
        deleteGlobalExercise(state.currentInspectorExercise);
      }
    });
  }

  // Edit Global Exercise Modal Event Listeners
  const editExGlobalBtn = document.getElementById('edit-global-exercise-btn');
  const editExGlobalModal = document.getElementById('edit-global-exercise-modal');
  const closeEditExGlobalModalBtn = document.getElementById('close-edit-global-exercise-modal-btn');
  
  if (editExGlobalBtn && editExGlobalModal) {
    editExGlobalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      const currentName = state.currentInspectorExercise;
      if (!currentName) return;

      if (isSystemExercise(currentName)) {
        alert("תרגילי מערכת הם קבועים ולא ניתן לערוך אותם. תוכל ליצור תרגיל מותאם אישית חדש.");
        return;
      }
      
      const allExs = getAllExercises();
      const exDetails = allExs.find(ex => ex.name === currentName) || { name: currentName, category: 'אחר', emoji: '💪' };
      
      // Populate name & category
      const nameInput = document.getElementById('edit-global-exercise-name');
      if (nameInput) nameInput.value = exDetails.name;
      
      const muscleSelector = document.getElementById('edit-global-exercise-muscle-selector');
      if (muscleSelector) {
        muscleSelector.querySelectorAll('.muscle-card').forEach(btn => {
          btn.classList.remove('active');
          if (btn.dataset.category === exDetails.category) btn.classList.add('active');
        });
      }
      
      const emojiSelector = document.getElementById('edit-global-exercise-emoji-selector');
      if (emojiSelector) {
        emojiSelector.querySelectorAll('.emoji-pick-btn').forEach(btn => {
          btn.classList.remove('active');
          const targetEmoji = exDetails.emoji === '💪' ? '' : exDetails.emoji;
          if (btn.dataset.emoji === exDetails.emoji || (exDetails.emoji === '💪' && btn.dataset.emoji === '') || (!exDetails.emoji && btn.dataset.emoji === '')) {
            btn.classList.add('active');
          }
        });
      }
      
      // --- POPULATE THE DEFAULTS CONFIG IN EDIT MODAL ---
      const defaults = getExerciseDefaults(currentName) || { targetSetsCount: 3, restTime: 90, metrics: ['weight', 'reps'] };

      const editSetsDisplay = document.getElementById('edit-global-sets-display');
      if (editSetsDisplay) editSetsDisplay.textContent = defaults.targetSetsCount || 3;

      const editSetsChips = document.querySelectorAll('#edit-global-sets-chips .edit-global-sets-chip');
      editSetsChips.forEach(chip => {
        chip.classList.remove('active');
        if (parseInt(chip.dataset.sets, 10) === (defaults.targetSetsCount || 3)) {
          chip.classList.add('active');
        }
      });

      const editRestChips = document.querySelectorAll('#edit-global-rest-chips .edit-global-rest-chip');
      editRestChips.forEach(chip => {
        chip.classList.remove('active');
        if (parseInt(chip.dataset.rest, 10) === (defaults.restTime || 90)) {
          chip.classList.add('active');
        }
      });

      const editMetricCards = document.querySelectorAll('#edit-global-exercise-modal .edit-global-metric-card');
      const activeMetrics = defaults.metrics || ['weight', 'reps'];
      editMetricCards.forEach(card => {
        card.classList.remove('active');
        if (activeMetrics.includes(card.dataset.metric)) {
          card.classList.add('active');
        }
      });
      
      // Hide inspector overlay to prevent stacking conflicts
      const inspectorModal = document.getElementById('exercise-inspector-modal');
      if (inspectorModal) inspectorModal.classList.add('hide');

      editExGlobalModal.classList.remove('hide');
      if (nameInput) setTimeout(() => nameInput.focus(), 100);
    });
  }

  // Setup click bindings for muscle cards in edit modal
  const editMuscleSelector = document.getElementById('edit-global-exercise-muscle-selector');
  if (editMuscleSelector) {
    editMuscleSelector.addEventListener('click', (e) => {
      const pill = e.target.closest('.muscle-card');
      if (!pill) return;
      editMuscleSelector.querySelectorAll('.muscle-card').forEach(b => b.classList.remove('active'));
      pill.classList.add('active');
    });
  }

  // Setup click bindings for emoji picker in edit modal
  const editEmojiSelector = document.getElementById('edit-global-exercise-emoji-selector');
  if (editEmojiSelector) {
    editEmojiSelector.addEventListener('click', (e) => {
      const emojiBtn = e.target.closest('.emoji-pick-btn');
      if (!emojiBtn) return;
      editEmojiSelector.querySelectorAll('.emoji-pick-btn').forEach(b => b.classList.remove('active'));
      emojiBtn.classList.add('active');
    });
  }

  const restoreInspectorIfPossible = () => {
    if (state.currentInspectorExercise) {
      openExerciseInspector(state.currentInspectorExercise);
    }
  };

  if (closeEditExGlobalModalBtn && editExGlobalModal) {
    closeEditExGlobalModalBtn.addEventListener('click', () => {
      editExGlobalModal.classList.add('hide');
      restoreInspectorIfPossible();
    });
    editExGlobalModal.addEventListener('click', (e) => {
      if (e.target === editExGlobalModal) {
        editExGlobalModal.classList.add('hide');
        restoreInspectorIfPossible();
      }
    });
  }

  const saveExEditedBtn = document.getElementById('save-edited-global-exercise-btn');
  if (saveExEditedBtn) {
    saveExEditedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentInspectorExercise) {
        saveEditedGlobalExercise(state.currentInspectorExercise);
      }
    });
  }

  const searchInputTab3 = document.getElementById('exercises-search-input-tab3');
  if (searchInputTab3) {
    searchInputTab3.addEventListener('input', renderExercisesManager);
  }

  const muscleFilterTab3 = document.getElementById('exercises-muscle-filter-tab3');
  if (muscleFilterTab3) {
    muscleFilterTab3.addEventListener('change', renderExercisesManager);
  }

  const typeFilterTab3 = document.getElementById('exercises-type-filter-tab3');
  if (typeFilterTab3) {
    typeFilterTab3.addEventListener('change', renderExercisesManager);
  }

  const usageFilterTab3 = document.getElementById('exercises-usage-filter-tab3');
  if (usageFilterTab3) {
    usageFilterTab3.addEventListener('change', renderExercisesManager);
  }

  const favoriteFilterTab3 = document.getElementById('exercises-favorite-filter-tab3');
  if (favoriteFilterTab3) {
    favoriteFilterTab3.addEventListener('change', renderExercisesManager);
  }

  const inspectorFavBtn = document.getElementById('inspector-exercise-fav-btn');
  if (inspectorFavBtn) {
    inspectorFavBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.currentInspectorExercise) return;
      const exName = state.currentInspectorExercise;
      const idx = state.favoriteExercises.indexOf(exName);
      if (idx > -1) {
        state.favoriteExercises.splice(idx, 1);
        inspectorFavBtn.innerHTML = '☆';
        inspectorFavBtn.classList.remove('active');
        inspectorFavBtn.title = 'הוסף למועדפים';
      } else {
        state.favoriteExercises.push(exName);
        inspectorFavBtn.innerHTML = '⭐';
        inspectorFavBtn.classList.add('active');
        inspectorFavBtn.title = 'הסר ממועדפים';
      }
      if (state.currentUser) {
        SafeStorage.setItem(`aura-favorite-exercises_${state.currentUser.uid}`, JSON.stringify(state.favoriteExercises));
        saveFieldToCloud("favoriteExercises", state.favoriteExercises);
      }
      renderExercisesManager();
      if (typeof window.renderExercisePickerList === 'function') window.renderExercisePickerList();
    });
  }

  const chartTabsTab3 = document.querySelectorAll('[data-chart-tab3]');
  chartTabsTab3.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetChartType = tab.getAttribute('data-chart-tab3');
      if (!targetChartType) return;

      state.activeChartTypeTab3 = targetChartType;

      chartTabsTab3.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      renderExerciseInspectorChart();
    });
  });

  window.addEventListener('resize', () => {
    if (inspectorModal && !inspectorModal.classList.contains('hide')) {
      renderExerciseInspectorChart();
    }
  });

  // Start periodic reminders checker
  startFutureWorkoutReminderChecker();

  // Initialize Coming soon coach
  initAICoach();


}



// Hook into global compatibility mappings
export function initAnalyticsModule() {
  window.renderWorkoutHistory = renderWorkoutHistory;
  window.renderAnalytics = renderAnalytics;
  window.checkAndShowPreviousPerformance = checkAndShowPreviousPerformance;
  window.renderExercisesManager = renderExercisesManager;
  window.renderWorkoutsLog = renderWorkoutsLog;
}

// Helper compatibility functions
function renderWorkoutHistory() {
  renderAnalytics();
}

function checkAndShowPreviousPerformance(exerciseName) {
  if (!state.workoutHistory || state.workoutHistory.length === 0) return;

  const sorted = [...state.workoutHistory].sort((a, b) => b.date - a.date);
  const prevWorkout = sorted.find(w => w.exercises && w.exercises.some(ex => ex.name === exerciseName && ex.sets && ex.sets.some(s => s.completed)));
  if (!prevWorkout) return;

  const prevEx = prevWorkout.exercises.find(ex => ex.name === exerciseName);
  if (!prevEx) return;

  const completedSets = prevEx.sets.filter(s => s.completed);
  if (completedSets.length === 0) return;

  const titleEl = document.getElementById('prev-workout-alert-title');
  const dateEl = document.getElementById('prev-workout-alert-date');
  const container = document.getElementById('prev-workout-alert-sets');

  if (titleEl) titleEl.textContent = exerciseName;
  if (dateEl) {
    const dateObj = new Date(prevWorkout.date);
    const dateStr = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
    const locationStr = prevWorkout.locationName || (prevWorkout.location === 'gym' ? 'חדר כושר' : 'פארק');
    const emoji = prevWorkout.locationEmoji || (prevWorkout.location === 'gym' ? '🏋️‍♂️' : '🌳');
    dateEl.textContent = `אימון אחרון (${emoji} ${locationStr}): ${dateStr}`;
  }

  if (container) {
    container.innerHTML = '';
    completedSets.forEach((s, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 6px; font-size: 0.9rem; color: #ffffff;';
      
      const showWeight = prevEx.metrics ? prevEx.metrics.includes('weight') : (prevEx.metricType === 'both' || prevEx.metricType === 'weight' || !prevEx.metricType);
      const showReps = prevEx.metrics ? prevEx.metrics.includes('reps') : (prevEx.metricType === 'both' || prevEx.metricType === 'reps' || !prevEx.metricType);
      const showTime = prevEx.metrics ? prevEx.metrics.includes('time') : (prevEx.metricType === 'time');

      const parts = [];
      if (showWeight) {
        parts.push(`<strong>${s.weight || 0} ק״ג</strong>`);
      }
      if (showReps) {
        parts.push(`<strong>${s.reps || 0} חזרות</strong>`);
      }
      if (showTime) {
        parts.push(`<strong>${s.time || 0} ש׳</strong>`);
      }
      const valText = parts.join(' × ');

      row.innerHTML = `
        <span style="font-weight: 700; color: #ef4444;">סט ${idx + 1}</span>
        <span style="direction: ltr;">${valText}</span>
      `;
      container.appendChild(row);
    });
  }

  const modal = document.getElementById('prev-workout-alert-modal');
  if (modal) modal.classList.remove('hide');
}

// Bind Prev Alert dismiss and global modal settings bindings
onDOMReady(() => {
  const modal = document.getElementById('prev-workout-alert-modal');
  const closeBtn = document.getElementById('close-prev-workout-alert-btn');
  const okBtn = document.getElementById('prev-workout-alert-ok-btn');

  const dismiss = () => {
    if (modal) modal.classList.add('hide');
  };

  if (closeBtn) closeBtn.addEventListener('click', dismiss);
  if (okBtn) okBtn.addEventListener('click', dismiss);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) dismiss();
    });
  }

  bindGlobalModalsSettingsListeners();
});

function bindGlobalModalsSettingsListeners() {
  // --- ADD GLOBAL MODAL BINDINGS ---
  const newSetsMinus = document.getElementById('new-global-sets-minus');
  const newSetsPlus = document.getElementById('new-global-sets-plus');
  const newSetsDisplay = document.getElementById('new-global-sets-display');
  const newSetsChips = document.querySelectorAll('#new-global-sets-chips .new-global-sets-chip');

  if (newSetsMinus && newSetsPlus && newSetsDisplay) {
    newSetsMinus.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(newSetsDisplay.textContent, 10) || 3;
      val = Math.max(1, val - 1);
      newSetsDisplay.textContent = val;
      newSetsChips.forEach(c => c.classList.remove('active'));
      const matching = Array.from(newSetsChips).find(c => parseInt(c.dataset.sets, 10) === val);
      if (matching) matching.classList.add('active');
    });

    newSetsPlus.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(newSetsDisplay.textContent, 10) || 3;
      val = Math.min(12, val + 1);
      newSetsDisplay.textContent = val;
      newSetsChips.forEach(c => c.classList.remove('active'));
      const matching = Array.from(newSetsChips).find(c => parseInt(c.dataset.sets, 10) === val);
      if (matching) matching.classList.add('active');
    });
  }

  newSetsChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      newSetsChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      if (newSetsDisplay) newSetsDisplay.textContent = chip.dataset.sets;
    });
  });

  const newRestChips = document.querySelectorAll('#new-global-rest-chips .new-global-rest-chip');
  newRestChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      newRestChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  const newMetricCards = document.querySelectorAll('#add-global-exercise-modal .new-global-metric-card');
  newMetricCards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.toggle('active');
    });
  });

  // --- EDIT GLOBAL MODAL BINDINGS ---
  const editSetsMinus = document.getElementById('edit-global-sets-minus');
  const editSetsPlus = document.getElementById('edit-global-sets-plus');
  const editSetsDisplay = document.getElementById('edit-global-sets-display');
  const editSetsChips = document.querySelectorAll('#edit-global-sets-chips .edit-global-sets-chip');

  if (editSetsMinus && editSetsPlus && editSetsDisplay) {
    editSetsMinus.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(editSetsDisplay.textContent, 10) || 3;
      val = Math.max(1, val - 1);
      editSetsDisplay.textContent = val;
      editSetsChips.forEach(c => c.classList.remove('active'));
      const matching = Array.from(editSetsChips).find(c => parseInt(c.dataset.sets, 10) === val);
      if (matching) matching.classList.add('active');
    });

    editSetsPlus.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(editSetsDisplay.textContent, 10) || 3;
      val = Math.min(12, val + 1);
      editSetsDisplay.textContent = val;
      editSetsChips.forEach(c => c.classList.remove('active'));
      const matching = Array.from(editSetsChips).find(c => parseInt(c.dataset.sets, 10) === val);
      if (matching) matching.classList.add('active');
    });
  }

  editSetsChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      editSetsChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      if (editSetsDisplay) editSetsDisplay.textContent = chip.dataset.sets;
    });
  });

  const editRestChips = document.querySelectorAll('#edit-global-rest-chips .edit-global-rest-chip');
  editRestChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      editRestChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  const editMetricCards = document.querySelectorAll('#edit-global-exercise-modal .edit-global-metric-card');
  editMetricCards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.toggle('active');
    });
  });
}

function onDOMReady(fn) {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}
