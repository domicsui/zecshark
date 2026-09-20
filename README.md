# 🦈 ZECKSHARK — 2222 NFTs on Zcash

Official production-ready Web3 NFT project website for **ZECKSHARK**, a privacy-focused 2222 pixel-art shark NFT collection natively built for the **Zcash ecosystem**.

---

## 🌟 Key Features

- **Official Pixel Artwork**: Utilizes official ZECKSHARK branding, pixel logo, wide banner, retro palette (Orange `#FF8800` & Yellow `#FFC107`), chunky arcade borders, and retro CRT scanlines.
- **Interactive HTML5 Canvas Banner**: Real-time bubbling particles, sweeping caustic sunbeam light rays, and an animated pixel shark responding to mouse movement and sound blips.
- **Real Database-Backed Registration Counter**: Real-time registered users counter synchronized via Server-Sent Events (SSE) and persistent SQLite database (no fake random numbers).
- **Sequential Social Quest Engine**:
  - Task 01: Connect X (`@zecshark`)
  - Task 02: Follow `@zecshark`
  - Task 03: Like + Repost Genesis Announcement
  - Task 04: Quote Tweet
  - Task 05: Comment
  - Step 06: Enter Zcash Shielded Wallet (Unified `u1...` or Sapling `zs1...`)
  - Step 07: Submit Application & generate unique `#ZK-XXXXXX` code
- **Strict Zcash Shielded Address Support**:
  - Exclusively validates and accepts **Zcash Shielded addresses** (Unified `u1...` ~60–300 chars & Sapling `zs1...` ~78 chars).
  - Automatically rejects unshielded transparent (`t1...`) and EVM (`0x...`) addresses with actionable security guidance.
- **Shielded Wallet Checker**: Rate-limited whitelist checker allowing users to verify if their shielded address is approved for priority mint allocation.
- **8-Bit Synthetic Audio**: Retro Web Audio API sound effects on button clicks, quest validations, error buzzes, and success fanfares with an arcade mute toggle.
- **Private Admin Portal (`/admin`)**:
  - Secret route hidden from public navigation.
  - Protected with JWT authentication.
  - Real-time KPI metrics, sequential task manager (add/archive/reorder/toggle), waitlist review, CSV export/import for eligible wallets, and immutable audit logging.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Canvas API, Web Audio API
- **Backend**: Node.js, Express.js
- **Database**: SQLite with `@libsql/client` (auto-migrating & self-seeding on startup)
- **Real-Time Updates**: Server-Sent Events (SSE)
- **Security**: Helmet, express-rate-limit, cookie-parser, bcryptjs, jsonwebtoken

---

## 🚀 Getting Started

### 1. Installation

```bash
# Clone repository
git clone https://github.com/domicsui/zecshark.git
cd zecshark

# Install dependencies
npm install
```

### 2. Build Frontend

```bash
npm run build
```

### 3. Run Production Server

```bash
npm start
```

The application will be accessible at:
- **Public Website**: [http://localhost:5000](http://localhost:5000)
- **Waitlist Quest**: [http://localhost:5000/waitlist](http://localhost:5000/waitlist)
- **Shielded Wallet Checker**: [http://localhost:5000/checker](http://localhost:5000/checker)
- **Admin Portal**: [http://localhost:5000/admin](http://localhost:5000/admin)

---

## 🔐 Default Admin Credentials

- **URL**: `/admin` (Direct link, not listed in public navbar)
- **Username**: `admin`
- **Password**: `zeckshark2026!`

*(Change default password and JWT secret in production settings)*

---

## 📁 Project Structure

```
├── client/              # Raw client assets
├── dist/                # Compiled production frontend bundle
├── public/              # Static assets (official logo, banner)
├── server/
│   ├── db.js            # SQLite database schema, tables & seeds
│   ├── index.js         # Express server & route mounting
│   ├── middleware/      # JWT auth, rate limiting
│   ├── routes/          # Admin, Checker, Waitlist, Stats, Settings APIs
│   └── services/        # X (Twitter) verification engine
├── src/
│   ├── components/      # Navbar, Footer, PixelCard, PixelButton, AnimatedBanner
│   ├── context/         # StatsContext (real-time SSE count)
│   ├── pages/           # HomePage, WaitlistPage, CheckerPage, RoadmapPage, FaqPage, AdminPage
│   └── utils/           # API fetcher, audio synthesizer, confetti
└── test/                # End-to-end automated verification scripts
```

---

## 📜 License

MIT License © 2026 ZECKSHARK. 2222 Pixel Sharks on Zcash.
