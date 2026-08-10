import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { state } from "../state.js";
import { SafeStorage } from "../utils/storage.js";
import { triggerLocalNotification, getInitialsAvatar, showPremiumToast } from "../utils/helpers.js";
import { syncUserSession } from "../utils/db.js";
import { updateAdminUI } from "../settings/admin.js";

// DOM Elements
let authScreen;
let appScreen;
let loginBtn;
let logoutBtn;
let userDisplayName;
let navUserPhoto;
let settingsUserPhoto;
let settingsUserPhotoMain;
let floatingUserPhoto;

// Safe helper to update text contents safely
const setElText = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

// Reset DOM fields safely on Logout to avoid credential leakage
export function clearUserSession() {
  state.currentUser = null;
  state.userRole = 'user';
  SafeStorage._fallbackMem = {};
  SafeStorage._failedKeys = {};

  // Close drawer if it was defined, otherwise ignore safely
  const closeDrawerBtn = document.getElementById('drawer-close-btn');
  if (closeDrawerBtn) closeDrawerBtn.click();

  setElText('user-display-name', 'User');
  setElText('settings-user-name-field', 'User');
  setElText('settings-user-email-field', 'user@gmail.com');
  setElText('settings-user-role-field', 'משתמש רגיל');
  setElText('settings-user-name-main', 'משתמש');
  
  const mainView = document.getElementById('settings-main-view');
  const accountView = document.getElementById('settings-account-view');
  if (mainView) mainView.classList.remove('hide');
  if (accountView) accountView.classList.add('hide');

  const initialsFallback = getInitialsAvatar('User');
  if (navUserPhoto) navUserPhoto.src = initialsFallback;
  if (settingsUserPhoto) settingsUserPhoto.src = initialsFallback;
  if (settingsUserPhotoMain) settingsUserPhotoMain.src = initialsFallback;
  if (floatingUserPhoto) floatingUserPhoto.src = initialsFallback;
  
  // Reset tabs to default Settings tab upon logout
  if (window.resetTabs) window.resetTabs();

  // Call clean sessions globally or dynamically
  if (window.clearWorkoutSession) window.clearWorkoutSession();

  // Reset admin layouts and badges
  updateAdminUI();

  // Reset sync UI status on logout
  if (window.updateSyncUI) window.updateSyncUI();
}

// Manage App Screen Transitions with premium animations
export function switchScreen(signedIn) {
  if (signedIn) {
    if (logoutBtn) logoutBtn.classList.remove('hide');
    document.body.classList.add('authenticated');
    if (authScreen) {
      authScreen.classList.remove('active');
      authScreen.style.display = 'none';
    }
    if (appScreen) {
      appScreen.style.display = 'flex';
      requestAnimationFrame(() => {
        appScreen.classList.add('active');
      });
    }
  } else {
    if (logoutBtn) logoutBtn.classList.add('hide');
    document.body.classList.remove('authenticated');
    if (appScreen) {
      appScreen.classList.remove('active');
      appScreen.style.display = 'none';
    }
    if (authScreen) {
      authScreen.style.display = 'flex';
      requestAnimationFrame(() => {
        authScreen.classList.add('active');
      });
    }
  }
}

// Update the user details everywhere in DOM
export function updateAuthUI() {
  if (!state.currentUser) return;

  const name = state.currentUser.displayName || 'Unknown User';
  const email = state.currentUser.email || '--';
  
  let roleText = 'בטעינה... ⏳';
  if (state.userRole === 'admin') {
    roleText = 'מנהל';
  } else if (state.userRole === 'user') {
    roleText = 'משתמש רגיל';
  }

  // Header Display Name
  setElText('user-display-name', name ? name.split(' ')[0] : 'User');
  setElText('settings-user-name-field', name);
  setElText('settings-user-email-field', email);
  setElText('settings-user-role-field', roleText);
  setElText('settings-user-name-main', name);

  // Photo Binding
  const initialsFallback = getInitialsAvatar(name);
  const photoURL = state.currentUser.photoURL || initialsFallback;

  if (navUserPhoto) {
    navUserPhoto.src = photoURL;
    navUserPhoto.onerror = () => { navUserPhoto.src = initialsFallback; };
  }
  if (settingsUserPhoto) {
    settingsUserPhoto.src = photoURL;
    settingsUserPhoto.onerror = () => { settingsUserPhoto.src = initialsFallback; };
  }
  if (settingsUserPhotoMain) {
    settingsUserPhotoMain.src = photoURL;
    settingsUserPhotoMain.onerror = () => { settingsUserPhotoMain.src = initialsFallback; };
  }
  if (floatingUserPhoto) {
    floatingUserPhoto.src = photoURL;
    floatingUserPhoto.onerror = () => { floatingUserPhoto.src = initialsFallback; };
  }

  // Update admin dashboard triggers and badges
  updateAdminUI();
}

