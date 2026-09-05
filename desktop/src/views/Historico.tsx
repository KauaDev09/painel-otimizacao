import React from 'react';
import { History, RefreshCcw, GitCompareArrows, FileText, FileJson, ExternalLink, X, Check } from 'lucide-react';
import { useApi } from '@/api';

// ---------------------------------------------------------------------------
// Tipos locais (formato do historyService / reportService / raw:export)
// ---------------------------------------------------------------------------

interface HistoryHardware {
  cpu?: string | null;
  gpu?: string | null;
  ramTotalGB?: number | null;
  ramConfigMHz?: number | null;
  motherboard?: string | null;
  bios?: string | null;
}

interface HistoryCounts {
  recommended?: number;
  optional?: number;
  critical?: number;
  advanced?: number;
}

interface HistoryEntry {
  id: string;
  date: string | number;
  score: number;
  categories?: Record<string, number | null>;
  counts?: HistoryCounts;
  hardware?: HistoryHardware;
  bootMode?: string | null;
}

interface HistoryCompareResult {
  before: HistoryEntry;
  after: HistoryEntry;
  scoreDelta: number;
  categoriesDelta: Record<string, { before: number | null; after: number | null }>;
  countsDelta: { recommended: number; optional: number; critical: number };
  recommendationChanges?: { id: string; from: string; to: string }[];
}

interface ReportResult {
  htmlPath?: string;
  txtPath?: string;
  dir?: string;
}

interface LocalApi {
  historyList(): Promise<HistoryEntry[]>;
  historyCompare(before: string, after: string): Promise<HistoryCompareResult | null>;
  generateReport(): Promise<ReportResult | null>;
  exportRaw(): Promise<string | null>;
  openPath(path: string): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function short(s: unknown, n: number): string {
  if (s == null || s === '') return '—';
  const str = String(s);
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

function fmtDate(d: string | number | undefined): string {
  if (d == null) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('pt-BR');
}

function fmtDelta(d: number | null | undefined): string {
  if (d == null || Number.isNaN(d)) return '—';
  return d > 0 ? `+${d}` : String(d);
}

/** Cor do delta. `invert` = valor menor é melhor (ex.: contagem de críticas). */
function deltaClass(d: number | null | undefined, invert = false): string {
  if (d == null || d === 0) return 'text-muted-foreground';
  const good = invert ? d < 0 : d > 0;
  return good ? 'text-green-400' : 'text-red-400';
}

function errMsg(err: unknown, fallback: string): string {
  const m = (err as { message?: string })?.message;
  return m ? String(m) : fallback;
}

type Banner = { kind: 'ok' | 'err' | 'info'; text: string; path?: string } | null;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function Historico({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi() as unknown as LocalApi;
  const [list, setList] = React.useState<HistoryEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selection, setSelection] = React.useState<string[]>([]);
  const [compare, setCompare] = React.useState<HistoryCompareResult | null>(null);
  const [comparing, setComparing] = React.useState(false);
  const [reportBusy, setReportBusy] = React.useState(false);
  const [rawBusy, setRawBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<Banner>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.historyList();
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      setList([]);
      setBanner({ kind: 'err', text: errMsg(err, 'Não foi possível carregar o histórico.') });
    }
    setSelection([]);
    setCompare(null);
    setLoading(false);
  }, [api]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await api.historyList();
        if (alive) setList(Array.isArray(data) ? data : []);
      } catch (err) {
        if (alive) setBanner({ kind: 'err', text: errMsg(err, 'Não foi possível carregar o histórico.') });
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [api]);

