const { app, BrowserWindow, Menu, ipcMain} = require('electron');
const { autoUpdater } = require("electron-updater");
const Store = require('./modules/store');

autoUpdater.autoInstallOnAppQuit = false; //Compulsory: If not updating might not work

// Class Variables ///////////////////////////////////////////////////////////////////////////////////////////////
const debug = /--debug/.test(process.argv[2]);

//Implement default values if stored date could not be read
let defaultValues = {
  openDirPastDownload: true,
  rememberStorageLocation: false
}
const store = new Store(defaultValues);

global.appVersion = app.getVersion();
global.store = store;
let win;
let menu;

const menuTemplate = [
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forcereload' },
      { role: 'toggledevtools' } 
    ]
  },
  {
    label: 'Settings',
    submenu: [
      { label: 'Choose storage location',
        click: chooseStorageLocation
      },
      { label: 'Open file path after download',
        type: 'checkbox',
        checked: store.get('openDirPastDownload'), //DefaultValue: true
        click: (menuItem, browserWindow, event) => {
          store.set('openDirPastDownload', menuItem.checked);
        }
      },
      {
        label: 'Remember storage location',
        type: 'checkbox',
        checked: store.get('rememberStorageLocation'), //DevaultValue: false
        click: (menuItem, browserWindow, event) => {
          store.set('rememberStorageLocation', menuItem.checked);
        }
      }
    ]
  },
  {
    label: 'Help',
    submenu: [
      { label: 'About Electron',
        click: async () => {
          const { shell } = require('electron');
          await shell.openExternal('https://electronjs.org');
        }
      },
      { label: 'GitHub Repository',
        click: async () => {
          const { shell } = require('electron');
          await shell.openExternal('https://github.com/code-by-tim/youtube-downloader');
        }
      },
      { type: 'separator' },
      { label: 'By Tim Bächle',
        enabled: false }
    ]
  }
]

// Main logic ////////////////////////////////////////////////////////////////////////////////////////////////////
function createWindow () {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 500,
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
  menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

//When the app is ready, create window and check for updates
app.whenReady().then( () => {
  createWindow();
  autoUpdater.checkForUpdates();
});

//Handle how to behave when quitting the app
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

//Opens a dialog and - if choosen by the user - sets the storageLocation variable
//Afterwards it reloads the window
function chooseStorageLocation() {
  if(app.isReady()){
    const { dialog } = require('electron');
    dialog.showOpenDialog({ properties: ['openDirectory'] }).then( (result) => {
      if(!result.canceled) {
        let path = result.filePaths[0];
        win.webContents.send('storageLocation-set', path);
        store.set('storageLocation', path);
      }
    });
  }
}

//React on autoUpdater Events
autoUpdater.on('update-available', () => {
  win.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
  win.webContents.send('update_downloaded');
});

//Update the app when requested
ipcMain.on('quit-and-update', () => {
  autoUpdater.quitAndInstall();
})