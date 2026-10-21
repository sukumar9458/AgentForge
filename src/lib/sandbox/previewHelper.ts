/**
 * Generates an isolated HTML document for live previewing HTML, SVG, and React/TSX/JSX.
 */
export function buildPreviewHtml(code: string, language: string): string {
  const normalizedLang = language.toLowerCase().trim();
  const raw = code.trim();

  // 1. If it's already a full HTML page
  if (raw.toLowerCase().startsWith("<!doctype") || raw.toLowerCase().startsWith("<html")) {
    return raw;
  }

  // 2. If it's an SVG
  if (raw.toLowerCase().startsWith("<svg")) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; padding: 24px; }
    svg { max-width: 100%; height: auto; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.3)); }
  </style>
</head>
<body>
  ${raw}
</body>
</html>`;
  }

  // 3. If it's a React / JSX / TSX Component
  const isReact =
    ["tsx", "jsx", "react"].includes(normalizedLang) ||
    raw.includes("export default") ||
    raw.includes("return (") ||
    raw.includes("useState") ||
    raw.includes("useEffect");

  if (isReact) {
    // Strip standard import statements that would cause browser syntax errors
    const cleanedCode = raw
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return (
          !trimmed.startsWith("import ") &&
          !trimmed.startsWith("import type ") &&
          !trimmed.startsWith("'use client'") &&
          !trimmed.startsWith('"use client"')
        );
      })
      .join("\n");

    const defaultMatch = raw.match(/export\s+default\s+function\s+([a-zA-Z0-9_]+)/);
    const functionMatch = raw.match(/function\s+([a-zA-Z0-9_]+)/);
    const constMatch = raw.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=/);

    const componentName =
      defaultMatch?.[1] || functionMatch?.[1] || constMatch?.[1] || "App";

    const executableReactCode = cleanedCode
      .replace(/export\s+default\s+function/g, "function")
      .replace(/export\s+default\s+/g, `const __DefaultExport = `)
      .replace(/export\s+/g, "");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 16px;
      background-color: #0b0f19;
      color: #f8fafc;
      min-height: 100vh;
    }
    #error-container {
      display: none;
      background: #450a0a;
      border: 1px solid #dc2626;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      color: #fca5a5;
    }
  </style>
</head>
<body>
  <div id="error-container"></div>
  <div id="root"></div>

  <script type="text/babel">
    window.onerror = function(msg, url, lineNo, columnNo, error) {
      const errBox = document.getElementById('error-container');
      if (errBox) {
        errBox.style.display = 'block';
        errBox.innerHTML = '<strong>Runtime Preview Error:</strong><br>' + msg + '<br><small>Line: ' + lineNo + '</small>';
      }
      return false;
    };

    const { useState, useEffect, useRef, useMemo, useCallback, useContext, createContext, useReducer } = React;

    try {
      ${executableReactCode}

      const targetToMount = typeof ${componentName} !== 'undefined'
        ? ${componentName}
        : (typeof __DefaultExport !== 'undefined' ? __DefaultExport : null);

      if (targetToMount) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(targetToMount));
      } else {
        document.getElementById('root').innerHTML = '<div class="p-6 text-slate-400 text-sm">Component not found for mounting.</div>';
      }
    } catch (err) {
      const errBox = document.getElementById('error-container');
      if (errBox) {
        errBox.style.display = 'block';
        errBox.innerText = 'Compilation / Render Error: ' + (err.message || String(err));
      }
    }
  </script>
</body>
</html>`;
  }

  // 4. Default HTML fragment with Tailwind
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #0b0f19;
      color: #f8fafc;
      min-height: 100vh;
    }
  </style>
</head>
<body>
  ${raw}
</body>
</html>`;
}
