import React, { useEffect, useRef } from 'react';
import { LogEntry, LogLevel } from '../types';
import { Terminal, CheckCircle2, AlertCircle, Info, Camera } from 'lucide-react';

interface LogTerminalProps {
  logs: LogEntry[];
  onViewScreenshot?: (log: LogEntry) => void;
}

const LogTerminal: React.FC<LogTerminalProps> = ({ logs, onViewScreenshot }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getIcon = (level: LogLevel) => {
    switch (level) {
      case LogLevel.SUCCESS: return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case LogLevel.ERROR: return <AlertCircle className="w-4 h-4 text-red-400" />;
      case LogLevel.WARNING: return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case LogLevel.SYSTEM: return <Terminal className="w-4 h-4 text-purple-400" />;
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.SUCCESS: return 'text-green-400';
      case LogLevel.ERROR: return 'text-red-400';
      case LogLevel.WARNING: return 'text-yellow-400';
      case LogLevel.SYSTEM: return 'text-purple-400';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-xl">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-mono text-slate-400">EXECUTION LOGS</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 rounded-full bg-red-500/20"></div>
          <div className="w-2 h-2 rounded-full bg-yellow-500/20"></div>
          <div className="w-2 h-2 rounded-full bg-green-500/20"></div>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-2 custom-scrollbar"
      >
        {logs.length === 0 && (
          <div className="text-slate-500 italic">Waiting for process start...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex items-start space-x-3 hover:bg-slate-800/30 p-1 rounded transition-colors group">
            <span className="text-slate-600 text-xs mt-0.5 whitespace-nowrap">
              {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}.
              <span className="text-slate-700">{log.timestamp.getMilliseconds().toString().padStart(3, '0')}</span>
            </span>
            <span className="mt-0.5">{getIcon(log.level)}</span>
            <div className="flex-1 flex items-start justify-between gap-4">
              <div className="break-all">
                {log.step && (
                  <span className="inline-block px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[10px] rounded mr-2 uppercase tracking-wider">
                    {log.step}
                  </span>
                )}
                <span className={getColor(log.level)}>{log.message}</span>
              </div>
              
              {log.hasScreenshot && (
                <button 
                  onClick={() => onViewScreenshot?.(log)}
                  className="flex-shrink-0 flex items-center space-x-1 px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[10px] transition-colors border border-slate-600"
                >
                  <Camera className="w-3 h-3" />
                  <span>View Capture</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogTerminal;