# docker build --platform=linux/amd64,linux/arm64 -t olivier86/google-serp:latest --push .
# docker run -e TWO_CAPTCHA_API_KEY=token -p 3001:3001 olivier86/google-serp:latest

# Use Node.js 18 Alpine as the base image
FROM alpine

# Install Chromium and dependencies
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      bash \
      nodejs \
      yarn \
      curl \
      dbus \
      fontconfig

# Set working directory
WORKDIR /app

# Set environment variables for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

ENV CHROMIUM_FLAGS="--disable-gpu --no-sandbox --disable-dev-shm-usage --disable-setuid-sandbox --no-zygote"

# Install node modules
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy application code
COPY . .

# Create a non-privileged user
ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/home/appuser" \
    --shell "/bin/bash" \
    --uid "${UID}" \
    appuser \
    && mkdir -p /home/appuser/.cache/puppeteer \
    && chown -R appuser:appuser /app /home/appuser

# Switch to non-root user
USER appuser

# Expose the port
EXPOSE 3001

# Start the application
CMD ["node", "index.js"]