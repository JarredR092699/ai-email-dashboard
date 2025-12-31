import { useState, useMemo, useEffect } from 'react'
import './App.css'
import BackendEmailAuth from './components/BackendEmailAuth'
import apiService from './services/apiService'

const mockEmails = [
  {
    id: 1,
    from: 'john.doe@company.com',
    subject: 'Q4 Board Meeting - Action Items Required',
    body: 'Need your input on the quarterly review and strategic planning items for next week\'s board meeting.',
    timestamp: new Date('2024-01-15T09:30:00'),
    isRead: false
  },
  {
    id: 2,
    from: 'marketing@newsletter.com',
    subject: 'Weekly Newsletter - Industry Updates',
    body: 'Check out this week\'s latest trends in technology and business development.',
    timestamp: new Date('2024-01-15T08:15:00'),
    isRead: true
  },
  {
    id: 3,
    from: 'sarah.wilson@partner.com',
    subject: 'URGENT: Contract Review Needed by EOD',
    body: 'The client contract needs immediate review and approval before we can proceed with the project timeline.',
    timestamp: new Date('2024-01-15T11:45:00'),
    isRead: false
  },
  {
    id: 4,
    from: 'hr@company.com',
    subject: 'Team Building Event - Next Friday',
    body: 'Don\'t forget to RSVP for our upcoming team building event. Lunch will be provided.',
    timestamp: new Date('2024-01-14T16:20:00'),
    isRead: true
  },
  {
    id: 5,
    from: 'alex.chen@vendor.com',
    subject: 'Budget Proposal for 2024 Projects',
    body: 'Attached is the detailed budget breakdown for the upcoming projects. Please review and provide feedback.',
    timestamp: new Date('2024-01-15T13:10:00'),
    isRead: false
  },
  {
    id: 6,
    from: 'notifications@app.com',
    subject: 'Your monthly report is ready',
    body: 'Your monthly usage and analytics report is now available for download.',
    timestamp: new Date('2024-01-14T09:00:00'),
    isRead: true
  }
]

function prioritizeEmail(email) {
  const subject = email.subject.toLowerCase()
  const body = email.body.toLowerCase()
  const from = email.from.toLowerCase()
  
  let score = 50 // Start with neutral score
  
  // 1. Urgency Keywords (High Priority Indicators)
  const urgencyKeywords = {
    'urgent': 25, 'asap': 25, 'immediate': 25, 'emergency': 30,
    'deadline': 20, 'eod': 20, 'end of day': 20, 'today': 15,
    'action required': 20, 'please respond': 15, 'time sensitive': 20,
    'important': 10, 'critical': 25, 'priority': 15
  }
  
  // 2. Executive/Business Keywords
  const businessKeywords = {
    'board': 30, 'ceo': 25, 'cto': 25, 'executive': 20,
    'meeting': 15, 'proposal': 15, 'contract': 25, 'budget': 20,
    'revenue': 20, 'client': 15, 'customer': 15, 'deal': 20,
    'partnership': 15, 'investor': 25, 'funding': 25
  }
  
  // 3. Low Priority Keywords (Subtract from score)
  const lowPriorityKeywords = {
    'newsletter': -20, 'unsubscribe': -25, 'notification': -15,
    'noreply': -20, 'automated': -15, 'marketing': -15,
    'promotional': -20, 'spam': -30, 'advertisement': -25,
    'sale': -10, 'offer': -10, 'deal of the day': -20,
    'team building': -5, 'social event': -5
  }
  
  // 4. Sender Analysis
  const senderScore = analyzeSender(from)
  score += senderScore
  
  // 5. Time Analysis
  const timeScore = analyzeTime(email.timestamp)
  score += timeScore
  
  // 6. Subject Analysis
  const subjectScore = analyzeSubject(subject)
  score += subjectScore
  
  // Apply keyword scoring
  const allKeywords = { ...urgencyKeywords, ...businessKeywords, ...lowPriorityKeywords }
  
  Object.entries(allKeywords).forEach(([keyword, points]) => {
    if (subject.includes(keyword) || body.includes(keyword)) {
      score += points
      // Double weight for subject line matches
      if (subject.includes(keyword)) {
        score += points * 0.5
      }
    }
  })
  
  // Convert score to priority level
  if (score >= 75) return 'HIGH'
  if (score <= 25) return 'LOW'
  return 'MEDIUM'
}

