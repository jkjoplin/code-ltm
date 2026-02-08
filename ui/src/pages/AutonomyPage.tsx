import { useMemo, useState } from "react";
import { useAutonomyRuns, useRunAutonomyCycle } from "../hooks/useAutonomy";
import type { RunAutonomyInput } from "../api/client";

const SOURCE_OPTIONS: Array<{ value: "git" | "tests" | "pr"; label: string }> = [
  { value: "git", label: "Git" },
  { value: "tests", label: "Tests" },
  { value: "pr", label: "PR Notes" },
];

function parseSources(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed) || parsed.length === 0) return "none";
    return parsed.join(", ");
  } catch {
    return raw || "none";
  }
}

function statusBadge(status: "success" | "partial" | "failed"): string {
  if (status === "success") return "bg-emerald-100 text-emerald-800";
  if (status === "partial") return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

export default function AutonomyPage() {
  const [projectPath, setProjectPath] = useState("");
  const [sources, setSources] = useState<Record<"git" | "tests" | "pr", boolean>>({
    git: true,
    tests: true,
    pr: false,
  });
  const [maintenance, setMaintenance] = useState(true);
  const [dryRun, setDryRun] = useState(true);

  const { data, isLoading, error, refetch, isFetching } = useAutonomyRuns();
  const runMutation = useRunAutonomyCycle();

  const selectedSources = useMemo(
    () =>
      SOURCE_OPTIONS.filter((option) => sources[option.value]).map(
        (option) => option.value
      ),
    [sources]
  );

  const handleRun = async () => {
    const payload: RunAutonomyInput = {
      project_path: projectPath.trim() || undefined,
      sources: selectedSources.length > 0 ? selectedSources : undefined,
      maintenance,
      dry_run: dryRun,
    };
    await runMutation.mutateAsync(payload);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Autonomy Control</h1>
        <p className="text-gray-500 mt-1">
          Run ingestion and maintenance cycles, and inspect recent autonomy audit runs.
        </p>
      </div>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Run Autonomy Cycle</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Path (optional)
            </label>
            <input
              type="text"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="/absolute/path/to/project"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">Sources</span>
            <div className="flex flex-wrap gap-3">
              {SOURCE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="inline-flex items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={sources[option.value]}
                    onChange={(e) =>
                      setSources((prev) => ({ ...prev, [option.value]: e.target.checked }))
                    }
                    className="rounded border-gray-300"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={maintenance}
                onChange={(e) => setMaintenance(e.target.checked)}
                className="rounded border-gray-300"
              />
              Include maintenance checks
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="rounded border-gray-300"
              />
              Dry run (no writes)
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRun}
              disabled={runMutation.isPending || selectedSources.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {runMutation.isPending ? "Running..." : "Run Cycle"}
            </button>
            {selectedSources.length === 0 && (
              <span className="text-sm text-amber-600">Select at least one source.</span>
            )}
          </div>
        </div>

        {runMutation.data && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-900">
                Last run: {runMutation.data.run_id}
              </span>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded ${statusBadge(runMutation.data.status)}`}
              >
                {runMutation.data.status}
              </span>
            </div>
            <p className="text-sm text-gray-700">
              Collected: {runMutation.data.collected_count} | Inserted:{" "}
              {runMutation.data.inserted_count} | Skipped: {runMutation.data.skipped_count}
            </p>
            {runMutation.data.notes.length > 0 && (
              <ul className="mt-2 text-sm text-gray-600 list-disc pl-5 space-y-1">
                {runMutation.data.notes.slice(0, 5).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Recent Runs</h2>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-60"
          >
            {isFetching ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-10 bg-gray-100 rounded" />
            <div className="h-10 bg-gray-100 rounded" />
            <div className="h-10 bg-gray-100 rounded" />
          </div>
        ) : error ? (
          <div className="text-sm text-rose-600">
            Failed to load runs: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : !data?.runs.length ? (
          <p className="text-sm text-gray-500">No autonomy runs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4 font-medium">Started</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Sources</th>
                  <th className="py-2 pr-4 font-medium">Mode</th>
                  <th className="py-2 pr-4 font-medium">Counts</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((run) => (
                  <tr key={run.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-4 text-gray-700">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${statusBadge(run.status)}`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {parseSources(run.sources_json)}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {run.dry_run ? "dry-run" : "write"}
                      {run.maintenance ? " + maintenance" : ""}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {run.collected_count}/{run.inserted_count}/{run.skipped_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-500">
              Count format: collected / inserted / skipped
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
