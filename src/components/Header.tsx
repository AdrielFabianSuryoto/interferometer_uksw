import logoUksw from "../images/logo_uksw.png";
import logoFsm from "../images/logo_fsm.png";

export function Header() {
  return (
    <header className="relative overflow-hidden rounded-b-[28px] border-b border-[#DDE8DD]/80 bg-gradient-to-br from-[#F7FAF7] via-[#F1FAEF] to-[#E4F6D5] px-6 py-2 shadow-[0_16px_36px_rgba(47,107,47,0.10)]">
      <div className="pointer-events-none absolute right-[-80px] top-[-110px] h-64 w-64 rounded-full bg-[#7BBF22]/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[140px] bottom-[-90px] h-44 w-44 rounded-full bg-white/70 blur-2xl" />

      <div className="relative flex max-w-[1680px] items-center gap-5">
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
    </header>
  );
}

export default Header;
