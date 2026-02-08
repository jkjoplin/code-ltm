import { useState } from "react";
import { useStats } from "../hooks/useLearnings";
import { api, type Learning } from "../api/client";

function labelize(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function SettingsPage() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors?: Array<{ id: string; error: string }>;
  } | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await api.exportLearnings();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `code-ltm-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Support both { learnings: [...] } and direct array
      const learnings: Learning[] = Array.isArray(data)
        ? data
        : data.learnings || [];

      if (learnings.length === 0) {
        throw new Error("No learnings found in file");
      }

      const result = await api.importLearnings({ learnings });
      setImportResult(result);
    } catch (err) {
      console.error("Import failed:", err);
      alert(`Import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setImporting(false);
      // Reset file input
      e.target.value = "";
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h1>

      {/* Database Stats */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Database Statistics</h2>
        {statsLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
          </div>
        ) : stats ? (
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Total Learnings</dt>
              <dd className="text-2xl font-semibold text-gray-900">{stats.total}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">With Embeddings</dt>
              <dd className="text-2xl font-semibold text-gray-900">
                {stats.embedded}
                {stats.total > 0 && (
                  <span className="text-sm text-gray-500 ml-2">
                    ({Math.round((stats.embedded / stats.total) * 100)}%)
                  </span>
                )}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-sm text-gray-500">Semantic Search</dt>
              <dd className="text-lg">
                {stats.semantic_available ? (
                  <span className="text-green-600 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Available
                  </span>
                ) : (
                  <span className="text-gray-500 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Not configured (set OPENAI_API_KEY or VOYAGEAI_API_KEY)
                  </span>
                )}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      {(stats?.byType || stats?.byScope) && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Distribution</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">By Type</h3>
              {stats?.byType && Object.keys(stats.byType).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(stats.byType)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => (
                      <div
                        key={type}
                        className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
                      >
                        <span className="text-gray-700">{labelize(type)}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No type data available.</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">By Scope</h3>
              {stats?.byScope && Object.keys(stats.byScope).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(stats.byScope)
                    .sort((a, b) => b[1] - a[1])
                    .map(([scope, count]) => (
                      <div
                        key={scope}
                        className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
                      >
                        <span className="text-gray-700">{labelize(scope)}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No scope data available.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Export */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Export Data</h2>
        <p className="text-sm text-gray-600 mb-4">
          Download all your learnings as a JSON file for backup or migration.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting ? "Exporting..." : "Export to JSON"}
        </button>
      </section>

      {/* Import */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Import Data</h2>
        <p className="text-sm text-gray-600 mb-4">
          Import learnings from a JSON file. Existing learnings with the same ID will be
          skipped.
        </p>
        <label className="inline-block">
          <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
            {importing ? "Importing..." : "Choose JSON File"}
          </span>
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
          />
        </label>

        {importResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900">Import Complete</h3>
            <ul className="mt-2 text-sm text-gray-600 space-y-1">
              <li>Imported: {importResult.imported}</li>
              <li>Skipped (already exist): {importResult.skipped}</li>
              {importResult.errors && importResult.errors.length > 0 && (
                <li className="text-red-600">Errors: {importResult.errors.length}</li>
              )}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
