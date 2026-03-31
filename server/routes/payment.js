const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { getPackages } = require('../config/packages');
const jwt = require('jsonwebtoken');

// 🛡️ Auth middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Yetkisiz erişim!' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Geçersiz token!' });
    req.user = decoded;
    next();
  });
};

// 📋 Paketleri listele (herkese açık)
router.get('/packages', (req, res) => {
  res.json(getPackages());
});

// 🛒 Paket satın al (mock — gerçek ödeme yok)
router.post('/purchase', authenticateToken, async (req, res) => {
  const { packageId } = req.body;

  const pkg = getPackages().find(p => p.id === Number(packageId));
  if (!pkg) return res.status(400).json({ message: 'Geçersiz paket!' });

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    if (user.isBanned) return res.status(403).json({ message: 'Hesabınız askıya alınmıştır.' });

    // Mock ödeme: gerçek sistemde burada iyzico/paytr çağrısı yapılır
    user.credits = BigInt(user.credits) + BigInt(pkg.amount);
    await user.save();

    await Transaction.create({
      userId: user.id,
      type: 'purchase',
      amount: pkg.amount,
      priceInTL: pkg.priceInTL,
      packageId: pkg.id,
      status: 'completed',
      paymentMethod: 'mock',
      description: `${pkg.label} paketi — ${pkg.amount} Elmas`,
    });

    res.json({
      success: true,
      message: `${pkg.amount} Elmas hesabınıza eklendi! 🎉`,
      newCredits: Number(user.credits),
    });
  } catch (err) {
    console.error('Satın alma hatası:', err);
    res.status(500).json({ message: 'Satın alma sırasında hata oluştu.' });
  }
});

// 📜 İşlem geçmişi
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 💸 Yayıncı Ödeme Talebi Oluştur
router.post('/request-payout', authenticateToken, async (req, res) => {
  try {
    const { DIAMOND_TO_TL_RATE } = require('../config/system');
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    if (user.role !== 'broadcaster') return res.status(403).json({ message: 'Sadece yayıncılar ödeme talep edebilir.' });
    if (!user.iban) return res.status(400).json({ message: 'Ödeme alabilmek için önce IBAN bilginizi ekleyin.' });
    if (Number(user.credits) <= 0) return res.status(400).json({ message: 'Çekilecek bakiye yok.' });

    // Zaten bekleyen talep var mı?
    const existingRequest = await Transaction.findOne({
      where: { userId: user.id, type: 'withdrawal_request', status: 'pending' }
    });
    if (existingRequest) {
      return res.status(400).json({ message: 'Zaten bekleyen bir ödeme talebiniz var. Admin onayını bekleyin.' });
    }

    const diamonds = Number(user.credits);
    const amountTL = parseFloat((diamonds * DIAMOND_TO_TL_RATE).toFixed(2));

    const tx = await Transaction.create({
      userId: user.id,
      type: 'withdrawal_request',
      amount: diamonds,
      priceInTL: amountTL,
      status: 'pending',
      paymentMethod: 'bank_transfer',
      description: `Ödeme talebi: ${diamonds} 💎 → ₺${amountTL} (IBAN: ${user.iban})`,
    });

    res.json({ success: true, message: `₺${amountTL} tutarında ödeme talebiniz alındı. Admin onayı bekleniyor.`, transaction: tx });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📋 Yayıncının Kendi Ödeme Taleplerini Gör
router.get('/my-payouts', authenticateToken, async (req, res) => {
  try {
    const payouts = await Transaction.findAll({
      where: { userId: req.user.id, type: ['withdrawal_request', 'withdrawal'] },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
