// ── Estado global ─────────────────────────────────────────
let client = null;
let pubTotal = 0;
let ultimoEnvio = [0,0,0,0];
const INTERVALO = 40;
const servoNames = ['Base','Hombro','Codo','Muñeca'];
const servoIcons = ['ti-rotate-clockwise','ti-arrow-up','ti-fold-up','ti-hand-grab'];
 
// ── Log ───────────────────────────────────────────────────
const logEl = document.getElementById('log');
function addLog(msg, tipo='inf') {
  const ts = new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const row = document.createElement('div');
  row.className = 'log-row';
  row.innerHTML = `<span class="log-ts">${ts}</span><span class="log-${tipo}">${msg}</span>`;
  logEl.prepend(row);
  while (logEl.children.length > 50) logEl.removeChild(logEl.lastChild);
}
function clearLog() { logEl.innerHTML = ''; }
 
// ── Device status ─────────────────────────────────────────
let deviceOnline = false;
let lastSeenInterval = null;
let connectedAt = null;
 
function setDevice(online) {
  deviceOnline = online;
  const dot   = document.getElementById('device-dot');
  const label = document.getElementById('device-label');
  const since = document.getElementById('device-since');
 
  if (online) {
    dot.className   = 'device-dot on';
    label.textContent = 'ESP32 — conectado';
    connectedAt     = Date.now();
    clearInterval(lastSeenInterval);
    lastSeenInterval = setInterval(() => {
      const secs = Math.floor((Date.now() - connectedAt) / 1000);
      since.textContent = `Activo hace ${secs}s`;
    }, 1000);
    addLog('ESP32 en línea', 'dev');
  } else {
    dot.className   = 'device-dot off';
    label.textContent = 'ESP32 — desconectado';
    clearInterval(lastSeenInterval);
    since.textContent = 'Sin señal';
    addLog('ESP32 fuera de línea', 'err');
  }
}
 
// ── Construir cards de servos ─────────────────────────────
function buildCards() {
  const grid = document.getElementById('servo-grid');
  grid.innerHTML = '';
  const arcLen = (Math.PI * 58).toFixed(1);
  const arcHalf = (Math.PI * 29).toFixed(1);
 
  for (let i = 1; i <= 4; i++) {
    grid.innerHTML += `
    <div class="servo-card" id="card${i}">
      <div class="servo-header">
        <div class="servo-title">
          <i class="ti ${servoIcons[i-1]}" style="font-size:14px;color:#7c6aaa;" aria-hidden="true"></i>
          Servo ${i} — ${servoNames[i-1]}
        </div>
        <div class="servo-angle">
          <span class="num" id="num${i}">90</span>
          <span class="deg">°</span>
        </div>
      </div>
      <div class="arc-wrap">
        <svg width="140" height="82" viewBox="0 0 140 82" role="img" aria-label="Ángulo servo ${i}">
          <path class="arc-bg-s"   d="M 12,70 A 58,58 0 0,1 128,70"/>
          <path class="arc-fill-s" id="arc${i}"
                d="M 12,70 A 58,58 0 0,1 128,70"
                stroke-dasharray="${arcLen}" stroke-dashoffset="${arcHalf}"/>
          <line id="needle${i}" x1="70" y1="70" x2="70" y2="16"
                stroke="#a78bff" stroke-width="2" stroke-linecap="round" class="needle-s"/>
          <circle cx="70" cy="70" r="4" fill="#7c6aff"/>
          <text x="10"  y="80" font-size="9" fill="#4a3f6b">0°</text>
          <text x="62"  y="12" font-size="9" fill="#4a3f6b">90°</text>
          <text x="118" y="80" font-size="9" fill="#4a3f6b" text-anchor="end">180°</text>
        </svg>
      </div>
      <input type="range" min="0" max="180" value="90" step="1"
             id="slider${i}" oninput="mover(${i}, this.value)"/>
      <div class="slider-ticks"><span>0°</span><span>90°</span><span>180°</span></div>
      <div class="presets">
        <button class="preset" onclick="irA(${i},0)">0°</button>
        <button class="preset" onclick="irA(${i},45)">45°</button>
        <button class="preset" onclick="irA(${i},90)">90°</button>
        <button class="preset" onclick="irA(${i},135)">135°</button>
        <button class="preset" onclick="irA(${i},180)">180°</button>
      </div>
    </div>`;
  }
}
 
// ── Ángulo visual ─────────────────────────────────────────
function updateAngle(i, val) {
  const v = parseInt(val);
  const arcLen = Math.PI * 58;
  document.getElementById('num'    + i).textContent = v;
  document.getElementById('arc'    + i).style.strokeDashoffset = (arcLen - (v/180)*arcLen).toFixed(1);
  document.getElementById('needle' + i).style.transform = `rotate(${-90 + v}deg)`;
}
 
