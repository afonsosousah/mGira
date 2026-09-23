# Cloudflare worker para cross domain proxy

Esta é uma alternativa ao [proxy](../../proxy.php) que é utilizada por defeito. Permite a qualquer pessoa com uma conta na https://www.cloudflare.com/ que tenha o seu próprio proxy a correr. A vantagem é uma camada de segurança: Nenhum request feito pela aplicação passa por um servidor alheio, simplesmente por um cloudflare worker montado por ti. <b>Não é necessário nenhum conhecimento de programação para utilizar esta opção</b>.

## Exemplo

Há um proxy a correr aqui:

https://gira-test.fmacedo.com

pode ser utilizado para testar só, não para uso diário - se tiver demasiados requests terei que o mandar abaixo 😥

## Requisitos

- Ter uma conta na [cloudflare](https://www.cloudflare.com/)

## Setup

Basicamente é seguir a primeira parte [deste guia](https://developers.cloudflare.com/workers/get-started/guide/) e copiar o código presente em [proxy.js](./proxy.js), o que equivale a:

1. Ir a https://dash.cloudflare.com e escolher **Workers & Pages > Create application**.
2. Seleccionar **Create Worker**, editar o nome para algo mais amigável como "gira" e escolher "Deploy" com o exemplo "Hello world" (código este que será editado no passo seguinte);
3. Escolher "Edit code" e copiar o código presente no ficheiro [proxy.js](./proxy.js) deste repositório para o ficheiro "worker.js" aberto no editor do cloudflare.
4. Escolher "Deploy" no canto superior direito do ecrã. No canto superior direito do editor de texto há um link "workers.dev" - este é o URL do proxy, que deves copiar. Deverá ser algo do género `https://gira.username.workers.dev` em que `username` é o teu username.
5. Na applicação mGira, nas definições de utilizador, editar o campo "Proxy definido pelo utilizador" com o URL copiado no passo anterior.

A partir de agora todos os pedidos à EMEL que antes passavam pelo proxy publico seram feitos através deste.

## Atualização para o novo sistema da GIRA (v0.3.0)

Com a mudança da GIRA para o sistema da VAIMOO, o código do [proxy.js](./proxy.js) foi atualizado. É o mesmo código que corre no proxy por defeito da mGira. Se já tinhas um proxy configurado, repete os passos 3 e 4 com o código novo, caso contrário o início de sessão e os pedidos à API deixam de funcionar.

O que mudou no proxy:

- Passa a aceitar pedidos `GET` (a API da VAIMOO usa `GET` para o perfil, saldo, passe e histórico de viagens)
- Só encaminha pedidos para `emel-consumerapp.vaimoo.com` e `login.emel.pt`
- O websocket e o token da Firebase deixaram de ser necessários e foram removidos
