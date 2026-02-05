import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type ListParams,
  type CreateLearningInput,
  type UpdateLearningInput,
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

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => api.getStats(),
  });
}
