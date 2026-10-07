import type { CSSProperties, ReactNode } from 'react';

/** Inset grouped list section, like a Settings form: a title-case header and rounded rows. */
export function Group({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`group ${className}`}>
      {title && <h3 className="group-title">{title}</h3>}
      <div className="group-body">{children}</div>
    </section>
  );
}

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group disclosure">
      <summary className="group-title">{title}</summary>
      <div className="group-body">{children}</div>
    </details>
  );
}

/** A row with a label on the leading edge and a control on the trailing edge. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="row">
      <span className="row-label">{label}</span>
      <span className="row-control">{children}</span>
    </label>
  );
}

export function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row">
      <span className="row-label">{label}</span>
      <input className="switch" type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Slider with a filled track; the knob turns into glass while pressed. */
export function Slider({ value, min, max, step = 1, onChange, label }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input className="slider" type="range" aria-label={label} min={min} max={max} step={step} value={value} style={{ '--pct': `${pct}%` } as CSSProperties} onChange={(e) => onChange(Number(e.target.value))} />
  );
}

/** Segmented control with a sliding thumb. */
export function Segmented<T extends string | number>({ value, options, onChange, label, kind = 'radio', className = '', glass = false }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; kind?: 'radio' | 'tab'; className?: string; glass?: boolean }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={`seg ${glass ? 'seg-glass' : ''} ${className}`} role={kind === 'tab' ? 'tablist' : 'radiogroup'} aria-label={label} style={{ '--n': options.length, '--i': index } as CSSProperties}>
      {!glass && <span className="seg-track" aria-hidden="true" />}
      <span className={`seg-thumb ${glass ? 'lens lens-thumb' : ''}`} aria-hidden="true" />
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role={kind === 'tab' ? 'tab' : 'radio'}
          {...(kind === 'tab' ? { 'aria-selected': o.value === value } : { 'aria-checked': o.value === value })}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
