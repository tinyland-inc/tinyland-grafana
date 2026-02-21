/**
 * Grafana Configuration Service
 *
 * Environment-agnostic configuration for Grafana API access.
 * Supports both Podman Compose (development) and Kubernetes (production).
 *
 * Unlike the original monorepo version this does NOT read from process.env or
 * $env/static/private directly.  All environment values flow through the
 * package-level config injected via configureGrafana().
 *
 * @module grafana-config
 */

import { getGrafanaConfig, getLogger } from './config.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Grafana time range for queries
 */
export interface TimeRange {
  from: string; // "now-1h", "2025-11-01T00:00:00Z", etc.
  to: string;   // "now", "2025-11-01T23:59:59Z", etc.
}

/**
 * Grafana dashboard panel reference
 */
export interface PanelReference {
  dashboardUid: string;
  panelId: number;
}

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

/**
 * Detect the runtime environment.
 *
 * Checks well-known env vars that are present in Kubernetes and Podman
 * Compose respectively.  Falls back to "unknown" for bare-metal / CI.
 */
export function detectEnvironment(): 'podman' | 'kubernetes' | 'unknown' {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.KUBERNETES_SERVICE_HOST) {
      return 'kubernetes';
    }
    if (process.env.COMPOSE_PROJECT_NAME || process.env.HOSTNAME?.includes('stonewall')) {
      return 'podman';
    }
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the Grafana base URL.
 *
 * Priority:
 *  1. Explicit value from package config (grafanaUrl)
 *  2. GRAFANA_URL from process.env (if available)
 *  3. Auto-detect based on environment
 */
function getGrafanaBaseUrl(): string {
  const logger = getLogger();
  const cfg = getGrafanaConfig();

  // 1. Package-level config override
  if (cfg.grafanaUrl) {
    logger.debug('Using grafanaUrl from package config', { url: cfg.grafanaUrl });
    return cfg.grafanaUrl;
  }

  // 2. process.env fallback
  if (typeof process !== 'undefined' && process.env?.GRAFANA_URL) {
    const envUrl = process.env.GRAFANA_URL;
    logger.debug('Using GRAFANA_URL from process.env', { url: envUrl });
    return envUrl;
  }

  // 3. Auto-detect
  const environment = detectEnvironment();
  switch (environment) {
    case 'kubernetes': {
      const k8sUrl = 'http://stonewall-grafana.monitoring.svc.cluster.local:3000';
      logger.info('Detected Kubernetes environment, using cluster DNS', { url: k8sUrl });
      return k8sUrl;
    }
    case 'podman': {
      const podmanUrl = 'http://stonewall-grafana:3000';
      logger.info('Detected Podman Compose environment, using service name', { url: podmanUrl });
      return podmanUrl;
    }
    default: {
      const fallbackUrl = 'http://localhost:3000';
      logger.warn('Unknown environment, using localhost fallback', { url: fallbackUrl });
      return fallbackUrl;
    }
  }
}

/**
 * Load the Grafana service account token.
 *
 * Priority:
 *  1. Package config (grafanaToken)
 *  2. GRAFANA_SERVICE_ACCOUNT_TOKEN env var
 *  3. Token file at /app/.grafana-token (Podman)
 *  4. Kubernetes secret mount at /run/secrets/grafana-token
 */
function loadServiceAccountToken(): string | null {
  const logger = getLogger();
  const cfg = getGrafanaConfig();

  // 1. Package-level config
  if (cfg.grafanaToken) {
    logger.debug('Using grafanaToken from package config');
    return cfg.grafanaToken;
  }

  // 2. Environment variable
  if (typeof process !== 'undefined' && process.env?.GRAFANA_SERVICE_ACCOUNT_TOKEN) {
    const envToken = process.env.GRAFANA_SERVICE_ACCOUNT_TOKEN;
    if (envToken.trim().length > 0) {
      logger.debug('Using GRAFANA_SERVICE_ACCOUNT_TOKEN from environment variable');
      return envToken.trim();
    }
  }

  // 3. Podman token file
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    const podmanTokenPath = '/app/.grafana-token';
    if (fs.existsSync(podmanTokenPath)) {
      const fileToken = (fs.readFileSync(podmanTokenPath, 'utf-8') as string).trim();
      if (fileToken.length > 0) {
        logger.info('Loaded Grafana token from file', { path: podmanTokenPath });
        return fileToken;
      }
    }
  } catch {
    logger.debug('No token file found (expected in Podman)');
  }

  // 4. Kubernetes secret
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    const k8sTokenPath = '/run/secrets/grafana-token';
    if (fs.existsSync(k8sTokenPath)) {
      const secretToken = (fs.readFileSync(k8sTokenPath, 'utf-8') as string).trim();
      if (secretToken.length > 0) {
        logger.info('Loaded Grafana token from Kubernetes secret', { path: k8sTokenPath });
        return secretToken;
      }
    }
  } catch {
    logger.debug('No Kubernetes secret found (expected outside K8s)');
  }

  logger.warn('No Grafana service account token found in config, env, file, or secrets');
  return null;
}

