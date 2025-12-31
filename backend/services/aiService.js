const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

class AIService {
  constructor() {
    console.log('🔧 AI Service initializing...');
    console.log('🔑 Anthropic API key configured:', !!process.env.ANTHROPIC_API_KEY);
    console.log('🔑 OpenAI API key configured:', !!process.env.OPENAI_API_KEY);
    
    // Prefer Anthropic Claude, fallback to OpenAI
    this.anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    }) : null;
    
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }) : null;
    
    console.log('🤖 Claude client created:', !!this.anthropic);
    console.log('🤖 OpenAI client created:', !!this.openai);
  }

  async analyzeEmailPriority(email) {
    // Try Anthropic Claude first, then fallback to OpenAI
    if (this.anthropic) {
      try {
        return await this.analyzeWithClaude(email);
      } catch (error) {
        console.error('Claude analysis failed, trying OpenAI:', error.message);
      }
    }
    
    if (this.openai) {
      try {
        return await this.analyzeWithOpenAI(email);
      } catch (error) {
        console.error('OpenAI analysis failed:', error.message);
      }
    }
    
    console.log('No AI service configured, skipping AI analysis');
    return null;
  }

  async analyzeWithClaude(email) {
    const prompt = this.buildPrompt(email);
    
    const response = await this.anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 200,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: `You are an AI assistant that analyzes emails for priority ranking for busy executives. Respond with ONLY a JSON object containing priority (HIGH, MEDIUM, LOW), confidence (0-100), and reasoning.

${prompt}`
        }
      ]
    });

    const result = JSON.parse(response.content[0].text);
    
    return {
      priority: result.priority,
      confidence: result.confidence,
      reasoning: result.reasoning,
      aiAnalyzed: true,
      model: 'claude'
    };
  }

  async analyzeWithOpenAI(email) {
    const prompt = this.buildPrompt(email);
    
    const response = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that analyzes emails for priority ranking for busy executives. Respond with a JSON object containing priority (HIGH, MEDIUM, LOW), confidence (0-100), and reasoning."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      priority: result.priority,
      confidence: result.confidence,
      reasoning: result.reasoning,
      aiAnalyzed: true,
      model: 'gpt-3.5'
    };
  }

  buildPrompt(email) {
    return `Analyze this email for priority ranking:

FROM: ${email.from}
SUBJECT: ${email.subject}
DATE: ${new Date(email.timestamp).toLocaleString()}
BODY: ${email.body}

Consider:
- Urgency indicators (deadlines, time constraints)
- Sender importance (executive, client, partner)
- Action requirements
- Business impact
- Personal importance cues

Respond with JSON:
{
  "priority": "HIGH|MEDIUM|LOW",
  "confidence": 85,
  "reasoning": "Brief explanation"
}`;
  }

  // Rule-based baseline for quick decisions
  getBaselinePriority(email) {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    const from = email.from.toLowerCase();
    
    // Clear spam/newsletters - immediate LOW
    const spamIndicators = [
      'unsubscribe', 'newsletter', 'marketing', 'promotional', 
      'noreply', 'no-reply', 'donotreply'
    ];
    
    if (spamIndicators.some(indicator => 
      from.includes(indicator) || subject.includes(indicator)
    )) {
      return { priority: 'LOW', confidence: 95, source: 'baseline', reasoning: 'Newsletter/automated content' };
    }
    
    // Clear urgency - immediate HIGH
    const urgentIndicators = [
      'urgent', 'asap', 'emergency', 'critical', 'immediate'
    ];
    
    if (urgentIndicators.some(indicator => 
      subject.includes(indicator) || body.includes(indicator)
    )) {
      return { priority: 'HIGH', confidence: 90, source: 'baseline', reasoning: 'Contains urgency keywords' };
    }
    
    // VIP senders - likely HIGH
    if (from.includes('ceo') || from.includes('board') || from.includes('investor')) {
      return { priority: 'HIGH', confidence: 85, source: 'baseline', reasoning: 'VIP sender' };
    }
    
    // Uncertain - needs AI analysis
    return null;
  }

  // Hybrid analysis combining baseline + AI
  async hybridAnalysis(email) {
    // First, try baseline rules
    const baseline = this.getBaselinePriority(email);
    
    if (baseline && baseline.confidence >= 90) {
      // High confidence baseline decision - no AI needed
      return baseline;
    }
    
    // Uncertain case - use AI
    const aiResult = await this.analyzeEmailPriority(email);
    
    if (aiResult) {
      return {
        priority: aiResult.priority,
        confidence: aiResult.confidence,
        reasoning: aiResult.reasoning,
        source: 'ai',
        aiAnalyzed: true
      };
    }
    
    // Fallback to baseline or default
    return baseline || { 
      priority: 'MEDIUM', 
      confidence: 50, 
      source: 'fallback',
      reasoning: 'Unable to analyze - defaulted to medium priority' 
    };
  }
}

module.exports = new AIService();