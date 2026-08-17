import { state } from "../state.js";
import { SafeStorage } from "./storage.js";
import { showPremiumToast } from "./helpers.js";
import { getCustomIcon } from "./icons.js";

let deferredPrompt = null;

// Capture PWA installation prompt event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log("PWA beforeinstallprompt captured.");
});

// Helper: Detect OS and Browser
function getOSAndBrowser() {
  const userAgent = navigator.userAgent;
  let os = 'other';
  let osName = 'מכשיר לא ידוע';
  let browser = 'other';
  let browserName = 'דפדפן לא ידוע';
  
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    os = 'ios';
    osName = 'iOS (iPhone/iPad)';
  } else if (/Android/i.test(userAgent)) {
    os = 'android';
    osName = 'Android';
  } else if (/Windows/i.test(userAgent)) {
    os = 'windows';
    osName = 'Windows PC';
  } else if (/Macintosh/i.test(userAgent)) {
    os = 'mac';
    osName = 'Mac';
  }
  
  if (/Firefox|FxiOS/i.test(userAgent)) {
    browser = 'firefox';
    browserName = 'Firefox';
  } else if (/Chrome|CriOS/i.test(userAgent) && !/Edge|Edg|OPR|Opera/i.test(userAgent)) {
    browser = 'chrome';
    browserName = 'Chrome';
  } else if (/Safari/i.test(userAgent) && !/Chrome|CriOS|Firefox|FxiOS/i.test(userAgent)) {
    browser = 'safari';
    browserName = 'Safari';
  } else if (/Edge|Edg/i.test(userAgent)) {
    browser = 'edge';
    browserName = 'Microsoft Edge';
  }
  
  return { os, osName, browser, browserName };
}

// Helper: Custom step-by-step instructions for installing PWA
function getPWAInstructions(os, browser) {
  const steps = [];
  let showNativePrompt = false;
  
  if (os === 'ios') {
    if (browser === 'safari') {
      steps.push(
        'לחצו על כפתור <strong>השיתוף</strong> בסרגל התחתון של Safari (אייקון של ריבוע עם חץ כלפי מעלה).',
        'גללו מטה בתפריט שנפתח ובחרו באפשרות <strong>"הוסף למסך הבית"</strong> (Add to Home Screen).',
        'לחצו על <strong>"הוסף"</strong> (Add) בפינה הימנית העליונה של המסך כדי לאשר.'
      );
    } else {
      steps.push(
        'לחצו על כפתור <strong>השיתוף</strong> בשורת הכתובת או בתפריט האפליקציה.',
        'גללו מטה בתפריט ובחרו באפשרות <strong>"הוסף למסך הבית"</strong> (Add to Home Screen).',
        'לחצו על <strong>"הוסף"</strong> (Add) בפינה הימנית העליונה.'
      );
    }
  } else if (os === 'android') {
    if (browser === 'chrome') {
      if (deferredPrompt) {
        showNativePrompt = true;
      }
      steps.push(
        'לחצו על כפתור <strong>"התקן עכשיו"</strong> המופיע בתחתית המודל.',
        'אם ההתקנה לא מתחילה, לחצו על תפריט <strong>שלוש הנקודות (⋮)</strong> בפינה השמאלית/ימנית העליונה של Chrome.',
        'בחרו ב-<strong>"התקן את האפליקציה"</strong> או <strong>"הוסף למסך הבית"</strong> (Add to Home Screen).'
      );
    } else if (browser === 'firefox') {
      if (deferredPrompt) {
        showNativePrompt = true;
      }
      steps.push(
        'לחצו על תפריט <strong>שלוש הנקודות (⋮)</strong> בפינה הימנית התחתונה של Firefox.',
        'בחרו באפשרות <strong>"התקן"</strong> (Install) או <strong>"הוסף למסך הבית"</strong>.',
        'אשרו את ההתקנה בחלון שיפתח.'
      );
    } else {
      steps.push(
        'פתחו את תפריט הדפדפן (לרוב אייקון של שלוש נקודות או קווים).',
        'חפשו אפשרות בשם <strong>"התקן"</strong> (Install) או <strong>"הוסף למסך הבית"</strong> (Add to Home Screen).',
        'אשרו את הפעולה.'
      );
    }
  } else {
    if (deferredPrompt) {
      showNativePrompt = true;
    }
    steps.push(
      'לחצו על אייקון <strong>ההתקנה</strong> בשורת הכתובת של הדפדפן (מופיע לרוב כסימן + או כפתור התקנה ייעודי).',
      'לחצו על <strong>"התקן"</strong> (Install) בחלונית האישור שנפתחה.'
    );
  }
  
  return { steps, showNativePrompt };
}

