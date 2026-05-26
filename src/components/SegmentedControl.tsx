interface SegmentedControlProps<T extends string> {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({ options, value, onChange, disabled }: SegmentedControlProps<T>) {
  return (
    <div className="grid gap-2 rounded-[22px] bg-card p-2 shadow-neu-inset-soft" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={`rounded-[17px] px-4 py-3 text-sm font-extrabold transition ${
              active ? 'bg-primary-green text-white shadow-neu-button' : 'bg-card text-primary shadow-neu-raised hover:text-dark-green'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            {active ? '✓ ' : ''}{option}
          </button>
        );
      })}
    </div>
  );
}
