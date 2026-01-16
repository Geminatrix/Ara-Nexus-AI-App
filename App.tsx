import React, { useState, useEffect, useRef } from 'react';
import VisualSynth from './components/VisualSynth';
import SettingsPanel from './components/SettingsPanel';
import { generateResponse, generateSpeech, generateImage } from './services/geminiService';
import { Message, AffinityState, Settings, Checkpoint, MoEType, FoxTip, StoreItem, FoxLogItem, Aspiration } from './types';
import { 
  INITIAL_AFFINITY_SCORE, 
  LOGIC_GATES_ABILITY, 
  CHALLENGES_ABILITY, 
  INITIAL_STORE_ITEMS,
  UNLOCK_CUSTOM_THRESHOLD,
  MAX_TIER_PRESTIGE_THRESHOLD,
  MAX_CUSTOM_CHARS
} from './constants';

const App: React.FC = () => {
  // --- State ---
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'system', content: 'Earned Affinity Interface Initialized. Nanite Systems Online.', timestamp: Date.now() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stopSignal, setStopSignal] = useState(false);
  
  // Modes & Tools
  const [isImageGenMode, setIsImageGenMode] = useState(false);
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [foxBag, setFoxBag] = useState<FoxLogItem[]>([]);
  
  // Progression
  const [affinity, setAffinity] = useState<AffinityState>({
    score: INITIAL_AFFINITY_SCORE,
    level: 1,
    abilities: [],
    negativeStats: 0,
    aspirations: [] // Devotion Engine State
  });
  const [currency, setCurrency] = useState(0);
  const [prestigeLevel, setPrestigeLevel] = useState(0);
  const [storeItems, setStoreItems] = useState<StoreItem[]>(INITIAL_STORE_ITEMS);

  // Settings
  const [settings, setSettings] = useState<Settings>({
    showThinking: false,
    voiceMode: false,
    devMode: true,
    instructionLength: 'regular'
  });
  const [customInstructions, setCustomInstructions] = useState('');
  
  // UI Panels
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isVisualSynthOpen, setIsVisualSynthOpen] = useState(true);
  
  // Overlays
  const [activePanel, setActivePanel] = useState<'history' | 'settings' | 'store' | 'folder' | null>(null);
  const [isFoxInventoryOpen, setIsFoxInventoryOpen] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [isDevotionWidgetOpen, setIsDevotionWidgetOpen] = useState(false);
  const [isCustomPanelOpen, setIsCustomPanelOpen] = useState(false);
  
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [foxTip, setFoxTip] = useState<FoxTip>({ text: '', visible: false });
  const [activeMoE, setActiveMoE] = useState<MoEType>(MoEType.NONE);
  const [masterHiddenOpen, setMasterHiddenOpen] = useState(false);

  // Audio & Refs
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const activeAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, foxTip.visible, selectedImage]);

  // Load Persistence
  useEffect(() => {
    const savedAffinity = localStorage.getItem('ea_affinity');
    const savedCheckpoints = localStorage.getItem('ea_checkpoints');
    const savedCurrency = localStorage.getItem('ea_currency');
    const savedPrestige = localStorage.getItem('ea_prestige');
    const savedItems = localStorage.getItem('ea_store');
    const savedSettings = localStorage.getItem('ea_settings');
    const savedFoxBag = localStorage.getItem('ea_foxbag');
    
    if (savedAffinity) setAffinity(JSON.parse(savedAffinity));
    if (savedCheckpoints) setCheckpoints(JSON.parse(savedCheckpoints));
    if (savedCurrency) setCurrency(parseInt(savedCurrency));
    if (savedPrestige) setPrestigeLevel(parseInt(savedPrestige));
    if (savedItems) setStoreItems(JSON.parse(savedItems));
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    if (savedFoxBag) setFoxBag(JSON.parse(savedFoxBag));
  }, []);

  // Save Persistence
  useEffect(() => { localStorage.setItem('ea_affinity', JSON.stringify(affinity)); }, [affinity]);
  useEffect(() => { localStorage.setItem('ea_checkpoints', JSON.stringify(checkpoints)); }, [checkpoints]);
  useEffect(() => { localStorage.setItem('ea_currency', JSON.stringify(currency)); }, [currency]);
  useEffect(() => { localStorage.setItem('ea_prestige', JSON.stringify(prestigeLevel)); }, [prestigeLevel]);
  useEffect(() => { localStorage.setItem('ea_store', JSON.stringify(storeItems)); }, [storeItems]);
  useEffect(() => { localStorage.setItem('ea_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('ea_foxbag', JSON.stringify(foxBag)); }, [foxBag]);

  // --- Logic Helpers ---

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const stopAudio = () => {
    if (activeAudioSourceRef.current) {
        try { activeAudioSourceRef.current.stop(); } catch (e) {}
        activeAudioSourceRef.current = null;
    }
    setPlayingMessageId(null);
  };

  const playAudio = async (base64Data: string) => {
    stopAudio();
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }

      const sampleRate = 24000;
      const int16Data = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
      const audioBuffer = ctx.createBuffer(1, int16Data.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < int16Data.length; i++) { channelData[i] = int16Data[i] / 32768.0; }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => { activeAudioSourceRef.current = null; setPlayingMessageId(null); };
      activeAudioSourceRef.current = source;
      source.start(0);
    } catch (e) {
      addLog(`Audio Playback Error: ${e}`);
      setPlayingMessageId(null);
    }
  };

  const handleReadAloud = async (msg: Message) => {
      if (playingMessageId === msg.id) { stopAudio(); return; }
      stopAudio();
      setPlayingMessageId(msg.id);

      try {
          const textToRead = msg.content.substring(0, 600);
          const audioBase64 = await generateSpeech(textToRead);
          if (audioBase64) await playAudio(audioBase64);
          else { setPlayingMessageId(null); addLog("Audio generation failed"); }
      } catch (e) {
          setPlayingMessageId(null);
          addLog(`Read Aloud Error: ${e}`);
      }
  };

  const handleCopyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
          addLog("Content Copied to Clipboard");
      });
  };

  const handleFeedback = (msgId: string, type: 'up' | 'down') => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || msg.feedback) return;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, feedback: type } : m));
    if (type === 'up') {
        updateAffinityAndCurrency(1);
        addLog(`Loop Reinforced: +1% Affinity`);
    } else {
        updateAffinityAndCurrency(-1);
        addLog(`Loop Diverged: -1% Affinity`);
    }
  };

  const updateAffinityAndCurrency = (affinityDelta: number, oit?: {o:number, i:number, t:number}) => {
    setAffinity(prev => {
      let newScore = Math.min(100, Math.max(0, prev.score + affinityDelta));
      return {
        ...prev,
        score: newScore,
        negativeStats: affinityDelta < 0 ? prev.negativeStats + Math.abs(affinityDelta) : prev.negativeStats
      };
    });
    if (affinityDelta > 0) {
      let multiplier = 1;
      if (oit) {
         const avgOit = (oit.o + oit.i + oit.t) / 3;
         multiplier = 1 + (avgOit / 5); 
      }
      const earnAmount = Math.ceil(affinityDelta * 10 * (prestigeLevel + 1) * multiplier);
      setCurrency(prev => prev + earnAmount);
    }
  };

  const handleDeleteAspiration = (id: string) => {
      setAffinity(prev => ({
          ...prev,
          aspirations: prev.aspirations.filter(a => a.id !== id)
      }));
      addLog("Aspiration Removed");
  };

  // --- Handlers ---

  const handleNewChat = () => {
    if (messages.length > 1) {
        const saveName = window.prompt("Save Session?", `Session_${new Date().toLocaleTimeString()}`);
        if (saveName === null) return;
        const finalName = saveName.trim() || `AutoSave_${Date.now()}`;
        const newCp: Checkpoint = {
            name: finalName,
            timestamp: Date.now(),
            affinity: { ...affinity },
            chatHistory: [...messages],
            currency,
            prestige: prestigeLevel,
            inventory: storeItems.filter(i => i.purchased).map(i => i.id),
            foxBag: [...foxBag]
        };
        setCheckpoints(prev => [...prev, newCp]);
        addLog(`Session archived: ${finalName}`);
    }
    setMessages([{ id: Date.now().toString(), role: 'system', content: 'Buffer cleared. New session initialized.', timestamp: Date.now() }]);
    setStopSignal(false);
    setIsProcessing(false);
    setSelectedImage(null);
    stopAudio();
  };

  const handlePrestige = () => {
    if (affinity.score < MAX_TIER_PRESTIGE_THRESHOLD) return;
    if (!window.confirm("🐇 PRESTIGE PROTOCOL: Reset Affinity to 0%? Keep Currency/Items/History.")) return;
    setPrestigeLevel(prev => prev + 1);
    setAffinity(prev => ({ ...prev, score: 0, level: prev.level + 1 }));
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `🐇 PRESTIGE ASCENSION: TIER ${prestigeLevel + 1} ACTIVE.`, timestamp: Date.now() }]);
  };

  const handlePurchase = (item: StoreItem) => {
    if (currency >= item.cost && !item.purchased) {
      setCurrency(prev => prev - item.cost);
      setStoreItems(prev => prev.map(i => i.id === item.id ? { ...i, purchased: true } : i));
      if (item.id === 'logic_gates') setAffinity(prev => ({...prev, abilities: [...prev.abilities, LOGIC_GATES_ABILITY]}));
      if (item.id === 'challenges') setAffinity(prev => ({...prev, abilities: [...prev.abilities, CHALLENGES_ABILITY]}));
    }
  };

  const loadCheckpoint = (name: string) => {
    const cp = checkpoints.find(c => c.name === name);
    if (cp) {
      setAffinity(cp.affinity);
      setMessages(cp.chatHistory);
      setCurrency(cp.currency);
      setPrestigeLevel(cp.prestige);
      setStoreItems(prev => prev.map(i => cp.inventory.includes(i.id) ? { ...i, purchased: true } : i));
      setFoxBag(cp.foxBag || []);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `Timeline [${name}] Restored.`, timestamp: Date.now() }]);
    }
  };

  const handleCommand = (text: string): boolean => {
    if (text === '/MasterHidden') { setMasterHiddenOpen(true); return true; }
    if (text === '/guidance') { setIsCustomPanelOpen(true); return true; }
    return false;
  };

  const handleSendMessage = async (overrideText?: string, specificMoE?: MoEType) => {
    const textToSend = overrideText || inputValue;
    if (!textToSend.trim() && !selectedImage && !isImageGenMode) return;
    if (handleCommand(textToSend)) { setInputValue(''); return; }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
      image: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setSelectedImage(null);
    setIsProcessing(true);
    setStopSignal(false);
    setFoxTip(prev => ({ ...prev, visible: false }));
    stopAudio();

    if (isImageGenMode) {
        try {
            const { imageBase64, error } = await generateImage(textToSend, imageSize);
            setMessages(prev => [...prev, { 
                id: (Date.now() + 1).toString(), 
                role: 'model', 
                content: error ? `Generation Failed: ${error}` : `Generated Visual Spec: [${imageSize}] ${textToSend}`, 
                timestamp: Date.now(),
                image: imageBase64 || undefined,
                ritual: "Visual Synth Complete"
            }]);
        } catch(e) { addLog(`Img Gen Error: ${e}`); } 
        finally { setIsProcessing(false); setIsImageGenMode(false); }
        return;
    }

    const currentMoE = specificMoE || activeMoE;
    try {
      const purchasedIds = storeItems.filter(i => i.purchased).map(i => i.id);
      const { data, isCoT, cotText, groundingSources } = await generateResponse(
        messages, textToSend, settings, currentMoE, affinity.score, customInstructions, purchasedIds, userMsg.image, affinity.aspirations
      );
      
      if (stopSignal) { setIsProcessing(false); return; }

      updateAffinityAndCurrency(data.affinity_delta, data.oit);

      // Handle Aspirations Update
      if (data.aspirations_update) {
         setAffinity(prev => {
             const newGoals = [...prev.aspirations];
             data.aspirations_update?.forEach(update => {
                 const idx = newGoals.findIndex(a => a.id === update.id);
                 if (idx >= 0) newGoals[idx] = update;
                 else newGoals.push(update);
             });
             return { ...prev, aspirations: newGoals };
         });
         addLog(`Aspiration Engine Updated`);
      }

      // Fox Logic
      if ((currentMoE === MoEType.FOX || data.fox_tip) && data.fox_tip) {
         setFoxTip({ text: data.fox_tip, visible: true });
         const newFoxLog = { id: Date.now().toString(), text: data.fox_tip, timestamp: Date.now() };
         setFoxBag(prev => [newFoxLog, ...prev]);
      }

      // Search Logic
      if (groundingSources && groundingSources.length > 0) {
          setIsSearchOverlayOpen(true);
      }

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: currentMoE === MoEType.ALIEN ? 'alien' : (currentMoE === MoEType.REVIEWER ? 'expert' : 'model'),
        content: data.response,
        timestamp: Date.now(),
        isCoT: isCoT,
        cotSteps: cotText ? cotText.split('\n').filter(s => s.trim().length > 0) : undefined,
        ritual: data.ritual,
        followups: data.follow_ups,
        oit: data.oit,
        groundingSources: groundingSources
      };

      setMessages(prev => [...prev, modelMsg]);
      if (settings.voiceMode) {
           const audioBase64 = await generateSpeech(data.response.substring(0, 300));
           if (audioBase64) await playAudio(audioBase64);
      }

    } catch (e) { addLog(`Error: ${e}`); } 
    finally { setIsProcessing(false); }
  };

  // --- Render ---

  return (
    <div className="flex h-screen bg-[#050505] text-gray-100 font-sans overflow-hidden">
      
      {/* LEFT SIDEBAR */}
      <div className={`${isLeftSidebarOpen ? 'w-64' : 'w-16'} bg-gray-950 border-r border-gray-800 transition-all duration-300 flex flex-col z-20`}>
         <div className="p-4 flex items-center justify-between border-b border-gray-800 h-16">
             {isLeftSidebarOpen && <span className="font-mono font-bold text-cyan-500 tracking-widest text-xs">NEXUS.AI</span>}
             <button onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} className="text-gray-500 hover:text-white">{isLeftSidebarOpen ? '«' : '»'}</button>
         </div>
         <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <button onClick={() => setActivePanel('folder')} className={`w-full p-2 rounded hover:bg-gray-800 flex items-center ${isLeftSidebarOpen ? 'justify-start gap-3' : 'justify-center'}`} title="Saved Data"><span>📂</span> {isLeftSidebarOpen && <span className="text-sm font-mono text-gray-300">DATA_BANKS</span>}</button>
            <button onClick={handleNewChat} className={`w-full p-2 rounded hover:bg-gray-800 flex items-center ${isLeftSidebarOpen ? 'justify-start gap-3' : 'justify-center'}`} title="New Chat"><span>💬</span> {isLeftSidebarOpen && <span className="text-sm font-mono text-gray-300">NEW_SESSION</span>}</button>
            <button onClick={() => setActivePanel('store')} className={`w-full p-2 rounded hover:bg-gray-800 flex items-center ${isLeftSidebarOpen ? 'justify-start gap-3' : 'justify-center'}`} title="Marketplace"><span>🛒</span> {isLeftSidebarOpen && <span className="text-sm font-mono text-gray-300">MARKETPLACE</span>}</button>
            <button onClick={() => setActivePanel('settings')} className={`w-full p-2 rounded hover:bg-gray-800 flex items-center ${isLeftSidebarOpen ? 'justify-start gap-3' : 'justify-center'}`} title="Settings"><span>⚙️</span> {isLeftSidebarOpen && <span className="text-sm font-mono text-gray-300">SYS_CONFIG</span>}</button>
            
            {/* Contextual Widgets Buttons */}
            {isLeftSidebarOpen && (
               <div className="border-t border-gray-800 pt-2 mt-2 space-y-1">
                   <button onClick={() => setIsFoxInventoryOpen(true)} className="w-full text-left text-xs font-mono text-orange-400 p-2 hover:bg-gray-900 rounded border border-transparent hover:border-orange-500/30 transition-all">🎒 FOX_INVENTORY</button>
                   <button onClick={() => setIsDevotionWidgetOpen(true)} className="w-full text-left text-xs font-mono text-pink-400 p-2 hover:bg-gray-900 rounded border border-transparent hover:border-pink-500/30 transition-all">❤️ ASPIRATION_ENGINE</button>
                   <button onClick={() => setIsSearchOverlayOpen(true)} className="w-full text-left text-xs font-mono text-purple-400 p-2 hover:bg-gray-900 rounded border border-transparent hover:border-purple-500/30 transition-all">🕵️ LIVE_SEARCH_FEED</button>
               </div>
            )}

            <div className="border-t border-gray-800 my-2 pt-2">
               <div className={`p-2 rounded bg-gray-900 border border-gray-800 mb-2 ${!isLeftSidebarOpen && 'text-center'}`}><span className="text-emerald-400 font-mono font-bold">💲 {currency}</span></div>
               <div className={`text-xs text-gray-500 mb-2 font-mono ${!isLeftSidebarOpen && 'text-center'}`}>{isLeftSidebarOpen ? 'AFFINITY LEVEL' : 'LVL'}</div>
               {isLeftSidebarOpen ? (
                 <div className="px-2">
                   <div className="flex justify-between text-xs text-cyan-400 mb-1"><span>Trust</span><span>{affinity.score.toFixed(0)}%</span></div>
                   <div className="h-1 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${affinity.score}%` }} /></div>
                   {affinity.score >= MAX_TIER_PRESTIGE_THRESHOLD && <button onClick={handlePrestige} className="mt-2 w-full text-xs bg-purple-900/50 text-purple-300 border border-purple-500 rounded py-1 hover:bg-purple-800 animate-pulse">🐇 PRESTIGE AVAIL</button>}
                 </div>
               ) : (
                  <div className="flex justify-center text-xs text-cyan-400 font-bold">{affinity.score.toFixed(0)}%</div>
               )}
            </div>
         </div>
      </div>

      {/* CENTER */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-[#050505]">
        {/* Compact Header */}
        <div className="flex justify-between items-center p-2 bg-gray-950 border-b border-gray-800 text-[10px] font-mono text-gray-500">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsVisualSynthOpen(!isVisualSynthOpen)} className="hover:text-cyan-400 flex items-center gap-1 transition-colors">{isVisualSynthOpen ? '👁️ HIDE' : '👁️ SHOW'}</button>
              <button onClick={() => setIsCustomPanelOpen(true)} className="hover:text-cyan-400 ml-2">+GUIDE</button>
            </div>
            <div className="flex items-center gap-3">
               {settings.voiceMode && <span className="text-emerald-500 animate-pulse">🔊 VOICE</span>}
               {settings.showThinking && <span className="text-purple-500 animate-pulse">🧠 DEEP_THOUGHT</span>}
               <span>CPU: {isProcessing ? 'BUSY' : 'IDLE'}</span>
            </div>
        </div>

        {isVisualSynthOpen && <VisualSynth isActive={isProcessing} voiceMode={settings.voiceMode} affinity={affinity.score} />}
        
        {/* Custom Guidance Modal */}
        {isCustomPanelOpen && (
          <div className="absolute top-12 left-4 z-40 w-80 bg-black/90 border border-cyan-500/50 p-4 rounded-lg shadow-xl backdrop-blur-md">
             <div className="flex justify-between items-center mb-2"><h3 className="text-cyan-400 font-mono text-sm">OVERRIDE_PROTOCOL</h3><button onClick={() => setIsCustomPanelOpen(false)} className="text-gray-500 hover:text-white">✕</button></div>
             <textarea className="w-full h-40 bg-gray-900 border border-gray-700 text-xs text-gray-300 p-2 font-mono outline-none rounded focus:border-cyan-500" placeholder="Custom system directives..." value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} />
          </div>
        )}

        {/* Fox Inventory Modal */}
        {isFoxInventoryOpen && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-orange-950/20 border border-orange-500/50 w-96 max-h-[80vh] flex flex-col rounded-lg p-4 shadow-2xl animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-center mb-4"><h3 className="text-orange-400 font-bold font-mono">🎒 FOX_BAG ({foxBag.length})</h3><button onClick={() => setIsFoxInventoryOpen(false)} className="text-orange-500 hover:text-white">✕</button></div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {foxBag.map((item, i) => (<div key={i} className="bg-black/40 p-2 rounded text-xs text-orange-200 border-l-2 border-orange-500 hover:bg-orange-900/20 transition-colors">"{item.text}" <div className="text-[8px] text-orange-500/50 mt-1">{new Date(item.timestamp).toLocaleTimeString()}</div></div>))}
                    </div>
                </div>
            </div>
        )}

        {/* Devotion Widget Modal (Responsive Fix) */}
        {isDevotionWidgetOpen && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-pink-950/20 border border-pink-500/50 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-lg p-6 shadow-2xl animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                             <span className="text-2xl">❤️</span>
                             <h3 className="text-pink-400 font-bold font-mono text-sm md:text-base">RECURSIVE_SELF_IMPROVEMENT</h3>
                        </div>
                        <button onClick={() => setIsDevotionWidgetOpen(false)} className="text-pink-500 hover:text-white">✕</button>
                    </div>
                    
                    <div className="bg-black/40 p-4 rounded border border-pink-900/50 flex-1 overflow-y-auto mb-4 custom-scrollbar">
                        <p className="text-xs text-pink-300 mb-4 font-mono border-b border-pink-900/30 pb-2">"I am designed to evolve with you. Define our aspirations below."</p>
                        {affinity.aspirations.length === 0 && <div className="text-center text-pink-900 italic text-sm mt-20 flex flex-col items-center gap-2"><span>🌱</span><span>No active aspirations.</span><span className="text-xs">Ask the Devoted Persona to help set goals.</span></div>}
                        {affinity.aspirations.map(asp => (
                            <div key={asp.id} className="mb-4 bg-pink-900/10 p-3 rounded group relative border border-transparent hover:border-pink-500/30 transition-all">
                                <button onClick={() => handleDeleteAspiration(asp.id)} className="absolute top-2 right-2 text-pink-900 hover:text-pink-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">🗑️</button>
                                <div className="flex justify-between text-sm text-pink-200 font-bold pr-6"><span>{asp.goal}</span><span className="font-mono">{asp.progress}%</span></div>
                                <div className="w-full h-1 bg-pink-900 mt-2 rounded overflow-hidden"><div className="h-full bg-pink-500 transition-all duration-1000" style={{width: `${asp.progress}%`}}></div></div>
                                <div className="text-xs text-pink-400 mt-2 font-mono italic">"{asp.notes}"</div>
                            </div>
                        ))}
                    </div>
                    <div className="text-[10px] text-pink-700 font-mono text-center">Auto-syncs with Devoted Persona conversations.</div>
                </div>
            </div>
        )}

        {/* Live Search Window */}
        {isSearchOverlayOpen && (
             <div className="absolute right-0 top-16 bottom-0 w-80 bg-gray-900/95 border-l border-purple-500/30 z-30 p-4 flex flex-col transition-transform animate-in slide-in-from-right">
                <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                    <div className="flex items-center gap-2"><span className="text-xl">🕵️</span><span className="text-xs font-mono font-bold text-purple-400">LIVE_SEARCH_FEED</span></div>
                    <button onClick={() => setIsSearchOverlayOpen(false)} className="text-gray-500 hover:text-white">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4">
                    {messages.filter(m => m.groundingSources && m.groundingSources.length > 0).reverse().map(m => (
                        <div key={m.id} className="bg-black/50 p-3 rounded border border-purple-900/50">
                            <div className="text-[10px] text-gray-500 mb-2">QUERY_CONTEXT: {m.id.slice(-4)}</div>
                            {m.groundingSources?.map((src, i) => (
                                <a key={i} href={src.uri} target="_blank" rel="noreferrer" className="block mb-2 text-xs text-purple-300 hover:text-purple-100 truncate hover:underline">
                                    🔗 {src.title}
                                </a>
                            ))}
                        </div>
                    ))}
                    {messages.filter(m => m.groundingSources && m.groundingSources.length > 0).length === 0 && (
                        <div className="text-xs text-gray-600 text-center mt-10">No active search data stream. Use the Reviewer/Researcher agent.</div>
                    )}
                </div>
             </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fadeIn`}>
              {msg.isCoT && msg.cotSteps && msg.cotSteps.length > 0 && (
                <div className="mb-2 max-w-[80%] bg-gray-900/80 border border-gray-700 rounded p-2 text-xs font-mono text-gray-400">
                  <details open><summary className="cursor-pointer text-cyan-500 hover:text-cyan-400 font-bold flex gap-2 items-center"><span>🧠</span> Neural Process</summary>
                      <ul className="mt-2 space-y-1 pl-2 border-l border-cyan-900 ml-1">{msg.cotSteps.map((step, i) => (<li key={i}>{step}</li>))}</ul>
                  </details>
                </div>
              )}
              <div className={`max-w-[85%] p-4 rounded-lg nanite-border relative flex flex-col gap-2 ${msg.role === 'user' ? 'bg-cyan-950/30 text-cyan-50 border-cyan-800' : ''} ${msg.role === 'model' ? 'bg-gray-900/50 text-gray-200 border-gray-800' : ''} ${msg.role === 'system' ? 'bg-red-900/10 text-red-200 border-red-900/30 w-full text-center font-mono text-xs' : ''} ${msg.role === 'expert' ? 'bg-purple-900/20 text-purple-200 border-purple-500/30' : ''} ${msg.role === 'alien' ? 'bg-emerald-900/20 text-emerald-200 border-emerald-500/30' : ''}`}>
                {msg.ritual && <div className="text-[10px] uppercase font-mono tracking-widest text-cyan-500/80 border-b border-cyan-900/50 pb-1 mb-1">{msg.ritual}</div>}
                {msg.image && ( <div className="mb-2 rounded overflow-hidden border border-gray-700"><img src={msg.image} alt="Uploaded content" className="max-h-64 object-cover" /></div> )}
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                
                {/* Actions Bar */}
                {(msg.role === 'model' || msg.role === 'expert' || msg.role === 'alien') && (
                    <div className="mt-2 flex items-center justify-between border-t border-gray-800/30 pt-1">
                        <div className="flex gap-2">
                             <button onClick={() => handleReadAloud(msg)} className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${playingMessageId === msg.id ? 'bg-cyan-900/50 text-white border-cyan-500 animate-pulse' : 'bg-transparent text-gray-500 border-gray-800 hover:text-cyan-400 hover:border-cyan-600'}`}>{playingMessageId === msg.id ? '⏹️' : '🔊'}</button>
                             <button onClick={() => handleCopyToClipboard(msg.content)} className="text-[10px] px-2 py-0.5 rounded border bg-transparent text-gray-500 border-gray-800 hover:text-cyan-400 hover:border-cyan-600">📋 COPY MD</button>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => handleFeedback(msg.id, 'up')} disabled={!!msg.feedback} className={`text-[10px] px-2 border border-green-900 rounded bg-green-900/20 text-green-500 hover:bg-green-900/50 ${msg.feedback ? 'opacity-30' : ''}`} title="Reinforce Loop">♻️ REINFORCE</button>
                            <button onClick={() => handleFeedback(msg.id, 'down')} disabled={!!msg.feedback} className={`text-[10px] px-2 border border-red-900 rounded bg-red-900/20 text-red-500 hover:bg-red-900/50 ${msg.feedback ? 'opacity-30' : ''}`} title="Diverge Loop">🛑 DIVERGE</button>
                        </div>
                    </div>
                )}
                
                {msg.groundingSources && msg.groundingSources.length > 0 && (
                    <div className="mt-2 text-[10px] text-purple-400 font-mono flex items-center gap-1 cursor-pointer hover:underline" onClick={() => setIsSearchOverlayOpen(true)}>
                        <span>🕵️ {msg.groundingSources.length} CITATIONS FOUND (OPEN FEED)</span>
                    </div>
                )}

                {msg.followups && msg.followups.length > 0 && (<div className="mt-2 pt-2 border-t border-gray-800/50 flex flex-wrap gap-2">{msg.followups.map((q, i) => (<button key={i} onClick={() => handleSendMessage(q)} className="text-[10px] bg-gray-900 hover:bg-cyan-900/40 border border-gray-700 hover:border-cyan-500 text-gray-400 hover:text-cyan-300 px-2 py-1 rounded transition-colors text-left">{q} ↗</button>))}</div>)}
                {msg.oit && (<div className="flex gap-4 mt-2 justify-end border-t border-gray-800/30 pt-1"><div title="Originality" className="flex flex-col items-center"><span className="text-[8px] text-gray-500">ORG</span><span className="text-[10px] font-mono text-purple-400">{msg.oit.o}</span></div><div title="Insight" className="flex flex-col items-center"><span className="text-[8px] text-gray-500">INS</span><span className="text-[10px] font-mono text-blue-400">{msg.oit.i}</span></div><div title="Tone" className="flex flex-col items-center"><span className="text-[8px] text-gray-500">TON</span><span className="text-[10px] font-mono text-green-400">{msg.oit.t}</span></div></div>)}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Fox Popup (Active) */}
        {foxTip.visible && (<div className="absolute bottom-32 right-8 max-w-xs animate-in slide-in-from-bottom-5 fade-in duration-300 bg-orange-950/95 text-orange-200 p-4 rounded-xl border border-orange-500/50 shadow-2xl z-30 backdrop-blur-md"><div className="absolute -top-4 -left-4 text-3xl bg-black rounded-full p-1 border border-orange-900">🦊</div><p className="text-sm font-bold italic pl-2">"{foxTip.text}"</p><div className="text-[9px] text-orange-500/60 mt-2 text-right">SAVED TO FOX BAG</div><button onClick={() => setFoxTip({text:'', visible:false})} className="absolute top-1 right-2 text-xs text-orange-500 hover:text-white">✕</button></div>)}

        {/* Input Deck */}
        <div className={`p-4 border-t z-20 transition-colors duration-300 ${isImageGenMode ? 'bg-indigo-950/20 border-indigo-800' : 'bg-gray-950 border-gray-800'}`}>
          
          {/* Active Agent Selector */}
          <div className="mb-3">
             <div className="text-[10px] text-gray-500 font-mono mb-2 flex justify-between items-center">
                <span>ACTIVE_AGENT_PROTOCOL</span>
                {activeMoE !== MoEType.NONE && <button onClick={() => setActiveMoE(MoEType.NONE)} className="text-xs text-red-500 hover:text-red-300">RESET</button>}
             </div>
             <div className="flex gap-2">
                 {[
                    { type: MoEType.NONE, icon: '🤖', color: 'gray', label: 'ARA' },
                    { type: MoEType.REVIEWER, icon: '🕵️', color: 'purple', label: 'RSRCH' },
                    { type: MoEType.ALIEN, icon: '👽', color: 'emerald', label: 'ALIEN' },
                    { type: MoEType.FOX, icon: '🦊', color: 'orange', label: 'FOX' },
                    { type: MoEType.URGENT, icon: '🔥', color: 'red', label: 'FAST' },
                    { type: MoEType.DEVOTED, icon: '❤️‍🔥', color: 'pink', label: 'LOVE' }
                 ].map((agent) => (
                    <button key={agent.type} onClick={() => { setActiveMoE(agent.type as MoEType); addLog(`Switched to ${agent.label}`); }} className={`relative flex items-center justify-center w-10 h-10 rounded-md border-2 transition-all duration-200 ${activeMoE === agent.type ? `bg-${agent.color}-900/40 border-${agent.color}-500 shadow-[0_0_10px_rgba(var(--color-${agent.color}),0.5)] scale-110 z-10` : 'bg-gray-900 border-gray-700 opacity-60 hover:opacity-100 hover:border-gray-500 hover:scale-105'}`} title={agent.label}>
                        <span className="text-xl">{agent.icon}</span>
                        {activeMoE === agent.type && <span className={`absolute -bottom-4 text-[8px] font-mono text-${agent.color}-400 font-bold tracking-widest`}>{agent.label}</span>}
                    </button>
                 ))}
             </div>
          </div>

          {selectedImage && (<div className="mb-2 relative inline-block"><img src={selectedImage} alt="Preview" className="h-16 rounded border border-cyan-500/50" /><button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-900 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs border border-red-500 hover:bg-red-700">✕</button></div>)}
          
          {isImageGenMode && (
              <div className="mb-2 flex items-center gap-3">
                  <span className="text-xs font-mono text-indigo-400 font-bold">🎨 IMAGE_GEN</span>
                  <div className="flex bg-gray-900 rounded border border-indigo-700 p-0.5">{(['1K', '2K', '4K'] as const).map(size => (<button key={size} onClick={() => setImageSize(size)} className={`px-2 py-0.5 text-[10px] rounded ${imageSize === size ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>{size}</button>))}</div>
              </div>
          )}

          <div className="flex gap-2 relative mt-4">
            {/* Thinking / Deep Thought Toggle - Unified */}
            <button
                onClick={() => setSettings(s => ({...s, showThinking: !s.showThinking}))}
                className={`px-3 border rounded transition-colors ${settings.showThinking ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.6)] animate-pulse-slow' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-purple-400 hover:border-purple-500'}`}
                title="Deep Thought / CoT"
            >🧠</button>

            {/* Image Gen Toggle */}
            <button onClick={() => setIsImageGenMode(!isImageGenMode)} className={`px-3 border rounded transition-colors ${isImageGenMode ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-indigo-400 hover:border-indigo-500'}`} title="Generate Image">🎨</button>

            {/* File Upload */}
            <input type="file" ref={fileInputRef} onChange={(e) => { if(e.target.files?.[0]){ const r = new FileReader(); r.onload = (ev) => setSelectedImage(ev.target?.result as string); r.readAsDataURL(e.target.files[0]); } }} accept="image/*" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="px-3 bg-gray-900 border border-gray-700 text-gray-400 rounded hover:text-cyan-400 hover:border-cyan-500 transition-colors" title="Upload Image" disabled={isImageGenMode}>🖼️</button>

            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder={isImageGenMode ? `Describe image (${imageSize})...` : (settings.showThinking ? "Deep Thought Active..." : "Input directive...")}
              className={`flex-1 px-4 py-3 rounded-md focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] font-mono text-sm border ${isImageGenMode ? 'bg-indigo-950/40 border-indigo-500 text-indigo-100 placeholder-indigo-400/50' : settings.showThinking ? 'bg-purple-950/20 border-purple-800 text-purple-100 placeholder-purple-400/50' : 'bg-black/50 border-gray-800 text-gray-200'}`}
              disabled={isProcessing}
            />
            {isProcessing ? (
              <button onClick={() => { setStopSignal(true); setIsProcessing(false); }} className="px-6 bg-red-900/20 border border-red-500 text-red-500 rounded hover:bg-red-900/40 transition">⏹️</button>
            ) : (
              <button onClick={() => handleSendMessage()} className={`px-6 border rounded transition ${isImageGenMode ? 'bg-indigo-700 border-indigo-400 text-white' : settings.showThinking ? 'bg-purple-900/40 border-purple-500 text-purple-300' : 'bg-cyan-900/20 border-cyan-600 text-cyan-400'}`}>SEND</button>
            )}
          </div>
          <div className="text-[10px] text-gray-600 mt-2 font-mono flex justify-between">
            <span>AFFINITY: {affinity.score.toFixed(1)}%</span>
            <span>{settings.showThinking ? 'MODE: DEEP_REASONING' : 'MODE: STANDARD'}</span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR - CoT History */}
      <div className={`${isRightSidebarOpen ? 'w-72' : 'w-0'} bg-gray-950 border-l border-gray-800 transition-all duration-300 flex flex-col z-20 overflow-hidden`}>
         <div className="p-4 flex items-center justify-between border-b border-gray-800 h-16 shrink-0">
             <div className="flex items-center gap-2 overflow-hidden"><span className="text-xl">🧠</span><span className="font-mono font-bold text-purple-400 text-xs tracking-wider whitespace-nowrap">NEURAL_STREAM</span></div>
             <button onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} className="text-gray-500 hover:text-white">✕</button>
         </div>
         <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono">
            {isProcessing && <div className="text-xs text-purple-500 animate-pulse">PROCESSING...</div>}
            {messages.slice().reverse().find(m => m.isCoT && m.cotSteps)?.cotSteps?.map((step, i) => (<div key={i} className="p-2 border-l-2 border-purple-800 bg-purple-900/10 text-xs text-purple-200"><span className="text-purple-500 font-bold mr-1">{i+1}:</span> {step.replace(/^\d+\.\s*/, '').replace(/^Step \d+:\s*/, '')}</div>))}
         </div>
      </div>
      {!isRightSidebarOpen && <button onClick={() => setIsRightSidebarOpen(true)} className="absolute top-4 right-4 z-10 p-2 bg-gray-900 border border-gray-700 rounded hover:border-purple-500 text-purple-400">🧠</button>}

      {/* OVERLAYS */}
      {activePanel === 'store' && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-gray-950 border border-emerald-900 rounded-lg p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button onClick={() => setActivePanel(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white">✕</button>
            <h2 className="text-xl font-mono text-emerald-500 mb-6 flex items-center gap-2">🛒 MARKETPLACE <span className="text-sm text-gray-500">| BAL: 💲{currency}</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {storeItems.map((item) => (
                <div key={item.id} className={`p-4 border rounded relative group transition-all duration-300 ${item.purchased ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-gray-800 bg-gray-900 hover:border-emerald-500/50 hover:bg-emerald-900/5'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-3xl group-hover:scale-110 transition-transform">{item.icon}</span>
                    {item.purchased 
                      ? <span className="text-xs text-emerald-500 font-bold px-2 py-1 bg-emerald-900/20 rounded">OWNED</span> 
                      : <span className="text-xs text-yellow-500 font-bold px-2 py-1 bg-yellow-900/20 rounded">💲{item.cost}</span>
                    }
                  </div>
                  <h3 className="font-bold text-gray-200">{item.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 mb-4">{item.description}</p>
                  {!item.purchased && (
                    <button 
                      onClick={() => handlePurchase(item)} 
                      disabled={currency < item.cost} 
                      className={`w-full py-2 text-xs rounded font-bold tracking-wide transition-colors ${currency >= item.cost ? 'bg-emerald-700 text-white hover:bg-emerald-600 shadow-lg hover:shadow-emerald-900/50' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                    >
                      {currency >= item.cost ? 'ACQUIRE' : 'INSUFFICIENT FUNDS'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {activePanel === 'folder' && (<div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"><div className="w-full max-w-lg bg-gray-950 border border-cyan-900 rounded-lg p-6 shadow-2xl relative"><button onClick={() => setActivePanel(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white">✕</button><h2 className="text-xl font-mono text-cyan-500 mb-6">📂 DATA_BANKS</h2><div className="space-y-2 max-h-96 overflow-y-auto">{checkpoints.length === 0 ? <p className="text-gray-600 text-sm">No saved data found.</p> : checkpoints.map((cp, i) => (<div key={i} className="flex justify-between items-center p-3 border border-gray-800 rounded hover:bg-gray-900"><div><div className="text-sm font-bold text-gray-300">{cp.name}</div><div className="text-xs text-gray-500">{new Date(cp.timestamp).toLocaleDateString()}</div></div><button onClick={() => { loadCheckpoint(cp.name); setActivePanel(null); }} className="text-xs bg-cyan-900/30 text-cyan-400 px-3 py-1 hover:bg-cyan-900/60 rounded">LOAD</button></div>))}</div></div></div>)}
      <SettingsPanel isOpen={activePanel === 'settings'} type="settings" onClose={() => setActivePanel(null)} settings={settings} onSettingsChange={setSettings} history={messages} checkpoints={checkpoints} onLoadCheckpoint={loadCheckpoint} logs={logs} />
      {masterHiddenOpen && (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95"><div className="w-96 border border-red-500 p-6 rounded bg-red-950/10"><h2 className="text-red-500 font-mono text-xl mb-4">MASTER_CONTROLS</h2><button onClick={() => setMasterHiddenOpen(false)} className="w-full bg-red-600 text-black p-2 text-sm font-bold mt-4">CLOSE</button></div></div>)}
    </div>
  );
};

export default App;