// Create and inject PWA modal
export function createPWAModal() {
  if (document.getElementById('pwa-install-guide-modal')) return;
  
  const modal = document.createElement('div');
  modal.id = 'pwa-install-guide-modal';
  modal.className = 'workout-modal-overlay hide';
  modal.style.zIndex = '1800';
  
  const info = getOSAndBrowser();
  const instructions = getPWAInstructions(info.os, info.browser);
  
  modal.innerHTML = `
    <div class="workout-modal-card pwa-guide-modal-card" style="max-width: 400px; width: 92%; border-radius: 28px; padding: 1.8rem; border: 1px solid rgba(255, 255, 255, 0.1); display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(135deg, hsla(225, 20%, 9%, 0.95) 0%, hsla(225, 20%, 5%, 0.98) 100%); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7);">
      <div class="modal-header" style="padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; direction: rtl;">
        <button id="close-pwa-guide-btn" class="btn-cancel-link" style="background: none; border: none; font-size: 0.95rem; font-weight: 700; color: var(--text-muted); cursor: pointer;">סגור</button>
        <h3 class="modal-title" style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #ffffff; direction: rtl; font-family: var(--font-display);">${getCustomIcon('mobile')} מדריך התקנת AuraApp</h3>
        <span style="width: 40px;"></span>
      </div>
      <div class="modal-body" style="padding: 1.5rem 0 0.5rem 0; text-align: right; direction: rtl; overflow-y: auto; flex: 1;">
        <div style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.5;">
          התקנת האפליקציה במסך הבית מאפשרת להשתמש בה במסך מלא, לקבל ביצועים מהירים יותר ולעבוד ללא הפרעות.
        </div>
        
        <div class="detected-badge" style="background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.25); padding: 10px 14px; border-radius: 14px; margin-bottom: 1.5rem; font-size: 0.85rem; color: var(--text-main); display: flex; justify-content: space-between; align-items: center; direction: rtl;">
          <span>זיהינו במכשיר שלך:</span>
          <strong style="color: var(--accent-light);">${info.osName} (${info.browserName})</strong>
        </div>
        
        <div class="pwa-steps-list" style="display: flex; flex-direction: column; gap: 16px;">
          ${instructions.steps.map((step, idx) => `
            <div class="pwa-step-item" style="display: flex; gap: 12px; align-items: flex-start; direction: rtl;">
              <div class="pwa-step-number" style="background: var(--accent); color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem; flex-shrink: 0; margin-top: 2px; box-shadow: 0 0 10px var(--accent-glow);">
                ${idx + 1}
              </div>
              <div class="pwa-step-text" style="font-size: 0.95rem; line-height: 1.45; color: var(--text-main);">
                ${step}
              </div>
            </div>
          `).join('')}
        </div>
        
        ${instructions.showNativePrompt ? `
          <button id="pwa-native-install-btn" class="btn btn-primary" style="width: 100%; margin-top: 1.5rem; padding: 14px; font-weight: bold; border-radius: 14px; background: linear-gradient(135deg, var(--electric-blue) 0%, var(--electric-blue-light) 100%); box-shadow: 0 4px 15px var(--electric-blue-glow);">
            ${getCustomIcon('mobile')} התקן עכשיו ישירות
          </button>
        ` : ''}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close buttons listeners
  document.getElementById('close-pwa-guide-btn')?.addEventListener('click', () => {
    modal.classList.add('hide');
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hide');
    }
  });
  
  // Native PWA prompt button behavior
  if (instructions.showNativePrompt) {
    const nativeBtn = document.getElementById('pwa-native-install-btn');
    nativeBtn?.addEventListener('click', async () => {
      if (deferredPrompt) {
        modal.classList.add('hide');
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to PWA install prompt: ${outcome}`);
        deferredPrompt = null;
      } else {
        showPremiumToast("ההתקנה האוטומטית אינה זמינה כעת בדפדפן זה.", "info");
      }
    });
  }
}

// Show PWA recommendation modal
export function showPWARecommendationModal() {
  createPWAModal();
  const modal = document.getElementById('pwa-install-guide-modal');
  if (modal) {
    modal.classList.remove('hide');
  }
}

// Initialize the Onboarding module
export function initOnboarding() {
  window.showPWARecommendationModal = showPWARecommendationModal;
  window.initOnboarding = initOnboarding;
}

// Automatically expose on window when this module is evaluated
if (typeof window !== 'undefined') {
  window.showPWARecommendationModal = showPWARecommendationModal;
  window.initOnboarding = initOnboarding;
}
