"use client";

/* eslint-disable react-hooks/immutability --
   The scene's typed arrays and three.js buffer attributes are mutable GPU
   state written once per frame from useFrame, outside React's render. The
   compiler rule reads them as frozen hook results; they are not. */

import { Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as React from "react";
import * as THREE from "three";

import { readColorTokens, type ColorTokens } from "@/lib/css-color";
import {
  accentCount,
  baseFovDegrees,
  cameraDistance,
  dimmedOpacity,
  edgeOpacity,
  fovForAspect,
  haloScale,
  hoverSeconds,
  orbitPeriodSeconds,
  parallaxPitch,
  parallaxYaw,
} from "@/lib/graph-scene";
import type { GraphNode } from "@/lib/graph-types";
import type {
  LayoutInbound,
  LayoutPositionsMessage,
} from "@/workers/graph-layout.worker";

import type { GraphCopy, GraphSelection } from "./RepoGraph";

// The live scene. Three draw calls: one instanced quad for every disc, one
// line segment set for every edge, and the same quad again for the halos
// behind the accent nodes. Flat colors from the tokens, no lights, no
// post-processing. Positions arrive from the layout worker; this thread
// eases toward them, turns the group for the orbit and the parallax, ramps
// the hover state, and projects the nodes once per frame for picking.

interface Props {
  selection: GraphSelection;
  copy: GraphCopy;
  maxCommits: number;
  reducedMotion: boolean;
  onReady: () => void;
  onActivate: (node: GraphNode) => void;
}

interface PointerState {
  /** Pixels from the canvas's top-left. */
  x: number;
  y: number;
  inside: boolean;
  touch: boolean;
}

/** Per-node screen position and radius in CSS pixels, written every frame. */
type ScreenBuffer = Float32Array;

/** Which side of the node the label hangs on, so it stays in the viewport. */
type LabelSide = "left" | "right";

const minPickRadiusPx = 14;
const positionEase = 6;
const parallaxEase = 4;
const hoverScale = 0.15;
const discQuadExtent = 1.08;
const litEdgeOpacity = 0.75;
const readyAfterFrames = 2;

export const RepoGraphCanvas: React.FC<Props> = ({
  selection,
  copy,
  reducedMotion,
  onReady,
  onActivate,
}) => {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [labelSide, setLabelSide] = React.useState<LabelSide>("right");
  const [tokens] = React.useState<ColorTokens>(() =>
    readColorTokens(document.documentElement),
  );
  const pointer = React.useRef<PointerState>({ x: 0, y: 0, inside: false, touch: false });
  const screen = React.useRef<ScreenBuffer>(new Float32Array(selection.nodes.length * 3));
  const hoveredRef = React.useRef<number | null>(null);
  const labelAnchor = React.useRef<THREE.Group>(null);

  React.useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  const pick = (x: number, y: number): number | null =>
    pickNearest(screen.current, selection.nodes.length, x, y);

  const localPoint = (event: React.PointerEvent | React.MouseEvent): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === "touch") return;
    const point = localPoint(event);
    pointer.current = { x: point.x, y: point.y, inside: true, touch: false };
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === "touch") return;
    pointer.current = { ...pointer.current, inside: false };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.pointerType !== "touch") return;
    // Touch: the first tap on a node lights it and shows the label, a second
    // tap on the same node opens it, a tap elsewhere clears.
    const point = localPoint(event);
    pointer.current = { x: point.x, y: point.y, inside: false, touch: true };
    const index = pick(point.x, point.y);
    if (index != null && index === hoveredRef.current) {
      onActivate(selection.nodes[index]);
      return;
    }
    handleHover(index, sideFor(screen.current, index, event.currentTarget.clientWidth));
  };

  const handleHover = (index: number | null, side: LabelSide): void => {
    setHovered(index);
    setLabelSide(side);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (pointer.current.touch) return;
    const point = localPoint(event);
    const index = pick(point.x, point.y);
    if (index != null) onActivate(selection.nodes[index]);
  };

  const hoveredNode = hovered == null ? null : selection.nodes[hovered];

  return (
    <Canvas
      className={hovered == null ? "touch-manipulation" : "cursor-pointer touch-manipulation"}
      dpr={[1, 2]}
      flat
      frameloop="always"
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, cameraDistance], fov: baseFovDegrees, near: 0.1, far: 50 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <CameraRig />
      <GraphScene
        selection={selection}
        tokens={tokens}
        reducedMotion={reducedMotion}
        pointer={pointer}
        screen={screen}
        hovered={hovered}
        labelAnchor={labelAnchor}
        onHover={handleHover}
        onReady={onReady}
      />
      <group ref={labelAnchor}>
        {hoveredNode != null ? <NodeLabel node={hoveredNode} copy={copy} side={labelSide} /> : null}
      </group>
    </Canvas>
  );
};

