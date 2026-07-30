import type {
  EdgeData,
  EdgePath,
  LayoutOptions,
  LayoutResult,
  NodeData,
  NodePosition,
} from './types';

type Point = { x: number; y: number };

type StoredNode = {
  id: string;
  width: number;
  height: number;
  data: NodeData;
};

type StoredEdge = {
  id: string;
  from: string;
  to: string;
  data?: EdgeData;
};

type RouteBox = {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
};

type PlanarizationResult = {
  orderedNodes: StoredNode[];
  orderedEdges: StoredEdge[];
};

const DEFAULT_NODE_WIDTH = 96;
const DEFAULT_NODE_HEIGHT = 116;
const DEFAULT_NODE_SEP = 120;
const DEFAULT_RANK_SEP = 120;
const DEFAULT_MARGIN_X = 48;
const DEFAULT_MARGIN_Y = 48;
const DEFAULT_EDGE_MARGIN = 28;
const GRID_UNIT = 10;

/**
 * Opt-in Topology-Shape-Metrics inspired orthogonal layout engine.
 *
 * The implementation keeps the TSM phases explicit:
 * - planarization: deterministic crossing-reduction order for the topology
 * - orthogonalization: global side/track assignment with Manhattan paths
 * - compaction: square-biased grid packing with integer coordinates
 *
 * This avoids changing the existing layered engines while giving architecture
 * diagrams clean, professional orthogonal edges and balanced area usage.
 */
export class OrthogonalLayoutEngine {
  private readonly nodes = new Map<string, StoredNode>();
  private readonly edges: StoredEdge[] = [];
  private edgeSequence = 0;

  constructor(private readonly options: LayoutOptions = {}) {}

  addNode(id: string, data: NodeData): void {
    this.nodes.set(id, {
      id,
      width: sanitizeDimension(data.width, DEFAULT_NODE_WIDTH),
      height: sanitizeDimension(data.height, DEFAULT_NODE_HEIGHT),
      data,
    });
  }

  addEdge(from: string, to: string, data?: EdgeData): void {
    this.edges.push({
      id: String(data?.id ?? `e${this.edgeSequence++}`),
      from,
      to,
      data,
    });
  }

  layout(): LayoutResult {
    const planar = this.planarize();
    const nodes = this.compact(planar.orderedNodes);
    const edges = this.orthogonalize(planar.orderedEdges, nodes);
    const bounds = calculateBounds(nodes, edges, this.options);

    return { nodes, edges, bounds };
  }

  private planarize(): PlanarizationResult {
    const allNodes = Array.from(this.nodes.values());
    const knownEdges = this.edges.filter(
      (edge) => this.nodes.has(edge.from) && this.nodes.has(edge.to)
    );

    if (allNodes.length <= 2) {
      return {
        orderedNodes: sortByStableKey(allNodes, (node) => node.id),
        orderedEdges: knownEdges,
      };
    }

    const degree = new Map<string, number>();
    for (const node of allNodes) degree.set(node.id, 0);
    for (const edge of knownEdges) {
      degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
      if (edge.to !== edge.from) {
        degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
      }
    }

    const orderedNodes = sortByStableKey(allNodes, (node) => [
      -(degree.get(node.id) ?? 0),
      node.id,
    ]);

    // A lightweight planarization heuristic: keep lower-conflict edges first so
    // later routing can reserve longer detours for edges that would cross more.
    const position = new Map(
      orderedNodes.map((node, index) => [node.id, index])
    );
    const orderedEdges = sortByStableKey(knownEdges, (edge) => {
      const fromIndex = position.get(edge.from) ?? 0;
      const toIndex = position.get(edge.to) ?? 0;
      return [Math.abs(fromIndex - toIndex), fromIndex, toIndex, edge.id];
    });

    return { orderedNodes, orderedEdges };
  }

  private compact(orderedNodes: StoredNode[]): Record<string, NodePosition> {
    const result: Record<string, NodePosition> = {};
    if (orderedNodes.length === 0) return result;

    const marginX = this.options.marginx ?? DEFAULT_MARGIN_X;
    const marginY = this.options.marginy ?? DEFAULT_MARGIN_Y;
    const nodeSep = this.options.nodesep ?? DEFAULT_NODE_SEP;
    const rankSep = this.options.ranksep ?? DEFAULT_RANK_SEP;
    const isLeftToRight = this.options.rankdir === 'LR';
    const columns = Math.max(1, Math.ceil(Math.sqrt(orderedNodes.length)));

    const columnWidths = Array.from({ length: columns }, () => 0);
    const rowHeights: number[] = [];

    orderedNodes.forEach((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      columnWidths[col] = Math.max(columnWidths[col], node.width);
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, node.height);
    });

