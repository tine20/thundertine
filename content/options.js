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

  // if under Windows Button Cancel is pressed, remember pwd and config
  var oldpwd = '';
  var timerId = null;

  var ttine = { }
  ttine.strings = window.opener.document.getElementById("ttine-strings");
	
  function onopen() {
	// read current config
	config.read();

	// override folders reference with global cached syncConfig folders
	config.getSyncConfig().folders = window.opener.config.getSyncConfig().folders;
	
	// get password and clear it in manager (to store it at close again)
	var passwordManager = Components.classes["@mozilla.org/login-manager;1"]
		.getService(Components.interfaces.nsILoginManager);
	var url = 
		(document.getElementById('hostSsl').checked ? 'https://' : 'http://') + 
		document.getElementById('host').value + '/Microsoft-Server-ActiveSync'; 
	var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
		Components.interfaces.nsILoginInfo, "init");
	var username = document.getElementById('user').value;
	if ( document.getElementById('host').value != '' && username != '') {
		var logins = passwordManager.findLogins({}, url, null, 'Tine 2.0 Active Sync');  
		for (var i = 0; i < logins.length; i++) { 
			if (logins[i].httpRealm == 'Tine 2.0 Active Sync') { 
				var loginInfo = new nsLoginInfo(
					url, null, 'Tine 2.0 Active Sync', document.getElementById('user').value, 
					logins[i].password, '', ''
				); 
				passwordManager.removeLogin(loginInfo);
				oldpwd = logins[i].password;
				document.getElementById('password').value = oldpwd; 
				config.setPwd('');
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
	First with true, sencond time with undefined!!
  */
  function onclose(ok) { 
	var result = false;
	
	// deny option dialog close, until folder sync is pending
	var folders = config.getFolders();
	if (folders.lastSyncDuration == undefined) {
		var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
        	.getService(Components.interfaces.nsIPromptService);

		promptService.alert(window, ttine.strings.getString("messageTitle"), ttine.strings.getString('foldersSyncPending'));
		return result;
	}
	
	// linux close button or Windows OK Button pressed
	if (document.getElementById('ThundertinePreferences').instantApply || ok) {
		result = true;
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
		if ( document.getElementById('host').value != '' && 
				document.getElementById('user').value != '' &&
			document.getElementById('password').value ) {
			passwordManager.addLogin(loginInfo);
			config.setPwd(document.getElementById('password').value);
			config.pwdChanged = (document.getElementById('password').value != oldpwd);
		}
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
		}
	}

	// apply modified syncConfig to callee (needs to be merged) 
	window.opener.ttine.optionsResultApplyCallback(result, JSON.parse(JSON.stringify(config)));
  }

  function localAbs() {
	  	var list = getContactsList();
	  	
		while (list.childNodes.length > 0) {
			if (list.lastChild.tagName == 'listitem')
				list.removeChild(list.lastChild);
			else
				break;
		}
		var addressbooks = config.getAbs();
		for (var i=0; i<addressbooks.length; i++)
			list.appendChild(newListItem(config.getAbSyncConfigByABook(addressbooks[i]), addressbooks[i].dirName, addressbooks[i].URI, '', ''));
  }
  
  function remoteFolders() {
	// overwrite connection settings
	config.url = (document.getElementById('hostSsl').checked ? 'https://' : 'http://') + 
		document.getElementById('host').value + '/Microsoft-Server-ActiveSync';
	config.user = document.getElementById('user').value;
	config.setPwd(document.getElementById('password').value);
	// show remote folders (empty if not synced yet)
	remoteFoldersFinish();
	
	// force syncing remote folders
	if (config.minimumConfig())
		sync.execute(Array('start', 'folderSync_Options', 'finish'));
  } 

  function remoteFoldersFinish() {
	// contacts
	folders = config.getFolders('contacts');
  	var list = getContactsList();

  	// add or update listitem
  	var cnt = folders.length;
  	for (var i=0; i<cnt; i++) {
  		var folder = folders[i];
  		var listItem = getContactsListItem(folder.id);

  		if (listItem != null) {
  			listItem.lastChild.setAttribute('label', folder.name);
  			listItem.lastChild.setAttribute('value', folder.id);
  		} else {
  			listItem = newListItem(null, '', '', folder.name, folder.id);
			list.appendChild(listItem);
  		}
  	}
  	// delete listitem
  	cnt = list.childNodes.length;
	for (var i=0; i<cnt; i++)
		if (list.childNodes[i].tagName == 'listitem') {
			var listItem = list.childNodes[i];
			var syncConfig = this.config.parseJSONFromString(listItem.value);
			var remote = listItem.lastChild.getAttribute('value');

			if (remote == undefined || remote == null || remote == '')
				continue;
			
			// found deleted folder
			if (remote != null && config.getFolder('contacts', remote) == null) {
				// deconfigure required
				if (syncConfig != null) {
					// toDo delete/re-init abook
					config.removeAbSyncConfig(syncConfig);
				}
				list.removeChild(listItem);
			}
		}
	return null;
  }

  function changeSyncConfig() {
		var list = getContactsList();
		var listItem = list.selectedItem;
		//var selectItems = Array();

		if (listItem == undefined)
			return;
		
		// re-init object
		var configOptions = { };
		switch (document.getElementById("ThundertinePreferences").currentPane.id) {
			case "paneThunderTineContacts":
				configOptions.category = "Addressbook";
				break;
			default:
				configOptions.category = null;
				break;
		}

		var syncConfig = this.config.parseJSONFromString(listItem.value);
		// new config
		if (syncConfig == null) {
			// emtpy Array
			configOptions.selectItems = Array();
			
			// local selected
			if (listItem.firstChild.getAttribute('label') != '') {
				//devTools.writeMsg('options', 'getContactsSelection', 'local target');
				configOptions.selectedItem = "{ \"label\": \"" + listItem.firstChild.getAttribute('label') + "\", \"value\": \"" + listItem.firstChild.getAttribute('value') + "\" }";
				configOptions.configure = 'local';
				for (var i=0; i<list.childNodes.length; i++) {
					if (list.childNodes[i].tagName == 'listitem' && list.childNodes[i].firstChild.getAttribute('label') == '') {
						configOptions.selectItems.push("{ \"label\": \"" + list.childNodes[i].lastChild.getAttribute('label') + "\", \"value\": \"" + list.childNodes[i].lastChild.getAttribute('value') + "\" }");
					}
				}
				dialog.open(configOptions);
			// remote selected
			} else {
				//devTools.writeMsg('options', 'getContactsSelection', 'remote target');
				configOptions.selectedItem = "{ \"label\": \"" + listItem.lastChild.getAttribute('label') + "\", \"value\": \"" + listItem.lastChild.getAttribute('value') + "\" }";
				configOptions.configure = 'remote';
				for (var i=0; i<list.childNodes.length; i++) {
					if (list.childNodes[i].tagName == 'listitem' && list.childNodes[i].lastChild.getAttribute('label') == '') {
						configOptions.selectItems.push("{ \"label\": \"" + list.childNodes[i].firstChild.getAttribute('label') + "\", \"value\": \"" + list.childNodes[i].firstChild.getAttribute('value') + "\" }");
					}
				}
				
				// open dialog with list
				if (configOptions.selectItems.length > 0)
					dialog.open(configOptions);
				else {
					var addedAb = null;
					
					if ((addedAb = newAb()) != null) {
						// toDo
					}
				}
					
			}
		// modify existing config
		} else {
			// delete syncConfig
			this.config.removeAbSyncConfig(syncConfig);
			
			// reinit addressbook
			
			// modify list
			var remoteName = listItem.lastChild.getAttribute('label'), remoteId = listItem.lastChild.getAttribute('value');
			var newItem = newListItem(null, '', '', remoteName, remoteId);
			var cnt = list.childNodes.length;
			var insertBeforeItem = null;
			// sort unconfigured remote folders
			for (var i=0; i<cnt; i++)
				if (list.childNodes[i].tagName == 'listitem' && 
					list.childNodes[i].value == '' &&
					(list.childNodes[i].lastChild.getAttribute('label') > remoteName ||
					(list.childNodes[i].lastChild.getAttribute('label') == remoteName && list.childNodes[i].lastChild.getAttribute('value') > remoteId)
				)) {
					insertBeforeItem = list.childNodes[i];
					break;
				}
			list.insertBefore(newItem, insertBeforeItem);
			
			modifyListItem(listItem, null
					, listItem.firstChild.getAttribute('label'), listItem.firstChild.getAttribute('value')
					, '', ''
			);
		}
  }
  
  function processUserSelection(selection) {
	  	//devTools.enter('options', 'processUserSelection', 'selection ' + selection);
		var list = getContactsList();
		var listItem = list.selectedItem;

		var syncConfig = this.config.parseJSONFromString(listItem.value);
		// new config
		if (syncConfig == null) {
			var newSyncConfig = null;
			var listItemMerge = {};
			
			// local selected
			if (listItem.firstChild.getAttribute('value') != '') {
				// step through unsynced remote nodes
				for (var i=0; i<list.childNodes.length; i++) {
					if (list.childNodes[i].tagName == 'listitem' && list.childNodes[i].firstChild.getAttribute('label') == '' && list.childNodes[i].lastChild.getAttribute('value') == selection) {
						//devTools.writeMsg('options', 'processUserSelection', 'local: ' + listItem.firstChild.getAttribute('label') + ' ' + list.childNodes[i].lastChild.getAttribute('label'));
						listItemMerge.localItem = listItem; 
						listItemMerge.remoteItem = list.childNodes[i];
						break;
					}
				}
			// remote selected
			} else {
				// step through unsynced local nodes
				for (var i=0; i<list.childNodes.length; i++) {
					if (list.childNodes[i].tagName == 'listitem' && list.childNodes[i].lastChild.getAttribute('label') == '' && list.childNodes[i].firstChild.getAttribute('value') == selection) {
						//devTools.writeMsg('options', 'processUserSelection', 'remote: ' + list.childNodes[i].firstChild.getAttribute('label') + ' ' + listItem.lastChild.getAttribute('label'));
						listItemMerge.localItem = list.childNodes[i];
						listItemMerge.remoteItem = listItem;
						break;
					}
				}
			}
			
			//devTools.writeMsg('options', 'processUserSelection', 'addAbSyncConfig');
			if ((newSyncConfig = this.config.addAbSyncConfig(listItemMerge.localItem.firstChild.getAttribute('value'), listItemMerge.remoteItem.lastChild.getAttribute('value'))) != null) {
				//devTools.writeMsg('options', 'processUserSelection', 'newSyncConfig ' + newSyncConfig);
				modifyListItem(listItemMerge.localItem, newSyncConfig
						, listItemMerge.localItem.firstChild.getAttribute('label'), listItemMerge.localItem.firstChild.getAttribute('value')
						, listItemMerge.remoteItem.lastChild.getAttribute('label'), listItemMerge.remoteItem.lastChild.getAttribute('value')
				);
				list.removeChild(listItemMerge.remoteItem);
			}
		// modify existing config
		} else {
			alert('ask deconfig');
		}

		//devTools.leave('options', 'processUserSelection');
  }
  
  function newAb(dontOpenDialog) {
	  var openDialog = (dontOpenDialog == true ? false : true);

	  if (openDialog)
		  window.openDialog("chrome://messenger/content/addressbook/abAddressBookNameDialog.xul", "", "chrome,modal,resizable=no,centerscreen", null);
	  
	  var list = getContactsList();

	  // search new book
	  var abs = this.config.getAbs();
	  for (var i=0; i<list.childNodes.length; i++) {
		  if (list.childNodes[i].tagName != 'listitem')
			  continue;
		  
		  // no more local abooks
		  if (list.childNodes[i].getAttribute('value') == null)
			  break;
		  
		  // remove known books from list
		  for (var j=0; j<abs.length; j++)
			  if (list.childNodes[i].firstChild.getAttribute('value') == abs[j].URI) {
				  abs = abs.slice(0,j).concat(abs.slice(j+1));
			  	  break;
			  }
	  }

	  // no new abook
	  if (abs.length == 0)
		  return null;

	  // return abook if only one new was found
	  var result = (abs.length == 1 ? abs[0] : null);
	  
	  // add new books to list
	  while (abs.length > 0) {
		  var idx = -1, found = false;

		  for (var i=0; i<list.childNodes.length; i++) {
			  if (list.childNodes[i].tagName != 'listitem')
				  continue;

			  // no more local abooks
			  if (list.childNodes[i].firstChild.getAttribute('label') == '')
				  idx = i+1;
			  // local abooks sorted by name
			  else if (list.childNodes[i].firstChild.getAttribute('label') > abs[0].dirName)
					  idx = i;
			  // local abooks equal name sorted by uri
			  else if (list.childNodes[i].firstChild.getAttribute('label') == abs[0].dirName && list.childNodes[i].firstChild.getAttribute('value') > abs[0].URI)
				  idx = i;
		  	 
			  if (idx >= 0) {
				  //devTools.writeMsg('options', 'newAb', 'adding: ' + abs[0].dirName + ' ' + (idx+1) + '/' + list.childNodes.length);
				  list.insertBefore(newListItem(null, abs[0].dirName, abs[0].URI, '', ''), (list.childNodes.length > idx ? list.childNodes[idx] : null));
				  abs = abs.slice(1);
				  found = true;
				  break;
			  }
		  }
		  // prevent endless loop
		  if (!found) {
			  alert('options.newAb: oops! didn\'t found position');
			  break;
		  }
	  }
	  
	  return result;
  }

  function reInit() {
	switch (document.getElementById("ThundertinePreferences").currentPane.id) {
		case "paneThunderTineContacts":
			  var list = getContactsList();
			  var listItem = list.selectedItem;
			  
			  this.reInitAb(listItem.firstChild.getAttribute('value'));
			break;
	}
  }
  
  function reInitAb(auri) {
		if (helper.ask(ttine.strings.getString('reinitializeFolder')))
			ab.doClearExtraFields(auri);
  }
  
  function onListBoxSelection()
  {
		var list = getContactsList();
		var listItem = list.selectedItem;

		var bSync = document.getElementById('toggleSync');
		var bReInit = document.getElementById('reinitSync');

		bSync.disabled = bReInit.disabled = (listItem == null);
		if (listItem == null)
			return;
		
		// unconfigured local addressbook
		bReInit.disabled = !(listItem.firstChild.getAttribute('label') != '' && listItem.value == ''); 
  }

// private helper functions
  function getContactsList() {
	  return document.getElementById('localContactsFolderMultiple');
  }
  
  function getContactsListItem(remoteId) {
		var list = getContactsList();
		var result = null;
		
		var cnt = list.childNodes.length;
		for (var i=0; i<cnt; i++)
			if (list.childNodes[i].tagName == 'listitem') {
				var listItem = list.childNodes[i];
				var syncConfig = this.config.parseJSONFromString(listItem.value);
				// known config or listed remote folder 
				if ((syncConfig != null ? syncConfig.remote : listItem.lastChild.getAttribute('value')) == remoteId) {
					result = listItem;
					break;
				}
			}

//		devTools.writeMsg('options', 'getContactsListItem', 'remoteId: ' + remoteId + ', result: ' + result + (result != null ? ' ' + result.value : ''));
		return result;
  }

  function newListItem(config, lLabel, lValue, rLabel, rValue) {
		var ab = document.createElement('listitem');
		
		if (config != null)
			ab.setAttribute('value', JSON.stringify(config));
		
		var lc = ab.appendChild(document.createElement('listcell'));
		lc.setAttribute('label', lLabel);
		if (lValue != '')
			lc.setAttribute('value', lValue);
		
		lc = ab.appendChild(document.createElement('listcell'));
		if (config != null)
			lc.setAttribute('label', 'ja');

		lc = ab.appendChild(document.createElement('listcell'));
		lc.setAttribute('label', rLabel);
		if (rValue != '')
			lc.setAttribute('value', rValue);
		
		return ab;
  }

  function modifyListItem(listItem, config, lLabel, lValue, rLabel, rValue) {
		var ab = listItem;
	
		ab.setAttribute('value', (config != null ? JSON.stringify(config) : ''));
		
		var lc = ab.childNodes[0];
		lc.setAttribute('label', lLabel);
		lc.setAttribute('value', (lValue != '' ? lValue : null));
		
		lc = ab.childNodes[1];
		lc.setAttribute('label', (config != null ? 'ja' : ''));

		lc = ab.childNodes[2];
		lc.setAttribute('label', rLabel);
		lc.setAttribute('value', (rValue != '' ? rValue : null));
		
		// button state
		onListBoxSelection();
  }
