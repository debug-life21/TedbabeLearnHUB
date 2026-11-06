# 🚀 TedbabeLearnHUB (TLH) — Free Deployment Guide

## Your Project at a Glance

| Component | Tech | What to Deploy |
|-----------|------|----------------|
| **Frontend (web)** | React + Vite | Static files → **Vercel** or **Netlify** |
| **Admin panel** | React + Vite | Static files → **Vercel** or **Netlify** |
| **Backend (server)** | Express 5 + Node.js | Node server → **Render** |
| **Database** | MongoDB (Mongoose) | Managed DB → **MongoDB Atlas** |
| **File uploads** | Local or Cloudflare R2 | R2 has a generous free tier |

---

## ✅ Yes, You Can Deploy This Entirely for Free

Here's the recommended free stack:

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Vercel      │     │  Render      │     │ MongoDB Atlas│
│  (Frontend)  │────▶│  (Backend)   │────▶│  (Database)  │
│  + Admin     │     │  Free tier   │     │  Free M0     │
└─────────────┘     └─────────────┘     └──────────────┘
```

---

## Step-by-Step Deployment

### 1️⃣ Database — MongoDB Atlas (Free)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and create an account
2. Create a **free M0 cluster** (512 MB storage, shared RAM — enough to start)
3. Under **Database Access**, create a user with a password
4. Under **Network Access**, add `0.0.0.0/0` (allow all IPs, needed for Render)
5. Click **Connect → Drivers** and copy the connection string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/learnhub?retryWrites=true&w=majority
   ```

> [!TIP]
> Atlas free tier gives you 512 MB storage with no time limit — perfect for getting started.

---

### 2️⃣ Backend — Render.com (Free)

