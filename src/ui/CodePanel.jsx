import { useEffect, useMemo, useRef, useState } from 'react';
import { ENGINES, buildExport } from '../lib/codeExport';

/** Clipboard API first, with a selection-based fallback for insecure origins. */
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to the legacy path */
    }
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  area.style.opacity = '0';
  document.body.appendChild(area);

  const selection = document.getSelection();
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }

  document.body.removeChild(area);
  if (previous && selection) {
    selection.removeAllRanges();
    selection.addRange(previous);
  }
  return ok;
}

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CodePanel({ engine, onEngineChange, params, position, onClose }) {
  const code = useMemo(
    () => buildExport(engine, params, { position }),
    [engine, params, position],
  );
  const [status, setStatus] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleCopy() {
    const ok = await copyText(code);
    setStatus(ok ? 'Copied' : 'Press Ctrl+C');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(''), 1800);
  }

  const meta = ENGINES[engine];

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Copy component code">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__card">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">Use this glass</h2>
            <p className="modal__subtitle">
              These are your live settings, applied as props. Copy the file into your project and
              import it.
            </p>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </header>

        <div className="modal__tabs" role="tablist">
          {Object.values(ENGINES).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={engine === item.id}
              className={`tab ${engine === item.id ? 'tab--active' : ''}`}
              onClick={() => onEngineChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <pre className="modal__code">
          <code>{code}</code>
        </pre>

        <footer className="modal__footer">
          <span className="modal__note">{meta.supports}</span>
          <div className="modal__actions">
            <button className="btn btn--sm" type="button" onClick={() => download(`${meta.component}.jsx`, code)}>
              Download .jsx
            </button>
            <button className="btn btn--accent" type="button" onClick={handleCopy}>
              {status || 'Copy code'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
