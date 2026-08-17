import { state } from "../state.js";
import { SafeStorage } from "../utils/storage.js";
import { showPremiumToast, escapeHTML } from "../utils/helpers.js";
import { getCustomIcon } from "../utils/icons.js";
import { getDb, saveFieldToCloud } from "../utils/db.js";
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  setDoc, 
  deleteDoc, 
  addDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Safe helper to update text contents safely
const setElText = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

// Initialize Admin, Feedback & Inbox module
export function initAdminModule() {
  console.log("Initializing Admin Console & Feedback Center...");

  // --- NAVIGATION LISTENERS ---
  const settingsMainView = document.getElementById('settings-main-view');
  const adminView = document.getElementById('settings-admin-view');
  const feedbackView = document.getElementById('settings-feedback-view');
  const messagesView = document.getElementById('settings-messages-view');

  // Go to Admin Panel
  const goToAdminBtn = document.getElementById('go-to-admin-console-btn');
  if (goToAdminBtn) {
    goToAdminBtn.addEventListener('click', async () => {
      if (state.userRole !== 'admin') return;
      if (window.resetSettingsSubViews) window.resetSettingsSubViews();
      if (settingsMainView) settingsMainView.classList.add('hide');
      if (adminView) adminView.classList.remove('hide');
      
      // Load data immediately
      await loadAdminDashboardData();
    });
  }

  // Back from Admin Panel
  const backFromAdminBtn = document.getElementById('back-from-admin-btn');
  if (backFromAdminBtn) {
    backFromAdminBtn.addEventListener('click', () => {
      if (adminView) adminView.classList.add('hide');
      if (settingsMainView) settingsMainView.classList.remove('hide');
    });
  }

  // Go to Feedback view
  const goToFeedbackBtn = document.getElementById('go-to-feedback-btn');
  if (goToFeedbackBtn) {
    goToFeedbackBtn.addEventListener('click', () => {
      if (window.resetSettingsSubViews) window.resetSettingsSubViews();
      if (settingsMainView) settingsMainView.classList.add('hide');
      if (feedbackView) feedbackView.classList.remove('hide');
      
      // Reset inputs
      const textInput = document.getElementById('feedback-text-input');
      if (textInput) textInput.value = '';
    });
  }

  // Back from Feedback view
  const backFromFeedbackBtn = document.getElementById('back-from-feedback-btn');
  if (backFromFeedbackBtn) {
    backFromFeedbackBtn.addEventListener('click', () => {
      if (feedbackView) feedbackView.classList.add('hide');
      if (settingsMainView) settingsMainView.classList.remove('hide');
    });
  }

  // Go to Messages view
  const goToMessagesBtn = document.getElementById('go-to-messages-btn');
  if (goToMessagesBtn) {
    goToMessagesBtn.addEventListener('click', async () => {
      if (window.resetSettingsSubViews) window.resetSettingsSubViews();
      if (settingsMainView) settingsMainView.classList.add('hide');
      if (messagesView) messagesView.classList.remove('hide');
      
      // Render and mark all messages as read
      renderUserMessagesList();
      await markAllMessagesAsRead();
    });
  }

  // Back from Messages view
  const backFromMessagesBtn = document.getElementById('back-from-messages-btn');
  if (backFromMessagesBtn) {
    backFromMessagesBtn.addEventListener('click', () => {
      if (messagesView) messagesView.classList.add('hide');
      if (settingsMainView) settingsMainView.classList.remove('hide');
    });
  }

  // --- ADMIN TAB TRANSITIONS ---
  const tabButtons = document.querySelectorAll('#settings-admin-view .ios-segmented-control .segmented-btn');
  const tabContents = document.querySelectorAll('.admin-tab-content');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.dataset.adminTab;
      tabContents.forEach(content => {
        content.classList.add('hide');
        if (content.id === `admin-tab-${targetTab}`) {
          content.classList.remove('hide');
        }
      });
    });
  });

  // --- USER SEARCH ---
  const searchInput = document.getElementById('admin-user-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      filterAdminUsersList(query);
    });
  }

  // --- SEND GLOBAL ANNOUNCEMENT ---
  const sendAnnouncementBtn = document.getElementById('admin-send-announcement-btn');
  if (sendAnnouncementBtn) {
    sendAnnouncementBtn.addEventListener('click', async () => {
      const titleInput = document.getElementById('admin-announcement-title');
      const contentInput = document.getElementById('admin-announcement-content');
      
      const title = titleInput ? titleInput.value.trim() : '';
      const content = contentInput ? contentInput.value.trim() : '';

      if (!title || !content) {
        showPremiumToast("נא למלא את כותרת ותוכן ההודעה", "error");
        return;
      }

      sendAnnouncementBtn.disabled = true;
      sendAnnouncementBtn.textContent = 'שולח... ⏳';

      const success = await sendGlobalAnnouncement(title, content);
      
      sendAnnouncementBtn.disabled = false;
      sendAnnouncementBtn.innerHTML = `שלח הודעה גלובלית ${getCustomIcon('message')}`;

      if (success) {
        if (titleInput) titleInput.value = '';
        if (contentInput) contentInput.value = '';
        showPremiumToast("ההודעה הגלובלית נשלחה בהצלחה לכל המשתמשים!", "success");
        // Reload admin stats and data immediately
        await loadAdminDashboardData();
        // Sync own session if admin is a registered user, to instantly load it in their own inbox
        if (state.currentUser) {
          const { syncUserSession } = await import("../utils/db.js");
          await syncUserSession(state.currentUser.uid);
          updateAdminUI();
          renderUserMessagesList();
        }
      }
    });
  }

  // --- SUBMIT USER FEEDBACK ---
  const sendFeedbackSubmitBtn = document.getElementById('send-feedback-submit-btn');
  if (sendFeedbackSubmitBtn) {
    sendFeedbackSubmitBtn.addEventListener('click', async () => {
      const categorySelect = document.getElementById('feedback-category-input');
      const textInput = document.getElementById('feedback-text-input');

      const category = categorySelect ? categorySelect.value : 'הצעת שיפור';
      const text = textInput ? textInput.value.trim() : '';

      if (!text) {
        showPremiumToast("נא לכתוב את תוכן המשוב", "error");
        return;
      }

      sendFeedbackSubmitBtn.disabled = true;
      sendFeedbackSubmitBtn.textContent = 'שולח... ⏳';

      const success = await submitUserFeedback(category, text);

      sendFeedbackSubmitBtn.disabled = false;
      sendFeedbackSubmitBtn.innerHTML = `שלח משוב ${getCustomIcon('rocket')}`;

      if (success) {
        if (textInput) textInput.value = '';
        showPremiumToast("המשוב שלך נשלח בהצלחה! תודה על העזרה.", "success");
        // Go back
        const backBtn = document.getElementById('back-from-feedback-btn');
        if (backBtn) backBtn.click();
      }
    });
  }

  // --- SYSTEM UPDATE TRIGGER ---
  const triggerUpdateBtn = document.getElementById('admin-trigger-update-btn');
  if (triggerUpdateBtn) {
    triggerUpdateBtn.addEventListener('click', async () => {
      if (!('serviceWorker' in navigator)) {
        showPremiumToast('שירות Service Worker אינו זמין במכשיר זה.', 'error');
        return;
      }
      triggerUpdateBtn.disabled = true;
      triggerUpdateBtn.innerHTML = `בודק עדכונים... ${getCustomIcon('search')}`;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) { showPremiumToast('לא נמצא Service Worker רשום.', 'error'); triggerUpdateBtn.disabled = false; triggerUpdateBtn.innerHTML = `${getCustomIcon('rocket')} הפץ עדכון גרסה עכשיו`; return; }
        triggerUpdateBtn.innerHTML = `מחפש גרסה חדשה... ${getCustomIcon('refresh')}`;
        await reg.update();
        await new Promise(r => setTimeout(r, 2000));
        if (reg.waiting) {
          triggerUpdateBtn.innerHTML = `מפעיל עדכון... ${getCustomIcon('rocket')}`;
          reg.waiting.postMessage({ action: 'skipWaiting' });
          showPremiumToast('עדכון גרסה הופעל! האפליקציה תתרענן בקרוב.', 'success');
        } else if (reg.installing) {
          triggerUpdateBtn.innerHTML = `מתקין עדכון... ${getCustomIcon('settings')}`;
          reg.installing.addEventListener('statechange', function() {
            if (this.state === 'installed') {
              this.postMessage({ action: 'skipWaiting' });
              showPremiumToast('עדכון גרסה הופעל! האפליקציה תתרענן בקרוב.', 'success');
            }
          });
        } else {
          const worker = navigator.serviceWorker.controller || reg.active;
          if (worker) {
            triggerUpdateBtn.innerHTML = `מרענן קבצים... ${getCustomIcon('inbox')}`;
            worker.postMessage({ action: 'downloadAndActivate' });
            showPremiumToast('הופצת עדכון קבצים הופעלה. האפליקציה תתרענן בקרוב.', 'success');
          } else {
            showPremiumToast('לא נמצא Service Worker פעיל.', 'error');
          }
        }
      } catch (err) {
        console.error('Admin update error:', err);
        showPremiumToast('שגיאה: ' + err.message, 'error');
      }
      triggerUpdateBtn.disabled = false;
      triggerUpdateBtn.innerHTML = `${getCustomIcon('rocket')} הפץ עדכון גרסה`;
    });
  }

  // --- FORCE REFRESH ALL ASSETS BUTTON ---
  const forceRefreshBtn = document.getElementById('admin-force-refresh-assets-btn');
  if (forceRefreshBtn) {
    forceRefreshBtn.addEventListener('click', async () => {
      if (!('serviceWorker' in navigator)) {
        showPremiumToast('שירות Service Worker אינו זמין במכשיר זה.', 'error');
        return;
      }
      forceRefreshBtn.disabled = true;
      forceRefreshBtn.innerHTML = `רענון בתהליך... ${getCustomIcon('sync')}`;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const worker = reg ? (reg.active || reg.waiting || reg.installing) : navigator.serviceWorker.controller;
        if (worker) {
          worker.postMessage({ action: 'downloadAndActivate' });
          showPremiumToast('הוראה לרענון מיידי של הקבצים נשלחה בהצלחה!','success');
        } else {
          showPremiumToast('לא נמצא Service Worker פעיל.', 'error');
        }
      } catch (err) {
        console.error('Force refresh error:', err);
        showPremiumToast('שגיאה: ' + err.message, 'error');
      }
      setTimeout(() => {
        forceRefreshBtn.disabled = false;
        forceRefreshBtn.innerHTML = `${getCustomIcon('sync')} רענון קבצים מיידי`;
      }, 3000);
    });
  }

  // --- CACHE INSPECTOR REFRESH BUTTON ---
  const scanCacheBtn = document.getElementById('refresh-cache-inspector-btn');
  if (scanCacheBtn) {
    scanCacheBtn.addEventListener('click', () => {
      scanAppCacheFiles();
    });
  }

  // Export globally
  window.updateAdminUI = updateAdminUI;
  window.loadAdminDashboardData = loadAdminDashboardData;
  window.scanAppCacheFiles = scanAppCacheFiles;
}

