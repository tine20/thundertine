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

	// initialize syncTimer
	this.startSyncTimer();
  },

  onUnLoad: function() {
	if (config.syncBeforeClose)
		this.sync();
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
		if (this.userConfigData != null)
			config.mergeFolders(this.userConfigData.jsonSyncConfig.folders);
		// restart timer 
		this.startSyncTimer();
		return 0;
	}

	// merge syncConfig
	var connectChanged = false;
	try {
		connectChanged = (this.userConfigData.url.split('/', 3)[2].split(':', 1)[0] != config.url.split('/', 3)[2].split(':', 1)[0] || 
						  this.userConfigData.user != config.user || 
						  this.userConfigData.pwdChanged);
	} catch(e) {
	}
	config.mergeSyncConfig(this.userConfigData.jsonSyncConfig, connectChanged);

	// reset dialog result
	this.userConfigAction = this.userConfigData = null;

	// now sync to initialize a new timer
	this.startSyncTimer(0);
	return 0;
  },

  onSync: function(e) {
//	devTools.enter('ttine', 'onSync', 'lastSyncStatus \'' + sync.lastSyncStatus + '\'');
	// right mouse click 
	if(e.button == 2) 
		this.onMenuItemCommand(e);
	// left click, if error is present
	else if (sync.lastSyncStatus != 1 && sync.lastSyncStatus != 0) {
		if (!isNaN(sync.lastSyncStatus)) {
			var serverResponse = this.strings.getString('serverResponse')+'\n'+errortxt.sync['code'+sync.lastStatus];
			if (sync.lastSyncStatus==3 || sync.lastSyncStatus==7) {
				if (helper.ask(serverResponse+'\n\n'+this.strings.getString('serverReturnZero'))) {
					// reset folders
					config.initFolders();
					this.sync();
				}
			} else {
				helper.prompt(serverResponse+'\n\n'+this.strings.getString('serverRecovery'));
				this.statusBar();
			}
		} else {
			helper.prompt(this.strings.getString('serverResponse')+'\n'+sync.lastSyncStatus);
			this.statusBar();
		}
	// normally sync
	} else
		this.sync();

//	devTools.leave('ttine', 'onSync');
  }, 

  statusBar: function(state) { 
//	devTools.enter("ttine", "statusBar", "status: " + (status == '' ? '<empty>' : status));
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
//	devTools.leave("ttine", "statusBar");
  },

  sync: function() { 
//	devTools.enter("ttine", "sync");
	// if other thread is already running quit
	if (sync.inProgress || !this.initialized) {
//		devTools.leave("ttine", "sync", "false");
		return false;
	}

	this.stopSyncTimer();
	
	var toDo = Array('start');
	if (config.checkFolderBefore || config.getFolders().syncKey == undefined)
		toDo.push('folderSync');
	toDo.push('prepareContacts');
	/*
	 * MISSING: prepare calendar and tasks
	 */
	toDo.push('sync');
	toDo.push('finish');
	sync.execute( toDo );
//	devTools.leave("ttine", "sync");
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
	var nextSync = (typeof delay == 'number' ? delay : config.interval);

	// delay initial sync for 10s (spend a little bit time for thunderbird startup)
	if (syncConfig.lastSyncTime == undefined)
		nextSync = 10000;
	
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


