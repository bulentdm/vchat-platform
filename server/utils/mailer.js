const nodemailer = require('nodemailer');

// SMTP ayarları env'den gelir.
// Resend:  SMTP_HOST=smtp.resend.com  SMTP_PORT=465  SMTP_USER=resend  SMTP_PASS=re_xxxx
// Gmail:   SMTP_HOST=smtp.gmail.com   SMTP_PORT=465  SMTP_USER=sen@gmail.com  SMTP_PASS=app_password
// Hiçbiri yoksa: console.log ile simülasyon yapar (test/dev)

const isConfigured = () =>
  process.env.SMTP_HOST && process.env.SMTP_PASS;

const createTransporter = () => {
  if (!isConfigured()) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: (Number(process.env.SMTP_PORT) || 465) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const FROM_ADDRESS = process.env.MAIL_FROM || 'vChat <noreply@vchat.com>';

/**
 * E-posta gönderir. SMTP yapılandırılmamışsa konsola yazar.
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 */
const sendMail = async (to, subject, html) => {
  if (!isConfigured()) {
    console.log(`📧 [MAIL SİMÜLASYON] To: ${to} | ${subject}`);
    // HTML içindeki kodu da göster (test kolaylığı için)
    const codeMatch = html.match(/\b(\d{6})\b/);
    if (codeMatch) console.log(`   Kod: ${codeMatch[1]}`);
    return { simulated: true };
  }

  const transporter = createTransporter();
  try {
    const info = await transporter.sendMail({ from: FROM_ADDRESS, to, subject, html });
    console.log(`✅ [MAIL GÖNDERİLDİ] ${to} → ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ [MAIL HATASI] ${to}:`, err.message);
    throw err;
  }
};

// ─── Hazır Şablonlar ────────────────────────────────────────────────

const sendVerificationEmail = (to, code) =>
  sendMail(
    to,
    'vChat — E-posta Doğrulama Kodunuz',
    `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#fff;padding:40px;border-radius:20px">
      <h1 style="color:#7c3aed;margin-bottom:10px">vChat</h1>
      <h2 style="margin-bottom:20px">E-posta Doğrulama</h2>
      <p style="color:#94a3b8">Hesabınızı doğrulamak için aşağıdaki 6 haneli kodu kullanın:</p>
      <div style="background:#1e293b;border:2px solid #7c3aed;border-radius:16px;padding:24px;text-align:center;margin:30px 0">
        <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#7c3aed">${code}</span>
      </div>
      <p style="color:#475569;font-size:0.85rem">Bu kod 15 dakika geçerlidir. Eğer bu işlemi siz yapmadıysanız bu e-postayı görmezden gelin.</p>
    </div>
    `
  );

const sendPasswordResetEmail = (to, code) =>
  sendMail(
    to,
    'vChat — Şifre Sıfırlama Kodunuz',
    `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#fff;padding:40px;border-radius:20px">
      <h1 style="color:#db2777;margin-bottom:10px">vChat</h1>
      <h2 style="margin-bottom:20px">Şifre Sıfırlama</h2>
      <p style="color:#94a3b8">Şifrenizi sıfırlamak için aşağıdaki kodu kullanın:</p>
      <div style="background:#1e293b;border:2px solid #db2777;border-radius:16px;padding:24px;text-align:center;margin:30px 0">
        <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#db2777">${code}</span>
      </div>
      <p style="color:#475569;font-size:0.85rem">Bu kod 15 dakika geçerlidir. Şifreni sıfırlamak istemediyseniz bu e-postayı yok sayın.</p>
    </div>
    `
  );

module.exports = { sendMail, sendVerificationEmail, sendPasswordResetEmail };
