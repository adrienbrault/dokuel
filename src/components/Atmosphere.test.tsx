import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitAtmosphere } from "../lib/atmosphere.ts";
import { Atmosphere } from "./Atmosphere.tsx";

// ── three.js boundary mock ────────────────────────────────────────────
// The WebGL scene is a system boundary: jsdom has no GL, so every three
// class is stubbed while the component's real contract — lifecycle,
// bus wiring, RAF loop, theme + visibility handling — stays under test.
const mocks = vi.hoisted(() => ({
  failWebGL: false,
  renderers: [] as unknown[],
  bloomPasses: [] as unknown[],
  composerRenders: [] as number[],
  rafCallbacks: [] as (FrameRequestCallback | null)[],
}));

type MockRenderer = {
  domElement: HTMLCanvasElement;
  setPixelRatio: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};
type MockBloom = { strength: number; threshold: number };
const rendererAt = (index: number) => mocks.renderers[index] as MockRenderer;
const bloomAt = (index: number) => mocks.bloomPasses[index] as MockBloom;

vi.mock("three", () => {
  const makeColor = (hex = 0) => ({
    isColor: true,
    hex,
    set: vi.fn(),
    setHex: vi.fn(),
    setRGB: vi.fn(),
    copy: vi.fn(),
    lerp: vi.fn(),
    getHex: vi.fn(() => hex),
  });

  const makeObject3D = (name: string) => {
    const position = { x: 0, y: 0, z: 0, set: vi.fn(), copy: vi.fn() };
    const rotation = { x: 0, y: 0, z: 0, set: vi.fn() };
    const scale = { x: 1, y: 1, z: 1, set: vi.fn() };
    return {
      name,
      isObject3D: true,
      children: [] as unknown[],
      position,
      rotation,
      scale,
      visible: true,
      matrixAutoUpdate: true,
      add: vi.fn(function (this: { children: unknown[] }, child: unknown) {
        this.children.push(child);
      }),
      remove: vi.fn(),
      traverse: vi.fn(function (
        this: { children: { traverse: (cb: unknown) => void }[] },
        cb: (o: unknown) => void,
      ) {
        cb(this);
        for (const child of this.children) child.traverse(cb);
      }),
    };
  };

  class MockWebGLRenderer {
    domElement = document.createElement("canvas");
    toneMapping = 0;
    outputColorSpace = "";
    constructor() {
      if (mocks.failWebGL) throw new Error("WebGL unavailable");
      mocks.renderers.push(this);
    }
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    // Computed keys: a bare `render` field key collides with the RTL
    // `render` import in vitest's mock-hoist analysis (TDZ crash).
    ["render"] = vi.fn();
    dispose = vi.fn();
  }

  const core = {
    WebGLRenderer: MockWebGLRenderer,
    Scene: function Scene() {
      return Object.assign(makeObject3D("scene"), {
        background: null,
        fog: null,
      });
    },
    PerspectiveCamera: function PerspectiveCamera() {
      return Object.assign(makeObject3D("camera"), {
        aspect: 1,
        fov: 50,
        updateProjectionMatrix: vi.fn(),
      });
    },
    Group: function Group() {
      return makeObject3D("group");
    },
    Mesh: function Mesh(geometry: unknown, material: unknown) {
      return Object.assign(makeObject3D("mesh"), { geometry, material });
    },
    Points: function Points(geometry: unknown, material: unknown) {
      return Object.assign(makeObject3D("points"), { geometry, material });
    },
    Sprite: function Sprite(material: unknown) {
      return Object.assign(makeObject3D("sprite"), {
        material,
        center: { set: vi.fn() },
      });
    },
    Color: function Color(hex?: number) {
      return makeColor(hex ?? 0);
    },
    Vector2: function Vector2(x: number, y: number) {
      return { x, y, set: vi.fn(), copy: vi.fn() };
    },
    Vector3: function Vector3(x: number, y: number, z: number) {
      return {
        x,
        y,
        z,
        set: vi.fn(),
        copy: vi.fn(),
        addScaledVector: vi.fn(),
        length: vi.fn(() => 1),
      };
    },
    BufferGeometry: function BufferGeometry() {
      return {
        isBufferGeometry: true,
        attributes: {} as Record<string, unknown>,
        setAttribute: vi.fn(function (
          this: { attributes: Record<string, unknown> },
          name: string,
          value: unknown,
        ) {
          this.attributes[name] = value;
        }),
        dispose: vi.fn(),
      };
    },
    BufferAttribute: function BufferAttribute(
      array: Float32Array,
      itemSize: number,
    ) {
      return { array, itemSize, needsUpdate: false };
    },
    PlaneGeometry: function PlaneGeometry(width: number, height: number) {
      return { isBufferGeometry: true, width, height, dispose: vi.fn() };
    },
    TorusGeometry: function TorusGeometry(radius: number) {
      return { isBufferGeometry: true, radius, dispose: vi.fn() };
    },
    ShaderMaterial: function ShaderMaterial(params: Record<string, unknown>) {
      return { isMaterial: true, uniforms: {}, ...params, dispose: vi.fn() };
    },
    MeshBasicMaterial: function MeshBasicMaterial(
      params: Record<string, unknown>,
    ) {
      return {
        isMaterial: true,
        opacity: 1,
        ...params,
        color: makeColor(params.color as number),
        dispose: vi.fn(),
      };
    },
    SpriteMaterial: function SpriteMaterial(params: Record<string, unknown>) {
      return {
        isMaterial: true,
        opacity: 1,
        rotation: 0,
        ...params,
        color: makeColor(params.color as number),
        clone: vi.fn(() => SpriteMaterial(params)),
        dispose: vi.fn(),
      };
    },
    CanvasTexture: function CanvasTexture(canvas: unknown) {
      return { image: canvas, needsUpdate: false, dispose: vi.fn() };
    },
    Texture: function Texture() {
      return { image: null, needsUpdate: false, dispose: vi.fn() };
    },
    FogExp2: function FogExp2(color: unknown, density: number) {
      return { color: makeColor(color as number), density };
    },
    AdditiveBlending: 2,
    NormalBlending: 1,
    DoubleSide: 2,
    FrontSide: 0,
    ACESFilmicToneMapping: 4,
    SRGBColorSpace: "srgb",
    NoToneMapping: 0,
  };
  return { ...core, default: core };
});

