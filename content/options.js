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

  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
  		.getService(Components.interfaces.nsIPrefService);
  prefs = prefs.getBranch("extensions.ttine.");

  var deviceId = prefs.getCharPref('deviceId');

  // if under Windows Button Cancel is pressed, remember pwd and config
  var oldpwd = '';

  var ttine = { };
  ttine.strings = window.opener.document.getElementById("ttine-strings");

  function onopen() {
    config.read(); 		// this is needed, because the thunderbirdOptions.xul windows is in a different javascript scope!
	// get password and clear it in manager (to store it at close again)
	var passwordManager = Components.classes["@mozilla.org/login-manager;1"]
		.getService(Components.interfaces.nsILoginManager);
	var url = 
		(document.getElementById('hostSsl').checked ? 'https://' : 'http://') + 
		document.getElementById('host').value + '/Microsoft-Server-ActiveSync'; 
	var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
		Components.interfaces.nsILoginInfo, "init");
	var username = document.getElementById('user').value;
	var i;
	if ( document.getElementById('host').value != '' && username != '') {
		var logins = passwordManager.findLogins({}, url, null, 'Tine 2.0 Active Sync');  
		for (i = 0; i < logins.length; i++) { 
			if (logins[i].httpRealm == 'Tine 2.0 Active Sync') { 
				var loginInfo = new nsLoginInfo(
					url, null, 'Tine 2.0 Active Sync', document.getElementById('user').value, 
					logins[i].password, '', ''
				); 
				passwordManager.removeLogin(loginInfo); 
				document.getElementById('password').value = logins[i].password;
				oldpwd = logins[i].password;
				break;
			}
		}
	}
	// load contacts pane
	localAbs();
	remoteFolders();
  }
  
  /*
	@ok within MS Windows: true=="Button Ok", undefined=="Button Cancel" 
	Important: Closing PrefWindow will fire onclose twice, if "Button Ok" is pressed. 
	First with true, second time with undefined!!
  */
  function onclose(ok) {

	// linux close button or Windows OK Button pressed
	if (document.getElementById('ThundertinePreferences').instantApply || ok) { 
		var passwordManager = Components.classes["@mozilla.org/login-manager;1"]
			.getService(Components.interfaces.nsILoginManager);
		var url = 
			(document.getElementById('hostSsl').checked ? 'https://' : 'http://') + 
			document.getElementById('host').value + '/Microsoft-Server-ActiveSync';
		var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
			Components.interfaces.nsILoginInfo, "init");
		var loginInfo = new nsLoginInfo(
			url, null, 'Tine 2.0 Active Sync', document.getElementById('user').value, 
			document.getElementById('password').value, '', ''
		);
		// if not empty -> store password
		if (document.getElementById('host').value != '' &&
			document.getElementById('user').value != '' &&
			document.getElementById('password').value ) {
			passwordManager.addLogin(loginInfo); 
		}
		// store (valid) folder settings

		// get local addressbooks
		var item, i, listbox, folderName, folderId, localAdressbook = {};
		var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
		var allAddressBooks = abManager.directories;
		while (allAddressBooks.hasMoreElements()) {  
			var addressBook = allAddressBooks.getNext();
			if (addressBook instanceof Components.interfaces.nsIAbDirectory && 
				!addressBook.isRemote && !addressBook.isMailList && addressBook.fileName != 'history.mab') {
				localAdressbook[addressBook.dirName] = addressBook.URI;
			}
		}

		// get remote folders
		config.localContactsFolder = {}
		listbox = document.getElementById('remoteContactsFolder');
		for (i=0; i<listbox.itemCount; i++) {
			item = listbox.getItemAtIndex(i);
			folderName = item.label;
			folderId = item.value;
			if (item.selected) {
				//helper.debugOut("selected item: folderName="+folderName+", folderId="+folderId+"\n");
				if (config.contactsSyncKey[folderId]===undefined) {
					config.contactsSyncKey[folderId] = 0;                // set SyncKey=0 if the sync relationship is new
				}
				// SyncKey of the folder is defined!
				if (localAdressbook[folderName]===undefined) {
					helper.debugOut("local address book '"+folderName+"' is missing. Can't sync this folder.\n");
					helper.prompt("Local address book '"+folderName+"' is missing. Can't sync this folder.\n\nPlease add the address book manually.");
					delete config.contactsSyncKey[folderId];			// do not sync this folder
				} else {
					// save sync relationship: folderID, URI
					helper.debugOut("connect: folderName='"+folderName+"', folderId='"+folderId+"', URI='"+localAdressbook[folderName]+"'\n");
					config.contactsFolder[folderId] = localAdressbook[folderName];
				}
			} else {
				// no longer connected, remove metadata (if there is any)
				helper.debugOut("disconnect: folderName='"+folderName+"', folderId='"+folderId+"', URI='"+localAdressbook[folderName]+"'\n");
				delete config.contactsSyncKey[folderId];				// remove the SyncKey of this contacts folder
				delete config.contactsFolder[folderId];					// remove the relationship to the local address book
				if (folderName && localAdressbook[folderName]) {
					delete config.managedCards[localAdressbook[folderName]];	// remove the list of managed cards of this local address book
					ab.doClearExtraFields(localAdressbook[folderName]);			// remove TineSyncId and TineSyncMD5 fields
				}
			}
		}
		// save new settings
		config.write();
	}
	// Windows cancel pressed -> remember old password and settings
	else if (ok==false) {
		if (oldpwd != '') { 
			var passwordManager = Components.classes["@mozilla.org/login-manager;1"]
				.getService(Components.interfaces.nsILoginManager);
			var url = 
				(prefs.getBoolPref('hostSsl') ? 'https://' : 'http://') + 
				prefs.getCharPref('host') + '/Microsoft-Server-ActiveSync';
			var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
				Components.interfaces.nsILoginInfo, "init");
			var loginInfo = new nsLoginInfo(
				url, null, 'Tine 2.0 Active Sync', prefs.getCharPref('user'), 
				oldpwd, '', ''
			); 
			passwordManager.addLogin(loginInfo);
			oldpwd = ''; // prevent saving password twice
		}
		// reload old settings
		config.read();
	}
  }

  function localAbs() {
	var listbox = document.getElementById('localContactsFolder');
	while (listbox.itemCount>0) {
		listbox.removeItemAt(0);
	}
	var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
	var allAddressBooks = abManager.directories;
	while (allAddressBooks.hasMoreElements()) {  
		var addressBook = allAddressBooks.getNext();
		if (addressBook instanceof Components.interfaces.nsIAbDirectory && 
			!addressBook.isRemote && !addressBook.isMailList && addressBook.fileName != 'history.mab') {
			listbox.appendItem(addressBook.dirName, addressBook.URI);
		}
	}
  }

  // command handler
  function remoteFolders() { 
	helper.debugOut("remoteFolders()\n");
	while (document.getElementById('remoteContactsFolder').children.length > 0) {
		document.getElementById('remoteContactsFolder').removeChild(document.getElementById('remoteContactsFolder').firstChild);
	}
	config.url = (document.getElementById('hostSsl').checked ? 'https://' : 'http://') + 
		document.getElementById('host').value + '/Microsoft-Server-ActiveSync';
	config.deviceType = (document.getElementById('iPhone').checked? 'iPhone' : 'ThunderTine');
	config.user = document.getElementById('user').value;
	config.pwd = document.getElementById('password').value;
	config.deviceId = deviceId; 
	config.folderSyncKey = 0;
	if (config.minimumConfig()) {
		sync.execute( ['start', 'folderSync_Options', 'finish'] );
	}
  } 

  function remoteFoldersFinish() {
	helper.debugOut("remoteFoldersFinish()\n");
	var remoteIds = folder.listFolderIds('Contacts'); 
	var remoteNames = folder.listFolderNames('Contacts'); 
	var listbox = document.getElementById('remoteContactsFolder');
	listbox.clearSelection();
	for (var i = 0; i < remoteNames.length; i++) {
		var ab = listbox.appendItem(remoteNames[i], remoteIds[i]);
		if (config.contactsSyncKey[remoteIds[i]]!==undefined) {
			listbox.ensureIndexIsVisible(listbox.getIndexOfItem(ab));
		    listbox.addItemToSelection(ab);
		}
	}
	listbox.focus();
  }

  // command handler
  function newAb() {
	window.openDialog("chrome://messenger/content/addressbook/abAddressBookNameDialog.xul", "", "chrome,modal=yes,resizable=no,centerscreen", null);
	localAbs();
  }

  // command handler
  function reInit() {
	if (helper.ask(ttine.strings.getString('reinitializeFolder'))) {
		var listbox = document.getElementById('localContactsFolder')
		helper.debugOut("options.reInit(): addressbook="+listbox.value+"\n");
		ab.doClearExtraFields(listbox.value);
	}
  }


