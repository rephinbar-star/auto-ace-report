// Utility for localStorage with expiration support

const EXPIRATION_HOURS = 24;

interface StoredData<T> {
  data: T;
  timestamp: number;
}

/**
 * Store data in localStorage with a timestamp for expiration checking
 */
export function setWithExpiry<T>(key: string, data: T): void {
  const item: StoredData<T> = {
    data,
    timestamp: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(item));
}

/**
 * Get data from localStorage, returning null if expired or not found
 */
export function getWithExpiry<T>(key: string, expirationHours = EXPIRATION_HOURS): T | null {
  const itemStr = localStorage.getItem(key);
  
  if (!itemStr) {
    return null;
  }
  
  try {
    const item: StoredData<T> = JSON.parse(itemStr);
    
    // Check if item has the new format with timestamp
    if (typeof item.timestamp !== "number" || !("data" in item)) {
      // Legacy format without timestamp - treat as expired to force refresh
      localStorage.removeItem(key);
      return null;
    }
    
    const expirationMs = expirationHours * 60 * 60 * 1000;
    const isExpired = Date.now() - item.timestamp > expirationMs;
    
    if (isExpired) {
      localStorage.removeItem(key);
      return null;
    }
    
    return item.data;
  } catch {
    // Invalid JSON, remove the item
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Remove an item from localStorage
 */
export function removeExpirableItem(key: string): void {
  localStorage.removeItem(key);
}

/**
 * Clean up all expired pending analysis data
 * Call this on app startup to clear stale data
 */
export function cleanupExpiredStorage(): void {
  const keysToCheck = ["pendingAnalysisData"];
  
  keysToCheck.forEach((key) => {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return;
    
    try {
      const item = JSON.parse(itemStr);
      
      // Check if it's the new format with timestamp
      if (typeof item.timestamp === "number") {
        const expirationMs = EXPIRATION_HOURS * 60 * 60 * 1000;
        if (Date.now() - item.timestamp > expirationMs) {
          localStorage.removeItem(key);
          localStorage.removeItem("pendingReport");
          console.log(`Cleaned up expired storage: ${key}`);
        }
      } else {
        // Legacy format, remove it
        localStorage.removeItem(key);
        localStorage.removeItem("pendingReport");
      }
    } catch {
      localStorage.removeItem(key);
    }
  });
}
