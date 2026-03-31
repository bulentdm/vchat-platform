// Paylaşımlı paket tanımları — hem admin hem payment route kullanır
// İleride DB'ye (Package modeli) taşınabilir
const packages = [
  { id: 1, amount: 100,  priceInTL: 50,   label: 'Başlangıç', color: '#cd7f32', icon: '🥉' },
  { id: 2, amount: 500,  priceInTL: 200,  label: 'Gümüş',     color: '#c0c0c0', icon: '🥈' },
  { id: 3, amount: 1500, priceInTL: 500,  label: 'Altın',      color: '#ffd700', icon: '🥇' },
  { id: 4, amount: 5000, priceInTL: 1500, label: 'Platin',     color: '#e5e4e2', icon: '💎' },
];

const getPackages = () => packages;

const updatePackage = (id, data) => {
  const idx = packages.findIndex(p => p.id === Number(id));
  if (idx === -1) return null;
  if (data.amount    !== undefined) packages[idx].amount    = Number(data.amount);
  if (data.priceInTL !== undefined) packages[idx].priceInTL = Number(data.priceInTL);
  if (data.label     !== undefined) packages[idx].label     = String(data.label);
  return packages[idx];
};

module.exports = { getPackages, updatePackage };
