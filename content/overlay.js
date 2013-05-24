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

var ttine = {

  // callback variables for optionsResultApplyCallback
  userConfigAction: null,
  userConfigData: null,

  onLoad: function() {
    // initialization code
    this.strings = document.getElementById("ttine-strings");
	config.read();

	if (config.minimumConfig())
		this.initialized = true;

	// init managedCards
	sync.initManagedCards();
	
	// initialize syncTimer
	this.startSyncTimer();
  },

  onUnLoad: function() {
	if (config.syncBeforeClose)
		this.sync();
	devTools.writeMsg('overlay', 'onUnLoad','saving config');
	config.saveSyncConfig();
  },

  onMenuItemCommand: function(e) { 
	// prevent changes while syncing
	if (sync.inProgress) {
		helper.prompt(this.strings.getString('syncInProgress'));
		return false;
	}

	// stop timer
	this.stopSyncTimer();

	// reset dialog result
	this.userConfigAction = this.userConfigData = null;

	// show options
	window.open(
		"chrome://ttine/content/thunderbirdOptions.xul",
		"ttine-options-window", 
		"chrome,centerscreen,modal,toolbar", 
		null, null
	); 

	this.initialized = true; 

	// nothing changed on options dialog (lastUserConfigAction called from options.onclose)
	if (this.userConfigAction != true) {
		// store folders
		if (this.userConfigData != null) {
			config.mergeFolders(this.userConfigData.jsonSyncConfig.folders);
			this.checkConfiguredRemoteFolder();
		}
		// restart timer 
		this.startSyncTimer();
		return 0;
	}

	// merge syncConfig
	var connectChanged = false;
	try {
		var curUrl = config.url.replace(config.urlSuffix, '');
		var newUrl = this.userConfigData.url.replace(config.urlSuffix, '');

		connectChanged = (newUrl.split('://', 2)[1] != curUrl.split('://', 2)[1] || 
						  this.userConfigData.user != config.user);
	} catch(e) {
	}
	config.mergeSyncConfig(this.userConfigData.jsonSyncConfig, connectChanged, this.userConfigData.pwdChanged);

	// reset dialog result
	this.userConfigAction = this.userConfigData = null;

	// now sync to initialize a new timer
	this.startSyncTimer(0);
	return 0;
  },
  
  checkConfiguredRemoteFolder: function() {
	devTools.writeMsg('ttine', 'checkConfiguredRemoteFolder');
	if (config.remoteCheckConfigs(config.getSyncConfig()) == true) {
		devTools.writeMsg('ttine', 'checkConfiguredRemoteFolder', 'saving syncConfig: configured remote folder has been removed on server side');
		config.saveSyncConfig();
	}
  },

  onSync: function(e) {
	devTools.writeMsg('ttine', 'onSync', 'lastSyncStatus: ' + sync.lastSyncStatus);
	// right mouse click 
	if(e.button == 2) 
		this.onMenuItemCommand(e);
	// left click, if error is present
	else {
			var serverResponse = this.strings.getString('serverResponse');
			switch (sync.lastSyncStatus) {
				case 0:
				case 1:
					this.sync();
					break;
				case 3:
				case 7:
					if (helper.ask(serverResponse+'\n\n'+this.strings.getString('serverReturnZero'))) {
						// reset folders
						config.initFolders();
						this.sync();
					}
					break;
				default:
					helper.prompt(serverResponse+'\n\n'+sync.lastSyncStatus);
					this.statusBar();
					break;
			}
	}
  }, 

  statusBar: function(state) { 
	let statusbar = document.getElementById("status-bar-thundertine");
	if (state == '' || state == null) {
		if (sync.inProgress)
			state = 'working';
		else if (!sync.inProgress && !this.initialized)
			state = 'inactive';
		else
			state = 'icon';
	}

	statusbar.setAttribute("image", "chrome://ttine/skin/ttine_" + state + ".png");
	statusbar.blur();
  },

  sync: function() { 
	// if other thread is already running quit
	if (sync.inProgress || !this.initialized) {
		return false;
	}
	
	if (sync.lastSyncStatus == 'upload' && this.uploadRetry == true) {
		this.uploadRetry = false;
	}

	this.stopSyncTimer();

	var toDo = Array('start');
	var folders = config.getFolders();
	if (config.checkFolderBefore || folders.syncKey == undefined) {
		if (folder.syncFolder() == true)
			toDo.push('folderAction');
	}
	toDo.push('sync');
	toDo.push('finish');
	sync.execute( toDo );
	return true;
  },

  optionsResultApplyCallback: function(result, data) {
	if (typeof result == 'boolean') {
		this.userConfigAction = result;
		this.userConfigData = JSON.parse(JSON.stringify(data));
	}
  },

  startSyncTimer: function(delay) {
	var syncConfig = config.getSyncConfig();
	// delay initial sync for 10s (spend a little bit time for thunderbird startup)
	var nextSync = (typeof delay == 'number' ? delay : (syncConfig.lastSyncTime == undefined ? 10000 : config.interval));

	//devTools.writeMsg('ttine', 'startSyncTimer', 'nextSync: ' + nextSync/1000);
    this.timerId = window.setTimeout('ttine.sync();', nextSync);
  },

  stopSyncTimer: function() {
	if(typeof this.timerId == "number") {
		devTools.writeMsg('ttine', 'stopSyncTimer');
		window.clearTimeout(this.timerId);
		this.timerId = null;
	}
  }

};

window.addEventListener("load", function(e) { ttine.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ttine.onUnLoad(e); }, false);
