"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "ai/react";
import { MessageCircle, Send, Sparkles, X, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "How much did I spend this month?",
  "What am I spending the most on?",
  "Show my top merchants",
  "Any recent statement uploads?",
];

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: "/api/chat",
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <Card className="flex h-[560px] w-[380px] flex-col overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="font-semibold">Finance Assistant</span>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/10" aria-label="Close chat">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Ask me about your spending, income, categories, or recent statements — I can pull real numbers
                  from your account.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => append({ role: "user", content: s })}
                      className="rounded-full border px-3 py-1.5 text-xs hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((m) => (
                <ChatBubble key={m.id} role={m.role} content={m.content} toolInvocations={(m as any).toolInvocations} />
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t p-3">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about your spending…"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      )}

      <Button
        size="icon"
        onClick={() => setOpen((o) => !o)}
        className="h-14 w-14 rounded-full shadow-lg"
        aria-label="Toggle finance assistant"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
    </div>
  );
}

function ChatBubble({
  role,
  content,
  toolInvocations,
}: {
  role: string;
  content: string;
  toolInvocations?: { toolName: string; state: string }[];
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex items-start gap-2", isUser && "flex-row-reverse")}>
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-secondary"}>
          {isUser ? "You" : "AI"}
        </AvatarFallback>
      </Avatar>
      <div className={cn("max-w-[80%] space-y-1", isUser && "items-end")}>
        {toolInvocations
          ?.filter((t) => t.state !== "result")
          .map((t, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
              <Wrench className="h-3 w-3" /> Checking {formatToolName(t.toolName)}…
            </div>
          ))}
        {content && (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
              isUser ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            {content}
          </div>
        )}
      </div>
    </div>
  );
}

function formatToolName(name: string) {
  return name.replace(/([A-Z])/g, " $1").toLowerCase().trim();
}
