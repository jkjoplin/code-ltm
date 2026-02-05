import { useState, useEffect } from "react";
import type { SearchMode } from "../api/client";

interface SearchBarProps {
  onSearch: (query: string, mode: SearchMode, semanticWeight: number) => void;
  initialQuery?: string;
  initialMode?: SearchMode;
  initialWeight?: number;
  semanticAvailable?: boolean;
}

export default function SearchBar({
  onSearch,
  initialQuery = "",
  initialMode = "hybrid",
  initialWeight = 0.5,
  semanticAvailable = false,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [semanticWeight, setSemanticWeight] = useState(initialWeight);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query, mode, semanticWeight);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, mode, semanticWeight, onSearch]);

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1 relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search learnings..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg
          className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <div className="flex gap-2 items-center">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as SearchMode)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="keyword">Keyword</option>
          <option value="hybrid" disabled={!semanticAvailable}>
            Hybrid {!semanticAvailable && "(unavailable)"}
          </option>
          <option value="semantic" disabled={!semanticAvailable}>
            Semantic {!semanticAvailable && "(unavailable)"}
          </option>
        </select>

        {mode === "hybrid" && semanticAvailable && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Weight:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={semanticWeight}
              onChange={(e) => setSemanticWeight(parseFloat(e.target.value))}
              className="w-20"
              title={`Semantic weight: ${semanticWeight}`}
            />
            <span className="text-sm text-gray-500 w-8">{semanticWeight}</span>
          </div>
        )}
      </div>
    </div>
  );
}
