import logoUksw from "../images/logo_uksw.png";
import logoFsm from "../images/logo_fsm.png";

type SafetyStatus = 'booting' | 'standby' | 'homing' | 'running' | 'done' | 'error';

interface HeaderProps {
  safetyStatus?: SafetyStatus;
}

const safetyStatusConfig: Record<SafetyStatus, { label: string; dotClass: string; pulse: boolean }> = {
  booting: {
    label: 'Booting',
    dotClass: 'bg-blue-500',
    pulse: true
  },
  standby: {
    label: 'Ready / standby',
    dotClass: 'bg-blue-500',
    pulse: false
  },
  homing: {
    label: 'Homing / return home',
    dotClass: 'bg-yellow-400',
    pulse: true
  },
  running: {
    label: 'Running acquisition',
    dotClass: 'bg-green-500',
    pulse: true
  },
  done: {
    // After acquisition is complete, the interferometer returns to standby.
    // Keep the label as acquisition done, but show steady blue to indicate safe standby.
    label: 'Acquisition done',
    dotClass: 'bg-blue-500',
    pulse: false
  },
  error: {
    label: 'Error / abort',
    dotClass: 'bg-red-500',
    pulse: true
  }
};

export function Header({ safetyStatus = 'standby' }: HeaderProps) {
  const indicator = safetyStatusConfig[safetyStatus];

  return (
    <header className="relative overflow-hidden rounded-b-[28px] border-b border-[#DDE8DD]/80 bg-gradient-to-br from-[#F7FAF7] via-[#F1FAEF] to-[#E4F6D5] px-6 py-2 shadow-[0_16px_36px_rgba(47,107,47,0.10)]">
      <div className="pointer-events-none absolute right-[-80px] top-[-110px] h-64 w-64 rounded-full bg-[#7BBF22]/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[140px] bottom-[-90px] h-44 w-44 rounded-full bg-white/70 blur-2xl" />

      <div className="relative flex w-full max-w-none items-center gap-5">
        <div className="flex min-w-0 items-center gap-5">
          <div className="flex shrink-0 items-center gap-2 rounded-2xl px-2 py-1.5">
            <img
              src={logoUksw}
              alt="Logo UKSW"
              className="h-12 w-12 object-contain"
              draggable={false}
            />
            <img
              src={logoFsm}
              alt="Logo FSM"
              className="h-12 w-12 object-contain"
              draggable={false}
            />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-[42px] font-black leading-none tracking-tight text-[#2F6B2F] md:text-[48px]">
              Interferometer
            </h1>
            <p className="mt-2 text-sm font-semibold tracking-[0.18em] text-[#647067] md:text-base">
              Laboratorium NIR UKSW
            </p>
          </div>
        </div>

        <div className="absolute right-6 top-3 hidden shrink-0 items-center gap-3 rounded-[22px] border border-white/70 bg-white/75 px-4 py-3 shadow-neu-raised backdrop-blur md:flex">
          <div className="relative grid size-4 place-items-center">
            {indicator.pulse && (
              <span className={`absolute inline-flex size-4 animate-ping rounded-full opacity-60 ${indicator.dotClass}`} />
            )}
            <span className={`relative inline-flex size-3 rounded-full ${indicator.dotClass}`} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#647067]">Safety Sign</p>
            <p className="mt-0.5 text-xs font-black text-[#244824]">{indicator.label}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
