declare module "react-force-graph-2d" {
  import { MutableRefObject } from "react";

  export interface ForceGraphMethods<NodeType = unknown, LinkType = unknown> {
    centerAt: (x?: number, y?: number, transitionMs?: number) => ForceGraphMethods<NodeType, LinkType>;
    zoom: (scale?: number, transitionMs?: number) => ForceGraphMethods<NodeType, LinkType>;
    zoomToFit: (transitionMs?: number, padding?: number) => ForceGraphMethods<NodeType, LinkType>;
    pauseAnimation: () => ForceGraphMethods<NodeType, LinkType>;
    resumeAnimation: () => ForceGraphMethods<NodeType, LinkType>;
    d3Force: (forceName: string, force?: unknown) => unknown | ForceGraphMethods<NodeType, LinkType>;
    d3ReheatSimulation: () => ForceGraphMethods<NodeType, LinkType>;
    emitParticle: (link: LinkType) => ForceGraphMethods<NodeType, LinkType>;
    refresh: () => ForceGraphMethods<NodeType, LinkType>;
    getGraphBbox: () => { x: [number, number]; y: [number, number] };
  }

  export interface ForceGraphProps<NodeType = unknown, LinkType = unknown> {
    graphData: {
      nodes: NodeType[];
      links: LinkType[];
    };
    ref?: MutableRefObject<ForceGraphMethods | null>;
    width?: number;
    height?: number;
    backgroundColor?: string;
    nodeRelSize?: number;
    nodeId?: string;
    nodeLabel?: string | ((node: NodeType) => string);
    nodeVal?: number | ((node: NodeType) => number);
    nodeColor?: string | ((node: NodeType) => string);
    nodeAutoColorBy?: string | ((node: NodeType) => string);
    nodeCanvasObject?: (node: NodeType, ctx: CanvasRenderingContext2D, globalScale: number) => void;
    nodeCanvasObjectMode?: string | ((node: NodeType) => string);
    nodePointerAreaPaint?: (node: NodeType, color: string, ctx: CanvasRenderingContext2D) => void;
    linkSource?: string;
    linkTarget?: string;
    linkLabel?: string | ((link: LinkType) => string);
    linkVisibility?: boolean | ((link: LinkType) => boolean);
    linkColor?: string | ((link: LinkType) => string);
    linkAutoColorBy?: string | ((link: LinkType) => string);
    linkWidth?: number | ((link: LinkType) => number);
    linkCurvature?: number | ((link: LinkType) => number);
    linkDirectionalArrowLength?: number | ((link: LinkType) => number);
    linkDirectionalArrowColor?: string | ((link: LinkType) => string);
    linkDirectionalArrowRelPos?: number | ((link: LinkType) => number);
    linkDirectionalParticles?: number | ((link: LinkType) => number);
    linkDirectionalParticleSpeed?: number | ((link: LinkType) => number);
    linkDirectionalParticleWidth?: number | ((link: LinkType) => number);
    linkDirectionalParticleColor?: string | ((link: LinkType) => string);
    linkCanvasObject?: (link: LinkType, ctx: CanvasRenderingContext2D, globalScale: number) => void;
    linkCanvasObjectMode?: string | ((link: LinkType) => string);
    linkPointerAreaPaint?: (link: LinkType, color: string, ctx: CanvasRenderingContext2D) => void;
    dagMode?: string;
    dagLevelDistance?: number;
    dagNodeFilter?: (node: NodeType) => boolean;
    onDagError?: (loopNodeIds: string[]) => void;
    d3AlphaDecay?: number;
    d3VelocityDecay?: number;
    d3AlphaMin?: number;
    warmupTicks?: number;
    cooldownTicks?: number;
    cooldownTime?: number;
    onEngineTick?: () => void;
    onEngineStop?: () => void;
    onNodeClick?: (node: NodeType, event: MouseEvent) => void;
    onNodeRightClick?: (node: NodeType, event: MouseEvent) => void;
    onNodeHover?: (node: NodeType | null, prevNode: NodeType | null) => void;
    onNodeDrag?: (node: NodeType, translate: { x: number; y: number }) => void;
    onNodeDragEnd?: (node: NodeType, translate: { x: number; y: number }) => void;
    onLinkClick?: (link: LinkType, event: MouseEvent) => void;
    onLinkRightClick?: (link: LinkType, event: MouseEvent) => void;
    onLinkHover?: (link: LinkType | null, prevLink: LinkType | null) => void;
    onBackgroundClick?: (event: MouseEvent) => void;
    onBackgroundRightClick?: (event: MouseEvent) => void;
    onZoom?: (zoom: { k: number; x: number; y: number }) => void;
    onZoomEnd?: (zoom: { k: number; x: number; y: number }) => void;
    enableNodeDrag?: boolean;
    enableZoomInteraction?: boolean;
    enablePanInteraction?: boolean;
    enablePointerInteraction?: boolean;
  }

  function ForceGraph2D<NodeType = unknown, LinkType = unknown>(
    props: ForceGraphProps<NodeType, LinkType>
  ): JSX.Element;

  export default ForceGraph2D;
}
