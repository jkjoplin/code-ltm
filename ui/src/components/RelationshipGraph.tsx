import { useCallback, useRef, useEffect } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { useNavigate } from "react-router-dom";
import type { RelationshipGraph as GraphData, LearningType, Scope } from "../api/client";

interface RelationshipGraphProps {
  data: GraphData;
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  highlightedNodeId?: string;
}

const TYPE_COLORS: Record<LearningType, string> = {
  pattern: "#9333ea", // purple
  gotcha: "#dc2626", // red
  tip: "#16a34a", // green
  documentation: "#2563eb", // blue
  investigation: "#ca8a04", // yellow
};

const SCOPE_SIZES: Record<Scope, number> = {
  project: 4,
  "cross-project": 6,
  global: 8,
};

interface GraphNode {
  id: string;
  title: string;
  type: LearningType;
  scope: Scope;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

export default function RelationshipGraph({
  data,
  width = 600,
  height = 400,
  onNodeClick,
  highlightedNodeId,
}: RelationshipGraphProps) {
  const navigate = useNavigate();
  const graphRef = useRef<ForceGraphMethods | null>(null);

  // Transform data for the graph library
  const graphData = {
    nodes: data.nodes as GraphNode[],
    links: data.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
    })),
  };

  const handleNodeClick = useCallback(
    (node: unknown) => {
      const graphNode = node as GraphNode;
      if (onNodeClick) {
        onNodeClick(graphNode.id);
      } else {
        navigate(`/learning/${graphNode.id}`);
      }
    },
    [onNodeClick, navigate]
  );

  // Center on highlighted node
  useEffect(() => {
    if (highlightedNodeId && graphRef.current) {
      const node = data.nodes.find((n) => n.id === highlightedNodeId);
      if (node) {
        graphRef.current.centerAt(0, 0, 500);
        graphRef.current.zoom(1.5, 500);
      }
    }
  }, [highlightedNodeId, data.nodes]);

  const nodeCanvasObject = useCallback(
    (node: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as GraphNode;
      const size = SCOPE_SIZES[graphNode.scope];
      const color = TYPE_COLORS[graphNode.type];
      const isHighlighted = graphNode.id === highlightedNodeId;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(graphNode.x || 0, graphNode.y || 0, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw highlight ring
      if (isHighlighted) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // Draw label if zoomed in enough
      if (globalScale > 0.8) {
        const label = graphNode.title.length > 20 ? graphNode.title.slice(0, 20) + "..." : graphNode.title;
        const fontSize = 12 / globalScale;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#333";
        ctx.fillText(label, graphNode.x || 0, (graphNode.y || 0) + size + fontSize);
      }
    },
    [highlightedNodeId]
  );

  const nodePointerAreaPaint = useCallback(
    (node: unknown, color: string, ctx: CanvasRenderingContext2D) => {
      const graphNode = node as GraphNode;
      const size = SCOPE_SIZES[graphNode.scope];
      ctx.beginPath();
      ctx.arc(graphNode.x || 0, graphNode.y || 0, size + 2, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  if (data.nodes.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
        style={{ width, height }}
      >
        <p className="text-gray-500">No relationships to display</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
      <ForceGraph2D<GraphNode, GraphLink>
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkColor={() => "#ddd"}
        linkWidth={1}
        onNodeClick={handleNodeClick}
        cooldownTicks={50}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />
    </div>
  );
}
