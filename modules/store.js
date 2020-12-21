/* Simple class to store user data and settings in electron.
 * NOT an ES Module. To be transformed when electron starts supporting them. */
const electron = require('electron');
const path = require('path');
const fs = require('fs');

class Store {
    constructor (defaultStore) {
        const app = (electron.app || electron.remote.app);
        const userDataDir = app.getPath('userData');
        this.path = path.join(userDataDir, `${app.name}-store` + '.json');
        this.store = parseStoreFile(this.path, defaultStore);
        app.on('before-quit', () => {
            this.safeStore();
        })
    }

    //This will return the value for the given key
    get(key) {
        return this.store[key];
    }

    //This will set the value and key
    set(key, value) {
        this.store[key] = value;
    }

    //Tries to write the store in a JSON file.
    safeStore() {
        try {
            fs.writeFileSync(this.path, JSON.stringify(this.store));
        } catch (error) {
            console.log(error);
        }
    }
}

//This function reads the specified file from filePath and returns it as a JSON-Object if possible
//If any error was thrown in that process, the defaultStore will be returned.
//If now object was given as the second argument, the default store will contain the current time in order not to be undefined.
function parseStoreFile(filePath, defaultStore = {  "time":`${new Date().getTime()}`    }) {
    try {
        return JSON.parse(fs.readFileSync(filePath));
    } catch(error) {
        return defaultStore;
    }
}

module.exports = Store;