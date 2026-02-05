import type { LearningSummary } from "../api/client";
import LearningCard from "./LearningCard";

interface LearningListProps {
  learnings: LearningSummary[];
  isLoading?: boolean;
  error?: Error | null;
  offset: number;
  limit: number;
  onOffsetChange: (offset: number) => void;
}

export default function LearningList({
  learnings,
  isLoading,
  error,
  offset,
  limit,
  onOffsetChange,
}: LearningListProps) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Error loading learnings: {error.message}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
            <div className="flex gap-2">
              <div className="h-5 bg-gray-200 rounded w-16" />
              <div className="h-5 bg-gray-200 rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (learnings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <p className="mt-2">No learnings found</p>
        <p className="text-sm">Try adjusting your filters or search query</p>
      </div>
    );
  }

  const currentPage = Math.floor(offset / limit) + 1;
  const hasMore = learnings.length === limit;

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500 mb-2">
        Showing {offset + 1} - {offset + learnings.length} learnings
      </div>

      <div className="space-y-3">
        {learnings.map((learning) => (
          <LearningCard key={learning.id} learning={learning} />
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
          disabled={offset === 0}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">Page {currentPage}</span>
        <button
          onClick={() => onOffsetChange(offset + limit)}
          disabled={!hasMore}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
