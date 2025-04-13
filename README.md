# Google SERP Scraper

A Node.js application that scrapes Google Search Engine Results Pages (SERP) using Puppeteer in a Docker container.

## Prerequisites

- Docker
- Node.js 18 or higher (for local development)
- Yarn package manager

## Quick Start

1. Clone the repository:

```bash
git clone <repository-url>
cd google-serp
```

2. Build and run with Docker:

```bash
# For Apple Silicon (M1/M2) Macs
docker build --platform=linux/arm64 -t google-serp .

# For Intel Macs
docker build --platform=linux/amd64 -t google-serp .

# For both arch
docker build --platform=linux/amd64,linux/arm64 -t olivier86/google-serp:latest --push .

# Run the container
docker run -e TWO_CAPTCHA_API_KEY=key -e PROXY_SERVER=proxy -e PROXY_USERNAME=username -e PROXY_PASSWORD=password  -p 3001:3001 olivier86/google-serp:latest
```

## Development

### Local Setup

1. Install dependencies:

```bash
yarn install
```

2. Start the application:

```bash
yarn start
```

The server will start on port 3001.

## Environment Variables

- `PUPPETEER_EXECUTABLE_PATH`: Path to Chromium browser (default: `/usr/bin/chromium-browser`)
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`: Skip Chromium download (default: `true`)
- `CHROMIUM_FLAGS`: Chrome flags for headless mode
- `TWO_CAPTCHA_API_KEY`: 2captcha API key for captcha solving
- `PROXY_SERVER`: the proxy host and port
- `PROXY_USERNAME`: the proxy username
- `PROXY_PASSWORD`: the proxy password

## Architecture

The application uses:

- Node.js for the runtime environment
- Puppeteer for web scraping
- Docker for containerization
- Alpine Linux as the base image

## Deployment

To deploy to production:

```bash
# Build for specific platform
docker build --platform=linux/amd64,linux/arm64 -t olivier86/google-serp:latest .

# Push to registry
docker push olivier86/google-serp

# or
docker build --platform=linux/amd64,linux/arm64 -t olivier86/google-serp:latest --push .
```

## Security Notes

- Runs as non-root user in Docker
- Uses secure Chrome flags
- Implements proper error handling

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