// ── Mover servo ───────────────────────────────────────────
function mover(servo, valor) {
  updateAngle(servo, valor);
  const ahora = Date.now();
  if (ahora - ultimoEnvio[servo-1] > INTERVALO && client && client.connected) {
    client.publish('brazo/manual/servo' + servo, String(valor));
    ultimoEnvio[servo-1] = ahora;
    pubTotal++;
    document.getElementById('pub-total').textContent = pubTotal;
    const card = document.getElementById('card' + servo);
    card.classList.add('pulse');
    setTimeout(() => card.classList.remove('pulse'), 300);
    addLog(`Servo ${servo} (${servoNames[servo-1]}) → ${valor}°`, 'ok');
  }
}
 
function irA(servo, val) {
  document.getElementById('slider' + servo).value = val;
  updateAngle(servo, val);
  if (client && client.connected) {
    client.publish('brazo/manual/servo' + servo, String(val));
    pubTotal++;
    document.getElementById('pub-total').textContent = pubTotal;
    addLog(`Preset servo ${servo} → ${val}°`, 'ok');
  }
}
 
function resetAll() {
  for (let i = 1; i <= 4; i++) irA(i, 90);
  addLog('Todos centrados a 90°', 'inf');
}
 
function setModo(modo) {
  document.getElementById('btn-manual').classList.toggle('active', modo==='manual');
  document.getElementById('btn-auto').classList.toggle('active', modo==='auto');
  if (client && client.connected) client.publish('brazo/modo', modo);
  addLog(`Modo → ${modo}`, 'inf');
}
 
// ── Conectar con credenciales ─────────────────────────────
const MQTT_HOST = '41287df21912452aa44d6b4f228a5f6d.s1.eu.hivemq.cloud';
 
function conectar(user, pass) {
  if (!user) user = document.getElementById('inp-user').value.trim();
  if (!pass) pass = document.getElementById('inp-pass').value;
  const errEl = document.getElementById('login-err');
  errEl.style.display = 'none';
 
  if (!user || !pass) {
    errEl.textContent = 'Completa usuario y contraseña.';
    errEl.style.display = 'block';
    return;
  }
 
  const url = `wss://${MQTT_HOST}:8884/mqtt`;
  addLog('Conectando al broker…', 'inf');
 
  client = mqtt.connect(url, {
    username: user,
    password: pass,
    clientId: 'web_brazo_' + Math.random().toString(16).slice(2,8),
    connectTimeout: 6000,
    reconnectPeriod: 4000,
  });
 
  client.on('connect', () => {
    // Guardar credenciales para la próxima vez
    localStorage.setItem('brazo_user', user);
    localStorage.setItem('brazo_pass', pass);
 
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('main').style.display = 'flex';
    document.getElementById('main').style.flexDirection = 'column';
    document.getElementById('conn-badge').className = 'badge badge-ok';
    document.getElementById('conn-badge').innerHTML = '<i class="ti ti-wifi" style="font-size:12px"></i> Conectado';
 
    client.subscribe('brazo/status');
    addLog('Broker conectado', 'ok');
    buildCards();
  });
 
  client.on('error', (e) => {
    // Si falla con credenciales guardadas, borrarlas
    localStorage.removeItem('brazo_user');
    localStorage.removeItem('brazo_pass');
    errEl.textContent = 'No se pudo conectar. Verifica usuario y contraseña.';
    errEl.style.display = 'block';
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('main').style.display = 'none';
    document.getElementById('conn-badge').className = 'badge badge-err';
    document.getElementById('conn-badge').innerHTML = '<i class="ti ti-wifi-off" style="font-size:12px"></i> Error';
    addLog('Error de conexión: ' + (e.message || ''), 'err');
    client.end();
  });
 
  client.on('offline', () => {
    document.getElementById('conn-badge').className = 'badge badge-warn';
    document.getElementById('conn-badge').innerHTML = '<i class="ti ti-wifi-off" style="font-size:12px"></i> Desconectado';
    addLog('Broker desconectado', 'err');
  });
 
  client.on('message', (topic, payload) => {
    const msg = payload.toString();
    if (topic === 'brazo/status') {
      setDevice(msg === 'online');
    }
  });
}
 
// ── Auto-login al cargar ──────────────────────────────────
(function autoLogin() {
  const user = localStorage.getItem('brazo_user');
  const pass = localStorage.getItem('brazo_pass');
  if (user && pass) {
    // Ocultar login de inmediato, sin esperar al evento load
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('inp-user').value = user;
    document.getElementById('inp-pass').value = pass;
    conectar(user, pass);
  }
})();
 
// ── Logout ────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('brazo_user');
  localStorage.removeItem('brazo_pass');
  if (client) { client.end(); client = null; }
  clearInterval(lastSeenInterval);
  document.getElementById('main').style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('inp-user').value = '';
  document.getElementById('inp-pass').value = '';
  addLog('Sesión cerrada', 'inf');
}
