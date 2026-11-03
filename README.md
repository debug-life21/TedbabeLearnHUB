# TedbabeLearnHUB (TLH) — Universal Online Learning & Education Management Platform

TedbabeLearnHUB (TLH) is a modern, responsive, and secure full-stack education management platform built using the **MERN** stack (MongoDB, Express.js, React.js, Node.js) with JavaScript throughout.

---

## 🌟 Key Highlights & Architectural Features

- **Focused Public Navigation**: The main navigation prioritizes course discovery, how learning works, instructors, FAQs, and contact support. Less-used links remain available in the site footer.
- **Social Media Links**: Configure LearnHUB's Facebook, X/Twitter, Telegram, YouTube, and TikTok URLs in `apps/web/src/components/SocialLinks.jsx`. A compact fixed icon bar appears at the bottom-right of the site. Unconfigured profiles remain visible but disabled until their official URLs are added.

### 1. Non-Negotiable Business Rules (Server-Enforced)
- **Hub Admin Controls Teacher Hiring**: Teachers cannot approve themselves or hire other teachers. All teacher applicants remain pending until reviewed and approved or rejected by the Hub Admin.
- **Hub Admin Controls Student Placement**: Students submit learning interests, skill levels, and schedule preferences upon registration. The Hub Admin assigns each student to an appropriate course, class, and teacher. Students cannot self-assign.
- **Complete Onboarding Profiles**: Student registration collects course choices, learning goals, skill level, weekly study hours, time zone, and preferred study times. Teacher applications collect qualifications, teaching experience, subjects, availability, a required CV, and optional certificates for administrator review.
- **Dashboard Profiles & Settings**: Students, teachers, and administrators can upload a profile photo and edit essential personal details. Teacher profiles include qualifications, expertise, experience, and availability; student learning preferences remain separately editable. All roles can manage language, device class reminders, and account security from their dashboard.
- **Modern Dashboard Navigation**: Student, teacher, admin, and cohort learning spaces use a persistent left-side vertical menu on desktop and a horizontally scrollable menu on smaller screens.
- **Modern Registration Experience**: Student and teacher signup use role-specific onboarding panels, accessible role selection, clearly grouped account and learning/application details, and responsive layouts. Required course choices, teaching documents, email verification, and teacher approval steps remain enforced.
- **Teachers Teach Assigned Classes**: Strict server-side RBAC ensures teachers can only view and manage classes assigned directly to them.
- **Students Access Assigned Learning Only**: Students have verified access exclusively to their enrolled courses, authorized Google Meet links, class materials, assignments, and quizzes.
- **Server-Side Authorization on Every Protected Endpoint**: Authorization uses cryptographic JWT sessions in HttpOnly SameSite cookies, verified in middleware.
- **Admin Management Workspace**: Administrators can create, activate, suspend, and remove accounts; manage categories, courses, cohorts, sessions, announcements, FAQs, and contact inquiries; and review changes recorded in the audit log. Deleting a cohort removes its associated learning records, while account deletion anonymizes the account and retains historical learning records.
- **Real Data & Functionality**: All users, courses, classes, sessions, attendance, assignments, submissions, quizzes, notifications, and certificates are stored in MongoDB.

### 2. Dual Language Support (አማርኛ / English)
- **Primary Language**: Amharic (አማርኛ) as the default interface language.
- **Secondary Language**: English with persistent localStorage preference and instant one-click toggle.
- Clean font rendering with Ethiopic Unicode typography (`Noto Sans Ethiopic` & `Plus Jakarta Sans`).

### 3. Integrated Live Google Meet Lessons
- Scheduled class sessions include verified Google Meet links (`https://meet.google.com/...`).
- Live class buttons show a live countdown and unlock five minutes before the session starts; early browser reminders can still notify learners ten minutes before class.
- Google Meet opens in a new tab because standard Meet links cannot be embedded in arbitrary application iframes.
- Teacher schedule conflict prevention prevents double-booking teachers for overlapping sessions.

### 4. Continuous Evaluation & Progress Modeling
- Weighted progress formula: `(attendance × 40%) + (assignments × 40%) + (quizzes × 20%)`.
- 70%+ overall score required to claim a verifiable digital certificate.
- Real-time scoring for multiple-choice quizzes with server-side answer evaluation.
- Teachers grade assignments with numeric scores and personalized feedback.
- Session attendance tracking (`Present`, `Absent`, `Late`, `Excused`).

