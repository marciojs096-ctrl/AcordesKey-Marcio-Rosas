
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Storage for our loaded sounds
  private samples: Map<number, AudioBuffer> = new Map();
  private activeSources: Map<number, { source: AudioBufferSourceNode; gain: GainNode }> = new Map();
  
  private isPianoLoaded: boolean = false;
  private useCustomSample: boolean = false;
  private customSampleBuffer: AudioBuffer | null = null;

  // IndexedDB Config
  private readonly DB_NAME = 'AcordesKeyAudioDB';
  private readonly STORE_NAME = 'samples';
  private readonly SAMPLE_KEY = 'user_piano_sample';

  public async initialize() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8; 
      this.masterGain.connect(this.ctx.destination);
      
      // Try to load user sample first, if fails/empty, load default
      const userSampleLoaded = await this.loadSavedSample();
      if (userSampleLoaded) {
        console.log("User sample loaded from storage");
        this.useCustomSample = true;
      } else {
        this.loadDefaultPiano();
      }
    }
    
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // --- IndexedDB Logic ---

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      
      request.onerror = () => {
        console.error("IndexedDB error:", request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
    });
  }

  private async saveToDB(file: Blob) {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      store.put(file, this.SAMPLE_KEY);
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error("Failed to save to DB", e);
    }
  }

  private async loadFromDB(): Promise<Blob | null> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.get(this.SAMPLE_KEY);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error("Failed to load from DB", e);
      return null;
    }
  }

  public async clearCustomSample() {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      store.delete(this.SAMPLE_KEY);
      this.customSampleBuffer = null;
      this.useCustomSample = false;
      
      // Reload default if needed
      if (!this.isPianoLoaded) {
        this.loadDefaultPiano();
      }
      return true;
    } catch (e) {
      console.error("Error clearing sample", e);
      return false;
    }
  }

  private async loadSavedSample(): Promise<boolean> {
    try {
      const blob = await this.loadFromDB();
      if (blob && this.ctx) {
        const arrayBuffer = await blob.arrayBuffer();
        this.customSampleBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        return true;
      }
    } catch (e) {
      console.error("Error restoring saved sample", e);
    }
    return false;
  }

  // --- End IndexedDB Logic ---

  public async loadDefaultPiano() {
    if (this.isPianoLoaded) return;

    // Load samples for C1 through C7 to support the full range
    const notesToLoad = [
      { index: 0, url: 'https://raw.githubusercontent.com/fuhton/piano-mp3/master/piano-mp3/C1.mp3' },
      { index: 12, url: 'https://raw.githubusercontent.com/fuhton/piano-mp3/master/piano-mp3/C2.mp3' },
      { index: 24, url: 'https://raw.githubusercontent.com/fuhton/piano-mp3/master/piano-mp3/C3.mp3' },
      { index: 36, url: 'https://raw.githubusercontent.com/fuhton/piano-mp3/master/piano-mp3/C4.mp3' },
      { index: 48, url: 'https://raw.githubusercontent.com/fuhton/piano-mp3/master/piano-mp3/C5.mp3' },
      { index: 60, url: 'https://raw.githubusercontent.com/fuhton/piano-mp3/master/piano-mp3/C6.mp3' },
      { index: 72, url: 'https://raw.githubusercontent.com/fuhton/piano-mp3/master/piano-mp3/C7.mp3' },
    ];

    try {
      const promises = notesToLoad.map(async (note) => {
        const response = await fetch(note.url);
        const arrayBuffer = await response.arrayBuffer();
        if (this.ctx) {
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.samples.set(note.index, audioBuffer);
        }
      });

      await Promise.all(promises);
      this.isPianoLoaded = true;
    } catch (e) {
      console.error('Failed to load piano samples', e);
    }
  }

  public async loadUserSample(file: File): Promise<boolean> {
    if (!this.ctx) this.initialize();
    if (!this.ctx) return false;

    try {
      // Decode for immediate use
      const arrayBuffer = await file.arrayBuffer();
      // Clone buffer because decodeAudioData detaches it
      const bufferForDecode = arrayBuffer.slice(0); 
      
      this.customSampleBuffer = await this.ctx.decodeAudioData(bufferForDecode);
      this.useCustomSample = true;

      // Save to DB for persistence (fire and forget)
      this.saveToDB(new Blob([arrayBuffer])); // Save original data
      
      return true;
    } catch (e) {
      console.error('Error decoding user file', e);
      return false;
    }
  }

  public setUseCustomSample(use: boolean) {
    this.useCustomSample = use;
  }

  public isUsingCustomSample(): boolean {
    return this.useCustomSample;
  }

  public hasCustomSampleLoaded(): boolean {
    return !!this.customSampleBuffer;
  }

  private getClosestBuffer(noteIndex: number): { buffer: AudioBuffer, rootIndex: number } | null {
    if (this.useCustomSample && this.customSampleBuffer) {
      return { buffer: this.customSampleBuffer, rootIndex: 24 }; // Assuming C3
    }

    if (this.samples.size === 0) return null;

    let closestIndex = -1;
    let minDistance = 1000;

    for (const rootIndex of this.samples.keys()) {
      const dist = Math.abs(noteIndex - rootIndex);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = rootIndex;
      }
    }

    if (closestIndex !== -1) {
      return { buffer: this.samples.get(closestIndex)!, rootIndex: closestIndex };
    }
    return null;
  }

  public playNote(frequency: number, noteIndex: number) {
    if (!this.ctx || !this.masterGain) {
      this.initialize();
    }
    if (!this.ctx || !this.masterGain) return;

    this.stopNote(noteIndex);

    const sampleData = this.getClosestBuffer(noteIndex);

    if (!sampleData) {
      this.playOscillator(frequency, noteIndex);
      return;
    }

    const { buffer, rootIndex } = sampleData;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const semitones = noteIndex - rootIndex;
    const rate = Math.pow(2, semitones / 12);
    source.playbackRate.value = rate;

    const noteGain = this.ctx.createGain();
    noteGain.gain.value = 1.0;

    source.connect(noteGain);
    noteGain.connect(this.masterGain);

    source.start(0);

    this.activeSources.set(noteIndex, { source, gain: noteGain });
  }

  private playOscillator(frequency: number, noteIndex: number) {
     if (!this.ctx || !this.masterGain) return;
     const osc = this.ctx.createOscillator();
     const noteGain = this.ctx.createGain();
     osc.type = 'triangle';
     osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
     noteGain.gain.setValueAtTime(0, this.ctx.currentTime);
     noteGain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 0.05);
     osc.connect(noteGain);
     noteGain.connect(this.masterGain);
     osc.start();
     this.activeSources.set(noteIndex, { source: osc as unknown as AudioBufferSourceNode, gain: noteGain });
  }

  public stopNote(noteIndex: number) {
    if (!this.ctx) return;
    
    const record = this.activeSources.get(noteIndex);
    if (record) {
      const { source, gain } = record;
      const now = this.ctx.currentTime;
      const release = 0.3;

      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + release);

      try {
        source.stop(now + release);
      } catch (e) {
      }

      this.activeSources.delete(noteIndex);
    }
  }

  public playChord(frequencies: number[], noteIndices: number[]) {
    noteIndices.forEach((idx, i) => {
      this.playNote(frequencies[i], idx);
    });
  }

  public stopChord(noteIndices: number[]) {
    noteIndices.forEach(idx => this.stopNote(idx));
  }
}

export const audioEngine = new AudioEngine();