// Translate auth error codes into friendly Hebrew
function handleAuthError(error, btn, originalText) {
  btn.disabled = false;
  const btnTextEl = btn.querySelector('.google-btn-text');
  if (btnTextEl) btnTextEl.textContent = originalText;
  console.error("Auth Error details:", error.code, error.message);

  let userFriendlyMessage = "שגיאת התחברות. נא לנסות שוב.";
  if (error.code === 'auth/web-storage-unsupported') {
    userFriendlyMessage = "הדפדפן שלך חוסם עוגיות צד שלישי (זה קורה לרוב בגלישה בסתר או בתוך אפליקציות כמו WhatsApp/Telegram). אנא העתק את הקישור ופתח אותו בדפדפן הרגיל של המכשיר (Chrome באנדרואיד או Safari באייפון) כדי שתוכל להתחבר.";
  } else if (error.code === 'auth/popup-blocked') {
    userFriendlyMessage = "חלונות קופצים חסומים בדפדפן שלך. אנא פתח את האפליקציה בדפדפן Chrome/Safari הרגיל.";
  } else if (error.code === 'auth/network-request-failed') {
    userFriendlyMessage = "בעיית רשת. נא לוודא שיש חיבור אינטרנט תקין ולנסות שוב.";
  } else {
    userFriendlyMessage = `שגיאת התחברות (${error.code || 'unknown'}): אנא ודא שהקישור פתוח בדפדפן Chrome/Safari הרגיל, ולא דרך חלון פנימי של WhatsApp/Telegram.`;
  }
  showPremiumToast(userFriendlyMessage, "error");
}

// Proactive Environment Warnings (WhatsApp/Telegram/Private Tabs/Android WebViews/Local Files)
export function detectEnvironmentAndWarn() {
  const storageOk = SafeStorage.isSupported();
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Android/iOS internal App browser identification
  const isKnownInApp = /FBAN|FBAV|Instagram|Twitter|FBIOS|Messenger|WhatsApp|Telegram|Line|WeChat/i.test(userAgent);
  const isAndroidWebView = /Android/i.test(userAgent) && /wv/i.test(userAgent);
  const isInApp = isKnownInApp || isAndroidWebView;
  const isLocalFile = window.location.protocol === 'file:';

  const authCard = document.querySelector('.auth-card');
  if (authCard) {
    let warningHtml = '';
    
    if (isLocalFile) {
      warningHtml = `
        <div style="background: rgba(239, 68, 68, 0.12); border: 1px dashed rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 14px; margin-bottom: 20px; direction: rtl; text-align: right; font-size: 0.88rem; color: #f87171; display: flex; gap: 10px; align-items: start; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.08);">
          <span style="font-size: 1.25rem;">⚠️</span>
          <div>
            <strong>הרצה מקומית לא מאובטחת!</strong><br>
            הורדת קבצי הקוד ישירות למכשיר חוסמת את החיבור המאובטח של גוגל.<br>
            <strong style="color: #fff;">איך להתחבר?</strong> עליך להיכנס לאפליקציה דרך הקישור הרשמי והמאובטח שלה: <br>
            <a href="https://power-4ab3e.web.app" target="_blank" style="color: #60a5fa; text-decoration: underline; font-weight: bold;">https://power-4ab3e.web.app</a><br>
            ומשם תוכל להתקין אותה למסך הבית בקלות!
          </div>
        </div>
      `;
    } else if (isInApp) {
      warningHtml = `
        <div style="background: rgba(239, 68, 68, 0.12); border: 1px dashed rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 14px; margin-bottom: 20px; direction: rtl; text-align: right; font-size: 0.88rem; color: #f87171; display: flex; gap: 10px; align-items: start; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.08);">
          <span style="font-size: 1.25rem;">⚠️</span>
          <div>
            <strong>דפדפן לא נתמך / חסום על ידי Google!</strong><br>
            פתחת את האפליקציה מתוך קישור פנימי. גוגל חוסמת התחברות מאובטחת בסביבה זו.<br>
            <strong style="color: #fff;">מה לעשות?</strong> לחץ על שלוש הנקודות בפינה העליונה ובחר <strong>"פתח בדפדפן"</strong> (Chrome) כדי להתחבר בהצלחה ולהתקין את האפליקציה למסך הבית.
          </div>
        </div>
      `;
    } else if (!storageOk) {
      warningHtml = `
        <div style="background: rgba(245, 158, 11, 0.1); border: 1px dashed rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 12px; margin-bottom: 20px; direction: rtl; text-align: right; font-size: 0.85rem; color: #d97706; display: flex; gap: 8px; align-items: start;">
          <span style="font-size: 1.1rem;">🔒</span>
          <div>
            <strong>אחסון חסום / מצב גלישה בסתר פעיל!</strong><br>
            הדפדפן שלך חוסם עוגיות או גישה לאחסון מקומי. התחברות Google לא תישמר. מומלץ להשתמש בדפדפן רגיל שאינו במצב גלישה בסתר.
          </div>
        </div>
      `;
    }

    if (warningHtml && authCard) {
      try {
        const warningWrapper = document.createElement('div');
        warningWrapper.innerHTML = warningHtml;
        if (warningWrapper.firstElementChild) {
          authCard.prepend(warningWrapper.firstElementChild);
        }
      } catch (e) {
        console.warn("Could not insert warningHtml into authCard:", e);
      }
    }
  }
}

