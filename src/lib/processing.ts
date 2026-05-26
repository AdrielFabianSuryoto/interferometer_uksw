import type {
  FftParameters,
  FftPoint,
  FftSource,
  FilterParameters,
  RepetitionData,
  SignalPoint
} from '../types';

export const clampOddWindow = (value: number, sampleCount: number): number => {
  if (sampleCount <= 2) return 1;

  const bounded = Math.max(3, Math.min(value, sampleCount - 1));
  return bounded % 2 === 0 ? bounded - 1 : bounded;
};

export const movingAverage = (values: number[], windowLength: number): number[] => {
  if (values.length === 0) return [];
  if (values.length < 3) return values.map((value) => round(value));

  const window = clampOddWindow(windowLength, values.length);
  const halfWindow = Math.floor(window / 2);

  return values.map((_, index) => {
    const start = Math.max(0, index - halfWindow);
    const end = Math.min(values.length - 1, index + halfWindow);
    const slice = values.slice(start, end + 1);
    return round(slice.reduce((sum, value) => sum + value, 0) / slice.length);
  });
};

export const kalmanFilter = (values: number[], q: number, r: number): number[] => {
  if (values.length === 0) return [];

  const processNoise = Number.isFinite(q) && q > 0 ? q : 0.002;
  const measurementNoise = Number.isFinite(r) && r > 0 ? r : 0.08;

  let estimate = values[0];
  let errorCovariance = 1;

  return values.map((measurement) => {
    errorCovariance += processNoise;

    const gain = errorCovariance / (errorCovariance + measurementNoise);
    estimate = estimate + gain * (measurement - estimate);
    errorCovariance = (1 - gain) * errorCovariance;

    return round(estimate);
  });
};

export const filterSignalValues = (values: number[], params: FilterParameters): number[] => {
  if (params.type === 'Kalman') {
    return kalmanFilter(values, params.kalmanQ, params.kalmanR);
  }

  // This is intentionally conservative for live data. It keeps the old UI behavior
  // while avoiding heavy polynomial regression on every BLE chunk.
  return movingAverage(values, params.windowLength);
};

export const createSignalFromRawSamples = (
  rawSamples: number[],
  recordDurationSec: number,
  filterParams: FilterParameters
): SignalPoint[] => {
  if (rawSamples.length === 0) return [];

  const duration = Number.isFinite(recordDurationSec) && recordDurationSec > 0 ? recordDurationSec : 1;
  const filteredValues = filterSignalValues(rawSamples, filterParams);
  const denominator = Math.max(1, rawSamples.length - 1);

  return rawSamples.map((raw, sampleIndex) => {
    const time = round((sampleIndex / denominator) * duration, 6);

    return {
      time,
      timeSquared: round(time * time, 6),
      raw: round(raw, 4),
      filtered: filteredValues[sampleIndex] ?? round(raw, 4)
    };
  });
};

export const createFftSpectrum = (
  signal: SignalPoint[],
  params: FftParameters,
  recordDurationSec: number
): FftPoint[] => {
  if (signal.length < 2) return [];

  const rawValues = signal.map((point) => point.raw);
  const filteredValues = signal.map((point) => point.filtered);
  const duration = Number.isFinite(recordDurationSec) && recordDurationSec > 0 ? recordDurationSec : 1;
  const sampleRate = rawValues.length / duration;
  const zeroPaddingFactor = Math.max(1, Math.floor(params.zeroPaddingFactor || 1));
  const fftSize = nextPowerOfTwo(Math.max(32, rawValues.length * zeroPaddingFactor));

  const rawSpectrum = computeMagnitudeSpectrum(rawValues, fftSize);
  const filteredSpectrum = computeMagnitudeSpectrum(filteredValues, fftSize);

  const minFrequency = Math.max(0, params.minFrequency);
  const maxFrequency = Math.max(minFrequency, params.maxFrequency);
  const maxBin = Math.min(Math.floor(fftSize / 2), rawSpectrum.length - 1);

  const points: FftPoint[] = [];

  for (let bin = 0; bin <= maxBin; bin++) {
    const frequency = (bin * sampleRate) / fftSize;

    if (frequency < minFrequency || frequency > maxFrequency) {
      continue;
    }

    points.push({
      frequency: round(frequency, 4),
      rawAmplitude: round(rawSpectrum[bin], 6),
      filteredAmplitude: round(filteredSpectrum[bin], 6)
    });
  }

  return points;
};

