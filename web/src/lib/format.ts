const FEATURE_LABELS: Record<string, string> = {
  system_monitoring: 'Monitoramento',
  basic_cleanup: 'Limpeza essencial',
  advanced_cleanup: 'Limpeza avançada',
  fps_boost: 'FPS Boost',
  gaming_mode: 'Modo gamer',
  process_optimizer: 'Processos',
  startup_optimizer: 'Inicialização',
  bios_optimizer: 'BIOS',
  xmp_optimizer: 'XMP',
  advanced_memory_optimizer: 'Memória avançada',
  advanced_windows_optimizer: 'Windows avançado',
  realtime_telemetry: 'Telemetria',
  priority_features: 'Fila prioritária',
};

const FEATURE_LABELS_LONG: Record<string, string> = {
  system_monitoring: 'Monitoramento do sistema',
  basic_cleanup: 'Limpeza essencial',
  advanced_cleanup: 'Limpeza avançada',
  fps_boost: 'FPS Boost',
  gaming_mode: 'Modo gamer',
  process_optimizer: 'Otimizador de processos',
  startup_optimizer: 'Otimizador de inicialização',
  bios_optimizer: 'Otimizador de BIOS',
  xmp_optimizer: 'Otimizador XMP',
  advanced_memory_optimizer: 'Otimização avançada de memória',
  advanced_windows_optimizer: 'Otimização avançada do Windows',
  realtime_telemetry: 'Telemetria em tempo real',
  priority_features: 'Recursos prioritários',
};

export function brl(v: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(v) || 0,
  );
}

export function featureLabel(f: string, long = false) {
  const map = long ? FEATURE_LABELS_LONG : FEATURE_LABELS;
  return map[f] || f.replace(/_/g, ' ');
}

export function statusBadgeClass(s: string | null | undefined) {
  const val = String(s || '');
  if (val === 'ativa' || val === 'ativo' || val === 'active' || val === 'paid') return 'ativo';
  if (
    val === 'expirada' ||
    val === 'bloqueada' ||
    val === 'revogada' ||
    val === 'expired' ||
    val === 'revoked'
  ) {
    return 'expirada';
  }
  return 'pending';
}

export function statusHint(s: string | null | undefined) {
  const val = String(s || '');
  if (val === 'pending' || val === 'pendente') {
    return 'Seu pagamento está sendo processado. Assim que for confirmado, sua licença aparece aqui automaticamente.';
  }
  if (val === 'expirada' || val === 'expired') {
    return 'Esta licença expirou. Adquira um novo plano para continuar usando os recursos premium.';
  }
  if (val === 'bloqueada' || val === 'revogada' || val === 'revoked') {
    return 'Esta licença foi revogada. Entre em contato pelo suporte se acha que houve engano.';
  }
  if (val === 'ativa' || val === 'ativo' || val === 'active') {
    return 'Licença ativa e válida.';
  }
  return '';
}

export function escapeHtml(s: unknown) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}
