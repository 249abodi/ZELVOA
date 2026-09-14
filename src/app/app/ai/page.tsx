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
  code: string | null;
  model: string | null;
  monthlyUsage: number;
  monthlyLimit: number;
  remaining: number;
}

interface GenerateResponse {
  generated: boolean;
  text?: string;
  output?: {
    caption?: string;
    hashtags?: string[];
    cta?: string;
    ideas?: { title: string; description: string; format?: string }[];
    rewritten?: string;
  };
  model?: string;
  reason?: string;
  usage?: { promptTokens: number; completionTokens: number; remaining: number };
}

type Language = "en" | "ar";
type Feature = "captions" | "hashtags" | "cta" | "ideas" | "rewrite" | "tone";

const FEATURES: { value: Feature; label: string; labelAr: string; hint: string }[] = [
  { value: "captions", label: "Caption", labelAr: "كابشن", hint: "Write a platform-native caption." },
  { value: "hashtags", label: "Hashtags", labelAr: "هاشتاغات", hint: "Curated, relevant hashtags." },
  { value: "cta", label: "Call to action", labelAr: "دعوة للإجراء", hint: "A single strong CTA line." },
  { value: "ideas", label: "Content ideas", labelAr: "أفكار محتوى", hint: "Fresh posting ideas from context." },
  { value: "rewrite", label: "Rewrite", labelAr: "إعادة كتابة", hint: "Clean up and improve your draft." },
  { value: "tone", label: "Change tone", labelAr: "تغيير النغمة", hint: "Rephrase the draft in a new tone." },
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

const TEXT: Record<Language, Record<string, string>> = {
  en: {
    "task": "Task",
    "platform": "Platform",
    "language": "Language",
    "tone": "Tone",
    "length": "Length",
    "options": "Options",
    "content": "Your content or context",
    "generate": "Generate",
    "regenerate": "Regenerate",
    "copy": "Copy",
    "clear": "Clear",
    "output": "Output",
    "generated": "AI generated",
    "loading": "Generating…",
    "empty": "Generated content appears here.",
    "monthly-usage": "Monthly AI usage",
    "model": "Model",
    "ideas-title": "Content ideas",
    "ideas-format": "Format",
  },
  ar: {
    "task": "المهمة",
    "platform": "المنصة",
    "language": "اللغة",
    "tone": "النغمة",
    "length": "الطول",
    "options": "الخيارات",
    "content": "المحتوى أو السياق",
    "generate": "توليد",
    "regenerate": "إعادة التوليد",
    "copy": "نسخ",
    "clear": "مسح",
    "output": "الناتج",
    "generated": "تم التوليد بالذكاء الاصطناعي",
    "loading": "جارٍ التوليد…",
    "empty": "يظهر المحتوى المولَّد هنا.",
    "monthly-usage": "الاستخدام الشهري للذكاء الاصطناعي",
    "model": "النموذج",
    "ideas-title": "أفكار المحتوى",
    "ideas-format": "الصيغة",
  },
};

function errorMessage(lang: Language, code: string | undefined, fallback: string): string {
  const ar: Record<string, string> = {
    AI_NOT_CONFIGURED: "لم يتم إعداد الذكاء الاصطناعي بعد.",
    AI_UNAUTHORIZED: "رفض مزود الذكاء الاصطناعي المفتاح المضبوط.",
    AI_RATE_LIMITED: "تم تجاوز حد الاستخدام. حاول مجددًا بعد قليل.",
    AI_PROVIDER_UNAVAILABLE: "مزود الذكاء الاصطناعي غير متاح حاليًا.",
    AI_INVALID_REQUEST: "طلباتك غير صالحة. حاول تعديلها.",
    AI_TIMEOUT: "استغرق مزود الذكاء الاصطناعي وقتًا طويلًا.",
  };
  if (lang === "ar" && code && ar[code]) return ar[code];
  return fallback;
}

function toDisplayText(result: GenerateResponse | null): string {
  if (!result?.text) return "";
  const o = result.output;
  if (!o) return result.text;
  if (o.caption) return o.caption;
  if (o.hashtags) return o.hashtags.join(" ");
  if (o.cta) return o.cta;
  if (o.rewritten) return o.rewritten;
  if (o.ideas) return o.ideas.map((i) => i.title).join("\n");
  return result.text;
}

export default function AIPage() {
  const { toastSuccess, toastError } = useToast();
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [feature, setFeature] = useState<Feature>("captions");
  const [platform, setPlatform] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [tone, setTone] = useState("");
  const [length, setLength] = useState("");
  const [count, setCount] = useState(1);
  const [content, setContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const isArabic = language === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const t = (key: string) => TEXT[language][key] ?? TEXT.en[key] ?? key;

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
        if (!cancelled) setStatus({ enabled: false, message: "Could not load AI status.", code: null, model: null, monthlyUsage: 0, monthlyLimit: 0, remaining: 0 });
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
          language,
          tone: tone || undefined,
          length: length || undefined,
          count: count > 1 ? count : undefined,
        }),
      });
      const data = (await res.json()) as {
        data?: GenerateResponse;
        error?: { message?: string; code?: string };
      };
      if (!res.ok) {
        const code = data.error?.code;
        const msg = data.error?.message ?? "Generation failed.";
        const localized = errorMessage(language, code, msg);
        toastError("Generation failed", localized);
        return;
      }
      if (data.data?.generated === false) {
        const msg = data.data.reason ?? "Generation failed.";
        const localized = errorMessage(language, undefined, msg);
        toastError("AI not configured", localized);
        return;
      }
      setResult(data.data ?? null);
      toastSuccess("Generated");
    } catch {
      toastError("Generation failed", errorMessage(language, undefined, "Could not reach the server."));
    } finally {
      setGenerating(false);
    }
  }, [feature, platform, tone, length, count, content, language, toastSuccess, toastError]);

  const copyResult = useCallback(async () => {
    const text = toDisplayText(result);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toastSuccess("Copied to clipboard");
    } catch {
      toastError("Copy failed", "Clipboard access is not available.");
    }
  }, [result, toastSuccess, toastError]);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  const usagePct = status && status.monthlyLimit > 0
    ? Math.min(100, Math.round((status.monthlyUsage / status.monthlyLimit) * 100))
    : 0;

  const displayText = toDisplayText(result);
  const output = result?.output;

  return (
    <div className="grid gap-6" dir={dir}>
      <PageHeader
        title={isArabic ? "مساعد الذكاء الاصطناعي" : "AI Assistant"}
        description={isArabic
          ? "اكتب كابشنات وهاشتاغات ودعوات إجراء وأفكار محتوى. كل عملية توليد تُسجَّل."
          : "Write captions, hashtags, CTAs, and content ideas with an AI copywriter. Every generation is recorded for usage."}
        icon="sparkles"
        badge={status?.enabled ? (isArabic ? "متصل" : "Connected") : undefined}
      />

      {!loaded ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          <Icon name="spinner" size={18} className="animate-spin text-primary" />
          {isArabic ? "جارٍ تحميل حالة الذكاء الاصطناعي…" : "Loading AI status…"}
        </div>
      ) : status?.enabled ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t("monthly-usage")}</p>
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
                <p className="mt-2 text-xs text-warning">
                  {isArabic ? "اقتربت من الحد الشهري للذكاء الاصطناعي." : "You are close to your monthly AI limit."}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <Icon name="zap" size={18} className="text-primary" />
              <div>
                <p className="font-medium text-foreground">{t("model")}: {status.model ?? "default"}</p>
                <p className="text-xs">{status.message}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="grid gap-4 rounded-xl border border-border bg-card p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="feature">{t("task")}</Label>
                  <Select
                    id="feature"
                    value={feature}
                    onChange={(e) => setFeature(e.target.value as Feature)}
                    options={FEATURES.map((f) => ({ value: f.value, label: isArabic ? f.labelAr : f.label }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="platform">{t("platform")}</Label>
                  <Select
                    id="platform"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    options={PLATFORMS}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="language">{t("language")}</Label>
                  <Select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                    options={[
                      { value: "en", label: "English" },
                      { value: "ar", label: "العربية" },
                    ]}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="tone">{t("tone")}</Label>
                  <Select
                    id="tone"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    options={TONES}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="length">{t("length")}</Label>
                  <Select
                    id="length"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    options={LENGTHS}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="count">{t("options")}</Label>
                  <Select
                    id="count"
                    value={String(count)}
                    onChange={(e) => setCount(parseInt(e.target.value, 10))}
                    options={[1, 2, 3].map((n) => ({ value: String(n), label: `${isArabic ? "خيار" : "option"}${n > 1 ? (isArabic ? "ات" : "s") : ""}` }))}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="content">{t("content")}</Label>
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
                {generating ? t("loading") : result ? t("regenerate") : t("generate")}
              </Button>
            </div>

            <div className="flex flex-col rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-medium">{t("output")}</p>
                {result && (
                  <Badge variant="secondary">
                    <Icon name="sparkles" size={12} />
                    {t("generated")}
                  </Badge>
                )}
              </div>
              <div className="flex-1 whitespace-pre-wrap p-4 text-sm leading-relaxed">
                {generating ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon name="spinner" size={16} className="animate-spin" />
                    {t("loading")}
                  </div>
                ) : output?.hashtags ? (
                  <div className="flex flex-wrap gap-2">
                    {output.hashtags.map((h) => (
                      <Badge key={h} variant="secondary">{h}</Badge>
                    ))}
                  </div>
                ) : output?.ideas ? (
                  <ul className="grid gap-3">
                    {output.ideas.map((idea, i) => (
                      <li key={`${idea.title}-${i}`} className="rounded-lg border border-border bg-background-subtle p-3">
                        <p className="font-medium">{idea.title}</p>
                        {idea.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{idea.description}</p>
                        )}
                        {idea.format && (
                          <Badge variant="outline" className="mt-2">{idea.format}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : displayText ? (
                  displayText
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    {t("empty")}
                  </div>
                )}
              </div>
              {displayText && (
                <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {result?.model && `${t("model")}: ${result.model}`}
                    {result?.usage ? ` · ${result.usage.promptTokens + result.usage.completionTokens} tokens · ${result.usage.remaining} left` : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" icon="trash" onClick={clearResult}>
                      {t("clear")}
                    </Button>
                    <Button variant="outline" size="sm" icon="save" onClick={copyResult}>
                      {t("copy")}
                    </Button>
                  </div>
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
          <h3 className="text-base font-semibold">
            {isArabic ? "مساعد الذكاء الاصطناعي غير متصل" : "AI assistant is not connected"}
          </h3>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{status?.message}</p>
        </div>
      )}
    </div>
  );
}