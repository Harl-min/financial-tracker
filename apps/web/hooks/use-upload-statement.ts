import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, BankStatement } from "@/lib/api-client";

export function useUploadStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post<BankStatement>("/statements/upload", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statements"] });
    },
  });
}

/** Polls a single statement while it's still being parsed in the background by Inngest. */
export function useStatementStatus(statementId: string | null) {
  return useQuery({
    queryKey: ["statements", statementId],
    queryFn: () => api.get<BankStatement>(`/statements/${statementId}`),
    enabled: !!statementId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PARSED" || status === "FAILED" ? false : 2000;
    },
  });
}

export function useStatements() {
  return useQuery({
    queryKey: ["statements"],
    queryFn: () => api.get<BankStatement[]>("/statements"),
  });
}
