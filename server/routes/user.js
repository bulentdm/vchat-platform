const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Transaction = require('../models/Transaction');

// 🛡️ Middleware: Token Doğrulama
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Yetkisiz erişim!' });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Geçersiz token!' });
    
    // Veritabanından kullanıcıyı kontrol et
    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı!' });
    if (user.isBanned) return res.status(403).json({ message: 'Hesabınız engellendi!' });
    
    req.user = user;
    next();
  });
};

// 💎 Kullanıcı Bilgilerini Getir (Kredi Dahil)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'username', 'email', 'avatar', 'credits', 'role', 'iban', 'isApproved', 'totalEarned', 'gender', 'level', 'vipStatus', 'perMinuteRate', 'messageRate', 'bio', 'age', 'phone', 'isEmailVerified']
    });
    if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🎁 Hediye Gönderimi (Kredi Düşümü)
router.post('/send-gift', authenticateToken, async (req, res) => {
  try {
    const { amount, receiverId } = req.body;
    const sender = await User.findByPk(req.user.id);
    
    if (!sender || sender.credits < amount) {
      return res.status(400).json({ message: 'Yetersiz bakiye!' });
    }

    // Gönderenin kredisini düşür
    sender.credits -= amount;
    
    // 🏆 Level hesaplama: Her 500 elmas harcamada 1 level
    const totalSpent = 1000 - sender.credits + amount; // Rough approximation
    const newLevel = Math.max(1, Math.floor(amount / 500) + (sender.level || 1));
    if (newLevel > (sender.level || 1)) {
      sender.level = Math.min(newLevel, 99);
    }
    
    await sender.save();

    // Alıcının (Yayıncı) kredisini artır (komisyon oranından hesaplanır)
    if (receiverId) {
      const receiver = await User.findByPk(receiverId);
      if (receiver) {
        const commissionRate = (receiver.commissionRate || 80) / 100;
        receiver.credits = Number(receiver.credits) + Math.floor(amount * commissionRate);
        
        // 🌟 VIP Otomatik: 10000+ kredi kazanan yayıncı VIP olur
        if (receiver.credits >= 10000 && !receiver.vipStatus) {
          receiver.vipStatus = true;
        }
        // Level artışı yayıncı için de (kazandıkça)
        const broadcasterLevel = Math.max(1, Math.floor(receiver.credits / 1000));
        if (broadcasterLevel > (receiver.level || 1)) {
          receiver.level = Math.min(broadcasterLevel, 99);
        }
        
        await receiver.save();
      }
    }

    res.json({ success: true, remainingCredits: sender.credits });

    // 📊 Transaction kaydet (hediye gönderen + alan)
    Transaction.create({ userId: sender.id, type: 'gift_sent', amount, status: 'completed', paymentMethod: 'credits', description: 'Hediye gönderildi' }).catch(() => {});
    if (receiverId) {
      Transaction.create({ userId: receiverId, type: 'gift_received', amount: Math.floor(amount * 0.8), status: 'completed', paymentMethod: 'credits', description: 'Hediye alındı' }).catch(() => {});
    }
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/add-credits', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findByPk(req.user.id);
    
    user.credits = Number(user.credits) + Number(amount);
    await user.save();

    res.json({ success: true, newCredits: user.credits });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📝 Profil Güncelleme (IBAN vb.)
router.put('/update-profile', authenticateToken, async (req, res) => {
  try {
    const { iban, avatar, perMinuteRate, messageRate, gender, bio, age, phone } = req.body;
    const user = await User.findByPk(req.user.id);
    
    if (iban !== undefined) user.iban = iban;
    if (avatar !== undefined) user.avatar = avatar;
    if (perMinuteRate !== undefined) user.perMinuteRate = perMinuteRate;
    if (messageRate !== undefined) user.messageRate = messageRate;
    if (gender !== undefined) user.gender = gender;
    if (bio !== undefined) user.bio = bio;
    if (age !== undefined) user.age = age;
    if (phone !== undefined) user.phone = phone;
    
    await user.save();

    res.json({ success: true, message: 'Profil başarıyla güncellendi.', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ❤️ Takip Et / Takipten Çık
router.post('/follow', authenticateToken, async (req, res) => {
  try {
    const { followingId } = req.body;
    const followerId = req.user.id;
    
    const Follow = require('../models/Follow');
    const existing = await Follow.findOne({ where: { followerId, followingId } });
    
    if (existing) {
      await existing.destroy();
      return res.json({ success: true, message: 'Takipten çıkıldı.', following: false });
    } else {
      await Follow.create({ followerId, followingId });
      // 🔔 Yayıncıya socket bildirimi gönder
      const { getIO } = require('../config/socket');
      const io = getIO();
      if (io) {
        const follower = await User.findByPk(followerId, { attributes: ['username', 'avatar'] });
        io.to(`user_${followingId}`).emit('new_follower', { followerName: follower?.username, avatar: follower?.avatar });
      }
      return res.json({ success: true, message: 'Takip edildi!', following: true });
    }
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ✉️ Özel Mesaj Gönder (Kredi Düşümü)
router.post('/send-message', authenticateToken, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const sender = await User.findByPk(req.user.id);
    const receiver = await User.findByPk(receiverId);
    
    if (!receiver) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });

    const cost = receiver.messageRate || 10;
    
    if (sender.credits < cost) {
      return res.status(400).json({ message: 'Mesaj atmak için bakiyeniz yetersiz.' });
    }
    
    sender.credits -= cost;
    receiver.credits += Math.floor(cost * 0.8);
    await sender.save();
    await receiver.save();
    
    const DirectMessage = require('../models/DirectMessage');
    const message = await DirectMessage.create({
      senderId: sender.id,
      receiverId: receiver.id,
      content,
      isPaid: true,
      pricePaid: cost
    });
    
    res.json({ success: true, message, remainingCredits: sender.credits });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// 📬 Kendi Mesajlarımı Getir
router.get('/messages', authenticateToken, async (req, res) => {
  try {
    const DirectMessage = require('../models/DirectMessage');
    const { Op } = require('sequelize');
    
    // Hem gelen hem giden
    const messages = await DirectMessage.findAll({
      where: {
        [Op.or]: [
          { senderId: req.user.id },
          { receiverId: req.user.id }
        ]
      },
      order: [['createdAt', 'ASC']]
    });
    // Gelen mesajları okundu olarak işaretle
    await DirectMessage.update({ isRead: true }, { where: { receiverId: req.user.id, isRead: false } });
    res.json(messages);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// 🔔 Okunmamış Mesaj Sayısı
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const DirectMessage = require('../models/DirectMessage');
    const count = await DirectMessage.count({ where: { receiverId: req.user.id, isRead: false } });
    res.json({ count });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// 👤 Genel Profil Görüntüleme (herkese açık)
router.get('/profile/:id', async (req, res) => {
  try {
    const Follow = require('../models/Follow');
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'username', 'avatar', 'bio', 'gender', 'level', 'vipStatus', 'isLive', 'isOnline', 'role', 'perMinuteRate', 'messageRate', 'createdAt']
    });
    if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    const followerCount = await Follow.count({ where: { followingId: req.params.id } });
    res.json({ ...user.toJSON(), followerCount });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
