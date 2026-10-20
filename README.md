# BookBridge — Social Reading Platform

BookBridge brings social networking and reading management into one place. Readers form reading groups, discuss books in spoiler-safe threads, share reviews and get genre-based recommendations.

Professional Training I project · Department of Computer Science and Engineering, School of Computing
**Student:** Srree Vaishnavi G V · **Guide:** Ms. Rajapriya S P, Associate Professor

**Live demo:** https://<your-username>.github.io/bookbridge/  (after enabling GitHub Pages on the `/docs` folder)

## Features
- **Authentication and profiles:** register and log in, favourite genres, personal reading list with To read / Reading / Finished shelves, yearly reading challenge and badges
- **Reading groups:** public and private groups, join requests, member roles, reading goals and progress, next-book polls
- **Discussion forum:** threads with categories, nested replies, likes, spoiler tags (`||text||`)
- **Reviews and recommendations:** star ratings and reviews, genre- and rating-based picks
- **Admin and moderation:** report content, remove it, block and restore users
- **BookBridge Labs (future development):** online reading, book availability, author conferences, publish and promote, author–reader Q&A, roadmap
- **API & Database page:** live request log, 8-table schema and REST endpoint list

## Architecture (three tiers)
| Tier | Technology |
|---|---|
| Presentation | HTML, CSS, JavaScript (single page, responsive, dark/light mode) |
| Application | Node.js, Express, JWT, bcrypt |
| Data | SQLite (8 tables, foreign keys, constraints) |

## Run the frontend
Open `frontend/index.html` in a browser. It uses a built-in browser-side API layer and stores data in localStorage, with 12 months of sample activity.

Sample logins: `Vaishu` / `vaishu123` (Admin) · `Vicky` / `vicky123` · `Sri` / `sri123` · `Divya` / `divya123` (Author) · `Priya` / `priya123`

## Run the backend
```bash
cd backend
npm install
npm start        # http://localhost:4000
```
Make an admin: `sqlite3 bookbridge.db "UPDATE users SET role='admin' WHERE name='you'"`

Key endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/books`, `POST /api/groups`, `POST /api/groups/:id/members`, `POST /api/threads`, `POST /api/comments`, `POST /api/reviews`, `GET /api/recommendations`, `POST /api/reports`, `DELETE /api/content/:type/:id`. Full list in `backend/server.js`.

> Note: the demo frontend does not call the Express server yet; it runs its own in-browser API layer that mirrors the same endpoints.

## Project structure
```
bookbridge/
├── frontend/   # single-page web app
├── docs/       # copy of the frontend, served by GitHub Pages
└── backend/    # Express + SQLite REST API
```
