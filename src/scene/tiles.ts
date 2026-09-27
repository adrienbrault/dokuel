import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearMipmapLinearFilter,
  MeshPhysicalMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { ScenePalette } from "./palette.ts";
import { FOG_GLSL, OUTPUT_GLSL } from "./shaders.ts";

const TILE_DEPTH = 0.24;
const ATLAS_CELL = 256;

type TileMotion = {
  digit: number;
  radius: number;
  angle: number;
  speed: number;
  height: number;
  bobAmp: number;
  bobFreq: number;
  phase: number;
  axis: Vector3;
  spin: number;
  scale: number;
  lift: number;
};

/**
 * Nine glyphs on a 3x3 atlas, read as data (no color space). Red holds the crisp numeral and an
 * engraved frame, green a blurred halo, so one texture drives both the
 * core and the bloom-friendly glow.
 */
async function drawAtlas(): Promise<CanvasTexture> {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_CELL * 3;
  canvas.height = ATLAS_CELL * 3;
  const ctx = canvas.getContext("2d");
  const font = `800 ${ATLAS_CELL * 0.66}px "DM Sans Variable", "DM Sans", system-ui, sans-serif`;
  try {
    await document.fonts?.load(font, "123456789");
  } catch {
    // The system fallback is fine; the numerals only need to read.
  }
  if (ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font;
    for (let d = 0; d < 9; d++) {
      const x = (d % 3) * ATLAS_CELL + ATLAS_CELL / 2;
      const y = Math.floor(d / 3) * ATLAS_CELL + ATLAS_CELL / 2;
      ctx.globalCompositeOperation = "lighter";
      // Halo, green channel.
      ctx.shadowColor = "rgb(0,255,0)";
      ctx.shadowBlur = 28;
      ctx.fillStyle = "rgb(0,160,0)";
      ctx.fillText(String(d + 1), x, y + ATLAS_CELL * 0.03);
      ctx.shadowBlur = 0;
      // Core, red channel.
      ctx.fillStyle = "rgb(255,0,0)";
      ctx.fillText(String(d + 1), x, y + ATLAS_CELL * 0.03);
      // Engraved frame.
      ctx.strokeStyle = "rgb(110,0,0)";
      ctx.lineWidth = 5;
      const inset = ATLAS_CELL * 0.08;
      const size = ATLAS_CELL - inset * 2;
      ctx.beginPath();
      ctx.roundRect(
        x - ATLAS_CELL / 2 + inset,
        y - ATLAS_CELL / 2 + inset,
        size,
        size,
        ATLAS_CELL * 0.1,
      );
      ctx.stroke();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Obsidian (or porcelain) tiles bearing digits, orbiting the board in
 * a loose ring. They answer the game: a placed 7 lights every 7 in the
 * air, a finished unit brightens them all, a win lifts them skyward.
 */
export async function createTiles(count: number, palette: ScenePalette) {
  const atlas = await drawAtlas();

  const body = new RoundedBoxGeometry(1, 1, TILE_DEPTH, 3, 0.1);
  const bodyMaterial = new MeshPhysicalMaterial({
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1,
  });
  const bodies = new InstancedMesh(body, bodyMaterial, count);

  const front = new PlaneGeometry(0.86, 0.86);
  front.translate(0, 0, TILE_DEPTH / 2 + 0.004);
  const back = new PlaneGeometry(0.86, 0.86);
  back.rotateY(Math.PI);
  back.translate(0, 0, -TILE_DEPTH / 2 - 0.004);
  const glyphGeometry = mergeGeometries([front, back]);
  front.dispose();
  back.dispose();
  const digits = new Float32Array(count);
  const glows = new Float32Array(count);
  const glowAttribute = new InstancedBufferAttribute(glows, 1);
  glowAttribute.setUsage(DynamicDrawUsage);
  glyphGeometry.setAttribute("aDigit", new InstancedBufferAttribute(digits, 1));
  glyphGeometry.setAttribute("aGlow", glowAttribute);

  const glyphUniforms = {
    uAtlas: { value: atlas },
    uColor: { value: new Color() },
    uHot: { value: new Color() },
    uEnergy: { value: 1 },
    uFogDensity: { value: 0.02 },
    uAdditive: { value: 1 },
  };
  const glyphMaterial = new ShaderMaterial({
    uniforms: glyphUniforms,
    vertexShader: /* glsl */ `
      attribute float aDigit;
      attribute float aGlow;
      varying vec2 vUv;
      varying float vGlow;
      varying float vDepth;
      void main() {
        vec2 cell = vec2(mod(aDigit, 3.0), 2.0 - floor(aDigit / 3.0));
        vUv = (uv + cell) / 3.0;
        vGlow = aGlow;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform vec3 uColor;
      uniform vec3 uHot;
      uniform float uEnergy;
      uniform float uFogDensity;
      uniform float uAdditive;
      varying vec2 vUv;
      varying float vGlow;
      varying float vDepth;
      ${FOG_GLSL}
      void main() {
        vec4 t = texture2D(uAtlas, vUv);
        float core = t.r;
        float halo = t.g;
        float fog = fogFactor(vDepth, uFogDensity);
        if (uAdditive > 0.5) {
          vec3 c = uColor * core * (0.35 + 0.4 * uEnergy)
            + uHot * core * vGlow
            + uColor * halo * (0.12 + 0.2 * uEnergy + vGlow * 1.2);
          c *= 1.0 - fog;
          gl_FragColor = vec4(c, 1.0);
        } else {
          vec3 c = mix(uColor, uHot, clamp(vGlow, 0.0, 1.0));
          float a = clamp(core + halo * vGlow * 0.6, 0.0, 1.0) * (1.0 - fog);
          gl_FragColor = vec4(c * a, a);
        }
        ${OUTPUT_GLSL}
      }
    `,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
  });
  const glyphs = new InstancedMesh(glyphGeometry, glyphMaterial, count);
  glyphs.renderOrder = 1;

  const motions: TileMotion[] = [];
  for (let i = 0; i < count; i++) {
    const digit = i % 9;
    digits[i] = digit;
    motions.push({
      digit,
      radius: 5.5 + Math.random() * 10,
      angle: Math.random() * Math.PI * 2,
      speed: 0.018 + Math.random() * 0.035,
      height: 0.8 + Math.random() * 7.5,
      bobAmp: 0.15 + Math.random() * 0.4,
      bobFreq: 0.25 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      axis: new Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize(),
      spin: (0.08 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1),
      scale: 0.55 + Math.random() * 0.55,
      lift: 1 + Math.random() * 1.6,
    });
  }

  const dummy = new Object3D();
  const spinQuat = new Quaternion();

  function setPalette(p: ScenePalette) {
    bodyMaterial.color.copy(p.tileBody);
    bodyMaterial.metalness = p.tileMetalness;
    bodyMaterial.roughness = p.tileRoughness;
    glyphUniforms.uColor.value.copy(p.tileGlyph);
    glyphUniforms.uHot.value.copy(p.accentHot);
    glyphUniforms.uFogDensity.value = p.fogDensity;
    glyphUniforms.uAdditive.value = p.additive ? 1 : 0;
    glyphMaterial.blending = p.additive ? AdditiveBlending : NormalBlending;
  }
  setPalette(palette);

  return {
    addTo(parent: Object3D) {
      parent.add(bodies, glyphs);
    },
    setPalette,
    /**
     * @param spread 1 frames the menu; >1 pushes the ring out so a board
     *   seen from above has room.
     * @param rise 0..1 victory lift.
     * @param appear 0..1 intro scale-in.
     */
    update(
      time: number,
      dt: number,
      spread: number,
      rise: number,
      appear: number,
      energy: number,
      camera: Vector3,
    ) {
      const decay = Math.exp(-dt * 1.6);
      for (const [i, m] of motions.entries()) {
        const angle = m.angle + time * m.speed * (1 + rise * 2.5);
        const radius = m.radius * spread + rise * m.lift * 2;
        const y =
          m.height +
          Math.sin(time * m.bobFreq + m.phase) * m.bobAmp +
          rise * m.lift * 6;
        dummy.position.set(
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius,
        );
        spinQuat.setFromAxisAngle(
          m.axis,
          m.phase + time * m.spin * (1 + rise * 4),
        );
        dummy.quaternion.copy(spinQuat);
        // Staggered intro: each tile pops in at its own moment.
        const pop = Math.min(1, Math.max(0, appear * 1.6 - (i / count) * 0.6));
        // A tile drifting into the lens would fill the screen, out of
        // focus: shrink it away instead.
        const near = dummy.position.distanceTo(camera);
        const clear = Math.min(1, Math.max(0, (near - 4) / 5));
        const shown = pop * clear * clear * (3 - 2 * clear);
        dummy.scale.setScalar(m.scale * shown * (1 + 0.6 * pop * (1 - pop)));
        dummy.updateMatrix();
        bodies.setMatrixAt(i, dummy.matrix);
        glyphs.setMatrixAt(i, dummy.matrix);
        glows[i] = (glows[i] ?? 0) * decay;
      }
      bodies.instanceMatrix.needsUpdate = true;
      glyphs.instanceMatrix.needsUpdate = true;
      glowAttribute.needsUpdate = true;
      glyphUniforms.uEnergy.value = energy;
    },
    /** Light every tile bearing this digit (1..9). */
    flashDigit(digit: number, amount: number) {
      for (const [i, m] of motions.entries()) {
        if (m.digit === digit - 1) {
          glows[i] = Math.max(glows[i] ?? 0, amount);
        }
      }
    },
    flashAll(amount: number) {
      for (let i = 0; i < count; i++) {
        glows[i] = Math.max(glows[i] ?? 0, amount);
      }
    },
    dispose() {
      body.dispose();
      bodyMaterial.dispose();
      glyphGeometry.dispose();
      glyphMaterial.dispose();
      atlas.dispose();
      bodies.dispose();
      glyphs.dispose();
    },
  };
}
