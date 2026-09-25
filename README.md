# Themis_Criador
Tradutor WhatsApp

## Guarda compartilhada

`guarda-compartilhada/` contém um programa que regula a guarda compartilhada: a partir do regime de convivência escolhido, ele monta o calendário anual de pernoites e redige a minuta do plano de convivência (arts. 1.583, 1.584 e 1.634 do Código Civil, com a redação da Lei nº 13.058/2014).

Para usar, abra `guarda-compartilhada/index.html` no navegador. Não há dependências nem etapa de build.

O programa cobre:

- **Regimes ordinários**: fins de semana alternados (com pernoite opcional no meio da semana), semanas alternadas, 2-2-5-5 e 2-2-3.
- **Datas especiais**, que prevalecem sobre o regime: Natal e Réveillon, Carnaval e Páscoa (alternados entre anos pares e ímpares), Dia das Mães, Dia dos Pais e aniversário de cada genitor.
- **Férias escolares**, divididas em metades que se alternam a cada ano.
- **Indicadores**: pernoites e percentual de cada genitor, maior período sem contato com cada um e número de trocas no ano.
- **Minuta** com cláusulas de guarda, base de moradia, convivência, trocas, datas especiais, férias, comunicação, acesso a informações, viagens, mudança de domicílio, alimentos (opcional), conduta (Lei nº 12.318/2010) e revisão.

Regra de precedência: Natal e Réveillon > datas comemorativas (Dia das Mães, Dia dos Pais, aniversários) > Carnaval e Páscoa > férias > regime ordinário. Cada dia do calendário indica com quem a criança pernoita.

As regras ficam em `guarda-compartilhada/motor.js`, que funciona no navegador e no Node. Para rodar os testes:

```
npm test
```

A minuta é um ponto de partida e deve ser revisada para o caso concreto antes da homologação judicial.
