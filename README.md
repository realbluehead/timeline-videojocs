# Timeline · Videojocs

Joc web inspirat en *Timeline*: col·loca cada videojoc al seu lloc de la línia temporal.

**Juga-hi:** https://realbluehead.github.io/timeline-videojocs/

## Com es juga

- La línia temporal comença amb una carta destapada.
- Cada torn reps una carta amb l'any amagat. Arrossega-la, o toca un **+**, al lloc on creus que va.
- Encert: **+1 punt**. Error: **−1 punt**, i la carta es col·loca al seu lloc correcte.
- Dos jocs del mateix any poden anar en qualsevol ordre.
- Pots triar partides de 10, 20, 40 cartes o tota la baralla.

## Cartes

Cada carta s'ha fet amb l'editor gratuït de [Foreverdeck](https://foreverdeck.cards). Cada família de plataforma té el seu marc i color:

| Família | Marc | Color |
|---|---|---|
| Arcade | Vintage | Crimson |
| Nintendo | Classic | Crimson |
| Sega | Full Art | Sapphire |
| PlayStation | Classic | Sapphire |
| Xbox | Classic | Emerald |
| PC i ordinadors | Tarot | Onyx |
| Mòbil | Full Art | Emerald |
| Multiplataforma | Tarot | Gilded |

Les il·lustracions són originals: emojis de [Twemoji](https://github.com/jdecked/twemoji) (© Twitter/X i col·laboradors, llicència [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)) sobre un fons amb el color de la plataforma i el filtre "Soft oil" de Foreverdeck. No s'hi fan servir portades ni captures dels jocs. Els noms dels jocs són marques dels seus propietaris.

## Estructura

- `cards.js`: les famílies de plataforma i la baralla (títol, any, estudi, plataforma, emoji i textos de la carta).
- `img/`: les 80 cartes de Foreverdeck. Si una imatge no carrega, el joc mostra una carta simple.
- `game.js`: la lògica del joc. Les cartes es dibuixen només a `renderCard()`.
- `style.css`: estils. El disseny de la carta és a `.card`.

És HTML, CSS i JS sense dependències. Per provar-lo en local:

```bash
python3 -m http.server --directory .
```
