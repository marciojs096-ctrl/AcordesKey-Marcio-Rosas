import { Chord } from '../types';

const STORAGE_KEY = 'triadkey_custom_chords';

export const saveCustomChords = (chords: Chord[]) => {
  try {
    const customOnly = chords.filter(c => !c.isDefault);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
  } catch (e) {
    console.error("Failed to save chords", e);
  }
};

export const loadCustomChords = (): Chord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load chords", e);
    return [];
  }
};

export const generateShareUrl = (chords: Chord[]): string => {
  const customOnly = chords.filter(c => !c.isDefault);
  if (customOnly.length === 0) return window.location.href.split('?')[0];

  const json = JSON.stringify(customOnly);
  // Simple encoding for URL safety
  const encoded = btoa(json); 
  const url = new URL(window.location.href);
  url.searchParams.set('data', encoded);
  return url.toString();
};

export const importFromUrl = (): Chord[] | null => {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('data');
  if (!data) return null;

  try {
    const json = atob(data);
    const chords = JSON.parse(json);
    if (Array.isArray(chords)) {
      return chords;
    }
  } catch (e) {
    console.error("Failed to import chords from URL", e);
  }
  return null;
};
