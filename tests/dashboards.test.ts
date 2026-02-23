








import { describe, it, expect } from 'vitest';
import {
  a11yMonitoringDashboard,
  securityMonitoringDashboard,
  serviceTopologyDashboard,
  trpcPerformanceDashboard,
} from '../src/index.js';





function expectValidDashboard(
  dashboard: Record<string, unknown>,
  expectedUid: string,
  expectedTitle: string,
  minPanels: number,
) {
  expect(dashboard).toBeDefined();
  expect(typeof dashboard).toBe('object');

  
  expect(dashboard.uid).toBe(expectedUid);
  expect(dashboard.title).toBe(expectedTitle);

  
  expect(Array.isArray(dashboard.tags)).toBe(true);
  expect((dashboard.tags as string[]).length).toBeGreaterThan(0);

  
  expect(Array.isArray(dashboard.panels)).toBe(true);
  expect((dashboard.panels as unknown[]).length).toBeGreaterThanOrEqual(minPanels);

  
  expect(typeof dashboard.schemaVersion).toBe('number');
  expect(dashboard.schemaVersion).toBeGreaterThanOrEqual(38);

  
  expect(dashboard.time).toBeDefined();
  const time = dashboard.time as Record<string, string>;
  expect(time.from).toBeDefined();
  expect(time.to).toBeDefined();
}

function expectValidPanel(panel: Record<string, unknown>) {
  expect(typeof panel.id).toBe('number');
  expect(typeof panel.title).toBe('string');
  expect((panel.title as string).length).toBeGreaterThan(0);
  expect(typeof panel.type).toBe('string');
  expect(panel.gridPos).toBeDefined();

  const gridPos = panel.gridPos as Record<string, number>;
  expect(typeof gridPos.h).toBe('number');
  expect(typeof gridPos.w).toBe('number');
  expect(typeof gridPos.x).toBe('number');
  expect(typeof gridPos.y).toBe('number');
}





describe('a11y-monitoring dashboard', () => {
  it('should have valid structure', () => {
    expectValidDashboard(
      a11yMonitoringDashboard as Record<string, unknown>,
      'phase2-a11y-monitoring',
      'Accessibility Monitoring',
      10,
    );
  });

  it('should include a11y and accessibility tags', () => {
    const tags = (a11yMonitoringDashboard as Record<string, unknown>).tags as string[];
    expect(tags).toContain('a11y');
    expect(tags).toContain('accessibility');
    expect(tags).toContain('traceql');
  });

  it('should have panels with valid structure', () => {
    const panels = (a11yMonitoringDashboard as Record<string, unknown>).panels as Record<string, unknown>[];
    panels.forEach(panel => expectValidPanel(panel));
  });

  it('should have panel IDs that are unique', () => {
    const panels = (a11yMonitoringDashboard as Record<string, unknown>).panels as Record<string, unknown>[];
    const ids = panels.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have the "A11y Violations Over Time" panel', () => {
    const panels = (a11yMonitoringDashboard as Record<string, unknown>).panels as Record<string, unknown>[];
    const violationsPanel = panels.find(p => p.title === 'A11y Violations Over Time');
    expect(violationsPanel).toBeDefined();
    expect(violationsPanel!.type).toBe('timeseries');
  });

  it('should use Tempo datasource for TraceQL queries', () => {
    const panels = (a11yMonitoringDashboard as Record<string, unknown>).panels as Record<string, unknown>[];
    const tempoPanel = panels[0];
    expect(tempoPanel.datasource).toBe('Tempo');
  });
});





describe('security-monitoring dashboard', () => {
  it('should have valid structure', () => {
    expectValidDashboard(
      securityMonitoringDashboard as Record<string, unknown>,
      'phase2-security-monitoring',
      'Security Monitoring',
      3,
    );
  });

  it('should include security and fingerprint tags', () => {
    const tags = (securityMonitoringDashboard as Record<string, unknown>).tags as string[];
    expect(tags).toContain('security');
    expect(tags).toContain('fingerprint');
  });

  it('should have panels with valid structure', () => {
    const panels = (securityMonitoringDashboard as Record<string, unknown>).panels as Record<string, unknown>[];
    panels.forEach(panel => expectValidPanel(panel));
  });

  it('should have the "High-Risk Sessions" panel', () => {
    const panels = (securityMonitoringDashboard as Record<string, unknown>).panels as Record<string, unknown>[];
    const riskPanel = panels.find(p => (p.title as string).includes('High-Risk Sessions'));
    expect(riskPanel).toBeDefined();
    expect(riskPanel!.type).toBe('table');
  });

  it('should have the "Impossible Travel Alerts" panel', () => {
    const panels = (securityMonitoringDashboard as Record<string, unknown>).panels as Record<string, unknown>[];
    const travelPanel = panels.find(p => (p.title as string).includes('Impossible Travel'));
    expect(travelPanel).toBeDefined();
  });
});





