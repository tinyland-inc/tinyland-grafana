





import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureGrafana,
  getGrafanaConfig,
  resetGrafanaConfig,
  defaultLogger,
  getLogger,
} from '../src/config.js';

describe('configureGrafana / getGrafanaConfig / resetGrafanaConfig', () => {
  beforeEach(() => {
    resetGrafanaConfig();
  });

  it('should return an empty config before any calls', () => {
    const cfg = getGrafanaConfig();
    expect(cfg).toEqual({});
  });

  it('should store values supplied via configureGrafana', () => {
    configureGrafana({ grafanaUrl: 'http://grafana:3000', timeout: 5000 });
    const cfg = getGrafanaConfig();
    expect(cfg.grafanaUrl).toBe('http://grafana:3000');
    expect(cfg.timeout).toBe(5000);
  });

  it('should merge subsequent calls without clobbering earlier keys', () => {
    configureGrafana({ grafanaUrl: 'http://grafana:3000' });
    configureGrafana({ grafanaToken: 'tok_abc' });
    const cfg = getGrafanaConfig();
    expect(cfg.grafanaUrl).toBe('http://grafana:3000');
    expect(cfg.grafanaToken).toBe('tok_abc');
  });

  it('should allow later calls to override earlier values', () => {
    configureGrafana({ timeout: 5000 });
    configureGrafana({ timeout: 15000 });
    expect(getGrafanaConfig().timeout).toBe(15000);
  });

  it('should reset to empty state on resetGrafanaConfig', () => {
    configureGrafana({ grafanaUrl: 'http://grafana:3000', grafanaToken: 'tok' });
    resetGrafanaConfig();
    expect(getGrafanaConfig()).toEqual({});
  });

  it('should accept all supported config keys', () => {
    const full = {
      grafanaUrl: 'http://localhost:3000',
      grafanaToken: 'glsa_token',
      grafanaUser: 'admin',
      grafanaPassword: 'secret',
      defaultDashboardUid: 'my-dash',
      timeout: 20000,
      enableCaching: false,
      cacheTtl: 60,
      maxConcurrent: 20,
      nodeEnv: 'production',
      lokiUrl: 'http://loki:3100',
    };
    configureGrafana(full);
    const cfg = getGrafanaConfig();
    expect(cfg).toMatchObject(full);
  });

  it('should accept a custom logger', () => {
    const logs: string[] = [];
    const customLogger = {
      info: (m: string) => logs.push(`INFO: ${m}`),
      warn: (m: string) => logs.push(`WARN: ${m}`),
      error: (m: string) => logs.push(`ERROR: ${m}`),
      debug: (m: string) => logs.push(`DEBUG: ${m}`),
    };
    configureGrafana({ logger: customLogger });
    const logger = getLogger();
    logger.info('hello');
    expect(logs).toContain('INFO: hello');
  });
});

describe('defaultLogger', () => {
  it('should expose info, warn, error, debug methods', () => {
    expect(typeof defaultLogger.info).toBe('function');
    expect(typeof defaultLogger.warn).toBe('function');
    expect(typeof defaultLogger.error).toBe('function');
    expect(typeof defaultLogger.debug).toBe('function');
  });

  it('should not throw when called with context', () => {
    expect(() => defaultLogger.info('test', { key: 'value' })).not.toThrow();
    expect(() => defaultLogger.debug('test')).not.toThrow();
  });
});

describe('getLogger', () => {
  beforeEach(() => {
    resetGrafanaConfig();
  });

  it('should return the default logger when no custom logger is set', () => {
    const logger = getLogger();
    expect(logger).toBe(defaultLogger);
  });

  it('should return the custom logger when one is configured', () => {
    const custom = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };
    configureGrafana({ logger: custom });
    expect(getLogger()).toBe(custom);
  });
});
