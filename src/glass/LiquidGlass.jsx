/**
 * LiquidGlass — SVG refraction engine.
 *
 * Renders a physics-based "liquid glass" pane using an SVG
 * `feDisplacementMap` driven by a generated displacement map, composited
 * with a specular highlight layer.
 *
 *   <LiquidGlass width={300} height={200} thickness={80} ior={3}>
 *     Anything inside is rendered above the glass.
 *   </LiquidGlass>
 *
 * Requires React 18+ and a Chromium-based browser (SVG `backdrop-filter`
 * with a fragment reference is not implemented in Firefox/Safari). Use
 * `LiquidGlassWebGL` for full cross-browser support.
 *
 * This file is dependency-free apart from React, so it can be pasted
 * verbatim into any React project with no CSS file to import.
 */

import { useEffect, useId, useRef, useState } from 'react';

/* ------------------------------------------------------------------ *
 * Defaults
 * ------------------------------------------------------------------ */

export const LIQUID_GLASS_DEFAULTS = {
  // Shape
  width: 300,
  height: 200,
  borderRadius: 60,
  surface: 'convex_squircle',

  // Refraction
  thickness: 80,
  bezel: 60,
  ior: 3,
  scaleRatio: 1,

  // Appearance
  blur: 0.3,
  specularOpacity: 0.5,
  specularSaturation: 4,

  // Inner shadow
  shadowColor: '#ffffff',
  shadowOpacity: 0.45,
  shadowBlur: 20,
  shadowSpread: -5,

  // Tint
  tintColor: '#ffffff',
  tintOpacity: 0.06,

  // Outer shadow
  outerShadowBlur: 24,
};

/* ------------------------------------------------------------------ *
 * Surface profiles
 *
 * Each function maps `x` (0 at the outer edge -> 1 at the inner flat
 * plateau) to a height in [0, 1]. This is what gives the pane its
 * lens-like cross-section.
 * ------------------------------------------------------------------ */

export const SURFACE_FNS = {
  convex_squircle: (x) => Math.pow(1 - Math.pow(1 - x, 4), 0.25),
  convex_circle: (x) => Math.sqrt(1 - (1 - x) * (1 - x)),
  concave: (x) => 1 - Math.sqrt(1 - (1 - x) * (1 - x)),
  lip: (x) => {
    const convex = Math.pow(1 - Math.pow(1 - Math.min(x * 2, 1), 4), 0.25);
    const concave = 1 - Math.sqrt(1 - (1 - x) * (1 - x)) + 0.1;
    const t = 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
    return convex * (1 - t) + concave * t;
  },
};

/* ------------------------------------------------------------------ *
 * Optics
 * ------------------------------------------------------------------ */

/**
 * Trace how the surface normal bends light across the bezel, producing a
 * displacement profile sampled from the outer edge inward.
 */
export function calculateRefractionProfile(
  glassThickness,
  bezelWidth,
  heightFn,
  ior,
  samples = 128,
) {
  const eta = 1 / ior;

  function refract(nx, ny) {
    const dot = ny;
    const k = 1 - eta * eta * (1 - dot * dot);
    if (k < 0) return null;
    const sq = Math.sqrt(k);
    return [-(eta * dot + sq) * nx, eta - (eta * dot + sq) * ny];
  }

  const profile = new Float64Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    const y = heightFn(x);
    const dx = x < 1 ? 0.0001 : -0.0001;
    const y2 = heightFn(x + dx);
    const deriv = (y2 - y) / dx;
    const mag = Math.sqrt(deriv * deriv + 1);
    const ref = refract(-deriv / mag, -1 / mag);
    if (!ref) {
      profile[i] = 0;
      continue;
    }
    profile[i] = (ref[0] * (y * bezelWidth + glassThickness)) / ref[1];
  }
  return profile;
}

/** `#rrggbb` -> `[r, g, b]`. */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  if (Number.isNaN(n)) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ------------------------------------------------------------------ *
 * Displacement + specular map generation
 *
 * Both functions rasterise a greyscale canvas that encodes, per pixel,
 * how far to push the backdrop (displacement) and how bright the
 * reflected highlight should be (specular).
 * ------------------------------------------------------------------ */