// Splash screen stage progress helper
export function updateSplashProgress(percent, stageText) {
  const fill = document.getElementById('splash-progress-fill');
  const status = document.getElementById('splash-status-text');
  if (fill) fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  if (status && stageText) status.textContent = stageText;
}

// Splash screen dismiss helper with smooth transition
export function dismissSplashScreen(delay = 100) {
  const splash = document.getElementById('splash-screen');
  if (!splash || splash.classList.contains('fade-out')) return;

  updateSplashProgress(100, 'מוכן! 🚀');
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 500);
  }, delay);
}

// Splash screen error fallback helper with interactive retry button
export function showSplashError(message, retryCallback) {
  const errorContainer = document.getElementById('splash-error-container');
  const errorMsg = document.getElementById('splash-error-message');
  const retryBtn = document.getElementById('splash-retry-btn');
  const progressContainer = document.querySelector('.splash-progress-container');

  if (progressContainer) progressContainer.style.display = 'none';
  if (errorMsg) errorMsg.textContent = message || 'אירעה שגיאה בטעינת האפליקציה';
  if (errorContainer) errorContainer.classList.remove('hide');

  if (retryBtn) {
    retryBtn.onclick = (e) => {
      e.stopPropagation();
      if (errorContainer) errorContainer.classList.add('hide');
      if (progressContainer) progressContainer.style.display = 'flex';
      updateSplashProgress(25, 'מנסה להתחבר מחדש...');
      if (retryCallback) {
        retryCallback();
      } else {
        window.location.reload();
      }
    };
  }
}

