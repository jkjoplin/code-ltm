import { Link } from "react-router-dom";
import type { SimilarLearning } from "../api/client";

interface DuplicateWarningProps {
  similar: SimilarLearning[];
  isLoading?: boolean;
}

export default function DuplicateWarning({
  similar,
  isLoading,
}: DuplicateWarningProps) {
  if (isLoading) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-yellow-600 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm text-yellow-700">
            Checking for similar learnings...
          </span>
        </div>
      </div>
    );
  }

  if (!similar.length) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-yellow-800">
            Potential duplicates found
          </h4>
          <p className="text-sm text-yellow-700 mt-1">
            The following learnings have similar content. Consider updating an
            existing learning instead of creating a new one.
          </p>
          <ul className="mt-3 space-y-2">
            {similar.map((item) => (
              <li key={item.id} className="flex items-center justify-between">
                <Link
                  to={`/learning/${item.id}`}
                  target="_blank"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {item.title}
                </Link>
                <span className="text-xs text-yellow-600 ml-2">
                  {Math.round(item.similarity * 100)}% similar
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
