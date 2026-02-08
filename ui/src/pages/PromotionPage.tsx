import { useState } from "react";
import { Link } from "react-router-dom";
import { usePromotionCandidates, usePromote } from "../hooks/usePromotion";
import PromotionDialog from "../components/PromotionDialog";
import type { Scope, PromotionCandidate } from "../api/client";

const TYPE_COLORS: Record<string, string> = {
  rule: "bg-amber-100 text-amber-800",
  pattern: "bg-purple-100 text-purple-800",
  gotcha: "bg-red-100 text-red-800",
  tip: "bg-green-100 text-green-800",
  documentation: "bg-blue-100 text-blue-800",
  investigation: "bg-yellow-100 text-yellow-800",
  suggestion: "bg-teal-100 text-teal-800",
};

const SCOPES: Array<{ value: Scope; label: string }> = [
  { value: "project", label: "Project" },
  { value: "cross-project", label: "Cross-project" },
];

export default function PromotionPage() {
  const [fromScope, setFromScope] = useState<Scope>("project");
  const [promotingCandidate, setPromotingCandidate] = useState<{
    candidate: PromotionCandidate;
    toScope: Scope;
  } | null>(null);

  const { data, isLoading, error } = usePromotionCandidates(fromScope);
  const promoteMutation = usePromote();

  const handlePromote = async () => {
    if (!promotingCandidate) return;

    try {
      await promoteMutation.mutateAsync({
        learningId: promotingCandidate.candidate.id,
        toScope: promotingCandidate.toScope,
      });
      setPromotingCandidate(null);
    } catch (err) {
      console.error("Promotion failed:", err);
    }
  };

  const getPromotionTargets = (scope: Scope): Scope[] => {
    if (scope === "project") return ["cross-project", "global"];
    if (scope === "cross-project") return ["global"];
    return [];
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Knowledge Promotion
          </h1>
          <p className="text-gray-500 mt-1">
            Promote learnings to broader scopes to share knowledge across
            projects.
          </p>
        </div>
      </div>

      {/* Scope selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Show candidates from scope:
        </label>
        <div className="flex gap-2">
          {SCOPES.map((scope) => (
            <button
              key={scope.value}
              onClick={() => setFromScope(scope.value)}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                fromScope === scope.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {scope.label}
            </button>
          ))}
        </div>
      </div>

      {/* Candidates list */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      ) : error ? (
        <div className="text-red-600">Error loading candidates: {error.message}</div>
      ) : !data?.candidates.length ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            No learnings found with "{fromScope}" scope.
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Create some project-scoped learnings first, then promote them here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.candidates.map((candidate) => (
            <div
              key={candidate.id}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${
                        TYPE_COLORS[candidate.type]
                      }`}
                    >
                      {candidate.type}
                    </span>
                    <Link
                      to={`/learning/${candidate.id}`}
                      className="text-lg font-medium text-gray-900 hover:text-blue-600"
                    >
                      {candidate.title}
                    </Link>
                  </div>
                  {candidate.project_path && (
                    <div className="mt-1 text-sm text-gray-500">
                      Project:{" "}
                      <code className="bg-gray-100 px-1 rounded">
                        {candidate.project_path}
                      </code>
                    </div>
                  )}
                  <div className="mt-1 text-sm text-gray-400">
                    Created: {new Date(candidate.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {getPromotionTargets(candidate.scope).map((target) => (
                    <button
                      key={target}
                      onClick={() =>
                        setPromotingCandidate({
                          candidate,
                          toScope: target,
                        })
                      }
                      className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100"
                    >
                      → {target === "global" ? "Global" : "Cross-project"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Promotion dialog */}
      {promotingCandidate && (
        <PromotionDialog
          title={promotingCandidate.candidate.title}
          fromScope={promotingCandidate.candidate.scope}
          toScope={promotingCandidate.toScope}
          onConfirm={handlePromote}
          onCancel={() => setPromotingCandidate(null)}
          isPromoting={promoteMutation.isPending}
        />
      )}
    </div>
  );
}