// ---------------------------------------------------------------------------
// Exported configuration object
// ---------------------------------------------------------------------------

/**
 * Build and return the resolved Grafana configuration.
 *
 * This is a function rather than a module-level constant so that
 * configureGrafana() can be called before the config is first read.
 */
export function buildGrafanaConfig() {
  const cfg = getGrafanaConfig();

  return {
    baseUrl: getGrafanaBaseUrl(),
    serviceAccountToken: loadServiceAccountToken(),
    basicAuth: {
      username: cfg.grafanaUser ?? (typeof process !== 'undefined' ? process.env?.GRAFANA_USER ?? 'admin' : 'admin'),
      password: cfg.grafanaPassword ?? (typeof process !== 'undefined' ? process.env?.GRAFANA_PASSWORD ?? 'admin' : 'admin'),
    },
    defaultDashboardUid: cfg.defaultDashboardUid ?? (typeof process !== 'undefined' ? process.env?.GRAFANA_DEFAULT_DASHBOARD_UID ?? 'qa-logging-dashboard' : 'qa-logging-dashboard'),
    timeout: cfg.timeout ?? parseInt(typeof process !== 'undefined' ? process.env?.GRAFANA_TIMEOUT ?? '10000' : '10000', 10),
    isProduction: cfg.nodeEnv === 'production' || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'),
    environment: detectEnvironment(),
    oauthHeaderPrefix: 'X-Auth-Request-',
    enableCaching: cfg.enableCaching ?? (typeof process !== 'undefined' ? process.env?.GRAFANA_ENABLE_CACHING !== 'false' : true),
    cacheTtl: cfg.cacheTtl ?? parseInt(typeof process !== 'undefined' ? process.env?.GRAFANA_CACHE_TTL ?? '300' : '300', 10),
    maxConcurrentRequests: cfg.maxConcurrent ?? parseInt(typeof process !== 'undefined' ? process.env?.GRAFANA_MAX_CONCURRENT ?? '10' : '10', 10),
    lokiUrl: cfg.lokiUrl ?? (typeof process !== 'undefined' ? process.env?.LOKI_URL ?? 'http://loki:3100' : 'http://loki:3100'),
    retry: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
    },
  } as const;
}

/** Convenience re-export for backward compatibility with the original monorepo shape. */
export const grafanaConfig = new Proxy({} as ReturnType<typeof buildGrafanaConfig>, {
  get(_target, prop) {
    return (buildGrafanaConfig() as Record<string | symbol, unknown>)[prop];
  },
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate the current Grafana configuration.
 *
 * This is NOT called automatically at module load (unlike the monorepo version)
 * so that consumers can call configureGrafana() before validation.
 */
export function validateGrafanaConfig(): { valid: boolean; errors: string[] } {
  const logger = getLogger();
  const config = buildGrafanaConfig();
  const errors: string[] = [];

  if (!config.serviceAccountToken) {
    errors.push('GRAFANA_SERVICE_ACCOUNT_TOKEN is not set');
  }
  if (!config.baseUrl) {
    errors.push('GRAFANA_URL could not be determined');
  }

  if (errors.length > 0) {
    logger.error('Grafana configuration validation failed', {
      errors,
      environment: config.environment,
    });

    if (config.environment === 'kubernetes') {
      throw new Error(`Grafana configuration invalid: ${errors.join(', ')}`);
    }

    logger.warn('Grafana will not be available until configuration is fixed', {
      environment: config.environment,
      errors,
    });
  } else {
    logger.info('Grafana configuration validated successfully', {
      baseUrl: config.baseUrl,
      environment: config.environment,
      hasToken: !!config.serviceAccountToken,
      caching: config.enableCaching,
    });
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

/**
 * Type guard to check if Grafana is configured with either service-account
 * token or basic-auth credentials.
 */
export function isGrafanaConfigured(): boolean {
  const config = buildGrafanaConfig();
  const hasServiceToken = !!config.serviceAccountToken;
  const hasBasicAuth = !!(config.basicAuth.username && config.basicAuth.password);
  return !!(config.baseUrl && (hasServiceToken || hasBasicAuth));
}

// ---------------------------------------------------------------------------
// OAuth2 Proxy helper
// ---------------------------------------------------------------------------

/**
 * Extract OAuth2 Proxy user info from request headers (k8s production only).
 */
export function extractOAuthUserInfo(headers: Headers): {
  email: string | null;
  name: string | null;
  groups: string[] | null;
} | null {
  const config = buildGrafanaConfig();

  if (!config.isProduction) {
    return null;
  }

  const email = headers.get(`${config.oauthHeaderPrefix}Email`);
  const name = headers.get(`${config.oauthHeaderPrefix}User`);
  const groupsHeader = headers.get(`${config.oauthHeaderPrefix}Groups`);

  if (!email) {
    return null;
  }

  return {
    email,
    name,
    groups: groupsHeader ? groupsHeader.split(',') : null,
  };
}
