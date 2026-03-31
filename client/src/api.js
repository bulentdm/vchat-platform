const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
const API_URL = `${API_BASE_URL}/api`;

const getHeaders = () => {
    const token = localStorage.getItem('vchat_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

export const api = {
    // 🔐 Auth
    login: async (identifier, password) => {
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, email: identifier, password })
            });
            return res.json();
        } catch (e) {
            return { message: "Sunucu bağlantı hatası" };
        }
    },
    register: async (userData) => {
        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            return res.json();
        } catch (e) {
            return { message: "Sunucu bağlantı hatası" };
        }
    },
    verifyEmail: async (email, code) => {
        try {
            const res = await fetch(`${API_URL}/auth/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });
            return res.json();
        } catch (e) {
            return { message: "Sunucu bağlantı hatası" };
        }
    },
    resendCode: async (email) => {
        try {
            const res = await fetch(`${API_URL}/auth/resend-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            return res.json();
        } catch (e) {
            return { message: "Sunucu bağlantı hatası" };
        }
    },
    forgotPassword: async (email) => {
        try {
            const res = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            return res.json();
        } catch (e) {
            return { message: "Sunucu bağlantı hatası" };
        }
    },
    resetPassword: async (email, code, newPassword) => {
        try {
            const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, newPassword })
            });
            return res.json();
        } catch (e) {
            return { message: "Sunucu bağlantı hatası" };
        }
    },

    // 👤 User
    getMe: async () => {
        const res = await fetch(`${API_URL}/user/me`, {
            headers: getHeaders()
        });
        return res.json();
    },
    updateProfile: async (data) => {
        const res = await fetch(`${API_URL}/user/update-profile`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },
    followUser: async (followingId) => {
        try {
            const res = await fetch(`${API_URL}/user/follow`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ followingId })
            });
            return await res.json();
        } catch (e) {
            console.error(e);
            return { success: false, message: e.message };
        }
    },
    sendMessage: async (receiverId, content) => {
        try {
            const res = await fetch(`${API_URL}/user/send-message`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ receiverId, content })
            });
            return await res.json();
        } catch (e) {
            console.error(e);
            return { success: false, message: e.message };
        }
    },
    getMessages: async () => {
        try {
            const res = await fetch(`${API_URL}/user/messages`, { headers: getHeaders() });
            return await res.json();
        } catch (e) {
            console.error(e);
            return [];
        }
    },
    addCredits: async (amount) => {
        const res = await fetch(`${API_URL}/user/add-credits`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ amount })
        });
        return res.json();
    },
    sendGift: async (amount, receiverId) => {
        const res = await fetch(`${API_URL}/user/send-gift`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ amount, receiverId })
        });
        return res.json();
    },

    // 📺 Stream
    getStreamers: async () => {
        const res = await fetch(`${API_URL}/stream/streamers`);
        return res.json();
    },
    getToken: async (channelName, role) => {
        const res = await fetch(`${API_URL}/stream/get-token`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ channelName, role })
        });
        return res.json();
    },
    startStream: async (streamData) => {
        const res = await fetch(`${API_URL}/stream/start-stream`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(streamData)
        });
        return res.json();
    },
    stopStream: async () => {
        const res = await fetch(`${API_URL}/stream/stop-stream`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },
    getMyStats: async () => {
        try {
            const res = await fetch(`${API_URL}/stream/my-stats`, { headers: getHeaders() });
            return await res.json();
        } catch { return null; }
    },

    // 📬 Unread + Profile
    getUnreadCount: async () => {
        try {
            const res = await fetch(`${API_URL}/user/unread-count`, { headers: getHeaders() });
            return await res.json();
        } catch { return { count: 0 }; }
    },
    getUserProfile: async (id) => {
        try {
            const res = await fetch(`${API_URL}/user/profile/${id}`, { headers: getHeaders() });
            return await res.json();
        } catch { return null; }
    },

    // 🛡️ Admin
    getPendingBroadcasters: async () => {
        const res = await fetch(`${API_URL}/admin/pending-broadcasters`, {
            headers: getHeaders()
        });
        return res.json();
    },
    getAllUsers: async () => {
        const res = await fetch(`${API_URL}/admin/users`, {
            headers: getHeaders()
        });
        return res.json();
    },
    toggleBanUser: async (id) => {
        const res = await fetch(`${API_URL}/admin/ban/${id}`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },
    payBroadcaster: async (id) => {
        const res = await fetch(`${API_URL}/admin/pay/${id}`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },
    approveBroadcaster: async (id) => {
        const res = await fetch(`${API_URL}/admin/approve-broadcaster/${id}`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },
    rejectBroadcaster: async (id) => {
        const res = await fetch(`${API_URL}/admin/reject-broadcaster/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return res.json();
    },
    getAdminFinanceStats: async () => {
        const res = await fetch(`${API_URL}/admin/stats/finance`, {
            headers: getHeaders()
        });
        return res.json();
    },
    getAdminPackages: async () => {
        const res = await fetch(`${API_URL}/admin/packages`, {
            headers: getHeaders()
        });
        return res.json();
    },
    updateAdminPackage: async (id, data) => {
        const res = await fetch(`${API_URL}/admin/packages/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },
    setBroadcasterCommission: async (id, commissionRate) => {
        const res = await fetch(`${API_URL}/admin/broadcaster-commission/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ commissionRate })
        });
        return res.json();
    },
    getPendingBroadcasterPayouts: async () => {
        const res = await fetch(`${API_URL}/admin/pending-payouts`, {
            headers: getHeaders()
        });
        return res.json();
    },
    rejectPayout: async (txId) => {
        const res = await fetch(`${API_URL}/admin/reject-payout/${txId}`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },
    updatePackage: async (id, data) => {
        const res = await fetch(`${API_URL}/admin/packages/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    }
};

// 💳 Payment (ayrı export — api nesnesi dışında, doğrudan kullanım için)
export const paymentApi = {
    getPackages: async () => {
        const res = await fetch(`${API_URL}/payment/packages`);
        return res.json();
    },
    purchasePackage: async (packageId) => {
        const token = localStorage.getItem('vchat_token');
        const res = await fetch(`${API_URL}/payment/purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ packageId })
        });
        return res.json();
    },
    getHistory: async () => {
        const token = localStorage.getItem('vchat_token');
        const res = await fetch(`${API_URL}/payment/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return res.json();
    },
    requestPayout: async () => {
        const token = localStorage.getItem('vchat_token');
        const res = await fetch(`${API_URL}/payment/request-payout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        return res.json();
    },
    getMyPayouts: async () => {
        const token = localStorage.getItem('vchat_token');
        const res = await fetch(`${API_URL}/payment/my-payouts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return res.json();
    }
};
