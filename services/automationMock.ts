import { JobStatus, LogLevel } from '../types';

// Helper to simulate delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const simulateLogin = async (
  username: string, 
  addLog: (msg: string, level: LogLevel, step: string, hasScreenshot?: boolean) => void
): Promise<boolean> => {
  addLog(`Navigating to https://withpassion.decathlon.net/rank2/control/login`, LogLevel.INFO, 'LOGIN');
  await delay(800);
  
  addLog(`Checking credentials for user: ${username}`, LogLevel.INFO, 'AUTH');
  await delay(1200);

  if (username.includes('error')) {
    addLog(`Authentication failed: Invalid credentials`, LogLevel.ERROR, 'AUTH', true);
    return false;
  }

  addLog(`Login successful. Dashboard loaded.`, LogLevel.SUCCESS, 'AUTH', true); // Added screenshot flag
  return true;
};

export const simulateNavigation = async (
  addLog: (msg: string, level: LogLevel, step: string) => void
): Promise<void> => {
  addLog(`Accessing Main Dashboard...`, LogLevel.INFO, 'NAV');
  await delay(600);
  addLog(`Clicking 'Rank 2' tab`, LogLevel.INFO, 'NAV');
  await delay(500);
  addLog(`Clicking 'Catalog' sub-menu`, LogLevel.INFO, 'NAV');
  await delay(800);
  addLog(`Catalog Control Panel loaded. Ready for input.`, LogLevel.SUCCESS, 'NAV');
};

export const simulateUploadBatch = async (
  batchId: number,
  recordCount: number,
  addLog: (msg: string, level: LogLevel, step: string) => void
): Promise<boolean> => {
  addLog(`Preparing Batch #${batchId} (${recordCount} records)...`, LogLevel.INFO, `BATCH-${batchId}`);
  await delay(400);
  
  addLog(`Converting JSON to .xlsx format for upload`, LogLevel.SYSTEM, `BATCH-${batchId}`);
  await delay(600); // Simulate file conversion time

  // Updated Sequence: Choose File -> Select File -> Click Update
  addLog(`Locating 'Choose File' input field...`, LogLevel.SYSTEM, `BATCH-${batchId}`);
  await delay(300);

  addLog(`Selecting file: batch_${batchId}.xlsx`, LogLevel.INFO, `BATCH-${batchId}`);
  await delay(500);

  addLog(`Clicking 'UPDATE' button to initiate upload...`, LogLevel.INFO, `BATCH-${batchId}`);
  await delay(800 + Math.random() * 500); // Network latency

  // Simulate random failure for realism (1% chance)
  if (Math.random() < 0.01) {
    addLog(`Server responded with 500 Internal Error on Batch #${batchId}`, LogLevel.ERROR, `BATCH-${batchId}`);
    return false;
  }

  addLog(`Batch #${batchId} upload confirmed. Status: Pending Processing`, LogLevel.SUCCESS, `BATCH-${batchId}`);
  return true;
};