/* Rotina do Bento: agenda
 * Calendário com consultas, vacinas, datas especiais e compromissos.
 * Mesversários são calculados a partir da data de nascimento (aba Bebê).
 * Lembretes aparecem dentro do app: um app instalado pelo Safari não consegue
 * tocar notificação com o app fechado. Para isso, cada evento pode ser
 * exportado para o calendário do celular.
 */
'use strict';
(function () {
  const RB = window.RB = window.RB || {};
  RB.telas = RB.telas || {};
  RB.acoes = RB.acoes || {};

  const CATEGORIAS = {
    'Consulta': '🩺',
    'Vacina': '💉',
    'Exame': '🔬',
    'Mesversário': '🎂',
    'Data especial': '⭐',
    'Compromisso': '📌',
    'Outro': '📝'
  };
  const LEMBRETES = [[null, 'Sem lembrete'], [30, '30 min antes'], [60, '1 h antes'], [180, '3 h antes'], [1440, '1 dia antes']];

  // Calendário Nacional de Vacinação (Ministério da Saúde), crianças até 15 meses.
  // O calendário muda de tempos em tempos: confirmar na Caderneta da Criança ou no posto.
  const VACINAS = [
    { meses: 0, doses: ['BCG (dose única)', 'Hepatite B (dose ao nascer)'] },
    { meses: 2, doses: ['Pentavalente (1ª dose)', 'Poliomielite inativada VIP (1ª dose)', 'Pneumocócica 10-valente (1ª dose)', 'Rotavírus (1ª dose)'] },
    { meses: 3, doses: ['Meningocócica C (1ª dose)'] },
    { meses: 4, doses: ['Pentavalente (2ª dose)', 'Poliomielite inativada VIP (2ª dose)', 'Pneumocócica 10-valente (2ª dose)', 'Rotavírus (2ª dose)'] },
    { meses: 5, doses: ['Meningocócica C (2ª dose)'] },
    { meses: 6, doses: ['Pentavalente (3ª dose)', 'Poliomielite inativada VIP (3ª dose)', 'Influenza (1ª dose, depois anual)', 'COVID-19 (1ª dose)'] },
    { meses: 7, doses: ['COVID-19 (2ª dose)'] },
    { meses: 9, doses: ['Febre amarela (1ª dose)', 'COVID-19 (3ª dose)'] },
    { meses: 12, doses: ['Tríplice viral (1ª dose)', 'Pneumocócica 10-valente (reforço)', 'Meningocócica (reforço)'] },
    { meses: 15, doses: ['DTP (1º reforço)', 'Poliomielite inativada VIP (reforço)', 'Hepatite A (dose única)', 'Tetra viral (ou tríplice viral 2ª dose + varicela)'] }
  ];

  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const p2 = (n) => String(n).padStart(2, '0');

  function navegacao() {
    const est = RB.estado;
    if (!est.agendaMes) { const d = new Date(); est.agendaMes = { a: d.getFullYear(), m: d.getMonth() }; }
    if (!est.agendaDia) est.agendaDia = RB.chaveDia(new Date());
    return est;
  }

  function somarMeses(base, k) {
    const a = base.getFullYear(), m = base.getMonth() + k, d = base.getDate();
    const ultimo = new Date(a, m + 1, 0).getDate();
    return new Date(a, m, Math.min(d, ultimo));
  }

  function eventosReais() {
    return Object.values(RB.estado.dados.agenda).filter((e) => e && !e.excluido && e.inicio);
  }

  function datasEspeciais(ini, fim) {
    const nasc = RB.nascimentoData();
    if (!nasc) return [];
    const lista = [];
    for (let k = 1; k <= 36; k++) {
      const d = somarMeses(nasc, k);
      if (d.getTime() < ini || d.getTime() >= fim) continue;
      const titulo = k % 12 === 0
        ? (k === 12 ? '1º aniversário do ' : (k / 12) + 'º aniversário do ') + RB.estado.bebe.nome
        : 'Mesversário: ' + k + (k === 1 ? ' mês' : ' meses');
      lista.push({ id: 'mes-' + k, virtual: true, titulo: titulo, categoria: 'Mesversário', inicio: d.toISOString(), diaInteiro: true });
    }
    return lista;
  }

  function eventosEntre(ini, fim) {
    return eventosReais()
      .filter((e) => RB.ms(e.inicio) >= ini && RB.ms(e.inicio) < fim)
      .concat(datasEspeciais(ini, fim))
      .sort((a, b) => RB.ms(a.inicio) - RB.ms(b.inicio) || (a.diaInteiro ? -1 : 1));
  }

  function eventosDoDia(chave) {
    const d0 = RB.dataDaChave(chave).getTime();
    return eventosEntre(d0, RB.somarDias(d0, 1).getTime());
  }

  function horarioEvento(e) {
    return e.diaInteiro ? 'Dia todo' : RB.hora(e.inicio);
  }

  function itemEvento(e, comData) {
    const quando = (comData ? RB.rotuloDia(RB.chaveDia(e.inicio)) + ' · ' : '') + horarioEvento(e);
    const sub = [quando, e.local, e.obs].filter(Boolean).join(' · ');
    const acao = e.virtual ? '' : ' data-acao="evento" data-id="' + RB.esc(e.id) + '"';
    return '<li><button type="button" class="item' + (e.concluido ? ' concluido' : '') + '"' + acao + '>' +
      '<span class="item-icone" aria-hidden="true">' + (CATEGORIAS[e.categoria] || '📝') + '</span>' +
      '<span class="item-corpo"><span class="item-titulo">' + RB.esc(e.titulo) + '</span>' +
      '<span class="item-sub" style="display:block">' + RB.esc(sub) + '</span></span>' +
      (e.concluido ? '<span class="item-dur">✓</span>' : '') +
      (RB.estado.pendentes.has('agenda:' + e.id) ? '<span class="item-pendente" title="Ainda não enviado à planilha"></span>' : '') +
      '</button></li>';
  }

  /* ---------- tela ---------- */

  function telaAgenda() {
    const est = navegacao();
    const { a, m } = est.agendaMes;
    const primeiro = new Date(a, m, 1);
    const inicioGrade = RB.somarDias(primeiro, -primeiro.getDay());
    const fimMes = new Date(a, m + 1, 1).getTime();
    const doMes = eventosEntre(inicioGrade.getTime(), RB.somarDias(inicioGrade, 42).getTime());
    const porDia = {};
    doMes.forEach((e) => { (porDia[RB.chaveDia(e.inicio)] = porDia[RB.chaveDia(e.inicio)] || []).push(e); });
    const hoje = RB.chaveDia(new Date());

    let h = '';
    if (RB.configurado() && est.versaoPlanilha === 1) {
      h += '<div class="cartao alerta-cartao" style="margin-bottom:10px"><b>Agenda só neste celular por enquanto.</b><p class="dica">Ela vai para a planilha e para o outro celular depois que o script novo for implantado.</p></div>';
    }
    h += '<div class="cartao calendario">' +
      '<div class="cal-topo">' +
      '<button type="button" class="cal-nav" data-acao="mes" data-valor="-1" aria-label="Mês anterior">‹</button>' +
      '<b>' + MESES[m] + ' ' + a + '</b>' +
      '<button type="button" class="cal-nav" data-acao="mes" data-valor="1" aria-label="Próximo mês">›</button>' +
      '</div><div class="cal-grade">' +
      ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => '<span class="cal-semana">' + d + '</span>').join('');
    for (let i = 0; i < 42; i++) {
      const d = RB.somarDias(inicioGrade, i);
      const chave = RB.chaveDia(d);
      const evs = porDia[chave] || [];
      const fora = d.getMonth() !== m;
      const classes = ['cal-dia', fora ? 'fora' : '', chave === hoje ? 'hoje' : '', chave === est.agendaDia ? 'selecionado' : ''].join(' ');
      const pontos = evs.slice(0, 3).map((e) => '<i class="p-' + (e.categoria === 'Mesversário' ? 'festa' : (e.categoria === 'Consulta' || e.categoria === 'Vacina' || e.categoria === 'Exame') ? 'saude' : 'outro') + '"></i>').join('');
      h += '<button type="button" class="' + classes + '" data-acao="dia" data-valor="' + chave + '"><span>' + d.getDate() + '</span><span class="cal-pontos">' + pontos + '</span></button>';
      if (i === 34 && RB.somarDias(inicioGrade, 35).getTime() >= fimMes) break;
    }
    h += '</div></div>';

    // Dia selecionado
    const evDia = eventosDoDia(est.agendaDia);
    h += '<div class="secao-titulo">' + RB.esc(RB.rotuloDia(est.agendaDia)) + (est.agendaDia !== hoje ? ' · ' + RB.fmtData.format(RB.dataDaChave(est.agendaDia)) : '') + '</div>';
    h += evDia.length ? '<ul class="lista">' + evDia.map((e) => itemEvento(e, false)).join('') + '</ul>'
      : '<div class="cartao vazio">Nada marcado neste dia.</div>';
    h += '<button type="button" class="botao laranja" style="margin-top:10px" data-acao="novo-evento" data-valor="' + est.agendaDia + '">+ Novo compromisso neste dia</button>';

    // Próximos
    const agora = Date.now();
    const proximos = eventosEntre(RB.inicioDia(new Date()).getTime(), agora + 45 * RB.DIA).filter((e) => !e.concluido).slice(0, 6);
    h += '<div class="secao-titulo">Próximos</div>';
    h += proximos.length ? '<ul class="lista">' + proximos.map((e) => itemEvento(e, true)).join('') + '</ul>'
      : '<div class="cartao vazio">Nenhum compromisso nos próximos 45 dias.</div>';

    // Vacinas
    h += '<div class="secao-titulo">Vacinas do calendário do SUS</div>' + cartaoVacinas();
    return h;
  }

  function cartaoVacinas() {
    const nasc = RB.nascimentoData();
    if (!nasc) return '<div class="cartao vazio">Informe a data de nascimento na aba Bebê da planilha.</div>';
    const titulos = new Set(eventosReais().map((e) => e.titulo));
    const hoje0 = RB.inicioDia(new Date()).getTime();
    let h = '<div class="cartao"><ul class="vacinas">';
    VACINAS.forEach((v) => {
      const data = somarMeses(nasc, v.meses);
      const titulo = v.meses === 0 ? 'Vacinas ao nascer' : 'Vacinas de ' + v.meses + (v.meses === 1 ? ' mês' : ' meses');
      const passou = data.getTime() < hoje0 - 30 * RB.DIA;
      const adicionada = titulos.has(titulo);
      h += '<li class="vacina' + (passou ? ' passada' : '') + '">' +
        '<div class="vacina-topo"><b>' + titulo + '</b><span>' + RB.fmtData.format(data) + '</span></div>' +
        '<p>' + v.doses.map(RB.esc).join(' · ') + '</p>' +
        (passou ? '' : adicionada ? '<span class="etiqueta">Na agenda</span>'
          : '<button type="button" class="link-acao" data-acao="agendar-vacina" data-valor="' + v.meses + '">+ Colocar na agenda</button>') +
        '</li>';
    });
    h += '</ul><p class="dica">Baseado no Calendário Nacional de Vacinação do Ministério da Saúde. O calendário muda: confirme as doses na Caderneta da Criança, com o pediatra ou no posto de saúde. A data é a idade indicada; o posto pode aplicar alguns dias depois.</p></div>';
    return h;
  }

  /* ---------- formulário ---------- */

  let formEvento = null;

  function abrirEvento(id, diaChave, preset) {
    const existente = id ? RB.estado.dados.agenda[id] : null;
    const e = existente ? Object.assign({}, existente) : Object.assign({
      titulo: '', categoria: 'Consulta', diaInteiro: false, lembreteMin: 60,
      inicio: new Date(RB.dataDaChave(diaChave || RB.chaveDia(new Date())).getTime() + 10 * RB.H).toISOString()
    }, preset || {});
    formEvento = { id: existente ? existente.id : null, categoria: e.categoria, lembreteMin: e.lembreteMin === undefined ? null : e.lembreteMin };
    const d = new Date(e.inicio);
    const dataVal = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    const horaVal = p2(d.getHours()) + ':' + p2(d.getMinutes());

    let h = '<h2 id="folha-titulo">' + (existente ? 'Editar compromisso' : 'Novo compromisso') + '</h2>' +
      '<div class="campo"><label for="ev-titulo">Título</label><input id="ev-titulo" class="entrada" type="text" value="' + RB.esc(e.titulo) + '" placeholder="Ex.: Consulta com a pediatra"></div>' +
      '<div class="campo"><span class="rotulo">Categoria</span><div class="opcoes" role="group">' +
      Object.keys(CATEGORIAS).filter((c) => c !== 'Mesversário').map((c) =>
        '<button type="button" class="opcao" data-acao="ev-categoria" data-valor="' + c + '" aria-pressed="' + (formEvento.categoria === c) + '">' + CATEGORIAS[c] + ' ' + c + '</button>').join('') +
      '</div></div>' +
      '<div class="campo"><label for="ev-data">Data</label><input id="ev-data" class="entrada" type="date" value="' + dataVal + '"></div>' +
      '<div class="campo"><label style="display:flex;gap:10px;align-items:center;font-weight:600;color:var(--texto)">' +
      '<input type="checkbox" id="ev-dia-inteiro" ' + (e.diaInteiro ? 'checked' : '') + ' style="width:22px;height:22px"> Dia todo (sem horário)</label></div>' +
      '<div class="campo" id="ev-hora-campo"' + (e.diaInteiro ? ' hidden' : '') + '><label for="ev-hora">Horário</label><input id="ev-hora" class="entrada" type="time" value="' + horaVal + '"></div>' +
      '<div class="campo"><label for="ev-local">Local</label><input id="ev-local" class="entrada" type="text" value="' + RB.esc(e.local || '') + '" placeholder="Opcional"></div>' +
      '<div class="campo"><span class="rotulo">Lembrete no app</span><div class="opcoes" role="group">' +
      LEMBRETES.map(([v, n]) => '<button type="button" class="opcao" data-acao="ev-lembrete" data-valor="' + (v === null ? '' : v) + '" aria-pressed="' + (formEvento.lembreteMin === v) + '">' + n + '</button>').join('') +
      '</div><p class="dica">O lembrete aparece na tela Hoje. Para receber alerta com o app fechado, use "Adicionar ao calendário do celular" depois de salvar.</p></div>' +
      '<div class="campo"><label for="ev-obs">Observação</label><textarea id="ev-obs" class="entrada" rows="3">' + RB.esc(e.obs || '') + '</textarea></div>' +
      '<p id="ev-erro" class="dica alerta" role="alert"></p>' +
      '<button type="button" class="botao laranja" data-acao="ev-salvar">Salvar</button>';
    if (existente) {
      h += '<button type="button" class="botao" data-acao="ev-concluir" data-id="' + RB.esc(existente.id) + '">' + (existente.concluido ? 'Marcar como não feito' : '✓ Marcar como feito') + '</button>' +
        '<button type="button" class="botao secundario" data-acao="ev-ics" data-id="' + RB.esc(existente.id) + '">📅 Adicionar ao calendário do celular</button>' +
        '<button type="button" class="botao perigo" data-acao="ev-excluir" data-id="' + RB.esc(existente.id) + '">Excluir</button>';
    }
    h += '<button type="button" class="botao secundario" data-acao="fechar">Cancelar</button>';
    RB.abrirFolha(h);
  }

  function salvarEvento() {
    const erro = document.getElementById('ev-erro');
    const titulo = document.getElementById('ev-titulo').value.trim();
    const data = document.getElementById('ev-data').value;
    const diaInteiro = document.getElementById('ev-dia-inteiro').checked;
    const horaTxt = document.getElementById('ev-hora').value || '09:00';
    if (!titulo) { erro.textContent = 'Dê um título ao compromisso.'; return; }
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
    if (!m) { erro.textContent = 'Escolha a data.'; return; }
    const [hh, mm] = diaInteiro ? [0, 0] : horaTxt.split(':').map(Number);
    const inicio = new Date(+m[1], +m[2] - 1, +m[3], hh, mm).toISOString();
    const base = formEvento.id ? Object.assign({}, RB.estado.dados.agenda[formEvento.id]) : {};
    Object.assign(base, {
      titulo: titulo,
      categoria: formEvento.categoria || 'Outro',
      inicio: inicio,
      fim: null,
      diaInteiro: diaInteiro,
      local: document.getElementById('ev-local').value.trim() || null,
      obs: document.getElementById('ev-obs').value.trim() || null,
      lembreteMin: formEvento.lembreteMin,
      concluido: !!base.concluido
    });
    const novo = !formEvento.id;
    RB.estado.agendaDia = RB.chaveDia(inicio);
    RB.salvarItem('agenda', base);
    RB.fecharFolha();
    RB.avisar(novo ? 'Compromisso salvo.' : 'Compromisso atualizado.');
  }

  function exportarIcs(e) {
    const f = (d) => d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + '00Z';
    const fd = (d) => d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate());
    const ini = new Date(e.inicio);
    const limpa = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rotina do Bento//PT-BR', 'BEGIN:VEVENT',
      'UID:' + e.id + '@rotina-do-bento', 'DTSTAMP:' + f(new Date())];
    if (e.diaInteiro) {
      linhas.push('DTSTART;VALUE=DATE:' + fd(ini), 'DTEND;VALUE=DATE:' + fd(RB.somarDias(ini, 1)));
    } else {
      linhas.push('DTSTART:' + f(ini), 'DTEND:' + f(new Date(ini.getTime() + RB.H)));
    }
    linhas.push('SUMMARY:' + limpa(e.titulo));
    if (e.local) linhas.push('LOCATION:' + limpa(e.local));
    if (e.obs) linhas.push('DESCRIPTION:' + limpa(e.obs));
    if (e.lembreteMin) linhas.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + limpa(e.titulo), 'TRIGGER:-PT' + e.lembreteMin + 'M', 'END:VALARM');
    linhas.push('END:VEVENT', 'END:VCALENDAR');
    const blob = new Blob([linhas.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'compromisso-bento.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /* ---------- tela Hoje ---------- */

  function vistos() { return RB.ler('rb:lembretesVistos', {}); }

  function lembretesAtivos() {
    const agora = Date.now();
    const v = vistos();
    return eventosReais().filter((e) => {
      if (e.concluido || e.lembreteMin === null || e.lembreteMin === undefined || v[e.id]) return false;
      const ini = RB.ms(e.inicio);
      return agora >= ini - e.lembreteMin * RB.M && agora < ini + 2 * RB.H;
    });
  }

  function avisosAgenda() {
    return lembretesAtivos().map((e) =>
      '<div class="lembrete-banner"><span aria-hidden="true">' + (CATEGORIAS[e.categoria] || '📌') + '</span>' +
      '<div><b>' + RB.esc(e.titulo) + '</b><small>' + RB.esc(RB.rotuloDia(RB.chaveDia(e.inicio)) + ' · ' + horarioEvento(e) + (e.local ? ' · ' + e.local : '')) + '</small></div>' +
      '<button type="button" data-acao="lembrete-ok" data-id="' + RB.esc(e.id) + '">OK</button></div>').join('');
  }

  function proximosCompromissos() {
    const ini = RB.inicioDia(new Date()).getTime();
    const lista = eventosEntre(ini, ini + 7 * RB.DIA).filter((e) => !e.concluido).slice(0, 3);
    if (!lista.length) return '';
    return '<div class="secao-titulo">Próximos compromissos</div><ul class="lista">' + lista.map((e) => itemEvento(e, true)).join('') + '</ul>' +
      '<button type="button" class="botao secundario" style="margin-top:10px" data-acao="ir" data-aba="agenda">Abrir agenda</button>';
  }

  RB.telas.agenda = telaAgenda;
  RB.proximosCompromissos = proximosCompromissos;
  RB.avisosAgenda = avisosAgenda;

  Object.assign(RB.acoes, {
    'mes': (alvo) => {
      const est = navegacao();
      const d = new Date(est.agendaMes.a, est.agendaMes.m + Number(alvo.dataset.valor), 1);
      est.agendaMes = { a: d.getFullYear(), m: d.getMonth() };
      RB.render();
    },
    'dia': (alvo) => { navegacao().agendaDia = alvo.dataset.valor; RB.render(); },
    'novo-evento': (alvo) => abrirEvento(null, alvo.dataset.valor),
    'evento': (alvo) => abrirEvento(alvo.dataset.id),
    'ev-categoria': (alvo) => {
      formEvento.categoria = alvo.dataset.valor;
      alvo.parentElement.querySelectorAll('.opcao').forEach((b) => b.setAttribute('aria-pressed', String(b === alvo)));
    },
    'ev-lembrete': (alvo) => {
      formEvento.lembreteMin = alvo.dataset.valor === '' ? null : Number(alvo.dataset.valor);
      alvo.parentElement.querySelectorAll('.opcao').forEach((b) => b.setAttribute('aria-pressed', String(b === alvo)));
    },
    'ev-salvar': () => salvarEvento(),
    'ev-concluir': (alvo) => {
      const e = Object.assign({}, RB.estado.dados.agenda[alvo.dataset.id]);
      e.concluido = !e.concluido;
      RB.salvarItem('agenda', e);
      RB.fecharFolha();
      RB.avisar(e.concluido ? 'Marcado como feito.' : 'Marcado como não feito.');
    },
    'ev-excluir': (alvo) => {
      if (!confirm('Excluir este compromisso?')) return;
      const e = Object.assign({}, RB.estado.dados.agenda[alvo.dataset.id]);
      e.excluido = true;
      RB.salvarItem('agenda', e);
      RB.fecharFolha();
      RB.avisar('Compromisso excluído.');
    },
    'ev-ics': (alvo) => exportarIcs(RB.estado.dados.agenda[alvo.dataset.id]),
    'agendar-vacina': (alvo) => {
      const meses = Number(alvo.dataset.valor);
      const v = VACINAS.find((x) => x.meses === meses);
      const data = somarMeses(RB.nascimentoData(), meses);
      abrirEvento(null, RB.chaveDia(data), {
        titulo: meses === 0 ? 'Vacinas ao nascer' : 'Vacinas de ' + meses + (meses === 1 ? ' mês' : ' meses'),
        categoria: 'Vacina', diaInteiro: true, lembreteMin: 1440,
        inicio: data.toISOString(), obs: v.doses.join('; ')
      });
    },
    'lembrete-ok': (alvo) => {
      const v = vistos();
      v[alvo.dataset.id] = true;
      RB.gravar('rb:lembretesVistos', v);
      RB.render();
    }
  });

  document.addEventListener('change', (ev) => {
    if (ev.target.id === 'ev-dia-inteiro') {
      const campo = document.getElementById('ev-hora-campo');
      if (campo) campo.hidden = ev.target.checked;
    }
  });
})();
