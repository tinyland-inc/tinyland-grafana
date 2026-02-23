












import { getLogger } from './config.js';
import {
  buildGrafanaConfig,
  isGrafanaConfigured,
  type TimeRange,
} from './grafana-config.js';








export interface GrafanaDashboard {
  uid: string;
  title: string;
  tags: string[];
  url: string;
  folderId?: number;
  folderTitle?: string;
}




export interface GrafanaPanelData {
  panelId: number;
  title: string;
  type: string;
  timeRange: TimeRange;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
    }>;
  };
  rawData?: Array<{
    timestamp: string;
    values: Record<string, unknown>;
  }>;
}




export interface GrafanaDataSource {
  id: number;
  uid: string;
  name: string;
  type: string;
  url: string;
  isDefault: boolean;
}




export interface RequestContext {
  fingerprintId?: string | null;
  sessionId?: string | null;
  userId?: string | null;
}








class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  tryConsume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  async waitForToken(): Promise<void> {
    while (!this.tryConsume()) {
      const tokensNeeded = 1 - this.tokens;
      const waitMs = (tokensNeeded / this.refillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, Math.max(waitMs, 100)));
    }
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  
  getTokenCount(): number {
    this.refill();
    return this.tokens;
  }
}













export function parseTimeRange(from: string, to: string, now: number): { start: number; end: number } {
  const logger = getLogger();

  const parseTime = (timeStr: string, isEnd: boolean): number => {
    if (timeStr === 'now') {
      return now;
    }

    const relativeMatch = timeStr.match(/^now-(\d+)(m|h|d|w|M|y)$/);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2];
      const multipliers: Record<string, number> = {
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000,
        'w': 7 * 24 * 60 * 60 * 1000,
        'M': 30 * 24 * 60 * 60 * 1000,
        'y': 365 * 24 * 60 * 60 * 1000,
      };
      return now - (amount * multipliers[unit]);
    }

    const timestamp = Date.parse(timeStr);
    if (!isNaN(timestamp)) {
      return timestamp;
    }

    logger.warn('Failed to parse time range, using defaults', { timeStr, isEnd });
    return isEnd ? now : now - 3600000;
  };

  return {
    start: parseTime(from, false),
    end: parseTime(to, true),
  };
}




