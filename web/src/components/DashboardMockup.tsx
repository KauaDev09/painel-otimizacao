import { useEffect, useState } from 'react';

/** Laudo ao vivo — foco único do hero (datasheet, sem “SaaS glass”). */
export default function DashboardMockup() {
  const [cpu, setCpu] = useState(40);
  const [gpu, setGpu] = useState(58);
  const [ram, setRam] = useState(4.6);
  const [temp, setTemp] = useState(60);
  const [fps, setFps] = useState(241);

  useEffect(() => {
    const id = setInterval(() => {
      setCpu(30 + Math.floor(Math.random() * 45));
      setGpu(40 + Math.floor(Math.random() * 40));
      setRam(3 + Math.random() * 3);
      setTemp(48 + Math.floor(Math.random() * 16));
      setFps(210 + Math.floor(Math.random() * 55));
    }, 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hero-stage">
      <div className="mockup mockup-sheet">
        <div className="mockup-bar">
          <div className="mockup-dots">
            <span className="r" />
            <span className="y" />
            <span className="g" />
          </div>
          <div className="mockup-title">leitura</div>
          <div className="mockup-title" style={{ marginLeft: 'auto' }}>
            <span className="mono svc-ind">{fps} fps</span>
          </div>
        </div>

        <div className="sheet-grid">
          <div className="sheet-cell">
            <div className="lab">CPU</div>
            <div className="val mono">
              {cpu}
              <small>%</small>
            </div>
          </div>
          <div className="sheet-cell">
            <div className="lab">GPU</div>
            <div className="val mono">
              {gpu}
              <small>%</small>
            </div>
          </div>
          <div className="sheet-cell">
            <div className="lab">RAM</div>
            <div className="val mono">
              {ram.toFixed(1)}
              <small>gb</small>
            </div>
          </div>
          <div className="sheet-cell">
            <div className="lab">Temp</div>
            <div className="val mono warn">
              {temp}
              <small>°c</small>
            </div>
          </div>
        </div>

        <div className="sheet-rows">
          <div className="sheet-row">
            <span className="k">Windows</span>
            <span className="v ok">limpo</span>
          </div>
          <div className="sheet-row">
            <span className="k">Inicialização</span>
            <span className="v warn">3 itens a mais</span>
          </div>
          <div className="sheet-row">
            <span className="k">GPU</span>
            <span className="v ok">ao vivo</span>
          </div>
          <div className="sheet-row">
            <span className="k">BIOS</span>
            <span className="v">somente leitura</span>
          </div>
        </div>
      </div>
    </div>
  );
}
