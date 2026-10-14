export function CodeBlock({ code }: { code: string }) {
  // Lightweight tokenizer: comments, strings, keywords
  const lines = code.split("\n");
  const renderLine = (line: string, i: number) => {
    // comment
    const commentIdx = line.indexOf("//");
    let main = line;
    let comment = "";
    if (commentIdx >= 0 && !line.trim().startsWith("/*") && !line.trim().startsWith("*")) {
      main = line.slice(0, commentIdx);
      comment = line.slice(commentIdx);
    }
    const parts = main.split(/("[^"]*"|'[^']*'|`[^`]*`)/g).map((p, j) => {
      if (/^["'`]/.test(p)) return <span key={j} className="text-amber-200">{p}</span>;
      const kw = p.split(/(\bimport\b|\bexport\b|\bfrom\b|\bclass\b|\bconst\b|\bawait\b|\basync\b|\bnew\b|\breturn\b|\btest\b|\bexpect\b|\bdescribe\b|\bbeforeEach\b)/g).map((w, k) =>
        /^(import|export|from|class|const|await|async|new|return|test|expect|describe|beforeEach)$/.test(w)
          ? <span key={k} className="text-violet-300">{w}</span>
          : <span key={k}>{w}</span>
      );
      return <span key={j}>{kw}</span>;
    });
    return (
      <div key={i} className="flex">
        <span className="w-10 shrink-0 select-none pr-3 text-right text-[#4b5563]">{i + 1}</span>
        <span className="whitespace-pre-wrap break-all">{parts}{comment && <span className="text-[#6b7280]">{comment}</span>}</span>
      </div>
    );
  };
  return (
    <pre className="overflow-auto rounded-xl border border-[#1f2937] bg-black/50 p-3 font-mono text-[12px] leading-relaxed">
      {lines.map(renderLine)}
    </pre>
  );
}
