import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFullGraph, useConnectedGraph } from "../hooks/useGraph";
import RelationshipGraph from "../components/RelationshipGraph";
import type { Scope, LearningType } from "../api/client";

const TYPES: Array<{ value: LearningType | "all"; label: string }> = [
  { value: "all", label: "All Types" },
  { value: "gotcha", label: "Gotcha" },
  { value: "pattern", label: "Pattern" },
  { value: "tip", label: "Tip" },
  { value: "documentation", label: "Documentation" },
  { value: "investigation", label: "Investigation" },
];

const SCOPES: Array<{ value: Scope | "all"; label: string }> = [
  { value: "all", label: "All Scopes" },
  { value: "global", label: "Global" },
  { value: "cross-project", label: "Cross-project" },
  { value: "project", label: "Project" },
];

export default function GraphPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<LearningType | "all">("all");
  const [scopeFilter, setScopeFilter] = useState<Scope | "all">("all");
  const [limit, setLimit] = useState(100);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Use connected graph if we have an ID, otherwise use full graph
  const fullGraphQuery = useFullGraph(
    id
      ? undefined
      : {
          scope: scopeFilter === "all" ? undefined : scopeFilter,
          type: typeFilter === "all" ? undefined : typeFilter,
          limit,
        }
  );
  const connectedGraphQuery = useConnectedGraph(id || "", 2);

  const query = id ? connectedGraphQuery : fullGraphQuery;
  const { data, isLoading, error } = query;

  // Handle window resize
  useEffect(() => {
    const updateDimensions = () => {
      const container = document.getElementById("graph-container");
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: Math.max(400, window.innerHeight - 300),
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const handleNodeClick = (nodeId: string) => {
    navigate(`/learning/${nodeId}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {id ? "Connected Learnings" : "Knowledge Graph"}
          </h1>
          <p className="text-gray-500 mt-1">
            {id
              ? "Explore learnings connected to a specific learning"
              : "Visualize relationships between learnings"}
          </p>
        </div>
        {id && (
          <button
            onClick={() => navigate("/graph")}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            View Full Graph
          </button>
        )}
      </div>

      {/* Filters (only for full graph) */}
      {!id && (
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as LearningType | "all")}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scope
            </label>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as Scope | "all")}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Nodes
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
      )}

      {/* Graph */}
      <div id="graph-container" className="w-full">
        {isLoading ? (
          <div
            className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
            style={{ height: dimensions.height }}
          >
            <div className="text-gray-500">Loading graph...</div>
          </div>
        ) : error ? (
          <div
            className="flex items-center justify-center bg-red-50 rounded-lg border border-red-200"
            style={{ height: dimensions.height }}
          >
            <div className="text-red-600">Error loading graph: {error.message}</div>
          </div>
        ) : data ? (
          <RelationshipGraph
            data={data}
            width={dimensions.width}
            height={dimensions.height}
            onNodeClick={handleNodeClick}
            highlightedNodeId={id}
          />
        ) : null}
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Legend</h3>
        <div className="flex flex-wrap gap-6">
          <div>
            <h4 className="text-xs text-gray-500 mb-2">Type (Color)</h4>
            <div className="flex flex-wrap gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-purple-600"></span>
                <span className="text-xs">Pattern</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-600"></span>
                <span className="text-xs">Gotcha</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-600"></span>
                <span className="text-xs">Tip</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                <span className="text-xs">Documentation</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-yellow-600"></span>
                <span className="text-xs">Investigation</span>
              </span>
            </div>
          </div>
          <div>
            <h4 className="text-xs text-gray-500 mb-2">Scope (Size)</h4>
            <div className="flex gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                <span className="text-xs">Project</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                <span className="text-xs">Cross-project</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-gray-500"></span>
                <span className="text-xs">Global</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="mt-4 text-sm text-gray-500">
          Showing {data.nodes.length} learnings with {data.edges.length} connections
        </div>
      )}
    </div>
  );
}
