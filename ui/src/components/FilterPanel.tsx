import type { Scope, LearningType } from "../api/client";

interface FilterPanelProps {
  scope: Scope | undefined;
  onScopeChange: (scope: Scope | undefined) => void;
  types: LearningType[];
  onTypesChange: (types: LearningType[]) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[];
}

const SCOPES: Array<{ value: Scope | undefined; label: string }> = [
  { value: undefined, label: "All" },
  { value: "global", label: "Global" },
  { value: "cross-project", label: "Cross-project" },
  { value: "project", label: "Project" },
];

const TYPES: Array<{ value: LearningType; label: string }> = [
  { value: "pattern", label: "Pattern" },
  { value: "gotcha", label: "Gotcha" },
  { value: "tip", label: "Tip" },
  { value: "documentation", label: "Documentation" },
  { value: "investigation", label: "Investigation" },
];

export default function FilterPanel({
  scope,
  onScopeChange,
  types,
  onTypesChange,
  tags,
  onTagsChange,
  availableTags,
}: FilterPanelProps) {
  const toggleType = (type: LearningType) => {
    if (types.includes(type)) {
      onTypesChange(types.filter((t) => t !== type));
    } else {
      onTypesChange([...types, type]);
    }
  };

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      onTagsChange(tags.filter((t) => t !== tag));
    } else {
      onTagsChange([...tags, tag]);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-6">
      {/* Scope Filter */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">Scope</h3>
        <div className="space-y-2">
          {SCOPES.map(({ value, label }) => (
            <label key={label} className="flex items-center">
              <input
                type="radio"
                name="scope"
                checked={scope === value}
                onChange={() => onScopeChange(value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Type Filter */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">Type</h3>
        <div className="space-y-2">
          {TYPES.map(({ value, label }) => (
            <label key={value} className="flex items-center">
              <input
                type="checkbox"
                checked={types.includes(value)}
                onChange={() => toggleType(value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Tags Filter */}
      {availableTags.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {availableTags.slice(0, 20).map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                  tags.includes(tag)
                    ? "bg-blue-100 border-blue-300 text-blue-800"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {tag}
              </button>
            ))}
            {availableTags.length > 20 && (
              <span className="text-xs text-gray-400">
                +{availableTags.length - 20} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Clear Filters */}
      {(scope || types.length > 0 || tags.length > 0) && (
        <button
          onClick={() => {
            onScopeChange(undefined);
            onTypesChange([]);
            onTagsChange([]);
          }}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
