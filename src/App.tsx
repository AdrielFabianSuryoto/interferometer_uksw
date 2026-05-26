import { useMemo, useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DataVisualizationPanel } from './components/DataVisualizationPanel';
import { BottomActionBar } from './components/BottomActionBar';
import {
  buildCsv,
  createEmptyRepetition,
  createRepetitionFromRawSamples,
  downloadTextFile
} from './lib/processing';
import {
  connectToInterferometerBle,
  disconnectInterferometerBle,
  sendAcquisitionStart,
  type SignalChunk
} from './lib/bluetooth';
import type {
  AcquisitionState,
  AnalysisMetadata,
  ConnectionStatus,
  ExperimentSetup,
  FftParameters,
  FftSource,
  FilterParameters,
  PlotMode,
  RepetitionData,
  TimeAxisMode
} from './types';

const DEFAULT_DUMMY_REPETITIONS = 3;

const initialSetup: ExperimentSetup = {
  motionMode: 'Rotation',
  distanceMm: Number.NaN,
  angleDeg: Number.NaN,
  speed: Number.NaN,
  repetitions: Number.NaN,
  recordDurationSec: 1
};

const initialFilterParams: FilterParameters = {
  type: 'Savitzky-Golay',
  windowLength: 13,
  polynomialOrder: 2,
  kalmanQ: 0.002,
  kalmanR: 0.08
};

const initialFftParams: FftParameters = {
  minFrequency: 0,
  maxFrequency: 120,
  zeroPaddingFactor: 3
};

const createMetadata = (analysisIndex = 1, parameterIndex = 1): AnalysisMetadata => ({
  analysisVersionId: `AN-${String(analysisIndex).padStart(4, '0')}`,
  parameterVersionId: `PV-${String(parameterIndex).padStart(4, '0')}`,
  acquisitionTimestamp: new Date().toISOString(),
  processingPipelineVersion: 'pipeline-live-ble-fft-v1.0.0'
});

