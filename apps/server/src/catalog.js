import { CourseModel } from "./models/Course.js";
import { LearningCategoryModel } from "./models/LearningCategory.js";
import { slugify } from "./utils.js";

const categoryData = [
    { name: "Languages", description: "English and Amharic language learning, literacy, conversation, and communication.", sortOrder: 1 },
    { name: "Primary School · Grades 1–4", description: "Foundational literacy, numeracy, science, and social studies practice for primary learners.", sortOrder: 2 },
    { name: "Middle School · Grades 5–8", description: "Grade-level language, mathematics, science, and social studies learning for middle school.", sortOrder: 3 },
    { name: "Secondary School · Grades 9–12", description: "High school language, mathematics, and subject-based science learning.", sortOrder: 4 },
    { name: "University & College", description: "Introductory university and college courses across computing, mathematics, and academic skills.", sortOrder: 5 },
    { name: "Web Development", description: "Build responsive websites and full-stack applications with modern tools.", sortOrder: 6 },
    { name: "Digital Marketing", description: "Master social media, SEO, content marketing, and online advertising to grow any business.", sortOrder: 7 },
    { name: "Programming", description: "Learn programming foundations, problem solving, and software development.", sortOrder: 8 },
    { name: "Data, AI & Analytics", description: "Explore data analysis, artificial intelligence, and machine learning foundations.", sortOrder: 9 },
    { name: "Cybersecurity & IT", description: "Build digital literacy, networking knowledge, and practical security awareness.", sortOrder: 10 },
    { name: "Design & Multimedia", description: "Practice user experience, visual design, and digital media production.", sortOrder: 11 },
    { name: "Business & Entrepreneurship", description: "Develop entrepreneurship, business planning, and communication skills.", sortOrder: 12 },
    { name: "Ethiopian Orthodox Tewahedo Church", description: "Explore the faith, history, worship, language, music, and traditions of the Ethiopian Orthodox Tewahedo Church.", sortOrder: 13 },
];

const courses = [];

function addCourse(category, title, description, skillLevel, learningObjectives) {
    courses.push({ category, title, description, skillLevel, learningObjectives });
}

const languageCourses = [
    ["Practical English · Beginner", "Build basic English vocabulary and confidence through everyday listening, speaking, reading, and writing practice.", ["Introduce yourself and ask simple questions", "Understand common everyday phrases", "Write short messages"]],
    ["Practical English · Elementary", "Strengthen everyday English for familiar situations with guided conversation and short texts.", ["Describe routines and familiar places", "Read short practical texts", "Write connected sentences"]],
    ["Practical English · Intermediate", "Improve fluency and comprehension for study, work, and everyday communication.", ["Explain opinions and experiences", "Understand the main ideas in clear speech", "Write organized paragraphs"]],
    ["Practical English · Upper Intermediate", "Develop accurate, flexible English for academic and professional communication.", ["Follow extended discussions", "Present a clear point of view", "Write structured reports and essays"]],
    ["English for Academic Study", "Practice the reading, writing, research, and presentation skills used in further education.", ["Identify claims and evidence in texts", "Plan and write an academic paragraph", "Deliver a short structured presentation"]],
    ["English for Work and Interviews", "Build practical communication skills for job applications, workplace conversations, and interviews.", ["Prepare a concise professional introduction", "Answer common interview questions", "Write clear workplace emails"]],
    ["Amharic Literacy · Foundations", "Build Amharic fidel reading and writing confidence through letter recognition, sounds, and short words.", ["Recognize and pronounce fidel", "Read and write familiar words", "Build a personal vocabulary list"]],
    ["Everyday Amharic Conversation", "Practice useful Amharic phrases for introductions, directions, daily activities, and conversation.", ["Use greetings and polite expressions", "Ask and answer everyday questions", "Describe familiar activities"]],
    ["Amharic Reading and Writing", "Develop Amharic reading comprehension, spelling, sentence construction, and paragraph writing.", ["Read short Amharic passages", "Identify key details and meaning", "Write connected Amharic sentences"]],
    ["Amharic Communication · Intermediate", "Extend Amharic fluency through longer conversations, listening practice, and clear written expression.", ["Summarize a short passage", "Take part in longer conversations", "Write a structured paragraph"]],
];
for (const [title, description, objectives] of languageCourses) {
    addCourse("Languages", title, description, title.includes("Beginner") || title.includes("Foundations") ? "Beginner" : "All levels", objectives);
}

