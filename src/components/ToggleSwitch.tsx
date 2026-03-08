type ToggleSwitchProps = {
  checked: boolean;
  onChange: () => void;
  label: string;
};

export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none touch-manipulation">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
          checked ? "bg-accent" : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
