/**
 * Client-safe language utilities for sandboxing and previewing.
 */

/**
 * Checks if a language is considered executable in sandbox environments.
 */
export function isExecutableLanguage(language: string): boolean {
  const normalized = language.toLowerCase().trim();
  return [
    "javascript",
    "js",
    "typescript",
    "ts",
    "tsx",
    "jsx",
    "python",
    "py",
    "bash",
    "sh",
    "shell",
  ].includes(normalized);
}

/**
 * Checks if code is visually previewable in the UI (HTML, React, SVG).
 */
export function isPreviewableLanguage(language: string): boolean {
  const normalized = language.toLowerCase().trim();
  return [
    "html",
    "htm",
    "xhtml",
    "svg",
    "xml",
    "tsx",
    "jsx",
    "react",
    "css",
    "tailwind",
  ].includes(normalized);
}
