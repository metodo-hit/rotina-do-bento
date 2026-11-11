/**
 * Rotina do Bento: API da planilha (versão 2).
 *
 * Este código fica dentro da planilha (Extensões > Apps Script).
 * O app no celular envia e recebe dados por aqui.
 *
 * Abas sincronizadas:
 *   Registros: uma linha por evento (mamada, sono, fralda...).
 *   Agenda: consultas, vacinas, datas especiais e compromissos.
 *   Marcos: marcos de desenvolvimento conquistados.
 * Aba lida pelo app:
 *   Bebê: configurações.
 *
 * Em Registros, as colunas P (Duração) e Q (Data) são fórmulas: não escreva nelas.
 */

const ABA_BEBE = 'Bebê';

const COLECOES = {
  registros: {
    aba: 'Registros',
    colunas: ['id', 'tipo', 'inicio', 'fim', 'detalhe', 'leite', 'quantidade', 'unidade',
      'corCoco', 'quem', 'obs', 'criadoEm', 'atualizadoEm', 'sincronizadoEm', 'excluido'],
    datas: ['inicio', 'fim', 'criadoEm', 'atualizadoEm', 'sincronizadoEm'],
    numeros: ['quantidade'],
    booleanos: ['excluido'],
    obrigatorio: 'tipo'
  },
  agenda: {
    aba: 'Agenda',
    colunas: ['id', 'titulo', 'categoria', 'inicio', 'fim', 'diaInteiro', 'local', 'obs',
      'lembreteMin', 'concluido', 'quem', 'criadoEm', 'atualizadoEm', 'sincronizadoEm', 'excluido'],
    datas: ['inicio', 'fim', 'criadoEm', 'atualizadoEm', 'sincronizadoEm'],
    numeros: ['lembreteMin'],
    booleanos: ['diaInteiro', 'concluido', 'excluido'],
    obrigatorio: 'titulo'
  },
  marcos: {
    aba: 'Marcos',
    colunas: ['id', 'fase', 'marco', 'categoria', 'data', 'obs', 'quem',
      'criadoEm', 'atualizadoEm', 'sincronizadoEm', 'excluido'],
    datas: ['data', 'criadoEm', 'atualizadoEm', 'sincronizadoEm'],
    numeros: [],
    booleanos: ['excluido'],
    obrigatorio: 'marco'
  }
};

/* ---------- Menu da planilha ---------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Rotina do Bento')
    .addItem('Gerar novo código de acesso', 'gerarCodigo')
    .addItem('Ver código de acesso', 'verCodigo')
    .addToUi();
}

function gerarCodigo() {
  const codigo = String(Math.floor(1e9 + Math.random() * 9e9));
  PropertiesService.getScriptProperties().setProperty('CODIGO', codigo);
  SpreadsheetApp.getUi().alert(
    'Novo código de acesso:\n\n' + codigo +
    '\n\nDigite este código em Ajustes, no app, em cada celular. O código anterior deixa de funcionar.'
  );
}

function verCodigo() {
  const codigo = PropertiesService.getScriptProperties().getProperty('CODIGO');
  SpreadsheetApp.getUi().alert(codigo
    ? 'Código de acesso atual:\n\n' + codigo
    : 'Ainda não existe código. Use "Gerar novo código de acesso".');
}

/* ---------- Edição manual na planilha ---------- */

/**
 * Quando alguém edita uma aba sincronizada à mão, marca a linha como alterada
 * para que os celulares recebam a mudança na próxima sincronização.
 * Uma linha nova digitada à mão (com a coluna B preenchida e sem ID) ganha um ID.
 */
function onEdit(e) {
  const aba = e.range.getSheet();
  const nome = aba.getName();
  let col = null;
  Object.keys(COLECOES).forEach(function (k) { if (COLECOES[k].aba === nome) col = COLECOES[k]; });
  if (!col) return;

  const n = col.colunas.length;
  const colAtualizado = col.colunas.indexOf('atualizadoEm');
  const colSincronizado = col.colunas.indexOf('sincronizadoEm');
  const colCriado = col.colunas.indexOf('criadoEm');
  const primeira = Math.max(e.range.getRow(), 2);
  const ultima = e.range.getLastRow();
  if (ultima < 2 || e.range.getColumn() > n) return;
  // Ignora edições só nas colunas de controle (Atualizado em / Sincronizado em)
  if (e.range.getColumn() > colAtualizado && e.range.getLastColumn() <= colSincronizado + 1) return;

  const linhas = aba.getRange(primeira, 1, ultima - primeira + 1, n).getValues();
  const agora = new Date();
  linhas.forEach(function (l, i) {
    const linha = primeira + i;
    if (!l[0] && l[1]) {
      aba.getRange(linha, 1).setValue(Utilities.getUuid());
      aba.getRange(linha, colCriado + 1).setValue(agora);
      l[0] = 'novo';
    }
    if (l[0]) aba.getRange(linha, colAtualizado + 1, 1, 2).setValues([[agora, agora]]);
  });
}

/* ---------- Entrada da API ---------- */

function doGet(e) {
  return responder(processar((e && e.parameter) || {}));
}

function doPost(e) {
  let corpo;
  try {
    corpo = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder({ ok: false, erro: 'Pedido inválido.' });
  }
  return responder(processar(corpo));
}

