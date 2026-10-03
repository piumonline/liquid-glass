import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import LiquidGlass from './glass/LiquidGlass';
import useDrag from './hooks/useDrag';
import CodePanel from './ui/CodePanel';
import ControlPanel from './ui/ControlPanel';

import { CONTROL_GROUPS, DEFAULT_PARAMS } from './lib/controlSchema';
import {
  DEFAULT_BACKGROUND,
  loadStoredBackground,
  storeBackground,
  validateImage,
} from './lib/backgrounds';

import './styles/app.css';

// Three.js is ~600 kB and only the WebGL engine needs it, so keep it out of
// the initial bundle.
const LiquidGlassWebGL = lazy(() => import('./glass/LiquidGlassWebGL'));

/** Top-left of the glass pane, centred in the viewport. */
function centred() {
  const { innerWidth: vw, innerHeight: vh } = window;
  return {
    x: Math.round(vw / 2 - DEFAULT_PARAMS.width / 2),
    y: Math.round(vh / 2 - DEFAULT_PARAMS.height / 2),
  };
}

export default function App() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [background, setBackground] = useState(DEFAULT_BACKGROUND);
  const [engine, setEngine] = useState('svg');
  const [panelOpen, setPanelOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [exportEngine, setExportEngine] = useState('svg');

  const { position, setPosition, dragProps } = useDrag(centred);

  /* --- restore a previously chosen backdrop --- */
  useEffect(() => {
    const stored = loadStoredBackground();
    if (!stored) return;

    let cancelled = false;
    validateImage(stored)
      .then(() => {
        if (!cancelled) setBackground(stored);
      })
      .catch(() => storeBackground('')); // stale URL: forget it

    return () => {
      cancelled = true;
    };
  }, []);

  /* --- keep the pane on screen when the window changes size --- */
  useEffect(() => {
    let timer;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setPosition(centred()), 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [setPosition]);

  const handleParamChange = useCallback((key, value) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const handleBackgroundChange = useCallback((url) => {
    setBackground(url);
    storeBackground(url);
  }, []);

  // The export reads from the same params object the preview renders from,
  // so keep `background` in step with the backdrop in state.
  const exportParams = useMemo(
    () => ({ ...params, background }),
    [params, background],
  );

  const glassStyle = {
    position: 'absolute',
    left: position.x,
    top: position.y,
  };

  const isWebGL = engine === 'webgl';

  return (
    <>
      <div className="stage">
        <div
          className="stage__bg"
          style={{ background: `url("${background}") center/cover no-repeat` }}
        />

        {isWebGL ? (
          <Suspense fallback={null}>
            <LiquidGlassWebGL
              background={background}
              style={{ position: 'absolute', inset: 0 }}
              position={{
                x: position.x + params.width / 2,
                y: position.y + params.height / 2,
              }}
              width={params.width}
              height={params.height}
              borderRadius={params.borderRadius}
              thickness={params.thickness}
              bezel={params.bezel}
              ior={params.ior}
              blur={params.blur * 1.5}
              specular={params.specularOpacity}
              tintOpacity={params.tintOpacity / 100}
              shadowOpacity={params.shadowOpacity / 100}
            />
          </Suspense>
        ) : (
          <LiquidGlass
            style={glassStyle}
            width={params.width}
            height={params.height}
            borderRadius={params.borderRadius}
            surface={params.surface}
            thickness={params.thickness}
            bezel={params.bezel}
            ior={params.ior}
            scaleRatio={params.scaleRatio}
            blur={params.blur}
            specularOpacity={params.specularOpacity}
            specularSaturation={params.specularSaturation}
            shadowColor={params.shadowColor}
            shadowOpacity={params.shadowOpacity / 100}
            shadowBlur={params.shadowBlur}
            shadowSpread={params.shadowSpread}
            tintColor={params.tintColor}
            tintOpacity={params.tintOpacity / 100}
            outerShadowBlur={params.outerShadowBlur}
          />
        )}

        {/* Invisible hit area for dragging, above whichever engine rendered. */}
        <div
          className="dragger"
          style={{
            left: position.x,
            top: position.y,
            width: params.width,
            height: params.height,
            borderRadius: params.borderRadius,
          }}
          {...dragProps}
        />
      </div>

      <button
        className={`panel-toggle ${panelOpen ? 'panel-toggle--hidden' : ''}`}
        type="button"
        onClick={() => setPanelOpen(true)}
        aria-label="Open controls"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      </button>

      <ControlPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        groups={CONTROL_GROUPS[engine]}
        params={params}
        onParamChange={handleParamChange}
        background={background}
        onBackgroundChange={handleBackgroundChange}
        defaultBackground={DEFAULT_BACKGROUND}
      />

      <div className="bottom-bar">
        <span className="bottom-bar__note">
          {isWebGL
            ? 'WebGL — works in every modern browser'
            : 'SVG backdrop-filter is Chromium only'}
        </span>

        <button
          className="btn btn--accent"
          type="button"
          onClick={() => {
            setExportEngine(engine);
            setCodeOpen(true);
          }}
        >
          Copy code
        </button>

        <button className="btn btn--accent" type="button" onClick={() => setEngine(isWebGL ? 'svg' : 'webgl')}>
          {isWebGL ? '← Switch to SVG' : 'Switch to WebGL →'}
        </button>
      </div>

      {codeOpen && (
        <CodePanel
          engine={exportEngine}
          onEngineChange={setExportEngine}
          params={exportParams}
          position={{
            x: position.x + params.width / 2,
            y: position.y + params.height / 2,
          }}
          onClose={() => setCodeOpen(false)}
        />
      )}
    </>
  );
}
