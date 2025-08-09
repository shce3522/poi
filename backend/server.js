const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// 如果后面有 Nginx / Cloudflare 等反向代理，把下行打开，Express 会信任 X-Forwarded-* 头
app.set('trust proxy', true);

// 获取客户端真实 IP，优先级：X-Real-IP > CF-Connecting-IP > X-Forwarded-For 首个 > remoteAddress
function getClientIp(req) {
  return (
    req.headers['x-real-ip'] ||
    req.headers['cf-connecting-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    ''
  );
}

// 初始化数据库
const db = new sqlite3.Database(path.join(__dirname, 'scores.db'));
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    score INTEGER,
    ip TEXT,
    region TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// 静态资源：前端游戏
app.use(express.static(path.join(__dirname, '../frontend')));

// 根据 IP 获取省/市信息
async function getRegion(ip) {
  try {
    const res = await axios.get(`http://ip-api.com/json/${ip}?fields=regionName,city`);
    const { regionName, city } = res.data;
    return `${regionName || ''}${city ? ' ' + city : ''}`.trim();
  } catch (e) {
    return '未知';
  }
}

// 提交分数
app.post('/score', async (req, res) => {
  const { name, score } = req.body;
  if (!name || typeof score !== 'number') {
    return res.status(400).json({ error: '参数错误' });
  }
  const ip = getClientIp(req);
  const region = await getRegion(ip);
  db.run(`INSERT INTO scores (name, score, ip, region) VALUES (?,?,?,?)`, [name, score, ip, region], function (err) {
     if (err) return res.status(500).json({ error: '数据库错误' });
     res.json({ success: true });
   });
});

// 获取排行榜
app.get('/scores', (req, res) => {
  db.all(`SELECT name, region, score FROM scores ORDER BY score DESC LIMIT 50`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    res.json(rows);
  });
});

// 简易后台面板
app.get('/admin', (req, res) => {
  db.all(`SELECT * FROM scores ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).send('数据库错误');
    const rowsHtml = rows
      .map(r => `<tr><td>${r.id}</td><td>${r.name}</td><td>${r.score}</td><td>${r.ip}</td><td>${r.region}</td><td>${r.created_at}</td></tr>`) 
      .join('');
    res.send(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>后台面板</title><style>table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px}</style></head><body><h2>玩家记录</h2><table><tr><th>ID</th><th>姓名</th><th>分数</th><th>IP</th><th>地区</th><th>时间</th></tr>${rowsHtml}</table></body></html>`);
  });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));