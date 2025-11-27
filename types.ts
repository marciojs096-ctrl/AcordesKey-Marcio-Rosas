
export interface Note {
  index: number; // 0 to 36 (C1 to C4)
  name: string;
  octave: number;
  isSharp: boolean;
  frequency: number;
}

export interface Chord {
  id: string;
  name: string;
  notes: number[]; // Array of Note indices
  isDefault?: boolean;
}

export enum AppView {
  KEYBOARD = 'KEYBOARD',
  CHORD_LIST = 'CHORD_LIST',
  CHORD_CREATOR = 'CHORD_CREATOR',
  FULL_PIANO = 'FULL_PIANO',
}