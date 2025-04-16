<p align="middle"> <img src="https://app.mgira.pt/assets/images/mGira_big.png" width="400"/> </p>

<p align="middle">
Uma melhor aplicação para o sistema de bicicletas partilhadas GIRA 
</p>

##

<p align="middle" style="height: fit-content; overflow: scroll; display: flex; gap: 5px;">
	<img src="https://app.mgira.pt/assets/images/screenshot_landing.png?t=0.0.5.1" width="200" height="444"/>
	<img src="https://app.mgira.pt/assets/images/screenshot_stations.png?t=0.0.5" width="200" height="444"/>
	<img src="https://app.mgira.pt/assets/images/screenshot_routing.png?t=0.0.5" width="200" height="444"/>
	<img src="https://app.mgira.pt/assets/images/screenshot_navigation.png?v=0.0.5" width="200" height="444"/>
</p>

<br>
<br>

## Utilização

<details>
<summary><img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/safari/safari_128x128.png" width="18" height="18"> Safari iOS</summary>

    1. Abrir o link app.mgira.pt
    2. Carregar no botão de partilhar, na barra do menu
    3. Andar para baixo na lista, e escolher 'Adicionar ao ecrã principal'


    Se a localização não funcionar, verifica as permissões de localização.
    Navega até Settings > Privacy & Security > Location Services > Safari Websites e seleciona "While using the app".
    Garante também que a opção "Precise Location" está ativada.

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/chrome/chrome_128x128.png" width="18" height="18"> Chrome Android</summary>

    1. Abrir o link app.mgira.pt
    2. Clicar nos três pontos, no canto superior esquerdo
    3. Clicar em 'Instalar'
    4. Verificar se a mGira aparece na lista de aplicações

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/firefox/firefox_128x128.png" width="18" height="18"> Firefox Android</summary>

    1. Abrir o link app.mgira.pt
    2. Clicar nos três pontos, no canto superior esquerdo
    3. Carregar em "Adicionar ao ecrã principal"

</details>
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
  - Estimativa de quilómetros percorridos\*
  - Estimativa de CO2 poupado\*\* <br><br>

## Limitações

- Não é possível registar uma nova conta da EMEL
- Não é possível pagar tarifários
- Não é possível pagar uma viagem com o saldo, apenas pontos <br><br>

## Projetos utilizados

- [OpenLayers](https://openlayers.org/), [OpenStreetMap](https://www.openstreetmap.org) e [CartoCDN](https://carto.com/basemaps) para o mapa
- [Mapbox](https://www.mapbox.com/) para as direções
- [Serv00](https://www.serv00.com/) para alojamento <br><br>

## Versões

- v0.0.1 - 01/12/2023
- v0.0.2 - 10/12/2023
- v0.0.3 - 21/12/2023
- v0.0.4 - 24/02/2024
- v0.0.5 - 10/11/2024
- v0.1.0 - 13/11/2024
- v0.1.1 - 16/04/2025
  - Pequenas correções gerais
  - Ciclovias atualizadas
  - Atualização dos endpoints

## Licença

Este software é source-available, ou seja, não é permitida a sua comercialização. O regime source-available permite, a quem quiser, avaliar a segurança da aplicação, assim como o seu funcionamento.

<br>

<details>
<summary>Notas</summary>

\*assume-se uma velocidade média de 15km/h<br>\*\*assume-se uma poupança de 54g/km obrigado <a href="https://github.com/temospena">temospena</a>

</details>
