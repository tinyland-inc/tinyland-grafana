/**
 * Package-level configuration injection for @tummycrypt/tinyland-grafana.
 *
 * Consumers call configureGrafana() at startup to supply environment-specific
 * values (URLs, tokens, timeouts) without coupling to SvelteKit's $env or
 * process.env directly.
 *
 * @module config
 */

/**
 * Logger interface matching the subset used throughout this package.
 * Consumers can supply any logger that satisfies this shape (e.g. pino, winston,
 * or the default console-based fallback).
 */
export interface GrafanaLogger {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
}

/**
 * Configuration object accepted by configureGrafana().
 *
 * All fields are optional -- unset fields fall back to sensible defaults
 * defined in grafana-config.ts and client.ts.
 */
export interface GrafanaPackageConfig {
  /** Grafana base URL (e.g. "http://stonewall-grafana:3000") */
  grafanaUrl?: string;
  /** Service account bearer token for Grafana API */
  grafanaToken?: string;
  /** Basic-auth username (fallback when token is absent) */
  grafanaUser?: string;
  /** Basic-auth password */
  grafanaPassword?: string;
  /** Default dashboard UID for QA logging */
  defaultDashboardUid?: string;
  /** HTTP request timeout in milliseconds */
  timeout?: number;
  /** Enable API response caching */
  enableCaching?: boolean;
  /** Cache TTL in seconds */
  cacheTtl?: number;
  /** Maximum concurrent requests to Grafana API */
  maxConcurrent?: number;
  /** Node environment string (e.g. "production", "development") */
  nodeEnv?: string;
  /** Loki base URL for direct log queries */
  lokiUrl?: string;
  /** Pluggable logger */
  logger?: GrafanaLogger;
}

/** Internal mutable config store */
let _config: GrafanaPackageConfig = {};

/**
 * Merge caller-supplied configuration into the package config.
 * Can be called multiple times; later calls merge on top of earlier ones.
 */
export function configureGrafana(config: GrafanaPackageConfig): void {
  _config = { ..._config, ...config };
}

/**
 * Retrieve the current resolved configuration.
 */
export function getGrafanaConfig(): GrafanaPackageConfig {
  return _config;
}

/**
 * Reset configuration to an empty state. Useful in tests.
 */
export function resetGrafanaConfig(): void {
  _config = {};
}

/**
 * Default console-based logger used when the consumer does not supply one.
 */
export const defaultLogger: GrafanaLogger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    console.log(`[DEBUG] ${message}`, context ?? ''),
  info: (message: string, context?: Record<string, unknown>) =>
    console.log(`[INFO] ${message}`, context ?? ''),
  warn: (message: string, context?: Record<string, unknown>) =>
    console.warn(`[WARN] ${message}`, context ?? ''),
  error: (message: string, context?: Record<string, unknown>) =>
    console.error(`[ERROR] ${message}`, context ?? ''),
};

/**
 * Return the configured logger, falling back to the default console logger.
 */
export function getLogger(): GrafanaLogger {
  return _config.logger ?? defaultLogger;
}
