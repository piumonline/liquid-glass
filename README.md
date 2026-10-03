# Liquid Glass

An interactive playground for an **iOS 26–style Liquid Glass** effect, built with
React. Tune every parameter live, then hit **Copy code** and paste the component
straight into your own project.

## Getting started

```bash
npm install
npm run dev      # http://127.0.0.1:5173
```

```bash
npm run build    # -> dist/
npm run preview  # serve the production build
```

## Copy the code out

This is the point of the project. Set the controls to what you want, press
**Copy code**, and you get a complete `.jsx` file plus a usage snippet with your
current settings applied as props:

```jsx
<LiquidGlass
  width={300}
  height={200}
  borderRadius={60}
  thickness={80}
  bezel={60}
  ior={3}
  blur={0.3}
  shadowColor="#ffffff"
  shadowOpacity={0.45}
  tintOpacity={0.06}
/>
```

Things worth knowing about the export:

- **No CSS file.** Both components style themselves with inline styles, so there
  is nothing else to copy or import.
- **No drift.** The snippet is generated from the component's own source via
  Vite's `?raw` imports, so the code you copy is literally the code running in
  the preview.
- **Self-contained.** The SVG engine needs nothing but React. The WebGL engine
  additionally needs `three`.

## Two engines

|                     | `LiquidGlass`                  | `LiquidGlassWebGL`               |
| ------------------- | ------------------------------ | -------------------------------- |
| **Source**          | `src/glass/LiquidGlass.jsx`    | `src/glass/LiquidGlassWebGL.jsx` |
| **Technique**       | SVG `feDisplacementMap` + `backdrop-filter` | Three.js fragment shader |
| **Refraction**      | Physics-based, with IOR        | Snell's law, per pixel           |
| **Browser support** | Chrome / Chromium only         | All modern browsers              |
| **Backdrop**        | Anything behind the element    | An image you supply              |
| **Children**        | Yes, render on top of the glass | No — it draws itself            |
| **Extra dependency**| None                           | `three`                          |

Because WebGL cannot read the DOM behind a canvas, `LiquidGlassWebGL` owns its
own backdrop and takes a `background` image URL. `LiquidGlass` refracts
whatever is genuinely behind it, so it drops into an existing page more
directly.

### Props

`LiquidGlass`

| Prop | Default | Range / notes |
| --- | --- | --- |
| `width`, `height` | `300`, `200` | px |
| `borderRadius` | `60` | px, clamped to half the shorter side |
| `surface` | `convex_squircle` | `convex_squircle` \| `lip` |
| `thickness` | `80` | Glass thickness, px |
| `bezel` | `60` | Width of the refracting rim, px |
| `ior` | `3` | Refractive index, 1–3 |
| `scaleRatio` | `1` | Multiplier on the computed displacement |
| `blur` | `0.3` | `feGaussianBlur` std deviation |
| `specularOpacity` | `0.5` | Highlight strength |
| `specularSaturation` | `4` | Saturation of the refracted area |
| `shadowColor` | `#ffffff` | Inner shadow colour |
| `shadowOpacity` | `0.45` | Inner shadow alpha |
| `shadowBlur` | `20` | Inner shadow blur, px |
| `shadowSpread` | `-5` | Inner shadow spread, px |
| `tintColor` | `#ffffff` | Tint colour |
| `tintOpacity` | `0.06` | Tint alpha |
| `outerShadowBlur` | `24` | Drop shadow blur, px |

`LiquidGlassWebGL` takes `width`, `height`, `borderRadius`, `thickness`,
`bezel`, `ior`, `blur`, `specular`, `tintOpacity`, `shadowOpacity`,
`background` and `position`. See `src/glass/LiquidGlassWebGL.jsx` for the
header comment.

## Project layout

```
src/
  glass/          the two copyable components — the whole payload
    LiquidGlass.jsx
    LiquidGlassWebGL.jsx
  lib/
    codeExport.js generates the copy-paste snippet from the sources above
    controlSchema.js  shared parameter state + per-engine control layout
    backgrounds.js    presets, localStorage, URL validation
  ui/             demo chrome (control panel, picker, export modal)
  hooks/useDrag.js
  styles/app.css  demo chrome only; the glass needs no stylesheet
legacy/           the original HTML/CSS/JS this was ported from
public/           background images and favicon
```

The demo keeps one shared parameter object so switching engines keeps the look
you tuned. A few controls map onto different things per engine, which is why
the control groups differ: the WebGL shader has no saturation or inner-shadow
blur, and its `blur` works in a finer range, so the shared slider is scaled on
the way in and out.

## Inspiration

Inspired by Apple's **iOS 26 Liquid Glass** design language. Thanks to
[chakachuk's CodePen demo](https://codepen.io/chakachuk/pen/QwbaYGO) for the
original glass-distortion filter setup that kicked this off.
