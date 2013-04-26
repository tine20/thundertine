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

	my_id : "thundertine@santa.noel",
	user : '',
	pwdCache : '',

	jsonSyncConfig: null,

	picDir : 'Photos',

	read : function() {
		// data in thunderbird config
		var prefs = Components.classes["@mozilla.org/preferences-service;1"]
				.getService(Components.interfaces.nsIPrefService);
		prefs = prefs.getBranch("extensions.ttine.");
		/*
		 * IMPORTANT: If extension is loaded the very first time a unique id is
		 * required!
		 */
		if (prefs.getCharPref("deviceId") == '') {
			prefs.setCharPref("deviceId", (new Date()).getTime());
		}
		config.user = prefs.getCharPref("user");
		config.deviceId = prefs.getCharPref("deviceId");
		config.deviceType = (prefs.getBoolPref('iPhone') ? 'iPhone'
				: 'ThunderTine');
		config.url = (prefs.getBoolPref('hostSsl') ? 'https://' : 'http://')
				+ prefs.getCharPref('host') + '/Microsoft-Server-ActiveSync';
		config.interval = prefs.getIntPref("syncInterval") * 60 * 1000; // in
																		// milliseconds
		config.syncBeforeClose = prefs.getBoolPref('syncBeforeClose');
		config.checkFolderBefore = prefs.getBoolPref('checkFolderBefore');
		config.contactsLimitPictureSize = prefs
				.getBoolPref("contactsLimitPictureSize");
		config.fullSilence = prefs.getBoolPref("fullSilence");
		config.enableConsoleOutput = prefs.getBoolPref("enableConsoleOutput");
		config.jsonSyncConfig = this.getSyncConfig();

		// check for deleted abooks
		config.localAbsCheck(config.jsonSyncConfig);

		config.user = prefs.getCharPref("user");
		// passwd will be read via getPwd()
		this.initialized = true;

		// make sure there is a folder for Photos
		var dir = Components.classes["@mozilla.org/file/directory_service;1"]
				.getService(Components.interfaces.nsIProperties).get("ProfD",
						Components.interfaces.nsIFile);
		dir.append(this.picDir);
		if (!dir.exists() || !dir.isDirectory()) { // if it doesn't exist,
													// create
			dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, parseInt('0755', 8));
		}

		// make sure all important things are known
		return (config.url != '' && config.user != '' && config.deviceId != '');
	},

	getPwd : function() {
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

	setPwd : function(pwd) {
		config.pwdCache = pwd;
	},

	isConsoleOutputEnabled : function() {
		// data in thunderbird config
		var prefs = Components.classes["@mozilla.org/preferences-service;1"]
				.getService(Components.interfaces.nsIPrefService);
		prefs = prefs.getBranch("extensions.ttine.");

		config.enableConsoleOutput = prefs.getBoolPref("enableConsoleOutput");

		return config.enableConsoleOutput;
	},

	getAbs : function() {
		var result = Array();
		
		let abManager = Components.classes["@mozilla.org/abmanager;1"] 
			.getService(Components.interfaces.nsIAbManager);
		let allAddressBooks = abManager.directories;
		while (allAddressBooks.hasMoreElements()) {  
			let addressBook = allAddressBooks.getNext();
			if (addressBook instanceof Components.interfaces.nsIAbDirectory && 
				!addressBook.isRemote && !addressBook.isMailList && addressBook.fileName != 'history.mab') {
				result.push(addressBook);
			}
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

	getAbByName : function(aname) {
		var abs = this.getAbs();

		for (var i=0; i<abs.length; i++)  
			if (abs[i].dirName == aname)
				return abs[i];

		return null;
	},
		
	getAbByUri : function(auri) {
		var abs = this.getAbs();

		for (var i=0; i<abs.length; i++)  
			if (abs[i].URI == auri)
				return abs[i];

		return null;
	},
		
	getAbSyncConfigByABook : function(abook) {
		var syncConfig = this.getSyncConfig();

		for ( var i = 0; i < syncConfig.contacts.configured.length; i++) {
			if (syncConfig.contacts.configured[i].local == abook.URI) {
				return syncConfig.contacts.configured[i];
			}
		}
		return null;
	},
	
	getAbSyncConfigByUri : function(uri) {
		var syncConfig = this.getSyncConfig();

		for ( var i = 0; i < syncConfig.contacts.configured.length; i++) {
			if (syncConfig.contacts.configured[i].local == uri) {
				return syncConfig.contacts.configured[i];
			}
		}
		return null;
	},

	addAbSyncConfig : function(abook, srvdir) {
		var syncConfig = this.getSyncConfig();
		var result = {};
		
		result.local = abook;
		result.remote = srvdir;
		
		syncConfig.contacts.configured.push(result);
		
		return result;
	},

	mergeAbSyncConfig: function(abSyncConfigs) {
		var syncConfig = this.getSyncConfig();
		devTools.enter('config', 'mergeAbSyncConfig', 'contacts: current ' + syncConfig.contacts.configured.length + ', new ' + abSyncConfigs.length);
		var cnt = abSyncConfigs.length;
		
		// handle new/modified configs
		for (var i=0; i<cnt; i++) {
			var abSyncConfig = this.getAbSyncConfigByUri(abSyncConfigs[i].local);
			
			// add new config
			if (abSyncConfig == null) {
				abSyncConfig = this.addAbSyncConfig(abSyncConfigs[i].local, abSyncConfigs[i].remote);
				syncConfig.lastMergeAddedNewConfigs = true;
			// replace config (incl. reset syncKey & syncStatus)
			} else { 
				if (abSyncConfig.remote != abSyncConfigs[i].remote) {
					abSyncConfig.remote = abSyncConfigs[i].remote;
					abSyncConfig.syncKey = undefined;
					abSyncConfig.syncStatus = undefined;
				}
			}
		}
		// handle removed configs
		var i = 0;
		while (syncConfig.contacts.configured.length > i) {
			var found = false;
			devTools.writeMsg('config', 'mergeAbSyncConfig', 'check removed: ' + syncConfig.contacts.configured[i].local);
			for (var j=0; j<abSyncConfigs.length; j++) {
				if (abSyncConfigs[j].local == syncConfig.contacts.configured[i].local) {
					found = true;
					break;
				}
			}
			
			if (found)
				i += 1;
			else
				syncConfig.contacts.configured.splice(i, 1);
		}
		devTools.leave('config', 'mergeAbSyncConfig', 'contacts: ' + syncConfig.contacts.configured.length);
	},
	
	removeAbSyncConfig : function(abSyncConfig) {
		var syncConfig = this.getSyncConfig();

		// remove from configured array
		for (var i=0; i<syncConfig.contacts.configured.length; i++)
			if (syncConfig.contacts.configured[i].local == abSyncConfig.local && syncConfig.contacts.configured[i].remote == abSyncConfig.remote) {
				syncConfig.contacts.configured.splice(i, 1);
				break;
			}
	},
		
	getSyncConfig : function() {
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
		// folders
		if (jsonConfigSave.folders != undefined)
			jsonConfigSave.folders = undefined;
		// contacts
		for (var i=0; i<jsonConfigSave.contacts.configured.length; i++) {
			if (jsonConfigSave.contacts.configured[i].syncKey != undefined)
				jsonConfigSave.contacts.configured[i].syncKey = undefined;
			if (jsonConfigSave.contacts.configured[i].syncStatus != undefined)
				jsonConfigSave.contacts.configured[i].syncStatus = undefined;
			if (jsonConfigSave.contacts.configured[i].managedCards != undefined)
				jsonConfigSave.contacts.configured[i].managedCards = undefined;
		}
		// calendars
		for (var i=0; i<jsonConfigSave.calendars.configured.length; i++) {
			if (jsonConfigSave.calendars.configured[i].syncKey != undefined)
				jsonConfigSave.calendars.configured[i].syncKey = undefined;
			if (jsonConfigSave.calendars.configured[i].syncStatus != undefined)
				jsonConfigSave.calendars.configured[i].syncStatus = undefined;
			if (jsonConfigSave.calendars.configured[i].managedCards != undefined)
				jsonConfigSave.calendars.configured[i].managedCards = undefined;
		}
		// task
		for (var i=0; i<jsonConfigSave.tasks.configured.length; i++) {
			if (jsonConfigSave.tasks.configured[i].syncKey != undefined)
				jsonConfigSave.tasks.configured[i].syncKey = undefined;
			if (jsonConfigSave.tasks.configured[i].syncStatus != undefined)
				jsonConfigSave.tasks.configured[i].syncStatus = undefined;
			if (jsonConfigSave.tasks.configured[i].managedCards != undefined)
				jsonConfigSave.tasks.configured[i].managedCards = undefined;
		}
		
		// write
		// data in thunderbird config
		var prefs = Components.classes["@mozilla.org/preferences-service;1"]
				.getService(Components.interfaces.nsIPrefService);
		prefs = prefs.getBranch("extensions.ttine.");

		prefs.setCharPref('jsonSyncConfig', JSON.stringify(jsonConfigSave));
	},
	
	localAbsCheck: function (syncConfig) {
		devTools.writeMsg('config', 'localAbsCheck', 'abSyncConfigs: ' + syncConfig.contacts.configured.length);
		var i = 0;
		while (syncConfig.contacts.configured.length > i) {
			if (config.getAbByUri(syncConfig.contacts.configured[i].local) == null) {
				devTools.writeMsg('config', 'localAbsCheck', 'remove abSyncConfig: ' + syncConfig.contacts.configured[i].local);
				syncConfig.contacts.configured.splice(i, 1);
			} else
				i += 1;
		}
		devTools.writeMsg('config', 'localAbsCheck', 'abSyncConfigs: ' + syncConfig.contacts.configured.length);
	},
 
	remoteAbsCheck: function (syncConfig) {
		devTools.writeMsg('config', 'remoteAbsCheck', 'abSyncConfigs: ' + syncConfig.contacts.configured.length);
		var i = 0;
		while (syncConfig.contacts.configured.length > i) {
			if (config.getAbByUri(syncConfig.contacts.configured[i].local) == null) {
				devTools.writeMsg('config', 'remoteAbsCheck', 'remove abSyncConfig: ' + syncConfig.contacts.configured[i].local);
				syncConfig.contacts.configured.splice(i, 1);
			} else
				i += 1;
		}
		devTools.writeMsg('config', 'remoteAbsCheck', 'abSyncConfigs: ' + syncConfig.contacts.configured.length);
	},
 
	initFolders: function(syncConfig) {
		if (syncConfig.folders == undefined) {
			syncConfig.folders = { };
			syncConfig.folders.syncKey = undefined;
			syncConfig.folders.contacts = [];
			syncConfig.folders.calendars = [];
			syncConfig.folders.tasks = [];
		}
	},
	
	getFolders: function(folderType) {
		var syncConfig = this.getSyncConfig();

		if (syncConfig.folders == undefined)
			this.initFolders(syncConfig);
		
		if (folderType != undefined)
			switch (folderType) {
				case 'contacts':
					return syncConfig.folders.contacts.sort(this.folderSortFunction);
					break;
				case 'calendars':
					return syncConfig.folders.calendars.sort(this.folderSortFunction);
					break;
				case 'tasks':
					return syncConfig.folders.tasks.sort(this.folderSortFunction);
					break;
				default:
					return null;
					break;
			}

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
		var folders = this.getFolders();

		// contacts
		var subFolders = folders.contacts;
		var cnt = subFolders.length;
		for (var i=0; i<cnt; i++) {
			if (subFolders.id == folderId) {
				subFolders.splice(i, 1);
				return true;
			}
		}
		// calendars
		subFolders = folders.calendars;
		cnt = subFolders.length;
		for (var i=0; i<cnt; i++) {
			if (subFolders.id == folderId) {
				subFolders.splice(i, 1);
				return true;
			}
		}
		// tasks
		subFolders = folders.tasks;
		cnt = subFolders.length;
		for (var i=0; i<cnt; i++) {
			if (subFolders.id == folderId) {
				subFolders.splice(i, 1);
				return true;
			}
		}

		return false;
	},
	
	parseJSONFromString : function (jsonString) {
		var result = null;
		
		if (jsonString == null || jsonString == "")
			return result;
		
		try {
			result = JSON.parse(jsonString);
		} catch (e) {
			result = null;
			//devTools.writeMsg('config', 'parseJSONFromString', e + ' ' + jsonString);
		}
			
		return result;
	},
	
	minimumConfig : function() {
		if (config.url != '' && config.user != '')
			return true;
		else
			return false;
	}

}
