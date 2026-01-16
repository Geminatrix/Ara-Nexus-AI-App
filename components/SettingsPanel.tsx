import React from 'react';
import { Settings, Message, Checkpoint } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  type: 'history' | 'settings';
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (newSettings: Settings) => void;
  history: Message[];
  checkpoints: Checkpoint[];
  onLoadCheckpoint: (name: string) => void;
  logs: string[];
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  isOpen, type, onClose, settings, onSettingsChange, history, checkpoints, onLoadCheckpoint, logs 
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
        <h2 className="text-xl font-mono text-white">
          {type === 'history' ? '⏳ CHRONO_LOGS' : '⚙️ SYSTEM_CONFIG'}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        {type === 'history' && (
          <div className="space-y-4">
            <button 
              className="text-xs text-cyan-400 border border-cyan-900 px-3 py-1 hover:bg-cyan-900/50 mb-4"
              onClick={() => {
                const blob = new Blob([JSON.stringify(history, null, 2)], {type : 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chat_history_${Date.now()}.json`;
                a.click();
              }}
            >
              📥 EXPORT DATA
            </button>
            {history.map((msg) => (
              <div key={msg.id} className="text-sm border-l-2 border-gray-700 pl-3 py-1">
                <div className="text-xs text-gray-500 mb-1 font-mono uppercase">{msg.role} - {new Date(msg.timestamp).toLocaleTimeString()}</div>
                <div className="text-gray-300 whitespace-pre-wrap">{msg.content.substring(0, 150)}{msg.content.length > 150 ? '...' : ''}</div>
              </div>
            ))}
          </div>
        )}

        {type === 'settings' && (
          <div className="space-y-6">
            {/* Toggles */}
            <div className="space-y-3">
              <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer hover:text-white">
                <span>Show Thinking (CoT)</span>
                <input 
                  type="checkbox" 
                  checked={settings.showThinking} 
                  onChange={(e) => onSettingsChange({...settings, showThinking: e.target.checked})}
                  className="accent-cyan-500"
                />
              </label>
              
              <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer hover:text-white">
                <span>Voice Mode (TTS)</span>
                <input 
                  type="checkbox" 
                  checked={settings.voiceMode} 
                  onChange={(e) => onSettingsChange({...settings, voiceMode: e.target.checked})}
                  className="accent-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer hover:text-white">
                <span>Developer Mode</span>
                <input 
                  type="checkbox" 
                  checked={settings.devMode} 
                  onChange={(e) => onSettingsChange({...settings, devMode: e.target.checked})}
                  className="accent-cyan-500"
                />
              </label>
            </div>

            {/* Checkpoints */}
            <div className="pt-4 border-t border-gray-800">
              <h3 className="text-sm font-mono text-cyan-500 mb-3">CHECKPOINT_CACHE</h3>
              {checkpoints.length === 0 ? <p className="text-xs text-gray-600">No checkpoints found.</p> : (
                <div className="grid gap-2">
                  {checkpoints.map((cp, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-900 p-2 rounded border border-gray-800">
                      <span className="text-xs text-white">{cp.name}</span>
                      <button 
                        onClick={() => onLoadCheckpoint(cp.name)}
                        className="text-xs bg-cyan-900/30 text-cyan-400 px-2 py-1 hover:bg-cyan-900/60"
                      >
                        LOAD
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error Logs */}
            {settings.devMode && (
               <div className="pt-4 border-t border-gray-800">
               <h3 className="text-sm font-mono text-red-500 mb-3">ERROR_LOGS</h3>
               <div className="bg-black p-2 rounded text-[10px] font-mono text-gray-400 h-32 overflow-y-auto">
                 {logs.map((log, i) => <div key={i}>{log}</div>)}
               </div>
             </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;