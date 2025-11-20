export interface AudioFileState {
  file: File | null;
  url: string | null;
  name: string;
  duration: number;
  buffer: AudioBuffer | null;
}

export interface ProcessingStats {
  oldDuration: number;
  newDuration: number;
  timeSaved: number;
  processingTime: number;
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  PROCESSING = 'PROCESSING',
  EDITOR = 'EDITOR'
}

export interface WaveformProps {
  audioBuffer: AudioBuffer | null;
  isPlaying: boolean;
  currentTime: number;
  silenceThreshold: number; // 0 to 1
  minSilenceDuration: number; // in seconds
  showSilence: boolean;
  onSeek: (time: number) => void;
  height?: number;
}