export function generateDisplacementMap(w, h, radius, bezelWidth, profile, maxDisp) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;

  // Neutral = no displacement. Red/green channels carry the offset that
  // `feDisplacementMap` reads via xChannelSelector="R" yChannelSelector="G".
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 128;
    d[i + 1] = 128;
    d[i + 2] = 0;
    d[i + 3] = 255;
  }

  const r = radius;
  const rSq = r * r;
  const r1Sq = (r + 1) ** 2;
  const rBSq = Math.max(r - bezelWidth, 0) ** 2;
  const wB = w - r * 2;
  const hB = h - r * 2;
  const S = profile.length;

  for (let y1 = 0; y1 < h; y1++) {
    for (let x1 = 0; x1 < w; x1++) {
      // Distance from the nearest corner centre (0 on the straight edges).
      const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0;
      const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0;
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;

      const dist = Math.sqrt(dSq);
      const fromSide = r - dist;
      // Feather the outermost pixel ring so the edge doesn't alias.
      const op =
        dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0 || dist === 0) continue;

      const cos = x / dist;
      const sin = y / dist;
      const bi = Math.min(((fromSide / bezelWidth) * S) | 0, S - 1);
      const disp = profile[bi] || 0;
      const dX = (-cos * disp) / maxDisp;
      const dY = (-sin * disp) / maxDisp;

      const idx = (y1 * w + x1) * 4;
      d[idx] = (128 + dX * 127 * op + 0.5) | 0;
      d[idx + 1] = (128 + dY * 127 * op + 0.5) | 0;
    }
  }

  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

export function generateSpecularMap(w, h, radius, bezelWidth, angle = Math.PI / 3) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  d.fill(0);

  const r = radius;
  const rSq = r * r;
  const r1Sq = (r + 1) ** 2;
  const rBSq = Math.max(r - bezelWidth, 0) ** 2;
  const wB = w - r * 2;
  const hB = h - r * 2;
  const sv = [Math.cos(angle), Math.sin(angle)];

  for (let y1 = 0; y1 < h; y1++) {
    for (let x1 = 0; x1 < w; x1++) {
      const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0;
      const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0;
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;

      const dist = Math.sqrt(dSq);
      const fromSide = r - dist;
      const op =
        dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0 || dist === 0) continue;

      const cos = x / dist;
      const sin = -y / dist;
      // How much this edge faces the light, and how close to the edge we are.
      const dot = Math.abs(cos * sv[0] + sin * sv[1]);
      const edge = Math.sqrt(Math.max(0, 1 - (1 - fromSide) ** 2));
      const coeff = dot * edge;
      const col = (255 * coeff) | 0;

      const idx = (y1 * w + x1) * 4;
      d[idx] = col;
      d[idx + 1] = col;
      d[idx + 2] = col;
      d[idx + 3] = (col * coeff * op) | 0;
    }
  }

  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

/* ------------------------------------------------------------------ *
 * Filter hook
 * ------------------------------------------------------------------ */

/**
 * Builds the displacement/specular maps for the current parameters and
 * element size, and returns the values needed by the SVG `<filter>`.
 *
 * Rasterising two canvases is expensive, so work is debounced and torn
 * down if parameters change again mid-flight.
 */
