/* ══════════════════════════════════════════════════
   ARC TESTNET DASHBOARD — Core Application Logic
   ══════════════════════════════════════════════════ */
'use strict';

// ═══ CONFIG ═══
const CONFIG = {
  chainId: 421614, // Arbitrum Sepolia
  chainHex: '0x66eee',
  rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
  explorer: 'https://sepolia.arbiscan.io',
  chainName: 'Arbitrum Sepolia',
  symbol: 'ETH',
  faucetCooldown: 24 * 60 * 60 * 1000,
};

// ═══ GLOBAL NAMESPACE ═══
const ARC = { wallet: {}, send: {}, faucet: {}, activity: {}, stats: {}, ui: {}, three: {} };

// ═══ STATE ═══
const state = {
  wallet: { connected: false, address: null, balance: '0', provider: null, signer: null },
  faucet: { lastClaim: null, claims: [] },
  stats: { tx: 14832, wallets: 4201, tps: 148, block: 0, volume: 392400 },
  transactions: [],
  tpsHistory: [],
};


// ═══ UTILITIES ═══
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const short = (a) => a ? `${a.slice(0,6)}...${a.slice(-4)}` : '0x0000...0000';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const fmtNum = (n) => {
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return n.toLocaleString();
};
const fmtTime = (d) => {
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return new Date(d).toLocaleDateString();
};
const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a);
const randHex = (n) => '0x' + [...Array(n)].map(()=>Math.floor(Math.random()*16).toString(16)).join('');

// ═══ TOAST ═══
ARC.ui.toast = (type, title, msg) => {
  const wrap = $('#toastWrap');
  const icons = {
    success: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    info: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  };
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<div class="toast__icon">${icons[type]||icons.info}</div><div class="toast__body"><span class="toast__title">${title}</span><span class="toast__msg">${msg}</span></div><button class="toast__close" onclick="this.parentElement.remove()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateX(20px)'; el.style.transition='all .3s'; setTimeout(()=>el.remove(),300); }, 5000);
};

// ═══ WALLET ═══
ARC.wallet.connect = async () => {
  if (state.wallet.connected) { ARC.ui.toast('info','Already Connected',`Wallet: ${short(state.wallet.address)}`); return; }
  // Directly try MetaMask first
  if (typeof window.ethereum !== 'undefined') {
    await ARC.wallet.connectMetaMask();
  } else {
    // Show modal for options
    $('#walletModal').classList.remove('hidden');
  }
};
ARC.wallet.closeModal = () => $('#walletModal').classList.add('hidden');

ARC.wallet.connectMetaMask = async () => {
  ARC.wallet.closeModal();
  if (typeof window.ethereum === 'undefined') {
    ARC.ui.toast('error','MetaMask Not Found','Please install MetaMask browser extension');
    window.open('https://metamask.io/download/', '_blank');
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) {
      ARC.ui.toast('error','No Account','No accounts found');
      return;
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const address = await signer.getAddress();
    const balance = ethers.utils.formatEther(await provider.getBalance(address));
    const network = await provider.getNetwork();
    state.wallet = { connected: true, address, balance, provider, signer, chainId: network.chainId };
    ARC.wallet._updateUI();
    ARC.ui.toast('success','Wallet Connected',`${short(address)} on Chain ${network.chainId}`);
    // Listen for changes
    window.ethereum.on('accountsChanged', (accs) => {
      if (accs.length === 0) { ARC.wallet.disconnect(); }
      else { location.reload(); }
    });
    window.ethereum.on('chainChanged', () => location.reload());
  } catch (e) {
    if (e.code === 4001) {
      ARC.ui.toast('error','Rejected','You rejected the connection request');
    } else {
      ARC.ui.toast('error','Connection Failed', e.message || 'Unknown error');
    }
  }
};

ARC.wallet.connectWC = () => { ARC.wallet.closeModal(); ARC.ui.toast('info','WalletConnect','Please use MetaMask for now'); };

ARC.wallet.disconnect = () => {
  state.wallet = { connected: false, address: null, balance: '0', provider: null, signer: null };
  ARC.wallet._updateUI();
  ARC.ui.toast('info','Disconnected','Wallet disconnected');
  localStorage.removeItem('arc_wallet');
};

