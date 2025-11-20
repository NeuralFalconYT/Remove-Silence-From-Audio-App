import React from 'react';
import { X, HelpCircle } from 'lucide-react';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({ isOpen, onClose }) => {
  return (
    <div 
      className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-tape-dark/95 backdrop-blur-xl text-white transform transition-transform duration-300 z-50 overflow-y-auto shadow-2xl border-l border-white/10 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="p-8 flex flex-col h-full relative">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
           <h2 className="text-2xl font-bold flex items-center gap-2 text-tape-primary">
             <HelpCircle className="opacity-100" />
             How to use
           </h2>
           <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors">
             <X size={24} />
           </button>
        </div>

        {/* Instructions */}
        <div className="space-y-10 flex-1">
          
          <div className="relative pl-8 border-l-2 border-tape-primary/30">
            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-tape-primary shadow-[0_0_10px_rgba(124,58,237,0.5)]" />
            <h3 className="text-xl font-bold mb-2">1. Upload (Left Panel)</h3>
            <p className="opacity-70 leading-relaxed text-sm">
              Start by dragging and dropping your audio file into the left panel, or click to browse your device.
            </p>
          </div>

          <div className="relative pl-8 border-l-2 border-tape-primary/30">
            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-tape-primary shadow-[0_0_10px_rgba(124,58,237,0.5)]" />
            <h3 className="text-xl font-bold mb-2">2. Configure & Process</h3>
            <p className="opacity-70 leading-relaxed text-sm">
              Adjust the <b>Remove pauses longer than</b> slider on the left to set your threshold, then click the purple <b>Process Audio</b> button.
            </p>
          </div>

          <div className="relative pl-8 border-l-2 border-tape-primary/30">
            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-tape-primary shadow-[0_0_10px_rgba(124,58,237,0.5)]" />
            <h3 className="text-xl font-bold mb-2">3. Preview Results (Right Panel)</h3>
            <p className="opacity-70 leading-relaxed text-sm">
              Once processed, the result appears on the right. Use the toggle switch to compare the <b>Original</b> vs <b>Processed</b> audio.
            </p>
          </div>

          <div className="relative pl-8 border-l-2 border-tape-primary/30">
             <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-tape-primary shadow-[0_0_10px_rgba(124,58,237,0.5)]" />
            <h3 className="text-xl font-bold mb-2">4. Export</h3>
            <p className="opacity-70 leading-relaxed text-sm">
              Click <b>Download Audio</b> to save your new file, or use <b>Copy URL</b> to share a simulation link.
            </p>
          </div>

          <div className="relative pl-8 border-l-2 border-red-500/30">
             <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
            <h3 className="text-xl font-bold mb-2 text-red-400">5. Auto-Deletion</h3>
            <p className="opacity-70 leading-relaxed text-sm">
              Your file will be deleted automatically after 1 hour. Please ensure you download your results.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-xs opacity-40 text-right">© 2025 • Neural Falcon</p>
        </div>
      </div>
    </div>
  );
};