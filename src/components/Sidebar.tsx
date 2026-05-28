import type React from 'react';
import { Activity, CheckCircle2, Droplets, Radio, SlidersHorizontal, Thermometer, ThermometerSun, Waves } from 'lucide-react';
import type {
  AcquisitionState,
  ConnectionStatus,
  ExperimentSetup,
  FilterParameters,
  FilterType,
  FftParameters,
  MotionMode,
  TimeAxisMode
} from '../types';
import { SegmentedControl } from './SegmentedControl';

interface SidebarProps {
  connectionStatus: ConnectionStatus;
  deviceStatus: string;
  isConnecting: boolean;
  acquisitionState: AcquisitionState;
  setup: ExperimentSetup;
  filterParams: FilterParameters;
  fftParams: FftParameters;
  axisMode: TimeAxisMode;
  locked: boolean;
  dominantFrequencyHz: number;
  fringeDurationSec: number;
  fringeCount: number;
  onToggleConnection: () => void;
  onSetupChange: (setup: ExperimentSetup) => void;
  onFilterChange: (params: FilterParameters) => void;
  onFftChange: (params: FftParameters) => void;
  onAxisModeChange: (mode: TimeAxisMode) => void;
}

const getMinimumLinearDuration = (distanceMm: number): number => {
  if (!Number.isFinite(distanceMm) || distanceMm <= 0) return 1;
  return Math.max(1, Math.ceil(distanceMm / 5));
};

const clampRotationAngle = (angleDeg: number): number => {
  if (!Number.isFinite(angleDeg)) return Number.NaN;
  return Math.min(180, Math.max(0, angleDeg));
};