const schoolSubjects = [
    { key: "English", label: "English Language", objective: "Read grade-level texts and communicate ideas in English." },
    { key: "Amharic", label: "Amharic Language", objective: "Read, write, and communicate in Amharic at a growing grade-level." },
    { key: "Mathematics", label: "Mathematics", objective: "Use grade-level mathematical reasoning to solve problems." },
    { key: "Science", label: "General Science", objective: "Explore grade-level scientific ideas through observation and explanation." },
    { key: "Social Studies", label: "Social Studies", objective: "Understand communities, history, geography, and civic life." },
];

for (let grade = 1; grade <= 8; grade += 1) {
    const category = grade <= 4 ? "Primary School · Grades 1–4" : "Middle School · Grades 5–8";
    for (const subject of schoolSubjects) {
        addCourse(
            category,
            `Grade ${grade} ${subject.label}`,
            `A guided Grade ${grade} ${subject.label.toLowerCase()} course with clear explanations, practice activities, and review of foundational concepts.`,
            "Grade-level",
            [subject.objective, "Practice skills through guided examples", "Review learning with short activities"],
        );
    }
}

for (let grade = 9; grade <= 12; grade += 1) {
    for (const subject of schoolSubjects) {
        addCourse(
            "Secondary School · Grades 9–12",
            `Grade ${grade} ${subject.label}`,
            `A guided Grade ${grade} ${subject.label.toLowerCase()} course with concept review, worked examples, and structured practice.`,
            "Grade-level",
            [subject.objective, "Connect key ideas to practical examples", "Strengthen understanding with review and practice"],
        );
    }
    for (const subject of ["Biology", "Chemistry", "Physics"]) {
        addCourse(
            "Secondary School · Grades 9–12",
            `Grade ${grade} ${subject}`,
            `An introductory Grade ${grade} ${subject.toLowerCase()} course focused on core concepts, scientific reasoning, and guided practice.`,
            "Grade-level",
            [`Explain key Grade ${grade} ${subject.toLowerCase()} concepts`, "Interpret examples, observations, or simple data", "Apply ideas to structured practice questions"],
        );
    }
}

const universityCourses = [
    ["University Mathematics Foundations", "Review algebra, functions, and mathematical reasoning used in introductory university study.", ["Manipulate algebraic expressions", "Interpret functions and graphs", "Show clear mathematical reasoning"]],
    ["Calculus I · Limits and Derivatives", "An introductory course in limits, continuity, and differentiation with worked examples.", ["Evaluate basic limits", "Differentiate common functions", "Apply derivatives to simple problems"]],
    ["Linear Algebra Foundations", "Study vectors, matrices, systems of linear equations, and their applications.", ["Solve systems using matrix methods", "Work with vectors and matrix operations", "Interpret linear transformations"]],
    ["Discrete Mathematics", "Explore logic, sets, counting, relations, graphs, and proof techniques for computing.", ["Use propositional logic", "Apply counting principles", "Reason about graphs and relations"]],
    ["University Academic Writing", "Practice research, academic structure, source evaluation, and clear university-level writing.", ["Develop a focused thesis", "Organize evidence into an argument", "Cite and evaluate sources responsibly"]],
    ["Introduction to Computer Science", "Explore foundational computing concepts, algorithms, data representation, and programming.", ["Describe core computing concepts", "Trace simple algorithms", "Represent information in common formats"]],
    ["Data Structures and Algorithms", "Study common data structures and algorithmic approaches through implementation and analysis.", ["Choose suitable data structures", "Implement core search and sort methods", "Compare algorithm efficiency"]],
    ["Database Systems", "Learn relational data modeling, SQL, normalization, and database application fundamentals.", ["Design a relational schema", "Query and update data with SQL", "Explain normalization and integrity"]],
    ["Operating Systems Foundations", "Explore processes, memory, file systems, and the role of an operating system.", ["Describe process and thread concepts", "Explain memory management basics", "Compare file system responsibilities"]],
    ["Software Engineering Practices", "Learn requirements, design, testing, collaboration, and maintenance in software projects.", ["Write clear functional requirements", "Plan and review a software change", "Design tests for expected behavior"]],
    ["Computer Networks Foundations", "Understand network layers, addressing, routing, and common internet protocols.", ["Explain basic network layers", "Interpret IP addressing concepts", "Describe common application protocols"]],
    ["Introduction to Economics", "Explore supply, demand, markets, incentives, and core microeconomic reasoning.", ["Interpret supply and demand", "Explain incentives and trade-offs", "Use simple economic models"]],
];
for (const [title, description, objectives] of universityCourses) {
    addCourse("University & College", title, description, "Introductory university", objectives);
}

