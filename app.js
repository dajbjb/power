// =========================================================================================
// 🛡️ AuraApp - Clean Modular Entry Point (ES6 Modules)
// =========================================================================================
import { state } from "./src/state.js";
import { SafeStorage } from "./src/utils/storage.js";
import { triggerLocalNotification, showPremiumToast } from "./src/utils/helpers.js";
import { initAuth } from "./src/auth/auth.js";
import { initWorkoutsModule } from "./src/workouts/workouts.js";
import { initAnalyticsModule, initAnalyticsTab } from "./src/metrics/metrics.js";
import { initSettingsModule, initPremiumSettings, showUpdateStateInSettings } from "./src/settings/settings.js";
import { initOnboarding } from "./src/utils/onboarding.js";
import { initAdminModule } from "./src/settings/admin.js";

// Helper to run functions on DOM load
function onDOMReady(fn) {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

// ==========================================================================
// PWA On-Demand Update Engine & Version Isolation Guard (Preserved Rules)
// ==========================================================================
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.protocol === 'file:';

if ('serviceWorker' in navigator) {
  if (isLocalhost && SafeStorage.getItem('enableLocalSW') !== 'true') {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister();
        console.log("Developer Mode: Unregistered active service worker to prevent cache lock.");
      }
    });
  } else {
    const loadAppVersion = (reg) => {
      const activeWorker = navigator.serviceWorker.controller || reg.active;
      if (!activeWorker) return;
      
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data && event.data.version) {
          const badge = document.getElementById('app-version-display');
          if (badge) {
            badge.textContent = `v${event.data.version}`;
          }
          const settingsVer = document.getElementById('settings-system-version');
          if (settingsVer) {
            settingsVer.textContent = `v${event.data.version}`;
          }
        }
      };
      activeWorker.postMessage({ action: 'getVersion' }, [messageChannel.port2]);
    };

    window.addEventListener('load', () => {
      const justUpdated = SafeStorage.getItem('pwa_just_updated');
      if (justUpdated) {
        SafeStorage.removeItem('pwa_just_updated');
        setTimeout(() => {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            triggerLocalNotification(
              "העדכון הותקן בהצלחה! ✨",
              "האפליקציה עודכנה לגרסה האחרונה. תהנה מהשיפורים והעיצוב החדש!",
              true
            );
          }
        }, 1500);
      }

      navigator.serviceWorker.register('./sw.js')
        .then((registration) => {
          console.log('PWA Service Worker registered successfully! Scope:', registration.scope);
          
          loadAppVersion(registration);
          
          registration.update();
          
          setInterval(() => {
            registration.update();
          }, 5 * 60 * 1000);

          if (registration.waiting) {
            showUpdateToast(registration.waiting);
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showUpdateToast(newWorker);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('Service Worker registration encountered an error:', error);
        });
    });

    let refreshing = false;
    let hasExistingController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      if (!hasExistingController) {
        // Initial claim on first SW registration - ignore to prevent infinite reload loop
        hasExistingController = true;
        return;
      }
      refreshing = true;
      console.log("Service Worker controller changed. Reloading page for new version...");
      SafeStorage.setItem('pwa_just_updated', 'true');
      window.location.reload();
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.action === 'updateFailed') {
        const refreshBtn = document.getElementById('pwa-refresh-btn');
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.style.opacity = '1';
          refreshBtn.style.cursor = 'pointer';
          refreshBtn.textContent = 'רענן כעת';
        }
        showPremiumToast('הורדת העדכון נכשלה. אנא ודא שיש לך חיבור רשת תקין ונסה שוב.', 'error');
      }
    });
  }
}

