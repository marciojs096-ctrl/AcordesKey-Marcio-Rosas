
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  
  // Storage for our loaded sounds
  private samples: Map<number, AudioBuffer> = new Map();
  private activeSources: Map<number, { source: AudioBufferSourceNode; gain: GainNode }> = new Map();
  
  private isPianoLoaded: boolean = false;
  private useCustomSample: boolean = false;
  private customSampleBuffer: AudioBuffer | null = null;
  private customSampleRootIndex: number = 24; // Default to C3
  
  // Initialize volume from storage or default to 1.0
  private globalVolume: number = parseFloat(localStorage.getItem('triadkey_master_volume') || '1.0');

  // IndexedDB Config
  private readonly DB_NAME = 'AcordesKeyAudioDB';
  private readonly STORE_NAME = 'samples';
  private readonly SAMPLE_KEY = 'user_piano_sample';
  private readonly ROOT_KEY_INDEX = 'user_piano_root_index';

  public async initialize() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // 1. Create Compressor (Studio Quality sound leveling)
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      // 2. Create Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.globalVolume; 

      // 3. Connect Graph: Compressor -> Master -> Destination
      this.compressor.connect(this.masterGain);
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

  // --- Volume Control ---
  public setVolume(value: number) {
    this.globalVolume = value;
    // Save to local storage for persistence across reloads
    localStorage.setItem('triadkey_master_volume', value.toString());

    if (this.masterGain && this.ctx) {
      // Use setTargetAtTime for smooth volume transitions without clicking
      this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
    }
  }

  public getVolume(): number {
    return this.globalVolume;
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

  private async saveToDB(file: Blob, rootIndex?: number) {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      
      store.put(file, this.SAMPLE_KEY);
      if (rootIndex !== undefined) {
        store.put(rootIndex, this.ROOT_KEY_INDEX);
      }
      
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error("Failed to save to DB", e);
    }
  }

  private async loadFromDB(): Promise<{blob: Blob | null, rootIndex: number | null}> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      
      const blobReq = store.get(this.SAMPLE_KEY);
      const rootReq = store.get(this.ROOT_KEY_INDEX);
      
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          resolve({
            blob: blobReq.result || null,
            rootIndex: rootReq.result !== undefined ? rootReq.result : null
          });
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error("Failed to load from DB", e);
      return { blob: null, rootIndex: null };
    }
  }

  public async clearCustomSample() {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      store.delete(this.SAMPLE_KEY);
      store.delete(this.ROOT_KEY_INDEX);
      
      this.customSampleBuffer = null;
      this.useCustomSample = false;
      this.customSampleRootIndex = 24; // Reset to C3
      
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
      const { blob, rootIndex } = await this.loadFromDB();
      if (blob && this.ctx) {
        const arrayBuffer = await blob.arrayBuffer();
        this.customSampleBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        if (rootIndex !== null) {
          this.customSampleRootIndex = rootIndex;
        }
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

    // Switching to Salamander Grand Piano samples (High Quality, Mellow)
    const baseUrl = 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/piano/';
    
    const notesToLoad = [
      { index: 0, file: 'C1.mp3' },
      { index: 12, file: 'C2.mp3' },
      { index: 24, file: 'C3.mp3' },
      { index: 36, file: 'C4.mp3' },
      { index: 48, file: 'C5.mp3' },
      { index: 60, file: 'C6.mp3' },
      { index: 72, file: 'C7.mp3' }, 
    ];

    try {
      const promises = notesToLoad.map(async (note) => {
        const response = await fetch(baseUrl + note.file);
        if (!response.ok) throw new Error(`Failed to load ${note.file}`);
        const arrayBuffer = await response.arrayBuffer();
        if (this.ctx) {
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.samples.set(note.index, audioBuffer);
        }
      });

      await Promise.all(promises);
      this.isPianoLoaded = true;
      console.log('High Quality Piano Samples Loaded');
    } catch (e) {
      console.error('Failed to load piano samples, falling back to soft synth', e);
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
      this.saveToDB(new Blob([arrayBuffer]), this.customSampleRootIndex); 
      
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
  
  public setCustomRootIndex(index: number) {
    this.customSampleRootIndex = index;
    // Update DB
    if (this.customSampleBuffer) {
        this.openDB().then(db => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            tx.objectStore(this.STORE_NAME).put(index, this.ROOT_KEY_INDEX);
        });
    }
  }
  
  public getCustomRootIndex(): number {
    return this.customSampleRootIndex;
  }

  private getClosestBuffer(noteIndex: number): { buffer: AudioBuffer, rootIndex: number } | null {
    if (this.useCustomSample && this.customSampleBuffer) {
      return { buffer: this.customSampleBuffer, rootIndex: this.customSampleRootIndex };
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
    if (!this.ctx || !this.masterGain || !this.compressor) {
      this.initialize();
    }
    if (!this.ctx || !this.masterGain || !this.compressor) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.stopNote(noteIndex);

    const sampleData = this.getClosestBuffer(noteIndex);

    if (!sampleData) {
      this.playOscillator(frequency, noteIndex);
      return;
    }

    const { buffer, rootIndex } = sampleData;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Use detune (cents) instead of playbackRate for better mobile compatibility
    const semitones = noteIndex - rootIndex;
    source.detune.value = semitones * 100;

    const noteGain = this.ctx.createGain();
    noteGain.gain.value = 1.0; 

    // Connect: Source -> NoteGain -> Compressor -> MasterGain -> Speaker
    source.connect(noteGain);
    noteGain.connect(this.compressor);

    source.start(0);

    this.activeSources.set(noteIndex, { source, gain: noteGain });
  }

  private playOscillator(frequency: number, noteIndex: number) {
     if (!this.ctx || !this.masterGain || !this.compressor) return;
     const osc = this.ctx.createOscillator();
     const noteGain = this.ctx.createGain();
     
     osc.type = 'sine'; 
     osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
     
     const now = this.ctx.currentTime;
     noteGain.gain.setValueAtTime(0, now);
     noteGain.gain.linearRampToValueAtTime(0.3, now + 0.05); 
     noteGain.gain.exponentialRampToValueAtTime(0.01, now + 1.5); 
     
     osc.connect(noteGain);
     noteGain.connect(this.compressor);
     
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
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    noteIndices.forEach((idx, i) => {
      this.playNote(frequencies[i], idx);
    });
  }

  public stopChord(noteIndices: number[]) {
    noteIndices.forEach(idx => this.stopNote(idx));
  }
}

export const audioEngine = new AudioEngine();
