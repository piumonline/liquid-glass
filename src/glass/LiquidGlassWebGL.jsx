/**
 * LiquidGlassWebGL — Three.js refraction engine.
 *
 * The same liquid-glass maths as `LiquidGlass`, but evaluated per-pixel in
 * a fragment shader, so it works in every modern browser (Firefox and
 * Safari included).
 *
 * Because WebGL cannot read the DOM behind the canvas, this component owns
 * its own backdrop: pass an image URL via `background` and it renders
 * `<image> + <refracted glass>` inside its own box.
 *
 *   <LiquidGlassWebGL
 *     background="/photo.jpg"
 *     style={{ position: 'fixed', inset: 0 }}
 *     thickness={50}
 *     ior={3}
 *     position={{ x: 400, y: 300 }}
 *   />
 *
 * `position` is the glass centre in pixels, relative to this component's
 * box. Omit it to centre the glass automatically.
 *
 * Requires React 18+ and `three`.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export const LIQUID_GLASS_WEBGL_DEFAULTS = {
  background: '',
  width: 300,
  height: 200,
  borderRadius: 60,
  thickness: 50,
  bezel: 60,
  ior: 3,
  blur: 1.5,
  specular: 0.55,
  tintOpacity: 0.08,
  shadowOpacity: 0.5,
};

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}`;

const fragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform vec2 uResolution;
uniform vec2 uGlassCenter;
uniform vec2 uGlassSize;
uniform float uRadius;
uniform float uBezel;
uniform float uThickness;
uniform float uIOR;
uniform float uBlur;
uniform float uSpecular;
uniform float uTint;
uniform float uShadow;
uniform sampler2D uBgTex;
uniform float uBgAspect;

// Signed distance to a rounded box centred on the origin.
float sdRoundedRect(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Height of the glass surface, 0 at the outer edge -> 1 on the plateau.
float surfaceHeight(float t) {
  float s = 1.0 - t;
  return pow(1.0 - s*s*s*s, 0.25);
}

// Sample the backdrop, reproducing CSS \`background: center/cover\` so the
// shader and the CSS fallback line up.
vec3 sampleBg(vec2 screenUV) {
  float screenAspect = uResolution.x / uResolution.y;
  vec2 uv = screenUV;
  if (uBgAspect > screenAspect) {
    float s = screenAspect / uBgAspect;
    uv.x = uv.x * s + (1.0 - s) * 0.5;
  } else {
    float s = uBgAspect / screenAspect;
    uv.y = uv.y * s + (1.0 - s) * 0.5;
  }
  uv.y = 1.0 - uv.y;
  return texture2D(uBgTex, uv).rgb;
}

// Cheap 16-tap blur (vogel disc) for the frosted interior.
vec3 sampleBgBlurred(vec2 uv, float radius) {
  if (radius < 0.5) return sampleBg(uv);
  vec3 sum = vec3(0.0);
  vec2 px = 1.0 / uResolution;
  vec2 offsets[16];
  offsets[0]  = vec2(-0.94201, -0.39906);
  offsets[1]  = vec2( 0.94558, -0.76890);
  offsets[2]  = vec2(-0.09418, -0.92938);
  offsets[3]  = vec2( 0.34495,  0.29387);
  offsets[4]  = vec2(-0.91588, -0.45771);
  offsets[5]  = vec2(-0.81544,  0.48568);
  offsets[6]  = vec2(-0.38277, -0.56071);
  offsets[7]  = vec2(-0.12675,  0.84686);
  offsets[8]  = vec2( 0.89642,  0.41254);
  offsets[9]  = vec2( 0.18150, -0.30020);
  offsets[10] = vec2(-0.01445, -0.16001);
  offsets[11] = vec2( 0.59614,  0.71118);
  offsets[12] = vec2( 0.49742, -0.47280);
  offsets[13] = vec2( 0.80685,  0.04588);
  offsets[14] = vec2(-0.32490, -0.03965);
  offsets[15] = vec2(-0.60975,  0.06566);
  for (int i = 0; i < 16; i++) {
    sum += sampleBg(uv + offsets[i] * radius * px);
  }
  return sum / 16.0;
}

void main() {
  vec2 screenPx = vec2(vUv.x, 1.0 - vUv.y) * uResolution;
  vec2 p = screenPx - uGlassCenter;
  vec2 halfSize = uGlassSize * 0.5;

  float sd = sdRoundedRect(p, halfSize, uRadius);

  // Outside the pane: only the drop shadow.
  if (sd > 0.0) {
    float shadowFalloff = exp(-sd * sd / 800.0);
    gl_FragColor = vec4(0.0, 0.0, 0.0, uShadow * shadowFalloff * 0.6);
    return;
  }

  float distFromEdge = -sd;
  float bezel = max(min(uBezel, min(uRadius, min(halfSize.x, halfSize.y)) - 1.0), 1.0);
  float t = clamp(distFromEdge / bezel, 0.0, 1.0);

  // Refraction via Snell's law applied to the surface slope.
  float h = surfaceHeight(t);
  float dt = 0.001;
  float h2 = surfaceHeight(min(t + dt, 1.0));
  float dh = (h2 - h) / dt;

  float slopeAngle = atan(dh * (uThickness / bezel));
  float sinR = clamp(sin(slopeAngle) / uIOR, -1.0, 1.0);
  float thetaR = asin(sinR);
  float displacement = h * uThickness * (tan(slopeAngle) - tan(thetaR));

  // Outward normal from the SDF gradient.
  float eps = 0.5;
  vec2 grad = vec2(
    sdRoundedRect(p + vec2(eps, 0.0), halfSize, uRadius) - sd,
    sdRoundedRect(p + vec2(0.0, eps), halfSize, uRadius) - sd
  );
  grad = normalize(grad);

  vec2 screenUV = screenPx / uResolution;
  vec2 refractedUV = screenUV - grad * displacement / uResolution;
  vec3 color = sampleBgBlurred(refractedUV, uBlur);

  // Specular rim highlight.
  vec2 lightDir = normalize(vec2(0.5, -0.7));
  float rimDot = abs(dot(grad, lightDir));
  float rimFalloff = 1.0 - smoothstep(0.0, bezel * 0.4, distFromEdge);
  float specHighlight = pow(rimDot * rimFalloff, 1.5);
  color += vec3(specHighlight * uSpecular);

  // Inner shadow + inner rim.
  float innerShadow = 1.0 - smoothstep(0.0, bezel * 0.6, distFromEdge);
  color *= mix(1.0, 0.7, innerShadow * 0.3);

  float innerRim = smoothstep(0.0, 2.0, distFromEdge) * (1.0 - smoothstep(2.0, 5.0, distFromEdge));
  color += vec3(innerRim * 0.15 * uSpecular);

  color = mix(color, vec3(1.0), uTint);

  float alpha = smoothstep(0.0, 1.5, distFromEdge);
  gl_FragColor = vec4(color, alpha);
}`;

export default function LiquidGlassWebGL({
  background = LIQUID_GLASS_WEBGL_DEFAULTS.background,
  width = LIQUID_GLASS_WEBGL_DEFAULTS.width,
  height = LIQUID_GLASS_WEBGL_DEFAULTS.height,
  borderRadius = LIQUID_GLASS_WEBGL_DEFAULTS.borderRadius,
  thickness = LIQUID_GLASS_WEBGL_DEFAULTS.thickness,
  bezel = LIQUID_GLASS_WEBGL_DEFAULTS.bezel,
  ior = LIQUID_GLASS_WEBGL_DEFAULTS.ior,
  blur = LIQUID_GLASS_WEBGL_DEFAULTS.blur,
  specular = LIQUID_GLASS_WEBGL_DEFAULTS.specular,
  tintOpacity = LIQUID_GLASS_WEBGL_DEFAULTS.tintOpacity,
  shadowOpacity = LIQUID_GLASS_WEBGL_DEFAULTS.shadowOpacity,
  position,
  style,
  className,
}) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [unsupported, setUnsupported] = useState(false);

  /* --- create the renderer once --- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    } catch {
      setUnsupported(true);
      return undefined;
    }
    if (!renderer.getContext()) {
      setUnsupported(true);
      return undefined;
    }

    // Cap DPR: beyond 2x the shader cost triples for no visible gain.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uGlassCenter: { value: new THREE.Vector2(0, 0) },
        uGlassSize: { value: new THREE.Vector2(width, height) },
        uRadius: { value: borderRadius },
        uBezel: { value: bezel },
        uThickness: { value: thickness },
        uIOR: { value: ior },
        uBlur: { value: blur },
        uSpecular: { value: specular },
        uTint: { value: tintOpacity },
        uShadow: { value: shadowOpacity },
        uBgTex: { value: null },
        uBgAspect: { value: 1.5 },
      },
      transparent: true,
      depthTest: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    scene.add(new THREE.Mesh(geometry, material));

    engineRef.current = { renderer, material };

    let frame = 0;
    const tick = () => {
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      scene.remove(scene.children[0]);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      engineRef.current = null;
    };
    // Intentionally mount-only: parameter changes are pushed through the
    // effect below so the GL context is never rebuilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- keep the drawing buffer in step with the element --- */
  useEffect(() => {
    const root = rootRef.current;
    const engine = engineRef.current;
    if (!root || !engine) return undefined;

    const resize = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (w < 1 || h < 1) return;
      engine.renderer.setSize(w, h, false);
      engine.material.uniforms.uResolution.value.set(w, h);
    };

    resize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  /* --- push parameters into the shader uniforms --- */
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const u = engine.material.uniforms;
    const { x: resW, y: resH } = u.uResolution.value;
    const half = Math.min(width, height) / 2;

    u.uGlassSize.value.set(width, height);
    u.uGlassCenter.value.set(
      position ? position.x : resW / 2,
      position ? position.y : resH / 2,
    );
    u.uRadius.value = Math.min(borderRadius, half);
    u.uBezel.value = bezel;
    u.uThickness.value = thickness;
    u.uIOR.value = ior;
    u.uBlur.value = blur;
    u.uSpecular.value = specular;
    u.uTint.value = tintOpacity;
    u.uShadow.value = shadowOpacity;
  }, [width, height, borderRadius, thickness, bezel, ior, blur, specular, tintOpacity, shadowOpacity, position]);

  /* --- load the backdrop texture --- */
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return undefined;

    if (!background) {
      engine.material.uniforms.uBgTex.value = null;
      return undefined;
    }

    let disposed = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      background,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        engine.material.uniforms.uBgTex.value = texture;
        engine.material.uniforms.uBgAspect.value =
          texture.image.width / texture.image.height;
      },
      undefined,
      () => {
        /* Keep the CSS backdrop if the texture fails to load. */
      },
    );

    return () => {
      disposed = true;
    };
  }, [background]);

  if (unsupported) return null;

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      {/* CSS fallback for the backdrop: also what shows if the texture
          fails to load, and keeps the effect legible without WebGL. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: background ? `url("${background}") center/cover no-repeat` : 'transparent',
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
    </div>
  );
}
