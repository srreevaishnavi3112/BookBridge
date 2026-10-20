// BookBridge REST API: Express + SQLite + JWT. Run: npm install && npm start
const express=require('express'),cors=require('cors'),Database=require('better-sqlite3'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),fs=require('fs');
const SECRET=process.env.JWT_SECRET||'dev-secret-change-me',db=new Database('bookbridge.db');
db.pragma('foreign_keys=ON');db.exec(fs.readFileSync(__dirname+'/schema.sql','utf8'));
const app=express();app.use(cors(),express.json());
const bad=(res,c,m)=>res.status(c).json({error:m});
const auth=roles=>(req,res,next)=>{try{req.user=jwt.verify((req.headers.authorization||'').replace('Bearer ',''),SECRET)}catch{return bad(res,401,'Login required')}
 const u=db.prepare('SELECT blocked FROM users WHERE id=?').get(req.user.id);if(!u||u.blocked)return bad(res,403,'Account restricted');
 if(roles&&!roles.includes(req.user.role))return bad(res,403,'Forbidden');next()};
const member=(gid,uid)=>db.prepare("SELECT role FROM group_members WHERE group_id=? AND user_id=? AND status='active'").get(gid,uid);
// ---- Auth ----
app.post('/api/auth/register',(req,res)=>{const{name,password,genres=[]}=req.body;
 if(!/^[A-Za-z][A-Za-z0-9_.-]{1,23}$/.test(name||'')||(password||'').length<6)return bad(res,400,'Invalid name or password');
 try{res.status(201).json({id:db.prepare('INSERT INTO users(name,password_hash,genres) VALUES(?,?,?)').run(name,bcrypt.hashSync(password,10),JSON.stringify(genres)).lastInsertRowid})}catch{bad(res,409,'Username taken')}});
app.post('/api/auth/login',(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE name=?').get(req.body.name);
 if(!u||!bcrypt.compareSync(req.body.password||'',u.password_hash))return bad(res,401,'Invalid credentials');
 res.json({token:jwt.sign({id:u.id,role:u.role},SECRET,{expiresIn:'2h'}),role:u.role})});
// ---- Books ----
app.get('/api/books',(req,res)=>{const{genre='',q=''}=req.query,l=`%${q}%`;
 res.json(db.prepare("SELECT b.*,ROUND(AVG(r.rating),1) avg_rating FROM books b LEFT JOIN reviews r ON r.book_id=b.id WHERE (?='' OR genre=?) AND (title LIKE ? OR author LIKE ?) GROUP BY b.id").all(genre,genre,l,l))});
app.post('/api/books',auth(['author','admin']),(req,res)=>{const{title,genre}=req.body;if(!title||!genre)return bad(res,400,'title and genre required');
 const u=db.prepare('SELECT name FROM users WHERE id=?').get(req.user.id);res.status(201).json({id:db.prepare('INSERT INTO books(title,author,genre) VALUES(?,?,?)').run(title,u.name,genre).lastInsertRowid})});
// ---- Reading groups ----
app.get('/api/groups',auth(),(req,res)=>res.json(db.prepare("SELECT g.*,(SELECT COUNT(*) FROM group_members m WHERE m.group_id=g.id AND status='active') members FROM reading_groups g WHERE is_public=1 OR id IN(SELECT group_id FROM group_members WHERE user_id=?)").all(req.user.id)));
app.post('/api/groups',auth(),(req,res)=>{const{name,book_id,is_public=1,goal=''}=req.body;if(!name||!book_id)return bad(res,400,'name and book_id required');
 const tx=db.transaction(()=>{const g=db.prepare('INSERT INTO reading_groups(name,book_id,is_public,goal,lead_id) VALUES(?,?,?,?,?)').run(name,book_id,is_public?1:0,goal,req.user.id).lastInsertRowid;
  db.prepare("INSERT INTO group_members VALUES(?,?,'lead','active')").run(g,req.user.id);return g});res.status(201).json({id:tx()})});
app.post('/api/groups/:id/members',auth(),(req,res)=>{const g=db.prepare('SELECT * FROM reading_groups WHERE id=?').get(req.params.id);if(!g)return bad(res,404,'No such group');
 try{const s=g.is_public?'active':'pending';db.prepare('INSERT INTO group_members VALUES(?,?,?,?)').run(g.id,req.user.id,'member',s);res.status(201).json({status:s})}catch{bad(res,409,'Already a member or requested')}});
