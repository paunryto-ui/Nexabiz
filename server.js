// ════════════════════════════════════════════════════════
//  CMS Messenger — Socket.IO Server
//
//  Install:  npm install express socket.io
//  Run:      node server.js
//  Buka:     http://localhost:3000
//
//  Upload ke Railway/Render:
//  - Taruh server.js + whatsapp.html dalam 1 folder
//  - Set start command: node server.js
// ════════════════════════════════════════════════════════

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 50e6   // 50MB — untuk kirim gambar & audio
});

// Serve whatsapp.html
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'whatsapp.html'));
});

// Map nomor → socket.id
const online = {};

io.on('connection', socket => {

  // Client daftar setelah login
  socket.on('register', ({ number }) => {
    if (!number) return;
    socket.number = number;
    online[number] = socket.id;
    console.log(`[+] ${number} online (${Object.keys(online).length} users)`);
  });

  // Kirim ke nomor tertentu
  function toUser(number, event, data) {
    const sid = online[number];
    if (sid) io.to(sid).emit(event, { ...data, type: event });
  }

  // Broadcast ke semua (presence & heartbeat)
  ['presence', 'hb'].forEach(ev => {
    socket.on(ev, data => {
      socket.broadcast.emit(ev, { ...data, type: ev });
    });
  });

  // Offline → broadcast
  socket.on('offline', data => {
    socket.broadcast.emit('offline', { ...data, type: 'offline' });
  });

  // Event yang diarahkan ke user tertentu (punya field "to")
  [
    'contact_req',
    'msg',
    'dlv',
    'read',
    'typing',
    'stat_upd',
    'call_inv',
    'call_acc',
    'call_dec',
    'call_end',
    'rtc_offer',
    'rtc_answer',
    'rtc_ice',
  ].forEach(ev => {
    socket.on(ev, data => {
      if (data.to) toUser(data.to, ev, data);
    });
  });

  // Cleanup saat disconnect
  socket.on('disconnect', () => {
    if (socket.number) {
      delete online[socket.number];
      console.log(`[-] ${socket.number} offline (${Object.keys(online).length} users)`);
      socket.broadcast.emit('offline', { type: 'offline', from: socket.number });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅  CMS Messenger ready`);
  console.log(`   Local  → http://localhost:${PORT}`);
  console.log(`   Deploy ke Railway/Render, set PORT env otomatis\n`);
});
