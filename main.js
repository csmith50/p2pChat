const electron = require('electron');
const url = require('url');
const path = require('path');
const cp = require('child_process');

const {app, BrowserWindow, Menu, ipcMain} = electron;

//Set the environment variable to disable dev tools
process.env.NODE_ENV = 'development';

let mainWindow;
let displayName = "";
let peerProcess; //= cp.fork('networking.js'); //Start libp2p
let renderFinish = false;
let chatLog = [];

//helper functions
function sendToChild(protocol, child, parameters) {
    if (protocol == "disconnecting") {
        child.send(parameters, (e) => {
            if (e) console.log("error sending disconnect message:", e);
            console.log("mainWindow is closing........");
        });
    }
    else if (protocol == "send") {
        child.send(parameters);
    }
}

// Listen for the app to be ready
app.on('ready', function(){
    //create new window
    mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true
        },
        width: 1280,
        height: 720,
        minWidth: 400,
        minHeight: 400,
        icon: path.join(__dirname, 'content/logo.ico')
    });
    //Load html into window
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'login.html'),
        protocol: 'file:',
        slashes: true
    }));

    //specify what to do on load
    mainWindow.webContents.on('did-finish-load', () => {
        console.log("inside did finish load");
        console.log("the name of window is: ", mainWindow.name);
        if (mainWindow.name == "chat-window") {
            console.log("inside if");
            renderFinish = true;
            mainWindow.webContents.send('setName', [displayName]);
            console.log("sent setName");
        }
    });

    //when the user clicks the app's close button tell libp2p to disconnect to all peers
    mainWindow.on('close', () => {
        sendToChild("disconnecting", peerProcess, {protocol: 'disconnecting', name: displayName});
        //give libp2p some time to execute the disconnect; waits for 200 miliseconds
        setTimeout(function (){}, 200);
        //delete our chat logs
        chatLog = [];
        console.log("chat logs deleted... app is now closing");
    });

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
    mainWindow.name = "chat-window";
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'mainWindow.html'),
        protocol: 'file:',
        slashes: true
    }));
    peerProcess = cp.fork('networking.js'); //Start libp2p
    //catch and handle inbound messages from libp2p
    peerProcess.on('message', (m) => {
        if (m.protocol === 'peer:found') {
            if (renderFinish) {
                mainWindow.webContents.send('peer:connect', m.peer);
            }
        }
        else if (m.protocol === 'messageRecieved') {
            if (renderFinish) {
                console.log("from libp2p: ", m);;
                mainWindow.webContents.send('recieve', [m.message, m.time, m.name]);
                chatLog.push(m);
            }
        }
        else if (m.protocol === 'newUserNameRequest') {
            peerProcess.send({protocol: 'newUserNameResponse', name: displayName});
        }
        else if (m.protocol === 'newUserConnection') {
            mainWindow.webContents.send('newUser', [m.name]);
        }
        else if (m.protocol === 'disconnectNotice') {
            console.log("recieved disconnect notice from libp2p");
            mainWindow.webContents.send('disconnectNotice', [m.name]);
        }
        else if (m.protocol === 'chatLogRequest') {
            console.log("recieved chat log request from libp2p");
            peerProcess.send({protocol: 'chatLogResponse', logs: chatLog});
        }
        else if (m.protocol === 'chatLogDisplay') {
            console.log("received chat log display from libp2p");
            mainWindow.webContents.send('chatLogDisplay', [m.names, m.messages, m.times]);
        }
    });
});

//Catch message:send
ipcMain.on('message:send', function(e, item){
    console.log("message recieved in main.js");
    console.log(item.message);
    console.log(item.time);
    sendToChild("send", peerProcess, {protocol: 'peer:send', message: item.message, time: item.time, name: displayName});
    item.name = displayName;
    chatLog.push(item);
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
            },
            {
                label: 'Display chat log',
                click(item, focusedWindow){
                    console.log("chat log display requested:");
                    console.log(chatLog);
                }
            }
        ]
    });
}

//Use vanilla javascript to send vairables found on html pages
//Then send variables to the main.js and send to where the variable 
//needs to go.
//IpcRenderer is the elctron class used to do this