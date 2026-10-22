'use strict';

const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

app.setName('Petal');
let window;
const entry = pathToFileURL(path.join(__dirname, 'web', 'index.html')).href;

function createWindow() {
  window = new BrowserWindow({
    width: 1080,
    height: 850,
    minWidth: 390,
    minHeight: 680,
    title: 'Petal',
    backgroundColor: '#faf5f3',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url.split('#')[0] !== entry) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.loadFile(path.join(__dirname, 'web', 'index.html'));
  window.on('closed', () => { window = null; });
}

function showShortcuts() {
  if (window) window.webContents.executeJavaScript('document.querySelector("#open-shortcuts").click()');
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: 'Petal',
    applicationVersion: app.getVersion(),
    copyright: 'Pequeñas cosas, bien hechas.',
  });
  const menu = [
    { label: 'Petal', submenu: [
      { label: 'Acerca de Petal', role: 'about' },
      { type: 'separator' },
      { label: 'Ocultar Petal', role: 'hide' },
      { label: 'Ocultar otras', role: 'hideOthers' },
      { label: 'Mostrar todas', role: 'unhide' },
      { type: 'separator' },
      { label: 'Salir de Petal', role: 'quit' },
    ] },
    { label: 'Edición', submenu: [
      { label: 'Deshacer', role: 'undo' },
      { label: 'Rehacer', role: 'redo' },
      { type: 'separator' },
      { label: 'Copiar', role: 'copy' },
      { label: 'Seleccionar todo', role: 'selectAll' },
    ] },
    { label: 'Ventana', submenu: [
      { label: 'Minimizar', role: 'minimize' },
      { label: 'Zoom', role: 'zoom' },
      { label: 'Pantalla completa', role: 'togglefullscreen' },
      { type: 'separator' },
      { label: 'Cerrar ventana', role: 'close' },
    ] },
    { label: 'Ayuda', submenu: [{ label: 'Atajos de teclado', click: showShortcuts }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
