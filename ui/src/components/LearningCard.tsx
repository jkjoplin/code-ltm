import { Link } from "react-router-dom";
import type { LearningSummary } from "../api/client";

interface LearningCardProps {
  learning: LearningSummary;
}

const TYPE_COLORS: Record<string, string> = {
  pattern: "bg-purple-100 text-purple-800",
  gotcha: "bg-red-100 text-red-800",
  tip: "bg-green-100 text-green-800",
  documentation: "bg-blue-100 text-blue-800",
  investigation: "bg-yellow-100 text-yellow-800",
};

const SCOPE_COLORS: Record<string, string> = {
  global: "bg-gray-100 text-gray-800",
  "cross-project": "bg-indigo-100 text-indigo-800",
  project: "bg-orange-100 text-orange-800",
};

const CONFIDENCE_INDICATOR: Record<string, string> = {
  high: "bg-green-500",
  medium: "bg-yellow-500",
  low: "bg-red-500",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return date.toLocaleDateString();
}

export default function LearningCard({ learning }: LearningCardProps) {
  return (
    <Link
      to={`/learning/${learning.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{learning.title}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${TYPE_COLORS[learning.type]}`}
            >
              {learning.type}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${SCOPE_COLORS[learning.scope]}`}
            >
              {learning.scope}
            </span>
            {learning.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs text-gray-600 bg-gray-100 rounded"
              >
                {tag}
              </span>
            ))}
            {learning.tags.length > 3 && (
              <span className="text-xs text-gray-400">
                +{learning.tags.length - 3} more
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>{formatDate(learning.created_at)}</span>
            <span className="flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${CONFIDENCE_INDICATOR[learning.confidence]}`}
              />
              {learning.confidence} confidence
            </span>
            {learning.relevance_score !== undefined && (
              <span>Score: {learning.relevance_score.toFixed(2)}</span>
            )}
          </div>
        </div>
        <svg
          className="w-5 h-5 text-gray-400 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </Link>
  );
}
