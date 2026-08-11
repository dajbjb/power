import { SafeStorage } from "./utils/storage.js";

// AuraApp Shared State Container
export const state = {
  // Authentication State
  currentUser: null,
  userRole: 'loading',
  isSensitiveDataVisible: false,
  firebaseEnabled: false,
  firebaseAuthResolved: false,
  app: null,
  auth: null,
  googleProvider: null,

  // Admin & User Communication State
  userMessages: [],
  usersList: [],
  feedbacksList: [],

  // Navigation State
  lastActiveMainTab: 'settings',
  previousTab: 'settings',
  activeSubTab: 'workouts',

  // Background sync indicator, read by views that show a "loading from cloud" hint
  isBackgroundSyncing: false,

  // Workouts State
  activeWorkout: null,
  activeTimerInterval: null,
  workoutHistory: [],
  editingWorkout: null,
  customLocations: [],
  customExercises: [],
  favoriteExercises: [],
  selectedExerciseForAdding: null,
  currentActiveCategoryFilter: 'הכל',
  editingActiveExerciseIndex: null,
  configuringExerciseDefaults: null,

  // Rest Timer State
  restTimerInterval: null,
  restTimerSecondsLeft: 0,
  restTimerTotalDuration: 90,

  // Set Logging State
  currentLoggingExercise: null,
  currentLoggingSetIndex: -1,

  // Analytics & Metrics State
  filterTimeSelection: 'all',
  filterStartDate: null,
  filterEndDate: null,
  filterLocation: 'all',
  filterMuscleGroup: 'all',
  activeChartTypeTab3: '1rm',
  activeInspectorMetric: 'weight',
  currentInspectorExercise: null,
  aerobicTimeSelection: '30',
  currentCalendarDate: new Date(),
  filterSortSelection: 'date-desc',
  activeAnalyticsSegment: 'workouts', // Only workouts is supported now

  // Location-based Run Tracker State
  isTrackingRun: false,
  isRunPaused: false,
  activeRunExerciseIndex: null,
  runWatchPositionId: null,
  runTrackerState: "run", // "run" | "walk" | "rest"
  runTrackerSegments: [],
  runTrackerMetrics: {
    totalDistance: 0,
    runDistance: 0,
    walkDistance: 0,
    totalDuration: 0,
    runDuration: 0,
    walkDuration: 0,
    restDuration: 0
  },

  // Cloud Sync Settings
  cloudSyncEnabled: SafeStorage.getItem('aura-cloud-sync-enabled') !== 'false',
  cloudSyncToggles: (() => {
    try {
      const saved = SafeStorage.getItem('aura-cloud-sync-toggles');
      return saved ? JSON.parse(saved) : {
        workoutHistory: true,
        customExercises: true,
        customLocations: true,
        favoriteExercises: true,
        exerciseDefaults: true,
        futureWorkouts: true,
        messages: true
      };
    } catch (e) {
      return {
        workoutHistory: true,
        customExercises: true,
        customLocations: true,
        favoriteExercises: true,
        exerciseDefaults: true,
        futureWorkouts: true,
        messages: true
      };
    }
  })(),

  // Display Settings
  displayTheme: SafeStorage.getItem('aura-display-theme') || (SafeStorage.getItem('aura-outdoor-mode') === 'true' ? 'outdoor' : (SafeStorage.getItem('settings_dark_mode') === 'false' ? 'light' : 'dark')),
  outdoorMode: SafeStorage.getItem('aura-outdoor-mode') === 'true',
  showGlows: SafeStorage.getItem('aura-show-glows') !== 'false',
  navStyle: SafeStorage.getItem('aura-nav-style') || 'floating',
  displayOpacity: parseInt(SafeStorage.getItem('aura-display-opacity') || '85'),
  accentColor: SafeStorage.getItem('aura-accent-color') || '#007aff',
  cardBgColor: SafeStorage.getItem('aura-card-bg-color') || '#16161c',
  wallpaper: SafeStorage.getItem('aura-wallpaper') || 'default',

  // Liquid Glass appearance controls (v1.10.0)
  // null = 'auto': defer to the OS prefers-reduced-transparency setting
  glassBlur: SafeStorage.getItem('aura-glass-blur') === null ? null : parseInt(SafeStorage.getItem('aura-glass-blur')),
  density: SafeStorage.getItem('aura-density') || 'comfortable',
  fontSize: SafeStorage.getItem('aura-font-size') || 'normal',
  cornerStyle: SafeStorage.getItem('aura-corner-style') || 'rounded',
  motionPref: SafeStorage.getItem('aura-motion') || 'full'
};


