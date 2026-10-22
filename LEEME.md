# Petal 🌸

Una calculadora rosada y tranquila para tu Mac. Funciona sin conexión y no envía tus cálculos a ningún servidor.

## Instalar la aplicación en tu MacBook

Abre **Petal-1.0.0-Apple-Silicon.dmg**, arrastra **Petal** a **Applications (Aplicaciones)** y expulsa el disco. Abre Petal desde Aplicaciones; puedes conservarla en el Dock.

La aplicación tiene su propia ventana, icono y menús. Es compatible con Apple Silicon, incluido MacBook Neo, y requiere macOS 13 o posterior. Esta edición tiene firma ad hoc y no está notarizada por Apple: si macOS bloquea la apertura, consulta **Ajustes del Sistema → Privacidad y seguridad → Abrir igualmente** después del primer intento, siempre que confíes en el origen del archivo.

El instalador se ha generado en Linux. Se verificaron el formato de disco, todos los archivos, enlaces y permisos, los hashes de las firmas ad hoc y el funcionamiento de la aplicación con Electron en Linux. La instalación y ejecución en macOS todavía necesitan comprobarse en un Mac.

El historial de la aplicación se guarda en tu Mac, separado del historial de Safari. Para desinstalarla, mueve Petal de Aplicaciones a la Papelera. Con la app cerrada, puedes eliminar también `~/Library/Application Support/Petal` si quieres borrar sus datos.

## Abrir en tu Mac

Descarga y descomprime la carpeta de Petal. Abre **index.html** con Safari, Chrome o Firefox. Conserva `index.html`, `styles.css`, `calculator.js` y `app.js` juntos en la misma carpeta. No necesitas instalar Node, usar Terminal ni crear una cuenta.

Si tienes el archivo independiente **Petal.html**, basta con abrir ese archivo; ya incluye todo lo necesario. Puedes guardarlo en el Escritorio o en Documentos y arrastrarlo al lado derecho del Dock para tenerlo a mano.

## Lo que puedes hacer

- Sumar, restar, multiplicar y dividir con botones o teclado.
- Usar decimales (coma o punto), cambiar el signo y calcular porcentajes. Por ejemplo: `200 + 10 % =` da `220`.
- Copiar resultados y recuperar cualquiera de las últimas 30 cuentas desde el historial.
- Elegir entre rosa nube, rosa durazno y rosa lavanda.
- Consultar los atajos con el botón **Atajos** o la tecla `?`.

Las operaciones encadenadas se resuelven en orden de entrada, como en una calculadora básica: `2 + 3 × 4 =` da `20`. Está pensada para cuentas cotidianas; los resultados tienen hasta 15 dígitos significativos, y no sustituyen cálculos contables de precisión arbitraria.

El historial y el color se guardan localmente en el navegador. Si el navegador impide el almacenamiento, el historial funciona durante la sesión. Al mover el archivo o cambiar de navegador, el historial anterior puede no estar disponible.

## Desarrollo

No hay dependencias ni compilación. Usa el checkout existente; no hace falta crear un worktree.

Para generar el archivo independiente en `dist/Petal.html`:

```sh
node tools/export.cjs
```

Pruebas del motor (Node.js 18 o superior):

```sh
node --test tests/calculator.test.cjs
```

Opcionalmente, para servir los archivos durante el desarrollo:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Comprueba una operación, un porcentaje y la recuperación del historial en el navegador. El servidor es opcional: la aplicación también funciona directamente desde el sistema de archivos.

## Empaquetado para macOS

El código de la ventana de escritorio está en `desktop/main.cjs`. No se habilita Node.js en la página y no se permiten ventanas externas. El icono `.icns` y las instrucciones de instalación están en `desktop/`.

Se usa el runtime oficial **Electron 45.0.0 para darwin-arm64**, descargado de `https://github.com/electron/electron/releases/download/v45.0.0/electron-v45.0.0-darwin-arm64.zip`. El script comprueba su SHA-256 contra el valor publicado en `SHASUMS256.txt` de esa misma versión:

```text
896c3a50b148e89a158dca08a6996a022ddf39b23aac871e107f5b4087f8caa9
```

Prepara el bundle en un directorio nuevo y vacío:

```sh
python3 tools/build-macos.py /ruta/electron-v45.0.0-darwin-arm64.zip /ruta/staging
```

Firma antes de crear la imagen. Se probó **rcodesign 0.29.0** de `indygreg/apple-platform-rs`, con firma ad hoc, el entitlement `com.apple.security.cs.allow-jit` en la aplicación principal y cada helper. El script registra los scopes de cada helper y firma también los frameworks. No modifiques el contenido después de firmar.

```sh
python3 tools/sign-macos.py /ruta/rcodesign /ruta/staging/Petal.app
```

En macOS puedes crear el disco con la herramienta del sistema:

```sh
hdiutil create -volname Petal -srcfolder /ruta/staging -format UDZO \
  dist/Petal-1.0.0-Apple-Silicon.dmg
```

En Linux, `tools/create-dmg.py` requiere `newfs_hfs` de hfsprogs 540.1.linux3 y `hfsplus`/`dmg` de `planetbeing/libdmg-hfsplus` (commit `7ac55ec64c96f7800d9818ce64c79670e7f02b67`). Crea HFS+ y comprime en UDIF, conserva enlaces de frameworks y permisos de ejecución y verifica todos los archivos tras descomprimir la imagen.

```sh
python3 tools/create-dmg.py /ruta/herramientas /ruta/staging \
  dist/Petal-1.0.0-Apple-Silicon.dmg
```

El resultado incluye un archivo `.sha256` y un informe `.validation.json`. La notarización con Developer ID y la validación final en macOS son pasos separados; no están realizadas en esta edición.
