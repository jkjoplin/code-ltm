import { useQuery } from "@tanstack/react-query";
import { api, type Scope, type LearningType } from "../api/client";

export function useFullGraph(options?: {
  scope?: Scope;
  type?: LearningType;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["graph", "full", options],
    queryFn: () => api.getGraph(options),
  });
}

export function useConnectedGraph(learningId: string, depth?: number) {
  return useQuery({
    queryKey: ["graph", "connected", learningId, depth],
    queryFn: () => api.getConnectedGraph(learningId, depth),
    enabled: !!learningId,
  });
}
