export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-[#1f2937] bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-[#9ca3af]">
      {children}
    </kbd>
  );
}
