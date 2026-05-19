// ===== ARC Testnet Dashboard - Main Application =====
'use strict';

// ===== STATE MANAGEMENT =====
const AppState = {
    wallet: {
        connected: false,
        address: null,
        balance: 0,
        chainId: null,
    },
    faucet: {
        lastClaim: null,
        cooldownMs: 24 * 60 * 60 * 1000, // 24 hours
        claims: [],
    },
    stats: {
        transactions: 0,
        wallets: 0,
        faucetClaims: 0,
        tps: 0,
        volume: 0,
    },
    transactions: [],
};

// ===== UTILITY FUNCTIONS =====
function shortenAddress(addr) {
    if (!addr) return '0x0000...0000';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function generateTxHash() {
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * 16)];
    return hash;
}

function generateAddress() {
    const chars = '0123456789abcdef';
    let addr = '0x';
    for (let i = 0; i < 40; i++) addr += chars[Math.floor(Math.random() * 16)];
    return addr;
}

function isValidAddress(addr) {
    return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function formatTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
}


// ===== TOAST NOTIFICATIONS =====
function showToast(type, title, message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <span class="toast-title">${title}</span>
            <span class="toast-message">${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ===== WALLET FUNCTIONALITY =====
function handleWalletConnect() {
    if (AppState.wallet.connected) {
        showToast('info', 'Already Connected', 'Your wallet is already connected.');
        return;
    }
    openWalletModal();
}

function openWalletModal() {
    document.getElementById('wallet-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeWalletModal() {
    document.getElementById('wallet-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

async function connectMetaMask() {
    closeWalletModal();
    
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const balance = await window.ethereum.request({
                method: 'eth_getBalance',
                params: [accounts[0], 'latest']
            });
            
            AppState.wallet.connected = true;
            AppState.wallet.address = accounts[0];
            AppState.wallet.chainId = chainId;
            AppState.wallet.balance = parseInt(balance, 16) / 1e18;
            
            updateWalletUI();
            showToast('success', 'Wallet Connected', `Connected: ${shortenAddress(accounts[0])}`);
        } catch (err) {
            showToast('error', 'Connection Failed', err.message || 'User rejected the request.');
        }
    } else {
        // Simulate connection for demo
        simulateWalletConnect();
    }
}

async function connectWalletConnect() {
    closeWalletModal();
    // Simulate WalletConnect for demo
    simulateWalletConnect();
}

function simulateWalletConnect() {
    const address = generateAddress();
    AppState.wallet.connected = true;
    AppState.wallet.address = address;
    AppState.wallet.chainId = '0x4d2'; // 1234
    AppState.wallet.balance = (Math.random() * 10 + 1).toFixed(4);
    
    updateWalletUI();
    showToast('success', 'Wallet Connected', `Connected: ${shortenAddress(address)}`);
}

function disconnectWallet() {
    AppState.wallet.connected = false;
    AppState.wallet.address = null;
    AppState.wallet.balance = 0;
    AppState.wallet.chainId = null;
    
    updateWalletUI();
    showToast('info', 'Wallet Disconnected', 'Your wallet has been disconnected.');
}

function updateWalletUI() {
    const connected = AppState.wallet.connected;
    const badge = document.getElementById('wallet-status-badge');
    const disconnectedEl = document.getElementById('wallet-disconnected');
    const connectedEl = document.getElementById('wallet-connected');
    const navBtn = document.getElementById('connect-text-nav');
    
    if (connected) {
        badge.textContent = 'Connected';
        badge.classList.add('connected');
        disconnectedEl.classList.add('hidden');
        connectedEl.classList.remove('hidden');
        document.getElementById('wallet-address').textContent = shortenAddress(AppState.wallet.address);
        document.getElementById('wallet-balance').textContent = `${parseFloat(AppState.wallet.balance).toFixed(4)} ARC`;
        navBtn.textContent = shortenAddress(AppState.wallet.address);
    } else {
        badge.textContent = 'Disconnected';
        badge.classList.remove('connected');
        disconnectedEl.classList.remove('hidden');
        connectedEl.classList.add('hidden');
        navBtn.textContent = 'Connect Wallet';
    }
}

function copyAddress() {
    if (AppState.wallet.address) {
        navigator.clipboard.writeText(AppState.wallet.address).then(() => {
            showToast('success', 'Copied', 'Address copied to clipboard');
        }).catch(() => {
            showToast('info', 'Address', AppState.wallet.address);
        });
    }
}


// ===== SEND TOKEN FUNCTIONALITY =====
async function handleSendToken() {
    if (!AppState.wallet.connected) {
        showToast('error', 'Wallet Required', 'Please connect your wallet first.');
        return;
    }

    const addressInput = document.getElementById('send-address');
    const amountInput = document.getElementById('send-amount');
    const address = addressInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const addressError = document.getElementById('address-error');
    const amountError = document.getElementById('amount-error');
    
    // Reset errors
    addressError.classList.add('hidden');
    amountError.classList.add('hidden');

    // Validate address
    if (!isValidAddress(address)) {
        addressError.classList.remove('hidden');
        addressInput.style.borderColor = 'var(--red)';
        return;
    }
    addressInput.style.borderColor = '';

    // Validate amount
    if (!amount || amount <= 0 || amount > parseFloat(AppState.wallet.balance)) {
        amountError.classList.remove('hidden');
        amountInput.style.borderColor = 'var(--red)';
        return;
    }
    amountInput.style.borderColor = '';

    // Show loading
    const btn = document.getElementById('send-btn');
    const btnText = btn.querySelector('.btn-text');
    const loader = document.getElementById('send-loader');
    btn.disabled = true;
    btnText.classList.add('hidden');
    loader.classList.remove('hidden');

    // Simulate transaction
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1500));

    // Success
    const txHash = generateTxHash();
    AppState.wallet.balance = (parseFloat(AppState.wallet.balance) - amount - 0.0001).toFixed(4);
    document.getElementById('wallet-balance').textContent = `${AppState.wallet.balance} ARC`;

    // Add to transactions
    addTransaction({
        hash: txHash,
        from: AppState.wallet.address,
        to: address,
        amount: amount.toFixed(4),
        timestamp: new Date(),
        status: 'success'
    });

    // Reset form
    addressInput.value = '';
    amountInput.value = '';
    btn.disabled = false;
    btnText.classList.remove('hidden');
    loader.classList.add('hidden');

    showToast('success', 'Transaction Sent', `${amount} ARC sent. Tx: ${shortenAddress(txHash)}`);
    AppState.stats.transactions++;
    updateStatsUI();
}

function pasteAddress() {
    navigator.clipboard.readText().then(text => {
        document.getElementById('send-address').value = text;
    }).catch(() => {
        showToast('info', 'Paste', 'Please paste manually (Ctrl+V)');
    });
}

function setMaxAmount() {
    if (AppState.wallet.connected) {
        const max = Math.max(0, parseFloat(AppState.wallet.balance) - 0.001);
        document.getElementById('send-amount').value = max.toFixed(4);
    }
}


// ===== FAUCET SYSTEM =====
async function handleFaucetClaim() {
    if (!AppState.wallet.connected) {
        showToast('error', 'Wallet Required', 'Please connect your wallet to claim tokens.');
        return;
    }

    // Check cooldown
    if (AppState.faucet.lastClaim) {
        const elapsed = Date.now() - AppState.faucet.lastClaim;
        if (elapsed < AppState.faucet.cooldownMs) {
            showToast('error', 'Cooldown Active', 'Please wait for the cooldown to expire.');
            return;
        }
    }

    // Show loading
    const btn = document.getElementById('faucet-btn');
    const btnText = document.getElementById('faucet-btn-text');
    const loader = document.getElementById('faucet-loader');
    btn.disabled = true;
    btnText.classList.add('hidden');
    loader.classList.remove('hidden');

    // Simulate claim
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Success
    const claimAmount = 0.5;
    AppState.wallet.balance = (parseFloat(AppState.wallet.balance) + claimAmount).toFixed(4);
    AppState.faucet.lastClaim = Date.now();
    AppState.faucet.claims.unshift({
        amount: claimAmount,
        timestamp: new Date(),
        txHash: generateTxHash()
    });
    AppState.stats.faucetClaims++;

    // Update UI
    document.getElementById('wallet-balance').textContent = `${AppState.wallet.balance} ARC`;
    btn.disabled = false;
    btnText.classList.remove('hidden');
    loader.classList.add('hidden');

    updateFaucetUI();
    updateFaucetHistory();
    updateStatsUI();

    showToast('success', 'Tokens Claimed!', `+${claimAmount} ARC added to your wallet.`);

    // Add transaction
    addTransaction({
        hash: generateTxHash(),
        from: '0x' + '0'.repeat(38) + 'F1',
        to: AppState.wallet.address,
        amount: claimAmount.toFixed(4),
        timestamp: new Date(),
        status: 'success'
    });
}

function updateFaucetUI() {
    const indicator = document.getElementById('faucet-indicator');
    const statusText = document.getElementById('faucet-status-text');
    const timer = document.getElementById('faucet-timer');
    const btn = document.getElementById('faucet-btn');
    const btnText = document.getElementById('faucet-btn-text');

    if (AppState.faucet.lastClaim) {
        const elapsed = Date.now() - AppState.faucet.lastClaim;
        if (elapsed < AppState.faucet.cooldownMs) {
            indicator.classList.remove('available');
            indicator.classList.add('cooldown');
            statusText.textContent = 'Cooldown';
            timer.classList.remove('hidden');
            btn.disabled = true;
            btnText.textContent = 'Cooldown Active';
            btn.style.opacity = '0.5';
            startCooldownTimer();
            return;
        }
    }

    indicator.classList.add('available');
    indicator.classList.remove('cooldown');
    statusText.textContent = 'Available';
    timer.classList.add('hidden');
    btn.disabled = false;
    btnText.textContent = 'Claim Tokens';
    btn.style.opacity = '1';
}

function startCooldownTimer() {
    const timerEl = document.getElementById('timer-value');
    
    function update() {
        if (!AppState.faucet.lastClaim) return;
        const remaining = AppState.faucet.cooldownMs - (Date.now() - AppState.faucet.lastClaim);
        if (remaining <= 0) {
            updateFaucetUI();
            return;
        }
        const hours = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        timerEl.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        requestAnimationFrame(update);
    }
    update();
}

function updateFaucetHistory() {
    const container = document.getElementById('faucet-history');
    if (AppState.faucet.claims.length === 0) return;

    container.innerHTML = AppState.faucet.claims.slice(0, 5).map(claim => `
        <div class="claim-item">
            <div class="claim-item-left">
                <div class="claim-item-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </div>
                <div>
                    <span class="claim-item-amount">+${claim.amount} ARC</span>
                    <span class="claim-item-time">${formatTime(claim.timestamp)}</span>
                </div>
            </div>
        </div>
    `).join('');
}


// ===== LIVE TRANSACTIONS =====
function addTransaction(tx) {
    AppState.transactions.unshift(tx);
    if (AppState.transactions.length > 50) AppState.transactions.pop();
    renderTransactions();
}

function renderTransactions() {
    const container = document.getElementById('transactions-list');
    if (AppState.transactions.length === 0) {
        container.innerHTML = `
            <div class="tx-skeleton"><div class="skeleton-line w-8"></div><div class="skeleton-line w-20"></div><div class="skeleton-line w-16"></div><div class="skeleton-line w-16"></div><div class="skeleton-line w-12"></div><div class="skeleton-line w-10"></div></div>
            <div class="tx-skeleton"><div class="skeleton-line w-8"></div><div class="skeleton-line w-20"></div><div class="skeleton-line w-16"></div><div class="skeleton-line w-16"></div><div class="skeleton-line w-12"></div><div class="skeleton-line w-10"></div></div>
            <div class="tx-skeleton"><div class="skeleton-line w-8"></div><div class="skeleton-line w-20"></div><div class="skeleton-line w-16"></div><div class="skeleton-line w-16"></div><div class="skeleton-line w-12"></div><div class="skeleton-line w-10"></div></div>
        `;
        return;
    }

    container.innerHTML = AppState.transactions.slice(0, 20).map(tx => `
        <div class="tx-row">
            <div class="tx-status">
                <span class="tx-status-dot ${tx.status}"></span>
            </div>
            <span class="tx-hash">${shortenAddress(tx.hash)}</span>
            <span class="tx-address">${shortenAddress(tx.from)}</span>
            <span class="tx-address">${shortenAddress(tx.to)}</span>
            <span class="tx-amount">${tx.amount} ARC</span>
            <span class="tx-time">${formatTime(tx.timestamp)}</span>
        </div>
    `).join('');
}

function generateMockTransaction() {
    const amounts = [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0];
    return {
        hash: generateTxHash(),
        from: generateAddress(),
        to: generateAddress(),
        amount: amounts[Math.floor(Math.random() * amounts.length)].toFixed(4),
        timestamp: new Date(),
        status: Math.random() > 0.05 ? 'success' : 'pending'
    };
}

function startTransactionFeed() {
    // Generate initial transactions
    for (let i = 0; i < 8; i++) {
        const tx = generateMockTransaction();
        tx.timestamp = new Date(Date.now() - Math.random() * 600000);
        AppState.transactions.push(tx);
    }
    renderTransactions();

    // Auto-generate new transactions
    setInterval(() => {
        addTransaction(generateMockTransaction());
        AppState.stats.transactions++;
        updateStatsUI();
    }, 3000 + Math.random() * 4000);
}


// ===== STATS ANIMATION =====
function animateCounter(elementId, target, duration = 2000, prefix = '', suffix = '') {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const start = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const current = Math.floor(start + (target - start) * eased);
        el.textContent = prefix + formatNumber(current) + suffix;
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function initStats() {
    AppState.stats = {
        transactions: 12847,
        wallets: 3421,
        faucetClaims: 8932,
        tps: 142,
        volume: 284650,
    };
    updateStatsUI();
    
    // Animate hero stats
    animateCounter('hero-tps', 142, 1500);
    animateCounter('hero-wallets', 3421, 1800);
    animateCounter('hero-txns', 12847, 2000);
}

function updateStatsUI() {
    const s = AppState.stats;
    document.getElementById('stat-transactions').textContent = formatNumber(s.transactions);
    document.getElementById('stat-wallets').textContent = formatNumber(s.wallets);
    document.getElementById('stat-faucet').textContent = formatNumber(s.faucetClaims);
    document.getElementById('stat-tps').textContent = s.tps;
    document.getElementById('stat-volume').textContent = formatNumber(s.volume);
}

// Increment stats periodically
function startStatsUpdater() {
    setInterval(() => {
        AppState.stats.wallets += Math.floor(Math.random() * 3);
        AppState.stats.tps = 130 + Math.floor(Math.random() * 30);
        AppState.stats.volume += Math.floor(Math.random() * 50);
        updateStatsUI();
    }, 5000);
}

// ===== NAVIGATION =====
function toggleMobileNav() {
    document.getElementById('nav-links').classList.toggle('active');
}

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Navbar scroll effect
function initNavScroll() {
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        lastScroll = currentScroll;
    });
}

