// Force-directed layout in three dimensions, shared by three callers: the data
// script (scripts/fetch-graph-data.mjs) converges it once and stores the
// result in content/graph.json, the layout worker keeps it alive in the
// browser, and nothing on the main thread ever ticks it.
//
// Erasable TypeScript only (no enums, no parameter properties): the data
// script imports this file straight into Node, which strips the types.

export interface ForceLink {
  source: number;
  target: number;
  /** 0 to 1. Stronger links pull tighter and sit closer. */
  weight: number;
}

export interface ForceParams {
  /** Pairwise push, scaled by the two radii. */
  repulsion: number;
  /** Rest length of a full-weight link, before the two radii are added. */
  linkDistance: number;
  linkStrength: number;
  /** Pull toward the origin, so the cloud never walks away. */
  center: number;
  /** Extra pull of z toward 0, so the cloud reads as a disc with depth. */
  flatten: number;
  /** Velocity kept per tick. */
  damping: number;
  /** Amplitude of the slow per-node wander that keeps a settled layout alive. */
  wander: number;
}

export interface Simulation {
  /** Interleaved x, y, z. Mutated in place by tick. */
  readonly positions: Float32Array;
  /** Advance one step. alpha in 0 to 1 scales every force; time drives wander. */
  tick: (alpha: number, time: number) => void;
}

export const defaultForceParams: ForceParams = {
  repulsion: 0.04,
  linkDistance: 0.55,
  linkStrength: 0.08,
  center: 0.012,
  flatten: 0.03,
  damping: 0.82,
  wander: 0.0025,
};

/** Ticks the data script runs before it writes positions down. */
export const convergenceTicks = 600;

/** A settled layout keeps this alpha in the browser so it never fully freezes. */
export const idleAlpha = 0.035;

const minDistance = 0.05;

export function createSimulation(
  positions: Float32Array,
  radii: Float32Array,
  links: ForceLink[],
  params: ForceParams = defaultForceParams,
  seed = 1,
): Simulation {
  const count = radii.length;
  const velocities = new Float32Array(count * 3);
  const random = mulberry32(seed);
  const wanderPhase = new Float32Array(count * 3);
  const wanderRate = new Float32Array(count * 3);
  for (let index = 0; index < count * 3; index++) {
    wanderPhase[index] = random() * Math.PI * 2;
    wanderRate[index] = 0.15 + random() * 0.25;
  }

  const tick = (alpha: number, time: number): void => {
    // Pairwise repulsion.
    for (let a = 0; a < count; a++) {
      const ax = positions[a * 3];
      const ay = positions[a * 3 + 1];
      const az = positions[a * 3 + 2];
      for (let b = a + 1; b < count; b++) {
        let dx = positions[b * 3] - ax;
        let dy = positions[b * 3 + 1] - ay;
        let dz = positions[b * 3 + 2] - az;
        let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distance < minDistance) {
          // Coincident points get a deterministic nudge apart.
          dx = ((a * 7 + b * 13) % 11) / 11 - 0.5;
          dy = ((a * 3 + b * 17) % 13) / 13 - 0.5;
          dz = ((a * 5 + b * 19) % 7) / 7 - 0.5;
          distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        const push =
          (alpha * params.repulsion * (radii[a] + radii[b])) / (distance * distance);
        const fx = (dx / distance) * push;
        const fy = (dy / distance) * push;
        const fz = (dz / distance) * push;
        velocities[a * 3] -= fx;
        velocities[a * 3 + 1] -= fy;
        velocities[a * 3 + 2] -= fz;
        velocities[b * 3] += fx;
        velocities[b * 3 + 1] += fy;
        velocities[b * 3 + 2] += fz;
      }
    }

    // Springs along links.
    for (const link of links) {
      const a = link.source;
      const b = link.target;
      const dx = positions[b * 3] - positions[a * 3];
      const dy = positions[b * 3 + 1] - positions[a * 3 + 1];
      const dz = positions[b * 3 + 2] - positions[a * 3 + 2];
      const distance = Math.max(minDistance, Math.sqrt(dx * dx + dy * dy + dz * dz));
      const rest =
        params.linkDistance * (1.6 - 0.6 * link.weight) + radii[a] + radii[b];
      const pull =
        (alpha * params.linkStrength * link.weight * (distance - rest)) / distance;
      const fx = dx * pull;
      const fy = dy * pull;
      const fz = dz * pull;
      velocities[a * 3] += fx;
      velocities[a * 3 + 1] += fy;
      velocities[a * 3 + 2] += fz;
      velocities[b * 3] -= fx;
      velocities[b * 3 + 1] -= fy;
      velocities[b * 3 + 2] -= fz;
    }

    // Centering, flattening, wander, integration.
    for (let index = 0; index < count; index++) {
      const base = index * 3;
      velocities[base] -= alpha * params.center * positions[base];
      velocities[base + 1] -= alpha * params.center * positions[base + 1];
      velocities[base + 2] -=
        alpha * (params.center + params.flatten) * positions[base + 2];
      if (params.wander > 0) {
        for (let axis = 0; axis < 3; axis++) {
          velocities[base + axis] +=
            alpha *
            params.wander *
            Math.sin(time * wanderRate[base + axis] + wanderPhase[base + axis]);
        }
      }
      for (let axis = 0; axis < 3; axis++) {
        velocities[base + axis] *= params.damping;
        positions[base + axis] += velocities[base + axis];
      }
    }
  };

  return { positions, tick };
}

/** Deterministic starting positions: a jittered spiral on a sphere, most
 * active node first so the big nodes begin near the middle. */
export function seedPositions(count: number, seed = 1): Float32Array {
  const random = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < count; index++) {
    const t = count === 1 ? 0 : index / (count - 1);
    const radius = 0.4 + 1.6 * Math.sqrt(t);
    const angle = index * golden;
    const y = (random() - 0.5) * 1.2;
    positions[index * 3] = Math.cos(angle) * radius + (random() - 0.5) * 0.2;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = Math.sin(angle) * radius * 0.6 + (random() - 0.5) * 0.2;
  }
  return positions;
}

/** Root-mean-square distance from the origin; the renderer scales the layout
 * so this lands on a fixed target regardless of node count. */
export function rmsRadius(positions: Float32Array): number {
  const count = positions.length / 3;
  if (count === 0) return 1;
  let total = 0;
  for (let index = 0; index < positions.length; index++) {
    total += positions[index] * positions[index];
  }
  return Math.sqrt(total / count);
}

/** Small, fast, seedable PRNG. Same output in Node and in the browser. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