### 5. Verifiable Digital Certificates
- Students who meet the 70%+ weighted threshold can claim a unique `LH-YYYY-XXXX` certificate.
- Public verification endpoint: `/verify-certificate` and `/api/public/certificates/:certNumber`.

### 6. Public Course Catalog
- 119 seeded courses across 11 categories: Languages, Primary Grades 1–4, Middle School Grades 5–8, Secondary School Grades 9–12, University, Web Development, Programming, AI/Data, IT, Design, Business.
- Full-text search, category filter, skill level filter, and pagination at `GET /api/public/courses`.
- Individual course pages with syllabus, outcomes, and cohort call-to-action.

### 7. Learning Workspace
- In-browser video player with playback speed controls and localStorage progress saving.
- PDF/document viewer for class resources.
- Administrators can add cohort resources from the **Resources** dashboard tab: embed YouTube videos or Google Drive PDFs, Word documents, spreadsheets, and presentations without using LearnHUB server disk or an R2 account. Google Drive and YouTube resources open in the Learning Space; Drive files must be shared with viewer access for the intended audience. Locally uploaded DOCX, XLSX, and PPTX files are parsed and previewed in the Learning Space; legacy DOC/XLS/PPT files are not supported by that preview. YouTube embeds use its privacy-enhanced player and `rel=0`; YouTube may still show same-channel recommendations or creator-added end screens.
- Direct file uploads remain available and use local storage by default; Cloudflare R2 is optional, not required for embedded links.
- Upload storage can use Cloudflare R2. Set `STORAGE_PROVIDER=r2` and the R2 credentials in the server `.env`; files stay private and are streamed through authenticated LearnHUB resource routes.
- Lesson syllabus checklist per cohort.
- Cohort discussion board with threaded replies (student & teacher).
- Google Meet join control with a live countdown and a five-minute pre-class join window.

### 8. Password Reset & Account Security
- Secure forgot-password flow: 6-digit code + token link, bcrypt-hashed at rest, 15-minute expiry.
- Security alert emails for password changes.
- In-dashboard password change with current-password verification.
- Verification and password-reset emails report delivery failures instead of pretending they were sent.

### 9. Secure File & Resource Management
- Educational file upload with MIME type and extension validation.
- Role-based download authorization ensuring private materials are accessible only to enrolled participants.

### 10. Analytics, Monetization & Payments
- Administrator analytics are calculated from MongoDB student, course, classroom, attendance, assessment, and activity records.
- Admins can price courses, create one-time and recurring plans, manage promotions, review subscriptions, and view payment/revenue reports.
- Student checkout supports configured providers only. Orders and transaction status are verified server-side; a successful payment records the purchased entitlement and course registration request but never assigns a classroom.
- Students can review order history and print receipts. Subscription renewals require a new student-paid order; automatic charges are not enabled.
- Financial values are stored as integer santim. Reports separate collected gross, gateway fees, refunds, and net revenue.
- Chapa and Telebirr require merchant credentials. Telebirr configuration depends on Ethio Telecom merchant onboarding; provider availability, fees, refunds, settlement, and webhook requirements must be confirmed for the merchant account before live use.
- Payment integrations have not been verified against this deployment's provider sandbox or live merchant accounts. Keep `PAYMENTS_ENABLED=false` until provider setup, webhook delivery, and end-to-end verification have been tested.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** (v20.19+ or v22.12+; required by Vite 8)
- **MongoDB Community Server** installed locally and listening on port 27017

### 1. Installation
Clone the repository and install all workspace dependencies:
```bash
npm install
```

### 2. Configure Environment

Copy the example environment files:
```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/server/.env` with your actual values:

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | At least 32-character secret |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth Web Client ID |
| `SMTP_HOST` | Optional | SMTP host for email (e.g. smtp.gmail.com) |
| `SMTP_USER` | Optional | SMTP email **address** (e.g. yourname@gmail.com) |
| `SMTP_PASS` | Optional | SMTP app password |
| `ADMIN_EMAIL` | ✅ (seed) | Bootstrap admin email |
| `ADMIN_PASSWORD` | ✅ (seed) | Bootstrap admin password |

> **Email Note:** Configure valid SMTP credentials to deliver verification codes and password-reset links. If SMTP is missing in development, codes and reset links are logged to the server console; if a configured SMTP server rejects a message, the request returns an error and details are logged by the server.

### 3. Start MongoDB
```bash
# One-time: start with a local data directory
mkdir -p .data/db
mongod --dbpath .data/db --bind_ip 127.0.0.1 --port 27017
# Or if installed as a service:
sudo systemctl start mongod
```

