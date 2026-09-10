FROM node:20-alpine

WORKDIR /app

# Build args para Vite (se bakea en el build, fallback a placeholder si no hay .env)
ARG VITE_API_URL=http://localhost:3001
ARG VITE_GEMINI_API_KEY=tu_api_key_aqui
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

COPY package*.json ./
RUN npm install

# Copiar resto (node_modules excluido vía .dockerignore)
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
