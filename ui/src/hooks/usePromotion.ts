import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Scope } from "../api/client";

export function usePromotionCandidates(fromScope: Scope, limit?: number) {
  return useQuery({
    queryKey: ["promotionCandidates", fromScope, limit],
    queryFn: () => api.getPromotionCandidates(fromScope, limit),
    enabled: !!fromScope,
  });
}

export function usePromote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      learningId,
      toScope,
      promotedBy,
    }: {
      learningId: string;
      toScope: Scope;
      promotedBy?: string;
    }) => api.promoteLearning(learningId, toScope, promotedBy),
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["learning", data.id] });
      queryClient.invalidateQueries({ queryKey: ["learnings"] });
      queryClient.invalidateQueries({ queryKey: ["promotionCandidates"] });
      queryClient.invalidateQueries({ queryKey: ["versions", data.id] });
    },
  });
}
