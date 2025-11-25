
import React, { useState, useMemo, useRef } from 'react';
import { Chord, ChordCategory } from '../types';
import { CHORD_CATEGORIES } from '../constants';
import { Play, Trash2, Search, Music2, Download, Upload, Music, Settings, AlertTriangle, Volume2 } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface ChordLibraryProps {
  chords: Chord[];
  onPlayChord: (chord: Chord) => void;
  onStopChord: () => void;
  onDeleteChord: (id: string) => void;
  onShare: () => void;
  onImportChords: (importedChords: Chord[]) => void;
  onForceSave: () => void;
  volume: number;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const FILTER_CATEGORIES: (ChordCategory | 'Todos' | 'Consonantes')[] = [
  'Todos',
  'Consonantes',
  ...CHORD_CATEGORIES
];

const ChordLibrary: React.FC<ChordLibraryProps> = ({
  chords,
  onPlayChord,
  onStopChord,
  onDeleteChord,
  onShare,
  onImportChords,
  onForceSave,
  volume,
  onVolumeChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeChordId, setActiveChordId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  
  // State for modals
  const [chordToDelete, setChordToDelete] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredChords = useMemo(() => {
    return chords.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (selectedCategory === 'Todos') return true;
      if (selectedCategory === 'Consonantes') {
        return c.category === 'Maior' || c.category === 'Menor';
      }
      if (c.category === selectedCategory) return true;
      if (selectedCategory === 'Outros') {
        return !c.category || c.category === 'Outros';
      }
      return false;
    });
  }, [chords, searchTerm, selectedCategory]);

  const handlePlay = (chord: Chord) => {
    // Ensure audio context is running (fix for iOS/Android suspend)
    if (audioEngine['ctx']?.state === 'suspended') {
      audioEngine['ctx'].resume();
    }
    
    if (activeChordId === chord.id) {
      onStopChord();
      setActiveChordId(null);
    } else {
      setActiveChordId(chord.id);
      onPlayChord(chord);
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chords, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "KeyMarcioRosas_Backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          onImportChords(parsed);
        } else {
          alert("Arquivo inválido: O formato deve ser uma lista de acordes.");
        }
      } catch (err) {
        console.error(err);
        alert("Erro ao ler o arquivo.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const confirmDelete = () => {
    if (chordToDelete) {
      onDeleteChord(chordToDelete);
      setChordToDelete(null);
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-gray-900 text-white relative">
      
      {/* Delete Confirmation Modal */}
      {chordToDelete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 shadow-2xl max-w-sm w-full transform scale-100">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center text-red-500">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Excluir Acorde?</h3>
                <p className="text-gray-400 text-sm">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex w-full gap-3 mt-2">
                <button 
                  onClick={() => setChordToDelete(null)}
                  className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium shadow-lg shadow-red-900/20 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header / Toolbar */}
      <div className="p-4 border-b border-gray-800 flex flex-col gap-4 shadow-md z-10 bg-gray-900">
        
        {/* Top Control Row */}
        <div className="flex justify-between items-center gap-2">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-purple-500 truncate hidden xs:block">
            Key Márcio Rosas
          </h2>
          <h2 className="text-lg font-bold text-primary-400 xs:hidden">
            Key
          </h2>
          
          <div className="flex gap-2">
             <button 
              onClick={handleExport}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-blue-400 border border-gray-700"
              title="Exportar Backup (JSON)"
            >
              <Download size={18} />
            </button>

            <button 
              onClick={handleImportClick}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-orange-400 border border-gray-700"
              title="Importar Backup"
            >
              <Upload size={18} />
            </button>
            
            <button 
              onClick={() => setShowSoundSettings(!showSoundSettings)}
              className={`p-2 rounded-lg transition-colors border border-gray-700 ${showSoundSettings ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              title="Configurar Sons"
            >
              <Music size={18} />
            </button>
          </div>
          
          <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
        </div>

        {/* Sound Settings Panel */}
        {showSoundSettings && (
          <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 animate-in fade-in slide-in-from-top-2">
             <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Settings size={14} /> Configuração de Som
                </h4>
             </div>
             
             {/* Volume Slider */}
             <div className="space-y-1 mb-3">
               <div className="flex justify-between text-xs text-gray-400">
                 <span className="flex items-center gap-1"><Volume2 size={12}/> Volume / Ganho</span>
                 <span>{Math.round(volume * 100)}%</span>
               </div>
               <input 
                 type="range" 
                 min="0" 
                 max="3" 
                 step="0.1" 
                 value={volume} 
                 onChange={onVolumeChange}
                 className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
               />
               <div className="flex justify-between text-[10px] text-gray-600 px-1">
                 <span>0%</span>
                 <span>100%</span>
                 <span>200%</span>
                 <span>300%</span>
               </div>
             </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input 
            type="text" 
            placeholder="Buscar acordes..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-primary-500 transition-colors text-sm"
          />
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4">
           {FILTER_CATEGORIES.map(cat => (
             <button
               key={cat}
               onClick={() => setSelectedCategory(cat)}
               className={`
                 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                 ${selectedCategory === cat 
                   ? 'bg-primary-600 border-primary-500 text-white shadow-glow' 
                   : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}
               `}
             >
               {cat}
             </button>
           ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
          {filteredChords.map(chord => (
            <div 
              key={chord.id}
              className={`
                relative group p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-24 select-none
                ${activeChordId === chord.id 
                  ? 'bg-primary-900/40 border-primary-500 shadow-glow' 
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600 hover:bg-gray-750'}
              `}
              onClick={() => handlePlay(chord)}
            >
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-sm md:text-base truncate pr-8" title={chord.name}>{chord.name}</h3>
                
                {/* Fixed Delete Button */}
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setChordToDelete(chord.id);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute -top-1 -right-1 w-10 h-10 flex items-center justify-center z-30 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-full transition-colors"
                  title="Excluir"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              
              <div className="flex justify-between items-end mt-1">
                <span className="text-[10px] text-gray-500 font-mono bg-gray-900/50 px-1.5 py-0.5 rounded">
                   {chord.category || 'Outros'}
                 </span>
                 <div className={`
                   w-7 h-7 rounded-full flex items-center justify-center transition-colors
                   ${activeChordId === chord.id ? 'bg-primary-500 text-white' : 'bg-gray-700 text-gray-400 group-hover:bg-gray-600'}
                 `}>
                   <Play size={12} fill={activeChordId === chord.id ? "currentColor" : "none"} />
                 </div>
              </div>
            </div>
          ))}
        </div>

        {filteredChords.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 text-center p-6">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Music2 size={32} className="text-gray-600" />
            </div>
            <p className="text-lg font-semibold text-gray-400">Banco vazio</p>
            <p className="text-sm max-w-xs mt-2">
              {chords.length === 0 
                ? "Seu banco de acordes está vazio. Vá até a aba 'Criar' ou Importe um arquivo."
                : "Nenhum acorde encontrado nesta categoria."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChordLibrary;
