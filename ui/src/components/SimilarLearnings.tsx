import { Link } from "react-router-dom";
import { useSimilarLearnings } from "../hooks/useSimilarity";

interface SimilarLearningsProps {
  learningId: string;
  threshold?: number;
}

const TYPE_COLORS: Record<string, string> = {
  rule: "bg-amber-100 text-amber-800",
  pattern: "bg-purple-100 text-purple-800",
  gotcha: "bg-red-100 text-red-800",
  tip: "bg-green-100 text-green-800",
  documentation: "bg-blue-100 text-blue-800",
  investigation: "bg-yellow-100 text-yellow-800",
  suggestion: "bg-teal-100 text-teal-800",
};

export default function SimilarLearnings({
  learningId,
  threshold = 0.6,
}: SimilarLearningsProps) {
  const { data, isLoading, error } = useSimilarLearnings(learningId, threshold);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-3"></div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Silently fail for similar learnings
  }

  if (!data?.similar.length) {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-3">
        Similar Learnings
      </h3>
      <div className="space-y-2">
        {data.similar.map((item) => (
          <Link
            key={item.id}
            to={`/learning/${item.id}`}
            className="block border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    TYPE_COLORS[item.type]
                  }`}
                >
                  {item.type}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {item.title}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {Math.round(item.similarity * 100)}% match
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
