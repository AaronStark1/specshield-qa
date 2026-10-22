import { Fragment, useMemo } from "react";
import { clsx } from "clsx";

export type CodeLanguage = "ts" | "text";

export interface CodeBlockProps {
  code: string;
  language?: CodeLanguage;
  /** Shown in a header strip inside the block, next to the language label. */
  fileName?: string;
  /** CSS max-height of the scrolling area. */
  maxHeight?: string;
  startLine?: number;
  className?: string;
}

export type TokenKind = "plain" | "comment" | "string" | "locator" | "number" | "keyword" | "api" | "matcher" | "type" | "decorator" | "punct";

export interface Token {
  k: TokenKind;
  t: string;
}

const TOKEN_CLASS: Record<Exclude<TokenKind, "plain">, string> = {
  comment: "italic text-fg-dim",
  string: "text-amber-200",
  locator: "text-cyan-300",
  number: "text-violet-200",
  keyword: "text-violet-300",
  api: "text-emerald-300",
  matcher: "text-sky-300",
  type: "text-amber-100",
  decorator: "text-cyan-300",
  punct: "text-fg-muted",
};

const KEYWORDS = new Set(
  (
    "import export from default class extends implements interface type const let var function return async await new " +
    "if else for of in while do switch case break continue try catch finally throw this super readonly private public " +
    "protected static abstract as satisfies typeof instanceof void delete yield enum declare keyof constructor"
  ).split(" ")
);
const LITERALS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);
const API = new Set(["test", "expect", "describe", "beforeEach", "afterEach", "beforeAll", "afterAll", "page", "locator", "step"]);
/** The first argument of these calls is rendered as a locator / URL. */
const LOCATOR_CALLS = new Set(["locator", "getByRole", "getByLabel", "getByText", "getByTestId", "getByPlaceholder", "getByTitle", "getByAltText", "goto"]);
const REGEX_AFTER_KEYWORD = new Set(["return", "typeof", "case", "in", "of", "throw", "void", "delete", "yield"]);
const REGEX_AFTER_PUNCT = /[(,=:[!&|?{};+\-*%<>~^]$/;

/**
 * Single sticky scanner; at each position the first matching alternative wins:
 *  1 whitespace · 2 block-comment start · 3 line comment · 4 "string" · 5 'string' · 6 template start
 *  7 decorator · 8 identifier · 9 number · 10 slash (comment/regex/division) · 11 punctuation run
 */
const SCAN =
  /(\s+)|(\/\*)|(\/\/.*)|("(?:[^"\\]|\\.)*"?)|('(?:[^'\\]|\\.)*'?)|(`)|(@[A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*)|((?:0[xXbBoO][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)n?)|(\/)|([^\sA-Za-z0-9_$"'`@/]+)/y;

interface ScanState {
  inBlockComment: boolean;
  inTemplate: boolean;
  templateKind: "string" | "locator";
  /** True right after `locatorCall(` — the next string/regex literal is the locator. */
  locatorArg: boolean;
  /** Last significant (non-whitespace, non-comment) raw token. */
  prev: Token | null;
}

function findTemplateEnd(line: string, from: number): number {
  for (let i = from; i < line.length; i++) {
    const c = line.charAt(i);
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "`") return i;
  }
  return -1;
}

function findRegexEnd(line: string, slashPos: number): number {
  let inClass = false;
  for (let i = slashPos + 1; i < line.length; i++) {
    const c = line.charAt(i);
    if (c === "\\") {
      i++;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
    } else if (c === "[") inClass = true;
    else if (c === "/") return i;
  }
  return -1;
}

function isRegexStart(prev: Token | null): boolean {
  if (!prev) return true;
  if (prev.k === "punct") return REGEX_AFTER_PUNCT.test(prev.t);
  if (prev.k === "keyword") return REGEX_AFTER_KEYWORD.has(prev.t);
  return false;
}

function classifyIdentifier(text: string, prev: Token | null): TokenKind {
  if (prev && prev.k === "punct" && prev.t.endsWith(".")) {
    // member access: expect(x).toBeVisible(), test.describe(), this.page
    if (/^to[A-Z]/.test(text)) return "matcher";
    if (API.has(text)) return "api";
    return "plain";
  }
  if (KEYWORDS.has(text)) return "keyword";
  if (LITERALS.has(text)) return "number";
  if (API.has(text)) return "api";
  if (/^[A-Z]/.test(text)) return "type";
  return "plain";
}

