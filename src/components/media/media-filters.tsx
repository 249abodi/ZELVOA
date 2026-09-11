"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function MediaFilters({
  total,
  onSearch,
}: {
  total: number;
  onSearch: (params: { q: string; type: string }) => void;
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [, startTransition] = useTransition();

  const apply = (newQ: string, newType: string) => {
    startTransition(() => {
      onSearch({ q: newQ, type: newType });
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1">
        <Input
          icon="search"
          placeholder="Search media..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply(q, type);
          }}
        />
      </div>
      <Select
        value={type}
        onChange={(e) => {
          setType(e.target.value);
          apply(q, e.target.value);
        }}
        options={[
          { value: "", label: "All types" },
          { value: "IMAGE", label: "Images" },
          { value: "VIDEO", label: "Videos" },
          { value: "DOCUMENT", label: "Documents" },
        ]}
        className="w-full sm:w-40"
      />
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {total} {total === 1 ? "file" : "files"}
      </span>
    </div>
  );
}
