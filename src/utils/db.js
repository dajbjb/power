import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  deleteField
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { state } from "../state.js";
import { SafeStorage } from "./storage.js";
import { showPremiumToast, triggerLocalNotification, setBgSyncing } from "./helpers.js";

let db = null;

const OWNER_EMAIL = 'wbddwd55@gmail.com';

// Never persist transient placeholder roles (e.g. 'loading') to Firestore —
// the security rules only accept 'user' on document creation.
function resolveRole(email, fallbackRole) {
  if (email && email.toLowerCase() === OWNER_EMAIL) return 'admin';
  return (fallbackRole === 'admin' || fallbackRole === 'user') ? fallbackRole : 'user';
}

// Initialize and get the Firestore instance with persistent cache support
export function getDb() {
  if (!db && state.app) {
    try {
      db = initializeFirestore(state.app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
      console.log("Firestore initialized successfully with persistent local cache.");
    } catch (e) {
      console.warn("Failed to initialize Firestore with persistent cache (possibly already initialized or unsupported):", e);
      try {
        db = getFirestore(state.app);
        console.log("Firestore initialized with standard getFirestore.");
      } catch (err) {
        console.error("Failed to get Firestore instance:", err);
      }
    }
  } else if (!db && window.firebaseConfig && window.firebaseConfig.apiKey && window.firebaseConfig.apiKey !== "YOUR_API_KEY") {
    try {
      if (!state.app) {
        state.app = initializeApp(window.firebaseConfig);
      }
      if (state.app) {
        db = getFirestore(state.app);
        console.log("Firestore auto-initialized with fallback getFirestore.");
      }
    } catch (err) {
      console.error("Failed to auto-initialize Firestore:", err);
    }
  }
  return db;
}

// Save a specific field to the user's cloud document
export async function saveFieldToCloud(fieldName, data) {
  if (!state.currentUser) return;
  if (!state.cloudSyncEnabled) {
    console.log("Cloud sync is disabled. Skipping save to cloud for:", fieldName);
    return;
  }

  const toggleMap = {
    workoutHistory: 'workoutHistory',
    activeWorkout: 'workoutHistory',
    customLocations: 'customLocations',
    customExercises: 'customExercises',
    favoriteExercises: 'favoriteExercises',
    exerciseDefaults: 'exerciseDefaults',
    futureWorkouts: 'futureWorkouts',
    messages: 'messages'
  };

  const toggleKey = toggleMap[fieldName];
  if (toggleKey && state.cloudSyncToggles && state.cloudSyncToggles[toggleKey] === false) {
    console.log(`Cloud sync is disabled for data type: ${toggleKey}. Skipping save to cloud.`);
    return;
  }

  const uid = state.currentUser.uid;
  const firestoreDb = getDb();
  if (!firestoreDb) {
    console.warn("Firestore not initialized. Cannot sync field:", fieldName);
    return;
  }
  try {
    const docRef = doc(firestoreDb, "users", uid);
    await setDoc(docRef, {
      [fieldName]: data,
      updatedAt: Date.now()
    }, { merge: true });
    console.log(`Successfully synced ${fieldName} to Firestore.`);
  } catch (error) {
    console.error(`Failed to sync ${fieldName} to Firestore:`, error);
  }
}

// Fetch the user's entire cloud document
// Fetch the user's entire cloud document
export async function loadUserDataFromCloud(uid) {
  const firestoreDb = getDb();
  if (!firestoreDb) {
    console.warn("Firestore not initialized. Cannot fetch user document.");
    throw new Error("Firestore is not initialized.");
  }
  try {
    const docRef = doc(firestoreDb, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.error("Failed to load user data from Firestore:", error);
    throw error;
  }
  return null;
}

// Upload local data to the cloud (used on first sync if cloud is empty)
export async function uploadLocalDataToCloud(uid) {
  // Ensure cloud sync state is enabled
  state.cloudSyncEnabled = true;
  SafeStorage.setItem('aura-cloud-sync-enabled', 'true');

  const data = {};
  const toggles = state.cloudSyncToggles || {};

  if (toggles.workoutHistory !== false) {
    const workoutHistory = SafeStorage.getItem(`aura-workout-history_${uid}`);
    if (workoutHistory) data.workoutHistory = JSON.parse(workoutHistory);
    const activeWorkout = SafeStorage.getItem(`aura-active-workout_${uid}`);
    if (activeWorkout) data.activeWorkout = JSON.parse(activeWorkout);
  }
  if (toggles.customLocations !== false) {
    const customLocations = SafeStorage.getItem(`aura-custom-locations_${uid}`);
    if (customLocations) data.customLocations = JSON.parse(customLocations);
  }
  if (toggles.customExercises !== false) {
    const customExercises = SafeStorage.getItem(`aura-custom-exercises_${uid}`);
    if (customExercises) data.customExercises = JSON.parse(customExercises);
  }
  if (toggles.favoriteExercises !== false) {
    const favoriteExercises = SafeStorage.getItem(`aura-favorite-exercises_${uid}`);
    if (favoriteExercises) data.favoriteExercises = JSON.parse(favoriteExercises);
  }
  if (toggles.exerciseDefaults !== false) {
    const exerciseDefaults = SafeStorage.getItem(`aura-exercise-defaults_${uid}`);
    if (exerciseDefaults) data.exerciseDefaults = JSON.parse(exerciseDefaults);
  }
  if (toggles.futureWorkouts !== false) {
    const futureWorkouts = SafeStorage.getItem(`aura-future-workouts_${uid}`);
    if (futureWorkouts) data.futureWorkouts = JSON.parse(futureWorkouts);
  }
  if (toggles.messages !== false) {
    const messages = SafeStorage.getItem(`aura-messages_${uid}`);
    if (messages) data.messages = JSON.parse(messages);
  }

  data.displaySettings = {
    opacity: state.displayOpacity,
    accentColor: state.accentColor,
    wallpaper: state.wallpaper
  };

  const firestoreDb = getDb();
  if (!firestoreDb) {
    throw new Error("Firestore is not initialized.");
  }
  try {
    const docRef = doc(firestoreDb, "users", uid);
    
    // Determine profile and role with cached fallback
    let email = state.currentUser ? state.currentUser.email : "";
    let displayName = state.currentUser ? state.currentUser.displayName : "";

    if (!email || !displayName) {
      try {
        const cachedStr = SafeStorage.getItem('aura-cached-user-session');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (!email) email = cached.email || "";
          if (!displayName) displayName = cached.displayName || "";
        }
      } catch (err) {}
    }

    const role = resolveRole(email, state.userRole);
    state.userRole = role;

    await setDoc(docRef, {
      ...data,
      email,
      displayName,
      role,
      updatedAt: Date.now()
    }, { merge: true });

    const nowTs = Date.now().toString();
    SafeStorage.setItem(`aura-last-sync_${uid}`, nowTs);
    SafeStorage.setItem(`aura-last-sync-time_${uid}`, nowTs);

    console.log("Successfully uploaded local cache to Firestore with user profile for UID:", uid);
  } catch (e) {
    console.error("Failed to upload local cache to Firestore:", e);
    throw e;
  }
}

// Merge cloud data with any existing local cache to prevent data loss, then update local state
export async function syncUserSession(uid, isManual = false) {
  if (!state.cloudSyncEnabled && !isManual) {
    console.log("Cloud sync is disabled. Skipping user session sync.");
    const email = state.currentUser ? state.currentUser.email : "";
    state.userRole = resolveRole(email, state.userRole);
    return;
  }
  
  state.isBackgroundSyncing = true;
  setBgSyncing(true, 'מסנכרן תרגילים ונתונים מהענן... ☁️');

  try {
    console.log("Starting cloud data synchronization for uid:", uid);
    if (isManual) {
      state.cloudSyncEnabled = true;
      SafeStorage.setItem('aura-cloud-sync-enabled', 'true');
      showPremiumToast("מסנכרן נתונים מהענן... ☁️", "info");
    }

    const cloudData = await loadUserDataFromCloud(uid);

    // Determine profile and role
    const email = state.currentUser ? state.currentUser.email : "";
    const displayName = state.currentUser ? state.currentUser.displayName : "";
    const role = resolveRole(email, cloudData?.role);
    state.userRole = role;

    if (!cloudData) {
      console.log("No cloud data found. Backup local data to cloud...");
      await uploadLocalDataToCloud(uid);
      if (isManual) {
        showPremiumToast("הסנכרון הראשוני הושלם והחשבון נוצר בענן! ⚡", "success");
      }
      return;
    }

    const localLastSync = parseInt(SafeStorage.getItem(`aura-last-sync_${uid}`) || "0");
    const cloudLastUpdate = cloudData.updatedAt || 0;

    if (cloudLastUpdate > 0 && cloudLastUpdate <= localLastSync && !isManual) {
      console.log("Local data is already up-to-date with cloud. Skipping heavy sync.");
      return;
    }

    if (!isManual) {
      showPremiumToast("מסנכרן שינויים מהענן... ⚡", "info");
    }

    // Adopt the cloud copy of the sync preferences so they follow the user across devices
    if (cloudData.cloudSyncToggles && typeof cloudData.cloudSyncToggles === 'object') {
      state.cloudSyncToggles = { ...(state.cloudSyncToggles || {}), ...cloudData.cloudSyncToggles };
      SafeStorage.setItem('aura-cloud-sync-toggles', JSON.stringify(state.cloudSyncToggles));
    }

    const toggles = state.cloudSyncToggles || {};

    // 1. Merge Workout History
    let mergedHistory = state.workoutHistory;
    if (toggles.workoutHistory !== false) {
      const localHistory = JSON.parse(SafeStorage.getItem(`aura-workout-history_${uid}`) || "[]");
      const cloudHistory = cloudData.workoutHistory || [];
      const historyMap = new Map();
      localHistory.forEach(w => historyMap.set(String(w.id), w));
      cloudHistory.forEach(w => historyMap.set(String(w.id), w));
      mergedHistory = Array.from(historyMap.values()).sort((a, b) => b.date - a.date);
      SafeStorage.setItem(`aura-workout-history_${uid}`, JSON.stringify(mergedHistory));
      state.workoutHistory = mergedHistory;
    }

    // 2. Merge Custom Locations
    let mergedLocs = state.customLocations;
    if (toggles.customLocations !== false) {
      const localLocs = JSON.parse(SafeStorage.getItem(`aura-custom-locations_${uid}`) || "[]");
      const cloudLocs = cloudData.customLocations || [];
      const locsMap = new Map();
      localLocs.forEach(l => locsMap.set(String(l.id), l));
      cloudLocs.forEach(l => locsMap.set(String(l.id), l));
      mergedLocs = Array.from(locsMap.values());
      SafeStorage.setItem(`aura-custom-locations_${uid}`, JSON.stringify(mergedLocs));
      state.customLocations = mergedLocs;
    }

    // 3. Merge Custom Exercises
    let mergedExs = state.customExercises;
    if (toggles.customExercises !== false) {
      const localExs = JSON.parse(SafeStorage.getItem(`aura-custom-exercises_${uid}`) || "[]");
      const cloudExs = cloudData.customExercises || [];
      const exsMap = new Map();
      localExs.forEach(e => exsMap.set(e.name.trim().toLowerCase(), e));
      cloudExs.forEach(e => exsMap.set(e.name.trim().toLowerCase(), e));
      mergedExs = Array.from(exsMap.values());
      SafeStorage.setItem(`aura-custom-exercises_${uid}`, JSON.stringify(mergedExs));
      state.customExercises = mergedExs;
    }

    // 4. Merge Favorite Exercises
    let mergedFavs = state.favoriteExercises;
    if (toggles.favoriteExercises !== false) {
      const localFavs = JSON.parse(SafeStorage.getItem(`aura-favorite-exercises_${uid}`) || "[]");
      const cloudFavs = cloudData.favoriteExercises || [];
      mergedFavs = Array.from(new Set([...localFavs, ...cloudFavs]));
      SafeStorage.setItem(`aura-favorite-exercises_${uid}`, JSON.stringify(mergedFavs));
      state.favoriteExercises = mergedFavs;
    }

    // 5. Merge Exercise Defaults Configurations
    let mergedDefaults = JSON.parse(SafeStorage.getItem(`aura-exercise-defaults_${uid}`) || "{}");
    if (toggles.exerciseDefaults !== false) {
      const localDefaults = mergedDefaults;
      const cloudDefaults = cloudData.exerciseDefaults || {};
      mergedDefaults = { ...localDefaults, ...cloudDefaults };
      SafeStorage.setItem(`aura-exercise-defaults_${uid}`, JSON.stringify(mergedDefaults));
    }

    // 6. Merge Active Workout
    let mergedActive = state.activeWorkout;
    if (toggles.workoutHistory !== false) {
      const localActive = SafeStorage.getItem(`aura-active-workout_${uid}`);
      if (cloudData.activeWorkout) {
        mergedActive = cloudData.activeWorkout;
      } else if (localActive) {
        try { mergedActive = JSON.parse(localActive); } catch(e) {}
      }
      if (mergedActive) {
        SafeStorage.setItem(`aura-active-workout_${uid}`, JSON.stringify(mergedActive));
      } else {
        SafeStorage.removeItem(`aura-active-workout_${uid}`);
      }
      state.activeWorkout = mergedActive;
    }

    // 7. Merge Future Workouts
    let mergedFuture = [];
    if (toggles.futureWorkouts !== false) {
      const localFuture = JSON.parse(SafeStorage.getItem(`aura-future-workouts_${uid}`) || "[]");
      const cloudFuture = cloudData.futureWorkouts || [];
      const futureMap = new Map();
      localFuture.forEach(f => futureMap.set(String(f.id), f));
      cloudFuture.forEach(f => futureMap.set(String(f.id), f));
      mergedFuture = Array.from(futureMap.values());
      SafeStorage.setItem(`aura-future-workouts_${uid}`, JSON.stringify(mergedFuture));
    }

    // 8. Merge Messages
    let mergedMessages = state.userMessages;
    if (toggles.messages !== false) {
      const localMessages = JSON.parse(SafeStorage.getItem(`aura-messages_${uid}`) || "[]");
      const cloudMessages = cloudData.messages || [];

      // Trigger local push notification on new unread cloud messages (Choice A1)
      const localMsgIds = new Set(localMessages.map(m => String(m.id)));
      const newCloudMessages = cloudMessages.filter(m => !localMsgIds.has(String(m.id)));
      if (newCloudMessages.length > 0) {
        const unreadNew = newCloudMessages.filter(m => !m.read);
        if (unreadNew.length > 0 && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          unreadNew.forEach(m => {
            try {
              triggerLocalNotification(
                m.title || "הודעה חדשה מהמערכת ✉️",
                m.content || "כנס לאפליקציה לצפייה בהודעה."
              );
            } catch(err) {
              console.warn("Failed to fire push notification:", err);
            }
          });
        }
      }

      const messagesMap = new Map();
      localMessages.forEach(m => messagesMap.set(String(m.id), m));
      cloudMessages.forEach(m => messagesMap.set(String(m.id), m));
      mergedMessages = Array.from(messagesMap.values()).sort((a, b) => b.date - a.date);
      SafeStorage.setItem(`aura-messages_${uid}`, JSON.stringify(mergedMessages));
      state.userMessages = mergedMessages;
    }

    // 9. Sync Display Settings (Theme, Opacity, Wallpaper, Accent Color, Glows, NavStyle)
    if (cloudData.displaySettings) {
      const ds = cloudData.displaySettings;
      if (ds.theme) {
        state.displayTheme = ds.theme;
        state.outdoorMode = (ds.theme === 'outdoor');
        SafeStorage.setItem('aura-display-theme', ds.theme);
        SafeStorage.setItem('settings_dark_mode', ds.theme === 'dark' ? 'true' : 'false');
        SafeStorage.setItem('aura-outdoor-mode', ds.theme === 'outdoor' ? 'true' : 'false');
      }
      if (ds.opacity !== undefined) {
        state.displayOpacity = ds.opacity;
        SafeStorage.setItem('aura-display-opacity', ds.opacity);
      }
      if (ds.accentColor) {
        state.accentColor = ds.accentColor;
        SafeStorage.setItem('aura-accent-color', ds.accentColor);
      }
      if (ds.cardColor) {
        state.cardBgColor = ds.cardColor;
        SafeStorage.setItem('aura-card-bg-color', ds.cardColor);
      }
      if (ds.wallpaper) {
        state.wallpaper = ds.wallpaper;
        SafeStorage.setItem('aura-wallpaper', ds.wallpaper);
      }
      if (ds.showGlows !== undefined) {
        state.showGlows = ds.showGlows;
        SafeStorage.setItem('aura-show-glows', ds.showGlows ? 'true' : 'false');
      }
      if (ds.navStyle) {
        state.navStyle = ds.navStyle;
        SafeStorage.setItem('aura-nav-style', ds.navStyle);
      }
      if (ds.glassBlur !== undefined) {
        state.glassBlur = ds.glassBlur;
        SafeStorage.setItem('aura-glass-blur', ds.glassBlur);
      }
      if (ds.density) { state.density = ds.density; SafeStorage.setItem('aura-density', ds.density); }
      if (ds.fontSize) { state.fontSize = ds.fontSize; SafeStorage.setItem('aura-font-size', ds.fontSize); }
      if (ds.cornerStyle) { state.cornerStyle = ds.cornerStyle; SafeStorage.setItem('aura-corner-style', ds.cornerStyle); }
      if (ds.motionPref) { state.motionPref = ds.motionPref; SafeStorage.setItem('aura-motion', ds.motionPref); }
      if (window.applyDisplayPreferences) {
        window.applyDisplayPreferences();
      }
      if (window.applyNavStyle) {
        window.applyNavStyle(state.navStyle);
      }
    }

    // Upload merged data back to the cloud in case local had items the cloud didn't
    if (state.cloudSyncEnabled) {
      const mergedDoc = {
        email,
        displayName,
        role,
        displaySettings: {
          theme: state.displayTheme,
          opacity: state.displayOpacity,
          accentColor: state.accentColor,
          cardColor: state.cardBgColor,
          wallpaper: state.wallpaper,
          showGlows: state.showGlows,
          navStyle: state.navStyle
        },
        updatedAt: Date.now()
      };
      if (toggles.workoutHistory !== false) {
        mergedDoc.workoutHistory = mergedHistory;
        mergedDoc.activeWorkout = mergedActive;
      }
      if (toggles.customLocations !== false) mergedDoc.customLocations = mergedLocs;
      if (toggles.customExercises !== false) mergedDoc.customExercises = mergedExs;
      if (toggles.favoriteExercises !== false) mergedDoc.favoriteExercises = mergedFavs;
      if (toggles.exerciseDefaults !== false) mergedDoc.exerciseDefaults = mergedDefaults;
      if (toggles.futureWorkouts !== false) mergedDoc.futureWorkouts = mergedFuture;
      if (toggles.messages !== false) mergedDoc.messages = mergedMessages;
      
      const firestoreDb = getDb();
      if (firestoreDb) {
        const docRef = doc(firestoreDb, "users", uid);
        await setDoc(docRef, mergedDoc, { merge: true });
      }
    }

    const nowTimestamp = Date.now().toString();
    SafeStorage.setItem(`aura-last-sync_${uid}`, nowTimestamp);
    SafeStorage.setItem(`aura-last-sync-time_${uid}`, nowTimestamp);

    if (isManual || cloudLastUpdate > localLastSync) {
      showPremiumToast("הסנכרון הושלם! ✨", "success");
    }
  } catch (error) {
    console.error("Error during cloud user sync session:", error);
    if (isManual) {
      const msg = error && error.message ? error.message : "בעיית חיבור לרשת";
      showPremiumToast(`סנכרון הענן נכשל: ${msg}`, "error");
    }
    throw error;
  } finally {
    state.isBackgroundSyncing = false;
    setBgSyncing(false);
    // Refresh any view that shows a "loading from cloud" placeholder
    if (window.renderExercisePickerList) window.renderExercisePickerList();
  }
}

export async function deleteSpecificCloudCategory(uid, categoryKey) {
  const firestoreDb = getDb();
  if (!firestoreDb) return;
  try {
    const docRef = doc(firestoreDb, "users", uid);
    await setDoc(docRef, {
      [categoryKey]: deleteField(),
      updatedAt: Date.now()
    }, { merge: true });
    console.log(`Successfully deleted category ${categoryKey} from cloud.`);
  } catch (error) {
    console.error(`Failed to delete category ${categoryKey} from cloud:`, error);
  }
}

export async function deleteSpecificCloudItem(uid, categoryKey, itemKey) {
  const cloudData = await loadUserDataFromCloud(uid);
  if (!cloudData || !cloudData[categoryKey]) return;

  const categoryData = cloudData[categoryKey];
  let updatedData;

  if (Array.isArray(categoryData)) {
    const target = String(itemKey).toLowerCase();
    updatedData = categoryData.filter(item => {
      // Plain string arrays (e.g. favoriteExercises) are matched by value
      if (typeof item === 'string') {
        return item.toLowerCase() !== target;
      }
      if (item && item.id !== undefined && String(item.id) === String(itemKey)) return false;
      if (item && item.name !== undefined && String(item.name).toLowerCase() === target) return false;
      return true;
    });
  } else if (typeof categoryData === 'object') {
    updatedData = { ...categoryData };
    delete updatedData[itemKey];
  } else {
    return;
  }

  const firestoreDb = getDb();
  if (!firestoreDb) return;
  try {
    const docRef = doc(firestoreDb, "users", uid);
    await setDoc(docRef, {
      [categoryKey]: updatedData,
      updatedAt: Date.now()
    }, { merge: true });
    console.log(`Successfully deleted item ${itemKey} from category ${categoryKey} in cloud.`);
  } catch (error) {
    console.error(`Failed to delete item ${itemKey} from category ${categoryKey} in cloud:`, error);
  }
}

// Delete all cloud data for the user (PRESERVING user document and profile)
export async function deleteCloudDataOnly(uid) {
  const firestoreDb = getDb();
  if (!firestoreDb) {
    throw new Error("Firestore not initialized.");
  }
  const docRef = doc(firestoreDb, "users", uid);
  const email = state.currentUser ? state.currentUser.email : "";
  const displayName = state.currentUser ? state.currentUser.displayName : "";

  // Clear data fields using deleteField(). `role` is deliberately NOT written here:
  // merge:true already preserves it, and recomputing it from state.userRole demoted
  // any admin whose role had not finished resolving yet.
  await setDoc(docRef, {
    workoutHistory: deleteField(),
    activeWorkout: deleteField(),
    customLocations: deleteField(),
    customExercises: deleteField(),
    favoriteExercises: deleteField(),
    exerciseDefaults: deleteField(),
    futureWorkouts: deleteField(),
    messages: deleteField(),
    displaySettings: deleteField(),
    email,
    displayName,
    updatedAt: Date.now()
  }, { merge: true });
  console.log(`Successfully reset user cloud data while preserving profile for: ${uid}`);
}
