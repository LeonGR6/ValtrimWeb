# WATERMARK_AUTHOR: Hecho por Gerardo Esparza
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runner

COPY --from=build /app/dist /usr/share/nginx/html

RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
server {
	listen 8080;
	server_name _;

	root /usr/share/nginx/html;
	index index.html;

	location / {
		try_files $uri $uri/ /index.html;
	}

	location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$ {
		expires 30d;
		add_header Cache-Control "public";
	}
}
EOF

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
