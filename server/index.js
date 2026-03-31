const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const sequelize = require('./config/db');
const { Op } = require('sequelize');
const User = require('./models/User');
const Stream = require('./models/Stream');
const Message = require('./models/Message');
const Follow = require('./models/Follow');
const DirectMessage = require('./models/DirectMessage');
const Call = require('./models/Call');

const app = express();

// 🛡️ Güvenlik Katmanı
app.use(helmet());

// 🚫 Hız Sınırlayıcı (15 dakikada en fazla 100 istek)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Çok fazla istek attınız, lütfen bir süre bekleyin.'
});
app.use('/api/', limiter);

const allowedOrigins = [
  'http://localhost',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Aynı origin veya izin verilenler listesi
    if (!origin || allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: izin verilmeyen origin'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});

app.use(cors(corsOptions));
app.use(express.json());

// 🔌 Rotalar
const authRoutes = require('./routes/auth');
const streamRoutes = require('./routes/stream');
const userRoutes = require('./routes/user'); // Yeni kullanıcı rotası

const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payment');
const Transaction = require('./models/Transaction');

app.use('/api/auth', authRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);

// Socket config'e io referansını kaydet (route'lardan kullanım için)
require('./config/socket').setIO(io);

// 🧪 Test rotası
app.get('/', (req, res) => {
  res.json({ message: 'vChat API Hazır 🚀' });
});

// 🔄 Model İlişkileri
User.hasMany(Stream, { foreignKey: 'userId' });
Stream.belongsTo(User, { foreignKey: 'userId' });
Stream.hasMany(Message, { foreignKey: 'streamId' });
Message.belongsTo(Stream, { foreignKey: 'streamId' });

User.hasMany(Follow, { foreignKey: 'followerId', as: 'following' });
User.hasMany(Follow, { foreignKey: 'followingId', as: 'followers' });

// DM info
User.hasMany(DirectMessage, { foreignKey: 'senderId', as: 'sentMessages' });
User.hasMany(DirectMessage, { foreignKey: 'receiverId', as: 'receivedMessages' });

// Call Info
User.hasMany(Call, { foreignKey: 'callerId', as: 'madeCalls' });
User.hasMany(Call, { foreignKey: 'receiverId', as: 'receivedCalls' });

// Aktif çağrıları (dakika bazlı kesinti için) takip edecek obje
const activeCalls = {};

// 🔗 Socket.io bağlantısı — JWT ile kimlik doğrulama
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    // Misafirler sadece yayın izleyebilir; hassas olaylara erişemez
    socket.isGuest = true;
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.isGuest = false;
    next();
  } catch {
    socket.isGuest = true;
    next(); // token geçersiz olsa da bağlantıyı kes değil, guest yap
  }
});

