# Rotina do Bento

App para registrar mamadas, sono, fraldas e outras informações do Bento. Funciona no iPhone como um app instalado na tela inicial, sem custo.

- **Mamada:** cronômetro por lado (esquerdo/direito), botão de trocar de lado, mamadeira com ml e horário sugerido da próxima mamada.
- **Sono:** soneca ou sono da noite, com cronômetro e o tempo acordado desde o último sono.
- **Fralda:** xixi e fralda seca em um toque; cocô com a cor.
- **Mais:** ordenha, tempo de barriga, temperatura, peso, altura, perímetro cefálico, remédio, banho e anotações.
- **Resumo:** números do dia, linha das 24 horas, últimos 7 dias, sono por dia e crescimento.
- **Sem internet:** registra mesmo offline e envia quando a conexão voltar.
- **Pai e mãe juntos:** os dois celulares usam a mesma planilha.

## Como funciona

```
iPhone (app na tela inicial)  →  GitHub Pages (este repositório)
                               →  Apps Script  →  Planilha Google (os dados)
```

O código deste repositório é público. Os dados ficam só na planilha, na conta Google de vocês, protegidos por um código de acesso que não está no código.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html`, `app.css`, `app.js` | O app |
| `manifest.webmanifest`, `icons/` | Nome, cores e ícone quando instalado |
| `sw.js` | Faz o app abrir sem internet |
| `apps-script/Codigo.gs` | Código que vai dentro da planilha (passo 1) |

## Passo 1: colocar o script na planilha

1. Abra a planilha **Base - Rotina de Bento**.
2. Menu **Extensões > Apps Script**.
3. Apague o que estiver no arquivo `Código.gs` e cole todo o conteúdo de `apps-script/Codigo.gs`. Clique em **Salvar** (ícone de disquete).
4. Clique em **Implantar > Nova implantação**.
   - Em "Selecione o tipo", escolha **App da Web**.
   - **Executar como:** Eu.
   - **Quem pode acessar:** Qualquer pessoa.
   - Clique em **Implantar** e autorize com a sua conta Google. O Google mostra o aviso "O Google não verificou este app"; clique em **Avançado > Acessar (não seguro)**. É normal para scripts pessoais.
5. Copie a **URL do app da Web** (termina em `/exec`). Guarde: ela vai no app.
6. Volte para a planilha e recarregue a página. Vai aparecer o menu **Rotina do Bento**.
7. Clique em **Rotina do Bento > Gerar novo código de acesso** e anote o código.

> "Qualquer pessoa" significa que qualquer um com a URL consegue chamar o script, mas sem o código de acesso ele recusa tudo. Não compartilhe a URL e o código juntos fora da família.

## Passo 2: publicar o app no GitHub Pages

1. Crie uma conta em [github.com](https://github.com) (grátis), se ainda não tiver.
2. Clique em **New repository**.
   - **Nome:** `rotina-do-bento`
   - Marque **Public** (o GitHub Pages grátis exige repositório público).
   - Clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**.
4. Arraste **todo o conteúdo** da pasta `rotina-do-bento` (os arquivos e as pastas `icons` e `apps-script`) e clique em **Commit changes**.
5. Vá em **Settings > Pages**.
   - **Source:** Deploy from a branch.
   - **Branch:** `main`, pasta `/ (root)`. Clique em **Save**.
6. Espere 1 ou 2 minutos e recarregue. O endereço aparece no topo: `https://SEU-USUARIO.github.io/rotina-do-bento/`.

## Passo 3: instalar no iPhone

1. Abra o endereço do passo 2 no **Safari**.
2. Toque em **Compartilhar** (quadrado com seta para cima).
3. Toque em **Adicionar à Tela de Início** e em **Adicionar**.
4. Abra o app pelo ícone novo (lua azul).
5. Vá em **Ajustes**:
   - Cole a **URL do app da Web** (passo 1.5) e o **código de acesso** (passo 1.7).
   - Toque em **Testar e salvar**. Deve aparecer "Conectado à planilha de Bento".
   - Escolha **Quem usa este celular** (Mãe, Pai ou outra pessoa).
6. Repita no outro celular.

## Passo 4: preencher a aba Bebê

Na planilha, aba **Bebê**, preencha as células amarelas:

- **Data de nascimento** (para o app mostrar a idade).
- **Intervalo entre mamadas (horas)**: usado para "Próxima por volta das…". Padrão: 3.
- **Início e fim do sono noturno**: separam soneca de sono da noite. Padrão: 19h às 7h.

## A planilha

| Aba | Conteúdo |
|---|---|
| **Registros** | Uma linha por registro. Colunas A a O são gravadas pelo app; P (Duração) e Q (Data) são fórmulas. |
| **Resumo** | Últimos 14 dias: mamadas, intervalo médio, sonecas, horas de sono, fraldas. Atualiza sozinho. |
| **Bebê** | Configurações que o app lê. |

- **Corrigir algo na planilha:** pode editar direto na aba Registros. A mudança chega aos celulares na próxima sincronização.
- **Excluir um registro:** marque a caixa da coluna **Excluído**. Não apague a linha, senão os celulares não ficam sabendo.
- **Novo registro digitado à mão:** preencha Tipo e Início; o ID é criado sozinho.

## Atualizar o app depois

1. Suba os arquivos alterados no GitHub (Add file > Upload files).
2. Em `sw.js`, aumente a versão (`rotina-bento-v1` → `rotina-bento-v2`) para os celulares baixarem a versão nova.
3. No iPhone, feche e abra o app duas vezes.

Se mudar o `apps-script/Codigo.gs`, cole o novo código no Apps Script e use **Implantar > Gerenciar implantações > editar (lápis) > Versão: Nova versão > Implantar**. Assim a URL continua a mesma.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "Código de acesso incorreto" | Na planilha: Rotina do Bento > Ver código de acesso. Confira letra por letra. |
| "A planilha não respondeu como esperado" | A implantação precisa estar com **Quem pode acessar: Qualquer pessoa**, e a URL deve terminar em `/exec`. |
| Os registros não aparecem no outro celular | Toque no indicador do topo (vai para Ajustes) e em **Sincronizar agora**. |
| Mudei a aba Bebê e o app não mudou | O app lê a aba a cada sincronização. Toque em **Sincronizar agora**. |
| Quero começar do zero em um celular | Ajustes > Apagar dados deste celular. A planilha não é afetada. |

## Aviso

O app ajuda a organizar a rotina. Os alertas de temperatura e da cor do cocô são lembretes gerais, não substituem a orientação do pediatra.
