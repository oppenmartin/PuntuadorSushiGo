# Sushi Go Scoreboard

App web simple para cargar una partida de Sushi Go, detectar cartas desde fotos y calcular el puntaje de 3 rondas mas pudines finales.

## Estado actual

- Landing con seleccion de `2` a `5` jugadores
- Carga de nombres
- Tablero estilo anotador con rondas, pudines y total
- Puntaje completo de:
  - Maki
  - Tempura
  - Sashimi
  - Gyoza
  - Nigiri + Wasabi
  - Pudin al final
- Carga manual asistida de cartas
- Detector automatico inicial desde foto

## Como probarlo

Necesitás tener `node` instalado.

1. Entrá a la carpeta del proyecto:

```bash
cd /Users/martin/Documents/sushi-go-online
```

2. Levantá el server:

```bash
npm start
```

3. Abrí en el navegador:

```text
http://localhost:3000
```

## Recomendaciones para las fotos

- Vista cenital o casi cenital
- Cartas sin superponerse
- Buena luz
- Fondo con buen contraste
- Puede ser una fila o una matriz
- La lectura en matriz va de arriba a abajo por filas, y de izquierda a derecha dentro de cada fila

## Estructura

- `public/index.html`: shell de la app
- `public/app.js`: estado, UI y scoring
- `public/detector.js`: detector automatico inicial en navegador
- `public/styles.css`: estilos
- `server.js`: servidor estatico simple

## Subir a GitHub

Cuando quieras publicarlo:

```bash
cd /Users/martin/Documents/sushi-go-online
git init
git add .
git commit -m "Initial Sushi Go scoreboard"
git branch -M main
git remote add origin <TU_REPO>
git push -u origin main
```

## Publicar con GitHub Pages

Este proyecto ya está preparado para publicarse desde la carpeta `docs/`.

En GitHub:

1. Entrá a `Settings`
2. Abrí `Pages`
3. En `Build and deployment`, elegí:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/docs`
4. Guardá y esperá unos minutos

## Siguiente mejora recomendada

- Ajustar el detector con mas fotos reales de partidas
- Agregar vista previa de deteccion
- Deploy publico en Vercel, Render o similar
