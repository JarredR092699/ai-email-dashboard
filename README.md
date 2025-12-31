# 📧 AI Email Priority Dashboard

An intelligent email dashboard that uses AI to automatically prioritize emails for busy executives.

## Features

✨ **AI-Powered Prioritization** - Uses Claude AI to understand email context and urgency  
🔐 **Secure Gmail Integration** - OAuth authentication, no passwords stored  
📊 **Executive Dashboard** - Clean interface showing high/medium/low priority emails  
🎯 **Smart Filtering** - Filter by priority level to focus on what matters  
🔍 **Debug Mode** - See exactly why emails get their priority rankings  

## How It Works

1. **Sign in with Google** - Secure OAuth, no setup required
2. **AI Analysis** - Claude analyzes email content, sender, timing, and context
3. **Smart Prioritization** - Emails ranked as HIGH, MEDIUM, or LOW priority
4. **Executive View** - Clean dashboard for quick decision making

## Technology

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **AI**: Anthropic Claude (with OpenAI fallback)
- **Auth**: Google OAuth 2.0
- **Email**: Gmail API

## Demo

Perfect for executives who need to quickly identify urgent emails among hundreds of messages.

The AI understands context like:
- "Meeting by 5PM today" → HIGH priority
- "Budget approval needed ASAP" → HIGH priority  
- "Newsletter updates" → LOW priority
- "Team lunch next week" → LOW priority

---

Built for executives who value their time. 🚀