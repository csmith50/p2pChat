const electron = require('electron');
const url = require('url');
const path = require('path');
const cp = require('child_process');

const {app, BrowserWindow, Menu, ipcMain} = electron;

let mainWindow;
let displayName;
let peerProcess = cp.fork('networking.js'); //Start libp2p

// Listen for the app to be ready
app.on('ready', function(){
    //create new window
    mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true
        }
    });
    //Load html into window
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'login.html'),
        protocol: 'file:',
        slashes: true
    }));

    //Build menu from template
    const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
    //Insert menu
    Menu.setApplicationMenu(mainMenu);
});

//Catch peer:connect
ipcMain.on('peer:start', function(event, item){
    displayName = item;
    console.log("name is ");
    console.log(displayName);

    //close login window and open wait screen
    var windowCopy = mainWindow;
    mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true
        }
    });
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'mainWindow.html'),
        protocol: 'file:',
        slashes: true
    }));
    windowCopy.close();
});

//catch and handle inbound messages from libp2p
peerProcess.on('message', (m) => {
    if (m.protocol === 'peer:found') {
        mainWindow.webContents.send('peer:connect', m.peer);
    }
    else if (m.protocol === 'messageRecieved') {
        console.log("from libp2p: ", m);
        console.log("mainwindow is: ", typeof(mainWindow));
        mainWindow.webContents.send('recieve', {message: m.message, time: m.time});
    }
});

//catch peer:accept from waitForPeers
ipcMain.on('peer:accept', function(event, item) {
    //open our chat window to that peer
    var tempWindow = mainWindow;
    mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true
        }
    });
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'mainWindow.html'),
        protocol: 'file:',
        slashes: true
    }));
    tempWindow.close();
    mainWindow.webContents.send('setName', {name: displayName});
});
//catch peer:deny from waitForPeers
ipcMain.on('peer:deny', function(event, item) {
    //tell libp2p to disconnect
    peerProcess.send('peer:deny', (e) => {
        if (e) {
            console.log("error sending message to fork");
        }
    })
});

//Catch message:send
ipcMain.on('message:send', function(e, item){
    console.log("message recieved in main.js");
    console.log(item.message);
    console.log(item.time);
    peerProcess.send({protocol: 'peer:send', message: item.message, time: item.time, name: displayName});
});

// Create menu template; a menu is just an array of objects
// Menu refers to the shortcut bar above the window i.e file, edit, view etc.
const mainMenuTemplate = [
    {
        label:'File',
        submenu:[
            {
                label: 'Quit',
                accelerator: process.platform == 'darwin' ? 'Command+Q' : 'Ctrl+Q',
                click(){
                    app.quit();
                }
            }
        ]
    }
];

//If mac, add empty object to menu
//this is to avoid having an option in the menu
//called electron first
if(process.platform == 'darwin') {
    mainMenuTemplate.unshift({});
}

//Add developer tools if not in production
//!== is equvalent to not equal value or not equal type
if(process.env.NODE_ENV !== 'production'){
    mainMenuTemplate.push({
        label:'Developer Tools',
        submenu:[
            {
                label: 'Toggle DevTools',
                accelerator: process.platform == 'darwin' ? 'Command+I' : 'Ctrl+I',
                click(item, focusedWindow){
                    focusedWindow.toggleDevTools();
                }
            },
            {
                role: 'reload'
            }
        ]
    });
}

//Use vanilla javascript to send vairables found on html pages
//Then send variables to the main.js and send to where the variable 
//needs to go.
//IpcRenderer is the elctron class used to do this