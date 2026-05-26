import type { FftParameters, RepetitionData } from '../types';
import { createFftLikeSpectrum, getDominantFrequency, movingAverage, round } from './processing';

export const createMockRepetitions = (count: number, fftParams: FftParameters): RepetitionData[] => {
  return Array.from({ length: count }, (_, index) => {
    const repetition = index + 1;
    const sampleCount = 700;
    const dominantHz = 16 + index * 0.35;
    const rawValues = Array.from({ length: sampleCount }, (_, sampleIndex) => {
      const time = sampleIndex / (sampleCount - 1);
      const main = 9.2 * Math.sin(2 * Math.PI * dominantHz * time + index * 0.15);
      const harmonic = 2.2 * Math.sin(2 * Math.PI * 24 * time + 0.7);
      const drift = 4.4 * Math.sin(2 * Math.PI * 1.25 * time);
      const noise = (pseudoRandom(sampleIndex + repetition * 79) - 0.5) * 4.8;
      return round(384 + main + harmonic + drift + noise, 4);
    });

    const filteredValues = movingAverage(rawValues, 13);
    const signal = rawValues.map((raw, sampleIndex) => {
      const time = round(sampleIndex / (sampleCount - 1), 6);
      return {
        time,
        timeSquared: round(time * time, 6),
        raw,
        filtered: filteredValues[sampleIndex]
      };
    });

    const fft = createFftLikeSpectrum(signal, fftParams, dominantHz);

    return {
      repetition,
      signal,
      fft,
      dominantFiltered: getDominantFrequency(fft, 'Filtered data'),
      dominantRaw: getDominantFrequency(fft, 'Raw data')
    };
  });
};

const pseudoRandom = (seed: number): number => {
  const value = Math.sin(seed * 32.173) * 9831.331;
  return value - Math.floor(value);
};
