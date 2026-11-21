# Meu Controle 3.4.0 — Versão para iPhone (PWA)

Esta pasta contém a versão WEB/PWA do aplicativo **Meu Controle 3.4.0**, construída diretamente a partir dos arquivos HTML, CSS, JavaScript e motor de cálculo da versão Android. A interface, as regras de saldo, lançamentos, vale-alimentação, Pix, crédito até 500 parcelas, simuladores e formato de backup JSON foram preservados.

## Como publicar por link no GitHub Pages

1. Entre em https://github.com e crie um repositório **público** chamado, por exemplo, `MeuControle-iPhone` na conta que você usa para o aplicativo (exemplo: `iuryvictorino-hub`). Crie o repositório vazio, sem README ou .gitignore inicial.
2. Extraia este ZIP para uma pasta, por exemplo `C:\MeuControlePWA`.
3. Abra o terminal PowerShell **dentro da pasta extraída** (a que contém `index.html`). Confirme que ela não está em um projeto Git anterior.
4. Execute os comandos a seguir, substituindo o dono e o repositório caso escolha outro nome:

```powershell
git init
git branch -M main
git add .
git commit -m "Meu Controle PWA 3.4.0 para iPhone"
git remote add origin https://github.com/iuryvictorino-hub/MeuControle-iPhone.git
git push -u origin main
```

5. No GitHub, abra o repositório, clique em **Settings > Pages**. Em **Build and deployment**, escolha **Deploy from a branch**, branch **main**, pasta **/(root)**, e salve.
6. Aguarde a publicação. O GitHub mostrará o link real no painel Pages, geralmente no formato `https://NOME-DO-USUARIO.github.io/MeuControle-iPhone/`. Abra **o link gerado pelo GitHub**; não suponha que ele esteja pronto antes da publicação.
7. No iPhone, abra esse link no **Safari**, toque no botão **Compartilhar** e em **Adicionar à Tela de Início** (em algumas versões: `Adicionar à Tela de Início` no menu de opções). Confirme **Adicionar** e abra pelo ícone.

**Importante:** o repositório PWA precisa ser público para o GitHub Pages gratuito. Isso torna o código web acessível publicamente, **não** os lançamentos armazenados localmente nos aparelhos.

## Dados, backup e compatibilidade com Android

- O histórico **não é sincronizado automaticamente** entre Android e iPhone. Cada aparelho armazena os dados localmente.
- Para copiar os lançamentos: Android > Ajustes > **Salvar cópia JSON**; transfira o arquivo ao iPhone; nele, abra a versão PWA > Ajustes > **Restaurar cópia**.
- O formato JSON é o mesmo da versão Android 3.4.0 e segue sujeito à validação da aplicação. Restaurar substitui os dados locais no iPhone; antes disso, faça backup se já houver lançamentos.
- Exportar backup e CSV no iPhone usa o menu **Compartilhar** quando disponível, ou download pelo navegador. Escolha **Salvar em Arquivos**.
- A aplicação funciona offline **após abrir e carregar completamente o site pela primeira vez com internet**, graças a um service worker. No iOS, podem existir limitações de armazenamento e o Safari pode apagar dados locais em algumas circunstâncias. **Não use a memória do navegador como seu único backup**: guarde arquivos JSON em Arquivos/iCloud Drive periodicamente.
- Ao usar o mesmo endereço em Safari e no ícone da tela inicial, o armazenamento pode ser tratado separadamente pelo iOS; importe o backup no lugar onde pretende usar o app.
- Os simuladores não modificam saldos. Nenhuma transação bancária real é executada.

## Atualizações da versão web

- Novas versões são distribuídas **pelo mesmo link do GitHub Pages**, não por APK.
- Publique os arquivos novos no mesmo repositório, atualize a versão em `version.json` e `pwa.js` e o identificador `CACHE` em `sw.js`. A nova versão será obtida ao tocar em **Verificar atualizações** no app ou ao reabrir o link (com internet).
- Não publique apenas arquivos HTML sem coordenar as versões dos scripts e do service worker.

## Privacidade e segurança

- A aplicação usa armazenamento local do navegador (`localStorage`); dados não são armazenados no GitHub. O service worker armazena apenas **arquivos estáticos do aplicativo**.
- Não envie backups JSON contendo seus dados pessoais ao repositório nem publique arquivos `.jks`, senhas ou chaves privadas.
- GitHub Pages funciona via HTTPS; não é uma plataforma de banco e o armazenamento não é criptografado por uma conta própria. Evite dispositivos compartilhados, mantenha o iPhone protegido e use backup seguro.
- **Antes de distribuir publicamente para pessoas que dependam do aplicativo, teste no iPhone real**: instalação, lançamento, edição, crédito, simuladores, exportação/restauração do JSON e funcionamento offline. Testes automatizados em navegador não substituem testes no Safari do iPhone.

## Arquivos principais

- `index.html`, `style.css`, `app.js`, `finance-core.js`: mesma interface e lógica financeira da versão Android 3.4.0, com ajustes de plataforma.
- `pwa.js`: compartilhamento/backup do iPhone e verificação de novas versões web.
- `sw.js`: cache offline de arquivos estáticos (nunca registros financeiros).
- `manifest.webmanifest` e `icons/`: ícone, aparência e instalação na tela inicial.
- `version.json`: metadados públicos de versão da PWA.
- `.nojekyll`: publicação como site estático.

## Android

A versão Android existente em APK e a assinatura `.jks` **não são modificadas** por esta pasta. Continue publicando APKs no repositório `MeuControle-Atualizacoes` separadamente.