// ---------------------------------------------------------------------------
// Camera: the vertical fov follows the aspect so the WebGL view covers the
// same region as the SVG snapshot with xMidYMid slice.

const CameraRig: React.FC = () => {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  React.useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    camera.fov = fovForAspect(size.width / Math.max(1, size.height));
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  return null;
};

// ---------------------------------------------------------------------------
// The scene body: geometry, materials, the worker, and the per-frame update.

interface SceneProps {
  selection: GraphSelection;
  tokens: ColorTokens;
  reducedMotion: boolean;
  pointer: React.RefObject<PointerState>;
  screen: React.RefObject<ScreenBuffer>;
  hovered: number | null;
  labelAnchor: React.RefObject<THREE.Group | null>;
  onHover: (index: number | null, side: LabelSide) => void;
  onReady: () => void;
}

interface SceneBuffers {
  current: Float32Array;
  target: Float32Array;
  lit: Float32Array;
  dim: Float32Array;
  discGeometry: THREE.InstancedBufferGeometry;
  discMaterial: THREE.ShaderMaterial;
  haloMaterial: THREE.ShaderMaterial;
  lineGeometry: THREE.BufferGeometry;
  lineMaterial: THREE.ShaderMaterial;
  centerAttribute: THREE.InstancedBufferAttribute;
  litAttribute: THREE.InstancedBufferAttribute;
  dimAttribute: THREE.InstancedBufferAttribute;
  linePositionAttribute: THREE.BufferAttribute;
  lineLitAttribute: THREE.BufferAttribute;
  lineDimAttribute: THREE.BufferAttribute;
}

