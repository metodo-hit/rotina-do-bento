/* Rotina do Bento
 * App de registro de mamadas, sono, fraldas e mais.
 * Os dados ficam no celular (localStorage) e são sincronizados com a planilha
 * do Google via Apps Script. Funciona sem internet: o que for registrado
 * offline é enviado quando a conexão voltar.
 */
'use strict';
(function () {

  const VERSAO = '1.0.0';

  /* =====================================================================
   * Armazenamento local
   * ===================================================================== */

  const CH = {
    registros: 'rb:registros',
    pendentes: 'rb:pendentes',
    desde: 'rb:desde',
    ajustes: 'rb:ajustes',
    bebe: 'rb:bebe',
    ultimaSync: 'rb:ultimaSync'
  };

  function ler(chave, padrao) {
    try {
      const v = localStorage.getItem(chave);
      return v ? JSON.parse(v) : padrao;
    } catch (e) { return padrao; }
  }
  function gravar(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* armazenamento indisponível */ }
  }

  const estado = {
    registros: ler(CH.registros, {}),
    pendentes: new Set(ler(CH.pendentes, [])),
    desde: ler(CH.desde, null),
    ajustes: Object.assign({ url: '', codigo: '', quem: '', tema: 'auto' }, ler(CH.ajustes, {})),
    bebe: Object.assign({ nome: 'Bento', nascimento: null, intervaloMamadasH: 3, noturnoInicio: 19, noturnoFim: 7 }, ler(CH.bebe, {})),
    aba: 'hoje',
    filtro: 'Todos',
    diasHistorico: 7,
    sync: { estado: 'desconfigurado', erro: null, ultima: ler(CH.ultimaSync, null) }
  };

  function persistir() {
    gravar(CH.registros, estado.registros);
    gravar(CH.pendentes, Array.from(estado.pendentes));
    gravar(CH.desde, estado.desde);
  }

  /* =====================================================================
   * Tipos de registro
   * ===================================================================== */

  const TIPOS = {
    'Mamada':             { icone: '🍼', intervalo: true, timer: true },
    'Sono':               { icone: '🌙', intervalo: true, timer: true },
    'Fralda':             { icone: '🧷' },
    'Ordenha':            { icone: '🥛', intervalo: true, timer: true },
    'Barriguinha':        { icone: '🧸', intervalo: true, timer: true, nome: 'Tempo de barriga' },
    'Temperatura':        { icone: '🌡️', unidade: '°C', casas: 1 },
    'Peso':               { icone: '⚖️', unidade: 'kg', casas: 3 },
    'Altura':             { icone: '📏', unidade: 'cm', casas: 1 },
    'Perímetro cefálico': { icone: '📐', unidade: 'cm', casas: 1 },
    'Remédio':            { icone: '💊' },
    'Banho':              { icone: '🛁' },
    'Nota':               { icone: '📝', nome: 'Anotação' }
  };
  const OUTROS = ['Ordenha', 'Barriguinha', 'Temperatura', 'Peso', 'Altura', 'Perímetro cefálico', 'Remédio', 'Banho', 'Nota'];

  const OPCOES = {
    ladoMamada: ['Peito esquerdo', 'Peito direito', 'Ambos os peitos', 'Mamadeira'],
    leite: ['Materno', 'Fórmula', 'Misto'],
    sono: ['Soneca', 'Sono noturno'],
    fralda: ['Xixi', 'Cocô', 'Xixi e cocô', 'Seca'],
    corCoco: ['Amarelo', 'Mostarda', 'Verde', 'Marrom', 'Preto', 'Vermelho', 'Branco'],
    ladoOrdenha: ['Esquerdo', 'Direito', 'Ambos'],
    unidadeRemedio: ['gotas', 'ml', 'mg', 'comprimido']
  };

  function nomeTipo(tipo) { return (TIPOS[tipo] && TIPOS[tipo].nome) || tipo; }
  function iconeTipo(tipo) { return (TIPOS[tipo] && TIPOS[tipo].icone) || '•'; }

  /* =====================================================================
   * Utilidades de data, texto e números
   * ===================================================================== */

  const p2 = (n) => String(n).padStart(2, '0');
  const ms = (iso) => (iso ? new Date(iso).getTime() : 0);
  const agoraISO = () => new Date().toISOString();
  const DIA = 86400000;

  const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const fmtDiaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const fmtDiaCurto = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit' });
  const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  function hora(iso) { return iso ? fmtHora.format(new Date(iso)) : ''; }

  function duracao(msv) {
    const min = Math.round(msv / 60000);
    if (min < 1) return 'menos de 1 min';
    if (min < 60) return min + ' min';
    const h = Math.floor(min / 60), m = min % 60;
    return m ? h + 'h ' + m + 'min' : h + 'h';
  }
  function duracaoCurta(msv) {
    const min = Math.round(msv / 60000);
    if (min < 1) return '<1 min';
    if (min < 60) return min + ' min';
    const h = Math.floor(min / 60), m = min % 60;
    return m ? h + 'h' + p2(m) : h + 'h';
  }
  function cronometro(msv) {
    const s = Math.max(0, Math.floor(msv / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h ? h + ':' + p2(m) + ':' + p2(ss) : p2(m) + ':' + p2(ss);
  }
  function ha(iso) {
    const d = Date.now() - ms(iso);
    if (d < 60000) return 'agora há pouco';
    return 'há ' + duracao(d);
  }

  function chaveDia(d) {
    d = new Date(d);
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  function inicioDia(d) { d = new Date(d); d.setHours(0, 0, 0, 0); return d; }
  function somarDias(d, n) { d = new Date(d); d.setDate(d.getDate() + n); return d; }
  function dataDaChave(chave) { const [a, m, d] = chave.split('-').map(Number); return new Date(a, m - 1, d); }
  function rotuloDia(chave) {
    const hoje = chaveDia(new Date());
    if (chave === hoje) return 'Hoje';
    if (chave === chaveDia(somarDias(new Date(), -1))) return 'Ontem';
    return fmtDiaSemana.format(dataDaChave(chave));
  }

  // <input type="datetime-local"> usa "AAAA-MM-DDTHH:MM" no horário local
  function paraInput(iso) {
    const d = iso ? new Date(iso) : new Date();
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function deInput(valor) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor || '');
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).toISOString();
  }

  function numero(v, casas) {
    if (v === null || v === undefined || v === '') return '';
    return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas === undefined ? 2 : casas });
  }
  function lerNumero(texto) {
    if (texto === null || texto === undefined) return null;
    const t = String(texto).trim().replace(/\s/g, '').replace(',', '.');
    if (!t) return null;
    const n = Number(t);
    return isFinite(n) ? n : NaN;
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function novoId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function idade(nascimento) {
    if (!nascimento) return '';
    const [a, m, d] = nascimento.split('-').map(Number);
    const nasc = new Date(a, m - 1, d);
    const hoje = inicioDia(new Date());
    const dias = Math.round((hoje - nasc) / DIA);
    if (dias < 0) return '';
    if (dias === 0) return 'Nasceu hoje';
    if (dias < 14) return dias + (dias === 1 ? ' dia' : ' dias');
    if (dias < 60) {
      const s = Math.floor(dias / 7), r = dias % 7;
      return s + ' semanas' + (r ? ' e ' + r + (r === 1 ? ' dia' : ' dias') : '');
    }
    let meses = (hoje.getFullYear() - a) * 12 + (hoje.getMonth() - (m - 1));
    if (hoje.getDate() < d) meses--;
    const base = new Date(a, m - 1 + meses, d);
    const r = Math.round((hoje - base) / DIA);
    return meses + (meses === 1 ? ' mês' : ' meses') + (r ? ' e ' + r + (r === 1 ? ' dia' : ' dias') : '');
  }

  function ehNoturno(data) {
    const h = new Date(data).getHours();
    const i = Number(estado.bebe.noturnoInicio), f = Number(estado.bebe.noturnoFim);
    return i > f ? (h >= i || h < f) : (h >= i && h < f);
  }

  /* =====================================================================
   * Consultas aos registros
   * ===================================================================== */

  function ativos() {
    return Object.values(estado.registros).filter((r) => r && !r.excluido && r.inicio);
  }
  function ordenados() {
    return ativos().sort((a, b) => ms(b.inicio) - ms(a.inicio));
  }
  function emAndamento() {
    return ativos()
      .filter((r) => TIPOS[r.tipo] && TIPOS[r.tipo].timer && !r.fim)
      .sort((a, b) => ms(a.inicio) - ms(b.inicio));
  }
  function ultimo(tipo, filtro) {
    return ordenados().find((r) => r.tipo === tipo && (!filtro || filtro(r))) || null;
  }
  function fimOuAgora(r) { return r.fim ? ms(r.fim) : Date.now(); }
  function sobreposicao(r, ini, fim) {
    const a = Math.max(ms(r.inicio), ini);
    const b = Math.min(fimOuAgora(r), fim);
    return Math.max(0, b - a);
  }

  /** Números de um dia. O dia de cada registro é o do horário de início, como na planilha. */
  function resumoDia(diaInicio) {
    const ini = inicioDia(diaInicio).getTime();
    const fim = somarDias(ini, 1).getTime();
    const todos = ativos();
    const doDia = todos.filter((r) => { const t = ms(r.inicio); return t >= ini && t < fim; });
    const mamadas = doDia.filter((r) => r.tipo === 'Mamada').sort((a, b) => ms(a.inicio) - ms(b.inicio));
    const sonos = doDia.filter((r) => r.tipo === 'Sono');
    const fraldas = doDia.filter((r) => r.tipo === 'Fralda');
    const soma = (lista) => lista.reduce((t, r) => t + (fimOuAgora(r) - ms(r.inicio)), 0);
    const sonecas = sonos.filter((r) => r.detalhe !== 'Sono noturno');
    const noturnos = sonos.filter((r) => r.detalhe === 'Sono noturno');
    return {
      mamadas: mamadas.length,
      tempoMamando: soma(mamadas),
      ml: mamadas.filter((r) => r.detalhe === 'Mamadeira').reduce((t, r) => t + (Number(r.quantidade) || 0), 0),
      intervaloMedio: mamadas.length >= 2
        ? (ms(mamadas[mamadas.length - 1].inicio) - ms(mamadas[0].inicio)) / (mamadas.length - 1)
        : null,
      sonecas: sonecas.length,
      tempoSoneca: soma(sonecas),
      tempoNoturno: soma(noturnos),
      // sono que de fato aconteceu dentro do dia (corta o que passou da meia-noite)
      sonoNoDia: todos.filter((r) => r.tipo === 'Sono').reduce((t, r) => t + sobreposicao(r, ini, fim), 0),
      fraldas: fraldas.length,
      cocos: fraldas.filter((r) => /coc[oô]/i.test(r.detalhe || '')).length,
      xixis: fraldas.filter((r) => /xixi/i.test(r.detalhe || '')).length
    };
  }

  function descrever(r) {
    const partes = [];
    const t = TIPOS[r.tipo] || {};
    switch (r.tipo) {
      case 'Mamada':
        if (r.detalhe) partes.push(r.detalhe);
        if (r.leite) partes.push(r.leite);
        if (r.quantidade) partes.push(numero(r.quantidade, 0) + ' ml');
        break;
      case 'Sono':
        partes.push(r.detalhe || 'Soneca');
        break;
      case 'Fralda':
        if (r.detalhe) partes.push(r.detalhe);
        if (r.corCoco) partes.push('cor ' + r.corCoco.toLowerCase());
        break;
      case 'Ordenha':
        if (r.detalhe) partes.push(r.detalhe);
        if (r.quantidade) partes.push(numero(r.quantidade, 0) + ' ml');
        break;
      case 'Remédio':
        if (r.detalhe) partes.push(r.detalhe);
        if (r.quantidade) partes.push(numero(r.quantidade) + ' ' + (r.unidade || ''));
        break;
      default:
        if (t.unidade && r.quantidade !== null && r.quantidade !== undefined && r.quantidade !== '') {
          partes.push(numero(r.quantidade, t.casas) + ' ' + t.unidade);
        }
    }
    if (t.intervalo && r.fim) partes.push('até ' + hora(r.fim));
    if (t.intervalo && !r.fim) partes.push('em andamento');
    if (r.obs) partes.push(r.obs);
    return partes.join(' · ');
  }

  /* =====================================================================
   * Gravação de registros
   * ===================================================================== */

  function salvarRegistro(r) {
    const agora = agoraISO();
    r.id = r.id || novoId();
    r.criadoEm = r.criadoEm || agora;
    r.atualizadoEm = agora;
    r.quem = r.quem || estado.ajustes.quem || null;
    r.excluido = !!r.excluido;
    estado.registros[r.id] = r;
    estado.pendentes.add(r.id);
    persistir();
    render();
    agendarSync();
    return r;
  }

  function iniciarTimer(tipo, detalhe) {
    const jaTem = emAndamento().find((r) => r.tipo === tipo);
    if (jaTem) { avisar('Já existe ' + nomeTipo(tipo).toLowerCase() + ' em andamento.'); return null; }
    const r = salvarRegistro({ tipo: tipo, inicio: agoraISO(), fim: null, detalhe: detalhe || null });
    avisar(nomeTipo(tipo) + ' iniciada às ' + hora(r.inicio) + '.');
    return r;
  }

  function finalizarTimer(id) {
    const r = estado.registros[id];
    if (!r || r.fim) return;
    r.fim = agoraISO();
    salvarRegistro(r);
    avisar(nomeTipo(r.tipo) + ' finalizada: ' + duracao(ms(r.fim) - ms(r.inicio)) + '.');
    // Mamadeira e ordenha pedem a quantidade em ml
    if ((r.tipo === 'Mamada' && r.detalhe === 'Mamadeira') || r.tipo === 'Ordenha') {
      abrirFormulario(r.tipo, r.id, { focar: 'quantidade' });
    }
  }

  function trocarLado(id) {
    const r = estado.registros[id];
    if (!r || r.fim) return;
    const comecou = r.detalhe === 'Peito esquerdo' ? 'esquerdo' : 'direito';
    r.detalhe = 'Ambos os peitos';
    r.obs = ('Começou no peito ' + comecou + '. ' + (r.obs || '')).trim();
    salvarRegistro(r);
    avisar('Trocou de lado.');
  }

  function excluirRegistro(id) {
    const r = estado.registros[id];
    if (!r) return;
    r.excluido = true;
    salvarRegistro(r);
    avisar(nomeTipo(r.tipo) + ' excluída.');
  }

  /* =====================================================================
   * Sincronização com a planilha
   * ===================================================================== */

  let syncEmCurso = false;
  let syncDeNovo = false;
  let syncTimer = null;

  function configurado() { return !!(estado.ajustes.url && estado.ajustes.codigo); }

  function agendarSync(atraso) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sincronizar, atraso === undefined ? 600 : atraso);
  }

  async function chamarApi(corpo, url, codigo) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const limite = setTimeout(() => ctrl && ctrl.abort(), 30000);
    try {
      // Sem cabeçalhos: o navegador envia text/plain, que o Apps Script aceita sem pré-verificação CORS.
      const resp = await fetch(url || estado.ajustes.url, {
        method: 'POST',
        body: JSON.stringify(Object.assign({ codigo: codigo || estado.ajustes.codigo }, corpo)),
        redirect: 'follow',
        signal: ctrl ? ctrl.signal : undefined
      });
      const texto = await resp.text();
      let dados;
      try { dados = JSON.parse(texto); } catch (e) {
        throw new Error('A planilha não respondeu como esperado. Confira a URL e se o script foi implantado com acesso para "Qualquer pessoa".');
      }
      if (!dados.ok) throw new Error(dados.erro || 'Erro desconhecido na planilha.');
      return dados;
    } catch (e) {
      if (e.name === 'AbortError' || e instanceof TypeError) {
        const erro = new Error(e.name === 'AbortError'
          ? 'A planilha demorou demais para responder. Os registros ficam guardados e vão na próxima tentativa.'
          : 'Não foi possível falar com a planilha. Confira a internet e a URL. Os registros ficam guardados.');
        erro.semRede = true;
        throw erro;
      }
      throw e;
    } finally {
      clearTimeout(limite);
    }
  }

  function normalizar(r) {
    return {
      id: String(r.id),
      tipo: r.tipo || null,
      inicio: r.inicio || null,
      fim: r.fim || null,
      detalhe: r.detalhe || null,
      leite: r.leite || null,
      quantidade: r.quantidade === null || r.quantidade === undefined || r.quantidade === '' ? null : Number(r.quantidade),
      unidade: r.unidade || null,
      corCoco: r.corCoco || null,
      quem: r.quem || null,
      obs: r.obs ? String(r.obs) : null,
      criadoEm: r.criadoEm || null,
      atualizadoEm: r.atualizadoEm || null,
      excluido: r.excluido === true
    };
  }

  async function sincronizar() {
    if (!configurado()) { definirStatus('desconfigurado'); return; }
    if (!navigator.onLine) { definirStatus('offline'); return; }
    if (syncEmCurso) { syncDeNovo = true; return; }
    syncEmCurso = true;
    definirStatus('sincronizando');

    const enviados = Array.from(estado.pendentes)
      .map((id) => estado.registros[id])
      .filter(Boolean)
      .map((r) => Object.assign({}, r));

    try {
      const dados = await chamarApi({ acao: 'sync', desde: estado.desde, registros: enviados });

      // Tira da fila o que foi enviado e não mudou durante o envio.
      enviados.forEach((r) => {
        const atual = estado.registros[r.id];
        if (!atual || atual.atualizadoEm === r.atualizadoEm) estado.pendentes.delete(r.id);
      });

      // Aplica o que veio da planilha, sem passar por cima de mudança local mais nova.
      (dados.registros || []).forEach((rr) => {
        const r = normalizar(rr);
        const local = estado.registros[r.id];
        if (local && estado.pendentes.has(r.id) && ms(local.atualizadoEm) > ms(r.atualizadoEm)) return;
        estado.registros[r.id] = r;
      });

      estado.desde = dados.agora || estado.desde;
      if (dados.config) {
        estado.bebe = Object.assign(estado.bebe, dados.config);
        gravar(CH.bebe, estado.bebe);
      }
      estado.sync.ultima = new Date().toISOString();
      gravar(CH.ultimaSync, estado.sync.ultima);
      persistir();
      definirStatus(estado.pendentes.size ? 'pendente' : 'ok');
      if (estado.aba === 'ajustes') atualizarAjustesSync(); else render();
      atualizarTopo();
    } catch (e) {
      definirStatus(e.semRede ? 'offline' : 'erro', e.message);
    } finally {
      syncEmCurso = false;
      if (syncDeNovo) { syncDeNovo = false; agendarSync(300); }
    }
  }

  function definirStatus(s, erro) {
    estado.sync.estado = s;
    estado.sync.erro = erro || null;
    const el = document.getElementById('status-sync');
    if (!el) return;
    const n = estado.pendentes.size;
    const textos = {
      ok: 'Sincronizado',
      sincronizando: 'Sincronizando',
      pendente: n + (n === 1 ? ' pendente' : ' pendentes'),
      offline: 'Sem internet',
      erro: 'Erro ao sincronizar',
      desconfigurado: 'Só neste celular'
    };
    el.dataset.estado = s;
    el.querySelector('.status-texto').textContent = textos[s] || s;
    el.title = erro || '';
    if (estado.aba === 'ajustes') atualizarAjustesSync();
  }

  /* =====================================================================
   * Interface: topo, abas e avisos
   * ===================================================================== */

  const $conteudo = document.getElementById('conteudo');

  function aplicarTema() {
    const t = estado.ajustes.tema;
    if (t === 'claro') document.documentElement.dataset.tema = 'claro';
    else if (t === 'escuro') document.documentElement.dataset.tema = 'escuro';
    else delete document.documentElement.dataset.tema;
  }

  function atualizarTopo() {
    const nome = estado.bebe.nome || 'Bento';
    document.getElementById('titulo').textContent = 'Rotina do ' + nome;
    document.title = 'Rotina do ' + nome;
    document.getElementById('idade').textContent = idade(estado.bebe.nascimento);
  }

  let avisoTimer = null;
  function avisar(texto) {
    const el = document.getElementById('aviso');
    el.textContent = texto;
    el.classList.add('visivel');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => el.classList.remove('visivel'), 2600);
  }

  function irPara(aba) {
    estado.aba = aba;
    document.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === aba));
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    atualizarTopo();
    if (estado.aba === 'hoje') $conteudo.innerHTML = telaHoje();
    else if (estado.aba === 'historico') $conteudo.innerHTML = telaHistorico();
    else if (estado.aba === 'resumo') $conteudo.innerHTML = telaResumo();
    else if (estado.aba === 'ajustes') { $conteudo.innerHTML = telaAjustes(); atualizarAjustesSync(); }
    tique();
  }

  // Atualiza cronômetros e "há X min" a cada segundo, sem redesenhar a tela.
  function tique() {
    const agora = Date.now();
    document.querySelectorAll('[data-desde]').forEach((el) => {
      el.textContent = cronometro(agora - ms(el.dataset.desde));
    });
    document.querySelectorAll('[data-ha]').forEach((el) => {
      el.textContent = ha(el.dataset.ha);
    });
  }

  /* =====================================================================
   * Tela: Hoje
   * ===================================================================== */

  function telaHoje() {
    let h = '';

    if (!configurado()) {
      h += '<div class="cartao" style="margin-bottom:10px">' +
        '<b>Planilha ainda não conectada.</b>' +
        '<p class="dica">Os registros ficam salvos neste celular e vão para a planilha quando você conectar em Ajustes.</p>' +
        '<button class="botao secundario" style="margin-top:10px" data-acao="ir" data-aba="ajustes">Conectar planilha</button>' +
        '</div>';
    }

    emAndamento().forEach((r) => { h += cartaoTimer(r); });

    // Destaques
    h += '<div class="secao-titulo">Agora</div>';
    h += destaqueMamada();
    h += destaqueSono();
    h += destaqueFralda();

    // Ações rápidas
    const dormindo = emAndamento().some((r) => r.tipo === 'Sono');
    h += '<div class="secao-titulo">Registrar</div><div class="acoes">' +
      botaoAcao('mamada', '🍼', 'Mamada', 'Peito ou mamadeira', 'laranja') +
      botaoAcao('sono', '🌙', 'Sono', dormindo ? 'Dormindo agora' : (ehNoturno(new Date()) ? 'Sono da noite' : 'Soneca'), 'azul') +
      botaoAcao('fralda', '🧷', 'Fralda', 'Xixi, cocô ou seca', '') +
      botaoAcao('mais', '➕', 'Mais', 'Ordenha, remédio, peso…', '') +
      '</div>';

    // Números de hoje
    const hoje = resumoDia(new Date());
    h += '<div class="secao-titulo">Hoje</div><div class="cartao">' +
      '<div class="numeros">' +
      numeroCaixa(hoje.mamadas, 'mamadas') +
      numeroCaixa(hoje.tempoMamando ? duracaoCurta(hoje.tempoMamando) : '0', 'mamando') +
      numeroCaixa(hoje.intervaloMedio ? duracaoCurta(hoje.intervaloMedio) : '–', 'intervalo médio') +
      numeroCaixa(hoje.sonecas, 'sonecas') +
      numeroCaixa(hoje.sonoNoDia ? duracaoCurta(hoje.sonoNoDia) : '0', 'dormiu') +
      numeroCaixa(hoje.fraldas, hoje.cocos ? 'fraldas (' + hoje.cocos + ' cocô)' : 'fraldas') +
      '</div>' +
      (hoje.ml ? '<p class="dica" style="text-align:center">Mamadeira hoje: ' + numero(hoje.ml, 0) + ' ml</p>' : '') +
      faixa24h() +
      '</div>';

    // Últimos registros
    const ultimos = ordenados().slice(0, 5);
    h += '<div class="secao-titulo">Últimos registros</div>';
    h += ultimos.length
      ? '<ul class="lista">' + ultimos.map(itemLista).join('') + '</ul>'
      : '<div class="cartao vazio">Nenhum registro ainda. Comece pela primeira mamada.</div>';

    return h;
  }

  function botaoAcao(acao, icone, nome, sub, cor) {
    return '<button type="button" class="acao ' + cor + '" data-acao="' + acao + '">' +
      '<span class="acao-icone" aria-hidden="true">' + icone + '</span>' +
      '<span class="acao-nome">' + esc(nome) + '</span>' +
      '<span class="acao-sub">' + esc(sub) + '</span></button>';
  }

  function numeroCaixa(valor, rotulo) {
    return '<div class="numero"><b>' + esc(valor) + '</b><span>' + esc(rotulo) + '</span></div>';
  }

  function cartaoTimer(r) {
    let rotulo = nomeTipo(r.tipo);
    if (r.tipo === 'Mamada') rotulo = 'Mamando';
    if (r.tipo === 'Sono') rotulo = r.detalhe === 'Sono noturno' ? 'Dormindo (noite)' : 'Soneca';
    if (r.tipo === 'Ordenha') rotulo = 'Ordenhando';
    const detalhe = [r.detalhe && r.tipo !== 'Sono' ? r.detalhe : '', 'desde ' + hora(r.inicio)].filter(Boolean).join(' · ');
    const podeTrocar = r.tipo === 'Mamada' && (r.detalhe === 'Peito esquerdo' || r.detalhe === 'Peito direito');
    return '<div class="timer" data-tipo="' + esc(r.tipo) + '">' +
      '<div class="timer-topo"><span class="timer-rotulo">' + iconeTipo(r.tipo) + ' ' + esc(rotulo) + '</span>' +
      '<span class="timer-detalhe">' + esc(detalhe) + '</span></div>' +
      '<div class="timer-tempo" data-desde="' + esc(r.inicio) + '">00:00</div>' +
      '<div class="timer-acoes">' +
      (podeTrocar ? '<button type="button" data-acao="trocar-lado" data-id="' + esc(r.id) + '">Trocar lado</button>' : '') +
      '<button type="button" data-acao="editar" data-id="' + esc(r.id) + '">Editar</button>' +
      '<button type="button" class="principal" data-acao="finalizar" data-id="' + esc(r.id) + '">' +
      (r.tipo === 'Sono' ? 'Acordou' : 'Finalizar') + '</button>' +
      '</div></div>';
  }

  function destaqueMamada() {
    const r = ultimo('Mamada');
    if (!r) {
      return cartaoDestaque('🍼', '', 'Última mamada', 'Sem registro', 'Registre a primeira mamada abaixo.', '');
    }
    const intervalo = (Number(estado.bebe.intervaloMamadasH) || 3) * 3600000;
    const proxima = ms(r.inicio) + intervalo;
    let etiqueta = '';
    if (!r.fim) {
      etiqueta = '<span class="etiqueta alerta">Mamando agora</span>';
    } else if (Date.now() > proxima) {
      etiqueta = '<span class="etiqueta alerta">Passou ' + duracao(Date.now() - proxima) + ' do horário sugerido (' + hora(new Date(proxima).toISOString()) + ')</span>';
    } else {
      etiqueta = '<span class="etiqueta">Próxima por volta das ' + hora(new Date(proxima).toISOString()) + '</span>';
    }
    let lado = '';
    if (r.detalhe === 'Ambos os peitos' && /Começou no peito (esquerdo|direito)/.test(r.obs || '')) {
      const comecou = /esquerdo/.test(r.obs) ? 'esquerdo' : 'direito';
      lado = 'Ambos (terminou no ' + (comecou === 'esquerdo' ? 'direito' : 'esquerdo') + ')';
    } else if (r.detalhe) {
      lado = r.detalhe;
    }
    const info = ['às ' + hora(r.inicio), lado, r.fim ? duracao(ms(r.fim) - ms(r.inicio)) : '',
      r.quantidade ? numero(r.quantidade, 0) + ' ml' : ''].filter(Boolean).join(' · ');
    return cartaoDestaque('🍼', '', 'Última mamada (desde o início)', '<span data-ha="' + esc(r.inicio) + '"></span>', info, etiqueta, r.id);
  }

  function destaqueSono() {
    if (emAndamento().some((r) => r.tipo === 'Sono')) return '';
    const r = ultimo('Sono', (x) => !!x.fim);
    if (!r) return cartaoDestaque('🌙', 'azul', 'Acordado', 'Sem registro de sono', 'Toque em Sono quando ele dormir.', '');
    const info = 'Último sono: ' + hora(r.inicio) + '–' + hora(r.fim) + ' (' + duracao(ms(r.fim) - ms(r.inicio)) + ')';
    return cartaoDestaque('🌙', 'azul', 'Acordado', '<span data-ha="' + esc(r.fim) + '"></span>', info, '', r.id);
  }

  function destaqueFralda() {
    const r = ultimo('Fralda');
    if (!r) return cartaoDestaque('🧷', 'azul', 'Última fralda', 'Sem registro', '', '');
    const info = [r.detalhe, r.corCoco ? 'cor ' + r.corCoco.toLowerCase() : '', 'às ' + hora(r.inicio)].filter(Boolean).join(' · ');
    return cartaoDestaque('🧷', 'azul', 'Última fralda', '<span data-ha="' + esc(r.inicio) + '"></span>', info, '', r.id);
  }

  function cartaoDestaque(icone, cor, rotulo, valorHtml, info, extra, id) {
    const abre = id ? '<button type="button" class="cartao destaque" data-acao="editar" data-id="' + esc(id) + '" style="width:100%;text-align:left;font:inherit">' : '<div class="cartao destaque">';
    const fecha = id ? '</button>' : '</div>';
    return abre +
      '<div class="destaque-icone ' + cor + '" aria-hidden="true">' + icone + '</div>' +
      '<div class="destaque-corpo">' +
      '<div class="destaque-rotulo">' + esc(rotulo) + '</div>' +
      '<div class="destaque-valor">' + valorHtml + '</div>' +
      (info ? '<div class="destaque-info">' + esc(info) + '</div>' : '') +
      (extra || '') +
      '</div>' + fecha;
  }

  function faixa24h() {
    const ini = inicioDia(new Date()).getTime();
    const fim = ini + DIA;
    const pos = (t) => Math.max(0, Math.min(100, ((t - ini) / DIA) * 100));
    let blocos = '';
    ativos().forEach((r) => {
      const a = ms(r.inicio), b = fimOuAgora(r);
      if (b < ini || a >= fim) return;
      if (r.tipo === 'Sono') {
        blocos += '<i class="sono" style="left:' + pos(a) + '%;width:' + (pos(b) - pos(a)) + '%"></i>';
      } else if (r.tipo === 'Mamada') {
        blocos += '<i class="mamada" style="left:' + pos(a) + '%;width:' + Math.max(0.6, pos(b) - pos(a)) + '%"></i>';
      } else if (r.tipo === 'Fralda') {
        blocos += '<i class="fralda" style="left:' + pos(a) + '%"></i>';
      }
    });
    blocos += '<i class="agora" style="left:' + pos(Date.now()) + '%"></i>';
    return '<div style="margin-top:14px">' +
      '<div class="faixa" role="img" aria-label="Linha do dia: sono, mamadas e fraldas">' + blocos + '</div>' +
      '<div class="faixa-horas"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div>' +
      '<div class="legenda"><span class="l-sono">Sono</span><span class="l-mamada">Mamada</span><span class="l-fralda">Fralda</span></div>' +
      '</div>';
  }

  function itemLista(r) {
    const t = TIPOS[r.tipo] || {};
    const dur = t.intervalo ? (r.fim ? duracaoCurta(ms(r.fim) - ms(r.inicio)) : 'agora') : '';
    return '<li><button type="button" class="item" data-acao="editar" data-id="' + esc(r.id) + '">' +
      '<span class="item-hora">' + hora(r.inicio) + '</span>' +
      '<span class="item-icone" aria-hidden="true">' + iconeTipo(r.tipo) + '</span>' +
      '<span class="item-corpo"><span class="item-titulo">' + esc(nomeTipo(r.tipo)) + '</span>' +
      '<span class="item-sub" style="display:block">' + esc(descrever(r)) + '</span></span>' +
      (dur ? '<span class="item-dur">' + esc(dur) + '</span>' : '') +
      (estado.pendentes.has(r.id) ? '<span class="item-pendente" title="Ainda não enviado à planilha"></span>' : '') +
      '</button></li>';
  }

  /* =====================================================================
   * Tela: Histórico
   * ===================================================================== */

  function telaHistorico() {
    const filtros = ['Todos', 'Mamada', 'Sono', 'Fralda', 'Outros'];
    let h = '<div class="chips" role="group" aria-label="Filtrar">' +
      filtros.map((f) => '<button type="button" class="chip" data-acao="filtro" data-valor="' + f + '" aria-pressed="' + (estado.filtro === f) + '">' + f + '</button>').join('') +
      '</div>';

    const limite = somarDias(inicioDia(new Date()), -(estado.diasHistorico - 1)).getTime();
    const passa = (r) => {
      if (estado.filtro === 'Todos') return true;
      if (estado.filtro === 'Outros') return OUTROS.includes(r.tipo);
      return r.tipo === estado.filtro;
    };
    const lista = ordenados().filter((r) => ms(r.inicio) >= limite && passa(r));

    if (!lista.length) {
      h += '<div class="cartao vazio" style="margin-top:12px">Nada registrado nesse período.</div>';
    } else {
      const dias = {};
      lista.forEach((r) => { (dias[chaveDia(r.inicio)] = dias[chaveDia(r.inicio)] || []).push(r); });
      Object.keys(dias).sort().reverse().forEach((chave) => {
        const s = resumoDia(dataDaChave(chave));
        const pl = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
        const sub = [pl(s.mamadas, 'mamada', 'mamadas'), pl(s.sonecas, 'soneca', 'sonecas'), pl(s.fraldas, 'fralda', 'fraldas')].join(' · ');
        h += '<div class="dia-titulo">' + esc(rotuloDia(chave)) + '<small>' + esc(sub) + '</small></div>';
        h += '<ul class="lista">' + dias[chave].map(itemLista).join('') + '</ul>';
      });
    }
    h += '<button type="button" class="botao secundario" style="margin-top:16px" data-acao="mais-dias">Mostrar mais 7 dias</button>';
    return h;
  }

  /* =====================================================================
   * Tela: Resumo
   * ===================================================================== */

  function telaResumo() {
    const dias = [];
    for (let i = 0; i < 7; i++) dias.push(somarDias(inicioDia(new Date()), -i));
    const resumos = dias.map((d) => ({ dia: d, s: resumoDia(d) }));

    let h = '<div class="secao-titulo">Últimos 7 dias</div>';
    h += '<div class="cartao tabela-wrap"><table class="tabela"><thead><tr>' +
      '<th>Dia</th><th>Mamadas</th><th>Intervalo</th><th>Sonecas</th><th>Fraldas</th>' +
      '</tr></thead><tbody>';
    resumos.forEach(({ dia, s }, i) => {
      h += '<tr' + (i === 0 ? ' class="hoje"' : '') + '>' +
        '<td>' + esc(i === 0 ? 'Hoje' : fmtDiaCurto.format(dia)) + '</td>' +
        '<td>' + s.mamadas + '</td>' +
        '<td>' + (s.intervaloMedio ? duracaoCurta(s.intervaloMedio) : '–') + '</td>' +
        '<td>' + s.sonecas + (s.tempoSoneca ? ' <small>(' + duracaoCurta(s.tempoSoneca) + ')</small>' : '') + '</td>' +
        '<td>' + s.fraldas + '</td></tr>';
    });
    h += '</tbody></table><p class="dica">Intervalo: tempo médio entre o início de uma mamada e o da seguinte.</p></div>';

    // Sono por dia
    const maxSono = Math.max(1, ...resumos.map(({ s }) => s.tempoSoneca + s.tempoNoturno));
    h += '<div class="secao-titulo">Sono por dia</div><div class="cartao"><div class="barras">';
    resumos.forEach(({ dia, s }, i) => {
      const total = s.tempoSoneca + s.tempoNoturno;
      h += '<div class="barra-linha"><span>' + esc(i === 0 ? 'Hoje' : fmtDiaCurto.format(dia)) + '</span>' +
        '<div class="barra"><i class="soneca" style="width:' + (s.tempoSoneca / maxSono * 100) + '%"></i>' +
        '<i class="noturno" style="width:' + (s.tempoNoturno / maxSono * 100) + '%"></i></div>' +
        '<span class="barra-valor">' + (total ? duracaoCurta(total) : '–') + '</span></div>';
    });
    h += '</div><div class="legenda"><span class="l-sono">Sonecas</span><span class="l-noite">Sono da noite</span></div></div>';

    // Médias
    const comDados = resumos.slice(1).filter(({ s }) => s.mamadas || s.sonecas || s.fraldas);
    if (comDados.length) {
      const media = (f) => comDados.reduce((t, { s }) => t + f(s), 0) / comDados.length;
      h += '<div class="secao-titulo">Média por dia (dias completos)</div><div class="cartao"><div class="numeros">' +
        numeroCaixa(numero(media((s) => s.mamadas), 1), 'mamadas') +
        numeroCaixa(duracaoCurta(media((s) => s.tempoSoneca + s.tempoNoturno)), 'de sono') +
        numeroCaixa(numero(media((s) => s.fraldas), 1), 'fraldas') +
        '</div><p class="dica" style="text-align:center">Com base em ' + comDados.length + (comDados.length === 1 ? ' dia' : ' dias') + ' anteriores a hoje.</p></div>';
    }

    // Crescimento
    const medidas = ['Peso', 'Altura', 'Perímetro cefálico'].map((t) => ultimo(t)).filter(Boolean);
    h += '<div class="secao-titulo">Crescimento</div><div class="cartao">';
    if (medidas.length) {
      medidas.forEach((r) => {
        const t = TIPOS[r.tipo];
        h += '<div class="config-linha"><span>' + esc(r.tipo) + ' <small>(' + fmtData.format(new Date(r.inicio)) + ')</small></span>' +
          '<span>' + numero(r.quantidade, t.casas) + ' ' + t.unidade + '</span></div>';
      });
    } else {
      h += '<p class="dica" style="margin:0">Registre peso, altura e perímetro cefálico em Registrar > Mais.</p>';
    }
    h += '</div>';
    return h;
  }

  /* =====================================================================
   * Tela: Ajustes
   * ===================================================================== */

  function telaAjustes() {
    const a = estado.ajustes;
    const b = estado.bebe;
    const quemOpcoes = ['Mãe', 'Pai'];
    const quemOutro = a.quem && !quemOpcoes.includes(a.quem);
    return '' +
      '<div class="secao-titulo">Conexão com a planilha</div><div class="cartao">' +
      '<div class="campo"><label for="aj-url">URL do app da Web (Apps Script)</label>' +
      '<input id="aj-url" class="entrada" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(a.url) + '"></div>' +
      '<div class="campo"><label for="aj-codigo">Código de acesso</label>' +
      '<input id="aj-codigo" class="entrada" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(a.codigo) + '">' +
      '<p class="dica">Na planilha: menu Rotina do Bento > Ver código de acesso.</p></div>' +
      '<button type="button" class="botao" data-acao="testar-conexao">Testar e salvar</button>' +
      '<p id="aj-conexao-msg" class="dica" role="status"></p>' +
      '</div>' +

      '<div class="secao-titulo">Quem usa este celular</div><div class="cartao">' +
      '<div class="opcoes" role="group" aria-label="Quem usa este celular">' +
      quemOpcoes.map((q) => '<button type="button" class="opcao" data-acao="quem" data-valor="' + q + '" aria-pressed="' + (a.quem === q) + '">' + q + '</button>').join('') +
      '<button type="button" class="opcao" data-acao="quem" data-valor="__outro" aria-pressed="' + quemOutro + '">Outra pessoa</button>' +
      '</div>' +
      '<div class="campo" id="aj-quem-outro" style="margin:12px 0 0"' + (quemOutro ? '' : ' hidden') + '>' +
      '<input class="entrada" id="aj-quem-texto" type="text" placeholder="Nome (ex.: Vovó)" value="' + esc(quemOutro ? a.quem : '') + '"></div>' +
      '<p class="dica">Esse nome vai na coluna "Registrado por" da planilha.</p></div>' +

      '<div class="secao-titulo">Aparência</div><div class="cartao"><div class="opcoes" role="group" aria-label="Tema">' +
      [['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']].map(([v, n]) =>
        '<button type="button" class="opcao" data-acao="tema" data-valor="' + v + '" aria-pressed="' + (a.tema === v) + '">' + n + '</button>').join('') +
      '</div><p class="dica">O modo escuro ajuda nas mamadas da madrugada.</p></div>' +

      '<div class="secao-titulo">Bebê</div><div class="cartao">' +
      '<div class="config-linha"><span>Nome</span><span>' + esc(b.nome) + '</span></div>' +
      '<div class="config-linha"><span>Nascimento</span><span>' + (b.nascimento ? fmtData.format(dataDaChave(b.nascimento)) : 'não informado') + '</span></div>' +
      '<div class="config-linha"><span>Intervalo entre mamadas</span><span>' + numero(b.intervaloMamadasH, 1) + ' h</span></div>' +
      '<div class="config-linha"><span>Sono da noite</span><span>das ' + b.noturnoInicio + 'h às ' + b.noturnoFim + 'h</span></div>' +
      '<p class="dica">Para mudar, edite a aba "Bebê" da planilha. O app atualiza na próxima sincronização.</p></div>' +

      '<div class="secao-titulo">Sincronização</div><div class="cartao">' +
      '<div class="config-linha"><span>Situação</span><span id="aj-sync-estado"></span></div>' +
      '<div class="config-linha"><span>Última sincronização</span><span id="aj-sync-ultima"></span></div>' +
      '<div class="config-linha"><span>Aguardando envio</span><span id="aj-sync-pendentes"></span></div>' +
      '<p id="aj-sync-erro" class="dica alerta" hidden></p>' +
      '<button type="button" class="botao" style="margin-top:12px" data-acao="sincronizar">Sincronizar agora</button>' +
      '<button type="button" class="botao secundario" data-acao="baixar-tudo">Baixar tudo da planilha de novo</button>' +
      '</div>' +

      '<div class="secao-titulo">Este celular</div><div class="cartao">' +
      '<p class="dica" style="margin-top:0">Apaga os registros guardados neste celular. O que já está na planilha continua lá e volta na próxima sincronização.</p>' +
      '<button type="button" class="botao perigo" style="margin-top:10px" data-acao="limpar-local">Apagar dados deste celular</button>' +
      '</div>' +
      '<p class="rodape">Rotina do Bento · versão ' + VERSAO + '</p>';
  }

  function atualizarAjustesSync() {
    const el = (id) => document.getElementById(id);
    if (!el('aj-sync-estado')) return;
    const textos = { ok: 'Em dia', sincronizando: 'Sincronizando…', pendente: 'Com envios pendentes', offline: 'Sem internet', erro: 'Com erro', desconfigurado: 'Planilha não conectada' };
    el('aj-sync-estado').textContent = textos[estado.sync.estado] || estado.sync.estado;
    el('aj-sync-ultima').textContent = estado.sync.ultima ? fmtDataHora.format(new Date(estado.sync.ultima)) : 'nunca';
    el('aj-sync-pendentes').textContent = String(estado.pendentes.size);
    const erro = el('aj-sync-erro');
    erro.hidden = !estado.sync.erro;
    erro.textContent = estado.sync.erro || '';
  }

  async function testarConexao() {
    const url = document.getElementById('aj-url').value.trim();
    const codigo = document.getElementById('aj-codigo').value.trim();
    const msg = document.getElementById('aj-conexao-msg');
    msg.className = 'dica';
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) {
      msg.className = 'dica alerta';
      msg.textContent = 'A URL deve começar com https://script.google.com/ e terminar em /exec.';
      return;
    }
    if (!codigo) { msg.className = 'dica alerta'; msg.textContent = 'Informe o código de acesso.'; return; }
    msg.textContent = 'Testando…';
    try {
      const dados = await chamarApi({ acao: 'ping' }, url, codigo);
      const mudouUrl = url !== estado.ajustes.url;
      estado.ajustes.url = url;
      estado.ajustes.codigo = codigo;
      gravar(CH.ajustes, estado.ajustes);
      if (mudouUrl) estado.desde = null; // planilha nova: baixa tudo
      if (dados.config) { estado.bebe = Object.assign(estado.bebe, dados.config); gravar(CH.bebe, estado.bebe); }
      persistir();
      msg.textContent = 'Conectado à planilha de ' + (estado.bebe.nome || 'Bento') + '.';
      atualizarTopo();
      sincronizar();
    } catch (e) {
      msg.className = 'dica alerta';
      msg.textContent = e.message;
    }
  }

  /* =====================================================================
   * Folha (modal) e formulários
   * ===================================================================== */

  const $folha = document.getElementById('folha');
  const $folhaConteudo = document.getElementById('folha-conteudo');
  let form = null; // estado do formulário aberto

  function abrirFolha(html) {
    $folhaConteudo.innerHTML = html;
    $folha.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function fecharFolha() {
    $folha.hidden = true;
    $folhaConteudo.innerHTML = '';
    document.body.style.overflow = '';
    form = null;
  }

  function folhaMamada() {
    const ultima = ultimo('Mamada', (r) => r.detalhe && r.detalhe.startsWith('Peito'));
    let dicaLado = '';
    if (ultima) {
      let lado = ultima.detalhe === 'Peito esquerdo' ? 'esquerdo' : ultima.detalhe === 'Peito direito' ? 'direito' : null;
      if (ultima.detalhe === 'Ambos os peitos' && /Começou no peito (esquerdo|direito)/.test(ultima.obs || '')) {
        lado = /esquerdo/.test(ultima.obs) ? 'direito' : 'esquerdo';
      }
      if (lado) dicaLado = '<p class="dica">Na última mamada no peito, terminou no lado ' + lado + ' (' + hora(ultima.inicio) + ').</p>';
    }
    abrirFolha('<h2 id="folha-titulo">🍼 Mamada</h2>' + dicaLado +
      '<div class="grande-opcoes" style="margin-top:12px">' +
      '<button type="button" class="botao laranja" data-acao="iniciar" data-tipo="Mamada" data-detalhe="Peito esquerdo"><span>◀</span>Iniciar no peito esquerdo</button>' +
      '<button type="button" class="botao laranja" data-acao="iniciar" data-tipo="Mamada" data-detalhe="Peito direito"><span>▶</span>Iniciar no peito direito</button>' +
      '<button type="button" class="botao secundario" data-acao="novo" data-tipo="Mamada" data-preset="mamadeira"><span>🍼</span>Registrar mamadeira</button>' +
      '<button type="button" class="botao secundario" data-acao="novo" data-tipo="Mamada"><span>✏️</span>Registrar mamada que já passou</button>' +
      '</div>');
  }

  function folhaSono() {
    const noturno = ehNoturno(new Date());
    abrirFolha('<h2 id="folha-titulo">🌙 Sono</h2>' +
      '<div class="grande-opcoes">' +
      '<button type="button" class="botao" data-acao="iniciar" data-tipo="Sono" data-detalhe="' + (noturno ? 'Sono noturno' : 'Soneca') + '"><span>▶</span>' +
      (noturno ? 'Começou o sono da noite' : 'Começou a soneca') + '</button>' +
      '<button type="button" class="botao secundario" data-acao="iniciar" data-tipo="Sono" data-detalhe="' + (noturno ? 'Soneca' : 'Sono noturno') + '"><span>▶</span>' +
      (noturno ? 'Começou uma soneca' : 'Começou o sono da noite') + '</button>' +
      '<button type="button" class="botao secundario" data-acao="novo" data-tipo="Sono"><span>✏️</span>Registrar sono que já passou</button>' +
      '</div>');
  }

  function folhaFralda() {
    abrirFolha('<h2 id="folha-titulo">🧷 Fralda</h2>' +
      '<p class="dica" style="margin-top:-8px">Xixi e fralda seca são salvos na hora. Para cocô, você escolhe a cor.</p>' +
      '<div class="grande-opcoes" style="margin-top:12px">' +
      '<button type="button" class="botao" data-acao="fralda-rapida" data-valor="Xixi"><span>💧</span>Xixi</button>' +
      '<button type="button" class="botao laranja" data-acao="novo" data-tipo="Fralda" data-preset="Cocô"><span>💩</span>Cocô</button>' +
      '<button type="button" class="botao laranja" data-acao="novo" data-tipo="Fralda" data-preset="Xixi e cocô"><span>💧</span>Xixi e cocô</button>' +
      '<button type="button" class="botao secundario" data-acao="fralda-rapida" data-valor="Seca"><span>○</span>Seca</button>' +
      '<button type="button" class="botao secundario" data-acao="novo" data-tipo="Fralda"><span>✏️</span>Outro horário ou detalhes</button>' +
      '</div>');
  }

  function folhaMais() {
    abrirFolha('<h2 id="folha-titulo">Registrar</h2><div class="acoes">' +
      OUTROS.map((t) => '<button type="button" class="acao" data-acao="novo" data-tipo="' + esc(t) + '">' +
        '<span class="acao-icone" aria-hidden="true">' + iconeTipo(t) + '</span>' +
        '<span class="acao-nome">' + esc(nomeTipo(t)) + '</span></button>').join('') +
      '</div>');
  }

  /* --- Formulário genérico --- */

  function grupoOpcoes(campo, opcoes, valor) {
    return '<div class="opcoes" role="group">' + opcoes.map((o) =>
      '<button type="button" class="opcao" data-acao="opcao" data-campo="' + campo + '" data-valor="' + esc(o) + '" aria-pressed="' + (valor === o) + '">' + esc(o) + '</button>'
    ).join('') + '</div>';
  }

  function campoData(id, rotulo, valorIso, comAgora) {
    return '<div class="campo"><label for="' + id + '">' + rotulo + '</label>' +
      '<div class="linha-entrada"><input id="' + id + '" class="entrada" type="datetime-local" value="' + (valorIso ? paraInput(valorIso) : '') + '">' +
      (comAgora ? '<button type="button" class="mini" data-acao="agora" data-alvo="' + id + '">Agora</button>' : '') +
      '</div></div>';
  }

  function abrirFormulario(tipo, id, opcoes) {
    opcoes = opcoes || {};
    const existente = id ? estado.registros[id] : null;
    const r = existente ? Object.assign({}, existente) : { tipo: tipo };
    const t = TIPOS[tipo] || {};
    const agora = agoraISO();

    if (!existente) {
      r.inicio = agora;
      if (t.intervalo) r.fim = agora;
      if (tipo === 'Mamada' && opcoes.preset === 'mamadeira') { r.detalhe = 'Mamadeira'; r.leite = 'Fórmula'; }
      if (tipo === 'Mamada' && !r.leite) r.leite = r.leite || 'Materno';
      if (tipo === 'Sono') r.detalhe = ehNoturno(new Date()) ? 'Sono noturno' : 'Soneca';
      if (tipo === 'Fralda') r.detalhe = opcoes.preset || 'Xixi';
      if (tipo === 'Remédio') r.unidade = 'gotas';
      if (t.unidade) r.unidade = t.unidade;
      if (tipo === 'Ordenha') r.unidade = 'ml';
    }

    form = { tipo: tipo, id: existente ? existente.id : null, valores: {
      detalhe: r.detalhe || null, leite: r.leite || null, corCoco: r.corCoco || null, unidade: r.unidade || null
    } };

    let h = '<h2 id="folha-titulo">' + iconeTipo(tipo) + ' ' + esc(nomeTipo(tipo)) + (existente ? ' <small style="font-weight:500;color:var(--texto-2)">editar</small>' : '') + '</h2>';

    if (t.intervalo) {
      h += campoData('f-inicio', 'Início', r.inicio, true);
      h += campoData('f-fim', 'Fim', r.fim, true);
      if (t.timer) {
        h += '<div class="campo"><label style="display:flex;gap:10px;align-items:center;font-weight:600;color:var(--texto)">' +
          '<input type="checkbox" id="f-andamento" ' + (existente && !existente.fim ? 'checked' : '') + ' style="width:22px;height:22px"> Ainda em andamento</label></div>';
      }
    } else {
      h += campoData('f-inicio', 'Horário', r.inicio, true);
    }

    switch (tipo) {
      case 'Mamada':
        h += '<div class="campo"><span class="rotulo">Como foi</span>' + grupoOpcoes('detalhe', OPCOES.ladoMamada, form.valores.detalhe) + '</div>';
        h += '<div class="campo"><span class="rotulo">Leite</span>' + grupoOpcoes('leite', OPCOES.leite, form.valores.leite) + '</div>';
        h += '<div class="campo" data-mostrar="mamadeira"><label for="f-qtd">Quantidade (ml)</label>' +
          '<input id="f-qtd" class="entrada" type="text" inputmode="decimal" value="' + esc(numero(r.quantidade, 0)) + '" placeholder="ex.: 60"></div>';
        break;
      case 'Sono':
        h += '<div class="campo"><span class="rotulo">Tipo de sono</span>' + grupoOpcoes('detalhe', OPCOES.sono, form.valores.detalhe) + '</div>';
        break;
      case 'Fralda':
        h += '<div class="campo"><span class="rotulo">Conteúdo</span>' + grupoOpcoes('detalhe', OPCOES.fralda, form.valores.detalhe) + '</div>';
        h += '<div class="campo" data-mostrar="coco"><span class="rotulo">Cor do cocô</span>' + grupoOpcoes('corCoco', OPCOES.corCoco, form.valores.corCoco) +
          '<p class="dica" id="f-dica-cor"></p></div>';
        break;
      case 'Ordenha':
        h += '<div class="campo"><span class="rotulo">Lado</span>' + grupoOpcoes('detalhe', OPCOES.ladoOrdenha, form.valores.detalhe) + '</div>';
        h += '<div class="campo"><label for="f-qtd">Quantidade (ml)</label><input id="f-qtd" class="entrada" type="text" inputmode="decimal" value="' + esc(numero(r.quantidade, 0)) + '" placeholder="ex.: 90"></div>';
        break;
      case 'Remédio':
        h += '<div class="campo"><label for="f-detalhe">Remédio</label><input id="f-detalhe" class="entrada" type="text" value="' + esc(r.detalhe || '') + '" placeholder="Nome do remédio ou vitamina"></div>';
        h += '<div class="campo"><label for="f-qtd">Dose</label><input id="f-qtd" class="entrada" type="text" inputmode="decimal" value="' + esc(numero(r.quantidade)) + '"></div>';
        h += '<div class="campo"><span class="rotulo">Unidade</span>' + grupoOpcoes('unidade', OPCOES.unidadeRemedio, form.valores.unidade) + '</div>';
        break;
      case 'Temperatura':
      case 'Peso':
      case 'Altura':
      case 'Perímetro cefálico': {
        const exemplos = { 'Temperatura': '36,7', 'Peso': '3,450', 'Altura': '50,5', 'Perímetro cefálico': '35' };
        h += '<div class="campo"><label for="f-qtd">' + esc(tipo) + ' (' + t.unidade + ')</label>' +
          '<input id="f-qtd" class="entrada" type="text" inputmode="decimal" value="' + esc(numero(r.quantidade, t.casas)) + '" placeholder="ex.: ' + exemplos[tipo] + '">' +
          (tipo === 'Temperatura' ? '<p class="dica" id="f-dica-temp"></p>' : '') + '</div>';
        break;
      }
      default:
        break;
    }

    h += '<div class="campo"><label for="f-obs">' + (tipo === 'Nota' ? 'Anotação' : 'Observação') + '</label>' +
      '<textarea id="f-obs" class="entrada" rows="3">' + esc(r.obs || '') + '</textarea></div>';

    h += '<p id="f-erro" class="dica alerta" role="alert"></p>';
    h += '<button type="button" class="botao laranja" data-acao="salvar-form">Salvar</button>';
    if (existente) h += '<button type="button" class="botao perigo" data-acao="excluir" data-id="' + esc(existente.id) + '">Excluir registro</button>';
    h += '<button type="button" class="botao secundario" data-acao="fechar">Cancelar</button>';

    abrirFolha(h);
    atualizarCondicionais();

    if (opcoes.focar === 'quantidade') {
      const q = document.getElementById('f-qtd');
      if (q) setTimeout(() => q.focus(), 250);
    }
  }

  function atualizarCondicionais() {
    if (!form) return;
    const d = form.valores.detalhe || '';
    document.querySelectorAll('[data-mostrar="mamadeira"]').forEach((el) => { el.hidden = d !== 'Mamadeira'; });
    document.querySelectorAll('[data-mostrar="coco"]').forEach((el) => { el.hidden = !/coc[oô]/i.test(d); });
    const fim = document.getElementById('f-fim');
    const andamento = document.getElementById('f-andamento');
    if (fim && andamento) fim.disabled = andamento.checked;

    const dicaCor = document.getElementById('f-dica-cor');
    if (dicaCor) {
      const c = form.valores.corCoco;
      const alerta = c === 'Branco' || c === 'Vermelho' || c === 'Preto';
      dicaCor.className = 'dica' + (alerta ? ' alerta' : '');
      dicaCor.textContent = alerta
        ? 'Cocô branco, vermelho ou preto (depois dos primeiros dias) é motivo para falar com o pediatra.'
        : '';
    }
    const dicaTemp = document.getElementById('f-dica-temp');
    const q = document.getElementById('f-qtd');
    if (dicaTemp && q) {
      const v = lerNumero(q.value);
      const alerta = v && v >= 37.8;
      dicaTemp.className = 'dica' + (alerta ? ' alerta' : '');
      dicaTemp.textContent = alerta ? 'Em recém-nascidos, 37,8 °C ou mais pede contato com o pediatra.' : '';
    }
  }

  function salvarFormulario() {
    if (!form) return;
    const erro = document.getElementById('f-erro');
    const t = TIPOS[form.tipo] || {};
    const base = form.id ? Object.assign({}, estado.registros[form.id]) : { tipo: form.tipo };

    const inicio = deInput(document.getElementById('f-inicio').value);
    if (!inicio) { erro.textContent = 'Informe o horário.'; return; }
    base.inicio = inicio;

    if (t.intervalo) {
      const andamento = document.getElementById('f-andamento');
      if (andamento && andamento.checked) {
        base.fim = null;
        const outro = emAndamento().find((r) => r.tipo === form.tipo && r.id !== form.id);
        if (outro) { erro.textContent = 'Já existe ' + nomeTipo(form.tipo).toLowerCase() + ' em andamento.'; return; }
      } else {
        const fim = deInput(document.getElementById('f-fim').value);
        if (!fim) { erro.textContent = 'Informe o horário do fim.'; return; }
        if (ms(fim) < ms(inicio)) { erro.textContent = 'O fim não pode ser antes do início.'; return; }
        if (ms(fim) - ms(inicio) > 16 * 3600000) { erro.textContent = 'Duração maior que 16 horas. Confira as datas.'; return; }
        base.fim = fim;
      }
    } else {
      base.fim = null;
    }

    Object.assign(base, {
      detalhe: form.valores.detalhe,
      leite: form.tipo === 'Mamada' ? form.valores.leite : null,
      corCoco: form.tipo === 'Fralda' && /coc[oô]/i.test(form.valores.detalhe || '') ? form.valores.corCoco : null,
      unidade: form.tipo === 'Remédio' ? form.valores.unidade : (t.unidade || (form.tipo === 'Ordenha' || form.tipo === 'Mamada' ? 'ml' : null))
    });

    const det = document.getElementById('f-detalhe');
    if (det) base.detalhe = det.value.trim() || null;

    const q = document.getElementById('f-qtd');
    if (q && !q.closest('[hidden]')) {
      const v = lerNumero(q.value);
      if (Number.isNaN(v)) { erro.textContent = 'Quantidade inválida. Use só números, por exemplo 3,45.'; return; }
      base.quantidade = v;
      if (['Temperatura', 'Peso', 'Altura', 'Perímetro cefálico'].includes(form.tipo) && v === null) {
        erro.textContent = 'Informe o valor.'; return;
      }
    } else {
      base.quantidade = null;
    }
    if (form.tipo === 'Mamada' && base.detalhe !== 'Mamadeira') base.quantidade = null;
    if (form.tipo === 'Mamada' && !base.quantidade) base.unidade = null;

    base.obs = document.getElementById('f-obs').value.trim() || null;
    if (form.tipo === 'Nota' && !base.obs) { erro.textContent = 'Escreva a anotação.'; return; }
    if (form.tipo === 'Remédio' && !base.detalhe) { erro.textContent = 'Informe o nome do remédio.'; return; }

    const novo = !form.id;
    salvarRegistro(base);
    fecharFolha();
    avisar(nomeTipo(base.tipo) + (novo ? ' registrada.' : ' atualizada.'));
  }

  /* =====================================================================
   * Eventos
   * ===================================================================== */

  document.addEventListener('click', (ev) => {
    const alvo = ev.target.closest('[data-acao], [data-aba]');
    if (!alvo) {
      if (ev.target === $folha) fecharFolha();
      return;
    }
    if (alvo.matches('.abas [data-aba]')) { irPara(alvo.dataset.aba); return; }

    const acao = alvo.dataset.acao;
    const id = alvo.dataset.id;
    switch (acao) {
      case 'ir': irPara(alvo.dataset.aba); break;
      case 'mamada': folhaMamada(); break;
      case 'sono': {
        const ativo = emAndamento().find((r) => r.tipo === 'Sono');
        if (ativo) abrirFormulario('Sono', ativo.id); else folhaSono();
        break;
      }
      case 'fralda': folhaFralda(); break;
      case 'mais': folhaMais(); break;
      case 'iniciar': fecharFolha(); iniciarTimer(alvo.dataset.tipo, alvo.dataset.detalhe); break;
      case 'novo': abrirFormulario(alvo.dataset.tipo, null, { preset: alvo.dataset.preset }); break;
      case 'editar': {
        const r = estado.registros[id];
        if (r) abrirFormulario(r.tipo, id);
        break;
      }
      case 'finalizar': finalizarTimer(id); break;
      case 'trocar-lado': trocarLado(id); break;
      case 'fralda-rapida':
        fecharFolha();
        salvarRegistro({ tipo: 'Fralda', inicio: agoraISO(), detalhe: alvo.dataset.valor });
        avisar('Fralda registrada: ' + alvo.dataset.valor.toLowerCase() + '.');
        break;
      case 'opcao': {
        const campo = alvo.dataset.campo;
        if (!form) break;
        const jaMarcado = alvo.getAttribute('aria-pressed') === 'true';
        alvo.parentElement.querySelectorAll('.opcao').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        // Tocar de novo desmarca (exceto o campo principal)
        if (jaMarcado && campo !== 'detalhe') { form.valores[campo] = null; }
        else { alvo.setAttribute('aria-pressed', 'true'); form.valores[campo] = alvo.dataset.valor; }
        atualizarCondicionais();
        break;
      }
      case 'agora': {
        const input = document.getElementById(alvo.dataset.alvo);
        if (input) { input.disabled = false; input.value = paraInput(); }
        const andamento = document.getElementById('f-andamento');
        if (andamento && alvo.dataset.alvo === 'f-fim') { andamento.checked = false; atualizarCondicionais(); }
        break;
      }
      case 'salvar-form': salvarFormulario(); break;
      case 'excluir':
        if (confirm('Excluir este registro? Ele também sai do resumo da planilha.')) { excluirRegistro(id); fecharFolha(); }
        break;
      case 'fechar': fecharFolha(); break;
      case 'filtro': estado.filtro = alvo.dataset.valor; render(); break;
      case 'mais-dias': estado.diasHistorico += 7; render(); break;
      case 'testar-conexao': testarConexao(); break;
      case 'quem': {
        const v = alvo.dataset.valor;
        document.querySelectorAll('[data-acao="quem"]').forEach((b) => b.setAttribute('aria-pressed', String(b === alvo)));
        const outro = document.getElementById('aj-quem-outro');
        if (v === '__outro') {
          outro.hidden = false;
          const txt = document.getElementById('aj-quem-texto');
          txt.focus();
          estado.ajustes.quem = txt.value.trim();
        } else {
          outro.hidden = true;
          estado.ajustes.quem = v;
        }
        gravar(CH.ajustes, estado.ajustes);
        break;
      }
      case 'tema':
        estado.ajustes.tema = alvo.dataset.valor;
        gravar(CH.ajustes, estado.ajustes);
        aplicarTema();
        document.querySelectorAll('[data-acao="tema"]').forEach((b) => b.setAttribute('aria-pressed', String(b === alvo)));
        break;
      case 'sincronizar': sincronizar(); break;
      case 'baixar-tudo':
        estado.desde = null;
        persistir();
        sincronizar();
        avisar('Baixando tudo da planilha…');
        break;
      case 'limpar-local':
        if (confirm('Apagar os registros guardados neste celular?' +
          (estado.pendentes.size ? '\n\nAtenção: ' + estado.pendentes.size + ' registro(s) ainda não foram enviados e serão perdidos.' : ''))) {
          estado.registros = {};
          estado.pendentes = new Set();
          estado.desde = null;
          persistir();
          render();
          sincronizar();
          avisar('Dados deste celular apagados.');
        }
        break;
      default: break;
    }
  });

  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'aj-quem-texto') {
      estado.ajustes.quem = ev.target.value.trim();
      gravar(CH.ajustes, estado.ajustes);
    }
    if (ev.target.id === 'f-qtd') atualizarCondicionais();
  });
  document.addEventListener('change', (ev) => {
    if (ev.target.id === 'f-andamento') atualizarCondicionais();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !$folha.hidden) fecharFolha();
  });
  document.getElementById('status-sync').addEventListener('click', () => irPara('ajustes'));

  // Sincroniza ao voltar para o app, ao recuperar internet e a cada 30 s
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { render(); agendarSync(100); }
  });
  window.addEventListener('online', () => agendarSync(100));
  window.addEventListener('offline', () => definirStatus('offline'));
  setInterval(() => { if (document.visibilityState === 'visible') agendarSync(0); }, 30000);

  // Cronômetros: a cada segundo. Tela Hoje: redesenha a cada minuto (para "próxima mamada").
  setInterval(tique, 1000);
  setInterval(() => { if (estado.aba === 'hoje' && document.visibilityState === 'visible') render(); }, 60000);

  /* =====================================================================
   * Início
   * ===================================================================== */

  aplicarTema();
  render();
  definirStatus(configurado() ? (estado.pendentes.size ? 'pendente' : 'ok') : 'desconfigurado');
  agendarSync(200);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sem modo offline */ });
  }

  // Para testes no navegador
  window.__rotina = { estado: estado, sincronizar: sincronizar, VERSAO: VERSAO };
})();
