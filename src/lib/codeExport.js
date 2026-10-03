/**
 * Generates the copy-paste source for a liquid-glass component.
 *
 * The component files are pulled in with Vite's `?raw` suffix, so the text
 * handed to the user is byte-for-byte the source the demo is running. That
 * makes it impossible for the exported snippet to drift away from what the
 * preview actually renders.
 */

import liquidGlassSource from '../glass/LiquidGlass.jsx?raw';
import liquidGlassWebGLSource from '../glass/LiquidGlassWebGL.jsx?raw';

/** Engines, in the order they appear as tabs in the export panel. */
export const ENGINES = {
  svg: {
    id: 'svg',
    label: 'SVG',
    source: liquidGlassSource,
    component: 'LiquidGlass',
    requires: null,
    supports: 'Chromium browsers only (SVG `backdrop-filter` with a fragment reference).',
  },
  webgl: {
    id: 'webgl',
    label: 'WebGL',
    source: liquidGlassWebGLSource,
    component: 'LiquidGlassWebGL',
    requires: 'npm install three',
    supports: 'All modern browsers.',
  },
};

/** Trim float noise (`0.30000000000000004` -> `0.3`). */
function num(value) {
  return String(Number(Number(value).toFixed(4)));
}

/**
 * Render a prop value as the right-hand side of a JSX attribute.
 *
 * Numbers go in braces (`width={300}`); strings stay bare
 * (`surface="convex_squircle"`) because that is the idiomatic JSX form.
 */
function n(value) {
  return `{${num(value)}}`;
}
function s(value) {
  return JSON.stringify(String(value));
}

/** Build `name=value` lines from pre-rendered literals. */
function propsBlock(entries) {
  return entries
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([name, v]) => `  ${name}=${v}`)
    .join('\n');
}

/** Which demo parameters map onto which component props, per engine. */
function svgProps(p) {
  return [
    ['width', n(p.width)],
    ['height', n(p.height)],
    ['borderRadius', n(p.borderRadius)],
    ['surface', s(p.surface)],
    ['thickness', n(p.thickness)],
    ['bezel', n(p.bezel)],
    ['ior', n(p.ior)],
    ['scaleRatio', n(p.scaleRatio)],
    ['blur', n(p.blur)],
    ['specularOpacity', n(p.specularOpacity)],
    ['specularSaturation', n(p.specularSaturation)],
    ['shadowColor', s(p.shadowColor)],
    // Stored 0-100 like the panel, consumed as a 0-1 alpha multiplier.
    ['shadowOpacity', n(p.shadowOpacity / 100)],
    ['shadowBlur', n(p.shadowBlur)],
    ['shadowSpread', n(p.shadowSpread)],
    ['tintColor', s(p.tintColor)],
    ['tintOpacity', n(p.tintOpacity / 100)],
    ['outerShadowBlur', n(p.outerShadowBlur)],
  ];
}

function webglProps(p, position) {
  const entries = [
    ['background', p.background ? s(p.background) : null],
    ['width', n(p.width)],
    ['height', n(p.height)],
    ['borderRadius', n(p.borderRadius)],
    ['thickness', n(p.thickness)],
    ['bezel', n(p.bezel)],
    ['ior', n(p.ior)],
    // The WebGL engine's blur range is finer-grained than the SVG one, so
    // scale the shared 0-8 slider onto its 0-12 range.
    ['blur', n(p.blur * 1.5)],
    ['specular', n(p.specularOpacity)],
    ['tintOpacity', n(p.tintOpacity / 100)],
    // Stored 0-100 like the SVG panel, consumed as a 0-1 alpha multiplier.
    ['shadowOpacity', n(p.shadowOpacity / 100)],
  ];

  if (position) {
    entries.push(['position', `{ x: ${num(position.x)}, y: ${num(position.y)} }`]);
  }

  return entries;
}

/**
 * Build the full snippet for an engine.
 *
 * @param {'svg'|'webgl'} engineId
 * @param {object} params   current demo parameters
 * @param {object} [opts]
 * @param {{x:number,y:number}} [opts.position] glass centre, for the WebGL engine
 */
export function buildExport(engineId, params, opts = {}) {
  const engine = ENGINES[engineId];
  if (!engine) throw new Error(`Unknown engine: ${engineId}`);

  const isWebGL = engineId === 'webgl';
  const Component = engine.component;
  const entries = isWebGL ? webglProps(params, opts.position) : svgProps(params);
  const props = propsBlock(entries);

  // The SVG component accepts children; the WebGL one draws itself and is
  // self-closing.
  const usage = isWebGL
    ? `<${Component}\n${props}\n/>`
    : `<${Component}\n${props}\n>\n  {/* children render above the glass */}\n</${Component}>`;

  const setup = [
    engine.requires
      ? `Install the peer dependency:  ${engine.requires}`
      : 'No extra dependencies — React 18+ is all you need.',
    `Save this as \`${Component}.jsx\` and import it wherever you need it.`,
    isWebGL
      ? 'WebGL cannot read the DOM behind it, so `background` supplies the image the glass refracts. Point it at your own.'
      : 'Anything you nest inside the component renders on top of the glass.',
    `Browser support: ${engine.supports}`,
  ];

  // The whole preamble has to sit inside a comment, otherwise the prose
  // lands in the pasted file as bare JavaScript and it will not parse.
  const preamble = [
    '/* ============================================================',
    ` * Liquid Glass — ${engine.label} engine`,
    ' *',
    ' * Copied out of the Liquid Glass playground, with your current',
    ' * settings applied as props in the usage snippet at the bottom.',
    ' *',
    ...setup.map((line) => ` * ${line}`),
    ' * ============================================================ */',
  ].join('\n');

  return [
    preamble,
    '',
    '/* ---------- Component ---------- */',
    '',
    engine.source.trimEnd(),
    '',
    '/* ---------- Usage ---------- */',
    '',
    usage,
    '',
  ].join('\n');
}
