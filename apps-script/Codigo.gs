/**
 * Rotina do Bento: API da planilha.
 *
 * Este código fica dentro da planilha (Extensões > Apps Script).
 * O app no celular envia e recebe os registros por aqui.
 *
 * Abas usadas:
 *   Registros: uma linha por evento (mamada, sono, fralda...).
 *   Bebê: configurações lidas pelo app.
 *
 * Colunas A até O da aba Registros são gravadas por este script.
 * As colunas P (Duração) e Q (Data) são fórmulas da planilha: não escreva nelas.
 */

const ABA_REGISTROS = 'Registros';
const ABA_BEBE = 'Bebê';

const COLUNAS = [
  'id', 'tipo', 'inicio', 'fim', 'detalhe', 'leite', 'quantidade', 'unidade',
  'corCoco', 'quem', 'obs', 'criadoEm', 'atualizadoEm', 'sincronizadoEm', 'excluido'
];
const COL_ATUALIZADO = COLUNAS.indexOf('atualizadoEm'); // 12 (coluna M)
const COL_SINCRONIZADO = COLUNAS.indexOf('sincronizadoEm'); // 13 (coluna N)
const CAMPOS_DATA = { inicio: true, fim: true, criadoEm: true, atualizadoEm: true, sincronizadoEm: true };
const CAMPOS_TEXTO = { tipo: true, detalhe: true, leite: true, unidade: true, corCoco: true, quem: true, obs: true };

/* ---------- Menu da planilha ---------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Rotina do Bento')
    .addItem('Gerar novo código de acesso', 'gerarCodigo')
    .addItem('Ver código de acesso', 'verCodigo')
    .addToUi();
}

function gerarCodigo() {
  const codigo = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
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
 * Quando alguém edita a aba Registros à mão, marca a linha como alterada
 * para que os celulares recebam a mudança na próxima sincronização.
 * Uma linha nova digitada à mão (com Tipo preenchido e sem ID) ganha um ID.
 */
function onEdit(e) {
  const aba = e.range.getSheet();
  if (aba.getName() !== ABA_REGISTROS) return;
  const primeira = Math.max(e.range.getRow(), 2);
  const ultima = e.range.getLastRow();
  if (ultima < 2 || e.range.getColumn() > COLUNAS.length) return;
  if (e.range.getColumn() > COL_ATUALIZADO && e.range.getLastColumn() <= COL_SINCRONIZADO + 1) return;

  const qtd = ultima - primeira + 1;
  const linhas = aba.getRange(primeira, 1, qtd, COLUNAS.length).getValues();
  const agora = new Date();
  linhas.forEach(function (l, i) {
    const linha = primeira + i;
    if (!l[0] && l[1]) {
      aba.getRange(linha, 1).setValue(Utilities.getUuid());
      aba.getRange(linha, COLUNAS.indexOf('criadoEm') + 1).setValue(agora);
      l[0] = 'novo';
    }
    if (l[0]) aba.getRange(linha, COL_ATUALIZADO + 1, 1, 2).setValues([[agora, agora]]);
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
    if (acao === 'ping') return { ok: true, agora: new Date().toISOString(), config: lerConfig() };
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
 * Recebe { registros: [...], desde: ISO } do app.
 * 1. Grava os registros recebidos (o mais recente vence, pela coluna Atualizado em).
 * 2. Devolve todas as linhas sincronizadas a partir de "desde".
 */
function sincronizar(req) {
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    const aba = SpreadsheetApp.getActive().getSheetByName(ABA_REGISTROS);
    const n = COLUNAS.length;
    const ultima = ultimaLinhaComId(aba);
    const dados = ultima >= 2 ? aba.getRange(2, 1, ultima - 1, n).getValues() : [];
    const indice = {};
    dados.forEach(function (l, i) { if (l[0]) indice[String(l[0])] = i; });

    const agora = new Date();
    const recebidos = Array.isArray(req.registros) ? req.registros : [];
    const novos = [];
    const alterados = [];

    recebidos.forEach(function (r) {
      if (!r || !r.id || !r.tipo) return;
      const i = indice[r.id];
      if (i === undefined) {
        indice[r.id] = dados.length + novos.length;
        novos.push(paraLinha(r, agora));
        return;
      }
      const naPlanilha = paraMs(dados[i][COL_ATUALIZADO]);
      if (naPlanilha && paraMs(r.atualizadoEm) < naPlanilha) return; // a planilha tem versão mais nova
      dados[i] = paraLinha(r, agora);
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

    const desde = req.desde ? paraMs(req.desde) : 0;
    const resposta = [];
    dados.concat(novos).forEach(function (l) {
      if (!l[0]) return;
      if (!desde || paraMs(l[COL_SINCRONIZADO]) >= desde) resposta.push(paraRegistro(l));
    });

    return { ok: true, agora: agora.toISOString(), registros: resposta, config: lerConfig() };
  } finally {
    trava.releaseLock();
  }
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

function paraLinha(r, agora) {
  return COLUNAS.map(function (c) {
    if (c === 'sincronizadoEm') return agora;
    if (c === 'excluido') return r.excluido === true;
    const v = r[c];
    if (v === undefined || v === null || v === '') return '';
    if (CAMPOS_DATA[c]) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? '' : d;
    }
    if (c === 'quantidade') {
      const num = Number(v);
      return isNaN(num) ? '' : num;
    }
    const texto = String(v).slice(0, 2000);
    // Evita que um texto seja interpretado como fórmula.
    return CAMPOS_TEXTO[c] && /^[=+\-@]/.test(texto) ? "'" + texto : texto;
  });
}

function paraRegistro(l) {
  const r = {};
  COLUNAS.forEach(function (c, i) {
    let v = l[i];
    if (c === 'excluido') { r[c] = v === true || v === 'TRUE'; return; }
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
  const v = aba.getRange('B3:B7').getValues().map(function (l) { return l[0]; });
  const nascimento = v[1] instanceof Date
    ? Utilities.formatDate(v[1], planilha.getSpreadsheetTimeZone(), 'yyyy-MM-dd')
    : null;
  return {
    nome: v[0] ? String(v[0]) : 'Bento',
    nascimento: nascimento,
    intervaloMamadasH: Number(v[2]) || 3,
    noturnoInicio: v[3] === '' ? 19 : Number(v[3]),
    noturnoFim: v[4] === '' ? 7 : Number(v[4])
  };
}