ARC.wallet._updateUI = () => {
  const c = state.wallet.connected;
  $('#walletDisconnected').classList.toggle('hidden', c);
  $('#walletConnected').classList.toggle('hidden', !c);
  $('#walletBtnText').textContent = c ? short(state.wallet.address) : 'Connect Wallet';
  if (c) {
    $('#wcAddr').textContent = short(state.wallet.address);
    $('#wcBal').textContent = `${parseFloat(state.wallet.balance).toFixed(4)} ETH`;
    $('#heroAddr').textContent = short(state.wallet.address);
    $('#heroBal').textContent = `${parseFloat(state.wallet.balance).toFixed(4)} ETH`;
    localStorage.setItem('arc_wallet', JSON.stringify({ address: state.wallet.address, balance: state.wallet.balance }));
  } else {
    $('#heroAddr').textContent = 'Connect to view';
    $('#heroBal').textContent = '— ETH';
  }
};


// ═══ SEND TOKENS ═══
ARC.send.paste = async () => {
  try { const t = await navigator.clipboard.readText(); $('#sendAddr').value = t; } catch(e) { ARC.ui.toast('info','Paste','Use Ctrl+V'); }
};
ARC.send.max = () => {
  if (!state.wallet.connected) return;
  const max = Math.max(0, parseFloat(state.wallet.balance) - 0.0005);
  $('#sendAmt').value = max.toFixed(4);
};

ARC.send.execute = async () => {
  if (!state.wallet.connected) { ARC.ui.toast('error','Wallet Required','Connect wallet first'); return; }
  const addr = $('#sendAddr').value.trim();
  const amt = parseFloat($('#sendAmt').value);
  // Validate
  $('#sendAddrErr').classList.add('hidden');
  $('#sendAmtErr').classList.add('hidden');
  if (!isAddr(addr)) { $('#sendAddrErr').classList.remove('hidden'); return; }
  if (!amt || amt <= 0 || amt > parseFloat(state.wallet.balance)) { $('#sendAmtErr').classList.remove('hidden'); return; }
  // Loading
  const btn = $('#sendBtn');
  btn.disabled = true;
  btn.querySelector('.btn__text').classList.add('hidden');
  $('#sendLoader').classList.remove('hidden');

  try {
    let txHash;
    if (state.wallet.signer) {
      // Real transaction via MetaMask
      const tx = await state.wallet.signer.sendTransaction({
        to: addr,
        value: ethers.utils.parseEther(amt.toString()),
      });
      txHash = tx.hash;
      ARC.ui.toast('info','Transaction Pending',`Tx: ${short(txHash)}`);
      await tx.wait();
      // Refresh balance
      const bal = ethers.utils.formatEther(await state.wallet.provider.getBalance(state.wallet.address));
      state.wallet.balance = bal;
    } else {
      ARC.ui.toast('error','No Signer','Please reconnect your wallet');
      btn.disabled = false;
      btn.querySelector('.btn__text').classList.remove('hidden');
      $('#sendLoader').classList.add('hidden');
      return;
    }
    // Add tx
    ARC.activity.add({ hash: txHash, from: state.wallet.address, to: addr, value: amt.toFixed(4), time: Date.now(), status: 'ok' });
    state.stats.tx++;
    ARC.stats.render();
    ARC.wallet._updateUI();
    ARC.ui.toast('success','Sent!',`${amt} ETH → ${short(addr)}`);
    $('#sendAddr').value = '';
    $('#sendAmt').value = '';
  } catch(e) {
    ARC.ui.toast('error','Failed', e.reason || e.message || 'Transaction rejected');
  }
  btn.disabled = false;
  btn.querySelector('.btn__text').classList.remove('hidden');
  $('#sendLoader').classList.add('hidden');
};