const technologyCourses = [
    // Web Development Courses
    ["HTML5 & Semantic Web Architecture", "Create accessible, high-performance web pages using modern HTML5 semantic elements, forms, and SEO best practices.", ["Structure accessible pages with semantic HTML5", "Implement rich forms with client-side validation", "Optimize metadata and Open Graph tags for discoverability"], "Web Development"],
    ["Modern CSS, Flexbox & CSS Grid", "Master modern CSS styling, custom properties, Flexbox alignment, CSS Grid layouts, and fluid responsive design.", ["Build fluid responsive layouts with Flexbox and Grid", "Use CSS custom properties for theme systems", "Create micro-interactions and smooth keyframe animations"], "Web Development"],
    ["Tailwind CSS & Modern UI Systems", "Speed up UI engineering by mastering Tailwind CSS utility classes, responsive variants, and reusable component patterns.", ["Configure Tailwind CSS in modern frontend projects", "Build consistent, accessible responsive UI components", "Implement dark mode and customized color palettes"], "Web Development"],
    ["JavaScript Programming · Modern ES6+ & DOM", "Master JavaScript from foundational logic to modern asynchronous programming, event handling, and DOM manipulation.", ["Write modern ES6+ syntax, destructuring, and arrow functions", "Handle asynchronous operations using Promises and async/await", "Interact with the browser DOM and handle complex user events"], "Web Development"],
    ["TypeScript Foundations for Modern Web", "Bring compile-time type safety to modern web development with TypeScript interfaces, types, generics, and tooling.", ["Understand static types, type inference, and union types", "Create robust interfaces and generic functions", "Integrate TypeScript with modern bundlers and frameworks"], "Web Development"],
    ["React.js · Component Architecture & State Management", "Build modular, high-performance Single Page Applications with React 19, custom hooks, and state management.", ["Design reusable functional components and custom hooks", "Manage local state, effects, and Context API", "Build rich interactive data-driven user interfaces"], "Web Development"],
    ["Next.js Full-Stack Web Applications", "Build production-grade web applications with Next.js App Router, Server Components, API routes, and SEO optimization.", ["Implement server-side rendering (SSR) and static generation (SSG)", "Build secure API routes and server actions", "Deploy and optimize Next.js web applications"], "Web Development"],
    ["Vue.js 3 & Modern Frontend Engineering", "Learn modern Vue 3 development using the Composition API, script setup, Pinia state management, and Vue Router.", ["Build reactive components with Vue 3 Composition API", "Manage global state using Pinia stores", "Configure single-page routing with Vue Router"], "Web Development"],
    ["Node.js & Express RESTful API Engineering", "Architect scalable, secure backend services and REST APIs with Node.js, Express, middleware, and authentication.", ["Structure RESTful APIs following industry best practices", "Implement JWT authentication, authorization, and bcrypt hashing", "Validate and sanitize incoming request payloads"], "Web Development"],
    ["Full-Stack MERN Application Mastery", "Build end-to-end production web applications connecting MongoDB, Express, React, and Node.js with secure authentication.", ["Connect frontend React UI with backend Express REST APIs", "Model data schemas and write complex queries with MongoDB/Mongoose", "Deploy and secure full-stack applications to cloud platforms"], "Web Development"],
    ["Python Web Development with FastAPI", "Build blazing-fast, type-safe REST APIs and microservices using modern Python and the FastAPI framework.", ["Create asynchronous endpoints with Pydantic validation", "Implement dependency injection and security schemes", "Automate interactive OpenAPI and Swagger documentation"], "Web Development"],
    ["Web Security, OAuth & Authentication", "Protect web applications from vulnerabilities with practical knowledge of OAuth2, JWTs, CORS, CSRF, and data encryption.", ["Implement secure token storage and refresh workflows", "Prevent common OWASP vulnerabilities like XSS and CSRF", "Configure HTTPS, secure cookies, and CORS policies"], "Web Development"],

    // Programming Courses
    ["Python Programming Foundations", "Learn Python basics, data structures, control flow, functions, and structured problem solving.", ["Write Python expressions and modular functions", "Work with lists, dictionaries, tuples, and file I/O", "Solve algorithmic problems using clean Pythonic code"], "Programming"],
    ["Java Programming & Object-Oriented Design", "Explore object-oriented programming principles, classes, inheritance, polymorphism, and Java fundamentals.", ["Apply core OOP principles to real-world software design", "Handle exceptions, generics, and collections in Java", "Write clean, testable code with JUnit testing"], "Programming"],
    ["C++ Programming & Systems Foundations", "Study fundamental low-level computing concepts, memory management, pointers, and STL in C++.", ["Understand memory allocation and pointer arithmetic", "Use C++ Standard Template Library (STL) algorithms and containers", "Write efficient, performance-critical code"], "Programming"],
    ["Data Structures & Algorithms in Practice", "Master arrays, linked lists, stacks, queues, trees, graphs, sorting algorithms, and Big-O efficiency analysis.", ["Choose optimal data structures for diverse engineering scenarios", "Implement search, sort, and graph traversal algorithms", "Analyze time and space complexity using Big-O notation"], "Programming"],
    ["Git, GitHub & Collaborative Agile Engineering", "Use version control to track software changes, manage feature branches, review PRs, and work in agile developer teams.", ["Master Git branching, merging, and rebasing techniques", "Submit and review GitHub Pull Requests effectively", "Resolve merge conflicts and maintain clean commit history"], "Programming"],
    ["Cross-Platform Mobile Apps with React Native", "Build cross-platform iOS and Android mobile applications using React Native, Expo, and native device features.", ["Build native mobile layouts and navigation stacks", "Integrate camera, storage, and push notifications", "Prepare mobile apps for app store release"], "Programming"],
    ["Flutter & Dart Mobile App Engineering", "Engineer beautiful, high-performance mobile apps across iOS and Android with Google Flutter and Dart.", ["Master Dart object-oriented language features", "Compose expressive UI layouts with Flutter widgets", "Manage reactive state across mobile screens"], "Programming"],

    // Other Technology, Data & IT Courses
    ["Digital Literacy Essentials", "Build confidence with computer basics, files, online communication, and safe digital habits.", ["Manage files and folders", "Use common online collaboration tools", "Recognize basic online safety risks"], "Cybersecurity & IT"],
    ["SQL for Data and Applications", "Query relational databases and use SQL to retrieve, filter, and summarize data.", ["Select and filter records", "Join related tables", "Aggregate and summarize results"], "Data, AI & Analytics"],
    ["MongoDB Fundamentals", "Model document data and perform common database operations with MongoDB concepts.", ["Design document structures", "Query and update documents", "Choose basic indexes"], "Data, AI & Analytics"],
    ["Data Analysis with Spreadsheets", "Organize, clean, analyze, and communicate findings from data using spreadsheets.", ["Clean tabular data", "Use formulas and summaries", "Present findings with charts"], "Data, AI & Analytics"],
    ["Data Analysis with Python", "Use Python tools and structured workflows to explore and visualize datasets.", ["Load and inspect a dataset", "Summarize and transform data", "Create clear visualizations"], "Data, AI & Analytics"],
    ["Artificial Intelligence Literacy", "Understand common AI concepts, practical uses, limitations, and responsible use.", ["Distinguish AI terms and capabilities", "Evaluate AI-generated output", "Identify privacy and fairness considerations"], "Data, AI & Analytics"],
    ["Machine Learning Foundations", "Explore data, features, model training, evaluation, and introductory machine learning workflows.", ["Prepare a simple dataset", "Describe a basic model workflow", "Interpret evaluation results"], "Data, AI & Analytics"],
    ["Networking Essentials", "Learn how devices communicate through networks, addressing, and common network services.", ["Describe network devices and links", "Explain basic addressing", "Troubleshoot simple connectivity scenarios"], "Cybersecurity & IT"],
    ["Cybersecurity Awareness", "Build practical knowledge of accounts, data protection, common threats, and safer online behavior.", ["Use strong authentication practices", "Recognize common social engineering", "Protect personal and organizational data"], "Cybersecurity & IT"],
    ["Cybersecurity Foundations", "Study security principles, threat modeling, access control, and defensive practices.", ["Explain confidentiality, integrity, and availability", "Identify common threat patterns", "Describe defensive security controls"], "Cybersecurity & IT"],
    ["Cloud Computing Fundamentals", "Understand cloud service models, deployment concepts, and basic cloud architecture.", ["Compare common cloud service models", "Describe scalable cloud resources", "Recognize shared responsibility basics"], "Cybersecurity & IT"],
    ["UI and UX Design Foundations", "Practice user research, information architecture, wireframing, and usability feedback.", ["Identify user needs", "Create a low-fidelity wireframe", "Improve a design using feedback"], "Design & Multimedia"],
    ["Graphic Design Fundamentals", "Explore visual hierarchy, typography, color, composition, and practical design workflows.", ["Apply visual hierarchy", "Choose effective type and color", "Create a simple visual asset"], "Design & Multimedia"],
    ["Video Editing Essentials", "Learn the foundations of planning, editing, and exporting clear short-form video.", ["Organize clips and media", "Build a clear edit sequence", "Export for a selected platform"], "Design & Multimedia"],
    ["Entrepreneurship and Business Planning", "Develop an early business idea through customer needs, value propositions, and basic planning.", ["Identify a customer problem", "Describe a value proposition", "Draft a simple business model"], "Business & Entrepreneurship"],
];
for (const [title, description, objectives, category] of technologyCourses) {
    addCourse(category, title, description, title.includes("Foundations") || title.includes("Essentials") ? "Beginner" : "Intermediate", objectives);
}