export const createRepetitionFromRawSamples = (
  repetition: number,
  rawSamples: number[],
  recordDurationSec: number,
  filterParams: FilterParameters,
  fftParams: FftParameters
): RepetitionData => {
  const signal = createSignalFromRawSamples(rawSamples, recordDurationSec, filterParams);
  const fft = createFftSpectrum(signal, fftParams, recordDurationSec);

  return {
    repetition,
    signal,
    fft,
    dominantFiltered: getDominantFrequency(fft, 'Filtered data'),
    dominantRaw: getDominantFrequency(fft, 'Raw data')
  };
};

export const createEmptyRepetition = (repetition = 1): RepetitionData => ({
  repetition,
  signal: [],
  fft: [],
  dominantFiltered: { frequency: 0, amplitude: 0 },
  dominantRaw: { frequency: 0, amplitude: 0 }
});

export const createFftLikeSpectrum = (
  signal: SignalPoint[],
  params: FftParameters,
  dominantHz: number
): FftPoint[] => {
  const frequencyStep = 1;
  const width = 3.2 / Math.max(1, params.zeroPaddingFactor);

  return Array.from({ length: params.maxFrequency - params.minFrequency + 1 }, (_, index) => {
    const frequency = params.minFrequency + index * frequencyStep;
    const dominantRaw = gaussian(frequency, dominantHz, width) * 4.25;
    const dominantFiltered = gaussian(frequency, dominantHz, width * 0.82) * 4.65;
    const sideBand = gaussian(frequency, dominantHz + 6, width * 1.35) * 1.25;
    const lowFrequencyArtifact = gaussian(frequency, 8, width * 1.7) * 1.55;
    const noiseFloor = 0.08 + pseudoRandom(frequency + signal.length) * 0.18;

    return {
      frequency,
      rawAmplitude: round(noiseFloor + dominantRaw * 0.92 + sideBand + lowFrequencyArtifact),
      filteredAmplitude: round(noiseFloor * 0.58 + dominantFiltered + sideBand * 0.42 + lowFrequencyArtifact * 0.25)
    };
  });
};

export const getDominantFrequency = (fft: FftPoint[], source: FftSource = 'Filtered data') => {
  const key = source === 'Filtered data' ? 'filteredAmplitude' : 'rawAmplitude';

  if (fft.length === 0) {
    return { frequency: 0, amplitude: 0 };
  }

  return fft.reduce(
    (dominant, point) =>
      point[key] > dominant.amplitude
        ? { frequency: point.frequency, amplitude: point[key] }
        : dominant,
    { frequency: 0, amplitude: Number.NEGATIVE_INFINITY }
  );
};

export const buildCsv = (rows: Record<string, string | number>[]): string => {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => headers.map((header) => row[header]).join(',')).join('\n');
  return `${headers.join(',')}\n${body}`;
};

export const downloadTextFile = (filename: string, content: string, mimeType = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
};

export const round = (value: number, digits = 4) => Number(value.toFixed(digits));

const computeMagnitudeSpectrum = (values: number[], fftSize: number): number[] => {
  const centered = removeMean(values);
  const padded = new Array(fftSize).fill(0);

  for (let index = 0; index < centered.length; index++) {
    padded[index] = centered[index] * hannWindow(index, centered.length);
  }

  const spectrum: number[] = [];
  const maxBin = Math.floor(fftSize / 2);

  for (let bin = 0; bin <= maxBin; bin++) {
    let real = 0;
    let imaginary = 0;

    for (let sample = 0; sample < fftSize; sample++) {
      const angle = (-2 * Math.PI * bin * sample) / fftSize;
      real += padded[sample] * Math.cos(angle);
      imaginary += padded[sample] * Math.sin(angle);
    }

    spectrum.push((2 * Math.sqrt(real * real + imaginary * imaginary)) / Math.max(1, values.length));
  }

  return spectrum;
};

const removeMean = (values: number[]): number[] => {
  if (values.length === 0) return [];

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.map((value) => value - mean);
};

const hannWindow = (index: number, length: number): number => {
  if (length <= 1) return 1;
  return 0.5 * (1 - Math.cos((2 * Math.PI * index) / (length - 1)));
};

const nextPowerOfTwo = (value: number): number => {
  let result = 1;

  while (result < value) {
    result *= 2;
  }

  return result;
};

const gaussian = (x: number, mean: number, sigma: number) => Math.exp(-0.5 * ((x - mean) / sigma) ** 2);

const pseudoRandom = (seed: number): number => {
  const value = Math.sin(seed * 32.173) * 9831.331;
  return value - Math.floor(value);
};
