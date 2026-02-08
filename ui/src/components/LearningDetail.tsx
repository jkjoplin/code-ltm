import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Learning, Scope } from "../api/client";
import VersionHistory from "./VersionHistory";
import SimilarLearnings from "./SimilarLearnings";
import PromoteButton from "./PromoteButton";
import PromotionDialog from "./PromotionDialog";
import MiniGraph from "./MiniGraph";
import FeedbackButtons from "./FeedbackButtons";
import { useVersionHistory } from "../hooks/useVersions";
import { usePromote } from "../hooks/usePromotion";

interface LearningDetailProps {
  learning: Learning;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

type Tab = "content" | "history";

const TYPE_COLORS: Record<string, string> = {
  rule: "bg-amber-100 text-amber-800",
  pattern: "bg-purple-100 text-purple-800",
  gotcha: "bg-red-100 text-red-800",
  tip: "bg-green-100 text-green-800",
  documentation: "bg-blue-100 text-blue-800",
  investigation: "bg-yellow-100 text-yellow-800",
  suggestion: "bg-teal-100 text-teal-800",
};

const SCOPE_COLORS: Record<string, string> = {
  global: "bg-gray-100 text-gray-800",
  "cross-project": "bg-indigo-100 text-indigo-800",
  project: "bg-orange-100 text-orange-800",
};

export default function LearningDetail({
  learning,
  onEdit,
  onDelete,
  isDeleting,
}: LearningDetailProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("content");
  const [promotionTarget, setPromotionTarget] = useState<Scope | null>(null);

  const { data: versionsData } = useVersionHistory(learning.id);
  const promoteMutation = usePromote();

  const handlePromote = async () => {
    if (!promotionTarget) return;
    try {
      await promoteMutation.mutateAsync({
        learningId: learning.id,
        toScope: promotionTarget,
      });
      setPromotionTarget(null);
    } catch (err) {
      console.error("Promotion failed:", err);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{learning.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span
                className={`px-2 py-1 text-sm font-medium rounded ${TYPE_COLORS[learning.type]}`}
              >
                {learning.type}
              </span>
              <span
                className={`px-2 py-1 text-sm font-medium rounded ${SCOPE_COLORS[learning.scope]}`}
              >
                {learning.scope}
              </span>
              <span className="text-sm text-gray-500">
                Confidence: {learning.confidence}
              </span>
              <span className="text-sm text-gray-500">v{learning.version}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <PromoteButton
              currentScope={learning.scope}
              onPromote={(toScope) => setPromotionTarget(toScope)}
              isPromoting={promoteMutation.isPending}
            />
            <button
              onClick={onEdit}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-sm text-gray-600">
            Feedback improves ranking for future agent recalls.
          </span>
          <FeedbackButtons learningId={learning.id} />
        </div>

        {/* Tags */}
        {learning.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {learning.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Project path */}
        {learning.project_path && (
          <div className="mt-4 text-sm text-gray-500">
            Project: <code className="bg-gray-100 px-1 rounded">{learning.project_path}</code>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mt-6 border-t border-gray-200 -mx-6 px-6 pt-4">
          <button
            onClick={() => setActiveTab("content")}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              activeTab === "content"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            Content
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${
              activeTab === "history"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            History
            {versionsData && versionsData.count > 0 && (
              <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {versionsData.count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "content" ? (
        <>
          {/* Content */}
          <div className="p-6">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{learning.content}</ReactMarkdown>
            </div>
          </div>

          {/* File References */}
          {learning.file_references.length > 0 && (
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900 mb-4">File References</h2>
              <div className="space-y-4">
                {learning.file_references.map((ref, index) => (
                  <div key={index} className="bg-white rounded border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2 bg-gray-100 text-sm font-mono text-gray-700 flex justify-between">
                      <span>{ref.path}</span>
                      {ref.line_start && (
                        <span className="text-gray-500">
                          {ref.line_end && ref.line_end !== ref.line_start
                            ? `Lines ${ref.line_start}-${ref.line_end}`
                            : `Line ${ref.line_start}`}
                        </span>
                      )}
                    </div>
                    {ref.snippet && (
                      <pre className="p-4 text-sm overflow-x-auto bg-gray-900 text-gray-100">
                        <code>{ref.snippet}</code>
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Learnings - now using MiniGraph */}
          <div className="p-6 border-t border-gray-200">
            <MiniGraph learningId={learning.id} />
          </div>

          {/* Similar Learnings */}
          <div className="p-6 border-t border-gray-200">
            <SimilarLearnings learningId={learning.id} threshold={0.6} />
          </div>
        </>
      ) : (
        /* History Tab */
        <div className="p-6">
          <VersionHistory learningId={learning.id} currentVersion={learning.version} />
        </div>
      )}

      {/* Metadata */}
      <div className="p-6 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <span>Created: {new Date(learning.created_at).toLocaleString()}</span>
          <span>Updated: {new Date(learning.updated_at).toLocaleString()}</span>
          <span>Created by: {learning.created_by}</span>
          <span className="font-mono text-xs">ID: {learning.id}</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900">Delete Learning</h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete "{learning.title}"? This action cannot be
              undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete();
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promotion Dialog */}
      {promotionTarget && (
        <PromotionDialog
          title={learning.title}
          fromScope={learning.scope}
          toScope={promotionTarget}
          onConfirm={handlePromote}
          onCancel={() => setPromotionTarget(null)}
          isPromoting={promoteMutation.isPending}
        />
      )}
    </div>
  );
}
