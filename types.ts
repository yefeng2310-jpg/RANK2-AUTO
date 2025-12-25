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

export interface AutomationConfig {
  username: string;
  batchSize: number; // For splitting large datasets
  targetEnv: 'PROD' | 'STAGING';
}

export interface JobStats {
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  errorCount: number;
  batchesTotal: number;
  batchesCompleted: number;
}