// Dedicated Digital Marketing courses
const digitalMarketingCourses = [
    ["Digital Marketing Foundations", "Learn the core concepts of digital marketing — audiences, funnels, channels, and measurement — to launch effective online campaigns.", ["Explain key digital marketing channels", "Define a target audience and campaign goal", "Measure success with basic digital metrics"]],
    ["Social Media Marketing & Strategy", "Build and manage social media presences on Instagram, TikTok, Facebook, and LinkedIn to grow an engaged audience.", ["Create a social media content calendar", "Write captions that drive engagement", "Analyze platform insights and metrics"]],
    ["SEO & Search Engine Optimization", "Improve website visibility on Google and other search engines through on-page, off-page, and technical SEO techniques.", ["Conduct keyword research", "Optimize pages for search rankings", "Understand backlinks and domain authority"]],
    ["Content Marketing & Copywriting", "Create compelling written, visual, and video content that attracts, educates, and converts your audience.", ["Write persuasive headlines and copy", "Plan a content strategy for a brand", "Repurpose content across channels"]],
    ["Email Marketing & Automation", "Build email lists, design high-converting newsletters, and set up automated drip sequences that nurture leads.", ["Grow an email list with lead magnets", "Design effective email campaigns", "Set up basic email automation sequences"]],
    ["Paid Advertising · Google & Meta Ads", "Run targeted pay-per-click campaigns on Google Search and Meta (Facebook/Instagram) to generate leads and sales.", ["Set up a Google Ads campaign", "Create a Meta Ads audience and creative", "Optimize ad spend based on ROAS"]],
    ["E-Commerce & Online Sales", "Launch and grow an online store using platforms like Shopify, with strategies for driving traffic and increasing conversions.", ["Set up an online store", "Write product descriptions that sell", "Use paid and organic channels to drive sales"]],
];
for (const [title, description, objectives] of digitalMarketingCourses) {
    addCourse("Digital Marketing", title, description, "Beginner", objectives);
}

