FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_URL
ARG VITE_SIGNALING_URL
ARG VITE_ICE_SERVERS

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SIGNALING_URL=$VITE_SIGNALING_URL
ENV VITE_ICE_SERVERS=$VITE_ICE_SERVERS

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist ./

EXPOSE 80
