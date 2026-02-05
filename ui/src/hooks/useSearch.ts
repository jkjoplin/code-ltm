import { useQuery } from "@tanstack/react-query";
import { api, type SearchParams } from "../api/client";

export function useSearch(params: SearchParams | null) {
  return useQuery({
    queryKey: ["search", params],
    queryFn: () => api.searchLearnings(params!),
    enabled: !!params?.query,
  });
}
