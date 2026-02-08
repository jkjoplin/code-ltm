import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RunAutonomyInput } from "../api/client";

export function useAutonomyRuns(limit = 50) {
  return useQuery({
    queryKey: ["autonomyRuns", limit],
    queryFn: () => api.getAutonomyRuns(limit),
    refetchInterval: 30_000,
  });
}

export function useRunAutonomyCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RunAutonomyInput) => api.runAutonomyCycle(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autonomyRuns"] });
      queryClient.invalidateQueries({ queryKey: ["learnings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
