FROM node:20-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar código y prisma
COPY . .

# Generar cliente Prisma
RUN npx prisma generate

EXPOSE 3001

# Migrations se ejecutan al arrancar el contenedor (deploy para prod, dev para local)
CMD sh -c "npx prisma migrate deploy || npx prisma migrate dev --name init || true; npx prisma generate; npm run start:dev"