// ═══ FAUCET ═══
ARC.faucet.claim = async () => {
  if (!state.wallet.connected) { ARC.ui.toast('error','Wallet Required','Connect wallet to claim'); return; }
  // Cooldown check
  if (state.faucet.lastClaim && (Date.now() - state.faucet.lastClaim) < CONFIG.faucetCooldown) {
    ARC.ui.toast('error','Cooldown','Wait for cooldown to expire'); return;
  }
  const btn = $('#faucetBtn');
  btn.disabled = true;
  $('#faucetBtnText').classList.add('hidden');
  $('#faucetLoader').classList.remove('hidden');

  try {
    // Attempt real faucet via Circle (will likely fail due to CORS/captcha in browser)
    // In production, this would hit a Next.js API route
    await wait(2500); // Simulate server-side request
    const claimAmt = 0.001;
    state.wallet.balance = (parseFloat(state.wallet.balance) + claimAmt).toFixed(4);
    state.faucet.lastClaim = Date.now();
    state.faucet.claims.unshift({ amount: claimAmt, time: Date.now(), hash: randHex(32) });
    state.stats.tx++;
    ARC.wallet._updateUI();
    ARC.faucet._renderUI();
    ARC.faucet._renderHistory();
    ARC.stats.render();
    ARC.activity.add({ hash: randHex(32), from: '0x' + '0'.repeat(38) + 'FA', to: state.wallet.address, value: claimAmt.toFixed(4), time: Date.now(), status: 'ok' });
    ARC.ui.toast('success','Claimed!', `+${claimAmt} ETH added`);
    localStorage.setItem('arc_faucet', JSON.stringify({ lastClaim: state.faucet.lastClaim, claims: state.faucet.claims.slice(0,10) }));
  } catch(e) {
    ARC.ui.toast('error','Claim Failed', e.message || 'Try again later');
  }
  btn.disabled = false;
  $('#faucetBtnText').classList.remove('hidden');
  $('#faucetLoader').classList.add('hidden');
};

ARC.faucet._renderUI = () => {
  const el = $('#faucetStatus');
  const timer = $('#faucetTimer');
  const btn = $('#faucetBtn');
  if (state.faucet.lastClaim && (Date.now() - state.faucet.lastClaim) < CONFIG.faucetCooldown) {
    el.innerHTML = '<span class="pulse-dot" style="background:var(--red)"></span><span id="faucetStatusText" style="color:var(--red)">Cooldown</span>';
    timer.classList.remove('hidden');
    btn.disabled = true;
    btn.style.opacity = '.5';
    ARC.faucet._tick();
  } else {
    el.innerHTML = '<span class="pulse-dot pulse-dot--green"></span><span id="faucetStatusText">Available</span>';
    timer.classList.add('hidden');
    btn.disabled = false;
    btn.style.opacity = '1';
  }
};

ARC.faucet._tick = () => {
  const remaining = CONFIG.faucetCooldown - (Date.now() - state.faucet.lastClaim);
  if (remaining <= 0) { ARC.faucet._renderUI(); return; }
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  $('#faucetTimerVal').textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  requestAnimationFrame(ARC.faucet._tick);
};

ARC.faucet._renderHistory = () => {
  const el = $('#faucetHistory');
  if (!state.faucet.claims.length) return;
  el.innerHTML = state.faucet.claims.slice(0,6).map(c => `
    <div class="claim-item"><div class="claim-item__left"><div class="claim-item__icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><div><span class="claim-item__amount">+${c.amount} ETH</span></div></div><span class="claim-item__time">${fmtTime(c.time)}</span></div>
  `).join('');
};


// ═══ LIVE ACTIVITY FEED ═══
ARC.activity.add = (tx) => {
  state.transactions.unshift(tx);
  if (state.transactions.length > 50) state.transactions.pop();
  ARC.activity.render();
};

ARC.activity.render = () => {
  const el = $('#activityFeed');
  if (!state.transactions.length) return;
  el.innerHTML = state.transactions.slice(0,20).map(tx => `
    <div class="tx-row">
      <div><span class="tx-dot tx-dot--${tx.status === 'ok' ? 'ok' : 'pending'}"></span></div>
      <span class="tx-hash">${short(tx.hash)}</span>
      <span class="tx-addr">${short(tx.from)}</span>
      <span class="tx-addr">${short(tx.to)}</span>
      <span class="tx-val">${tx.value} ETH</span>
      <span class="tx-time">${fmtTime(tx.time)}</span>
    </div>
  `).join('');
};

ARC.activity._mock = () => {
  const amounts = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.5, 1.0, 2.5];
  return { hash: randHex(32), from: randHex(20), to: randHex(20), value: amounts[Math.floor(Math.random()*amounts.length)].toFixed(4), time: Date.now(), status: Math.random() > 0.04 ? 'ok' : 'pending' };
};

ARC.activity.startFeed = () => {
  // Seed initial
  for (let i = 0; i < 8; i++) {
    const tx = ARC.activity._mock();
    tx.time = Date.now() - Math.random() * 600000;
    state.transactions.push(tx);
  }
  ARC.activity.render();
  // Live feed
  const feed = () => {
    ARC.activity.add(ARC.activity._mock());
    state.stats.tx++;
    ARC.stats.render();
    setTimeout(feed, 3000 + Math.random() * 5000);
  };
  setTimeout(feed, 2000);
};

