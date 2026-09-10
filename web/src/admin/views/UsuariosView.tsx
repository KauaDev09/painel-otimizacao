import { useEffect, useState } from 'react';
import { adminCall } from '../api';
import { PageHeading, TableEmpty, TableLoading } from '../components';
import { fmtDate } from '../utils';

type User = {
  id: number;
  nome?: string;
  licencas?: number;
  criado_em?: string;
  ativo?: boolean;
};

export default function UsuariosView() {
  const [users, setUsers] = useState<User[] | null>(null);

  useEffect(() => {
    adminCall<{ users: User[] }>('/api/v1/admin/users')
      .then((j) => setUsers(j.users || []))
      .catch(() => setUsers([]));
  }, []);

  return (
    <>
      <PageHeading title="Usuários" desc="Contas cadastradas na plataforma" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Usuário</th>
              <th>Licenças</th>
              <th>Criado em</th>
              <th>Ativo</th>
            </tr>
          </thead>
          <tbody>
            {users === null ? (
              <TableLoading cols={6} title="Carregando usuários…" />
            ) : users.length === 0 ? (
              <TableEmpty cols={6} title="Nenhum usuário" desc="As contas da loja aparecerão aqui." />
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.nome}</td>
                  <td>{u.nome}</td>
                  <td>{u.licencas}</td>
                  <td>{fmtDate(u.criado_em)}</td>
                  <td>{u.ativo ? 'Sim' : 'Não'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