### 4. Seed the Database
```bash
# Seed 11 categories + 119 catalog courses
npm run seed:catalog

# Provision the initial Hub Admin account (from ADMIN_EMAIL / ADMIN_PASSWORD in .env)
npm run seed:admin
```

### 5. Development Mode
```bash
npm run dev
```
| App | URL |
|---|---|
| Web App (Public + Student + Teacher) | http://localhost:5173 |
| Admin Portal | http://localhost:5174 |
| Backend API | http://localhost:4000 |

Check API health: http://localhost:4000/api/health

### 6. Google OAuth Setup
1. Open **Google Cloud Console → APIs & Services → Credentials → Create Web Application OAuth Client ID**
2. Add `http://localhost:5173` to **Authorized JavaScript origins**
3. Set `GOOGLE_CLIENT_ID` in `apps/server/.env` and `VITE_GOOGLE_CLIENT_ID` in `apps/web/.env`
4. Restart both development servers

### 7. Production Build & Tests
```bash
# Full production bundle (server + web + admin)
npm run build

# Linting across all workspaces
npm run lint

# Automated integration tests (requires MongoDB)
npm test
```

---

## 🌐 Public Routes

| Path | Description |
|---|---|
| `/` | Homepage with hero carousel and featured courses |
| `/courses` | Public course catalog with search & filter |
| `/courses/:slug` | Individual course detail + syllabus |
| `/categories` | Browse by learning category |
| `/how-it-works` | 5-step learner journey + teacher recruitment process |
| `/pricing` | Cohort plans & pricing |
| `/instructors` | Certified educator directory |
| `/help` | Searchable help center & inquiry form |
| `/about` | About LearnHUB |
| `/faq` | Frequently asked questions |
| `/contact` | Contact & support |
| `/verify-certificate` | Public certificate credential lookup |
| `/payment/result` | Student payment return and server verification |
| `/sign-in` | Sign in page |
| `/register/student` | Student registration |
| `/apply/teacher` | Teacher application |
| `/forgot-password` | Password reset request |
| `/reset-password` | Password reset confirmation |

## 🧾 Student & Teacher Onboarding

- Students select one or more published courses grouped by catalog category (Digital Marketing is listed first) and provide their learning goals, current level, weekly study availability, and time zone during registration. They can update these details from **Learning preferences** in the student dashboard; the administrator uses them when reviewing cohort placement.
- Teacher applicants provide their contact phone, qualifications, teaching experience, years of experience, subjects, availability, and a short teaching statement, and upload a CV. They may also upload up to five supporting certificates. Each document is limited to 5MB and the combined upload limit is 10MB. Application files are stored privately and can only be downloaded by Hub Administrators from the application review view.
- Approved teachers can update their professional profile, contact details, teaching subjects, qualifications, and availability from the teacher dashboard.
- Students and teachers can view scheduled and currently running live classes from their dashboards. Session times are displayed in each user's device time zone, with the cohort time zone shown when it differs. Administrators schedule sessions in the cohort's configured time zone and can review the assigned teacher, learners, and session state.
- Students and teachers can enable browser/device notifications for a reminder about 10 minutes before class. Notifications require browser permission and LearnHUB to remain open; closing the browser stops these in-page reminders.

## 🔐 Authenticated Routes

| Path | Roles | Description |
|---|---|---|
| `/app` | Student, Teacher | Dashboard (role-dispatched) |
| `/workspace/:classroomId` | Student, Teacher | Learning workspace with video + discussions |

---

## 📡 Key API Endpoints

