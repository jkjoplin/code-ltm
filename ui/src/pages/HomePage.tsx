import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import FilterPanel from "../components/FilterPanel";
import LearningList from "../components/LearningList";
import LearningForm from "../components/LearningForm";
import { useLearnings, useTags, useProjects, useCreateLearning, useStats } from "../hooks/useLearnings";
import { useSearch } from "../hooks/useSearch";
import type { Scope, LearningType, SearchMode, CreateLearningInput } from "../api/client";

export default function HomePage() {
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("hybrid");
  const [semanticWeight, setSemanticWeight] = useState(0.5);

  // Filter state
  const [scope, setScope] = useState<Scope | undefined>();
  const [types, setTypes] = useState<LearningType[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [project, setProject] = useState<string | undefined>();

  // Pagination
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Modal state
  const [showAddForm, setShowAddForm] = useState(false);

  // Queries
  const { data: statsData } = useStats();
  const { data: tagsData } = useTags();
  const { data: projectsData } = useProjects();
  const createMutation = useCreateLearning();

  // Get learnings - either from search or list
  const isSearching = searchQuery.trim().length > 0;

  const listQuery = useLearnings({
    scope,
    type: types.length === 1 ? types[0] : undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    project_path: project,
    limit,
    offset,
  });

  const searchQuery2 = useSearch(
    isSearching
      ? {
          query: searchQuery,
          scope,
          type: types.length === 1 ? types[0] : undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          project_path: project,
          limit,
          mode: searchMode,
          semantic_weight: semanticWeight,
        }
      : null
  );

  const learnings = isSearching
    ? searchQuery2.data?.learnings ?? []
    : listQuery.data?.learnings ?? [];

  const isLoading = isSearching ? searchQuery2.isLoading : listQuery.isLoading;
  const error = isSearching ? searchQuery2.error : listQuery.error;

  const handleSearch = useCallback(
    (query: string, mode: SearchMode, weight: number) => {
      setSearchQuery(query);
      setSearchMode(mode);
      setSemanticWeight(weight);
      setOffset(0); // Reset pagination on new search
    },
    []
  );

  const handleCreate = async (data: CreateLearningInput) => {
    const learning = await createMutation.mutateAsync(data);
    setShowAddForm(false);
    navigate(`/learning/${learning.id}`);
  };

  return (
    <div>
      {/* Header with search and add button */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 w-full sm:w-auto">
            <SearchBar
              onSearch={handleSearch}
              initialQuery={searchQuery}
              initialMode={searchMode}
              initialWeight={semanticWeight}
              semanticAvailable={statsData?.semantic_available}
            />
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Learning
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar with filters */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <FilterPanel
            scope={scope}
            onScopeChange={(s) => {
              setScope(s);
              setOffset(0);
            }}
            types={types}
            onTypesChange={(t) => {
              setTypes(t);
              setOffset(0);
            }}
            tags={selectedTags}
            onTagsChange={(t) => {
              setSelectedTags(t);
              setOffset(0);
            }}
            availableTags={tagsData ?? []}
            project={project}
            onProjectChange={(p) => {
              setProject(p);
              setOffset(0);
            }}
            availableProjects={projectsData ?? []}
          />
        </aside>

        {/* Learning list */}
        <main className="flex-1 min-w-0">
          <LearningList
            learnings={learnings}
            isLoading={isLoading}
            error={error instanceof Error ? error : null}
            offset={offset}
            limit={limit}
            onOffsetChange={setOffset}
          />
        </main>
      </div>

      {/* Add Learning Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-50 rounded-lg w-full max-w-3xl my-8">
            <LearningForm
              onSubmit={handleCreate}
              onCancel={() => setShowAddForm(false)}
              isSubmitting={createMutation.isPending}
            />
          </div>
        </div>
      )}
    </div>
  );
}