// Initialize Auth
export async function initAuth() {
  authScreen = document.getElementById('auth-screen');
  appScreen = document.getElementById('app-screen');
  loginBtn = document.getElementById('google-login-btn');
  logoutBtn = document.getElementById('app-logout-btn');
  userDisplayName = document.getElementById('user-display-name');
  navUserPhoto = document.getElementById('nav-user-photo');
  settingsUserPhoto = document.getElementById('settings-user-photo');
  settingsUserPhotoMain = document.getElementById('settings-user-photo-main');
  floatingUserPhoto = document.getElementById('floating-user-photo');

  updateSplashProgress(20, 'מאתחל את המערכת...');

  // Optimistic 0ms Instant Startup using cached user session
  const cachedUserStr = SafeStorage.getItem('aura-cached-user-session');
  if (cachedUserStr) {
    try {
      state.currentUser = JSON.parse(cachedUserStr);
      updateAuthUI();
      if (window.initWorkouts) window.initWorkouts();
      switchScreen(true);
      updateSplashProgress(85, 'טוען נתונים מקומיים...');
      // Dismiss splash screen immediately for instant access!
      dismissSplashScreen(80);
    } catch(e) {
      console.warn("Failed to parse cached user session:", e);
    }
  } else {
    updateSplashProgress(45, 'מאמת פרטי משתמש...');
  }

  // Set compatibility mappings for dormant code
  window.clearUserSession = clearUserSession;

  // Initialize Firebase dynamically
  if (window.firebaseConfig && window.firebaseConfig.apiKey && window.firebaseConfig.apiKey !== "YOUR_API_KEY") {
    try {
      state.app = initializeApp(window.firebaseConfig);
      state.auth = getAuth(state.app);
      await setPersistence(state.auth, browserLocalPersistence);
      state.googleProvider = new GoogleAuthProvider();
      state.googleProvider.setCustomParameters({ prompt: 'select_account' });
      state.firebaseEnabled = true;
      console.log("Firebase Auth initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize Firebase Auth module:", error);
      showSplashError("נכשלה התחברות לשירותי Firebase. אנא בדוק את החיבור לרשת ונסה שוב.", () => initAuth());
      return;
    }
  } else {
    console.error("Firebase configuration missing or invalid! Auth flows disabled.");
  }

  // Detect and Warn on environment
  detectEnvironmentAndWarn();

  // Binds event listeners
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      if (!state.firebaseEnabled) {
        showPremiumToast("שירותי ההתחברות אינם זמינים כעת עקב בעיית תצורה ב-Firebase.", "error");
        return;
      }

      loginBtn.disabled = true;
      const btnTextEl = loginBtn.querySelector('.google-btn-text');
      const originalText = btnTextEl ? btnTextEl.textContent : 'Sign in with Google';

      if (btnTextEl) btnTextEl.textContent = 'Connecting...';

      try {
        await signInWithPopup(state.auth, state.googleProvider);
        console.log("Logged in successfully via popup!");
        
        // Request notification permission ONLY after successful login.
        if ('Notification' in window && typeof Notification !== 'undefined' && Notification.permission === 'default') {
          try {
            await Notification.requestPermission();
          } catch (err) {
            console.warn("Could not request notification permission on login success:", err);
          }
        }
        
        loginBtn.disabled = false;
        if (btnTextEl) btnTextEl.textContent = originalText;
      } catch (popupError) {
        console.warn("Popup authentication failed/blocked. Code:", popupError.code, popupError.message);
        
        loginBtn.disabled = false;
        if (btnTextEl) btnTextEl.textContent = originalText;

        if (popupError.code === 'auth/account-exists-with-different-credential') {
          showPremiumToast("קיים כבר חשבון רשום עם כתובת אימייל זו במערכת. אנא פנה לתמיכה לצורך מיזוג חשבונות.", "error");
          return;
        }

        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
          showPremiumToast('ההתחברות נחסמה או בוטלה. <a href="#" onclick="document.getElementById(\'google-login-btn\').click(); return false;" style="text-decoration: underline; color: #60a5fa;">נסה להתחבר שנית 🔄</a>', "error", true);
        } else {
          showPremiumToast(`שגיאת התחברות: ${popupError.message || 'נא לנסות שנית'}`, "error");
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (!state.firebaseEnabled) {
        showPremiumToast("התנתקות אינה זמינה במצב לא מקוון/דמו.", "error");
        return;
      }

      try {
        await signOut(state.auth);
        console.log("Session signed out successfully.");
      } catch (error) {
        console.error("Sign-out process encountered an error:", error);
      }
    });
  }

  // Handle Firebase auth checking state changes
  let initialAuthCheckDone = false;
  if (state.firebaseEnabled) {
    onAuthStateChanged(state.auth, async (user) => {
      state.firebaseAuthResolved = true;
      const isLoginTransition = initialAuthCheckDone && user && !state.currentUser;
      const isLogoutTransition = initialAuthCheckDone && !user && state.currentUser;

      try {
        if (user) {
          console.log("User signed in successfully:", user.displayName);
          state.currentUser = user;
          
          SafeStorage.setItem('aura-cached-user-session', JSON.stringify({
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL
          }));

          updateAuthUI();
          switchScreen(true);
          dismissSplashScreen(50);

          // Non-blocking Background Sync (Stale-While-Revalidate pattern)
          syncUserSession(user.uid).then(() => {
            updateAuthUI();
            if (window.initWorkouts) window.initWorkouts();
            if (window.renderWorkoutHistory) window.renderWorkoutHistory();
            if (window.renderAnalytics) window.renderAnalytics();
            if (window.renderExercisesManager) window.renderExercisesManager();
            if (window.renderWorkoutsLog) window.renderWorkoutsLog();
            if (window.renderExercisePickerList) window.renderExercisePickerList();
            if (window.renderFutureWorkouts) window.renderFutureWorkouts();
            if (window.updateUnreadMessagesCount) window.updateUnreadMessagesCount();
            if (window.renderUserMessages) window.renderUserMessages();
            if (window.checkAndRestoreActiveWorkout) window.checkAndRestoreActiveWorkout();
            if (window.updateSyncUI) window.updateSyncUI();
          }).catch(syncErr => {
            console.warn("User session background sync encountered an error:", syncErr);
            if (state.userRole === 'loading') {
              const email = state.currentUser ? state.currentUser.email : "";
              state.userRole = (email && email.toLowerCase() === 'wbddwd55@gmail.com') ? 'admin' : 'user';
              updateAuthUI();
            }
          });
          
          // Dynamic initializers
          if (window.initWorkouts) window.initWorkouts();
          if (window.initOnboarding) window.initOnboarding();

          const hasBeenWelcomed = sessionStorage.getItem('aura_session_welcomed');
          if (isLoginTransition && !hasBeenWelcomed && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            triggerLocalNotification(
              "התחברת בהצלחה! 👋",
              `ברוך הבא ל-Aura, ${user.displayName || 'משתמש'}!`
            );
            sessionStorage.setItem('aura_session_welcomed', 'true');
          } else {
            sessionStorage.setItem('aura_session_welcomed', 'true');
          }
        } else {
          console.log("No authenticated user active.");
          const prevUser = state.currentUser;
          
          sessionStorage.removeItem('aura_session_welcomed');
          
          clearUserSession();
          switchScreen(false);
          dismissSplashScreen(50);

          if (isLogoutTransition && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            triggerLocalNotification(
              "התנתקת מהחשבון 🔒",
              `להתראות ${prevUser && prevUser.displayName ? prevUser.displayName.split(' ')[0] : ''}, נתראה באימון הבא!`
            );
          }
        }
      } catch (err) {
        console.error("Error during auth state change processing:", err);
        switchScreen(user ? true : false);
        dismissSplashScreen(50);
      } finally {
        initialAuthCheckDone = true;
      }
    });

    // Resolve redirect result
    getRedirectResult(state.auth)
      .then((result) => {
        if (result && result.user) {
          console.log("Redirect sign-in resolved successfully for:", result.user.displayName);
          sessionStorage.setItem('aura_session_welcomed', 'true');
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            triggerLocalNotification(
              "התחברת בהצלחה! 👋",
              `ברוך הבא ל-Aura, ${result.user.displayName || 'משתמש'}!`
            );
          }
        }
      })
      .catch((error) => {
        console.error("Error resolving redirect result:", error.code, error.message);
        if (error.code === 'auth/account-exists-with-different-credential') {
          showPremiumToast("קיים כבר חשבון רשום עם כתובת אימייל זו במערכת. אנא פנה לתמיכה לצורך מיזוג חשבונות.", "error");
          return;
        }
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
          console.log("Sign-in process was cancelled by the user.");
        } else if (error.code === 'auth/web-storage-unsupported') {
          showPremiumToast("שים לב: הדפדפן הנוכחי שלך חוסם עוגיות או פועל במצב גלישה בסתר. אנא פתח את האפליקציה בדפדפן הרגיל כדי להתחבר בהצלחה.", "error");
        } else {
          showPremiumToast(`שגיאת התחברות: ${error.message || 'נא לפתוח בדפדפן Chrome/Safari הרגיל'}`, "error");
        }
      });

    // Fail-safe: Handle startup errors or network timeouts cleanly
    setTimeout(() => {
      if (!state.firebaseAuthResolved) {
        state.firebaseAuthResolved = true;
        console.warn("Firebase Auth resolution timed out.");
        if (!state.currentUser) {
          showSplashError("החיבור לשרתי המערכת התעכב. בדוק את חיבור האינטרנט ונסה שוב.", () => window.location.reload());
        } else {
          dismissSplashScreen(0);
        }
      }
    }, 12000);
  } else {
    console.log("Firebase is disabled. Auth features are unavailable.");
    switchScreen(false);
    dismissSplashScreen(300);
  }
}
