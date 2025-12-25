// Audio utility for generating notification sounds using Web Audio API

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

export const playWorkCompleteSound = () => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Create a pleasant "ding ding" sound for work completion
  const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 (major chord)
  
  frequencies.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, now + i * 0.15);
    
    gainNode.gain.setValueAtTime(0, now + i * 0.15);
    gainNode.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.5);
    
    oscillator.start(now + i * 0.15);
    oscillator.stop(now + i * 0.15 + 0.5);
  });
};

export const playBreakCompleteSound = () => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Create a gentle "boop boop" sound for break completion
  const frequencies = [440, 554.37]; // A4, C#5
  
  frequencies.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(freq, now + i * 0.2);
    
    gainNode.gain.setValueAtTime(0, now + i * 0.2);
    gainNode.gain.linearRampToValueAtTime(0.25, now + i * 0.2 + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.4);
    
    oscillator.start(now + i * 0.2);
    oscillator.stop(now + i * 0.2 + 0.4);
  });
};
