import { ArrowLeft, ArrowRight, Minus, Plus, RotateCcw } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FftParameters, FftSource, RepetitionData, TimeAxisMode } from '../types';
import { NeumorphicSelect } from './NeumorphicSelect';

interface FftPlotCardProps {
  data: RepetitionData;
  source: FftSource;
  axisMode: TimeAxisMode;
  selectedRepetition: number;
  totalRepetitions: number;
  fftParams: FftParameters;
  onSelectRepetition: (value: number) => void;
  onPrevRepetition: () => void;
  onNextRepetition: () => void;
}

export const FftPlotCard = ({
  data,
  source,
  axisMode,
  selectedRepetition,
  totalRepetitions,
  fftParams,
  onSelectRepetition,
  onPrevRepetition,
  onNextRepetition
}: FftPlotCardProps) => {
  const amplitudeKey = source === 'Filtered data' ? 'filteredAmplitude' : 'rawAmplitude';
  const dominant = source === 'Filtered data' ? data.dominantFiltered : data.dominantRaw;
  const lineColor = source === 'Filtered data' ? '#7BBF22' : '#2563EB';
  const repetitionOptions = Array.from({ length: totalRepetitions }, (_, index) => {
    const repetition = String(index + 1);
    return { value: repetition, label: `Repetition ${repetition}` };
  });

  return (
    <section className="rounded-[28px] bg-card p-5 shadow-neu-raised">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-xl font-black text-primary">FFT Plot</h2>
          <p className="mt-1 text-sm font-semibold text-secondary">Read-only spectrum computed from recorded signal arrays and locked parameters.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="result-pill"><span>Dominant</span><b>{dominant.frequency.toFixed(2)} Hz</b></div>
          <div className="result-pill"><span>Amplitude</span><b>{dominant.amplitude.toFixed(3)}</b></div>
          <div className="result-pill"><span>Range</span><b>{fftParams.minFrequency}-{fftParams.maxFrequency} Hz</b></div>
          <div className="result-pill"><span>Axis</span><b>{axisMode}</b></div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[72px_1fr_72px] items-center gap-3">
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

      <div className="mt-5 flex flex-col gap-3 text-xs font-semibold text-secondary md:flex-row md:items-center md:justify-between">
        <div>
          <p>Zoom 100%</p>
          <p className="mt-2">
            FFT Plot - Repetition {selectedRepetition} • Source: {source} • Frequency: {fftParams.minFrequency.toFixed(2)}-
            {fftParams.maxFrequency.toFixed(2)} Hz
          </p>
        </div>
        <div className="flex gap-2">
          {[ArrowLeft, Minus, RotateCcw, Plus, ArrowRight].map((Icon, index) => (
            <button
              key={index}
              className="grid h-10 w-12 place-items-center rounded-full bg-app text-secondary shadow-neu-raised transition hover:text-dark-green"
              title="Display-only zoom/pan control"
              type="button"
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4 h-[520px] rounded-[24px] bg-white p-4 shadow-neu-inset-soft">
        <div className="chart-legend-box">
          <span><i style={{ backgroundColor: lineColor }} /> FFT of {source.toLowerCase()}</span>
          <span><i className="bg-teal-700" /> dominant frequency</span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.fft} margin={{ top: 22, right: 28, bottom: 34, left: 12 }}>
            <CartesianGrid stroke="#E5EDE5" />
            <XAxis dataKey="frequency" stroke="#647067" tick={{ fontSize: 12 }} label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -18 }} />
            <YAxis stroke="#647067" tick={{ fontSize: 12 }} label={{ value: 'Amplitude', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value) => Number(value).toFixed(4)} />
            <ReferenceLine
              x={dominant.frequency}
              stroke="#0F766E"
              strokeDasharray="6 6"
              label={{ value: `${dominant.frequency.toFixed(2)} Hz`, position: 'top', fill: '#0F766E', fontSize: 13 }}
            />
            <Line
              type="monotone"
              dataKey={amplitudeKey}
              name={`FFT of ${source.toLowerCase()}`}
              stroke={lineColor}
              dot={false}
              strokeWidth={2.2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
