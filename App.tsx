import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FileSpreadsheet, 
  Settings, 
  ShieldCheck, 
  LayoutDashboard,
  Layers,
  Database,
  Activity,
  AlertTriangle,
  Link as LinkIcon,
  DownloadCloud,
  FileText,
  X as XIcon,
  Camera,
  Table as TableIcon,
  Bug,
  Monitor
} from 'lucide-react';

import { JobStatus, LogEntry, LogLevel, JobStats, CatalogItem, AutomationConfig, SimulationScenario } from './types';
import { APP_NAME, URLS, DEFAULT_BATCH_SIZE, DEMO_CSV_DATA } from './constants';
import { parseCSV, chunkArray, parseGoogleSheetUrl, constructCsvExportUrl } from './utils/dataProcessor';
import { simulateLogin, simulateNavigation, simulateUploadBatch } from './services/automationMock';
import LogTerminal from './components/LogTerminal';
import { StatsCard } from './components/StatsCard';

const App: React.FC = () => {
  // --- State ---
  const [config, setConfig] = useState<AutomationConfig>({
    username: '',
    batchSize: DEFAULT_BATCH_SIZE,
    targetEnv: 'PROD',
    simulationScenario: 'SUCCESS'
  });
  const [password, setPassword] = useState('');
  const [isElectron, setIsElectron] = useState(false);
  
  // Data Source & View State
  const [inputType, setInputType] = useState<'manual' | 'google-sheet'>('google-sheet');
  const [viewMode, setViewMode] = useState<'raw' | 'table'>('table'); 
  
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1oH41KmxSeEUuLyRT9LrFdWkdgvPS7P6Dk3AWF-b8Y40/edit?gid=0#gid=0');
  const [isFetching, setIsFetching] = useState(false);

  const [rawData, setRawData] = useState('');
  const [status, setStatus] = useState<JobStatus>(JobStatus.IDLE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<JobStats>({
    totalRecords: 0,
    processedRecords: 0,
    successCount: 0,
    errorCount: 0,
    batchesTotal: 0,
    batchesCompleted: 0
  });
  
  const [viewingScreenshot, setViewingScreenshot] = useState<LogEntry | null>(null);

  const stopRef = useRef(false);

  // --- Check for Electron Environment ---
  useEffect(() => {
    if (window.electronAPI) {
      setIsElectron(true);
      
      // Setup Listeners for Real Automation
      window.electronAPI.onLog((log) => {
        // Convert string timestamp from JSON to Date object
        const fixedLog = { ...log, timestamp: new Date(log.timestamp) };
        setLogs(prev => [...prev, fixedLog]);
      });
      
      window.electronAPI.onStatusChange((newStatus) => {
        setStatus(newStatus);
      });

      window.electronAPI.onStatsUpdate((newStats) => {
        setStats(prev => ({ ...prev, ...newStats }));
      });
    }
  }, []);

  // --- Derived State for Preview ---
  const parsedPreviewData = useMemo(() => {
    return parseCSV(rawData);
  }, [rawData]);

  const previewHeaders = useMemo(() => {
    if (parsedPreviewData.length > 0) {
      return Object.keys(parsedPreviewData[0]).filter(k => k !== 'id');
    }
    return [];
  }, [parsedPreviewData]);

  // --- Helpers ---
  const addLog = useCallback((message: string, level: LogLevel = LogLevel.INFO, step: string = 'SYS', hasScreenshot: boolean = false) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      level,
      message,
      step,
      hasScreenshot
    }]);
  }, []);

  // --- Fetch Logic ---
  const handleFetchSheet = async () => {
    if (!sheetUrl) return;
    setIsFetching(true);
    addLog(`Resolving Google Sheet: ${sheetUrl}`, LogLevel.INFO, 'FETCH');
    const sheetDetails = parseGoogleSheetUrl(sheetUrl);
    
    if (!sheetDetails) {
      addLog("Invalid Google Sheet URL format.", LogLevel.ERROR, 'FETCH');
      setIsFetching(false);
      return;
    }
    const exportUrl = constructCsvExportUrl(sheetDetails.id, sheetDetails.gid);
    addLog(`Attempting to download CSV from: ${exportUrl}`, LogLevel.SYSTEM, 'FETCH');

    try {
      const response = await fetch(exportUrl);
      if (response.ok) {
        const text = await response.text();
        setRawData(text);
        addLog("Sheet data fetched successfully.", LogLevel.SUCCESS, 'FETCH');
        setViewMode('table');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      addLog("Could not direct fetch (CORS restriction). Loading simulation data for preview...", LogLevel.WARNING, 'FETCH');
      setTimeout(() => {
        setRawData(DEMO_CSV_DATA);
        addLog("Loaded cached/demo data for testing purposes.", LogLevel.INFO, 'FETCH');
        setViewMode('table');
      }, 1000);
    } finally {
      setIsFetching(false);
    }
  };

  // --- Automation Logic ---
  const runAutomation = async () => {
    if (!config.username || !password) {
      alert("Please enter credentials first.");
      return;
    }
    if (!rawData.trim()) {
      alert("Please load or enter data to process.");
      return;
    }

    const parsedData = parseCSV(rawData);
    if (parsedData.length === 0) {
      alert("No valid data found.");
      return;
    }

    setLogs([]);
    setStatus(JobStatus.RUNNING);

    // --- BRANCH: REAL ELECTRON AUTOMATION ---
    if (window.electronAPI) {
      addLog("Handing over control to Electron Main Process...", LogLevel.SYSTEM, "IPC");
      setStats({
        totalRecords: parsedData.length,
        processedRecords: 0,
        successCount: 0,
        errorCount: 0,
        batchesTotal: Math.ceil(parsedData.length / config.batchSize),
        batchesCompleted: 0
      });

      // Send the job to the backend
      window.electronAPI.startJob({
        config,
        password,
        data: parsedData
      });
      return;
    }

    // --- BRANCH: BROWSER SIMULATION (FALLBACK) ---
    stopRef.current = false;
    
    addLog("Initializing Automation Agent v1.0 (Simulation Mode)...", LogLevel.SYSTEM, "INIT");
    addLog(`Target URL: ${URLS.LOGIN}`, LogLevel.INFO, "INIT");
    
    const batches = chunkArray(parsedData, config.batchSize);
    setStats({
      totalRecords: parsedData.length,
      processedRecords: 0,
      successCount: 0,
      errorCount: 0,
      batchesTotal: batches.length,
      batchesCompleted: 0
    });

    addLog(`Data parsed successfully. ${parsedData.length} records found.`, LogLevel.SUCCESS, "DATA");
    addLog(`Split into ${batches.length} batch(es) of max ${config.batchSize} records.`, LogLevel.INFO, "DATA");

    // Login Phase
    if (stopRef.current) return;
    const loginSuccess = await simulateLogin(config.username, password, config.simulationScenario, addLog);
    if (!loginSuccess) {
      setStatus(JobStatus.FAILED);
      return;
    }

    // Navigation Phase
    if (stopRef.current) return;
    await simulateNavigation(addLog);

    // Batch Upload Phase
    let processedTotal = 0;
    
    for (let i = 0; i < batches.length; i++) {
      if (stopRef.current) {
        addLog("Job stopped by user.", LogLevel.WARNING, "STOP");
        setStatus(JobStatus.PAUSED);
        return;
      }

      const batchSuccess = await simulateUploadBatch(i + 1, batches[i].length, config.simulationScenario, addLog);
      processedTotal += batches[i].length;
      
      setStats(prev => ({
        ...prev,
        processedRecords: processedTotal,
        batchesCompleted: i + 1,
        successCount: batchSuccess ? prev.successCount + batches[i].length : prev.successCount,
        errorCount: !batchSuccess ? prev.errorCount + batches[i].length : prev.errorCount
      }));

      if (i < batches.length - 1) {
        addLog("Waiting 2s before next batch to ensure stability...", LogLevel.SYSTEM, "WAIT");
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    addLog("All batches processed.", LogLevel.SUCCESS, "DONE");
    setStatus(JobStatus.COMPLETED);
  };

  const handleStop = () => {
    if (window.electronAPI) {
      window.electronAPI.stopJob();
    } else {
      stopRef.current = true;
    }
  };

  const handleReset = () => {
    setStatus(JobStatus.IDLE);
    setLogs([]);
    setStats({
      totalRecords: 0,
      processedRecords: 0,
      successCount: 0,
      errorCount: 0,
      batchesTotal: 0,
      batchesCompleted: 0
    });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans text-gray-800 relative">
      {/* ... (Screenshot Modal Logic omitted for brevity, keeping existing) ... */}
      {viewingScreenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden max-h-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold">Captured Screenshot</h3>
              <button onClick={() => setViewingScreenshot(null)}><XIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-8 flex justify-center bg-gray-100">
               <div className="bg-white p-6 rounded shadow text-center">
                 <p className="text-gray-500">Screenshots are available in the local debug folder in Electron mode.</p>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg z-10">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <div className={`p-2 rounded-lg ${isElectron ? 'bg-purple-600' : 'bg-decathlon-blue'}`}>
              {isElectron ? <Monitor className="text-white w-6 h-6" /> : <Layers className="text-white w-6 h-6" />}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-decathlon-dark">{APP_NAME}</h1>
              {isElectron && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">DESKTOP MODE</span>}
            </div>
          </div>
          <p className="text-xs text-gray-400">Decathlon Catalog Automation Agent</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
              <ShieldCheck className="w-3 h-3 mr-2" /> Credentials
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Decathlon Email</label>
                <input 
                  type="email" 
                  value={config.username}
                  onChange={(e) => setConfig({...config, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-decathlon-blue focus:border-transparent text-sm transition-all"
                  placeholder="name@decathlon.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-decathlon-blue focus:border-transparent text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
              <Settings className="w-3 h-3 mr-2" /> Job Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Size</label>
                <input 
                  type="number" 
                  value={config.batchSize}
                  onChange={(e) => setConfig({...config, batchSize: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-decathlon-blue focus:border-transparent text-sm"
                />
              </div>

              {!isElectron && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    <Bug className="w-3 h-3 mr-1 text-gray-400" />
                    Scenario Simulation
                  </label>
                  <select 
                    value={config.simulationScenario}
                    onChange={(e) => setConfig({...config, simulationScenario: e.target.value as SimulationScenario})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-decathlon-blue focus:border-transparent text-sm bg-white"
                  >
                    <option value="SUCCESS">✅ Happy Path (Success)</option>
                    <option value="ERROR_VPN">🌐 Error: VPN Disconnected</option>
                    <option value="ERROR_AUTH">🔒 Error: Login Failed</option>
                    <option value="ERROR_UPLOAD">📁 Error: Upload Failed</option>
                  </select>
                </div>
              )}
            </div>
          </section>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <div className="flex items-center space-x-4">
             <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
               status === JobStatus.RUNNING ? 'bg-blue-50 text-blue-600 border-blue-200 animate-pulse' :
               status === JobStatus.COMPLETED ? 'bg-green-50 text-green-600 border-green-200' :
               status === JobStatus.FAILED ? 'bg-red-50 text-red-600 border-red-200' :
               'bg-gray-100 text-gray-500 border-gray-200'
             }`}>
               STATUS: {status}
             </span>
             {status === JobStatus.RUNNING && (
               <span className="text-sm text-gray-500">Processing Batch {stats.batchesCompleted + 1} of {stats.batchesTotal}</span>
             )}
          </div>
          
          <div className="flex items-center space-x-3">
             {status === JobStatus.RUNNING ? (
               <button 
                onClick={handleStop}
                className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
               >
                 <Pause className="w-4 h-4" />
                 <span>Stop Job</span>
               </button>
             ) : (
               <button 
                onClick={runAutomation}
                className={`flex items-center space-x-2 px-6 py-2 ${isElectron ? 'bg-purple-600 hover:bg-purple-700' : 'bg-decathlon-blue hover:bg-decathlon-dark'} text-white rounded-md transition-colors shadow-sm text-sm font-medium`}
               >
                 <Play className="w-4 h-4 fill-current" />
                 <span>{isElectron ? 'Start Real Automation' : 'Start Simulation'}</span>
               </button>
             )}
             
             {(status === JobStatus.COMPLETED || status === JobStatus.FAILED) && (
               <button 
                 onClick={handleReset}
                 className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                 title="Reset"
               >
                 <RotateCcw className="w-5 h-5" />
               </button>
             )}
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-6 bg-slate-50">
          
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <StatsCard 
              label="Total Rows" 
              value={stats.totalRecords} 
              icon={FileSpreadsheet} 
              colorClass="bg-blue-500 text-blue-600"
            />
             <StatsCard 
              label="Processed" 
              value={stats.processedRecords} 
              icon={Activity} 
              colorClass="bg-indigo-500 text-indigo-600"
              subtext={`${Math.round((stats.processedRecords / (stats.totalRecords || 1)) * 100)}% Complete`}
            />
             <StatsCard 
              label="Successful" 
              value={stats.successCount} 
              icon={ShieldCheck} 
              colorClass="bg-green-500 text-green-600"
            />
             <StatsCard 
              label="Errors" 
              value={stats.errorCount} 
              icon={AlertTriangle} 
              colorClass={stats.errorCount > 0 ? "bg-red-500 text-red-600" : "bg-gray-400 text-gray-500"}
            />
          </div>

          <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
            {/* Input Area */}
            <div className="w-full md:w-1/2 flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
               {/* Tab Header */}
               <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                 <div className="flex space-x-4">
                   <button 
                    onClick={() => setInputType('google-sheet')}
                    className={`flex items-center space-x-2 py-2 px-1 border-b-2 text-sm font-medium transition-colors ${inputType === 'google-sheet' ? 'border-decathlon-blue text-decathlon-blue' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                   >
                     <LinkIcon className="w-4 h-4" />
                     <span>Google Sheet</span>
                   </button>
                   <button 
                    onClick={() => setInputType('manual')}
                    className={`flex items-center space-x-2 py-2 px-1 border-b-2 text-sm font-medium transition-colors ${inputType === 'manual' ? 'border-decathlon-blue text-decathlon-blue' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                   >
                     <FileText className="w-4 h-4" />
                     <span>Manual Paste</span>
                   </button>
                 </div>
                 
                 <div className="flex bg-gray-200 rounded p-0.5">
                    <button 
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded text-xs flex items-center ${viewMode === 'table' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <TableIcon className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setViewMode('raw')}
                      className={`p-1.5 rounded text-xs flex items-center ${viewMode === 'raw' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                 </div>
               </div>

               {/* Google Sheet Input */}
               {inputType === 'google-sheet' && (
                 <div className="p-4 bg-gray-50 border-b border-gray-100 space-y-3">
                   <div className="flex space-x-2">
                     <input 
                      type="text" 
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-decathlon-blue focus:border-transparent"
                     />
                     <button 
                      onClick={handleFetchSheet}
                      disabled={isFetching || status === JobStatus.RUNNING}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center space-x-2 disabled:opacity-50"
                     >
                       {isFetching ? <span className="animate-spin">⌛</span> : <DownloadCloud className="w-4 h-4" />}
                       <span>Fetch Data</span>
                     </button>
                   </div>
                 </div>
               )}
               
               {/* Preview Content Area */}
               <div className="relative flex-1 overflow-auto bg-white">
                 {viewMode === 'raw' ? (
                   <textarea
                    className="w-full h-full p-4 font-mono text-xs resize-none focus:ring-2 focus:ring-inset focus:ring-decathlon-blue border-none outline-none text-gray-600"
                    placeholder={inputType === 'manual' ? `Paste content here...` : `Fetched data will appear here...`}
                    value={rawData}
                    onChange={(e) => setRawData(e.target.value)}
                    disabled={status === JobStatus.RUNNING}
                    readOnly={inputType === 'google-sheet'}
                   />
                 ) : (
                   <div className="min-w-full inline-block align-middle">
                     {parsedPreviewData.length > 0 ? (
                       <table className="min-w-full divide-y divide-gray-200">
                         <thead className="bg-gray-50 sticky top-0">
                           <tr>
                             {previewHeaders.map((header) => (
                               <th key={header} scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                 {header}
                               </th>
                             ))}
                           </tr>
                         </thead>
                         <tbody className="bg-white divide-y divide-gray-200">
                           {parsedPreviewData.map((row, idx) => (
                             <tr key={idx} className="hover:bg-gray-50">
                               {previewHeaders.map((header) => (
                                 <td key={`${idx}-${header}`} className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                                   {row[header]}
                                 </td>
                               ))}
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     ) : (
                       <div className="flex flex-col items-center justify-center h-full text-gray-400">
                         <TableIcon className="w-8 h-8 mb-2 opacity-20" />
                         <span className="text-xs">No data to display. Paste CSV or Fetch Sheet.</span>
                       </div>
                     )}
                   </div>
                 )}
               </div>

               <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400 flex justify-between">
                 <span>Preview Mode: {viewMode === 'table' ? 'Data Grid' : 'Raw Text'}</span>
                 <span>{parsedPreviewData.length} records detected</span>
               </div>
            </div>

            {/* Output / Terminal Area */}
            <div className="w-full md:w-1/2 h-full min-h-[300px]">
              <LogTerminal 
                logs={logs} 
                onViewScreenshot={(log) => setViewingScreenshot(log)}
              />
            </div>

          </div>
        </div>

      </main>
    </div>
  );
};

// Helper for the screenshot mock since I can't import Lucide icons directly in the render logic sometimes
const CheckCircle2Icon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
);

export default App;