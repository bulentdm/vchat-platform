/**
 * ⚙️ Platform Finansal Konfigürasyonu
 *
 * Hesaplama mantığı:
 *  - Kullanıcı 100 💎 için ₺50 öder → 1 💎 = ₺0.50 yüz değeri
 *  - commissionRate %80 ise: yayıncı hediyelerin %80'ini 💎 olarak alır
 *  - Ödemede: yayıncının 💎 bakiyesi × DIAMOND_TO_TL_RATE = onun kazancı
 *  - Örnek: 80 💎 × ₺0.50 = ₺40 → platformda ₺10 kalır (₺50'nin %20'si)
 */
const systemConfig = {
  DIAMOND_TO_TL_RATE: 0.50,       // 1 yayıncı 💎'ı = kaç ₺ (en ucuz paketten hesaplanmış)
  DEFAULT_COMMISSION_RATE: 80,    // Yeni yayıncı için varsayılan komisyon % (yayıncıya giden)
};

module.exports = systemConfig;
