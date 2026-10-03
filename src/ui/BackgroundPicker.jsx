import { useState } from 'react';
import { BACKGROUNDS, validateImage } from '../lib/backgrounds';

export default function BackgroundPicker({ background, defaultBackground, onChange }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const isPreset = BACKGROUNDS.some((b) => b.url === background);

  async function applyDraft() {
    const url = draft.trim();
    if (!url) return;

    setPending(true);
    setError('');
    try {
      await validateImage(url);
      onChange(url);
      setDraft('');
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="thumbs">
        {BACKGROUNDS.map((preset) => (
          <img
            key={preset.url}
            className={`thumb ${background === preset.url ? 'thumb--active' : ''}`}
            src={preset.url}
            alt={preset.label}
            title={preset.label}
            draggable={false}
            onClick={() => {
              setError('');
              onChange(preset.url);
            }}
          />
        ))}

        {!isPreset && background && (
          <img
            className="thumb thumb--active"
            src={background}
            alt="Custom background"
            title="Custom background"
            draggable={false}
          />
        )}
      </div>

      <div className="thumbs__row">
        <input
          className="thumbs__input"
          type="text"
          placeholder="Paste image URL…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyDraft();
          }}
        />
        <button className="btn btn--sm" type="button" onClick={applyDraft} disabled={pending}>
          {pending ? '…' : 'Load'}
        </button>
        <button
          className="btn btn--sm btn--accent"
          type="button"
          onClick={() => {
            setError('');
            setDraft('');
            onChange(defaultBackground);
          }}
        >
          Reset
        </button>
      </div>

      {error && <p className="thumbs__error">{error}</p>}
    </>
  );
}
