import React, { useState, useCallback, useRef } from 'react';
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
  Camera
} from 'lucide-react';

import { JobStatus, LogEntry, LogLevel, JobStats, CatalogItem, AutomationConfig } from './types';
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
    targetEnv: 'PROD'
  });
  const [password, setPassword] = useState('');
  
  // Data Source State
  const [inputType, setInputType] = useState<'manual' | 'google-sheet'>('google-sheet');
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
  
  // Screenshot Modal State
  const [viewingScreenshot, setViewingScreenshot] = useState<LogEntry | null>(null);

  const stopRef = useRef(false);

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
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      addLog("Could not direct fetch (CORS restriction). Loading simulation data for preview...", LogLevel.WARNING, 'FETCH');
      
      setTimeout(() => {
        setRawData(DEMO_CSV_DATA);
        addLog("Loaded cached/demo data for testing purposes.", LogLevel.INFO, 'FETCH');
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

    setStatus(JobStatus.RUNNING);
    setLogs([]); 
    stopRef.current = false;
    
    // 1. Data Parsing Phase
    addLog("Initializing Automation Agent v1.0...", LogLevel.SYSTEM, "INIT");
    addLog(`Target URL: ${URLS.LOGIN}`, LogLevel.INFO, "INIT");
    
    const parsedData = parseCSV(rawData);
    if (parsedData.length === 0) {
      addLog("Failed to parse CSV data. Check format.", LogLevel.ERROR, "DATA");
      setStatus(JobStatus.FAILED);
      return;
    }

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

    // 2. Login Phase
    if (stopRef.current) return;
    const loginSuccess = await simulateLogin(config.username, addLog);
    if (!loginSuccess) {
      setStatus(JobStatus.FAILED);
      return;
    }

    // 3. Navigation Phase
    if (stopRef.current) return;
    await simulateNavigation(addLog);

    // 4. Batch Upload Phase
    let processedTotal = 0;
    
    for (let i = 0; i < batches.length; i++) {
      if (stopRef.current) {
        addLog("Job stopped by user.", LogLevel.WARNING, "STOP");
        setStatus(JobStatus.PAUSED);
        return;
      }

      const batchSuccess = await simulateUploadBatch(i + 1, batches[i].length, addLog);
      
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
    addLog("Generating Final Report...", LogLevel.INFO, "DONE");
    setStatus(JobStatus.COMPLETED);
  };

  const handleStop = () => {
    stopRef.current = true;
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
      
      {/* Screenshot Modal */}
      {viewingScreenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden max-h-full animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center space-x-2">
                <Camera className="w-5 h-5 text-decathlon-blue" />
                <h3 className="font-bold text-gray-800">Screenshot Capture</h3>
                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                  {viewingScreenshot.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <button 
                onClick={() => setViewingScreenshot(null)}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <XIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            
            <div className="p-0 bg-gray-100 flex justify-center items-center h-[500px] overflow-auto">
               {/* Mock Browser Window */}
               <div className="w-full max-w-3xl bg-white shadow-lg border border-gray-300 rounded-md overflow-hidden">
                 <div className="bg-gray-100 border-b border-gray-300 p-2 flex items-center space-x-2">
                   <div className="flex space-x-1">
                     <div className="w-3 h-3 rounded-full bg-red-400"></div>
                     <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                     <div className="w-3 h-3 rounded-full bg-green-400"></div>
                   </div>
                   <div className="bg-white flex-1 px-3 py-1 rounded text-xs text-gray-500 flex items-center">
                     <ShieldCheck className="w-3 h-3 mr-1 text-green-600" />
                     https://withpassion.decathlon.net/rank2/dashboard
                   </div>
                 </div>
                 
                 {/* Mock Content */}
                 <div className="p-8">
                   <div className="flex justify-between items-center mb-8 border-b pb-4">
                     <div className="h-8 w-32 bg-decathlon-blue rounded"></div>
                     <div className="flex space-x-4">
                       <div className="h-8 w-20 bg-gray-200 rounded"></div>
                       <div className="h-8 w-8 bg-gray-300 rounded-full"></div>
                     </div>
                   </div>
                   
                   <div className="flex space-x-6">
                      <div className="w-1/4 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-full"></div>
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-decathlon-blue/20 rounded w-full"></div>
                        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                      </div>
                      <div className="w-3/4 p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex flex-col items-center justify-center min-h-[200px]">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                          <CheckCircle2Icon className="w-8 h-8 text-green-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-700">Login Successful</h2>
                        <p className="text-gray-500 mt-2">Welcome back, {config.username || 'User'}!</p>
                      </div>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar / Config Panel */}
      <aside className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg z-10">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-decathlon-blue p-2 rounded-lg">
              <Layers className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-decathlon-dark">{APP_NAME}</h1>
          </div>
          <p className="text-xs text-gray-400">Decathlon Catalog Automation Agent</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Credentials Section */}
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

          {/* Configuration Section */}
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
                <p className="text-[10px] text-gray-400 mt-1">Recommended: 500 lines per batch</p>
              </div>
              
              <div className="p-3 bg-yellow-50 rounded border border-yellow-100 text-xs text-yellow-800 flex items-start">
                <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                <p>Ensure you are connected to the corporate VPN before starting.</p>
              </div>
            </div>
          </section>

        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-[10px] text-center text-gray-400">
            Secure Connection • TLS 1.3 • v1.0.2
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Header */}
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
                className="flex items-center space-x-2 px-6 py-2 bg-decathlon-blue text-white rounded-md hover:bg-decathlon-dark transition-colors shadow-sm text-sm font-medium"
               >
                 <Play className="w-4 h-4 fill-current" />
                 <span>Start Automation</span>
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
               <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center space-x-4">
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
                       {isFetching ? (
                         <span className="animate-spin">⌛</span>
                       ) : (
                         <DownloadCloud className="w-4 h-4" />
                       )}
                       <span>Fetch Data</span>
                     </button>
                   </div>
                   <div className="text-[10px] text-gray-400">
                     Note: For direct fetch to work, the sheet must be public or you may need to use the "Publish to Web" link.
                   </div>
                 </div>
               )}
               
               {/* Preview Area */}
               <div className="relative flex-1">
                 <textarea
                  className="absolute inset-0 w-full h-full p-4 font-mono text-xs resize-none focus:ring-2 focus:ring-inset focus:ring-decathlon-blue border-none outline-none text-gray-600"
                  placeholder={inputType === 'manual' ? `Paste content here...` : `Fetched data will appear here...`}
                  value={rawData}
                  onChange={(e) => setRawData(e.target.value)}
                  disabled={status === JobStatus.RUNNING}
                  readOnly={inputType === 'google-sheet'}
                 />
               </div>
               <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400 flex justify-between">
                 <span>Preview Mode</span>
                 <span>{rawData.split('\n').filter(l => l.trim()).length} lines detected</span>
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