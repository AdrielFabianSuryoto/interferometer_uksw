import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Minus, Plus, RotateCcw } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { FftParameters, FftSource, PlotMode, RepetitionData, SignalPoint, FftPoint, TimeAxisMode } from '../types';
import { NeumorphicSelect } from './NeumorphicSelect';

interface DataVisualizationPanelProps {
  data: RepetitionData;
  plotMode: PlotMode;
  axisMode: TimeAxisMode;
  fftSource: FftSource;
  selectedRepetition: number;
  totalRepetitions: number;
  fftParams: FftParameters;
  onPlotModeChange: (mode: PlotMode) => void;
  onAxisModeChange: (mode: TimeAxisMode) => void;
  onFftSourceChange: (source: FftSource) => void;
  onSelectRepetition: (value: number) => void;
  onPrevRepetition: () => void;
  onNextRepetition: () => void;
}

const EMPTY_SIGNAL: SignalPoint[] = Array.from({ length: 121 }, (_, index) => {
  const time = index / 120;
  return { time, timeSquared: time * time, raw: Number.NaN, filtered: Number.NaN };
});

const EMPTY_FFT: FftPoint[] = Array.from({ length: 121 }, (_, index) => ({
  frequency: index,
  rawAmplitude: Number.NaN,
  filteredAmplitude: Number.NaN
}));

