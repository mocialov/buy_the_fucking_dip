/**
 * API Configuration
 * 
 * Manages API keys with fallback strategy:
 * 1. User-provided key (runtime, stored in localStorage)
 * 2. Environment variable (developer's key from .env.local)
 * 3. Demo key (limited, shared)
 */

export const DEMO_API_KEY = '1e84c56991a24d25ba629f833087c00d';
const STORAGE_KEY = 'twelvedata_api_key';

/**
 * Get API key from environment variable (.env.local)
 * Only available to developers who have .env.local file
 */
function getEnvApiKey(): string | undefined {
  return import.meta.env.VITE_TWELVE_DATA_API_KEY;
}

/**
 * Get user's saved API key from localStorage
 */
export function getUserApiKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to read API key from localStorage:', error);
    return null;
  }
}

/**
 * Save user's API key to localStorage
 */
export function saveUserApiKey(apiKey: string): void {
  try {
    if (apiKey.trim()) {
      localStorage.setItem(STORAGE_KEY, apiKey.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Failed to save API key to localStorage:', error);
  }
}

/**
 * Clear user's saved API key
 */
export function clearUserApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear API key from localStorage:', error);
  }
}

/**
 * Get the active API key with fallback strategy:
 * 1. User-provided key (highest priority)
 * 2. Developer's .env.local key
 * 3. Demo key (lowest priority, shared/limited)
 */
export function getActiveApiKey(): { key: string; source: 'user' | 'env' | 'demo' } {
  // First, check for user-provided key
  const userKey = getUserApiKey();
  if (userKey) {
    return { key: userKey, source: 'user' };
  }
  
  // Second, check for developer's environment variable
  const envKey = getEnvApiKey();
  if (envKey && envKey !== 'your_api_key_here') {
    return { key: envKey, source: 'env' };
  }
  
  // Finally, fall back to demo key
  return { key: DEMO_API_KEY, source: 'demo' };
}

/**
 * Get a descriptive message about the current API key source
 */
export function getApiKeySourceMessage(): string {
  const { source } = getActiveApiKey();
  
  switch (source) {
    case 'user':
      return '✅ Using your custom API key';
    case 'env':
      return '🔧 Using developer API key from .env.local';
    case 'demo':
      return '⚠️ Using demo API key (limited, shared)';
  }
}

/**
 * Check if debug mode is enabled
 * Debug mode shows additional UI elements for development/testing:
 * - Input Time Series (Debug) section
 * - Raw Data expandable section
 */
export function isDebugMode(): boolean {
  const debugMode = import.meta.env.VITE_DEBUG_MODE;
  return debugMode === 'true' || debugMode === true;
}
