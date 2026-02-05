import { useState } from "react";
import type { Scope } from "../api/client";

interface PromoteButtonProps {
  currentScope: Scope;
  onPromote: (toScope: Scope) => void;
  isPromoting?: boolean;
}

const SCOPE_LABELS: Record<Scope, string> = {
  project: "Project",
  "cross-project": "Cross-project",
  global: "Global",
};

const VALID_PROMOTIONS: Record<Scope, Scope[]> = {
  project: ["cross-project", "global"],
  "cross-project": ["global"],
  global: [],
};

export default function PromoteButton({
  currentScope,
  onPromote,
  isPromoting,
}: PromoteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const validTargets = VALID_PROMOTIONS[currentScope];

  if (validTargets.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPromoting}
        className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50 flex items-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
        {isPromoting ? "Promoting..." : "Promote"}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              {validTargets.map((scope) => (
                <button
                  key={scope}
                  onClick={() => {
                    onPromote(scope);
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
                >
                  Promote to {SCOPE_LABELS[scope]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
