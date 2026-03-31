const sequelize = require('./config/db');
const User = require('./models/User');

const seedUsers = async () => {
    try {
        // Tüm modellerin tablolarını oluştur (silme yapmadan)
        await sequelize.sync();

        const existingUserCount = await User.count();
        if (existingUserCount > 0) {
            console.log(`ℹ️ Seed atlandı: veritabanında zaten ${existingUserCount} kullanıcı var.`);
            process.exit();
        }

        console.log('✅ Veritabanı hazır, örnek kullanıcılar ekleniyor.');

        const users = [
            {
                username: 'Aleyna_K',
                email: 'aleyna@vchat.com',
                password: 'test1',
                avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
                credits: 5200,
                isLive: true,
                isOnline: true,
                role: 'broadcaster',
                isApproved: true,
                gender: 'female',
                level: 5,
                vipStatus: true,
                perMinuteRate: 60,
                messageRate: 15
            },
            {
                username: 'Ceren_Live',
                email: 'ceren@vchat.com',
                password: 'test1',
                avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
                credits: 2100,
                isLive: true,
                isOnline: true,
                role: 'broadcaster',
                isApproved: true,
                gender: 'female',
                level: 3,
                vipStatus: false,
                perMinuteRate: 40,
                messageRate: 10
            },
            {
                username: 'Sena_Gmz',
                email: 'sena@vchat.com',
                password: 'test1',
                avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
                credits: 3500,
                isLive: false,
                isOnline: true,
                role: 'broadcaster',
                isApproved: true,
                gender: 'female',
                level: 4,
                vipStatus: false,
                perMinuteRate: 50,
                messageRate: 10
            },
            {
                username: 'Buse_Ceylan',
                email: 'buse@vchat.com',
                password: 'test1',
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
                credits: 15400,
                isLive: true,
                isOnline: true,
                role: 'broadcaster',
                isApproved: true,
                gender: 'female',
                level: 8,
                vipStatus: true,
                perMinuteRate: 100,
                messageRate: 25
            },
            {
                username: 'Gizem_Su',
                email: 'gizem@vchat.com',
                password: 'test1',
                avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop',
                credits: 890,
                isLive: false,
                isOnline: false,
                role: 'broadcaster',
                isApproved: true,
                gender: 'female',
                level: 2,
                vipStatus: false,
                perMinuteRate: 30,
                messageRate: 5
            },
            {
                username: 'Merve_Nur',
                email: 'merve@vchat.com',
                password: 'test1',
                avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop',
                credits: 4300,
                isLive: true,
                isOnline: true,
                role: 'broadcaster',
                isApproved: true,
                gender: 'female',
                level: 6,
                vipStatus: true,
                perMinuteRate: 70,
                messageRate: 15
            },
            {
                username: 'Aylin_Yildiz',
                email: 'aylin@vchat.com',
                password: 'test1',
                avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop',
                credits: 210,
                isLive: false,
                isOnline: true,
                role: 'broadcaster',
                isApproved: true,
                gender: 'female',
                level: 1,
                vipStatus: false,
                perMinuteRate: 25,
                messageRate: 5
            },
            {
                username: 'Zehra_Tunc',
                email: 'zehra@vchat.com',
                password: 'test1',
                avatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop',
                credits: 0,
                isLive: true,
                isOnline: true,
                role: 'broadcaster',
                isApproved: false, // Admin paneli için onaysız
                gender: 'female',
                level: 1,
                vipStatus: false,
                perMinuteRate: 30,
                messageRate: 5
            },
            {
                username: 'Melis_Akay',
                email: 'melis@vchat.com',
                password: 'test1',
                avatar: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=400&h=400&fit=crop',
                credits: 9800,
                isLive: false,
                isOnline: false,
                role: 'broadcaster',
                isApproved: true,
                gender: 'female',
                level: 7,
                vipStatus: true,
                perMinuteRate: 80,
                messageRate: 20
            },
            {
                username: 'Damla_Vip',
                email: 'damla@vchat.com',
                password: 'test1',
                avatar: 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=400&fit=crop',
                credits: 24500,
                isLive: true,
                isOnline: true,
                role: 'broadcaster',
                isApproved: true,
                gender: 'female',
                level: 10,
                vipStatus: true,
                perMinuteRate: 150,
                messageRate: 30
            },
            {
                username: 'Test_User',
                email: 'test@vchat.com',
                password: 'test1',
                avatar: 'https://cdn.icon-icons.com/icons2/1378/PNG/512/avatardefault_92824.png',
                credits: 1000,
                isLive: false,
                isOnline: true,
                role: 'user',
                isApproved: true,
                gender: 'male',
                level: 1,
                vipStatus: false
            },
            {
                username: 'Murat_Admin',
                email: 'admin@vchat.com',
                password: 'test1',
                avatar: 'https://cdn.icon-icons.com/icons2/1378/PNG/512/avatardefault_92824.png',
                credits: 999999,
                isLive: false,
                isOnline: true,
                role: 'admin',
                isApproved: true,
                gender: 'male',
                level: 99,
                vipStatus: true
            }
        ];

        for (const userData of users) {
           await User.create({ ...userData, isEmailVerified: true });
        }

        console.log('🚀 Test kayıtları başarıyla oluşturuldu!');
        process.exit();
    } catch (error) {
        console.error('❌ Hata:', error);
        process.exit(1);
    }
};

seedUsers();
