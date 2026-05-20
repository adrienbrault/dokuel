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
  name,
  ariaLabel,
}: SlidingRadioGroupProps<T>) {
  const activeIndex = options.findIndex((o) => o.value === value);
  const count = options.length;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative flex w-full rounded-2xl bg-bg-inset border border-border-default p-1"
    >
      <div
        className="absolute top-1 bottom-1 rounded-xl transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${count})`,
          transform: `translateX(calc(${activeIndex} * 100%))`,
          backgroundImage:
            "linear-gradient(160deg, var(--color-accent), var(--color-accent-strong))",
          boxShadow:
            "0 6px 14px -8px oklch(0.52 0.12 168 / 0.6), inset 0 1px 0 0 oklch(1 0 0 / 0.2)",
        }}
        aria-hidden="true"
      />

      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <label
            key={option.value}
            className={`relative z-10 flex flex-1 ${
              option.description ? "flex-col" : "items-center justify-center"
            } items-center gap-0.5 rounded-lg py-2 cursor-pointer select-none touch-manipulation transition-colors duration-200 ${
              isActive ? "text-text-on-accent" : "text-text-secondary"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={isActive}
              onChange={() => {
                if (!isActive) onChange(option.value);
              }}
              className="sr-only"
            />
            <span className="text-sm font-semibold leading-none">
              {option.label}
            </span>
            {option.description && (
              <span
                className={`text-[0.625rem] leading-none transition-colors duration-200 ${
                  isActive ? "text-text-on-accent/70" : "text-text-muted"
                }`}
              >
                {option.description}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