const tewahedoCourses = [
    ["Introduction to the Ethiopian Orthodox Tewahedo Church", "An introductory overview of the church's identity, core beliefs, community life, and place within Ethiopian history and culture.", ["Describe the church's origins and identity", "Recognize foundational Christian beliefs in the Tewahedo tradition", "Identify trusted church and community learning resources"]],
    ["The Bible in the Ethiopian Orthodox Tradition", "Explore how scripture is read, taught, and used in worship and spiritual life in the Ethiopian Orthodox Tewahedo tradition.", ["Identify the role of scripture in church life", "Explore selected biblical themes and stories", "Practice reading a passage with historical and spiritual context"]],
    ["History of Christianity in Ethiopia", "Trace major periods and people in the history of Christianity in Ethiopia, from its early presence to contemporary church life.", ["Outline key periods in Ethiopian Christian history", "Recognize influential historical figures and institutions", "Connect church history with Ethiopia's wider cultural history"]],
    ["Worship, Liturgy, and the Church Year", "Learn about the structure of worship, the liturgical year, and the meaning of major observances in the Ethiopian Orthodox Tewahedo Church.", ["Describe common elements of Orthodox worship", "Identify major seasons, fasts, and feasts", "Explain how liturgical practices shape community life"]],
    ["Ge'ez Language and Church Heritage", "An introductory study of Ge'ez as a classical language of Ethiopian Christian worship, manuscripts, and scholarship.", ["Recognize the role of Ge'ez in church heritage", "Learn basic script and pronunciation concepts", "Identify examples of Ge'ez use in liturgical and historical sources"]],
    ["Ethiopian Orthodox Church Music and Hymnody", "Discover the heritage of Ethiopian Orthodox sacred music, including the role of chant, instruments, and the tradition associated with Saint Yared.", ["Describe the place of music in Orthodox worship", "Recognize basic features of Ethiopian Orthodox chant", "Explore the cultural and spiritual context of sacred music"]],
    ["Church Art, Architecture, and Sacred Objects", "Explore the visual traditions of Ethiopian Orthodox churches, including architecture, painting, crosses, and other sacred objects.", ["Identify common forms of Ethiopian Orthodox sacred art", "Describe visual themes and their worship context", "Approach sacred objects with cultural and religious respect"]],
    ["Spiritual Life, Prayer, and Christian Ethics", "An introduction to prayer, spiritual disciplines, and ethical life in the Ethiopian Orthodox Tewahedo tradition.", ["Explore common forms of personal and communal prayer", "Relate spiritual practices to daily life", "Discuss ethical themes through selected teachings and examples"]],
    ["Monastic Life, Saints, and Pilgrimage", "Learn about monastic communities, saints, and pilgrimage in the history and devotional life of the Ethiopian Orthodox Tewahedo Church.", ["Describe the role of monastic communities", "Recognize the place of saints in church tradition", "Explain the meaning of pilgrimage in community life"]],
];
for (const [title, description, objectives] of tewahedoCourses) {
    addCourse("Ethiopian Orthodox Tewahedo Church", title, description, "Beginner", objectives);
}

export async function seedLearningCatalog() {
    const categoriesByName = new Map();
    for (const category of categoryData) {
        const saved = await LearningCategoryModel.findOneAndUpdate(
            { slug: slugify(category.name) },
            { $set: { ...category, slug: slugify(category.name), isActive: true } },
            { upsert: true, new: true },
        );
        categoriesByName.set(category.name, saved);
    }

    await CourseModel.bulkWrite(courses.map((course) => {
        const category = categoriesByName.get(course.category);
        if (!category) {
            throw new Error(`Unknown course category: ${course.category}`);
        }
        return {
            updateOne: {
                filter: { slug: slugify(course.title) },
                update: {
                    $set: {
                        title: course.title,
                        slug: slugify(course.title),
                        description: course.description,
                        learningObjectives: course.learningObjectives,
                        category: category._id,
                        skillLevel: course.skillLevel,
                        status: "published",
                    },
                },
                upsert: true,
            },
        };
    }));
    console.log(`Seeded ${categoryData.length} learning categories and ${courses.length} catalog courses.`);
    return Object.fromEntries(categoriesByName);
}
