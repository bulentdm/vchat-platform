import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Settings, DollarSign, Users, Video, Power, ShieldCheck, CameraOff } from 'lucide-react';

const BroadcasterStudio = ({ onStartStream, onStopStream, currentUser }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [iban, setIban] = useState(currentUser?.iban || '');
  const [gender, setGender] = useState(currentUser?.gender || 'female');
  const [perMinuteRate, setPerMinuteRate] = useState(currentUser?.perMinuteRate || 50);
  const [messageRate, setMessageRate] = useState(currentUser?.messageRate || 10);
  const [stats, setStats] = useState({
    followers: 0,
    diamonds: 0,
    pendingTL: '0.00',
    totalEarnedTL: 0,
    totalStreamMinutes: 0,
    monthlyGiftDiamonds: 0,
    commissionRate: currentUser?.commissionRate || 80,
  });
  const [hasPendingPayout, setHasPendingPayout] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes}dk`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}sa ${m}dk`;
  };

  useEffect(() => {
    const enableCamera = async () => {
      try {
        const userStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(userStream);
        if (videoRef.current) {
          videoRef.current.srcObject = userStream;
        }
      } catch (err) {
        console.error("Kamera hatası:", err);
        setError("Kameranıza erişilemedi. Lütfen tarayıcı izinlerini kontrol edin.");
      }
    };

    enableCamera();
    
    // Gerçek istatistikleri ve ödeme durumunu çek
    const fetchStats = async () => {
      try {
        const { api, paymentApi } = await import('../api');
        const [data, payouts] = await Promise.all([api.getMyStats(), paymentApi.getMyPayouts()]);
        if (data && !data.message) {
          setStats({
            followers: data.followerCount || 0,
            diamonds: data.currentCredits || 0,
            pendingTL: data.pendingTL || '0.00',
            totalEarnedTL: data.totalEarnedTL || 0,
            totalStreamMinutes: data.totalStreamMinutes || 0,
            monthlyGiftDiamonds: data.monthlyGiftDiamonds || 0,
            commissionRate: data.commissionRate || 80,
          });
        }
        if (Array.isArray(payouts)) {
          setHasPendingPayout(payouts.some(p => p.type === 'withdrawal_request' && p.status === 'pending'));
        }
      } catch(e) { console.error(e); }
    };
    fetchStats();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck color="#7c3aed" /> Yayıncı Paneli — {currentUser?.username || 'Studio'}
        </h1>
        <div className="glass-pill" style={{ color: '#22c55e', fontSize: '0.9rem', borderColor: '#22c55e' }}>
          ● Sistem Hazır
        </div>
      </div>

      {/* 📊 İstatistik Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        {[
          { icon: <Users />, label: 'Takipçi', value: stats.followers },
          { icon: <DollarSign color="#db2777" />, label: `💎 Biriken (Komisyon %${stats.commissionRate})`, value: stats.diamonds },
          { icon: <Power color="#22c55e" />, label: '⏳ Bekleyen Kazanç', value: `₺${stats.pendingTL}` },
          { icon: <Video color="#7c3aed" />, label: 'Toplam Yayın', value: formatDuration(stats.totalStreamMinutes) }
        ].map((item, idx) => (
          <motion.div whileHover={{ y: -5 }} key={idx} style={{ 
            backgroundColor: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '15px' 
          }}>
            <div style={{ display: 'flex', gap: '10px', color: '#94a3b8', marginBottom: '10px' }}>{item.icon} {item.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{item.value}</div>
          </motion.div>
        ))}
      </div>

      {/* � Ödeme Talebi Bölümü */}
      {parseFloat(stats.pendingTL) > 0 && (
        <div style={{ padding: '20px 25px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '4px' }}>Birikmiş Kazancınız</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#22c55e' }}>₺{stats.pendingTL}</div>
            <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '3px' }}>💎 {stats.diamonds} elmas × ₺0.50 kur — komisyon %{stats.commissionRate}</div>
            {!iban && <div style={{ color: '#f59e0b', fontSize: '0.8rem', marginTop: '6px' }}>⚠️ Ödeme alabilmek için sağ panelden IBAN bilginizi ekleyin</div>}
          </div>
          {hasPendingPayout ? (
            <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', padding: '12px 22px', borderRadius: '12px', color: '#f59e0b', fontWeight: 'bold' }}>
              ⏳ Ödeme talebiniz inceleniyor
            </div>
          ) : (
            <button
              disabled={payoutLoading || !iban}
              onClick={async () => {
                setPayoutLoading(true);
                try {
                  const { paymentApi } = await import('../api');
                  const res = await paymentApi.requestPayout();
                  alert(res.message);
                  if (res.success) setHasPendingPayout(true);
                } catch(e) { alert('Hata: ' + e.message); }
                setPayoutLoading(false);
              }}
              style={{ background: !iban ? '#334155' : 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '12px', fontWeight: 'bold', cursor: !iban ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: payoutLoading ? 0.7 : 1 }}>
              {payoutLoading ? '⏳ İşleniyor...' : `💸 ₺${stats.pendingTL} Ödeme Talep Et`}
            </button>
          )}
        </div>
      )}

      {/* �📡 Yayın Hazırlık Alanı */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div style={{ 
          backgroundColor: '#000', 
          height: '400px', 
          borderRadius: '24px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {error ? (
              <div style={{ textAlign: 'center', color: '#ef4444' }}>
                  <CameraOff size={48} style={{ marginBottom: '10px' }} />
                  <div>{error}</div>
              </div>
          ) : (
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
              />
          )}

          {!stream && !error && (
            <div className="glass-pill" style={{ padding: '20px 40px', position: 'absolute' }}>
               Kamera Önizlemesi Hazırlanıyor...
            </div>
          )}

          <div style={{ position: 'absolute', bottom: '20px', display: 'flex', gap: '14px' }}>
            <button 
                onClick={() => {
                   console.log("🎞️ Yayın başlatılıyor...");
                   onStartStream();
                }} 
                className="btn-primary" 
                style={{ padding: '15px 40px' }}>
               YAYINI BAŞALAT
            </button>
            {onStopStream && (
              <button
                onClick={async () => {
                  try {
                    const { api } = await import('../api');
                    await api.stopStream();
                  } catch(e) { console.error(e); }
                  if (onStopStream) onStopStream();
                }}
                style={{ padding: '15px 28px', background: '#ef4444', border: 'none', borderRadius: '50px', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}>
                ⏹️ Yayını Bitir
              </button>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ marginBottom: '20px' }}><Settings size={18} /> Profil & Fiyatlandırma</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', maxHeight: '400px', paddingRight: '10px' }}>
            
            <label style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Cinsiyet</label>
            <select 
               value={gender} 
               onChange={(e) => setGender(e.target.value)} 
               style={{ background: '#1e293b', border: 'none', padding: '12px', borderRadius: '10px', color: '#fff' }}>
               <option value="female">Kadın</option>
               <option value="male">Erkek</option>
               <option value="other">Diğer</option>
            </select>

            <label style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Özel Arama Dakika Ücreti (💎)</label>
            <input 
               type="number"
               value={perMinuteRate} 
               onChange={(e) => setPerMinuteRate(e.target.value)} 
               style={{ background: '#1e293b', border: 'none', padding: '12px', borderRadius: '10px', color: '#fff' }} 
            />

            <label style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Özel Mesaj Ücreti (💎)</label>
            <input 
               type="number"
               value={messageRate} 
               onChange={(e) => setMessageRate(e.target.value)} 
               style={{ background: '#1e293b', border: 'none', padding: '12px', borderRadius: '10px', color: '#fff' }} 
            />

            <label style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '10px' }}>Ödeme İçin IBAN</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                 value={iban} 
                 onChange={(e) => setIban(e.target.value)} 
                 placeholder="TR00..." 
                 style={{ flex: 1, background: '#1e293b', border: 'none', padding: '12px', borderRadius: '10px', color: '#fff' }} 
              />
            </div>
            
            <button 
              onClick={async () => {
                 const { api } = await import('../api');
                 const res = await api.updateProfile({ 
                    iban, gender, 
                    perMinuteRate: parseInt(perMinuteRate), 
                    messageRate: parseInt(messageRate) 
                 });
                 if (res.success) alert("Profil ve fiyat ayarları başarıyla kaydedildi!");
                 else alert(res.message || "Hata!");
              }}
              className="btn-primary" 
              style={{ padding: '12px', borderRadius: '10px', marginTop: '10px' }}>
              Ayarları Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcasterStudio;
