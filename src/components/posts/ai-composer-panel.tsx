"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/ui/toast";
import { fetchAIStatus, generateAI, type AIStatusData } from "@/lib/ai/client";
import type { AIGenerateResult } from "@/lib/ai/client";

interface ComposerAIPanelProps {
  content: string;
  platform?: string;
  language?: "en" | "ar";
  onInsertText: (text: string) => void;
  onAppendHashtags: (tags: string[]) => void;
}

const COMposer_FEATURES = [
  { value: "captions", label: "Caption" },
  { value: "hashtags", label: "Hashtags" },
  { value: "cta", label: "CTA" },
  { value: "ideas", label: "Content ideas" },
  { value: "rewrite", label: "Rewrite" },
  { value: "tone", label: "Change tone" },
] as const;

export function ComposerAIPanel({
  content,
  platform,
  language = "en",
  onInsertText,
  onAppendHashtags,
}: ComposerAIPanelProps) {
  const { toastSuccess, toastError } = useToast();
  const [status, setStatus] = useState<AIStatusData | null>(null);
  const [feature, setFeature] = useState<string>("captions");
  const [tone, setTone] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<AIGenerateResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchAIStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = useCallback(async () => {
    if (feature !== "ideas" && !content.trim()) {
      toastError("Content required", "Add some text to work with.");
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await generateAI({
        feature: feature as "captions",
        content: content.trim() || undefined,
        platform: platform || undefined,
        language,
        tone: tone || undefined,
        count: 1,
      });
      if (res.error) {
        toastError("AI generation failed", res.error.message);
        return;
      }
      if (res.data) setResult(res.data);
      toastSuccess("Generated");
    } catch {
      toastError("AI generation failed", "Could not reach the AI service.");
    } finally {
      setGenerating(false);
    }
  }, [feature, content, platform, language, tone, toastSuccess, toastError]);

  const apply = useCallback(() => {
    if (!result?.output) return;
    const o = result.output;
    if (o.caption) {
      onInsertText(o.caption);
      toastSuccess("Caption inserted");
    } else if (o.rewritten) {
      onInsertText(o.rewritten);
      toastSuccess("Rewritten text applied");
    } else if (o.cta) {
      const base = content.trim();
      onInsertText(base ? `${base}\n\n${o.cta}` : o.cta);
      toastSuccess("CTA appended");
    } else if (o.hashtags) {
      onAppendHashtags(o.hashtags);
      toastSuccess("Hashtags appended");
    } else if (o.ideas && o.ideas.length > 0) {
      onInsertText(o.ideas.map((i) => `${i.title}: ${i.description}`).join("\n"));
      toastSuccess("Ideas added");
    }
  }, [result, content, onInsertText, onAppendHashtags, toastSuccess]);

  if (!status?.enabled) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border-strong bg-background-subtle px-4 py-4 text-sm text-muted-foreground">
        <Icon name="sparkles" size={16} />
        {status
          ? "AI assistant is not configured. Add AI_API_KEY to enable generation."
          : "AI assistant unavailable right now."}
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="sparkles" size={16} className="text-primary" />
          <p className="text-sm font-medium">AI assistant</p>
        </div>
        <Badge variant="secondary">
          {status.remaining.toLocaleString()} left
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="ai-composer-feature">Task</Label>
          <Select
            id="ai-composer-feature"
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            options={COMposer_FEATURES.map((f) => ({ value: f.value, label: f.label }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ai-composer-tone">Tone</Label>
          <Select
            id="ai-composer-tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            options={[
              { value: "", label: "Keep original tone" },
              { value: "professional", label: "Professional" },
              { value: "friendly", label: "Friendly" },
              { value: "luxury", label: "Luxury" },
              { value: "playful", label: "Playful" },
              { value: "bold", label: "Bold" },
              { value: "neutral", label: "Neutral" },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={generate} loading={generating} icon="sparkles" className="flex-1" size="sm">
          {generating ? "Generating…" : "Generate"}
        </Button>
        {result?.output && (
          <Button variant="outline" size="sm" icon="check" onClick={apply}>
            Apply
          </Button>
        )}
      </div>
    </div>
  );
}