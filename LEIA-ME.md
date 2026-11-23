# RM Veículos — versão Firebase Spark (gratuita) + Vercel

Esta versão remove os recursos que dependiam do **plano Blaze**: Firebase Storage e Cloud Functions para push automático. Não contém senhas de administrador nem service accounts.

## O que funciona no Spark

- **Firebase Authentication**: e-mail e senha privados para administrador autorizado.
- **Firestore**: veículos públicos e propostas enviadas pelos visitantes; apenas administrador pode ver as propostas e editar o estoque.
- **Vercel**: hospeda o site estático.
- **Fotos por URL HTTPS**: use uma imagem hospedada publicamente em um serviço externo; cole o endereço direto da imagem no painel. Não é possível enviar o arquivo local pelo painel nesta versão.
- **Novas propostas**: lista, contador e aviso instantâneo com Firestore `onSnapshot`. Opcionalmente autorize alertas do navegador enquanto a guia do painel estiver aberta. **Não há push quando o painel está fechado.**
- **Inatividade**: encerra o login após 180 segundos sem interação e leva à vitrine. Recarregar antes do prazo conserva o login.

## O que já foi configurado no Firebase Console

1. Projeto `rm-veiculos`, aplicativo Web registrado.
2. Authentication > E-mail/senha habilitado, conta administrativa criada.
3. Firestore criado, e coleção `admins/{UID-DO-ADMIN}` com campo `active = true` (boolean) criado.
4. Regras `firestore.rules` publicadas no console (confirme que são idênticas às incluídas neste pacote).

## O que falta antes de publicar

1. **Verificar a configuração pública:** preenchi `firebase-config.js` com os dados mostrados nas capturas do Firebase, inclusive a `apiKey`. Abra **Firebase Console > Configurações do projeto > Seus aplicativos**, copie novamente os valores para conferir caractere por caractere (principalmente a chave `apiKey`, transcrita de imagem). Ela é pública, não é a senha do administrador. Nunca envie uma senha, token de conta de serviço ou private key.
2. **Segurança:** confirme que as regras em `firestore.rules` são as mesmas que você publicou na aba Regras. A criação de propostas é pública e, portanto, sujeita a spam. Antes de divulgação ampla, configure o App Check para Firestore, teste e ative o enforcement somente após validar o site, para evitar bloquear visitantes. Também avalie limites de abuso e retenção dos dados conforme LGPD.
3. **Vercel:** envie o conteúdo desta pasta ao GitHub e importe o repositório pela Vercel. Use Framework Preset "Other", sem Build Command; a raiz publicada precisa conter `index.html`, `admin.html`, `firebase-config.js`, `script.js` etc.
4. **Domínio autorizado:** em Authentication > Configurações > Domínios autorizados, adicione o host `SEU-SITE.vercel.app` e seu domínio próprio quando houver.
5. **Testes:** abra o site público e `admin.html`; entre com o e-mail/senha do Auth. Cadastre um carro com foto em URL HTTPS, envie uma proposta pelo site e veja se chega no painel. Recarregue em menos de três minutos (mantém login). Fique três minutos sem interagir (redireciona à vitrine).

## Imagens dos veículos

Abra uma conta em um serviço de imagem que disponibilize links HTTPS diretos de arquivos (por exemplo, a biblioteca de mídia Cloudinary com plano gratuito, sujeita aos termos/cotas do serviço). Envie as imagens pelo painel desse serviço e cole a URL fornecida no formulário do carro da RM Veículos. URLs que apontam para páginas HTML, páginas privadas ou links expiráveis podem não funcionar como fotos; use links diretos permanentes.

**Evite enviar fotos em base64 ao Firestore:** isso desperdiça a quota gratuita e pode estourar o limite por documento.

## Notificações — diferença importante

**Com painel aberto:** o Firestore notifica em tempo real e aparece um aviso na tela; ativar "Avisar neste navegador" permite notificação local em navegadores compatíveis enquanto a página estiver aberta e a sessão válida.

**Com painel fechado / navegador encerrado:** não existem notificações automáticas nesta versão. Para esse recurso, será necessário um servidor seguro de envio de push ou outro serviço de notificações, que pode ter custos e configuração adicional. O Cloud Messaging ser gratuito não significa que exista um disparador automático de mensagens sem backend.

## Privacidade e segurança

- O `firebase-config.js` contém apenas configurações públicas do app; a senha fica no Firebase Authentication.
- As regras do Firestore devem estar publicadas. Sem elas, esconder o painel não impede acesso indevido ao banco.
- Este site salva nome, telefone e preferências dos visitantes quando enviam uma proposta. Ajuste o aviso de privacidade e rotinas de exclusão antes da produção.
- No plano Spark, ao atingir os limites de uso grátis, serviços podem ficar indisponíveis até o reset de quota; verifique o painel Uso do Firebase.
- Os 3 minutos de inatividade são um controle de sessão da interface; não revogam instantaneamente tokens de Auth emitidos pelo Firebase.

## Arquivos

`index.html` (site), `admin.html` (painel), `script.js` (UI), `store-sync.js` (Firestore público), `admin.js` (gestão), `firebase-client.js`, `firebase-config.js`, `firestore.rules`, `firebase.json`, `vercel.json`, `styles.css`, `assets/`.

Até validar com sua conta Firebase e um deployment HTTPS, a versão é **preparada para integração, não testada em produção**.