function analyzeSender(from) {
  // VIP domains and patterns
  const vipDomains = [
    'board', 'ceo', 'cto', 'cfo', 'vp', 'director', 'partner',
    'client', 'customer', 'investor'
  ]
  
  // Corporate domains vs personal/marketing
  if (from.includes('@gmail.com') || from.includes('@hotmail.com') || from.includes('@yahoo.com')) {
    return -5 // Personal emails slightly lower priority
  }
  
  if (from.includes('noreply') || from.includes('no-reply') || from.includes('donotreply')) {
    return -15 // Automated emails
  }
  
  // Check for VIP keywords in email address
  for (const vip of vipDomains) {
    if (from.includes(vip)) {
      return 15
    }
  }
  
  // Corporate domain (anything that's not common personal email)
  return 5
}

function analyzeTime(timestamp) {
  const emailDate = new Date(timestamp)
  const now = new Date()
  const hoursSinceReceived = (now - emailDate) / (1000 * 60 * 60)
  
  // Recent emails get priority boost
  if (hoursSinceReceived < 1) return 10      // Last hour
  if (hoursSinceReceived < 4) return 5       // Last 4 hours
  if (hoursSinceReceived > 48) return -10    // Older than 2 days
  
  // Check if sent during business hours (more likely to be important)
  const hour = emailDate.getHours()
  const day = emailDate.getDay()
  
  // Weekend emails might be more urgent
  if (day === 0 || day === 6) return 5
  
  // After hours emails might be more urgent
  if (hour < 7 || hour > 19) return 5
  
  return 0
}

function analyzeSubject(subject) {
  let score = 0
  
  // Question marks often indicate requests needing response
  if (subject.includes('?')) score += 5
  
  // All caps suggests urgency (but could be spam)
  if (subject === subject.toUpperCase() && subject.length > 5) {
    score += 10
  }
  
  // Exclamation points suggest urgency
  const exclamationCount = (subject.match(/!/g) || []).length
  if (exclamationCount > 0) score += Math.min(exclamationCount * 3, 10)
  
  // RE: or FWD: suggests ongoing conversation
  if (subject.startsWith('re:') || subject.startsWith('fwd:')) score += 5
  
  // Very short subjects often more urgent
  if (subject.length < 20) score += 3
  
  // Very long subjects often spam
  if (subject.length > 100) score -= 10
  
  return score
}

