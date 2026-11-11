/* Rotina do Bento: sono
 * Previsão de sonecas, programação do dia, análise e insights.
 *
 * Como as previsões funcionam
 * 1. Referência por idade (tabela REF_SONO): janelas de vigília e duração típica
 *    de soneca usadas por pediatras e consultoras de sono, e totais de sono
 *    recomendados pela National Sleep Foundation (2015) e pela Academia
 *    Americana de Medicina do Sono (2016). Janelas de vigília são um consenso
 *    prático, não uma regra rígida: cada bebê tem seu ritmo.
 * 2. Dados do Bento: com pelo menos DIAS_MINIMOS dias de registros de sono,
 *    a duração prevista de cada soneca passa a usar a mediana das sonecas
 *    dele que começaram perto do mesmo horário (últimos 14 dias), sempre
 *    mostrada ao lado da referência.
 */
'use strict';
(function () {
  const RB = window.RB = window.RB || {};
  RB.telas = RB.telas || {};
  RB.acoes = RB.acoes || {};

  const DIAS_MINIMOS = 10;
  const PREPARO_MIN = 10; // minutos de rotina antes da soneca (fralda, quarto escuro, ruído, colo)
  const CICLO_MIN = 45;   // um ciclo de sono do bebê pequeno dura cerca de 40 a 50 min

  // ateSem: limite superior da faixa, em semanas de vida
  const REF_SONO = [
    { ateSem: 4,   faixa: '0 a 4 semanas', janela: [35, 60],   sonecas: '4 a 6 ou mais', duracao: [30, 120], alvo: 60,  total: [14, 17] },
    { ateSem: 8,   faixa: '1 a 2 meses',   janela: [60, 90],   sonecas: '4 a 6',         duracao: [30, 120], alvo: 60,  total: [14, 17] },
    { ateSem: 13,  faixa: '2 a 3 meses',   janela: [75, 105],  sonecas: '4 a 5',         duracao: [30, 120], alvo: 60,  total: [14, 17] },
    { ateSem: 17,  faixa: '3 a 4 meses',   janela: [80, 120],  sonecas: '4',             duracao: [40, 120], alvo: 75,  total: [12, 16] },
    { ateSem: 26,  faixa: '4 a 6 meses',   janela: [105, 150], sonecas: '3 a 4',         duracao: [40, 120], alvo: 75,  total: [12, 16] },
    { ateSem: 35,  faixa: '6 a 8 meses',   janela: [120, 180], sonecas: '3',             duracao: [45, 120], alvo: 75,  total: [12, 16] },
    { ateSem: 44,  faixa: '8 a 10 meses',  janela: [150, 210], sonecas: '2',             duracao: [60, 120], alvo: 90,  total: [12, 16] },
    { ateSem: 61,  faixa: '10 a 14 meses', janela: [180, 240], sonecas: '2',             duracao: [60, 120], alvo: 90,  total: [11, 14] },
    { ateSem: 999, faixa: '14 a 24 meses', janela: [240, 360], sonecas: '1',             duracao: [60, 150], alvo: 120, total: [11, 14] }
  ];

  /* ---------- utilidades ---------- */

  const mediana = (arr) => {
    if (!arr.length) return null;
    const s = arr.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const media = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const desvio = (arr) => {
    const m = media(arr);
    return arr.length > 1 ? Math.sqrt(arr.reduce((t, x) => t + (x - m) * (x - m), 0) / (arr.length - 1)) : 0;
  };
  const minutosDoDia = (t) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
  const dur = (r) => RB.ms(r.fim) - RB.ms(r.inicio);
  const fmtMin = (min) => RB.duracaoCurta(min * RB.M);

  function refAtual(em) {
    const s = RB.semanasDeVida(em);
    const sem = s === null ? 6 : s;
    return REF_SONO.find((r) => sem < r.ateSem) || REF_SONO[REF_SONO.length - 1];
  }

  function horaDormirHora() {
    const b = RB.estado.bebe;
    if (b.horaDormir !== null && b.horaDormir !== undefined && b.horaDormir !== '' && isFinite(Number(b.horaDormir))) {
      return Number(b.horaDormir);
    }
    const s = RB.semanasDeVida();
    return s === null || s < 13 ? 22 : s < 17 ? 21 : 20;
  }

  /** Dia "lógico": um despertar à 1h ainda pertence ao dia anterior. */
  function diaLogico(t) { return RB.inicioDia(t - 4 * RB.H).getTime(); }

  function horaDormirDoDia(diaMs) {
    const h = horaDormirHora();
    return diaMs + (h < 12 ? h + 24 : h) * RB.H;
  }

  function sonos() {
    return RB.ativos().filter((r) => r.tipo === 'Sono').sort((a, b) => RB.ms(a.inicio) - RB.ms(b.inicio));
  }
  const ehSoneca = (r) => r.detalhe !== 'Sono noturno';

  function diasComSono() {
    return new Set(sonos().map((r) => RB.chaveDia(r.inicio))).size;
  }
  function personalizado() { return diasComSono() >= DIAS_MINIMOS; }

  function sonecasRecentes(dias) {
    const lim = Date.now() - (dias || 14) * RB.DIA;
    return sonos().filter((r) => ehSoneca(r) && r.fim && RB.ms(r.inicio) >= lim && dur(r) >= 10 * RB.M && dur(r) <= 4 * RB.H);
  }

  function sonecasPerto(minDia, raio) {
    raio = raio || 90;
    return sonecasRecentes(14).filter((r) => {
      const dif = Math.abs(minutosDoDia(RB.ms(r.inicio)) - minDia);
      return Math.min(dif, 1440 - dif) <= raio;
    });
  }

  /** Tempo acordado antes de uma soneca (fim do sono anterior até o início desta). */
  function janelaAntes(r) {
    const ini = RB.ms(r.inicio);
    const anteriores = sonos().filter((x) => x.fim && RB.ms(x.fim) <= ini && x.id !== r.id);
    if (!anteriores.length) return null;
    const fim = Math.max.apply(null, anteriores.map((x) => RB.ms(x.fim)));
    const gap = ini - fim;
    return gap > 0 && gap <= 6 * RB.H ? gap : null;
  }

  /** Duração prevista (min) para uma soneca que começa em t. */
  function duracaoPrevista(t) {
    const ref = refAtual();
    if (personalizado()) {
      const perto = sonecasPerto(minutosDoDia(t));
      if (perto.length >= 3) {
        const med = mediana(perto.map(dur)) / RB.M;
        return { min: Math.max(20, Math.min(ref.duracao[1], med)), fonte: 'bento', n: perto.length, mediana: med };
      }
    }
    return { min: ref.alvo, fonte: 'referencia' };
  }

  /* ---------- previsões ---------- */

  function previsaoSoneca(r) {
    const ref = refAtual();
    const ini = RB.ms(r.inicio);
    if (!ehSoneca(r)) return { noite: true };
    const p = duracaoPrevista(ini);
    const alvoRef = ini + ref.alvo * RB.M;
    const esperado = ini + p.min * RB.M;
    let limite = ini + ref.duracao[1] * RB.M;
    let motivoLimite = 'sonecas diurnas acima de ' + fmtMin(ref.duracao[1]) + ' costumam roubar mamadas e sono da noite';
    const hd = horaDormirDoDia(diaLogico(ini));
    const protegeNoite = hd - ref.janela[0] * RB.M;
    if (ini < hd && protegeNoite < limite) {
      limite = Math.max(ini + 20 * RB.M, protegeNoite);
      motivoLimite = 'para chegar com sono na hora de dormir (' + RB.horaMs(hd) + ')';
    }
    return { ini, esperado, alvoRef, limite, motivoLimite, ciclo: ini + CICLO_MIN * RB.M, prev: p, ref };
  }

  function estadoAgora() {
    const ref = refAtual();
    const agora = Date.now();
    const ativo = RB.emAndamento().find((r) => r.tipo === 'Sono');
    if (ativo) return { dormindo: true, r: ativo, p: previsaoSoneca(ativo), ref };
    const lista = sonos().filter((r) => r.fim);
    if (!lista.length) return { semDados: true, ref };
    const ultimoSono = lista.reduce((a, b) => (RB.ms(b.fim) > RB.ms(a.fim) ? b : a));
    const acordouEm = RB.ms(ultimoSono.fim);
    if (agora - acordouEm > 8 * RB.H) return { semDados: true, ref };
    const inicioJanela = acordouEm + ref.janela[0] * RB.M;
    const fimJanela = acordouEm + ref.janela[1] * RB.M;
    const preparar = inicioJanela - PREPARO_MIN * RB.M;
    const hd = horaDormirDoDia(diaLogico(acordouEm));
    const madrugada = !ehSoneca(ultimoSono) && RB.ehNoturno(acordouEm) && new Date(acordouEm).getHours() < 5;
    const proximaENoite = madrugada || inicioJanela >= hd - 45 * RB.M;
    let pessoal = null;
    if (personalizado()) {
      const janelas = sonecasRecentes(14).map(janelaAntes).filter((x) => x !== null).map((x) => x / RB.M);
      if (janelas.length >= 5) pessoal = mediana(janelas);
    }
    return { acordado: true, ultimoSono, acordouEm, inicioJanela, fimJanela, preparar, proximaENoite, madrugada, hd, ref, pessoal };
  }

  /* ---------- programação do dia ---------- */

  function programacao() {
    const ref = refAtual();
    const agora = Date.now();
    const hoje0 = diaLogico(agora);
    const itens = [];

    // Acordou: fim do último sono da noite que terminou entre 4h e 12h de hoje
    const noites = sonos().filter((r) => !ehSoneca(r) && r.fim && RB.ms(r.fim) >= hoje0 && RB.ms(r.fim) < hoje0 + 8 * RB.H);
    const acordou = noites.length ? Math.max.apply(null, noites.map((r) => RB.ms(r.fim))) : null;
    if (acordou) itens.push({ tipo: 'acordou', ini: acordou, status: 'registrado' });

    const hd = horaDormirDoDia(hoje0);
    const doDia = sonos().filter((r) => {
      const t = RB.ms(r.inicio);
      return ehSoneca(r) && t >= Math.max(hoje0, acordou || hoje0) && t < hd + 2 * RB.H;
    });
    let n = 0;
    let ultimoFim = acordou;
    doDia.forEach((r) => {
      n++;
      if (r.fim) {
        itens.push({ tipo: 'soneca', n, ini: RB.ms(r.inicio), fim: RB.ms(r.fim), status: 'registrado', id: r.id });
        ultimoFim = RB.ms(r.fim);
      } else {
        const p = previsaoSoneca(r);
        itens.push({ tipo: 'soneca', n, ini: RB.ms(r.inicio), fim: p.esperado, status: 'andamento', id: r.id });
        ultimoFim = p.esperado;
      }
    });

    const noiteHoje = sonos().find((r) => !ehSoneca(r) && RB.ms(r.inicio) >= hoje0 + 14 * RB.H);
    if (noiteHoje) {
      itens.push({ tipo: 'noite', ini: RB.ms(noiteHoje.inicio), status: 'registrado' });
      return { itens, ref, hd };
    }
    if (ultimoFim === null) return { itens, ref, hd, semInicio: true };

    let t = ultimoFim;
    for (let guarda = 0; guarda < 8; guarda++) {
      const iniJ = t + ref.janela[0] * RB.M;
      const fimJ = t + ref.janela[1] * RB.M;
      const meio = (iniJ + fimJ) / 2;
      const d = duracaoPrevista(meio).min * RB.M;
      if (meio + d + ref.janela[0] * RB.M > hd) break;
      n++;
      itens.push({ tipo: 'soneca', n, ini: iniJ, iniMax: fimJ, fim: meio + d, status: 'estimado' });
      t = meio + d;
    }
    itens.push({ tipo: 'noite', ini: t + ref.janela[0] * RB.M, iniMax: Math.max(t + ref.janela[1] * RB.M, hd), status: 'estimado' });
    return { itens, ref, hd };
  }

  /* ---------- análise e insights ---------- */

  /** Despertares da noite que começa no dia (chave). null se a noite não foi registrada. */
  function noiteDo(diaMs) {
    const ini = diaMs + 17 * RB.H, fim = diaMs + 35 * RB.H; // 17h até 11h do dia seguinte
    const trechos = sonos().filter((r) => !ehSoneca(r) && RB.ms(r.inicio) >= ini && RB.ms(r.inicio) < fim);
    if (!trechos.length) return null;
    const primeiro = RB.ms(trechos[0].inicio);
    const ultimoFim = Math.max.apply(null, trechos.map((r) => RB.fimOuAgora(r)));
    const mamadas = RB.ativos().filter((r) => r.tipo === 'Mamada' && RB.ms(r.inicio) > primeiro && RB.ms(r.inicio) < ultimoFim).length;
    return { despertares: trechos.length - 1, inicio: primeiro, mamadas };
  }

  function analise(dias) {
    const hoje0 = RB.inicioDia(new Date()).getTime();
    const linhas = [];
    for (let i = dias - 1; i >= 0; i--) {
      const d0 = RB.somarDias(hoje0, -i).getTime();
      const d1 = RB.somarDias(d0, 1).getTime();
      const total = sonos().reduce((t, r) => t + RB.sobreposicao(r, d0, Math.min(d1, Date.now())), 0);
      const sonecas = sonos().filter((r) => ehSoneca(r) && RB.ms(r.inicio) >= d0 && RB.ms(r.inicio) < d1);
      const tSonecas = sonecas.reduce((t, r) => t + (RB.fimOuAgora(r) - RB.ms(r.inicio)), 0);
      const noite = noiteDo(d0);
      linhas.push({ d0, total, sonecas: sonecas.length, tSonecas, tNoite: Math.max(0, total - tSonecas), noite, hoje: i === 0 });
    }
    return linhas;
  }

  function insights() {
    const ref = refAtual();
    const lista = [];
    const naps = sonecasRecentes(14);

    // 1. Duração das sonecas por período do dia
    const periodos = [['da manhã', 0, 720], ['do início da tarde', 720, 900], ['do fim da tarde', 900, 1080], ['da noite', 1080, 1440]];
    periodos.forEach(([nome, a, b]) => {
      const ns = naps.filter((r) => { const x = minutosDoDia(RB.ms(r.inicio)); return x >= a && x < b; });
      if (ns.length < 3) return;
      const med = mediana(ns.map(dur)) / RB.M;
      const nDias = new Set(ns.map((r) => RB.chaveDia(r.inicio))).size;
      const horario = RB.horaMs(RB.inicioDia(new Date()).getTime() + mediana(ns.map((r) => minutosDoDia(RB.ms(r.inicio)))) * RB.M);
      if (med < CICLO_MIN) {
        lista.push({ tom: 'alerta', icone: '⏱️', titulo: 'Sonecas ' + nome + ' estão curtas',
          texto: 'Nos últimos ' + nDias + ' dias, as sonecas que começam perto das ' + horario + ' duraram em média ' + fmtMin(med) +
            '. A referência para ' + ref.faixa + ' é de cerca de ' + fmtMin(ref.alvo) + '.',
          porque: 'Uma soneca de 30 a 45 minutos costuma ser um único ciclo de sono. Ajudar o bebê a emendar o segundo ciclo (quarto escuro, ruído branco contínuo, colo ou mão no peito no primeiro despertar) tende a alongar a soneca.' });
      } else if (med > ref.duracao[1]) {
        lista.push({ tom: 'alerta', icone: '⏰', titulo: 'Sonecas ' + nome + ' estão longas',
          texto: 'As sonecas perto das ' + horario + ' duraram em média ' + fmtMin(med) + ' (referência: até ' + fmtMin(ref.duracao[1]) + ').',
          porque: 'Sonecas muito longas durante o dia podem diminuir as mamadas do dia e empurrar o sono para a madrugada.' });
      } else {
        lista.push({ tom: 'ok', icone: '✅', titulo: 'Sonecas ' + nome + ' dentro do esperado',
          texto: 'Média de ' + fmtMin(med) + ' em ' + ns.length + ' sonecas (referência: ' + fmtMin(ref.duracao[0]) + ' a ' + fmtMin(ref.duracao[1]) + ').' });
      }
    });

    // 2. Janelas de vigília
    const janelas = naps.map(janelaAntes).filter((x) => x !== null).map((x) => x / RB.M);
    if (janelas.length >= 5) {
      const med = mediana(janelas);
      const faixa = fmtMin(ref.janela[0]) + ' a ' + fmtMin(ref.janela[1]);
      if (med > ref.janela[1] * 1.15) {
        lista.push({ tom: 'alerta', icone: '🥱', titulo: 'Tempo acordado acima da referência',
          texto: 'Antes das sonecas, ' + RB.estado.bebe.nome + ' tem ficado acordado em média ' + fmtMin(med) + '. Para ' + ref.faixa + ', a referência é ' + faixa + '.',
          porque: 'Bebês que passam da janela podem ficar cansados demais: choram mais, demoram a pegar no sono e fazem sonecas mais curtas.' });
      } else if (med < ref.janela[0] * 0.85) {
        lista.push({ tom: 'alerta', icone: '🌤️', titulo: 'Tempo acordado abaixo da referência',
          texto: 'A média tem sido ' + fmtMin(med) + ' acordado antes das sonecas (referência: ' + faixa + ').',
          porque: 'Se o bebê ainda não tem sono suficiente, pode demorar a dormir ou fazer sonecas curtas.' });
      } else {
        lista.push({ tom: 'ok', icone: '✅', titulo: 'Janelas de vigília adequadas',
          texto: 'Média de ' + fmtMin(med) + ' acordado antes das sonecas (referência: ' + faixa + ').' });
      }
    }

    // 3. Total de sono em 24 h (dias completos)
    const linhas = analise(8).filter((l) => !l.hoje && l.total > 0);
    if (linhas.length >= 4) {
      const medH = media(linhas.map((l) => l.total)) / RB.H;
      const txt = 'Média de ' + RB.numero(medH, 1) + ' h por dia nos últimos ' + linhas.length + ' dias. Recomendado para ' + ref.faixa + ': ' + ref.total[0] + ' a ' + ref.total[1] + ' h.';
      if (medH < ref.total[0] - 0.5) {
        lista.push({ tom: 'alerta', icone: '📉', titulo: 'Sono total abaixo do recomendado', texto: txt,
          porque: 'Os totais são da National Sleep Foundation e da Academia Americana de Medicina do Sono. Se o registro estiver completo e a diferença continuar, vale comentar com o pediatra.' });
      } else {
        lista.push({ tom: 'ok', icone: '✅', titulo: 'Sono total no esperado', texto: txt });
      }
    }

    // 4. Soneca longa no fim do dia x despertares da madrugada
    const hoje0 = RB.inicioDia(new Date()).getTime();
    const grupoLonga = [], grupoCurta = [];
    for (let i = 1; i <= 14; i++) {
      const d0 = RB.somarDias(hoje0, -i).getTime();
      const noite = noiteDo(d0);
      if (!noite) continue;
      const tardias = sonos().filter((r) => ehSoneca(r) && r.fim && RB.ms(r.inicio) >= d0 + 16 * RB.H && RB.ms(r.inicio) < noite.inicio);
      const maior = tardias.length ? Math.max.apply(null, tardias.map(dur)) / RB.M : 0;
      (maior > 90 ? grupoLonga : grupoCurta).push(noite.despertares);
    }
    if (grupoLonga.length >= 3 && grupoCurta.length >= 3) {
      const a = media(grupoLonga), b = media(grupoCurta);
      if (a - b >= 1) {
        lista.push({ tom: 'alerta', icone: '🌙', titulo: 'Soneca longa no fim do dia, madrugada mais agitada',
          texto: 'Nas noites depois de uma soneca de mais de 1h30 a partir das 16h, ' + RB.estado.bebe.nome + ' acordou em média ' + RB.numero(a, 1) +
            ' vezes. Nas outras noites, ' + RB.numero(b, 1) + ' vezes.',
          porque: 'Uma soneca longa perto da hora de dormir reduz a pressão de sono da noite. O app avisa o horário limite dessa soneca para proteger a madrugada.' });
      }
    }

    // 5. Regularidade da hora de dormir
    const inicios = [];
    for (let i = 1; i <= 14; i++) {
      const noite = noiteDo(RB.somarDias(hoje0, -i).getTime());
      if (noite) { let m = minutosDoDia(noite.inicio); if (m < 720) m += 1440; inicios.push(m); }
    }
    if (inicios.length >= 5) {
      const dp = desvio(inicios);
      const medio = RB.horaMs(hoje0 + (media(inicios) % 1440) * RB.M);
      if (dp > 60) {
        lista.push({ tom: 'alerta', icone: '🕰️', titulo: 'Hora de dormir varia bastante',
          texto: 'O sono da noite começou em média às ' + medio + ', mas variando cerca de ' + fmtMin(dp) + ' para mais ou para menos.',
          porque: 'Uma rotina de dormir parecida todos os dias (banho, mamada, quarto escuro) ajuda o relógio biológico, que começa a se formar entre 2 e 4 meses.' });
      } else {
        lista.push({ tom: 'ok', icone: '✅', titulo: 'Hora de dormir regular', texto: 'Em média às ' + medio + ', com pouca variação.' });
      }
    }
    return lista;
  }

  /* ---------- interface ---------- */

  function linhaPrevisaoSoneca(r) {
    const p = previsaoSoneca(r);
    if (p.noite) return '<p class="timer-previsao">Sono da noite. Bom descanso!</p>';
    const fonte = p.prev.fonte === 'bento' ? 'costuma acordar' : 'previsão';
    return '<p class="timer-previsao">' + fonte + ' por volta das <b>' + RB.horaMs(p.esperado) + '</b> · acordar até ' + RB.horaMs(p.limite) + '</p>';
  }

  function cartaoSonoHoje() {
    const e = estadoAgora();
    if (e.semDados || !e.acordado) {
      return RB.cartaoDestaque('🌙', 'azul', 'Sono', 'Sem registro recente', 'Registre quando ele dormir e acordar para ver a próxima janela de soneca.', '');
    }
    const agora = Date.now();
    let etiqueta = '';
    if (e.madrugada) {
      etiqueta = '<span class="etiqueta">Madrugada: volte a dormir quando ele mostrar sono</span>';
    } else if (e.proximaENoite) {
      etiqueta = '<span class="etiqueta">Sono da noite entre ' + RB.horaMs(e.inicioJanela) + ' e ' + RB.horaMs(Math.max(e.fimJanela, e.hd)) + '</span>';
    } else if (agora < e.preparar) {
      etiqueta = '<span class="etiqueta">Próxima soneca: ' + RB.horaMs(e.inicioJanela) + '–' + RB.horaMs(e.fimJanela) +
        ' · preparar em <b data-ate="' + e.preparar + '"></b></span>';
    } else if (agora < e.inicioJanela) {
      etiqueta = '<span class="etiqueta alerta">Comece a preparar a soneca (janela às ' + RB.horaMs(e.inicioJanela) + ')</span>';
    } else if (agora <= e.fimJanela) {
      etiqueta = '<span class="etiqueta alerta">Hora da soneca! A janela vai até ' + RB.horaMs(e.fimJanela) + '</span>';
    } else {
      etiqueta = '<span class="etiqueta alerta">Passou da janela há ' + RB.duracao(agora - e.fimJanela) + ': observe sinais de cansaço</span>';
    }
    const info = 'Último sono: ' + RB.hora(e.ultimoSono.inicio) + '–' + RB.hora(e.ultimoSono.fim) + ' (' + RB.duracao(dur(e.ultimoSono)) + ')';
    const botao = !e.proximaENoite && agora < e.preparar
      ? '<button type="button" class="link-acao" data-acao="timer-preparo" data-fim="' + e.preparar + '">⏰ Me avise na hora de preparar</button>'
      : '';
    return RB.cartaoDestaque('🌙', 'azul', 'Acordado', '<span data-ha="' + RB.esc(e.ultimoSono.fim) + '"></span>', info, etiqueta + botao);
  }

  function telaSono() {
    const ref = refAtual();
    const e = estadoAgora();
    let h = '';

    // Agora
    h += '<div class="secao-titulo">Agora</div>';
    if (e.dormindo) {
      const p = e.p;
      if (p.noite) {
        h += '<div class="cartao"><b>🌙 Sono da noite desde ' + RB.hora(e.r.inicio) + '</b><p class="dica">Durante a noite o app não faz previsão de soneca.</p></div>';
      } else {
        const fonte = p.prev.fonte === 'bento'
          ? 'Com base em ' + p.prev.n + ' sonecas do ' + RB.esc(RB.estado.bebe.nome) + ' que começaram perto deste horário (mediana ' + fmtMin(p.prev.mediana) + ').'
          : 'Pela referência da idade (' + ref.faixa + '). Com ' + DIAS_MINIMOS + ' dias de registros, a previsão passa a usar os dados dele.';
        h += '<div class="cartao previsao">' +
          '<div class="previsao-rotulo">😴 Soneca desde ' + RB.hora(e.r.inicio) + ' · <span data-desde="' + RB.esc(e.r.inicio) + '"></span></div>' +
          '<div class="previsao-grande">deve dormir até <b>' + RB.horaMs(p.esperado) + '</b></div>' +
          '<div class="previsao-linhas">' +
          (p.esperado > p.ciclo ? '<div><span>Primeiro ciclo termina</span><b>' + RB.horaMs(p.ciclo) + '</b></div>' : '') +
          '<div><span>Referência saudável</span><b>até ' + RB.horaMs(p.alvoRef) + '</b></div>' +
          '<div><span>Acordar no máximo às</span><b>' + RB.horaMs(p.limite) + '</b></div>' +
          '</div>' +
          '<p class="dica">' + fonte + ' Limite: ' + p.motivoLimite + '.</p>' +
          '<p class="dica">Se ele acordar perto do fim do primeiro ciclo, tente ajudar a emendar antes de tirar do berço.</p>' +
          '</div>';
      }
    } else if (e.acordado) {
      h += cartaoSonoHoje();
      if (e.pessoal) {
        h += '<p class="dica">Nos últimos 14 dias, ele ficou em média ' + fmtMin(e.pessoal) + ' acordado antes das sonecas. Referência para ' + ref.faixa + ': ' + fmtMin(ref.janela[0]) + ' a ' + fmtMin(ref.janela[1]) + '.</p>';
      }
    } else {
      h += '<div class="cartao vazio">Registre o sono (botão Sono na tela Hoje) para ver as previsões.</div>';
    }

    // Programação do dia
    const prog = programacao();
    h += '<div class="secao-titulo">Programação do dia</div><div class="cartao"><ul class="plano">';
    if (prog.semInicio && !prog.itens.length) {
      h += '<li class="plano-vazio">Registre o sono da noite (ou o primeiro sono do dia) para montar a programação.</li>';
    }
    const nomes = ['Primeira', 'Segunda', 'Terceira', 'Quarta', 'Quinta', 'Sexta', 'Sétima', 'Oitava'];
    prog.itens.forEach((it) => {
      let icone, titulo, horario, status;
      if (it.tipo === 'acordou') { icone = '☀️'; titulo = 'Acordou'; horario = RB.horaMs(it.ini); }
      else if (it.tipo === 'noite') { icone = '🌙'; titulo = 'Sono da noite'; horario = it.iniMax ? RB.horaMs(it.ini) + ' – ' + RB.horaMs(it.iniMax) : RB.horaMs(it.ini); }
      else {
        icone = '😴'; titulo = (nomes[it.n - 1] || it.n + 'ª') + ' soneca';
        horario = it.status === 'estimado' ? RB.horaMs(it.ini) + ' – ' + RB.horaMs(it.fim) : RB.horaMs(it.ini) + ' – ' + RB.horaMs(it.fim);
      }
      status = it.status === 'registrado' ? 'Registrado'
        : it.status === 'andamento' ? 'Dormindo agora (fim previsto)'
          : it.tipo === 'noite' ? 'Janela ideal para dormir' : 'Estimado · começar entre ' + RB.horaMs(it.ini) + ' e ' + RB.horaMs(it.iniMax);
      h += '<li class="plano-item ' + it.status + '"><span class="plano-icone" aria-hidden="true">' + icone + '</span>' +
        '<span class="plano-corpo"><b>' + titulo + '</b><small>' + status + '</small></span>' +
        '<span class="plano-hora">' + horario + '</span></li>';
    });
    h += '</ul><p class="dica">Os horários se ajustam a cada registro. Hora alvo para dormir à noite: ' + RB.horaMs(prog.hd) + ' (aba Bebê da planilha).</p></div>';

    // Análise
    const periodo = RB.estado.periodoSono || 7;
    const linhas = analise(periodo);
    const completos = linhas.filter((l) => !l.hoje && l.total > 0);
    const medTotal = completos.length ? media(completos.map((l) => l.total)) : null;
    const comSonecas = completos.filter((l) => l.sonecas);
    const medSonecas = comSonecas.length ? media(comSonecas.map((l) => l.sonecas)) : null;
    const todasNaps = sonecasRecentes(periodo);
    const medDurNap = todasNaps.length ? mediana(todasNaps.map(dur)) : null;
    const noites = completos.map((l) => l.noite).filter(Boolean);
    const medDesp = noites.length ? media(noites.map((n) => n.despertares)) : null;
    const max = Math.max(RB.H, ...linhas.map((l) => l.total));

    h += '<div class="secao-titulo">Análise do sono</div><div class="cartao">' +
      '<div class="chips" role="group" aria-label="Período">' +
      [7, 14].map((p) => '<button type="button" class="chip" data-acao="periodo-sono" data-valor="' + p + '" aria-pressed="' + (periodo === p) + '">' + p + ' dias</button>').join('') +
      '</div>' +
      '<div class="numeros" style="margin-top:6px">' +
      '<div class="numero"><b>' + (medTotal ? RB.numero(medTotal / RB.H, 1) + 'h' : '–') + '</b><span>sono por dia</span></div>' +
      '<div class="numero"><b>' + (medSonecas ? RB.numero(medSonecas, 1) : '–') + '</b><span>sonecas por dia</span></div>' +
      '<div class="numero"><b>' + (medDurNap ? RB.duracaoCurta(medDurNap) : '–') + '</b><span>duração da soneca</span></div>' +
      '</div>' +
      '<div class="numeros">' +
      '<div class="numero"><b>' + (medDesp !== null ? RB.numero(medDesp, 1) : '–') + '</b><span>despertares por noite</span></div>' +
      '<div class="numero"><b>' + ref.total[0] + '–' + ref.total[1] + 'h</b><span>recomendado/dia</span></div>' +
      '<div class="numero"><b>' + ref.sonecas + '</b><span>sonecas na idade</span></div>' +
      '</div>' +
      '<div class="colunas" role="img" aria-label="Horas de sono por dia">' +
      linhas.map((l) => {
        const hs = l.total / RB.H;
        return '<div class="coluna' + (l.hoje ? ' hoje' : '') + '">' +
          '<span class="coluna-valor">' + (l.total ? RB.numero(hs, 1) : '') + '</span>' +
          '<div class="coluna-barra"><i class="noturno" style="height:' + (l.tNoite / max * 100) + '%"></i><i class="soneca" style="height:' + (l.tSonecas / max * 100) + '%"></i></div>' +
          '<span class="coluna-dia">' + (periodo <= 7 ? RB.fmtDiaCurto.format(new Date(l.d0)).replace('.', '') : new Date(l.d0).getDate()) + '</span></div>';
      }).join('') +
      '</div>' +
      '<div class="legenda"><span class="l-sono">Sonecas</span><span class="l-noite">Noite</span></div>' +
      '<p class="dica">O dia de hoje ainda está em andamento e não entra nas médias.</p>' +
      '</div>';

    // Insights
    const dias = diasComSono();
    h += '<div class="secao-titulo">Insights do ' + RB.esc(RB.estado.bebe.nome) + '</div>';
    if (dias < DIAS_MINIMOS) {
      h += '<div class="cartao"><b>Coletando dados: ' + dias + ' de ' + DIAS_MINIMOS + ' dias</b>' +
        '<div class="progresso"><i style="width:' + (dias / DIAS_MINIMOS * 100) + '%"></i></div>' +
        '<p class="dica">Com ' + DIAS_MINIMOS + ' dias de registros de sono, o app compara as sonecas do ' + RB.esc(RB.estado.bebe.nome) +
        ' com a referência da idade, usa os horários dele nas previsões e aponta padrões (por exemplo, soneca longa no fim do dia e madrugada agitada). Até lá, as previsões usam a referência.</p></div>';
    } else {
      const lista = insights();
      if (!lista.length) h += '<div class="cartao vazio">Ainda não há padrões claros. Continue registrando.</div>';
      lista.forEach((i) => {
        h += '<div class="cartao insight ' + i.tom + '"><div class="insight-topo"><span aria-hidden="true">' + i.icone + '</span><b>' + RB.esc(i.titulo) + '</b></div>' +
          '<p>' + RB.esc(i.texto) + '</p>' + (i.porque ? '<p class="dica">Por quê: ' + RB.esc(i.porque) + '</p>' : '') + '</div>';
      });
    }

    // Referência
    h += '<div class="secao-titulo">Referência para a idade</div><div class="cartao">' +
      '<div class="config-linha"><span>Faixa</span><span>' + ref.faixa + '</span></div>' +
      '<div class="config-linha"><span>Tempo acordado entre sonos</span><span>' + fmtMin(ref.janela[0]) + ' a ' + fmtMin(ref.janela[1]) + '</span></div>' +
      '<div class="config-linha"><span>Sonecas por dia</span><span>' + ref.sonecas + '</span></div>' +
      '<div class="config-linha"><span>Duração da soneca</span><span>' + fmtMin(ref.duracao[0]) + ' a ' + fmtMin(ref.duracao[1]) + '</span></div>' +
      '<div class="config-linha"><span>Sono total em 24 h</span><span>' + ref.total[0] + ' a ' + ref.total[1] + ' h</span></div>' +
      '<p class="dica">Totais: National Sleep Foundation (2015) e Academia Americana de Medicina do Sono (2016). Janelas de vigília e duração de soneca: consenso prático usado por pediatras e consultoras de sono, com variação grande entre bebês. ' +
      'Nos primeiros meses o relógio biológico ainda está se formando, e saltos de desenvolvimento, cólicas e picos de crescimento bagunçam o sono. As previsões ajudam a planejar, mas os sinais do bebê (bocejo, olhar parado, esfregar os olhos) vêm primeiro.</p>' +
      '</div>';
    return h;
  }

  RB.telas.sono = telaSono;
  RB.cartaoSonoHoje = cartaoSonoHoje;
  RB.linhaPrevisaoSoneca = linhaPrevisaoSoneca;
  RB.sono = { refAtual, estadoAgora, previsaoSoneca, programacao, insights, analise, diasComSono, REF_SONO, DIAS_MINIMOS };

  RB.acoes['periodo-sono'] = (alvo) => { RB.estado.periodoSono = Number(alvo.dataset.valor); RB.render(); };
})();
