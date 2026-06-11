import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group.tsx";

type Option<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type SlidingRadioGroupProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  name: string;
  ariaLabel: string;
};

export function SlidingRadioGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SlidingRadioGroupProps<T>) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        // Radix emits "" when toggling the active item off in single
        // mode — the picker is meant to always have a selection, so
        // suppress that path.
        if (next && next !== value) onChange(next as T);
      }}
      aria-label={ariaLabel}
      role="radiogroup"
      className="w-full rounded-xl bg-muted p-1 gap-0"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="flex-1 flex flex-col gap-0.5 px-3 py-2 rounded-lg data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
        >
          <span className="text-sm font-semibold leading-none">
            {option.label}
          </span>
          {option.description && (
            <span className="text-[0.625rem] leading-none opacity-70">
              {option.description}
            </span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
