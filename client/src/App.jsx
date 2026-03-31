import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Heart, Sparkles, LogIn, LayoutGrid, User, ShieldCheck, Mail, Users, Lock } from 'lucide-react';
import io from 'socket.io-client';
import VideoRoom from './components/VideoRoom';
import ChatBox from './components/ChatBox';
import BroadcasterStudio from './components/BroadcasterStudio';
import AdminPanel from './components/AdminPanel'; // Yeni eklenen
import { api, paymentApi } from './api';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const createSocket = () => {
  const token = localStorage.getItem('vchat_token');
  return io(API_BASE_URL, {
    auth: token ? { token } : {},
    autoConnect: true
  });
};

let socket = createSocket();

function App() {
  const [view, setView] = useState('home'); // home, studio, streaming, admin
  const [isLogged, setIsLogged] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null); // seçili paket — ödeme adımı
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginMode, setLoginMode] = useState('login'); // login or register
  const [searchTerm, setSearchTerm] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [registerStep, setRegisterStep] = useState(1); // 1=basic, 2=profile
  
  const [authData, setAuthData] = useState({ email: '', password: '', username: '', role: 'user', gender: 'other', age: '', phone: '', bio: '', avatar: '' });
  const [currentUser, setCurrentUser] = useState(null);
  const [credits, setCredits] = useState(0);
  const [streamers, setStreamers] = useState([]);
  const [activeStreamer, setActiveStreamer] = useState(null);

  const [diamondPackages, setDiamondPackages] = useState([
    { id: 1, amount: 100, priceInTL: 50, label: 'Başlangıç', color: '#cd7f32', icon: '🥉' },
    { id: 2, amount: 500, priceInTL: 200, label: 'Gümüş', color: '#c0c0c0', icon: '🥈' },
    { id: 3, amount: 1500, priceInTL: 500, label: 'Altın', color: '#ffd700', icon: '🥇' },
    { id: 4, amount: 5000, priceInTL: 1500, label: 'Platin', color: '#e5e4e2', icon: '💎' },
  ]);

  const [giftAnimation, setGiftAnimation] = useState(null);

  const getDynamicChannel = () => {
    if (activeStreamer) return activeStreamer.username;
    if (currentUser) return currentUser.username;
    return "test_channel";
  };

  const [filter, setFilter] = useState('all'); // all, female, male
  const [sort, setSort] = useState('popular'); // popular, newest, rich
  const [showInbox, setShowInbox] = useState(false);
  const [dms, setDms] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState({ bio: '', avatar: '', iban: '' });
  const [forgotStep, setForgotStep] = useState(0); // 0=off, 1=email, 2=code+newpw
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPw, setForgotNewPw] = useState('');
  const isAuthenticated = isLogged && !!currentUser;
  const [isStreamersLoading, setIsStreamersLoading] = useState(true);
  const [streamersError, setStreamersError] = useState('');
  
  // 📞 Gelen çağrı modal
  const [incomingCall, setIncomingCall] = useState(null); // { callerId, callerName, channelName }
  // 🎬 Aktif özel görüşme
  const [activePrivateCall, setActivePrivateCall] = useState(null); // { channelName }
  // ☕ Arayan taraf bekleme durumu
  const [callingUser, setCallingUser] = useState(null); // { id, name }
  // 📧 Okunmamış mesaj sayısı
  const [unreadCount, setUnreadCount] = useState(0);
  // 👁️ İzleyici sayısı
  const [viewerCount, setViewerCount] = useState(0);
  // 📜 İşlem geçmişi
  const [showHistory, setShowHistory] = useState(false);
  const [txHistory, setTxHistory] = useState([]);
  // 🌐 Online sayısı
  const [onlineCount, setOnlineCount] = useState(0);
  // 📝 Toast bildirimi
  const [toast, setToast] = useState(null);
  
  const filteredStreamers = streamers
    .filter(s => filter === 'all' || s.gender === filter)
    .filter(s => s.username.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'popular') return (b.level || 0) - (a.level || 0);
      if (sort === 'rich') return (b.credits || 0) - (a.credits || 0);
      return 0;
    });

  // 🔄 Initial Load: Check Token & Fetch Streamers
  useEffect(() => {
    const init = async () => {
      // Streamer listesi
      setIsStreamersLoading(true);
      setStreamersError('');
      const streamerList = await api.getStreamers();
      if (Array.isArray(streamerList)) {
        setStreamers(streamerList);
      } else {
        setStreamersError(streamerList?.message || 'Yayıncı listesi alınamadı.');
      }
      setIsStreamersLoading(false);

      // Oturum kontrolü
      const token = localStorage.getItem('vchat_token');
      if (token) {
        const userData = await api.getMe();
        if (userData && !userData.message) {
          setIsLogged(true);
          setCurrentUser(userData);
          setCredits(userData.credits);
          socket.emit('register_user', userData.id);
          api.getUnreadCount().then(r => setUnreadCount(r?.count || 0));
        } else {
          localStorage.removeItem('vchat_token');
          socket.disconnect();
          socket = createSocket();
        }
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (view === 'streaming') {
      setViewerCount(0);
      socket.emit('join_stream', getDynamicChannel());
    } else {
      // Yayından ayrılırsa viewerCount azalt
      if (socket.currentStreamId) {
        socket.emit('leave_stream', socket.currentStreamId);
      }
    }

    const showToast = (msg, color = '#7c3aed') => {
      setToast({ msg, color });
      setTimeout(() => setToast(null), 4000);
    };

    socket.on('gift_event', (data) => {
      setGiftAnimation(data);
      setTimeout(() => setGiftAnimation(null), 4000);
    });

    socket.on('update_credits', (data) => {
      setCredits(data.credits);
    });

    socket.on('viewer_count', (data) => {
      setViewerCount(data.count || 0);
    });

    socket.on('online_count', (data) => {
      setOnlineCount(data.count || 0);
    });

    socket.on('new_follower', (data) => {
      showToast(`💖 ${data.followerName} seni takip etti!`, '#db2777');
    });

    socket.on('incoming_call', (data) => {
      setIncomingCall(data);
    });

    socket.on('call_accepted', (data) => {
      setCallingUser(null);
      setActivePrivateCall({ channelName: data.channelName });
    });

    socket.on('call_rejected', (data) => {
      setCallingUser(null);
      showToast(data.message, '#ef4444');
    });
    socket.on('call_cancelled', (data) => {
      setIncomingCall(null);
      showToast(data.message, '#64748b');
    });
    socket.on('call_ended_no_credits', (data) => {
      setActivePrivateCall(null);
      setCallingUser(null);
      showToast(data.message, '#ef4444');
    });
    socket.on('call_ended', (data) => {
      setActivePrivateCall(null);
      setCallingUser(null);
      showToast(data.message, '#64748b');
    });

    return () => {
      socket.off('gift_event');
      socket.off('update_credits');
      socket.off('viewer_count');
      socket.off('online_count');
      socket.off('new_follower');
      socket.off('incoming_call');
      socket.off('call_accepted');
      socket.off('call_rejected');
      socket.off('call_cancelled');
      socket.off('call_ended_no_credits');
      socket.off('call_ended');
    };
  }, [view]);

  // Messages Loader
  useEffect(() => {
    if (showInbox && isLogged) {
       api.getMessages().then(res => setDms(res));
       setUnreadCount(0); // Modal açıldığında okunmamış sayısını sıfırla
    }
  }, [showInbox, isLogged]);

  useEffect(() => {
    // Streaming ekranı sadece giriş yapan kullanıcılar için erişilebilir.
    if (view === 'streaming' && !isAuthenticated) {
      setView('home');
      setShowLogin(true);
    }
  }, [view, isAuthenticated]);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      let res;
      if (loginMode === 'login') {
        res = await api.login(authData.email, authData.password);
      } else {
        // Kayıt: tüm alanlarla birlikte
        res = await api.register({
          ...authData,
          age: authData.age ? parseInt(authData.age) : null
        });
      }

      if (res && res.token) {
        localStorage.setItem('vchat_token', res.token);
        // Socket'i token ile yeniden bağla
        socket.disconnect();
        socket = createSocket();
        setIsLogged(true);
        setCurrentUser(res.user);
        setCredits(res.user.credits || 0);
        setShowLogin(false);
        socket.emit('register_user', res.user.id);
        api.getUnreadCount().then(r => setUnreadCount(r?.count || 0));
        
        // Kayıt sonrası doğrulama gerekiyorsa
        if (res.verificationRequired) {
          setVerificationEmail(authData.email);
          setShowVerification(true);
        }
        
        setRegisterStep(1);
      } else {
        alert(res?.message || 'Bir hata oluştu!');
      }
    } catch (error) {
      console.error("Auth error:", error);
      alert("Bağlantı hatası: Sunucuya ulaşılamıyor veya beklenmeyen bir hata oluştu.");
    }
  };

  const handleVerifyEmail = async () => {
    const res = await api.verifyEmail(verificationEmail, verificationCode);
    if (res.success) {
      alert('🎉 ' + res.message);
      setShowVerification(false);
      // Kullanıcı bilgilerini güncelle
      const userData = await api.getMe();
      if (userData && !userData.message) setCurrentUser(userData);
    } else {
      alert(res.message || 'Doğrulama başarısız!');
    }
  };

  const handleResendCode = async () => {
    const res = await api.resendCode(verificationEmail);
    alert(res.message || 'Kod gönderildi.');
  };

  const handleBuyCredits = async () => {
    if (!selectedPkg) return;
    setPaymentLoading(true);
    const res = await paymentApi.purchasePackage(selectedPkg.id);
    setPaymentLoading(false);
    if (res.success) {
      setCredits(res.newCredits);
      setShowWallet(false);
      setSelectedPkg(null);
      alert(res.message);
    } else {
      alert(res.message || 'Satın alma başarısız!');
    }
  };

  const handleOpenProfile = () => {
    setProfileData({
      bio: currentUser.bio || '',
      avatar: currentUser.avatar || '',
      iban: currentUser.iban || ''
    });
    setShowProfile(true);
  };

  const handleSaveProfile = async () => {
    const res = await api.updateProfile(profileData);
    if (res.success || res.user) {
      const updated = await api.getMe();
      if (updated && !updated.message) setCurrentUser(updated);
      setShowProfile(false);
      alert('Profilin güncellendi ✅');
    } else {
      alert(res.message || 'Güncelleme başarısız!');
    }
  };

  const logout = () => {
    localStorage.removeItem('vchat_token');
    socket.disconnect();
    socket = createSocket(); // tokensiz misafir socket
    setIsLogged(false);
    setCurrentUser(null);
    setCredits(0);
    setView('home');
  };

  return (
    <div className="App" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'hidden', position: 'relative' }}>

      {/* 🌐 Toast Bildirimi */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            style={{ position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', background: toast.color || '#7c3aed', color: '#fff', padding: '12px 28px', borderRadius: '50px', fontWeight: 'bold', zIndex: 99999, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📞 Gelen Çağrı Modalı */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 99998, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              style={{ background: '#1e293b', border: '2px solid #7c3aed', borderRadius: '28px', padding: '40px', textAlign: 'center', width: '340px', boxShadow: '0 0 60px rgba(124,58,237,0.4)' }}>
              <div style={{ fontSize: '60px', marginBottom: '16px' }}>📞</div>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{incomingCall.callerName} seni arıyor!</h3>
              <p style={{ color: '#94a3b8', marginBottom: '28px', fontSize: '0.9rem' }}>Aramayı kabul edersen dakika başı bakiye kesilir.</p>
              <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
                <button onClick={() => {
                    socket.emit('accept_call', { ...incomingCall, receiverId: currentUser?.id });
                    setActivePrivateCall({ channelName: incomingCall.channelName });
                    setIncomingCall(null);
                  }}
                  style={{ background: '#22c55e', border: 'none', borderRadius: '14px', color: '#fff', padding: '14px 28px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' }}>✅ Kabul</button>
                <button onClick={() => { socket.emit('reject_call', { callerId: incomingCall.callerId, receiverId: currentUser?.id }); setIncomingCall(null); }}
                  style={{ background: '#ef4444', border: 'none', borderRadius: '14px', color: '#fff', padding: '14px 28px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' }}>❌ Reddet</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⏳ Arıyor... Bekleme Ekranı */}
      <AnimatePresence>
        {callingUser && !activePrivateCall && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.88)', zIndex: 99995, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              style={{ background: '#1e293b', border: '2px solid #22c55e', borderRadius: '28px', padding: '40px', textAlign: 'center', width: '320px', boxShadow: '0 0 60px rgba(34,197,94,0.4)' }}>
              <div style={{ fontSize: '60px', marginBottom: '16px' }}>📞</div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>{callingUser.name} aranıyor...</h3>
              <p style={{ color: '#94a3b8', marginBottom: '28px', fontSize: '0.9rem' }}>Yayıncının cevap vermesi bekleniyor.</p>
              <button onClick={() => {
                socket.emit('cancel_call', { callerId: currentUser?.id, receiverId: callingUser.id });
                setCallingUser(null);
              }} style={{ background: '#ef4444', border: 'none', borderRadius: '14px', color: '#fff', padding: '14px 28px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' }}>❌ Vazgeç</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎥 Aktif Özel Görüşme */}
      <AnimatePresence>
        {activePrivateCall && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#000', zIndex: 99994, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1rem' }}>🔒 Özel Görüşme</span>
              <button onClick={() => {
                socket.emit('end_call', { channelName: activePrivateCall.channelName });
                setActivePrivateCall(null);
              }} style={{ background: '#ef4444', border: 'none', borderRadius: '10px', color: '#fff', padding: '10px 22px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>
                📵 Görüşmeyi Bitir
              </button>
            </div>
            <div style={{ flex: 1 }}>
              <VideoRoom
                channelName={activePrivateCall.channelName}
                role="publisher"
                onLeave={() => {
                  socket.emit('end_call', { channelName: activePrivateCall.channelName });
                  setActivePrivateCall(null);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📜 İşlem Geçmişi Modalı */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9997, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
            <div style={{ background: '#1e293b', border: '1px solid #7c3aed', borderRadius: '24px', padding: '30px', width: '480px', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.3rem' }}>📜 İşlem Geçmişi</h3>
                <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {txHistory.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center' }}>Henüz işlem yok.</p> : txHistory.map(tx => (
                  <div key={tx.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{tx.description || tx.type}</div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{new Date(tx.createdAt).toLocaleString('tr-TR')}</div>
                    </div>
                    <div style={{ color: ['purchase','gift_received','call_received'].includes(tx.type) ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                      {['gift_received','call_received','purchase'].includes(tx.type) ? '+' : '-'}{tx.amount} 💎
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 🔴 Mesajlar Modal */}
      <AnimatePresence>
        {showInbox && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}
          >
            <div style={{ backgroundColor: '#1e293b', width: '400px', height: '500px', borderRadius: '24px', padding: '30px', border: '1px solid #7c3aed', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', marginBottom: '15px' }}>
                <h3 style={{ fontSize: '1.4rem' }}>Gelen Kutusu</h3>
                <button onClick={() => setShowInbox(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {dms.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center' }}>Hiç mesajın yok.</p> : dms.map(m => (
                    <div key={m.id} style={{ padding: '10px', background: m.senderId === currentUser?.id ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)', borderRadius: '10px', borderLeft: m.isPaid ? '4px solid #db2777' : 'none' }}>
                       <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '5px' }}>
                          {m.senderId === currentUser?.id ? 'Sen gönderdin' : 'Sana geldi'} 
                          {m.isPaid && ` (💎 ${m.pricePaid})`}
                       </div>
                       <div>{m.content}</div>
                    </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎬 Global Gift Animation Overlay */}
      <AnimatePresence>
        {giftAnimation && (
          <motion.div 
            initial={{ scale: 0, y: 100, opacity: 0 }}
            animate={{ scale: 1.2, y: 0, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            style={{ 
              position: 'fixed', 
              top: '30%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              zIndex: 9999,
              pointerEvents: 'none',
              textAlign: 'center',
              textShadow: '0 0 20px rgba(124, 58, 237, 0.8)'
            }}
          >
            <div style={{ fontSize: '100px', marginBottom: '10px' }}>{giftAnimation.giftIcon || '💎'}</div>
            <div style={{ 
              background: 'linear-gradient(90deg, #7c3aed, #db2777)', 
              padding: '10px 30px', 
              borderRadius: '50px', 
              color: '#fff', 
              fontWeight: 'bold',
              fontSize: '1.5rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
              {giftAnimation.sender} bir {giftAnimation.giftValue >= 1000 ? 'EFSANE' : 'Hediye'} Gönderdi! 🔥
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🧭 Navbar */}
      <nav className="navbar" style={{ padding: '10px 5%' }}>
        <div className="logo" style={{ fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('home')}>
          <Video color="#7c3aed" /> Murat'ın Yeri
        </div>
        <div style={{ display: 'flex', flex: 1, justifyContent: 'center', margin: '0 40px' }}>
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Yayıncı veya kategori ara..." 
            style={{ width: '100%', maxWidth: '400px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 25px', borderRadius: '50px', color: '#fff' }} 
          />
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {isLogged ? (
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
               <div className="glass-pill" style={{ color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} /> 💎 {credits}
                <span onClick={() => setShowWallet(true)} style={{ color: '#fff', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '5px', fontSize: '0.8rem' }}>+ Yükle</span>
                <span onClick={async () => { const h = await paymentApi.getHistory(); setTxHistory(Array.isArray(h) ? h : []); setShowHistory(true); }} style={{ color: '#a78bfa', cursor: 'pointer', background: 'rgba(124,58,237,0.15)', padding: '2px 8px', borderRadius: '5px', fontSize: '0.8rem' }}>📜</span>
              </div>
              
              <button onClick={() => setShowInbox(true)} className="glass-pill" style={{ display: 'flex', gap: '5px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', cursor: 'pointer', border: '1px solid #38bdf8', position: 'relative' }}>
                <Mail size={16} /> Mesajlar
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.65rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <div className="glass-pill" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={handleOpenProfile}>
                <Users size={16} /> 👤 {currentUser.username}
                {currentUser.isEmailVerified ? 
                  <span title="Doğrulanmış Hesap" style={{ color: '#22c55e', fontSize: '0.9rem' }}>✓</span> : 
                  <span onClick={(e) => { e.stopPropagation(); setVerificationEmail(currentUser.email); setShowVerification(true); }} title="E-posta doğrulanmamış! Tıkla ve doğrula." style={{ color: '#fbbf24', fontSize: '0.9rem', cursor: 'pointer' }}>⚠️</span>
                }
              </div>

               {currentUser?.role === 'admin' && (
                  <button 
                    onClick={() => setView('admin')}
                    style={{ background: 'rgba(124, 58, 237, 0.2)', color: '#7c3aed', border: '1px solid #7c3aed', padding: '8px 18px', borderRadius: '50px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    🛡️ Admin Paneli
                  </button>
               )}

               <button 
                  onClick={logout}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
                  Çıkış
                </button>
            </div>
          ) : (
            <div 
              onClick={() => { setLoginMode('login'); setShowLogin(true); }}
              className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
              Giriş Yap
            </div>
          )}

          {isAuthenticated && (
            <button 
              onClick={() => {
                if (currentUser.role === 'broadcaster') {
                  if (currentUser.isApproved) {
                    setView('studio');
                  } else {
                    alert("⚠️ Başvurunuz hala inceleniyor. Lütfen onaylanana kadar bekleyin.");
                  }
                } else if (currentUser.role === 'admin') {
                  setView('studio'); // Adminler her şeyi yapabilir
                } else {
                  alert("⚠️ Yayın açmak için önce Yayıncı Başvurusu yapmalısınız!");
                }
              }}
              className="glass-pill" style={{ padding: '8px 18px', fontSize: '0.8rem', color: '#fff', cursor: 'pointer', border: '1px solid #7c3aed', background: view === 'studio' ? '#7c3aed' : 'none' }}>
              Yayıncı Paneli
            </button>
          )}
        </div>
      </nav>

      {/* � Profil Düzenleme Modal */}
      <AnimatePresence>
        {showProfile && currentUser && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ backgroundColor: '#1e293b', padding: '40px', borderRadius: '32px', width: '420px', border: '1px solid #7c3aed', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h2 style={{ fontSize: '1.5rem' }}>Profilini Düzenle</h2>
                <button onClick={() => setShowProfile(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
              </div>

              <img src={profileData.avatar || 'https://cdn.icon-icons.com/icons2/1378/PNG/512/avatardefault_92824.png'}
                style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c3aed', marginBottom: '20px' }} alt="avatar" />

              <input placeholder="Avatar URL" value={profileData.avatar}
                onChange={e => setProfileData({ ...profileData, avatar: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '12px', marginBottom: '12px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#fff', outline: 'none' }} />

              <textarea rows={3} placeholder="Hakkında bir şeyler yaz..." value={profileData.bio}
                onChange={e => setProfileData({ ...profileData, bio: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '12px', marginBottom: '12px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#fff', outline: 'none', resize: 'none' }} />

              {currentUser.role === 'broadcaster' && (
                <input placeholder="IBAN (Kazanc havale için)" value={profileData.iban}
                  onChange={e => setProfileData({ ...profileData, iban: e.target.value })}
                  style={{ display: 'block', width: '100%', padding: '12px', marginBottom: '12px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#fff', outline: 'none' }} />
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button onClick={() => setShowProfile(false)}
                  style={{ flex: 1, background: 'none', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', color: '#fff', cursor: 'pointer' }}>
                  Vazgeç
                </button>
                <button onClick={handleSaveProfile} className="btn-primary"
                  style={{ flex: 2, padding: '12px', fontSize: '1rem', justifyContent: 'center' }}>
                  Kaydet ✅
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* �🔑 Login / Register Modal */}
      <AnimatePresence>
        {showLogin && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ backgroundColor: '#1e293b', padding: '40px', borderRadius: '32px', width: loginMode === 'register' ? '500px' : '400px', border: '1px solid #7c3aed', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(124, 58, 237, 0.2)', padding: '15px', borderRadius: '50%' }}>
                     <ShieldCheck size={40} color="#7c3aed" />
                  </div>
                </div>
                <h2 style={{ marginBottom: '10px', fontSize: '1.8rem' }}>
                  {loginMode === 'login' ? 'Tekrar Hoş Geldin' : (registerStep === 1 ? 'Aramıza Katıl' : 'Profilini Tamamla')}
                </h2>
                <p style={{ color: '#94a3b8', marginBottom: '25px', fontSize: '0.9rem' }}>
                  {loginMode === 'login' ? 'Hesabına giriş yaparak eğlenceye devam et.' : (registerStep === 1 ? 'Temel bilgilerini gir.' : 'Kendini tanıt, profilini zenginleştir.')}
                </p>
                
                {loginMode === 'login' ? (
                  forgotStep === 0 ? (
                  <form onSubmit={handleAuth}>
                    <input required type="text" placeholder="E-posta veya kullanıcı adı" value={authData.email}
                      onChange={(e) => setAuthData({...authData, email: e.target.value})}
                      style={{ display: 'block', width: '100%', padding: '14px', marginBottom: '15px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                    <input required type="password" placeholder="Şifre (min 6 karakter)" value={authData.password}
                      onChange={(e) => setAuthData({...authData, password: e.target.value})}
                      style={{ display: 'block', width: '100%', padding: '14px', marginBottom: '10px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                    <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                      <button type="button" onClick={() => setForgotStep(1)}
                        style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: '0.85rem', cursor: 'pointer' }}>
                        Şifremi unuttum
                      </button>
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem', justifyContent: 'center' }}>
                      Giriş Yap
                    </button>
                  </form>
                  ) : forgotStep === 1 ? (
                  <div>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>Kayıtlı e-posta adresini gir, sıfırlama kodu gönderelim.</p>
                    <input type="email" placeholder="E-posta adresin" value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      style={{ display: 'block', width: '100%', padding: '14px', marginBottom: '15px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                    <button onClick={async () => {
                        const r = await api.forgotPassword(forgotEmail);
                        alert(r.message);
                        if (r.success) setForgotStep(2);
                      }} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem', justifyContent: 'center' }}>
                      Kod Gönder
                    </button>
                    <button onClick={() => setForgotStep(0)} style={{ background: 'none', border: 'none', color: '#94a3b8', marginTop: '15px', cursor: 'pointer', fontSize: '0.85rem', display: 'block', width: '100%' }}>← Geri Dön</button>
                  </div>
                  ) : (
                  <div>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>Sunucu konsolundaki 6 haneli kodu ve yeni şifreni gir.</p>
                    <input type="text" maxLength={6} placeholder="Doğrulama kodu" value={forgotCode}
                      onChange={e => setForgotCode(e.target.value.replace(/\D/g, ''))}
                      style={{ display: 'block', width: '100%', padding: '14px', marginBottom: '12px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', outline: 'none', letterSpacing: '6px', textAlign: 'center' }} />
                    <input type="password" placeholder="Yeni şifre (min 6 karakter)" value={forgotNewPw}
                      onChange={e => setForgotNewPw(e.target.value)}
                      style={{ display: 'block', width: '100%', padding: '14px', marginBottom: '20px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                    <button onClick={async () => {
                        const r = await api.resetPassword(forgotEmail, forgotCode, forgotNewPw);
                        alert(r.message);
                        if (r.success) { setForgotStep(0); setForgotEmail(''); setForgotCode(''); setForgotNewPw(''); }
                      }} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem', justifyContent: 'center' }}>
                      Şifremi Güncelle
                    </button>
                    <button onClick={() => setForgotStep(1)} style={{ background: 'none', border: 'none', color: '#94a3b8', marginTop: '15px', cursor: 'pointer', fontSize: '0.85rem', display: 'block', width: '100%' }}>← Geri Dön</button>
                  </div>
                  )
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); if (registerStep === 1) { setRegisterStep(2); } else { handleAuth(e); } }}>
                    {registerStep === 1 && (
                      <>
                        <input required placeholder="Kullanıcı Adı (harf, rakam, _ , -)" value={authData.username}
                          onChange={(e) => setAuthData({...authData, username: e.target.value})}
                          style={{ display: 'block', width: '100%', padding: '14px', marginBottom: '15px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                        <input required type="email" placeholder="E-posta Adresi" value={authData.email}
                          onChange={(e) => setAuthData({...authData, email: e.target.value})}
                          style={{ display: 'block', width: '100%', padding: '14px', marginBottom: '15px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                        <input required type="password" placeholder="Şifre (min 6 karakter)" value={authData.password}
                          onChange={(e) => setAuthData({...authData, password: e.target.value})}
                          style={{ display: 'block', width: '100%', padding: '14px', marginBottom: '20px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                        
                        <div style={{ marginBottom: '15px' }}>
                          <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '8px', textAlign: 'left' }}>Ne yapmak istiyorsun?</label>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={() => setAuthData({...authData, role: 'user'})}
                              style={{ flex: 1, background: authData.role === 'user' ? '#7c3aed' : '#0f172a', border: authData.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '10px', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}>
                              👁️ İzleyiciyim
                            </button>
                            <button type="button" onClick={() => setAuthData({...authData, role: 'broadcaster'})}
                              style={{ flex: 1, background: authData.role === 'broadcaster' ? '#db2777' : '#0f172a', border: authData.role === 'broadcaster' ? 'none' : '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '10px', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}>
                              🎥 Yayıncıyım
                            </button>
                          </div>
                        </div>

                        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem', justifyContent: 'center' }}>
                          Devam Et →
                        </button>
                      </>
                    )}

                    {registerStep === 2 && (
                      <>
                        {/* Avatar Önizleme */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', justifyContent: 'center' }}>
                          <img src={authData.avatar || 'https://cdn.icon-icons.com/icons2/1378/PNG/512/avatardefault_92824.png'} 
                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c3aed' }} alt="avatar" />
                        </div>
                        
                        <input placeholder="Profil Fotoğrafı URL'si (isteğe bağlı)" value={authData.avatar}
                          onChange={(e) => setAuthData({...authData, avatar: e.target.value})}
                          style={{ display: 'block', width: '100%', padding: '14px', marginBottom: '15px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', outline: 'none' }} />

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '5px', textAlign: 'left' }}>Cinsiyet</label>
                            <select value={authData.gender} onChange={(e) => setAuthData({...authData, gender: e.target.value})}
                              style={{ width: '100%', padding: '14px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', outline: 'none' }}>
                              <option value="female">Kadın</option>
                              <option value="male">Erkek</option>
                              <option value="other">Belirtmek İstemiyorum</option>
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '5px', textAlign: 'left' }}>Yaş</label>
                            <input type="number" min="18" max="99" placeholder="18+" value={authData.age}
                              onChange={(e) => setAuthData({...authData, age: e.target.value})}
                              style={{ width: '100%', padding: '14px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                          </div>
                        </div>

                        <input type="tel" placeholder="Telefon Numarası (isteğe bağlı)" value={authData.phone}
                          onChange={(e) => setAuthData({...authData, phone: e.target.value})}
                          style={{ display: 'block', width: '100%', padding: '14px', marginBottom: '15px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                        
                        <textarea placeholder="Hakkında bir şeyler yaz... (isteğe bağlı)" value={authData.bio} rows={3}
                          onChange={(e) => setAuthData({...authData, bio: e.target.value})}
                          style={{ display: 'block', width: '100%', padding: '14px', marginBottom: '20px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', outline: 'none', resize: 'none' }} />

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="button" onClick={() => setRegisterStep(1)} 
                            style={{ flex: 1, background: 'none', border: '1px solid rgba(255,255,255,0.1)', padding: '14px', borderRadius: '12px', color: '#fff', cursor: 'pointer' }}>
                            ← Geri
                          </button>
                          <button type="submit" className="btn-primary" style={{ flex: 2, padding: '14px', fontSize: '1rem', justifyContent: 'center' }}>
                            Kayıt Ol 🚀
                          </button>
                        </div>
                      </>
                    )}
                  </form>
                )}

                <div style={{ marginTop: '25px', fontSize: '0.9rem' }}>
                  <span style={{ color: '#94a3b8' }}>
                    {loginMode === 'login' ? 'Henüz hesabın yok mu?' : 'Zaten hesabın var mı?'}
                  </span>
                  <button 
                    onClick={() => {
                        setLoginMode(loginMode === 'login' ? 'register' : 'login');
                        setRegisterStep(1);
                        setAuthData({ email: '', password: '', username: '', role: 'user', gender: 'other', age: '', phone: '', bio: '', avatar: '' });
                    }}
                    style={{ background: 'none', border: 'none', color: '#7c3aed', marginLeft: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {loginMode === 'login' ? 'Kayıt Ol' : 'Giriş Yap'}
                  </button>
                </div>

                <button onClick={() => { setShowLogin(false); setRegisterStep(1); }} style={{ background: 'none', border: 'none', color: '#64748b', marginTop: '20px', cursor: 'pointer', fontSize: '0.8rem' }}>Vazgeç</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ✅ E-Posta Doğrulama Modal */}
      <AnimatePresence>
        {showVerification && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(10px)' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ backgroundColor: '#1e293b', padding: '40px', borderRadius: '32px', width: '420px', border: '1px solid #22c55e', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
              <div style={{ fontSize: '4rem', marginBottom: '15px' }}>📧</div>
              <h2 style={{ marginBottom: '10px', fontSize: '1.6rem' }}>E-Posta Doğrulama</h2>
              <p style={{ color: '#94a3b8', marginBottom: '25px', fontSize: '0.9rem' }}>
                <strong>{verificationEmail}</strong> adresine 6 haneli bir doğrulama kodu gönderdik.<br/>
                <span style={{ color: '#fbbf24', fontSize: '0.8rem' }}>(Test: Sunucu konsoluna bakınız)</span>
              </p>
              
              <input 
                type="text" 
                maxLength={6}
                placeholder="000000" 
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                style={{ 
                  display: 'block', width: '200px', margin: '0 auto 20px', padding: '18px', 
                  background: '#0f172a', border: '2px solid #22c55e', borderRadius: '16px', 
                  color: '#fff', outline: 'none', fontSize: '2rem', textAlign: 'center', 
                  letterSpacing: '10px', fontWeight: 'bold'
                }} 
              />
              
              <button onClick={handleVerifyEmail} className="btn-primary" 
                style={{ width: '100%', padding: '14px', fontSize: '1rem', justifyContent: 'center', background: 'linear-gradient(135deg, #22c55e, #059669)' }}>
                ✅ Doğrula
              </button>
              
              <div style={{ marginTop: '20px', fontSize: '0.85rem', color: '#94a3b8' }}>
                Kod gelmedi mi? 
                <button onClick={handleResendCode} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' }}>
                  Tekrar Gönder
                </button>
              </div>

              <button onClick={() => setShowVerification(false)} style={{ background: 'none', border: 'none', color: '#64748b', marginTop: '15px', cursor: 'pointer', fontSize: '0.8rem' }}>
                Şimdilik Geç
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 💳 Wallet Modal */}
      <AnimatePresence>
        {showWallet && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(10px)' }}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              style={{ backgroundColor: '#0f172a', padding: '40px', borderRadius: '32px', width: selectedPkg ? '460px' : '620px', border: '1px solid #db2777', textAlign: 'center', transition: 'width 0.3s' }}>

              {/* Adım 1: Paket Seçimi */}
              {!selectedPkg ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h2 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Sparkles color="#db2777" /> Elmas Satın Al
                    </h2>
                    <button onClick={() => setShowWallet(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                    {diamondPackages.map((pkg) => (
                      <motion.div
                        whileHover={{ scale: 1.03, borderColor: pkg.color }}
                        onClick={() => setSelectedPkg(pkg)}
                        key={pkg.id}
                        style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: '22px', borderRadius: '20px', border: `1px solid ${pkg.color}44`, cursor: 'pointer' }}
                      >
                        <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>{pkg.icon || '💎'}</div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: pkg.color }}>{pkg.label}</div>
                        <div style={{ color: '#fff', fontSize: '1.4rem', fontWeight: '800', margin: '5px 0' }}>{pkg.amount} 💎</div>
                        <div style={{ background: `${pkg.color}22`, border: `1px solid ${pkg.color}55`, borderRadius: '8px', padding: '5px 10px', display: 'inline-block', color: pkg.color, fontWeight: '700' }}>₺{pkg.priceInTL}</div>
                      </motion.div>
                    ))}
                  </div>
                  <p style={{ marginTop: '25px', color: '#475569', fontSize: '0.8rem' }}>Pakete tıklayarak ödeme adımına geçebilirsin.</p>
                </>
              ) : (
                /* Adım 2: Ödeme Formu */
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <button onClick={() => setSelectedPkg(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' }}>← Geri</button>
                    <h2 style={{ fontSize: '1.4rem' }}>Ödeme</h2>
                    <button onClick={() => { setShowWallet(false); setSelectedPkg(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                  </div>

                  {/* Seçili Paket Özeti */}
                  <div style={{ background: `${selectedPkg.color}11`, border: `1px solid ${selectedPkg.color}44`, borderRadius: '16px', padding: '20px', marginBottom: '25px' }}>
                    <div style={{ fontSize: '2rem' }}>{selectedPkg.icon}</div>
                    <div style={{ fontWeight: 'bold', color: selectedPkg.color, fontSize: '1.1rem', marginTop: '6px' }}>{selectedPkg.label} Paketi</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fff', margin: '4px 0' }}>{selectedPkg.amount} 💎</div>
                    <div style={{ color: selectedPkg.color, fontSize: '1.3rem', fontWeight: '700' }}>₺{selectedPkg.priceInTL}</div>
                  </div>

                  {/* Mock Kart Formu */}
                  <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Kart Numarası</label>
                    <input maxLength={19} placeholder="4242 4242 4242 4242" defaultValue="4242 4242 4242 4242"
                      style={{ width: '100%', padding: '12px 14px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none', letterSpacing: '2px', marginBottom: '12px' }} />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Son Kullanma</label>
                        <input placeholder="12/28" defaultValue="12/28" maxLength={5}
                          style={{ width: '100%', padding: '12px 14px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>CVV</label>
                        <input placeholder="123" defaultValue="123" maxLength={3} type="password"
                          style={{ width: '100%', padding: '12px 14px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '10px', padding: '10px 14px', marginBottom: '20px', fontSize: '0.8rem', color: '#fbbf24', textAlign: 'left' }}>
                    ⚠️ Bu form şu an <strong>test modunda</strong>. Gerçek ödeme alınmaz. Gerçek entegrasyon için İyzico/PayTR bağlanacak.
                  </div>

                  <button
                    onClick={handleBuyCredits}
                    disabled={paymentLoading}
                    className="btn-primary"
                    style={{ width: '100%', padding: '14px', fontSize: '1rem', justifyContent: 'center', opacity: paymentLoading ? 0.7 : 1 }}
                  >
                    {paymentLoading ? 'İşleniyor...' : `₺${selectedPkg.priceInTL} Öde → ${selectedPkg.amount} 💎 Kazan`}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚀 Main Content */}
      <main className="hero-section" style={{ flex: 1, padding: view === 'streaming' ? '20px' : '40px 5%' }}>
        {view === 'home' && (
          <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ textAlign: 'center', marginBottom: '80px' }}
            >
              <h1 className="hero-title" style={{ fontSize: '3.5rem', lineHeight: 1.2 }}>
                Samimi İnsanlarla <span className="gradient-text">Tanış</span> <br />
                Murat'ın Yeri'nde Eğlenceyi Yakala
              </h1>
              <p style={{ fontSize: '1.1rem', color: '#94a3b8', marginTop: '20px', maxWidth: '600px', margin: '20px auto' }}>
                Türkiye'nin en samimi video sohbet platformunda binlerce kişi seni bekliyor. 
                Hemen bir odaya katıl veya kendi yayınını başlat!
              </p>
            </motion.div>
            
            <div style={{ padding: '40px 80px 0', display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button className={`glass-pill ${filter === 'all' ? 'active-filter' : ''}`} onClick={() => setFilter('all')} style={{ background: filter === 'all' ? '#db2777' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', cursor: 'pointer', padding: '10px 20px', borderRadius: '50px' }}>🔥 Popüler</button>
                <button className={`glass-pill ${filter === 'female' ? 'active-filter' : ''}`} onClick={() => setFilter('female')} style={{ background: filter === 'female' ? '#db2777' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', cursor: 'pointer', padding: '10px 20px', borderRadius: '50px' }}>Kadınlar</button>
                <button className={`glass-pill ${filter === 'male' ? 'active-filter' : ''}`} onClick={() => setFilter('male')} style={{ background: filter === 'male' ? '#db2777' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', cursor: 'pointer', padding: '10px 20px', borderRadius: '50px' }}>Erkekler</button>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                 <select 
                   value={sort} 
                   onChange={e => setSort(e.target.value)}
                   style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 15px', borderRadius: '10px', outline: 'none' }}>
                   <option value="popular">En Yüksek Seviyeler</option>
                   <option value="rich">En Çok Kazananlar</option>
                 </select>
              </div>
            </div>

            <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px', paddingBottom: '100px' }}>
              {isStreamersLoading && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>
                  Yayıncılar yükleniyor...
                </div>
              )}

              {!isStreamersLoading && streamersError && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#fda4af', padding: '30px 0' }}>
                  {streamersError}
                </div>
              )}

              {!isStreamersLoading && !streamersError && filteredStreamers.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>
                  Filtreye uygun yayıncı bulunamadı.
                </div>
              )}

              {!isStreamersLoading && !streamersError && filteredStreamers.map((s) => (
                <motion.div 
                  whileHover={isAuthenticated ? { y: -10 } : undefined}
                  key={s.id}
                  style={{ 
                    position: 'relative',
                    aspectRatio: '3/4',
                    background: `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(15, 23, 42, 0.95)), url(${s.avatar})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: '32px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                    cursor: isAuthenticated ? 'pointer' : 'default'
                  }}
                  onClick={() => {
                    if (!isAuthenticated) {
                      setShowLogin(true);
                      return;
                    }
                    setActiveStreamer(s);
                    setView('streaming');
                  }}
                >
                  <div style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', gap: '6px' }}>
                    {s.isLive && <div style={{ background: '#ef4444', color: '#fff', padding: '4px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '900', boxShadow: '0 0 10px rgba(239,68,68,0.5)', animation: 'pulse 2s infinite' }}>CANLI</div>}
                    {!s.isLive && s.isOnline && <div style={{ background: '#22c55e', color: '#fff', padding: '4px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '900' }}>ONLINE</div>}
                    {!s.isLive && !s.isOnline && <div style={{ background: '#64748b', color: '#fff', padding: '4px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '900' }}>OFFLINE</div>}
                  </div>

                  {!isAuthenticated && (
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(2,6,23,0.2), rgba(2,6,23,0.78))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                      <div style={{ textAlign: 'center', background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '16px', padding: '12px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                          <Lock size={18} color="#f8fafc" />
                        </div>
                        <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 600 }}>Yayın ve etkileşim için giriş yap</div>
                      </div>
                    </div>
                  )}

                  <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px' }}>
                    <h3 style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {s.username} 
                      {s.vipStatus && <span style={{ fontSize: '0.8rem', background: 'gold', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>VIP</span>}
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                      <div style={{ color: '#e2e8f0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Heart size={14} color="#db2777" fill="#db2777" /> {s.followerCount || 0} takipçi
                      </div>
                      <div style={{ background: 'rgba(219, 39, 119, 0.8)', padding: '5px 12px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                        {s.perMinuteRate || 50} 💎/dk
                      </div>
                    </div>
                    {isAuthenticated ? (
                      <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                        <button 
                           onClick={(e) => { e.stopPropagation(); api.followUser(s.id).then(r=>alert(r.message)); }}
                           style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', padding: '8px', borderRadius: '10px', color: '#fff', cursor: 'pointer' }}>Takip Et</button>
                        <button 
                           onClick={(e) => {
                              e.stopPropagation();
                              if (!isAuthenticated) { setShowLogin(true); return; }
                              if (credits < (s.perMinuteRate || 50)) return alert("Bakiyen yetersiz! Elmas yükle.");
                              socket.emit('invite_call', { callerId: currentUser.id, callerName: currentUser.username, receiverId: s.id });
                              setCallingUser({ id: s.id, name: s.username });
                           }}
                           style={{ flex: 1, background: '#7c3aed', border: 'none', padding: '8px', borderRadius: '10px', color: '#fff', cursor: 'pointer' }}>Özel Çağrı</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: '15px', background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(255,255,255,0.15)', padding: '8px 12px', borderRadius: '10px', fontSize: '0.85rem', color: '#cbd5e1', textAlign: 'center' }}>
                        Etkileşim ve yayına katılım için giriş yap
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {view === 'studio' && (
          <BroadcasterStudio currentUser={currentUser} onStartStream={() => setView('streaming')} onStopStream={async () => { await api.stopStream(); setView('home'); }} />
        )}

        {view === 'admin' && (
          <AdminPanel />
        )}

        {view === 'streaming' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ 
              display: 'flex', 
              gap: '24px', 
              width: '100%', 
              maxWidth: '1440px', 
              height: '700px',
              margin: '0 auto',
              alignItems: 'stretch',
              flexDirection: 'column'
            }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <button onClick={() => setView('home')} className="glass-pill" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                ← Geri Dön
              </button>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {viewerCount > 0 && <span className="glass-pill" style={{ color: '#06b6d4', fontSize: '0.85rem' }}>👁️ {viewerCount} izleyici</span>}
                {onlineCount > 0 && <span className="glass-pill" style={{ color: '#22c55e', fontSize: '0.85rem' }}>🐟 {onlineCount} çevrimici</span>}
              </div>
              
              {activeStreamer && (
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {activeStreamer.username} 
                      {activeStreamer.vipStatus && <span style={{ fontSize: '0.8rem', background: 'gold', color: '#000', padding: '2px 6px', borderRadius: '4px' }}>VIP</span>}
                    </h2>
                    
                    <button 
                      onClick={async () => {
                          const res = await api.followUser(activeStreamer.id);
                          alert(res.message);
                      }}
                      className="glass-pill" style={{ color: '#db2777', border: '1px solid #db2777', cursor: 'pointer' }}>
                      ❤️ Takip Et
                    </button>
                    
                    <button 
                      onClick={async () => {
                          const content = prompt(`${activeStreamer.username} kişisine mesaj gönder (Ücret: ${activeStreamer.messageRate || 10}💎):`);
                          if(content) {
                             const res = await api.sendMessage(activeStreamer.id, content);
                             if(res.success) {
                                alert("Mesajınız iletildi!");
                                setCredits(res.remainingCredits);
                             } else {
                                alert(res.message);
                             }
                          }
                      }}
                      className="glass-pill" style={{ color: '#0ea5e9', border: '1px solid #0ea5e9', cursor: 'pointer' }}>
                      ✉️ Mesaj ({activeStreamer.messageRate || 10}💎)
                    </button>
                    
                    <button 
                      onClick={() => {
                          if (credits < (activeStreamer.perMinuteRate || 50)) return alert("Bakiyen yetersiz! Elmas yükle.");
                          socket.emit('invite_call', { callerId: currentUser.id, callerName: currentUser.username, receiverId: activeStreamer.id });
                          setCallingUser({ id: activeStreamer.id, name: activeStreamer.username });
                      }}
                      className="btn-primary" style={{ padding: '8px 15px', borderRadius: '10px', display: 'flex', gap: '8px', alignItems: 'center', boxShadow: '0 0 15px rgba(219,39,119,0.5)' }}>
                      📞 Özel Ara ({activeStreamer.perMinuteRate || 50}💎/dk)
                    </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '24px', flex: 1, height: '600px' }}>
              <div style={{ flex: 1, height: '100%', overflow: 'hidden', borderRadius: '32px', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                <VideoRoom 
                  channelName={getDynamicChannel()}
                  role={activeStreamer ? "subscriber" : "publisher"} 
                  onLeave={() => setView('home')}
                />
              </div>
              
              <div style={{ width: '380px', height: '100%' }}>
                  <ChatBox 
                    socket={socket} 
                    streamId={getDynamicChannel()} 
                    username={currentUser?.username || 'Misafir'}
                    credits={credits}
                    setCredits={setCredits}
                    activeStreamer={activeStreamer || currentUser}
                    senderId={currentUser?.id}
                    receiverId={activeStreamer?.id}
                  />
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default App;