function processar(req) {
  try {
    const codigo = PropertiesService.getScriptProperties().getProperty('CODIGO');
    if (!codigo) {
      return { ok: false, erro: 'Código de acesso não configurado. Abra a planilha e use o menu Rotina do Bento.' };
    }
    if (String(req.codigo || '') !== codigo) {
      return { ok: false, erro: 'Código de acesso incorreto.' };
    }
    const acao = req.acao || 'ping';
    if (acao === 'ping') return { ok: true, versao: 2, agora: new Date().toISOString(), config: lerConfig() };
    if (acao === 'sync') return sincronizar(req);
    return { ok: false, erro: 'Ação desconhecida: ' + acao };
  } catch (err) {
    return { ok: false, erro: 'Erro na planilha: ' + err.message };
  }
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Sincronização ---------- */

/**
 * Recebe { registros: [...], agenda: [...], marcos: [...], desde: ISO }.
 * Para cada coleção:
 * 1. Grava o que veio (o mais recente vence, pela coluna Atualizado em).
 * 2. Devolve todas as linhas sincronizadas a partir de "desde".
 */
function sincronizar(req) {
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    const agora = new Date();
    const desde = req.desde ? paraMs(req.desde) : 0;
    const resposta = { ok: true, versao: 2, agora: agora.toISOString(), config: lerConfig() };
    Object.keys(COLECOES).forEach(function (nome) {
      resposta[nome] = sincronizarColecao(COLECOES[nome], req[nome], desde, agora);
    });
    return resposta;
  } finally {
    trava.releaseLock();
  }
}

function sincronizarColecao(col, recebidos, desde, agora) {
  const aba = obterAba(col);
  const n = col.colunas.length;
  const iAtualizado = col.colunas.indexOf('atualizadoEm');
  const iSincronizado = col.colunas.indexOf('sincronizadoEm');
  const ultima = ultimaLinhaComId(aba);
  const dados = ultima >= 2 ? aba.getRange(2, 1, ultima - 1, n).getValues() : [];
  const indice = {};
  dados.forEach(function (l, i) { if (l[0]) indice[String(l[0])] = i; });

  const novos = [];
  const alterados = [];
  (Array.isArray(recebidos) ? recebidos : []).forEach(function (r) {
    if (!r || !r.id || !r[col.obrigatorio]) return;
    const i = indice[r.id];
    if (i === undefined) {
      indice[r.id] = dados.length + novos.length;
      novos.push(paraLinha(col, r, agora));
      return;
    }
    const naPlanilha = paraMs(dados[i][iAtualizado]);
    if (naPlanilha && paraMs(r.atualizadoEm) < naPlanilha) return; // a planilha tem versão mais nova
    dados[i] = paraLinha(col, r, agora);
    alterados.push(i);
  });

  alterados.forEach(function (i) {
    aba.getRange(i + 2, 1, 1, n).setValues([dados[i]]);
  });
  if (novos.length) {
    const inicio = dados.length + 2;
    const faltam = inicio + novos.length - 1 - aba.getMaxRows();
    if (faltam > 0) aba.insertRowsAfter(aba.getMaxRows(), faltam + 200);
    aba.getRange(inicio, 1, novos.length, n).setValues(novos);
  }

  const saida = [];
  dados.concat(novos).forEach(function (l) {
    if (!l[0]) return;
    if (!desde || paraMs(l[iSincronizado]) >= desde) saida.push(paraObjeto(col, l));
  });
  return saida;
}

function obterAba(col) {
  const planilha = SpreadsheetApp.getActive();
  let aba = planilha.getSheetByName(col.aba);
  if (!aba) {
    aba = planilha.insertSheet(col.aba);
    aba.getRange(1, 1, 1, col.colunas.length).setValues([col.colunas]).setFontWeight('bold');
    aba.setFrozenRows(1);
  }
  return aba;
}

function ultimaLinhaComId(aba) {
  const ultima = aba.getLastRow();
  if (ultima < 2) return 1;
  const ids = aba.getRange(1, 1, ultima, 1).getValues();
  for (let i = ids.length - 1; i >= 1; i--) {
    if (ids[i][0] !== '' && ids[i][0] !== null) return i + 1;
  }
  return 1;
}

function paraLinha(col, r, agora) {
  return col.colunas.map(function (c) {
    if (c === 'sincronizadoEm') return agora;
    if (col.booleanos.indexOf(c) >= 0) return r[c] === true;
    const v = r[c];
    if (v === undefined || v === null || v === '') return '';
    if (col.datas.indexOf(c) >= 0) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? '' : d;
    }
    if (col.numeros.indexOf(c) >= 0) {
      const num = Number(v);
      return isNaN(num) ? '' : num;
    }
    const texto = String(v).slice(0, 2000);
    // Evita que um texto seja interpretado como fórmula.
    return c !== 'id' && /^[=+\-@]/.test(texto) ? "'" + texto : texto;
  });
}

function paraObjeto(col, l) {
  const r = {};
  col.colunas.forEach(function (c, i) {
    let v = l[i];
    if (col.booleanos.indexOf(c) >= 0) { r[c] = v === true || v === 'TRUE'; return; }
    if (v instanceof Date) v = v.toISOString();
    r[c] = v === '' || v === undefined ? null : v;
  });
  r.id = String(r.id);
  return r;
}

function paraMs(v) {
  if (!v) return 0;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/* ---------- Configurações do bebê ---------- */

function lerConfig() {
  const planilha = SpreadsheetApp.getActive();
  const aba = planilha.getSheetByName(ABA_BEBE);
  if (!aba) return {};
  const v = aba.getRange('B3:B8').getValues().map(function (l) { return l[0]; });
  const nascimento = v[1] instanceof Date
    ? Utilities.formatDate(v[1], planilha.getSpreadsheetTimeZone(), 'yyyy-MM-dd')
    : null;
  return {
    nome: v[0] ? String(v[0]) : 'Bento',
    nascimento: nascimento,
    intervaloMamadasH: Number(v[2]) || 3,
    noturnoInicio: v[3] === '' ? 19 : Number(v[3]),
    noturnoFim: v[4] === '' ? 7 : Number(v[4]),
    horaDormir: v[5] === '' ? null : Number(v[5])
  };
}