// Active nav link
function initActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 200;
            if (window.scrollY >= sectionTop) current = section.getAttribute('id');
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) link.classList.add('active');
        });
    });
}


// ===== PARTICLES BACKGROUND =====
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouse = { x: null, y: null };
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.3;
            this.vy = (Math.random() - 0.5) * 0.3;
            this.radius = Math.random() * 1.5 + 0.5;
            this.opacity = Math.random() * 0.4 + 0.1;
        }
        
        update() {
            this.x += this.vx;
            this.y += this.vy;
            
            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            
            // Mouse interaction
            if (mouse.x && mouse.y) {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    const force = (120 - dist) / 120 * 0.01;
                    this.vx -= dx * force;
                    this.vy -= dy * force;
                }
            }
            
            // Damping
            this.vx *= 0.999;
            this.vy *= 0.999;
        }
        
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(139, 92, 246, ${this.opacity})`;
            ctx.fill();
        }
    }
    
    // Create particles
    const count = Math.min(80, Math.floor(canvas.width * canvas.height / 15000));
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }
    
    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 150) {
                    const opacity = (1 - dist / 150) * 0.15;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(139, 92, 246, ${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        drawConnections();
        requestAnimationFrame(animate);
    }
    animate();
}


// ===== SCROLL ANIMATIONS (AOS-like) =====
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = entry.target.dataset.aosDelay || 0;
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, delay);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('[data-aos]').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        observer.observe(el);
    });
}

// ===== ETHEREUM WALLET LISTENERS =====
function initWalletListeners() {
    if (typeof window.ethereum !== 'undefined') {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                disconnectWallet();
            } else {
                AppState.wallet.address = accounts[0];
                updateWalletUI();
                showToast('info', 'Account Changed', `Switched to ${shortenAddress(accounts[0])}`);
            }
        });

        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
    }
}

// ===== KEYBOARD SHORTCUTS =====
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Close modal on Escape
        if (e.key === 'Escape') {
            closeWalletModal();
        }
    });
    
    // Close modal on overlay click
    document.getElementById('wallet-modal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeWalletModal();
        }
    });
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all systems
    initParticles();
    initNavScroll();
    initActiveNav();
    initScrollAnimations();
    initKeyboardShortcuts();
    initWalletListeners();
    
    // Load stats with animation
    setTimeout(initStats, 500);
    
    // Start live feeds
    setTimeout(startTransactionFeed, 1500);
    startStatsUpdater();
    
    // Check for saved wallet state
    const savedAddress = localStorage.getItem('arc_wallet_address');
    if (savedAddress) {
        AppState.wallet.connected = true;
        AppState.wallet.address = savedAddress;
        AppState.wallet.balance = localStorage.getItem('arc_wallet_balance') || '5.0000';
        updateWalletUI();
    }

    // Check faucet cooldown
    const lastClaim = localStorage.getItem('arc_faucet_lastClaim');
    if (lastClaim) {
        AppState.faucet.lastClaim = parseInt(lastClaim);
        updateFaucetUI();
    }

    console.log('%c ARC Testnet Dashboard ', 'background: linear-gradient(135deg, #a855f7, #06b6d4); color: white; font-size: 14px; padding: 8px 16px; border-radius: 4px; font-weight: bold;');
    console.log('%c Built with premium quality ', 'color: #94a3b8; font-size: 12px;');
});

// Save state on changes
function saveState() {
    if (AppState.wallet.connected) {
        localStorage.setItem('arc_wallet_address', AppState.wallet.address);
        localStorage.setItem('arc_wallet_balance', AppState.wallet.balance);
    } else {
        localStorage.removeItem('arc_wallet_address');
        localStorage.removeItem('arc_wallet_balance');
    }
    if (AppState.faucet.lastClaim) {
        localStorage.setItem('arc_faucet_lastClaim', AppState.faucet.lastClaim);
    }
}

// Auto-save every 5 seconds
setInterval(saveState, 5000);