function tokenizeLine(line: string, st: ScanState): Token[] {
  const out: Token[] = [];
  const push = (k: TokenKind, t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.k === k) last.t += t;
    else out.push({ k, t });
  };

  let pos = 0;
  if (st.inBlockComment) {
    const end = line.indexOf("*/");
    if (end < 0) {
      push("comment", line);
      return out;
    }
    push("comment", line.slice(0, end + 2));
    pos = end + 2;
    st.inBlockComment = false;
  } else if (st.inTemplate) {
    const end = findTemplateEnd(line, 0);
    if (end < 0) {
      push(st.templateKind, line);
      return out;
    }
    push(st.templateKind, line.slice(0, end + 1));
    pos = end + 1;
    st.inTemplate = false;
    st.prev = { k: st.templateKind, t: "`" };
  }

  while (pos < line.length) {
    SCAN.lastIndex = pos;
    const m = SCAN.exec(line);
    if (!m) {
      // Unreachable in practice (every char is covered), but never loop forever.
      push("punct", line.charAt(pos));
      pos += 1;
      continue;
    }
    const text = m[0];
    pos += text.length;

    if (m[1] !== undefined) {
      push("plain", text);
      continue;
    }
    if (m[2] !== undefined) {
      const end = line.indexOf("*/", pos);
      if (end < 0) {
        push("comment", line.slice(pos - 2));
        st.inBlockComment = true;
        return out;
      }
      push("comment", line.slice(pos - 2, end + 2));
      pos = end + 2;
      continue;
    }
    if (m[3] !== undefined) {
      push("comment", text);
      continue;
    }
    if (m[6] !== undefined) {
      const kind: "string" | "locator" = st.locatorArg ? "locator" : "string";
      const end = findTemplateEnd(line, pos);
      st.locatorArg = false;
      st.prev = { k: kind, t: "`" };
      if (end < 0) {
        push(kind, line.slice(pos - 1));
        st.inTemplate = true;
        st.templateKind = kind;
        return out;
      }
      push(kind, line.slice(pos - 1, end + 1));
      pos = end + 1;
      continue;
    }

    let kind: TokenKind;
    if (m[4] !== undefined || m[5] !== undefined) kind = st.locatorArg ? "locator" : "string";
    else if (m[7] !== undefined) kind = "decorator";
    else if (m[8] !== undefined) kind = classifyIdentifier(text, st.prev);
    else if (m[9] !== undefined) kind = "number";
    else if (m[10] !== undefined) {
      kind = "punct";
      if (isRegexStart(st.prev)) {
        const end = findRegexEnd(line, pos - 1);
        if (end >= 0) {
          let flagsEnd = end + 1;
          while (flagsEnd < line.length && /[a-z]/i.test(line.charAt(flagsEnd))) flagsEnd++;
          const rk: "string" | "locator" = st.locatorArg ? "locator" : "string";
          push(rk, line.slice(pos - 1, flagsEnd));
          pos = flagsEnd;
          st.locatorArg = false;
          st.prev = { k: rk, t: "/" };
          continue;
        }
      }
    } else kind = "punct";

    push(kind, text);
    st.locatorArg = kind === "punct" && text === "(" && st.prev !== null && st.prev.k !== "punct" && LOCATOR_CALLS.has(st.prev.t);
    st.prev = { k: kind, t: text };
  }
  return out;
}

/** Splits on "\n" only (a "\r" stays in the line) so the rendered text is byte-for-byte the input. */
export function tokenizeCode(code: string, language: CodeLanguage): Token[][] {
  const lines = code.split("\n");
  if (language !== "ts") return lines.map((l) => (l ? [{ k: "plain", t: l }] : []));
  const st: ScanState = { inBlockComment: false, inTemplate: false, templateKind: "string", locatorArg: false, prev: null };
  return lines.map((l) => tokenizeLine(l, st));
}

export function CodeBlock({ code, language = "ts", fileName, maxHeight = "min(70vh, 720px)", startLine = 1, className }: CodeBlockProps) {
  const lines = useMemo(() => tokenizeCode(code, language), [code, language]);
  const lastNumber = startLine + lines.length - 1;
  const digits = Math.max(2, String(Math.max(lastNumber, 1)).length);
  const gutterWidth = `calc(${digits}ch + 1.25rem)`;

  return (
    <div className={clsx("min-w-0 overflow-hidden rounded-panel border border-edge bg-canvas", className)}>
      {fileName && (
        <div className="flex items-center justify-between gap-3 border-b border-edge bg-surface-1 px-3 py-1.5 font-mono text-2xs text-fg-dim">
          <span className="truncate text-fg-muted">{fileName}</span>
          <span className="shrink-0 uppercase tracking-wider">{language === "ts" ? "typescript" : "text"}</span>
        </div>
      )}
      <pre
        tabIndex={0}
        role="region"
        aria-label={fileName ? `Source of ${fileName}` : "Source code"}
        className="overflow-auto font-mono text-[12px] leading-5 text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-emerald-400/50"
        style={{ maxHeight, tabSize: 2 }}
      >
        <code className="block w-max min-w-full whitespace-pre py-2">
          {lines.map((tokens, i) => (
            <Fragment key={i}>
              <span className="group/line inline-block w-full min-w-full align-top hover:bg-white/[0.03]">
                <span
                  aria-hidden
                  className="sticky left-0 z-[1] inline-block select-none bg-canvas pr-3 text-right text-fg-faint group-hover/line:bg-[#0e1116] group-hover/line:text-fg-dim"
                  style={{ width: gutterWidth }}
                >
                  {startLine + i}
                </span>
                <span className="pl-1 pr-4">
                  {tokens.map((tok, j) =>
                    tok.k === "plain" ? (
                      tok.t
                    ) : (
                      <span key={j} className={TOKEN_CLASS[tok.k]}>
                        {tok.t}
                      </span>
                    )
                  )}
                </span>
              </span>
              {"\n"}
            </Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}
