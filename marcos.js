/* Rotina do Bento: marcos de desenvolvimento
 * Fases por idade, com marcos esperados em cada uma. Os marcos foram escritos
 * a partir das referências públicas da Caderneta da Criança (Ministério da
 * Saúde) e do programa "Learn the Signs. Act Early" do CDC (EUA).
 * Cada bebê tem seu ritmo: as idades são janelas comuns, não prazos.
 */
'use strict';
(function () {
  const RB = window.RB = window.RB || {};
  RB.telas = RB.telas || {};
  RB.acoes = RB.acoes || {};

  const ICONES = { 'Motor': '🤸', 'Linguagem': '🗣️', 'Social': '😊', 'Cognitivo': '🧠', 'Sentidos': '👀' };

  // de / ate: semanas de vida
  const FASES = [
    { id: 'f1', n: 1, nome: 'Chegando ao mundo', faixa: 'até 1 mês', de: 0, ate: 4,
      sobre: 'O bebê está se adaptando: dorme muito, mama com frequência e reconhece a voz e o cheiro dos pais.',
      dica: 'Converse olhando de perto (20 a 30 cm), faça contato pele a pele e responda ao choro: isso constrói segurança.',
      marcos: [
        ['f1-rosto', 'Fixa o olhar em um rosto próximo', 'Sentidos'],
        ['f1-som', 'Se assusta ou pisca com um barulho alto', 'Sentidos'],
        ['f1-acalma', 'Se acalma no colo ou com a voz dos pais', 'Social'],
        ['f1-movimento', 'Mexe braços e pernas dos dois lados igualmente', 'Motor'],
        ['f1-suga', 'Suga bem e coordena mamar e respirar', 'Motor'],
        ['f1-cabeca', 'De bruços, vira a cabeça para o lado', 'Motor']
      ] },
    { id: 'f2', n: 2, nome: 'Primeiros sorrisos', faixa: '1 a 2 meses', de: 4, ate: 9,
      sobre: 'Aparecem o sorriso social e os primeiros sons além do choro. O bebê começa a acompanhar o que se move.',
      dica: 'Sorria e espere a resposta, imite os sons dele e mostre objetos coloridos devagar de um lado para o outro.',
      marcos: [
        ['f2-sorriso', 'Sorri quando alguém sorri ou fala com ele', 'Social'],
        ['f2-segue', 'Acompanha um objeto ou rosto com os olhos', 'Sentidos'],
        ['f2-arrulho', 'Faz sons além do choro ("aaa", "ooo")', 'Linguagem'],
        ['f2-ergue', 'De bruços, levanta a cabeça por alguns segundos', 'Motor'],
        ['f2-olha-voz', 'Olha na direção de quem está falando', 'Sentidos'],
        ['f2-maos', 'Abre as mãos e leva às vezes à boca', 'Motor']
      ] },
    { id: 'f3', n: 3, nome: 'Descobrindo o corpo', faixa: '2 a 4 meses', de: 9, ate: 17,
      sobre: 'O bebê descobre as mãos, firma o pescoço e começa a "conversar" com risadas e gritinhos.',
      dica: 'Ofereça tempo de barriga para baixo várias vezes ao dia e brinquedos fáceis de segurar.',
      marcos: [
        ['f3-pescoco', 'Sustenta a cabeça firme no colo', 'Motor'],
        ['f3-maos-boca', 'Leva as mãos à boca de propósito', 'Motor'],
        ['f3-risada', 'Dá risada alta', 'Social'],
        ['f3-vira-som', 'Vira a cabeça na direção de um som', 'Sentidos'],
        ['f3-segura', 'Segura um brinquedo colocado na mão', 'Motor'],
        ['f3-antebracos', 'De bruços, se apoia nos antebraços', 'Motor'],
        ['f3-conversa', 'Responde com sons quando alguém fala com ele', 'Linguagem']
      ] },
    { id: 'f4', n: 4, nome: 'Rolando e alcançando', faixa: '4 a 6 meses', de: 17, ate: 26,
      sobre: 'Hora de rolar, alcançar objetos e explorar tudo com a boca. O balbucio fica mais variado.',
      dica: 'Deixe brinquedos um pouco fora do alcance no chão para incentivar o movimento.',
      marcos: [
        ['f4-rola', 'Rola de barriga para cima para barriga para baixo', 'Motor'],
        ['f4-alcanca', 'Estica o braço para pegar um objeto', 'Motor'],
        ['f4-balbucia', 'Balbucia ("ba", "ma", "da")', 'Linguagem'],
        ['f4-conhecidos', 'Reconhece pessoas próximas e sorri para elas', 'Social'],
        ['f4-boca', 'Leva objetos à boca para explorar', 'Cognitivo'],
        ['f4-senta-apoio', 'Fica sentado com apoio', 'Motor']
      ] },
    { id: 'f5', n: 5, nome: 'Sentando e explorando', faixa: '6 a 9 meses', de: 26, ate: 39,
      sobre: 'O bebê senta sozinho, passa objetos de uma mão para a outra e começa a estranhar desconhecidos.',
      dica: 'Brinque de esconder e achar (cadê? achou!) e chame pelo nome dele com frequência.',
      marcos: [
        ['f5-senta', 'Senta sem apoio', 'Motor'],
        ['f5-troca-mao', 'Passa um objeto de uma mão para a outra', 'Motor'],
        ['f5-nome', 'Atende quando chamam pelo nome', 'Linguagem'],
        ['f5-estranha', 'Estranha pessoas desconhecidas', 'Social'],
        ['f5-silabas', 'Repete sílabas ("mamama", "papapa")', 'Linguagem'],
        ['f5-procura', 'Procura um objeto que caiu ou foi escondido', 'Cognitivo']
      ] },
    { id: 'f6', n: 6, nome: 'Engatinhando e de pé', faixa: '9 a 12 meses', de: 39, ate: 53,
      sobre: 'Começam o deslocamento, os primeiros apoios para ficar de pé e os gestos para se comunicar.',
      dica: 'Deixe a casa segura para ele explorar e nomeie tudo o que ele aponta ou pega.',
      marcos: [
        ['f6-desloca', 'Engatinha ou se arrasta para se deslocar', 'Motor'],
        ['f6-de-pe', 'Fica de pé se apoiando nos móveis', 'Motor'],
        ['f6-pinca', 'Pega objetos pequenos com o polegar e o indicador', 'Motor'],
        ['f6-tchau', 'Dá tchau ou bate palmas', 'Social'],
        ['f6-palavra', 'Fala a primeira palavra com sentido', 'Linguagem'],
        ['f6-nao', 'Entende o "não"', 'Cognitivo']
      ] },
    { id: 'f7', n: 7, nome: 'Primeiros passos e palavras', faixa: '12 a 18 meses', de: 53, ate: 79,
      sobre: 'Os passos ganham confiança e o vocabulário cresce. A criança imita o que vê os adultos fazendo.',
      dica: 'Leia livros com figuras grandes e deixe ele ajudar em tarefas simples.',
      marcos: [
        ['f7-anda', 'Anda sozinho', 'Motor'],
        ['f7-palavras', 'Fala algumas palavras', 'Linguagem'],
        ['f7-aponta', 'Aponta para mostrar algo que quer', 'Social'],
        ['f7-rabisca', 'Rabisca com giz ou lápis', 'Motor'],
        ['f7-copo', 'Bebe no copo com ajuda', 'Motor'],
        ['f7-imita', 'Imita tarefas da casa', 'Cognitivo']
      ] },
    { id: 'f8', n: 8, nome: 'Pequeno explorador', faixa: '18 a 24 meses', de: 79, ate: 105,
      sobre: 'Corre, sobe, junta palavras e começa a brincar de faz de conta.',
      dica: 'Ofereça escolhas simples ("blusa azul ou vermelha?") e brinque de faz de conta com ele.',
      marcos: [
        ['f8-corre', 'Corre', 'Motor'],
        ['f8-frase', 'Junta duas palavras ("quer água")', 'Linguagem'],
        ['f8-chuta', 'Chuta uma bola', 'Motor'],
        ['f8-corpo', 'Mostra partes do corpo quando perguntam', 'Cognitivo'],
        ['f8-faz-conta', 'Brinca de faz de conta', 'Cognitivo'],
        ['f8-escada', 'Sobe degraus com apoio', 'Motor']
      ] }
  ];

  function faseDaIdade() {
    const s = RB.semanasDeVida();
    if (s === null) return FASES[0];
    return FASES.find((f) => s < f.ate) || FASES[FASES.length - 1];
  }

  function conquistas() {
    const mapa = {};
    Object.values(RB.estado.dados.marcos).forEach((m) => { if (m && !m.excluido) mapa[m.id] = m; });
    return mapa;
  }

  function marcosDaFase(fase) {
    const feitos = conquistas();
    const lista = fase.marcos.map(([id, texto, cat]) => ({ id, texto, cat, feito: feitos[id] || null }));
    Object.values(feitos).forEach((m) => {
      if (m.fase === fase.id && !fase.marcos.some((x) => x[0] === m.id)) {
        lista.push({ id: m.id, texto: m.marco, cat: m.categoria || 'Cognitivo', feito: m, proprio: true });
      }
    });
    return lista;
  }

  function telaMarcos() {
    const est = RB.estado;
    const atual = faseDaIdade();
    const fase = FASES.find((f) => f.id === est.faseMarcos) || atual;
    const lista = marcosDaFase(fase);
    const feitos = lista.filter((m) => m.feito).length;
    const idx = FASES.indexOf(fase);

    let h = '';
    if (RB.configurado() && est.versaoPlanilha === 1) {
      h += '<div class="cartao alerta-cartao" style="margin-bottom:10px"><b>Marcos só neste celular por enquanto.</b><p class="dica">Eles vão para a planilha e para o outro celular depois que o script novo for implantado.</p></div>';
    }
    h += '<div class="fase-nav">' +
      '<button type="button" class="cal-nav" data-acao="fase" data-valor="' + (idx - 1) + '"' + (idx === 0 ? ' disabled' : '') + ' aria-label="Fase anterior">‹</button>' +
      '<span>Fase ' + fase.n + (fase === atual ? ' · fase atual' : '') + '</span>' +
      '<button type="button" class="cal-nav" data-acao="fase" data-valor="' + (idx + 1) + '"' + (idx === FASES.length - 1 ? ' disabled' : '') + ' aria-label="Próxima fase">›</button>' +
      '</div>';
    h += '<div class="cartao fase-cabeca"><h2>' + RB.esc(fase.nome) + '</h2><p class="fase-faixa">' + fase.faixa + '</p>' +
      '<p>' + RB.esc(fase.sobre) + '</p>' +
      '<div class="progresso"><i style="width:' + (lista.length ? feitos / lista.length * 100 : 0) + '%"></i></div>' +
      '<p class="dica">' + feitos + ' de ' + lista.length + ' marcos conquistados</p></div>';

    h += '<div class="secao-titulo">Nesta fase</div><div class="marcos">';
    lista.forEach((m) => {
      h += '<button type="button" class="marco' + (m.feito ? ' feito' : '') + '" data-acao="marco" data-id="' + RB.esc(m.id) + '" data-fase="' + fase.id + '">' +
        '<span class="marco-check" aria-hidden="true">' + (m.feito ? '✓' : '') + '</span>' +
        '<span class="marco-icone" aria-hidden="true">' + (ICONES[m.cat] || '⭐') + '</span>' +
        '<span class="marco-texto">' + RB.esc(m.texto) + '</span>' +
        '<span class="marco-cat">' + RB.esc(m.cat) + (m.proprio ? ' · seu' : '') + '</span>' +
        (m.feito ? '<span class="marco-data">' + RB.fmtData.format(new Date(m.feito.data || m.feito.criadoEm)) + '</span>' : '') +
        '</button>';
    });
    h += '</div>';
    h += '<button type="button" class="botao secundario" style="margin-top:12px" data-acao="marco-proprio" data-fase="' + fase.id + '">+ Registrar outra conquista nesta fase</button>';
    h += '<div class="cartao dica-fase" style="margin-top:12px"><b>💡 Para estimular</b><p>' + RB.esc(fase.dica) + '</p></div>';

    // Conquistas recentes
    const todas = Object.values(conquistas()).sort((a, b) => RB.ms(b.data) - RB.ms(a.data)).slice(0, 5);
    if (todas.length) {
      h += '<div class="secao-titulo">Conquistas recentes</div><ul class="lista">' + todas.map((m) =>
        '<li><div class="item"><span class="item-icone" aria-hidden="true">' + (ICONES[m.categoria] || '⭐') + '</span>' +
        '<span class="item-corpo"><span class="item-titulo">' + RB.esc(m.marco) + '</span>' +
        '<span class="item-sub" style="display:block">' + RB.fmtData.format(new Date(m.data)) + (m.obs ? ' · ' + RB.esc(m.obs) : '') + '</span></span></div></li>').join('') + '</ul>';
    }
    h += '<p class="dica" style="margin-top:14px">Cada bebê tem seu ritmo, e as faixas de idade são aproximadas (bebês prematuros contam pela idade corrigida). ' +
      'Converse com o pediatra se ele perder uma habilidade que já tinha ou se vários marcos da fase anterior ainda não apareceram. ' +
      'Referências: Caderneta da Criança (Ministério da Saúde) e CDC.</p>';
    return h;
  }

  let formMarco = null;

  function abrirMarco(id, faseId) {
    const fase = FASES.find((f) => f.id === faseId);
    const feito = conquistas()[id];
    const def = fase.marcos.find((x) => x[0] === id);
    const texto = def ? def[1] : (feito ? feito.marco : '');
    const cat = def ? def[2] : (feito ? feito.categoria : 'Cognitivo');
    formMarco = { id: id, fase: faseId, texto: texto, cat: cat };
    const data = feito ? new Date(feito.data) : new Date();
    const val = data.getFullYear() + '-' + RB.p2(data.getMonth() + 1) + '-' + RB.p2(data.getDate());
    let h = '<h2 id="folha-titulo">' + (ICONES[cat] || '⭐') + ' ' + RB.esc(texto) + '</h2>' +
      '<p class="dica" style="margin-top:-8px">' + RB.esc(cat) + ' · ' + fase.faixa + '</p>' +
      '<div class="campo"><label for="mc-data">Quando ' + RB.esc(RB.estado.bebe.nome) + ' conseguiu</label><input id="mc-data" class="entrada" type="date" value="' + val + '"></div>' +
      '<div class="campo"><label for="mc-obs">Observação</label><textarea id="mc-obs" class="entrada" rows="3" placeholder="Como foi? Quem viu primeiro?">' + RB.esc(feito && feito.obs ? feito.obs : '') + '</textarea></div>' +
      '<button type="button" class="botao laranja" data-acao="marco-salvar">' + (feito ? 'Salvar' : '✓ Marcar como conquistado') + '</button>';
    if (feito) h += '<button type="button" class="botao perigo" data-acao="marco-desmarcar">Desmarcar</button>';
    h += '<button type="button" class="botao secundario" data-acao="fechar">Cancelar</button>';
    RB.abrirFolha(h);
  }

  function abrirMarcoProprio(faseId) {
    formMarco = { id: null, fase: faseId, texto: '', cat: 'Cognitivo', proprio: true };
    const hoje = new Date();
    const val = hoje.getFullYear() + '-' + RB.p2(hoje.getMonth() + 1) + '-' + RB.p2(hoje.getDate());
    RB.abrirFolha('<h2 id="folha-titulo">Nova conquista</h2>' +
      '<div class="campo"><label for="mc-texto">O que ele fez?</label><input id="mc-texto" class="entrada" type="text" placeholder="Ex.: Achou o próprio pé"></div>' +
      '<div class="campo"><span class="rotulo">Área</span><div class="opcoes" role="group">' +
      Object.keys(ICONES).map((c) => '<button type="button" class="opcao" data-acao="marco-cat" data-valor="' + c + '" aria-pressed="' + (c === 'Cognitivo') + '">' + ICONES[c] + ' ' + c + '</button>').join('') +
      '</div></div>' +
      '<div class="campo"><label for="mc-data">Quando</label><input id="mc-data" class="entrada" type="date" value="' + val + '"></div>' +
      '<div class="campo"><label for="mc-obs">Observação</label><textarea id="mc-obs" class="entrada" rows="3"></textarea></div>' +
      '<p id="mc-erro" class="dica alerta" role="alert"></p>' +
      '<button type="button" class="botao laranja" data-acao="marco-salvar">Salvar conquista</button>' +
      '<button type="button" class="botao secundario" data-acao="fechar">Cancelar</button>');
  }

  function salvarMarco() {
    const textoEl = document.getElementById('mc-texto');
    if (textoEl) {
      formMarco.texto = textoEl.value.trim();
      if (!formMarco.texto) { document.getElementById('mc-erro').textContent = 'Descreva a conquista.'; return; }
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(document.getElementById('mc-data').value);
    const data = m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : new Date();
    const existente = formMarco.id ? RB.estado.dados.marcos[formMarco.id] : null;
    const item = Object.assign({}, existente || {}, {
      id: formMarco.id || 'proprio-' + RB.novoId(),
      fase: formMarco.fase,
      marco: formMarco.texto,
      categoria: formMarco.cat,
      data: data.toISOString(),
      obs: document.getElementById('mc-obs').value.trim() || null,
      excluido: false
    });
    RB.salvarItem('marcos', item);
    RB.fecharFolha();
    RB.avisar('Conquista registrada! 🎉');
  }

  RB.telas.marcos = telaMarcos;
  RB.marcos = { FASES, faseDaIdade };

  Object.assign(RB.acoes, {
    'fase': (alvo) => {
      const i = Number(alvo.dataset.valor);
      if (FASES[i]) { RB.estado.faseMarcos = FASES[i].id; RB.render(); }
    },
    'marco': (alvo) => abrirMarco(alvo.dataset.id, alvo.dataset.fase),
    'marco-proprio': (alvo) => abrirMarcoProprio(alvo.dataset.fase),
    'marco-cat': (alvo) => {
      formMarco.cat = alvo.dataset.valor;
      alvo.parentElement.querySelectorAll('.opcao').forEach((b) => b.setAttribute('aria-pressed', String(b === alvo)));
    },
    'marco-salvar': () => salvarMarco(),
    'marco-desmarcar': () => {
      const m = Object.assign({}, RB.estado.dados.marcos[formMarco.id]);
      m.excluido = true;
      RB.salvarItem('marcos', m);
      RB.fecharFolha();
      RB.avisar('Marco desmarcado.');
    }
  });
})();