### Public
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/public/courses` | Search & paginated course catalog |
| `GET` | `/api/public/courses/:slugOrId` | Course detail with syllabus |
| `GET` | `/api/public/plans` | Active sellable plans and package benefits |
| `GET` | `/api/public/instructors` | Approved educator directory |
| `GET` | `/api/public/certificates/:certNumber` | Certificate verification |
| `GET` | `/api/public/home` | Home stats & featured courses |
| `GET` | `/api/public/categories` | Learning categories |
| `GET` | `/api/public/faqs` | Published FAQs |
| `POST` | `/api/public/contact` | Contact form submission |

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Register student or teacher |
| `POST` | `/api/auth/verify-code` | Confirm 6-digit verification code |
| `POST` | `/api/auth/login` | Local email/password sign in |
| `POST` | `/api/auth/google` | Google OAuth sign in / sign up |
| `POST` | `/api/auth/forgot-password` | Request password reset (code + link) |
| `POST` | `/api/auth/reset-password` | Confirm reset with code or token |
| `POST` | `/api/auth/change-password` | Change password (authenticated) |
| `PATCH` | `/api/auth/profile` | Update profile (authenticated) |
| `GET` | `/api/auth/me` | Current session user |
| `POST` | `/api/auth/logout` | Clear session cookie |

### Student Payments
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/payments/config` | Enabled payment methods and provider capabilities; no secrets |
| `POST` | `/api/payments/orders` | Create an order from server-priced course/plan IDs |
| `POST` | `/api/payments/checkout` | Initialize a provider checkout |
| `GET` | `/api/payments/orders` | Student-scoped order history with transaction statuses |
| `POST` | `/api/payments/orders/:orderId/verify` | Server-to-server provider verification |
| `GET` | `/api/payments/transactions/:transactionId/receipt` | Student-owned receipt data |
| `GET` | `/api/payments/subscriptions` | Student subscription history |
| `POST` | `/api/payments/subscriptions/:subscriptionId/cancel` | Schedule cancellation at the end of the paid period |
| `POST` | `/api/payments/webhook/:providerId` | Provider webhook; signature validation is required |

