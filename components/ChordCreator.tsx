import React, { useState } from 'react';
import { Save, X, RotateCcw, Music } from 'lucide-react';
import { ChordCategory } from '../types';
import { CHORD_CATEGORIES } from '../constants';

interface ChordCreatorProps {
  selectedNotes: Set<number>;
  onSave: (name: string, category: ChordCategory) => void;
  onCancel: () => void;
  onClear: () => void;
}

const ChordCreator: React.FC<ChordCreatorProps> = ({
  selectedNotes,
  onSave,
  onCancel,
  onClear
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ChordCategory>('Outros');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setError('O nome é obrigatório.');
      return;
    }
    if (selectedNotes.size === 0) {
      setError('Selecione pelo menos uma nota no teclado.');
      return;
    }
    onSave(name, category);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Music className="text-primary-500" />
          Criar Novo Acorde
        </h2>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto pb-20">
        {/* Name Input */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Nome do Acorde
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="Ex: C Maj7"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-primary-500 focus:outline-none text-lg"
          />
        </div>

        {/* Category Select */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Categoria
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CHORD_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`py-2 px-3 rounded-md text-xs md:text-sm font-medium transition-all border ${
                  category === cat
                    ? 'bg-primary-600 border-primary-500 text-white shadow-glow'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Notes Display */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-sm">Notas Selecionadas:</span>
            <button 
              onClick={onClear}
              className="text-xs flex items-center gap-1 text-red-400 hover:text-red-300"
            >
              <RotateCcw size={12} /> Limpar
            </button>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {Array.from(selectedNotes).sort((a: number, b: number) => a - b).map(noteIdx => (
              <span key={noteIdx} className="px-3 py-1 bg-primary-900/50 text-primary-300 rounded-full text-sm border border-primary-500/30">
                Nota {noteIdx}
              </span>
            ))}
            {selectedNotes.size === 0 && (
              <span className="text-gray-600 italic text-sm py-1">Toque nas teclas abaixo para selecionar...</span>
            )}
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-900/50">
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <Save size={20} />
          Salvar Acorde
        </button>
      </div>
    </div>
  );
};

export default ChordCreator;