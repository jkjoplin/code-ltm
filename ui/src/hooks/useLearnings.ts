import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type ListParams,
  type CreateLearningInput,
  type UpdateLearningInput,
  type FeedbackOutcome,
  type FeedbackSource,
} from "../api/client";

export function useLearnings(params: ListParams) {
  return useQuery({
    queryKey: ["learnings", params],
    queryFn: () => api.listLearnings(params),
  });
}

export function useLearning(id: string | undefined) {
  return useQuery({
    queryKey: ["learning", id],
    queryFn: () => api.getLearning(id!),
    enabled: !!id,
  });
}

export function useCreateLearning() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLearningInput) => api.createLearning(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learnings"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useUpdateLearning(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateLearningInput) => api.updateLearning(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learnings"] });
      queryClient.invalidateQueries({ queryKey: ["learning", id] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useDeleteLearning() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteLearning(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learnings"] });
    },
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => api.getTags(),
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects(),
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => api.getStats(),
  });
}

export function useRecordFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      outcome,
      source,
      context,
    }: {
      id: string;
      outcome: FeedbackOutcome;
      source?: FeedbackSource;
      context?: string;
    }) => api.recordFeedback(id, outcome, source, context),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["learning", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["learnings"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
