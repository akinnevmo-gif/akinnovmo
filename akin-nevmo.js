// === AKIN NEVMO - COMPLETE SINGLE FILE ===
// Save this as `akin-nevmo.js` and run with: node akin-nevmo.js

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

// ======================
// CONFIGURATION
// ======================

// Your MTN number (where all donations go)
const PLATFORM_PHONE = '231887716973'; // Remove + and any non-digit characters

// MTN API Configuration (from your .env file)
const MTN_CONFIG = {
  consumerKey: process.env.MTN_CONSUMER_KEY || 'YOUR_CONSUMER_KEY',
  consumerSecret: process.env.MTN_CONSUMER_SECRET || 'YOUR_CONSUMER_SECRET',
  subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY || 'YOUR_SUBSCRIPTION_KEY',
  baseUrl: process.env.BASE_URL || 'https://sandbox.momodeveloper.mtn.com'
};

// ======================
// EXPRESS APP SETUP
// ======================

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (for any future assets)
app.use(express.static(path.join(__dirname, 'public')));

// ======================
// MTN API FUNCTIONS
// ======================

// Get Access Token from MTN
async function getAccessToken() {
  try {
    const authString = Buffer.from(`${MTN_CONFIG.consumerKey}:${MTN_CONFIG.consumerSecret}`).toString('base64');
    
    const response = await axios.post(
      `${MTN_CONFIG.baseUrl}/disbursement/token/`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Ocp-Apim-Subscription-Key': MTN_CONFIG.subscriptionKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('❌ MTN Auth Error:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with MTN API');
  }
}

// Send Money via MTN Disbursements API
async function sendMoney(amount, recipientPhone, message, externalId = null) {
  try {
    const accessToken = await getAccessToken();
    const xReferenceId = externalId || Date.now().toString();
    
    const response = await axios.post(
      `${MTN_CONFIG.baseUrl}/disbursement/v1_0/transfer`,
      {
        amount: amount.toString(),
        currency: 'XAF',
        externalId: xReferenceId,
        payee: {
          partyIdType: 'MSISDN',
          partyId: recipientPhone
        },
        payerMessage: message,
        payeeNote: 'From Akin NevMo'
      },
      {
        headers: {
          'X-Reference-Id': xReferenceId,
          'Ocp-Apim-Subscription-Key': MTN_CONFIG.subscriptionKey,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      transactionId: xReferenceId,
      response: response.data
    };
  } catch (error) {
    console.error('❌ MTN Transfer Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Transfer failed');
  }
}

// ======================
// API ROUTES
// ======================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    platformPhone: PLATFORM_PHONE,
    timestamp: new Date().toISOString()
  });
});

