const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');
require('dotenv').config();

// 🔢 6 Haneli Doğrulama Kodu Üret
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 🔑 Kayıt Ol (Register) - Gelişmiş
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role, gender, age, phone, bio, avatar } = req.body;
    
    // Validasyonlar
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Kullanıcı adı, e-posta ve şifre zorunludur!' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır!' });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ message: 'Kullanıcı adı en az 3 karakter olmalıdır!' });
    }

    // Kullanıcı adı formatı kontrolü (sadece harf, sayı, _ ve -)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ message: 'Kullanıcı adı sadece harf, rakam, _ ve - içerebilir!' });
    }

    // E-posta veya kullanıcı adı var mı kontrol et
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) return res.status(400).json({ message: 'Bu e-posta adresi zaten kullanımda!' });

    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) return res.status(400).json({ message: 'Bu kullanıcı adı zaten alınmış!' });

    // Yaş kontrolü
    if (age && (age < 18 || age > 99)) {
      return res.status(400).json({ message: 'Yaşınız 18-99 arasında olmalıdır!' });
    }

    // Doğrulama kodu oluştur
    const verificationCode = generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 dakika geçerli

    const newUser = await User.create({ 
      username, 
      email, 
      password, 
      role: role || 'user',
      gender: gender || 'other',
      age: age || null,
      phone: phone || null,
      bio: bio || '',
      avatar: avatar || 'https://cdn.icon-icons.com/icons2/1378/PNG/512/avatardefault_92824.png',
      isApproved: role === 'admin' ? true : (role === 'broadcaster' ? false : true),
      isEmailVerified: false,
      verificationCode,
      verificationExpiry
    });
    
    // 📧 Doğrulama e-postası gönder
    await sendVerificationEmail(email, verificationCode).catch(err => console.error('Mail gönderilemedi:', err.message));

    const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.status(201).json({ 
      token, 
      user: { 
        id: newUser.id, 
        username, 
        email, 
        role: newUser.role, 
        isApproved: newUser.isApproved,
        isEmailVerified: false,
        gender: newUser.gender,
        age: newUser.age,
        avatar: newUser.avatar
      },
      message: `Kayıt başarılı! Doğrulama kodu ${email} adresine gönderildi. (Test ortamı: konsola bakınız)`,
      verificationRequired: true
    });
  } catch (err) {
    console.error('Register hatası:', err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ E-Posta Doğrulama
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı!' });
    
    if (user.isEmailVerified) {
      return res.json({ success: true, message: 'E-posta zaten doğrulanmış.' });
    }
    
    // Kod kontrolü
    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'Geçersiz doğrulama kodu!' });
    }
    
    // Süre kontrolü
    if (user.verificationExpiry && new Date() > new Date(user.verificationExpiry)) {
      return res.status(400).json({ message: 'Doğrulama kodunun süresi dolmuş. Yeni kod talep edin.' });
    }
    
    user.isEmailVerified = true;
    user.verificationCode = null;
    user.verificationExpiry = null;
    await user.save();
    
    res.json({ success: true, message: 'E-posta başarıyla doğrulandı! 🎉' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔄 Doğrulama Kodunu Yeniden Gönder
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı!' });
    
    if (user.isEmailVerified) {
      return res.json({ success: true, message: 'E-posta zaten doğrulanmış.' });
    }
    
    const verificationCode = generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000);
    
    user.verificationCode = verificationCode;
    user.verificationExpiry = verificationExpiry;
    await user.save();
    
    await sendVerificationEmail(email, verificationCode).catch(err => console.error('Mail gönderilemedi:', err.message));

    res.json({ success: true, message: 'Yeni doğrulama kodu gönderildi!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔓 Giriş Yap (Login)
router.post('/login', async (req, res) => {
  try {
    const { email, identifier, password } = req.body;
    const loginValue = (identifier || email || '').trim();

    if (!loginValue || !password) {
      return res.status(400).json({ message: 'E-posta/kullanıcı adı ve şifre zorunludur!' });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: loginValue },
          { username: loginValue }
        ]
      }
    });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Hatalı e-posta veya şifre!' });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: 'Hesabınız yönetici tarafından engellenmiştir!' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        avatar: user.avatar,
        credits: user.credits, 
        iban: user.iban, 
        role: user.role, 
        isApproved: user.isApproved,
        isEmailVerified: user.isEmailVerified,
        gender: user.gender,
        age: user.age,
        bio: user.bio,
        level: user.level,
        vipStatus: user.vipStatus,
        perMinuteRate: user.perMinuteRate,
        messageRate: user.messageRate,
        totalEarned: user.totalEarned
      } 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔑 Şifremi Unuttum — Sıfırlama Kodu Gönder
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'E-posta zorunludur!' });

    const user = await User.findOne({ where: { email } });
    // Kullanıcı yok olsa bile aynı mesajı döneriz (güvenlik)
    if (user) {
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const resetExpiry = new Date(Date.now() + 15 * 60 * 1000);
      user.verificationCode = resetCode;
      user.verificationExpiry = resetExpiry;
      await user.save();
      await sendPasswordResetEmail(email, resetCode).catch(err => console.error('Mail gönderilemedi:', err.message));
    }
    res.json({ success: true, message: 'Eğer bu e-posta kayıtlıysa sıfırlama kodu gönderildi.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔄 Yeni Şifre Belirle
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword)
      return res.status(400).json({ message: 'Tüm alanlar zorunludur!' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır!' });

    const user = await User.findOne({ where: { email } });
    if (!user || user.verificationCode !== code)
      return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş kod!' });
    if (user.verificationExpiry && new Date() > new Date(user.verificationExpiry))
      return res.status(400).json({ message: 'Kodun süresi dolmuş. Tekrar talep edin.' });

    user.password = newPassword; // beforeCreate hook yoksa burada hash lazım
    // Manuel hash (beforeUpdate hook olmadığından)
    const bcrypt = require('bcryptjs');
    user.password = await bcrypt.hash(newPassword, 10);
    user.verificationCode = null;
    user.verificationExpiry = null;
    await user.save();
    res.json({ success: true, message: 'Şifreniz başarıyla güncellendi!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
