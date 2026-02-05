import type { Scope } from "../api/client";

interface PromotionDialogProps {
  title: string;
  fromScope: Scope;
  toScope: Scope;
  onConfirm: () => void;
  onCancel: () => void;
  isPromoting?: boolean;
}

const SCOPE_LABELS: Record<Scope, string> = {
  project: "Project",
  "cross-project": "Cross-project",
  global: "Global",
};

const SCOPE_DESCRIPTIONS: Record<Scope, string> = {
  project: "Only visible in a specific project",
  "cross-project": "Visible across multiple projects",
  global: "Visible everywhere",
};

export default function PromotionDialog({
  title,
  fromScope,
  toScope,
  onConfirm,
  onCancel,
  isPromoting,
}: PromotionDialogProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-medium text-gray-900">Promote Learning</h3>
        <p className="mt-2 text-sm text-gray-500">
          You are about to promote "{title}" to a broader scope.
        </p>

        <div className="mt-4 flex items-center justify-center gap-4">
          {/* From scope */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
              <span className="text-2xl">
                {fromScope === "project" ? "📁" : "📂"}
              </span>
            </div>
            <div className="mt-2 text-sm font-medium text-gray-900">
              {SCOPE_LABELS[fromScope]}
            </div>
            <div className="text-xs text-gray-500">
              {SCOPE_DESCRIPTIONS[fromScope]}
            </div>
          </div>

          {/* Arrow */}
          <svg
            className="w-8 h-8 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>

          {/* To scope */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <span className="text-2xl">
                {toScope === "global" ? "🌍" : "📂"}
              </span>
            </div>
            <div className="mt-2 text-sm font-medium text-gray-900">
              {SCOPE_LABELS[toScope]}
            </div>
            <div className="text-xs text-gray-500">
              {SCOPE_DESCRIPTIONS[toScope]}
            </div>
          </div>
        </div>

        {fromScope === "project" && (
          <p className="mt-4 text-sm text-yellow-700 bg-yellow-50 p-3 rounded">
            Note: The project path will be removed when promoting to a broader
            scope.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPromoting}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {isPromoting ? "Promoting..." : "Confirm Promotion"}
          </button>
        </div>
      </div>
    </div>
  );
}
