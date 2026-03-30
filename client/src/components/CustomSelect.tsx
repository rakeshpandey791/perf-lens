import { useEffect, useRef, useState } from "react";

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type CustomSelectProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  widthClassName?: string;
};

export default function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  widthClassName = "w-full"
}: CustomSelectProps<T>): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className={`relative ${widthClassName}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        <span className="truncate pr-3">{selected?.label}</span>
        <span className={`text-xs text-slate-500 transition ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                  active ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