io.on('connection', (socket) => {
  if (!socket.isGuest) {
    console.log('✅ Kimliği doğrulanmış kullanıcı bağlandı:', socket.id);
  }
  // Bağlantı sayısını tüm istemcilere bildir
  io.emit('online_count', { count: io.sockets.sockets.size });

  // Kullanıcı sisteme kendi user ID'si ile login olduğunu bildirir
  socket.on('register_user', async (userId) => {
      if (socket.isGuest) return; // misafir kayıt olamaz
      // JWT'deki ID ile eşleşmiyorsa spoofing girişimi, yoksay
      if (socket.userId && socket.userId !== userId) return;
      socket.userId = userId;
      socket.join(`user_${userId}`);
      console.log(`👤 Socket kaydedildi: user_${userId}`);
      try {
        await User.update({ isOnline: true }, { where: { id: userId } });
      } catch(e) { console.error('Online güncelleme hatası:', e); }
  });

  // 📞 Birebir Özel Görüşme: İstek Gönderme
  socket.on('invite_call', async (data) => {
    if (socket.isGuest) return;
    const { callerId, callerName, receiverId } = data;
    io.to(`user_${receiverId}`).emit('incoming_call', { callerId, callerName, channelName: `call_${callerId}_${receiverId}` });
  });

  // 🟢 Çağrı Kabul Edildi
  socket.on('accept_call', async (data) => {
    const { callerId, receiverId, channelName } = data;
    io.to(`user_${callerId}`).emit('call_accepted', { channelName });

    // Call kaydı oluştur
    let callRecord = null;
    try {
      callRecord = await Call.create({ callerId, receiverId, status: 'ongoing', durationMinutes: 0, totalPricePaid: 0 });
    } catch(e) { console.error('Call kaydı hatası:', e); }

    activeCalls[channelName] = {
      callId: callRecord?.id,
      startTime: Date.now(),
      totalPaid: 0,
      callerId,
      receiverId,
      interval: null
    };

    // Dakika başına bakiye düşüm motoru
    activeCalls[channelName].interval = setInterval(async () => {
        try {
            const caller = await User.findByPk(callerId);
            const receiver = await User.findByPk(receiverId);

            if (!caller || !receiver || caller.credits < receiver.perMinuteRate) {
                io.to(channelName).emit('call_ended_no_credits', { message: 'Bakiye yetersiz, arama sonlandırıldı.' });
                clearInterval(activeCalls[channelName]?.interval);
                delete activeCalls[channelName];
                return;
            }

            const amount = receiver.perMinuteRate || 50;
            const commissionRate = typeof receiver.commissionRate === 'number' ? receiver.commissionRate : 80;
            caller.credits = BigInt(caller.credits) - BigInt(amount);
            receiver.credits = BigInt(receiver.credits) + BigInt(Math.floor(amount * commissionRate / 100));
            if (activeCalls[channelName]) activeCalls[channelName].totalPaid += amount;

            await caller.save();
            await receiver.save();

            io.to(`user_${callerId}`).emit('update_credits', { credits: Number(caller.credits) });
        } catch (e) {
            console.error('Özel arama dakika kesintisi hatası', e);
        }
    }, 60000);
  });

  // 🔴 Çağrı Reddedildi
  socket.on('reject_call', async (data) => {
    const { callerId, receiverId } = data;
    io.to(`user_${callerId}`).emit('call_rejected', { message: 'Karşı taraf meşgul veya çağrıyı reddetti.' });
    if (callerId && receiverId) {
      Call.create({ callerId, receiverId, status: 'rejected', durationMinutes: 0, totalPricePaid: 0 }).catch(() => {});
    }
  });

  // ⛔ Çağrı Bitti
  socket.on('end_call', async (data) => {
    const { channelName } = data;
    const callMeta = activeCalls[channelName];
    if (callMeta) {
      clearInterval(callMeta.interval);
      const durationMinutes = Math.ceil((Date.now() - callMeta.startTime) / 60000);
      if (callMeta.callId) {
        Call.update(
          { status: 'completed', durationMinutes, totalPricePaid: callMeta.totalPaid },
          { where: { id: callMeta.callId } }
        ).catch(() => {});
        if (callMeta.totalPaid > 0) {
          Transaction.create({ userId: callMeta.callerId, type: 'call_payment', amount: callMeta.totalPaid, status: 'completed', paymentMethod: 'credits', description: `Özel görüşme — ${durationMinutes} dakika` }).catch(() => {});
        }
      }
      delete activeCalls[channelName];
    }
    io.to(channelName).emit('call_ended', { message: 'Görüşme sonlandırıldı.' });
  });

  // ❌ Arayan Çağrıyı İptal Etti
  socket.on('cancel_call', (data) => {
    const { callerId, receiverId } = data;
    if (!callerId || !receiverId) return;
    io.to(`user_${receiverId}`).emit('call_cancelled', { message: 'Arayan taraf vazgeçti.' });
  });

  // 🚪 Odaya Katıl (Yayın ID bazlı)
  socket.on('join_stream', async (streamId) => {
    socket.join(streamId);
    socket.currentStreamId = streamId;
    socket.to(streamId).emit('user_joined', { message: 'Bir izleyici aramıza katıldı! 👋' });
    try {
      await Stream.increment('viewerCount', { where: { id: streamId, isLive: true } });
      const s = await Stream.findByPk(streamId, { attributes: ['viewerCount'] });
      if (s) io.to(streamId).emit('viewer_count', { count: Number(s.viewerCount) });
    } catch(e) { console.error('viewerCount artış hatası:', e); }
  });

  // 🚪 Odadan Ayrıl
  socket.on('leave_stream', async (streamId) => {
    socket.leave(streamId);
    socket.currentStreamId = null;
    try {
      await Stream.decrement('viewerCount', { where: { id: streamId, isLive: true, viewerCount: { [Op.gt]: 0 } } });
      const s = await Stream.findByPk(streamId, { attributes: ['viewerCount'] });
      if (s) io.to(streamId).emit('viewer_count', { count: Math.max(0, Number(s.viewerCount)) });
    } catch(e) { console.error('viewerCount azalma hatası:', e); }
  });

  // 📧 Mesaj Gönder
  socket.on('send_message', async (data) => {
    const { streamId, sender, content, type, giftValue, senderId, receiverId } = data;

    io.to(streamId).emit('receive_message', {
      sender, content, type, giftValue,
      timestamp: new Date()
    });

    // 🎁 Hediye ise: animasyon + chat kaydı + Transaction
    if (type === 'gift') {
      io.to(streamId).emit('gift_event', {
        sender,
        message: `${sender} bir hediye gönderdi! 🔥`,
        giftValue,
        giftIcon: data.giftIcon || '💎'
      });
      // Transaction kaydet
      if (senderId) Transaction.create({ userId: senderId, type: 'gift_sent', amount: giftValue || 0, status: 'completed', paymentMethod: 'credits', description: `${data.giftIcon || '💎'} hediye gönderildi` }).catch(() => {});
      if (receiverId) Transaction.create({ userId: receiverId, type: 'gift_received', amount: Math.floor((giftValue || 0) * 0.8), status: 'completed', paymentMethod: 'credits', description: `${data.giftIcon || '💎'} hediye alındı` }).catch(() => {});
    }

    // 💾 Chat mesajını DB'ye kaydet
    if (streamId) {
      Message.create({
        fromUserId: senderId || null,
        streamId,
        content,
        type: type || 'text',
        giftValue: giftValue || 0
      }).catch(() => {});
    }
  });

  // ⚔️ Moderasyon: Kullanıcıyı At (Kick)
  socket.on('kick_user', (data) => {
    const { streamId, targetId, reason } = data;
    // Hedef kullanıcıya "atıldın" bilgisi gönder
    io.to(targetId).emit('you_are_kicked', { reason });
    console.log(`⚔️ Kullanıcı odadan atıldı: ${targetId}`);
  });

  socket.on('disconnect', async () => {
    // Bağlantı sayısı güncelle
    io.emit('online_count', { count: io.sockets.sockets.size });
    // Yayın odasından ayrıl, viewerCount azalt
    if (socket.currentStreamId) {
      Stream.decrement('viewerCount', { where: { id: socket.currentStreamId, isLive: true, viewerCount: { [Op.gt]: 0 } } })
        .then(() => Stream.findByPk(socket.currentStreamId, { attributes: ['viewerCount'] }))
        .then(s => { if (s) io.to(socket.currentStreamId).emit('viewer_count', { count: Math.max(0, Number(s.viewerCount)) }); })
        .catch(() => {});
    }
    console.log('❌ Kullanıcı ayrıldı:', socket.id);
    if (socket.userId) {
      try {
        await User.update({ isOnline: false }, { where: { id: socket.userId } });
      } catch(e) { console.error('Offline güncelleme hatası:', e); }
    }
  });
});

const PORT = process.env.PORT || 5001; // Port 5001 olarak güncellendi

// Sağlık kontrolü için HTTP sunucusunu hemen başlat.
server.listen(PORT, () => {
  console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
});

// Veritabanını arka planda başlat; hata olsa da süreç ayakta kalsın.
(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: false });
    console.log('✅ Veritabanı bağlantısı ve senkronizasyon tamam.');
  } catch (err) {
    console.error('❌ Veritabanı başlatma hatası:', err?.message || err);
  }
})();
