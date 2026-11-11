/* Rotina do Bento: ruído branco e timer rápido
 *
 * Ruído: três sons gerados pelo próprio app (sem anúncio, funcionam sem
 * internet e começam com um toque) e as faixas do YouTube escolhidas pela
 * família. O YouTube pode pedir um toque no vídeo para começar no iPhone e
 * mostra anúncios de vez em quando.
 *
 * Timer: alarmes rápidos com motivo. Um app instalado pelo Safari fica
 * pausado quando a tela bloqueia; nesse caso o alarme toca assim que o app
 * for aberto de novo. Para algo crítico, use também o Relógio do iPhone.
 */
'use strict';
(function () {
  const RB = window.RB = window.RB || {};
  RB.telas = RB.telas || {};
  RB.acoes = RB.acoes || {};
  RB.aoTique = RB.aoTique || [];

  /* =====================================================================
   * Ruído branco
   * ===================================================================== */

  const FAIXAS = [
    { id: 'branco', nome: 'Ruído branco', sub: 'Do app: sem anúncio, funciona sem internet', tipo: 'local' },
    { id: 'rosa', nome: 'Ruído rosa', sub: 'Do app: mais suave que o branco', tipo: 'local' },
    { id: 'marrom', nome: 'Ruído marrom', sub: 'Do app: grave e abafado', tipo: 'local' },
    { id: 'yt1', nome: 'Ruído branco 2 h', sub: 'YouTube · tela preta', tipo: 'yt', video: 'E-_dkwDvIkM' },
    { id: 'yt2', nome: 'Vídeo 2 (YouTube)', sub: 'Abre no app do YouTube: o dono não permite tocar dentro de outros apps', tipo: 'externo', video: 'mKFy_F_jU0o' },
    { id: 'yt3', nome: 'Música para cólica', sub: 'YouTube · tela preta', tipo: 'yt', video: 'XDT4-Xs4XXA' },
    { id: 'yt4', nome: 'Clássicos para bebês', sub: 'YouTube · piano', tipo: 'yt', video: 'faFwpo6sO7I' }
  ];
  const DESLIGAR = [[0, 'Não desligar'], [15, '15 min'], [30, '30 min'], [60, '1 h'], [120, '2 h']];

  const som = { faixa: 'branco', desligarMin: 0 };
  let tocando = null; // { faixa, ate }
  let audio = null;
  const urls = {};
  let travaTela = null;

  function faixaAtual() { return FAIXAS.find((f) => f.id === som.faixa) || FAIXAS[0]; }
  function salvarSom() { RB.gravar('rb:som', som); }

  function gerarRuido(tipo) {
    if (urls[tipo]) return urls[tipo];
    const sr = 22050, n = sr * 30, f = sr;
    const s = new Float32Array(n + f);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, ult = 0;
    for (let i = 0; i < n + f; i++) {
      const w = Math.random() * 2 - 1;
      let v;
      if (tipo === 'rosa') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        v = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.09;
        b6 = w * 0.115926;
      } else if (tipo === 'marrom') {
        ult = (ult + 0.02 * w) / 1.02;
        v = ult * 6;
      } else {
        v = w * 0.35;
      }
      s[i] = v;
    }
    // Emenda suave: o começo vira a continuação do fim, sem estalo no loop.
    for (let i = 0; i < f; i++) {
      const a = i / f;
      s[i] = s[i] * Math.sqrt(a) + s[n + i] * Math.sqrt(1 - a);
    }
    const buf = new ArrayBuffer(44 + n * 2);
    const dv = new DataView(buf);
    const txt = (o, t) => { for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
    txt(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    txt(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const v = Math.max(-1, Math.min(1, s[i]));
      dv.setInt16(44 + i * 2, v * 32767, true);
    }
    urls[tipo] = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
    return urls[tipo];
  }

  async function travarTela() {
    try { if ('wakeLock' in navigator) travaTela = await navigator.wakeLock.request('screen'); } catch (e) { /* sem trava */ }
  }
  function soltarTela() {
    try { if (travaTela) travaTela.release(); } catch (e) { /* ok */ }
    travaTela = null;
  }

  function tocar() {
    const f = faixaAtual();
    parar(true);
    if (f.tipo === 'externo') {
      window.open('https://www.youtube.com/watch?v=' + f.video, '_blank');
      RB.avisar('Abrindo no YouTube…');
      return;
    }
    tocando = { faixa: f.id, ate: som.desligarMin ? Date.now() + som.desligarMin * RB.M : null };
    if (f.tipo === 'local') {
      if (!audio) {
        audio = new Audio();
        audio.loop = true;
        audio.setAttribute('playsinline', '');
      }
      audio.src = gerarRuido(f.id);
      audio.play().catch(() => RB.avisar('Toque de novo para tocar o som.'));
      if ('mediaSession' in navigator && window.MediaMetadata) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: f.nome, artist: 'Rotina do ' + (RB.estado.bebe.nome || 'Bento') });
        try {
          navigator.mediaSession.setActionHandler('pause', () => { parar(); RB.render(); });
          navigator.mediaSession.setActionHandler('play', () => { tocar(); RB.render(); });
        } catch (e) { /* navegador sem suporte */ }
      }
    } else {
      const area = document.getElementById('player-yt');
      area.innerHTML = '<div class="yt-topo"><span>▶ ' + RB.esc(f.nome) + '</span><button type="button" data-acao="som-parar" aria-label="Fechar o vídeo">✕</button></div>' +
        '<div class="yt-video"><iframe src="https://www.youtube-nocookie.com/embed/' + f.video +
        '?autoplay=1&playsinline=1&loop=1&playlist=' + f.video + '&rel=0" title="' + RB.esc(f.nome) +
        '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>' +
        '<p class="dica">Se não começar sozinho, toque no vídeo. Mantenha o app aberto: o vídeo para quando a tela bloqueia.</p>';
      area.hidden = false;
      travarTela();
    }
  }

  function parar(silencioso) {
    if (audio) { audio.pause(); }
    const area = document.getElementById('player-yt');
    if (area && !area.hidden) { area.innerHTML = ''; area.hidden = true; }
    soltarTela();
    tocando = null;
    if (!silencioso) RB.avisar('Som parado.');
  }

  function folhaSons() {
    let h = '<h2 id="folha-titulo">🎵 Som para acalmar</h2><ul class="lista faixas">';
    FAIXAS.forEach((f) => {
      h += '<li><button type="button" class="item" data-acao="som-faixa" data-valor="' + f.id + '">' +
        '<span class="item-icone" aria-hidden="true">' + (f.tipo === 'local' ? '〰️' : '▶️') + '</span>' +
        '<span class="item-corpo"><span class="item-titulo">' + RB.esc(f.nome) + '</span>' +
        '<span class="item-sub" style="display:block;white-space:normal">' + RB.esc(f.sub) + '</span></span>' +
        (som.faixa === f.id ? '<span class="item-dur">✓</span>' : '') + '</button></li>';
    });
    h += '</ul><div class="campo" style="margin-top:14px"><span class="rotulo">Desligar sozinho depois de</span><div class="opcoes" role="group">' +
      DESLIGAR.map(([v, n]) => '<button type="button" class="opcao" data-acao="som-desligar" data-valor="' + v + '" aria-pressed="' + (som.desligarMin === v) + '">' + n + '</button>').join('') +
      '</div><p class="dica">Os sons do app continuam tocando com a tela bloqueada na maioria dos iPhones. Os vídeos do YouTube precisam do app aberto.</p></div>' +
      '<button type="button" class="botao secundario" data-acao="fechar">Fechar</button>';
    RB.abrirFolha(h);
  }

  /* =====================================================================
   * Timer rápido
   * ===================================================================== */

  const MOTIVOS = [
    { k: 'soneca', icone: '😴', t: 'Preparar o ' + 'Bento para a soneca' },
    { k: 'esterilizador', icone: '♨️', t: 'Tirar as mamadeiras do esterilizador' },
    { k: 'mamadeira', icone: '🍼', t: 'Preparar a mamadeira' },
    { k: 'remedio', icone: '💊', t: 'Dar o remédio' },
    { k: 'fralda', icone: '🧷', t: 'Trocar a fralda' },
    { k: 'outro', icone: '⏰', t: 'Outro motivo' }
  ];
  const DURACOES = [5, 10, 15, 20, 30, 45, 60];

  let timers = [];

  // Este arquivo carrega antes do núcleo: lê o que está salvo quando o app inicia.
  RB.iniciarModulos = RB.iniciarModulos || [];
  RB.iniciarModulos.push(() => {
    Object.assign(som, RB.ler('rb:som', {}));
    if (!FAIXAS.some((f) => f.id === som.faixa)) som.faixa = 'branco';
    timers = RB.ler('rb:timers', []);
  });
  let formTimer = { motivo: 'soneca', min: 15 };
  let alarmeAtual = null;
  let somAlarme = null;
  let ctx = null;

  function salvarTimers() { RB.gravar('rb:timers', timers); }
  function textoMotivo(k) {
    const m = MOTIVOS.find((x) => x.k === k);
    return m ? m.t.replace('Bento', RB.estado.bebe.nome || 'Bento') : k;
  }

  function criarTimer(motivo, icone, fim) {
    destravarAudio();
    timers.push({ id: RB.novoId(), motivo: motivo, icone: icone, fim: fim, tocou: false });
    timers.sort((a, b) => a.fim - b.fim);
    salvarTimers();
    RB.render();
  }

  function proximoTimer() { return timers.filter((t) => !t.tocou).sort((a, b) => a.fim - b.fim)[0] || null; }

  function folhaTimer() {
    const ativos = timers.filter((t) => !t.tocou);
    let h = '<h2 id="folha-titulo">⏱️ Timer</h2>';
    if (ativos.length) {
      h += '<ul class="lista" style="margin-bottom:14px">' + ativos.map((t) =>
        '<li><div class="item"><span class="item-icone" aria-hidden="true">' + t.icone + '</span>' +
        '<span class="item-corpo"><span class="item-titulo">' + RB.esc(t.motivo) + '</span>' +
        '<span class="item-sub" style="display:block">toca às ' + RB.horaMs(t.fim) + ' · faltam <b data-ate="' + t.fim + '"></b></span></span>' +
        '<button type="button" class="mini" data-acao="timer-mais5" data-id="' + t.id + '">+5</button>' +
        '<button type="button" class="mini" data-acao="timer-cancelar" data-id="' + t.id + '">✕</button></div></li>').join('') + '</ul>';
    }
    h += '<div class="campo"><span class="rotulo">Para lembrar de</span><div class="opcoes" role="group">' +
      MOTIVOS.map((m) => '<button type="button" class="opcao" data-acao="timer-motivo" data-valor="' + m.k + '" aria-pressed="' + (formTimer.motivo === m.k) + '">' + m.icone + ' ' + RB.esc(textoMotivo(m.k)) + '</button>').join('') +
      '</div></div>' +
      '<div class="campo" id="tm-outro-campo"' + (formTimer.motivo === 'outro' ? '' : ' hidden') + '><input id="tm-outro" class="entrada" type="text" placeholder="Ex.: Tirar a roupa da máquina"></div>' +
      '<div class="campo"><span class="rotulo">Daqui a</span><div class="opcoes" role="group">' +
      DURACOES.map((d) => '<button type="button" class="opcao" data-acao="timer-min" data-valor="' + d + '" aria-pressed="' + (formTimer.min === d) + '">' + (d < 60 ? d + ' min' : '1 h') + '</button>').join('') +
      '</div><div class="linha-entrada" style="margin-top:8px"><input id="tm-min" class="entrada" type="number" inputmode="numeric" min="1" max="600" placeholder="Outro tempo (min)"></div></div>' +
      '<button type="button" class="botao laranja" data-acao="timer-iniciar">Iniciar timer</button>' +
      '<p class="dica">Deixe o app aberto para o alarme tocar na hora. Com a tela bloqueada, o iPhone pausa o app e o alarme toca quando ele for aberto de novo. Para algo que não pode atrasar, use também o Relógio do iPhone.</p>' +
      '<button type="button" class="botao secundario" data-acao="fechar">Fechar</button>';
    RB.abrirFolha(h);
  }

  /* --- som do alarme --- */

  function destravarAudio() {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* sem áudio */ }
  }
  function bip() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [0, 0.25].forEach((atraso) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + atraso);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + atraso + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + atraso + 0.18);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0 + atraso); o.stop(t0 + atraso + 0.2);
    });
  }

  function dispararAlarme(t) {
    alarmeAtual = t;
    const el = document.getElementById('alarme');
    const atraso = Date.now() - t.fim;
    el.innerHTML = '<div class="alarme-caixa" role="alertdialog" aria-labelledby="alarme-titulo">' +
      '<div class="alarme-icone" aria-hidden="true">' + t.icone + '</div>' +
      '<p class="alarme-rotulo">Timer</p>' +
      '<h2 id="alarme-titulo">' + RB.esc(t.motivo) + '</h2>' +
      (atraso > 2 * RB.M ? '<p class="dica">Terminou às ' + RB.horaMs(t.fim) + ' (o app estava fechado).</p>' : '') +
      '<button type="button" class="botao laranja" data-acao="alarme-ok">Parar alarme</button>' +
      '<button type="button" class="botao secundario" data-acao="alarme-adiar">Mais 5 minutos</button></div>';
    el.hidden = false;
    destravarAudio();
    bip();
    clearInterval(somAlarme);
    somAlarme = setInterval(bip, 1200);
    if (navigator.vibrate) navigator.vibrate([300, 200, 300]);
    setTimeout(() => { if (alarmeAtual === t) clearInterval(somAlarme); }, 60000);
  }

  function fecharAlarme() {
    clearInterval(somAlarme);
    document.getElementById('alarme').hidden = true;
    alarmeAtual = null;
  }

  /* =====================================================================
   * Barra rápida da tela Hoje
   * ===================================================================== */

  function barraRapida() {
    const f = faixaAtual();
    const ativo = !!tocando;
    const prox = proximoTimer();
    return '<div class="rapidos">' +
      '<div class="rapido som' + (ativo ? ' tocando' : '') + '">' +
      '<button type="button" class="som-play" data-acao="som-alternar" aria-label="' + (ativo ? 'Parar o som' : 'Tocar ' + RB.esc(f.nome)) + '">' + (ativo ? '❚❚' : '▶') + '</button>' +
      '<button type="button" class="rapido-info" data-acao="som-escolher">' +
      '<small>' + (ativo ? (tocando.ate ? 'Desliga em <b data-ate="' + tocando.ate + '"></b>' : 'Tocando') : 'Som para acalmar') + '</small>' +
      '<b>' + RB.esc(f.nome) + ' ▾</b></button></div>' +
      '<button type="button" class="rapido timer-rapido' + (prox ? ' ativo' : '') + '" data-acao="timer-abrir">' +
      '<span class="rapido-icone" aria-hidden="true">' + (prox ? prox.icone : '⏱️') + '</span>' +
      '<span class="rapido-info"><small>' + (prox ? RB.esc(prox.motivo) : 'Timer rápido') + '</small>' +
      '<b>' + (prox ? '<span data-ate="' + prox.fim + '"></span>' : 'Novo timer') + '</b></span></button>' +
      '</div>';
  }

  RB.barraRapida = barraRapida;
  RB.avisosHoje = () => (RB.avisosAgenda ? RB.avisosAgenda() : '');

  RB.aoTique.push((agora) => {
    if (tocando && tocando.ate && agora >= tocando.ate) {
      parar(true);
      if (RB.estado.aba === 'hoje') RB.render();
    }
    if (!alarmeAtual) {
      const vencido = timers.find((t) => !t.tocou && t.fim <= agora);
      if (vencido) {
        vencido.tocou = true;
        timers = timers.filter((t) => !t.tocou || t === vencido);
        salvarTimers();
        dispararAlarme(vencido);
        if (RB.estado.aba === 'hoje') RB.render();
      }
    }
  });

  Object.assign(RB.acoes, {
    'som-alternar': () => { if (tocando) parar(); else tocar(); RB.render(); },
    'som-escolher': () => folhaSons(),
    'som-faixa': (alvo) => {
      som.faixa = alvo.dataset.valor;
      salvarSom();
      RB.fecharFolha();
      tocar();
      RB.render();
    },
    'som-desligar': (alvo) => {
      som.desligarMin = Number(alvo.dataset.valor);
      salvarSom();
      if (tocando) tocando.ate = som.desligarMin ? Date.now() + som.desligarMin * RB.M : null;
      alvo.parentElement.querySelectorAll('.opcao').forEach((b) => b.setAttribute('aria-pressed', String(b === alvo)));
      RB.render();
    },
    'som-parar': () => { parar(); RB.render(); },
    'timer-abrir': () => folhaTimer(),
    'timer-motivo': (alvo) => {
      formTimer.motivo = alvo.dataset.valor;
      alvo.parentElement.querySelectorAll('.opcao').forEach((b) => b.setAttribute('aria-pressed', String(b === alvo)));
      document.getElementById('tm-outro-campo').hidden = formTimer.motivo !== 'outro';
    },
    'timer-min': (alvo) => {
      formTimer.min = Number(alvo.dataset.valor);
      document.getElementById('tm-min').value = '';
      alvo.parentElement.querySelectorAll('.opcao').forEach((b) => b.setAttribute('aria-pressed', String(b === alvo)));
    },
    'timer-iniciar': () => {
      const outroMin = Number(document.getElementById('tm-min').value);
      const min = outroMin > 0 ? Math.min(600, outroMin) : formTimer.min;
      const m = MOTIVOS.find((x) => x.k === formTimer.motivo) || MOTIVOS[5];
      let texto = textoMotivo(m.k);
      if (m.k === 'outro') texto = document.getElementById('tm-outro').value.trim() || 'Timer';
      criarTimer(texto, m.icone, Date.now() + min * RB.M);
      RB.fecharFolha();
      RB.avisar('Timer de ' + min + ' min: ' + texto + '.');
    },
    'timer-mais5': (alvo) => {
      const t = timers.find((x) => x.id === alvo.dataset.id);
      if (t) { t.fim += 5 * RB.M; salvarTimers(); folhaTimer(); RB.render(); }
    },
    'timer-cancelar': (alvo) => {
      timers = timers.filter((x) => x.id !== alvo.dataset.id);
      salvarTimers();
      folhaTimer();
      RB.render();
    },
    'timer-preparo': (alvo) => {
      const fim = Number(alvo.dataset.fim);
      if (!(fim > Date.now())) { RB.avisar('Já está na hora de preparar.'); return; }
      criarTimer(textoMotivo('soneca'), '😴', fim);
      RB.avisar('Aviso às ' + RB.horaMs(fim) + ' para preparar a soneca.');
    },
    'alarme-ok': () => {
      if (alarmeAtual) timers = timers.filter((t) => t.id !== alarmeAtual.id);
      salvarTimers();
      fecharAlarme();
      RB.render();
    },
    'alarme-adiar': () => {
      const t = alarmeAtual;
      timers = timers.filter((x) => x.id !== t.id);
      fecharAlarme();
      criarTimer(t.motivo, t.icone, Date.now() + 5 * RB.M);
      RB.avisar('Mais 5 minutos.');
    }
  });

  // O iPhone só libera som depois de um toque: aproveita o primeiro toque na tela.
  document.addEventListener('touchend', destravarAudio, { once: true, passive: true });
  document.addEventListener('click', destravarAudio, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && tocando && document.getElementById('player-yt').hidden === false) travarTela();
  });
})();
