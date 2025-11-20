import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Download, Link as LinkIcon, Play, Pause, X, HelpCircle, Scissors, Wand2, UploadCloud, Sparkles, CheckCircle2, AudioWaveform, RefreshCcw, Check } from 'lucide-react';
import { SidePanel } from './components/SidePanel';
import { Waveform } from './components/Waveform';
import { AudioFileState, ProcessingStats } from './types';
import { formatTime, analyzeSilence, processAudio, createProcessedBuffer, generateUUID } from './utils/audio';

const App: React.FC = () => {
  const [sidePanelOpen, setSidePanelOpen] = useState(false); 
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Audio State
  const [audioState, setAudioState] = useState<AudioFileState>({
    file: null,
    url: null,
    name: '',
    duration: 0,
    buffer: null
  });

  // Processed State
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [processedStats, setProcessedStats] = useState<ProcessingStats | null>(null);
  const [lastProcessedConfig, setLastProcessedConfig] = useState<{fileId: string, duration: number} | null>(null);

  // App Logic State
  const [hasProcessed, setHasProcessed] = useState(false);
  const [isProcessingUI, setIsProcessingUI] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [removeSilenceActive, setRemoveSilenceActive] = useState(false);
  const [isProcessingDownload, setIsProcessingDownload] = useState(false);
  
  // Processing Parameters
  const [maxSilenceDuration, setMaxSilenceDuration] = useState(0.5); // Seconds

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultContainerRef = useRef<HTMLDivElement>(null);

  // Computed Silence Regions (Calculated on fly for visualizer of original)
  const silenceRegions = useMemo(() => {
      if (!audioState.buffer) return [];
      return analyzeSilence(audioState.buffer, maxSilenceDuration);
  }, [audioState.buffer, maxSilenceDuration]);

  // Initialize AudioContext
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
        if (audioContextRef.current?.state !== 'closed') {
            audioContextRef.current?.close();
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
        alert('Please upload an audio file.');
        return;
    }

    setIsAnalyzing(true);
    setHasProcessed(false); 
    setProcessedBuffer(null);
    setLastProcessedConfig(null);
    handleResetPlayback();
    
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = audioContextRef.current!;
    try {
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const url = URL.createObjectURL(file);
        
        setAudioState({
            file,
            url,
            name: file.name,
            duration: decodedBuffer.duration,
            buffer: decodedBuffer
        });
    } catch (e) {
        console.error(e);
        alert("Error decoding audio file.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const getActiveBuffer = () => {
      return removeSilenceActive && processedBuffer ? processedBuffer : audioState.buffer;
  };

  const getActiveDuration = () => {
      const buf = getActiveBuffer();
      return buf ? buf.duration : 0;
  };

  const playAudio = (startOffset?: number) => {
    const buffer = getActiveBuffer();
    if (!audioContextRef.current || !buffer) return;
    
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }

    // Stop existing source if any
    if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    const duration = buffer.duration;
    // Use provided offset or fall back to tracked time
    const offset = startOffset !== undefined ? startOffset : (pausedTimeRef.current % duration);
    
    source.start(0, offset);
    
    startTimeRef.current = audioContextRef.current.currentTime - offset;
    sourceNodeRef.current = source;
    setIsPlaying(true);

    // Cancel existing loop
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }

    const animate = () => {
        const now = audioContextRef.current!.currentTime;
        let progress = now - startTimeRef.current;
        
        if (progress >= duration) {
            pauseAudio();
            setCurrentTime(0);
            pausedTimeRef.current = 0;
        } else {
            setCurrentTime(progress);
            animationFrameRef.current = requestAnimationFrame(animate);
        }
    };
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const pauseAudio = () => {
    if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (audioContextRef.current) {
        pausedTimeRef.current = audioContextRef.current.currentTime - startTimeRef.current;
    }
    
    setIsPlaying(false);
  };

  const handleResetPlayback = () => {
      pauseAudio();
      setCurrentTime(0);
      pausedTimeRef.current = 0;
  };

  const togglePlay = () => {
    if (isPlaying) pauseAudio();
    else playAudio();
  };

  const handleToggleView = () => {
      const newState = !removeSilenceActive;
      // Stop playback, reset time, update state
      if (isPlaying) {
          pauseAudio();
      }
      setCurrentTime(0);
      pausedTimeRef.current = 0;
      setRemoveSilenceActive(newState);
      
      // Optional: Auto-play when switching views? 
      // User requirement was about seeking, but auto-playing here might be jarring. 
      // We'll keep it paused to be safe unless requested otherwise.
  };

  const handleSeek = (time: number) => {
      // Update time references
      pausedTimeRef.current = time;
      setCurrentTime(time);
      
      // If it was playing, restart immediately from new time
      if (isPlaying) {
          playAudio(time);
      }
  };

  const handleResetFile = () => {
      handleResetPlayback();
      setAudioState({ file: null, url: null, name: '', duration: 0, buffer: null });
      setHasProcessed(false);
      setProcessedBuffer(null);
      setRemoveSilenceActive(false);
      setMaxSilenceDuration(0.5);
  };

  const handleDownload = async () => {
    if (!audioState.buffer) return;
    setIsProcessingDownload(true);
    
    setTimeout(async () => {
        try {
            const wavBlob = processAudio(audioState.buffer!, silenceRegions);
            const uuid = generateUUID().slice(0, 8);
            const originalName = audioState.name.replace(/\.[^/.]+$/, "");
            const filename = `${originalName}_clean_${uuid}.wav`;
            
            const url = URL.createObjectURL(wavBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to process audio.");
        } finally {
            setIsProcessingDownload(false);
        }
    }, 100);
  };

  const handleCopyUrl = () => {
      const uuid = generateUUID();
      const fakeUrl = `${window.location.origin}/share/${uuid}`;
      navigator.clipboard.writeText(fakeUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
  };

  const handleProcessClick = async () => {
      if (!audioState.buffer || !audioContextRef.current) return;
      
      if (hasProcessed && lastProcessedConfig?.fileId === audioState.name && lastProcessedConfig?.duration === maxSilenceDuration) {
          setRemoveSilenceActive(true);
          return;
      }

      setIsProcessingUI(true);
      setHasProcessed(false);
      
      // Reduced delay for snappy feel (600ms)
      setTimeout(() => {
          const buffer = audioState.buffer!;
          
          const totalSilence = silenceRegions.reduce((acc, region) => acc + (region.end - region.start), 0);
          const oldDuration = buffer.duration;
          const newDuration = Math.max(0, oldDuration - totalSilence);
          const processingTime = oldDuration * 0.15; 

          const pBuffer = createProcessedBuffer(buffer, silenceRegions, audioContextRef.current!);
          
          setProcessedStats({
              oldDuration,
              newDuration,
              timeSaved: totalSilence,
              processingTime
          });
          setProcessedBuffer(pBuffer);
          setLastProcessedConfig({ fileId: audioState.name, duration: maxSilenceDuration });
          
          setHasProcessed(true);
          setIsProcessingUI(false);
          setRemoveSilenceActive(true);
          handleResetPlayback();

      }, 600); 
  };

  const triggerFileInput = () => {
      fileInputRef.current?.click();
  }

  return (
    <div className="min-h-screen w-full bg-tape-black text-tape-text bg-grain font-sans overflow-hidden flex relative selection:bg-tape-primary selection:text-white">
      
      <div className="absolute inset-0 pointer-events-none z-0 mix-blend-overlay opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      
      {/* Background Glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-tape-primary/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

      <main className={`flex-1 flex flex-col relative z-10 transition-all duration-300 ${sidePanelOpen ? 'mr-0 md:mr-96' : 'mr-0'}`}>
        
        {/* Header */}
        <header className="px-6 py-8 flex justify-center items-center relative z-20">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-tape-primary rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(124,58,237,0.4)] ring-1 ring-white/20">
                <AudioWaveform className="text-white" size={24} />
             </div>
             <h1 className="text-4xl font-bold tracking-tighter text-white drop-shadow-lg bg-clip-text text-transparent bg-gradient-to-r from-white to-tape-muted/80">
                Silence Remover
             </h1>
          </div>
          
          <button 
            onClick={() => setSidePanelOpen(true)}
            className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 text-sm font-medium text-tape-muted hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-full border border-white/10 hover:bg-white/10 hover:border-white/20 backdrop-blur-md"
          >
            <HelpCircle size={16} />
            <span className="hidden sm:inline">Help</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
            <div className="max-w-screen-2xl w-full mx-auto">
                
                {/* PERMANENT SPLIT GRID LAYOUT */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* LEFT COLUMN (Controls / Upload) - Span 4 */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        
                        {/* 1. UPLOAD BOX OR CONTROLS */}
                        {!audioState.buffer ? (
                            /* UPLOAD STATE */
                            <div 
                                onClick={triggerFileInput}
                                className={`glass-card w-full aspect-[4/5] lg:aspect-auto lg:h-[500px] rounded-3xl flex flex-col items-center justify-center p-8 text-center transition-all duration-500 cursor-pointer group relative overflow-hidden ${
                                    isDragOver ? 'border-tape-primary bg-tape-primary/10 scale-[1.02]' : 'hover:border-tape-primary/50 hover:bg-white/5'
                                }`}
                                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={onDrop}
                            >
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept="audio/*" 
                                    onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                                    className="hidden"
                                />
                                {isAnalyzing ? (
                                    <div className="flex flex-col items-center justify-center z-10">
                                        <div className="w-14 h-14 border-4 border-tape-primary border-t-transparent rounded-full animate-spin mb-6"></div>
                                        <p className="text-xl font-medium text-white animate-pulse">Analyzing Audio...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-8 z-10">
                                        <div className="w-24 h-24 bg-[#1A1A1D] rounded-full flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-500 group-hover:border-tape-primary/50 shadow-2xl group-hover:shadow-tape-primary/20">
                                            <UploadCloud size={42} className="text-tape-primary group-hover:text-white transition-colors" />
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-bold mb-3 text-white tracking-tight">Upload Audio</h2>
                                            <p className="text-tape-muted text-base px-4 leading-relaxed">
                                                Drag & drop your audio file here <br/>or click to browse
                                            </p>
                                            <div className="flex gap-2 justify-center mt-8">
                                                <span className="text-[10px] font-bold bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-tape-muted uppercase tracking-wider">WAV</span>
                                                <span className="text-[10px] font-bold bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-tape-muted uppercase tracking-wider">MP3</span>
                                                <span className="text-[10px] font-bold bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-tape-muted uppercase tracking-wider">M4A</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* CONTROLS STATE */
                            <div className="animate-fade-in space-y-6">
                                {/* File Info */}
                                <div className="glass-card bg-[#18181b] rounded-2xl p-5 shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-tape-primary"></div>
                                    <div className="flex items-center justify-between mb-4 pl-3">
                                        <span className="text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> File Loaded
                                        </span>
                                        <button 
                                            onClick={handleResetFile}
                                            className="p-2 bg-white/10 hover:bg-red-500/20 rounded-full transition-colors text-white hover:text-red-400 border border-white/5 group/x"
                                            title="Close and remove file"
                                        >
                                            <X size={18} className="group-hover/x:scale-110 transition-transform" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-4 pl-2">
                                        <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                                            <Scissors size={22} className="text-tape-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-white font-bold text-lg truncate pr-2" title={audioState.name}>{audioState.name}</h3>
                                            <p className="text-sm text-tape-muted font-mono mt-0.5">{formatTime(audioState.duration)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Slider */}
                                <div className="glass-card bg-[#18181b] rounded-2xl p-6 shadow-xl">
                                    <div className="flex justify-between items-center mb-8">
                                        <label className="text-white font-bold flex items-center gap-2.5 text-lg">
                                            <Wand2 size={20} className="text-tape-primary" />
                                            Remove pauses longer than
                                        </label>
                                        <span className="font-mono text-sm text-white bg-tape-primary/20 px-3 py-1 rounded-md border border-tape-primary/30 shadow-[0_0_10px_rgba(124,58,237,0.2)]">
                                            {maxSilenceDuration.toFixed(1)}s
                                        </span>
                                    </div>
                                    <div className="relative h-8 flex items-center mb-4 cursor-pointer group px-1">
                                        {/* Track Background - Explicitly styled for visibility */}
                                        <div className="absolute w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-tape-primary to-tape-primaryHover transition-all duration-100" 
                                                style={{width: `${(maxSilenceDuration / 5) * 100}%`}}
                                            />
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0.1" 
                                            max="5" 
                                            step="0.1"
                                            value={maxSilenceDuration}
                                            onChange={(e) => setMaxSilenceDuration(parseFloat(e.target.value))}
                                            className="absolute w-full h-full opacity-0 cursor-pointer z-20"
                                        />
                                        <div 
                                            className="absolute w-6 h-6 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.4)] border-4 border-tape-primary pointer-events-none transition-all z-10"
                                            style={{left: `calc(${(maxSilenceDuration / 5) * 100}% - 12px)`}}
                                        />
                                    </div>
                                    <p className="text-xs text-tape-muted mt-6 leading-relaxed border-t border-white/5 pt-4 flex items-center gap-1.5 flex-wrap">
                                        Silence longer than 
                                        <span className="text-tape-primary font-bold bg-tape-primary/10 px-1.5 py-0.5 rounded border border-tape-primary/20">
                                            {maxSilenceDuration.toFixed(1)} seconds
                                        </span> 
                                        will be removed.
                                    </p>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    <button 
                                        onClick={handleProcessClick}
                                        disabled={isProcessingUI}
                                        className="w-full bg-gradient-to-r from-tape-primary to-[#6d28d9] text-white py-5 rounded-2xl font-bold text-lg shadow-[0_10px_30px_rgba(124,58,237,0.3)] hover:shadow-[0_10px_50px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-80 disabled:cursor-not-allowed disabled:transform-none group relative overflow-hidden border border-white/10"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]"></div>
                                        {isProcessingUI ? (
                                            <span className="flex items-center gap-3">
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Processing...
                                            </span>
                                        ) : (
                                            <>
                                                <Sparkles size={20} className={hasProcessed ? "text-yellow-300" : ""} />
                                                {hasProcessed ? 'Reprocess Audio' : 'Process Audio'}
                                            </>
                                        )}
                                    </button>
                                    
                                    <button 
                                        onClick={handleResetFile}
                                        className="w-full bg-[#27272a] hover:bg-[#3f3f46] text-white py-4 rounded-2xl font-bold text-sm border border-white/10 hover:border-white/30 shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
                                    >
                                        <RefreshCcw size={16} className="opacity-80" />
                                        Upload New Audio
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN (Results / Animation) - Span 8 */}
                    <div className="lg:col-span-8 min-h-[500px] flex flex-col relative">
                        
                        {/* CONDITION 1: PROCESSING ANIMATION */}
                        {isProcessingUI && (
                            <div className="absolute inset-0 z-20 glass-card bg-black/60 rounded-3xl flex flex-col items-center justify-center overflow-hidden">
                                <div className="relative w-64 h-64 flex items-center justify-center">
                                    {/* Spinning Rings */}
                                    <div className="absolute inset-0 border-2 border-tape-primary/30 rounded-full animate-[spin_3s_linear_infinite]"></div>
                                    <div className="absolute inset-8 border-2 border-tape-primary/50 rounded-full animate-[spin_4s_linear_infinite_reverse]"></div>
                                    
                                    {/* Center Icon */}
                                    <div className="relative z-10 bg-black p-6 rounded-2xl border border-tape-primary shadow-[0_0_50px_rgba(124,58,237,0.4)]">
                                        <Wand2 size={48} className="text-tape-primary animate-pulse" />
                                    </div>
                                    
                                    {/* Scanning Line */}
                                    <div className="absolute w-full h-20 bg-gradient-to-b from-tape-primary/20 to-transparent animate-scan opacity-50 blur-md"></div>
                                </div>
                                <h3 className="text-3xl font-bold text-white mt-8 animate-pulse tracking-tight">Optimizing Audio...</h3>
                                <p className="text-tape-muted mt-3">Removing silence patterns</p>
                            </div>
                        )}

                        {/* CONDITION 2: RESULT VIEW */}
                        {hasProcessed && audioState.buffer ? (
                            <div ref={resultContainerRef} className={`space-y-6 transition-all duration-700 ${isProcessingUI ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                                
                                {/* PLAYER CARD */}
                                <div className="glass-card bg-[#18181b] rounded-3xl overflow-hidden shadow-2xl relative group ring-1 ring-white/5">
                                    
                                    {/* Visualizer Area */}
                                    <div className="h-48 bg-[#0c0c0e] relative flex items-center justify-center border-b border-white/10">
                                        <div className="absolute inset-0 w-full h-full">
                                            <Waveform 
                                                audioBuffer={getActiveBuffer()}
                                                currentTime={currentTime}
                                                duration={getActiveDuration()}
                                                silenceRegions={removeSilenceActive ? [] : silenceRegions}
                                                onSeek={handleSeek}
                                                height={192} 
                                            />
                                        </div>
                                        
                                        {/* Big Play Button Overlay */}
                                        <button 
                                            onClick={togglePlay}
                                            className="absolute z-20 w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-110 transition-transform active:scale-95 hover:shadow-[0_0_50px_rgba(255,255,255,0.5)]"
                                        >
                                            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                                        </button>
                                    </div>

                                    {/* Player Controls Footer */}
                                    <div className="px-6 py-4 bg-[#18181b] grid grid-cols-3 items-center">
                                        
                                        {/* Left: Empty or extra controls */}
                                        <div className="justify-self-start text-xs font-medium text-tape-muted hidden md:block">
                                            {removeSilenceActive ? 'Processed Audio' : 'Original Audio'}
                                        </div>
                                        
                                        {/* Center: Toggle Switch */}
                                        <div className="justify-self-center flex items-center gap-4 bg-black/40 px-5 py-2.5 rounded-full border border-white/5 shadow-inner">
                                            <span className={`text-xs font-bold uppercase tracking-wider transition-colors ${!removeSilenceActive ? 'text-white' : 'text-tape-muted'}`}>Original</span>
                                            <div className="relative w-12 h-7">
                                                <input 
                                                    type="checkbox" 
                                                    id="toggle-player" 
                                                    className="toggle-checkbox"
                                                    checked={removeSilenceActive}
                                                    onChange={handleToggleView}
                                                />
                                                <label htmlFor="toggle-player" className="toggle-label w-full h-full shadow-inner cursor-pointer block rounded-full bg-tape-gray relative transition-colors border border-white/5">
                                                    <span className="toggle-circle w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 left-1 transition-transform"></span>
                                                </label>
                                            </div>
                                            <span className={`text-xs font-bold uppercase tracking-wider transition-colors ${removeSilenceActive ? 'text-tape-primary drop-shadow-[0_0_8px_rgba(124,58,237,0.8)]' : 'text-tape-muted'}`}>Processed</span>
                                        </div>
                                        
                                        {/* Right: Time Display */}
                                        <div className="justify-self-end text-sm font-mono text-tape-muted flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                            <span className="text-white">{formatTime(currentTime)}</span>
                                            <span className="opacity-30">|</span>
                                            <span>{formatTime(getActiveDuration())}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* STATS ROW */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="glass-card bg-[#18181b] rounded-2xl p-6 flex flex-col items-center justify-center gap-2 shadow-lg">
                                        <p className="text-tape-muted text-[10px] uppercase tracking-widest font-bold">Original Duration</p>
                                        <p className="text-xl font-mono text-white/70">{formatTime(processedStats?.oldDuration || 0)}</p>
                                    </div>
                                    <div className="glass-card bg-gradient-to-b from-[#18181b] to-tape-primary/10 border-tape-primary/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 relative overflow-hidden shadow-[0_0_30px_rgba(124,58,237,0.1)]">
                                        <p className="text-tape-primary text-[10px] uppercase tracking-widest font-bold relative z-10">New Duration</p>
                                        <p className="text-3xl font-mono text-white font-bold relative z-10 drop-shadow-md">{formatTime(processedStats?.newDuration || 0)}</p>
                                        {processedStats && (
                                            <div className="absolute top-3 right-3 bg-green-500/10 text-green-400 text-[10px] font-bold px-2 py-1 rounded-full border border-green-500/20 shadow-[0_0_10px_rgba(74,222,128,0.2)]">
                                                -{processedStats.timeSaved.toFixed(1)}s
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* DOWNLOAD ACTIONS */}
                                <div className="flex gap-4 pt-2">
                                    <button 
                                        onClick={handleDownload}
                                        disabled={isProcessingDownload}
                                        className="flex-[2] bg-white hover:bg-gray-100 text-black h-16 rounded-2xl font-bold text-lg shadow-[0_10px_30px_rgba(255,255,255,0.1)] hover:scale-[1.01] hover:shadow-[0_15px_40px_rgba(255,255,255,0.2)] transition-all flex items-center justify-center gap-3 active:scale-95"
                                    >
                                        {isProcessingDownload ? (
                                            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                        ) : (
                                            <Download size={22} className="stroke-[2.5]" />
                                        )}
                                        Download Audio
                                    </button>
                                    <button 
                                        onClick={handleCopyUrl}
                                        className={`flex-1 h-16 rounded-2xl font-bold text-base flex items-center justify-center gap-2 border transition-all shadow-lg ${
                                            isCopied 
                                              ? 'bg-green-500/10 border-green-500/50 text-green-400' 
                                              : 'bg-[#18181b] hover:bg-white/10 border-white/10 hover:border-white/30 text-white'
                                        }`}
                                    >
                                        {isCopied ? (
                                            <>
                                                <CheckCircle2 size={20} />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <LinkIcon size={20} />
                                                Copy URL
                                            </>
                                        )}
                                    </button>
                                </div>

                            </div>
                        ) : (
                            /* CONDITION 3: EMPTY / IDLE STATE */
                            <div className={`h-full min-h-[400px] border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center p-10 transition-opacity duration-500 bg-white/[0.02] ${isProcessingUI ? 'opacity-0' : 'opacity-100'}`}>
                                {audioState.buffer ? (
                                    <>
                                        <div className="w-20 h-20 bg-[#18181b] rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
                                            <Sparkles size={32} className="text-tape-gray" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-3">Ready to Process</h3>
                                        <p className="text-tape-muted/50 text-center max-w-xs leading-relaxed">
                                            Your audio is loaded. Configure settings on the left and click Process to generate your clean audio.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-20 h-20 bg-[#18181b] rounded-full flex items-center justify-center mb-6 border border-white/5">
                                            <div className="w-2.5 h-2.5 bg-tape-gray rounded-full animate-bounce mr-1.5"></div>
                                            <div className="w-2.5 h-2.5 bg-tape-gray rounded-full animate-bounce delay-75 mr-1.5"></div>
                                            <div className="w-2.5 h-2.5 bg-tape-gray rounded-full animate-bounce delay-150"></div>
                                        </div>
                                        <h3 className="text-xl font-bold text-tape-muted/30 mb-2">Waiting for audio...</h3>
                                    </>
                                )}
                            </div>
                        )}

                    </div>

                </div>
            </div>
        </div>
      </main>

      <SidePanel isOpen={sidePanelOpen} onClose={() => setSidePanelOpen(false)} />
      
    </div>
  );
};

export default App;