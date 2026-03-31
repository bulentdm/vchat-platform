FROM node:22-slim

WORKDIR /app

# Bağımlılıkları kopyala ve yükle
COPY server/package*.json ./
RUN npm install --production

# Uygulama kodunu kopyala
COPY server/ .

# Portu dışarı aç
EXPOSE 5001

CMD ["node", "index.js"]