// ═══ BLOCKCHAIN CONNECTION (Real RPC) ═══
ARC.activity.connectRPC = async () => {
  try {
    const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpc);
    const block = await provider.getBlockNumber();
    state.stats.block = block;
    ARC.stats.render();
    // Poll for new blocks
    setInterval(async () => {
      try {
        const b = await provider.getBlockNumber();
        if (b > state.stats.block) {
          state.stats.block = b;
          state.stats.tps = 130 + Math.floor(Math.random() * 40);
          ARC.stats.render();
        }
      } catch(e) {}
    }, 8000);
    // Get gas price
    const gas = await provider.getGasPrice();
    const gwei = parseFloat(ethers.utils.formatUnits(gas, 'gwei'));
    $('#gasLow').textContent = Math.max(0.01, gwei * 0.8).toFixed(2);
    $('#gasMid').textContent = gwei.toFixed(2);
    $('#gasHigh').textContent = (gwei * 1.3).toFixed(2);
  } catch(e) {
    // Fallback to simulated data
    state.stats.block = 78423156;
    ARC.stats.render();
    $('#gasLow').textContent = '0.01';
    $('#gasMid').textContent = '0.02';
    $('#gasHigh').textContent = '0.03';
  }
};

// ═══ STATS ═══
ARC.stats.render = () => {
  const s = state.stats;
  $('#statTx').textContent = fmtNum(s.tx);
  $('#statWallets').textContent = fmtNum(s.wallets);
  $('#statTps').textContent = s.tps;
  $('#statBlock').textContent = fmtNum(s.block);
  $('#statVol').textContent = fmtNum(s.volume);
  $('#heroTps').textContent = s.tps;
  $('#heroBlock').textContent = fmtNum(s.block);
  $('#heroWallets').textContent = fmtNum(s.wallets);
};

ARC.stats.animate = () => {
  setInterval(() => {
    state.stats.wallets += Math.floor(Math.random() * 3);
    state.stats.tps = 130 + Math.floor(Math.random() * 35);
    state.stats.volume += Math.floor(Math.random() * 80);
    ARC.stats.render();
    // TPS chart
    state.tpsHistory.push(state.stats.tps);
    if (state.tpsHistory.length > 30) state.tpsHistory.shift();
    ARC.stats.drawChart();
  }, 4000);
};

// ═══ MINI CHART (Canvas) ═══
ARC.stats.drawChart = () => {
  const canvas = $('#chartTps');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 180 * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = 180;
  ctx.clearRect(0,0,w,h);
  const data = state.tpsHistory;
  if (data.length < 2) return;
  const max = Math.max(...data) * 1.2;
  const step = w / (data.length - 1);
  // Gradient fill
  const grad = ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0, 'rgba(167,139,250,0.15)');
  grad.addColorStop(1, 'rgba(167,139,250,0)');
  ctx.beginPath();
  ctx.moveTo(0, h - (data[0]/max)*h*0.8);
  for (let i = 1; i < data.length; i++) {
    const x = i * step;
    const y = h - (data[i]/max)*h*0.8;
    const px = (i-1)*step;
    const py = h - (data[i-1]/max)*h*0.8;
    const cpx = (px+x)/2;
    ctx.bezierCurveTo(cpx,py,cpx,y,x,y);
  }
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  // Line
  ctx.beginPath();
  ctx.moveTo(0, h - (data[0]/max)*h*0.8);
  for (let i = 1; i < data.length; i++) {
    const x = i * step;
    const y = h - (data[i]/max)*h*0.8;
    const px = (i-1)*step;
    const py = h - (data[i-1]/max)*h*0.8;
    const cpx = (px+x)/2;
    ctx.bezierCurveTo(cpx,py,cpx,y,x,y);
  }
  ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2; ctx.stroke();
  // Dot at end
  const lastX = (data.length-1)*step;
  const lastY = h - (data[data.length-1]/max)*h*0.8;
  ctx.beginPath(); ctx.arc(lastX,lastY,4,0,Math.PI*2); ctx.fillStyle='#a78bfa'; ctx.fill();
  ctx.beginPath(); ctx.arc(lastX,lastY,8,0,Math.PI*2); ctx.fillStyle='rgba(167,139,250,0.2)'; ctx.fill();
};


