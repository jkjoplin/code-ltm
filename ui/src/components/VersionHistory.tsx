import { useState } from "react";
import { useVersionHistory, useRollback } from "../hooks/useVersions";
import type { LearningVersion } from "../api/client";

interface VersionHistoryProps {
  learningId: string;
  currentVersion: number;
}

const CHANGE_TYPE_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
};

export default function VersionHistory({
  learningId,
  currentVersion,
}: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<LearningVersion | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const { data, isLoading, error } = useVersionHistory(learningId);
  const rollbackMutation = useRollback();

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600">
        Error loading version history: {error.message}
      </div>
    );
  }

  if (!data?.versions.length) {
    return (
      <div className="text-gray-500 text-sm">No version history available.</div>
    );
  }

  const handleRollback = async () => {
    if (!selectedVersion) return;

    try {
      await rollbackMutation.mutateAsync({
        learningId,
        version: selectedVersion.version,
      });
      setShowRollbackConfirm(false);
      setSelectedVersion(null);
    } catch (err) {
      console.error("Rollback failed:", err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Version History ({data.count} versions)
        </h3>
      </div>

      <div className="space-y-3">
        {data.versions.map((version) => (
          <div
            key={version.id}
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedVersion?.id === version.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
            onClick={() =>
              setSelectedVersion(selectedVersion?.id === version.id ? null : version)
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900">v{version.version}</span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    CHANGE_TYPE_COLORS[version.change_type]
                  }`}
                >
                  {version.change_type}
                </span>
                {version.version === currentVersion && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                    current
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {new Date(version.changed_at).toLocaleString()}
              </div>
            </div>

            <div className="mt-2 text-sm text-gray-600">
              <span className="font-medium">{version.title}</span>
              <span className="ml-2 text-gray-400">by {version.changed_by}</span>
            </div>

            {/* Expanded details */}
            {selectedVersion?.id === version.id && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-500">Type:</span>{" "}
                    <span className="font-medium">{version.type}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Scope:</span>{" "}
                    <span className="font-medium">{version.scope}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Confidence:</span>{" "}
                    <span className="font-medium">{version.confidence}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Tags:</span>{" "}
                    <span className="font-medium">
                      {version.tags.length > 0 ? version.tags.join(", ") : "None"}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-gray-500 text-sm mb-1">Content preview:</div>
                  <div className="bg-gray-100 rounded p-2 text-sm text-gray-700 max-h-32 overflow-y-auto">
                    {version.content.slice(0, 500)}
                    {version.content.length > 500 && "..."}
                  </div>
                </div>

                {version.version !== currentVersion && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRollbackConfirm(true);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Rollback to this version
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rollback confirmation modal */}
      {showRollbackConfirm && selectedVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900">
              Rollback to Version {selectedVersion.version}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              This will restore the learning to the state it was in at version{" "}
              {selectedVersion.version}. The current state will be saved as a new version
              before the rollback.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowRollbackConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                disabled={rollbackMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {rollbackMutation.isPending ? "Rolling back..." : "Rollback"}
              </button>
            </div>
            {rollbackMutation.isError && (
              <p className="mt-2 text-sm text-red-600">
                Error: {rollbackMutation.error?.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
