














export interface GrafanaLogger {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
}







export interface GrafanaPackageConfig {
  
  grafanaUrl?: string;
  
  grafanaToken?: string;
  
  grafanaUser?: string;
  
  grafanaPassword?: string;
  
  defaultDashboardUid?: string;
  
  timeout?: number;
  
  enableCaching?: boolean;
  
  cacheTtl?: number;
  
  maxConcurrent?: number;
  
  nodeEnv?: string;
  
  lokiUrl?: string;
  
  logger?: GrafanaLogger;
}


let _config: GrafanaPackageConfig = {};





export function configureGrafana(config: GrafanaPackageConfig): void {
  _config = { ..._config, ...config };
}




export function getGrafanaConfig(): GrafanaPackageConfig {
  return _config;
}




export function resetGrafanaConfig(): void {
  _config = {};
}




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




export function getLogger(): GrafanaLogger {
  return _config.logger ?? defaultLogger;
}
