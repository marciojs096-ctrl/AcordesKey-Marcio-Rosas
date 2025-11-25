
export interface Note {
  index: number; // 0 to 36 (C1 to C4)
  name: string;
  octave: number;
  isSharp: boolean;
  frequency: number;
}

export type ChordCategory = 
  | 'Maior' 
  | 'Menor' 
  | 'Diminuto' 
  | 'Meio Diminuto' 
  | 'Maior 7' 
  | 'Maior 7M' 
  | 'Menor 7' 
  | 'Menor 7M' 
  | 'Maior 9' 
  | 'Maior 7M(9)' 
  | 'Dominante 9'
  | 'Outros';

export interface Chord {
  id: string;
  name: string;
  notes: number[]; // Array of Note indices
  isDefault?: boolean;
  category?: ChordCategory;
}

export enum AppView {
  KEYBOARD = 'KEYBOARD',
  CHORD_LIST = 'CHORD_LIST',
  CHORD_CREATOR = 'CHORD_CREATOR',
  FULL_PIANO = 'FULL_PIANO',
}
