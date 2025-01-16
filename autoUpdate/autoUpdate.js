
const electron = require('electron');

electron.app.on('ready', () => {
    electron.autoUpdater.setFeedURL({
        url: 'http://local-server/update.json'
    });
    electron.autoUpdater.checkForUpdates();
});