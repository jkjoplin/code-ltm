import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

export function useVersionHistory(learningId: string, limit?: number) {
  return useQuery({
    queryKey: ["versions", learningId, limit],
    queryFn: () => api.getVersionHistory(learningId, limit),
    enabled: !!learningId,
  });
}

export function useVersion(learningId: string, version: number) {
  return useQuery({
    queryKey: ["version", learningId, version],
    queryFn: () => api.getVersion(learningId, version),
    enabled: !!learningId && version > 0,
  });
}

export function useRollback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      learningId,
      version,
      changedBy,
    }: {
      learningId: string;
      version: number;
      changedBy?: string;
    }) => api.rollbackToVersion(learningId, version, changedBy),
    onSuccess: (data) => {
      // Invalidate learning and versions queries
      queryClient.invalidateQueries({ queryKey: ["learning", data.id] });
      queryClient.invalidateQueries({ queryKey: ["versions", data.id] });
      queryClient.invalidateQueries({ queryKey: ["learnings"] });
    },
  });
}