function showUpdateToast(waitingWorker) {
  const toast = document.getElementById('pwa-update-toast');
  let refreshBtn = document.getElementById('pwa-refresh-btn');
  
  if (toast && refreshBtn) {
    // Query the waiting worker for version and update description
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data) {
        const textEl = toast.querySelector('.toast-text');
        if (textEl) {
          const versionStr = event.data.version ? `גרסה ${event.data.version}` : 'גרסה חדשה';
          const descriptionStr = event.data.description || 'שיפורי ביצועים ועיצוב כלליים';
          textEl.innerHTML = `<strong>${versionStr} זמינה!</strong><br><span style="font-size: 0.78rem; font-weight: 500; color: #475569; display: block; margin-top: 2px;">${descriptionStr}</span>`;
        }
      }
    };
    waitingWorker.postMessage({ action: 'getVersion' }, [messageChannel.port2]);

    toast.classList.add('show');
    // Replace the node first: showUpdateToast can fire more than once per session, and
    // stacking listeners made a single tap post the download message several times.
    const freshBtn = refreshBtn.cloneNode(true);
    refreshBtn.parentNode.replaceChild(freshBtn, refreshBtn);
    refreshBtn = freshBtn;
    refreshBtn.addEventListener('click', () => {
      console.log("User requested update activation. Initiating on-demand asset download...");
      refreshBtn.disabled = true;
      refreshBtn.style.opacity = '0.7';
      refreshBtn.style.cursor = 'not-allowed';
      refreshBtn.textContent = 'מוריד עדכונים... ⏳';
      waitingWorker.postMessage({ action: 'downloadAndActivate' });
    });
  }

  showUpdateStateInSettings(waitingWorker);
}


// ==========================================================================
// AuraApp Unified Navigation Controller Engine
// ==========================================================================

export function switchTab(targetTab) {
  if (!targetTab) return;

  if (targetTab === 'analytics') {
    // When entering analytics sub-view, preserve the active main tab (workouts or settings)
    if (state.lastActiveMainTab && state.lastActiveMainTab !== 'analytics') {
      state.previousTab = state.lastActiveMainTab;
    } else if (!state.previousTab) {
      state.previousTab = 'workouts';
    }
  } else {
    // Store active main tab
    state.previousTab = state.lastActiveMainTab || 'settings';
    state.lastActiveMainTab = targetTab;
  }

  const mainNav = document.getElementById('app-bottom-nav') || document.querySelector('.ios-bottom-nav');
  const subNav = document.getElementById('metrics-sub-nav');
  const mainTabs = mainNav ? mainNav.querySelectorAll('.nav-tab[data-tab]') : [];
  const tabPanes = document.querySelectorAll('.tab-content-container .tab-pane');

  // Update active status on tab buttons
  mainTabs.forEach(tab => {
    if (tab.dataset.tab === targetTab) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Activate target tab pane
  window.scrollTo(0, 0);
  tabPanes.forEach(pane => {
    const isTargetPane = pane.id === `tab-${targetTab}`;
    pane.classList.toggle('active', isTargetPane);

    if (isTargetPane) {
      pane.style.display = 'flex';
      pane.style.opacity = '1';
      pane.style.visibility = 'visible';
      pane.style.pointerEvents = 'auto';
      pane.style.zIndex = '10';
      pane.scrollTop = 0;

      // Reset scroll wrappers inside pane
      const innerScrolls = pane.querySelectorAll('.ios-settings-scroll-container, .ios-analytics-scroll-container, .exercises-list-container, .workout-history-list');
      innerScrolls.forEach(c => c.scrollTop = 0);
    } else {
      pane.style.display = 'none';
      pane.style.opacity = '0';
      pane.style.visibility = 'hidden';
      pane.style.pointerEvents = 'none';
      pane.style.zIndex = '-9999';
    }
  });

  // Switch between main navigation and analytics sub-navigation bar
  if (targetTab === 'analytics') {
    if (mainNav) mainNav.classList.add('nav-hidden');
    if (subNav) {
      subNav.classList.remove('nav-hidden');
      subNav.classList.add('sub-nav-active');
    }
    if (window.renderWorkoutsLog) window.renderWorkoutsLog();
  } else {
    if (subNav) {
      subNav.classList.add('nav-hidden');
      subNav.classList.remove('sub-nav-active');
    }
    if (mainNav) mainNav.classList.remove('nav-hidden');
  }

  console.log(`Navigated to tab: ${targetTab}, previousTab: ${state.previousTab}`);
}

export function goBackNav() {
  const destination = (state.previousTab && state.previousTab !== 'analytics') ? state.previousTab : 'workouts';
  console.log(`goBackNav returning to destination: ${destination}`);
  switchTab(destination);
}

export function applyNavStyle(style) {
  const targetStyle = (style === 'fixed') ? 'fixed' : 'floating';
  state.navStyle = targetStyle;
  SafeStorage.setItem('aura-nav-style', targetStyle);

  // .ios-settings-scroll-container is deliberately NOT in this list. Writing an
  // inline `!important` padding here outranks every stylesheet, which is why the
  // four CSS declarations of this same property (settings.css:749 and :2036,
  // components.css:1181, glass.css) had no effect and kept getting raised —
  // 200px, 140px, 110px — by anyone trying to fix spacing from the CSS side.
  // The settings container's own box already ends ~30px above the nav in both
  // nav styles, so it needs no JS clearance at all; settings.css:2036 owns it.
  const scrollContainers = document.querySelectorAll('.ios-analytics-scroll-container, .exercises-list-container, .tab-pane');
  scrollContainers.forEach(el => {
    if (targetStyle === 'fixed') {
      el.style.setProperty('padding-bottom', 'calc(90px + env(safe-area-inset-bottom, 16px))', 'important');
    } else {
      el.style.setProperty('padding-bottom', 'calc(110px + env(safe-area-inset-bottom, 24px))', 'important');
    }
  });

  if (targetStyle === 'fixed') {
    document.body.classList.add('nav-style-fixed');
  } else {
    document.body.classList.remove('nav-style-fixed');
  }
}

export function resetTabs() {
  state.previousTab = 'settings';
  state.lastActiveMainTab = 'settings';
  switchTab('settings');
}

// Bind Global Navigation Functions & Event Listeners
window.switchTab = switchTab;
window.goBackNav = goBackNav;
window.applyNavStyle = applyNavStyle;
window.resetTabs = resetTabs;

// Compatibility aliases for dormant/legacy code
window.collapseNav = function() {};
window.expandNav = function() {};

onDOMReady(() => {
  // Bind tab clicks on main navigation bar
  const mainNav = document.getElementById('app-bottom-nav') || document.querySelector('.ios-bottom-nav');
  if (mainNav) {
    const mainTabs = mainNav.querySelectorAll('.nav-tab[data-tab]');
    mainTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetTab = tab.dataset.tab;
        if (targetTab) {
          switchTab(targetTab);
        }
      });
    });
  }

  // Bind Back Button on metrics sub-navigation bar
  const subNavBackBtn = document.getElementById('sub-nav-back-btn');
  if (subNavBackBtn) {
    subNavBackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      goBackNav();
    });
  }
});

