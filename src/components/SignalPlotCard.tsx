import { ArrowLeft, ArrowRight, Minus, Plus, RotateCcw } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RepetitionData, TimeAxisMode } from '../types';
import { NeumorphicSelect } from './NeumorphicSelect';

interface SignalPlotCardProps {
  data: RepetitionData;
  selectedRepetition: number;
  totalRepetitions: number;
  axisMode: TimeAxisMode;
  onSelectRepetition: (value: number) => void;
  onPrevRepetition: () => void;
  onNextRepetition: () => void;
}

export const SignalPlotCard = ({
  data,
  selectedRepetition,
  totalRepetitions,
  axisMode,
  onSelectRepetition,
  onPrevRepetition,
  onNextRepetition
}: SignalPlotCardProps) => {
  const xKey = axisMode === 't²' ? 'timeSquared' : 'time';
  const repetitionOptions = Array.from({ length: totalRepetitions }, (_, index) => {
    const repetition = String(index + 1);
    return { value: repetition, label: `Repetition ${repetition}` };
  });

  const rawValues = data.signal.map((point) => point.raw);
  const sample = data.signal[75]?.raw ?? data.signal[0]?.raw ?? 0;

  return (
    <section className="rounded-[28px] bg-card p-5 shadow-neu-raised">
      <div>
        <h2 className="text-xl font-black text-primary">Signal Plot</h2>
        <p className="mt-1 text-sm font-semibold text-secondary">Unmodified raw data with algorithmically derived filtered signal.</p>
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
            Signal Plot - Repetition {selectedRepetition} • X: {axisMode} • sample {sample.toFixed(3)} • min{' '}
            {Math.min(...rawValues).toFixed(3)} • max {Math.max(...rawValues).toFixed(3)}
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
          <span><i className="bg-scientific-blue" /> raw data</span>
          <span><i className="bg-primary-green" /> filtered data</span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.signal} margin={{ top: 22, right: 26, bottom: 34, left: 12 }}>
            <CartesianGrid stroke="#E5EDE5" />
            <XAxis
              dataKey={xKey}
              stroke="#647067"
              tick={{ fontSize: 12 }}
              label={{ value: axisMode === 't²' ? 'Time² (s²)' : 'Time (s)', position: 'insideBottom', offset: -18 }}
            />
            <YAxis stroke="#647067" tick={{ fontSize: 12 }} label={{ value: 'Amplitude', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value) => Number(value).toFixed(4)} />
            <Line type="monotone" dataKey="raw" name="raw data" stroke="#2563EB" dot={false} strokeWidth={1.4} isAnimationActive={false} />
            <Line type="monotone" dataKey="filtered" name="filtered data" stroke="#7BBF22" dot={false} strokeWidth={2.2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