// Donate endpoint - sends money TO your number
app.post('/api/donate', async (req, res) => {
  try {
    const { phone, amount, message = 'Donation from Akin NevMo' } = req.body;

    if (!phone || !amount || amount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Valid phone number and amount (min 100 XAF) required'
      });
    }

    // Validate phone number (remove non-digits)
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number'
      });
    }

    // Send donation TO your platform number
    const result = await sendMoney(amount, PLATFORM_PHONE, `${message} from ${cleanPhone}`);

    res.json({
      success: true,
      message: `Donation of ${amount} XAF received!`,
      transactionId: result.transactionId
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Save endpoint - sends money TO your number (savings)
app.post('/api/save', async (req, res) => {
  try {
    const { goal, amount, frequency = 'monthly' } = req.body;

    if (!goal || !amount || amount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Goal and amount (min 100 XAF) required'
      });
    }

    const message = `Savings for "${goal}" (${frequency})`;
    const result = await sendMoney(amount, PLATFORM_PHONE, message);

    res.json({
      success: true,
      message: `Saved ${amount} XAF for "${goal}"!`,
      transactionId: result.transactionId
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Withdraw endpoint - sends money FROM your number to user
app.post('/api/withdraw', async (req, res) => {
  try {
    const { phone, amount } = req.body;

    if (!phone || !amount || amount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Valid phone number and amount (min 100 XAF) required'
      });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number'
      });
    }

    const message = 'Withdrawal from Akin NevMo savings';
    const result = await sendMoney(amount, cleanPhone, message);

    res.json({
      success: true,
      message: `Withdrew ${amount} XAF to ${cleanPhone}!`,
      transactionId: result.transactionId
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ======================
// SERVE FRONTEND HTML
// ======================

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Akin NevMo - Send Love with MTN Mobile Money</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        :root {
            --primary: #009688;
            --primary-dark: #00796b;
            --secondary: #ff9800;
            --light: #f5f5f5;
            --dark: #333;
            --success: #4caf50;
            --danger: #f44336;
            --warning: #ff9800;
            --info: #2196f3;
        }
        
        body {
            background: linear-gradient(135deg, #f5f5f5, #e8f5e8);
            color: var(--dark);
            line-height: 1.6;
            padding: 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        header {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: white;
            padding: 25px 20px;
            text-align: center;
            border-radius: 16px;
            margin-bottom: 25px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        
        .logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 12px;
        }
        
        .logo i {
            font-size: 32px;
            color: var(--secondary);
        }
        
        h1 {
            font-size: 28px;
            font-weight: 700;
        }
        
        h1 span {
            color: var(--secondary);
        }
        
        .subtitle {
            font-size: 16px;
            opacity: 0.9;
            max-width: 600px;
            margin: 0 auto;
        }
        
        .tabs {
            display: flex;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            margin-bottom: 25px;
        }
        
        .tab-btn {
            flex: 1;
            padding: 16px;
            border: none;
            background: white;
            color: var(--dark);
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-align: center;
        }
        
        .tab-btn:hover {
            background: #f0f0f0;
        }
        
        .tab-btn.active {
            background: var(--primary);
            color: white;
        }
        
        .tab-content {
            display: none;
            background: white;
            padding: 25px;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        
        .tab-content.active {
            display: block;
            animation: fadeIn 0.4s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: var(--dark);
        }
        
        input, select, textarea {
            width: 100%;
            padding: 14px;
            border: 1px solid #ddd;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s ease;
        }
        
        input:focus, select:focus, textarea:focus {
            border-color: var(--primary);
            outline: none;
            box-shadow: 0 0 0 3px rgba(0, 150, 136, 0.2);
        }
        
        .btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 14px;
            border-radius: 10px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            transition: all 0.3s ease;
            box-shadow: 0 4px 10px rgba(0,0,0,0.15);
        }
        
        .btn:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(0,0,0,0.2);
        }
        
        .btn:disabled {
            background: #cccccc;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .status {
            padding: 16px;
            margin-top: 20px;
            border-radius: 10px;
            display: none;
            animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        
        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6da;
        }
        
        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .mtn-section {
            background: white;
            padding: 20px;
            border-radius: 16px;
            margin-top: 25px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        
        .mtn-logo {
            height: 40px;
            margin: 0 auto 15px;
        }
        
        .security-note {
            font-size: 14px;
            color: #666;
            margin-top: 10px;
            line-height: 1.5;
        }
        
        .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
        }
        
        @media (max-width: 600px) {
            .tabs {
                flex-direction: column;
            }
            
            header {
                padding: 20px 15px;
            }
            
            h1 {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">
                <i class="fas fa-hand-holding-heart"></i>
                <h1>Akin <span>NevMo</span></h1>
            </div>
            <p class="subtitle">Send love, save securely, and withdraw instantly using MTN Mobile Money</p>
        </header>

        <div class="tabs">
            <button class="tab-btn active" data-tab="donate">
                <i class="fas fa-donate"></i> Donate
            </button>
            <button class="tab-btn" data-tab="save">
                <i class="fas fa-piggy-bank"></i> Save
            </button>
            <button class="tab-btn" data-tab="withdraw">
                <i class="fas fa-wallet"></i> Withdraw
            </button>
        </div>

        <!-- DONATE TAB -->
        <div class="tab-content active" id="donate-tab">
            <h2 style="margin-bottom: 20px; color: var(--primary);">Send a Donation</h2>
            <form id="donate-form">
                <div class="form-group">
                    <label for="donate-phone"><i class="fas fa-mobile-alt"></i> Recipient's MTN Number</label>
                    <input type="tel" id="donate-phone" placeholder="e.g., 231887716973" required>
                </div>
                <div class="form-group">
                    <label for="donate-amount"><i class="fas fa-coins"></i> Amount (XAF)</label>
                    <input type="number" id="donate-amount" min="100" placeholder="Enter amount" required>
                </div>
                <div class="form-group">
                    <label for="donate-message"><i class="fas fa-comment"></i> Personal Message (Optional)</label>
                    <textarea id="donate-message" rows="2" placeholder="Add a note for your loved one"></textarea>
                </div>
                <button type="submit" class="btn" id="donate-btn">
                    <i class="fas fa-paper-plane"></i> Send Donation
                </button>
            </form>
            <div id="donate-status" class="status"></div>
        </div>

        <!-- SAVE TAB -->
        <div class="tab-content" id="save-tab">
            <h2 style="margin-bottom: 20px; color: var(--primary);">Save for Your Goals</h2>
            <form id="save-form">
                <div class="form-group">
                    <label for="save-goal"><i class="fas fa-bullseye"></i> Savings Goal</label>
                    <input type="text" id="save-goal" placeholder="e.g., Emergency Fund, Birthday Gift" required>
                </div>
                <div class="form-group">
                    <label for="save-amount"><i class="fas fa-coins"></i> Amount to Save (XAF)</label>
                    <input type="number" id="save-amount" min="100" placeholder="Enter amount" required>
                </div>
                <div class="form-group">
                    <label for="save-frequency"><i class="fas fa-calendar-alt"></i> Frequency</label>
                    <select id="save-frequency" required>
                        <option value="">Select frequency</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </div>
                <button type="submit" class="btn" id="save-btn">
                    <i class="fas fa-save"></i> Start Saving
                </button>
            </form>
            <div id="save-status" class="status"></div>
        </div>

        <!-- WITHDRAW TAB -->
        <div class="tab-content" id="withdraw-tab">
            <h2 style="margin-bottom: 20px; color: var(--primary);">Withdraw Funds</h2>
            <form id="withdraw-form">
                <div class="form-group">
                    <label for="withdraw-amount"><i class="fas fa-coins"></i> Amount (XAF)</label>
                    <input type="number" id="withdraw-amount" min="100" placeholder="Enter amount" required>
                </div>
                <div class="form-group">
                    <label for="withdraw-phone"><i class="fas fa-mobile-alt"></i> Your MTN Number</label>
                    <input type="tel" id="withdraw-phone" placeholder="e.g., 231887716973" required>
                </div>
                <button type="submit" class="btn" id="withdraw-btn">
                    <i class="fas fa-wallet"></i> Withdraw to MTN
                </button>
            </form>
            <div id="withdraw-status" class="status"></div>
        </div>

        <div class="mtn-section">
            <svg class="mtn-logo" viewBox="0 0 200 60">
                <path d="M0 0h200v60H0z" fill="#ffc300"/>
                <path d="M10 30H20V20h10V10h10V20h10V30h10V40h-10V50h-10V-40H20V40H10V30z" fill="#fff"/>
            </svg>
            <p><strong>Powered by MTN Mobile Money</strong></p>
            <p class="security-note">
                <i class="fas fa-lock"></i> All transactions are secured with MTN's banking-grade encryption.<br>
                Your money is protected at all times.
            </p>
        </div>

        <div class="footer">
            <p>&copy; 2023 Akin NevMo. All rights reserved.</p>
            <p>Send love, support, and care through MTN Mobile Money</p>
        </div>
    </div>

    <script>
        // Backend URL (same origin)
        const BACKEND_URL = '';
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                button.classList.add('active');
                document.getElementById(button.dataset.tab + '-tab').classList.add('active');
            });
        });

        // Helper: Show status message
        function showStatus(id, message, type) {
            const statusEl = document.getElementById(id);
            statusEl.textContent = message;
            statusEl.className = 'status ' + type;
            statusEl.style.display = 'block';
            
            // Auto hide after 6 seconds
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 6000);
        }

        // Helper: Disable/enable button
        function setButtonState(buttonId, disabled, text = null) {
            const btn = document.getElementById(buttonId);
            btn.disabled = disabled;
            if (text) btn.innerHTML = text;
        }

        // Donate Form Handler
        document.getElementById('donate-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const phone = document.getElementById('donate-phone').value.trim();
            const amount = document.getElementById('donate-amount').value;
            const message = document.getElementById('donate-message').value.trim() || 'Donation from Akin NevMo';
            
            // Validate phone number (basic)
            if (!/^\\d{10,12}$/.test(phone.replace(/\\D/g, ''))) {
                showStatus('donate-status', '❌ Please enter a valid MTN phone number (10-12 digits)', 'error');
                return;
            }
            
            setButtonState('donate-btn', true, '<i class="fas fa-spinner fa-spin"></i> Sending...');
            showStatus('donate-status', 'Processing donation...', 'info');
            
            try {
                const response = await fetch(\`\${BACKEND_URL}/api/donate\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        phone: phone,
                        amount: amount,
                        message: message
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showStatus('donate-status', \`✅ Donation of \${amount} XAF sent successfully!\`, 'success');
                    document.getElementById('donate-form').reset();
                } else {
                    showStatus('donate-status', \`❌ \${result.error || 'Failed to send donation'}\`, 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showStatus('donate-status', '❌ Network error. Please check your connection.', 'error');
            } finally {
                setButtonState('donate-btn', false, '<i class="fas fa-paper-plane"></i> Send Donation');
            }
        });

        // Save Form Handler
        document.getElementById('save-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const goal = document.getElementById('save-goal').value.trim();
            const amount = document.getElementById('save-amount').value;
            const frequency = document.getElementById('save-frequency').value;
            
            if (!goal || !amount || !frequency) {
                showStatus('save-status', '❌ Please fill all fields', 'error');
                return;
            }
            
            setButtonState('save-btn', true, '<i class="fas fa-spinner fa-spin"></i> Saving...');
            showStatus('save-status', 'Processing savings...', 'info');
            
            try {
                const response = await fetch(\`\${BACKEND_URL}/api/save\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        goal: goal,
                        amount: amount,
                        frequency: frequency
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showStatus('save-status', \`✅ Saved \${amount} XAF for "\${goal}" (\${frequency})!\`, 'success');
                    document.getElementById('save-form').reset();
                } else {
                    showStatus('save-status', \`❌ \${result.error || 'Failed to save'}\`, 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showStatus('save-status', '❌ Network error. Please check your connection.', 'error');
            } finally {
                setButtonState('save-btn', false, '<i class="fas fa-save"></i> Start Saving');
            }
        });

        // Withdraw Form Handler
        document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const amount = document.getElementById('withdraw-amount').value;
            const phone = document.getElementById('withdraw-phone').value.trim();
            
            // Validate phone number
            if (!/^\\d{10,12}$/.test(phone.replace(/\\D/g, ''))) {
                showStatus('withdraw-status', '❌ Please enter a valid MTN phone number (10-12 digits)', 'error');
                return;
            }
            
            setButtonState('withdraw-btn', true, '<i class="fas fa-spinner fa-spin"></i> Withdrawing...');
            showStatus('withdraw-status', 'Processing withdrawal...', 'info');
            
            try {
                const response = await fetch(\`\${BACKEND_URL}/api/withdraw\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        phone: phone,
                        amount: amount
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showStatus('withdraw-status', \`✅ Withdrew \${amount} XAF to \${phone} successfully!\`, 'success');
                    document.getElementById('withdraw-form').reset();
                } else {
                    showStatus('withdraw-status', \`❌ \${result.error || 'Failed to withdraw'}\`, 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showStatus('withdraw-status', '❌ Network error. Please check your connection.', 'error');
            } finally {
                setButtonState('withdraw-btn', false, '<i class="fas fa-wallet"></i> Withdraw to MTN');
            }
        });
    </script>
</body>
</html>
  `);
});

// ======================
// START SERVER
// ======================

// Create .env file if it doesn't exist (for first-time users)
const fs = require('fs');
if (!fs.existsSync('.env')) {
  fs.writeFileSync('.env', `# MTN SANDBOX CREDENTIALS
MTN_CONSUMER_KEY=YOUR_CONSUMER_KEY_HERE
MTN_CONSUMER_SECRET=YOUR_CONSUMER_SECRET_HERE
MTN_SUBSCRIPTION_KEY=YOUR_SUBSCRIPTION_KEY_HERE

# SERVER CONFIG
PORT=3000
BASE_URL=https://sandbox.momodeveloper.mtn.com
`);
  console.log('📁 Created .env file - PLEASE EDIT IT WITH YOUR MTN CREDENTIALS!');
}

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 AKIN NEVMO IS RUNNING!');
  console.log('='.repeat(60));
  console.log(`📱 All donations go to: +${PLATFORM_PHONE}`);
  console.log(`🌐 Open in browser: http://localhost:${PORT}`);
  console.log(`🔧 Edit .env file to add your MTN credentials`);
  console.log('='.repeat(60));
});
