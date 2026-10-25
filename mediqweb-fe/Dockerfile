FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-fund --no-audit
COPY . .
RUN npx ng build
ENV API_BASE_URL=http://localhost:8099
ENV BFF_BASE_URL=http://localhost:3000
ENV NODE_ENV=production
EXPOSE 80
CMD ["npx", "http-server", "dist/mediqapp-fe", "-p", "80"]
