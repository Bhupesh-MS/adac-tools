import ELK from 'elkjs';
import { type ElkNode, type ElkEdge } from '@mindfiredigital/adac-layout-elk';

import { createLayoutEngine } from '@mindfiredigital/adac-layout';
import { routeAStar } from './routing';

let fsPromise: Promise<typeof import('fs-extra')> | undefined;

const getFs = () => (fsPromise ??= import('fs-extra'));

const CSS_STYLES = `
  /* ── Design Tokens ──────────────────────────────────── */
  :root {
    /* Canvas */
    --canvas-bg:        #EEF2F7;
    --canvas-padding:   40px;

    /* Typography */
    --font-aws:         "Amazon Ember", "Inter", "Segoe UI",
                        system-ui, sans-serif;
    --font-gcp:         "Google Sans", "Product Sans",
                        Roboto, system-ui, sans-serif;
    --font-azure:       "Segoe UI", "Inter",
                        system-ui, sans-serif;

    /* Text colors */
    --text-900:         #0F172A;
    --text-600:         #475569;
    --text-400:         #94A3B8;

    /* Node card */
    --card-bg:          #FFFFFF;
    --card-border:      #DDE3ED;
    --card-radius:      10px;

    /* ── AWS Brand ── */
    --aws-orange:       #FF9900;
    --aws-dark:         #232F3E;
    --aws-hover:        #EC7211;

    --aws-vpc-bg:       #F9F4FF;
    --aws-vpc-border:   #7C3AED;

    --aws-az-bg:        #F8FAFC;
    --aws-az-border:    #B0BACC;

    --aws-pub-bg:       #F0FDF4;
    --aws-pub-border:   #16A34A;

    --aws-priv-bg:      #F0F9FF;
    --aws-priv-border:  #0369A1;

    --aws-cluster-bg:   #FFFBEB;
    --aws-cluster-border: #D97706;

    --aws-edge:         #8FA3BF;

    /* ── GCP Brand ── */
    --gcp-blue:         #1A73E8;
    --gcp-green:        #1E8E3E;
    --gcp-red:          #D93025;
    --gcp-yellow:       #F9AB00;

    --gcp-vpc-bg:       #EEF2FF;
    --gcp-vpc-border:   #1A73E8;

    --gcp-region-bg:    #F0FDF4;
    --gcp-region-border: #1E8E3E;

    --gcp-zone-bg:      #F5F8FF;
    --gcp-zone-border:  #4285F4;

    --gcp-subnet-bg:    #EEF2FF;
    --gcp-subnet-border: #1A73E8;

    --gcp-cluster-bg:   #FFF7ED;
    --gcp-cluster-border: #EA580C;

    --gcp-edge:         #4285F4;

    /* ── Azure Brand ── */
    --azure-blue:       #0078D4;
    --azure-dark:       #003366;

    --azure-rg-bg:      #EFF6FF;
    --azure-rg-border:  #0078D4;

    --azure-vnet-bg:    #DBEAFE;
    --azure-vnet-border: #2563EB;

    --azure-subnet-bg:  #EFF6FF;
    --azure-subnet-border: #0078D4;

    --azure-cluster-bg:  #FFF7ED;
    --azure-cluster-border: #EA580C;

    --azure-edge:       #0078D4;

    /* ── Compliance ── */
    --ok-color:         #16A34A;
    --fail-color:       #DC2626;
  }

  /* ── Base SVG ── */
  svg {
    font-variant-ligatures: none;
    text-rendering:         optimizeLegibility;
    shape-rendering:        geometricPrecision;
    background-color:       var(--canvas-bg);
  }

  /* ── Canvas roots ── */
  .title-pill {
    stroke-dasharray: none !important;
    stroke-width: 1.5px !important;
  }
  .aws-root, .gcp-root, .azure-root {
    fill:   var(--canvas-bg);
    stroke: none;
  }

  /* ═══════════════════════════════════════════════════
     AWS CONTAINERS
  ══════════════════════════════════════════════════ */
  .aws-container { fill: none; }

  .aws-vpc {
    fill:             var(--aws-vpc-bg);
    stroke:           var(--aws-vpc-border);
    stroke-dasharray: 10 5;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }
  .aws-az {
    fill:             var(--aws-az-bg);
    stroke:           var(--aws-az-border);
    stroke-dasharray: 6 4;
    stroke-width:     1.5px;
  }
  .aws-subnet-public {
    fill:             var(--aws-pub-bg);
    stroke:           var(--aws-pub-border);
    stroke-dasharray: 5 3;
    stroke-width:     1.5px;
  }
  .aws-subnet-private {
    fill:             var(--aws-priv-bg);
    stroke:           var(--aws-priv-border);
    stroke-dasharray: 5 3;
    stroke-width:     1.5px;
  }
  .aws-compute-cluster {
    fill:             var(--aws-cluster-bg);
    stroke:           var(--aws-cluster-border);
    stroke-dasharray: 6 3;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }

  /* AWS Typography */
  .aws-container-label {
    font-family:    var(--font-aws);
    font-size:      11px;
    font-weight:    700;
    fill:           var(--text-900);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .aws-node-label {
    font-family: var(--font-aws);
    font-size:   10px;
    font-weight: 500;
    fill:        var(--text-600);
  }
  .aws-edge {
    stroke:         var(--aws-edge);
    stroke-width:   1.5px;
    stroke-opacity: 0.85;
    fill:           none;
  }

  /* ── GCP CONTAINERS ── */
  .gcp-vpc {
    fill:             var(--gcp-vpc-bg);
    stroke:           var(--gcp-vpc-border);
    stroke-dasharray: 10 5;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }
  .gcp-region {
    fill:             var(--gcp-region-bg);
    stroke:           var(--gcp-region-border);
    stroke-dasharray: 6 3;
    stroke-width:     2px;
  }
  .gcp-zone {
    fill:             var(--gcp-zone-bg);
    stroke:           var(--gcp-zone-border);
    stroke-dasharray: 4 4;
    stroke-width:     1.2px;
  }
  .gcp-subnet {
    fill:             var(--gcp-subnet-bg);
    stroke:           var(--gcp-subnet-border);
    stroke-width:     1.5px;
  }
  .gcp-compute-cluster {
    fill:             var(--gcp-cluster-bg);
    stroke:           var(--gcp-cluster-border);
    stroke-dasharray: 5 3;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }

  /* GCP Typography */
  .gcp-container-label {
    font-family:    var(--font-gcp);
    font-size:      11px;
    font-weight:    700;
    fill:           var(--text-900);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .gcp-node-label {
    font-family: var(--font-gcp);
    font-size:   10px;
    font-weight: 400;
    fill:        var(--text-600);
  }
  .gcp-edge {
    stroke:         var(--gcp-edge);
    stroke-width:   1.5px;
    stroke-opacity: 0.75;
    fill:           none;
  }

  /* ── Azure Containers ── */
  .azure-rg {
    fill:             var(--azure-rg-bg);
    stroke:           var(--azure-rg-border);
    stroke-dasharray: 10 5;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }
  .azure-subscription {
    fill:             var(--azure-vnet-bg);
    stroke:           var(--azure-vnet-border);
    stroke-dasharray: 6 3;
    stroke-width:     2px;
  }
  .azure-container {
    fill:             var(--azure-subnet-bg);
    stroke:           var(--azure-subnet-border);
    stroke-dasharray: 5 3;
    stroke-width:     1.5px;
  }
  .azure-compute-cluster {
    fill:             var(--azure-cluster-bg);
    stroke:           var(--azure-cluster-border);
    stroke-dasharray: 5 3;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }

  /* Azure Typography */
  .azure-container-label {
    font-family:    var(--font-azure);
    font-size:      11px;
    font-weight:    700;
    fill:           var(--text-900);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .azure-node-label {
    font-family: var(--font-azure);
    font-size:   10px;
    font-weight: 400;
    fill:        var(--text-600);
  }
  .azure-edge {
    stroke:         var(--azure-edge);
    stroke-width:   1.5px;
    stroke-opacity: 0.70;
    fill:           none;
  }

  /* ── SERVICE NODE CARDS ── */
  .node-card {
    fill:   var(--card-bg);
    stroke: var(--card-border);
    stroke-width: 1px;
    filter: url(#nodeShadow);
  }
  .node-icon-bg {
    fill:   #F7FAFC;
    stroke: none;
  }

  /* ── COMPLIANCE ── */
  .compliance-ok {
    stroke:       var(--ok-color) !important;
    stroke-width: 2px !important;
  }
  .compliance-fail {
    stroke:       var(--fail-color) !important;
    stroke-width: 2px !important;
  }

  /* ── COST BADGE ── */
  .cost-badge-bg {
    fill:   #1E293B;
    rx:     4px;
  }
  .cost-badge-text {
    font-family: var(--font-aws);
    font-size:   9px;
    font-weight: 600;
    fill:        #FFFFFF;
  }

  /* ── Legend ── */
  .legend-box {
    fill:   #FFFFFF;
    stroke: #CBD5E1;
    stroke-width: 1px;
    rx:     6px;
  }
  .legend-title {
    font-family: var(--font-aws);
    font-size:   12px;
    font-weight: 700;
    fill:        #0F172A;
  }
  .legend-item-text {
    font-family: var(--font-aws);
    font-size:   10px;
    font-weight: 500;
    fill:        #475569;
  }
  .edge-label {
    font-family: var(--font-aws);
    font-size:   9px;
    font-weight: 500;
    fill:        #475569;
    paint-order: stroke;
    stroke:      #EEF2F7;
    stroke-width: 4px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

function getProvider(node: ElkNode): 'aws' | 'gcp' | 'azure' {
  const cssClass = (node.properties?.cssClass as string) || '';
  if (cssClass.startsWith('gcp-')) return 'gcp';
  if (cssClass.startsWith('azure-')) return 'azure';
  if (cssClass.startsWith('aws-')) return 'aws';

  if (node.children) {
    for (const child of node.children) {
      const p = getProvider(child);
      if (p !== 'aws') return p;
    }
  }
  return 'aws';
}

const STRUCTURAL_CLASS_TOKENS = new Set([
  'aws-az',
  'aws-vpc',
  'aws-subnet',
  'aws-subnet-private',
  'aws-subnet-public',
  'gcp-region',
  'gcp-zone',
  'gcp-vpc',
  'gcp-subnet',
  'azure-subscription',
  'azure-rg',
  'azure-vnet',
  'azure-subnet',
]);

const ZONE_CLASS_TOKENS = new Set(['aws-az', 'gcp-zone']);

const hasCssClassToken = (node: ElkNode, tokens: Set<string>) => {
  const cssClass = node.properties?.cssClass;
  if (typeof cssClass !== 'string') return false;
  return cssClass.split(/\s+/).some((token) => tokens.has(token));
};
function calculateLabelDimensions(
  label: string | undefined,
  availableWidth: number
) {
  const safeLabel = label || '';
  const PILL_LABEL_CHAR_WIDTH = 7.5;
  const PILL_LABEL_PADDING = 40;

  const maxLabelW = Math.min(
    availableWidth - 56,
    safeLabel.length * PILL_LABEL_CHAR_WIDTH + PILL_LABEL_PADDING
  );
  const maxChars = Math.floor(
    (maxLabelW - PILL_LABEL_PADDING) / PILL_LABEL_CHAR_WIDTH
  );
  const displayLabel =
    safeLabel.length > maxChars + 2
      ? safeLabel.substring(0, maxChars).trim() + '…'
      : safeLabel;

  const actualLabelW =
    displayLabel.length * PILL_LABEL_CHAR_WIDTH + PILL_LABEL_PADDING;

  return { displayLabel, actualLabelW };
}

function getUniqueIconPaths(root: ElkNode): string[] {
  const iconPaths = new Set<string>();

  function traverse(node: ElkNode): void {
    const iconPath = node.properties?.iconPath;

    if (iconPath) {
      iconPaths.add(iconPath);
    }

    for (const child of node.children ?? []) {
      traverse(child);
    }
  }

  traverse(root);

  return [...iconPaths];
}

async function buildIconDataUriMap(
  iconPaths: string[],
  iconResolver: (path: string) => Promise<string | null>
): Promise<Map<string, string>> {
  const iconMap = new Map<string, string>();
  await Promise.all(
    iconPaths.map(async (path) => {
      try {
        const dataUri = await iconResolver(path);

        if (dataUri) {
          iconMap.set(path, dataUri);
        }
      } catch (e) {
        console.warn(`Failed to resolve icon: ${path}`, e);
      }
    })
  );

  return iconMap;
}

export async function renderSvg(
  graph: ElkNode,
  layoutEngine: 'elk' | 'custom' = 'elk',
  complianceTooltipMap?: Record<
    string,
    { frameworks: string[]; violations: string[] }
  >,
  optimizationTooltipMap?: Record<string, { recommendations: string[] }>,
  perServiceCosts?: Record<string, number>,
  period: 'hourly' | 'daily' | 'monthly' | 'yearly' = 'monthly',
  iconResolver?: (iconName: string) => Promise<string | null>
): Promise<string> {
  let layout: ElkNode;
  const allNodeBoxes: {
    id: string;
    x: number;
    y: number;
    right: number;
    bottom: number;
    isContainer: boolean;
  }[] = [];

  if (layoutEngine === 'custom') {
    // ── Hierarchical custom layout ──────────────────────────────
    // Recursively lays out children within each container,
    // preserving the nesting. Children are arranged in a grid
    // when there are many siblings. Cross-container edges are
    // routed using absolute node positions with orthogonal paths.

    const CONTAINER_PAD = 48; // padding inside container boundaries
    const CONTAINER_TOP = 44; // extra top padding for label strip
    const NODE_GAP_X = 140; // horizontal gap between children
    const NODE_GAP_Y = 120; // vertical gap between rows

    // Collect ALL original edges from every level for rendering later
    const allOriginalEdges: ElkEdge[] = [];
    const collectAllEdges = (node: ElkNode) => {
      if (node.edges) allOriginalEdges.push(...node.edges);
      node.children?.forEach(collectAllEdges);
    };
    collectAllEdges(graph);

    /**
     * Recursively lay out a node's children.
     * Uses the core engine when there are edges between children
     * (to get proper rank-based ordering). Falls back to grid
     * layout when children are disconnected.
     */
    const layoutNode = async (node: ElkNode): Promise<ElkNode> => {
      // Leaf node: return as-is
      if (!node.children || node.children.length === 0) {
        return {
          ...node,
          width: node.width || 96,
          height: node.height || 116,
          children: [],
          edges: [],
        };
      }

      // Container: recursively lay out children first
      const laidOutChildren: ElkNode[] = [];
      for (const child of node.children) {
        laidOutChildren.push(await layoutNode(child));
      }

      // Check if there are any local edges between direct children
      const childIds = new Set(laidOutChildren.map((c) => c.id));
      const localEdges: ElkEdge[] = [];
      if (node.edges) {
        for (const edge of node.edges) {
          if (childIds.has(edge.sources[0]) && childIds.has(edge.targets[0])) {
            localEdges.push(edge);
          }
        }
      }

      let positionedChildren: ElkNode[];

      const hasStructuralChildren = laidOutChildren.some((c) =>
        hasCssClassToken(c, STRUCTURAL_CLASS_TOKENS)
      );

      if (
        localEdges.length > 0 &&
        laidOutChildren.length <= 12 &&
        !hasStructuralChildren
      ) {
        // Use the core engine for rank-based layout when there are edges
        const engine = await createLayoutEngine('custom', {
          rankdir: 'TB',
          nodesep: NODE_GAP_X,
          ranksep: NODE_GAP_Y,
        });

        for (const child of laidOutChildren) {
          engine.addNode(child.id, {
            width: child.width || 96,
            height: child.height || 116,
          });
        }
        for (const edge of localEdges) {
          engine.addEdge(edge.sources[0], edge.targets[0]);
        }

        const result = await engine.layout();
        positionedChildren = laidOutChildren.map((child) => {
          const pos = result.nodes[child.id];
          if (pos) {
            return {
              ...child,
              x: pos.x + CONTAINER_PAD,
              y: pos.y + CONTAINER_TOP,
            };
          }
          return child;
        });
      } else {
        // Flow Layout (Masonry) for tightly packing mixed-size items
        const isAz = (c: ElkNode) => hasCssClassToken(c, ZONE_CLASS_TOKENS);
        const azChildren = laidOutChildren.filter((c) => isAz(c));
        const nonAzChildren = laidOutChildren.filter((c) => !isAz(c));

        let currentX = 0;
        const columns: { x: number; w: number; y: number }[] = [];

        const positionedAzs = azChildren.map((c) => {
          const res = { ...c, x: currentX + CONTAINER_PAD, y: CONTAINER_TOP };
          columns.push({
            x: currentX,
            w: (c.width || 0) + NODE_GAP_X,
            y: CONTAINER_TOP + (c.height || 0) + NODE_GAP_Y,
          });
          currentX += (c.width || 0) + NODE_GAP_X;
          return res;
        });

        if (columns.length === 0 && nonAzChildren.length > 0) {
          let maxChildWidth = 400;
          for (const c of nonAzChildren) {
            if (c.width && c.width > maxChildWidth) {
              maxChildWidth = c.width;
            }
          }
          const numCols = Math.min(
            Math.ceil(Math.sqrt(nonAzChildren.length)),
            4
          );
          for (let i = 0; i < numCols; i++) {
            const colObj = {
              x: i * (maxChildWidth + NODE_GAP_X),
              w: maxChildWidth,
              y: CONTAINER_TOP,
            };
            columns.push(colObj);
          }
        }

        const positionedNonAz: ElkNode[] = [];
        nonAzChildren.forEach((c) => {
          let minCol = columns[0] || { x: 0, w: 0, y: CONTAINER_TOP };
          for (const col of columns) {
            if (col.y < minCol.y) minCol = col;
          }

          positionedNonAz.push({
            ...c,
            x: minCol.x + CONTAINER_PAD,
            y: minCol.y,
          });

          minCol.y += (c.height || 0) + NODE_GAP_Y;
        });

        positionedChildren = [...positionedAzs, ...positionedNonAz];
      }

      // Compute container size from children bounds
      let maxX = 0,
        maxY = 0;
      positionedChildren.forEach((child) => {
        maxX = Math.max(maxX, (child.x || 0) + (child.width || 0));
        maxY = Math.max(maxY, (child.y || 0) + (child.height || 0));
      });

      const labelText = node.labels?.[0]?.text || '';
      // Heuristic: ~8px per character + 80px padding for the pill structure
      const minLabelWidth = labelText.length * 8 + 80;

      return {
        ...node,
        width: Math.max(maxX + CONTAINER_PAD, minLabelWidth),
        height: maxY + CONTAINER_PAD,
        children: positionedChildren,
        edges: [],
      };
    };

    layout = await layoutNode(graph);
    layout.properties = graph.properties;

    // Pass 1: Global absolute positioning calculation
    const absPositions = new Map<
      string,
      {
        id: string;
        x: number;
        y: number;
        w: number;
        h: number;
        isLeaf: boolean;
        type?: string;
        isStacked?: boolean;
        label?: string;
      }
    >();
    const parentChain = new Map<string, string>(); // childId -> parentId

    const buildAbsPositions = (n: ElkNode, ox: number, oy: number) => {
      const ax = ox + (n.x || 0);
      const ay = oy + (n.y || 0);
      const isLeaf = !n.children || n.children.length === 0;
      absPositions.set(n.id, {
        id: n.id,
        x: ax,
        y: ay,
        w: n.width || 0,
        h: n.height || 0,
        isLeaf,
        type: n.properties?.type,
        isStacked: n.properties?.isStacked,
        label: n.labels?.[0]?.text || '',
      });
      n.children?.forEach((c) => {
        parentChain.set(c.id, n.id);
        buildAbsPositions(c, ax, ay);
      });
    };
    buildAbsPositions(layout, 0, 0);

    const allObstacles: {
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      isLeaf: boolean;
    }[] = Array.from(absPositions.values()).map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      isLeaf: p.isLeaf,
    }));

    // ── Route ALL original edges using A* ──
    const routedEdges: ElkEdge[] = [];
    const verticalPortUsage = new Map<number, number>();
    const horizontalPortUsage = new Map<number, number>();

    const getVerticalOffset = (x: number) => {
      const key = Math.round(x / 5) * 5;
      const count = verticalPortUsage.get(key) || 0;
      verticalPortUsage.set(key, count + 1);
      const sign = count % 2 === 0 ? 1 : -1;
      const mag = Math.floor((count + 1) / 2) * 15;
      return sign * mag;
    };

    const getHorizontalOffset = (y: number) => {
      const key = Math.round(y / 5) * 5;
      const count = horizontalPortUsage.get(key) || 0;
      horizontalPortUsage.set(key, count + 1);
      const sign = count % 2 === 0 ? 1 : -1;
      const mag = Math.floor((count + 1) / 2) * 15;
      return sign * mag;
    };

    const getPillBounds = (pos: { x: number; w: number; label?: string }) => {
      const { actualLabelW } = calculateLabelDimensions(pos.label, pos.w);
      return { left: pos.x + 16, right: pos.x + 16 + actualLabelW };
    };

    allOriginalEdges.forEach((origEdge) => {
      const srcId = origEdge.sources[0];
      const tgtId = origEdge.targets[0];
      const srcPos = absPositions.get(srcId);
      const tgtPos = absPositions.get(tgtId);
      if (!srcPos || !tgtPos) return;

      const srcCx = srcPos.x + srcPos.w / 2;
      const srcCy = srcPos.y + srcPos.h / 2;
      const tgtCx = tgtPos.x + tgtPos.w / 2;
      const tgtCy = tgtPos.y + tgtPos.h / 2;

      let sOffX = 0,
        tOffX = 0;
      let sOffY = 0,
        tOffY = 0;

      const isVertical = Math.abs(tgtCx - srcCx) < Math.abs(tgtCy - srcCy);

      if (isVertical) {
        if (Math.abs(srcCx - tgtCx) < 5) {
          const off = getVerticalOffset(srcCx);
          sOffX = off;
          tOffX = off;
        } else {
          sOffX = getVerticalOffset(srcCx);
          tOffX = getVerticalOffset(tgtCx);
        }
      } else {
        if (Math.abs(srcCy - tgtCy) < 5) {
          const off = getHorizontalOffset(srcCy);
          sOffY = off;
          tOffY = off;
        } else {
          sOffY = getHorizontalOffset(srcCy);
          tOffY = getHorizontalOffset(tgtCy);
        }
      }

      let srcTopAdjust = 0;
      if (srcPos?.type === 'container') {
        const bounds = getPillBounds(srcPos);
        if (
          srcCx + sOffX >= bounds.left - 5 &&
          srcCx + sOffX <= bounds.right + 5
        ) {
          srcTopAdjust = -14;
        }
      } else if (srcPos?.isStacked) srcTopAdjust = -8;

      let tgtTopAdjust = 0;
      if (tgtPos?.type === 'container') {
        const bounds = getPillBounds(tgtPos);
        if (
          tgtCx + tOffX >= bounds.left - 5 &&
          tgtCx + tOffX <= bounds.right + 5
        ) {
          tgtTopAdjust = -14;
        }
      } else if (tgtPos?.isStacked) tgtTopAdjust = -8;

      const srcBot = srcPos.y + srcPos.h;
      const srcTop = srcPos.y + srcTopAdjust;
      const tgtBot = tgtPos.y + tgtPos.h;
      const tgtTop = tgtPos.y + tgtTopAdjust;

      let startPt: { x: number; y: number };
      let endPt: { x: number; y: number };
      let startStub: { x: number; y: number };
      let endStub: { x: number; y: number };

      if (isVertical) {
        if (tgtTop > srcBot - 10) {
          startPt = { x: srcCx + sOffX, y: srcBot };
          startStub = { x: srcCx + sOffX, y: srcBot + 20 };
          endPt = { x: tgtCx + tOffX, y: tgtTop };
          endStub = { x: tgtCx + tOffX, y: tgtTop - 20 };
        } else {
          startPt = { x: srcCx + sOffX, y: srcTop };
          startStub = { x: srcCx + sOffX, y: srcTop - 20 };
          endPt = { x: tgtCx + tOffX, y: tgtBot };
          endStub = { x: tgtCx + tOffX, y: tgtBot + 20 };
        }
      } else {
        if (tgtCx > srcCx) {
          startPt = { x: srcPos.x + srcPos.w, y: srcCy + sOffY };
          startStub = { x: srcPos.x + srcPos.w + 20, y: srcCy + sOffY };
          endPt = { x: tgtPos.x, y: tgtCy + tOffY };
          endStub = { x: tgtPos.x - 20, y: tgtCy + tOffY };
        } else {
          startPt = { x: srcPos.x, y: srcCy + sOffY };
          startStub = { x: srcPos.x - 20, y: srcCy + sOffY };
          endPt = { x: tgtPos.x + tgtPos.w, y: tgtCy + tOffY };
          endStub = { x: tgtPos.x + tgtPos.w + 20, y: tgtCy + tOffY };
        }
      }

      const skipIds = new Set<string>();
      const addParentChain = (nodeId: string) => {
        skipIds.add(nodeId);
        let cur = parentChain.get(nodeId);
        while (cur) {
          skipIds.add(cur);
          cur = parentChain.get(cur);
        }
      };
      addParentChain(srcId);
      addParentChain(tgtId);

      // Filter obstacles: treat all non-ancestor nodes (both leaf and container) as solid obstacles
      const activeObstacles = allObstacles.filter((o) => !skipIds.has(o.id));

      let mappedBends: { x: number; y: number }[];
      try {
        const astarResult = routeAStar(startStub, endStub, activeObstacles, 20);
        mappedBends = astarResult.points.map((p) => ({
          x: p.x,
          y: p.y,
        }));
      } catch (err) {
        console.warn(
          `[ADAC Routing] A* routing failed for edge ${origEdge.id}:`,
          err
        );
        const midY = (startStub.y + endStub.y) / 2;
        mappedBends = [
          { x: startStub.x, y: midY },
          { x: endStub.x, y: midY },
        ];
      }

      routedEdges.push({
        id: origEdge.id,
        sources: [srcId],
        targets: [tgtId],
        labels: origEdge.labels,
        sections: [
          {
            id: `global-s${origEdge.id}`,
            startPoint: startPt,
            endPoint: endPt,
            bendPoints: mappedBends,
          },
        ],
      });
    });

    // Attach routed edges at the root level
    layout.edges = routedEdges;
  } else {
    const elk = new ELK();
    layout = (await elk.layout(graph)) as ElkNode;
  }

  const padding = 40;
  if (layout.children && layout.children.length > 0) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    layout.children.forEach((child) => {
      const cx = child.x || 0,
        cy = child.y || 0,
        cw = child.width || 0,
        ch = child.height || 0;
      minX = Math.min(minX, cx);
      minY = Math.min(minY, cy);
      maxX = Math.max(maxX, cx + cw);
      maxY = Math.max(maxY, cy + ch);
    });

    // Also include edge coordinates in bounds calculation
    // so that routed edges are never clipped
    if (layout.edges) {
      layout.edges.forEach((e) => {
        e.sections?.forEach((s) => {
          [s.startPoint, s.endPoint, ...(s.bendPoints || [])].forEach((pt) => {
            minX = Math.min(minX, pt.x);
            minY = Math.min(minY, pt.y);
            maxX = Math.max(maxX, pt.x);
            maxY = Math.max(maxY, pt.y);
          });
        });
      });
    }

    if (minX !== Infinity) {
      const shiftX = -minX + padding,
        shiftY = -minY + padding;
      layout.children.forEach((c) => {
        if (c.x !== undefined) c.x += shiftX;
        if (c.y !== undefined) c.y += shiftY;
      });

      // Shift edge coordinates by the same amount so they
      // stay aligned with the nodes after the viewBox adjustment
      if (layout.edges) {
        layout.edges.forEach((e) => {
          e.sections?.forEach((s) => {
            s.startPoint.x += shiftX;
            s.startPoint.y += shiftY;
            s.endPoint.x += shiftX;
            s.endPoint.y += shiftY;
            s.bendPoints?.forEach((b) => {
              b.x += shiftX;
              b.y += shiftY;
            });
          });
        });
      }

      layout.width = maxX - minX + 2 * padding;
      layout.height = maxY - minY + 2 * padding;
    }
  }

  const width = layout.width || 800;
  const height = layout.height || 600;

  let iconDataUriMap: Map<string, string>;

  if (iconResolver) {
    const uniqueIconPaths = getUniqueIconPaths(graph);
    iconDataUriMap = await buildIconDataUriMap(uniqueIconPaths, iconResolver);
  }

  const getIconDataUri = async (params: { path?: string }) => {
    try {
      if (!params.path) return null;
      if (iconResolver) return iconDataUriMap.get(params.path) || null;
      else {
        const fs = await getFs();
        if (!fs.existsSync(params.path)) return null;
        const data = fs.readFileSync(params.path);
        if (!data) return null;
        const b64 = data.toString('base64');
        const ext = params.path.split('.').pop()?.toLowerCase();
        let mime = 'image/svg+xml';
        if (ext === 'png') mime = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
        return `data:${mime};base64,${b64}`;
      }
    } catch (e) {
      console.warn(`Failed to read icon: ${params.path}`, e);
      return null;
    }
  };

  const nodeAbsPos = new Map<string, { x: number; y: number }>();
  const parentMap = new Map<string, string>();
  const nodesMap = new Map<string, ElkNode>();

  const mapNodePositions = (
    n: ElkNode,
    ox: number,
    oy: number,
    pid?: string
  ) => {
    const cx = ox + (n.x || 0),
      cy = oy + (n.y || 0);
    const nw = n.width || 0;
    const nh = n.height || 0;
    nodeAbsPos.set(n.id, { x: cx, y: cy });
    nodesMap.set(n.id, n);
    if (pid) parentMap.set(n.id, pid);
    if (pid) {
      const isContainer =
        n.properties?.type === 'container' ||
        Boolean(n.children && n.children.length > 0);
      allNodeBoxes.push({
        id: n.id,
        x: cx,
        y: cy,
        right: cx + nw,
        bottom: cy + nh,
        isContainer,
      });
    }
    if (n.children)
      n.children.forEach((c) => mapNodePositions(c, cx, cy, n.id));
  };
  mapNodePositions(layout, 0, 0);

  const allEdges: ElkEdge[] = [];
  const processedEdgeIds = new Set<string>();
  const processedLabelKeys = new Set<string>();
  const collectEdges = (n: ElkNode) => {
    if (n.edges) {
      n.edges.forEach((e) => {
        if (e.id && processedEdgeIds.has(e.id)) return;
        if (e.id) processedEdgeIds.add(e.id);

        let containerOffset = { x: 0, y: 0 };
        let currentContainerId = e.container || n.id;

        while (currentContainerId) {
          const pos = nodeAbsPos.get(currentContainerId);
          if (pos) {
            containerOffset = pos;
            break;
          }
          // Walk up using pre-computed parentMap
          currentContainerId = parentMap.get(currentContainerId) || '';
        }

        const ge: ElkEdge = JSON.parse(JSON.stringify(e));
        if (ge.sections) {
          ge.sections.forEach((s) => {
            s.startPoint.x += containerOffset.x;
            s.startPoint.y += containerOffset.y;
            s.endPoint.x += containerOffset.x;
            s.endPoint.y += containerOffset.y;
            s.bendPoints?.forEach((b) => {
              b.x += containerOffset.x;
              b.y += containerOffset.y;
            });
          });
        }
        allEdges.push(ge);
      });
    }
    n.children?.forEach(collectEdges);
  };
  collectEdges(layout);

  const rootCssProp = (layout.properties?.cssClass || '') as string;
  const defaultEdgeClass = rootCssProp.includes('gcp')
    ? 'gcp-edge'
    : rootCssProp.includes('azure')
      ? 'azure-edge'
      : 'aws-edge';

  const defaultArrow = rootCssProp.includes('gcp')
    ? 'url(#arrow-gcp)'
    : rootCssProp.includes('azure')
      ? 'url(#arrow-azure)'
      : 'url(#arrow)';

  const escapeXml = (s: string) =>
    s.replace(
      /[<>&'"]/g,
      (c) =>
        ({
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          "'": '&apos;',
          '"': '&quot;',
        })[c] || ''
    );

  const placedLabels: { l: number; r: number; t: number; b: number }[] = [];
  let edgePathsOutput = '';
  let edgeLabelsOutput = '';

  // Precompute all edge segment bounding boxes for fast collision detection
  const edgeSegmentsCache: {
    edgeId: string;
    sLeft: number;
    sRight: number;
    sTop: number;
    sBottom: number;
  }[] = [];
  allEdges.forEach((otherEdge) => {
    (otherEdge.sections || []).forEach((otherSec) => {
      const otherPts = [
        otherSec.startPoint,
        ...(otherSec.bendPoints || []),
        otherSec.endPoint,
      ];
      for (let j = 0; j < otherPts.length - 1; j++) {
        const p1 = otherPts[j];
        const p2 = otherPts[j + 1];
        edgeSegmentsCache.push({
          edgeId: otherEdge.id,
          sLeft: Math.min(p1.x, p2.x),
          sRight: Math.max(p1.x, p2.x),
          sTop: Math.min(p1.y, p2.y),
          sBottom: Math.max(p1.y, p2.y),
        });
      }
    });
  });

  allEdges.forEach((e) => {
    (e.sections || []).forEach((s) => {
      const pts = [s.startPoint, ...(s.bendPoints || []), s.endPoint];
      let d = `M ${pts[0].x} ${pts[0].y}`;
      const R = 12; // Corner radius

      for (let i = 1; i < pts.length - 1; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const p2 = pts[i + 1];

        const dx1 = p1.x - p0.x;
        const dy1 = p1.y - p0.y;
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

        const dx2 = p2.x - p1.x;
        const dy2 = p2.y - p1.y;
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        const r = Math.min(R, len1 / 2, len2 / 2);

        const cross = (dx1 / len1) * (dy2 / len2) - (dy1 / len1) * (dx2 / len2);

        if (r > 1 && Math.abs(cross) > 0.001) {
          const startX = p1.x - (dx1 / len1) * r;
          const startY = p1.y - (dy1 / len1) * r;
          d += ` L ${startX} ${startY}`;

          const endX = p1.x + (dx2 / len2) * r;
          const endY = p1.y + (dy2 / len2) * r;

          const sweep = cross > 0 ? 1 : 0;

          d += ` A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`;
        } else {
          d += ` L ${p1.x} ${p1.y}`;
        }
      }
      const last = pts[pts.length - 1];
      d += ` L ${last.x} ${last.y}`;

      let edgeClass = '';
      let tNode: ElkNode | undefined | null = null;
      if (e.targets && e.targets.length > 0) {
        let currTarget = e.targets[0];
        while (currTarget) {
          tNode = nodesMap.get(currTarget);
          if (tNode?.properties?.type === 'container') {
            const cCls = tNode.properties.cssClass;
            if (typeof cCls === 'string' && cCls) {
              const classToken = cCls.split(/\s+/).find(Boolean);
              if (classToken) {
                edgeClass = `dynamic-edge ${classToken}-edge`;
              }
            }
            break;
          }
          if (tNode) break; // Found the leaf target
          currTarget = parentMap.get(currTarget) || '';
        }
      }

      const finalClass = edgeClass
        ? `${edgeClass} ${defaultEdgeClass}`
        : defaultEdgeClass;
      edgePathsOutput += `<path d="${d}" class="${finalClass}" marker-end="${defaultArrow}"/>`;

      // Add edge label if available
      const edgeLabel = e.labels?.[0]?.text;
      if (edgeLabel) {
        let maxLen = -1;
        let longestSegStart = s.startPoint;
        let longestSegEnd = s.endPoint;

        let isVertical = false;

        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const len = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
          if (len > maxLen) {
            maxLen = len;
            longestSegStart = p1;
            longestSegEnd = p2;
            isVertical = Math.abs(p1.y - p2.y) > Math.abs(p1.x - p2.x);
          }
        }

        const labelX =
          (longestSegStart.x + longestSegEnd.x) / 2 + (isVertical ? 6 : 0);
        const labelY =
          (longestSegStart.y + longestSegEnd.y) / 2 - (isVertical ? 0 : 6);

        let placed = false;
        let finalX = labelX,
          finalY = labelY;
        const textLen = edgeLabel.length * 6.5;
        const textW = isVertical ? 14 : textLen + 4;
        const textH = isVertical ? textLen + 4 : 14;

        const offsets = isVertical
          ? [
              { x: 0, y: 0 },
              { x: 16, y: 0 },
              { x: -16, y: 0 },
              { x: 32, y: 0 },
              { x: -32, y: 0 },
              { x: 0, y: textLen / 2 + 10 },
              { x: 0, y: -(textLen / 2 + 10) },
              { x: 48, y: 0 },
              { x: -48, y: 0 },
            ]
          : [
              { x: 0, y: 0 },
              { x: 0, y: 16 },
              { x: 0, y: -16 },
              { x: 0, y: 32 },
              { x: 0, y: -32 },
              { x: textLen / 2 + 10, y: 0 },
              { x: -(textLen / 2 + 10), y: 0 },
              { x: 0, y: 48 },
              { x: 0, y: -48 },
            ];

        for (const off of offsets) {
          const cx = labelX + off.x;
          const cy = labelY + off.y;

          const tLeft = cx - textW / 2;
          const tRight = cx + textW / 2;
          const tTop = cy - textH / 2;
          const tBottom = cy + textH / 2;

          const overlapsLabel = placedLabels.some((lb) => {
            return (
              tLeft <= lb.r && tRight >= lb.l && tTop <= lb.b && tBottom >= lb.t
            );
          });

          const overlapsNode = allNodeBoxes.some((b) => {
            if (b.isContainer) {
              // Check title banner + bottom/left/right borders
              const onTitle =
                tBottom > b.y &&
                tTop < b.y + 44 &&
                tRight > b.x &&
                tLeft < b.right;
              const onBottom =
                tBottom > b.bottom - 14 &&
                tTop < b.bottom &&
                tRight > b.x &&
                tLeft < b.right;
              const onLeft =
                tRight > b.x - 14 &&
                tLeft < b.x &&
                tBottom > b.y &&
                tTop < b.bottom;
              const onRight =
                tRight > b.right &&
                tLeft < b.right + 14 &&
                tBottom > b.y &&
                tTop < b.bottom;
              return onTitle || onBottom || onLeft || onRight;
            }

            // Solid block for leaf nodes
            return (
              tBottom > b.y &&
              tTop < b.bottom &&
              tRight > b.x &&
              tLeft < b.right
            );
          });

          const overlapsOtherEdge = edgeSegmentsCache.some((seg) => {
            if (seg.edgeId === e.id) return false;
            return (
              tLeft <= seg.sRight &&
              tRight >= seg.sLeft &&
              tTop <= seg.sBottom &&
              tBottom >= seg.sTop
            );
          });

          if (!overlapsLabel && !overlapsNode && !overlapsOtherEdge) {
            finalX = cx;
            finalY = cy;
            placed = true;
            break;
          }
        }

        if (!placed) {
          finalX = labelX;
          finalY = labelY + (isVertical ? 0 : 16);
        }

        const labelKey = `${finalX.toFixed(1)},${finalY.toFixed(1)},${edgeLabel}`;
        if (!processedLabelKeys.has(labelKey)) {
          processedLabelKeys.add(labelKey);
          placedLabels.push({
            l: finalX - textW / 2,
            r: finalX + textW / 2,
            t: finalY - textH / 2,
            b: finalY + textH / 2,
          });
          const transformAttr = isVertical
            ? ` transform="rotate(90 ${finalX} ${finalY})"`
            : '';
          edgeLabelsOutput += `<text x="${finalX}" y="${finalY}" class="edge-label" text-anchor="middle"${transformAttr}>${escapeXml(edgeLabel)}</text>`;
        }
      }
    });
  });

  const resolveNodeCost = (id: string): number | undefined => {
    if (!perServiceCosts) return undefined;
    return perServiceCosts[id];
  };

  const renderNode = async (
    node: ElkNode,
    offsetX = 0,
    offsetY = 0
  ): Promise<string> => {
    const nx = node.x || 0,
      ny = node.y || 0,
      nw = node.width || 0,
      nh = node.height || 0;

    const absX = nx + offsetX;
    const absY = ny + offsetY;

    const props = node.properties || {};
    const label = node.labels?.[0]?.text || '';
    const nodeId = node.id || '';
    const cost = resolveNodeCost(nodeId);
    const costLabel =
      cost !== undefined ? `💰 ${cost.toFixed(2)}/${period}` : '';

    const isLayoutContainer =
      props.type === 'container' &&
      /vpc|az|region|zone|subnet/.test(props.cssClass || '');

    const tooltips: string[] = [];
    if (!isLayoutContainer) {
      const comp = complianceTooltipMap?.[nodeId];
      if (comp) {
        if (comp.violations.length > 0) {
          tooltips.push(
            `⚠ Compliance Violations (${comp.frameworks.join(', ')}):`
          );
          comp.violations.forEach((v) => tooltips.push(`  • ${v}`));
        } else {
          tooltips.push(`✅ Compliant with: ${comp.frameworks.join(', ')}`);
        }
      }

      const opt = optimizationTooltipMap?.[nodeId];
      if (opt?.recommendations.length) {
        if (tooltips.length) tooltips.push('');
        tooltips.push(`💡 Optimization Suggestions:`);
        opt.recommendations.forEach((r) => tooltips.push(`  • ${r}`));
      }

      if (costLabel) {
        if (tooltips.length) tooltips.push('');
        tooltips.push(costLabel);
      }
    }

    let output = `<g id="node-${nodeId}">`;
    if (tooltips.length) {
      const tooltipText = tooltips.map(escapeXml).join('\n');
      output += `<title>${tooltipText}</title>`;
    }

    if (props.type === 'container') {
      // Determine provider from cssClass
      const css = (props.cssClass || '') as string;
      const isGcpCont = css.includes('gcp');
      const isAzureCont = css.includes('azure');

      const labelCls = isAzureCont
        ? 'azure-container-label'
        : isGcpCont
          ? 'gcp-container-label'
          : 'aws-container-label';

      let rectClass = isGcpCont
        ? 'gcp-container'
        : isAzureCont
          ? 'azure-container'
          : 'aws-container';
      if (props.cssClass) rectClass += ` ${props.cssClass}`;
      // Note: complianceClass isn't defined here but exists in user logic,
      // I'll check if I need to calculate it. For now following prompt.
      // (Checking original code... it wasn't there but I'll add the hook)
      const comp = complianceTooltipMap?.[nodeId];
      const complianceClass = comp
        ? comp.violations.length > 0
          ? 'compliance-fail'
          : 'compliance-ok'
        : '';
      if (complianceClass) rectClass += ` ${complianceClass}`;

      const r = 14; // corner radius — consistent across all containers

      // 1. Container background + border
      output += `<rect x="${absX}" y="${absY}"
        width="${nw}" height="${nh}"
        class="${rectClass}"
        rx="${r}" ry="${r}"/>`;

      // 2. Label pill — standalone overlapping pill at the top-left
      const pillH = 28;
      const pillR = 14;

      const { displayLabel, actualLabelW } = calculateLabelDimensions(
        label,
        nw
      );

      output += `<rect x="${absX + 16}" y="${absY - pillR}"
        width="${actualLabelW}" height="${pillH}"
        rx="${pillR}" ry="${pillR}"
        class="${rectClass} title-pill"/>`;

      output += `<text
        x="${absX + 16 + actualLabelW / 2}" y="${absY - pillR + pillH / 2}"
        class="${labelCls}"
        text-anchor="middle"
        dominant-baseline="middle">${escapeXml(displayLabel)}</text>`;

      // 4. Provider icon (top-right corner, 20×20)
      if (props.iconPath) {
        const iconUri = await getIconDataUri({ path: props.iconPath });
        if (iconUri) {
          output += `<image
            href="${iconUri}"
            x="${absX + nw - 28}" y="${absY + 6}"
            width="20" height="20"
            preserveAspectRatio="xMidYMid meet"/>`;
        }
      }
    } else {
      const comp = complianceTooltipMap?.[nodeId];
      const complianceClass = comp
        ? comp.violations.length > 0
          ? 'compliance-fail'
          : 'compliance-ok'
        : '';

      // ── Constants ──────────────────────────────────────
      const ICON_SIZE = 42; // icon image size in px
      const ICON_BG_PAD = 5; // padding around icon background
      const CARD_W = nw;
      const CARD_H = nh;

      // Icon centered horizontally
      const iconX = absX + Math.round((CARD_W - ICON_SIZE) / 2);
      // Icon top margin: 10px from top of card
      const iconY = absY + 10;
      // Label starts 8px below icon bottom
      const labelStartY = iconY + ICON_SIZE + 9;

      // Provider detection for label class
      const rootCss = (layout.properties?.cssClass || '') as string;
      const isGcpLeaf = rootCss.includes('gcp');
      const isAzureLeaf = rootCss.includes('azure');
      const nodeLabelCls = isAzureLeaf
        ? 'azure-node-label'
        : isGcpLeaf
          ? 'gcp-node-label'
          : 'aws-node-label';

      // Compliance + base class
      let cardClass = 'node-card';
      if (complianceClass) cardClass += ` ${complianceClass}`;

      // ── Card background ─────────────────────────────────
      if (props.isStacked) {
        output += `<rect x="${absX + 8}" y="${absY - 8}"
          width="${CARD_W}" height="${CARD_H}"
          class="${cardClass}"
          rx="10" ry="10" fill-opacity="0.4" stroke-opacity="0.4"/>`;
        output += `<rect x="${absX + 4}" y="${absY - 4}"
          width="${CARD_W}" height="${CARD_H}"
          class="${cardClass}"
          rx="10" ry="10" fill-opacity="0.7" stroke-opacity="0.7"/>`;
      }

      output += `<rect x="${absX}" y="${absY}"
        width="${CARD_W}" height="${CARD_H}"
        class="${cardClass}"
        rx="10" ry="10"/>`;

      // ── Icon ─────────────────────────────────────────────
      const iconUri = await getIconDataUri({ path: props.iconPath });

      if (iconUri) {
        // Icon background pill
        output += `<rect
          x="${iconX - ICON_BG_PAD}"
          y="${iconY - ICON_BG_PAD}"
          width="${ICON_SIZE + ICON_BG_PAD * 2}"
          height="${ICON_SIZE + ICON_BG_PAD * 2}"
          rx="8" ry="8"
          class="node-icon-bg"/>`;
        output += `<image
          href="${iconUri}"
          x="${iconX}" y="${iconY}"
          width="${ICON_SIZE}" height="${ICON_SIZE}"
          preserveAspectRatio="xMidYMid meet"/>`;
      } else {
        // Fallback placeholder when no icon
        output += `<rect
          x="${iconX}" y="${iconY}"
          width="${ICON_SIZE}" height="${ICON_SIZE}"
          rx="8" ry="8"
          fill="#EDF2F7" stroke="#CBD5E1"
          stroke-width="1"/>`;
        // Placeholder "?" text
        output += `<text
          x="${iconX + ICON_SIZE / 2}"
          y="${iconY + ICON_SIZE / 2 + 1}"
          class="${nodeLabelCls}"
          text-anchor="middle"
          dominant-baseline="middle"
          fill="#94A3B8"
          font-size="16" font-weight="300">?</text>`;
      }

      // ── Cost badge (bottom-right, only if cost exists) ──
      if (cost !== undefined) {
        const badgeTxt = `$${cost.toFixed(2)}`;
        const badgeW = badgeTxt.length * 5.5 + 8;
        const badgeH = 14;
        const badgeX = absX + CARD_W - badgeW - 4;
        const badgeY = absY + CARD_H - badgeH - 4;
        output += `<rect
          x="${badgeX}" y="${badgeY}"
          width="${badgeW}" height="${badgeH}"
          rx="3" ry="3"
          fill="#1E293B"/>`;
        output += `<text
          x="${badgeX + badgeW / 2}"
          y="${badgeY + badgeH / 2 + 1}"
          class="cost-badge-text"
          text-anchor="middle"
          dominant-baseline="middle">${escapeXml(badgeTxt)}</text>`;
      }

      // ── Label (1 or 2 lines, centered) ──────────────────
      // Max label width = card width minus 6px padding each side
      const maxLabelChars = Math.floor((CARD_W - 12) / 6.0);

      // Word-wrap: try to split into max 2 lines at word boundary
      const words = label.split(' ');
      let line1 = label;
      let line2 = '';

      if (label.length > maxLabelChars && words.length > 1) {
        // Find split point that keeps both lines under maxLabelChars
        let bestSplit = Math.ceil(words.length / 2);
        for (let s = 1; s < words.length; s++) {
          const l1 = words.slice(0, s).join(' ');
          const l2 = words.slice(s).join(' ');
          if (l1.length <= maxLabelChars && l2.length <= maxLabelChars) {
            bestSplit = s;
            break;
          }
        }
        line1 = words.slice(0, bestSplit).join(' ');
        line2 = words.slice(bestSplit).join(' ');
      }

      // Truncate if still too long
      const truncate = (t: string) =>
        t.length > maxLabelChars + 2
          ? t.substring(0, maxLabelChars).trim() + '…'
          : t;

      const LINE_H = 13; // line height in px
      // If two lines, shift first line up by half LINE_H to center block
      const line1Y = line2
        ? labelStartY + Math.round(LINE_H / 2) - 2
        : labelStartY + 4;
      const line2Y = line1Y + LINE_H;

      output += `<text
        x="${absX + CARD_W / 2}" y="${line1Y}"
        class="${nodeLabelCls}"
        text-anchor="middle"
        dominant-baseline="auto">${escapeXml(truncate(line1))}</text>`;

      if (line2) {
        output += `<text
          x="${absX + CARD_W / 2}" y="${line2Y}"
          class="${nodeLabelCls}"
          text-anchor="middle"
          dominant-baseline="auto">${escapeXml(truncate(line2))}</text>`;
      }
    }
    for (const c of node.children ?? []) {
      output += await renderNode(c, absX, absY);
    }
    output += '</g>';
    return output;
  };

  const provider = getProvider(layout);
  const rootRect = `<rect width="${width}" height="${height}" class="${provider}-root" />
                    <rect width="${width}" height="${height}" fill="url(#dotGrid)" pointer-events="none" />`;

  const nodesOutput = (
    await Promise.all((layout.children ?? []).map((n) => renderNode(n)))
  ).join('');

  // ── Legend ──
  const renderLegend = () => {
    const LEGEND_W = 160;
    const LEGEND_H = 80;
    // Legend bounds check: push left if there's a container collision
    let LX = width - LEGEND_W - 20;
    let LY = height - LEGEND_H - 20;
    const legendOverlaps = (box: (typeof allNodeBoxes)[number]) =>
      LY < box.bottom &&
      LY + LEGEND_H > box.y &&
      LX < box.right &&
      LX + LEGEND_W > box.x;

    for (const box of allNodeBoxes) {
      if (legendOverlaps(box)) {
        LX = box.x - LEGEND_W - 20; // push outside container
      }
    }
    // Clamp legend to visible area — never render at negative coords
    if (LX < 20) LX = 20;
    // If clamped position still overlaps, try above the blocking box, then top-left.
    const blockingBox = allNodeBoxes.find((box) => legendOverlaps(box));
    if (blockingBox) {
      LY = Math.max(20, blockingBox.y - LEGEND_H - 20);
      if (allNodeBoxes.some((box) => legendOverlaps(box))) {
        LY = 20;
      }
    }
    const maxLegendY = Math.max(20, height - LEGEND_H - 20);
    const candidatePositions = [
      { x: LX, y: LY },
      { x: 20, y: LY },
      { x: width - LEGEND_W - 20, y: 20 },
      { x: 20, y: 20 },
    ];
    for (let y = 20; y <= maxLegendY; y += 20) {
      candidatePositions.push({ x: 20, y });
      candidatePositions.push({ x: width - LEGEND_W - 20, y });
    }
    const clearPosition = candidatePositions.find((candidate) => {
      LX = Math.max(20, Math.min(candidate.x, width - LEGEND_W - 20));
      LY = Math.max(20, Math.min(candidate.y, maxLegendY));
      return !allNodeBoxes.some((box) => legendOverlaps(box));
    });
    if (clearPosition) {
      LX = Math.max(20, Math.min(clearPosition.x, width - LEGEND_W - 20));
      LY = Math.max(20, Math.min(clearPosition.y, maxLegendY));
    }
    const edgeColor =
      provider === 'gcp'
        ? '#4285F4'
        : provider === 'azure'
          ? '#0078D4'
          : '#8FA3BF';
    const items = [
      { color: edgeColor, label: 'Relationship' },
      { color: '#16A34A', label: 'Compliant' },
      { color: '#DC2626', label: 'Non-Compliant' },
    ];
    let legendContent = `<rect x="${LX}" y="${LY}" width="${LEGEND_W}" height="${LEGEND_H}" class="legend-box" />`;
    legendContent += `<text x="${LX + 10}" y="${LY + 22}" class="legend-title">Legend</text>`;
    items.forEach((item, i) => {
      const iy = LY + 42 + i * 14;
      legendContent += `<line x1="${LX + 10}" y1="${iy}" x2="${LX + 30}" y2="${iy}" stroke="${item.color}" stroke-width="2" />`;
      legendContent += `<text x="${LX + 35}" y="${iy + 4}" class="legend-item-text">${item.label}</text>`;
    });
    return `<g id="legend">${legendContent}</g>`;
  };
  const legendOutput = renderLegend();

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto; max-width: 100%; background-color: #EEF2F7;">
  <defs>
    <style>${CSS_STYLES}</style>

    <!-- Dotted Grid Pattern -->
    <pattern id="dotGrid" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.5" fill="#CBD5E1" opacity="0.6"/>
    </pattern>

    <!-- Container drop shadow: soft, barely visible -->
    <filter id="containerShadow"
      x="-8%" y="-8%" width="116%" height="116%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
      <feOffset dx="0" dy="2" result="blur"/>
      <feFlood flood-color="#000000" flood-opacity="0.06"/>
      <feComposite in2="blur" operator="in" result="shadow"/>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Node card shadow: tight, crisp -->
    <filter id="nodeShadow"
      x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
      <feOffset dx="0" dy="1" result="blur"/>
      <feFlood flood-color="#000000" flood-opacity="0.08"/>
      <feComposite in2="blur" operator="in" result="shadow"/>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Compliance OK: green ring glow -->
    <filter id="glowGreen"
      x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feFlood flood-color="#16A34A" flood-opacity="0.4"
        result="color"/>
      <feComposite in="color" in2="blur" operator="in"
        result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Compliance FAIL: red ring glow -->
    <filter id="glowRed"
      x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feFlood flood-color="#DC2626" flood-opacity="0.4"
        result="color"/>
      <feComposite in="color" in2="blur" operator="in"
        result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Arrow markers: one per provider -->
    <marker id="arrow" viewBox="0 0 10 10"
      refX="9" refY="5"
      markerWidth="5" markerHeight="5"
      orient="auto-start-reverse">
      <path d="M0,1.5 L8.5,5 L0,8.5 Z"
        fill="#8FA3BF" stroke="none"/>
    </marker>
    <marker id="arrow-gcp" viewBox="0 0 10 10"
      refX="9" refY="5"
      markerWidth="5" markerHeight="5"
      orient="auto-start-reverse">
      <path d="M0,1.5 L8.5,5 L0,8.5 Z"
        fill="#4285F4" stroke="none" fill-opacity="0.85"/>
    </marker>
    <marker id="arrow-azure" viewBox="0 0 10 10"
      refX="9" refY="5"
      markerWidth="5" markerHeight="5"
      orient="auto-start-reverse">
      <path d="M0,1.5 L8.5,5 L0,8.5 Z"
        fill="#0078D4" stroke="none" fill-opacity="0.85"/>
    </marker>
  </defs>
  ${rootRect}${nodesOutput}${edgePathsOutput}${edgeLabelsOutput}${legendOutput}
</svg>`;
}