// iOS Settings Sub-navigation (Main View <-> Account Details View)
onDOMReady(() => {
  const goToAccountBtn = document.getElementById('go-to-account-btn');
  const backToSettingsBtn = document.getElementById('back-to-settings-btn');
  const settingsMainView = document.getElementById('settings-main-view');
  const settingsAccountView = document.getElementById('settings-account-view');

  if (goToAccountBtn && settingsMainView && settingsAccountView) {
    goToAccountBtn.addEventListener('click', () => {
      settingsMainView.classList.add('hide');
      settingsAccountView.classList.remove('hide');
    });
  }

  if (backToSettingsBtn && settingsMainView && settingsAccountView) {
    backToSettingsBtn.addEventListener('click', () => {
      settingsAccountView.classList.add('hide');
      settingsMainView.classList.remove('hide');
    });
  }
});

// Premium iOS PWA Installation Banner Prompt Logic
window.addEventListener('load', () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true || 
                       window.matchMedia('(display-mode: standalone)').matches;
  const iosPromptDismissed = SafeStorage.getItem('ios-pwa-prompt-dismissed');
  
  if (isIOS && !isStandalone && !iosPromptDismissed) {
    const banner = document.getElementById('ios-install-banner');
    const closeBtn = document.getElementById('ios-prompt-close-btn');
    
    if (banner) {
      setTimeout(() => banner.classList.add('show'), 3000);
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          banner.classList.remove('show');
          SafeStorage.setItem('ios-pwa-prompt-dismissed', 'true');
        });
      }
    }
  }
});

// ==========================================================================
// Binds Modules and Run initializers on Startup
// ==========================================================================
initWorkoutsModule();
initAnalyticsModule();
initSettingsModule();

// DOM initialization trigger
onDOMReady(() => {
  try { applyNavStyle(state.navStyle); } catch (e) { console.error("Nav style init error:", e); }
  try { initAuth(); } catch (e) { console.error("Auth init error:", e); }
  try { initPremiumSettings(); } catch (e) { console.error("Settings init error:", e); }
  try { initAnalyticsTab(); } catch (e) { console.error("Analytics tab init error:", e); }
  try { initOnboarding(); } catch (e) { console.error("Onboarding init error:", e); }
  try { initAdminModule(); } catch (e) { console.error("Admin module init error:", e); }
});
