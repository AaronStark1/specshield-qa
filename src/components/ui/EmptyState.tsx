export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#1f2937] bg-[#111827]/60 p-8 text-center">
      <p className="text-sm font-semibold text-[#e5e7eb]">{title}</p>
      <p className="mt-1 text-xs text-[#9ca3af]">{hint}</p>
    </div>
  );
}
