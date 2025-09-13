# Nomadic Phone Modern

A simple web-based phone system built with Node.js, React, and Twilio APIs.

## Features

- **Voice Calls**: Make and receive calls in your browser using WebRTC
- **SMS Messages**: Send and receive text messages with conversation threading
- **Simple Auth**: Single password authentication
- **Clean UI**: Modern interface built with Material-UI

## Tech Stack

- **Backend**: Node.js, Express, Twilio SDK
- **Frontend**: React, TypeScript, Material-UI
- **Authentication**: JWT tokens with simple password auth
- **Data**: No database - everything loaded from Twilio API

## Setup

### Prerequisites
- Node.js 18+
- Twilio account
- ngrok (for webhooks)

### Installation

1. **Clone and install**
   ```bash
   git clone https://github.com/imasimali/nomadic-phone.git
   cd nomadic-phone-master
   npm run install:all
   ```

2. **Configure environment**

   Edit `.env` with your Twilio credentials:
   ```env
   # Twilio Configuration - Only need these two main credentials!
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   TWILIO_APPLICATION_SID=your_app_sid

   # App Configuration
   PORT=3001
   JWT_SECRET=your_jwt_secret
   APP_PASSWORD=your_password
   WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
   ```

   **Note**: API keys are now created automatically! You only need your Account SID and Auth Token.

### Twilio Setup

1. **Create API Key** in Twilio Console → Account → API Keys
2. **Create TwiML App** in Console → Voice → TwiML Apps
3. **Configure webhooks** on your phone number:
   - Voice: `https://your-ngrok-url.ngrok.io/webhooks/voice/incoming`
   - SMS: `https://your-ngrok-url.ngrok.io/webhooks/sms/incoming`

### Run

1. **Start ngrok**:
   ```bash
   ngrok http 3001
   ```

2. **Start the app**:
   ```bash
   npm run dev
   ```

3. **Open**: http://localhost:3000

## Usage

1. **Login** with your configured password
2. **Voice**: Enter a phone number and click Call
3. **SMS**: Start conversations and send messages
4. **Settings**: Configure call behavior

## Production

```bash
npm run build
npm start
```

Set `NODE_ENV=production` and update webhook URLs to your domain.

## License

MIT
