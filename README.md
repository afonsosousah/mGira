<p align="middle"> <img src="https://app.mgira.pt/assets/images/mGira_big.png" width="400"/> </p>

<p align="middle">
Uma melhor aplicação para o sistema de bicicletas partilhadas GIRA 
</p>

## 
<p align="middle">
	<img src="https://app.mgira.pt/assets/images/screenshot_landing.png?v=0.0.3" width="200"/>
	<img src="https://app.mgira.pt/assets/images/screenshot_stations.png?v=0.0.3" width="200"/>
	<img src="https://app.mgira.pt/assets/images/screenshot_routing.png?v=0.0.3" width="200"/>
</p>

<br>
<br>

## Funcionalidades adicionais
 - Navegação na aplicação, que calcula a melhor rota tendo em conta:
	 - Onde se localizam as estações
	 - Se há bicicletas disponíveis na estação
	 - Rota otimizada para bicicleta
- Tentar retirar bicicleta que aparenta estar disponível na estação mas não aparece na aplicação
- Ver estatísticas de uso, como:
	- Número de viagens realizadas
	- Tempo total de utilização
	- Estimativa de quilómetros percorridos*
	- Estimativa de CO2 poupado**

<br>

## Limitações
- Não é possível registar uma nova conta da EMEL
- Não é possível pagar tarifários
- Não é possível pagar uma viagem com o saldo, apenas pontos

<br>

## Utilização

Para utilizar a aplicação mGira, basta abrir o [website](https://mgira.pt/) num navegador no seu smartphone Android ou iOS e seguir as instruções!

Há também uma aplicação nativa para Android que não necessita de proxy, feita pelo [@ttmx](https://github.com/ttmx), disponível na [release](https://github.com/afonsosousah/mGira/releases/tag/0.0.1)!

<br>

## Versões

 - v0.0.1 - Versão beta inicial - 01/12/2023
 - v0.0.2 - 10/12/2023
 - v0.0.3 - 21/12/2023
   - Mudança da UI
   - Suporte para botão voltar atrás nativo (obrigado DanielAgostinho)
   - Pedidos e error handling melhorados (obrigado rodrigoleitao)
   - Proxy já não é utilizado no login na API da EMEL (obrigado j0dd)
   - Melhorias no sistema de navegação (já não utiliza a bússola do dispositivo)

<br>

## Licença

Este software é source-available, ou seja, não é permitida a sua comercialização. O regime source-available permite, a quem quiser, avaliar a segurança da aplicação, assim como o seu funcionamento.

<br>
<br>
<br>

> *assume-se uma velocidade média de 15km/h<br>**assume-se uma poupança de 54g/km (obrigado [temospena](https://github.com/temospena))