export const DataVisualizationPanel = ({
  data,
  plotMode,
  axisMode,
  fftSource,
  selectedRepetition,
  totalRepetitions,
  fftParams,
  onPlotModeChange,
  onAxisModeChange,
  onFftSourceChange,
  onSelectRepetition,
  onPrevRepetition,
  onNextRepetition
}: DataVisualizationPanelProps) => {
  const [signalZoom, setSignalZoom] = useState(1);
  const [signalStartIndex, setSignalStartIndex] = useState(0);
  const [fftZoom, setFftZoom] = useState(1);
  const [fftStartIndex, setFftStartIndex] = useState(0);

  const signalData = data?.signal?.length ? data.signal : EMPTY_SIGNAL;
  const fftData = data?.fft?.length ? data.fft : EMPTY_FFT;
  const hasSignalData = Boolean(data?.signal?.length);
  const hasFftData = Boolean(data?.fft?.length);

  const repetitionOptions = useMemo(
    () =>
      Array.from({ length: Math.max(1, totalRepetitions) }, (_, index) => {
        const repetition = String(index + 1);
        return { value: repetition, label: `Repetition ${repetition}` };
      }),
    [totalRepetitions]
  );

  const rawValues = useMemo(() => signalData.map((point) => point.raw).filter(Number.isFinite), [signalData]);
  const sample = rawValues[75] ?? rawValues[0] ?? 0;
  const minRaw = rawValues.length ? Math.min(...rawValues) : 0;
  const maxRaw = rawValues.length ? Math.max(...rawValues) : 1;
  const xKey = axisMode === 't²' ? 'timeSquared' : 'time';
  const amplitudeKey = fftSource === 'Filtered data' ? 'filteredAmplitude' : 'rawAmplitude';
  const dominant = fftSource === 'Filtered data' ? data?.dominantFiltered : data?.dominantRaw;
  const fftLineColor = fftSource === 'Filtered data' ? '#7BBF22' : '#2563EB';

  const visibleSignal = useMemo(
    () => getVisibleWindow(signalData, signalZoom, signalStartIndex),
    [signalData, signalStartIndex, signalZoom]
  );

  const visibleFft = useMemo(
    () => getVisibleWindow(fftData, fftZoom, fftStartIndex),
    [fftData, fftStartIndex, fftZoom]
  );

  useEffect(() => {
    setSignalStartIndex((current) => clampStart(current, signalData.length, signalZoom));
  }, [signalData.length, signalZoom]);

  useEffect(() => {
    setFftStartIndex((current) => clampStart(current, fftData.length, fftZoom));
  }, [fftData.length, fftZoom]);

  const activeZoom = plotMode === 'Signal Plot' ? signalZoom : fftZoom;
  const zoomPercent = Math.round(activeZoom * 100);

  const zoomInSignal = () => {
    const nextZoom = Math.min(10, signalZoom * 1.5);
    setSignalZoom(nextZoom);
    setSignalStartIndex((current) => clampStart(current, signalData.length, nextZoom));
  };

  const zoomOutSignal = () => {
    const nextZoom = Math.max(1, signalZoom / 1.5);
    setSignalZoom(nextZoom);
    setSignalStartIndex((current) => clampStart(current, signalData.length, nextZoom));
  };

  const panSignal = (direction: -1 | 1) => {
    setSignalStartIndex((current) => panWindow(current, signalData.length, signalZoom, direction));
  };

  const resetSignalZoom = () => {
    setSignalZoom(1);
    setSignalStartIndex(0);
  };

  const zoomInFft = () => {
    const nextZoom = Math.min(10, fftZoom * 1.5);
    setFftZoom(nextZoom);
    setFftStartIndex((current) => clampStart(current, fftData.length, nextZoom));
  };

  const zoomOutFft = () => {
    const nextZoom = Math.max(1, fftZoom / 1.5);
    setFftZoom(nextZoom);
    setFftStartIndex((current) => clampStart(current, fftData.length, nextZoom));
  };

  const panFft = (direction: -1 | 1) => {
    setFftStartIndex((current) => panWindow(current, fftData.length, fftZoom, direction));
  };

  const resetFftZoom = () => {
    setFftZoom(1);
    setFftStartIndex(0);
  };

  const chartControls = plotMode === 'Signal Plot'
    ? {
        onPanLeft: () => panSignal(-1),
        onZoomOut: zoomOutSignal,
        onReset: resetSignalZoom,
        onZoomIn: zoomInSignal,
        onPanRight: () => panSignal(1)
      }
    : {
        onPanLeft: () => panFft(-1),
        onZoomOut: zoomOutFft,
        onReset: resetFftZoom,
        onZoomIn: zoomInFft,
        onPanRight: () => panFft(1)
      };

  const metaText = plotMode === 'Signal Plot'
    ? `Signal Plot - Repetition ${selectedRepetition} • X: ${axisMode} • sample ${sample.toFixed(3)} • min ${minRaw.toFixed(3)} • max ${maxRaw.toFixed(3)}`
    : `FFT Plot - Repetition ${selectedRepetition} • Source: ${fftSource} • Frequency: ${fftParams.minFrequency.toFixed(2)}-${fftParams.maxFrequency.toFixed(2)} Hz`;

  return (
    <section className="rounded-[28px] bg-card p-5 shadow-neu-raised">
      <div className="grid gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-xl font-black text-primary">{plotMode}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <div className="grid grid-cols-2 gap-2 rounded-[22px] bg-app p-1 shadow-neu-inset-soft">
              {(['Signal Plot', 'FFT Plot'] as PlotMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onPlotModeChange(mode)}
                  className={plotMode === mode ? 'plot-toggle-active plot-toggle-compact' : 'plot-toggle-muted plot-toggle-compact'}
                  type="button"
                >
                  {mode}
                </button>
              ))}
            </div>

            <NeumorphicSelect
              label="Domain"
              value={axisMode}
              onChange={onAxisModeChange}
              options={[{ value: 't', label: 't' }, { value: 't²', label: 't²' }]}
              className="w-[145px]"
            />

            {plotMode === 'FFT Plot' && (
              <NeumorphicSelect
                label="FFT Source"
                value={fftSource}
                onChange={onFftSourceChange}
                options={[{ value: 'Filtered data', label: 'Filtered data' }, { value: 'Raw data', label: 'Raw data' }]}
                className="w-[190px]"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-[72px_1fr_72px] items-stretch gap-3">
          <button className="repetition-button-small" disabled={selectedRepetition <= 1} onClick={onPrevRepetition} type="button">
            Prev
          </button>
          <NeumorphicSelect
            label="Repetition"
            value={String(selectedRepetition)}
            options={repetitionOptions}
            onChange={(value) => onSelectRepetition(Number(value))}
            className="w-full"
          />
          <button className="repetition-button-small" disabled={selectedRepetition >= totalRepetitions} onClick={onNextRepetition} type="button">
            Next
          </button>
        </div>

        <div className="flex flex-col gap-3 text-xs font-semibold text-secondary md:flex-row md:items-center md:justify-between">
          <div>
            <p>Zoom {zoomPercent}%</p>
            <p className="mt-2">{metaText}</p>
          </div>
          <ChartControls {...chartControls} />
        </div>

        <div className="relative h-[620px] min-h-[440px] rounded-[24px] bg-white p-4 shadow-neu-inset-soft">
          {plotMode === 'Signal Plot' ? (
            <>
              <div className="chart-legend-box">
                <span><i className="bg-scientific-blue" /> raw data</span>
                <span><i className="bg-primary-green" /> filtered data</span>
              </div>
              {!hasSignalData && <EmptyChartNotice label="Waiting for signal data" />}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visibleSignal} margin={{ top: 26, right: 28, bottom: 38, left: 12 }}>
                  <CartesianGrid stroke="#E5EDE5" />
                  <XAxis
                    dataKey={xKey}
                    stroke="#647067"
                    tick={{ fontSize: 12 }}
                    domain={['dataMin', 'dataMax']}
                    type="number"
                    label={{ value: axisMode === 't²' ? 'Time² (s²)' : 'Time (s)', position: 'insideBottom', offset: -20 }}
                  />
                  <YAxis
                    stroke="#647067"
                    tick={{ fontSize: 12 }}
                    domain={hasSignalData ? ['auto', 'auto'] : [0, 1]}
                    label={{ value: 'Amplitude', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip formatter={(value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(4) : '-')} />
                  <Line type="monotone" dataKey="raw" name="raw data" stroke="#2563EB" dot={false} strokeWidth={1.5} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="filtered" name="filtered data" stroke="#7BBF22" dot={false} strokeWidth={2.3} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <>
              <div className="chart-legend-box">
                <span><i style={{ backgroundColor: fftLineColor }} /> FFT of {fftSource.toLowerCase()}</span>
                <span><i className="bg-teal-700" /> dominant frequency</span>
              </div>
              {!hasFftData && <EmptyChartNotice label="Waiting for FFT data" />}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visibleFft} margin={{ top: 26, right: 28, bottom: 38, left: 12 }}>
                  <CartesianGrid stroke="#E5EDE5" />
                  <XAxis
                    dataKey="frequency"
                    stroke="#647067"
                    tick={{ fontSize: 12 }}
                    type="number"
                    domain={hasFftData ? ['dataMin', 'dataMax'] : [fftParams.minFrequency, fftParams.maxFrequency]}
                    label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -20 }}
                  />
                  <YAxis
                    stroke="#647067"
                    tick={{ fontSize: 12 }}
                    domain={hasFftData ? [0, 'auto'] : [0, 1]}
                    label={{ value: 'Amplitude', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip formatter={(value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(4) : '-')} />
                  {hasFftData && dominant && visibleFft.some((point) => Math.abs(point.frequency - dominant.frequency) < 0.0001) && (
                    <ReferenceLine
                      x={dominant.frequency}
                      stroke="#0F766E"
                      strokeDasharray="6 6"
                      label={{ value: `${dominant.frequency.toFixed(2)} Hz`, position: 'top', fill: '#0F766E', fontSize: 13 }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey={amplitudeKey}
                    name={`FFT of ${fftSource.toLowerCase()}`}
                    stroke={fftLineColor}
                    dot={false}
                    strokeWidth={2.3}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

const ChartControls = ({
  onPanLeft,
  onZoomOut,
  onReset,
  onZoomIn,
  onPanRight
}: {
  onPanLeft: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onZoomIn: () => void;
  onPanRight: () => void;
}) => (
  <div className="flex gap-2">
    <button className="chart-control-button" onClick={onPanLeft} title="Pan left" type="button"><ArrowLeft size={15} /></button>
    <button className="chart-control-button" onClick={onZoomOut} title="Zoom out" type="button"><Minus size={15} /></button>
    <button className="chart-control-button" onClick={onReset} title="Reset zoom" type="button"><RotateCcw size={15} /></button>
    <button className="chart-control-button" onClick={onZoomIn} title="Zoom in" type="button"><Plus size={15} /></button>
    <button className="chart-control-button" onClick={onPanRight} title="Pan right" type="button"><ArrowRight size={15} /></button>
  </div>
);

const EmptyChartNotice = ({ label }: { label: string }) => (
  <div className="pointer-events-none absolute inset-0 z-[1] grid place-items-center">
    <div className="rounded-[18px] bg-white/85 px-5 py-3 text-sm font-black text-secondary shadow-neu-raised backdrop-blur">
      {label}
    </div>
  </div>
);

function getWindowSize(length: number, zoom: number) {
  return Math.max(12, Math.ceil(length / zoom));
}

function clampStart(startIndex: number, length: number, zoom: number) {
  const windowSize = getWindowSize(length, zoom);
  return Math.max(0, Math.min(startIndex, Math.max(0, length - windowSize)));
}

function getVisibleWindow<T>(items: T[], zoom: number, startIndex: number) {
  const safeStart = clampStart(startIndex, items.length, zoom);
  const windowSize = getWindowSize(items.length, zoom);
  return items.slice(safeStart, safeStart + windowSize);
}

function panWindow(startIndex: number, length: number, zoom: number, direction: -1 | 1) {
  const windowSize = getWindowSize(length, zoom);
  const step = Math.max(4, Math.ceil(windowSize * 0.25));
  return clampStart(startIndex + direction * step, length, zoom);
}
