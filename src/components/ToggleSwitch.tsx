import { Switch } from "./ui/switch.tsx";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: () => void;
  label: string;
};

export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <div className="flex items-center gap-3 select-none touch-manipulation">
      <span className="text-sm text-text-secondary">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
