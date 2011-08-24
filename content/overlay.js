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

  onLoad: function() {
    // initialization code
    this.strings = document.getElementById("ttine-strings");
	config.read();
	
	helper.debugOut("\n================================================================\n");
	helper.debugOut("overlay.onLoad(): config.contactsSyncKey = '"+JSON.stringify(config.contactsSyncKey)+"'\n");

	if (config.minimumConfig()) {
		this.initialized = true;

		// set lastStatus=1 so that sync can be executed
		sync.lastStatus = 1;
	}
	
	// go syncing some seconds after Thunderbird is loaded
	this.timerId = window.setTimeout('ttine.sync();', 1000);
  },

  onUnLoad: function() {
    // must not sync without processing the response, therefore commented this out
    
	//if (config.syncBeforeClose) {
	//	this.sync();
	//}
	//else {
	//	config.write();
	//}
  },

  onMenuItemCommand: function(e) { 
	// prevent changes while syncing
	if (sync.inProgress) {
		helper.prompt(this.strings.getString('syncInProgress'));
		return false;
	}
	// delete existing timer
	if (typeof this.timerId == "number") {
		window.clearTimeout(this.timerId);
	}

	// show options
	window.open(
		"chrome://ttine/content/thunderbirdOptions.xul",
		"ttine-options-window", 
		"chrome,centerscreen,modal,toolbar", 
		null, null
	); 
	this.initialized = true; 
	config.read(); 			// config parameters may have changed -> load parameters into config object in this scope

	// now sync to initialize a new timer
	this.sync();
  },

  onSync: function(e) {
	// right mouse click 
	helper.debugOut("overlay.onSync(): sync.lastStatus="+sync.lastStatus+"\n");
	if (e.button == 2) {
		this.onMenuItemCommand(e);
	}
	// left click, if error is present
	else if (sync.lastStatus != 1) {
		if (!isNaN(sync.lastStatus)) {
			var serverResponse = this.strings.getString('serverResponse')+"\n"+errortxt.sync['code'+sync.lastStatus];
			if (sync.lastStatus==3 || sync.lastStatus==7) {
				if (helper.ask(serverResponse+"\n\n"+this.strings.getString('serverReturnZero'))) {
					config.folderSyncKey[sync.syncFolders[0]] = 0; 		// is this right?
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
	else {
		this.sync();
	}
  }, 

  statusBar: function(state) { 
	var statusbar = document.getElementById("status-bar-thundertine");
	if (state == '' || state == null) {
		if (sync.inProgress) {
			state = 'working';
		} else if (!sync.inProgress && !this.initialized) {
			state = 'inactive';
		} else {
			state = 'icon';
		}
	}
	statusbar.setAttribute("image", "chrome://ttine/skin/ttine_" + state + ".png");
	statusbar.blur();
  },


  sync: function() { 
	// if other thread is already running quit
	if (sync.inProgress || !this.initialized) {
		return false;
	}

	if (typeof this.timerId == "number") {
		window.clearTimeout(this.timerId);
	}

	var toDo = ['start'];
	if (config.checkFolderBefore) {
		toDo.push('folderSync');
	}
	//toDo.push('prepareContacts');
	toDo.push('sync');
	toDo.push('finish');
	sync.execute( toDo );
  }

};

window.addEventListener("load", function(e) { ttine.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ttine.onUnLoad(e); }, false);