export const Sidebar = ({
  connectionStatus,
  deviceStatus,
  isConnecting,
  acquisitionState,
  setup,
  filterParams,
  fftParams,
  axisMode,
  locked,
  dominantFrequencyHz,
  fringeDurationSec,
  fringeCount,
  onToggleConnection,
  onSetupChange,
  onFilterChange,
  onFftChange,
  onAxisModeChange
}: SidebarProps) => {
  const lockClass = locked ? 'opacity-70' : '';
  const safeRepetitions = Number.isFinite(setup.repetitions) && setup.repetitions > 0 ? Math.floor(setup.repetitions) : 3;
  const minimumLinearDuration = getMinimumLinearDuration(setup.distanceMm);
  const moveDuration = Number.isFinite(setup.speed) ? `${Math.max(0.1, setup.speed).toFixed(1)}s` : '-';

  // Matches current RTOS BLE firmware Config.h:
  // Linear: STEPS_PER_REV=200, LINEAR_MICROSTEP=8, LEADSCREW_LEAD_MM=1.5
  // Rotation: STEPS_PER_REV=200, ROT_MICROSTEP=16, ROT_GEAR_RATIO=1
  const linearStepsPerMm = (200 * 8) / 1.5;
  const rotationStepsPerDegree = (200 * 16 * 1) / 360;
  const motorSteps =
    setup.motionMode === 'Linear' && Number.isFinite(setup.distanceMm)
      ? `${Math.round(setup.distanceMm * linearStepsPerMm)} step`
      : setup.motionMode === 'Rotation' && Number.isFinite(setup.angleDeg)
        ? `${Math.round(setup.angleDeg * rotationStepsPerDegree)} step`
        : '-';
  const connectionButtonLabel = isConnecting ? 'Connecting...' : connectionStatus;
  const connectionButtonClass =
    connectionStatus === 'Connected'
      ? 'bg-primary-green text-white shadow-green-glow hover:brightness-95'
      : 'bg-warning-red text-white shadow-neu-button hover:brightness-95';


  return (
    <aside className="custom-scrollbar sidebar-scroll-viewport grid w-full min-w-0 max-w-full gap-5 bg-transparent pr-1 xl:sticky xl:top-4">
      <Panel title="System Setup" icon={<Radio size={17} />}>
        <button
          type="button"
          disabled={isConnecting}
          onClick={onToggleConnection}
          className={`mb-3 w-full rounded-[18px] px-4 py-3 text-center text-sm font-black transition disabled:cursor-wait disabled:opacity-70 ${connectionButtonClass}`}
        >
          {connectionButtonLabel}
        </button>

        <div className="mb-5 min-w-0 max-w-full rounded-[18px] bg-card px-4 py-3 shadow-neu-inset-soft">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-secondary">Device status</p>
          <p
            className="mt-1 max-w-full overflow-hidden text-ellipsis break-words text-sm font-black leading-5 text-primary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]"
            title={deviceStatus}
          >
            {deviceStatus}
          </p>
        </div>

        <ControlLabel label="Mode">
          <SegmentedControl
            options={['Linear', 'Rotation'] as MotionMode[]}
            value={setup.motionMode}
            onChange={(motionMode) => {
              if (motionMode === 'Linear') {
                const minimumDuration = getMinimumLinearDuration(setup.distanceMm);
                onSetupChange({
                  ...setup,
                  motionMode,
                  speed: Number.isFinite(setup.distanceMm) ? minimumDuration : setup.speed,
                  recordDurationSec: Number.isFinite(setup.distanceMm) ? minimumDuration : setup.recordDurationSec
                });
                return;
              }

              onSetupChange({
                ...setup,
                motionMode,
                angleDeg: clampRotationAngle(setup.angleDeg)
              });
            }}
            disabled={locked}
          />
        </ControlLabel>

        <div className={`mt-5 grid gap-4 ${lockClass}`}>
          {setup.motionMode === 'Linear' ? (
            <NumberInput
              label="Distance"
              suffix="mm"
              value={setup.distanceMm}
              disabled={locked}
              onChange={(distanceMm) => {
                const minimumDuration = getMinimumLinearDuration(distanceMm);
                onSetupChange({
                  ...setup,
                  distanceMm,
                  speed: Number.isFinite(distanceMm) ? minimumDuration : setup.speed,
                  recordDurationSec: Number.isFinite(distanceMm) ? minimumDuration : setup.recordDurationSec
                });
              }}
            />
          ) : (
            <NumberInput
              label="Angle"
              suffix="deg"
              value={setup.angleDeg}
              disabled={locked}
              max={180}
              onChange={(angleDeg) => onSetupChange({ ...setup, angleDeg: clampRotationAngle(angleDeg) })}
            />
          )}
          <NumberInput
            label="Duration"
            suffix="s"
            value={setup.speed}
            disabled={locked}
            min={setup.motionMode === 'Linear' ? minimumLinearDuration : 0.1}
            step={0.1}
            onChange={(speed) => onSetupChange({ ...setup, speed, recordDurationSec: Number.isFinite(speed) ? speed : setup.recordDurationSec })}
          />
          <NumberInput
            label="Repetitions"
            value={setup.repetitions}
            disabled={locked}
            min={1}
            onChange={(repetitions) =>
              onSetupChange({
                ...setup,
                repetitions: Number.isFinite(repetitions) ? Math.max(1, Math.floor(repetitions)) : Number.NaN
              })
            }
          />
        </div>
      </Panel>

      <Panel title="Fringe Count" icon={<Activity size={17} />}>
        <SummaryRow label="Formula" value="n = f × t" />
        <SummaryRow label="Dominant Frequency" value={formatNumber(dominantFrequencyHz, 'Hz', 3)} />
        <SummaryRow label="Duration" value={formatNumber(fringeDurationSec, 's', 2)} />
        <SummaryRow label="Estimated Cycles" value={formatNumber(fringeCount, 'cycles', 2)} />
      </Panel>

      <Panel title="Filter Settings" icon={<SlidersHorizontal size={17} />}>
        <div>
          <SegmentedControl
            options={['Savitzky-Golay', 'Kalman'] as FilterType[]}
            value={filterParams.type}
            onChange={(type) => onFilterChange({ ...filterParams, type })}
          />
          {filterParams.type === 'Savitzky-Golay' ? (
            <div className="mt-5 grid gap-5">
              <RangeInput
                label="Window"
                value={filterParams.windowLength}
                min={3}
                max={41}
                onChange={(windowLength) => onFilterChange({ ...filterParams, windowLength })}
              />
              <RangeInput
                label="Order"
                value={filterParams.polynomialOrder}
                min={1}
                max={5}
                onChange={(polynomialOrder) => onFilterChange({ ...filterParams, polynomialOrder })}
              />
            </div>
          ) : (
            <div className="mt-5 grid gap-5">
              <RangeInput
                label="Kalman Q"
                value={filterParams.kalmanQ}
                min={0.0001}
                max={0.02}
                step={0.0001}
                formatValue={(value) => value.toFixed(4)}
                onChange={(kalmanQ) => onFilterChange({ ...filterParams, kalmanQ })}
              />
              <RangeInput
                label="Kalman R"
                value={filterParams.kalmanR}
                min={0.001}
                max={1}
                step={0.001}
                formatValue={(value) => value.toFixed(3)}
                onChange={(kalmanR) => onFilterChange({ ...filterParams, kalmanR })}
              />
            </div>
          )}
        </div>
      </Panel>

      <Panel title="FFT Settings" icon={<Waves size={17} />}>
        <div className={`grid gap-4 ${lockClass}`}>
          <RangeInput
            label="FFT Min Frequency"
            value={fftParams.minFrequency}
            min={0}
            max={30}
            disabled={locked}
            onChange={(minFrequency) => onFftChange({ ...fftParams, minFrequency })}
          />
          <RangeInput
            label="FFT Max Frequency"
            value={fftParams.maxFrequency}
            min={80}
            max={160}
            disabled={locked}
            onChange={(maxFrequency) => onFftChange({ ...fftParams, maxFrequency })}
          />
          <RangeInput
            label="Zero Padding Factor"
            value={fftParams.zeroPaddingFactor}
            min={1}
            max={8}
            disabled={locked}
            onChange={(zeroPaddingFactor) => onFftChange({ ...fftParams, zeroPaddingFactor })}
          />
          <ControlLabel label="Time Axis">
            <SegmentedControl options={['t', 't²'] as TimeAxisMode[]} value={axisMode} onChange={onAxisModeChange} disabled={locked} />
          </ControlLabel>
        </div>
      </Panel>

      <Panel title="Ambient Conditions" icon={<Thermometer size={17} />}>
        <div className="grid grid-cols-2 gap-4">
          <SensorValueCard
            icon={<ThermometerSun size={18} strokeWidth={2.6} />}
            label="Temp"
            value="NULL"
            unit="°C"
          />
          <SensorValueCard
            icon={<Droplets size={18} strokeWidth={2.6} />}
            label="Humidity"
            value="NULL"
            unit="%"
          />
        </div>
      </Panel>

      <Panel title="Motor Movement Summary" icon={<CheckCircle2 size={17} />}>
        <SummaryRow label="State" value={acquisitionState} />
        <SummaryRow label="Movement Type" value={setup.motionMode === 'Rotation' ? 'Rotation' : 'Linear'} />
        <SummaryRow label="Input" value={setup.motionMode === 'Rotation' ? formatValue(setup.angleDeg, 'deg') : formatValue(setup.distanceMm, 'mm')} />
        <SummaryRow label="Repetitions" value={`${safeRepetitions}`} />
        <SummaryRow label="Move Duration" value={moveDuration} />
        <SummaryRow label="Motor Steps" value={motorSteps} />
      </Panel>
    </aside>
  );
};

