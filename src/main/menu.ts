import { app, BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron';

export function buildMenu(window: BrowserWindow): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Flowt',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'Cmd+T',
          click: () => {
            if (!window.isDestroyed()) {
              window.webContents.send('menu:new-tab');
            }
          },
        },
        {
          label: 'Close Tab',
          accelerator: 'Cmd+W',
          click: () => {
            if (!window.isDestroyed()) {
              window.webContents.send('menu:close-tab');
            }
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload Preview',
          accelerator: 'Cmd+R',
          click: () => { if (!window.isDestroyed()) window.webContents.send('preview:reload-from-menu'); },
        },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: 'Increase Terminal Font',
          accelerator: 'Cmd+=',
          click: () => { if (!window.isDestroyed()) window.webContents.send('terminal:zoom', 'in'); },
        },
        {
          label: 'Decrease Terminal Font',
          accelerator: 'Cmd+-',
          click: () => { if (!window.isDestroyed()) window.webContents.send('terminal:zoom', 'out'); },
        },
        {
          label: 'Reset Terminal Font',
          accelerator: 'Cmd+0',
          click: () => { if (!window.isDestroyed()) window.webContents.send('terminal:zoom', 'reset'); },
        },
        { type: 'separator' },
        {
          label: 'Increase All Fonts',
          accelerator: 'Cmd+Option+=',
          click: () => { if (!window.isDestroyed()) window.webContents.send('ui:zoom', 'in'); },
        },
        {
          label: 'Decrease All Fonts',
          accelerator: 'Cmd+Option+-',
          click: () => { if (!window.isDestroyed()) window.webContents.send('ui:zoom', 'out'); },
        },
        {
          label: 'Reset All Fonts',
          accelerator: 'Cmd+Option+0',
          click: () => { if (!window.isDestroyed()) window.webContents.send('ui:zoom', 'reset'); },
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
