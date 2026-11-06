import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest } from "../lib/api";

/**
 * Lightweight, robust parser to render AI markdown responses
 * Supporting headers, bold, bullet points, numbered lists, inline code, and code blocks.
 */
function MarkdownRenderer({ content }) {
    if (!content) return null;

    // Split on code blocks ```lang ... ```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            parts.push({
                type: "text",
                value: content.slice(lastIndex, match.index),
            });
        }
        parts.push({
            type: "code",
            lang: match[1] || "code",
            value: match[2].trim(),
        });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
        parts.push({
            type: "text",
            value: content.slice(lastIndex),
        });
    }

    const copyCode = (codeText) => {
        try {
            navigator.clipboard.writeText(codeText);
        } catch {
            // ignore
        }
    };

    return (
        <div className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-100">
            {parts.map((part, pIdx) => {
                if (part.type === "code") {
                    return (
                        <div key={pIdx} className="my-2.5 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950 text-slate-100 shadow-md">
                            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                                <span>{part.lang || "code"}</span>
                                <button
                                    type="button"
                                    onClick={() => copyCode(part.value)}
                                    className="hover:text-amber-400 transition flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10"
                                    title="Copy code to clipboard"
                                >
                                    <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                                        <path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                                    </svg>
                                    Copy
                                </button>
                            </div>
                            <pre className="p-3 overflow-x-auto font-mono text-[11px] sm:text-xs leading-5 text-emerald-300">
                                <code>{part.value}</code>
                            </pre>
                        </div>
                    );
                }

                // Render standard markdown text line-by-line
                const lines = part.value.split("\n");
                return (
                    <div key={pIdx} className="space-y-1.5">
                        {lines.map((line, lIdx) => {
                            const trimmed = line.trim();
                            if (!trimmed) {
                                return <div key={lIdx} className="h-1" />;
                            }

                            // Headers
                            if (trimmed.startsWith("### ")) {
                                return (
                                    <h4 key={lIdx} className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 mt-2 mb-1">
                                        {formatInlineText(trimmed.replace(/^###\s+/, ""))}
                                    </h4>
                                );
                            }
                            if (trimmed.startsWith("## ")) {
                                return (
                                    <h3 key={lIdx} className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-2.5 mb-1">
                                        {formatInlineText(trimmed.replace(/^##\s+/, ""))}
                                    </h3>
                                );
                            }
                            if (trimmed.startsWith("# ")) {
                                return (
                                    <h2 key={lIdx} className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-3 mb-1.5">
                                        {formatInlineText(trimmed.replace(/^#\s+/, ""))}
                                    </h2>
                                );
                            }

                            // Bullet lists
                            if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                                return (
                                    <div key={lIdx} className="flex items-start gap-2 pl-2">
                                        <span className="text-amber-500 font-bold mt-1 text-[10px]">•</span>
                                        <div className="flex-1">{formatInlineText(trimmed.replace(/^[-*]\s+/, ""))}</div>
                                    </div>
                                );
                            }

                            // Numbered lists
                            const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
                            if (numMatch) {
                                return (
                                    <div key={lIdx} className="flex items-start gap-2 pl-2">
                                        <span className="font-mono text-[11px] font-bold text-amber-500 min-w-[18px]">
                                            {numMatch[1]}.
                                        </span>
                                        <div className="flex-1">{formatInlineText(numMatch[2])}</div>
                                    </div>
                                );
                            }

                            return (
                                <p key={lIdx} className="text-slate-800 dark:text-slate-200">
                                    {formatInlineText(line)}
                                </p>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Format inline **bold**, *italic*, and `inline code`
 */
function formatInlineText(text) {
    if (!text) return "";
    const segments = [];
    let current = text;
    let key = 0;

    // Pattern for inline code `...` or bold **...**
    const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    let match;
    let lastIdx = 0;

    while ((match = inlineRegex.exec(current)) !== null) {
        if (match.index > lastIdx) {
            segments.push(current.slice(lastIdx, match.index));
        }
        const token = match[0];
        if (token.startsWith("`") && token.endsWith("`")) {
            segments.push(
                <code
                    key={key++}
                    className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-amber-600 dark:text-amber-400 font-semibold"
                >
                    {token.slice(1, -1)}
                </code>,
            );
        } else if (token.startsWith("**") && token.endsWith("**")) {
            segments.push(
                <strong key={key++} className="font-bold text-slate-900 dark:text-white">
                    {token.slice(2, -2)}
                </strong>,
            );
        }
        lastIdx = match.index + token.length;
    }

    if (lastIdx < current.length) {
        segments.push(current.slice(lastIdx));
    }

    return segments.length > 0 ? segments : text;
}

export function AIChatAssistant({ classroom, activeTab, selectedVideo, selectedDoc, user }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [copiedIndex, setCopiedIndex] = useState(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const role = user?.role || "student";
    const userName = user?.name || user?.email?.split("@")[0] || "Learner";
    const courseTitle = classroom?.course?.title || classroom?.title || "Tedbabe Learning Space";
    const classroomTitle = classroom?.title || "Cohort Classroom";
    const currentLesson = selectedVideo?.title || selectedDoc?.title || (activeTab ? `Active Tab: ${activeTab}` : "");

    const storageKey = `tlh_ai_chat_${classroom?._id || "default"}_${user?._id || role}`;

    // Load initial greeting or saved history
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMessages(parsed);
                    return;
                }
            }
        } catch {
            // ignore localStorage parse error
        }

        // Default personalized welcome greeting
        const isTeacher = role === "teacher";
        const isAdmin = role === "admin" || role === "hub_admin";

        const welcomeText = isTeacher
            ? `Hello Instructor **${userName}**! 🎓 Welcome to your **TLH AI Co-Pilot** for *${courseTitle}*.\n\nI can help you:\n- **Draft 45-min lesson plans** and active learning outlines\n- **Create grading rubrics** and formative quiz questions\n- **Provide simplified explanations** for difficult concepts\n- **Support multilingual instruction** in English and Amharic (አማርኛ)\n\nWhat topic would you like to prepare or explore today?`
            : isAdmin
            ? `Greetings Administrator **${userName}**! 🛡️ TLH AI Academic Assistant is ready to support your educational operations in *${classroomTitle}*.\n\nAsk any question regarding curriculum synthesis, lesson facilitation best practices, or learning outcomes.`
            : `Hello **${userName}**! 👋 Welcome to your **TLH AI Learning Assistant** for *${courseTitle}*.\n\nI am here to guide your studies:\n- **Explain lessons & concepts** in plain, easy-to-understand language\n- **Walk through code and examples** step-by-step\n- **Help with homework & assignments** without giving away direct answers\n- **Answer questions in English and Amharic (አማርኛ)**\n\nWhat would you like to learn or practice right now?`;

        setMessages([
            {
                role: "assistant",
                content: welcomeText,
                timestamp: new Date().toISOString(),
                provider: "built-in",
            },
        ]);
    }, [storageKey, role, userName, courseTitle, classroomTitle]);

    // Save history when messages change
    useEffect(() => {
        if (messages.length > 0) {
            try {
                localStorage.setItem(storageKey, JSON.stringify(messages));
            } catch {
                // ignore
            }
        }
    }, [messages, storageKey]);

    // Auto-scroll to bottom of chat
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen, messages, scrollToBottom]);

    const handleClearChat = () => {
        if (window.confirm("Are you sure you want to clear your conversation history?")) {
            try {
                localStorage.removeItem(storageKey);
            } catch {
                // ignore
            }
            const isTeacher = role === "teacher";
            const resetMsg = {
                role: "assistant",
                content: isTeacher
                    ? `Conversation cleared! How can I assist you with your lesson planning or students today, Instructor **${userName}**?`
                    : `Conversation cleared! What would you like to learn about next, **${userName}**?`,
                timestamp: new Date().toISOString(),
                provider: "built-in",
            };
            setMessages([resetMsg]);
            setError("");
        }
    };

    const handleSend = async (textToSend) => {
        const prompt = (textToSend || input).trim();
        if (!prompt || loading) return;

        const userMsg = {
            role: "user",
            content: prompt,
            timestamp: new Date().toISOString(),
        };

        const updatedHistory = [...messages, userMsg];
        setMessages(updatedHistory);
        setInput("");
        setError("");
        setLoading(true);

        try {
            // Build context payload
            const payload = {
                messages: updatedHistory.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
                context: {
                    role,
                    userName,
                    courseTitle,
                    classroomTitle,
                    currentLesson: currentLesson || "Active Workspace",
                    activeTab,
                    resourceType: selectedVideo ? "video" : selectedDoc ? "document" : "overview",
                    language: /[\u1200-\u137F]/.test(prompt) ? "am" : "en",
                },
            };

            const response = await apiRequest("/api/ai/chat", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            const replyContent =
                response?.reply ||
                "I am here to help you learn! Could you please clarify your question so I can provide a more specific explanation?";

            const aiMsg = {
                role: "assistant",
                content: replyContent,
                timestamp: new Date().toISOString(),
                provider: response?.provider || "built-in",
            };

            setMessages((prev) => [...prev, aiMsg]);
        } catch (err) {
            console.error("[TLH AI] Request failed:", err);
            setError(err?.message || "Failed to reach AI assistant. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleCopyMessage = (text, idx) => {
        try {
            navigator.clipboard.writeText(text);
            setCopiedIndex(idx);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch {
            // ignore
        }
    };

    // Quick suggestion prompt chips
    const suggestions =
        role === "teacher"
            ? [
                  "📋 Draft a 45-min lesson plan",
                  "📊 Create an assessment rubric",
                  "💡 Active learning exercises",
                  "🇪🇹 የትምህርት እቅድ በአማርኛ (Amharic)",
              ]
            : [
                  "💡 Explain this lesson simply",
                  "📝 Quiz me with 3 questions",
                  "💻 Show a code example",
                  "🇪🇹 በአማርኛ አብራራልኝ (Amharic)",
              ];

    return (
        <>
            {/* 1. Floating Toggle Button */}
            <div className="fixed bottom-6 right-6 z-40 flex items-center">
                {!isOpen && (
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="group relative flex items-center gap-2.5 rounded-full px-4 py-3 shadow-[0_10px_30px_rgba(7,27,73,0.35)] dark:shadow-[0_10px_30px_rgba(197,155,39,0.3)] transition-all duration-300 hover:scale-105 active:scale-95 golden-btn"
                        aria-label="Open TLH AI Learning Assistant"
                        title="Open TLH AI Learning Assistant"
                    >
                        {/* Glowing Sparkle Icon */}
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white font-black text-base shadow-inner">
                            ✦
                        </span>
                        <div className="text-left hidden sm:block">
                            <p className="text-[10px] uppercase font-bold tracking-widest text-amber-200 dark:text-amber-100 leading-tight">
                                Tedbabe AI
                            </p>
                            <p className="text-xs font-black text-white leading-tight">
                                {role === "teacher" ? "Instructor Co-Pilot" : "Learning Assistant"}
                            </p>
                        </div>
                        {/* Live pulsating dot */}
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900" />
                        </span>
                    </button>
                )}
            </div>

            {/* 2. Slide-over Chat Panel */}
            <div
                className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white dark:bg-[#0c1322] border-l border-stone-200 dark:border-slate-800 shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out sm:w-[440px] md:w-[480px] lg:w-[500px] ${
                    isOpen ? "translate-x-0" : "translate-x-full"
                }`}
                role="dialog"
                aria-modal="true"
                aria-label="AI Chat Assistant"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 px-5 py-3.5 bg-stone-50/90 dark:bg-[#0f172a]/95 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#071B49] to-[#0d348a] dark:from-[#C59B27] dark:to-[#8E6C15] text-white shadow-md">
                            <span className="text-lg font-black">✦</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                                    TLH AI Assistant
                                </h3>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {role === "teacher"
                                    ? "🧑‍🏫 Instructor Co-Pilot"
                                    : role === "admin"
                                    ? "🛡️ Academic Supervisor Mode"
                                    : "🎓 Student Study Companion"}
                            </p>
                        </div>
                    </div>

                    {/* Header actions */}
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleClearChat}
                            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
                            title="Clear conversation"
                            aria-label="Clear conversation"
                        >
                            <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="rounded-xl p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
                            title="Close AI Assistant"
                            aria-label="Close AI Assistant"
                        >
                            <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Context Bar */}
                <div className="flex items-center justify-between px-5 py-2 border-b border-stone-200/70 dark:border-slate-800/80 bg-stone-100/60 dark:bg-slate-900/40 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="truncate max-w-[280px]" title={courseTitle}>
                        📚 <strong className="font-semibold text-slate-800 dark:text-slate-200">{courseTitle}</strong>
                    </span>
                    {currentLesson && (
                        <span className="truncate max-w-[150px] font-mono text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/50">
                            {currentLesson}
                        </span>
                    )}
                </div>

                {/* Chat History */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {messages.map((msg, index) => {
                        const isUser = msg.role === "user";
                        return (
                            <div
                                key={index}
                                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                            >
                                <div className="flex items-end gap-2 max-w-[92%] sm:max-w-[86%]">
                                    {!isUser && (
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#071B49] to-[#0d348a] dark:from-[#C59B27] dark:to-[#8E6C15] text-white text-xs font-bold shadow-sm mb-1">
                                            ✦
                                        </div>
                                    )}

                                    <div
                                        className={`group relative rounded-2xl px-4 py-3 shadow-sm ${
                                            isUser
                                                ? "bg-[#071B49] dark:bg-[#C59B27] text-white rounded-br-none"
                                                : "bg-stone-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-stone-200 dark:border-slate-700/60 rounded-bl-none"
                                        }`}
                                    >
                                        {isUser ? (
                                            <p className="text-xs sm:text-sm font-medium whitespace-pre-wrap leading-relaxed text-white">
                                                {msg.content}
                                            </p>
                                        ) : (
                                            <MarkdownRenderer content={msg.content} />
                                        )}

                                        {/* Action footer for assistant messages */}
                                        {!isUser && (
                                            <div className="mt-2.5 pt-2 border-t border-stone-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                                                <span className="font-mono">
                                                    {msg.provider === "gemini"
                                                        ? "Powered by Gemini"
                                                        : msg.provider === "openai"
                                                        ? "Powered by OpenAI"
                                                        : "TLH Educational Engine"}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyMessage(msg.content, index)}
                                                    className="flex items-center gap-1 hover:text-amber-500 transition px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                                    title="Copy response"
                                                >
                                                    {copiedIndex === index ? (
                                                        <span className="text-emerald-500 font-bold">✓ Copied</span>
                                                    ) : (
                                                        <>
                                                            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                                                                <path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                                                            </svg>
                                                            Copy
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Typing Loading Indicator */}
                    {loading && (
                        <div className="flex items-end gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#071B49] to-[#0d348a] dark:from-[#C59B27] dark:to-[#8E6C15] text-white text-xs font-bold shadow-sm">
                                ✦
                            </div>
                            <div className="rounded-2xl rounded-bl-none px-4 py-3 bg-stone-100 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700/60 shadow-sm flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.3s]" />
                                <span className="h-2 w-2 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.15s]" />
                                <span className="h-2 w-2 rounded-full bg-amber-500 animate-bounce" />
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-1">
                                    AI is formulating response…
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Error Banner with Retry */}
                    {error && (
                        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-800 dark:text-rose-300">
                            <div className="flex items-center justify-between gap-2">
                                <span>⚠️ {error}</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const lastUser = [...messages].reverse().find((m) => m.role === "user");
                                        if (lastUser) handleSend(lastUser.content);
                                    }}
                                    className="font-bold underline hover:text-rose-900 dark:hover:text-rose-100"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Suggestion Chips */}
                <div className="border-t border-stone-200/80 dark:border-slate-800/80 px-4 py-2.5 bg-stone-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                        {suggestions.map((suggestion, sIdx) => (
                            <button
                                key={sIdx}
                                type="button"
                                onClick={() => handleSend(suggestion)}
                                disabled={loading}
                                className="shrink-0 rounded-full border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-amber-500 dark:hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition shadow-2xs active:scale-95 disabled:opacity-50"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Input Area */}
                <div className="border-t border-stone-200 dark:border-slate-800 p-4 bg-white dark:bg-[#0c1322]">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                        className="relative flex items-end gap-2"
                    >
                        <div className="relative flex-1">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                rows={2}
                                placeholder="Ask a question in English or አማርኛ… (Enter to send)"
                                disabled={loading}
                                className="w-full resize-none rounded-2xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-900 px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-amber-500 dark:focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500/30 disabled:opacity-50"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!input.trim() || loading}
                            className="golden-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Send message"
                            aria-label="Send message"
                        >
                            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                            </svg>
                        </button>
                    </form>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 px-1">
                        <span>Press <strong>Enter</strong> to send, <strong>Shift+Enter</strong> for newline</span>
                        <span>TLH Academic Assistant</span>
                    </div>
                </div>
            </div>

            {/* Mobile backdrop overlay */}
            {isOpen && (
                <div
                    onClick={() => setIsOpen(false)}
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity sm:hidden"
                    aria-hidden="true"
                />
            )}
        </>
    );
}