### Administrator Analytics & Finance
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/analytics/dashboard` | Platform-wide learning analytics |
| `GET` | `/api/admin/monetization/plans` | Manage plans, prices, and benefits |
| `GET` | `/api/admin/payments/dashboard` | Revenue, fees, refunds, and provider performance |
| `GET` | `/api/admin/payments/transactions` | Filtered transaction ledger |
| `GET` | `/api/admin/payments/transactions/export.csv` | Filtered CSV transaction report (up to 5,000 rows) |
| `POST` | `/api/admin/payments/reconcile` | Re-verify pending gateway transactions |

Admin analytics, monetization, and payment routes require the `hub_admin` role. Student order, receipt, and subscription routes are scoped to the authenticated student.

---

## 📁 Project Architecture

```
LearnHUB/
├── apps/
│   ├── server/                         # Express.js + Mongoose Backend
│   │   ├── src/
│   │   │   ├── models/                 # Mongoose schemas
│   │   │   │   ├── User.js             # Users with roles, verification, reset tokens
│   │   │   │   ├── Course.js           # Courses with syllabus modules & lessons
│   │   │   │   ├── Classroom.js        # Live cohorts
│   │   │   │   ├── Certificate.js      # Verifiable digital certificates
│   │   │   │   ├── Discussion.js       # Classroom discussion threads
│   │   │   │   └── ...                 # Assignment, Quiz, Attendance, etc.
│   │   │   ├── routes/                 # REST endpoints
│   │   │   │   ├── authRoutes.js       # Auth, forgot/reset password, profile
│   │   │   │   ├── publicRoutes.js     # Catalog, instructors, certificates
│   │   │   │   ├── studentRoutes.js    # Student dashboard, certificates, discussions
│   │   │   │   ├── teacherRoutes.js    # Teacher dashboard, discussions
│   │   │   │   ├── adminRoutes.js      # Admin: users, approvals, classes
│   │   │   │   └── resourceRoutes.js   # File upload/download
│   │   │   ├── controllers/            # Auth handlers (incl. forgotPassword, resetPassword)
│   │   │   ├── middleware/             # JWT protect + RBAC
│   │   │   ├── utils/email.js          # Branded HTML email with dev-safe fallback
│   │   │   ├── auth.js                 # Password hashing, JWT cookies
│   │   │   ├── seedCatalog.js          # 11 categories + 119 courses
│   │   │   ├── seedAdmin.js            # Admin bootstrap from env
│   │   │   ├── app.js                  # Express + Helmet + CORS + Rate Limiting
│   │   │   └── index.js                # Server entry point
│   │   ├── test/
│   │   │   └── system.test.js          # Catalog, auth, payment and RBAC integration tests
│   │   └── package.json
│   ├── web/                            # React 19 + Vite Frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Navbar.jsx          # Full navigation with new routes
│   │   │   │   ├── Footer.jsx          # Expanded footer with all public links
│   │   │   │   └── ...                 # UIComponents, BrandLogo, etc.
│   │   │   ├── pages/
│   │   │   │   ├── HomePage.jsx        # Hero carousel (PRESERVED as-is)
│   │   │   │   ├── CourseCatalogPage.jsx
│   │   │   │   ├── CourseDetailsPage.jsx
│   │   │   │   ├── HowItWorksPage.jsx
│   │   │   │   ├── PricingPage.jsx
│   │   │   │   ├── InstructorsPage.jsx
│   │   │   │   ├── HelpCenterPage.jsx
│   │   │   │   ├── VerifyCertificatePage.jsx
│   │   │   │   ├── LearningWorkspace.jsx
│   │   │   │   ├── AuthPages.jsx       # ForgotPasswordPage, ResetPasswordPage added
│   │   │   │   ├── StudentDashboard.jsx # Learning dashboard, payments, receipts and subscriptions
│   │   │   │   └── TeacherDashboard.jsx # Workspace button + Account Security tab
│   │   │   ├── context/AuthContext.jsx
│   │   │   ├── i18n.js
│   │   │   ├── App.jsx                 # All routes registered
│   │   │   └── index.css
│   │   ├── public/
│   │   │   ├── robots.txt
│   │   │   └── sitemap.xml
│   │   └── index.html                  # OpenGraph + Twitter Card meta tags
│   └── admin/                          # Admin Portal (React + Vite)
├── package.json                        # Root workspace with test + build scripts
└── README.md
```

---

## 🧪 Test Results

Run: `npm test`

Last verified locally: **25 tests passed, 0 failed**. The suite covers catalog, authentication, RBAC, certificates, payment fulfillment/idempotency, provider amount/currency validation, subscription cancellation ownership, CORS origin rejection, and external resource URL validation.

---

## 🔧 Environment Variables Reference

### `apps/server/.env`

```env
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/learnhub
CLIENT_URL=http://localhost:5173
ADMIN_CLIENT_URL=http://localhost:5174
JWT_SECRET=your-secure-32-char-secret
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youraddress@gmail.com        # Note: must be email address, NOT hostname
SMTP_PASS=your-gmail-app-password
ADMIN_EMAIL=admin@learnhub.et
ADMIN_PASSWORD=your-secure-admin-password
SEED_DEMO_DATA=false
STORAGE_PROVIDER=local
PAYMENTS_ENABLED=false
PAYMENT_ENVIRONMENT=sandbox
SERVER_PUBLIC_URL=https://your-api.example
CHAPA_SECRET_KEY=
CHAPA_WEBHOOK_SECRET=
CHAPA_BASE_URL=https://api.chapa.co/v1
CHAPA_FEE_PERCENT=2.5
TELEBIRR_BASE_URL=
TELEBIRR_MERCHANT_APP_ID=
TELEBIRR_MERCHANT_CODE=
TELEBIRR_PRIVATE_KEY=
TELEBIRR_PUBLIC_KEY=
TELEBIRR_NOTIFY_URL=
TELEBIRR_FEE_PERCENT=0
# For Cloudflare R2, set STORAGE_PROVIDER=r2 and fill all R2 values:
R2_ACCOUNT_ID=
R2_BUCKET=learnhub-resources
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
```

Keep payment keys only in server-side environment secrets, never in `VITE_*` variables. Chapa's webhook URL is `{SERVER_PUBLIC_URL}/api/payments/webhook/chapa`. Configure the matching webhook secret in the Chapa merchant dashboard. Telebirr requires credentials, endpoints, whitelisting, and webhook details issued for the merchant account; do not infer them from another provider's setup. Fee percentages are reporting estimates unless the provider returns an actual charge. Refund support is not assumed to be available through either adapter.

For sandbox testing, configure a provider account, expose the API over HTTPS, register the exact webhook URL, set `PAYMENTS_ENABLED=true` and `PAYMENT_ENVIRONMENT=sandbox`, and complete an initialize → provider payment → webhook/server verification → entitlement → receipt round trip. Only consider `PAYMENT_ENVIRONMENT=live` after live merchant onboarding and a controlled live transaction have been verified. This repository change alone does not establish sandbox or live readiness.

Keep R2 credentials only in `apps/server/.env` (or your hosting provider's server-side secrets), never in frontend environment variables or committed files. Switching to R2 affects new uploads; existing local files must be migrated separately before removing the old server storage.

To migrate existing resources and teacher application documents after setting `STORAGE_PROVIDER=r2` and all four R2 values, run `npm run migrate:uploads-to-r2 --workspace server`. The script copies files to R2, updates their storage metadata, and retains the local originals as a backup. It can be rerun safely if it stops partway through.

### `apps/web/.env`

```env
VITE_API_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```
