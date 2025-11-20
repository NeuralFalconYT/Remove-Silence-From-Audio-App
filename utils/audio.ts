
// Simulates checking for silence regions
// Threshold is now essentially fixed for "true silence" or noise floor
export const analyzeSilence = (
  buffer: AudioBuffer, 
  minDuration: number // in seconds
): { start: number; end: number }[] => {
  const rawData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const silenceRegions: { start: number; end: number }[] = [];
  
  // Fixed low threshold for "silence" (removes background hiss if set slightly higher, or exact 0 if set to 0)
  const threshold = 0.015; 
  
  let isSilent = false;
  let silenceStart = 0;
  
  // Optimization: Step by 200 samples for performance while retaining accuracy
  const step = 200; 
  
  for (let i = 0; i < rawData.length; i += step) {
    const amplitude = Math.abs(rawData[i]);
    
    if (amplitude < threshold) {
      if (!isSilent) {
        isSilent = true;
        silenceStart = i;
      }
    } else {
      if (isSilent) {
        const duration = (i - silenceStart) / sampleRate;
        if (duration >= minDuration) {
          silenceRegions.push({
            start: silenceStart / sampleRate,
            end: i / sampleRate
          });
        }
        isSilent = false;
      }
    }
  }
  
  // Check end
  if (isSilent) {
    const duration = (rawData.length - silenceStart) / sampleRate;
    if (duration >= minDuration) {
      silenceRegions.push({
        start: silenceStart / sampleRate,
        end: rawData.length / sampleRate
      });
    }
  }

  return silenceRegions;
};

export const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00.0";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
};

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Converts AudioBuffer to WAV Blob
export const bufferToWav = (abuffer: AudioBuffer, len: number) => {
  let numOfChan = abuffer.numberOfChannels;
  let length = len * numOfChan * 2 + 44;
  let buffer = new ArrayBuffer(length);
  let view = new DataView(buffer);
  let channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this example)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for(i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while(pos < len) {
    for(i = 0; i < numOfChan; i++) { // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true); // write 16-bit sample
      offset += 2;
    }
    pos++;
  }

  return new Blob([buffer], {type: "audio/wav"});

  function setUint16(data: any) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: any) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
};

// Helper to create a new AudioBuffer (for playback)
export const createProcessedBuffer = (
  originalBuffer: AudioBuffer,
  silenceRegions: {start: number, end: number}[],
  context: AudioContext
): AudioBuffer => {
  const sampleRate = originalBuffer.sampleRate;
  const channels = originalBuffer.numberOfChannels;
  const totalSamples = originalBuffer.length;

  const keepRegions: {start: number, end: number}[] = [];
  let cursor = 0;
  const sortedSilence = [...silenceRegions].sort((a, b) => a.start - b.start);
  
  for (const region of sortedSilence) {
      const regionStartSample = Math.floor(region.start * sampleRate);
      const regionEndSample = Math.floor(region.end * sampleRate);
      
      if (cursor < regionStartSample) {
          keepRegions.push({start: cursor, end: regionStartSample});
      }
      cursor = regionEndSample;
  }
  if (cursor < totalSamples) {
      keepRegions.push({start: cursor, end: totalSamples});
  }
  
  const newLength = keepRegions.reduce((acc, reg) => acc + (reg.end - reg.start), 0);
  
  const newBuffer = context.createBuffer(channels, newLength, sampleRate);
  
  for (let c = 0; c < channels; c++) {
      const oldData = originalBuffer.getChannelData(c);
      const newData = newBuffer.getChannelData(c);
      let pointer = 0;
      
      for (const reg of keepRegions) {
          const len = reg.end - reg.start;
          const chunk = oldData.subarray(reg.start, reg.end);
          newData.set(chunk, pointer);
          pointer += len;
      }
  }
  return newBuffer;
};

// Creates a WAV Blob (for download)
export const processAudio = (
  originalBuffer: AudioBuffer, 
  silenceRegions: {start: number, end: number}[]
): Blob => {
  // We can reuse the logic if we had a context, but for pure data manipulation without context:
  const sampleRate = originalBuffer.sampleRate;
  const channels = originalBuffer.numberOfChannels;
  const totalSamples = originalBuffer.length;
  
  const keepRegions: {start: number, end: number}[] = [];
  let cursor = 0;
  const sortedSilence = [...silenceRegions].sort((a, b) => a.start - b.start);
  
  for (const region of sortedSilence) {
      const regionStartSample = Math.floor(region.start * sampleRate);
      const regionEndSample = Math.floor(region.end * sampleRate);
      
      if (cursor < regionStartSample) {
          keepRegions.push({start: cursor, end: regionStartSample});
      }
      cursor = regionEndSample;
  }
  if (cursor < totalSamples) {
      keepRegions.push({start: cursor, end: totalSamples});
  }
  
  const newLength = keepRegions.reduce((acc, reg) => acc + (reg.end - reg.start), 0);
  
  const newBuffer = new AudioBuffer({
      length: newLength,
      numberOfChannels: channels,
      sampleRate: sampleRate
  });
  
  for (let c = 0; c < channels; c++) {
      const oldData = originalBuffer.getChannelData(c);
      const newData = newBuffer.getChannelData(c);
      let pointer = 0;
      
      for (const reg of keepRegions) {
          const len = reg.end - reg.start;
          const chunk = oldData.subarray(reg.start, reg.end);
          newData.set(chunk, pointer);
          pointer += len;
      }
  }
  
  return bufferToWav(newBuffer, newLength);
};
