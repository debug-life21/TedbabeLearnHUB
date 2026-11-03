import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        brandTagline:
          "Practical learning. Expert instruction. Progress shared when ready.",
        courses: "Courses",
        navHowItWorks: "How it works",
        navInstructors: "Instructors",
        about: "About",
        contact: "Contact",
        faq: "FAQ",
        privacy: "Privacy Policy",
        terms: "Terms of Service",
        cookies: "Cookie Policy",
        acceptableUse: "Acceptable Use",
        signIn: "Sign in",
        studentSignUp: "Join as a student",
        teacherApply: "Teach with us",
        dashboard: "Dashboard",
        signOut: "Sign out",
        heroTitle: "Build practical skills with instructor-led learning.",
        heroDescription:
          "Choose a program that fits your goals and schedule. Learn with an instructor and cohort, complete practical work, and receive feedback on results released by your teacher.",
        heroPrimary: "Explore learning programs",
        heroSecondary: "See how it works",
        categoriesTitle: "Find a program that fits your goals",
        categoriesSubtitle:
          "Explore structured programs across technology, languages, business, and school subjects. Review the curriculum and available cohorts before you choose.",
        clickToViewPrograms: "Click to view programs",
        viewPrograms: "View Programs",
        hidePrograms: "Hide Programs",
        programsInCategory: "Programs in",
        noProgramsFound:
          "There are no published programs in this category yet. Please check back later.",
        allProgramsInCatalog: "Browse Full Catalog",
        loadingPrograms: "Loading programs...",
        activeTrack: "Selected Track",
        featuredCourses: "Featured learning programs",
        featuredCoursesSubtitle:
          "Compare programs, meet your cohort, and learn with guidance from an instructor.",
        howItWorks: "A clear path from enrollment to progress",
        howItWorksSubtitle:
          "Learn how cohort placement, live sessions, assignments, teacher-reviewed assessments, and published progress reports fit together.",
        howWorksKicker: "LEARNING WITH GUIDANCE",
        howWorksPageTitle: "How learning works at TedbabeLearnHUB",
        howWorksPageDesc:
          "A clear process connects program selection, cohort placement, instructor-led learning, teacher-reviewed results, and published progress.",
        learnerJourney: "THE LEARNER JOURNEY",
        learnerJourneyTitle:
          "From choosing a program to reviewing your progress",
        journeyTag1: "GET STARTED",
        journeyTag2: "COHORT PLACEMENT",
        journeyTag3: "LEARN AND PRACTICE",
        journeyTag4: "RESULTS AND FEEDBACK",
        teacherQualityKicker: "FOR INSTRUCTORS",
        teacherQualityTitle: "Teach, review, and guide progress",
        teacherQualityDesc:
          "Approved instructors lead their assigned cohorts, review learner work, and decide when grades and progress reports are ready to publish.",
        teacherJourneyTitle: "Your teaching workflow",
        teacherStep1Title: "Apply to teach",
        teacherStep1Desc:
          "Share your experience, qualifications, and subject areas through the instructor application.",
        teacherStep2Title: "Complete administrator review",
        teacherStep2Desc:
          "An administrator reviews your application and activates your instructor account when approved.",
        teacherStep3Title: "Teach and support your cohort",
        teacherStep3Desc:
          "Schedule sessions, share resources, record attendance, review assignments and assessments, and publish learner progress.",
        applyToTeachCta: "Apply to teach",
        step1Title: "1. Share your goals and schedule",
        step1Desc:
          "Create an account and tell us what you want to learn, your experience level, and when you are available.",
        step2Title: "2. Join an assigned cohort",
        step2Desc:
          "An administrator reviews your preferences and assigns you to an appropriate cohort and instructor when a place is available.",
        step3Title: "3. Learn through sessions and practice",
        step3Desc:
          "Attend scheduled lessons, use course resources, and submit assignments and assessments for your teacher to review.",
        step4Title: "4. Review feedback and published results",
        step4Desc:
          "Your teacher reviews your work and publishes grades and progress reports when they are ready. Eligible learners can then request a certificate.",
        benefitsStudents: "Support for your learning journey",
        benefitsTeachers: "Tools for teaching and learner support",
        studentBenefit1:
          "Scheduled live sessions with opportunities to ask questions and receive instructor guidance",
        studentBenefit2:
          "Course resources, assignments, assessments, and published progress in one learning space",
        studentBenefit3:
          "Practical work and teacher feedback to help you understand your next steps",
        teacherBenefit1:
          "Manage assigned cohorts, schedule sessions, and record attendance",
        teacherBenefit2:
          "Create assignments and assessments, review submissions, and release results",
        teacherBenefit3:
          "Publish learner progress reports and share course resources with your cohorts",
        students: "Active learners",
        teachers: "Approved instructors",
        classes: "Active cohorts",
        contactTitle: "How can we help you get started?",
        contactDescription:
          "Contact our team with questions about programs, cohort placement, teaching, or your account.",
        submit: "Send message",
        fullName: "Full name",
        email: "Email address",
        password: "Password",
        subject: "Subject",
        message: "Message",
        learningGoals: "Learning goals",
        learningInterests: "Topics of interest",
        skillLevel: "Current experience level",
        preferredSchedule: "Preferred schedule",
        adminOverview: "Admin workspace",
        teacherOverview: "Instructor workspace",
        studentOverview: "Your learning space",
        loading: "Please wait…",
        approve: "Approve",
        reject: "Decline",
        createCategory: "Add a category",
        createCourse: "Create a program",
        createClass: "Create a cohort",
        scheduleSession: "Schedule a session",
        title: "Title",
        description: "Description",
        status: "Status",
        category: "Category",
        course: "Program",
        teacher: "Instructor",
        student: "Learner",
        startTime: "Start time",
        endTime: "End time",
        meetingUrl: "Live meeting link",
        overview: "Overview",
        attendance: "Attendance",
        assignments: "Assignments",
        assessments: "Assessments",
        resources: "Resources",
        announcements: "Announcements",
        reports: "Reports",
        settings: "Settings",
        createAssignment: "Create assignment",
        createAssessment: "Create assessment",
        uploadResource: "Add a resource",
        submitWork: "Submit work",
        saveGrade: "Save feedback",
        present: "Present",
        absent: "Absent",
        late: "Late",
        excused: "Excused",
        markAttendance: "Save attendance",
        takeAssessment: "Start assessment",
        submitAnswers: "Submit answers",
        passed: "Passed",
        failed: "Keep practicing",
        dueDate: "Due date",
        download: "Download",
        ctaTitle: "Choose your next learning step",
        ctaSubtitle:
          "Explore available programs and find the learning support that fits your goals.",
        pricingKicker: "CLEAR PROGRAM INFORMATION",
        pricingTitle: "Choose how you want to learn",
        pricingDescription:
          "Browse published programs and review current course or plan details before you enroll or pay.",
        pricingExploreTitle: "Explore the catalog",
        pricingExplorePrice: "Free to browse",
        pricingExplorePeriod: "Program prices shown in the catalog",
        pricingExploreDescription:
          "Compare published programs and decide what fits your learning goals.",
        pricingExploreFeature1: "Browse published programs and categories",
        pricingExploreFeature2:
          "Review course descriptions and learning objectives",
        pricingExploreFeature3: "See whether each program is free or paid",
        pricingExploreFeature4: "Create an account to request cohort placement",
        pricingExploreButton: "Browse programs",
        pricingCohortTitle: "Teacher-led cohort",
        pricingCohortPrice: "Varies by course",
        pricingCohortPeriod: "Final price shown before checkout",
        pricingCohortDescription:
          "Join an administrator-assigned cohort and learn with an instructor and classmates.",
        pricingCohortFeature1: "Scheduled sessions for your assigned cohort",
        pricingCohortFeature2:
          "Assignments and assessments reviewed by your teacher",
        pricingCohortFeature3:
          "Results and progress shared after your teacher publishes them",
        pricingCohortFeature4: "Cohort learning resources and discussions",
        pricingCohortButton: "Request placement",
        pricingPlanTitle: "Learning plans",
        pricingPlanPrice: "See active offers",
        pricingPlanPeriod: "Plan terms shown before checkout",
        pricingPlanDescription:
          "Review current packages, included courses, and billing terms before purchase.",
        pricingPlanFeature1: "See included courses and resources on each offer",
        pricingPlanFeature2:
          "Review the price, currency, and interval before payment",
        pricingPlanFeature3: "Subscription renewals require a new payment",
        pricingPlanFeature4:
          "Access follows the terms listed for the selected plan",
        pricingPlanButton: "View plans",
        pricingPlacementNoteTitle: "Need help choosing a cohort?",
        pricingPlacementNote:
          "Contact the team with your subject, schedule, and learning goals. An administrator can review placement options with you.",
        pricingPlacementContact: "Ask about placement",
        instructorsKicker: "MEET THE INSTRUCTORS",
        instructorsTitle: "Learn with an instructor",
        instructorsDescription:
          "Explore instructor profiles and areas of expertise. Instructors work with the cohorts assigned to them.",
        instructorsExploreCourses: "Explore programs",
        instructorsJoinTeam: "Apply to teach",
        instructorsLoadError:
          "Instructor profiles could not be loaded. Please try again.",
        instructorsEmptyTitle: "No instructor profiles are available yet",
        instructorsEmptyDescription:
          "Approved instructor profiles will appear here when they are ready to be shared.",
        instructorsApplyButton: "Apply to become an instructor",
        instructorLabel: "Instructor",
        instructorLearnCohort: "Explore cohort learning",
        courseLoading: "Loading course details…",
        courseNotFound: "Program not found",
        courseNotFoundDescription:
          "We could not find this program in the published catalog.",
        courseReturnCatalog: "Return to programs",
        courseCategoryFallback: "Category",
        courseDurationFallback: "Duration set by the instructor",
        courseActiveCohorts: "active cohorts",
        courseCompletionCertificate:
          "Certificate eligibility after completion review",
        courseRequestPlacement: "Request cohort placement",
        coursePlacementInfo: "How cohort placement works",
        courseLearningOutcomes: "What you will learn",
        courseLearningOutcomesDescription:
          "Learning objectives published for this program.",
        courseSyllabusTitle: "Program outline",
        courseSyllabusDescription:
          "Modules and lessons included in this program.",
        courseModulesTotal: "modules",
        courseLessonMinutes: "min",
        exploreNow: "Explore Track →",
        enrollNow: "Enroll Now →",
        allCategories: "All Tracks",
        allCourses: "Available Programs",
        objectives: "Core Competencies",
        registerAndRequest: "Get Started Free",
        aboutHeroTitle: "A learning community built around clear guidance.",
        aboutHeroDesc:
          "TedbabeLearnHUB connects learners with instructors through structured cohorts, practical activities, and teacher feedback.",
        missionTitle: "Our mission",
        missionDesc:
          "Make instructor-guided learning practical, accessible, and supportive for every learner.",
        visionTitle: "Our vision",
        visionDesc:
          "A community where people can build skills with confidence and understand their next steps.",
        valuesTitle: "What guides us",
        valuesDesc:
          "We value curiosity, careful teaching, fairness, transparency, and continuous learning.",
        architectureTitle: "A personal path, supported by a community",
        architectureDesc:
          "Share your interests and availability. An administrator reviews your preferences and assigns you to a cohort when a suitable place is available. Your instructor guides lessons, reviews work, and publishes progress reports.",
        becomeStudent: "Start learning",
        applyToTeach: "Become an instructor",
        faqSearchPlaceholder: "Search questions and answers…",
        faqLoading: "Loading answers…",
        faqLoadError:
          "We couldn’t load the answers right now. Please try again.",
        faqRetry: "Try again",
        faqNotFoundTitle: "No answers found",
        faqNotFoundDesc:
          "Try a different search, or contact our team and we’ll help you find the answer.",
        faqNeedHelp: "Need a hand?",
        faqContactTeam: "Talk to our team",
        helpCenterKicker: "LEARNER, INSTRUCTOR & ACCOUNT SUPPORT",
        helpCenterTitle: "Help and support",
        helpCenterDescription:
          "Find practical answers about programs, cohort placement, teaching, assessments, and your account.",
        helpSearchPlaceholder:
          "Search help topics, such as placement or grades",
        helpStudentsTab: "For learners",
        helpTeachersTab: "For instructors",
        helpTechnicalTab: "Account and technical help",
        helpStudentQuestion1: "How does cohort placement work?",
        helpStudentAnswer1:
          "After you share your learning preferences, an administrator reviews them and assigns you to a cohort when a suitable place is available. You can see your assigned cohort and upcoming lessons in your dashboard.",
        helpStudentQuestion2: "How do I join a live lesson?",
        helpStudentAnswer2:
          "Open your dashboard or cohort workspace, find the scheduled lesson, and use its meeting link when the session is available.",
        helpStudentQuestion3: "When can I see my grades and progress report?",
        helpStudentAnswer3:
          "Your teacher reviews assignments and assessments, then publishes your progress report. Grades, self-assessment, and progress details appear only after publication.",
        helpStudentQuestion4: "Can I access course resources later?",
        helpStudentAnswer4:
          "Resources shared with your cohort are available from the learning workspace. Access can depend on the resource type and your cohort enrollment.",
        helpTeacherQuestion1: "How do I apply to teach?",
        helpTeacherAnswer1:
          "Submit an instructor application with your experience, qualifications, and subject areas. An administrator reviews the application before enabling instructor access.",
        helpTeacherQuestion2:
          "How do I record attendance and schedule lessons?",
        helpTeacherAnswer2:
          "Use your instructor dashboard to manage assigned cohorts, schedule lessons, and record attendance for sessions you teach.",
        helpTeacherQuestion3: "Who grades quizzes and assessments?",
        helpTeacherAnswer3:
          "You review learner submissions, enter the result and feedback, then release them. Students see assessment results only after you publish them.",
        helpTechnicalQuestion1:
          "What if I do not receive my verification code?",
        helpTechnicalAnswer1:
          "Check your spam folder and confirm that the email address is correct. If the code expires, request a new one from the verification screen.",
        helpTechnicalQuestion2: "How do I reset my password?",
        helpTechnicalAnswer2:
          "Use the Forgot Password link on the sign-in page and follow the instructions sent to your account email.",
        helpTechnicalQuestion3: "Can I switch between English and Amharic?",
        helpTechnicalAnswer3:
          "Yes. Use the language switch in the site navigation or your account settings. The interface will update to the selected language.",
        helpContactKicker: "CONTACT SUPPORT",
        helpContactTitle: "Need more help? Send us a message",
        helpContactDescription:
          "Tell us what you need help with. Our team will respond using the email address you provide.",
        helpContactSuccess:
          "Your message has been received. Our team will follow up by email.",
        helpContactFailure: "We could not send your message. Please try again.",
        helpContactSubmit: "Send message",
        helpContactSending: "Sending…",
        helpContactSubjectPlaceholder: "Briefly describe your question",
        helpContactMessagePlaceholder:
          "Include the details that will help us assist you.",
        supportCenter: "We’re here to help",
        supportCenterDesc:
          "Reach out with questions about joining a cohort, teaching with TedbabeLearnHUB (TLH), or using your account.",
        businessHours: "Monday–Saturday, 8:30 AM–6:00 PM EAT",
        addisAbabaEthiopia: "Addis Ababa, Ethiopia",
        bentoPlacementTitle: "A thoughtful start",
        bentoPlacementDesc:
          "We take your goals, experience, and schedule into account to help you find a cohort that fits.",
        bentoMeetTitle: "Real-time learning",
        bentoMeetDesc:
          "Meet your instructor and cohort live, work through ideas together, and get help when it matters.",
        bentoGradingTitle: "Progress with purpose",
        bentoGradingDesc:
          "Follow your participation, practical work, and assessments to understand where you are and what comes next.",
        bentoVettedTitle: "Instructors who care about your growth",
        bentoVettedDesc:
          "Our instructor approval process helps build a learning community grounded in expertise, care, and accountability.",
      },
    },
    am: {
      translation: {
        brandTagline: "ተግባራዊ ትምህርት። የአስተማሪ መመሪያ። ዝግጁ ሲሆን የሚጋራ እድገት።",
        courses: "ትምህርቶች",
        navHowItWorks: "እንዴት እንደሚሰራ",
        navInstructors: "አስተማሪዎች",
        about: "ስለ እኛ",
        contact: "ያግኙን",
        faq: "ተደጋጋሚ ጥያቄዎች",
        privacy: "የግላዊነት ፖሊሲ",
        terms: "የአጠቃቀም ደንቦች",
        cookies: "የኩኪ ፖሊሲ",
        acceptableUse: "ተቀባይነት ያለው አጠቃቀም",
        signIn: "ይግቡ",
        studentSignUp: "እንደ ተማሪ ይመዝገቡ",
        teacherApply: "ከእኛ ጋር ያስተምሩ",
        dashboard: "ዳሽቦርድ",
        signOut: "ይውጡ",
        heroTitle: "በአስተማሪ መመሪያ ተግባራዊ ክህሎቶችን ይገንቡ።",
        heroDescription:
          "ከግቦችዎና ከጊዜ ሰሌዳዎ ጋር የሚስማማ ፕሮግራም ይምረጡ። ከአስተማሪና ከኮሆርት ጋር ይማሩ፣ ተግባራዊ ስራዎችን ያቅርቡ፣ አስተማሪዎ በለቀቀው ውጤት ላይ ግብረ-መልስ ያግኙ።",
        heroPrimary: "የትምህርት ፕሮግራሞችን ይመልከቱ",
        heroSecondary: "እንዴት እንደሚሰራ ይወቁ",
        categoriesTitle: "ከግቦችዎ ጋር የሚስማማ ፕሮግራም ያግኙ",
        categoriesSubtitle:
          "በቴክኖሎጂ፣ ቋንቋዎች፣ ንግድ እና ትምህርት ቤት ትምህርቶች ያሉ የተዋቀሩ ፕሮግራሞችን ያስሱ። ከመምረጥዎ በፊት የትምህርት ይዘቱንና ያሉ ኮሆርቶችን ይመልከቱ።",
        clickToViewPrograms: "ፕሮግራሞችን ለማየት ጠቅ ያድርጉ",
        viewPrograms: "ፕሮግራሞችን ይመልከቱ",
        hidePrograms: "ፕሮግራሞችን ይደብቁ",
        programsInCategory: "ውስጥ የሚገኙ ፕሮግራሞች",
        noProgramsFound: "በዚህ ዘርፍ የታተመ ፕሮግራም እስካሁን የለም። እባክዎ በኋላ ይመለሱ።",
        allProgramsInCatalog: "ሙሉ ካታሎግ ይመልከቱ",
        loadingPrograms: "ፕሮግራሞችን በመጫን ላይ...",
        activeTrack: "የተመረጠ ዘርፍ",
        featuredCourses: "የተመረጡ የትምህርት ፕሮግራሞች",
        featuredCoursesSubtitle:
          "ፕሮግራሞችን ያወዳድሩ፣ ከኮሆርትዎ ጋር ይተዋወቁ እና በአስተማሪ መመሪያ ይማሩ።",
        howItWorks: "ከምዝገባ እስከ እድገት የሚያደርስ ግልጽ መንገድ",
        howItWorksSubtitle:
          "የኮሆርት ምደባ፣ ቀጥታ ትምህርቶች፣ ስራዎች፣ በአስተማሪ የሚገመገሙ ምዘናዎች እና የታተሙ የእድገት ሪፖርቶች እንዴት እንደሚገናኙ ይወቁ።",
        howWorksKicker: "በመመሪያ የሚደገፍ ትምህርት",
        howWorksPageTitle: "በTedbabeLearnHUB ትምህርት እንዴት ይሰራል?",
        howWorksPageDesc:
          "የፕሮግራም ምርጫን፣ የኮሆርት ምደባን፣ በአስተማሪ የሚመራ ትምህርትን፣ የሚገመገሙ ውጤቶችን እና የሚታተም እድገትን የሚያገናኝ ግልጽ ሂደት።",
        learnerJourney: "የተማሪው የትምህርት ጉዞ",
        learnerJourneyTitle: "ፕሮግራም ከመምረጥ እስከ እድገትዎን መመልከት",
        journeyTag1: "መጀመር",
        journeyTag2: "የኮሆርት ምደባ",
        journeyTag3: "መማርና ልምምድ",
        journeyTag4: "ውጤትና ግብረ-መልስ",
        teacherQualityKicker: "ለአስተማሪዎች",
        teacherQualityTitle: "ያስተምሩ፣ ይገምግሙ፣ እድገትን ይምሩ",
        teacherQualityDesc:
          "የተፈቀደላቸው አስተማሪዎች የተመደቡላቸውን ኮሆርቶች ይመራሉ፣ የተማሪዎችን ስራ ይገምግማሉ፣ ውጤትና የእድገት ሪፖርት መቼ እንደሚታተም ይወስናሉ።",
        teacherJourneyTitle: "የአስተማሪ የስራ ሂደት",
        teacherStep1Title: "ለማስተማር ያመልክቱ",
        teacherStep1Desc:
          "የስራ ልምድዎን፣ ትምህርታዊ ዝግጅትዎንና የሚያስተምሩትን ዘርፍ በማመልከቻው ያጋሩ።",
        teacherStep2Title: "የአስተዳዳሪ ግምገማን ያጠናቅቁ",
        teacherStep2Desc: "አስተዳዳሪ ማመልከቻዎን ይገመግማል፤ ሲፈቀድ የአስተማሪ መለያዎን ያነቃል።",
        teacherStep3Title: "ኮሆርትዎን ያስተምሩና ይደግፉ",
        teacherStep3Desc:
          "ትምህርቶችን ያቅዱ፣ መርጃዎችን ያጋሩ፣ መገኘትን ይመዝግቡ፣ ስራዎችንና ምዘናዎችን ይገምግሙ እና የተማሪ እድገትን ያትሙ።",
        applyToTeachCta: "ለማስተማር ያመልክቱ",
        step1Title: "1. ግቦችዎንና የጊዜ ሰሌዳዎን ያጋሩ",
        step1Desc: "መለያ ይፍጠሩ፤ መማር የሚፈልጉትን ዘርፍ፣ የልምድ ደረጃዎንና የሚመችዎትን ጊዜ ይግለጹ።",
        step2Title: "2. ወደተመደበልዎ ኮሆርት ይቀላቀሉ",
        step2Desc:
          "አስተዳዳሪ ምርጫዎን ይገመግማል፤ ተስማሚ ቦታ ሲኖር ወደ ተገቢ ኮሆርትና አስተማሪ ይመድብዎታል።",
        step3Title: "3. በትምህርትና በልምምድ ይማሩ",
        step3Desc:
          "የታቀዱ ትምህርቶችን ይከታተሉ፣ የኮርስ መርጃዎችን ይጠቀሙ እና ስራዎችንና ምዘናዎችን ለአስተማሪዎ ግምገማ ያስገቡ።",
        step4Title: "4. ግብረ-መልስንና የታተሙ ውጤቶችን ይመልከቱ",
        step4Desc:
          "አስተማሪዎ ስራዎን ይገመግማል፤ ዝግጁ ሲሆን ውጤትና የእድገት ሪፖርት ያትማል። መስፈርቱን የሚያሟሉ ተማሪዎች ሰርተፍኬት መጠየቅ ይችላሉ።",
        benefitsStudents: "ለትምህርት ጉዞዎ የሚደረግ ድጋፍ",
        benefitsTeachers: "ለማስተማርና ለተማሪ ድጋፍ የሚረዱ መሳሪያዎች",
        studentBenefit1: "ጥያቄ የሚጠይቁበትና የአስተማሪ መመሪያ የሚያገኙበት የቀጥታ ትምህርት",
        studentBenefit2:
          "የኮርስ መርጃዎች፣ ስራዎች፣ ምዘናዎችና የታተሙ የእድገት ሪፖርቶች በአንድ የትምህርት ቦታ",
        studentBenefit3: "ቀጣይ እርምጃዎን እንዲያውቁ የሚረዱ ተግባራዊ ስራዎችና የአስተማሪ ግብረ-መልስ",
        teacherBenefit1: "የተመደቡ ኮሆርቶችን ያስተዳድሩ፣ ትምህርቶችን ያቅዱ እና መገኘትን ይመዝግቡ",
        teacherBenefit2: "ስራዎችንና ምዘናዎችን ይፍጠሩ፣ የተማሪ ማስረከቦችን ይገምግሙ እና ውጤቶችን ያትሙ",
        teacherBenefit3: "የተማሪ እድገት ሪፖርቶችን ያትሙ እና የኮርስ መርጃዎችን ከኮሆርትዎ ጋር ያጋሩ",
        students: "ንቁ ተማሪዎች",
        teachers: "የተፈቀደላቸው አስተማሪዎች",
        classes: "ንቁ ክፍሎች",
        contactTitle: "ቀጣዩን የትምህርት እርምጃ እንዲወስዱ እንርዳዎ",
        contactDescription:
          "ስለ ፕሮግራሞች፣ የኮሆርት ምደባ፣ ማስተማር ወይም መለያዎ ጥያቄ ካለዎት ቡድናችንን ያነጋግሩ።",
        submit: "መልእክት ይላኩ",
        fullName: "ሙሉ ስም",
        email: "የኢሜይል አድራሻ",
        password: "የይለፍ ቃል",
        subject: "ርዕስ",
        message: "መልእክት",
        learningGoals: "የትምህርት ግቦች",
        learningInterests: "የፍላጎት አርእስቶች",
        skillLevel: "የአሁኑ የልምድ ደረጃ",
        preferredSchedule: "ተመራጭ የጊዜ ሰሌዳ",
        adminOverview: "የአድሚን የስራ ቦታ",
        teacherOverview: "የአስተማሪ የስራ ቦታ",
        studentOverview: "የእርስዎ የትምህርት ቦታ",
        loading: "እባክዎ ይጠብቁ…",
        approve: "ፍቀድ",
        reject: "ውድቅ አድርግ",
        createCategory: "ምድብ አክል",
        createCourse: "ፕሮግራም ፍጠር",
        createClass: "ክፍል ፍጠር",
        scheduleSession: "ክፍለ-ጊዜ መድብ",
        title: "ርዕስ",
        description: "መግለጫ",
        status: "ሁኔታ",
        category: "ምድብ",
        course: "ፕሮግራም",
        teacher: "አስተማሪ",
        student: "ተማሪ",
        startTime: "የመጀመሪያ ሰዓት",
        endTime: "የማብቂያ ሰዓት",
        meetingUrl: "የቀጥታ ስብሰባ አገናኝ",
        overview: "አጠቃላይ እይታ",
        attendance: "መገኘት",
        assignments: "ስራዎች",
        assessments: "ምዘናዎች",
        resources: "መርጃዎች",
        announcements: "ማስታወቂያዎች",
        reports: "ሪፖርቶች",
        settings: "ቅንብሮች",
        createAssignment: "ስራ ፍጠር",
        createAssessment: "ምዘና ፍጠር",
        uploadResource: "መርጃ አክል",
        submitWork: "ስራ አስረክብ",
        saveGrade: "ግብረ-መልስ አስቀምጥ",
        present: "ተገኝቷል",
        absent: "ቀርቷል",
        late: "አርፍዷል",
        excused: "ፈቃድ",
        markAttendance: "መገኘት አስቀምጥ",
        takeAssessment: "ምዘና ጀምር",
        submitAnswers: "መልሶችን አስረክብ",
        passed: "አልፏል",
        failed: "ልምምድ ይቀጥሉ",
        dueDate: "የማስረከቢያ ቀን",
        download: "አውርድ",
        ctaTitle: "ቀጣዩን የትምህርት እርምጃ ይምረጡ",
        ctaSubtitle: "ያሉ ፕሮግራሞችን ያስሱ እና ከግቦችዎ ጋር የሚስማማውን ድጋፍ ያግኙ።",
        pricingKicker: "ግልጽ የፕሮግራም መረጃ",
        pricingTitle: "መማር የሚፈልጉበትን መንገድ ይምረጡ",
        pricingDescription:
          "ከመመዝገብ ወይም ክፍያ ከመፈጸምዎ በፊት የታተሙ ፕሮግራሞችንና የአሁኑን የኮርስ ወይም የእቅድ ዝርዝር ይመልከቱ።",
        pricingExploreTitle: "ካታሎጉን ያስሱ",
        pricingExplorePrice: "ማሰስ በነጻ",
        pricingExplorePeriod: "የፕሮግራም ዋጋ በካታሎጉ ይታያል",
        pricingExploreDescription:
          "የታተሙ ፕሮግራሞችን ያወዳድሩ እና ከግቦችዎ ጋር የሚስማማውን ይምረጡ።",
        pricingExploreFeature1: "የታተሙ ፕሮግራሞችንና ምድቦችን ያስሱ",
        pricingExploreFeature2: "የኮርስ መግለጫዎችንና የትምህርት ዓላማዎችን ይመልከቱ",
        pricingExploreFeature3: "እያንዳንዱ ፕሮግራም ነጻ ወይም ክፍያ ያለው መሆኑን ይመልከቱ",
        pricingExploreFeature4: "የኮሆርት ምደባ ለመጠየቅ መለያ ይፍጠሩ",
        pricingExploreButton: "ፕሮግራሞችን ያስሱ",
        pricingCohortTitle: "በአስተማሪ የሚመራ ኮሆርት",
        pricingCohortPrice: "እንደ ኮርሱ ይለያያል",
        pricingCohortPeriod: "የመጨረሻ ዋጋ ከክፍያ በፊት ይታያል",
        pricingCohortDescription:
          "በአስተዳዳሪ ወደተመደበ ኮሆርት ይቀላቀሉ እና ከአስተማሪና ከክፍል ጓደኞችዎ ጋር ይማሩ።",
        pricingCohortFeature1: "ለተመደበው ኮሆርት የታቀዱ ትምህርቶች",
        pricingCohortFeature2: "በአስተማሪ የሚገመገሙ ስራዎችና ምዘናዎች",
        pricingCohortFeature3: "አስተማሪዎ ካተመ በኋላ የሚታዩ ውጤቶችና የእድገት ሪፖርቶች",
        pricingCohortFeature4: "የኮሆርት የትምህርት መርጃዎችና ውይይቶች",
        pricingCohortButton: "ምደባ ይጠይቁ",
        pricingPlanTitle: "የትምህርት እቅዶች",
        pricingPlanPrice: "ያሉ ቅናሾችን ይመልከቱ",
        pricingPlanPeriod: "የእቅዱ ውሎች ከክፍያ በፊት ይታያሉ",
        pricingPlanDescription:
          "ከመግዛትዎ በፊት ያሉ ጥቅሎችን፣ የተካተቱ ኮርሶችንና የክፍያ ውሎችን ይመልከቱ።",
        pricingPlanFeature1: "በእያንዳንዱ እቅድ የተካተቱ ኮርሶችንና መርጃዎችን ይመልከቱ",
        pricingPlanFeature2: "ከክፍያ በፊት ዋጋን፣ ገንዘብ አይነትንና የክፍያ ጊዜን ይመልከቱ",
        pricingPlanFeature3: "የደንበኝነት እድሳት አዲስ ክፍያ ይፈልጋል",
        pricingPlanFeature4: "መዳረሻው በተመረጠው እቅድ ውሎች መሠረት ነው",
        pricingPlanButton: "እቅዶችን ይመልከቱ",
        pricingPlacementNoteTitle: "ኮሆርት ለመምረጥ እርዳታ ይፈልጋሉ?",
        pricingPlacementNote:
          "የሚፈልጉትን ዘርፍ፣ የጊዜ ሰሌዳና የትምህርት ግቦች ለቡድናችን ያጋሩ። አስተዳዳሪ የምደባ አማራጮችን ከእርስዎ ጋር ይመለከታል።",
        pricingPlacementContact: "ስለ ምደባ ይጠይቁ",
        instructorsKicker: "አስተማሪዎችን ያግኙ",
        instructorsTitle: "ከአስተማሪ ጋር ይማሩ",
        instructorsDescription:
          "የአስተማሪዎችን መገለጫና የሙያ ዘርፎቻቸውን ይመልከቱ። አስተማሪዎች ከተመደቡላቸው ኮሆርቶች ጋር ይሰራሉ።",
        instructorsExploreCourses: "ፕሮግራሞችን ያስሱ",
        instructorsJoinTeam: "ለማስተማር ያመልክቱ",
        instructorsLoadError: "የአስተማሪ መገለጫዎችን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
        instructorsEmptyTitle: "እስካሁን የአስተማሪ መገለጫ የለም",
        instructorsEmptyDescription:
          "ለህዝብ ለማጋራት ዝግጁ የሆኑ የተፈቀዱ አስተማሪዎች መገለጫ እዚህ ይታያል።",
        instructorsApplyButton: "አስተማሪ ለመሆን ያመልክቱ",
        instructorLabel: "አስተማሪ",
        instructorLearnCohort: "የኮሆርት ትምህርትን ይመልከቱ",
        courseLoading: "የፕሮግራሙን ዝርዝር በመጫን ላይ…",
        courseNotFound: "ፕሮግራሙ አልተገኘም",
        courseNotFoundDescription: "ይህን ፕሮግራም በታተመው ካታሎግ ውስጥ ማግኘት አልቻልንም።",
        courseReturnCatalog: "ወደ ፕሮግራሞች ይመለሱ",
        courseCategoryFallback: "ምድብ",
        courseDurationFallback: "የቆይታ ጊዜውን አስተማሪው ይወስናል",
        courseActiveCohorts: "ንቁ ኮሆርቶች",
        courseCompletionCertificate: "ከኮርስ ማጠናቀቅ ግምገማ በኋላ የሰርተፍኬት ብቁነት",
        courseRequestPlacement: "የኮሆርት ምደባ ይጠይቁ",
        coursePlacementInfo: "የኮሆርት ምደባ እንዴት እንደሚሰራ",
        courseLearningOutcomes: "የሚማሯቸው",
        courseLearningOutcomesDescription: "ለዚህ ፕሮግራም የታተሙ የትምህርት ዓላማዎች።",
        courseSyllabusTitle: "የፕሮግራሙ እቅድ",
        courseSyllabusDescription: "በዚህ ፕሮግራም የተካተቱ ሞጁሎችና ትምህርቶች።",
        courseModulesTotal: "ሞጁሎች",
        courseLessonMinutes: "ደቂቃ",
        exploreNow: "ዘርፉን ያስሱ →",
        enrollNow: "አሁን ይመዝገቡ →",
        allCategories: "ሁሉም ዘርፎች",
        allCourses: "ያሉ ፕሮግራሞች",
        objectives: "ዋና ዋና ብቃቶች",
        registerAndRequest: "በነጻ ይጀምሩ",
        aboutHeroTitle: "በግልጽ መመሪያ የሚደገፍ የትምህርት ማህበረሰብ።",
        aboutHeroDesc:
          "ተድባቤ ሌርንሃብ (TLH) ተማሪዎችንና አስተማሪዎችን በተዋቀሩ ኮሆርቶች፣ ተግባራዊ ልምምዶች እና የአስተማሪ ግብረ-መልስ ያገናኛል።",
        missionTitle: "የእኛ ተልዕኮ",
        missionDesc: "በአስተማሪ የሚመራ ትምህርትን ተግባራዊ፣ ተደራሽ እና ደጋፊ ለእያንዳንዱ ተማሪ ማድረግ።",
        visionTitle: "የእኛ ራዕይ",
        visionDesc:
          "ሰዎች ክህሎቶችን በራስ መተማመን የሚገነቡበትና ቀጣይ እርምጃቸውን በግልጽ የሚያውቁበት ማህበረሰብ።",
        valuesTitle: "የሚመሩን እሴቶች",
        valuesDesc:
          "ጉጉትን፣ ጥንቃቄ የተሞላበት ማስተማርን፣ ፍትሃዊነትን፣ ግልጽነትን እና ቀጣይ ትምህርትን እናከብራለን።",
        architectureTitle: "በማህበረሰብ የሚደገፍ የግል መንገድ",
        architectureDesc:
          "ፍላጎቶችዎንና የጊዜ ሰሌዳዎን ያጋሩ። ተስማሚ ቦታ ሲኖር አስተዳዳሪ ወደ ተገቢ ኮሆርት ይመድብዎታል። አስተማሪዎ ትምህርትን ይመራል፣ ስራዎን ይገምግማል እና የእድገት ሪፖርት ያትማል።",
        becomeStudent: "መማር ይጀምሩ",
        applyToTeach: "አስተማሪ ይሁኑ",
        faqSearchPlaceholder: "ጥያቄዎችን እና መልሶችን ይፈልጉ…",
        faqLoading: "መልሶች እየጫኑ ነው…",
        faqLoadError: "በአሁኑ ጊዜ መልሶችን መጫን አልቻልንም። እባክዎ እንደገና ይሞክሩ።",
        faqRetry: "እንደገና ይሞክሩ",
        faqNotFoundTitle: "ምንም መልስ አልተገኘም",
        faqNotFoundDesc:
          "ሌላ ፍለጋ ይሞክሩ ወይም ቡድናችንን ያነጋግሩ እና መልሱን እንዲያገኙ እናግዝዎታለን።",
        faqNeedHelp: "እርዳታ ይፈልጋሉ?",
        faqContactTeam: "ቡድናችንን ያነጋግሩ",
        helpCenterKicker: "ለተማሪዎች፣ ለአስተማሪዎችና ለመለያ እርዳታ",
        helpCenterTitle: "እርዳታና ድጋፍ",
        helpCenterDescription:
          "ስለ ፕሮግራሞች፣ የኮሆርት ምደባ፣ ማስተማር፣ ምዘናዎችና መለያዎ ተግባራዊ መልሶችን ያግኙ።",
        helpSearchPlaceholder: "እንደ ምደባ ወይም ውጤት ያሉ ርዕሶችን ይፈልጉ",
        helpStudentsTab: "ለተማሪዎች",
        helpTeachersTab: "ለአስተማሪዎች",
        helpTechnicalTab: "መለያና ቴክኒካዊ እርዳታ",
        helpStudentQuestion1: "የኮሆርት ምደባ እንዴት ይሰራል?",
        helpStudentAnswer1:
          "የትምህርት ምርጫዎን ካጋሩ በኋላ አስተዳዳሪ ይገመግማቸዋል፤ ተስማሚ ቦታ ሲኖር ወደ ኮሆርት ይመድብዎታል። የተመደቡበትን ኮሆርትና የሚቀጥሉ ትምህርቶችን በዳሽቦርድዎ ላይ ያያሉ።",
        helpStudentQuestion2: "የቀጥታ ትምህርትን እንዴት እቀላቀላለሁ?",
        helpStudentAnswer2:
          "ዳሽቦርድዎን ወይም የኮሆርት የትምህርት ቦታን ይክፈቱ፣ የታቀደውን ትምህርት ይፈልጉ እና ስብሰባው ሲከፈት የስብሰባ አገናኙን ይጠቀሙ።",
        helpStudentQuestion3: "ውጤትና የእድገት ሪፖርቴን መቼ ማየት እችላለሁ?",
        helpStudentAnswer3:
          "አስተማሪዎ ስራዎችንና ምዘናዎችን ይገመግማል፣ ከዚያም የእድገት ሪፖርትዎን ያትማል። ውጤቶችና የእድገት ዝርዝሮች ከታተሙ በኋላ ብቻ ይታያሉ።",
        helpStudentQuestion4: "የኮርስ መርጃዎችን በኋላ ማግኘት እችላለሁ?",
        helpStudentAnswer4:
          "ከኮሆርትዎ ጋር የተጋሩ መርጃዎች በየትምህርት ቦታው ይገኛሉ። መዳረሻው እንደ መርጃው አይነትና የኮሆርት አባልነትዎ ሊለያይ ይችላል።",
        helpTeacherQuestion1: "እንዴት አስተማሪ ለመሆን ማመልከት እችላለሁ?",
        helpTeacherAnswer1:
          "የስራ ልምድዎን፣ ትምህርታዊ ዝግጅትዎንና የሚያስተምሩትን ዘርፍ በአስተማሪ ማመልከቻ ያቅርቡ። አስተዳዳሪ ከገመገመ በኋላ የአስተማሪ መዳረሻ ያነቃል።",
        helpTeacherQuestion2: "መገኘትን እንዴት እመዘግባለሁ እና ትምህርት እንዴት እዘጋጃለሁ?",
        helpTeacherAnswer2:
          "በአስተማሪ ዳሽቦርድዎ የተመደቡልዎትን ኮሆርቶች ያስተዳድሩ፣ ትምህርቶችን ያቅዱ እና ለሚያስተምሩት ክፍለ ጊዜ መገኘትን ይመዝግቡ።",
        helpTeacherQuestion3: "የፈተናና የምዘና ውጤቶችን ማን ይሰጣል?",
        helpTeacherAnswer3:
          "የተማሪዎችን ማስረከቦች ይገምግሙ፣ ውጤትና ግብረ-መልስ ያስገቡ፣ ከዚያም ያትሙ። ተማሪዎች ውጤቶችን እርስዎ ካተሙ በኋላ ብቻ ያያሉ።",
        helpTechnicalQuestion1: "የማረጋገጫ ኮድ ካልደረሰኝ ምን ላድርግ?",
        helpTechnicalAnswer1:
          "የኢሜይልዎ አድራሻ ትክክል መሆኑንና የSpam ማህደርን ይመልከቱ። ኮዱ ካለፈበት ከማረጋገጫ ገጹ አዲስ ኮድ ይጠይቁ።",
        helpTechnicalQuestion2: "የይለፍ ቃሌን እንዴት እቀይራለሁ?",
        helpTechnicalAnswer2:
          "በመግቢያ ገጹ ላይ “የይለፍ ቃል ረሳሁ” የሚለውን ይጠቀሙ እና ወደ መለያዎ ኢሜይል የሚላኩትን መመሪያዎች ይከተሉ።",
        helpTechnicalQuestion3: "በእንግሊዝኛና በአማርኛ መካከል መቀያየር እችላለሁ?",
        helpTechnicalAnswer3:
          "አዎ። በድረ-ገጹ ላይ ያለውን የቋንቋ መቀየሪያ ወይም በመለያ ቅንብሮች ያለውን ምርጫ ይጠቀሙ።",
        helpContactKicker: "ድጋፍን ያነጋግሩ",
        helpContactTitle: "ተጨማሪ እርዳታ ይፈልጋሉ? መልእክት ይላኩልን",
        helpContactDescription: "በምን እንደምንረዳዎ ይግለጹ። ቡድናችን በሰጡት ኢሜይል ይመልስልዎታል።",
        helpContactSuccess: "መልእክትዎ ደርሶናል። ቡድናችን በኢሜይል ያገኝዎታል።",
        helpContactFailure: "መልእክትዎን መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
        helpContactSubmit: "መልእክት ይላኩ",
        helpContactSending: "በመላክ ላይ…",
        helpContactSubjectPlaceholder: "ጥያቄዎን በአጭሩ ይግለጹ",
        helpContactMessagePlaceholder: "እንድንረዳዎ የሚያስፈልጉ ዝርዝሮችን ያካትቱ።",
        supportCenter: "እርስዎን ለመርዳት እዚህ ነን",
        supportCenterDesc:
          "ቡድንን ስለመቀላቀል፣ ከእኛ ጋር ስለማስተማር ወይም መለያዎን ስለመጠቀም ጥያቄዎችን ይጠይቁ።",
        businessHours: "ከሰኞ–ቅዳሜ፣ ከጠዋቱ 2:30–12:00 ሰዓት (EAT)",
        addisAbabaEthiopia: "አዲስ አበባ፣ ኢትዮጵያ",
      },
    },
  },
  lng: (function () {
    if (typeof window === "undefined") return "en";
    try {
      const userChoice = localStorage.getItem("learnhub_user_language");
      if (userChoice === "am" || userChoice === "en") {
        return userChoice;
      }
      localStorage.setItem("i18nextLng", "en");
      return "en";
    } catch {
      return "en";
    }
  })(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

if (typeof document !== "undefined") {
  const syncDocumentLanguage = (language) => {
    document.documentElement.lang = language?.startsWith("am") ? "am" : "en";
    document.documentElement.dir = "ltr";
  };
  syncDocumentLanguage(i18n.language);
  i18n.on("languageChanged", syncDocumentLanguage);
}

export default i18n;
