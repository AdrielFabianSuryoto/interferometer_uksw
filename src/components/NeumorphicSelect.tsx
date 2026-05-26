import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface NeumorphicSelectProps<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
}

export function NeumorphicSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
  disabled = false
}: NeumorphicSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const selectOption = (nextValue: T) => {
    if (disabled) return;
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className="select-trigger h-14 w-full disabled:cursor-not-allowed disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="min-w-0 text-left">
          <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-secondary">{label}</span>
          <span className="mt-0.5 block truncate text-sm font-black text-primary">{selectedOption?.label}</span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-secondary transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="select-menu" role="listbox">
          {options.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => selectOption(option.value)}
                className={`select-option ${active ? 'select-option-active' : ''}`}
              >
                <span>{option.label}</span>
                {active && <Check size={16} className="text-primary-green" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
