"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/utils";

const POST_TYPES = [
  { value: "STANDARD", label: "Standard" },
  { value: "STORY", label: "Story" },
  { value: "REEL", label: "Reel" },
  { value: "CAROUSEL", label: "Carousel" },
  { value: "VIDEO", label: "Video" },
] as const;

interface PostEditorProps {
  initialTitle?: string;
  initialContent?: string;
  initialType?: string;
  captionLimit?: number;
  onChange: (data: { title: string; content: string; postType: string }) => void;
}

export function PostEditor({
  initialTitle = "",
  initialContent = "",
  initialType = "STANDARD",
  captionLimit = 2200,
  onChange,
}: PostEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [postType, setPostType] = useState(initialType);

  const update = (data: { title?: string; content?: string; postType?: string }) => {
    const next = {
      title: data.title ?? title,
      content: data.content ?? content,
      postType: data.postType ?? postType,
    };
    onChange(next);
  };

  const [prevInitials, setPrevInitials] = useState({
    title: initialTitle,
    content: initialContent,
    postType: initialType,
  });
  if (initialTitle !== prevInitials.title) {
    setPrevInitials((p) => ({ ...p, title: initialTitle }));
    setTitle(initialTitle);
  }
  if (initialContent !== prevInitials.content) {
    setPrevInitials((p) => ({ ...p, content: initialContent }));
    setContent(initialContent);
  }
  if (initialType !== prevInitials.postType) {
    setPrevInitials((p) => ({ ...p, postType: initialType }));
    setPostType(initialType);
  }

  return (
    <div className="grid gap-4">
      <div>
        <label htmlFor="post-title" className="text-sm font-medium">
          Title <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          id="post-title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            update({ title: e.target.value });
          }}
          placeholder="Give your post a title..."
          className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="post-content" className="text-sm font-medium">
            Content
          </label>
          <span
            className={cn(
              "text-xs",
              content.length > captionLimit ? "text-warning" : "text-muted-foreground"
            )}
          >
            {content.length} / {captionLimit}
          </span>
        </div>
        <textarea
          id="post-content"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            update({ content: e.target.value });
          }}
          placeholder="What would you like to share?"
          rows={7}
          className="mt-1 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm leading-relaxed focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          This will be used as the default copy across selected platforms.
        </p>
        {content.length > captionLimit && (
          <p className="mt-1 text-xs text-warning">
            Exceeds the character limit of one of your selected platforms. Publishing will be
            rejected by the provider adapter.
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium">Post type</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {POST_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setPostType(t.value);
                update({ postType: t.value });
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                postType === t.value
                  ? "border-primary bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <PostPreview content={content} postType={postType} />
    </div>
  );
}

function PostPreview({ content, postType }: { content: string; postType: string }) {
  const [platform, setPlatform] = useState<
    "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "X"
  >("INSTAGRAM");
  const [mockImg] = useState<IconName>("image");

  const tabs: { value: typeof platform; label: string }[] = [
    { value: "INSTAGRAM", label: "Instagram" },
    { value: "FACEBOOK", label: "Facebook" },
    { value: "LINKEDIN", label: "LinkedIn" },
    { value: "X", label: "X" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Preview</p>
        <div className="flex gap-1 rounded-lg bg-muted p-0.5">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setPlatform(t.value)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                platform === t.value
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-sm rounded-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon name="campaigns" size={15} />
          </div>
          <div>
            <p className="text-xs font-semibold">{platform.charAt(0) + platform.slice(1).toLowerCase()}</p>
            <p className="text-[10px] text-muted-foreground">Now</p>
          </div>
        </div>
        <div className="flex aspect-square items-center justify-center rounded-xl bg-muted mt-2">
          <Icon name={mockImg} size={40} className="text-muted-foreground/50" />
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
          {content || (
            <span className="text-muted-foreground italic">Your post content previews here...</span>
          )}
        </p>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {postType.toLowerCase()} post
        </p>
      </div>
    </div>
  );
}