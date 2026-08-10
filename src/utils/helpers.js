import { SafeStorage } from "./storage.js";

// Safe HTML escape helper to prevent Persistent DOM XSS
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Centralized helper to safely request notification permissions in a premium, cross-browser way
export async function requestNotificationPermissionSafely() {
  if ('Notification' in window && typeof Notification !== 'undefined') {
    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        console.log("Notification permission state:", permission);
      } catch (err) {
        console.warn("Could not request notification permission:", err);
      }
    }
  }
}

// Robust helper to trigger native-like local notifications
export async function triggerLocalNotification(title, body, isSystemUpdate = false) {
  if (!isSystemUpdate) {
    const notifEnabled = SafeStorage.getItem('settings_notifications_enabled') !== 'false';
    if (!notifEnabled) {
      console.log("Notifications are disabled by user settings. Skipping non-system notification.");
      return;
    }
  }

  if (!('Notification' in window) || typeof Notification === 'undefined') {
    console.warn("Notifications are not supported in this browser environment.");
    return;
  }
  
  if (Notification.permission !== 'granted') {
    console.warn("Notification permission is not granted.");
    return;
  }

  const options = {
    body: body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  // Try to use Service Worker registration first for full iOS and Android standalone PWA support
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, options);
        console.log("Local notification triggered successfully via Service Worker.");
        return;
      }
    } catch (e) {
      console.warn("Service Worker notification failed, falling back to window.Notification:", e);
    }
  }

  // Fallback to standard client-side Notification API (for desktop browsers)
  try {
    new Notification(title, options);
    console.log("Local notification triggered successfully via standard constructor.");
  } catch (e) {
    console.error("Failed to display notification:", e);
  }
}

// Safe Date Parsing Helper Functions
export function safeFormatDate(value) {
  if (!value) return 'N/A';
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    return new Date(num).toLocaleDateString();
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
}

// Safe Date Time Helper
export function safeFormatDateTime(value) {
  if (!value) return 'N/A';
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    return new Date(num).toLocaleString();
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
}

// Initials Avatar generator
export function getInitialsAvatar(name) {
  const cleanName = String(name || 'User').trim();
  // Filter out empty segments so names with double spaces cannot produce undefined initials
  const parts = cleanName.split(/\s+/).filter(Boolean);
  let initials = '';
  if (parts.length > 1) {
    initials = (parts[0][0] || '') + (parts[1][0] || '');
  } else if (parts.length === 1) {
    initials = parts[0].substring(0, 2);
  }
  initials = (initials || 'U').toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="avatar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#dc2626"/>
        <stop offset="100%" stop-color="#f43f5e"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#avatar-grad)"/>
    <text x="50" y="55" font-family="'Outfit', 'Inter', sans-serif" font-weight="800" font-size="36" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" letter-spacing="1">${initials}</text>
  </svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Sleek glassmorphic Toast notification system.
// `message` is treated as PLAIN TEXT by default — several callers interpolate
// user-controlled values (display names, exercise names, error strings) into it.
// Pass allowHtml = true only for a hard-coded markup string.
export function showPremiumToast(message, type = 'info', allowHtml = false) {
  let toastContainer = document.getElementById('premium-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'premium-toast-container';
    toastContainer.className = 'premium-toast-container';
    document.body.appendChild(toastContainer);
  }
  
  const toast = document.createElement('div');
  toast.className = `premium-toast toast-${type}`;
  
  let icon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="custom-svg-icon"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3z"/></svg>';
  if (type === 'error') {
    icon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ff3b30" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="custom-svg-icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  } else if (type === 'success') {
    icon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#34c759" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="custom-svg-icon"><polyline points="20 6 9 17 4 12"/></svg>';
  }
  
  toast.innerHTML = `
    <span class="toast-icon" style="display: flex; align-items: center; justify-content: center;">${icon}</span>
    <span class="toast-text"></span>
  `;
  const textEl = toast.querySelector('.toast-text');
  if (allowHtml) {
    textEl.innerHTML = message;
  } else {
    textEl.textContent = message;
  }
  
  toastContainer.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// Reusable elegant glassmorphic status toast notifications
export function showAuraToast(message) {
  const existing = document.getElementById('aura-premium-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'aura-premium-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: calc(90px + env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: rgba(15, 15, 20, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(220, 38, 38, 0.4);
    box-shadow: 0 10px 30px rgba(220, 38, 38, 0.15), 0 0 15px rgba(220, 38, 38, 0.25);
    padding: 14px 24px;
    border-radius: 16px;
    color: #ffffff;
    font-size: 0.95rem;
    font-weight: 700;
    z-index: 99999;
    pointer-events: none;
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    direction: rtl;
    text-align: center;
    white-space: nowrap;
    font-family: var(--font-sans);
  `;
  toast.innerHTML = `<span>🤖🔥</span> <span class="aura-toast-text"></span>`;
  toast.querySelector('.aura-toast-text').textContent = message;
  document.body.appendChild(toast);

  // Force a reflow
  toast.offsetHeight;

  // Fade and slide in
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  // Remove toast
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 2500);
}

// Background Activity Indicator & Workout Refresh Badge Controller
export function setBgSyncing(isSyncing, messageText) {
  const topBar = document.getElementById('top-bg-sync-bar');
  const topText = document.getElementById('top-sync-text');
  const workoutBadge = document.getElementById('workout-sync-badge');
  const workoutBadgeText = document.getElementById('workout-sync-badge-text');

  if (isSyncing) {
    if (topText) topText.textContent = messageText || 'מסנכרן תרגילים ונתונים ברקע... 🔄';
    if (topBar) topBar.classList.remove('hide');
    if (workoutBadgeText) workoutBadgeText.textContent = messageText || 'מעדכן תרגילים מהענן... ⚡';
    if (workoutBadge) workoutBadge.classList.remove('hide');
  } else {
    if (topBar) topBar.classList.add('hide');
    if (workoutBadge) workoutBadge.classList.add('hide');
  }
}

