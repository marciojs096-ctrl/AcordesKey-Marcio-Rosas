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
  
  // Generate 7 Octaves + 1 note (C1 to C8) = 85 keys
  // Start at index 0 (C1)
  const keys = useMemo(() => {
    const generatedKeys: Note[] = [];
    const baseFreq = 32.703; // C1
    const totalKeys = 85; // C1 to C8 inclusive

    for (let i = 0; i < totalKeys; i++) {
      const noteData = NOTES_DATA[i % 12];
      const octave = Math.floor(i / 12) + 1;
      // Formula: f = f0 * (2)^(n/12)
      const frequency = baseFreq * Math.pow(2, i / 12);

      generatedKeys.push({
        index: i,
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
      const note = keys[idx];
      audioEngine.playNote(note.frequency, idx);
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
      return `${note.name}${note.octave}`;
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
    <div className="w-full h-full bg-gray-900 overflow-x-auto overflow-y-hidden shadow-inner custom-scrollbar">
      {/* 
        Container for keys. 
        Using inline-flex to allow it to expand horizontally as much as needed.
        pt-2 pb-4 to give some breathing room.
      */}
      <div className="inline-flex h-full px-4 pt-1 pb-2 min-w-max">
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