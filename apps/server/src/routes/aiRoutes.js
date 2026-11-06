import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../auth.js";
import { UserModel } from "../models/User.js";
import { asyncHandler, ApiError } from "../lib/http.js";

export const aiRouter = Router();

// Rate limiting: 30 AI requests per 5 minutes per user/IP
const aiRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "AI chat rate limit reached. Please pause a moment before asking another question.",
    },
});

aiRouter.use(requireAuth);
aiRouter.use(aiRateLimiter);

/**
 * Built-in pedagogical knowledge engine that provides context-aware,
 * role-specific educational answers when external AI keys are unavailable.
 */
function generateBuiltInResponse({ userMessage, role, userName, courseTitle, classroomTitle, currentLesson, isAmharic }) {
    const q = userMessage.toLowerCase().trim();

    // 1. Amharic query detection or explicit Amharic request
    const containsEthiopic = /[\u1200-\u137F]/.test(userMessage) || isAmharic;
    if (containsEthiopic) {
        if (role === "teacher") {
            return `ሰላም መምህር ${userName || ""}! በ **${classroomTitle || "የትምህርት ክፍለ-ጊዜ"}** ውስጥ የትምህርት ዝግጅትዎን ለማገዝ ዝግጁ ነኝ።

### የተማሪዎችን ተሳትፎ ለማሳደግ የሚረዱ 3 ምክሮች:
1. **ቀላል ምሳሌዎችን ማስቀደም**: ፅንሰ-ሀሳቡን ከዕለት ተዕለት ኑሮ ጋር በማያያዝ ማብራራት።
2. **ተግባራዊ የኮዲንግ/የስራ ልምምድ (Hands-on Lab)**: ተማሪዎች እራሳቸው እንዲሞክሩት ማድረግ።
3. **የመወያያ ጥያቄዎችን ማንሳት**: በክፍል ውስጥ ተማሪዎች ሃሳባቸውን እንዲለዋወጡ ማበረታታት።

የየትኛውን ርዕስ የትምህርት እቅድ (Lesson Plan) ወይም የፈተና ጥያቄ እንዳዘጋጅልዎ ይፈልጋሉ?`;
        }

        return `ሰላም ${userName || "ተማሪ"}! እንኳን ወደ **${courseTitle || "ተድባበ ለርን ሀብ (TLH)"}** የትምህርት ረዳት በደህና መጡ።

ጥያቄዎን ተቀብያለሁ። ለ **${currentLesson || "ትምህርቱ"}** የሚረዳዎ ማብራሪያ ይኸውልዎ:

- **ዋናው ሃሳብ**: በትምህርትዎ ውስጥ ያሉትን ቁልፍ ነጥቦች ደረጃ በደረጃ በመረዳት ወደ ተግባር መቀየር ወሳኝ ነው።
- **የጥናት ዘዴ**: 
  1. የተመዘገቡትን የቪዲዮ ትምህርቶች ደጋግመው ይመልከቱ።
  2. በ Learning Space ውስጥ ያሉትን የንባብ ማስታወሻዎች (Materials) ያንብቡ።
  3. ከጥያቄዎ ጋር የተያያዘውን የኮድ ወይም የንድፈ-ሃሳብ ልምምድ ይስሩ።

ስለየትኛው የተለየ ርዕስ ወይም የቤት ስራ (Assignment) ማብራሪያ ይፈልጋሉ? ጥያቄዎን በዝርዝር ቢጽፉልኝ በደስታ አብራራለሁ!`;
    }

    // 2. Teacher-specific queries
    if (role === "teacher") {
        if (q.includes("lesson") || q.includes("plan") || q.includes("teach") || q.includes("prepare")) {
            return `Hello Instructor ${userName || ""}! Here is a structured pedagogical plan tailored for **${courseTitle || "your cohort"}**:

### 🎯 45-Minute Interactive Session Blueprint
1. **Hook & Concept Retrieval (5-7 mins)**
   - Review prior prerequisite concepts with a quick polling question or recap.
   - Introduce the central challenge of today's lesson: *${currentLesson || "Mastery Objective"}*.

2. **Core Instruction & Live Demonstration (15-20 mins)**
   - Walk through the theoretical foundation concisely.
   - Conduct a live step-by-step walkthrough or code demo. Keep terminal/browser outputs clearly visible.

3. **Guided Collaborative Practice (10-15 mins)**
   - Present a focused problem in the cohort workspace.
   - Encourage students to write down their thoughts in the **Cohort Discussions** tab.

4. **Wrap-up & Formative Check (5 mins)**
   - Highlight the upcoming assignment milestone.
   - Answer lingering questions and remind students about office hours.

Would you like me to draft specific discussion prompts, code challenges, or a rubric for this topic?`;
        }

        if (q.includes("rubric") || q.includes("grade") || q.includes("assessment") || q.includes("quiz")) {
            return `Here is a recommended 4-tier assessment rubric you can adapt for **${courseTitle || "your assignments"}**:

| Criteria | Exemplary (90-100%) | Proficient (75-89%) | Developing (60-74%) | Needs Focus (<60%) |
| :--- | :--- | :--- | :--- | :--- |
| **Correctness & Functionality** | Meets all functional specs without errors; handles edge cases cleanly. | Meets primary requirements with minor non-breaking flaws. | Partial functionality; core requirements incomplete. | Major runtime errors or missing deliverables. |
| **Code / Solution Quality** | Follows modular design, clear naming, and idiomatic best practices. | Clean and organized with minor formatting inconsistencies. | Monolithic or hard-to-read structure. | Unstructured or copied code without understanding. |
| **Documentation & Explanation** | Includes comprehensive comments, rationale, and clear setup steps. | Clear explanations with minor omissions. | Minimal documentation provided. | No explanatory notes or comments. |

Would you like me to tailor this for a specific assignment or project brief?`;
        }
    }

    // 3. Student-specific: Programming / Technical concepts
    if (q.includes("javascript") || q.includes("js") || q.includes("react") || q.includes("state") || q.includes("hook")) {
        return `Great question about modern web development! Here is a clear, step-by-step breakdown:

### 💡 Core Concept Overview
In frontend development with **React**, state represents data that changes over time and drives what users see on the screen.

\`\`\`javascript
// Example: Modern React state counter with best practices
import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);

  // Functional update prevents stale closures
  const increment = () => setCount((prev) => prev + 1);

  return (
    <button 
      onClick={increment}
      className="px-4 py-2 rounded-full bg-blue-600 text-white font-bold"
    >
      Clicks: {count}
    </button>
  );
}
\`\`\`

### 🔑 Key Takeaways to Remember:
1. **Immutability**: Never mutate state directly (e.g. \`count = 5\`). Always use the setter function (\`setCount\`).
2. **Re-rendering**: Updating state tells React to re-evaluate the component UI.
3. **Practice Tip**: Try modifying the example above to add a reset button!

Does this help clarify your question? Let me know if you want to explore more!`;
    }

    if (q.includes("python") || q.includes("function") || q.includes("loop") || q.includes("list")) {
        return `Python is built for readability and clean syntax! Here is a simple explanation of how functions and data structures fit together:

\`\`\`python
# Example: Processing learner progress data in Python
def calculate_mastery(scores: list[float]) -> dict:
    if not scores:
        return {"average": 0.0, "status": "No data"}
    
    avg = sum(scores) / len(scores)
    status = "Mastered" if avg >= 80 else "In Progress"
    
    return {
        "average": round(avg, 2),
        "status": status,
        "completed_items": len(scores)
    }

# Test run
student_scores = [85.5, 92.0, 78.0, 95.0]
result = calculate_mastery(student_scores)
print(f"Results: {result}")
# Output: Results: {'average': 87.62, 'status': 'Mastered', 'completed_items': 4}
\`\`\`

### 🚀 Step-by-Step Logic:
1. **Define with \`def\`**: Keeps logic modular and reusable.
2. **Defensive Check**: \`if not scores\` prevents division by zero.
3. **List Comprehension & Built-ins**: \`sum()\` and \`len()\` are fast and expressive.

Would you like to practice building a specific exercise related to your current cohort?`;
    }

    // 4. General study / lesson comprehension
    return `Hello ${userName || "there"}! I'm your **TLH AI Learning Assistant** for **${courseTitle || "Tedbabe LearnHUB"}** in the **${classroomTitle || "cohort space"}**.

Here are some helpful ways I can guide your learning right now:

- 📖 **Explain difficult concepts**: Ask me to explain any topic from your lessons in simple, beginner-friendly terms.
- 💻 **Code & Examples**: Request code snippets, debugging tips, or step-by-step logic in Python, JavaScript, Java, or Web Development.
- 📝 **Study & Review**: Ask me to generate a 3-question mini-quiz or summarize the key points of your current lesson.
- 🗣️ **Multilingual**: Feel free to ask questions in either **English** or **Amharic (አማርኛ)**.

What concept or assignment would you like to explore today?`;
}

