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

  var ttine = { };
  ttine.strings = window.opener.document.getElementById("ttine-strings");
	
  function onopen() {
	// read current config
	config.read();

	// clone current config
	config.jsonSyncConfig = JSON.parse(JSON.stringify(window.opener.config.getSyncConfig()));
	
	checkConnectionStatus();
	
	// get password and clear it in manager (to store it at close again)
	var passwordManager = Components.classes["@mozilla.org/login-manager;1"]
		.getService(Components.interfaces.nsILoginManager);
	var url = 
		(document.getElementById('hostSsl').checked ? 'https://' : 'http://') + 
		document.getElementById('host').value + config.urlSuffix; 
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
	
	// load local and remote data
	localAbs();
	localCals();
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
	
	if (folder.isResponsePending(folders) == true) {
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
			document.getElementById('host').value + config.urlSuffix;
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
				prefs.getCharPref('host') + config.urlSuffix;
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
	
	return true;
  }

  function onListBoxContextMenu(event) {
  	var open = false;
	// deny popup open, until folder sync is pending
	var folders = config.getFolders();
	
	if (folder.isResponsePending(folders) == true)
		return open;

	var category = selectedCategory();
	if ((category == 'calendars' || category == 'tasks') && !config.isCalendarAccessible())
		return open;
	
	var list = getListByCategory(category);
  	var listItem = list.selectedItem;

  	if (listItem != undefined) {
  	  	var isLocal = (listItem.firstChild.getAttribute('label') != '');
  	  	var isRemote = (listItem.lastChild.getAttribute('label') != '');
  	  	var isConfigured = (listItem.value != '');
  	  	
  		document.getElementById('cmRemoteDelete').hidden = !(isRemote && !isConfigured);
  		document.getElementById('cmRemoteUpdate').hidden = !(isRemote);

  		open = (isLocal  == true || isRemote == true);
  	}
  	
  	document.getElementById('cmRemoteRefresh').hidden = false;
  	document.getElementById('cmRemoteCreate').hidden = false;
  	
	return open;
  }
  
  function onListBoxSelection(disabled)
  {
		var buttons = {};
		buttons.contacts = {};
		buttons.contacts.config = document.getElementById('toggleSyncContacts');
		buttons.contacts.reinit = document.getElementById('reinitSyncContacts');
		buttons.calendars = {};
		buttons.calendars.config = document.getElementById('toggleSyncCalendars');
		buttons.calendars.reinit = document.getElementById('reinitSyncCalendars');
		buttons.tasks = {};
		buttons.tasks.config = document.getElementById('toggleSyncTasks');
		buttons.tasks.reinit = document.getElementById('reinitSyncTasks');

		var folders = config.getFolders();
		var disableAll = (folder.isResponsePending(folders) == true || (typeof disabled == 'boolean' && disabled == true));
		
		for (var idx in config.categories) {
			var category = config.categories[idx];
			var list = getListByCategory(category);
			var listItem = list.selectedItem;

			// disable all
			buttons[category].config.disabled = buttons[category].reinit.disabled = true;

			if ((category == 'calendars' || category == 'tasks') && !config.isCalendarAccessible())
				continue;
			
			// selective turn on
			if (disableAll == false && listItem != null) {
				buttons[category].config.disabled = false;
				buttons[category].reinit.disabled = !(listItem.firstChild.getAttribute('label') != '' && listItem.value == '');
			}
		}
  }
  
  function localAbs() {
	  	var category = 'contacts';
	  	var list = getListByCategory(category);
	  	
		while (list.childNodes.length > 0) {
			if (list.lastChild.tagName == 'listitem')
				list.removeChild(list.lastChild);
			else
				break;
		}
		var addressbooks = config.getAbs();
		for (var i=0; i<addressbooks.length; i++) {
			var abook = addressbooks[i];
			list.appendChild(newListItem(config.getSyncConfigByCategoryUri(category, abook.URI), abook.dirName, abook.URI, '', ''));
		}
  }
  
  function localCals(category) {
	  
	  	if (category == undefined) {
	  		localCals('calendars');
	  		localCals('tasks');
	  	} else {
		  	var list = getListByCategory(category);
		  	
			while (list.childNodes.length > 0) {
				if (list.lastChild.tagName == 'listitem')
					list.removeChild(list.lastChild);
				else
					break;
			}
			var calendars = config.getCals();
			for (var i=0; i<calendars.length; i++) {
				var cal = calendars[i];
				list.appendChild(newListItem(config.getSyncConfigByCategoryUri(category, cal.URI), cal.dirName, cal.URI, '', ''));
			}
  		}
  }

  function createRemoteFolder() {
	overwriteConnectionSettings();

	var name = {};
	name.value = '';

	if (helper.promptInput('Verzeichnis-Name', name) == true && name.value != '') {
		// force syncing remote folders
		if (config.minimumConfig()) {
			var category = selectedCategory();
			if (folder.createFolder('0', folder.serverTypeForCategory(category), name.value, 'y') == true) {
				statusBar('working');
				sync.execute(Array('folderAction'));
			}
		}
	}
  } 

  function renameRemoteFolder() {
	overwriteConnectionSettings();

	var category = selectedCategory();
	var list = getListByCategory(category);
	var listItem = list.selectedItem;
	var rf = config.getFolder(category, listItem.lastChild.getAttribute('value'));

	if (rf == null)
		return false;
	
	var name = {};
	name.value = rf.name;

	if (helper.promptInput('Verzeichnis-Name', name) == true && name.value != '') {
		// force syncing remote folders
		if (config.minimumConfig()) {
			if (folder.updateFolder(rf.id, (rf.parent != undefined ? rf.parent : '0'), name.value, 'y') == true) {
				statusBar('working');
				sync.execute(Array('folderAction'));
			}
		}
	}
	
	return true;
  }
  
  function removeRemoteFolder() {
	var category = selectedCategory();
	var list = getListByCategory(category);
	var listItem = list.selectedItem;
	  	
	overwriteConnectionSettings();
		
	// force syncing remote folders
	if (config.minimumConfig()) {
		if (folder.deleteFolder(listItem.lastChild.getAttribute('value'), 'y') == true)
			statusBar('working');
			sync.execute(Array('folderAction'));
	}
  } 

  function remoteFolders() {
	overwriteConnectionSettings();
		
	// show remote folders (empty if not synced yet)
	remoteFoldersFinish();
		
	// force syncing remote folders
	if (config.minimumConfig()) {
		if (folder.syncFolder('y') == true) {
			statusBar('working');
			sync.execute(Array('folderAction'));
		}
	}
  }

  function remoteFoldersFinish(err) {
  	// handle buttons
  	onListBoxSelection();
  	checkConnectionStatus(err);
  	
  	// check last err and send response (modify err object)
  	if (err != undefined && !config.isLastError('http', 200, err)) {
  		if (config.isLastError('http', 401, err)) {
//  			devTools.writeMsg('options', 'remoteFoldersFinish', 'err.dontPromptUser = true');
  			err.dontPromptUser = true;
  		}

  		statusBar('inactive');
  		return null;
  	}

  	// for all types
  	for (var idx in config.categories) {
  		var category = config.categories[idx];
		var folders = config.getFolders(category);
	  	var list = getListByCategory(category);
	
	  	// add or update listitem
	  	for (var i=0; i<folders.length; i++) {
	//  		devTools.writeMsg('options', 'remoteFoldersFinish', 'folders[' + i + '] "' + JSON.stringify(folders[i]) + '"');
	  		var folder = folders[i];
	  		var listItem = getListItemByCategory(category, folder.id);
	
	  		// add
	  		if (listItem != null) {
	  			listItem.lastChild.setAttribute('label', folder.name);
	  			listItem.lastChild.setAttribute('value', folder.id);
			// update
	  		} else {
				var newItem = newListItem(null, '', '', folder.name, folder.id);
				var cnt = list.childNodes.length;
				var insertBeforeItem = null;
				// sort unconfigured remote folders
				for (var j=0; j<cnt; j++) {
					if (list.childNodes[j].tagName == 'listitem' && 
						list.childNodes[j].value == '' &&
						(list.childNodes[j].lastChild.getAttribute('label') > folder.name ||
						(list.childNodes[j].lastChild.getAttribute('label') == folder.name && list.childNodes[j].lastChild.getAttribute('value') > folder.id)
					)) {
						insertBeforeItem = list.childNodes[j];
						break;
					}
				}
				list.insertBefore(newItem, insertBeforeItem);
	  		}
	  	}
	  	// delete listitem
		for (var i=0; i<list.childNodes.length; i++)
			if (list.childNodes[i].tagName == 'listitem') {
				var listItem = list.childNodes[i];
				var syncConfig = this.config.parseJSONFromString(listItem.value);
				var remote = listItem.lastChild.getAttribute('value');
	
				if (remote == undefined || remote == null || remote == '')
					continue;
				
				// found deleted folder
				if (remote != null && config.getFolder(category, remote) == null) {
					// deconfigure required
					if (syncConfig != null) {
						// toDo delete/re-init abook
						config.removeSyncConfigByCategory(category, syncConfig);
						listItem.value = undefined;
						modifyListItem(listItem, null
								, listItem.firstChild.getAttribute('label'), listItem.firstChild.getAttribute('value')
								, '', ''
						);
					} else
						list.removeChild(listItem);
				}
			}
  	}

	statusBar('icon');
	return null;
  }

  function selectedCategory() {
	var result = null;
	
	switch (document.getElementById("ThundertinePreferences").currentPane.id) {
		case "paneThunderTineContacts":
			result = 'contacts';
			break;
		case "paneThunderTineCalendars":
			result = 'calendars';
			break;
		case "paneThunderTineTasks":
			result = 'tasks';
			break;
	}

	return result;
  }
  
  function changeSyncConfig() {
	  	var category = selectedCategory();
		var list = getListByCategory(category);
		var listItem = list.selectedItem;
		//var selectItems = Array();

		if (listItem == undefined)
			return;
		
		// re-init object
		var configOptions = { };
		configOptions.category = category;

		var syncConfig = this.config.parseJSONFromString(listItem.value);
		// new config
		if (syncConfig == null) {
			// emtpy Array
			configOptions.selectItems = Array();
			
			// local selected
			if (listItem.firstChild.getAttribute('label') != '') {
				devTools.writeMsg('options', 'getContactsSelection', 'local target');
				configOptions.selectedItem = "{ \"label\": \"" + listItem.firstChild.getAttribute('label') + "\", \"value\": \"" + listItem.firstChild.getAttribute('value') + "\" }";
				configOptions.configure = 'local';
				for (var i=0; i<list.childNodes.length; i++) {
					if (list.childNodes[i].tagName == 'listitem' && list.childNodes[i].firstChild.getAttribute('label') == '') {
						configOptions.selectItems.push("{ \"label\": \"" + list.childNodes[i].lastChild.getAttribute('label') + "\", \"value\": \"" + list.childNodes[i].lastChild.getAttribute('value') + "\" }");
					}
				}
				if (configOptions.selectItems.length > 0)
					dialog.open(configOptions);
				else {
					createRemoteFolder();
				}
			// remote selected
			} else {
				devTools.writeMsg('options', 'getContactsSelection', 'remote target');
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
					if (category == 'contacts') {
						var addedAb = null;
						
						if ((addedAb = newAb()) != null) {
							var abSyncConfig = config.addSyncConfigByCategory(category, addedAb.URI, listItem.lastChild.getAttribute('value'));
							modifyListItem(listItem, abSyncConfig
									, addedAb.dirName, addedAb.URI
									, listItem.lastChild.getAttribute('label'), listItem.lastChild.getAttribute('value')
							);
						}
					} else
						devTools.writeMsg('options', 'changeSyncConfig', 'not implemented yet!');
				}
					
			}
		// modify existing config
		} else {
			// delete syncConfig
			this.config.removeSyncConfigByCategory(category, syncConfig);
			
			// reinit addressbook
			
			// modify list
			var remoteName = listItem.lastChild.getAttribute('label'), remoteId = listItem.lastChild.getAttribute('value');
			var newItem = newListItem(null, '', '', remoteName, remoteId);
			var cnt = list.childNodes.length;
			var insertBeforeItem = null;
			// sort unconfigured remote folders
			for (var i=0; i<cnt; i++) {
				if (list.childNodes[i].tagName == 'listitem' && 
					list.childNodes[i].value == '' &&
					(list.childNodes[i].lastChild.getAttribute('label') > remoteName ||
					(list.childNodes[i].lastChild.getAttribute('label') == remoteName && list.childNodes[i].lastChild.getAttribute('value') > remoteId)
				)) {
					insertBeforeItem = list.childNodes[i];
					break;
				}
			}
			list.insertBefore(newItem, insertBeforeItem);
			
			modifyListItem(listItem, null
					, listItem.firstChild.getAttribute('label'), listItem.firstChild.getAttribute('value')
					, '', ''
			);
		}
  }
  
  function processUserSelection(category, selection) {
	  	//devTools.enter('options', 'processUserSelection', 'selection ' + selection);
//	  	var category = selectedCategory();
		var list = getListByCategory(category);
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
			
			//devTools.writeMsg('options', 'processUserSelection', 'addSyncConfigByCategory');
			if ((newSyncConfig = this.config.addSyncConfigByCategory(category, listItemMerge.localItem.firstChild.getAttribute('value'), listItemMerge.remoteItem.lastChild.getAttribute('value'))) != null) {
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
  
  function newAb(category, dontOpenDialog) {
	  var openDialog = (dontOpenDialog == true ? false : true);

	  if (openDialog) {
		  if (category == 'contacts')
			  window.openDialog("chrome://messenger/content/addressbook/abAddressBookNameDialog.xul", "", "chrome,modal,resizable=no,centerscreen", null);
		  if (category == 'calendars' || category == 'tasks')
				window.openDialog("chrome://calendar/content/calendarCreation.xul", "caEditServer", "chrome,titlebar,modal,centerscreen", null);
	  }
	  
	  var list = getListByCategory(category);

	  // search new book
	  var abs = null;
	  
	  if (category == 'contacts')
		  abs = this.config.getAbs();
	  if (category == 'calendars' || category == 'tasks')
		  abs = this.config.getCals();
	  
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
				  idx = i;
			  // local abooks sorted by name
			  else if (list.childNodes[i].firstChild.getAttribute('label') > abs[0].dirName)
					  idx = i;
			  // local abooks equal name sorted by uri
			  else if (list.childNodes[i].firstChild.getAttribute('label') == abs[0].dirName && list.childNodes[i].firstChild.getAttribute('value') > abs[0].URI)
				  idx = i;
		  	 
			  if (idx >= 0) {
				  //devTools.writeMsg('options', 'newAb', 'adding: ' + abs[0].dirName + ' ' + (idx+1) + '/' + list.childNodes.length);
				  // insert new listItem, if dialog was not opened from here 
				  if (openDialog == false)
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
	  alert('reInit nicht implementiert!');
  }
  
// private helper functions
  function getListByCategory(category) {
	  var result = null;
	  
	  switch(category) {
		  case 'contacts':
			  result = document.getElementById('localContactsFolderMultiple');
			  break;
		  case 'calendars':
			  result = document.getElementById('localCalendarsFolderMultiple');
			  break;
		  case 'tasks':
			  result = document.getElementById('localTasksFolderMultiple');
			  break;
	  }
	  
	  return result;
  }
  
  function getListItemByCategory(category, remoteId) {
		var list = getListByCategory(category);
		var result = null;
		
		var cnt = list.childNodes.length;
		for (var i=0; i<cnt; i++) {
			if (list.childNodes[i].tagName == 'listitem') {
				var listItem = list.childNodes[i];
				var syncConfig = this.config.parseJSONFromString(listItem.value);
				// known config or listed remote folder 
				if ((syncConfig != null ? syncConfig.remote : listItem.lastChild.getAttribute('value')) == remoteId) {
					result = listItem;
					break;
				}
			}
		}

		return result;
  }
  
  function getContactsList() {
	  return getListByCategory(config.categories[0]);
  }
  
  function getCalendarsList() {
	  return getListByCategory(config.categories[1]);
  }
  
  function getTasksList() {
	  return getListByCategory(config.categories[2]);
  }
  
  function formatSyncStatus(config) {
	  	var sync = '';
	  
	  	if (config != null) {
	  		devTools.writeMsg('options', 'formatSyncStatus', 'config: ' + JSON.stringify(config));
	  		if (config.syncKey != undefined) {
	  			if (config.syncKey > '0') {
		  			sync = 'ok';
		  			sync += (config.managedCards != undefined && config.managedCards.length > 0 ? ' (' + config.managedCards.length + ')' : '');
	  			} else
	  				sync = 'failed';
	  		} else
	  			sync = 'ja';
	  	}

	  	return sync;
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
		lc.setAttribute('label', formatSyncStatus(config));

		lc = ab.appendChild(document.createElement('listcell'));
		lc.setAttribute('label', rLabel);
		if (rValue != '') {
			lc.setAttribute('value', rValue);
		}

		return ab;
  }

  function modifyListItem(listItem, config, lLabel, lValue, rLabel, rValue) {
		var ab = listItem;
	
		ab.setAttribute('value', (config != null ? JSON.stringify(config) : ''));
		
		var lc = ab.childNodes[0];
		lc.setAttribute('label', lLabel);
		lc.setAttribute('value', (lValue != '' ? lValue : null));
		
		lc = ab.childNodes[1];
		lc.setAttribute('label', formatSyncStatus(config));

		lc = ab.childNodes[2];
		lc.setAttribute('label', rLabel);
		lc.setAttribute('value', (rValue != '' ? rValue : null));
		
		// button state
		onListBoxSelection();
  }

  function overwriteConnectionSettings() {
	  var host = document.getElementById('host').value;
	  var url = (document.getElementById('hostSsl').checked ? 'https://' : 'http://') + host + config.urlSuffix;
	  var user = document.getElementById('user').value;
	  var pwd = document.getElementById('password').value;
	  
	  var connectChanged = false;
	  try {
		  connectChanged = (host != config.url.split('/', 3)[2].split(':', 1)[0] || user != config.user);
	  } catch(e) {
	  }
	  // connect changes?
	  if (connectChanged) {
		  config.jsonSyncConfig = null;
	  }
	  
	  // overwrite connection settings
	  config.url = url;
	  config.user = user;
	  config.setPwd(pwd);
	
  }

  function checkConnectionStatus(err) {
//	  devTools.enter('options', 'checkConnectionStatus', 'http 401: ' + config.isLastError('http', 401));
	  var vbConnectionTest = document.getElementById('vbConnectionTest');
	  
	  if (vbConnectionTest != undefined) {
		  vbConnectionTest.hidden = !(config.isLastError('http', 401, err) || !config.minimumConfig());
		  
		  if (vbConnectionTest.hidden == false) {
			  document.getElementById("ThundertinePreferences").showPane(document.getElementById('paneThunderTineHost')); 
		  }
	  }
  }

  function statusBar(state) {
	  // values: working, inactive, icon
	  try {
		  // handle buttons
		  if (state == 'working')
			  onListBoxSelection(true);

		  window.opener.ttine.statusBar(state);
	  } catch(e) {
		  
	  }
  }