const Panel = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <section className="min-w-0 rounded-[28px] bg-card p-5 shadow-neu-raised">
    <div className="mb-5 flex items-center justify-between">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <h3 className="text-base font-black">{title}</h3>
      </div>
    </div>
    {children}
  </section>
);

const SensorValueCard = ({
  icon,
  label,
  value,
  unit
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
}) => (
  <div className="rounded-[22px] bg-card px-4 py-4 shadow-neu-inset-soft">
    <div className="mb-3 flex items-center gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-soft-green text-dark-green shadow-neu-inset-soft">
        {icon}
      </span>
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-secondary">{label}</span>
    </div>
    <div className="flex items-end gap-1">
      <span className="text-2xl font-black leading-none text-primary">{value}</span>
      <span className="text-sm font-black leading-none text-dark-green">{unit}</span>
    </div>
  </div>
);

const ControlLabel = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-2 block text-xs font-bold text-secondary">{label}</span>
    {children}
  </label>
);

const NumberInput = ({
  label,
  value,
  onChange,
  disabled,
  step = 1,
  min,
  max,
  suffix
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) => {
  const displayValue = Number.isFinite(value) ? String(value) : '';

  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={displayValue}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === '' ? Number.NaN : Number(event.target.value))}
        placeholder={label}
        className="w-full rounded-[20px] bg-card px-4 py-4 text-sm font-bold text-primary outline-none shadow-neu-inset-soft placeholder:text-secondary disabled:cursor-not-allowed"
      />
      {suffix && displayValue && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-secondary">{suffix}</span>}
    </label>
  );
};

const RangeInput = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  formatValue = (currentValue) => String(currentValue)
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  formatValue?: (value: number) => string;
}) => (
  <label className="block">
    <div className="mb-2 flex items-center justify-between text-xs font-bold text-secondary">
      <span>{label}</span>
      <span>{formatValue(value)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      className="green-range w-full disabled:cursor-not-allowed"
    />
  </label>
);

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 border-b border-border/60 py-2 text-xs">
    <span className="font-semibold text-secondary">{label}</span>
    <span className="text-right font-black text-primary">{value}</span>
  </div>
);

const formatValue = (value: number, unit: string) => (Number.isFinite(value) ? `${value} ${unit}` : '-');

const formatNumber = (value: number, unit: string, digits = 2) =>
  Number.isFinite(value) && value > 0 ? `${value.toFixed(digits)} ${unit}` : '-';
