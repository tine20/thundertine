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

var sync = {

  inProgress: false, 

  lastStatus: 0,

  /*
   * The dispatcher is the origin of every action.
   * It keeps the order for asynchronous calls. Always return to dispatch!
   */

  dispatcher: [],	// contains a sequence of commands to process, for example ["start", "folderSync", "sync", "finish"]
  
  syncFolders: [],	// contains a list of remote folder IDs to be synced, when a folder has been processed it is removed from this list

  // start a sequence of commands
  execute: function(dispatcher) {
	var id;

	// initialize sequence of commands
	this.dispatcher = dispatcher;
	
	// initialize list of folders to be synchronized
	this.syncFolders = [];
	for (id in config.contactsSyncKey) {
		this.syncFolders.push(id);
	}

	this.dispatch();
  },

  dispatch: function() {
  
	// empty dispatcher means nothing to do
	if (this.dispatcher.length <= 0) {
		return null;
	}

    helper.debugOut("\n--> sync.dispatch(), this.dispatcher="+JSON.stringify(this.dispatcher)+
	                ", this.syncFolders="+JSON.stringify(this.syncFolders)+"\n");

	// go for next action
	switch (this.dispatcher[0]) {

		case "folderSync":
			folder.update(function(req) {
				// cannot use this.xyz in callback function (use sync.xyz instead)
				if (!req || !folder.updateFinish(req) || !folder.stillExists(sync.syncFolders[0])) {
					helper.debugOut("sync.dispatch(): folderSync failed -> set status = 12\n");
					sync.failed(12);
					return false;
				} 
				sync.dispatcher.splice(0, 1);
				sync.dispatch();
			});
			break;

		case "folderSync_Options":
			folder.update(function(req) {
				// cannot use this.xyz in callback function (use sync.xyz instead)
				if (req) {
					if (folder.updateFinish(req)) {
						remoteFoldersFinish();			// this works only if the folder sync has been started from the options dialog
					}
				}
				sync.dispatcher.splice(0, 1);
				sync.dispatch();
			});
			break;

		case "sync": 
			this.dispatcher.splice(0, 1);
			this.request(function(req){
				// cannot use this.xyz in callback function (use sync.xyz instead)
				var status = sync.response(req);
				if (status != 1 && status != 7) {
					sync.failed(status);
				}
				sync.dispatch();
			});						// TODO: check return value of request() function
			break;

		case "start":
			this.inProgress = true; 
			if (ttine.statusBar) {
				ttine.statusBar('working');
			}
			this.dispatcher.splice(0, 1);
			this.dispatch();
			break;

		case "finish":
			this.inProgress = false; 
			if (ttine.statusBar) {
				ttine.statusBar();
				ttine.timerId = window.setTimeout('ttine.sync();', config.interval);		// schedule next sync
			}
			this.dispatcher.splice(0, 1);
			this.lastStatus = 1;
			break;
	}
  },

  failed: function (reason, txt) { 
	// In asynchron mode die silently -> visible in statusbar
	this.dispatcher = [];
	if (reason == 'http') {
		helper.prompt(ttine.strings.getString('connectionFailed')+"\n\n" + txt.statusText + "\n\n"+ttine.strings.getString('checkSettings'));
	} else {
		this.lastStatus = reason;
	}
	sync.inProgress = false;
	ttine.initialized = false;
	ttine.statusBar('error');
  }, 

  /*
   * THE SYNC itself
   */

  // send the sync request. f is the callback function
  request: function(f) {
    //
    // ["Sync", ["Collections", ["Collection", [...], ...]]]
    //
    
	var collections = [];
	var req = ["Sync", ["Collections", collections]];

	helper.debugOut("sync.request()\n");

	/*
	 * AT THE MOMENT THERE'S ONLY A CONTACTS COLLECTION
	 */

	collections.push('Collection', this.createContactsCollection());

	wbxml.httpRequest(req, "Sync", f); // asynchroneus request -> response ends up in callback function f
	return true;
  }, 


  response: function(req) {  
	var reqText, obj, syncStatus, collection, i, status, syncKey;
	
	helper.debugOut("sync.response()\n");
	
	reqText = req.responseText;
	// check if WbXML returned
	if (reqText.substr(0,4) != String.fromCharCode(0x03,0x01,0x6A,0x00) && reqText != '') {
		helper.prompt("The Server response:\n\n"+reqText);
		ttine.initialized = false;
		this.inProgress = false;
		ttine.statusBar();
		return reqText;
	}
	if (reqText == '') {
		/*
		 * Empty response indicates that there're no server side changes (for saving bandwidth). 
		 * Client may request empty then. Not implemented right now. It seem's like Tine 2.0 
		 * isn't using it. 
		 *
		 */
		return true; // empty response -> no changes / no syncKey change
	}
	obj = wbxml.wbxml2obj(reqText);

	// {"Sync":
	//     {"Collections":
	//         {"Collection": [
	//             {"Class":        "Contacts",
	//              "CollectionId": "xxx",
	//              "Status":       "1",
	//              "SyncKey":      "xxx",
	//              "Commands":
	//                 {"Add": [
	//                     {"ServerId": "xxx",
	//                      "ApplicationData": {...}
	//                     },
	//                     ...
	//                 ]},
	//              "Responses":
	//                 {"Add": [
	//                     {"ClientId": "xxx",
	//                      "ServerId": "xxx",
	//                      "Status":   "1"
	//                     },
	//                     ...
	//                 ]},
	//             },
	//             ...
	//         ]}
	//     }
	// }

	// Sync Status (this one is different to Collection Status and only defined if no Collection stati are present!)
	syncStatus = obj.Sync.Status || 1;

	if (syncStatus == 1 && obj.Sync.Collections && obj.Sync.Collections.Collection) { 
		/*
		 * At the Moment only contacts folder is synced. 
		 */

		collection = obj.Sync.Collections.Collection;
		for (i = 0; i < collection.length; i++) {
		
			var collectionId = collection[i].CollectionId;
		
			if (config.contactsSyncKey[collectionId]!==undefined) {
				// process the collection

				status = collection[i].Status;
				
				if (status == 7) {
					this.lastStatus = 7;
				} else if (status != 1) {
					return status;				// TODO
				}

				try {				
					this.applyContactsCollection(config.contactsFolder[collectionId], collection[i].Responses||null, collection[i].Commands||null);
				} catch (err) {
					helper.debugOut("  synchronization of folderId '"+collectionId+"' failed. Exception: "+err+"\n");
					return status;              // TODO
				}

				helper.debugOut("  synchronization of folderId '"+collectionId+"' has completed successfully.\n");

				syncKey = collection[i].SyncKey;
				helper.debugOut("  received SyncKey: "+syncKey+"  (must be used in next request)\n");
				if (syncKey) {
					config.contactsSyncKey[collectionId] = syncKey;	// save SyncKey
				}
			}
		}
		
		/*
		 * After successfull sync save! (e.g. for Id in xml)
		 */
		config.write();
	}

	return syncStatus;

  },

  createContactsCollection: function() {
    //
    // ["Class",        "Contacts",
    //  "SyncKey",      "xxx",
    //  "CollectionId", "xxx",
    //  "Supported",    [tagname, null, tagname, null, ...],                      (only when SyncKey == 0)
    //  "GetChanges",   null,                                                     (only when SyncKey != 0)
    //  "Commands",     ["Add", [...], "Change", [...], "Delete", [...], ...]     (only when SyncKey != 0)
    // ]
  
	var col = [];

	// collections -> Collection -> Class    (is this required?)
	col.push('Class', 'Contacts');
	
	// get the CollectionId and SyncKey of the current folder
	var collectionId = this.syncFolders[0];
	var contactsSyncKey = config.contactsSyncKey[collectionId];
	var contactsLocalFolder = config.contactsFolder[collectionId];
	helper.debugOut("sync.createContactsCollection(): collectionId='"+collectionId+"', SyncKey='"+contactsSyncKey+"'\n");

	// make sure config.managedCards[] exists
	if (config.managedCards[contactsLocalFolder]===undefined) {
		config.managedCards[contactsLocalFolder] = [];
	}
	
	// collections -> Collection -> SyncKey
	col.push('SyncKey', contactsSyncKey);

	// collections -> Collection -> CollectionId
	col.push('CollectionId', collectionId);

	if (contactsSyncKey == 0) { 
		// collections -> Collection -> Supported
		col.push('Supported', ab.asSupported());
		// collections -> Collection -> Options
		//col.push('GetChanges', null);
		//col.push('Options', ['Class', 'Contacts']);
		// queue next request (get entries with key of 1)
		this.dispatcher.splice(this.dispatcher.indexOf('finish')-1, 0, 'sync');
	}
	else if (config.contactsSyncKey == 1) {
		/*
		 * Bug or feature? If syncKey = 1 then giving commands results to a Tine 2.0 exception.
		 */
		// collections -> Collection -> GetChanges?
		col.push('GetChanges', null);
		// queue next request (send local entries with key of 2)
		this.dispatcher.splice(this.dispatcher.indexOf('finish')-1, 0, 'sync');
	}
	else { 
		// collections -> Collection -> GetChanges?
		col.push('GetChanges', null);
		// collections -> Collection -> Commands
		var commands = ab.commandsDom(contactsLocalFolder); 
		if (commands != null) { //  && config.contactsSyncKey > 1
			col.push('Commands', commands);
		}

		// remove this folder from the list
		this.syncFolders.splice(0, 1);
		if (this.syncFolders.length > 0) {
			// if there are still folders to do then queue next request
			this.dispatcher.splice(this.dispatcher.indexOf('finish')-1, 0, 'sync');
		}
	}
	return col;
  }, 

  applyContactsCollection: function(contactsLocalFolder, responses, commands) {
	// responses = {"Add": [
	//                 {"Status":   "1",
	//                  "ServerId": "xxx",
	//                  "ClientId": "xxx",
	//                  "Class":    "xxx"
	//                 },
	//                 ...
	//              ],
	//              "Change": [
	//                 {"Status":   "1",
	//                  "ServerId": "xxx",
	//                  "Class":    "xxx"
	//                 },
	//                 ...
	//              ],
	//              "Fetch":
	//                 {"Status":   "1",
	//                  "ServerId": "xxx",
	//                  "ApplicationData" : {..}
	//                 }
	//             }

	var i, entry;

	// process server response
	if (responses && responses.Add) {
		for (i = 0; i < responses.Add.length; i++) {
			entry = responses.Add[i];
			if (entry.Status == 1) {
				ab.responseCard(contactsLocalFolder, entry.ClientId, ["TineSyncId", 'TineSyncMD5'], [entry.ServerId, ''] ); 
			} else {
				helper.prompt("Syncing failed. The server responded: \n" + errortxt.sync['code'+entry.Status]);
			}
		}
	}

	if (responses && responses.Change) {
		for (i = 0; i < responses.Change.length; i++) {
			entry = responses.Change[i];
			if (entry.Status == 1) {
				ab.responseCard(contactsLocalFolder, entry.ServerId, ['TineSyncMD5'], [''] ); 
			} else {
				helper.prompt("Syncing failed. The server responded: \n" + errortxt.sync['code'+entry.Status]);
			}
		}
	}

	// commands  = {"Add": [
	//                 {"ServerId": "xxx",
	//                  "ApplicationData" : {..}
	//                 },
	//                 ...
	//              ],
	//              "Change": [
	//                 {"ServerId": "xxx",
	//                  "Class":    "xxx",
	//                  "ApplicationData" : {..}
	//                 },
	//                 ...
	//              ],
	//              "Delete": [
	//                 {"ServerId": "xxx",
	//                  "Class":    "xxx"
	//                 },
	//                 ...
	//              ],
	//              "SoftDelete": [
	//                 {"ServerId": "xxx"},
	//                 ...
	//              ],
	//             }

	// process server commands
	if (commands && commands.Add) {
		for (i = 0; i < commands.Add.length; i++) {
			entry = commands.Add[i];
			ab.commandCard(contactsLocalFolder, "Add", entry.ServerId, entry.ApplicationData);
		}
	}
	if (commands && commands.Change) {
		for (i = 0; i < commands.Change.length; i++) {
			entry = commands.Change[i];
			ab.commandCard(contactsLocalFolder, "Change", entry.ServerId, entry.ApplicationData);
		}
	}
	if (commands && commands.Delete) {
		for (i = 0; i < commands.Delete.length; i++) {
			entry = commands.Delete[i];
			ab.commandCard(contactsLocalFolder, "Delete", entry.ServerId, null);
		}
	}
	
	// keep track of cards for deleting
	ab.managedCards(contactsLocalFolder);
  }

};