vi.mock("three/examples/jsm/postprocessing/EffectComposer.js", () => ({
  EffectComposer: class MockEffectComposer {
    passes: unknown[] = [];
    constructor(renderer: unknown) {
      this.renderer = renderer;
    }
    renderer: unknown;
    addPass = vi.fn(function (this: { passes: unknown[] }, pass: unknown) {
      this.passes.push(pass);
    });
    setSize = vi.fn();
    ["render"] = vi.fn(() => {
      mocks.composerRenders.push(performance.now());
    });
    dispose = vi.fn();
  },
}));

vi.mock("three/examples/jsm/postprocessing/RenderPass.js", () => ({
  RenderPass: class MockRenderPass {},
}));

vi.mock("three/examples/jsm/postprocessing/UnrealBloomPass.js", () => ({
  UnrealBloomPass: class MockUnrealBloomPass {
    strength: number;
    radius: number;
    threshold: number;
    constructor(
      _resolution: unknown,
      strength: number,
      radius: number,
      threshold: number,
    ) {
      this.strength = strength;
      this.radius = radius;
      this.threshold = threshold;
      mocks.bloomPasses.push(this);
    }
    setSize = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock("three/examples/jsm/postprocessing/ShaderPass.js", () => ({
  ShaderPass: class MockShaderPass {
    uniforms: Record<string, unknown>;
    material: Record<string, unknown>;
    constructor(shader: { uniforms: Record<string, unknown> }) {
      this.uniforms = structuredCloneLike(shader.uniforms);
      this.material = { uniforms: this.uniforms };
    }
    setSize = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock("three/examples/jsm/postprocessing/OutputPass.js", () => ({
  OutputPass: class MockOutputPass {
    dispose = vi.fn();
  },
}));

const busSpies = vi.hoisted(() => ({ unsubscribes: [] as (() => void)[] }));
const structuredCloneLike = vi.hoisted(
  () =>
    function structuredCloneLike(uniforms: Record<string, unknown>) {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(uniforms)) {
        out[key] = { value: (uniforms[key] as { value: unknown }).value };
      }
      return out;
    },
);
vi.mock("../lib/atmosphere.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/atmosphere.ts")>();
  return {
    ...actual,
    subscribeAtmosphere: vi.fn((listener: (e: unknown) => void) => {
      const unsub = actual.subscribeAtmosphere(listener as never);
      const tracked = vi.fn(unsub);
      busSpies.unsubscribes.push(tracked);
      return tracked;
    }),
  };
});

// ── RAF harness ───────────────────────────────────────────────────────
let nowMs = 0;
function pumpFrames(count = 1, stepMs = 16.7) {
  for (let i = 0; i < count; i++) {
    nowMs += stepMs;
    const callbacks = mocks.rafCallbacks
      .splice(0, mocks.rafCallbacks.length)
      .filter((cb): cb is FrameRequestCallback => cb !== null);
    for (const cb of callbacks) cb(nowMs);
  }
}

beforeEach(() => {
  nowMs = 0;
  mocks.failWebGL = false;
  mocks.renderers.length = 0;
  mocks.bloomPasses.length = 0;
  mocks.composerRenders.length = 0;
  mocks.rafCallbacks.length = 0;
  busSpies.unsubscribes.length = 0;

  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    mocks.rafCallbacks.push(cb);
    return mocks.rafCallbacks.length;
  });
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => {
      mocks.rafCallbacks[id - 1] = null;
    }),
  );
  vi.spyOn(performance, "now").mockImplementation(() => nowMs);

  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
        listeners.add(cb),
      removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
        listeners.delete(cb),
      onchange: null,
      dispatchEvent: () => true,
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderAtmosphere(mood: "menu" | "game" = "menu") {
  return render(<Atmosphere mood={mood} />);
}

describe("Atmosphere", () => {
  it("mounts the WebGL canvas into a decorative container", () => {
    const { container } = renderAtmosphere();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("canvas")).toBe(rendererAt(0).domElement);
  });

  it("advertises the current mood on the layer element", () => {
    const { container, rerender } = renderAtmosphere("menu");
    expect(container.firstElementChild).toHaveAttribute("data-mood", "menu");

    rerender(<Atmosphere mood="game" />);
    expect(container.firstElementChild).toHaveAttribute("data-mood", "game");
  });

  it("starts the render loop and renders on every frame", () => {
    renderAtmosphere();
    expect(mocks.rafCallbacks.length).toBe(1);

    const before = mocks.composerRenders.length;
    pumpFrames(3);
    expect(mocks.composerRenders.length).toBe(before + 3);
  });

  it("keeps requesting frames while mounted", () => {
    renderAtmosphere();
    pumpFrames(5);
    expect(mocks.rafCallbacks.length).toBe(1);
  });

  it("stops rendering and disposes on unmount", () => {
    const { unmount } = renderAtmosphere();
    pumpFrames(2);
    const renderer = rendererAt(0);

    unmount();
    pumpFrames(3);

    expect(mocks.composerRenders).toHaveLength(2);
    expect(renderer.dispose).toHaveBeenCalled();
    expect(vi.mocked(cancelAnimationFrame)).toHaveBeenCalled();
  });

  it("subscribes to the atmosphere bus and unsubscribes on unmount", () => {
    const { unmount } = renderAtmosphere();
    expect(busSpies.unsubscribes).toHaveLength(1);
    unmount();
    expect(busSpies.unsubscribes[0]).toHaveBeenCalled();
  });

  it("drives the scene from game cues: bloom rises on completion", () => {
    renderAtmosphere("game");
    pumpFrames(30);
    const bloom = bloomAt(0);
    const before = bloom.strength;

    emitAtmosphere({ kind: "cue", cue: "complete" });
    pumpFrames(5);

    expect(bloom.strength).toBeGreaterThan(before);
  });

  it("raises the baseline when the mood switches to game", () => {
    const { rerender } = renderAtmosphere("menu");
    pumpFrames(60);
    const menuLevel = bloomAt(0).strength;

    rerender(<Atmosphere mood="game" />);
    pumpFrames(120);

    expect(bloomAt(0).strength).toBeGreaterThan(menuLevel);
  });

  it("pauses rendering while the document is hidden", () => {
    renderAtmosphere();
    pumpFrames(2);
    const visibleCount = mocks.composerRenders.length;

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    pumpFrames(5);

    expect(mocks.composerRenders).toHaveLength(visibleCount);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    pumpFrames(2);
    expect(mocks.composerRenders.length).toBe(visibleCount + 2);
  });

  it("survives machines without WebGL by rendering no canvas", () => {
    mocks.failWebGL = true;
    const { container } = renderAtmosphere();

    expect(container.querySelector("canvas")).toBeNull();
    expect(mocks.rafCallbacks).toHaveLength(0);
    // The CSS ambient glow only stands in when flagged as fallback —
    // on live WebGL it would double-wash the shader's own sky.
    expect(container.firstChild).toHaveAttribute("data-atmosphere", "fallback");
  });

  it("flags the layer as webgl when the engine boots", () => {
    const { container } = renderAtmosphere();

    expect(container.firstChild).toHaveAttribute("data-atmosphere", "webgl");
  });

  it("renders a single still frame under prefers-reduced-motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        onchange: null,
        dispatchEvent: () => true,
      })),
    );

    renderAtmosphere();
    pumpFrames(1);

    expect(mocks.composerRenders.length).toBeGreaterThanOrEqual(1);
    expect(mocks.rafCallbacks).toHaveLength(0);
  });

  it("drops to a cheaper render scale when frames keep missing 30fps", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    renderAtmosphere();
    pumpFrames(10);
    expect(rendererAt(0).setPixelRatio).toHaveBeenLastCalledWith(2);

    // 200ms frames: a weak GPU (integrated laptops, SwiftShader CI)
    // must not be pinned at full resolution forever.
    pumpFrames(40, 200);
    expect(rendererAt(0).setPixelRatio).toHaveBeenLastCalledWith(1);
  });

  it("resizes the renderer when the window resizes", () => {
    renderAtmosphere();
    pumpFrames(1);
    const renderer = rendererAt(0);
    const callsBefore = renderer.setSize;

    window.dispatchEvent(new Event("resize"));

    expect(callsBefore).toHaveBeenCalled();
  });
});