export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  } else if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h`;
  } else {
    return `${Math.floor(seconds / 86400)}d`;
  }
}




export function calculateInterval(rangeSeconds: number): string {
  if (rangeSeconds < 3600) {
    return '30s';
  } else if (rangeSeconds < 6 * 3600) {
    return '1m';
  } else if (rangeSeconds < 24 * 3600) {
    return '5m';
  } else if (rangeSeconds < 7 * 24 * 3600) {
    return '30m';
  } else {
    return '1h';
  }
}




export function extractRawData(
  lokiData: { data?: { result?: Array<{ stream?: Record<string, unknown>; values?: Array<[string, string]> }> } },
  panelType: string,
): Array<{ timestamp: string; values: Record<string, unknown> }> | undefined {
  if (panelType !== 'table' && panelType !== 'stat') {
    return undefined;
  }

  if (!lokiData.data?.result || lokiData.data.result.length === 0) {
    return [];
  }

  const rawEntries: Array<{ timestamp: string; values: Record<string, unknown> }> = [];

  for (const stream of lokiData.data.result) {
    const streamLabels = stream.stream || {};
    const values = stream.values || [];

    for (const [timestamp, logLine] of values) {
      try {
        const parsed = JSON.parse(logLine);
        rawEntries.push({
          timestamp: new Date(parseInt(timestamp) / 1000000).toISOString(),
          values: { ...streamLabels, ...parsed },
        });
      } catch {
        rawEntries.push({
          timestamp: new Date(parseInt(timestamp) / 1000000).toISOString(),
          values: { ...streamLabels, message: logLine },
        });
      }
    }
  }

  return rawEntries;
}








export class GrafanaClient {
  private readonly baseUrl: string;
  private readonly token: string | null;
  private readonly basicAuth: { username: string; password: string } | null;
  private readonly timeout: number;
  private readonly rateLimiter: RateLimiter;
  private readonly lokiUrl: string;
  private readonly retryConfig: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };

  constructor() {
    if (!isGrafanaConfigured()) {
      throw new Error(
        'Grafana is not configured. Call configureGrafana() or set GRAFANA_SERVICE_ACCOUNT_TOKEN / GRAFANA_USER+GRAFANA_PASSWORD environment variables.',
      );
    }

    const config = buildGrafanaConfig();
    const logger = getLogger();

    this.baseUrl = config.baseUrl;
    this.token = config.serviceAccountToken;
    this.basicAuth = !this.token ? config.basicAuth : null;
    this.timeout = config.timeout;
    this.lokiUrl = config.lokiUrl;
    this.retryConfig = { ...config.retry };

    this.rateLimiter = new RateLimiter(
      config.maxConcurrentRequests,
      5,
    );

    logger.info('Grafana client initialized', {
      baseUrl: this.baseUrl,
      environment: config.environment,
      timeout: this.timeout,
      hasToken: !!this.token,
      hasBasicAuth: !!this.basicAuth,
      authMethod: this.token ? 'service_account' : 'basic_auth',
    });
  }

  
  
  

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    context?: RequestContext,
    attempt: number = 1,
  ): Promise<T> {
    const logger = getLogger();

    await this.rateLimiter.waitForToken();

    const url = `${this.baseUrl}/api${endpoint}`;
    const startTime = Date.now();

    const headers = new Headers(options.headers);
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    } else if (this.basicAuth) {
      const basicAuthStr = Buffer.from(
        `${this.basicAuth.username}:${this.basicAuth.password}`,
      ).toString('base64');
      headers.set('Authorization', `Basic ${basicAuthStr}`);
    }
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');

    logger.debug('Grafana API request', {
      method: (options.method || 'GET') as string,
      endpoint,
      url,
      attempt,
      maxAttempts: this.retryConfig.maxAttempts,
      fingerprintId: context?.fingerprintId ?? undefined,
      sessionId: context?.sessionId ?? undefined,
      userId: context?.userId ?? undefined,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Grafana API error response', {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          duration,
          attempt,
          fingerprintId: context?.fingerprintId ?? undefined,
          sessionId: context?.sessionId ?? undefined,
        });

        if (
          (response.status >= 500 || response.status === 429) &&
          attempt < this.retryConfig.maxAttempts
        ) {
          const delay = this.calculateBackoff(attempt);
          logger.warn('Retrying Grafana API request', {
            endpoint,
            attempt,
            nextAttempt: attempt + 1,
            delayMs: delay,
            status: response.status,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.request<T>(endpoint, options, context, attempt + 1);
        }

        throw new Error(
          `Grafana API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = (await response.json()) as T;

      logger.info('Grafana API request successful', {
        endpoint,
        status: response.status,
        duration,
        attempt,
        fingerprintId: context?.fingerprintId ?? undefined,
        sessionId: context?.sessionId ?? undefined,
      });

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('Grafana API request timeout', {
          endpoint,
          timeout: this.timeout,
          attempt,
          fingerprintId: context?.fingerprintId ?? undefined,
        });

        if (attempt < this.retryConfig.maxAttempts) {
          const delay = this.calculateBackoff(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.request<T>(endpoint, options, context, attempt + 1);
        }

        throw new Error(`Grafana API timeout after ${attempt} attempts`);
      }

      logger.error('Grafana API request failed', {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
        duration,
        attempt,
        fingerprintId: context?.fingerprintId ?? undefined,
      });

      throw error;
    }
  }

  private calculateBackoff(attempt: number): number {
    const delay =
      this.retryConfig.initialDelay *
      Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  
  
  

  


  async getDashboard(uid: string, context?: RequestContext): Promise<GrafanaDashboard> {
    const logger = getLogger();
    logger.info('Fetching Grafana dashboard', {
      dashboardUid: uid,
      fingerprintId: context?.fingerprintId ?? undefined,
      sessionId: context?.sessionId ?? undefined,
    });

    const response = await this.request<{
      dashboard: { uid: string; title: string; tags: string[] };
      meta: { url: string; folderId?: number; folderTitle?: string };
    }>(`/dashboards/uid/${uid}`, {}, context);

    return {
      uid: response.dashboard.uid,
      title: response.dashboard.title,
      tags: response.dashboard.tags || [],
      url: response.meta.url,
      folderId: response.meta.folderId,
      folderTitle: response.meta.folderTitle,
    };
  }

  





  async queryPanel(
    dashboardUid: string,
    panelId: number,
    timeRange: TimeRange,
    context?: RequestContext,
  ): Promise<GrafanaPanelData> {
    const logger = getLogger();

    logger.info('Querying Loki panel data directly', {
      dashboardUid,
      panelId,
      timeRange,
      fingerprintId: context?.fingerprintId ?? undefined,
      sessionId: context?.sessionId ?? undefined,
    });

    const dashboard = await this.request<{
      dashboard: {
        panels: Array<{
          id: number;
          title: string;
          type?: string;
          targets: Array<{ expr?: string; refId: string }>;
        }>;
      };
    }>(`/dashboards/uid/${dashboardUid}`, {}, context);

    const panel = dashboard.dashboard.panels?.find(p => p.id === panelId);
    if (!panel) {
      throw new Error(`Panel ${panelId} not found in dashboard ${dashboardUid}`);
    }

    const logqlQuery = panel.targets?.[0]?.expr;
    if (!logqlQuery) {
      logger.warn('No query found for panel', { panelId, title: panel.title });
      return {
        panelId,
        title: panel.title,
        type: panel.type || 'timeseries',
        timeRange,
        data: { labels: [], datasets: [] },
      };
    }

    const now = Date.now();
    const { start, end } = parseTimeRange(timeRange.from, timeRange.to, now);
    const rangeSeconds = Math.floor((end - start) / 1000);
    const rangeStr = formatDuration(rangeSeconds);
    const intervalStr = calculateInterval(rangeSeconds);

    const processedQuery = logqlQuery
      .replace(/\$__range/g, rangeStr)
      .replace(/\$__interval/g, intervalStr);

    const lokiPath = `/loki/api/v1/query_range?query=${encodeURIComponent(processedQuery)}&start=${start * 1000000}&end=${end * 1000000}&limit=1000`;

    logger.debug('Querying Loki', {
      originalQuery: logqlQuery,
      processedQuery,
      lokiPath,
      timeRange,
      rangeStr,
      intervalStr,
      start,
      end,
    });

    const lokiResponse = await fetch(`${this.lokiUrl}${lokiPath}`);
    if (!lokiResponse.ok) {
      const errorText = await lokiResponse.text();
      logger.error('Loki query failed', {
        status: lokiResponse.status,
        statusText: lokiResponse.statusText,
        error: errorText,
        url: `${this.lokiUrl}${lokiPath}`,
      });
      throw new Error(`Loki query failed: ${lokiResponse.statusText}`);
    }

    const lokiData = await lokiResponse.json();

    const labels: string[] = [];
    const datasets: Array<{ label: string; data: number[] }> = [];

    if (lokiData.data?.result && lokiData.data.result.length > 0) {
      if (panel.type === 'timeseries' || panel.type === 'graph') {
        for (const stream of lokiData.data.result) {
          const dataPoints = stream.values || [];
          const chartLabels: string[] = [];
          const chartData: number[] = [];

          dataPoints.forEach(([timestamp, value]: [string, string]) => {
            const ts = parseInt(timestamp);
            let dateMs: number;
            if (ts > 1e15) {
              dateMs = ts / 1_000_000;
            } else if (ts > 1e12) {
              dateMs = ts;
            } else {
              dateMs = ts * 1000;
            }

            const date = new Date(dateMs);
            if (date.getFullYear() < 2020 || date.getFullYear() > 2030) {
              logger.warn('Timestamp out of reasonable range', {
                timestamp,
                dateMs,
                date: date.toISOString(),
                panelId,
                panelTitle: panel.title,
              });
            }

            chartLabels.push(date.toLocaleTimeString());
            chartData.push(parseFloat(value) || 0);
          });

          labels.push(...chartLabels);
          datasets.push({
            label: stream.stream?.component || panel.title,
            data: chartData,
          });
        }
      } else {
        const count = lokiData.data.result.reduce(
          (acc: number, stream: { values?: unknown[] }) => acc + (stream.values?.length || 0),
          0,
        );
        labels.push(panel.title);
        datasets.push({ label: panel.title, data: [count] });
      }
    }

    const rawData = extractRawData(lokiData, panel.type || 'timeseries');

    logger.info('Panel data transformed', {
      panelId,
      title: panel.title,
      type: panel.type,
      labelCount: labels.length,
      datasetCount: datasets.length,
      rawDataCount: rawData?.length || 0,
      lokiResultCount: lokiData.data?.result?.length || 0,
    });

    return {
      panelId,
      title: panel.title,
      type: panel.type || 'timeseries',
      timeRange,
      data: {
        labels: labels.length > 0 ? labels : ['No data'],
        datasets: datasets.length > 0 ? datasets : [{ label: 'No data', data: [0] }],
      },
      rawData,
    };
  }

  


  async getDatasources(context?: RequestContext): Promise<GrafanaDataSource[]> {
    const logger = getLogger();
    logger.info('Fetching Grafana data sources', {
      fingerprintId: context?.fingerprintId ?? undefined,
      sessionId: context?.sessionId ?? undefined,
    });

    const datasources = await this.request<
      Array<{
        id: number;
        uid: string;
        name: string;
        type: string;
        url: string;
        isDefault: boolean;
      }>
    >('/datasources', {}, context);

    return datasources.map(ds => ({
      id: ds.id,
      uid: ds.uid,
      name: ds.name,
      type: ds.type,
      url: ds.url,
      isDefault: ds.isDefault,
    }));
  }

  


  async searchDashboards(
    query?: string,
    tags?: string[],
    context?: RequestContext,
  ): Promise<GrafanaDashboard[]> {
    const logger = getLogger();
    logger.info('Searching Grafana dashboards', {
      query,
      tags,
      fingerprintId: context?.fingerprintId ?? undefined,
      sessionId: context?.sessionId ?? undefined,
    });

    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (tags?.length) params.set('tag', tags.join(','));
    params.set('type', 'dash-db');

    const endpoint = `/search?${params.toString()}`;

    const results = await this.request<
      Array<{
        uid: string;
        title: string;
        tags: string[];
        url: string;
        folderId?: number;
        folderTitle?: string;
      }>
    >(endpoint, {}, context);

    return results.map(r => ({
      uid: r.uid,
      title: r.title,
      tags: r.tags || [],
      url: r.url,
      folderId: r.folderId,
      folderTitle: r.folderTitle,
    }));
  }

  


  async healthCheck(context?: RequestContext): Promise<{ ok: boolean; version: string }> {
    const logger = getLogger();
    logger.debug('Grafana health check', {
      fingerprintId: context?.fingerprintId ?? undefined,
    });

    try {
      const response = await this.request<{ version: string }>('/health', {}, context);
      logger.info('Grafana health check successful', {
        version: response.version,
        fingerprintId: context?.fingerprintId ?? undefined,
      });
      return { ok: true, version: response.version };
    } catch (error) {
      logger.error('Grafana health check failed', {
        error: error instanceof Error ? error.message : String(error),
        fingerprintId: context?.fingerprintId ?? undefined,
      });
      return { ok: false, version: 'unknown' };
    }
  }
}











