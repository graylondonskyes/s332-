FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=8787
ENV SKYDEXIA_EDITION=90GB
ENV OLLAMA_URL=http://skydexia90-ollama:11434
ENV SKYDEXIA_DEFAULT_MODEL=qwen2.5-coder:7b

EXPOSE 8787

CMD ["npm", "run", "start"]
