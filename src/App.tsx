import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DataVisualizationPanel } from './components/DataVisualizationPanel';
import { BottomActionBar } from './components/BottomActionBar';
import { BlePairingModal } from './components/BlePairingModal';
import { ValidationNoticeModal } from './components/ValidationNoticeModal';
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
type PairingModalStatus = 'idle' | 'scanning' | 'connected' | 'failed';
type NoticeVariant = 'warning' | 'error' | 'connection' | 'data';


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
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [pairingModalStatus, setPairingModalStatus] = useState<PairingModalStatus>('idle');
  const [validationNotice, setValidationNotice] = useState<{ title: string; message: string; detail?: string; variant?: NoticeVariant } | null>(null);
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
  const firstIncomingRepetitionOffsetRef = useRef<number | null>(null);

  // Keep controls editable because the current Start button can send multiple acquisition commands.
  // Real locking should be driven by ESP32 RUNNING/DONE states later.
  const locked = false;

  const safeRepetitionCount =
    Number.isFinite(setup.repetitions) && setup.repetitions > 0
      ? Math.floor(setup.repetitions)
      : DEFAULT_DUMMY_REPETITIONS;

  const maxReceivedRepetition = useMemo(() => {
    const received = Object.keys(rawSamplesByRepetition)
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0);

    return received.length ? Math.max(...received) : 0;
  }, [rawSamplesByRepetition]);

  const totalRepetitions = Math.max(safeRepetitionCount, maxReceivedRepetition, selectedRepetition, 1);

  const selectedSamples = rawSamplesByRepetition[selectedRepetition] ?? [];
  const deferredSelectedSamples = useDeferredValue(selectedSamples);
  const deferredFilterParams = useDeferredValue(filterParams);
  const deferredFftParams = useDeferredValue(fftParams);

  const selectedData = useMemo(
    () =>
      deferredSelectedSamples.length
        ? createRepetitionFromRawSamples(
            selectedRepetition,
            deferredSelectedSamples,
            setup.recordDurationSec,
            deferredFilterParams,
            deferredFftParams
          )
        : createEmptyRepetition(selectedRepetition),
    [deferredSelectedSamples, selectedRepetition, setup.recordDurationSec, deferredFilterParams, deferredFftParams]
  );

  const dominantFrequencyHz =
    fftSource === 'Raw data' ? selectedData.dominantRaw.frequency : selectedData.dominantFiltered.frequency;
  const fringeDurationSec = Number.isFinite(setup.speed) && setup.speed > 0 ? setup.speed : 0;
  const fringeCount =
    Number.isFinite(dominantFrequencyHz) && dominantFrequencyHz > 0 && fringeDurationSec > 0
      ? dominantFrequencyHz * fringeDurationSec
      : 0;

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

  const showNotice = (notice: { title: string; message: string; detail?: string; variant?: NoticeVariant }) => {
    setValidationNotice(notice);
  };


  const normalizeIncomingRepetition = (incomingRepetition: number): number => {
    const safeIncomingRepetition = Math.max(1, Math.floor(incomingRepetition || 1));

    if (firstIncomingRepetitionOffsetRef.current === null) {
      firstIncomingRepetitionOffsetRef.current = safeIncomingRepetition - 1;
    }

    return Math.max(1, safeIncomingRepetition - firstIncomingRepetitionOffsetRef.current);
  };

  const handleSignalChunk = (chunk: SignalChunk) => {
    const repetition = normalizeIncomingRepetition(chunk.repetition);

    setRawSamplesByRepetition((current) => {
      const previous = current[repetition] ?? [];

      return {
        ...current,
        [repetition]: [...previous, ...chunk.samples]
      };
    });

    // Keep the user's selected repetition stable.
    // Incoming hardware repetition numbers are normalized so the first received dataset is always Repetition 1.
    setDeviceStatus(`Receiving signal data: repetition ${repetition}, ${chunk.samples.length} samples`);
  };

  const handleToggleConnection = () => {
    if (connectionStatus === 'Connected') {
      disconnectInterferometerBle();
      setConnectionStatus('Disconnected');
      setPairingModalStatus('idle');
      setIsPairingModalOpen(false);
      setDeviceStatus('Device disconnected');
      setAcquisitionState('Idle');
      return;
    }

    setPairingModalStatus('idle');
    setIsPairingModalOpen(true);
    setDeviceStatus('Ready to pair with ESP32-S3');
  };

  const handlePairDevice = async () => {
    try {
      setIsConnecting(true);
      setPairingModalStatus('scanning');
      setDeviceStatus('Searching for ESP32-S3...');

      const result = await connectToInterferometerBle({
        onDeviceStatusChange: (status: string) => {
          setDeviceStatus(status);

          if (status === 'Device disconnected') {
            setConnectionStatus('Disconnected');
            setPairingModalStatus('idle');
            setAcquisitionState('Idle');
          }

          if (status.startsWith('ERROR:')) {
            showNotice({
              title: 'ESP32 Error',
              message: 'The ESP32-S3 reported an error.',
              detail: status.replace(/^ERROR:/, '').trim() || status,
              variant: 'error'
            });
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
          const normalizedRepetition = normalizeIncomingRepetition(repetition);
          setDeviceStatus(`Repetition ${normalizedRepetition} received`);
        },
        onAcquisitionDone: () => {
          setAcquisitionState('Completed');
          setDeviceStatus('Acquisition data received');
        },
        onDisconnect: () => {
          setConnectionStatus('Disconnected');
          setPairingModalStatus('idle');
          setAcquisitionState('Idle');
          setDeviceStatus('Device disconnected');
        }
      });

      setConnectionStatus('Connected');
      setPairingModalStatus('connected');
      setDeviceStatus(`Connected to ${result.deviceName}`);

      window.setTimeout(() => {
        setIsPairingModalOpen(false);
      }, 900);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Connection failed';
      setConnectionStatus('Disconnected');
      setPairingModalStatus('failed');
      setDeviceStatus(message);
      showNotice({
        title: 'BLE Connection Failed',
        message: 'The web app could not connect to the ESP32-S3.',
        detail: message,
        variant: 'connection'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const validateStartParameters = () => {
    if (setup.motionMode === 'Rotation' && !Number.isFinite(setup.angleDeg)) {
      return {
        title: 'Missing Angle',
        message: 'Fill the angle value before starting the rotation acquisition.',
        detail: 'Rotation mode requires a valid angle in degrees.',
        variant: 'warning' as NoticeVariant
      };
    }

    if (setup.motionMode === 'Linear' && !Number.isFinite(setup.distanceMm)) {
      return {
        title: 'Missing Distance',
        message: 'Fill the distance value before starting the linear acquisition.',
        detail: 'Linear mode requires a valid distance in millimeters.',
        variant: 'warning' as NoticeVariant
      };
    }

    if (!Number.isFinite(setup.speed) || setup.speed <= 0) {
      return {
        title: 'Invalid Duration',
        message: 'Fill a valid duration value before starting the acquisition.',
        detail: 'Duration must be greater than 0 seconds.',
        variant: 'warning' as NoticeVariant
      };
    }

    if (setup.motionMode === 'Linear' && setup.speed < 2) {
      return {
        title: 'Duration Too Short',
        message: 'Linear mode requires a minimum duration of 2 seconds.',
        detail: 'Increase the Duration field to 2.0 s or higher before sending parameters.',
        variant: 'warning' as NoticeVariant
      };
    }

    if (!Number.isFinite(setup.repetitions) || setup.repetitions <= 0) {
      return {
        title: 'Invalid Repetitions',
        message: 'Fill a valid repetitions value before starting the acquisition.',
        detail: 'Repetitions must be at least 1.',
        variant: 'warning' as NoticeVariant
      };
    }

    return null;
  };

  const handleStart = async () => {
    if (acquisitionState === 'Running') {
      showNotice({
        title: 'Acquisition Still Running',
        message: 'Wait until the current acquisition is complete before starting another one.',
        detail: 'If the device is stuck, disconnect and reconnect the ESP32-S3.',
        variant: 'warning'
      });
      return;
    }

    if (connectionStatus !== 'Connected') {
      const message = 'Connect to ESP32-S3 first';
      setDeviceStatus(message);
      showNotice({
        title: 'Device Not Connected',
        message: 'Connect to the ESP32-S3 before sending acquisition parameters.',
        detail: 'Use the Connect button in System Setup, then pair with ESP32S3-Interferometer.',
        variant: 'connection'
      });
      return;
    }

    const validationError = validateStartParameters();
    if (validationError) {
      setDeviceStatus(validationError.message);
      showNotice(validationError);
      return;
    }

    try {
      firstIncomingRepetitionOffsetRef.current = null;
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
      const message = error instanceof Error ? error.message : 'Failed to send Start command';
      setAcquisitionState('Idle');
      setDeviceStatus(message);
      showNotice({
        title: 'Failed to Send Parameters',
        message: 'The web app could not send the acquisition command to ESP32-S3.',
        detail: message,
        variant: 'error'
      });
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
    setSelectedRepetition((current) => Math.min(current, Math.max(nextRepetitionLimit, maxReceivedRepetition, 1)));
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
      const message = 'No signal data to export yet';
      setDeviceStatus(message);
      showNotice({
        title: 'No Signal Data',
        message: 'There is no signal data available for CSV export.',
        detail: 'Run an acquisition first, then save the selected repetition.',
        variant: 'data'
      });
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
          dominantFrequencyHz={dominantFrequencyHz}
          fringeDurationSec={fringeDurationSec}
          fringeCount={fringeCount}
          onToggleConnection={handleToggleConnection}
          onSetupChange={setSafeSetup}
          onFilterChange={setSafeFilter}
          onFftChange={setSafeFft}
          onAxisModeChange={(value) => (locked ? bumpVersionIfLocked() : setAxisMode(value))}
        />
      </main>

      <BlePairingModal
        open={isPairingModalOpen}
        status={pairingModalStatus}
        deviceStatus={deviceStatus}
        isConnecting={isConnecting}
        onPair={handlePairDevice}
        onClose={() => setIsPairingModalOpen(false)}
      />

      <ValidationNoticeModal
        open={Boolean(validationNotice)}
        title={validationNotice?.title ?? ''}
        message={validationNotice?.message ?? ''}
        detail={validationNotice?.detail}
        variant={validationNotice?.variant}
        onClose={() => setValidationNotice(null)}
      />

      <BottomActionBar onStart={handleStart} onSaveCsv={exportMeasurementCsv} isRunning={acquisitionState === 'Running'} />
    </div>
  );
}

export default App;