export async function getGeographicCityBreakdown(
  timeRange: TimeRange,
  topN: number = 10,
  context?: RequestContext,
): Promise<{
  cityBreakdown: Record<string, number>;
  totalCities: number;
  totalUniqueVisitors: number;
}> {
  const logger = getLogger();
  const config = buildGrafanaConfig();

  try {
    logger.info('Fetching geographic city breakdown with fingerprint deduplication', {
      timeRange,
      topN,
      fingerprintId: context?.fingerprintId ?? undefined,
    });

    const now = Date.now();
    const { start, end } = parseTimeRange(timeRange.from, timeRange.to, now);

    const lokiUrl = config.lokiUrl;
    const query = `{job="stonewall-observability"} | json | component="fingerprint-enrichment" | geo_city != ""`;
    const lokiPath = `/loki/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start * 1000000}&end=${end * 1000000}&limit=5000`;

    logger.debug('Querying Loki for geographic data', {
      query,
      start,
      end,
      url: `${lokiUrl}${lokiPath}`,
    });

    const lokiResponse = await fetch(`${lokiUrl}${lokiPath}`);
    if (!lokiResponse.ok) {
      const errorText = await lokiResponse.text();
      logger.error('Loki geographic query failed', {
        status: lokiResponse.status,
        statusText: lokiResponse.statusText,
        error: errorText,
      });
      throw new Error(`Loki geographic query failed: ${lokiResponse.statusText}`);
    }

    const lokiData = await lokiResponse.json();
    const cityFingerprints = new Map<string, Set<string>>();

    lokiData.data.result.forEach(
      (stream: { metric?: Record<string, string>; stream?: Record<string, string>; values?: Array<[string, string]> }) => {
        const city = stream.metric?.geo_city || stream.stream?.geo_city || 'Unknown';

        stream.values?.forEach(([_timestamp, logLine]: [string, string]) => {
          try {
            const parsed = JSON.parse(logLine);
            const fingerprintId = parsed.fingerprint_id;
            if (!fingerprintId) return;

            if (!cityFingerprints.has(city)) {
              cityFingerprints.set(city, new Set());
            }
            cityFingerprints.get(city)!.add(fingerprintId);
          } catch (error) {
            logger.warn('Failed to parse log line for fingerprint', {
              error: error instanceof Error ? error.message : String(error),
              logLine: logLine.substring(0, 100),
            });
          }
        });
      },
    );

    const cityBreakdown: Record<string, number> = {};
    cityFingerprints.forEach((fingerprints, city) => {
      cityBreakdown[city] = fingerprints.size;
    });

    const topCities = Object.entries(cityBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .reduce(
        (acc, [city, count]) => {
          acc[city] = count;
          return acc;
        },
        {} as Record<string, number>,
      );

    const totalUniqueVisitors = Array.from(cityFingerprints.values()).reduce(
      (sum, set) => sum + set.size,
      0,
    );

    logger.info('Geographic breakdown computed', {
      totalCities: cityFingerprints.size,
      topCityCount: Object.keys(topCities).length,
      totalUniqueVisitors,
    });

    return {
      cityBreakdown: topCities,
      totalCities: cityFingerprints.size,
      totalUniqueVisitors,
    };
  } catch (error) {
    logger.error('Failed to get geographic city breakdown', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { cityBreakdown: {}, totalCities: 0, totalUniqueVisitors: 0 };
  }
}





let grafanaClient: GrafanaClient | null = null;




export function getGrafanaClient(): GrafanaClient {
  if (!grafanaClient) {
    grafanaClient = new GrafanaClient();
  }
  return grafanaClient;
}




export function resetGrafanaClient(): void {
  grafanaClient = null;
}
