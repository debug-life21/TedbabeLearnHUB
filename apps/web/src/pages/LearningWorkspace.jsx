import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest, API_BASE_URL } from "../lib/api";
import { Modal } from "../components/UIComponents";
import { LiveSessionButton } from "../components/LiveSessionButton";
import { formatSessionTime } from "../lib/sessionTime";
import { OfficeDocumentPreview } from "../components/OfficeDocumentPreview";
import { DashboardSidebar } from "../components/DashboardSidebar";

export function getYouTubeVideoId(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes("youtu.be")) {
            return parsed.pathname.slice(1).split(/[?#]/)[0];
        }
        if (parsed.pathname.includes("/embed/")) {
            return parsed.pathname.split("/embed/")[1]?.split(/[?#]/)[0];
        }
        if (parsed.pathname.includes("/shorts/")) {
            return parsed.pathname.split("/shorts/")[1]?.split(/[?#]/)[0];
        }
        return parsed.searchParams.get("v");
    } catch {
        const match = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([A-Za-z0-9_-]{11})/);
        return match ? match[1] : null;
    }
}

function useProtectedObjectUrl(resource) {
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [reloadCount, setReloadCount] = useState(0);
    const primaryKey = resource?._id || resource?.storedKey;
    const fallbackType = resource?.mimeType || "application/pdf";

    const retry = () => setReloadCount((c) => c + 1);

    useEffect(() => {
        if (!primaryKey) {
            setUrl("");
            setError("");
            return undefined;
        }
        let cancelled = false;
        let objectUrl = "";
        setLoading(true);
        setError("");

        const fetchFile = async () => {
            try {
                let blob;
                try {
                    blob = await apiRequest(`/api/resources/${primaryKey}/file`, { responseType: "blob" });
                } catch (firstErr) {
                    // If primary key failed and storedKey is different, try storedKey
                    if (resource?.storedKey && resource.storedKey !== primaryKey) {
                        blob = await apiRequest(`/api/resources/${encodeURIComponent(resource.storedKey)}/file`, { responseType: "blob" });
                    } else {
                        throw firstErr;
                    }
                }
                if (cancelled) return;
                const typed = blob instanceof Blob && (!blob.type || blob.type === "application/octet-stream")
                    ? new Blob([blob], { type: fallbackType })
                    : blob;
                objectUrl = URL.createObjectURL(typed);
                setUrl(objectUrl);
            } catch (err) {
                if (cancelled) return;
                let msg = err?.message || "Unable to load this document.";
                if (err?.response?.data instanceof Blob) {
                    try {
                        const text = await err.response.data.text();
                        const parsed = JSON.parse(text);
                        if (parsed.message) msg = parsed.message;
                    } catch {
                        // ignore
                    }
                }
                setError(msg);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchFile();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [primaryKey, resource?.storedKey, fallbackType, reloadCount]);

    return { url, error, loading, retry };
}

function ProtectedDocumentPreview({ resource, kind = "document" }) {
    const { url, error, loading, retry } = useProtectedObjectUrl(resource);
    const [zoom, setZoom] = useState(100);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Dismiss expand modal on Escape key
    useEffect(() => {
        if (!isExpanded) return undefined;
        const onKey = (e) => { if (e.key === "Escape") setIsExpanded(false); };
        document.addEventListener("keydown", onKey);
        // Prevent body scrolling while modal is open
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [isExpanded]);

    const ReaderToolbar = ({ inModal = false }) => (
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-slate-900/90 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 flex items-center gap-1.5 text-xs font-bold text-slate-200 truncate max-w-xs sm:max-w-md">
                    <span>{kind === "image" ? "🖼️" : "📕"}</span>
                    <span className="truncate">{resource?.originalFilename || resource?.title || "Document Reader"}</span>
                </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
                {/* Zoom controls */}
                <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1 border border-white/10 text-slate-300">
                    <button type="button" onClick={() => setZoom((z) => Math.max(25, z - 15))}
                        className="rounded-lg px-2 py-0.5 hover:bg-white/10 font-bold transition" title="Zoom Out">−</button>
                    <span className="px-1 text-[11px] font-mono font-bold text-cyan-300 min-w-[40px] text-center">{zoom}%</span>
                    <button type="button" onClick={() => setZoom((z) => Math.min(300, z + 15))}
                        className="rounded-lg px-2 py-0.5 hover:bg-white/10 font-bold transition" title="Zoom In">+</button>
                    <button type="button" onClick={() => setZoom(100)}
                        className="rounded-lg px-2 py-0.5 text-[10px] hover:bg-white/10 text-slate-400 hover:text-white transition" title="Reset Zoom">Fit</button>
                </div>
                {/* Reader mode */}
                <button type="button" onClick={() => setIsDarkMode((d) => !d)}
                    className={`rounded-xl px-2.5 py-1 text-[11px] font-bold border transition ${isDarkMode ? "bg-slate-800 text-cyan-300 border-cyan-500/30" : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                        }`} title="Toggle Reader Mode">
                    {isDarkMode ? "🌙 Dark" : "☀️ Light"}
                </button>
                {/* Expand/collapse */}
                {inModal ? (
                    <button type="button" onClick={() => setIsExpanded(false)}
                        className="rounded-xl bg-rose-600/80 px-2.5 py-1 text-[11px] font-bold text-white border border-rose-500/40 hover:bg-rose-600 transition"
                        title="Exit Expanded View">
                        ✕ Close
                    </button>
                ) : (
                    <button type="button" onClick={() => setIsExpanded(true)}
                        className="rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-2.5 py-1 text-[11px] font-bold text-white border border-[var(--tlh-cyan)]/40 hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)] transition"
                        title="Expand to Full View">
                        ⛶ Expand
                    </button>
                )}
                {/* Pop out */}
                {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                        className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm hover:from-blue-500 hover:to-cyan-500 transition">
                        Pop-out ↗
                    </a>
                )}
            </div>
        </div>
    );

    const ReaderContent = () => (
        <div className={`relative flex-1 overflow-auto p-4 flex items-start justify-center transition-colors ${isDarkMode ? "bg-slate-950" : "bg-slate-100/90"
            }`}>
            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm font-medium text-slate-300">
                    <div className="h-10 w-10 animate-spin rounded-full border-3 border-cyan-400 border-t-transparent shadow-lg shadow-cyan-500/20" />
                    <span className="font-semibold text-xs tracking-wider uppercase text-cyan-300">Loading document…</span>
                </div>
            )}
            {error && !loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-slate-900">
                    <span className="text-4xl">📄</span>
                    <p className="text-sm font-bold text-rose-300">We couldn't display this file.</p>
                    <p className="max-w-md text-xs text-slate-400 leading-relaxed">{error}</p>
                    <div className="mt-3 flex items-center gap-3">
                        <button type="button" onClick={retry}
                            className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-2.5 text-xs font-bold text-white hover:from-blue-500 hover:to-cyan-500 transition shadow-md shadow-blue-500/20">
                            Retry loading
                        </button>
                    </div>
                </div>
            )}
            {url && !error && (
                kind === "image" ? (
                    <div className="flex h-full w-full items-center justify-center p-4">
                        <img src={url} alt={resource?.title}
                            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center top" }}
                            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl transition-transform duration-200 select-none ring-1 ring-white/10"
                            draggable={false} onContextMenu={(e) => e.preventDefault()} />
                    </div>
                ) : (
                    <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center", width: "100%", height: zoom > 100 ? `${zoom}%` : "100%" }}
                        className="transition-transform duration-200 flex flex-col w-full min-h-full">
                        <object data={`${url}#toolbar=0&navpanes=0&scrollbar=1`} type="application/pdf"
                            className="h-full w-full min-h-[600px] rounded-2xl border-0 bg-white shadow-2xl ring-1 ring-black/10 flex-1"
                            title={resource?.title}>
                            <iframe src={`${url}#toolbar=0&navpanes=0&scrollbar=1`} title={resource?.title}
                                className="h-full w-full min-h-[600px] rounded-2xl border-0 bg-white">
                                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-800 bg-white rounded-2xl h-full">
                                    <span className="text-4xl mb-3">📕</span>
                                    <p className="font-bold text-base mb-1 text-slate-900">{resource?.title || "PDF Document"}</p>
                                    <p className="text-xs text-slate-500 mb-4 max-w-sm">Tap below to view this document in your browser's native reader.</p>
                                    <a href={url} target="_blank" rel="noopener noreferrer"
                                        className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-cyan-500 transition">
                                        Open Full PDF ↗
                                    </a>
                                </div>
                            </iframe>
                        </object>
                    </div>
                )
            )}
        </div>
    );

    const ReaderBottomBar = () => (
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/10 bg-slate-900/90 text-[11px] text-slate-400">
            <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-slate-300">TedbabeLearnHUB Secured Reader</span>
                <span className="hidden sm:inline text-slate-500">• Protected Material</span>
            </span>
            <span className="font-mono text-[10px] text-cyan-300/80 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                {resource?.mimeType || "application/pdf"}
            </span>
        </div>
    );

    return (
        <>
            {/* Inline reader */}
            <div className="relative h-[80vh] min-h-[620px] w-full" onContextMenu={(e) => e.preventDefault()}>
                <div className="relative h-full w-full rounded-3xl p-1 bg-gradient-to-b from-blue-500/30 via-slate-700/20 to-transparent shadow-[0_20px_80px_rgba(0,102,255,0.22)] ring-1 ring-white/10 overflow-hidden flex flex-col bg-slate-950">
                    <ReaderToolbar />
                    <ReaderContent />
                    <ReaderBottomBar />
                </div>
            </div>

            {/* Full-screen expand overlay */}
            {isExpanded && (
                <div
                    className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/98 backdrop-blur-2xl"
                    onContextMenu={(e) => e.preventDefault()}
                    style={{ animation: "fadeInScale 0.2s ease" }}
                >
                    <style>{`
                        @keyframes fadeInScale {
                            from { opacity: 0; transform: scale(0.97); }
                            to { opacity: 1; transform: scale(1); }
                        }
                    `}</style>
                    <div className="relative h-full w-full flex flex-col overflow-hidden">
                        <ReaderToolbar inModal />
                        <ReaderContent />
                        <ReaderBottomBar />
                    </div>
                </div>
            )}
        </>
    );
}

function VideoThumbnail({ resource, lesson, className = "", aspect = "aspect-video" }) {
    const [imgFailed, setImgFailed] = useState(false);
    const ytUrl = resource?.sourceUrl || resource?.externalUrl || lesson?.videoUrl;
    const isYouTube = resource?.sourceType === "youtube" || (ytUrl && (ytUrl.includes("youtube.com") || ytUrl.includes("youtu.be")));
    const ytId = isYouTube ? getYouTubeVideoId(ytUrl) : null;
    const directVideoUrl = resource?.storedKey
        ? `${API_BASE_URL}/api/resources/${resource.storedKey}/file`
        : lesson?.videoUrl && !isYouTube
            ? lesson.videoUrl
            : null;

    if (ytId && !imgFailed) {
        return (
            <div className={`relative overflow-hidden rounded-xl bg-slate-900 ${aspect} ${className}`}>
                <img
                    src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                    alt={resource?.title || lesson?.title || "Video thumbnail"}
                    onError={() => setImgFailed(true)}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-center justify-center">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/90 text-white shadow-md transition group-hover:scale-110">
                        <svg className="h-3 w-3 fill-current ml-0.5" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </span>
                </div>
                <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[8px] font-bold text-white tracking-wider">
                    YouTube
                </span>
            </div>
        );
    }

    if (directVideoUrl) {
        return (
            <div className={`relative overflow-hidden rounded-xl bg-slate-950 ${aspect} ${className}`}>
                <video
                    src={`${directVideoUrl}#t=1`}
                    preload="metadata"
                    muted
                    playsInline
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-center justify-center">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--tlh-blue-primary)]/90 text-white shadow-md transition group-hover:scale-110">
                        <svg className="h-3 w-3 fill-current ml-0.5" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </span>
                </div>
                <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[8px] font-bold text-[var(--tlh-cyan)]">
                    VIDEO
                </span>
            </div>
        );
    }

    return (
        <div className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white ${aspect} ${className}`}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-emerald-400">
                <svg className="h-3 w-3 fill-current ml-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                </svg>
            </span>
            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[8px] font-bold text-slate-300">
                VIDEO
            </span>
        </div>
    );
}

const isVideoResource = (resource) => (
    resource.sourceType === "youtube" ||
    resource.category === "video" ||
    resource.mimeType?.startsWith("video/")
);

function DocVideoPlayer({ resource, resUrl: resUrlFn }) {
    const [docVideoExpanded, setDocVideoExpanded] = useState(false);
    const src = resUrlFn ? resUrlFn(`/api/resources/${resource.storedKey}/file`) : "";

    useEffect(() => {
        if (!docVideoExpanded) return undefined;
        const onKey = (e) => { if (e.key === "Escape") setDocVideoExpanded(false); };
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [docVideoExpanded]);

    return (
        <>
            <div className="rounded-3xl overflow-hidden ring-1 ring-white/10 shadow-2xl bg-black">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-white/10">
                    <span className="text-xs font-bold text-slate-200 truncate">{resource?.title}</span>
                    <button type="button" onClick={() => setDocVideoExpanded(true)}
                        className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 py-1 text-[11px] font-bold text-white border border-emerald-500/40 hover:from-emerald-500 hover:to-teal-500 transition"
                        title="Expand Video to Full View">
                        ⛶ Expand
                    </button>
                </div>
                <video
                    src={src}
                    controls
                    controlsList="nodownload"
                    onContextMenu={(e) => e.preventDefault()}
                    preload="metadata"
                    className="h-[70vh] w-full bg-black"
                    aria-label={resource?.title}
                />
            </div>
            {docVideoExpanded && (
                <div className="fixed inset-0 z-[9999] flex flex-col bg-black" style={{ animation: "fadeInScale 0.2s ease" }}>
                    <style>{`
                        @keyframes fadeInScale {
                            from { opacity: 0; transform: scale(0.97); }
                            to { opacity: 1; transform: scale(1); }
                        }
                    `}</style>
                    <div className="flex items-center justify-between px-5 py-3 bg-slate-900/90 border-b border-white/10">
                        <span className="text-xs font-bold text-slate-200 truncate">{resource?.title}</span>
                        <button type="button" onClick={() => setDocVideoExpanded(false)}
                            className="rounded-xl bg-rose-600/80 px-3 py-1.5 text-[11px] font-bold text-white border border-rose-500/40 hover:bg-rose-600 transition">
                            ✕ Exit Full View
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-black">
                        <video
                            src={src}
                            controls
                            autoPlay
                            controlsList="nodownload"
                            onContextMenu={(e) => e.preventDefault()}
                            className="w-full h-full object-contain bg-black"
                        />
                    </div>
                </div>
            )}
        </>
    );
}

export function LearningWorkspace() {
    const { classroomId } = useParams();
    const { user } = useAuth();
    const isAdmin = Boolean(user && (user.role === "admin" || user.role === "hub_admin"));
    const isStudent = Boolean(user?.role === "student");

    const [classroom, setClassroom] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [resources, setResources] = useState([]);
    const [discussions, setDiscussions] = useState([]);
    const [trackingStats, setTrackingStats] = useState(null);
    const [trackingData, setTrackingData] = useState(null); // full tracking response
    // Honour ?tab=tracking (admin deep-link from AdminDashboard)
    const [activeTab, setActiveTab] = useState(() => {
        const tab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null;
        return tab || "player";
    });
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState("");
    const [workspaceNow, setWorkspaceNow] = useState(() => Date.now());

    // Video Player state
    const [currentLesson, setCurrentLesson] = useState(null);
    const [playbackRate, setPlaybackRate] = useState(1);
    const videoRef = useRef(null);
    const [selectedVideoResource, setSelectedVideoResource] = useState(null);
    const [videoExpanded, setVideoExpanded] = useState(false);

    // Dismiss video expanded overlay on Escape key
    useEffect(() => {
        if (!videoExpanded) return undefined;
        const onKey = (e) => { if (e.key === "Escape") setVideoExpanded(false); };
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [videoExpanded]);

    // Discussion modal / form state
    const [newThreadModal, setNewThreadModal] = useState(false);
    const [threadTitle, setThreadTitle] = useState("");
    const [threadContent, setThreadContent] = useState("");
    const [threadCategory, setThreadCategory] = useState("general");
    const [replyContent, setReplyContent] = useState({});

    // Document Viewer state
    const [selectedDoc, setSelectedDoc] = useState(null);
    const videoResources = useMemo(() => resources.filter(isVideoResource), [resources]);
    const courseMaterials = useMemo(
        () => resources.filter((resource) => !isVideoResource(resource)),
        [resources],
    );

    // Load workspace data
    const loadWorkspace = useCallback(async () => {
        try {
            setLoading(true);
            const isTeacher = user?.role === "teacher";
            const apiPrefix = isAdmin ? "/api/admin" : isTeacher ? "/api/teacher" : "/api/student";

            // Fetch classes list to find this classroom
            const classesRes = await apiRequest(`${apiPrefix}/classes`);
            let matchedClass = (classesRes.classes || []).find((c) => String(c._id) === String(classroomId));

            if (!matchedClass && isAdmin) {
                try {
                    const singleRes = await apiRequest(`/api/admin/classes/${classroomId}`);
                    if (singleRes?.classroom) {
                        matchedClass = singleRes.classroom;
                    }
                } catch {
                    // Non-blocking
                }
            }

            if (!matchedClass) {
                setFeedback("Classroom not found or you are not enrolled.");
                setLoading(false);
                return;
            }
            setClassroom(matchedClass);

            if (isAdmin) {
                try {
                    const trackRes = await apiRequest(`/api/admin/classes/${classroomId}/tracking`);
                    if (trackRes?.stats) {
                        setTrackingStats(trackRes.stats);
                    }
                    setTrackingData(trackRes || null);
                } catch {
                    // Non-blocking for oversight view
                }
            }

            // Fetch classroom sessions if available
            if (classesRes.sessions) {
                setSessions(classesRes.sessions.filter((session) => (
                    (session.classroom?._id || session.classroom)?.toString() === classroomId
                )));
            }

            // Fetch resources
            const resRes = await apiRequest("/api/resources");
            const classResources = (resRes.resources || []).filter(
                (r) => r.classroom?._id === classroomId || r.classroom === classroomId
            );
            setResources(classResources);
            const targetResId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("resourceId") : null;
            const targetRes = targetResId ? classResources.find((r) => r._id === targetResId) : null;
            if (targetRes) {
                if (isVideoResource(targetRes)) {
                    setSelectedVideoResource(targetRes);
                    setActiveTab("player");
                } else {
                    setSelectedDoc(targetRes);
                    setActiveTab("documents");
                }
            } else {
                setSelectedDoc((current) => current || classResources.find((resource) => !isVideoResource(resource)) || null);
                setSelectedVideoResource((current) => current || classResources.find(isVideoResource) || null);
            }

            // Fetch discussions
            const discRes = await apiRequest(`${apiPrefix}/classes/${classroomId}/discussions`);
            setDiscussions(discRes.discussions || []);

            // Set default lesson
            if (matchedClass.course?.modules?.[0]?.lessons?.[0]) {
                setCurrentLesson(matchedClass.course.modules[0].lessons[0]);
            } else {
                setCurrentLesson({
                    title: "Welcome to " + (matchedClass.title || "Course"),
                    description: "Orientation, learning objectives, and cohort introduction.",
                    durationMinutes: 30,
                    videoUrl: "",
                });
            }
        } catch (err) {
            setFeedback(err.message || "Failed to load classroom workspace.");
        } finally {
            setLoading(false);
        }
    }, [classroomId, user, isAdmin]);

    useEffect(() => {
        void loadWorkspace();
    }, [loadWorkspace]);

    useEffect(() => {
        const timer = window.setInterval(() => setWorkspaceNow(Date.now()), 15_000);
        return () => window.clearInterval(timer);
    }, []);

    // Resume video progress
    useEffect(() => {
        if (!videoRef.current) return;
        const progressId = selectedVideoResource?._id || currentLesson?.title;
        if (!progressId) return;
        const savedTime = localStorage.getItem(`tlh_video_progress_${progressId}`);
        if (savedTime && parseFloat(savedTime) > 0) {
            videoRef.current.currentTime = parseFloat(savedTime);
        }
    }, [currentLesson, selectedVideoResource]);

    const nextSession = useMemo(() => {
        const activeSession = sessions.find((session) => (
            session.status === "scheduled" &&
            new Date(session.startsAt).getTime() <= workspaceNow &&
            new Date(session.endsAt).getTime() > workspaceNow
        ));
        return activeSession || sessions.find((session) => (
            session.status === "scheduled" && new Date(session.endsAt).getTime() > workspaceNow
        ));
    }, [sessions, workspaceNow]);

    const handleTimeUpdate = () => {
        const progressId = selectedVideoResource?._id || currentLesson?.title;
        if (videoRef.current && progressId) {
            localStorage.setItem(
                `tlh_video_progress_${progressId}`,
                String(videoRef.current.currentTime)
            );
        }
    };

    // Helper to build an absolute API resource URL so browser-native requests
    // (e.g. <a download>, <video src>, <iframe src>) always reach the backend
    // regardless of whether a Vite proxy is active or not.
    const resUrl = (path) => `${API_BASE_URL}${path}`;

    const handleSpeedChange = (rate) => {
        setPlaybackRate(rate);
        if (videoRef.current) {
            videoRef.current.playbackRate = rate;
        }
    };

    // Discussion thread submission
    const handleCreateThread = async (e) => {
        e.preventDefault();
        try {
            const apiPrefix = isAdmin ? "/api/admin" : user?.role === "teacher" ? "/api/teacher" : "/api/student";
            const res = await apiRequest(`${apiPrefix}/classes/${classroomId}/discussions`, {
                method: "POST",
                body: JSON.stringify({
                    title: threadTitle,
                    content: threadContent,
                    category: threadCategory,
                }),
            });
            setDiscussions([res.discussion, ...discussions]);
            setNewThreadModal(false);
            setThreadTitle("");
            setThreadContent("");
            setFeedback("Discussion thread created.");
        } catch (err) {
            setFeedback(err.message || "Could not create discussion topic.");
        }
    };

    const handleAddReply = async (discussionId) => {
        const text = replyContent[discussionId];
        if (!text || !text.trim()) return;
        try {
            const apiPrefix = isAdmin ? "/api/admin" : user?.role === "teacher" ? "/api/teacher" : "/api/student";
            const res = await apiRequest(`${apiPrefix}/classes/${classroomId}/discussions/${discussionId}/reply`, {
                method: "POST",
                body: JSON.stringify({ content: text.trim() }),
            });
            setDiscussions(discussions.map((d) => (d._id === discussionId ? res.discussion : d)));
            setReplyContent({ ...replyContent, [discussionId]: "" });
        } catch (err) {
            setFeedback(err.message || "Could not post reply.");
        }
    };

    const handleDeleteThread = async (discussionId) => {
        if (!window.confirm("Remove this discussion topic as an administrator?")) return;
        try {
            await apiRequest(`/api/admin/classes/${classroomId}/discussions/${discussionId}`, {
                method: "DELETE",
            });
            setDiscussions((prev) => prev.filter((d) => d._id !== discussionId));
            setFeedback("Discussion topic removed by administrator.");
        } catch (err) {
            setFeedback(err.message || "Failed to remove discussion topic.");
        }
    };

    if (loading) {
        return (
            <div className="editorial-page flex min-h-[60vh] items-center justify-center">
                <div className="flex items-center gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent"></div>
                    <span className="text-sm font-bold text-stone-700">Loading learning workspace…</span>
                </div>
            </div>
        );
    }

    if (!classroom) {
        return (
            <div className="editorial-page mx-auto max-w-3xl px-4 py-20 text-center">
                <div className="rounded-3xl bg-white p-12 ring-1 ring-stone-200 shadow-sm">
                    <h2 className="text-2xl font-bold text-stone-900">Workspace Unavailable</h2>
                    <p className="mt-2 text-xs text-stone-500">{feedback || "You do not have access to this classroom."}</p>
                    <Link to="/dashboard" className="editorial-button mt-6 text-xs font-bold">
                        ← Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="learning-workspace editorial-page min-h-screen pb-24 lg:pl-72">
            <DashboardSidebar
                title="Learning space"
                user={user}
                backHref="/dashboard"
                tabs={[
                    { id: "player", label: "Interactive Video", icon: "🎬" },
                    { id: "documents", label: `Course Materials (${courseMaterials.length})`, icon: "📄" },
                    { id: "discussions", label: `Cohort Discussions (${discussions.length})`, icon: "💬" },
                    ...(isAdmin ? [{ id: "tracking", label: `Cohort Tracking (${classroom.students?.length || 0})`, icon: "📊" }] : []),
                ]}
                activeTab={activeTab}
                onSelect={setActiveTab}
            />
            {/* Workspace Header Topbar */}
            <div className="sticky top-16 z-30 border-b border-stone-200/90 bg-white/95 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Link to="/dashboard" className="text-xs font-bold text-stone-500 hover:text-stone-900">
                                ← Back to Dashboard
                            </Link>
                            <span className="text-stone-300">/</span>
                            <span className="text-xs font-bold text-[var(--tlh-blue-primary)] uppercase tracking-wider">
                                {classroom.course?.title || "Cohort Workspace"}
                            </span>
                        </div>
                        <h1 className="editorial-display mt-0.5 text-xl font-bold text-stone-900 sm:text-2xl">
                            {classroom.title}
                        </h1>
                    </div>

                    {/* Live Meeting Action */}
                    <div className="flex items-center gap-3">
                        {nextSession ? (
                            <div className="flex flex-col items-end gap-1">
                                <p className="text-right text-[11px] font-semibold text-stone-600">
                                    {nextSession.title} · {formatSessionTime(nextSession.startsAt)}
                                </p>
                                <LiveSessionButton session={nextSession} />
                                {nextSession.meetingUrl ? (
                                    <span className="text-[10px] text-stone-500">Google Meet opens in a new tab.</span>
                                ) : null}
                            </div>
                        ) : (
                            <span className="rounded-xl bg-stone-100 px-3 py-1.5 text-[11px] font-semibold text-stone-500">
                                No upcoming live session
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
                {isAdmin && (
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-300/40 bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50/60 p-4 shadow-sm dark:border-sky-500/20 dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] text-xs font-black text-white shadow-sm">
                                TLH
                            </span>
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                    Administrator Oversight Mode
                                </p>
                                <p className="text-xs text-[var(--tlh-blue-primary)] dark:text-sky-300">
                                    You have full administrative visibility to track live sessions, lesson media, student attendance, and discussions in this cohort.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab("tracking")}
                                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${activeTab === "tracking" ? "golden-btn shadow-sm" : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
                            >
                                📊 Track Cohort Space
                            </button>
                            <Link
                                to="/dashboard"
                                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white transition hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                                ← Admin Dashboard
                            </Link>
                        </div>
                    </div>
                )}

                {/* Prominent Live Session Spotlight */}
                {nextSession && (
                    <div className="mb-6 overflow-hidden rounded-3xl border border-[var(--tlh-cyan)]/30 bg-gradient-to-r from-[#071B49] via-[#050E24] to-slate-950 dark:from-[#050E24] dark:via-[#091124] dark:to-slate-950 p-6 sm:p-7 text-white shadow-2xl">
                        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--tlh-cyan)]/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-[var(--tlh-cyan)] border border-[var(--tlh-cyan)]/30">
                                        <span className="h-2 w-2 rounded-full bg-[var(--tlh-cyan)] animate-ping" />
                                        <span>Scheduled Live Session</span>
                                    </span>
                                    <span className="text-xs font-semibold text-slate-400">
                                        Cohort: <span className="text-slate-200 font-bold">{classroom.title}</span>
                                    </span>
                                </div>
                                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                                    {nextSession.title}
                                </h2>
                                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                                    <span className="flex items-center gap-1.5">
                                        <span className="text-teal-400">📅</span>
                                        <span>{formatSessionTime(nextSession.startsAt)} — {formatSessionTime(nextSession.endsAt)}</span>
                                    </span>
                                    <span className="text-amber-300 font-medium">
                                        🔒 Meeting link activates 10 minutes before class
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                <LiveSessionButton session={nextSession} />
                            </div>
                        </div>
                    </div>
                )}

                {feedback && (
                    <div className="mt-4 rounded-2xl bg-sky-50 p-3.5 text-xs font-bold text-blue-900 ring-1 ring-sky-200 flex justify-between items-center">
                        <span>{feedback}</span>
                        <button onClick={() => setFeedback("")} className="text-blue-600 hover:text-blue-900">✕</button>
                    </div>
                )}

                {/* TAB 1: Lessons & Video Player */}
                {activeTab === "player" && (
                    <div className="mt-6 grid gap-8 lg:grid-cols-3">
                        {/* Video Player Column */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Video player expanded overlay */}
                            {videoExpanded && (
                                <div
                                    className="fixed inset-0 z-[9999] flex flex-col bg-black"
                                    style={{ animation: "fadeInScale 0.2s ease" }}
                                >
                                    <style>{`
                                    @keyframes fadeInScale {
                                        from { opacity: 0; transform: scale(0.97); }
                                        to { opacity: 1; transform: scale(1); }
                                    }
                                `}</style>
                                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-slate-900/90 backdrop-blur-md">
                                        <div className="flex items-center gap-2">
                                            <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                                            <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                                            <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                                            <span className="ml-3 text-xs font-bold text-slate-200 truncate max-w-xs sm:max-w-lg">
                                                {selectedVideoResource?.title || currentLesson?.title || "Classroom Player"}
                                            </span>
                                        </div>
                                        <button type="button" onClick={() => setVideoExpanded(false)}
                                            className="rounded-xl bg-rose-600/80 px-3 py-1.5 text-[11px] font-bold text-white border border-rose-500/40 hover:bg-rose-600 transition">
                                            ✕ Exit Full View
                                        </button>
                                    </div>
                                    <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
                                        {selectedVideoResource?.sourceType === "youtube" ? (
                                            <iframe
                                                src={`https://www.youtube-nocookie.com/embed/${getYouTubeVideoId(selectedVideoResource.sourceUrl || selectedVideoResource.externalUrl)}?rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&controls=1&fs=1&autoplay=1`}
                                                title={selectedVideoResource.title}
                                                className="w-full h-full border-0 bg-black"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                referrerPolicy="strict-origin-when-cross-origin"
                                                allowFullScreen
                                            />
                                        ) : selectedVideoResource?.sourceType === "google_drive" ? (
                                            <iframe
                                                src={selectedVideoResource.externalUrl}
                                                title={selectedVideoResource.title}
                                                className="w-full h-full border-0 bg-black"
                                                referrerPolicy="no-referrer"
                                                allow="autoplay"
                                                allowFullScreen
                                            />
                                        ) : selectedVideoResource ? (
                                            <video
                                                src={resUrl(`/api/resources/${selectedVideoResource.storedKey}/file`)}
                                                controls
                                                autoPlay
                                                controlsList="nodownload"
                                                onContextMenu={(e) => e.preventDefault()}
                                                onTimeUpdate={handleTimeUpdate}
                                                className="w-full h-full object-contain bg-black"
                                            />
                                        ) : currentLesson?.videoUrl ? (
                                            <video
                                                src={currentLesson.videoUrl}
                                                controls
                                                autoPlay
                                                controlsList="nodownload"
                                                onContextMenu={(e) => e.preventDefault()}
                                                onTimeUpdate={handleTimeUpdate}
                                                className="w-full h-full object-contain bg-black"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                                                <span className="text-5xl mb-4">📺</span>
                                                <p className="font-bold text-white text-lg">No video available</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="relative rounded-3xl p-1 bg-gradient-to-b from-cyan-400/35 via-slate-700/25 to-transparent shadow-[0_25px_95px_rgba(0,102,255,0.28)] ring-1 ring-white/15">
                                <div className="relative rounded-[22px] overflow-hidden bg-slate-950 backdrop-blur-xl">
                                    {/* Top Media Bar / Window Frame */}
                                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-slate-900/90 backdrop-blur-md">
                                        <div className="flex items-center gap-2">
                                            <span className="h-3 w-3 rounded-full bg-rose-500/80 shadow-xs" />
                                            <span className="h-3 w-3 rounded-full bg-amber-500/80 shadow-xs" />
                                            <span className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-xs" />
                                            <span className="ml-3 text-xs font-bold text-slate-200 truncate max-w-xs sm:max-w-md">
                                                {selectedVideoResource?.title || currentLesson?.title || "Classroom Player"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                            <span className="rounded-md bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/25">
                                                1080p Studio HD
                                            </span>
                                            <span className="hidden sm:inline-block rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                                                {selectedVideoResource?.sourceType === "youtube" ? "Interactive Video" : "Live Session Lab"}
                                            </span>
                                            <button type="button" onClick={() => setVideoExpanded(true)}
                                                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 py-1 text-[11px] font-bold text-white border border-emerald-500/40 hover:from-emerald-500 hover:to-teal-500 transition"
                                                title="Expand Video to Full View">
                                                ⛶ Expand
                                            </button>
                                        </div>
                                    </div>

                                    {/* Video Canvas */}
                                    {selectedVideoResource?.sourceType === "youtube" ? (
                                        <iframe
                                            src={`https://www.youtube-nocookie.com/embed/${getYouTubeVideoId(selectedVideoResource.sourceUrl || selectedVideoResource.externalUrl)}?rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&controls=1&fs=1`}
                                            title={selectedVideoResource.title}
                                            className="w-full aspect-video border-0 bg-black"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            referrerPolicy="strict-origin-when-cross-origin"
                                            allowFullScreen
                                        />
                                    ) : selectedVideoResource?.sourceType === "google_drive" ? (
                                        <iframe
                                            src={selectedVideoResource.externalUrl}
                                            title={selectedVideoResource.title}
                                            className="w-full aspect-video border-0 bg-black"
                                            referrerPolicy="no-referrer"
                                            allow="autoplay"
                                            allowFullScreen
                                        />
                                    ) : selectedVideoResource ? (
                                        <video
                                            ref={videoRef}
                                            src={resUrl(`/api/resources/${selectedVideoResource.storedKey}/file`)}
                                            controls
                                            controlsList="nodownload"
                                            onContextMenu={(e) => e.preventDefault()}
                                            onTimeUpdate={handleTimeUpdate}
                                            className="w-full aspect-video bg-black"
                                        />
                                    ) : currentLesson?.videoUrl ? (
                                        <video
                                            ref={videoRef}
                                            src={currentLesson.videoUrl}
                                            controls
                                            controlsList="nodownload"
                                            onContextMenu={(e) => e.preventDefault()}
                                            onTimeUpdate={handleTimeUpdate}
                                            className="w-full aspect-video bg-black"
                                        />
                                    ) : (
                                        <div className="aspect-video flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 p-8 text-center">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-950/60 border border-cyan-500/30 text-2xl text-cyan-400 mb-3 shadow-lg shadow-cyan-500/10">
                                                📺
                                            </div>
                                            <h3 className="text-base font-bold text-white">{currentLesson?.title || "Cohort Video Lab"}</h3>
                                            <p className="mt-1 text-xs text-slate-400 max-w-sm">
                                                Guided lesson notes and teacher live instructions are provided in scheduled Google Meet sessions.
                                            </p>
                                        </div>
                                    )}

                                    {/* Custom Player Controls Toolbar */}
                                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-slate-900/90 px-6 py-3.5 text-xs">
                                        {selectedVideoResource?.sourceType !== "youtube" ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400 font-semibold">Speed:</span>
                                                {[0.75, 1, 1.25, 1.5, 2].map((spd) => (
                                                    <button
                                                        key={spd}
                                                        type="button"
                                                        onClick={() => handleSpeedChange(spd)}
                                                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${playbackRate === spd
                                                            ? "bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/30"
                                                            : "bg-white/10 text-white hover:bg-white/20"
                                                            }`}
                                                    >
                                                        {spd}x
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                                                <span>▶ Interactive HD Stream</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                                {selectedVideoResource?.sourceType === "youtube" ? "YouTube Verified Embed" : "Progress Auto-Saved"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Lesson Overview Card */}
                            <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                    {selectedVideoResource ? "VIDEO RESOURCE" : "CURRENT LESSON"}
                                </span>
                                <h2 className="editorial-display mt-1 text-2xl font-bold text-stone-900">
                                    {selectedVideoResource?.title || currentLesson?.title}
                                </h2>
                                <p className="mt-2 text-xs text-stone-600 leading-relaxed">
                                    {selectedVideoResource?.description || currentLesson?.description || "In this session, learners review core concepts, discuss practice exercises, and interact with the instructor."}
                                </p>
                            </div>
                        </div>

                        {/* Lessons Syllabus Sidebar */}
                        <div className="space-y-4">
                            {videoResources.length > 0 && (
                                <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-stone-500">
                                            Interactive Videos ({videoResources.length})
                                        </h3>
                                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                            Lessons
                                        </span>
                                    </div>
                                    <div className="space-y-2.5 max-h-[30rem] overflow-y-auto pr-1">
                                        {videoResources.map((resource) => {
                                            const isSelected = selectedVideoResource?._id === resource._id;
                                            return (
                                                <button
                                                    key={resource._id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedVideoResource(resource);
                                                        setCurrentLesson(null);
                                                    }}
                                                    className={`group flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-all ${isSelected
                                                        ? "bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] text-white shadow-md ring-2 ring-blue-500/40"
                                                        : "bg-stone-50 text-stone-800 hover:bg-stone-100"
                                                        }`}
                                                >
                                                    <div className="w-24 shrink-0 sm:w-28">
                                                        <VideoThumbnail resource={resource} aspect="aspect-video" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`line-clamp-2 text-xs font-bold ${isSelected ? "text-white" : "text-stone-900 group-hover:text-emerald-950"}`}>
                                                            {resource.title}
                                                        </p>
                                                        <p className={`mt-1 text-[10px] ${isSelected ? "text-emerald-200" : "text-stone-500"}`}>
                                                            {resource.sourceType === "youtube" ? "YouTube Stream" : "Uploaded Lesson"}
                                                        </p>
                                                        {isSelected && (
                                                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                                Now Playing
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
                                <h3 className="text-xs font-black uppercase tracking-wider text-stone-500 mb-4">
                                    Syllabus Modules
                                </h3>
                                <div className="space-y-3">
                                    {classroom.course?.modules?.length > 0 ? (
                                        classroom.course.modules.map((mod, mIdx) => (
                                            <div key={mIdx} className="space-y-1.5">
                                                <div className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                                                    {mod.title}
                                                </div>
                                                <div className="space-y-1.5">
                                                    {mod.lessons.map((les, lIdx) => {
                                                        const isSelected = currentLesson?.title === les.title;
                                                        return (
                                                            <button
                                                                key={lIdx}
                                                                type="button"
                                                                onClick={() => {
                                                                    setCurrentLesson(les);
                                                                    setSelectedVideoResource(null);
                                                                }}
                                                                className={`group flex w-full items-center gap-3 rounded-2xl p-2 text-left text-xs transition ${isSelected
                                                                    ? "bg-emerald-800 text-white font-bold"
                                                                    : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                                                                    }`}
                                                            >
                                                                {les.videoUrl ? (
                                                                    <div className="w-16 shrink-0">
                                                                        <VideoThumbnail lesson={les} aspect="aspect-video" />
                                                                    </div>
                                                                ) : (
                                                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/60 text-xs text-stone-500 shadow-2xs">
                                                                        📄
                                                                    </span>
                                                                )}
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="line-clamp-1">{les.title}</p>
                                                                    <span className={`text-[10px] font-mono ${isSelected ? "text-emerald-200" : "text-stone-400"}`}>
                                                                        {les.durationMinutes}m
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-xs text-stone-500">
                                            Teacher conducts live lessons according to the cohort schedule.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: In-Browser Document & PDF Viewer */}
                {activeTab === "documents" && (
                    <div className="mt-6 grid gap-8 lg:grid-cols-3">
                        <div className="lg:col-span-2 space-y-4">
                            {selectedDoc ? (
                                <div className="space-y-4">
                                    {/* Direct In-Browser Document & Material Preview */}
                                    <div className="w-full" onContextMenu={(e) => e.preventDefault()}>
                                        {selectedDoc.sourceType === "google_drive" ? (
                                            <div className="rounded-3xl overflow-hidden ring-1 ring-white/10 shadow-2xl bg-slate-950">
                                                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-slate-900/90 text-xs text-slate-300">
                                                    <span className="font-bold truncate">{selectedDoc.title}</span>
                                                    <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">Google Drive Cloud Preview</span>
                                                </div>
                                                <iframe
                                                    src={selectedDoc.externalUrl}
                                                    title={selectedDoc.title}
                                                    className="h-[75vh] min-h-[550px] w-full border-0 bg-white"
                                                    referrerPolicy="no-referrer"
                                                    allow="autoplay"
                                                />
                                            </div>
                                        ) : selectedDoc.mimeType?.startsWith("video/") ? (
                                            <DocVideoPlayer resource={selectedDoc} resUrl={resUrl} />
                                        ) : (selectedDoc.mimeType?.includes("pdf") || selectedDoc.category === "pdf" || /\.pdf$/i.test(selectedDoc.originalFilename || "")) ? (
                                            <ProtectedDocumentPreview resource={selectedDoc} kind="document" />
                                        ) : selectedDoc.mimeType?.includes("image") ? (
                                            <ProtectedDocumentPreview resource={selectedDoc} kind="image" />
                                        ) : (
                                            <div className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm">
                                                <OfficeDocumentPreview resource={selectedDoc} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-3xl bg-white p-12 text-center ring-1 ring-stone-200">
                                    <p className="text-xs text-stone-500">No course materials have been added for this cohort yet.</p>
                                </div>
                            )}
                        </div>

                        {/* Resources List Sidebar — all resource types */}
                        <div className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-wider text-stone-500 mb-2">
                                Available Materials ({resources.length})
                            </h3>
                            {resources.length === 0 && (
                                <p className="text-xs text-stone-400">No materials have been added for this cohort yet.</p>
                            )}
                            {resources.map((res) => {
                                const isVideo = isVideoResource(res);
                                const isSelected = isVideo
                                    ? selectedVideoResource?._id === res._id
                                    : selectedDoc?._id === res._id;
                                const isPresentation = res.category === "slide" || /\.(pptx?|odp)$/i.test(res.originalFilename || "");
                                const isSpreadsheet = res.category === "spreadsheet" || /\.(xlsx?|csv|ods)$/i.test(res.originalFilename || "");
                                const isPdf = res.mimeType?.includes("pdf") || res.category === "pdf" || /\.pdf$/i.test(res.originalFilename || "");
                                const fileIcon = res.sourceType === "google_drive" ? "☁️"
                                    : isPdf ? "📕"
                                        : isPresentation ? "📊"
                                            : isSpreadsheet ? "📈"
                                                : res.mimeType?.includes("image") ? "🖼️"
                                                    : "📄";
                                return (
                                    <button
                                        key={res._id}
                                        type="button"
                                        onClick={() => {
                                            if (isVideo) {
                                                setSelectedVideoResource(res);
                                                setActiveTab("player");
                                            } else {
                                                setSelectedDoc(res);
                                                setActiveTab("documents");
                                            }
                                        }}
                                        className={`group flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${isSelected
                                            ? "bg-emerald-50 ring-2 ring-emerald-400"
                                            : "bg-stone-50 hover:bg-stone-100"
                                            }`}
                                    >
                                        {isVideo ? (
                                            <div className="w-20 sm:w-24 shrink-0">
                                                <VideoThumbnail resource={res} aspect="aspect-video" />
                                            </div>
                                        ) : (
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-xs ring-1 ring-stone-200">
                                                {fileIcon}
                                            </span>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-stone-900 line-clamp-1 group-hover:text-emerald-950">{res.title}</p>
                                            <p className="text-[10px] text-stone-500">
                                                {res.sourceType === "youtube" ? "YouTube video"
                                                    : res.sourceType === "google_drive" ? `Google Drive · ${res.category}`
                                                        : res.fileSize ? `${(res.fileSize / 1024 / 1024).toFixed(1)} MB · ${res.category}`
                                                            : res.category}
                                            </p>
                                        </div>
                                        {isVideo && (
                                            <span className="shrink-0 text-[9px] font-black uppercase tracking-wider rounded-md bg-emerald-100 text-emerald-800 px-1.5 py-0.5">
                                                Watch
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* TAB 3: Cohort Discussions */}
                {activeTab === "discussions" && (
                    <div className="mt-6 max-w-4xl mx-auto space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-stone-900">Cohort Discussion Board</h2>
                                <p className="text-xs text-stone-500">Collaborate with fellow students and your instructor.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setNewThreadModal(true)}
                                className="golden-btn rounded-full px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
                            >
                                + New Discussion Topic
                            </button>
                        </div>

                        {discussions.length === 0 ? (
                            <div className="rounded-3xl bg-white p-12 text-center ring-1 ring-stone-200">
                                <span className="text-3xl block mb-2">💬</span>
                                <h3 className="font-bold text-stone-900 text-sm">No discussions yet</h3>
                                <p className="text-xs text-stone-500 mt-1">Start a conversation or ask your teacher a question.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {discussions.map((disc) => (
                                    <div
                                        key={disc._id}
                                        className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm space-y-4"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-700 uppercase">
                                                        {disc.category}
                                                    </span>
                                                    {disc.isPinned && (
                                                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                                            PINNED
                                                        </span>
                                                    )}
                                                    {isAdmin && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteThread(disc._id)}
                                                            className="ml-auto text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline"
                                                        >
                                                            ✕ Delete Topic (Admin)
                                                        </button>
                                                    )}
                                                </div>
                                                <h3 className="font-bold text-stone-900 text-base mt-1.5">{disc.title}</h3>
                                                <p className="text-xs text-stone-500">
                                                    By <strong>{disc.author?.fullName || "Member"}</strong> ({disc.author?.role}) ·{" "}
                                                    {new Date(disc.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>

                                        <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">
                                            {disc.content}
                                        </p>

                                        {/* Replies list */}
                                        {disc.replies?.length > 0 && (
                                            <div className="border-t border-stone-100 pt-3 space-y-2.5">
                                                <p className="text-[11px] font-bold text-stone-500">
                                                    Replies ({disc.replies.length}):
                                                </p>
                                                {disc.replies.map((rep, rIdx) => (
                                                    <div key={rIdx} className="rounded-2xl bg-stone-50 p-3 text-xs">
                                                        <div className="font-bold text-stone-800 flex items-center justify-between">
                                                            <span>{rep.author?.fullName || "Member"}</span>
                                                            <span className="text-[10px] font-normal text-stone-400">
                                                                {new Date(rep.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 text-stone-600">{rep.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add Reply Input */}
                                        <div className="flex gap-2 pt-2 border-t border-stone-100">
                                            <input
                                                type="text"
                                                value={replyContent[disc._id] || ""}
                                                onChange={(e) =>
                                                    setReplyContent({ ...replyContent, [disc._id]: e.target.value })
                                                }
                                                placeholder="Write a reply…"
                                                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs outline-none focus:border-emerald-700"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAddReply(disc._id)}
                                                className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 shrink-0"
                                            >
                                                Reply
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 4 (Admin only): Cohort Tracking */}
                {isAdmin && activeTab === "tracking" && (
                    <div className="mt-6 space-y-8">
                        {/* ── KPI Cards ── */}
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                            {[
                                { icon: "🎓", label: "Learners", value: trackingStats?.totalStudents ?? "—", sub: `of ${trackingStats?.capacity ?? "—"} capacity` },
                                { icon: "📊", label: "Fill Rate", value: trackingStats?.fillRate != null ? `${trackingStats.fillRate}%` : "—", sub: "enrolled" },
                                { icon: "📅", label: "Sessions", value: trackingStats?.totalSessions ?? "—", sub: `${trackingStats?.completedSessions ?? 0} completed` },
                                { icon: "📁", label: "Resources", value: trackingStats?.totalResources ?? "—", sub: "uploaded" },
                                { icon: "📝", label: "Assignments", value: trackingStats?.totalAssignments ?? "—", sub: "created" },
                                { icon: "💬", label: "Discussions", value: trackingStats?.discussionsCount ?? "—", sub: "threads" },
                            ].map((kpi) => (
                                <div key={kpi.label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 flex flex-col gap-1">
                                    <span className="text-xl">{kpi.icon}</span>
                                    <p className="text-2xl font-black text-stone-900">{kpi.value}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{kpi.label}</p>
                                    <p className="text-[10px] text-stone-400">{kpi.sub}</p>
                                </div>
                            ))}
                        </div>

                        {/* ── Fill-rate bar ── */}
                        {trackingStats?.fillRate != null && (
                            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-600">Cohort Capacity Fill</span>
                                    <span className="text-xs font-bold text-[var(--tlh-blue-primary)]">{trackingStats.fillRate}%</span>
                                </div>
                                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-cyan)] transition-all"
                                        style={{ width: `${Math.min(trackingStats.fillRate, 100)}%` }}
                                    />
                                </div>
                                <p className="mt-1.5 text-[11px] text-stone-500">
                                    {trackingStats.totalStudents} learners enrolled out of {trackingStats.capacity} seats
                                </p>
                            </div>
                        )}

                        {/* ── Instructor Info ── */}
                        {(trackingData?.cohort?.teacher) && (
                            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
                                <h3 className="text-xs font-black uppercase tracking-wider text-stone-500 mb-3">Assigned Instructor</h3>
                                <div className="flex items-center gap-3">
                                    {trackingData.cohort.teacher.avatarUrl ? (
                                        <img
                                            src={trackingData.cohort.teacher.avatarUrl}
                                            alt={trackingData.cohort.teacher.fullName}
                                            className="h-11 w-11 rounded-xl object-cover ring-1 ring-stone-200"
                                        />
                                    ) : (
                                        <div className="h-11 w-11 rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] flex items-center justify-center text-xs font-black text-white shadow-sm">
                                            {(trackingData.cohort.teacher.fullName || "T").slice(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm font-bold text-stone-900">{trackingData.cohort.teacher.fullName || trackingData.cohort.teacher.name}</p>
                                        <p className="text-xs text-stone-500">{trackingData.cohort.teacher.email}</p>
                                    </div>
                                    <span className="ml-auto rounded-lg bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-800 ring-1 ring-sky-200">
                                        Instructor
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* ── Enrolled Learners Roster ── */}
                        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
                            <h3 className="text-xs font-black uppercase tracking-wider text-stone-500 mb-4">
                                Enrolled Learners ({trackingData?.cohort?.students?.length || 0})
                            </h3>
                            {(trackingData?.cohort?.students?.length ?? 0) === 0 ? (
                                <p className="text-xs text-stone-400">No learners enrolled yet.</p>
                            ) : (
                                <div className="divide-y divide-stone-100">
                                    {trackingData.cohort.students.map((student, idx) => (
                                        <div key={student._id || idx} className="flex items-center gap-3 py-3">
                                            {student.avatarUrl ? (
                                                <img
                                                    src={student.avatarUrl}
                                                    alt={student.fullName}
                                                    className="h-9 w-9 rounded-xl object-cover ring-1 ring-stone-200"
                                                />
                                            ) : (
                                                <div className="h-9 w-9 shrink-0 rounded-xl bg-stone-200 flex items-center justify-center text-[10px] font-black text-stone-600">
                                                    {(student.fullName || student.name || "S").slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-stone-900 truncate">{student.fullName || student.name}</p>
                                                <p className="text-[10px] text-stone-500 truncate">{student.email}</p>
                                            </div>
                                            <span className="rounded-lg bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600 uppercase tracking-wider">
                                                Enrolled
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Live Session Tracker ── */}
                        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
                            <h3 className="text-xs font-black uppercase tracking-wider text-stone-500 mb-4">
                                Session Schedule ({trackingData?.sessions?.length || 0} sessions)
                            </h3>
                            {(trackingData?.sessions?.length ?? 0) === 0 ? (
                                <p className="text-xs text-stone-400">No sessions scheduled for this cohort.</p>
                            ) : (
                                <div className="space-y-3">
                                    {trackingData.sessions.map((sess) => {
                                        const start = new Date(sess.startsAt);
                                        const end = new Date(sess.endsAt);
                                        const isLiveNow = Date.now() >= start.getTime() && Date.now() < end.getTime();
                                        const isCompleted = sess.status === "completed" || end.getTime() < Date.now();
                                        return (
                                            <div key={sess._id} className={`flex items-center gap-3 rounded-xl p-3 ${isLiveNow ? "bg-emerald-50 ring-1 ring-emerald-300" : isCompleted ? "bg-stone-50" : "bg-stone-50"
                                                }`}>
                                                <div className="flex flex-col items-center justify-center gap-1 w-12 shrink-0">
                                                    {isLiveNow ? (
                                                        <>
                                                            <span className="relative flex h-3 w-3">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                                                            </span>
                                                            <span className="text-[9px] font-black uppercase text-emerald-700">LIVE</span>
                                                        </>
                                                    ) : isCompleted ? (
                                                        <span className="text-lg">✅</span>
                                                    ) : (
                                                        <span className="text-lg">📅</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-stone-900 truncate">{sess.title}</p>
                                                    <p className="text-[10px] text-stone-500">
                                                        {start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ·{" "}
                                                        {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                        {classroom?.timeZone ? ` (${classroom.timeZone})` : ""}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <span className={`rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${isLiveNow ? "bg-emerald-700 text-white" : isCompleted ? "bg-stone-200 text-stone-600" : "bg-blue-100 text-blue-700"
                                                        }`}>
                                                        {isLiveNow ? "In Progress" : isCompleted ? "Completed" : "Scheduled"}
                                                    </span>
                                                    {sess.meetingUrl && (
                                                        <a
                                                            href={sess.meetingUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="rounded-lg bg-emerald-800 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700"
                                                        >
                                                            Inspect Meet →
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Create Discussion Topic Modal */}
            <Modal
                isOpen={newThreadModal}
                onClose={() => setNewThreadModal(false)}
                title="Start a Discussion Topic"
            >
                <form onSubmit={handleCreateThread} className="space-y-4">
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Topic Title
                        <input
                            required
                            type="text"
                            value={threadTitle}
                            onChange={(e) => setThreadTitle(e.target.value)}
                            placeholder="E.g. Question on Module 2 homework"
                            className="mt-1.5 w-full rounded-2xl border border-stone-200 px-4 py-3 text-xs font-medium outline-none focus:border-emerald-700"
                        />
                    </label>

                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Category
                        <select
                            value={threadCategory}
                            onChange={(e) => setThreadCategory(e.target.value)}
                            className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs font-semibold outline-none focus:border-emerald-700"
                        >
                            <option value="general">General</option>
                            <option value="lesson">Lesson Question</option>
                            <option value="assignment">Assignment Help</option>
                            <option value="announcement">Announcement</option>
                        </select>
                    </label>

                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Message Content
                        <textarea
                            required
                            rows={4}
                            value={threadContent}
                            onChange={(e) => setThreadContent(e.target.value)}
                            placeholder="Type your question or message for your cohort…"
                            className="mt-1.5 w-full rounded-2xl border border-stone-200 px-4 py-3 text-xs font-medium outline-none focus:border-emerald-700"
                        />
                    </label>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setNewThreadModal(false)}
                            className="rounded-2xl border border-stone-200 px-4 py-2 text-xs font-bold text-stone-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="golden-btn rounded-full px-5 py-2 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
                        >
                            Post Topic
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