// ==========================================================================
// Cache Inspector & Storage Manager (Admin Only)
// ==========================================================================
export async function scanAppCacheFiles() {
  const container = document.getElementById('admin-cached-files-list');
  const summaryEl = document.getElementById('admin-cache-stats-summary');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">סורק קבצים במטמון... ⏳</div>';

  if (!('caches' in window)) {
    container.innerHTML = '<div style="text-align:center; color: var(--color-danger); padding: 15px;">Cache API אינו נתמך בדפדפן זה.</div>';
    return;
  }

  try {
    const keys = await caches.keys();
    if (!keys.length) {
      container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">לא נמצאו קבצים שמורים במטמון במכשיר זה.</div>';
      if (summaryEl) summaryEl.innerHTML = '';
      return;
    }

    let totalBytes = 0;
    let filesList = [];

    for (const key of keys) {
      const cache = await caches.open(key);
      const requests = await cache.keys();
      for (const req of requests) {
        try {
          const res = await cache.match(req);
          if (res) {
            const blob = await res.blob();
            const size = blob.size;
            totalBytes += size;
            const urlPath = new URL(req.url).pathname;
            const cleanPath = urlPath.replace(/^\//, './');
            filesList.push({
              url: req.url,
              path: cleanPath,
              size: size,
              cacheName: key
            });
          }
        } catch (e) {
          console.warn("Could not read cached file:", req.url, e);
        }
      }
    }

    // Sort by path
    filesList.sort((a, b) => a.path.localeCompare(b.path));

    const totalKB = (totalBytes / 1024).toFixed(1);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div style="flex: 1; background: rgba(255,255,255,0.04); padding: 12px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.06); text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">סה״כ קבצים שמורים</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: var(--electric-blue-light); margin-top: 2px;">${filesList.length}</div>
        </div>
        <div style="flex: 1; background: rgba(255,255,255,0.04); padding: 12px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.06); text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">נפח אחסון במכשיר</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: #34c759; margin-top: 2px;">${totalBytes > 1024*1024 ? totalMB + ' MB' : totalKB + ' KB'}</div>
        </div>
      `;
    }

    const MEANINGS = {
      'index.html': 'שלד ומבנה האפליקציה הראשי (HTML)',
      'style.css': 'מערכת העיצוב, צבעים וסגנונות (CSS)',
      'app.js': 'לוגיקת ניווט ראשית וטעינת מודולים (JS)',
      'sw.js': 'מנהל Service Worker, מטמון והתראות',
      'firebase-config.js': 'הגדרות התחברות ל-Firebase',
      'manifest.json': 'הגדרות התקנת האפליקציה (PWA Manifest)',
      'icon-192.png': 'אייקון אפליקציה ראשי (192px)',
      'icon-512.png': 'אייקון אפליקציה ברזולוציה גבוהה (512px)',
      'src/state.js': 'ניהול מצב האפליקציה והנתונים הזמניים',
      'src/utils/storage.js': 'מנגנון שמירה מאובטח בזיכרון המקומי',
      'src/utils/helpers.js': 'פונקציות עזר, התראות ועיצוב תאריכים',
      'src/auth/auth.js': 'מערכת התחברות גוגל ואבטחת משתמשים',
      'src/workouts/workouts.js': 'ניהול אימונים, תרגילים, סטופר ו-GPS',
      'src/metrics/metrics.js': 'לוח מדדים, גרפים, ניתוח ביצועים ו-AI',
      'src/settings/settings.js': 'מערכת הגדרות, תצוגה וסנכרון ענן'
    };

    container.innerHTML = filesList.map(f => {
      const filename = f.path.split('/').pop() || f.path;
      let matchedMeaning = 'מסמך/קובץ שמור במטמון המכשיר';
      for (const [keyPath, desc] of Object.entries(MEANINGS)) {
        if (f.path.includes(keyPath)) {
          matchedMeaning = desc;
          break;
        }
      }
      const fileSizeFormatted = f.size > 1024 * 1024 
        ? (f.size / (1024 * 1024)).toFixed(2) + ' MB'
        : (f.size / 1024).toFixed(1) + ' KB';

      return `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; direction: rtl;">
          <div style="display: flex; flex-direction: column; gap: 3px; max-width: 68%;">
            <div style="font-weight: 700; font-size: 0.95rem; color: #ffffff; font-family: monospace;">${escapeHTML(filename)}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${matchedMeaning}</div>
            <div style="font-size: 0.72rem; color: rgba(255,255,255,0.35); font-family: monospace;">${escapeHTML(f.path)}</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
            <span style="font-weight: 800; font-size: 0.88rem; color: var(--electric-blue-light);">${fileSizeFormatted}</span>
            <button class="delete-single-cache-file-btn" data-url="${escapeHTML(f.url)}" data-cache="${escapeHTML(f.cacheName)}" style="background: rgba(255,149,0,0.15); border: 1px solid rgba(255,149,0,0.35); color: #ff9500; font-size: 0.72rem; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">רענן קובץ ${getCustomIcon('refresh')}</button>
          </div>
        </div>
      `;
    }).join('');

    // Bind delete/refetch single file handlers
    container.querySelectorAll('.delete-single-cache-file-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fileUrl = btn.dataset.url;
        const cacheName = btn.dataset.cache;
        btn.disabled = true;
        btn.textContent = 'מוריד... ⏳';
        try {
          // Offline-Safe Cache Refreshing: Fetch first before modifying existing cache
          const res = await fetch(new Request(fileUrl, { cache: 'reload' }));
          if (res.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(fileUrl, res);
            showPremiumToast('הקובץ רוענן מחדש מהשרת!','success');
          } else {
            showPremiumToast('רענון הקובץ נכשל: שגיאה מהשרת.', 'error');
          }
          await scanAppCacheFiles();
        } catch (err) {
          console.error("Single file refresh failed:", err);
          showPremiumToast('רענון הקובץ נכשל. בדוק חיבור לרשת.', 'error');
        }
      });
    });

  } catch (err) {
    console.error("Error scanning cache files:", err);
    container.innerHTML = '<div style="text-align:center; color: var(--color-danger); padding: 15px;">שגיאה בסריקת קבצי המטמון.</div>';
  }
}

// Update DOM elements relating to role and unread messages badge
export function updateAdminUI() {
  const adminGroup = document.getElementById('settings-admin-group');
  const unreadBadge = document.getElementById('unread-messages-badge');
  const unreadDot = document.getElementById('nav-settings-unread-dot');

  // Admin options visibility
  if (adminGroup) {
    if (state.currentUser && state.userRole === 'admin') {
      adminGroup.classList.remove('hide');
    } else {
      adminGroup.classList.add('hide');
    }
  }

  const unreadCount = state.userMessages ? state.userMessages.filter(m => !m.read).length : 0;

  // Unread messages badge count inside Settings main view
  if (unreadBadge) {
    if (unreadCount > 0) {
      unreadBadge.textContent = unreadCount;
      unreadBadge.classList.remove('hide');
    } else {
      unreadBadge.classList.add('hide');
    }
  }

  // Glowing dot on Settings tab in the bottom nav bar
  if (unreadDot) {
    if (unreadCount > 0) {
      unreadDot.classList.remove('hide');
    } else {
      unreadDot.classList.add('hide');
    }
  }
}

// Load admin dashboard statistics and items
async function loadAdminDashboardData() {
  const db = getDb();
  if (!db) return;

  try {
    showPremiumToast("טוען נתוני ניהול... ⏳", "info");

    // 1. Fetch Users List
    const usersSnapshot = await getDocs(collection(db, "users"));
    const usersList = [];
    let totalWorkouts = 0;
    
    usersSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const userObj = {
        uid: docSnap.id,
        email: data.email || 'משתמש ללא אימייל',
        displayName: data.displayName || 'משתמש Aura',
        role: data.role || 'user',
        workoutHistoryCount: data.workoutHistory ? data.workoutHistory.length : 0
      };
      usersList.push(userObj);
      totalWorkouts += userObj.workoutHistoryCount;
    });

    state.usersList = usersList.sort((a, b) => b.workoutHistoryCount - a.workoutHistoryCount);

    // 2. Fetch Feedbacks List
    const feedbacksSnapshot = await getDocs(collection(db, "feedbacks"));
    const feedbacksList = [];
    let pendingCount = 0;

    feedbacksSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const feedbackObj = {
        id: docSnap.id,
        uid: data.uid,
        email: data.email || '--',
        displayName: data.displayName || 'משתמש',
        category: data.category || 'הצעת שיפור',
        text: data.text || '',
        createdAt: data.createdAt || Date.now(),
        status: data.status || 'pending'
      };
      feedbacksList.push(feedbackObj);
      if (feedbackObj.status === 'pending') {
        pendingCount++;
      }
    });

    state.feedbacksList = feedbacksList.sort((a, b) => b.createdAt - a.createdAt);

    // 3. Render Stats
    setElText('admin-stat-users-count', state.usersList.length);
    setElText('admin-stat-workouts-count', totalWorkouts);
    setElText('admin-stat-pending-feedback-count', pendingCount);

    // 4. Render Lists
    renderAdminUsersList(state.usersList);
    renderAdminFeedbacksList(state.feedbacksList);
  } catch (err) {
    console.error("Failed to load admin data:", err);
    showPremiumToast("טעינת נתוני ניהול נכשלה. בדוק הרשאות Firestore.", "error");
  }
}

// Render user rows in admin tab
function renderAdminUsersList(list) {
  const container = document.getElementById('admin-users-list');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">לא נמצאו משתמשים.</div>';
    return;
  }

  container.innerHTML = list.map(user => {
    const isTargetAdmin = user.role === 'admin';
    const roleBadge = isTargetAdmin 
      ? '<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 0.72rem; padding: 2px 6px; border-radius: 6px; font-weight: bold; margin-right: 6px;">מנהל</span>'
      : '<span style="background: rgba(255, 255, 255, 0.08); color: var(--text-muted); font-size: 0.72rem; padding: 2px 6px; border-radius: 6px; margin-right: 6px;">משתמש</span>';
      
    return `
      <div class="ios-workout-log-card" style="padding: 14px; display: flex; flex-direction: column; gap: 10px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.05); background: rgba(255, 255, 255, 0.02);">
        <div style="display: flex; justify-content: space-between; align-items: start; direction: rtl;">
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #fff; font-size: 0.98rem; display: flex; align-items: center; gap: 6px;">
              ${escapeHTML(user.displayName)}
              ${roleBadge}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; font-family: var(--font-sans);">${escapeHTML(user.email)}</div>
          </div>
          <div style="text-align: left; font-family: var(--font-sans);">
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--electric-blue);">${user.workoutHistoryCount}</div>
            <div style="font-size: 0.68rem; color: var(--text-muted);">אימונים</div>
          </div>
        </div>
        
        <!-- Admin Actions grid -->
        <div style="display: flex; gap: 8px; direction: rtl; margin-top: 4px;">
          <button class="btn btn-secondary admin-action-btn" data-uid="${escapeHTML(user.uid)}" data-action="toggle-role" style="flex: 1; padding: 8px; font-size: 0.78rem; font-weight: bold; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);">
            ${isTargetAdmin ? `הורד למשתמש ${getCustomIcon('user')}` : `שדרג למנהל ${getCustomIcon('crown')}`}
          </button>
          <button class="btn btn-secondary admin-action-btn" data-uid="${escapeHTML(user.uid)}" data-action="send-msg" style="flex: 1; padding: 8px; font-size: 0.78rem; font-weight: bold; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);">
            הודעה אישית ${getCustomIcon('mail')}
          </button>
          <button class="btn btn-logout admin-action-btn" data-uid="${escapeHTML(user.uid)}" data-action="delete" style="flex: 0 0 auto; padding: 8px 12px; font-size: 0.78rem; font-weight: bold; border-radius: 10px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #f87171;">
            מחק ${getCustomIcon('trash')}
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Bind Actions
  container.querySelectorAll('.admin-action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const uid = btn.dataset.uid;
      const action = btn.dataset.action;
      const user = state.usersList.find(u => u.uid === uid);
      if (!user) return;

      if (action === 'toggle-role') {
        const nextRole = user.role === 'admin' ? 'user' : 'admin';
        const confirmMsg = nextRole === 'admin'
          ? `האם אתה בטוח שברצונך לשדרג את ${user.displayName} לתפקיד מנהל?`
          : `האם אתה בטוח שברצונך להוריד את ${user.displayName} לתפקיד משתמש רגיל?`;
        
        if (confirm(confirmMsg)) {
          btn.disabled = true;
          const ok = await updateUserRole(uid, nextRole);
          if (ok) {
            showPremiumToast("תפקיד המשתמש עודכן בהצלחה!", "success");
            await loadAdminDashboardData();
          } else {
            btn.disabled = false;
          }
        }
      } else if (action === 'send-msg') {
        const title = prompt(`הודעה אישית אל ${user.displayName}\nהכנס כותרת להודעה:`);
        if (title === null) return;
        const cleanTitle = title.trim();
        if (!cleanTitle) {
          showPremiumToast("חובה להזין כותרת", "error");
          return;
        }

        const content = prompt("הכנס את תוכן ההודעה:");
        if (content === null) return;
        const cleanContent = content.trim();
        if (!cleanContent) {
          showPremiumToast("חובה להזין תוכן", "error");
          return;
        }

        btn.disabled = true;
        const ok = await sendDirectMessage(uid, cleanTitle, cleanContent);
        btn.disabled = false;
        if (ok) {
          showPremiumToast(`ההודעה האישית נשלחה אל ${user.displayName}!`, "success");
          // Reload admin stats and data immediately
          await loadAdminDashboardData();
          // Sync own session if admin sent a message to themselves
          if (state.currentUser && uid === state.currentUser.uid) {
            const { syncUserSession } = await import("../utils/db.js");
            await syncUserSession(state.currentUser.uid);
            updateAdminUI();
            renderUserMessagesList();
          }
        }
      } else if (action === 'delete') {
        if (confirm(`אזהרה חמורה!\nהאם אתה בטוח שברצונך למחוק לצמיתות את המשתמש ${user.displayName} וכל נתוני Firestore שלו מהמערכת?\nפעולה זו אינה ניתנת לביטול!`)) {
          btn.disabled = true;
          const ok = await deleteUserAccount(uid);
          if (ok) {
            showPremiumToast("המשתמש נמחק בהצלחה מהמערכת", "success");
            await loadAdminDashboardData();
          } else {
            btn.disabled = false;
          }
        }
      }
    });
  });
}