function App() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('Disconnected');
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState('Ready to connect');
  const [acquisitionState, setAcquisitionState] = useState<AcquisitionState>('Idle');
  const [selectedRepetition, setSelectedRepetition] = useState(1);
  const [setup, setSetup] = useState<ExperimentSetup>(initialSetup);
  const [filterParams, setFilterParams] = useState<FilterParameters>(initialFilterParams);
  const [fftParams, setFftParams] = useState<FftParameters>(initialFftParams);
  const [axisMode, setAxisMode] = useState<TimeAxisMode>('t');
  const [plotMode, setPlotMode] = useState<PlotMode>('Signal Plot');
  const [fftSource, setFftSource] = useState<FftSource>('Filtered data');
  const [metadata, setMetadata] = useState<AnalysisMetadata>(() => createMetadata());
  const [analysisIndex, setAnalysisIndex] = useState(1);
  const [parameterIndex, setParameterIndex] = useState(1);
  const [rawSamplesByRepetition, setRawSamplesByRepetition] = useState<Record<number, number[]>>({});

  // Keep controls editable because the current Start button can send multiple acquisition commands.
  // Real locking should be driven by ESP32 RUNNING/DONE states later.
  const locked = false;

  const safeRepetitionCount =
    Number.isFinite(setup.repetitions) && setup.repetitions > 0
      ? Math.floor(setup.repetitions)
      : DEFAULT_DUMMY_REPETITIONS;

  const liveRepetitions = useMemo(
    () =>
      Object.entries(rawSamplesByRepetition)
        .map(([repetition, samples]) =>
          createRepetitionFromRawSamples(
            Number(repetition),
            samples,
            setup.recordDurationSec,
            filterParams,
            fftParams
          )
        )
        .sort((a, b) => a.repetition - b.repetition),
    [rawSamplesByRepetition, setup.recordDurationSec, filterParams, fftParams]
  );

  const totalRepetitions = Math.max(safeRepetitionCount, liveRepetitions.length, 1);

  const selectedData =
    liveRepetitions.find((repetition) => repetition.repetition === selectedRepetition) ??
    createEmptyRepetition(selectedRepetition);

  const bumpVersionIfLocked = () => {
    if (!locked) return;

    const nextAnalysisIndex = analysisIndex + 1;
    const nextParameterIndex = parameterIndex + 1;

    setAnalysisIndex(nextAnalysisIndex);
    setParameterIndex(nextParameterIndex);
    setMetadata((current) => ({
      ...current,
      analysisVersionId: `AN-${String(nextAnalysisIndex).padStart(4, '0')}`,
      parameterVersionId: `PV-${String(nextParameterIndex).padStart(4, '0')}`
    }));
  };

  const handleSignalChunk = (chunk: SignalChunk) => {
    setRawSamplesByRepetition((current) => {
      const previous = current[chunk.repetition] ?? [];

      return {
        ...current,
        [chunk.repetition]: [...previous, ...chunk.samples]
      };
    });

    setSelectedRepetition((current) => (current === 1 && chunk.repetition !== 1 ? chunk.repetition : current));
    setDeviceStatus(`Receiving signal data: repetition ${chunk.repetition}, ${chunk.samples.length} samples`);
  };

  const handleToggleConnection = async () => {
    if (connectionStatus === 'Connected') {
      disconnectInterferometerBle();
      setConnectionStatus('Disconnected');
      setDeviceStatus('Device disconnected');
      setAcquisitionState('Idle');
      return;
    }

    try {
      setIsConnecting(true);
      setDeviceStatus('Searching for ESP32-S3...');

      const result = await connectToInterferometerBle({
        onDeviceStatusChange: (status: string) => {
          setDeviceStatus(status);

          if (status === 'Device disconnected') {
            setConnectionStatus('Disconnected');
            setAcquisitionState('Idle');
          }

          if (status === 'ACQUISITION_STARTED') {
            setAcquisitionState('Running');
          }

          if (status === 'ACQUISITION_DONE' || status === 'Acquisition data received') {
            setAcquisitionState('Completed');
          }
        },
        onSignalChunk: handleSignalChunk,
        onRepetitionDone: (repetition: number) => {
          setDeviceStatus(`Repetition ${repetition} received`);
        },
        onAcquisitionDone: () => {
          setAcquisitionState('Completed');
          setDeviceStatus('Acquisition data received');
        },
        onDisconnect: () => {
          setConnectionStatus('Disconnected');
          setAcquisitionState('Idle');
          setDeviceStatus('Device disconnected');
        }
      });

      setConnectionStatus('Connected');
      setDeviceStatus(`Connected to ${result.deviceName}`);
    } catch (error) {
      console.error(error);
      setConnectionStatus('Disconnected');
      setDeviceStatus(error instanceof Error ? error.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const validateStartParameters = () => {
    if (setup.motionMode === 'Rotation' && !Number.isFinite(setup.angleDeg)) {
      return 'Fill the angle value before pressing Start.';
    }

    if (setup.motionMode === 'Linear' && !Number.isFinite(setup.distanceMm)) {
      return 'Fill the distance value before pressing Start.';
    }

    if (!Number.isFinite(setup.speed) || setup.speed <= 0) {
      return 'Fill a valid speed value before pressing Start.';
    }

    if (!Number.isFinite(setup.repetitions) || setup.repetitions <= 0) {
      return 'Fill a valid repetitions value before pressing Start.';
    }

    return null;
  };

  const handleStart = async () => {
    if (connectionStatus !== 'Connected') {
      setDeviceStatus('Connect to ESP32-S3 first');
      return;
    }

    const validationError = validateStartParameters();
    if (validationError) {
      setDeviceStatus(validationError);
      return;
    }

    try {
      setRawSamplesByRepetition({});
      setSelectedRepetition(1);
      setAcquisitionState('Running');
      setDeviceStatus('Sending parameters to ESP32-S3...');

      await sendAcquisitionStart({
        mode: setup.motionMode,
        distanceMm: setup.motionMode === 'Linear' ? setup.distanceMm : null,
        angleDeg: setup.motionMode === 'Rotation' ? setup.angleDeg : null,
        speed: setup.speed,
        repetitions: Math.floor(setup.repetitions)
      });

      setDeviceStatus('Start command sent. Waiting for signal data...');
      setMetadata((current) => ({ ...current, acquisitionTimestamp: new Date().toISOString() }));
    } catch (error) {
      console.error(error);
      setAcquisitionState('Idle');
      setDeviceStatus(error instanceof Error ? error.message : 'Failed to send Start command');
    }
  };

  const setSafeSetup = (next: ExperimentSetup) => {
    if (locked) {
      bumpVersionIfLocked();
      return;
    }

    const normalizedRepetitions =
      Number.isFinite(next.repetitions) && next.repetitions > 0 ? Math.floor(next.repetitions) : Number.NaN;
    const normalized = { ...next, repetitions: normalizedRepetitions };
    const nextRepetitionLimit = Number.isFinite(normalizedRepetitions)
      ? Math.max(1, normalizedRepetitions)
      : DEFAULT_DUMMY_REPETITIONS;

    setSetup(normalized);
    setSelectedRepetition((current) => Math.min(current, nextRepetitionLimit));
  };

  const setSafeFilter = (next: FilterParameters) => {
    if (locked) {
      bumpVersionIfLocked();
    }

    setFilterParams(next);
  };

  const setSafeFft = (next: FftParameters) => {
    if (locked) {
      bumpVersionIfLocked();
      return;
    }

    setFftParams({ ...next, maxFrequency: Math.max(next.maxFrequency, next.minFrequency + 10) });
  };

  const goToPreviousRepetition = () => {
    setSelectedRepetition((current) => Math.max(1, current - 1));
  };

  const goToNextRepetition = () => {
    setSelectedRepetition((current) => Math.min(totalRepetitions, current + 1));
  };

  const selectRepetition = (value: number) => {
    setSelectedRepetition(Math.min(Math.max(1, value), totalRepetitions));
  };

  const exportMeasurementCsv = () => {
    const dataToExport: RepetitionData = selectedData;
    const dominant = fftSource === 'Filtered data' ? dataToExport.dominantFiltered : dataToExport.dominantRaw;
    const maxLength = Math.max(dataToExport.signal.length, dataToExport.fft.length);

    if (maxLength === 0) {
      setDeviceStatus('No signal data to export yet');
      return;
    }

    const rows = Array.from({ length: maxLength }, (_, index) => {
      const signalPoint = dataToExport.signal[index];
      const fftPoint = dataToExport.fft[index];

      return {
        timestamp: metadata.acquisitionTimestamp,
        analysis_version_id: metadata.analysisVersionId,
        parameter_version_id: metadata.parameterVersionId,
        repetition: selectedRepetition,
        time: signalPoint?.time ?? '',
        time_squared: signalPoint?.timeSquared ?? '',
        raw_signal: signalPoint?.raw ?? '',
        filtered_signal: signalPoint?.filtered ?? '',
        fft_frequency: fftPoint?.frequency ?? '',
        fft_raw_amplitude: fftPoint?.rawAmplitude ?? '',
        fft_filtered_amplitude: fftPoint?.filteredAmplitude ?? '',
        dominant_frequency: dominant.frequency,
        dominant_amplitude: dominant.amplitude,
        filter_type: filterParams.type,
        sg_window: filterParams.windowLength,
        sg_order: filterParams.polynomialOrder,
        kalman_q: filterParams.kalmanQ,
        kalman_r: filterParams.kalmanR,
        fft_min_frequency: fftParams.minFrequency,
        fft_max_frequency: fftParams.maxFrequency,
        fft_zero_padding_factor: fftParams.zeroPaddingFactor,
        motion_mode: setup.motionMode,
        distance_mm: Number.isFinite(setup.distanceMm) ? setup.distanceMm : '',
        angle_deg: Number.isFinite(setup.angleDeg) ? setup.angleDeg : '',
        speed: Number.isFinite(setup.speed) ? setup.speed : '',
        sample_count: dataToExport.signal.length
      };
    });

    downloadTextFile(
      `interferometer-live-repetition-${selectedRepetition}-${metadata.analysisVersionId}.csv`,
      buildCsv(rows),
      'text/csv'
    );
  };

  return (
    <div className="app-background min-h-screen pb-24 text-primary">
      <Header />

      <main className="dashboard-workspace grid w-full items-start gap-4 px-3 pt-4 2xl:px-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 self-start">
          <DataVisualizationPanel
            data={selectedData}
            plotMode={plotMode}
            axisMode={axisMode}
            fftSource={fftSource}
            selectedRepetition={selectedRepetition}
            totalRepetitions={totalRepetitions}
            fftParams={fftParams}
            onPlotModeChange={setPlotMode}
            onAxisModeChange={(value) => (locked ? bumpVersionIfLocked() : setAxisMode(value))}
            onFftSourceChange={setFftSource}
            onSelectRepetition={selectRepetition}
            onPrevRepetition={goToPreviousRepetition}
            onNextRepetition={goToNextRepetition}
          />
        </div>

        <Sidebar
          connectionStatus={connectionStatus}
          deviceStatus={deviceStatus}
          isConnecting={isConnecting}
          acquisitionState={acquisitionState}
          setup={setup}
          filterParams={filterParams}
          fftParams={fftParams}
          axisMode={axisMode}
          locked={locked}
          onToggleConnection={handleToggleConnection}
          onSetupChange={setSafeSetup}
          onFilterChange={setSafeFilter}
          onFftChange={setSafeFft}
          onAxisModeChange={(value) => (locked ? bumpVersionIfLocked() : setAxisMode(value))}
        />
      </main>

      <BottomActionBar onStart={handleStart} onSaveCsv={exportMeasurementCsv} isRunning={acquisitionState === 'Running'} />
    </div>
  );
}

export default App;
