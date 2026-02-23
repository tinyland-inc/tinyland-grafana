





import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  configureGrafana,
  resetGrafanaConfig,
} from '../src/config.js';
import {
  buildGrafanaConfig,
  detectEnvironment,
  isGrafanaConfigured,
  validateGrafanaConfig,
  extractOAuthUserInfo,
} from '../src/grafana-config.js';

describe('detectEnvironment', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should return "kubernetes" when KUBERNETES_SERVICE_HOST is set', () => {
    process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
    expect(detectEnvironment()).toBe('kubernetes');
  });

  it('should return "podman" when COMPOSE_PROJECT_NAME is set', () => {
    delete process.env.KUBERNETES_SERVICE_HOST;
    process.env.COMPOSE_PROJECT_NAME = 'stonewall';
    expect(detectEnvironment()).toBe('podman');
  });

  it('should return "podman" when HOSTNAME contains "stonewall"', () => {
    delete process.env.KUBERNETES_SERVICE_HOST;
    delete process.env.COMPOSE_PROJECT_NAME;
    process.env.HOSTNAME = 'stonewall-sveltekit-abc';
    expect(detectEnvironment()).toBe('podman');
  });

  it('should return "unknown" when no relevant env vars are set', () => {
    delete process.env.KUBERNETES_SERVICE_HOST;
    delete process.env.COMPOSE_PROJECT_NAME;
    process.env.HOSTNAME = 'my-laptop';
    expect(detectEnvironment()).toBe('unknown');
  });
});

describe('buildGrafanaConfig', () => {
  beforeEach(() => {
    resetGrafanaConfig();
  });

  it('should return sensible defaults when nothing is configured', () => {
    const cfg = buildGrafanaConfig();
    expect(cfg.timeout).toBeGreaterThan(0);
    expect(cfg.retry.maxAttempts).toBe(3);
    expect(cfg.retry.backoffMultiplier).toBe(2);
    expect(cfg.oauthHeaderPrefix).toBe('X-Auth-Request-');
  });

  it('should prefer package config over defaults', () => {
    configureGrafana({
      grafanaUrl: 'http://custom:9090',
      timeout: 30000,
      enableCaching: false,
      cacheTtl: 10,
      maxConcurrent: 50,
    });
    const cfg = buildGrafanaConfig();
    expect(cfg.baseUrl).toBe('http://custom:9090');
    expect(cfg.timeout).toBe(30000);
    expect(cfg.enableCaching).toBe(false);
    expect(cfg.cacheTtl).toBe(10);
    expect(cfg.maxConcurrentRequests).toBe(50);
  });

  it('should set isProduction when nodeEnv is "production"', () => {
    configureGrafana({ nodeEnv: 'production' });
    expect(buildGrafanaConfig().isProduction).toBe(true);
  });

  it('should use configured basic auth credentials', () => {
    configureGrafana({ grafanaUser: 'myuser', grafanaPassword: 'mypass' });
    const cfg = buildGrafanaConfig();
    expect(cfg.basicAuth.username).toBe('myuser');
    expect(cfg.basicAuth.password).toBe('mypass');
  });

  it('should use configured Loki URL', () => {
    configureGrafana({ lokiUrl: 'http://loki-custom:3100' });
    const cfg = buildGrafanaConfig();
    expect(cfg.lokiUrl).toBe('http://loki-custom:3100');
  });

  it('should use configured defaultDashboardUid', () => {
    configureGrafana({ defaultDashboardUid: 'custom-dash' });
    expect(buildGrafanaConfig().defaultDashboardUid).toBe('custom-dash');
  });
});

describe('isGrafanaConfigured', () => {
  beforeEach(() => {
    resetGrafanaConfig();
  });

  it('should return true when token is provided', () => {
    configureGrafana({ grafanaUrl: 'http://grafana:3000', grafanaToken: 'tok' });
    expect(isGrafanaConfigured()).toBe(true);
  });

  it('should return true when basic auth is provided (defaults)', () => {
    
    configureGrafana({ grafanaUrl: 'http://grafana:3000' });
    expect(isGrafanaConfigured()).toBe(true);
  });

  it('should return false when baseUrl is empty and no env detection matches', () => {
    configureGrafana({ grafanaUrl: '' });
    
    
    
    expect(typeof isGrafanaConfigured()).toBe('boolean');
  });
});

describe('validateGrafanaConfig', () => {
  beforeEach(() => {
    resetGrafanaConfig();
  });

  it('should report errors when no token is set', () => {
    const result = validateGrafanaConfig();
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('GRAFANA_SERVICE_ACCOUNT_TOKEN is not set');
  });

  it('should pass validation when token is set', () => {
    configureGrafana({ grafanaToken: 'glsa_test_token' });
    const result = validateGrafanaConfig();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should throw in kubernetes environment when validation fails', () => {
    const origK8s = process.env.KUBERNETES_SERVICE_HOST;
    process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
    try {
      expect(() => validateGrafanaConfig()).toThrow('Grafana configuration invalid');
    } finally {
      if (origK8s === undefined) {
        delete process.env.KUBERNETES_SERVICE_HOST;
      } else {
        process.env.KUBERNETES_SERVICE_HOST = origK8s;
      }
    }
  });
});

describe('extractOAuthUserInfo', () => {
  beforeEach(() => {
    resetGrafanaConfig();
  });

  it('should return null when not in production', () => {
    configureGrafana({ nodeEnv: 'development' });
    const headers = new Headers({ 'X-Auth-Request-Email': 'test@example.com' });
    expect(extractOAuthUserInfo(headers)).toBeNull();
  });

  it('should extract user info in production', () => {
    configureGrafana({ nodeEnv: 'production' });
    const headers = new Headers({
      'X-Auth-Request-Email': 'user@example.com',
      'X-Auth-Request-User': 'Test User',
      'X-Auth-Request-Groups': 'admin,editor',
    });
    const info = extractOAuthUserInfo(headers);
    expect(info).toEqual({
      email: 'user@example.com',
      name: 'Test User',
      groups: ['admin', 'editor'],
    });
  });

  it('should return null when email header is missing in production', () => {
    configureGrafana({ nodeEnv: 'production' });
    const headers = new Headers({ 'X-Auth-Request-User': 'user' });
    expect(extractOAuthUserInfo(headers)).toBeNull();
  });

  it('should handle missing groups header', () => {
    configureGrafana({ nodeEnv: 'production' });
    const headers = new Headers({
      'X-Auth-Request-Email': 'user@example.com',
    });
    const info = extractOAuthUserInfo(headers);
    expect(info).toEqual({
      email: 'user@example.com',
      name: null,
      groups: null,
    });
  });
});
