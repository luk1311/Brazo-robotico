// ── MQTT ────────────────────────────────────────────────────
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
let ultimoEnvio = [0, 0, 0, 0];
const INTERVALO = 40;
let pubTotal = 0;

const badge = document.getElementById('conn-badge');
const pubTotalEl = document.getElementById('pub-total');

client.on("connect", () => {
  badge.className = 'badge badge-ok';
  badge.innerHTML = '<i class="ti ti-wifi" style="font-size:12px"></i> Conectado';
  addLog('Conectado a broker.hivemq.com', 'ok');
});
client.on("error",   () => { badge.className='badge badge-err'; badge.innerHTML='<i class="ti ti-wifi-off" style="font-size:12px"></i> Error';        addLog('Error de conexión','err'); });
client.on("offline", () => { badge.className='badge badge-warn';badge.innerHTML='<i class="ti ti-wifi-off" style="font-size:12px"></i> Desconectado'; addLog('Desconectado','err'); });

// ── LOG ─────────────────────────────────────────────────────
const logEl = document.getElementById('log');
function addLog(msg, tipo='inf') {
  const ts = new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const row = document.createElement('div');
  row.className = 'log-row';
  row.innerHTML = `<span class="log-ts">${ts}</span><span class="log-${tipo}">${msg}</span>`;
  logEl.prepend(row);
  while (logEl.children.length > 40) logEl.removeChild(logEl.lastChild);
}
function clearLog() { logEl.innerHTML = ''; }

// ── SERVO NAMES ─────────────────────────────────────────────
const servoNames = ['Base', 'Hombro', 'Codo', 'Muñeca'];
const servoIcons = ['ti-rotate-clockwise','ti-arrow-up','ti-fold-up','ti-hand-grab'];

// ── BUILD CARDS ─────────────────────────────────────────────
const grid = document.getElementById('servo-grid');

for (let i = 1; i <= 4; i++) {
  const arcR = 58, arcCx = 70, arcCy = 70;
  const arcLen = Math.PI * arcR; // semicircle = πr ≈ 182

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
        <path class="arc-bg-s"   d="M 12,70 A ${arcR},${arcR} 0 0,1 128,70"/>
        <path class="arc-fill-s" id="arc${i}"
              d="M 12,70 A ${arcR},${arcR} 0 0,1 128,70"
              stroke-dasharray="${arcLen.toFixed(1)}"
              stroke-dashoffset="${(arcLen/2).toFixed(1)}"/>
        <line id="needle${i}" x1="70" y1="70" x2="70" y2="16"
              stroke="#a78bff" stroke-width="2" stroke-linecap="round" class="needle-s"/>
        <circle cx="70" cy="70" r="4" fill="#7c6aff"/>
        <text x="10" y="80" font-size="9" fill="#4a3f6b">0°</text>
        <text x="62" y="12" font-size="9" fill="#4a3f6b">90°</text>
        <text x="118" y="80" font-size="9" fill="#4a3f6b" text-anchor="end">180°</text>
      </svg>
    </div>

    <input type="range" min="0" max="180" value="90" step="1"
           id="slider${i}"
           oninput="mover(${i}, this.value)"/>
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

// ── ANGLE UPDATE ────────────────────────────────────────────
function updateAngle(i, val) {
  const v = parseInt(val);
  const arcLen = Math.PI * 58;
  document.getElementById('num'    + i).textContent = v;
  document.getElementById('arc'    + i).style.strokeDashoffset = (arcLen - (v/180)*arcLen).toFixed(1);
  document.getElementById('needle' + i).style.transform = `rotate(${-90 + v}deg)`;
}

// ── MOVER ────────────────────────────────────────────────────
function mover(servo, valor) {
  updateAngle(servo, valor);
  const ahora = Date.now();
  if (ahora - ultimoEnvio[servo-1] > INTERVALO) {
    client.publish("brazo/manual/servo" + servo, String(valor));
    ultimoEnvio[servo-1] = ahora;
    pubTotal++;
    pubTotalEl.textContent = pubTotal;
    document.getElementById('card' + servo).classList.add('active');
    setTimeout(() => document.getElementById('card' + servo).classList.remove('active'), 300);
    addLog(`Servo ${servo} (${servoNames[servo-1]}) → ${valor}°`, 'ok');
  }
}

// ── PRESET ───────────────────────────────────────────────────
function irA(servo, val) {
  document.getElementById('slider' + servo).value = val;
  updateAngle(servo, val);
  client.publish("brazo/manual/servo" + servo, String(val));
  pubTotal++;
  pubTotalEl.textContent = pubTotal;
  addLog(`Preset servo ${servo} → ${val}°`, 'ok');
}

// ── RESET ALL ────────────────────────────────────────────────
function resetAll() {
  for (let i = 1; i <= 4; i++) irA(i, 90);
  addLog('Todos los servos centrados a 90°', 'inf');
}

// ── MODO ─────────────────────────────────────────────────────
function setModo(modo) {
  document.getElementById('btn-manual').classList.toggle('active', modo==='manual');
  document.getElementById('btn-auto').classList.toggle('active', modo==='auto');
  client.publish("brazo/modo", modo);
  addLog(`Modo → ${modo}`, 'inf');
}