describe('service-topology dashboard', () => {
  it('should have valid structure', () => {
    expectValidDashboard(
      serviceTopologyDashboard as Record<string, unknown>,
      'phase2-service-topology',
      'Service Topology & Dependencies',
      3,
    );
  });

  it('should include topology and service-graph tags', () => {
    const tags = (serviceTopologyDashboard as Record<string, unknown>).tags as string[];
    expect(tags).toContain('topology');
    expect(tags).toContain('service-graph');
  });

  it('should have a nodeGraph panel for service call graph', () => {
    const panels = (serviceTopologyDashboard as Record<string, unknown>).panels as Record<string, unknown>[];
    const graphPanel = panels.find(p => p.type === 'nodeGraph');
    expect(graphPanel).toBeDefined();
    expect(graphPanel!.title).toContain('Service Call Graph');
  });

  it('should have a heatmap panel for latency distribution', () => {
    const panels = (serviceTopologyDashboard as Record<string, unknown>).panels as Record<string, unknown>[];
    const heatmap = panels.find(p => p.type === 'heatmap');
    expect(heatmap).toBeDefined();
  });
});





describe('trpc-performance dashboard', () => {
  it('should have valid structure', () => {
    expectValidDashboard(
      trpcPerformanceDashboard as Record<string, unknown>,
      'phase2-trpc-performance',
      'tRPC Performance Monitoring',
      3,
    );
  });

  it('should include trpc and performance tags', () => {
    const tags = (trpcPerformanceDashboard as Record<string, unknown>).tags as string[];
    expect(tags).toContain('trpc');
    expect(tags).toContain('performance');
  });

  it('should have the "Slow Mutations" panel', () => {
    const panels = (trpcPerformanceDashboard as Record<string, unknown>).panels as Record<string, unknown>[];
    const slowPanel = panels.find(p => (p.title as string).includes('Slow Mutations'));
    expect(slowPanel).toBeDefined();
    expect(slowPanel!.type).toBe('histogram');
  });

  it('should have the "Procedure Call Distribution" pie chart', () => {
    const panels = (trpcPerformanceDashboard as Record<string, unknown>).panels as Record<string, unknown>[];
    const piePanel = panels.find(p => p.type === 'piechart');
    expect(piePanel).toBeDefined();
  });

  it('should have the "tRPC Error Rate" panel', () => {
    const panels = (trpcPerformanceDashboard as Record<string, unknown>).panels as Record<string, unknown>[];
    const errorPanel = panels.find(p => (p.title as string).includes('Error Rate'));
    expect(errorPanel).toBeDefined();
  });
});





describe('cross-dashboard validation', () => {
  it('all dashboards should have unique UIDs', () => {
    const uids = [
      (a11yMonitoringDashboard as Record<string, unknown>).uid,
      (securityMonitoringDashboard as Record<string, unknown>).uid,
      (serviceTopologyDashboard as Record<string, unknown>).uid,
      (trpcPerformanceDashboard as Record<string, unknown>).uid,
    ];
    expect(new Set(uids).size).toBe(4);
  });

  it('all dashboards should use TraceQL queries', () => {
    const dashboards = [
      a11yMonitoringDashboard,
      securityMonitoringDashboard,
      serviceTopologyDashboard,
      trpcPerformanceDashboard,
    ] as Array<Record<string, unknown>>;

    for (const dashboard of dashboards) {
      const tags = dashboard.tags as string[];
      expect(tags).toContain('traceql');
    }
  });

  it('all dashboards should have a refresh interval set', () => {
    const dashboards = [
      a11yMonitoringDashboard,
      securityMonitoringDashboard,
      serviceTopologyDashboard,
      trpcPerformanceDashboard,
    ] as Array<Record<string, unknown>>;

    for (const dashboard of dashboards) {
      expect(dashboard.refresh).toBeDefined();
      expect(typeof dashboard.refresh).toBe('string');
    }
  });
});