app.patch('/api/groups/:id/members/:uid',auth(),(req,res)=>{const m=member(req.params.id,req.user.id);if(!(m&&m.role=='lead')&&req.user.role!='admin')return bad(res,403,'Group lead only');
 db.prepare('UPDATE group_members SET status=COALESCE(?,status),role=COALESCE(?,role) WHERE group_id=? AND user_id=?').run(req.body.status,req.body.role,req.params.id,req.params.uid);res.json({ok:true})});
// ---- Discussion forum ----
app.get('/api/groups/:id/threads',auth(),(req,res)=>{if(!member(req.params.id,req.user.id))return bad(res,403,'Members only');
 const cm=db.prepare('SELECT c.*,u.name author FROM comments c JOIN users u ON u.id=c.author_id WHERE thread_id=?');
 res.json(db.prepare('SELECT t.*,u.name author FROM threads t JOIN users u ON u.id=t.author_id WHERE group_id=? ORDER BY t.id DESC').all(req.params.id).map(t=>({...t,comments:cm.all(t.id)})))});
app.post('/api/threads',auth(),(req,res)=>{const{group_id,title,body,category='General'}=req.body;if(!member(group_id,req.user.id))return bad(res,403,'Join the group first');if(!title||!body)return bad(res,400,'title and body required');
 res.status(201).json({id:db.prepare('INSERT INTO threads(group_id,author_id,category,title,body) VALUES(?,?,?,?,?)').run(group_id,req.user.id,category,title,body).lastInsertRowid})});
app.post('/api/comments',auth(),(req,res)=>{const{thread_id,parent_id=null,body}=req.body,t=db.prepare('SELECT group_id FROM threads WHERE id=?').get(thread_id);
 if(!t)return bad(res,404,'No such thread');if(!member(t.group_id,req.user.id))return bad(res,403,'Members only');if(!body)return bad(res,400,'body required');
 res.status(201).json({id:db.prepare('INSERT INTO comments(thread_id,parent_id,author_id,body) VALUES(?,?,?,?)').run(thread_id,parent_id,req.user.id,body).lastInsertRowid})});
// ---- Reviews & recommendations ----
app.post('/api/reviews',auth(),(req,res)=>{const{book_id,rating,text=''}=req.body;if(!(rating>=1&&rating<=5))return bad(res,400,'rating must be 1-5');
 db.prepare('INSERT INTO reviews(book_id,user_id,rating,text) VALUES(?,?,?,?) ON CONFLICT(book_id,user_id) DO UPDATE SET rating=excluded.rating,text=excluded.text').run(book_id,req.user.id,rating,text);res.status(201).json({ok:true})});
app.get('/api/recommendations',auth(),(req,res)=>{const g=JSON.parse(db.prepare('SELECT genres FROM users WHERE id=?').get(req.user.id).genres||'[]');
 res.json(db.prepare(`SELECT b.*,IFNULL(AVG(r.rating),0) avg_rating FROM books b LEFT JOIN reviews r ON r.book_id=b.id WHERE b.id NOT IN(SELECT book_id FROM reviews WHERE user_id=?) GROUP BY b.id ORDER BY(b.genre IN(${g.map(()=>'?').join(',')||"''"})) DESC,avg_rating DESC LIMIT 5`).all(req.user.id,...g))});
// ---- Moderation ----
app.post('/api/reports',auth(),(req,res)=>{const{thread_id=null,comment_id=null,reason='inappropriate'}=req.body;
 res.status(201).json({id:db.prepare('INSERT INTO reports(thread_id,comment_id,reporter_id,reason) VALUES(?,?,?,?)').run(thread_id,comment_id,req.user.id,reason).lastInsertRowid})});
app.delete('/api/content/:type/:id',auth(['admin']),(req,res)=>{const t={thread:'threads',comment:'comments'}[req.params.type];if(!t)return bad(res,400,'type must be thread|comment');
 db.prepare(`UPDATE ${t} SET removed=1 WHERE id=?`).run(req.params.id);res.status(204).end()});
app.patch('/api/users/:id/block',auth(['admin']),(req,res)=>{db.prepare('UPDATE users SET blocked=? WHERE id=?').run(req.body.blocked?1:0,req.params.id);res.json({ok:true})});
app.listen(process.env.PORT||4000,()=>console.log('BookBridge API on http://localhost:4000'));
