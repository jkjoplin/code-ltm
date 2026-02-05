import { Link } from "react-router-dom";
import { useConnectedGraph } from "../hooks/useGraph";
import RelationshipGraph from "./RelationshipGraph";

interface MiniGraphProps {
  learningId: string;
  depth?: number;
}

export default function MiniGraph({ learningId, depth = 1 }: MiniGraphProps) {
  const { data, isLoading, error } = useConnectedGraph(learningId, depth);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  // Only show if there are connections
  if (data.nodes.length <= 1 || data.edges.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-900">Related Learnings</h3>
        <Link
          to={`/graph/${learningId}`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View full graph
        </Link>
      </div>
      <RelationshipGraph
        data={data}
        width={320}
        height={200}
        highlightedNodeId={learningId}
      />
      <div className="mt-2 text-xs text-gray-500">
        {data.nodes.length} learnings, {data.edges.length} connections
      </div>
    </div>
  );
}
