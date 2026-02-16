"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function HeroShader({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });

    const size = () => ({ w: el.clientWidth || 1, h: el.clientHeight || 1 });
    const { w, h } = size();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(w, h) },
      },
      vertexShader: `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float iTime;
        uniform vec2 iResolution;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 uv = gl_FragCoord.xy / iResolution.xy;
          vec2 p = (uv - 0.5) * vec2(iResolution.x / iResolution.y, 1.0) * 2.2;

          float t = iTime * 0.22;
          float n1 = fbm(p + vec2(t, 0.0));
          float n2 = fbm(p * 1.6 - vec2(0.0, t * 0.8));
          float n = mix(n1, n2, 0.5);

          vec3 c1 = vec3(0.70, 0.80, 0.98);
          vec3 c2 = vec3(0.57, 0.76, 0.96);
          vec3 c3 = vec3(0.78, 0.88, 0.98);

          vec3 color = mix(c1, c2, smoothstep(0.2, 0.9, n));
          color = mix(color, c3, 0.35 * sin((uv.x + uv.y + t) * 3.2));

          float vignette = smoothstep(1.25, 0.25, length(uv - 0.5));
          color *= 0.9 + 0.1 * vignette;

          gl_FragColor = vec4(color, 0.82);
        }
      `,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let raf = 0;
    let paused = false;

    const loop = () => {
      if (!paused) material.uniforms.iTime.value += 0.016;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    const onResize = () => {
      const next = size();
      renderer.setSize(next.w, next.h);
      material.uniforms.iResolution.value.set(next.w, next.h);
    };

    const onVisibility = () => {
      paused = document.hidden;
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={ref} className={`absolute inset-0 ${className}`} />;
}
