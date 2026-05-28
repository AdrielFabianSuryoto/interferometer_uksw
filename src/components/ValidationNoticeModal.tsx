import { AlertTriangle, Bluetooth, FileWarning, Radio, X } from 'lucide-react';

type ValidationNoticeVariant = 'warning' | 'error' | 'connection' | 'data';

interface ValidationNoticeModalProps {
  open: boolean;
  title: string;
  message: string;
  actionLabel?: string;
  variant?: ValidationNoticeVariant;
  detail?: string;
  onClose: () => void;
}

const variantStyles: Record<ValidationNoticeVariant, { iconClass: string; buttonClass: string }> = {
  warning: {
    iconClass: 'bg-red-100 text-warning-red',
    buttonClass: 'bg-lime-500 text-white shadow-neu-green'
  },
  error: {
    iconClass: 'bg-red-100 text-warning-red',
    buttonClass: 'bg-warning-red text-white shadow-neu-button'
  },
  connection: {
    iconClass: 'bg-lime-100 text-lime-700',
    buttonClass: 'bg-lime-500 text-white shadow-neu-green'
  },
  data: {
    iconClass: 'bg-lime-100 text-lime-700',
    buttonClass: 'bg-lime-500 text-white shadow-neu-green'
  }
};

export const ValidationNoticeModal = ({
  open,
  title,
  message,
  actionLabel = 'OK',
  variant = 'warning',
  detail,
  onClose
}: ValidationNoticeModalProps) => {
  if (!open) return null;

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-primary/20 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-[32px] border border-white/70 bg-card p-5 shadow-neu-floating">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`grid size-12 place-items-center rounded-2xl shadow-neu-inset ${styles.iconClass}`}>
              <NoticeIcon variant={variant} />
            </div>
            <div>
              <h2 className="text-lg font-black text-primary">{title}</h2>
              <p className="mt-1 text-xs font-semibold leading-5 text-secondary">{message}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-2xl bg-card text-secondary shadow-neu hover:text-primary"
            aria-label="Close notice"
          >
            <X size={18} />
          </button>
        </div>

        {detail && (
          <div className="rounded-[24px] bg-white/80 p-4 shadow-neu-inset">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary">Details</p>
            <p className="mt-2 text-sm font-black leading-5 text-primary">{detail}</p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className={`mt-5 w-full rounded-[22px] px-4 py-4 text-sm font-black transition hover:-translate-y-0.5 ${styles.buttonClass}`}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
};

const NoticeIcon = ({ variant }: { variant: ValidationNoticeVariant }) => {
  if (variant === 'connection') return <Bluetooth size={22} strokeWidth={2.7} />;
  if (variant === 'data') return <FileWarning size={22} strokeWidth={2.7} />;
  if (variant === 'error') return <Radio size={22} strokeWidth={2.7} />;
  return <AlertTriangle size={22} strokeWidth={2.7} />;
};
