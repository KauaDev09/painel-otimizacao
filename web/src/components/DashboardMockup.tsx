import { useEffect, useState } from 'react';

export default function DashboardMockup() {
  const [cpu, setCpu] = useState(40);
  const [gpu, setGpu] = useState(58);
  const [ram, setRam] = useState(4.6);
  const [temp, setTemp] = useState(60);
  const [fps, setFps] = useState(241);

  useEffect(() => {
    const tick = () => {
      setCpu(30 + Math.floor(Math.random() * 45));
      setGpu(40 + Math.floor(Math.random() * 40));
      setRam(3 + Math.random() * 3);
      setTemp(48 + Math.floor(Math.random() * 16));
      setFps(210 + Math.floor(Math.random() * 55));
    };
    const id = setInterval(tick, 1600);
    return () => clearInterval(id);
  }, []);

  const ramPct = Math.round((ram / 16) * 100);

  return (
    <div className="hero-stage">
      <div className="orbit" aria-hidden="true" />
      <div className="mockup mockup-pro" data-tilt="6" data-glare data-spotlight>
        <div className="mockup-bar">
          <div className="mockup-dots">
            <span className="r" />
            <span className="y" />
            <span className="g" />
          </div>
          <div className="mockup-title">
            <span className="mui">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="6" />
              </svg>
            </span>
            ORION <span className="mono">— painel</span>
          </div>
          <div className="mockup-title" style={{ marginLeft: 'auto' }}>
            <span className="mono svc-ind">latência 8ms</span>
          </div>
        </div>
        <div className="mockup-head">
          <div className="mh-title">
            Dashboard <span>· real-time</span>
          </div>
          <div className="mockup-tabs">
            <span className="on">Overview</span>
            <span>Processos</span>
            <span>Integridade</span>
          </div>
        </div>

        <div className="mockup-grid">
          <div className="mockup-card">
            <div className="lab">CPU</div>
            <div className="val">
              <span>{cpu}</span>
              <small>%</small>
            </div>
            <div className="meter">
              <i style={{ width: `${cpu}%` }} />
            </div>
          </div>
          <div className="mockup-card">
            <div className="lab">GPU</div>
            <div className="val">
              <span>{gpu}</span>
              <small>%</small>
            </div>
            <div className="meter">
              <i style={{ width: `${gpu}%` }} />
            </div>
          </div>
          <div className="mockup-card">
            <div className="lab">RAM</div>
            <div className="val">
              <span>{ram.toFixed(1)}</span>
              <small>GB</small>
            </div>
            <div className="meter">
              <i className="m-green" style={{ width: `${ramPct}%` }} />
            </div>
          </div>
          <div className="mockup-card">
            <div className="lab">Temp</div>
            <div className="val">
              <span>{temp}</span>
              <small>°C</small>
            </div>
            <div className="meter">
              <i style={{ width: `${temp}%` }} />
            </div>
          </div>
        </div>

        <div className="mockup-charts">
          <div className="mock-chart mock-chart-line">
            <div className="mch-head">
              <div>
                <div className="mch-title">Performance Overview</div>
                <div className="mch-metric">
                  <strong>{fps}</strong>
                  <span> FPS méd.</span>
                  <em className="mch-trend">↗ 18.2%</em>
                </div>
              </div>
              <div className="mch-select">Esta sessão</div>
            </div>
            <svg className="mch-svg" viewBox="0 0 420 160" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="orionLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="55%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
                <linearGradient id="orionAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
                  <stop offset="100%" stopColor="rgba(59,130,246,0)" />
                </linearGradient>
                <filter id="orionGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.2" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <g className="mch-grid" stroke="rgba(255,255,255,0.06)" strokeWidth="1">
                <line x1="36" y1="28" x2="400" y2="28" />
                <line x1="36" y1="64" x2="400" y2="64" />
                <line x1="36" y1="100" x2="400" y2="100" />
                <line x1="36" y1="136" x2="400" y2="136" />
              </g>
              <text className="mch-axis" x="8" y="32">
                300
              </text>
              <text className="mch-axis" x="8" y="68">
                200
              </text>
              <text className="mch-axis" x="8" y="104">
                100
              </text>
              <text className="mch-axis" x="14" y="140">
                0
              </text>
              <path
                className="mch-area"
                d="M36,118 C70,112 95,96 120,88 C150,78 170,92 200,70 C230,48 255,42 280,52 C310,64 335,38 360,34 C380,32 395,40 400,36 L400,136 L36,136 Z"
                fill="url(#orionAreaGrad)"
              />
              <path
                className="mch-line"
                d="M36,118 C70,112 95,96 120,88 C150,78 170,92 200,70 C230,48 255,42 280,52 C310,64 335,38 360,34 C380,32 395,40 400,36"
                fill="none"
                stroke="url(#orionLineGrad)"
                strokeWidth="2.6"
                filter="url(#orionGlow)"
                strokeLinecap="round"
              />
              <circle cx="120" cy="88" r="3.2" fill="#fff" />
              <circle cx="200" cy="70" r="3.2" fill="#fff" />
              <circle cx="280" cy="52" r="3.2" fill="#fff" />
              <circle cx="360" cy="34" r="3.8" fill="#fff" className="mch-pulse" />
              <g className="mch-tip" transform="translate(318,18)">
                <rect
                  width="78"
                  height="22"
                  rx="8"
                  fill="rgba(15,21,32,0.92)"
                  stroke="rgba(56,189,248,0.35)"
                />
                <text
                  x="39"
                  y="14.5"
                  textAnchor="middle"
                  fill="#e8eef7"
                  fontSize="10"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {fps} FPS
                </text>
              </g>
              <text className="mch-axis" x="50" y="154">
                0s
              </text>
              <text className="mch-axis" x="150" y="154">
                30s
              </text>
              <text className="mch-axis" x="250" y="154">
                60s
              </text>
              <text className="mch-axis" x="350" y="154">
                90s
              </text>
            </svg>
          </div>

          <div className="mock-chart mock-chart-donut">
            <div className="mch-title">System Load</div>
            <div className="donut-wrap">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="12"
                />
                <circle
                  className="donut-seg d-idle"
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="12"
                  strokeDasharray="168 96"
                  strokeDashoffset="0"
                  transform="rotate(-90 60 60)"
                />
                <circle
                  className="donut-seg d-game"
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="12"
                  strokeDasharray="48 216"
                  strokeDashoffset="-168"
                  transform="rotate(-90 60 60)"
                />
                <circle
                  className="donut-seg d-bg"
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="12"
                  strokeDasharray="28 236"
                  strokeDashoffset="-216"
                  transform="rotate(-90 60 60)"
                />
                <circle
                  className="donut-seg d-alert"
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke="#f472b6"
                  strokeWidth="12"
                  strokeDasharray="12 252"
                  strokeDashoffset="-244"
                  transform="rotate(-90 60 60)"
                />
                <text
                  x="60"
                  y="56"
                  textAnchor="middle"
                  fill="#e8eef7"
                  fontSize="22"
                  fontWeight="700"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  47
                </text>
                <text
                  x="60"
                  y="72"
                  textAnchor="middle"
                  fill="#8b9bb4"
                  fontSize="9"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  PROCESSOS
                </text>
              </svg>
            </div>
            <ul className="donut-legend">
              <li>
                <i className="c-cyan" />
                Idle / sistema <b>28</b>
              </li>
              <li>
                <i className="c-blue" />
                Jogos <b>8</b>
              </li>
              <li>
                <i className="c-indigo" />
                Background <b>9</b>
              </li>
              <li>
                <i className="c-pink" />
                Alertas <b>2</b>
              </li>
            </ul>
          </div>
        </div>

        <div className="mockup-status">
          <div className="mockup-status-head">
            <div className="s-title">
              SYSTEM <span>SECURE</span>
            </div>
            <div className="s-state">
              <span className="s-dot" />
              ONLINE
            </div>
          </div>
          <div className="mockup-status-body">
            <div className="ms-row">
              <span className="k">Windows</span>
              <span className="v">
                <span className="ok">●</span> limpo
              </span>
            </div>
            <div className="ms-row">
              <span className="k">Gaming</span>
              <span className="v">
                <span className="ok">●</span> pronto
              </span>
            </div>
            <div className="ms-row">
              <span className="k">Boot</span>
              <span className="v">
                <span className="ok">●</span> enxuto
              </span>
            </div>
            <div className="ms-row">
              <span className="k">Background</span>
              <span className="v">
                <span className="warn">●</span> 3 a mais
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
