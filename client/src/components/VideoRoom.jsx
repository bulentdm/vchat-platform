import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

const VideoRoom = ({ channelName, token, appId, role = 'publisher', onLeave }) => {
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoHidden, setIsVideoHidden] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const clientRef = useRef(null);
  const tracksRef = useRef({ audio: null, video: null });
  const localPlayerRef = useRef(null);

  useEffect(() => {
    let isSubscribed = true;
    // 🔗 Agora Client Başlat
    clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    const handleUserPublished = async (user, mediaType) => {
      await clientRef.current.subscribe(user, mediaType);
      if (mediaType === 'video') {
        setRemoteUsers((prev) => [...prev, user]);
      }
      if (mediaType === 'audio') {
        user.audioTrack.play();
      }
    };

    const handleUserUnpublished = (user) => {
      setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
    };

    clientRef.current.on("user-published", handleUserPublished);
    clientRef.current.on("user-unpublished", handleUserUnpublished);

    // 🔄 Token Yenileme Mantığı
    const fetchNewToken = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
        const response = await fetch(`${apiBase}/api/stream/get-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelName, role })
        });
        return await response.json();
      } catch (err) {
        console.error("Token fetch error:", err);
        return null;
      }
    };

    const handleTokenWillExpire = async () => {
      console.log("🎟️ Token süresi doluyor, yenileniyor...");
      const data = await fetchNewToken();
      if (data && data.token) {
        await clientRef.current.renewToken(data.token);
        console.log("✅ Token başarıyla yenilendi.");
      }
    };

    clientRef.current.on("token-privilege-will-expire", handleTokenWillExpire);

    const init = async () => {
      if (!clientRef.current) return;
      setLoading(true);

      const data = await fetchNewToken();
      if (!data) return;
      
      const currentToken = data.token;
      const currentAppId = data.appId;

      // 🎥 Önce Yerel Kamerayı Hazırla (Siyah Ekranı Bitir)
      let audioTrack, videoTrack;
      try {
        if (role === 'publisher') {
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          videoTrack = await AgoraRTC.createCameraVideoTrack();
          
          tracksRef.current = { audio: audioTrack, video: videoTrack };
          
          setLocalAudioTrack(audioTrack);
          setLocalVideoTrack(videoTrack);
          
          if (localPlayerRef.current && isSubscribed) {
            videoTrack.play(localPlayerRef.current);
          }
        }
      } catch (err) {
        console.error("Kamera Hazırlama Hatası:", err);
      }

      try {
        await clientRef.current.join(currentAppId, channelName, currentToken, null);
        if (role === 'publisher' && audioTrack && videoTrack) {
          await clientRef.current.publish([audioTrack, videoTrack]);
        }
        if (isSubscribed) {
          setJoined(true);
          setLoading(false);
        }
      } catch (error) {
        console.error("Agora Bağlantı Hatası:", error);
        if (isSubscribed) {
          setJoined(true);
          setLoading(false);
        }
      }
    };

    init();

    // 🚪 Temizlik
    return () => {
      isSubscribed = false;
      const { audio, video } = tracksRef.current;
      audio?.close();
      video?.close();
      if (clientRef.current) {
        clientRef.current.leave();
        clientRef.current = null;
      }
    };
  }, [appId, token, channelName]);

  const toggleMic = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(isMuted);
    }
    setIsMuted(!isMuted);
  };

  const toggleVideo = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(isVideoHidden);
    }
    setIsVideoHidden(!isVideoHidden);
  };

  const endCall = () => {
    if (onLeave) {
      onLeave();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '24px', overflow: 'hidden', backgroundColor: '#000' }}>
      {/* 📹 Video Oynatıcı Alanı */}
      <div 
        ref={localPlayerRef} 
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      >
        {isVideoHidden && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff' }}>
            <VideoOff size={64} />
          </div>
        )}
      </div>

      {/* 👥 Uzak Kullanıcılar (Küçük Resimler) */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {remoteUsers.map((user) => (
          <div 
            key={user.uid} 
            id={`remote-user-${user.uid}`}
            ref={(el) => el && user.videoTrack?.play(el)}
            style={{ 
              width: '120px', 
              height: '160px', 
              backgroundColor: '#1e293b', 
              borderRadius: '12px', 
              border: '2px solid rgba(255,255,255,0.1)',
              overflow: 'hidden' 
            }} 
          />
        ))}
      </div>

      {/* 🛠️ Kontrol Paneli (Floating Glass Panel) */}
      <div style={{ 
        position: 'absolute', 
        bottom: '30px', 
        left: '50%', 
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '15px',
        padding: '15px 25px',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <button onClick={toggleMic} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          {isMuted ? <MicOff color="#db2777" /> : <Mic />}
        </button>
        
        <button onClick={toggleVideo} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          {isVideoHidden ? <VideoOff color="#db2777" /> : <Video />}
        </button>

        <button onClick={endCall} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}>
          <PhoneOff size={20} />
        </button>
      </div>

      {/* 🔴 Canlı Rozeti */}
      {joined && (
        <div style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', gap: '8px' }}>
          <div style={{ background: '#ef4444', color: '#fff', padding: '4px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '800' }}>
            CANLI
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoRoom;
