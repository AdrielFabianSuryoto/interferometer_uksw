interface BottomActionBarProps {
  onStart: () => void;
  onSaveCsv: () => void;
  isRunning: boolean;
}

export const BottomActionBar = ({ onStart, onSaveCsv, isRunning }: BottomActionBarProps) => {
  return (
    <div className="fixed inset-x-4 bottom-4 z-20 rounded-[26px] bg-card/95 p-4 shadow-neu-floating backdrop-blur">
      <div className="grid grid-cols-4 gap-3">
        <button
          onClick={onStart}
          className="action-primary col-span-3"
          type="button"
          title={isRunning ? 'Send another Start command' : 'Send Start command'}
        >
          Start
        </button>
        <button onClick={onSaveCsv} className="action-success col-span-1" type="button">
          Save CSV
        </button>
      </div>
    </div>
  );
};
