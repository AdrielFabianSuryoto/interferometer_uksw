import { Bluetooth, CheckCircle2, Loader2, Radio, ShieldCheck, X, XCircle } from 'lucide-react';

type PairingModalStatus = 'idle' | 'scanning' | 'connected' | 'failed';

interface BlePairingModalProps {
  open: boolean;
  status: PairingModalStatus;
  deviceStatus: string;
  isConnecting: boolean;
  onPair: () => void;
  onClose: () => void;
}

const statusCopy: Record<PairingModalStatus, { title: string; message: string }> = {
  idle: {
    title: 'Connect ESP32-S3',
    message: 'Make sure the interferometer is powered on and BLE advertising is active.'
  },
  scanning: {
    title: 'Waiting for browser pairing',
    message: 'Chrome will open a Bluetooth pairing window. Select ESP32S3-Interferometer there.'
  },
  connected: {
    title: 'Device connected',
    message: 'The web app is now connected to the interferometer.'
  },
  failed: {
    title: 'Connection failed',
    message: 'Check that the ESP32-S3 is powered on, advertising, and not connected elsewhere.'
  }
};

export const BlePairingModal = ({
  open,
  status,
  deviceStatus,
  isConnecting,
  onPair,
  onClose
}: BlePairingModalProps) => {
  if (!open) return null;

  const copy = statusCopy[status];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-primary/20 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[440px] rounded-[32px] border border-white/70 bg-card p-5 shadow-neu-floating">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-lime-100 text-lime-700 shadow-neu-inset">
              <Bluetooth size={22} strokeWidth={2.7} />
            </div>
            <div>
              <h2 className="text-lg font-black text-primary">{copy.title}</h2>
              <p className="mt-1 text-xs font-semibold leading-5 text-secondary">{copy.message}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-2xl bg-card text-secondary shadow-neu hover:text-primary"
            aria-label="Close pairing modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="rounded-[26px] bg-white/80 p-4 shadow-neu-inset">
          <div className="mb-4 flex items-center gap-3">
            <StatusIcon status={status} isConnecting={isConnecting} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary">Device Status</p>
              <p className="mt-1 text-sm font-black text-primary">{deviceStatus}</p>
            </div>
          </div>

          <div className="grid gap-3 text-xs font-bold text-secondary">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-lime-600" />
              Browser pairing is required for security.
            </div>
            <div className="flex items-center gap-2">
              <Radio size={15} className="text-lime-600" />
              Select ESP32S3-Interferometer in the Chrome popup.
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_1.4fr] gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[22px] bg-card px-4 py-4 text-sm font-black text-primary shadow-neu transition hover:-translate-y-0.5"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onPair}
            disabled={isConnecting || status === 'connected'}
            className="rounded-[22px] bg-lime-500 px-4 py-4 text-sm font-black text-white shadow-neu-green transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-red-400 disabled:hover:translate-y-0"
          >
            {isConnecting ? 'Opening Chrome Pairing...' : status === 'connected' ? 'Connected' : 'Pair Device'}
          </button>
        </div>
      </div>
    </div>
  );
};

const StatusIcon = ({ status, isConnecting }: { status: PairingModalStatus; isConnecting: boolean }) => {
  if (isConnecting || status === 'scanning') {
    return (
      <div className="grid size-11 place-items-center rounded-2xl bg-lime-100 text-lime-700">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div className="grid size-11 place-items-center rounded-2xl bg-lime-100 text-lime-700">
        <CheckCircle2 size={20} />
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="grid size-11 place-items-center rounded-2xl bg-red-100 text-red-500">
        <XCircle size={20} />
      </div>
    );
  }

  return (
    <div className="grid size-11 place-items-center rounded-2xl bg-lime-100 text-lime-700">
      <Bluetooth size={20} />
    </div>
  );
};
