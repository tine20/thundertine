/*

Copyright (C) 2010 by Santa Noel

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; version 2
of the License ONLY.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

*/

var config = {

  my_id: 'thundertine@santa.noel',
  user: '',
  pwdCache: '',
  categories: ['contacts', 'calendars', 'tasks'],
  urlSuffix: '/Microsoft-Server-ActiveSync',

  jsonSyncConfig: null,

  picDir: 'Photos',
  keepSyncKeyOnSave: false,

  read: function() {
	// data in thunderbird config
	var prefs = Components.classes['@mozilla.org/preferences-service;1'].
			getService(Components.interfaces.nsIPrefService);
	prefs = prefs.getBranch('extensions.ttine.');
	// IMPORTANT: If extension is loaded the very first time a unique id is required!
	if (prefs.getCharPref('deviceId') == '')
		prefs.setCharPref('deviceId', (new Date()).getTime());
	this.user = prefs.getCharPref('user');
	this.deviceId = prefs.getCharPref('deviceId');
	this.deviceType = 'ThunderTine';
	this.url = (prefs.getBoolPref('hostSsl') ? 'https://' : 'http://') + prefs.getCharPref('host') + this.urlSuffix;
	this.interval = prefs.getIntPref('syncInterval') * 60 * 1000; // in milliseconds
	this.syncBeforeClose = prefs.getBoolPref('syncBeforeClose');
	this.checkFolderBefore = prefs.getBoolPref('checkFolderBefore');
	this.contactsLimitPictureSize = prefs.getBoolPref('contactsLimitPictureSize');
	this.fullSilence = prefs.getBoolPref('fullSilence');
	this.enableConsoleOutput = prefs.getBoolPref('enableConsoleOutput');
	this.enableExperimentalCode = prefs.getBoolPref('enableExperimentalCode');
	this.keepSyncKeyOnSave = prefs.getBoolPref('keepSyncKeyOnSave');
	this.jsonSyncConfig = this.getSyncConfig();

	// check for deleted abooks
	this.localCheckConfigs(this.jsonSyncConfig);

	// passwd will be read via getPwd()
	this.initialized = true;

	// make sure there is a folder for Photos
	var dir = Components.classes['@mozilla.org/file/directory_service;1']
			.getService(Components.interfaces.nsIProperties).get('ProfD', Components.interfaces.nsIFile);
	dir.append(this.picDir);
	// if it doesn't exist, create
	if (!dir.exists() || !dir.isDirectory()) {
		dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, parseInt('0755', 8));
	}

	// make sure all important things are known
	return this.minimumConfig();
  },

  getPwd: function() {
	if (config.pwdCache == '') {
		try {
			// data in thunderbird config
			var prefs = Components.classes["@mozilla.org/preferences-service;1"]
					.getService(Components.interfaces.nsIPrefService);
			prefs = prefs.getBranch("extensions.ttine.");
			// get password
			var passwordManager = Components.classes["@mozilla.org/login-manager;1"]
					.getService(Components.interfaces.nsILoginManager);
			if (prefs.getCharPref('host') != '' && config.user != '') {
				var logins = passwordManager.findLogins({}, config.url, null,
						'Tine 2.0 Active Sync');
				for ( var i = 0; i < logins.length; i++) {
					if (logins[i].username == config.user) {
						config.setPwd(logins[i].password);
						break;
					}
				}
			}
		} catch(e) {
			config.setPwd('');
		}
	}
	return config.pwdCache;
  },

  setPwd: function(pwd) {
	config.pwdCache = pwd;
  },

  isConsoleOutputEnabled: function() {
	// data in thunderbird config
	var prefs = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService);
	prefs = prefs.getBranch("extensions.ttine.");

	config.enableConsoleOutput = prefs.getBoolPref("enableConsoleOutput");

	return config.enableConsoleOutput;
  },

  getAbs: function() {
	var result = Array();

	let abManager = Components.classes["@mozilla.org/abmanager;1"] 
		.getService(Components.interfaces.nsIAbManager);
	let allAddressBooks = abManager.directories;
	while (allAddressBooks.hasMoreElements()) {  
		let addressBook = allAddressBooks.getNext();
		if (addressBook instanceof Components.interfaces.nsIAbDirectory && 
			!addressBook.isRemote && !addressBook.isMailList && addressBook.fileName != 'history.mab')
			result.push(addressBook);
	}

	return result.sort(this.abSortFunction);
  },

  abSortFunction: function(a, b) {
	if (a.dirName > b.dirName || (a.dirName == b.dirName && a.URI > b.URI))
		return 1;
	if (a.dirName < b.dirName || (a.dirName == b.dirName && a.URI < b.URI))
		return -1;

	return 0;
  },

  getAbByUri: function(uri) {
	var abs = this.getAbs();

	for (var i=0; i<abs.length; i++)  
		if (abs[i].URI == uri)
			return abs[i];

	return null;
  },

  getSyncConfigByCategoryUri: function(category, uri) {
	var syncConfig = this.getSyncConfig();

	for ( var i = 0; i < syncConfig[category].configured.length; i++)
		if (syncConfig[category].configured[i].local == uri)
			return syncConfig[category].configured[i];

	return null;
  },

  isCalendarAccessible: function(param) {
	var result = false;

	try {
		var calMgr = Components.classes["@mozilla.org/calendar/manager;1"].
					getService(Components.interfaces.calICalendarManager);

		if (typeof param == 'object')
			param.calMgr = calMgr;

		result = true;
	} catch(e) {
		var syncConfig = this.getSyncConfig();
		if (syncConfig.missingCalendarNotified == undefined) {
			syncConfig.missingCalendarNotified = true;
			helper.prompt(ttine.strings.getString('addOnLightningMissed'));
		}
	}

	return result;
  },

  getCals: function(inclCalendarReference) {
	var result = [];

	var cal = {};
	if (this.isCalendarAccessible(cal) == true) {
		var calList = cal.calMgr.getCalendars({});

		for (var idx in calList) {
			if (calList[idx].readOnly == true)
				continue;

			var cal = {};
			cal.dirName = calList[idx].name;
			cal.URI = calList[idx].uri.asciiSpec + '?id=' + calList[idx].id;
			if (typeof inclCalendarReference == 'boolean' && inclCalendarReference == true)
				cal.calendar = calList[idx]; 

			result.push(cal);
		}
	}

	return result.sort(this.abSortFunction);
  },

  getCalByUri: function(uri, inclCalendarReference) {
	var cals = this.getCals(inclCalendarReference);

	for (var i=0; i<cals.length; i++)  
		if (cals[i].URI == uri)
			return cals[i];

	return null;
  },

  getTasks: function() {
	var result = [];

	var cal = {};
	if (this.isCalendarAccessible(cal) == true) {
		var calList = cal.calMgr.getCalendars({});

		for (var idx in calList) {
			var cal = {};
			cal.dirName = calList[idx].name;
			cal.URI = calList[idx].uri.asciiSpec;

			result.push(cal);
		}
	}

	return result.sort(this.abSortFunction);
  },

  addSyncConfigByCategory: function(category, abUri, folderId) {
	var syncConfig = this.getSyncConfig();
	var result = {};

	result.local = abUri;
	result.remote = folderId;

	syncConfig[category].configured.push(result);

	return result;
  },

  removeSyncConfigByCategory: function(category, removeSyncConfig) {
	var syncConfig = this.getSyncConfig();

	// remove from configured array
	for (var i=0; i<syncConfig[category].configured.length; i++)
		if (syncConfig[category].configured[i].local == removeSyncConfig.local && syncConfig[category].configured[i].remote == removeSyncConfig.remote) {
			syncConfig[category].configured.splice(i, 1);
			break;
		}
  },

  addSyncInfos: function(action) {
	var syncConfig = config.getSyncConfig();

	if (syncConfig != undefined) {
		switch (action) {
			case 'start':
				syncConfig.lastSyncDuration = undefined;
				syncConfig.lastSyncTimeComplete = syncConfig.lastSyncTime;
				syncConfig.lastSyncTime = Date.now();
				break;
			case 'stop':
				syncConfig.lastSyncDuration = Date.now() - syncConfig.lastSyncTime;
				syncConfig.lastSyncTime = Date.now();
				break;
			case 'failed':
				syncConfig.lastSyncDuration = Date.now() - syncConfig.lastSyncTime;
				syncConfig.lastSyncTime = Date.now();
				break;
			default:
				devTools.writeMsg('config', 'addSyncInfos', 'action: ' + action);
				break;
		}
	} else
		devTools.writeMsg('config', 'addSyncInfos', 'action: ' + action + ' syncConfig = undefined!');
  },

  isLastError: function(reason, status, err) {
	var result = false;

	if (err != undefined) {
		result = (err.reason == reason && err.status == status); 
	}

	//devTools.writeMsg('config', 'isLastError', 'reason ' + reason + ', status ' + status + ', err ' + (err != undefined ? JSON.stringify(err) : err) + ', result ' + result);
	return result;
  },

  getSyncConfig: function() {
	if (config.jsonSyncConfig == null) {
		var prefs = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService);
		prefs = prefs.getBranch("extensions.ttine.");

		config.jsonSyncConfig = config.parseJSONFromString(prefs.getCharPref("jsonSyncConfig"));

		devTools.writeMsg('config', 'getSyncConfig', 'config ' + (config.jsonSyncConfig == null ? '<null>' : 'version ' + config.jsonSyncConfig.version));
		// convert if not version 1.0
		if (config.jsonSyncConfig != null && config.jsonSyncConfig.version != "1.0") {
		}
	}

	return config.jsonSyncConfig;
  },

  saveSyncConfig: function() {
	// clone jsonSyncConfig
	var jsonConfigSave = JSON.parse(JSON.stringify(config.getSyncConfig()));

	// remove temporary stuff
	// list of properties
	var configProps = ['folders', 'lastSyncTime', 'lastSyncTimeComplete', 'lastSyncDuration', 'lastSyncStatus', 'lastMergeAddedNewConfigs', 'missingCalendarNotified'];
	for (var idx in configProps)
		if (jsonConfigSave.hasOwnProperty(configProps[idx]))
			jsonConfigSave[configProps[idx]] = undefined;

	// list of categories
	// list of properties per category
	var folderProps = ['syncKey', 'syncStatus', 'managedCards']; 
	for (var idx in this.categories) {
		var category = this.categories[idx];
		var folders = jsonConfigSave[category].configured;

		// for each element
		for (var i=0; i<folders.length; i++) {
			var folder = folders[i];
			for (var pdx in folderProps) {
				var folderProp = folderProps[pdx];
			
				// don't reset syncKey
				if (this.keepSyncKeyOnSave == true && folderProp == 'syncKey')
					continue;
				
				if (folder.hasOwnProperty(folderProp))
					folder[folderProp] = undefined;
			}
		}
	}

	// write
	// data in thunderbird config
	var prefs = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService);
	prefs = prefs.getBranch("extensions.ttine.");

	prefs.setCharPref('jsonSyncConfig', JSON.stringify(jsonConfigSave));
  },

  mergeSyncConfig: function(newSyncConfig, connectModified, passwordChanged) {
	devTools.enter('config', 'mergeSyncConfig', 'conn: ' + connectModified + ', pwd: ' + passwordChanged);

	if (passwordChanged == true)
		this.setPwd('');

	// re-read whole config
	if (connectModified == true) {
		this.jsonSyncConfig = null;
		this.read();
	}

	// merge with option dialog results
	this.mergeFolders(newSyncConfig.folders);
	for (var idx in this.categories)
		this.mergeSyncConfigByCategory(this.categories[idx], newSyncConfig[this.categories[idx]].configured);
	if (newSyncConfig.missingCalendarNotified != undefined)
		this.getSyncConfig().missingCalendarNotified = newSyncConfig.missingCalendarNotified; 

	// default options
	// data in thunderbird config
	var prefs = Components.classes['@mozilla.org/preferences-service;1'].
			getService(Components.interfaces.nsIPrefService);
	prefs = prefs.getBranch('extensions.ttine.');

	this.fullSilence = prefs.getBoolPref('fullSilence');
	this.keepSyncKeyOnSave = prefs.getBoolPref('keepSyncKeyOnSave');
	
	this.saveSyncConfig();
	devTools.leave('config', 'mergeSyncConfig');
  },

  mergeSyncConfigByCategory: function(category, mergeSyncConfig) {
	var syncConfig = this.getSyncConfig();
	var cnt = mergeSyncConfig.length;

	// handle new/modified configs
	for (var i=0; i<cnt; i++) {
		var abSyncConfig = this.getSyncConfigByCategoryUri(category, mergeSyncConfig[i].local);

		// add new config
		if (abSyncConfig == null) {
			abSyncConfig = this.addSyncConfigByCategory(category, mergeSyncConfig[i].local, mergeSyncConfig[i].remote);
			syncConfig.lastMergeAddedNewConfigs = true;
		// replace config (incl. reset syncKey & syncStatus)
		} else { 
			if (abSyncConfig.remote != mergeSyncConfig[i].remote) {
				abSyncConfig.remote = mergeSyncConfig[i].remote;
				abSyncConfig.syncKey = undefined;
				abSyncConfig.syncStatus = undefined;
			}
		}
	}
	// handle removed configs
	var i = 0, reinitCnt = 0, deleteData = false;
	while (syncConfig[category].configured.length > i) {
		var found = false;
		for (var j=0; j<mergeSyncConfig.length; j++) {
			if (mergeSyncConfig[j].local == syncConfig[category].configured[i].local) {
				found = true;
				break;
			}
		}

		if (found)
			i += 1;
		else {
			if (reinitCnt == 0)
				deleteData = helper.askYesNo(ttine.strings.getString('reinitializeFolder'));

			switch (category) {
				case 'contacts':
					ttineAb.doClearExtraFields(syncConfig[category].configured[i].local, deleteData);
					reinitCnt += 1;
					break;
				case 'calendars':
					ttineCal.doClearExtraFields( { 'local': syncConfig[category].configured[i].local, 'deleteData': deleteData } );
					reinitCnt += 1;
					break;
			}
			syncConfig[category].configured.splice(i, 1);
		}
	}
  },

  localCheckConfigs: function (syncConfig) {
	var forceSave = false;

	for (var idx in this.categories) {
		var category = this.categories[idx];
		var i = 0;
		while (syncConfig[category].configured.length > i) {
			var uri = syncConfig[category].configured[i].local;
			if ((category == 'contacts' && this.getAbByUri(uri) == null) ||
				(category == 'calendars' && this.getCalByUri(uri) == null)) {
				devTools.writeMsg('config', 'localCheckConfigs', 'remove ' + category + ': ' + syncConfig[category].configured[i].local);
				syncConfig[category].configured.splice(i, 1);
				forceSave = true;
			} else
				i += 1;
		}
	}
	
	return forceSave;
  },

  remoteCheckConfigs: function (syncConfig) {
	var forceSave = false;
	for (var idx in this.categories) {
		var category = this.categories[idx];
		var i = 0;
		while (syncConfig[category].configured.length > i) {
			if (config.getFolder(category, syncConfig[category].configured[i].remote) == null) {
				devTools.writeMsg('config', 'remoteCheckConfigs', 'remove ' + category + ': ' + syncConfig[category].configured[i].remote);
				syncConfig[category].configured.splice(i, 1);
				forceSave = true;
			} else
				i += 1;
		}
	}
	
	return forceSave;
  },

  initFolders: function(syncConfig) {
	if (syncConfig == undefined)
		syncConfig = this.getSyncConfig();
	
	if (syncConfig.folders == undefined) {
		syncConfig.folders = { };
		syncConfig.folders.syncKey = undefined;
		syncConfig.folders.contacts = [];
		syncConfig.folders.calendars = [];
		syncConfig.folders.tasks = [];
	}
  },

  getFolder: function(folderType, remoteId) {
	var folderTypes = this.categories;
	var result = null;

	outerLoop:
	for (var idx in folderTypes) {
		if (folderType != undefined && folderTypes[idx] != folderType)
			continue;

		var folders = this.getFolders(folderTypes[idx]);
		for (var i=0; i<folders.length; i++) {
			if (folders[i].id == remoteId) {
				result = folders[i];
				break outerLoop;
			}
		}
	}

	return result;
  },

  getFolders: function(folderType) {
	var syncConfig = this.getSyncConfig();

	if (syncConfig.folders == undefined)
		this.initFolders(syncConfig);

	if (folderType != undefined)
		return (syncConfig.folders[folderType] != undefined ? syncConfig.folders[folderType] : null);

	return syncConfig.folders; // return the whole object
  },

  folderSortFunction: function(a, b) {
	if (a.name > b.name || (a.name == b.name && a.id > b.id))
		return 1;
	if (a.name < b.name || (a.name == b.name && a.id < b.id))
		return -1;

	return 0;
  },

  addFolder: function(type, folder) {
	var folders = this.getFolders(type);

	if (folders != null) {
		for (var i=0; i<folders.length; i++) {
			if (folders[i].id == folder.id) {
				folders[i] = folder;
				return null;
			}
		}

		folders.push(folder);
	}

	return null;
  },

  removeFolder: function(folderId) {
    //devTools.leave('config', 'removeFolder', 'folder ' + folderId);
	var folderTypes = this.categories;

	for (var idx in folderTypes) {
		var folderType = folderTypes[idx];
		var folders = this.getFolders(folderType);
		//devTools.writeMsg('config', 'removeFolder', 'folderType ' + folderType + ' ' + folders.length);

		var cnt = folders.length;
		for (var i=0; i<cnt; i++) {
			if (folders[i].id == folderId) {
				folders.splice(i, 1);
				devTools.leave('config', 'removeFolder', 'id: ' + folderId);
				return true;
			}
		}
	}

	//devTools.leave('config', 'removeFolder', 'folders: contacts ' + folders.contacts.length + ', calendars '+ folders.calendars.length + ', tasks '+ folders.tasks.length);
	return false;
  },

  mergeFolders: function(paramNewFolders) {
	var folderTypes = this.categories;

	for (var idx in folderTypes) {
		var folderType = folderTypes[idx];
		var folders = this.getFolders(folderType);
		var newFolders = paramNewFolders[folderType];

		if (newFolders != undefined) {
			var cnt = newFolders.length; 

			// add or update
			for (var i=0; i<cnt; i++) {
				var j=0;
				while (folders.length > j) {
					// update existing
					if (folders[j].id == newFolders[i].id) {
						folders[j].name = newFolders[i].name;
						break;
					}
					j += 1;
				}

				// not found, add
				if (j == folders.length)
					folders.push(JSON.parse(JSON.stringify(newFolders[i])));
			}
			// delete
			var i = 0;
			while (folders.length > i) {
				var j = 0;
				while (newFolders.length > j) {
					if (newFolders[j].id == folders[i].id) {
						break;
					}
					j += 1;
				}

				// found
				if (j < newFolders.length)
					i += 1;
				// not found
				else
					folders.splice(i, 1);
			}
		}
	}
	folders = this.getFolders();
	folders.syncKey = paramNewFolders.syncKey;

	devTools.leave('config', 'mergeFolders', 'folders: syncKey ' + folders.syncKey + ', contacts ' + folders.contacts.length + ', calendars '+ folders.calendars.length + ', tasks '+ folders.tasks.length);
  },

  parseJSONFromString: function (jsonString) {
	var result = null;

	if (jsonString == undefined || jsonString == null || jsonString == '')
		return result;

	try {
		result = JSON.parse(jsonString);
	} catch (e) {
		//devTools.writeMsg('config', 'parseJSONFromString', e + ' ' + jsonString);
		;
	}

	return result;
  },

  minimumConfig: function() {
	return (config.url != '' && config.user != '' && config.deviceId != '');
  }

};
