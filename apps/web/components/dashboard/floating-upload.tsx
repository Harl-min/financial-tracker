"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle2, XCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUploadStatement, useStatementStatus } from "@/hooks/use-upload-statement";

const ACCEPTED = {
  "text/csv": [".csv"],
  "application/pdf": [".pdf"],
};

export function FloatingUploadWidget() {
  const [open, setOpen] = useState(false);
  const [activeStatementId, setActiveStatementId] = useState<string | null>(null);
  const upload = useUploadStatement();
  const { data: activeStatement } = useStatementStatus(activeStatementId);
  const queryClient = useQueryClient();

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      upload.mutate(file, {
        onSuccess: (statement) => {
          setActiveStatementId(statement.id);
        },
      });
    },
    [upload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: 1,
    maxSize: 15 * 1024 * 1024,
  });

  // When parsing finishes, refresh anything depending on transactions/analysis.
  useEffect(() => {
    if (activeStatement?.status === "PARSED" || activeStatement?.status === "FAILED") {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analysis"] });
    }
  }, [activeStatement?.status, queryClient]);

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {open ? (
        <Card className="w-[360px] shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Upload statement</CardTitle>
              <CardDescription>CSV or PDF, up to 15MB</CardDescription>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-accent" aria-label="Close upload panel">
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              {...getRootProps()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">
                {isDragActive ? "Drop it here" : "Drag & drop, or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground">We'll auto-sort transactions and analyze your spending</p>
            </div>

            {upload.isPending && (
              <StatusRow icon={<Loader2 className="h-4 w-4 animate-spin" />} label="Uploading…" />
            )}
            {upload.isError && (
              <StatusRow
                icon={<XCircle className="h-4 w-4 text-destructive" />}
                label={upload.error instanceof Error ? upload.error.message : "Upload failed"}
              />
            )}

            {activeStatement && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{activeStatement.fileName}</span>
                  </div>
                  <StatusBadge status={activeStatement.status} />
                </div>
                {activeStatement.status === "PARSED" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Imported {activeStatement.transactionCount} transactions and categorized your spending.
                  </p>
                )}
                {activeStatement.status === "FAILED" && (
                  <p className="mt-2 text-xs text-destructive">{activeStatement.errorMessage}</p>
                )}
                {(activeStatement.status === "UPLOADED" || activeStatement.status === "PARSING") && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reading transactions and categorizing spending in the background…
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Button size="icon" className="h-14 w-14 rounded-full shadow-lg" onClick={() => setOpen(true)} aria-label="Upload bank statement">
          <Upload className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}

function StatusRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "PARSED":
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3 w-3" /> Done
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Processing
        </Badge>
      );
  }
}
