import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../api/client";

export function useSimilarLearnings(
  learningId: string,
  threshold?: number,
  limit?: number
) {
  return useQuery({
    queryKey: ["similar", learningId, threshold, limit],
    queryFn: () => api.getSimilarLearnings(learningId, threshold, limit),
    enabled: !!learningId,
  });
}

export function useCheckSimilarity() {
  return useMutation({
    mutationFn: ({
      title,
      content,
      threshold,
    }: {
      title: string;
      content: string;
      threshold?: number;
    }) => api.checkSimilarity(title, content, threshold),
  });
}
