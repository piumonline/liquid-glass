import BackgroundPicker from './BackgroundPicker';

/** A single labelled control row. */
function Field({ field, value, onChange }) {
  const label = (
    <span className="field__label" title={field.label}>
      {field.label}
    </span>
  );

  if (field.type === 'color') {
    return (
      <label className="field">
        {label}
        <input
          className="field__color"
          type="color"
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="field">
        {label}
        <select
          className="field__select"
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
        >
          {field.options.map(([optValue, optLabel]) => (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="field">
      {label}
      <input
        className="field__range"
        type="range"
        min={field.min}
        max={field.max}
        step={field.step}
        value={value}
        onChange={(e) => onChange(field.key, Number(e.target.value))}
      />
      <span className="field__value">{field.format(value)}</span>
    </label>
  );
}

export default function ControlPanel({
  open,
  onClose,
  groups,
  params,
  onParamChange,
  background,
  onBackgroundChange,
  defaultBackground,
}) {
  return (
    <aside className={`panel ${open ? 'panel--open' : ''}`}>
      <header className="panel__header">
        <span className="panel__title">Controls</span>
        <button className="icon-btn" type="button" onClick={onClose} aria-label="Close controls">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </header>

      <div className="panel__body">
        {groups.map((group) => (
          <section className="panel__group" key={group.title}>
            <h2 className="panel__heading">{group.title}</h2>
            {group.fields.map((field) => (
              <Field
                key={field.key}
                field={field}
                value={params[field.key]}
                onChange={onParamChange}
              />
            ))}
          </section>
        ))}

        <section className="panel__group">
          <h2 className="panel__heading">Background</h2>
          <BackgroundPicker
            background={background}
            defaultBackground={defaultBackground}
            onChange={onBackgroundChange}
          />
        </section>
      </div>
    </aside>
  );
}
