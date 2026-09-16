// The layout thread. Receives the converged positions from graph.json plus
// the links, keeps the same simulation the data script ran ticking at a low
// alpha, and posts a fresh position buffer at a steady rate. The main thread
// only interpolates toward the last buffer and draws.

import {
  createSimulation,
  defaultForceParams,
  idleAlpha,
  type ForceLink,
  type Simulation,
} from "../lib/graph-force";

export interface LayoutInitMessage {
  type: "init";
  positions: Float32Array;
  radii: Float32Array;
  links: ForceLink[];
  seed: number;
  /** Reduced motion: hold the layout still instead of letting it wander. */
  still: boolean;
}

export interface LayoutControlMessage {
  type: "pause" | "resume";
}

export type LayoutInbound = LayoutInitMessage | LayoutControlMessage;

export interface LayoutPositionsMessage {
  type: "positions";
  positions: Float32Array;
}

const tickMs = 1000 / 30;

let simulation: Simulation | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let paused = false;
let elapsed = 0;

const scope = self as unknown as {
  postMessage: (message: LayoutPositionsMessage, transfer: Transferable[]) => void;
  onmessage: ((event: MessageEvent<LayoutInbound>) => void) | null;
};

scope.onmessage = (event: MessageEvent<LayoutInbound>): void => {
  const message = event.data;
  if (message.type === "init") {
    start(message);
  } else if (message.type === "pause") {
    paused = true;
  } else if (message.type === "resume") {
    paused = false;
  }
};

function start(message: LayoutInitMessage): void {
  stop();
  const params = message.still ? { ...defaultForceParams, wander: 0 } : defaultForceParams;
  simulation = createSimulation(
    message.positions,
    message.radii,
    message.links,
    params,
    message.seed,
  );
  elapsed = 0;
  if (message.still) {
    // Reduced motion: the stored layout, untouched, so the scene is the same
    // picture as the snapshot and nothing eases.
    post();
    return;
  }
  timer = setInterval(step, tickMs);
  post();
}

function step(): void {
  if (paused || simulation == null) return;
  elapsed += tickMs / 1000;
  simulation.tick(idleAlpha, elapsed);
  post();
}

function post(): void {
  if (simulation == null) return;
  // Copy, so the simulation keeps its own buffer and the copy transfers.
  const positions = new Float32Array(simulation.positions);
  scope.postMessage({ type: "positions", positions }, [positions.buffer]);
}

function stop(): void {
  if (timer != null) clearInterval(timer);
  timer = null;
  simulation = null;
}