  // Banner desaparece sozinho após alguns segundos (exceto quando tem caminho para abrir).
  React.useEffect(() => {
    if (!banner || banner.path) return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  const toggleSelect = (id: string) => {
    setSelection((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const next = [...prev, id];
      // Mantém no máximo 2 selecionadas: descarta a mais antiga (como no legado).
      while (next.length > 2) next.shift();
      return next;
    });
    setCompare(null);
  };

  const runCompare = async () => {
    if (selection.length !== 2 || comparing) return;
    setComparing(true);
    try {
      // A lista vem ordenada do mais recente para o mais antigo → índice maior = mais antigo.
      const [x, y] = selection;
      const ix = list.findIndex((e) => e.id === x);
      const iy = list.findIndex((e) => e.id === y);
      const [before, after] = ix > iy ? [x, y] : [y, x];
      const cmp = await api.historyCompare(before, after);
      if (!cmp) {
        setBanner({ kind: 'err', text: 'Não foi possível comparar as análises selecionadas.' });
        setCompare(null);
      } else {
        setCompare(cmp);
      }
    } catch (err) {
      setBanner({ kind: 'err', text: errMsg(err, 'Não foi possível comparar.') });
    }
    setComparing(false);
  };

  const generateReport = async () => {
    if (reportBusy) return;
    setReportBusy(true);
    try {
      const res = await api.generateReport();
      const target = res?.htmlPath || res?.dir || null;
      setBanner({
        kind: 'ok',
        text: target ? 'Relatório gerado com sucesso.' : 'Relatório gerado.',
        path: target || undefined,
      });
    } catch (err) {
      setBanner({ kind: 'err', text: errMsg(err, 'Não foi possível gerar o relatório. Execute uma análise primeiro.') });
    }
    setReportBusy(false);
  };

  const exportRaw = async () => {
    if (rawBusy) return;
    setRawBusy(true);
    try {
      const file = await api.exportRaw();
      setBanner({
        kind: 'ok',
        text: file ? 'Dados brutos exportados.' : 'Exportação concluída.',
        path: file || undefined,
      });
    } catch (err) {
      setBanner({ kind: 'err', text: errMsg(err, 'Não foi possível exportar os dados. Execute uma análise primeiro.') });
    }
    setRawBusy(false);
  };

  const openPath = async (p: string) => {
    try {
      await api.openPath(p);
    } catch (err) {
      setBanner({ kind: 'err', text: errMsg(err, 'Não foi possível abrir o arquivo.') });
    }
  };

  const secondaryBtn =
    'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:cursor-not-allowed disabled:opacity-60';
  const primaryBtn =
    'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)] disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="view-appear space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Histórico</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Análises anteriores deste computador. Selecione duas para comparar antes e depois.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runCompare}
            disabled={selection.length !== 2 || comparing}
            className={primaryBtn}
            title={selection.length !== 2 ? 'Selecione exatamente duas análises' : 'Comparar antes / depois'}
          >
            <GitCompareArrows className={'h-4 w-4 ' + (comparing ? 'animate-pulse' : '')} />
            {comparing ? 'Comparando…' : 'COMPARAR ANTES / DEPOIS'}
          </button>
          <button type="button" onClick={load} disabled={loading} className={secondaryBtn}>
            <RefreshCcw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
            ATUALIZAR
          </button>
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
            banner.kind === 'err'
              ? 'bg-red-500/10 text-red-300'
              : banner.kind === 'ok'
                ? 'bg-green-500/10 text-green-300'
                : 'bg-[var(--orion-selected-bg)] text-foreground'
          }`}
        >
          {banner.kind === 'ok' ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
          <div className="min-w-0 flex-1">
            <p className="m-0">{banner.text}</p>
            {banner.path && (
              <p className="m-0 mt-1 break-all font-mono text-xs text-muted-foreground">{banner.path}</p>
            )}
          </div>
          {banner.path && (
            <button
              type="button"
              onClick={() => openPath(banner.path as string)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              ABRIR
            </button>
          )}
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--orion-icon-default)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Análises anteriores</span>
          {list.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {selection.length}/2 selecionadas
            </span>
          )}
        </div>

        {loading && list.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
            <p className="text-sm text-muted-foreground">Carregando histórico…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="py-8 text-center">
            <p className="mb-3 text-sm text-muted-foreground">Nenhuma análise no histórico ainda.</p>
            {onNavigate && (
              <button type="button" onClick={() => onNavigate('dashboard')} className={primaryBtn}>
                EXECUTAR ANÁLISE
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-8 px-2 py-2" />
                  <th className="px-2 py-2">Data</th>
                  <th className="px-2 py-2">Score</th>
                  <th className="px-2 py-2">CPU</th>
                  <th className="px-2 py-2">RAM</th>
                  <th className="px-2 py-2">Placa-mãe</th>
                  <th className="px-2 py-2">BIOS</th>
                  <th className="px-2 py-2 text-center" title="Recomendadas">OK</th>
                  <th className="px-2 py-2 text-center" title="Opcionais">Méd</th>
                  <th className="px-2 py-2 text-center" title="Críticas">Alto</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => {
                  const sel = selection.includes(e.id);
                  const hw = e.hardware || {};
                  const c = e.counts || {};
                  return (
                    <tr
                      key={e.id}
                      onClick={() => toggleSelect(e.id)}
                      className={`cursor-pointer border-t border-[var(--orion-selected-bg)] transition-colors ${
                        sel ? 'bg-[var(--orion-selected-bg)]' : 'hover:bg-[var(--orion-selected-bg)]/50'
                      }`}
                    >
                      <td className="px-2 py-2.5">
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                            sel
                              ? 'border-[var(--orion-icon-active)] bg-[var(--orion-icon-active)] text-black'
                              : 'border-[var(--orion-hover-border)]'
                          }`}
                          aria-checked={sel}
                          role="checkbox"
                        >
                          {sel && <Check className="h-3 w-3" />}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-foreground">{fmtDate(e.date)}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-semibold text-foreground">{e.score}/100</td>
                      <td className="px-2 py-2.5 text-muted-foreground" title={hw.cpu || ''}>{short(hw.cpu, 34)}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-muted-foreground">
                        {hw.ramTotalGB ?? '—'} GB @ {hw.ramConfigMHz ?? '?'} MHz
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground" title={hw.motherboard || ''}>{short(hw.motherboard, 28)}</td>
                      <td className="px-2 py-2.5 text-muted-foreground" title={hw.bios || ''}>{short(hw.bios, 30)}</td>
                      <td className="px-2 py-2.5 text-center text-green-400">{c.recommended ?? 0}</td>
                      <td className="px-2 py-2.5 text-center text-amber-400">{c.optional ?? 0}</td>
                      <td className="px-2 py-2.5 text-center text-red-400">{c.critical ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Comparação */}
      {compare && (
        <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-[var(--orion-icon-default)]" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Antes → Depois</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2">Métrica</th>
                  <th className="px-2 py-2">Antes ({fmtDate(compare.before?.date)})</th>
                  <th className="px-2 py-2">Depois ({fmtDate(compare.after?.date)})</th>
                  <th className="px-2 py-2 text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--orion-selected-bg)]">
                  <td className="px-2 py-2 font-semibold text-foreground">Score geral</td>
                  <td className="px-2 py-2 text-muted-foreground">{compare.before?.score}/100</td>
                  <td className="px-2 py-2 text-muted-foreground">{compare.after?.score}/100</td>
                  <td className={`px-2 py-2 text-right font-semibold ${deltaClass(compare.scoreDelta)}`}>{fmtDelta(compare.scoreDelta)}</td>
                </tr>
                {Object.entries(compare.categoriesDelta || {}).map(([cat, d]) => {
                  const delta = (d.after ?? 0) - (d.before ?? 0);
                  return (
                    <tr key={cat} className="border-t border-[var(--orion-selected-bg)]">
                      <td className="px-2 py-2 text-foreground">{cat}</td>
                      <td className="px-2 py-2 text-muted-foreground">{d.before ?? '—'}%</td>
                      <td className="px-2 py-2 text-muted-foreground">{d.after ?? '—'}%</td>
                      <td className={`px-2 py-2 text-right font-semibold ${deltaClass(delta)}`}>{fmtDelta(delta)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t border-[var(--orion-selected-bg)]">
                  <td className="px-2 py-2 text-foreground">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-500" />Recomendadas
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{compare.before?.counts?.recommended ?? 0}</td>
                  <td className="px-2 py-2 text-muted-foreground">{compare.after?.counts?.recommended ?? 0}</td>
                  <td className={`px-2 py-2 text-right font-semibold ${deltaClass(compare.countsDelta?.recommended, true)}`}>
                    {fmtDelta(compare.countsDelta?.recommended)}
                  </td>
                </tr>
                <tr className="border-t border-[var(--orion-selected-bg)]">
                  <td className="px-2 py-2 text-foreground">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-400" />Opcionais
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{compare.before?.counts?.optional ?? 0}</td>
                  <td className="px-2 py-2 text-muted-foreground">{compare.after?.counts?.optional ?? 0}</td>
                  <td className="px-2 py-2 text-right font-semibold text-muted-foreground">{fmtDelta(compare.countsDelta?.optional)}</td>
                </tr>
                <tr className="border-t border-[var(--orion-selected-bg)]">
                  <td className="px-2 py-2 text-foreground">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-400" />Críticas
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{compare.before?.counts?.critical ?? 0}</td>
                  <td className="px-2 py-2 text-muted-foreground">{compare.after?.counts?.critical ?? 0}</td>
                  <td className={`px-2 py-2 text-right font-semibold ${deltaClass(compare.countsDelta?.critical, true)}`}>
                    {fmtDelta(compare.countsDelta?.critical)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {compare.recommendationChanges && compare.recommendationChanges.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recomendações alteradas</p>
              <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                {compare.recommendationChanges.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-xs">
                    <span className="flex-1 truncate font-mono text-foreground" title={r.id}>{r.id}</span>
                    <span className="text-muted-foreground">{r.from}</span>
                    <span className="text-[var(--orion-icon-default)]">→</span>
                    <span className="text-foreground">{r.to}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Dica: reduções em Recomendadas e Críticas indicam recomendações resolvidas após ajustes manuais na BIOS.
          </p>
        </div>
      )}

      {/* Exportação */}
      <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--orion-icon-default)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Relatórios e exportação</span>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Gere um relatório completo da última análise (HTML) ou exporte o perfil de hardware em JSON. Os arquivos são salvos
          em Documentos › Orion Optimizer.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={generateReport} disabled={reportBusy} className={secondaryBtn}>
            <FileText className={'h-4 w-4 ' + (reportBusy ? 'animate-pulse' : '')} />
            {reportBusy ? 'Gerando…' : 'GERAR RELATÓRIO'}
          </button>
          <button type="button" onClick={exportRaw} disabled={rawBusy} className={secondaryBtn}>
            <FileJson className={'h-4 w-4 ' + (rawBusy ? 'animate-pulse' : '')} />
            {rawBusy ? 'Exportando…' : 'EXPORTAR DADOS BRUTOS (JSON)'}
          </button>
        </div>
      </div>
    </div>
  );
}
