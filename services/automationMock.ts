import { JobStatus, LogLevel, SimulationScenario } from '../types';

// Helper to simulate delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const simulateLogin = async (
  username: string, 
  password: string,
  scenario: SimulationScenario,
  addLog: (msg: string, level: LogLevel, step: string, hasScreenshot?: boolean) => void
): Promise<boolean> => {
  addLog(`Navigating to https://withpassion.decathlon.net/rank2/control/login`, LogLevel.INFO, 'LOGIN');
  await delay(800);
  
  // Robustness: Simulate VPN Check
  if (scenario === 'ERROR_VPN') {
    addLog(`Network Error: Host unreachable.`, LogLevel.ERROR, 'NET');
    await delay(300);
    addLog(`CRITICAL: Corporate VPN connection not detected. Please connect to GlobalProtect and retry.`, LogLevel.ERROR, 'SYS');
    return false;
  }

  addLog(`Checking credentials for user: ${username}`, LogLevel.INFO, 'AUTH');
  await delay(1200);

  // Expanded Validation Logic for Simulation
  const isInvalidPassword = password.length < 4 || ['wrong', 'error', 'fail', 'invalid'].some(s => password.toLowerCase().includes(s));
  
  if (scenario === 'ERROR_AUTH' || username.includes('error') || isInvalidPassword) {
    addLog(`Authentication failed: Invalid credentials or Account Locked.`, LogLevel.ERROR, 'AUTH', true);
    addLog(`(Simulation Tip: Avoid using passwords containing "wrong" or "error" for the Happy Path)`, LogLevel.SYSTEM, 'AUTH');
    return false;
  }

  addLog(`Login successful. Dashboard loaded.`, LogLevel.SUCCESS, 'AUTH', true); 
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
  scenario: SimulationScenario,
  addLog: (msg: string, level: LogLevel, step: string) => void
): Promise<boolean> => {
  addLog(`Preparing Batch #${batchId} (${recordCount} records)...`, LogLevel.INFO, `BATCH-${batchId}`);
  await delay(400);
  
  addLog(`Converting JSON to .xlsx format for upload`, LogLevel.SYSTEM, `BATCH-${batchId}`);
  await delay(600); 

  addLog(`Locating 'Choose File' input field...`, LogLevel.SYSTEM, `BATCH-${batchId}`);
  await delay(300);

  addLog(`Selecting file: batch_${batchId}.xlsx`, LogLevel.INFO, `BATCH-${batchId}`);
  await delay(500);

  addLog(`Clicking 'UPDATE' button to initiate upload...`, LogLevel.INFO, `BATCH-${batchId}`);
  await delay(800 + Math.random() * 500); 

  // Robustness: Simulate Random or Forced Upload Failure
  if (scenario === 'ERROR_UPLOAD' || Math.random() < 0.01) {
    addLog(`Server responded with 500 Internal Error on Batch #${batchId}`, LogLevel.ERROR, `BATCH-${batchId}`);
    addLog(`Retrying Batch #${batchId} (Attempt 1/3)...`, LogLevel.WARNING, `BATCH-${batchId}`);
    await delay(1000);
    addLog(`Retry failed. Skipping batch to maintain workflow stability.`, LogLevel.ERROR, `BATCH-${batchId}`);
    return false;
  }

  addLog(`Batch #${batchId} upload confirmed. Status: Pending Processing`, LogLevel.SUCCESS, `BATCH-${batchId}`);
  return true;
};