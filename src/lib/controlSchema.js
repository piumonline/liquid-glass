/**
 * One shared parameter object drives both engines, so switching engines
 * keeps the look you tuned. Fields a given engine ignores (WebGL has no
 * saturation or inner-shadow blur) are simply absent from that engine's
 * control groups.
 */

export const DEFAULT_PARAMS = {
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

  // Inner shadow (opacity and tint are stored as 0-100 percentages)
  shadowColor: '#ffffff',
  shadowOpacity: 45,
  shadowBlur: 20,
  shadowSpread: -5,

  // Tint
  tintColor: '#ffffff',
  tintOpacity: 6,

  // Outer shadow
  outerShadowBlur: 24,

  // Backdrop
  background: '',
};

const fmt = {
  int: (v) => String(Math.round(v)),
  one: (v) => Number(v).toFixed(1),
  two: (v) => Number(v).toFixed(2),
  pct: (v) => `${Math.round(v)}%`,
  identity: (v) => v,
};

export const CONTROL_GROUPS = {
  svg: [
    {
      title: 'Glass Shape',
      fields: [
        { key: 'width', label: 'Width', min: 200, max: 700, step: 1, format: fmt.int },
        { key: 'height', label: 'Height', min: 200, max: 800, step: 1, format: fmt.int },
        { key: 'borderRadius', label: 'Border Radius', min: 20, max: 100, step: 1, format: fmt.int },
        {
          key: 'surface',
          label: 'Surface',
          type: 'select',
          options: [
            ['convex_squircle', 'Convex Squircle'],
            ['lip', 'Lip'],
          ],
          format: fmt.identity,
        },
      ],
    },
    {
      title: 'Refraction',
      fields: [
        { key: 'thickness', label: 'Glass Thickness', min: 10, max: 200, step: 1, format: fmt.int },
        { key: 'bezel', label: 'Bezel Width', min: 2, max: 60, step: 1, format: fmt.int },
        { key: 'ior', label: 'Refractive Index', min: 1, max: 3, step: 0.05, format: fmt.two },
        { key: 'scaleRatio', label: 'Scale Ratio', min: 0, max: 2, step: 0.05, format: fmt.two },
      ],
    },
    {
      title: 'Appearance',
      fields: [
        { key: 'blur', label: 'Blur', min: 0, max: 12, step: 0.1, format: fmt.one },
        { key: 'specularOpacity', label: 'Specular Opacity', min: 0, max: 1, step: 0.05, format: fmt.two },
        { key: 'specularSaturation', label: 'Specular Saturation', min: 0, max: 12, step: 1, format: fmt.int },
      ],
    },
    {
      title: 'Inner Shadow',
      fields: [
        { key: 'shadowColor', label: 'Color', type: 'color' },
        { key: 'shadowOpacity', label: 'Opacity', min: 0, max: 100, step: 1, format: fmt.pct },
        { key: 'shadowBlur', label: 'Blur', min: 0, max: 40, step: 1, format: fmt.int },
        { key: 'shadowSpread', label: 'Spread', min: -15, max: 10, step: 1, format: fmt.int },
      ],
    },
    {
      title: 'Glass Tint',
      fields: [
        { key: 'tintColor', label: 'Tint Color', type: 'color' },
        { key: 'tintOpacity', label: 'Tint Opacity', min: 0, max: 40, step: 1, format: fmt.pct },
      ],
    },
    {
      title: 'Outer Shadow',
      fields: [
        { key: 'outerShadowBlur', label: 'Blur', min: 0, max: 50, step: 1, format: fmt.int },
      ],
    },
  ],

  webgl: [
    {
      title: 'Glass',
      fields: [
        { key: 'width', label: 'Width', min: 200, max: 700, step: 1, format: fmt.int },
        { key: 'height', label: 'Height', min: 200, max: 800, step: 1, format: fmt.int },
        { key: 'borderRadius', label: 'Radius', min: 4, max: 100, step: 1, format: fmt.int },
      ],
    },
    {
      title: 'Refraction',
      fields: [
        { key: 'thickness', label: 'Thickness', min: 10, max: 200, step: 1, format: fmt.int },
        { key: 'bezel', label: 'Bezel', min: 2, max: 60, step: 1, format: fmt.int },
        { key: 'ior', label: 'Refractive Index', min: 1, max: 3, step: 0.05, format: fmt.two },
      ],
    },
    {
      title: 'Look',
      fields: [
        // The WebGL shader works in a finer blur range than the SVG filter,
        // so this slider is scaled on the way in and out.
        { key: 'blur', label: 'Blur', min: 0, max: 12, step: 0.1, format: fmt.one },
        { key: 'specularOpacity', label: 'Specular', min: 0, max: 1, step: 0.05, format: fmt.two },
        { key: 'tintOpacity', label: 'Tint', min: 0, max: 40, step: 1, format: fmt.pct },
        // The shader has no separate outer-shadow blur, so the inner-shadow
        // opacity knob doubles as overall shadow strength here.
        { key: 'shadowOpacity', label: 'Shadow', min: 0, max: 100, step: 1, format: fmt.pct },
      ],
    },
  ],
};