const GraphScene: React.FC<SceneProps> = ({
  selection,
  tokens,
  reducedMotion,
  pointer,
  screen,
  hovered,
  labelAnchor,
  onHover,
  onReady,
}) => {
  const groupRef = React.useRef<THREE.Group>(null);
  const hoveredRef = React.useRef<number | null>(hovered);
  const yawRef = React.useRef(0);
  const pitchRef = React.useRef(0);
  const frameRef = React.useRef(0);
  const readyRef = React.useRef(false);
  const scratch = React.useMemo(() => ({ world: new THREE.Vector3(), view: new THREE.Vector3() }), []);

  const buffers = React.useMemo(() => createBuffers(selection, tokens), [selection, tokens]);

  React.useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  // Layout worker: owns the simulation, posts positions; paused while hidden.
  React.useEffect(() => {
    const worker = new Worker(new URL("../workers/graph-layout.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<LayoutPositionsMessage>): void => {
      if (event.data.type === "positions") buffers.target.set(event.data.positions);
    };
    const init: LayoutInbound = {
      type: "init",
      positions: new Float32Array(selection.positions),
      radii: new Float32Array(selection.radii),
      links: selection.links,
      seed: selection.seed,
      still: reducedMotion,
    };
    worker.postMessage(init, [init.positions.buffer, init.radii.buffer]);
    const handleVisibility = (): void => {
      const control: LayoutInbound = { type: document.hidden ? "pause" : "resume" };
      worker.postMessage(control);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      worker.terminate();
    };
  }, [selection, reducedMotion, buffers]);

  // GPU resources go when the scene does.
  React.useEffect(() => {
    return () => {
      buffers.discGeometry.dispose();
      buffers.discMaterial.dispose();
      buffers.haloMaterial.dispose();
      buffers.lineGeometry.dispose();
      buffers.lineMaterial.dispose();
    };
  }, [buffers]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (group == null) return;
    const step = Math.min(delta, 0.1);
    const count = selection.nodes.length;
    const { current, target, lit, dim } = buffers;
    const hoveredIndex = hoveredRef.current;
    const neighbourhood = hoveredIndex == null ? null : selection.neighbours[hoveredIndex];

    // Orbit and parallax.
    const orbit = reducedMotion ? 0 : (state.clock.elapsedTime * Math.PI * 2) / orbitPeriodSeconds;
    const pointerState = pointer.current;
    const wantYaw =
      !reducedMotion && pointerState.inside
        ? (pointerState.x / state.size.width - 0.5) * 2 * parallaxYaw
        : 0;
    const wantPitch =
      !reducedMotion && pointerState.inside
        ? (pointerState.y / state.size.height - 0.5) * 2 * parallaxPitch
        : 0;
    yawRef.current = THREE.MathUtils.damp(yawRef.current, wantYaw, parallaxEase, step);
    pitchRef.current = THREE.MathUtils.damp(pitchRef.current, wantPitch, parallaxEase, step);
    group.rotation.set(pitchRef.current, orbit + yawRef.current, 0);
    group.updateMatrixWorld();

    // Ease toward the worker's positions and ramp the hover state.
    const ease = 1 - Math.exp(-positionEase * step);
    const ramp = Math.min(1, step / hoverSeconds);
    for (let index = 0; index < count; index++) {
      const base = index * 3;
      current[base] += (target[base] - current[base]) * ease;
      current[base + 1] += (target[base + 1] - current[base + 1]) * ease;
      current[base + 2] += (target[base + 2] - current[base + 2]) * ease;
      buffers.centerAttribute.setXYZ(
        index,
        current[base] * selection.scale,
        current[base + 1] * selection.scale,
        current[base + 2] * selection.scale,
      );
      const related =
        hoveredIndex != null && (index === hoveredIndex || neighbourhood?.includes(index) === true);
      const litTarget = related ? 1 : 0;
      const dimTarget = hoveredIndex != null && !related ? 1 : 0;
      lit[index] += (litTarget - lit[index]) * ramp;
      dim[index] += (dimTarget - dim[index]) * ramp;
    }
    buffers.litAttribute.set(lit);
    buffers.dimAttribute.set(dim);
    buffers.centerAttribute.needsUpdate = true;
    buffers.litAttribute.needsUpdate = true;
    buffers.dimAttribute.needsUpdate = true;

    // Edges follow their endpoints; an edge is lit when it touches the
    // hovered node and dimmed when neither end is related.
    selection.links.forEach((link, edgeIndex) => {
      const a = link.source * 3;
      const b = link.target * 3;
      buffers.linePositionAttribute.setXYZ(
        edgeIndex * 2,
        current[a] * selection.scale,
        current[a + 1] * selection.scale,
        current[a + 2] * selection.scale,
      );
      buffers.linePositionAttribute.setXYZ(
        edgeIndex * 2 + 1,
        current[b] * selection.scale,
        current[b + 1] * selection.scale,
        current[b + 2] * selection.scale,
      );
      const touches =
        hoveredIndex != null && (link.source === hoveredIndex || link.target === hoveredIndex);
      const edgeLit = touches ? Math.max(lit[link.source], lit[link.target]) : 0;
      const edgeDim = Math.min(dim[link.source], dim[link.target]);
      buffers.lineLitAttribute.setX(edgeIndex * 2, edgeLit);
      buffers.lineLitAttribute.setX(edgeIndex * 2 + 1, edgeLit);
      buffers.lineDimAttribute.setX(edgeIndex * 2, edgeDim);
      buffers.lineDimAttribute.setX(edgeIndex * 2 + 1, edgeDim);
    });
    buffers.linePositionAttribute.needsUpdate = true;
    buffers.lineLitAttribute.needsUpdate = true;
    buffers.lineDimAttribute.needsUpdate = true;

    // Project every node for picking: screen x, y, and radius in CSS pixels.
    const camera = state.camera as THREE.PerspectiveCamera;
    const focalPx = state.size.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
    const screenBuffer = screen.current;
    for (let index = 0; index < count; index++) {
      const base = index * 3;
      scratch.world
        .set(
          current[base] * selection.scale,
          current[base + 1] * selection.scale,
          current[base + 2] * selection.scale,
        )
        .applyMatrix4(group.matrixWorld);
      scratch.view.copy(scratch.world).applyMatrix4(camera.matrixWorldInverse);
      const depth = Math.max(0.1, -scratch.view.z);
      scratch.world.project(camera);
      screenBuffer[base] = ((scratch.world.x + 1) / 2) * state.size.width;
      screenBuffer[base + 1] = ((1 - scratch.world.y) / 2) * state.size.height;
      screenBuffer[base + 2] = (selection.radii[index] * focalPx) / depth;
    }

    // The label follows the hovered node, above and to its right.
    const anchor = labelAnchor.current;
    if (anchor != null && hoveredIndex != null) {
      const base = hoveredIndex * 3;
      const radius = selection.radii[hoveredIndex];
      scratch.world
        .set(
          current[base] * selection.scale,
          current[base + 1] * selection.scale,
          current[base + 2] * selection.scale,
        )
        .applyMatrix4(group.matrixWorld);
      const toLeft = screen.current[base] > state.size.width / 2;
      anchor.position.set(
        scratch.world.x + radius * (toLeft ? -0.9 : 0.9),
        scratch.world.y + radius * 0.9,
        scratch.world.z,
      );
    }

    // Mouse hover resolves here, against this frame's projection.
    if (!pointerState.touch) {
      const next = pointerState.inside ? pickNearest(screenBuffer, count, pointerState.x, pointerState.y) : null;
      if (next !== hoveredIndex) {
        hoveredRef.current = next;
        onHover(next, sideFor(screenBuffer, next, state.size.width));
      }
    }

    frameRef.current += 1;
    if (!readyRef.current && frameRef.current >= readyAfterFrames) {
      readyRef.current = true;
      onReady();
    }
  });

  return (
    <group ref={groupRef}>
      <mesh
        geometry={buffers.discGeometry}
        material={buffers.discMaterial}
        frustumCulled={false}
        renderOrder={0}
      />
      <lineSegments
        geometry={buffers.lineGeometry}
        material={buffers.lineMaterial}
        frustumCulled={false}
        renderOrder={1}
      />
      <mesh
        geometry={buffers.discGeometry}
        material={buffers.haloMaterial}
        frustumCulled={false}
        renderOrder={2}
      />
    </group>
  );
};

