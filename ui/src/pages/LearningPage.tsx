import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import LearningDetail from "../components/LearningDetail";
import LearningForm from "../components/LearningForm";
import { useLearning, useUpdateLearning, useDeleteLearning } from "../hooks/useLearnings";
import type { UpdateLearningInput } from "../api/client";

export default function LearningPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);

  const { data: learning, isLoading, error } = useLearning(id);
  const updateMutation = useUpdateLearning(id!);
  const deleteMutation = useDeleteLearning();

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-lg font-medium text-red-900">Error loading learning</h2>
        <p className="mt-2 text-red-700">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <Link
          to="/"
          className="mt-4 inline-block px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800"
        >
          Back to learnings
        </Link>
      </div>
    );
  }

  if (!learning) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <h2 className="text-lg font-medium text-yellow-900">Learning not found</h2>
        <p className="mt-2 text-yellow-700">
          The learning you're looking for doesn't exist or has been deleted.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block px-4 py-2 text-sm font-medium text-yellow-600 hover:text-yellow-800"
        >
          Back to learnings
        </Link>
      </div>
    );
  }

  const handleUpdate = async (data: UpdateLearningInput) => {
    await updateMutation.mutateAsync(data);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(learning.id);
    navigate("/");
  };

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-4">
        <Link to="/" className="text-blue-600 hover:text-blue-800 text-sm">
          &larr; Back to learnings
        </Link>
      </nav>

      {isEditing ? (
        <LearningForm
          learning={learning}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
          isSubmitting={updateMutation.isPending}
        />
      ) : (
        <LearningDetail
          learning={learning}
          onEdit={() => setIsEditing(true)}
          onDelete={handleDelete}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
