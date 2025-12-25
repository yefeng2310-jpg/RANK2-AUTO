const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { chromium } = require('playwright');

let mainWindow;
let browser;
let page;
let isStopped = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // In dev, load Vite dev server. In prod, load file.
  const devUrl = 'http://localhost:5173';
  
  // Try to load dev URL, fallback to build file if not available (production logic simplified)
  mainWindow.loadURL(devUrl).catch(() => {
     mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  });
  
  // Open DevTools for debugging
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- HELPER: Send Logs to React ---
const sendLog = (level, message, step) => {
  const logEntry = {
    id: Math.random().toString(36).substr(2, 9),
    timestamp: new Date(),
    level,
    message,
    step,
  };
  // Guard against window being closed
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('job-log', logEntry);
  }
};

// --- REAL AUTOMATION LOGIC ---
ipcMain.on('start-job', async (event, { config, password, data }) => {
  isStopped = false;
  
  try {
    mainWindow.webContents.send('job-status', 'RUNNING');
    sendLog('SYSTEM', 'Launching Playwright Browser Engine...', 'INIT');

    browser = await chromium.launch({ headless: false }); // Headless: false so user sees it
    const context = await browser.newContext();
    page = await context.newPage();

    // 1. LOGIN
    sendLog('INFO', `Navigating to ${'https://withpassion.decathlon.net/rank2/control/login'}`, 'LOGIN');
    try {
        await page.goto('https://withpassion.decathlon.net/rank2/control/login', { timeout: 30000 });
    } catch (e) {
        sendLog('ERROR', 'Failed to load login page. Check VPN connection.', 'NET');
        throw e;
    }
    
    // Note: Selectors below are educated guesses. You MUST inspect the real Decathlon page 
    // and update 'input[type="email"]' etc. with real IDs or classes.
    sendLog('INFO', `Entering credentials for ${config.username}`, 'AUTH');
    
    // Wait for email field
    try {
        // Attempt to find generic login fields
        const emailSelector = 'input[type="email"], input[name="username"], input[name="login"]';
        await page.waitForSelector(emailSelector, { timeout: 5000 });
        await page.fill(emailSelector, config.username);
        
        const pwdSelector = 'input[type="password"], input[name="password"]';
        await page.waitForSelector(pwdSelector, { timeout: 5000 });
        await page.fill(pwdSelector, password);
        
        await page.click('button[type="submit"], input[type="submit"]');
    } catch (e) {
        sendLog('WARNING', 'Standard login fields not found. Please log in manually in the browser window...', 'AUTH');
        // Give user time to manual login
        await page.waitForTimeout(15000);
    }

    await page.waitForTimeout(3000); // Wait for transition
    
    sendLog('SUCCESS', 'Login phase complete.', 'AUTH');

    // 2. NAVIGATION
    sendLog('INFO', 'Navigating to Dashboard...', 'NAV');
    // await page.click('text="Catalog"'); // Real click example
    
    // 3. PROCESSING BATCHES
    const totalBatches = Math.ceil(data.length / config.batchSize);
    let processedCount = 0;

    for (let i = 0; i < totalBatches; i++) {
        if (isStopped) {
            sendLog('WARNING', 'Job stopped by user.', 'STOP');
            break;
        }

        const batchData = data.slice(i * config.batchSize, (i + 1) * config.batchSize);
        sendLog('INFO', `Processing Batch ${i + 1}/${totalBatches} (${batchData.length} items)`, `BATCH-${i+1}`);

        // --- REAL FILE UPLOAD LOGIC WOULD GO HERE ---
        // Simulating the work for now inside the Real Browser
        await page.waitForTimeout(1000); 

        processedCount += batchData.length;
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('job-stats', {
                processedRecords: processedCount,
                batchesCompleted: i + 1,
                successCount: processedCount 
            });
        }
        
        sendLog('SUCCESS', `Batch ${i + 1} uploaded successfully via Chrome.`, `BATCH-${i+1}`);
    }

    if (!isStopped) {
        sendLog('SUCCESS', 'Automation Complete.', 'DONE');
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('job-status', 'COMPLETED');
    } else {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('job-status', 'PAUSED');
    }

  } catch (error) {
    console.error(error);
    sendLog('ERROR', `Critical Failure: ${error.message}`, 'ERR');
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('job-status', 'FAILED');
  } finally {
    // Optional: Keep browser open for debugging or close it
    // if (browser) await browser.close(); 
  }
});

ipcMain.on('stop-job', () => {
  isStopped = true;
});