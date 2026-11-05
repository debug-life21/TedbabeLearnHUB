import { useEffect, useId, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { api } from "../lib/api";

const EXTENSION_MAP = {
    ".docx": "docx",
    ".doc": "docx",
    ".xlsx": "xlsx",
    ".xls": "xlsx",
    ".csv": "csv",
    ".pptx": "pptx",
    ".ppt": "pptx",
    ".odt": "odt",
    ".ods": "ods",
    ".odp": "odp",
    ".rtf": "rtf",
    ".txt": "md",
    ".md": "md",
};

export function OfficeDocumentPreview({ resource }) {
    const iframeId = useId();
    const containerRef = useRef(null);
    const [state, setState] = useState({ loading: true, html: "", rawText: "", error: "", format: "" });
    const [zoom, setZoom] = useState(100);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const filename = resource?.originalFilename || resource?.title || "Document";
    const extension = useMemo(() => {
        return filename.match(/\.[^.]+$/)?.[0]?.toLowerCase() || "";
    }, [filename]);

    const detectedType = useMemo(() => {
        if (EXTENSION_MAP[extension]) return EXTENSION_MAP[extension];
        if (resource?.category === "spreadsheet" || resource?.mimeType?.includes("sheet") || resource?.mimeType?.includes("csv")) return "xlsx";
        if (resource?.category === "slide" || resource?.mimeType?.includes("presentation") || resource?.mimeType?.includes("powerpoint")) return "pptx";
        if (resource?.category === "document" || resource?.mimeType?.includes("word") || resource?.mimeType?.includes("officedocument")) return "docx";
        return "docx";
    }, [extension, resource]);

    useEffect(() => {
        let active = true;

        async function renderDocument() {
            setState({ loading: true, html: "", rawText: "", error: "", format: detectedType });
            try {
                const response = await api.get(`/api/resources/${resource.storedKey}/file`, {
                    responseType: "arraybuffer",
                });
                if (!active) return;

                const buffer = response.data;

                // Handle plain text and CSV directly if needed
                if (extension === ".txt" || extension === ".csv" || resource.mimeType?.startsWith("text/")) {
                    const decoder = new TextDecoder("utf-8");
                    const text = decoder.decode(buffer);

                    if (extension === ".csv") {
                        // Render CSV as a clean, styled spreadsheet table
                        const rows = text.split(/\r?\n/).filter(Boolean).map((row) => {
                            // Simple CSV parser supporting quotes
                            const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || row.split(",");
                            return matches.map((cell) => cell.replace(/^"|"$/g, "").trim());
                        });

                        const tableHtml = `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="utf-8">
                                <style>
                                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; background: #ffffff; color: #0f172a; }
                                    .csv-table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
                                    .csv-table th { background: var(--tlh-navy); color: #ffffff; padding: 10px 14px; font-weight: 700; border: 1px solid #1e293b; position: sticky; top: 0; }
                                    .csv-table td { padding: 9px 14px; border: 1px solid #e2e8f0; }
                                    .csv-table tr:nth-child(even) { background: #f8fafc; }
                                    .csv-table tr:hover { background: #eff6ff; }
                                </style>
                            </head>
                            <body>
                                <table class="csv-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            ${(rows[0] || []).map((h) => `<th>${escapeHtml(h)}</th>`).join("")}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${rows.slice(1).map((row, i) => `
                                            <tr>
                                                <td style="color:#94a3b8;font-family:monospace;font-size:11px;">${i + 1}</td>
                                                ${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}
                                            </tr>
                                        `).join("")}
                                    </tbody>
                                </table>
                            </body>
                            </html>
                        `;
                        if (active) setState({ loading: false, html: tableHtml, rawText: text, error: "", format: "csv" });
                        return;
                    }

                    // Standard text file display
                    const textHtml = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body { font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; margin: 0; padding: 28px; background: #090d16; color: #e2e8f0; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
                            </style>
                        </head>
                        <body>${escapeHtml(text)}</body>
                        </html>
                    `;
                    if (active) setState({ loading: false, html: textHtml, rawText: text, error: "", format: "txt" });
                    return;
                }

                // Parse Office formats (.pptx, .docx, .xlsx, .odt, .ods, .odp) with officeparser
                const { OfficeParser } = await import("officeparser");
                if (!active) return;

                const file = new File(
                    [buffer],
                    filename,
                    { type: resource.mimeType || "application/octet-stream" },
                );

                const document = await OfficeParser.parseOffice(file, { fileType: detectedType });
                const converted = await document.to("html");

                // Inject enhanced custom styling into the generated HTML to ensure full visual fidelity
                const enhancedHtml = injectViewerEnhancements(converted?.value || "", detectedType);

                const sanitized = DOMPurify.sanitize(enhancedHtml, {
                    WHOLE_DOCUMENT: true,
                    ADD_TAGS: ["style", "meta", "article", "section", "table", "thead", "tbody", "tr", "th", "td", "span", "div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a", "img"],
                    ADD_ATTR: ["class", "id", "style", "href", "target", "data-sheet-id", "data-slide-index"],
                    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "base"],
                    FORBID_ATTR: ["srcdoc", "onclick", "onerror", "onload"],
                });

                if (active) {
                    setState({ loading: false, html: sanitized, rawText: "", error: "", format: detectedType });
                }
            } catch (err) {
                console.warn("[OfficeDocumentPreview] Parser error:", err);
                if (active) {
                    // Try fallback plain text extraction
                    try {
                        const fallbackResponse = await api.get(`/api/resources/${resource.storedKey}/file`, {
                            responseType: "text",
                        });
                        if (fallbackResponse?.data && typeof fallbackResponse.data === "string" && fallbackResponse.data.length > 20) {
                            const safe = escapeHtml(fallbackResponse.data.slice(0, 10000));
                            setState({
                                loading: false,
                                html: `<div style="font-family:sans-serif;padding:24px;color:#334155;line-height:1.6;white-space:pre-wrap;">${safe}</div>`,
                                rawText: safe,
                                error: "",
                                format: "text",
                            });
                            return;
                        }
                    } catch (_) {
                        // ignore secondary fallback error
                    }

                    setState({
                        loading: false,
                        html: "",
                        rawText: "",
                        error: `Preview could not be generated for this ${detectedType.toUpperCase()} file (${err?.message || "format unsupported"}).`,
                        format: detectedType,
                    });
                }
            }
        }

        void renderDocument();
        return () => { active = false; };
    }, [resource._id, resource.storedKey, resource.mimeType, filename, detectedType, extension]);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
    };

    useEffect(() => {
        const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    const typeBadge = useMemo(() => {
        switch (state.format) {
            case "pptx":
            case "ppt":
                return { label: "PowerPoint Presentation", color: "bg-amber-100 text-amber-900 border-amber-300", icon: "📊" };
            case "xlsx":
            case "xls":
            case "csv":
                return { label: "Excel Spreadsheet", color: "bg-emerald-100 text-emerald-900 border-emerald-300", icon: "📈" };
            case "docx":
            case "doc":
            case "odt":
                return { label: "Word Document", color: "bg-blue-100 text-blue-900 border-blue-300", icon: "📄" };
            default:
                return { label: "Learning Material", color: "bg-slate-100 text-slate-800 border-slate-300", icon: "📁" };
        }
    }, [state.format]);

    return (
        <div
            ref={containerRef}
            className={`flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition-all ${
                isFullscreen ? "fixed inset-0 z-50 rounded-none h-screen w-screen p-4 bg-slate-900" : "w-full"
            }`}
        >
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/90 px-4 py-3 rounded-t-2xl">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs text-base ring-1 ring-slate-200/80">
                        {typeBadge.icon}
                    </span>
                    <div className="min-w-0">
                        <h4 className="truncate text-xs font-black text-slate-900 sm:text-sm">
                            {filename}
                        </h4>
                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${typeBadge.color}`}>
                            {typeBadge.label}
                        </span>
                    </div>
                </div>

                {/* View Controls (Zoom & Fullscreen) — NO DOWNLOAD ALLOWED */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="hidden sm:flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-xs">
                        <button
                            type="button"
                            onClick={() => setZoom((z) => Math.max(50, z - 15))}
                            className="h-7 w-7 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center justify-center"
                            title="Zoom Out"
                        >
                            −
                        </button>
                        <span className="px-2 text-[11px] font-mono font-bold text-slate-500 min-w-10 text-center">
                            {zoom}%
                        </span>
                        <button
                            type="button"
                            onClick={() => setZoom((z) => Math.min(200, z + 15))}
                            className="h-7 w-7 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center justify-center"
                            title="Zoom In"
                        >
                            +
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-100 transition"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
                    >
                        <span>{isFullscreen ? "🗗" : "⛶"}</span>
                        <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Fullscreen"}</span>
                    </button>

                    <span className="inline-flex items-center gap-1 rounded-xl bg-sky-50 border border-sky-200 px-2.5 py-1 text-[11px] font-extrabold text-[var(--tlh-blue-primary)]">
                        🔒 In-Place Reader
                    </span>
                </div>
            </div>

            {/* Document Viewer Frame */}
            <div
                className={`relative flex-1 overflow-auto bg-slate-100/60 p-2 sm:p-4 select-none ${
                    isFullscreen ? "h-[calc(100vh-80px)]" : "h-[74vh] min-h-[520px]"
                }`}
                onContextMenu={(e) => e.preventDefault()}
            >
                {state.loading && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center bg-white rounded-xl">
                        <div className="h-9 w-9 animate-spin rounded-full border-3 border-[var(--tlh-blue-primary)] border-t-transparent" />
                        <p className="text-xs font-bold text-slate-700">Loading {typeBadge.label} into learning space…</p>
                        <p className="text-[11px] text-slate-400">Rendering directly in place without downloading.</p>
                    </div>
                )}

                {!state.loading && state.error && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center bg-white rounded-xl">
                        <span className="text-4xl">📁</span>
                        <h4 className="text-sm font-bold text-slate-900">{filename}</h4>
                        <p className="max-w-md text-xs text-slate-500 leading-relaxed">{state.error}</p>
                        <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-200">
                            🔒 Protected In-Workspace View Only
                        </span>
                    </div>
                )}

                {!state.loading && !state.error && state.html && (
                    <div
                        className="mx-auto h-full w-full max-w-5xl transition-transform origin-top"
                        style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
                    >
                        <iframe
                            id={iframeId}
                            title={`${filename} in-place preview`}
                            srcDoc={state.html}
                            sandbox="allow-same-origin allow-scripts"
                            className="h-full w-full rounded-xl border border-slate-200 bg-white shadow-md"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function escapeHtml(str) {
    return String(str || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function injectViewerEnhancements(rawHtml, format) {
    const customCss = `
        <style>
            /* Global clean reading styles */
            html, body {
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #0f172a;
                background-color: #ffffff;
                line-height: 1.6;
                -webkit-font-smoothing: antialiased;
            }
            body {
                padding: 24px 32px;
                max-width: 900px;
                margin: 0 auto;
            }

            /* Spreadsheet Grid Styling */
            .spreadsheet-container {
                width: 100%;
                overflow-x: auto;
                background: #ffffff;
            }
            .spreadsheet-table, .excel-grid {
                border-collapse: collapse;
                width: 100%;
                font-size: 13px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
            }
            .spreadsheet-table th, .excel-col-header, .excel-row-num-header {
                background: var(--tlh-navy) !important;
                color: #ffffff !important;
                padding: 8px 12px;
                font-weight: 700;
                text-align: center;
                border: 1px solid #1e293b;
            }
            .spreadsheet-table td, .excel-row td {
                padding: 8px 12px;
                border: 1px solid #cbd5e1;
                color: #0f172a;
            }
            .excel-row-num {
                background: #f1f5f9;
                color: #64748b;
                font-weight: 700;
                text-align: center;
                font-size: 11px;
                width: 44px;
            }
            .spreadsheet-tabs {
                display: flex;
                gap: 4px;
                margin-top: 14px;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 2px;
            }
            .spreadsheet-tab {
                padding: 6px 16px;
                font-size: 12px;
                font-weight: 700;
                text-decoration: none;
                color: #475569;
                border-radius: 8px 8px 0 0;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-bottom: none;
            }
            .spreadsheet-tab.active, .spreadsheet-tab:hover {
                background: var(--tlh-blue-primary);
                color: #ffffff;
            }

            /* Presentation / Slides Layout */
            .slide, [class*="slide-"], section {
                margin: 24px auto;
                padding: 32px 40px;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
                box-shadow: 0 4px 16px rgba(0, 27, 68, 0.08);
                min-height: 380px;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
            }
            h1, h2, h3, h4 { color: var(--tlh-navy); }
            h1 { font-size: 26px; border-bottom: 2px solid var(--tlh-blue-primary); padding-bottom: 8px; margin-top: 0; }
            h2 { font-size: 20px; margin-top: 18px; }
            ul, ol { padding-left: 24px; }
            li { margin-bottom: 8px; }
            img { max-width: 100%; height: auto; border-radius: 8px; }

            /* Prevent select and copying if needed */
            ::selection { background: #93c5fd; color: var(--tlh-navy); }
        </style>
    `;

    if (rawHtml.includes("<head>")) {
        return rawHtml.replace("<head>", `<head>${customCss}`);
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${customCss}</head><body>${rawHtml}</body></html>`;
}
