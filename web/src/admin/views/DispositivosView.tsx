import { useEffect, useState } from 'react';
import { adminCall } from '../api';
import { Badge, ExpBadge, KeyMono, PageHeading, TableEmpty, TableLoading } from '../components';
import { fmtDate } from '../utils';

type Device = {
  hostname?: string;
  chave?: string;
  status?: string;
  expira_em?: string | null;
  primeiro_visto?: string;
  ultimo_visto?: string;
};

export default function DispositivosView() {
  const [devices, setDevices] = useState<Device[] | null>(null);

  useEffect(() => {
    adminCall<{ devices: Device[] }>('/api/v1/admin/devices')
      .then((j) => setDevices(j.devices || []))
      .catch(() => setDevices([]));
  }, []);

  return (
    <>
      <PageHeading title="Dispositivos" desc="Máquinas com licença ativada" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Hostname</th>
              <th>Licença</th>
              <th>Status licença</th>
              <th>Vence em</th>
              <th>Primeiro visto</th>
              <th>Último visto</th>
            </tr>
          </thead>
          <tbody>
            {devices === null ? (
              <TableLoading cols={6} title="Carregando dispositivos…" />
            ) : devices.length === 0 ? (
              <TableEmpty cols={6} title="Nenhum dispositivo ativado" desc="As máquinas com licença aparecerão aqui." />
            ) : (
              devices.map((d, i) => (
                <tr key={`${d.chave}-${i}`}>
                  <td>
                    <b>{d.hostname || '—'}</b>
                  </td>
                  <td>{d.chave ? <KeyMono value={d.chave} /> : '—'}</td>
                  <td>
                    <Badge status={d.status || ''} />
                  </td>
                  <td>
                    <ExpBadge exp={d.expira_em} />
                  </td>
                  <td>{fmtDate(d.primeiro_visto)}</td>
                  <td>{fmtDate(d.ultimo_visto)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
