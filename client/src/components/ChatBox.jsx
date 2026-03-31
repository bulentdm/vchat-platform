import React, { useState, useEffect, useRef } from 'react';
import { Send, Gift, Heart, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';

const ChatBox = ({ socket, streamId, username, credits, setCredits, activeStreamer, senderId, receiverId }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [showGifts, setShowGifts] = useState(false);
  const chatEndRef = useRef(null);

  const [giftAnimation, setGiftAnimation] = useState(null);

  useEffect(() => {
    if (!socket) return;

    // 📩 Mesajları Dinle
    socket.on('receive_message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    // 🎁 Hediye Animasyonunu Dinle
    socket.on('gift_event', (data) => {
      setGiftAnimation(data);
      setTimeout(() => setGiftAnimation(null), 4000); // 4 saniye sonra kaybolsun
    });

    // 🚪 Yeni Kullanıcı Bildirimi
    socket.on('user_joined', (data) => {
      setMessages((prev) => [...prev, { sender: 'Sistem', content: data.message, system: true }]);
    });

    return () => {
      socket.off('receive_message');
      socket.off('gift_event');
      socket.off('user_joined');
    };
  }, [socket]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const messageData = {
      streamId,
      sender: username,
      content: inputValue,
      type: 'text'
    };

    socket.emit('send_message', messageData);
    setInputValue("");
  };

  const sendGift = async (giftType, value, icon) => {
    if (credits < value) {
      alert("❌ Bakiyen yetersiz! Pırlanta yüklemelisin.");
      return;
    }

    // 💳 Backend'de kredisini düşür
    const res = await api.sendGift(value, activeStreamer?.id);
    
    if (res.success) {
      const giftData = {
        streamId,
        sender: username,
        senderId: senderId || null,
        receiverId: receiverId || activeStreamer?.id || null,
        content: `${giftType} gönderdi! ${icon}`,
        type: 'gift',
        giftValue: value,
        giftIcon: icon
      };
      
      socket.emit('send_message', giftData);
      setCredits(res.remainingCredits); // 💎 Bakiyeden düş
      setShowGifts(false);
    } else {
      alert(res.message || "Hediye gönderilirken bir hata oluştu.");
    }
  };

  const gifts = [
    { name: 'Gül', icon: '🌹', value: 1 },
    { name: 'Kalp', icon: '❤️', value: 10 },
    { name: 'Pırlanta', icon: '💎', value: 50 },
    { name: 'Araba', icon: '🚗', value: 1000 },
    { name: 'Uçak', icon: '✈️', value: 3000 },
    { name: 'Şato', icon: '🏰', value: 10000 },
  ];

  return (
    <div className="chat-box" style={{ 
      width: '350px', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(15px)',
      borderRadius: '24px',
      border: '1px solid rgba(255,255,255,0.1)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <div style={{ padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 'bold', display: 'flex', gap: '8px' }}>
        <Sparkles size={18} color="#7c3aed" /> Canlı Sohbet
      </div>

      {/* 📩 Mesaj Listesi */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '15px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '10px',
        scrollbarWidth: 'thin',
        scrollbarColor: '#7c3aed transparent'
      }}>
        {messages.map((msg, idx) => (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            key={idx} 
            style={{ 
              backgroundColor: msg.type === 'gift' ? 'rgba(219, 39, 119, 0.1)' : 'rgba(255,255,255,0.05)', 
              padding: '8px 12px', 
              borderRadius: '12px',
              borderLeft: msg.type === 'gift' ? '4px solid #db2777' : 'none',
              fontSize: '0.9rem',
              textAlign: msg.system ? 'center' : 'left' // Keep system messages centered
            }}
          >
            {msg.system ? (
              <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>{msg.content}</span>
            ) : (
              <div>
                <b style={{ color: msg.type === 'gift' ? '#db2777' : '#7c3aed' }}>{msg.sender}:</b> 
                <span style={{ marginLeft: '5px' }}>{msg.content}</span>
              </div>
            )}
          </motion.div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* 🎁 Hediye Menüsü (Popup) */}
      <AnimatePresence>
        {showGifts && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            style={{ 
              position: 'absolute', bottom: '70px', left: '10px', right: '10px',
              backgroundColor: '#1e293b', padding: '15px', borderRadius: '15px',
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px',
              border: '1px solid #7c3aed'
            }}
          >
                      {gifts.map((g) => (
                      <motion.div 
                        whileHover={{ scale: 1.1 }}
                        key={g.name}
                        onClick={() => sendGift(g.name, g.value, g.icon)}
                        style={{ cursor: 'pointer', padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        <div style={{ fontSize: '1.5rem' }}>{g.icon}</div>
                        <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{g.value} 💎</div>
                      </motion.div>
                    ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⌨️ Input Alanı */}
      <form onSubmit={sendMessage} style={{ padding: '15px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px' }}>
        <button type="button" onClick={() => setShowGifts(!showGifts)} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer' }}>
          <Gift />
        </button>
        <input 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Samimi bir şeyler yaz..."
          style={{ 
            flex: 1, 
            background: 'rgba(255,255,255,0.05)', 
            border: 'none', 
            borderRadius: '10px', 
            padding: '8px 12px', 
            color: '#fff',
            outline: 'none'
          }}
        />
        <button type="submit" style={{ background: 'none', border: 'none', color: '#db2777', cursor: 'pointer' }}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default ChatBox;
