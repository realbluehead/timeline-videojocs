# Timeline · Videojocs

Joc web inspirat en *Timeline*: col·loca cada videojoc al seu lloc de la línia temporal.

**Juga-hi:** https://realbluehead.github.io/timeline-videojocs/

## Com es juga

- La línia temporal comença amb una carta destapada.
- Cada torn reps una carta amb l'any amagat. Arrossega-la, o toca un **+**, al lloc on creus que va.
- Encert: **+1 punt**. Error: **−1 punt**, i la carta es col·loca al seu lloc correcte.
- Dos jocs del mateix any poden anar en qualsevol ordre.
- Pots triar partides de 10, 20, 40 cartes o tota la baralla.

## Estructura

- `cards.js`: la baralla (títol, any, estudi, plataforma, emoji). Si una carta té el camp opcional `image`, es mostra la imatge en lloc de l'emoji.
- `game.js`: la lògica del joc. Les cartes es dibuixen només a `renderCard()`.
- `style.css`: estils. El disseny de la carta és a `.card`.

És HTML, CSS i JS sense dependències. Per provar-lo en local:

```bash
python3 -m http.server --directory .
```
