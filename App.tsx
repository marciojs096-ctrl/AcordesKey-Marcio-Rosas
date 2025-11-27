
import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_CHORDS } from './constants';
import { Chord, AppView } from './types';
import { saveCustomChords, loadCustomChords, generateShareUrl, importFromUrl } from './services/storageService';
import { audioEngine } from './services/audioEngine';
import Keyboard from './components/Keyboard';
import ChordLibrary from './components/ChordLibrary';
import ChordCreator from './components/ChordCreator';
import { PlusCircle, Piano, Volume2 } from 'lucide-react';

function App() {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [highlightedNotes, setHighlightedNotes] = useState<Set<number>>(new Set());
  const [chords, setChords] = useState<Chord[]>(DEFAULT_CHORDS);
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHORD_LIST);
  const [creatorNotes, setCreatorNotes] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'info'} | null>(null);
  
  // Initialize volume from the engine (which loads from storage)
  const [volume, setVolume] = useState(() => audioEngine.getVolume());
  
  // Initialize
  useEffect(() => {
    // 1. Load local chords
    const local = loadCustomChords();
    
    // 2. Check for shared chords in URL
    const shared = importFromUrl();
    
    let combined = [...DEFAULT_CHORDS, ...local];
    
    if (shared && shared.length > 0) {
      // Merge shared chords avoiding duplicates by ID
      const existingIds = new Set(combined.map(c => c.id));
      const newShared = shared.filter(c => !existingIds.has(c.id));
      
      if (newShared.length > 0) {
        combined = [...combined, ...newShared];
        setToast({ msg: `${newShared.length} novos acordes importados via Link!`, type: 'success' });
        // Clean URL without refresh
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    
    setChords(combined);
    
    // Initialize Audio Engine and Load Sounds
    const initAudio = async () => {
      await audioEngine.initialize();
      // Only remove if initialized, but initialize is idempotent-ish
      // We keep the listeners to ensure we unlock AudioContext on mobile
      if (audioEngine['ctx']?.state === 'running') {
         window.removeEventListener('click', initAudio);
         window.removeEventListener('touchstart', initAudio);
      }
    };

    window.addEventListener('click', initAudio);
    window.addEventListener('touchstart', initAudio);

    // Try auto init immediately (works on some desktops)
    initAudio();

    return () => {
        window.removeEventListener('click', initAudio);
        window.removeEventListener('touchstart', initAudio);
    }
  }, []);

  // Save changes to local storage whenever chords change
  useEffect(() => {
    saveCustomChords(chords);
  }, [chords]);

  const handleShare = () => {
    const url = generateShareUrl(chords);
    navigator.clipboard.writeText(url).then(() => {
      setToast({ msg: "Link copiado para a área de transferência!", type: 'success' });
    });
  };

  const handleForceSave = () => {
    saveCustomChords(chords);
    setToast({ msg: "Banco de dados salvo no dispositivo!", type: 'success' });
  };

  const handleImportFile = (importedChords: Chord[]) => {
    const existingIds = new Set(chords.map(c => c.id));
    
    // Sanitize imported data to ensure notes are numbers
    const validChords = importedChords.map(c => ({
      ...c,
      notes: Array.isArray(c.notes) ? c.notes.map(n => Number(n)).filter(n => !isNaN(n)) : []
    }));

    const newItems = validChords.filter(c => {
       if (existingIds.has(c.id)) return false;
       return true;
    });

    if (newItems.length === 0) {
      setToast({ msg: "Todos os acordes do arquivo já existem na biblioteca.", type: 'info' });
      return;
    }

    setChords(prev => [...prev, ...newItems]);
    setToast({ msg: `${newItems.length} acordes importados com sucesso!`, type: 'success' });
  };

  const handlePlayKeyboardNote = useCallback((idx: number) => {
    if (currentView === AppView.CHORD_CREATOR) {
      setCreatorNotes(prev => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        return next;
      });
      // Brief feedback sound
      const baseFreq = 32.703;
      const freq = baseFreq * Math.pow(2, idx / 12);
      audioEngine.playNote(freq, idx);
      setTimeout(() => audioEngine.stopNote(idx), 300);
    } else {
      setActiveNotes(prev => new Set(prev).add(idx));
    }
  }, [currentView]);

  const handleStopKeyboardNote = useCallback((idx: number) => {
    if (currentView !== AppView.CHORD_CREATOR) {
      setActiveNotes(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  }, [currentView]);

  const handlePlayChord = (chord: Chord) => {
    // Stop current
    audioEngine.stopChord(Array.from(highlightedNotes));
    
    // Visualize
    const noteSet = new Set(chord.notes);
    setHighlightedNotes(noteSet);

    // Calculate frequencies and play
    const baseFreq = 32.703;
    const frequencies = chord.notes.map(idx => baseFreq * Math.pow(2, idx / 12));
    audioEngine.playChord(frequencies, chord.notes);
  };

  const handleStopChord = () => {
    audioEngine.stopChord(Array.from(highlightedNotes));
    setHighlightedNotes(new Set());
  };

  const handleDeleteChord = (id: string) => {
    // No window.confirm here, UI handles it in ChordLibrary
    setChords(prev => prev.filter(c => c.id !== id));
    handleStopChord();
    setToast({ msg: "Acorde excluído.", type: 'success' });
  };

  const handleSaveNewChord = (name: string) => {
    const newChord: Chord = {
      id: uuidv4(),
      name,
      notes: Array.from(creatorNotes),
      isDefault: false
    };
    setChords(prev => [...prev, newChord]);
    setCreatorNotes(new Set());
    setCurrentView(AppView.CHORD_LIST);
    setToast({ msg: "Acorde salvo com sucesso!", type: 'success' });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = parseFloat(e.target.value);
    setVolume(newVal);
    audioEngine.setVolume(newVal);
  };

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    // Use h-full with parent body 100dvh for correct mobile height
    <div className="flex flex-col h-full w-full bg-gray-950 overflow-hidden relative">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-primary-500 text-white px-6 py-3 rounded-full shadow-2xl animate-bounce-in pointer-events-none text-center min-w-[300px]">
          {toast.msg}
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="flex bg-gray-900 border-b border-gray-800 shrink-0 z-40">
        <button 
          onClick={() => setCurrentView(AppView.CHORD_LIST)}
          className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs md:text-sm font-bold tracking-wide transition-colors
            ${currentView === AppView.CHORD_LIST ? 'text-primary-400 border-b-2 border-primary-500 bg-gray-800' : 'text-gray-500 hover:text-gray-300'}`}
        >
          LISTA
        </button>
        <button 
          onClick={() => setCurrentView(AppView.CHORD_CREATOR)}
          className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs md:text-sm font-bold tracking-wide transition-colors
            ${currentView === AppView.CHORD_CREATOR ? 'text-primary-400 border-b-2 border-primary-500 bg-gray-800' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <PlusCircle size={18} />
          CRIAR
        </button>
        <button 
          onClick={() => setCurrentView(AppView.FULL_PIANO)}
          className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs md:text-sm font-bold tracking-wide transition-colors
            ${currentView === AppView.FULL_PIANO ? 'text-primary-400 border-b-2 border-primary-500 bg-gray-800' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <Piano size={18} />
          PIANO
        </button>
      </div>
      
      {/* Full Piano Toolbar (Fixed Position above keyboard, not floating over keys) */}
      {currentView === AppView.FULL_PIANO && (
        <div className="bg-gray-800 border-b border-gray-700 p-2 flex items-center justify-end px-4 gap-3 z-30 shrink-0">
          <span className="text-xs text-gray-500 font-medium tracking-wider">VOLUME</span>
          <Volume2 size={16} className="text-gray-400" />
          <input 
            type="range" 
            min="0" 
            max="3" 
            step="0.1" 
            value={volume}
            onChange={handleVolumeChange}
            className="w-32 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
          />
        </div>
      )}

      {/* Main Content Area (Hidden in Full Piano Mode) */}
      {currentView !== AppView.FULL_PIANO && (
        <div className="flex-1 overflow-hidden relative">
          {currentView === AppView.CHORD_LIST && (
            <ChordLibrary 
              chords={chords}
              onPlayChord={handlePlayChord}
              onStopChord={handleStopChord}
              onDeleteChord={handleDeleteChord}
              onShare={handleShare}
              onImportChords={handleImportFile}
              onForceSave={handleForceSave}
              volume={volume}
              onVolumeChange={handleVolumeChange}
            />
          )}
          {currentView === AppView.CHORD_CREATOR && (
            <ChordCreator 
              selectedNotes={creatorNotes}
              onSave={handleSaveNewChord}
              onCancel={() => {
                setCreatorNotes(new Set());
                setCurrentView(AppView.CHORD_LIST);
              }}
              onClear={() => setCreatorNotes(new Set())}
            />
          )}
        </div>
      )}

      {/* Bottom Section: Piano Keyboard */}
      {/* Increased height on mobile from 40vh to 45dvh for better visibility */}
      <div className={`
        ${currentView === AppView.FULL_PIANO 
          ? 'flex-1 relative z-20 shadow-2xl bg-gray-900' // Full screen mode
          : 'h-[45dvh] min-h-[220px] border-t border-gray-800 shadow-2xl z-20 relative bg-gray-900'} // Split screen mode
      `}>
         {currentView === AppView.CHORD_CREATOR && creatorNotes.size > 0 && (
             <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg animate-pulse pointer-events-none z-30 whitespace-nowrap">
                Modo Edição: Toque para adicionar/remover
             </div>
         )}
         <Keyboard 
           activeNotes={currentView === AppView.CHORD_CREATOR ? creatorNotes : activeNotes}
           highlightedNotes={highlightedNotes}
           onPlayNote={handlePlayKeyboardNote}
           onStopNote={handleStopKeyboardNote}
           isCreatorMode={currentView === AppView.CHORD_CREATOR}
         />
      </div>
    </div>
  );
}

export default App;
