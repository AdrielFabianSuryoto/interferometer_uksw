export type AcquisitionState = 'Idle' | 'Running' | 'Completed';
export type ConnectionStatus = 'Connected' | 'Disconnected';
export type MotionMode = 'Linear' | 'Rotation';
export type FilterType = 'Savitzky-Golay' | 'Kalman';
export type TimeAxisMode = 't' | 't²';
export type PlotMode = 'Signal Plot' | 'FFT Plot';
export type FftSource = 'Filtered data' | 'Raw data';

export interface ExperimentSetup {
  motionMode: MotionMode;
  distanceMm: number;
  angleDeg: number;
  speed: number;
  repetitions: number;
  recordDurationSec: number;
}

export interface FilterParameters {
  type: FilterType;
  windowLength: number;
  polynomialOrder: number;
  kalmanQ: number;
  kalmanR: number;
}

export interface FftParameters {
  minFrequency: number;
  maxFrequency: number;
  zeroPaddingFactor: number;
}

export interface SignalPoint {
  time: number;
  timeSquared: number;
  raw: number;
  filtered: number;
}

export interface FftPoint {
  frequency: number;
  rawAmplitude: number;
  filteredAmplitude: number;
}

export interface DominantFrequencyResult {
  frequency: number;
  amplitude: number;
}

export interface AnalysisMetadata {
  analysisVersionId: string;
  parameterVersionId: string;
  acquisitionTimestamp: string;
  processingPipelineVersion: string;
}

export interface RepetitionData {
  repetition: number;
  signal: SignalPoint[];
  fft: FftPoint[];
  dominantFiltered: DominantFrequencyResult;
  dominantRaw: DominantFrequencyResult;
}
