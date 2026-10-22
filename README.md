# Petal 🌸

Una calculadora rosada, bonita y tranquila para tu MacBook.

**[🌸 Descargar Petal para Mac (.dmg)](https://github.com/Kuintesa/Kuintesa/releases/download/petal-v1.0.0/Petal-1.0.0-Apple-Silicon.dmg)** · [Ver la publicación y sus archivos](https://github.com/Kuintesa/Kuintesa/releases/tag/petal-v1.0.0)

Abre el `.dmg`, arrastra **Petal** a **Aplicaciones** y ábrela desde allí.

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

El instalador está disponible en [GitHub Releases](https://github.com/Kuintesa/Kuintesa/releases/tag/petal-v1.0.0); los binarios de `dist/` no están incluidos en el historial de Git. Esta edición tiene firma ad hoc y no está notarizada por Apple. El instalador se construye y verifica en macOS; la interacción con la aplicación en un Mac de usuario sigue pendiente de validación.

Consulta [las instrucciones de instalación y compilación](LEEME.md).

## Pruebas

Con Node.js 18 o superior:

```sh
node --test tests/calculator.test.cjs
```

El motor tiene 18 pruebas. También se comprobaron el historial, los temas, el teclado, el diseño adaptable y el funcionamiento sin conexión en el navegador, además del arranque de la ventana de escritorio con Electron en Linux. La publicación verifica en macOS las firmas nativas, el montaje del disco, la copia de la aplicación y una operación con el ejecutable de Apple Silicon.
