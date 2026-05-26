interface StatusBadgeProps {
  label: string;
  value: string;
  tone?: 'green' | 'blue' | 'red' | 'neutral';
}

const toneClass = {
  green: 'bg-primary-green text-white shadow-green-glow',
  blue: 'bg-scientific-blue text-white',
  red: 'bg-warning-red text-white',
  neutral: 'bg-card text-primary shadow-neu-inset-soft'
};

export const StatusBadge = ({ label, value, tone = 'neutral' }: StatusBadgeProps) => {
  return (
    <div className="rounded-[20px] bg-card p-3 shadow-neu-raised">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">{label}</p>
      <div className={`mt-2 rounded-[15px] px-3 py-2 text-center text-sm font-extrabold ${toneClass[tone]}`}>{value}</div>
    </div>
  );
};
