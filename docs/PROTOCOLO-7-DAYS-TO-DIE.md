# Protocolo de 7 Days to Die

Este protocolo es el preset editable de **7 Days to Die V3.4** para The Game Master. Su archivo fuente es:

`presets/7-days-to-die-v3.4-protocol.json`

Puede importarse directamente desde la pantalla **Import Game Library (JSON)**. El archivo contiene un único juego; el importador acepta tanto un objeto individual como una biblioteca completa.

## Cómo funciona una categoría

Cada categoría representa una opción del juego y debe tener un `id` único, un nombre y al menos dos resultados:

```json
{
  "id": "cat-example",
  "name": "[World] Example Setting",
  "options": [
    { "id": "opt-example-default", "label": "Default", "rank": "D" },
    { "id": "opt-example-hard", "label": "Hard", "rank": "B" }
  ]
}
```

El RNG no usa el rango como peso. Dentro de una categoría, cada opción conserva la misma probabilidad. Los rangos solo describen la dificultad y permiten aplicar límites globales.

## Escala recomendada

- `F`: ventaja importante para el jugador.
- `E`: ligeramente más fácil que el valor predeterminado.
- `D`: comportamiento predeterminado o neutral.
- `C`: dificultad perceptible, pero cómoda.
- `B`: restricción severa que sigue siendo sostenible.
- `A`: condición extrema que debe combinarse con moderación.
- `S`: peligro excepcional o condición capaz de definir toda la partida.

## Restricciones del protocolo

El objeto `constraints` protege la jugabilidad mediante cuatro mecanismos:

1. `maxAttempts`: intentos máximos para encontrar una configuración válida.
2. `rankLimits`: máximo 4 resultados S y 15 resultados A/S combinados.
3. `forbiddenCombinations`: opciones que nunca pueden aparecer juntas.
4. `numericSums`: los cinco porcentajes de bioma deben sumar exactamente 100%.

Las restricciones actuales impiden, entre otros casos:

- desactivar simultáneamente daño melee y ranged;
- desactivar daño de bloques y terreno;
- quedarse sin dos modos principales de movimiento;
- combinar enemigos solo vulnerables a headshots con multiplicador de headshot nulo;
- generar un mundo sin ciudades ni POI de naturaleza;
- desactivar simultáneamente minería y obtención general de recursos;
- combinar blood moon diaria, 64 zombis y velocidad nightmare;
- eliminar a la vez comida de loot, cultivos y comercio;
- comenzar con cero puntos y sin posibilidad de ganar XP.

## Valores utilizados en sumas

Las opciones que participan en `numericSums` necesitan `constraintValue`:

```json
{
  "id": "opt-biome-forest-20",
  "label": "20%",
  "rank": "D",
  "constraintValue": 20
}
```

No debe eliminarse `constraintValue` de una opción de bioma mientras su categoría siga incluida en la regla de suma.

## Flujo para editar el protocolo

1. Editar `presets/7-days-to-die-v3.4-protocol.json`.
2. Mantener únicos todos los IDs de categorías y opciones.
3. Si se elimina una opción referenciada por una restricción, actualizar también `constraints`.
4. Sincronizar la biblioteca:

   ```powershell
   node scripts/sync-7dtd-protocol.mjs
   ```

5. Construir la aplicación con Node 22 o superior:

   ```powershell
   node build.mjs
   ```

6. Importar el JSON y ejecutar varias secuencias de prueba.

Para volver a extraer el protocolo desde la biblioteca de ejemplos:

```powershell
node scripts/sync-7dtd-protocol.mjs --extract
```

## Lista de control al agregar opciones

- La opción existe realmente en la versión/mod utilizada de 7 Days to Die.
- Su rango representa el impacto acumulativo, no solo la dificultad aislada.
- Una opción A o S no elimina por sí sola una mecánica indispensable.
- Las combinaciones peligrosas tienen una regla en `forbiddenCombinations`.
- Las categorías numéricas relacionadas conservan una configuración válida posible.
- El protocolo puede encontrar resultados sin agotar `maxAttempts`.
