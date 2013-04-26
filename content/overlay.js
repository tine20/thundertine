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
  userConfigAction: null,
  userConfigData: null,
  
  onLoad: function() {
    // initialization code
    this.strings = document.getElementById("ttine-strings");
	config.read();

	if (config.minimumConfig())
		this.initialized = true;

	// go syncing some seconds after Thunderbird is loaded
	this.startSyncTimer(5000);
  },

  onUnLoad: function() {
	if (config.syncBeforeClose)
		this.sync();
  },

  onMenuItemCommand: function(e) { 
	devTools.enter('ttine', 'onMenuItemCommand');
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

	// nothing changed on options dialog (lastUserConfigAction called from options.onclose)
	if (this.userConfigAction != true) {
		this.startSyncTimer();
		return 0;
	}

	// update configs
	devTools.writeMsg('ttine', 'onMenuItemCommand', 'update config');
	if (this.userConfigData.host != config.host ||
		this.userConfigData.user != config.user ||
		this.userConfigData.pwdChanged
	) {
		devTools.writeMsg('overlay', 'onMenuItemCommand', 'reset config after login changed');
		// replace the whole config
		//config = userConfigData;
	} else {
		devTools.writeMsg('overlay', 'onMenuItemCommand', 'reset sync config');
		// merge ab config
		config.mergeAbSyncConfig(this.userConfigData.jsonSyncConfig.contacts.configured);
		// check calendars configs
		// toDo
		// check tasks configs
		// toDo
	}
	config.saveSyncConfig();

	// reset dialog result
	this.userConfigAction = this.userConfigData = null;

	// appliedConfig != jsonSyncConfig
	this.initialized = true; 

	// now sync to initialize a new timer
	devTools.writeMsg('ttine', 'onMenuItemCommand', 'starting sync');
	this.startSyncTimer(0);
	devTools.leave('ttine', 'onMenuItemCommand');
	return 0;
  },

  onSync: function(e) {
	devTools.enter("ttine", "onSync");
	// right mouse click 
	if(e.button == 2) 
		this.onMenuItemCommand(e);
	// left click, if error is present
	else if (sync.lastStatus != 1) {
		if (!isNaN(sync.lastStatus)) {
			var serverResponse = this.strings.getString('serverResponse')+"\n"+errortxt.sync['code'+sync.lastStatus];
			if (sync.lastStatus==3 || sync.lastStatus==7) {
				if (helper.ask(serverResponse+"\n\n"+this.strings.getString('serverReturnZero'))) {
					// reset folders
					config.initFolders();
					this.sync();
				}
			}
			else {
				helper.prompt(serverResponse+"\n\n"+this.strings.getString('serverRecovery'));
				this.statusBar();
			}
		}
		else {
			helper.prompt(this.strings.getString('serverResponse')+"\n"+sync.lastStatus);
			this.statusBar();
		}
	}
	// normally sync
	else
		this.sync();

	devTools.leave("ttine", "onSync");
  }, 

  statusBar: function(state) { 
	devTools.enter("ttine", "statusBar", "status: " + (status == '' ? '<empty>' : status));
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
	devTools.leave("ttine", "statusBar");
  },

  sync: function() { 
	devTools.enter("ttine", "sync");
	// if other thread is already running quit
	if (sync.inProgress || !this.initialized) {
		devTools.leave("ttine", "sync", "false");
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
	devTools.leave("ttine", "sync");
	return true;
  },

  lastUserConfigAction: function(result, data) {
	devTools.enter('overlay', 'lastUserConfigAction', 'result: ' + result + ', data: ' + data);
	if (typeof result == 'boolean') {
		this.userConfigAction = result;
		this.userConfigData = (result ? JSON.parse(JSON.stringify(data)) : null);
	} else {
		this.userConfigAction = null;
		this.userConfigData = null;
	}
	devTools.leave('overlay', 'lastUserConfigAction');
  },
  
  startSyncTimer: function(delay) {
    this.timerId = window.setTimeout('ttine.sync();', (typeof delay == 'number' ? delay : config.interval));
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