function useGlassFilter(params, width, height) {
  const [defs, setDefs] = useState(null);

  const {
    borderRadius,
    surface,
    thickness,
    bezel,
    ior,
    scaleRatio,
    blur,
    specularOpacity,
    specularSaturation,
  } = params;

  const w = Math.round(width);
  const h = Math.round(height);

  useEffect(() => {
    if (w < 2 || h < 2) {
      setDefs(null);
      return undefined;
    }

    const timer = setTimeout(() => {
      const heightFn = SURFACE_FNS[surface] || SURFACE_FNS.convex_squircle;

      // A radius or bezel wider than half the pane produces degenerate
      // corner geometry, so clamp both to what the pane can actually show.
      const minHalf = Math.min(w, h) / 2;
      const radius = Math.min(borderRadius, minHalf);
      const clampedBezel = Math.max(Math.min(bezel, radius - 1, minHalf - 1), 1);

      const profile = calculateRefractionProfile(thickness, clampedBezel, heightFn, ior, 128);

      let maxDisp = 0;
      for (let i = 0; i < profile.length; i++) {
        const a = Math.abs(profile[i]);
        if (a > maxDisp) maxDisp = a;
      }
      maxDisp = maxDisp || 1;

      setDefs({
        dispUrl: generateDisplacementMap(w, h, radius, clampedBezel, profile, maxDisp),
        specUrl: generateSpecularMap(w, h, radius, clampedBezel * 2.5),
        blur,
        scale: maxDisp * scaleRatio,
        specSat: specularSaturation,
        specOpacity: specularOpacity,
      });
    }, 30);

    return () => clearTimeout(timer);
  }, [
    w,
    h,
    borderRadius,
    surface,
    thickness,
    bezel,
    ior,
    scaleRatio,
    blur,
    specularOpacity,
    specularSaturation,
  ]);

  return defs;
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export default function LiquidGlass({
  width = LIQUID_GLASS_DEFAULTS.width,
  height = LIQUID_GLASS_DEFAULTS.height,
  borderRadius = LIQUID_GLASS_DEFAULTS.borderRadius,
  surface = LIQUID_GLASS_DEFAULTS.surface,
  thickness = LIQUID_GLASS_DEFAULTS.thickness,
  bezel = LIQUID_GLASS_DEFAULTS.bezel,
  ior = LIQUID_GLASS_DEFAULTS.ior,
  scaleRatio = LIQUID_GLASS_DEFAULTS.scaleRatio,
  blur = LIQUID_GLASS_DEFAULTS.blur,
  specularOpacity = LIQUID_GLASS_DEFAULTS.specularOpacity,
  specularSaturation = LIQUID_GLASS_DEFAULTS.specularSaturation,
  shadowColor = LIQUID_GLASS_DEFAULTS.shadowColor,
  shadowOpacity = LIQUID_GLASS_DEFAULTS.shadowOpacity,
  shadowBlur = LIQUID_GLASS_DEFAULTS.shadowBlur,
  shadowSpread = LIQUID_GLASS_DEFAULTS.shadowSpread,
  tintColor = LIQUID_GLASS_DEFAULTS.tintColor,
  tintOpacity = LIQUID_GLASS_DEFAULTS.tintOpacity,
  outerShadowBlur = LIQUID_GLASS_DEFAULTS.outerShadowBlur,
  style,
  className,
  children,
}) {
  const rootRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // `useId` keeps filter ids unique across instances; the sanitising pass
  // strips the `:` characters React uses, which are illegal in a URL
  // fragment and would break `url(#id)`.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const filterId = `liquid-glass-${uid}`;

  // Measure the rendered pane. Prop width/height are enough for the common
  // case, but this also covers percentage sizing and container queries.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;

    const measure = () => {
      setSize((prev) =>
        prev.width === el.offsetWidth && prev.height === el.offsetHeight
          ? prev
          : { width: el.offsetWidth, height: el.offsetHeight },
      );
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const defs = useGlassFilter(
    { borderRadius, surface, thickness, bezel, ior, scaleRatio, blur, specularOpacity, specularSaturation },
    size.width,
    size.height,
  );

  return (
    <>
      {/* The filter graph itself. Kept in-document but visually inert. */}
      <svg
        aria-hidden="true"
        focusable="false"
        colorInterpolationFilters="sRGB"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
      >
        {defs && (
          <defs>
            <filter id={filterId} x="0%" y="0%" width="100%" height="100%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={defs.blur} result="blurred_source" />
              <feImage href={defs.dispUrl} x="0" y="0" width={size.width} height={size.height} result="disp_map" />
              <feDisplacementMap
                in="blurred_source"
                in2="disp_map"
                scale={defs.scale}
                xChannelSelector="R"
                yChannelSelector="G"
                result="displaced"
              />
              <feColorMatrix in="displaced" type="saturate" values={defs.specSat} result="displaced_sat" />
              <feImage href={defs.specUrl} x="0" y="0" width={size.width} height={size.height} result="spec_layer" />
              <feComposite in="displaced_sat" in2="spec_layer" operator="in" result="spec_masked" />
              <feComponentTransfer in="spec_layer" result="spec_faded">
                <feFuncA type="linear" slope={defs.specOpacity} />
              </feComponentTransfer>
              <feBlend in="spec_masked" in2="displaced" mode="normal" result="with_sat" />
              <feBlend in="spec_faded" in2="with_sat" mode="normal" />
            </filter>
          </defs>
        )}
      </svg>

      <div
        ref={rootRef}
        className={className}
        style={{
          position: 'relative',
          width,
          height,
          borderRadius,
          // Creates a stacking context so the `zIndex: -1` backdrop layer
          // stays inside the pane instead of falling behind the page.
          isolation: 'isolate',
          boxShadow: `0px 4px ${outerShadowBlur}px rgba(0, 0, 0, 0.18)`,
          ...style,
        }}
      >
        {/* Refraction layer: sits behind the pane's own content. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            zIndex: -1,
            isolation: 'isolate',
            pointerEvents: 'none',
            backdropFilter: defs ? `url(#${filterId})` : undefined,
            WebkitBackdropFilter: defs ? `url(#${filterId})` : undefined,
          }}
        />

        {/* Inner shadow + tint, above the refraction but below children. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            zIndex: 1,
            pointerEvents: 'none',
            boxShadow: `inset 0 0 ${shadowBlur}px ${shadowSpread}px ${rgba(shadowColor, shadowOpacity)}`,
            backgroundColor: rgba(tintColor, tintOpacity),
          }}
        />

        {children}
      </div>
    </>
  );
}
