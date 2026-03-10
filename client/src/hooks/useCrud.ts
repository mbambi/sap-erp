import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useState, useCallback } from "react";

interface UseCrudOptions {
  key: string;
  endpoint: string;
  defaultParams?: Record<string, string | number | undefined>;
}

export function useCrud<T = any>({ key, endpoint, defaultParams }: UseCrudOptions) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const params = { ...defaultParams, page, search, limit: 25, ...filters };

  const list = useQuery({
    queryKey: [key, params],
    queryFn: () => api.get(endpoint, params),
  });

  const get = (id: string) =>
    api.get(`${endpoint}/${id}`);

  const create = useMutation({
    mutationFn: (data: Partial<T>) => api.post(endpoint, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<T> }) =>
      api.put(`${endpoint}/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${endpoint}/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
  });

  const action = useMutation({
    mutationFn: ({ id, action: act, data }: { id: string; action: string; data?: any }) =>
      api.post(`${endpoint}/${id}/${act}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
  });

  const handleSearch = useCallback((q: string) => {
    setSearch(q);
    setPage(1);
  }, []);

  return {
    data: list.data?.data || list.data || [],
    pagination: list.data?.pagination,
    isLoading: list.isLoading,
    error: list.error,
    page,
    setPage,
    search,
    setSearch: handleSearch,
    filters,
    setFilters,
    get,
    create,
    update,
    remove,
    action,
    invalidate: () => queryClient.invalidateQueries({ queryKey: [key] }),
  };
}
