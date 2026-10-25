FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-fund --no-audit
COPY src ./src
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/index.ts"]
