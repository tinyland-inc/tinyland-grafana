/**
 * @tinyland-inc/tinyland-grafana
 *
 * Grafana API client, configuration, and dashboard definitions
 * for Tinyland observability.
 *
 * @module @tinyland-inc/tinyland-grafana
 */

// ---------------------------------------------------------------------------
// Package-level configuration
// ---------------------------------------------------------------------------
export {
  configureGrafana,
  getGrafanaConfig,
  resetGrafanaConfig,
  defaultLogger,
  getLogger,
} from './config.js';

export type {
  GrafanaPackageConfig,
  GrafanaLogger,
} from './config.js';

// ---------------------------------------------------------------------------
// Grafana configuration (environment detection, validation, OAuth helpers)
// ---------------------------------------------------------------------------
export {
  grafanaConfig,
  buildGrafanaConfig,
  isGrafanaConfigured,
  validateGrafanaConfig,
  detectEnvironment,
  extractOAuthUserInfo,
} from './grafana-config.js';

export type {
  TimeRange,
  PanelReference,
} from './grafana-config.js';

// ---------------------------------------------------------------------------
// Grafana HTTP client
// ---------------------------------------------------------------------------
export {
  GrafanaClient,
  getGrafanaClient,
  resetGrafanaClient,
  getGeographicCityBreakdown,
  // Time-range helpers (useful for consumers and testing)
  parseTimeRange,
  formatDuration,
  calculateInterval,
  extractRawData,
} from './client.js';

export type {
  GrafanaDashboard,
  GrafanaPanelData,
  GrafanaDataSource,
  RequestContext,
} from './client.js';

// ---------------------------------------------------------------------------
// Dashboard JSON definitions
// ---------------------------------------------------------------------------
import _a11yMonitoringDashboard from './dashboards/a11y-monitoring.json';
import _securityMonitoringDashboard from './dashboards/security-monitoring.json';
import _serviceTopologyDashboard from './dashboards/service-topology.json';
import _trpcPerformanceDashboard from './dashboards/trpc-performance.json';

export const a11yMonitoringDashboard = _a11yMonitoringDashboard;
export const securityMonitoringDashboard = _securityMonitoringDashboard;
export const serviceTopologyDashboard = _serviceTopologyDashboard;
export const trpcPerformanceDashboard = _trpcPerformanceDashboard;
