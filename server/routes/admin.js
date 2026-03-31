const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// 🛡️ Middleware: Sadece Adminler Girebilir
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Yetkisiz erişim!' });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Geçersiz token!' });
    
    // Veritabanından admin olup olmadığını doğrula
    const user = await User.findByPk(decoded.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz yok!' });
    }
    
    req.user = user;
    next();
  });
};

// 📋 Onay Bekleyen Yayıncıları Listele
router.get('/pending-broadcasters', authenticateAdmin, async (req, res) => {
  try {
    const list = await User.findAll({
      where: { role: 'broadcaster', isApproved: false },
      attributes: ['id', 'username', 'email', 'avatar', 'createdAt']
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Yayıncıyı Onayla
router.post('/approve-broadcaster/:id', authenticateAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });

    user.isApproved = true;
    await user.save();

    res.json({ success: true, message: `${user.username} onaylandı!` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ❌ Yayıncıyı Reddet veya Sil
router.delete('/reject-broadcaster/:id', authenticateAdmin, async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
  
      user.role = 'user'; // Tekrar izleyiciye çevir veya komple sil
      await user.save();
  
      res.json({ success: true, message: 'Yayıncı başvurusu reddedildi.' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

// 📊 Tüm Kullanıcıları ve Yayıncıları Getir (Stats ile birlikte)
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'role', 'avatar', 'credits', 'totalEarned', 'isBanned', 'iban', 'isApproved', 'gender', 'level', 'vipStatus', 'perMinuteRate', 'messageRate', 'commissionRate', 'createdAt']
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🚫 Kullanıcıyı Engelle / Engeli Kaldır
router.post('/ban/:id', authenticateAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Admin engellenemez!' });

    user.isBanned = !user.isBanned;
    await user.save();

    res.json({ success: true, message: `Kullanıcı ${user.isBanned ? 'engellendi' : 'engeli kaldırıldı'}.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 💸 Yayıncıya Ödeme Yap (💎 → ₺ kur üzerinden) — varsa pending talebi tamamlar
router.post('/pay/:id', authenticateAdmin, async (req, res) => {
  try {
    const { DIAMOND_TO_TL_RATE } = require('../config/system');
    const Transaction = require('../models/Transaction');
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'Yayıncı bulunamadı.' });
    if (!user.iban) return res.status(400).json({ message: 'Yayıncının IBAN bilgisi yok!' });
    if (Number(user.credits) <= 0) return res.status(400).json({ message: 'Ödenecek bakiye yok!' });

    const diamonds = Number(user.credits);
    const payTL = parseFloat((diamonds * DIAMOND_TO_TL_RATE).toFixed(2));

    // Varsa bekleyen withdrawal_request'i tamamla
    await Transaction.update(
      { status: 'completed', description: `Ödeme tamamlandı: ${diamonds} 💎 → ₺${payTL} (IBAN: ${user.iban})` },
      { where: { userId: user.id, type: 'withdrawal_request', status: 'pending' } }
    );

    // withdrawal kaydı oluştur
    await Transaction.create({
      userId: user.id,
      type: 'withdrawal',
      amount: diamonds,
      priceInTL: payTL,
      status: 'completed',
      paymentMethod: 'bank_transfer',
      description: `IBAN ödemesi: ${diamonds} 💎 → ₺${payTL}`
    });

    // Bakiyeyi sıfırla
    user.totalEarned = parseFloat((Number(user.totalEarned) + payTL).toFixed(2));
    user.credits = 0;
    await user.save();

    res.json({ success: true, message: `${user.username} adlı yayıncıya ${diamonds} 💎 karşılığı ₺${payTL} ödeme yapıldı ve bakiye sıfırlandı!` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📋 Bekleyen Ödeme Taleplerini Listele
router.get('/pending-payouts', authenticateAdmin, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const requests = await Transaction.findAll({
      where: { type: 'withdrawal_request', status: 'pending' },
      order: [['createdAt', 'ASC']],
    });
    // Her talebe kullanıcı bilgisi ekle
    const result = await Promise.all(requests.map(async (tx) => {
      const u = await User.findByPk(tx.userId, { attributes: ['id', 'username', 'avatar', 'iban'] });
      return { ...tx.toJSON(), user: u?.toJSON() };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ❌ Ödeme Talebini Reddet
router.post('/reject-payout/:txId', authenticateAdmin, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const tx = await Transaction.findByPk(req.params.txId);
    if (!tx || tx.type !== 'withdrawal_request' || tx.status !== 'pending') {
      return res.status(404).json({ message: 'Bekleyen ödeme talebi bulunamadı.' });
    }
    tx.status = 'failed';
    tx.description = tx.description + ' [Admin tarafından reddedildi]';
    await tx.save();
    res.json({ success: true, message: 'Ödeme talebi reddedildi. Yayıncının bakiyesi korundu.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🎚️ Yayıncıya Özel Komisyon Oranı Ayarla
router.put('/broadcaster-commission/:id', authenticateAdmin, async (req, res) => {
  try {
    const { commissionRate } = req.body;
    const rate = parseInt(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ message: 'Komisyon oranı 0-100 arasında tam sayı olmalı!' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user || user.role !== 'broadcaster') return res.status(404).json({ message: 'Yayıncı bulunamadı.' });
    user.commissionRate = rate;
    await user.save();
    res.json({ success: true, message: `${user.username} komisyon oranı %${rate} olarak güncellendi.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📈 Finansal Raporlar ve İstatistikler
router.get('/stats/finance', authenticateAdmin, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const Stream = require('../models/Stream');
    const { DIAMOND_TO_TL_RATE } = require('../config/system');

    // Toplam satın alınan kredi TL cirosu
    const totalRevenueTL = await Transaction.sum('priceInTL', { where: { type: 'purchase', status: 'completed' } }) || 0;
    // Sistdeki toplam elmas
    const users = await User.findAll({ attributes: ['credits', 'totalEarned', 'role'] });
    const totalCreditsInSystem = users.reduce((acc, u) => acc + Number(u.credits || 0), 0);
    // Toplam ödenen TL
    const totalPaidOutTL = await Transaction.sum('priceInTL', { where: { type: 'withdrawal', status: 'completed' } }) || 0;
    // Aktif yayın sayısı
    const activeStreams = await Stream.count({ where: { isLive: true } });
    // Bekleyen yayıncı ödemeleri
    const broadcasters = users.filter(u => u.role === 'broadcaster');
    const pendingPayoutTL = broadcasters.reduce((acc, u) => acc + Number(u.credits || 0) * DIAMOND_TO_TL_RATE, 0);

    res.json({
      totalRevenue: parseFloat(totalRevenueTL).toFixed(2),
      totalCreditsInSystem,
      activeStreams,
      totalPaidOutTL: parseFloat(totalPaidOutTL).toFixed(2),
      pendingPayoutTL: parseFloat(pendingPayoutTL).toFixed(2),
      diamondToTLRate: DIAMOND_TO_TL_RATE,
      dailySales: [1200, 1900, 1500, 2100, 2400, 1800, 2900] // Gerçek veri için Transaction.findAll ile günlük gruplama gerekir
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📦 Paket Ayarlarını Getir
const { getPackages, updatePackage } = require('../config/packages');
router.get('/packages', authenticateAdmin, (req, res) => {
  res.json(getPackages());
});

// 🔧 Paket Güncelle (Gerçek güncelleme)
router.put('/packages/:id', authenticateAdmin, (req, res) => {
  const { amount, priceInTL, label } = req.body;
  const pkg = updatePackage(req.params.id, { amount, priceInTL, label });
  if (!pkg) return res.status(404).json({ message: 'Paket bulunamadı.' });
  res.json({ success: true, message: 'Paket güncellendi.', package: pkg });
});

module.exports = router;
