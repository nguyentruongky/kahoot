"use client";

import type { RefObject } from "react";

type HostJsonImportInputProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  onImportText: (text: string) => Promise<void> | void;
  onError?: (message: string) => void;
};

export function HostJsonImportInput({
  inputRef,
  onImportText,
  onError,
}: HostJsonImportInputProps) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="application/json"
      className="hidden"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          await onImportText(text);
        } catch {
          onError?.("Invalid JSON");
        } finally {
          e.target.value = "";
        }
      }}
    />
  );
}