function App() {
  const [filterPriority, setFilterPriority] = useState('ALL')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [emails, setEmails] = useState([])
  const [isLoadingEmails, setIsLoadingEmails] = useState(false)
  const [emailError, setEmailError] = useState(null)
  const [useRealEmails, setUseRealEmails] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  
  
  useEffect(() => {
    if (isAuthenticated && useRealEmails) {
      loadEmails()
    }
  }, [isAuthenticated, useRealEmails])
  
  const loadEmails = async () => {
    setIsLoadingEmails(true)
    setEmailError(null)
    try {
      const response = await apiService.fetchEmails(50)
      const emailsWithDates = response.emails.map(email => ({
        ...email,
        timestamp: new Date(email.timestamp)
      }))
      setEmails(emailsWithDates)
    } catch (error) {
      console.error('Failed to load emails:', error)
      setEmailError('Failed to load emails. Please try again.')
    } finally {
      setIsLoadingEmails(false)
    }
  }
  
  const currentEmails = useRealEmails && isAuthenticated ? emails : mockEmails
  
  const emailsWithPriority = useMemo(() => {
    return currentEmails.map(email => {
      // Use AI priority if available, fallback to rule-based
      const aiPriority = email.aiPriority;
      const fallbackPriority = prioritizeEmail(email);
      
      return {
        ...email,
        priority: aiPriority ? aiPriority.priority : (typeof fallbackPriority === 'string' ? fallbackPriority : fallbackPriority.priority),
        aiAnalysis: aiPriority || null,
        debugInfo: aiPriority ? `AI: ${aiPriority.reasoning} (${aiPriority.confidence}% confident, source: ${aiPriority.source})` : null
      }
    }).sort((a, b) => {
      if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1
      if (b.priority === 'HIGH' && a.priority !== 'HIGH') return 1
      if (a.priority === 'MEDIUM' && b.priority === 'LOW') return -1
      if (b.priority === 'MEDIUM' && a.priority === 'LOW') return 1
      return new Date(b.timestamp) - new Date(a.timestamp)
    })
  }, [currentEmails])
  
  const filteredEmails = useMemo(() => {
    if (filterPriority === 'ALL') return emailsWithPriority
    return emailsWithPriority.filter(email => email.priority === filterPriority)
  }, [emailsWithPriority, filterPriority])
  
  const priorityCounts = useMemo(() => {
    return emailsWithPriority.reduce((acc, email) => {
      acc[email.priority] = (acc[email.priority] || 0) + 1
      return acc
    }, {})
  }, [emailsWithPriority])

  return (
    <div className="app">
      <header className="header">
        <h1>📧 Email Priority Dashboard</h1>
        <p className="subtitle">AI-powered email prioritization for executive productivity</p>
        <BackendEmailAuth 
          onAuthChange={setIsAuthenticated}
        />
        {isAuthenticated && (
          <div className="email-controls">
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={useRealEmails} 
                onChange={(e) => setUseRealEmails(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">
                {useRealEmails ? 'Using Real Emails' : 'Using Demo Data'}
              </span>
            </label>
            {useRealEmails && (
              <button onClick={loadEmails} className="refresh-button" disabled={isLoadingEmails}>
                {isLoadingEmails ? '⏳ Loading...' : '🔄 Refresh'}
              </button>
            )}
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={showDebug} 
                onChange={(e) => setShowDebug(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">
                {showDebug ? 'AI Debug: ON' : 'AI Debug: OFF'}
              </span>
            </label>
          </div>
        )}
        {emailError && (
          <div className="error-message">
            {emailError}
          </div>
        )}
      </header>
      
      <div className="dashboard">
        <div className="stats">
          <div className="stat-card high">
            <div className="stat-number">{priorityCounts.HIGH || 0}</div>
            <div className="stat-label">High Priority</div>
          </div>
          <div className="stat-card medium">
            <div className="stat-number">{priorityCounts.MEDIUM || 0}</div>
            <div className="stat-label">Medium Priority</div>
          </div>
          <div className="stat-card low">
            <div className="stat-number">{priorityCounts.LOW || 0}</div>
            <div className="stat-label">Low Priority</div>
          </div>
        </div>
        
        <div className="filters">
          <button 
            className={filterPriority === 'ALL' ? 'active' : ''}
            onClick={() => setFilterPriority('ALL')}
          >
            All Emails
          </button>
          <button 
            className={filterPriority === 'HIGH' ? 'active' : ''}
            onClick={() => setFilterPriority('HIGH')}
          >
            High Priority
          </button>
          <button 
            className={filterPriority === 'MEDIUM' ? 'active' : ''}
            onClick={() => setFilterPriority('MEDIUM')}
          >
            Medium Priority
          </button>
          <button 
            className={filterPriority === 'LOW' ? 'active' : ''}
            onClick={() => setFilterPriority('LOW')}
          >
            Low Priority
          </button>
        </div>
        
        <div className="email-list">
          {filteredEmails.map(email => (
            <div key={email.id} className={`email-item ${email.priority.toLowerCase()} ${!email.isRead ? 'unread' : ''}`}>
              <div className="email-header">
                <div className="email-from">{email.from}</div>
                <div className="email-time">
                  {email.timestamp.toLocaleDateString()} {email.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
              <div className="email-subject">
                <span className={`priority-badge ${email.priority.toLowerCase()}`}>
                  {email.priority}
                </span>
                {email.subject}
              </div>
              <div className="email-preview">
                {email.body}
              </div>
              {showDebug && email.debugInfo && (
                <div className="debug-info">
                  🤖 {email.debugInfo}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