    const xOffsets = prefixOffsets(columnWidths, nodeSep, marginX);
    const yOffsets = prefixOffsets(rowHeights, rankSep, marginY);

    orderedNodes.forEach((node, index) => {
      const primary = index % columns;
      const secondary = Math.floor(index / columns);
      const x = isLeftToRight ? yOffsets[secondary] : xOffsets[primary];
      const y = isLeftToRight ? xOffsets[primary] : yOffsets[secondary];

      result[node.id] = {
        x: snap(x),
        y: snap(y),
        width: node.width,
        height: node.height,
      };
    });

    return result;
  }

  private orthogonalize(
    orderedEdges: StoredEdge[],
    nodes: Record<string, NodePosition>
  ): Record<string, EdgePath> {
    const edgePaths: Record<string, EdgePath> = {};
    const boxes = new Map<string, RouteBox>();

    for (const [id, node] of Object.entries(nodes)) {
      boxes.set(id, {
        id,
        left: node.x,
        right: node.x + node.width,
        top: node.y,
        bottom: node.y + node.height,
        cx: node.x + node.width / 2,
        cy: node.y + node.height / 2,
      });
    }

    const verticalTracks = new TrackAllocator();
    const horizontalTracks = new TrackAllocator();
    const edgeMargin = this.options.edgeMargin ?? DEFAULT_EDGE_MARGIN;

    for (const edge of orderedEdges) {
      const source = boxes.get(edge.from);
      const target = boxes.get(edge.to);
      if (!source || !target) continue;

      const path =
        source.id === target.id
          ? routeSelfLoop(source, horizontalTracks, edgeMargin)
          : routeBetweenBoxes(
              source,
              target,
              boxes,
              verticalTracks,
              horizontalTracks,
              edgeMargin
            );

      edgePaths[edge.id] = { points: simplifyPath(path.map(snapPoint)) };
    }

    return edgePaths;
  }
}

class TrackAllocator {
  private readonly used = new Map<number, number>();

  reserve(preferred: number, minimumGap: number): number {
    const key = snap(preferred);
    const count = this.used.get(key) ?? 0;
    this.used.set(key, count + 1);
    if (count === 0) return key;

    const direction = count % 2 === 0 ? -1 : 1;
    const distance = Math.ceil(count / 2) * minimumGap;
    return snap(key + direction * distance);
  }
}

function routeBetweenBoxes(
  source: RouteBox,
  target: RouteBox,
  boxes: Map<string, RouteBox>,
  verticalTracks: TrackAllocator,
  horizontalTracks: TrackAllocator,
  edgeMargin: number
): Point[] {
  const dx = target.cx - source.cx;
  const dy = target.cy - source.cy;
  const preferHorizontal = Math.abs(dx) >= Math.abs(dy);

  if (preferHorizontal) {
    const start = dx >= 0 ? rightPort(source) : leftPort(source);
    const end = dx >= 0 ? leftPort(target) : rightPort(target);
    const rawTrack = (start.x + end.x) / 2;
    const track = verticalTracks.reserve(
      clearVerticalTrack(rawTrack, source, target, boxes, edgeMargin),
      edgeMargin
    );
    return [start, { x: track, y: start.y }, { x: track, y: end.y }, end];
  }

  const start = dy >= 0 ? bottomPort(source) : topPort(source);
  const end = dy >= 0 ? topPort(target) : bottomPort(target);
  const rawTrack = (start.y + end.y) / 2;
  const track = horizontalTracks.reserve(
    clearHorizontalTrack(rawTrack, source, target, boxes, edgeMargin),
    edgeMargin
  );
  return [start, { x: start.x, y: track }, { x: end.x, y: track }, end];
}

function routeSelfLoop(
  box: RouteBox,
  horizontalTracks: TrackAllocator,
  edgeMargin: number
): Point[] {
  const start = rightPort(box);
  const end = bottomPort(box);
  const outsideX = snap(box.right + edgeMargin);
  const outsideY = horizontalTracks.reserve(
    box.bottom + edgeMargin,
    edgeMargin
  );

  return [
    start,
    { x: outsideX, y: start.y },
    { x: outsideX, y: outsideY },
    { x: end.x, y: outsideY },
    end,
  ];
}

