# BookBridge API
Three-tier backend: Express (application) + SQLite (data). JWT auth, bcrypt hashing, role guards (member/author/admin), prepared statements.
Run: `npm install && npm start` (port 4000). Make an admin: `sqlite3 bookbridge.db "UPDATE users SET role='admin' WHERE name='you'"`.
