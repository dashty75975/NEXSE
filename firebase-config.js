// Firebase Configuration for NEXŞE
// This file contains Firebase configuration and database structure

// Firebase configuration (replace with your actual config)
const firebaseConfig = {
  // Replace these with your actual Firebase project configuration
  apiKey: "your-api-key-here",
  authDomain: "nexse.firebaseapp.com",
  databaseURL: "https://nexse-default-rtdb.firebaseio.com/",
  projectId: "nexse",
  storageBucket: "nexse.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456789"
};

// Database structure for NEXŞE
const DATABASE_STRUCTURE = {
  // Driver profiles
  drivers: {
    driverId: {
      name: "string",
      email: "string",
      phone: "string",
      vehicleType: "string", // taxi, van, minibus, tuk-tuk, bus
      plate: "string",
      licenseNumber: "string",
      approved: "boolean",
      online: "boolean",
      location: {
        lat: "number",
        lng: "number", 
        timestamp: "number"
      },
      country: "IQ", // Always Iraq
      governorate: "string", // Baghdad, Basra, etc.
      icon: "string", // URL to vehicle icon
      registeredAt: "timestamp",
      lastSeen: "timestamp",
      // Bus specific
      routeFrom: "string",
      routeTo: "string",
      // Taxi specific
      taxiNumber: "string",
      // Additional fields
      rating: "number",
      totalTrips: "number",
      status: "string" // available, busy, offline
    }
  },
  
  // Vehicle types configuration
  vehicleTypes: {
    typeId: {
      name: "string",
      icon: "string",
      color: "string",
      enabled: "boolean"
    }
  },
  
  // Admin users
  admins: {
    adminId: {
      email: "string",
      role: "string", // super-admin, moderator
      permissions: ["approve-drivers", "manage-types", "view-analytics"]
    }
  },
  
  // Real-time location updates (optimized for geohash queries)
  locations: {
    driverId: {
      lat: "number",
      lng: "number",
      timestamp: "number",
      geohash: "string", // For efficient radius queries
      online: "boolean",
      status: "string"
    }
  },
  
  // System configuration
  config: {
    maxRadius: 10, // km
    defaultRadius: 5, // km
    locationUpdateInterval: 10, // seconds
    offlineThreshold: 300, // seconds
    rateLimits: {
      registration: 3, // per hour
      locationUpdate: 60 // per minute
    }
  },
  
  // Analytics and metrics
  analytics: {
    dailyStats: {
      date: {
        activeDrivers: "number",
        totalRegistrations: "number",
        onlineDrivers: "number"
      }
    }
  }
};

// Firestore Security Rules
const FIRESTORE_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read access to approved drivers and vehicle types
    match /drivers/{driverId} {
      allow read: if resource.data.approved == true;
      allow write: if request.auth != null && request.auth.uid == driverId;
    }
    
    match /vehicleTypes/{typeId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Location updates - drivers can only update their own
    match /locations/{driverId} {
      allow read: if resource.data.online == true;
      allow write: if request.auth != null && request.auth.uid == driverId;
    }
    
    // Admin only access
    match /admins/{adminId} {
      allow read, write: if isAdmin();
    }
    
    match /config/{document=**} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Helper functions
    function isAdmin() {
      return request.auth != null && 
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
  }
}
`;

// Realtime Database Rules (alternative to Firestore)
const REALTIME_DB_RULES = {
  "rules": {
    "drivers": {
      ".read": true,
      "$driverId": {
        ".write": "$driverId === auth.uid"
      }
    },
    "locations": {
      ".read": true,
      "$driverId": {
        ".write": "$driverId === auth.uid"
      }
    },
    "vehicleTypes": {
      ".read": true,
      ".write": "root.child('admins').child(auth.uid).exists()"
    },
    "admins": {
      ".read": "root.child('admins').child(auth.uid).exists()",
      ".write": "root.child('admins').child(auth.uid).exists()"
    },
    "config": {
      ".read": true,
      ".write": "root.child('admins').child(auth.uid).exists()"
    }
  }
};

// Default vehicle types for Iraq
const DEFAULT_VEHICLE_TYPES = [
  {
    id: "taxi",
    name: "Taxi",
    icon: "🚕",
    color: "#FFD700",
    enabled: true
  },
  {
    id: "minibus", 
    name: "Minibus",
    icon: "🚐",
    color: "#4CAF50",
    enabled: true
  },
  {
    id: "tuk-tuk",
    name: "Tuk-tuk",
    icon: "🛺",
    color: "#FF9800",
    enabled: true
  },
  {
    id: "van",
    name: "Van", 
    icon: "🚐",
    color: "#2196F3",
    enabled: true
  },
  {
    id: "bus",
    name: "Bus",
    icon: "🚌", 
    color: "#F44336",
    enabled: true
  }
];

// Firebase initialization function
function initializeFirebase() {
  // Initialize Firebase
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  
  // Get database references
  const db = firebase.firestore();
  const rtdb = firebase.database();
  const auth = firebase.auth();
  
  return { db, rtdb, auth };
}

// Geohash utilities for efficient location queries
class GeoHashUtil {
  static encode(lat, lng, precision = 9) {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let latRange = [-90, 90];
    let lngRange = [-180, 180];
    let geohash = '';
    let bit = 0;
    let ch = 0;
    let isEvenBit = true;
    
    while (geohash.length < precision) {
      if (isEvenBit) {
        const mid = (lngRange[0] + lngRange[1]) / 2;
        if (lng >= mid) {
          ch |= (1 << (4 - bit));
          lngRange[0] = mid;
        } else {
          lngRange[1] = mid;
        }
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        if (lat >= mid) {
          ch |= (1 << (4 - bit));
          latRange[0] = mid;
        } else {
          latRange[1] = mid;
        }
      }
      
      isEvenBit = !isEvenBit;
      
      if (bit < 4) {
        bit++;
      } else {
        geohash += base32[ch];
        bit = 0;
        ch = 0;
      }
    }
    
    return geohash;
  }
  
  // Get geohash neighbors for radius queries
  static getNeighbors(geohash) {
    // Implementation for getting neighboring geohash regions
    // This is a simplified version - full implementation would be more complex
    return [geohash]; // Placeholder
  }
}

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    firebaseConfig,
    DATABASE_STRUCTURE,
    FIRESTORE_RULES,
    REALTIME_DB_RULES,
    DEFAULT_VEHICLE_TYPES,
    initializeFirebase,
    GeoHashUtil
  };
}