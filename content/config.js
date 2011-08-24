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

  my_id: "thundertine@santa.noel",
  user: '',
  pwd: '',

  // remote folder Id -> SyncKey of folders to be synced
  contactsSyncKey: {},

  // remote folders  
  folderSyncKey: 0, 
  folderIds: [], 
  folderNames: [], 
  folderTypes: [],

  // remote folder Id -> local addressbook URI
  contactsFolder: {},

  picDir: 'Photos', 

  // local addressbook URI -> Arrays with TineSyncId of contacts to track deleted cards
  managedCards: {},
  
  // debug flag
  debug: false,

  write: function() {
	/*
	 * all preferences which are not subject to change with every sync are in   
	 * the thunderbird preferences and can only be edited within options dialog
	 */
	 
    /* State saved in <profiledir>/thundertine.json file:
     *
     * {"contactsSyncKey": {RemoteFolderId: ContactsSyncKey,
     *                      RemoteFolderId: ContactsSyncKey,
     *                      ...
     *                     },
     *  "folderSyncKey":   FolderSyncKey,
     *  "folderIds":       [RemoteFolderId, RemoteFolderId, ...],
     *  "folderNames":     [RemoteFolderName, RemoteFolderName, ...],
     *  "folderTypes":     [RemoteFolderType, RemoteFolderType, ...],
     *  "contactsFolder":  {RemoteFolderId: localAddressBookURI,
     *                      RemoteFolderId: localAddressBookURI,
     *                      ...
     *                     },
     *  "managedCards":    {localAddressBookURI: [TineSyncId, TineSyncId, ...],
     *                      localAddressBookURI: [TineSyncId, TineSyncId, ...],
     *                      ...
     *                     }
     * }
	 */

	var doc = {
		'contactsSyncKey': this.contactsSyncKey,
		'folderSyncKey':   this.folderSyncKey,
		'folderIds':       this.folderIds,
		'folderNames' :    this.folderNames,
		'folderTypes' :    this.folderTypes,
		'contactsFolder':  this.contactsFolder,
		'managedCards':    this.managedCards
	};
	//helper.debugOut("config.write(): "+JSON.stringify(doc)+"\n");
	helper.debugOut("config.write()\n");

	helper.writefile("thundertine.json", JSON.stringify(doc));
  }, 

  read: function() { 
	// data in thunderbird config
	var prefs = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService);
	prefs = prefs.getBranch("extensions.ttine.");
	/*
	 * IMPORTANT: If extension is loaded the very first time a unique id is required!
	 */
	if (prefs.getCharPref("deviceId") == '') {
		prefs.setCharPref("deviceId", (new Date()).getTime());
	}
	config.user = prefs.getCharPref("user");
	config.deviceId = prefs.getCharPref("deviceId");
	config.deviceType = (prefs.getBoolPref('iPhone')? 'iPhone' : 'ThunderTine');
	config.url = (prefs.getBoolPref('hostSsl')? 'https://' : 'http://') + prefs.getCharPref('host') + '/Microsoft-Server-ActiveSync'; 
	config.interval = prefs.getIntPref("syncInterval") * 60 * 1000; // in milliseconds
	config.syncBeforeClose = prefs.getBoolPref('syncBeforeClose');
	config.checkFolderBefore = prefs.getBoolPref('checkFolderBefore');
	//config.contactsLocalFolder = prefs.getCharPref("contactsLocalFolder");
	//config.contactsRemoteFolder = prefs.getCharPref("contactsRemoteFolder");
	config.contactsLimitPictureSize = prefs.getBoolPref("contactsLimitPictureSize");
    config.fullSilence = prefs.getBoolPref("fullSilence");
    config.debug = prefs.getBoolPref("debug");
	// get password
	var passwordManager = Components.classes["@mozilla.org/login-manager;1"]
		.getService(Components.interfaces.nsILoginManager);
	var username = config.user = prefs.getCharPref("user");
	if ( prefs.getCharPref('host') != '' && username != '') {
		var i, logins = passwordManager.findLogins({}, config.url, null, 'Tine 2.0 Active Sync');  
		for (i = 0; i < logins.length; i++) { 
			if (logins[i].username == username) {
				config.pwd = logins[i].password;
			    this.initialized = true;
				break;
			}
		}
	}

	// data in file
	var doc, data = helper.readfile("thundertine.json");
	if (!data) {
		return false;
	}
	try {
		doc = JSON.parse(data);
	} catch(e) {
		return false;
	}
	//helper.debugOut("config.read(): "+JSON.stringify(doc)+"\n");
	helper.debugOut("config.read()\n");

	this.contactsSyncKey = doc.contactsSyncKey;
	this.folderSyncKey   = doc.folderSyncKey;
	this.folderIds       = doc.folderIds;
	this.folderNames     = doc.folderNames;
	this.folderTypes     = doc.folderTypes;
	this.contactsFolder  = doc.contactsFolder;
	this.managedCards    = doc.managedCards;
	
	// make sure there is a folder for Photos
	var dir = Components.classes["@mozilla.org/file/directory_service;1"]
		.getService(Components.interfaces.nsIProperties)
		.get("ProfD", Components.interfaces.nsIFile);
	dir.append(this.picDir);
	if( !dir.exists() || !dir.isDirectory() ) {   // if it doesn't exist, create
		dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
	}
  }, 

  minimumConfig: function() {
	return config.url != '' && config.user != '';
  }

};
