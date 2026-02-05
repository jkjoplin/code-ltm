import { useState, useEffect, useCallback } from "react";
import type {
  Learning,
  CreateLearningInput,
  UpdateLearningInput,
  LearningType,
  Scope,
  Confidence,
  FileRef,
  SimilarLearning,
} from "../api/client";
import { useCheckSimilarity } from "../hooks/useSimilarity";
import DuplicateWarning from "./DuplicateWarning";

interface LearningFormCreateProps {
  learning?: undefined;
  onSubmit: (data: CreateLearningInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

interface LearningFormEditProps {
  learning: Learning;
  onSubmit: (data: UpdateLearningInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

type LearningFormProps = LearningFormCreateProps | LearningFormEditProps;

const TYPES: LearningType[] = ["gotcha", "pattern", "investigation", "documentation", "tip"];
const SCOPES: Scope[] = ["global", "cross-project", "project"];
const CONFIDENCES: Confidence[] = ["low", "medium", "high"];

export default function LearningForm({
  learning,
  onSubmit,
  onCancel,
  isSubmitting,
}: LearningFormProps) {
  const [title, setTitle] = useState(learning?.title ?? "");
  const [content, setContent] = useState(learning?.content ?? "");
  const [type, setType] = useState<LearningType>(learning?.type ?? "tip");
  const [scope, setScope] = useState<Scope>(learning?.scope ?? "global");
  const [projectPath, setProjectPath] = useState(learning?.project_path ?? "");
  const [tags, setTags] = useState(learning?.tags.join(", ") ?? "");
  const [confidence, setConfidence] = useState<Confidence>(learning?.confidence ?? "medium");
  const [fileRefs, setFileRefs] = useState<FileRef[]>(learning?.file_references ?? []);
  const [newRefPath, setNewRefPath] = useState("");
  const [similarLearnings, setSimilarLearnings] = useState<SimilarLearning[]>([]);
  const [checkDebounceTimer, setCheckDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const isEditing = !!learning;
  const checkSimilarityMutation = useCheckSimilarity();

  // Reset form when learning changes
  useEffect(() => {
    if (learning) {
      setTitle(learning.title);
      setContent(learning.content);
      setType(learning.type);
      setScope(learning.scope);
      setProjectPath(learning.project_path ?? "");
      setTags(learning.tags.join(", "));
      setConfidence(learning.confidence);
      setFileRefs(learning.file_references);
    }
  }, [learning]);

  // Check for similar learnings (debounced) when creating new
  const checkForSimilar = useCallback(async () => {
    if (isEditing || !title.trim() || !content.trim()) {
      setSimilarLearnings([]);
      return;
    }

    try {
      const result = await checkSimilarityMutation.mutateAsync({
        title,
        content,
        threshold: 0.6,
      });
      setSimilarLearnings(result.similar);
    } catch {
      // Silently fail - similarity check is optional
    }
  }, [title, content, isEditing, checkSimilarityMutation]);

  const handleContentBlur = () => {
    if (checkDebounceTimer) {
      clearTimeout(checkDebounceTimer);
    }
    const timer = setTimeout(checkForSimilar, 500);
    setCheckDebounceTimer(timer);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (checkDebounceTimer) {
        clearTimeout(checkDebounceTimer);
      }
    };
  }, [checkDebounceTimer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (learning) {
      // Editing an existing learning
      const data: UpdateLearningInput = {
        title,
        content,
        type,
        scope,
        project_path: scope === "project" ? projectPath : undefined,
        tags: parsedTags,
        confidence,
        file_references: fileRefs,
      };
      (onSubmit as (data: UpdateLearningInput) => void)(data);
    } else {
      // Creating a new learning
      const data: CreateLearningInput = {
        title,
        content,
        type,
        scope,
        project_path: scope === "project" ? projectPath : undefined,
        tags: parsedTags,
        confidence,
        file_references: fileRefs,
        created_by: "web-ui",
      };
      (onSubmit as (data: CreateLearningInput) => void)(data);
    }
  };

  const addFileRef = () => {
    if (newRefPath.trim()) {
      setFileRefs([...fileRefs, { path: newRefPath.trim() }]);
      setNewRefPath("");
    }
  };

  const removeFileRef = (index: number) => {
    setFileRefs(fileRefs.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        {isEditing ? "Edit Learning" : "Add New Learning"}
      </h2>

      <div className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Brief, descriptive title"
          />
        </div>

        {/* Content */}
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
            Content * (Markdown supported)
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleContentBlur}
            required
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="Detailed content of the learning..."
          />
        </div>

        {/* Duplicate Warning */}
        {!isEditing && (similarLearnings.length > 0 || checkSimilarityMutation.isPending) && (
          <DuplicateWarning
            similar={similarLearnings}
            isLoading={checkSimilarityMutation.isPending}
          />
        )}

        {/* Type and Scope */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Type *
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as LearningType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="scope" className="block text-sm font-medium text-gray-700 mb-1">
              Scope *
            </label>
            <select
              id="scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1).replace("-", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="confidence" className="block text-sm font-medium text-gray-700 mb-1">
              Confidence *
            </label>
            <select
              id="confidence"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as Confidence)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CONFIDENCES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Project Path (conditional) */}
        {scope === "project" && (
          <div>
            <label
              htmlFor="projectPath"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Project Path *
            </label>
            <input
              id="projectPath"
              type="text"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              required={scope === "project"}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="/path/to/project"
            />
          </div>
        )}

        {/* Tags */}
        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
            Tags (comma-separated)
          </label>
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="react, hooks, performance"
          />
        </div>

        {/* File References */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            File References
          </label>
          <div className="space-y-2">
            {fileRefs.map((ref, index) => (
              <div key={index} className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm">{ref.path}</code>
                <button
                  type="button"
                  onClick={() => removeFileRef(index)}
                  className="p-2 text-red-600 hover:text-red-800"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newRefPath}
                onChange={(e) => setNewRefPath(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="path/to/file.ts"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFileRef();
                  }
                }}
              />
              <button
                type="button"
                onClick={addFileRef}
                className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !title.trim() || !content.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Learning"}
        </button>
      </div>
    </form>
  );
}
