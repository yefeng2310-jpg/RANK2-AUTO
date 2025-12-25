export enum JobStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PAUSED = 'PAUSED'
}

export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SYSTEM = 'SYSTEM'
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  step?: string;
  hasScreenshot?: boolean; // Indicates if a screenshot is available for this log
}

export interface CatalogItem {
  id: string;
  name: string;
  price: number;
  category: string;
  status: string;
  [key: string]: any; // Allow flexible columns from CSV
}

export type SimulationScenario = 'SUCCESS' | 'ERROR_VPN' | 'ERROR_AUTH' | 'ERROR_UPLOAD';

export interface AutomationConfig {
  username: string;
  batchSize: number; // For splitting large datasets
  targetEnv: 'PROD' | 'STAGING';
  simulationScenario: SimulationScenario;
}

export interface JobStats {
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  errorCount: number;
  batchesTotal: number;
  batchesCompleted: number;
}

// --- Electron Bridge Types ---

export interface ElectronAPI {
  startJob: (payload: { config: AutomationConfig; password: string; data: CatalogItem[] }) => void;
  stopJob: () => void;
  onLog: (callback: (log: LogEntry) => void) => void;
  onStatsUpdate: (callback: (stats: Partial<JobStats>) => void) => void;
  onStatusChange: (callback: (status: JobStatus) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}