// ---------------------------------------------------------------------------
// The hover label: mono, next to the node, fades over the hover ramp.

interface LabelProps {
  node: GraphNode;
  copy: GraphCopy;
  side: LabelSide;
}

const NodeLabel: React.FC<LabelProps> = ({ node, copy, side }) => {
  const facts = [
    node.language,
    `${node.commits} ${copy.commitsUnit}`,
    node.stars > 0 ? `${node.stars} ${copy.starsUnit}` : null,
    node.firstActivity != null ? `${copy.sincePrefix} ${node.firstActivity.slice(0, 4)}` : null,
  ].filter((fact): fact is string => fact != null);

  return (
    <Html key={node.id} zIndexRange={[10, 0]} className="pointer-events-none">
      <div className={side === "left" ? "graph-label graph-label-left" : "graph-label"}>
        <span className="graph-label-name">{node.label}</span>
        <span className="graph-label-facts">{facts.join(" · ")}</span>
      </div>
    </Html>
  );
};

// ---------------------------------------------------------------------------
// Geometry and materials

function createBuffers(selection: GraphSelection, tokens: ColorTokens): SceneBuffers {
  const count = selection.nodes.length;
  const current = new Float32Array(selection.positions);
  const target = new Float32Array(selection.positions);
  const lit = new Float32Array(count);
  const dim = new Float32Array(count);

  const quad = new THREE.PlaneGeometry(2, 2);
  const discGeometry = new THREE.InstancedBufferGeometry();
  discGeometry.index = quad.index;
  discGeometry.setAttribute("position", quad.getAttribute("position"));
  discGeometry.instanceCount = count;
  const centerAttribute = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  centerAttribute.setUsage(THREE.DynamicDrawUsage);
  const radiusAttribute = new THREE.InstancedBufferAttribute(new Float32Array(selection.radii), 1);
  const accentAttribute = new THREE.InstancedBufferAttribute(
    Float32Array.from({ length: count }, (_, index) => (index < accentCount ? 1 : 0)),
    1,
  );
  const litAttribute = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  litAttribute.setUsage(THREE.DynamicDrawUsage);
  const dimAttribute = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  dimAttribute.setUsage(THREE.DynamicDrawUsage);
  discGeometry.setAttribute("aCenter", centerAttribute);
  discGeometry.setAttribute("aRadius", radiusAttribute);
  discGeometry.setAttribute("aAccent", accentAttribute);
  discGeometry.setAttribute("aLit", litAttribute);
  discGeometry.setAttribute("aDim", dimAttribute);
  for (let index = 0; index < count; index++) {
    centerAttribute.setXYZ(
      index,
      current[index * 3] * selection.scale,
      current[index * 3 + 1] * selection.scale,
      current[index * 3 + 2] * selection.scale,
    );
  }

  const muted = toVector(tokens["--foreground-muted"]);
  const accent = toVector(tokens["--accent"]);
  const glow = toVector(tokens["--glow"]);
  const sharedUniforms = {
    uMuted: { value: muted },
    uAccent: { value: accent },
    uGlow: { value: glow },
    uGlowAlpha: { value: tokens["--glow"].a },
    uDimmed: { value: dimmedOpacity },
    uHoverScale: { value: hoverScale },
  };
  const discMaterial = new THREE.ShaderMaterial({
    vertexShader: nodeVertexShader,
    fragmentShader: nodeFragmentShader,
    uniforms: { ...sharedUniforms, uPass: { value: 0 }, uExtent: { value: discQuadExtent } },
    transparent: true,
    depthTest: true,
    depthWrite: true,
  });
  const haloMaterial = new THREE.ShaderMaterial({
    vertexShader: nodeVertexShader,
    fragmentShader: nodeFragmentShader,
    uniforms: { ...sharedUniforms, uPass: { value: 1 }, uExtent: { value: haloScale } },
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });

  const edgeCount = selection.links.length;
  const lineGeometry = new THREE.BufferGeometry();
  const linePositionAttribute = new THREE.BufferAttribute(new Float32Array(edgeCount * 6), 3);
  linePositionAttribute.setUsage(THREE.DynamicDrawUsage);
  const lineLitAttribute = new THREE.BufferAttribute(new Float32Array(edgeCount * 2), 1);
  lineLitAttribute.setUsage(THREE.DynamicDrawUsage);
  const lineDimAttribute = new THREE.BufferAttribute(new Float32Array(edgeCount * 2), 1);
  lineDimAttribute.setUsage(THREE.DynamicDrawUsage);
  lineGeometry.setAttribute("position", linePositionAttribute);
  lineGeometry.setAttribute("aLit", lineLitAttribute);
  lineGeometry.setAttribute("aDim", lineDimAttribute);
  const lineMaterial = new THREE.ShaderMaterial({
    vertexShader: edgeVertexShader,
    fragmentShader: edgeFragmentShader,
    uniforms: {
      uAccent: { value: accent },
      uEdgeOpacity: { value: edgeOpacity },
      uLitOpacity: { value: litEdgeOpacity },
      uDimmed: { value: dimmedOpacity },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });

  return {
    current,
    target,
    lit,
    dim,
    discGeometry,
    discMaterial,
    haloMaterial,
    lineGeometry,
    lineMaterial,
    centerAttribute,
    litAttribute,
    dimAttribute,
    linePositionAttribute,
    lineLitAttribute,
    lineDimAttribute,
  };
}

function toVector(color: { r: number; g: number; b: number }): THREE.Vector3 {
  return new THREE.Vector3(color.r, color.g, color.b);
}

function sideFor(buffer: ScreenBuffer, index: number | null, width: number): LabelSide {
  return index != null && buffer[index * 3] > width / 2 ? "left" : "right";
}

function pickNearest(buffer: ScreenBuffer, count: number, x: number, y: number): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (let index = 0; index < count; index++) {
    const dx = buffer[index * 3] - x;
    const dy = buffer[index * 3 + 1] - y;
    const radius = Math.max(buffer[index * 3 + 2] * 1.15, minPickRadiusPx);
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= radius && distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

// Billboarded quad per node: the corner offset is added in view space so the
// disc always faces the camera. The same shader draws the disc (pass 0) and
// the halo (pass 1); the quad's extent differs per pass.
const nodeVertexShader = /* glsl */ `
  attribute vec3 aCenter;
  attribute float aRadius;
  attribute float aAccent;
  attribute float aLit;
  attribute float aDim;
  uniform float uExtent;
  uniform float uHoverScale;
  varying vec2 vUv;
  varying float vAccent;
  varying float vLit;
  varying float vDim;
  void main() {
    vUv = position.xy;
    vAccent = aAccent;
    vLit = aLit;
    vDim = aDim;
    vec4 center = modelViewMatrix * vec4(aCenter, 1.0);
    float extent = aRadius * uExtent * (1.0 + uHoverScale * aLit);
    gl_Position = projectionMatrix * (center + vec4(position.xy * extent, 0.0, 0.0));
  }
`;

const nodeFragmentShader = /* glsl */ `
  uniform vec3 uMuted;
  uniform vec3 uAccent;
  uniform vec3 uGlow;
  uniform float uGlowAlpha;
  uniform float uDimmed;
  uniform float uPass;
  uniform float uExtent;
  varying vec2 vUv;
  varying float vAccent;
  varying float vLit;
  varying float vDim;
  void main() {
    float d = length(vUv);
    float edge = 1.0 / uExtent;
    float aa = fwidth(d);
    float dimFactor = mix(1.0, uDimmed, vDim);
    float tone = max(vAccent, vLit);
    if (uPass < 0.5) {
      float coverage = 1.0 - smoothstep(edge - aa, edge + aa, d);
      if (coverage < 0.01) discard;
      gl_FragColor = vec4(mix(uMuted, uAccent, tone), coverage * dimFactor);
    } else {
      float t = clamp((d - edge) / (1.0 - edge), 0.0, 1.0);
      float falloff = (1.0 - t) * (1.0 - t) * (1.0 - t);
      float strength = tone * uGlowAlpha * falloff * dimFactor;
      if (d < edge || strength < 0.003) discard;
      gl_FragColor = vec4(uGlow, strength);
    }
  }
`;

const edgeVertexShader = /* glsl */ `
  attribute float aLit;
  attribute float aDim;
  varying float vLit;
  varying float vDim;
  void main() {
    vLit = aLit;
    vDim = aDim;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const edgeFragmentShader = /* glsl */ `
  uniform vec3 uAccent;
  uniform float uEdgeOpacity;
  uniform float uLitOpacity;
  uniform float uDimmed;
  varying float vLit;
  varying float vDim;
  void main() {
    float alpha = mix(uEdgeOpacity, uLitOpacity, vLit) * mix(1.0, uDimmed, vDim);
    gl_FragColor = vec4(uAccent, alpha);
  }
`;
