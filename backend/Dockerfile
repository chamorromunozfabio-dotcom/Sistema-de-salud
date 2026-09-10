FROM node:20-alpine

# Prisma 5.22 necesita OpenSSL - en Alpine instalar antes de prisma generate para detectar versión correcta (evita default 1.1.x)
# + herramientas para wait-for-db (pg_isready via postgresql-client y netcat)
RUN apk add --no-cache openssl postgresql-client netcat-openbsd

WORKDIR /app

# Copiar archivos de dependencias (con lock para versión exacta de prisma 5.22.0)
COPY package*.json ./

# Instalar TODAS las dependencias (prisma está en dependencies)
RUN npm install --include=dev

# Copiar el resto del código (node_modules excluido vía .dockerignore)
COPY . .

# Generar cliente Prisma - usa binario local (ahora con openssl disponible detecta 3.x)
RUN ./node_modules/.bin/prisma generate || npx prisma generate || npm run prisma:generate

EXPOSE 3001

# Al arrancar: esperar postgres, luego sincronizar schema (db push corrige migraciones faltantes) + migrate deploy + generate + seed
CMD sh -c "echo '⏳ Esperando postgres...'; until pg_isready -h postgres -p 5432 -U postgres >/dev/null 2>&1; do sleep 1; done; echo '✅ Postgres ready, sincronizando schema...'; npx prisma db push --accept-data-loss 2>&1 || echo 'db push skip'; npx prisma migrate deploy 2>&1 || echo 'migrate deploy skip'; ./node_modules/.bin/prisma generate; echo '🌱 Seed si BD vacía...'; npm run prisma:seed 2>&1 || echo 'seed skip (ya existe o error)'; npm run start:dev"