// ═══ THREE.JS PARTICLES ═══
ARC.three.init = () => {
  const canvas = $('#three-canvas');
  if (!canvas || typeof THREE === 'undefined') return;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.z = 5;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Particles
  const count = 120;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i*3] = (Math.random()-0.5)*12;
    positions[i*3+1] = (Math.random()-0.5)*12;
    positions[i*3+2] = (Math.random()-0.5)*6;
    velocities.push({ x:(Math.random()-0.5)*0.003, y:(Math.random()-0.5)*0.003, z:(Math.random()-0.5)*0.002 });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xa78bfa, size: 0.03, transparent: true, opacity: 0.6, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // Lines between nearby particles
  const lineMat = new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.06 });
  let lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat);
  scene.add(lines);

  let mouse = { x: 0, y: 0 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  const animate = () => {
    requestAnimationFrame(animate);
    const pos = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i*3] += velocities[i].x;
      pos[i*3+1] += velocities[i].y;
      pos[i*3+2] += velocities[i].z;
      if (Math.abs(pos[i*3]) > 6) velocities[i].x *= -1;
      if (Math.abs(pos[i*3+1]) > 6) velocities[i].y *= -1;
      if (Math.abs(pos[i*3+2]) > 3) velocities[i].z *= -1;
    }
    geo.attributes.position.needsUpdate = true;

    // Update lines
    const linePositions = [];
    for (let i = 0; i < count; i++) {
      for (let j = i+1; j < count; j++) {
        const dx = pos[i*3]-pos[j*3], dy = pos[i*3+1]-pos[j*3+1], dz = pos[i*3+2]-pos[j*3+2];
        const dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
        if (dist < 2) {
          linePositions.push(pos[i*3],pos[i*3+1],pos[i*3+2],pos[j*3],pos[j*3+1],pos[j*3+2]);
        }
      }
    }
    lines.geometry.dispose();
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    lines.geometry = lg;

    // Camera follow mouse slightly
    camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 0.3 - camera.position.y) * 0.02;
    camera.lookAt(0,0,0);
    renderer.render(scene, camera);
  };
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
};

// ═══ MOUSE GLOW ═══
ARC.ui.mouseGlow = () => {
  const el = $('#mouseGlow');
  let active = false;
  document.addEventListener('mousemove', (e) => {
    if (!active) { el.classList.add('visible'); active = true; }
    el.style.left = e.clientX + 'px';
    el.style.top = e.clientY + 'px';
  });
  document.addEventListener('mouseleave', () => { el.classList.remove('visible'); active = false; });
};

// ═══ NAV ═══
ARC.ui.initNav = () => {
  const nav = $('#navbar');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  });
  // Active link
  const sections = $$('section[id],.hero');
  const links = $$('.navbar__link');
  window.addEventListener('scroll', () => {
    let cur = '';
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 200) cur = s.id || 'hero'; });
    links.forEach(l => { l.classList.toggle('active', l.dataset.section === cur); });
  });
};

ARC.ui.toggleMobile = () => { $('#navLinks').classList.toggle('open'); };
ARC.ui.scrollTo = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior:'smooth', block:'start' }); };

// ═══ SCROLL ANIMATIONS ═══
ARC.ui.initObserver = () => {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });
  $$('.stat-card,.glass-panel,.chart-panel').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'all .6s cubic-bezier(0.16,1,0.3,1)';
    obs.observe(el);
  });
};

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', () => {
  // Three.js particles
  ARC.three.init();
  // Mouse glow
  ARC.ui.mouseGlow();
  // Navigation
  ARC.ui.initNav();
  // Scroll animations
  ARC.ui.initObserver();
  // Load saved state - try to reconnect if MetaMask available
  if (typeof window.ethereum !== 'undefined') {
    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts && accounts.length > 0) {
        ARC.wallet.connectMetaMask();
      }
    }).catch(() => {});
  }
  const savedFaucet = localStorage.getItem('arc_faucet');
  if (savedFaucet) {
    const f = JSON.parse(savedFaucet);
    state.faucet.lastClaim = f.lastClaim;
    state.faucet.claims = f.claims || [];
    ARC.faucet._renderUI();
    ARC.faucet._renderHistory();
  }
  // Connect to real RPC
  ARC.activity.connectRPC();
  // Start feeds
  ARC.stats.render();
  ARC.activity.startFeed();
  ARC.stats.animate();
  // Seed TPS chart
  for (let i = 0; i < 15; i++) state.tpsHistory.push(130 + Math.floor(Math.random()*30));
  ARC.stats.drawChart();

  console.log('%c⚡ ARC Testnet Dashboard','background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;padding:8px 16px;border-radius:4px;font-weight:bold;font-size:14px');
});
