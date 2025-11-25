
import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_CHORDS } from './constants';
import { Chord, AppView, ChordCategory } from './types';
import { saveCustomChords, loadCustomChords, generateShareUrl, importFromUrl } from './services/storageService';
import { audioEngine } from './services/audioEngine';
import Keyboard from './components/Keyboard';
import ChordLibrary from './components/ChordLibrary';
import ChordCreator from './components/ChordCreator';
import { Library, PlusCircle, Piano, Volume2, Smartphone, X, Share, MoreVertical } from 'lucide-react';

function App() {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [highlightedNotes, setHighlightedNotes] = useState<Set<number>>(new Set());
  const [chords, setChords] = useState<Chord[]>(DEFAULT_CHORDS);
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHORD_LIST);
  const [creatorNotes, setCreatorNotes] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'info'} | null>(null);
  
  // Initialize volume from the engine (which loads from storage)
  const [volume, setVolume] = useState(() => audioEngine.getVolume());
  
  // Install / PWA State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false); // The "Do you want to install?" question
  const [showIOSInstructions, setShowIOSInstructions] = useState(false); // The instructions for iOS
  const [showAndroidInstructions, setShowAndroidInstructions] = useState(false); // Manual instructions for Android/Chrome

  // Initialize
  useEffect(() => {
    // Detect iOS
    const iosCheck = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iosCheck);

    // Check if running in standalone (installed) mode
    const checkStandalone = () => {
      const isStd = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsStandalone(!!isStd);
    };
    checkStandalone();
    window.addEventListener('resize', checkStandalone); // Sometimes changes on rotation/launch

    // If on iOS and not installed, and haven't asked yet in this session
    if (iosCheck && !isStandalone && !sessionStorage.getItem('installPromptSeen')) {
       setTimeout(() => setShowInstallModal(true), 3000);
    }

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

    // Listen for install prompt (Android/Desktop)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      console.log('Install prompt captured');
      
      // If not installed and haven't asked yet
      if (!window.matchMedia('(display-mode: standalone)').matches && !sessionStorage.getItem('installPromptSeen')) {
        setTimeout(() => setShowInstallModal(true), 3000);
      }
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
        window.removeEventListener('click', initAudio);
        window.removeEventListener('touchstart', initAudio);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('resize', checkStandalone);
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

  // Unified install handler (called by Modal or Button)
  const handleInstallClick = async () => {
    setShowInstallModal(false);
    sessionStorage.setItem('installPromptSeen', 'true');

    if (isIOS) {
      setShowIOSInstructions(true);
    } else if (installPrompt) {
      // Native prompt available
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallPrompt(null);
      }
    } else {
      // No native prompt (Manual Android/Chrome instructions)
      setShowAndroidInstructions(true);
    }
  };

  const handleDismissInstall = () => {
    setShowInstallModal(false);
    sessionStorage.setItem('installPromptSeen', 'true');
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

  const handleSaveNewChord = (name: string, category: ChordCategory) => {
    const newChord: Chord = {
      id: uuidv4(),
      name,
      notes: Array.from(creatorNotes),
      isDefault: false,
      category: category
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

      {/* Auto Install Invite Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
           <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 shadow-2xl max-w-sm w-full text-center">
              <div className="w-16 h-16 bg-primary-600/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary-400">
                 <Smartphone size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Instalar Key Márcio Rosas?</h3>
              <p className="text-gray-300 text-sm mb-6">
                 Instale o aplicativo para ter acesso <strong>Offline</strong> e usar em <strong>Tela Cheia</strong>.
              </p>
              <div className="flex gap-3">
                 <button 
                   onClick={handleDismissInstall}
                   className="flex-1 py-3 text-gray-400 font-medium hover:text-white"
                 >
                   Agora não
                 </button>
                 <button 
                   onClick={handleInstallClick}
                   className="flex-1 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-bold shadow-lg shadow-primary-900/20"
                 >
                   Instalar
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* iOS Installation Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowIOSInstructions(false)}>
           <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 shadow-2xl max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setShowIOSInstructions(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
              <h3 className="text-lg font-bold text-white mb-4 text-center">Instalar no iPhone/iPad</h3>
              <ol className="text-gray-300 text-sm space-y-4 list-decimal pl-4">
                <li>
                  Toque no botão <strong>Compartilhar</strong> <Share size={14} className="inline mx-1"/> na barra do navegador.
                </li>
                <li>
                  Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.
                </li>
                <li>
                  Toque em <strong>Adicionar</strong>.
                </li>
              </ol>
              <button 
                onClick={() => setShowIOSInstructions(false)}
                className="w-full mt-6 py-3 bg-primary-600 rounded-lg text-white font-bold"
              >
                Entendi
              </button>
           </div>
        </div>
      )}

      {/* Android/Chrome Manual Instructions Modal */}
      {showAndroidInstructions && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowAndroidInstructions(false)}>
           <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 shadow-2xl max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setShowAndroidInstructions(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
              <h3 className="text-lg font-bold text-white mb-4 text-center">Instalar Aplicativo</h3>
              <p className="text-xs text-gray-400 mb-4 text-center">A instalação automática não está disponível. Siga os passos:</p>
              <ol className="text-gray-300 text-sm space-y-4 list-decimal pl-4">
                <li>
                  Toque no botão de menu do navegador (Geralmente <strong>3 pontinhos</strong> <MoreVertical size={14} className="inline"/> no canto).
                </li>
                <li>
                  Procure por <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                </li>
                <li>
                  Confirme a instalação.
                </li>
              </ol>
              <button 
                onClick={() => setShowAndroidInstructions(false)}
                className="w-full mt-6 py-3 bg-primary-600 rounded-lg text-white font-bold"
              >
                Entendi
              </button>
           </div>
        </div>
      )}

      {/* Floating Volume Control for Full Piano */}
      {currentView === AppView.FULL_PIANO && (
        <div className="absolute top-16 right-4 z-30 flex items-center gap-2 bg-gray-800/90 p-2 rounded-lg border border-gray-700 backdrop-blur-sm shadow-lg">
          <Volume2 size={16} className="text-gray-400" />
          <input 
            type="range" 
            min="0" 
            max="3" 
            step="0.1" 
            value={volume}
            onChange={handleVolumeChange}
            className="w-24 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
          />
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="flex bg-gray-900 border-b border-gray-800 shrink-0 z-40">
        <button 
          onClick={() => setCurrentView(AppView.CHORD_LIST)}
          className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs md:text-sm font-bold tracking-wide transition-colors
            ${currentView === AppView.CHORD_LIST ? 'text-primary-400 border-b-2 border-primary-500 bg-gray-800' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <Library size={18} />
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
