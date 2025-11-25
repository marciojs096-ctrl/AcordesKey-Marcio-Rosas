import React, { useMemo } from 'react';
import { NOTES_DATA } from '../constants';
import { Note } from '../types';
import PianoKey from './PianoKey';
import { audioEngine } from '../services/audioEngine';

interface KeyboardProps {
  activeNotes: Set<number>;
  highlightedNotes: Set<number>;
  onPlayNote: (idx: number) => void;
  onStopNote: (idx: number) => void;
  isCreatorMode?: boolean;
}

const Keyboard: React.FC<KeyboardProps> = ({ 
  activeNotes, 
  highlightedNotes, 
  onPlayNote, 
  onStopNote,
  isCreatorMode 
}) => {
  
  // Generate 5 Octaves + 1 note (C2 to C7) = 61 keys
  // Start at index 12 (C2) relative to C1 (0)
  const keys = useMemo(() => {
    const generatedKeys: Note[] = [];
    const baseFreq = 32.703; // C1 frequency (approx)
    const startKey = 12; // Start at C2
    const totalKeys = 61; // 5 Octaves (C2 to C7 inclusive)

    for (let i = 0; i < totalKeys; i++) {
      const absIndex = startKey + i;
      const noteData = NOTES_DATA[absIndex % 12];
      const octave = Math.floor(absIndex / 12) + 1;
      // Formula: f = f0 * (2)^(n/12)
      const frequency = baseFreq * Math.pow(2, absIndex / 12);

      generatedKeys.push({
        index: absIndex,
        name: noteData.name,
        isSharp: noteData.isSharp,
        octave,
        frequency,
      });
    }
    return generatedKeys;
  }, []);

  const handlePress = (idx: number) => {
    // In creator mode, we toggle instead of just momentary play
    if (!isCreatorMode) {
      // Find note in our generated keys array
      const note = keys.find(k => k.index === idx);
      if (note) {
        audioEngine.playNote(note.frequency, idx);
      }
    }
    onPlayNote(idx);
  };

  const handleRelease = (idx: number) => {
    if (!isCreatorMode) {
      audioEngine.stopNote(idx);
    }
    onStopNote(idx);
  };

  const getNoteLabel = (note: Note) => {
    if (!note.isSharp) {
      return note.name; // Removed octave number (e.g. "C" instead of "C2")
    }
    // Map sharps to flats for display
    // C# -> Db, D# -> Eb, etc.
    const flatMap: Record<string, string> = {
      'C#': 'Db', 
      'D#': 'Eb', 
      'F#': 'Gb', 
      'G#': 'Ab', 
      'A#': 'Bb'
    };
    return `${note.name}\n${flatMap[note.name] || ''}`;
  };

  return (
    <div className="w-full h-full bg-gray-900 overflow-x-auto overflow-y-hidden shadow-inner custom-scrollbar relative">
      {/* 
        Container for keys. 
        Using inline-flex to allow it to expand horizontally as much as needed.
        pt-1 to give room at top.
        pb-[env(safe-area-inset-bottom)] ensures the scrollbar and keys aren't hidden behind gesture bars.
        min-h-full forces container to fill height.
      */}
      <div 
        className="inline-flex h-full px-4 pt-1 min-w-max"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
         {keys.map((note) => {
           return (
             <PianoKey
               key={note.index}
               index={note.index}
               isSharp={note.isSharp}
               noteName={getNoteLabel(note)}
               isActive={activeNotes.has(note.index)}
               isHighlighted={highlightedNotes.has(note.index)}
               onPress={handlePress}
               onRelease={handleRelease}
             />
           );
         })}
      </div>
    </div>
  );
};

export default Keyboard;