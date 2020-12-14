const { app, BrowserWindow, Menu, ipcMain} = require('electron');
const { autoUpdater } = require("electron-updater");

const debug = /--debug/.test(process.argv[2]);

global.storageLocation = {path: undefined,
                          version: app.getVersion()};
var win;

const menuTemplate = [
  {
    label: 'File',
    submenu: [
      { role: 'quit' },
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forcereload' },
      { role: 'toggledevtools' },
      { type: 'separator' },
      { role: 'resetzoom' },
      { role: 'zoomin' },
      { role: 'zoomout' }    
    ]
  },
  {
    label: 'Settings',
    submenu: [
      { label: 'Choose storage location',
        click: chooseStorageLocation
      }
    ]
  },
  {
    label: 'Help',
    submenu: [
      { label: 'Learn More',
        click: async () => {
          const { shell } = require('electron');
          await shell.openExternal('https://electronjs.org');
      }},
      { type: 'separator' },
      { label: 'By Tim Bächle',
        enabled: false }
    ]
  }
]

function createWindow () {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true
    }
  });

  win.loadFile('index.html');

  //Launch fullscreen with DevTools open if in DebugMode
  if(debug) {
    win.webContents.openDevTools();
    win.maximize();
  }

  //Set my custom menu
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  //Check for updates once the window is ready
  win.once('ready-to-show', () => {
    autoUpdater.checkForUpdatesAndNotify();
  })
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    console.log("Was here");
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

//Opens a dialog and - if choosen by the user - sets the storageLocation variable
//Afterwards it reloads the window
function chooseStorageLocation() {
  if(app.isReady()){
    const { dialog } = require('electron');
    dialog.showOpenDialog({ properties: ['openDirectory'] }).then( (result) => {
      if(!result.canceled) {
        storageLocation.path = result.filePaths[0];
        win.reload();
      }
    });
  }
}

autoUpdater.on('update-available', () => {
  win.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
  win.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
})