function clearVerticalTrack(
  preferred: number,
  source: RouteBox,
  target: RouteBox,
  boxes: Map<string, RouteBox>,
  edgeMargin: number
): number {
  const minY = Math.min(source.cy, target.cy);
  const maxY = Math.max(source.cy, target.cy);
  let track = preferred;

  for (const box of boxes.values()) {
    if (box.id === source.id || box.id === target.id) continue;
    const overlapsY =
      box.top - edgeMargin <= maxY && box.bottom + edgeMargin >= minY;
    const hitsX =
      track >= box.left - edgeMargin && track <= box.right + edgeMargin;
    if (overlapsY && hitsX) {
      track =
        preferred < box.cx ? box.left - edgeMargin : box.right + edgeMargin;
    }
  }

  return track;
}

function clearHorizontalTrack(
  preferred: number,
  source: RouteBox,
  target: RouteBox,
  boxes: Map<string, RouteBox>,
  edgeMargin: number
): number {
  const minX = Math.min(source.cx, target.cx);
  const maxX = Math.max(source.cx, target.cx);
  let track = preferred;

  for (const box of boxes.values()) {
    if (box.id === source.id || box.id === target.id) continue;
    const overlapsX =
      box.left - edgeMargin <= maxX && box.right + edgeMargin >= minX;
    const hitsY =
      track >= box.top - edgeMargin && track <= box.bottom + edgeMargin;
    if (overlapsX && hitsY) {
      track =
        preferred < box.cy ? box.top - edgeMargin : box.bottom + edgeMargin;
    }
  }

  return track;
}

function leftPort(box: RouteBox): Point {
  return { x: box.left, y: box.cy };
}

function rightPort(box: RouteBox): Point {
  return { x: box.right, y: box.cy };
}

function topPort(box: RouteBox): Point {
  return { x: box.cx, y: box.top };
}

function bottomPort(box: RouteBox): Point {
  return { x: box.cx, y: box.bottom };
}

function simplifyPath(points: Point[]): Point[] {
  const deduped = points.filter((point, index) => {
    const prev = points[index - 1];
    return !prev || prev.x !== point.x || prev.y !== point.y;
  });

  return deduped.filter((point, index) => {
    const prev = deduped[index - 1];
    const next = deduped[index + 1];
    if (!prev || !next) return true;
    const sameVertical = prev.x === point.x && point.x === next.x;
    const sameHorizontal = prev.y === point.y && point.y === next.y;
    return !sameVertical && !sameHorizontal;
  });
}

function calculateBounds(
  nodes: Record<string, NodePosition>,
  edges: Record<string, EdgePath>,
  options: LayoutOptions
) {
  let maxX = 0;
  let maxY = 0;
  const marginX = options.marginx ?? DEFAULT_MARGIN_X;
  const marginY = options.marginy ?? DEFAULT_MARGIN_Y;

  for (const node of Object.values(nodes)) {
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  for (const edge of Object.values(edges)) {
    for (const point of edge.points) {
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  return {
    width: snap(maxX + marginX),
    height: snap(maxY + marginY),
  };
}

function prefixOffsets(
  values: number[],
  gap: number,
  margin: number
): number[] {
  const offsets: number[] = [];
  let cursor = margin;

  for (const value of values) {
    offsets.push(cursor);
    cursor += value + gap;
  }

  return offsets;
}

function sanitizeDimension(
  value: number | undefined,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function sortByStableKey<T>(
  values: T[],
  getKey: (value: T) => string | number | Array<string | number>
): T[] {
  return [...values].sort((a, b) => compareKeys(getKey(a), getKey(b)));
}

function compareKeys(
  left: string | number | Array<string | number>,
  right: string | number | Array<string | number>
): number {
  const leftParts = Array.isArray(left) ? left : [left];
  const rightParts = Array.isArray(right) ? right : [right];
  const length = Math.max(leftParts.length, rightParts.length);

  for (let i = 0; i < length; i++) {
    const leftValue = leftParts[i] ?? '';
    const rightValue = rightParts[i] ?? '';
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }

  return 0;
}

function snapPoint(point: Point): Point {
  return { x: snap(point.x), y: snap(point.y) };
}

function snap(value: number): number {
  return Math.round(value / GRID_UNIT) * GRID_UNIT;
}