// Filter users list on search input
function filterAdminUsersList(query) {
  if (!state.usersList) return;
  const filtered = state.usersList.filter(user => {
    return user.displayName.toLowerCase().includes(query) || 
           user.email.toLowerCase().includes(query);
  });
  renderAdminUsersList(filtered);
}

// Render user feedback cards
function renderAdminFeedbacksList(list) {
  const container = document.getElementById('admin-feedbacks-list');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">אין משובים זמינים.</div>';
    return;
  }

  container.innerHTML = list.map(item => {
    const isPending = item.status === 'pending';
    const statusBadge = isPending 
      ? '<span style="background: rgba(255, 149, 0, 0.15); color: #ff9500; font-size: 0.72rem; padding: 2px 6px; border-radius: 6px; font-weight: bold; margin-right: 6px;">ממתין</span>'
      : '<span style="background: rgba(52, 199, 89, 0.15); color: #34c759; font-size: 0.72rem; padding: 2px 6px; border-radius: 6px; font-weight: bold; margin-right: 6px;">טופל</span>';
      
    const dateStr = new Date(item.createdAt).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="ios-workout-log-card" style="padding: 14px; display: flex; flex-direction: column; gap: 10px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.05); background: rgba(255, 255, 255, 0.02);">
        <div style="display: flex; justify-content: space-between; align-items: start; direction: rtl;">
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #fff; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
              ${escapeHTML(item.displayName)}
              ${statusBadge}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 1px; font-family: var(--font-sans);">${escapeHTML(item.email)}</div>
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-sans); text-align: left;">
            ${dateStr}
          </div>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.03); padding: 10px; border-radius: 10px; font-size: 0.88rem; color: #e4e4e7; line-height: 1.4; direction: rtl; text-align: right; border: 1px solid rgba(255,255,255,0.02);">
          <div style="font-weight: bold; font-size: 0.75rem; color: var(--electric-blue); margin-bottom: 4px;">סוג: ${escapeHTML(item.category)}</div>
          ${escapeHTML(item.text)}
        </div>

        ${isPending ? `
          <div style="display: flex; gap: 8px; direction: rtl; margin-top: 2px;">
            <button class="btn btn-secondary admin-feedback-btn" data-id="${escapeHTML(item.id)}" data-action="resolve" style="flex: 1; padding: 7px; font-size: 0.75rem; font-weight: bold; border-radius: 9px; border: 1px solid rgba(255,255,255,0.08);">
              סמן כטופל ${getCustomIcon('check')}
            </button>
            <button class="btn btn-secondary admin-feedback-btn" data-id="${escapeHTML(item.id)}" data-action="reply" style="flex: 1; padding: 7px; font-size: 0.75rem; font-weight: bold; border-radius: 9px; border: 1px solid rgba(255,255,255,0.08);">
              שלח מענה ${getCustomIcon('mail')}
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Bind Feedback actions
  container.querySelectorAll('.admin-feedback-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const item = state.feedbacksList.find(f => f.id === id);
      if (!item) return;

      if (action === 'resolve') {
        btn.disabled = true;
        const ok = await markFeedbackResolved(id);
        if (ok) {
          showPremiumToast("המשוב סומן כטופל בהצלחה!", "success");
          await loadAdminDashboardData();
        } else {
          btn.disabled = false;
        }
      } else if (action === 'reply') {
        const replyText = prompt(`הודעת מענה אישי אל ${item.displayName}\nהכנס את תוכן ההודעה:`);
        if (replyText === null) return;
        const cleanReply = replyText.trim();
        if (!cleanReply) {
          showPremiumToast("חובה להזין תוכן", "error");
          return;
        }

        btn.disabled = true;
        const msgOk = await sendDirectMessage(item.uid, "מענה למשוב שלך", cleanReply);
        if (msgOk) {
          // Auto resolve the feedback too
          await markFeedbackResolved(id);
          showPremiumToast("המענה נשלח בהצלחה והמשוב סומן כטופל!", "success");
          await loadAdminDashboardData();
        } else {
          btn.disabled = false;
        }
      }
    });
  });
}

// Render regular user inbox list
function renderUserMessagesList() {
  const container = document.getElementById('user-messages-list');
  if (!container) return;

  const list = state.userMessages || [];
  if (list.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 40px; font-size: 0.95rem;">אין הודעות מערכת זמינות.</div>';
    return;
  }

  container.innerHTML = list.map(item => {
    const dateStr = new Date(item.date).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    const isNew = !item.read;

    return `
      <div class="ios-workout-log-card" style="padding: 16px; border-radius: 18px; border: 1px solid ${isNew ? 'rgba(0,122,255,0.25)' : 'rgba(255,255,255,0.05)'}; background: ${isNew ? 'rgba(0,122,255,0.03)' : 'rgba(255,255,255,0.01)'}; position: relative; direction: rtl; text-align: right;">
        ${isNew ? '<span style="position: absolute; top: 16px; left: 16px; width: 8px; height: 8px; border-radius: 50%; background: #007aff; box-shadow: 0 0 8px #007aff;"></span>' : ''}
        <div style="font-weight: 800; color: #fff; font-size: 1.05rem; margin-bottom: 4px; padding-left: 20px;">${escapeHTML(item.title)}</div>
        <div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-sans); margin-bottom: 10px;">${dateStr}</div>
        <div style="font-size: 0.88rem; color: #d4d4d8; line-height: 1.5; white-space: pre-wrap;">${escapeHTML(item.content)}</div>
      </div>
    `;
  }).join('');
}

// --- FIRESTORE WRITING AND DB INTERACTION ---

// Submit user feedback to database
async function submitUserFeedback(category, text) {
  const db = getDb();
  if (!db) return false;
  try {
    const data = {
      uid: state.currentUser ? state.currentUser.uid : 'anonymous',
      email: state.currentUser ? state.currentUser.email : 'anonymous@gmail.com',
      displayName: state.currentUser ? state.currentUser.displayName : 'משתמש Aura',
      category,
      text,
      createdAt: Date.now(),
      status: 'pending'
    };
    await addDoc(collection(db, "feedbacks"), data);
    console.log("Feedback submitted to Firestore successfully.");
    return true;
  } catch (err) {
    console.error("Failed to submit feedback:", err);
    showPremiumToast("שליחת המשוב נכשלה. אנא בדוק את החיבור לרשת.", "error");
    return false;
  }
}

// Broadcast message to ALL users in Firestore using Batched Writes (Phase 2 optimization)
async function sendGlobalAnnouncement(title, content) {
  const db = getDb();
  if (!db) return false;

  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    if (usersSnapshot.empty) return true;

    // Use Firestore writeBatch for scalable performance & network reliability
    let batch = writeBatch(db);
    let count = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userMessages = userData.messages || [];
      const newMessage = {
        id: String(Date.now() + Math.random()),
        title,
        content,
        date: Date.now(),
        read: false
      };
      
      const newMessages = [newMessage, ...userMessages];
      const userRef = doc(db, "users", userDoc.id);
      batch.set(userRef, { messages: newMessages }, { merge: true });
      count++;

      // Firestore batch limit is 500 operations
      if (count % 450 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }

    if (count % 450 !== 0) {
      await batch.commit();
    }

    console.log(`Global announcement broadcasted to ${count} users via batched writes.`);
    return true;
  } catch (err) {
    console.error("Failed to send global announcement:", err);
    showPremiumToast("שליחת ההודעה הגלובלית נכשלה.", "error");
    return false;
  }
}

// Send a direct message to a specific user using direct getDoc read (Phase 2 optimization)
async function sendDirectMessage(targetUid, title, content) {
  const db = getDb();
  if (!db) return false;

  try {
    const userRef = doc(db, "users", targetUid);
    // Direct document read instead of fetching the entire users collection
    const userSnap = await getDoc(userRef);
    
    let currentMessages = [];
    if (userSnap.exists()) {
      currentMessages = userSnap.data().messages || [];
    }

    const newMessage = {
      id: String(Date.now() + Math.random()),
      title,
      content,
      date: Date.now(),
      read: false
    };

    const newMessages = [newMessage, ...currentMessages];
    await setDoc(userRef, { messages: newMessages }, { merge: true });
    console.log(`Direct message sent to ${targetUid} via direct document read.`);
    return true;
  } catch (err) {
    console.error("Failed to send direct message:", err);
    showPremiumToast("שליחת ההודעה הישירה נכשלה.", "error");
    return false;
  }
}

// Change user role in Firestore
async function updateUserRole(targetUid, newRole) {
  const db = getDb();
  if (!db) return false;
  try {
    const userRef = doc(db, "users", targetUid);
    await setDoc(userRef, { role: newRole, updatedAt: Date.now() }, { merge: true });
    console.log(`User role for uid: ${targetUid} updated to: ${newRole} successfully.`);
    return true;
  } catch (err) {
    console.error("Failed to update user role:", err);
    showPremiumToast("שינוי תפקיד המשתמש נכשל.", "error");
    return false;
  }
}

// Delete user document from Firestore
async function deleteUserAccount(targetUid) {
  const db = getDb();
  if (!db) return false;
  try {
    const userRef = doc(db, "users", targetUid);
    await deleteDoc(userRef);
    console.log(`User document for uid: ${targetUid} deleted successfully from Firestore.`);
    return true;
  } catch (err) {
    console.error("Failed to delete user document:", err);
    showPremiumToast("מחיקת המשתמש נכשלה.", "error");
    return false;
  }
}

// Mark feedback as resolved
async function markFeedbackResolved(feedbackId) {
  const db = getDb();
  if (!db) return false;
  try {
    const docRef = doc(db, "feedbacks", feedbackId);
    await setDoc(docRef, { status: 'resolved' }, { merge: true });
    console.log(`Feedback doc id: ${feedbackId} resolved successfully.`);
    return true;
  } catch (err) {
    console.error("Failed to resolve feedback doc:", err);
    return false;
  }
}

// Mark all logged in user messages as read
async function markAllMessagesAsRead() {
  if (!state.currentUser) return;
  
  const uid = state.currentUser.uid;
  const list = state.userMessages || [];
  let changed = false;

  const updatedList = list.map(m => {
    if (!m.read) {
      m.read = true;
      changed = true;
    }
    return m;
  });

  if (changed) {
    state.userMessages = updatedList;
    SafeStorage.setItem(`aura-messages_${uid}`, JSON.stringify(updatedList));
    updateAdminUI(); // refresh badge count
    
    // Save to Firestore
    await saveFieldToCloud('messages', updatedList);
    
    // NOTE: no notification is fired here. The user is already looking at the inbox —
    // telling them they just read their own messages was pure noise.
  }
}
