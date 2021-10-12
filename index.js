const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');

(function(helper) {
    helper.rootDir = __dirname;
    helper.settings = {};
    helper.userInfo = null;
    helper.orgList = [];
    helper.settingsLines = {};

    helper.platforms = [
        {
          "name": "argon",
          "title": "Argon",
          "id": 12,
          "gen": 3
        },
        {
          "name": "boron",
          "title": "Boron",
          "id": 13,
          "gen": 3
        },
        {
          "name": "bsom",
          "title": "B4xx",
          "id": 23,
          "gen": 3
        },
        {
          "name": "b5som",
          "title": "B5xx",
          "id": 25,
          "gen": 3
        },
        {
          "name": "tracker",
          "title": "Tracker",
          "id": 26,
          "gen": 3
        },
        {
          "name": "electron",
          "title": "Electron",
          "id": 10,
          "gen": 2
        },
        {
          "name": "photon",
          "title": "Photon",
          "id": 6,
          "gen": 2
        },
        {
          "name": "p1",
          "title": "P1",
          "id": 8,
          "gen": 2
        },
        {
          "name": "xenon",
          "title": "Xenon",
          "id": 14,
          "gen": 3,
          "discontinued": true
        },
        {
          "name": "core",
          "title": "Core",
          "id": 0,
          "gen": 1,
          "discontinued": true
        }
    ];

    helper.platformTitleFromId = function(platformId) {
        for(const platform of helper.platforms) {
            if (platform.id == platformId) {
                return platform.title;
            }
        }
        return 'Unknown Platform ' + platformId;
    }

    helper.withConfig = function(config) {
        helper.config = config;

        // Find the line numbers for settings
        const lines = fs.readFileSync(path.join(helper.rootDir, 'config.js'), 'utf8').split('\n');

        const re = /config\.([A-Za-z0-9_]+)[ \t]*=/;

        for(let line = 1; line <= lines.length; line++) {
            const m = lines[line - 1].match(re);
            if (m) {
                helper.settingsLines[m[1]] = line;
            }
        }

        return helper;
    };


    helper.withRootDir = function(rootDir) {
        helper.rootDir = rootDir;
        return helper;
    }

    //
    // Configuration
    //

    helper.warnConfigKey = function(configKey) {
        console.log('You must set config.' + configKey + ' in the config.js, line ' + helper.settingsLines[configKey]);
    };

    //
    // Settings
    //

    helper.loadSettings = function() {
        if (!helper.settingsPath) {
            helper.settingsPath = path.join(helper.rootDir, 'settings.json');
        }
        try {
            if (fs.existsSync(helper.settingsPath)) {
                helper.settings = JSON.parse(fs.readFileSync(helper.settingsPath, 'utf8'));

                // console.log('loaded settings', helper.settings);
            }
        }
        catch(e) {
            helper.settings = {};
        }
    };

    helper.saveSettings = function() {
        if (Object.keys(helper.settings).length > 0) {
            fs.writeFileSync(helper.settingsPath, JSON.stringify(helper.settings, null, 2));
        }
        else {
            if (fs.existsSync(helper.settingsPath)) {
                fs.unlinkSync(helper.settingsPath);
            }
        }
    };

    //
    // Readline Stuff
    //

    helper.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    helper.rl.on('SIGINT', function() {
        helper.rl.close();
        process.exit(1);
    });

    helper.muteOutput = false;

    helper.rl._writeToOutput = function _writeToOutput(s) {
        if (!helper.muteOutput) {
            helper.rl.output.write(s);
        }
    };

    helper.isQuit = function(resp) {
        return resp.toLowerCase().startsWith('q') || resp.toLowerCase().startsWith('x');
    };

    helper.question = function(query) {
        return new Promise(function(resolve, reject) {
            helper.muteOutput = false;
            helper.rl.question(query, function(resp) {
                resolve(resp);
            });
        });
    };

    helper.questionPassword = function(query) {
        return new Promise(function(resolve, reject) {
            helper.muteOutput = true;
            const ask = function() {
                console.log(query);
                helper.rl.question('', function(resp) {
                    if (resp != '') {
                        helper.muteOutput = false;
                        helper.rl.history = helper.rl.history.slice(1);
                        resolve(resp);    
                    }
                    else {
                        ask();
                    }
                });
            };
            ask();
        });
    };

    helper.questionContinueQuit = function(query) {
        return new Promise(function(resolve, reject) {
            helper.muteOutput = false;
            const ask = function() {
                helper.rl.question(query + ' (return to continue, q to quit) ', function(resp) {
                    if (helper.isQuit(resp)) {
                        helper.rl.close();
                        process.exit(1);
                    }
                    else if (resp != '') {
                        ask();
                    }
                    else {
                        resolve(true);
                    }
                });    
            }
            ask();
        });
    };

    helper.questionYN = function(query) {
        return new Promise(function(resolve, reject) {
            helper.muteOutput = false;
            const ask = function() {
                helper.rl.question(query + ' (y or n) ', function(resp) {
                    if (resp.toLowerCase().startsWith('y')) {
                        resolve(true);
                    }
                    else if (resp.toLowerCase().startsWith('n')) {
                        resolve(false);
                    }
                    else
                    if (helper.isQuit(resp)) {
                        helper.rl.close();
                        process.exit(1);
                    }
                    else {
                        ask();
                    }
                });
            }
            ask();
        });
    };

    helper.questionNumber = function(query, options) {
        return new Promise(function(resolve, reject) {
            helper.muteOutput = false;

            const ask = function() {
                helper.rl.question(query, function(resp) {
                    if (helper.isQuit(resp)) {
                        helper.rl.close();
                        process.exit(1);
                    }

                    try {
                        const val = parseInt(resp);
                        if (options && options.validator) {
                            if (options.validator(val)) {
                                if (options.transformResult) {
                                    resolve(options.transformResult(val));
                                }
                                else {
                                    resolve(val);
                                }
                            }
                            else {
                                ask();
                            }
                        }
                        else {
                            resolve(val);
                        }
                    }
                    catch(e) {
                        ask();
                    }
                });
            };
            ask();
        });
    };

    helper.questionMenu = function(query, menuOptions, options) {
        for(let ii = 0; ii < menuOptions.length; ii++) {
            console.log( (ii + 1) + ' - ' + menuOptions[ii]);
        }
        if (options && options.showQuitOption) {
            console.log('q - quit application');
        }
        return helper.questionNumber(query, {
            validator: function(val) {
                return (val >= 1 && val <= menuOptions.length);
            },
            transformResult: function(val) {
                return val - 1;
            }
        });
    };

    helper.close = function() {
        helper.rl.close();
    }

    //
    // Text-based output utilities
    //
    helper.formatOutput = function(data) {
        if (!data || data.length == 0) {
            return  '';
        }

        let output = '';

        let maxColumWidth = [];
        for(const c of data[0]) {
            maxColumWidth.push(0);
        }

        for(const d of data) {
            for(let ii = 0; ii < maxColumWidth.length; ii++) {
                if (maxColumWidth[ii] < d[ii].length) {
                    maxColumWidth[ii] = d[ii].length;
                }
            }
        }

        for(const d of data) {
            let line = '';

            for(let ii = 0; ii < maxColumWidth.length; ii++) {
                const width = maxColumWidth[ii] + 1;
                
                let s = d[ii];
                if (s.length < width) {
                    s += '                                                             '.substr(0, width - s.length); 
                }
                line += s;
            }

            output += line + '\n';
        }        

        return output;
    };

    //
    // Particle Stuff
    //

    helper.getUserInfo = async function() {
        const resp = await axios({
            headers: {
                'Authorization': 'Bearer ' + helper.auth,
                'Accept': 'application/json'
            },
            method: 'get',
            transformResponse: data => JSON.parse(data),
            url: 'https://api.particle.io/v1/user/'
        });

        return resp.data;
    };

    helper.authenticate = async function() {
        helper.loadSettings();
        helper.devices = [];
        helper.auth = null;
        
        if (!helper.auth && helper.config.auth) {
            try {
                helper.auth = helper.config.auth;
                helper.userInfo = await helper.getUserInfo();

                console.log('Using auth token in config.js');
            }
            catch(e) {
                console.log('config.auth is set but does not appear to be valid');
                helper.auth = null;
                helper.config.warnConfigKey('auth');
                process.exit(1);
            }
        }

        if (!helper.auth && helper.settings.auth) {
            try {
                helper.auth = helper.settings.auth;
                helper.userInfo = await helper.getUserInfo();

                console.log('Using auth token saved from previous interactive login');
            }
            catch(e) {
                console.log('Auth token from previous interactive login has expired, please log in again');
                helper.auth = null;
                delete helper.settings.auth;
                helper.saveSettings();                
            }
        }

        if (!helper.auth) {
            console.log('You must log into your Particle account');

            const username = await helper.question('Particle username (account email): ');

            const password = await helper.questionPassword('Password: (will not display as you type) ');

            const postBodyObj = {
                'client_id': 'particle',
                'client_secret': 'particle',
                'expires_in': helper.config.authTokenLifeSecs,
                'grant_type': 'password',
                'password': password,
                'username': username
            }

            let mfa_token;

            try {
                const resp = await axios({
                    data: new URLSearchParams(postBodyObj).toString(),
                    method: 'post',
                    url: 'https://api.particle.io/oauth/token'
                });

                helper.auth = resp.data.access_token;
            }
            catch(e) {
                if (e.response.status == 403) {
                    mfa_token = e.response.data.mfa_token;
                }
            }

            if (mfa_token) {
                try {
                    const otp = await helper.question('MFA token: ');

                    const postBodyObj = {
                        'client_id': 'particle',
                        'client_secret': 'particle',
                        'grant_type': 'urn:custom:mfa-otp',
                        'mfa_token': mfa_token,
                        'otp': otp
                    };
                    const resp = await axios({
                        data: new URLSearchParams(postBodyObj).toString(),
                        method: 'post',
                        url: 'https://api.particle.io/oauth/token'
                    });
    
                    helper.auth = resp.data.access_token;
                }
                catch(e) {                    
                }
            }

            if (!helper.auth) {
                console.log('Login failed');
                process.exit(1);
            }

            if (helper.config.saveInteractiveToken) {
                helper.settings.auth = helper.auth;
                helper.saveSettings(); 
            }

            try {
                helper.userInfo = await helper.getUserInfo();
            }
            catch(e) {
                console.log('Unexpected error retrieving device list ' + e.statusText, e.data);
                process.exit(1);
            }
        }

        if (helper.userInfo.account_info.first_name && helper.userInfo.account_info.last_name) {
            console.log('Logged in as ' + helper.userInfo.username + ' (' + helper.userInfo.account_info.first_name + ' ' + helper.userInfo.account_info.last_name + ')');
        }
        else {
            console.log('Logged in as ' + helper.userInfo.username);
        }

        try {
            const resp = await axios({
                headers: {
                    'Authorization': 'Bearer ' + helper.auth,
                    'Accept': 'application/json'
                },
                method: 'get',
                transformResponse: data => JSON.parse(data),
                url: 'https://api.particle.io/v1/orgs/'
            });

            helper.orgList = resp.data.organizations;
            if (helper.orgList.length == 0) {
                // console.log('You do not have access to any organizations');
            }
        }
        catch(e) {                    
            console.log('Unexpected error retrieving organization list ' + e.statusText, e.data);
            process.exit(1);
        }        

    };

    helper.promptForOrganization = async function(opts) {
        let orgChoices = [];

        if (helper.orgList.length == 0) {
            return null;
        }

        if (helper.orgList.length == 1) {
            return helper.orgList[0];
        }

        for(const org of helper.orgList) {
            orgChoices.push(org.name);
        }
        const promptIndex = await helper.questionMenu('Organization? ', orgChoices);

        return helper.orgList[promptIndex];
    };

    helper.promptForProduct = async function(opts) {

        if (opts.allowSandbox) {
            const promptIndex = await helper.questionMenu(
                opts.prompt + '? ', 
                [
                    'Developer sandbox', // 0
                    'Product' // 1
                ]
            );
            
            if (promptIndex == 0) {
                return {sandbox: true};
            }
        }

        let productList;

        if (helper.orgList.length > 0) {
            const promptIndex = await helper.questionMenu(
                opts.prompt + '? ', 
                [
                    'Sandbox product', // 0
                    'Organization product' // 1
                ]
            );
    
            if (promptIndex == 1) {
                // Organization product
                const org = await helper.promptForOrganization({});
                if (!org) {
                    return {cancel: true};
                }
                console.log(opts.prompt + ' organization ' + org.name + '? ');

                // List org products
                try {
                    const resp = await axios({
                        headers: {
                            'Authorization': 'Bearer ' + helper.auth,
                            'Accept': 'application/json'
                        },
                        method: 'get',
                        transformResponse: data => JSON.parse(data),
                        url: 'https://api.particle.io/v1/orgs/' + org.id + '/products'
                    });
        
                    productList = resp.data.products;
                }
                catch(e) {                    
                    console.log('Unexpected error retrieving org product list ' + e.statusText, e.data);
                    return {error: true, errorText: e.statusText};
                }                        
            }

        }

        if (!productList) {
            // List sandbox products
            try {
                const resp = await axios({
                    headers: {
                        'Authorization': 'Bearer ' + helper.auth,
                        'Accept': 'application/json'
                    },
                    method: 'get',
                    transformResponse: data => JSON.parse(data),
                    url: 'https://api.particle.io/v1/user/products'
                });
    
                productList = resp.data.products;
            }
            catch(e) {                    
                console.log('Unexpected error retrieving sandbox product list ' + e.statusText, e.data);
                return {error: true, errorText: e.statusText};
            }                        
            
        }
        
        if (productList.length == 0) {
            const err = 'There are no products available';
            console.log(err);
            return {error: true, errorText: err};
        }
        // console.log('productList', productList);
        
        let data = [];

        data.push([
            'ID',
            'Name',
            'Platform',
            'Description'
        ]);

        for(const product of productList) {
            if (opts.platformId) {
                if (opts.platformId != product.platform_id) {
                    continue;
                }
            }
            if (opts.notProductId) {
                if (opts.notProductId == product.id) {
                    continue;
                }
            }

            let description = '';
            if (product.description) {
                description = product.description.substr(0, 50).replace('\n', ' ');
            }

            data.push([
                product.id.toString(),
                product.name,
                helper.platformTitleFromId(product.platform_id),
                description
            ]);
        }

        console.log(helper.formatOutput(data));


        while(true) {
            const productId = await helper.questionNumber(opts.prompt + ' product ID? ');

            for(let product of productList) {
                if (product.id == productId) {
                    product.platformName = helper.platformTitleFromId(product.platform_id);
                    return product;
                }
            }
            
            console.log('Not a valid numeric product ID');
        }

        return {error:true};
    };

    helper.assignDeviceGroups = async function(options) {
        const requestBody = {
            groups: options.groups
        };

        const resp = await axios({
            data: JSON.stringify(requestBody),
            headers: {
                'Authorization': 'Bearer ' + helper.auth,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            method: 'put',
            transformResponse: data => JSON.parse(data),
            url: 'https://api.particle.io/v1/products/' + options.product + '/devices/' + options.deviceId
        });

        return resp.data;
    };

    helper.getProductInfo = async function(productId) {
        const resp = await axios({
            headers: {
                'Authorization': 'Bearer ' + helper.auth,
                'Accept': 'application/json'
            },
            method: 'get',
            transformResponse: data => JSON.parse(data),
            url: 'https://api.particle.io/v1/products/' + productId
        });

        return resp.data.product;
    };

    helper.getProductDeviceList = async function(productId) {
        let deviceList = [];

        for(let page = 1; ; page++) {
            try {
                const resp = await axios({
                    headers: {
                        'Authorization': 'Bearer ' + helper.auth,
                        'Accept': 'application/json'
                    },
                    method: 'get',
                    params: {
                        page
                    },
                    transformResponse: data => JSON.parse(data),
                    url: 'https://api.particle.io/v1/products/' + productId + '/devices'
                });
                for(const device of resp.data.devices) {
                    deviceList.push(device);
                }
                if (page >= resp.data.meta.total_pages) {
                    break;
                }
            }
            catch(e) {                    
                console.log('Unexpected error retrieving product device list ' + e.statusText, e.data);
                return {error: true, errorText: e.statusText};
            }         
        }

        return deviceList;
    };
    

    helper.parseDeviceIdFile = function(fileContents) {
        let result = [];

        for(const deviceId of fileContents.matchAll(/([0-9A-Fa-f]{24})/g)) {
            result.push(deviceId.toLowerCase());
        }

        return result;
    };

    helper.findByDeviceIdOrSerialNumber = async function(str) {
        let result = {};

        const deviceIdMatches = helper.parseDeviceIdFile(str);
        if (deviceIdMatches.length == 1) {
            result.device_id = deviceIdMatches[0];
        }
        else {
            // Maybe a serial number?

            // If there's a space, it's probably serial number space mobile secret
            const spaceIndex = str.indexOf(' ');
            if (spaceIndex > 0) {
                result.mobile_secret = str.substr(spaceIndex + 1).trim();
                result.serial_number = str.substr(0, spaceIndex).trim();                
            }
            else {
                result.serial_number = trim();                
            }

            // Look up using the serial number API
            try {
                const resp = await axios({
                    headers: {
                        'Authorization': 'Bearer ' + helper.auth,
                        'Accept': 'application/json'
                    },
                    method: 'get',
                    transformResponse: data => JSON.parse(data),
                    url: 'https://api.particle.io/v1/serial_numbers/' + result.serial_number
                });
    
                result = Object.assign(result, resp.data);
            }
            catch(e) {
                result = {};
            }
    
        }

        return result;
    };

    helper.zeroPaddedNumber = function(n, width) {
        const s = n.toString();
        if (s.length < width) {
            return '00000000000000'.substr(0, width - s.length) + s;
        }
        else {
            return s;
        }
    };

    helper.formatDateYYYYMMDD = function() {
        const d = new Date();
        
        return d.getFullYear() + 
            helper.zeroPaddedNumber(d.getMonth() + 1, 2) + 
            helper.zeroPaddedNumber(d.getDate(), 2);
    };


}(module.exports));


