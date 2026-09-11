"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/ui/toast";

interface AIStatus {
  enabled: boolean;
  message: string;
  model: string | null;
  monthlyUsage: number;
  monthlyLimit: number;
}

interface GenerateResponse {
  generated: boolean;
  text?: string;
  model?: string;
  reason?: string;
  usage?: { promptTokens: number; completionTokens: number };
}

const FEATURES: { value: string; label: string; hint: string }[] = [
  { value: "captions", label: "Caption", hint: "Write a platform-native caption." },
  { value: "hashtags", label: "Hashtags", hint: "Curated, relevant hashtags." },
  { value: "cta", label: "Call to action", hint: "A single strong CTA line." },
  { value: "ideas", label: "Content ideas", hint: "Fresh posting ideas from context." },
  { value: "rewrite", label: "Rewrite", hint: "Clean up and improve your draft." },
  { value: "tone", label: "Change tone", hint: "Rephrase the draft in a new tone." },
];

const PLATFORMS = [
  { value: "", label: "Generic / multi-platform" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "X", label: "X" },
  { value: "YOUTUBE", label: "YouTube" },
];

const TONES = [
  { value: "", label: "Keep original tone" },
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "luxury", label: "Luxury" },
  { value: "playful", label: "Playful" },
  { value: "bold", label: "Bold" },
  { value: "neutral", label: "Neutral" },
];

const LENGTHS = [
  { value: "", label: "Default length" },
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

export default function AIPage() {
  const { toastSuccess, toastError } = useToast();
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [feature, setFeature] = useState("captions");
  const [platform, setPlatform] = useState("");
  const [tone, setTone] = useState("");
  const [length, setLength] = useState("");
  const [count, setCount] = useState(1);
  const [content, setContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(async () => {
        const res = await fetch("/api/v1/ai/status");
        if (!res.ok) throw new Error("status_failed");
        const data = (await res.json()) as { data: AIStatus };
        if (!cancelled) setStatus(data.data);
      })
      .catch(() => {
        if (!cancelled) setStatus({ enabled: false, message: "Could not load AI status.", model: null, monthlyUsage: 0, monthlyLimit: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = useCallback(async () => {
    if (!content.trim() && feature !== "ideas") {
      toastError("Content required", "Add some text to work with.");
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature,
          content: content.trim() || undefined,
          platform: platform || undefined,
          tone: tone || undefined,
          length: length || undefined,
          count: count > 1 ? count : undefined,
        }),
      });
      const data = (await res.json()) as { data?: GenerateResponse; error?: { message?: string } };
      if (!res.ok || data.data?.generated === false) {
        const msg = data.error?.message ?? data.data?.reason ?? "Generation failed.";
        if (res.status === 501) {
          toastError("AI not configured", msg);
        } else {
          toastError("Generation failed", msg);
        }
        if (data.data) setResult(data.data);
        return;
      }
      setResult(data.data ?? null);
      if (data.data) toastSuccess("Generated");
    } catch {
      toastError("Generation failed", "Could not reach the server.");
    } finally {
      setGenerating(false);
    }
  }, [feature, platform, tone, length, count, content, toastSuccess, toastError]);

  const copyResult = useCallback(async () => {
    if (!result?.text) return;
    try {
      await navigator.clipboard.writeText(result.text);
      toastSuccess("Copied to clipboard");
    } catch {
      toastError("Copy failed", "Clipboard access is not available.");
    }
  }, [result, toastSuccess, toastError]);

  const usagePct = status && status.monthlyLimit > 0
    ? Math.min(100, Math.round((status.monthlyUsage / status.monthlyLimit) * 100))
    : 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="AI Assistant"
        description="Write captions, hashtags, CTAs, and content ideas with an AI copywriter. Every generation is recorded for usage."
        icon="sparkles"
        badge={status?.enabled ? "Connected" : undefined}
      />

      {!loaded ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          <Icon name="spinner" size={18} className="animate-spin text-primary" />
          Loading AI status…
        </div>
      ) : status?.enabled ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Monthly AI usage</p>
                <Badge variant="secondary">
                  {status.monthlyUsage.toLocaleString()} / {status.monthlyLimit.toLocaleString()}
                </Badge>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              {usagePct >= 90 && (
                <p className="mt-2 text-xs text-warning">You are close to your monthly AI limit.</p>
              )}
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <Icon name="zap" size={18} className="text-primary" />
              <div>
                <p className="font-medium text-foreground">Model: {status.model ?? "default"}</p>
                <p className="text-xs">{status.message}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="grid gap-4 rounded-xl border border-border bg-card p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="feature">Task</Label>
                  <Select
                    id="feature"
                    value={feature}
                    onChange={(e) => setFeature(e.target.value)}
                    options={FEATURES.map((f) => ({ value: f.value, label: f.label }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="platform">Platform</Label>
                  <Select
                    id="platform"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    options={PLATFORMS}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="tone">Tone</Label>
                  <Select
                    id="tone"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    options={TONES}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="length">Length</Label>
                  <Select
                    id="length"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    options={LENGTHS}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="count">Options</Label>
                  <Select
                    id="count"
                    value={String(count)}
                    onChange={(e) => setCount(parseInt(e.target.value, 10))}
                    options={[1, 2, 3].map((n) => ({ value: String(n), label: `${n} option${n > 1 ? "s" : ""}` }))}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="content">Your content or context</Label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  placeholder={FEATURES.find((f) => f.value === feature)?.hint}
                  className="resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                />
                <p className="text-right text-xs text-muted-foreground">{content.length.toLocaleString()}</p>
              </div>
              <Button onClick={generate} loading={generating} icon="sparkles" className="w-full">
                Generate
              </Button>
            </div>

            <div className="flex flex-col rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-medium">Output</p>
                {result && (
                  <Badge variant="secondary">
                    <Icon name="sparkles" size={12} />
                    AI generated
                  </Badge>
                )}
              </div>
              <div className="flex-1 whitespace-pre-wrap p-4 text-sm leading-relaxed">
                {result?.text ?? (generating ? "Generating…" : "Generated content appears here.")}
              </div>
              {result?.text && (
                <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {result.model && `Model: ${result.model}`}
                    {result.usage ? ` · ${result.usage.promptTokens + result.usage.completionTokens} tokens` : ""}
                  </span>
                  <Button variant="outline" size="sm" icon="save" onClick={copyResult}>
                    Copy
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-background-subtle px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Icon name="sparkles" size={26} />
          </div>
          <h3 className="text-base font-semibold">AI assistant is not connected</h3>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{status?.message}</p>
        </div>
      )}
    </div>
  );
}