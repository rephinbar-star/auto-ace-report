/**
 * URL Validation utility to prevent SSRF attacks
 * Blocks private IPs, localhost, and cloud metadata endpoints
 */

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  url?: URL;
}

// Blocked hostname patterns (private networks, localhost, metadata endpoints)
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,              // IPv4 loopback
  /^10\.\d+\.\d+\.\d+$/,               // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/,  // Private Class B
  /^192\.168\.\d+\.\d+$/,              // Private Class C
  /^169\.254\.\d+\.\d+$/,              // Link-local / AWS metadata
  /^0\.0\.0\.0$/,                      // Any address
  /^\[::1\]$/,                         // IPv6 loopback
  /^\[fe80:/i,                         // IPv6 link-local
  /^\[fc00:/i,                         // IPv6 unique local
  /^\[fd00:/i,                         // IPv6 unique local
  /^metadata\.google\.internal$/i,     // GCP metadata
  /^metadata\.google\.com$/i,          // GCP metadata alt
  /^instance-data$/i,                  // Generic cloud metadata
];

// Blocked hostnames (exact match)
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  '169.254.169.254',                   // AWS/Azure metadata
  'metadata.google.internal',          // GCP metadata
  'metadata.google.com',
  'instance-data',
]);

/**
 * Validates a URL to prevent SSRF attacks
 * @param urlString - The URL string to validate
 * @returns Validation result with sanitized URL or error message
 */
export function validateUrl(urlString: string): UrlValidationResult {
  // Trim and normalize
  const trimmed = urlString?.trim();
  if (!trimmed) {
    return { valid: false, error: "URL is required" };
  }

  // Parse URL
  let url: URL;
  try {
    // Handle URLs without protocol
    let normalized = trimmed;
    if (!normalized.match(/^https?:\/\//i)) {
      normalized = `https://${normalized}`;
    }
    url = new URL(normalized);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Only allow HTTP and HTTPS protocols
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, error: "Only HTTP/HTTPS URLs are allowed" };
  }

  // Block file:// and other dangerous schemes explicitly
  if (url.protocol === 'file:') {
    return { valid: false, error: "File URLs are not allowed" };
  }

  const hostname = url.hostname.toLowerCase();

  // Check against exact blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: "Cannot access private or internal addresses" };
  }

  // Check against blocked patterns
  for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: "Cannot access private or internal addresses" };
    }
  }

  // Additional check: block any hostname containing "metadata"
  if (hostname.includes('metadata')) {
    return { valid: false, error: "Cannot access metadata endpoints" };
  }

  // Block IP addresses in decimal or octal notation (alternative representations)
  // e.g., http://2130706433/ (decimal for 127.0.0.1)
  if (/^\d+$/.test(hostname)) {
    return { valid: false, error: "Numeric IP addresses are not allowed" };
  }

  // Block octal notation (0177.0.0.1 = 127.0.0.1)
  if (/^0\d+/.test(hostname.split('.')[0] || '')) {
    return { valid: false, error: "Octal IP notation is not allowed" };
  }

  // Validate port if specified (block common internal service ports)
  if (url.port) {
    const port = parseInt(url.port, 10);
    const blockedPorts = [22, 23, 25, 135, 139, 445, 3389, 5432, 3306, 6379, 27017];
    if (blockedPorts.includes(port)) {
      return { valid: false, error: "Access to this port is not allowed" };
    }
  }

  // URL length limit to prevent memory exhaustion
  if (url.href.length > 2000) {
    return { valid: false, error: "URL is too long" };
  }

  return { valid: true, url };
}

/**
 * Allowlist of known car listing domains (optional stricter mode)
 */
export const KNOWN_CAR_LISTING_DOMAINS = [
  'bringatrailer.com',
  'ebay.com',
  'carmax.com',
  'carvana.com',
  'autotrader.com',
  'cars.com',
  'craigslist.org',
  'facebook.com',
  'carfax.com',
  'kbb.com',
  'edmunds.com',
  'truecar.com',
  'cargurus.com',
  'vroom.com',
  'shift.com',
];

/**
 * Optional: Validate URL is from a known car listing domain
 * (Currently not enforced to allow flexibility)
 */
export function isKnownCarListingDomain(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return KNOWN_CAR_LISTING_DOMAINS.some(domain => 
    hostname === domain || hostname.endsWith(`.${domain}`)
  );
}
