import { Chord, ChordCategory } from './types';

// Frequencies calculated starting from C1 (~32.70 Hz)
// We generate 3 octaves + 1 note (C1 to C4)
export const NOTES_DATA = [
  { name: 'C', isSharp: false },
  { name: 'C#', isSharp: true },
  { name: 'D', isSharp: false },
  { name: 'D#', isSharp: true },
  { name: 'E', isSharp: false },
  { name: 'F', isSharp: false },
  { name: 'F#', isSharp: true },
  { name: 'G', isSharp: false },
  { name: 'G#', isSharp: true },
  { name: 'A', isSharp: false },
  { name: 'A#', isSharp: true },
  { name: 'B', isSharp: false },
];

export const CHORD_CATEGORIES: ChordCategory[] = [
  'Maior', 
  'Menor', 
  'Diminuto', 
  'Meio Diminuto', 
  'Maior 7', 
  'Maior 7M', 
  'Menor 7', 
  'Menor 7M', 
  'Maior 9', 
  'Maior 7M(9)', 
  'Dominante 9',
  'Outros'
];

// Empty by default as requested
export const DEFAULT_CHORDS: Chord[] = [];