1. Push your code to **GitHub** (if not already)
2. Go to [render.com](https://render.com) and sign up with GitHub
3. Click **New → Web Service** and connect your repo
4. Configure:

   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `apps/server` |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |
   | **Instance Type** | Free |

5. Add **Environment Variables**:

   | Variable | Value |
   |----------|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `MONGODB_URI` | *(your Atlas connection string)* |
   | `JWT_SECRET` | *(generate a strong 32+ char secret)* |
   | `CLIENT_URL` | `https://learnhub.vercel.app` *(your frontend URL)* |
   | `ADMIN_CLIENT_URL` | `https://learnhub-admin.vercel.app` |
   | `GOOGLE_CLIENT_ID` | *(if using Google OAuth)* |
   | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Gmail SMTP (`debuglife1221@gmail.com` + 16-char App Password) |
   | `RESEND_API_KEY` *(Recommended)* | Free HTTPS email API from [resend.com](https://resend.com). **100% immune to cloud port firewalls**. |
   | `BREVO_API_KEY` *(Alternative)* | Free HTTPS email API from [brevo.com](https://brevo.com) (300 emails/day, no credit card needed). |
   | `STORAGE_PROVIDER` | `r2` or `local` |
   | `GEMINI_API_KEY` *(Required for AI)* | Your Google Gemini API Key from [aistudio.google.com](https://aistudio.google.com/app/apikey) |
   | `OPENAI_API_KEY` *(Alternative)* | OpenAI API Key if using ChatGPT |

> [!IMPORTANT]
> **Why do OTP emails need Resend or Brevo on Render?**
> Render's free tier blocks outbound SMTP ports (`25`, `465`, and `587`) by default to prevent spam.
> To inbox real OTP emails directly on Render:
> 1. Sign up for free at **[resend.com](https://resend.com)** (takes 60 seconds).
> 2. Create an API key (`re_...`) and add `RESEND_API_KEY` in your Render Environment Variables.
> 3. That's it! Emails are sent via secure HTTPS (port 443) and arrive in the user's inbox instantly.
> 
> *If unconfigured, the system automatically detects the network firewall block and securely displays the OTP code on the verification screen so users are never stuck or locked out.*

6. Click **Deploy**

> [!WARNING]
> Render free tier **spins down after 15 min of inactivity** and takes ~30s to cold-start. This is acceptable for a demo/portfolio but not for production traffic. If this is a concern, consider upgrading to the $7/mo Starter plan.

---

### 3️⃣ Frontend (web) — Vercel (Free)

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click **Import Project** → select your repo
3. Configure:

   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `apps/web` |
   | **Framework Preset** | Vite |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `dist` |

4. Add **Environment Variable**:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | `https://your-backend.onrender.com` |

5. Deploy!

---

### 4️⃣ Admin Panel — Vercel (Free, separate project)

Repeat the same steps as the frontend, but:

| Setting | Value |
|---------|-------|
| **Root Directory** | `apps/admin` |
| **Project Name** | `learnhub-admin` |

Add the same `VITE_API_URL` env var pointing to your Render backend.

---

## 🌐 Custom Domain Name

### Option A: Free Subdomain (no cost)

Out of the box you'll get:
- **Vercel**: `learnhub.vercel.app`
- **Render**: `learnhub-api.onrender.com`

### Option B: Custom Domain (~$1–12/year)

Truly free custom domains are unreliable. Here are the **cheapest reliable options**:

| Registrar | Price | Notes |
|-----------|-------|-------|
| [**Namecheap**](https://namecheap.com) | ~$1.98/yr for `.xyz` | Cheapest reliable option |
| [**Cloudflare Registrar**](https://www.cloudflare.com/products/registrar/) | At-cost pricing (~$8/yr for `.com`) | No markup, great DNS |
| [**Porkbun**](https://porkbun.com) | ~$2/yr for `.xyz`, `.tech` | Excellent budget registrar |
| [**Google Domains** (Squarespace)](https://domains.squarespace.com) | ~$12/yr for `.com` | Premium but well-integrated |

> [!TIP]
> `.xyz`, `.tech`, and `.dev` domains are often under $5/year. For example, `learnhub.xyz` could cost as little as **$1.98/year** on Namecheap.

### Connecting Your Domain

#### On Vercel (Frontend):
1. Go to your Vercel project → **Settings → Domains**
2. Add your domain (e.g., `learnhub.xyz`)
3. Vercel gives you DNS records to add at your registrar:
   - **A Record**: `76.76.21.21`
   - **CNAME**: `cname.vercel-dns.com`
4. Vercel auto-provisions **free SSL** (HTTPS)

#### On Render (Backend):
1. Go to your Render service → **Settings → Custom Domain**
2. Add your API subdomain (e.g., `api.learnhub.xyz`)
3. Add the CNAME record Render provides at your registrar
4. Render auto-provisions **free SSL**

### Recommended Domain Setup:
```
learnhub.xyz          → Vercel (frontend)
admin.learnhub.xyz    → Vercel (admin panel)
api.learnhub.xyz      → Render (backend)
```

---

## 📋 Pre-Deployment Checklist

Before deploying, make sure your code is ready:

- [ ] **API URL is configurable** — Frontend uses `import.meta.env.VITE_API_URL` (not hardcoded `localhost`)
- [ ] **CORS is configured** — Your Express server allows requests from your Vercel domain
- [ ] **MongoDB URI is from Atlas** — Not `localhost:27017`
- [ ] **JWT_SECRET is strong** — Not the default `learnhub_dev_secret_please_change`
- [ ] **File uploads** — If using local storage, switch to R2 (Render's filesystem is ephemeral)
- [ ] **Code is on GitHub** — Both Vercel and Render deploy from Git

> [!IMPORTANT]
> **File uploads will NOT persist on Render's free tier** because the filesystem is ephemeral. You should set `STORAGE_PROVIDER=r2` and use Cloudflare R2 (10 GB/month free) for production file storage.

---

## 💰 Total Cost Summary

| Service | Cost | What You Get |
|---------|------|--------------|
| MongoDB Atlas M0 | **Free** | 512 MB database |
| Render Free | **Free** | Backend hosting (cold starts) |
| Vercel Free | **Free** | Frontend + Admin hosting |
| Cloudflare R2 | **Free** | 10 GB storage, 1M requests/month |
| Domain (`.xyz`) | **~$2/year** | Custom domain name |
| **Total** | **$0–$2/year** | |

---

## 🔄 Alternative Free Platforms

If you prefer alternatives:

| Component | Alternatives |
|-----------|-------------|
| Frontend | **Netlify** (free), **Cloudflare Pages** (free), **GitHub Pages** (static only) |
| Backend | **Railway** (free trial with $5 credit), **Fly.io** (free tier), **Cyclic** |
| Database | **Supabase** (PostgreSQL, free tier), **PlanetScale** (MySQL, free tier) |

---

> [!NOTE]
> If this is for a class project demo or portfolio, the free tiers above are more than sufficient. If you expect real users and traffic, plan to upgrade the Render backend ($7/mo) to avoid cold starts.
