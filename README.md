# Petal 🌸

Una calculadora rosada, bonita y tranquila para tu MacBook.

<img src="desktop/petal.png" alt="Icono de Petal: una flor sobre fondo rosa" width="96">

- Tres paletas: rosa nube, rosa durazno y rosa lavanda.
- Operaciones básicas, porcentajes, decimales y atajos de teclado.
- Historial local con las últimas 30 cuentas y copia de resultados.
- Funciona sin conexión y sin enviar tus cálculos a servidores.

## Usarla en el navegador

Descarga el código y abre **index.html** con Safari, Chrome o Firefox. Mantén los archivos de la carpeta juntos. No necesitas instalar dependencias.

Para generar un único archivo portátil, con Node.js:

```sh
node tools/export.cjs
```

Abre después `dist/Petal.html`.

## Aplicación para macOS

Petal también se empaqueta como una aplicación con ventana, icono y menús propios, dentro de un instalador `.dmg` para **Apple Silicon y macOS 13 o posterior**, incluido MacBook Neo.

El instalador se distribuye por separado; los binarios de `dist/` no están incluidos en Git. Esta edición no está notarizada por Apple y la instalación en macOS está pendiente de validación en un Mac.

Consulta [las instrucciones de instalación y compilación](LEEME.md).

## Pruebas

Con Node.js 18 o superior:

```sh
node --test tests/calculator.test.cjs
```

El motor tiene 18 pruebas. También se comprobaron el historial, los temas, el teclado, el diseño adaptable y el funcionamiento sin conexión en el navegador, además del arranque de la ventana de escritorio con Electron en Linux.