/**
 * POST /api/ai/chat
 * Secure AI interaction endpoint for learning workspaces.
 */
aiRouter.post(
    "/chat",
    asyncHandler(async (req, res) => {
        const { messages, context = {} } = req.body;

        if (!Array.isArray(messages) || messages.length === 0) {
            throw new ApiError(400, "Messages array is required.");
        }

        const latestMessage = messages[messages.length - 1]?.content || "";
        if (!latestMessage.trim()) {
            throw new ApiError(400, "Message content cannot be empty.");
        }

        // Fetch user profile for personalization
        const user = await UserModel.findById(req.user.id).select("fullName role email").lean();
        const role = user?.role || req.user.role || "student";
        const userName = user?.fullName || "Learner";

        const {
            courseTitle = "",
            classroomTitle = "",
            currentLesson = "",
            activeTab = "player",
            userLanguage = "en",
        } = context;

        // Check for available external AI API keys
        const geminiApiKey =
            process.env.GEMINI_API_KEY ||
            process.env.GOOGLE_AI_API_KEY ||
            process.env.GOOGLE_API_KEY;

        const openAiApiKey = process.env.OPENAI_API_KEY;

        // 1. Try Google Gemini API if key is present
        if (geminiApiKey) {
            try {
                const systemInstruction = `You are Tedbabe LearnHUB (TLH) AI Learning Assistant, an intelligent, patient, and highly skilled pedagogical assistant for Tedbabe LearnHUB (TLH).

CURRENT USER CONTEXT:
- User Role: ${role === "teacher" ? "Teacher / Instructor" : "Student / Learner"}
- User Name: ${userName}
- Current Program/Course: ${courseTitle || "Universal Education"}
- Current Cohort/Classroom: ${classroomTitle || "Learning Space"}
- Active Workspace Tab: ${activeTab}
- Current Lesson / Material: ${currentLesson || "General Coursework"}

INSTRUCTIONAL GUIDELINES:
1. If the user is a STUDENT:
   - Provide clear, encouraging, step-by-step educational explanations.
   - Break down complex concepts with concrete examples and real-world analogies.
   - When discussing coding, provide well-commented, idiomatic code snippets in Markdown.
   - Foster understanding rather than doing full assignment answers directly.

2. If the user is a TEACHER:
   - Act as an instructional design partner and teaching assistant.
   - Assist with lesson plan outlines, engaging discussion starters, rubrics, and creative class exercises.

3. MULTILINGUAL:
   - Fully support English and Amharic (አማርኛ). If the user asks in Amharic, reply in natural, accurate Amharic.

4. SAFETY & INTEGRITY:
   - Never reveal private personal data, grades, or attendance of others.
   - Never claim to directly edit database records, attendance, or official grades.
   - Always format answers with clean Markdown (headers, bullet points, bold highlights, code blocks).`;

                // Format messages for Gemini API (ensures starts with 'user' and alternates)
                const validMessages = messages.filter((m) => m && m.content && String(m.content).trim());
                const contents = [];

                validMessages.slice(-10).forEach((m) => {
                    const mappedRole = m.role === "assistant" ? "model" : "user";
                    if (contents.length === 0 && mappedRole === "model") {
                        // Skip leading model welcome greeting so Gemini starts with a user turn
                        return;
                    }
                    const last = contents[contents.length - 1];
                    if (last && last.role === mappedRole) {
                        last.parts[0].text += `\n\n${m.content}`;
                    } else {
                        contents.push({
                            role: mappedRole,
                            parts: [{ text: String(m.content).trim() }],
                        });
                    }
                });

                if (contents.length === 0) {
                    contents.push({
                        role: "user",
                        parts: [{ text: latestMessage }],
                    });
                }

                const geminiModels = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"];
                const requestPayload = JSON.stringify({
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    contents,
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.95,
                        maxOutputTokens: 1200,
                    },
                });

                for (const model of geminiModels) {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 15000);

                        const response = await fetch(
                            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                signal: controller.signal,
                                body: requestPayload,
                            },
                        );

                        clearTimeout(timeoutId);

                        if (response.ok) {
                            const data = await response.json();
                            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                            if (text) {
                                return res.json({
                                    reply: text,
                                    provider: "gemini",
                                    role,
                                });
                            }
                        }
                    } catch (modelErr) {
                        console.warn(`[TLH AI] Gemini ${model} failed, trying next:`, modelErr.message);
                    }
                }
            } catch (err) {
                console.warn("[TLH AI] Gemini API call skipped or timed out, using built-in engine:", err.message);
            }
        }

        // 2. Try OpenAI API if key is present
        if (openAiApiKey) {
            try {
                const systemPrompt = `You are Tedbabe LearnHUB (TLH) AI Learning Assistant for ${userName} (${role}).
Course: ${courseTitle}, Cohort: ${classroomTitle}, Lesson: ${currentLesson}.
Help explain concepts clearly, provide code examples, support English and Amharic, and maintain high pedagogical quality.`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 18000);

                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${openAiApiKey}`,
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        model: "gpt-4o-mini",
                        messages: [
                            { role: "system", content: systemPrompt },
                            ...messages.slice(-10),
                        ],
                        temperature: 0.7,
                        max_tokens: 1000,
                    }),
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    const text = data?.choices?.[0]?.message?.content || "";
                    if (text) {
                        return res.json({
                            reply: text,
                            provider: "openai",
                            role,
                        });
                    }
                }
            } catch (err) {
                console.warn("[TLH AI] OpenAI API call failed, using built-in engine:", err.message);
            }
        }

        // 3. Fallback: TLH Built-in Pedagogical Intelligence Engine
        const fallbackReply = generateBuiltInResponse({
            userMessage: latestMessage,
            role,
            userName,
            courseTitle,
            classroomTitle,
            currentLesson,
            isAmharic: userLanguage === "am",
        });

        return res.json({
            reply: fallbackReply,
            provider: "built-in",
            role,
        });
    }),
);

