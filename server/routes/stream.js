const express = require('express');
const router = express.Router();
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const Stream = require('../models/Stream');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// 🛡️ Auth Middleware
const authenticateToken = (req, res, next) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Yetkisiz erişim!' });
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Geçersiz token!' });
    const user = await User.findByPk(decoded.id);
    if (!user || user.isBanned) return res.status(403).json({ message: 'Erişim reddedildi!' });
    req.user = user;
    next();
  });
};

// 🎟️ Token Üretici (Sadece Yayıncılar ve İzleyiciler İçin)
router.post('/get-token', authenticateToken, async (req, res) => {
  const { channelName, role, expireTime } = req.body; // role: 'publisher' veya 'subscriber'
  
  const appId = process.env.AGORA_APP_ID || 'demo_app_id';
  const appCertificate = process.env.AGORA_APP_CERTIFICATE || 'demo_app_cert';
  const uid = 0; // 0 verilirse Agora UID'yi otomatik atar.
  const expirationTimeInSeconds = expireTime || 3600; // Varsayılan 1 saat, istenirse uzatılabilir
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      agoraRole,
      privilegeExpiredTs
    );

    res.json({ token, uid, appId });
  } catch (err) {
    res.status(500).json({ message: 'Token üretilirken bir hata oluştu.' });
  }
});

// 📺 Yayını Başlat (Veritabanına Kaydet)
router.post('/start-stream', authenticateToken, async (req, res) => {
  try {
    const { channelName, title } = req.body;
    const userId = req.user.id; // token'dan al, body'den değil

    if (req.user.role !== 'broadcaster' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Sadece yayıncılar yayın başlatabilir!' });
    }
    if (req.user.role === 'broadcaster' && !req.user.isApproved) {
      return res.status(403).json({ message: 'Hesabınız henüz onaylanmamış!' });
    }

    const stream = await Stream.create({
      userId,
      channelName,
      title,
      isLive: true
    });

    await User.update({ isLive: true }, { where: { id: userId } });
    res.status(201).json(stream);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ⏹️ Yayını Durdur
router.post('/stop-stream', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await User.update({ isLive: false }, { where: { id: userId } });
    await Stream.update(
      { isLive: false, endTime: new Date() },
      { where: { userId, isLive: true } }
    );
    res.json({ success: true, message: 'Yayın sonlandırıldı.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📊 Yayıncı Kendi İstatistiklerini Getir
router.get('/my-stats', authenticateToken, async (req, res) => {
  try {
    const Follow = require('../models/Follow');
    const Transaction = require('../models/Transaction');
    const { Op } = require('sequelize');
    const { DIAMOND_TO_TL_RATE } = require('../config/system');
    const userId = req.user.id;

    // Takipçi sayısı
    const followerCount = await Follow.count({ where: { followingId: userId } });

    // Toplam yayın süresi (dakika olarak)
    const streams = await Stream.findAll({
      where: { userId, isLive: false, endTime: { [Op.ne]: null } },
      attributes: ['startTime', 'endTime']
    });
    const totalStreamMinutes = streams.reduce((acc, s) => {
      if (s.startTime && s.endTime) {
        return acc + Math.max(0, Math.floor((new Date(s.endTime) - new Date(s.startTime)) / 60000));
      }
      return acc;
    }, 0);

    // Bu ayın 💎 kazanımları (hediyeler)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthlyGifts = await Transaction.sum('amount', {
      where: { userId, type: 'gift_received', createdAt: { [Op.gte]: monthStart } }
    }) || 0;

    const currentCredits = Number(req.user.credits);
    const pendingTL = (currentCredits * DIAMOND_TO_TL_RATE).toFixed(2);
    const totalEarnedTL = Number(req.user.totalEarned);

    res.json({
      followerCount,
      totalStreamMinutes,
      monthlyGiftDiamonds: monthlyGifts,
      currentCredits,
      pendingTL,
      totalEarnedTL,
      commissionRate: req.user.commissionRate || 80,
      diamondToTLRate: DIAMOND_TO_TL_RATE,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📋 Tüm Yayıncıları Listele (CANLI ve Online Durumları Dahil)
router.get('/streamers', async (req, res) => {
  try {
    const Follow = require('../models/Follow');
    const streamers = await User.findAll({
      where: {
        role: 'broadcaster',
        isApproved: true,
        isBanned: false
      },
      attributes: ['id', 'username', 'avatar', 'isLive', 'isOnline', 'credits', 'gender', 'level', 'vipStatus', 'perMinuteRate', 'messageRate']
    });
    
    // Her yayıncı için takipçi sayısını ekle
    const streamersWithFollowers = await Promise.all(
      streamers.map(async (s) => {
        const followerCount = await Follow.count({ where: { followingId: s.id } });
        return { ...s.toJSON(), followerCount };
      })
    );
    
    res.json(streamersWithFollowers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
