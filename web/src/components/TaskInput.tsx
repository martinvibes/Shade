"use client";

import { useState } from "react";

interface TaskInputProps {
  onSubmit: (task: string) => void;
  disabled?: boolean;
}

export function TaskInput({ onSubmit, disabled }: TaskInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="flex-1 relative">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter a task for Shade..."
          disabled={disabled}
          className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-[14px] font-mono text-text placeholder:text-text-3 focus:outline-none focus:border-gold/40 transition-colors disabled:opacity-40"
        />
      </div>
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        className="px-5 py-3 bg-surface-2 border border-border rounded-lg font-mono text-[13px] text-text-2 hover:text-text hover:border-border-light transition-colors disabled:opacity-30 disabled:pointer-events-none"
      >
        Execute
      </button>
    </form>
  );
}
