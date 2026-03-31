import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserCheck, UserX, Clock, RefreshCcw, Users, Wallet, Ban, PlayCircle, BarChart3, Package, TrendingUp, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('stats'); // stats, pending, users, broadcasters, packages
  const [pending, setPending] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [financeStats, setFinanceStats] = useState(null);
  const [packages, setPackages] = useState([]);
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingData, usersData, stats, pkgs, payoutData] = await Promise.all([
        api.getPendingBroadcasters(),
        api.getAllUsers(),
        api.getAdminFinanceStats(),
        api.getAdminPackages(),
        api.getPendingBroadcasterPayouts(),
      ]);
      if (Array.isArray(pendingData)) setPending(pendingData);
      if (Array.isArray(usersData)) setAllUsers(usersData);
      if (stats && !stats.message) setFinanceStats(stats);
      if (Array.isArray(pkgs)) setPackages(pkgs);
      if (Array.isArray(payoutData)) setPendingPayouts(payoutData);
    } catch (err) {
      console.error('Admin veri yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (id) => {
    const res = await api.approveBroadcaster(id);
    if (res.success) {
      alert(res.message);
      fetchData();
    }
  };

  const handleReject = async (id) => {
    if (window.confirm("Bu başvuruyu reddetmek istediğinize emin misiniz?")) {
        const res = await api.rejectBroadcaster(id);
        if (res.success) {
          alert(res.message);
          fetchData();
        }
    }
  };

  const handleToggleBan = async (id) => {
    const res = await api.toggleBanUser(id);
    if (res.success) {
      alert(res.message);
      fetchData();
    } else {
        alert(res.message || "Hata!");
    }
  };

  const handlePay = async (id, amount) => {
    if (window.confirm(`Yayıncıya ${amount} değerinde ödemeyi onaylıyor musunuz (IBAN'a gönderildi mi)?`)) {
      const res = await api.payBroadcaster(id);
      if (res.success) {
        alert(res.message);
        fetchData();
      } else {
        alert(res.message || "Ödeme sırasında hata!");
      }
    }
  };

  const handleSetCommission = async (id, rate) => {
    const res = await api.setBroadcasterCommission(id, rate);
    if (res.success) {
      alert(res.message);
      fetchData();
    } else {
      alert(res.message || 'Hata!');
    }
  };

  const filteredUsers = allUsers.filter(u => u.role === 'user');
  const filteredBroadcasters = allUsers.filter(u => u.role === 'broadcaster' && u.isApproved);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '15px', margin: 0 }}>
          <ShieldCheck size={40} color="#7c3aed" /> Admin Kontrol Paneli
        </h1>
        <button 
          onClick={fetchData}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '12px', color: '#fff', cursor: 'pointer' }}>
          <RefreshCcw size={16} /> Yenile
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
        <button 
          onClick={() => setActiveTab('stats')}
          style={{ background: activeTab === 'stats' ? '#7c3aed' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <BarChart3 size={18} /> Raporlar
        </button>
        <button 
          onClick={() => setActiveTab('pending')}
          style={{ background: activeTab === 'pending' ? '#7c3aed' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Clock size={18} /> Başvurular ({pending.length})
        </button>
        <button 
          onClick={() => setActiveTab('payouts')}
          style={{ background: activeTab === 'payouts' ? '#f59e0b' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', position: 'relative' }}>
          <CreditCard size={18} /> Ödeme Talepleri
          {pendingPayouts.length > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>{pendingPayouts.length}</span>}
        </button>
        <button 
          onClick={() => setActiveTab('broadcasters')}
          style={{ background: activeTab === 'broadcasters' ? '#db2777' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <PlayCircle size={18} /> Yayıncılar & Ödemeler ({filteredBroadcasters.length})
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          style={{ background: activeTab === 'users' ? '#3b82f6' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Users size={18} /> İzleyiciler ({filteredUsers.length})
        </button>
        <button 
          onClick={() => setActiveTab('packages')}
          style={{ background: activeTab === 'packages' ? '#f59e0b' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Package size={18} /> Paket Ayarları
        </button>
      </div>

      <div style={{ background: '#1e293b', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Yükleniyor...</div>
        ) : (
          <div style={{ padding: '20px' }}>
            <AnimatePresence mode="wait">
              {/* 📊 STATS TAB */}
              {activeTab === 'stats' && financeStats && (
                <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: '25px', borderRadius: '20px', border: '1px solid rgba(124, 58, 237, 0.3)' }}>
                      <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '10px' }}>Toplam Satış Cirosu</div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>₺{financeStats.totalRevenue}</div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '8px' }}>1 💎 = ₺{financeStats.diamondToTLRate} ödeme kuru</div>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: '25px', borderRadius: '20px', border: '1px solid rgba(219, 39, 119, 0.3)' }}>
                      <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '10px' }}>Sistemdeki Elmas</div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#db2777' }}>💎 {financeStats.totalCreditsInSystem?.toLocaleString()}</div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '8px' }}>Bekleyen yayıncı ödemesi: ₺{financeStats.pendingPayoutTL}</div>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: '25px', borderRadius: '20px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '10px' }}>Aktif Yayınlar</div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>{financeStats.activeStreams}</div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '8px' }}>Toplam ödenen: ₺{financeStats.totalPaidOutTL}</div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* � ÖDEME TALEPLERI TAB */}
              {activeTab === 'payouts' && (
                <motion.div key="payouts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {pendingPayouts.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                      <CreditCard size={48} style={{ marginBottom: '15px', opacity: 0.4 }} />
                      <div>Bekleyen ödeme talebi bulunmuyor.</div>
                    </div>
                  ) : pendingPayouts.map((tx) => (
                    <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '16px', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: '1 1 200px' }}>
                        <img src={tx.user?.avatar} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{tx.user?.username}</div>
                          <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginTop: '3px' }}>
                            IBAN: <span style={{ fontFamily: 'monospace' }}>{tx.user?.iban || 'Belirtilmemiş'}</span>
                            <button onClick={() => navigator.clipboard.writeText(tx.user?.iban || '')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', marginLeft: '6px', fontSize: '0.75rem' }}>Köpya</button>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{new Date(tx.createdAt).toLocaleString('tr-TR')}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f59e0b' }}>₺{Number(tx.priceInTL).toFixed(2)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>💎 {Number(tx.amount).toLocaleString()} elmas</div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={async () => {
                            if (window.confirm(`${tx.user?.username} adlı yayıncıya ₺${Number(tx.priceInTL).toFixed(2)} ödensin mi? IBAN'a gönderildiğini onaylıyor musunuz?`)) {
                              const res = await api.payBroadcaster(tx.userId);
                              alert(res.message);
                              if (res.success) fetchData();
                            }
                          }}
                          style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Wallet size={16} /> Ödeyi Onayla
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm('Bu ödeme talebi reddedilsin mi? Yayıncının bakiyesi korunacak.')) {
                              const res = await api.rejectPayout(tx.id);
                              alert(res.message);
                              if (res.success) fetchData();
                            }
                          }}
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <UserX size={16} /> Reddet
                        </button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* �📦 PACKAGES TAB */}
              {activeTab === 'packages' && (
                <motion.div key="packages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                    {packages.map((pkg) => (
                      <div key={pkg.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: `1px solid ${pkg.color}44` }}>
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>💎</div>
                        <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Elmas Miktarı</label>
                        <input 
                          type="number" 
                          defaultValue={pkg.amount} 
                          style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', color: '#fff', marginBottom: '10px' }} 
                          onBlur={(e) => api.updatePackage(pkg.id, { amount: e.target.value })}
                        />
                        <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Fiyat (₺)</label>
                        <input 
                          type="text" 
                          defaultValue={pkg.price} 
                          style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', color: '#fff' }} 
                          onBlur={(e) => api.updatePackage(pkg.id, { price: e.target.value })}
                        />
                        <button 
                          onClick={() => alert('Fiyat güncellendi!')}
                          style={{ width: '100%', marginTop: '15px', background: pkg.color, color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                          Kaydet
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* PENDING TAB */}
              {activeTab === 'pending' && (
                <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {pending.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Şu an onay bekleyen başvuru bulunmuyor.</div>
                  ) : pending.map((user) => (
                    <div key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', marginBottom: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <img src={user.avatar} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{user.username}</div>
                          <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>{user.email}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleApprove(user.id)} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <UserCheck size={18} /> Onayla
                        </button>
                        <button onClick={() => handleReject(user.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <UserX size={18} /> Reddet
                        </button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* BROADCASTERS TAB */}
              {activeTab === 'broadcasters' && (
                <motion.div key="broadcasters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {filteredBroadcasters.map((user) => {
                    const RATE = financeStats?.diamondToTLRate || 0.50;
                    const pendingTL = (Number(user.credits) * RATE).toFixed(2);
                    return (
                    <div key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', marginBottom: '15px', border: user.isBanned ? '1px solid #ef4444' : 'none', flexWrap: 'wrap', gap: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: '1 1 220px' }}>
                        <img src={user.avatar} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', opacity: user.isBanned ? 0.5 : 1 }} alt="" />
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {user.username} {user.isBanned && <span style={{ color: '#ef4444', fontSize: '0.8rem', background: 'rgba(239,68,68,0.2)', padding: '2px 8px', borderRadius: '4px' }}>YASAKLI</span>}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{user.email}</div>
                          <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginTop: '3px' }}>IBAN: {user.iban || 'Belirtilmemiş'}</div>
                        </div>
                      </div>
                      
                      {/* Finansal Bilgiler */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#db2777' }}>💎 {Number(user.credits).toLocaleString()}</div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Biriken Elmas</div>
                          <div style={{ fontSize: '0.85rem', color: '#22c55e', fontWeight: 'bold' }}>≈ ₺{pendingTL}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#a78bfa' }}>₺{Number(user.totalEarned || 0).toFixed(2)}</div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Toplam Ödenen</div>
                        </div>

                        {/* Komisyon Oranı */}
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '5px' }}>Komisyon Oranı (%)</div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                              type="number"
                              min="0" max="100"
                              defaultValue={user.commissionRate || 80}
                              id={`commission-${user.id}`}
                              style={{ width: '64px', background: '#0f172a', border: '1px solid #7c3aed', borderRadius: '8px', padding: '6px', color: '#fff', textAlign: 'center' }}
                            />
                            <button
                              onClick={() => {
                                const val = document.getElementById(`commission-${user.id}`)?.value;
                                handleSetCommission(user.id, parseInt(val));
                              }}
                              style={{ background: '#7c3aed', border: 'none', borderRadius: '8px', color: '#fff', padding: '6px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>
                              Kaydet
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                           <button 
                             onClick={() => handlePay(user.id, pendingTL)}
                             disabled={user.credits <= 0 || !user.iban}
                             style={{ background: (user.credits <= 0 || !user.iban) ? '#334155' : '#10b981', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: (user.credits <= 0 || !user.iban) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                             <Wallet size={16} /> ₺{pendingTL} Öde
                           </button>
                           <button 
                             onClick={() => handleToggleBan(user.id)}
                             style={{ background: user.isBanned ? '#22c55e' : 'rgba(239, 68, 68, 0.1)', color: user.isBanned ? '#fff' : '#ef4444', border: user.isBanned ? 'none' : '1px solid #ef4444', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <Ban size={16} /> {user.isBanned ? 'Engeli Kaldır' : 'Engelle'}
                           </button>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </motion.div>
              )}

              {/* USERS TAB */}
              {activeTab === 'users' && (
                <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {filteredUsers.map((user) => (
                    <div key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: user.isBanned ? '1px solid #ef4444' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <img src={user.avatar} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{user.username}</div>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>💎 {user.credits} Bakiye</div>
                        </div>
                      </div>
                      <button 
                         onClick={() => handleToggleBan(user.id)}
                         style={{ background: user.isBanned ? '#22c55e' : 'transparent', color: user.isBanned ? '#fff' : '#ef4444', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                         title={user.isBanned ? "Engeli Kaldır" : "Engelle"}>
                         <Ban size={20} />
                      </button>
                    </div>
                  ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
