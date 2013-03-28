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
   * The dispatcher is the origin and destination of every action. 
   * It keeps the order for asynchronous calls. Always return to dispatch!
   */

  dispatcher: Array(), 
  dispGoTo: null, 
  syncCollections: Array(),

  execute: function(dispatcher) {
	devTools.enter("sync", "execute");
	// new command set is given
	if (typeof dispatcher != 'undefined')
		this.dispatcher = dispatcher;

	this.dispatch();
	devTools.leave("sync", "execute");
  },

  dispatch: function(req) { 
	devTools.enter("sync", "dispatch");
	// just returned to here
	switch (this.dispGoTo) {
		case 'folderSync': 
			if(!folder.updateFinish(req) || !folder.stillExists()) {
				this.failed(12);
				devTools.leave("sync", "dispatch", "case folderSync: 12");
				return false;
			} 
			this.dispatcher.splice(0,1);
			this.dispGoTo = null;
			break;
		case 'remoteFoldersFinish': 
			if(typeof req != 'undefined')
				if(folder.updateFinish(req))
					remoteFoldersFinish();
			this.dispatcher.splice(0,1);
			this.dispGoTo = null;
			break;
		case 'sync': 
			var status = this.response(req);
			if(status != 1 && status != 7) 
				this.failed(status);
			this.dispGoTo = null;
			break;
	}

	// empty dispatcher means nothing to do
	if (this.dispatcher.length <= 0) {
		devTools.leave("sync", "dispatch", "empty dispatcher");
		return null;
	}

	// go for next action
	switch(this.dispatcher[0]) {
		case "folderSync":
			this.dispGoTo = 'folderSync';
			folder.update();
			break;
		case "folderSync_Options":
			this.dispGoTo = 'remoteFoldersFinish';
			folder.update();
			break;
		case "prepareContacts": 
			if (ab.stillExists()) 
				this.syncCollections.push('contacts');
			this.dispatcher.splice(0,1);
			this.dispatch();
			break;
		case "prepareCalendar":
			this.syncCollections.push('calendar');
			this.dispatcher.splice(0,1);
			this.dispatch();
			break;
		case "prepareTasks":
			this.syncCollections.push('tasks');
			this.dispatcher.splice(0,1);
			this.dispatch();
			break;
		case "sync": 
			this.dispGoTo = 'sync';
			this.dispatcher.splice(0,1);
			if(this.request() == false) {
				this.dispGoTo = null;
				this.dispatch();
			}
			break;
		case "start":
			this.inProgress = true; 
			devTools.writeMsg("sync", "dispatch", "sync started " + config.contactsLocalFolder + " - " + config.contactsRemoteFolder, true);
			if (typeof ttine.statusBar != 'undefined')
				ttine.statusBar('working');
			this.dispatcher.splice(0,1);
			this.syncCollections = Array();
			this.dispatch();
			break;
		case "finish":
			this.inProgress = false; 
			if (typeof ttine.statusBar != 'undefined') {
				ttine.statusBar();
				ttine.timerId = window.setTimeout('ttine.sync();', config.interval);
				devTools.writeMsg("sync", "dispatch", "sync finished successful " + config.contactsLocalFolder + " - " + config.contactsRemoteFolder, true);
			}
			this.dispatcher.splice(0,1);
			this.lastStatus = 1;
			break;
		default:
			this.dispGoTo = '';
	}
	devTools.leave("sync", "dispatch");
  },

  failed: function (reason, txt) { 
	devTools.enter("sync", "failed");
	// In asynchron mode die silently -> visible in statusbar
	this.dispatcher = Array();
	if (reason == 'http')
		helper.prompt(ttine.strings.getString('connectionFailed')+"\n\n" + txt.statusText + "\n\n"+ttine.strings.getString('checkSettings'));
	else
		this.lastStatus = reason;
	sync.inProgress = false;
	ttine.initialized = false;
	ttine.statusBar('error');
	devTools.leave("sync", "failed");
  }, 

  /*
   * THE SYNC itself
   */

  request: function() { 
	devTools.enter("sync", "request");
	var doc = document.implementation.createDocument("", "", null);
	var dom = doc.createElement('Sync');
	// collections
	dom.appendChild(doc.createElement('Collections'));

	/*
	 * AT THE MOMENT THERE'S ONLY A CONTACTS COLLECTION
	 */

	if (this.syncCollections.indexOf('contacts') >= 0)
		dom.lastChild.appendChild( this.createContactsCollection() );

	if (this.syncCollections.indexOf('calendar') >= 0)
		dom.lastChild.appendChild( this.createCalendasCollection() );

	if (this.syncCollections.indexOf('tasks') >= 0)
		dom.lastChild.appendChild( this.createTasksCollection() );

	if (this.syncCollections.length > 0)
		wbxml.httpRequest(dom); // asynchroneus -> ends up in this.dispatch()
	else {
		devTools.leave("sync", "request");
		return false;
	}
	devTools.leave("sync", "request");
  }, 


  response: function(req) {  
	devTools.enter("sync", "response");
	var reqText = req.responseText; 
	// check if WbXML returned
	if (reqText.substr(0,4) != String.fromCharCode(0x03,0x01,0x6A,0x00) && reqText != '') {
		helper.prompt("The Server respones \n\n"+reqText);
		ttine.initialized = false;
		this.inProgress = false;
		ttine.statusBar();
		devTools.leave("sync", "response");
		return reqText;
	}
	else if (reqText == '') {
		/*
		 * Empty response indicates that there're no server side changes (for saving bandwidth). 
		 * Client may request empty then. Not implemented right now. It seem's like Tine 2.0 
		 * isn't using it. 
		 *
		 */
		devTools.leave("sync", "response");
		return true; // empty response -> no changes / no syncKey change
	}
	else
		var dom = wbxml.doXml(reqText);		

	// Sync Status (this one is different to Collection Status and only defined if no Collection stati are present!)
	if(typeof helper.doEvaluateXPath(dom, "/Sync/Status")[0] == 'undefined')
		var syncStatus = 1;
	else
		var syncStatus = helper.doEvaluateXPath(dom, "/Sync/Status")[0].firstChild.nodeValue;

	if (syncStatus == 1) { 
		/*
		 * At the Moment only contacts folder is synced. 
		 */

		var contactsColl = helper.doEvaluateXPath(dom, "/Sync/Collections/Collection[CollectionId='"+config.contactsRemoteFolder+"']");

		var status = helper.doEvaluateXPath(contactsColl[0], "//Status");
		if (status[0].firstChild.nodeValue == 7)
			this.lastStatus = 7;
		else if (status[0].firstChild.nodeValue != 1) {
			devTools.leave("sync", "response", "status: " + status[0].firstChild.nodeValue);
			return status[0].firstChild.nodeValue;
		} 

		var syncKey = helper.doEvaluateXPath(contactsColl[0], "//SyncKey");
		if(typeof syncKey[0].firstChild.nodeValue != 'undefined')
			config.contactsSyncKey = syncKey[0].firstChild.nodeValue;

		this.applyContactsCollection(
			helper.doEvaluateXPath(dom, "/Sync/Collections/Collection[CollectionId='"+config.contactsRemoteFolder+"']/Responses"),
			helper.doEvaluateXPath(dom, "/Sync/Collections/Collection[CollectionId='"+config.contactsRemoteFolder+"']/Commands")
		);

		/*
		 * MISSING: Apply new calendar and task entries
		 */

		/*
		 * After successfull sync save! (e.g. for Id in xml)
		 */
		config.write();
	}

	devTools.leave("sync", "response", "syncStatus: " + syncStatus);
	return syncStatus;

  },

  createContactsCollection: function() {
	devTools.enter("sync", "createContactsCollection", "syncKey: " + config.contactsSyncKey + ", remoteFolder: " + config.contactsRemoteFolder);
	var doc = document.implementation.createDocument("", "", null);
	// collections -> Collection
	var dom = doc.createElement('Collection');

	// collections -> Collection -> Class
	dom.appendChild(doc.createElement('Class'));
		dom.lastChild.appendChild(doc.createTextNode('Contacts'));

	// collections -> Collection -> SyncKey
	dom.appendChild(doc.createElement('SyncKey')); 
		dom.lastChild.appendChild(doc.createTextNode(config.contactsSyncKey));

	// collections -> Collection -> CollectionId
	dom.appendChild(doc.createElement('CollectionId'));
		dom.lastChild.appendChild(doc.createTextNode(config.contactsRemoteFolder));

	if (config.contactsSyncKey == 0) { 
		devTools.writeMsg("sync", "createContactsCollection", "config.contactsSyncKey == 0");
		// collections -> Collection -> Supported
		dom.appendChild( ab.supportedDom() );
		// collections -> Collection -> Options
		dom.appendChild(doc.createElement('Options')); dom.appendChild(doc.createElement('GetChanges'));
		dom.lastChild.appendChild(doc.createElement('Class'));
			dom.lastChild.lastChild.appendChild(doc.createTextNode('Contacts')); 
		// queue next request (get entries with key of 1)
		this.dispatcher.splice(this.dispatcher.indexOf('finish')-1, 0, 'prepareContacts', 'sync');
	}
	else if (config.contactsSyncKey == 1) {
		devTools.writeMsg("sync", "createContactsCollection", "config.contactsSyncKey == 1");
		/*
		 * Bug or feature? If syncKey = 1 then giving commands results to a Tine 2.0 exception.
		 */
		// collections -> Collection -> GetChanges?
		dom.appendChild(doc.createElement('GetChanges'));
		// queue next request (send local entries with key of 2)
		this.dispatcher.splice(this.dispatcher.indexOf('finish')-1, 0, 'prepareContacts', 'sync');
	}
	else { 
		devTools.writeMsg("sync", "createContactsCollection", "config.contactsSyncKey > 1");
		// collections -> Collection -> GetChanges?
		dom.appendChild(doc.createElement('GetChanges'));
		// collections -> Collection -> Commands
		var commands = ab.commandsDom(); 
		if (commands != null) { //  && config.contactsSyncKey > 1
			dom.appendChild( doc.createElement('Commands') );
			for(var i = 0; i<commands.length; i++)
				dom.lastChild.appendChild(commands[i]);
		} 
	}
	devTools.leave("sync", "createContactsCollection");
	return dom;
  }, 

  createCalendarCollection: function() {
	/*
	 * MISSING: calendar and tasks
	 */
  },

  createTasksCollection: function() {
	/*
	 * MISSING: calendar and tasks
	 */
  }, 

  applyContactsCollection: function(responses, commands) {
	devTools.enter("sync", "applyContactsCollection");
	// process server response
	if (responses.length > 0 && responses[0].childNodes.length > 0) {

		for (var r = 0; r < responses[0].childNodes.length; r++) {
			var cardDom = responses[0].childNodes[r]; 
			var cStatus = -1; var cServerId = null; var cClientId = null;
			for (var c = 0; c < cardDom.childNodes.length; c++) {
				if (cardDom.childNodes[c].nodeName == 'Status')
					cStatus = cardDom.childNodes[c].firstChild.nodeValue;
				else if (cardDom.childNodes[c].nodeName == 'ServerId')
					cServerId = cardDom.childNodes[c].firstChild.nodeValue;
				else if (cardDom.childNodes[c].nodeName == 'ClientId')
					cClientId = cardDom.childNodes[c].firstChild.nodeValue;
			}

			if (cStatus != 1) {
				devTools.writeMsg("sync", "applyContactsCollection", "cStatus: " + cStatus);
				if (cStatus == 8) {
					devTools.writeMsg("sync", "applyContactsCollection", "clientID: " + cClientId + ", serverID: " + cServerId + ", status: " + cStatus + ", cardDom: " + wbxml.domStr(cardDom));
					ab.removeCard((cServerId ? cServerId : cClientId));
				}
				continue;
			} 

			if (cardDom.nodeName == 'Add')
				ab.responseCard(cClientId, Array("TineSyncId", 'TineSyncMD5'), Array(cServerId, '') ); 
			else if (cardDom.nodeName == 'Change')
				ab.responseCard(cServerId, Array('TineSyncMD5'), Array('') );
		}
	}

	// process server commands
	if (commands.length > 0 && commands[0].childNodes.length > 0) {
		for (var r = 0; r < commands[0].childNodes.length; r++) {
			var cardDom = commands[0].childNodes[r]; 
			var cServerId = null; var cAppData = null;	
			for (var c = 0; c < cardDom.childNodes.length; c++) {
				if (cardDom.childNodes[c].nodeName == 'ServerId')
					cServerId = cardDom.childNodes[c].firstChild.nodeValue;
				else if (cardDom.childNodes[c].nodeName == 'ApplicationData')
					cAppData = cardDom.childNodes[c];
			}	

			if (cardDom.nodeName == 'Add' || cardDom.nodeName == 'Change' || cardDom.nodeName == 'Delete') {
				ab.commandCard(cardDom.nodeName, cServerId, cAppData); 
			}

		}

	}

	// keep track of cards for deleting
	ab.managedCards();
	devTools.leave("sync", "applyContactsCollection");
  }, 

  applyCalendarCollection: function(dom) {
	/*
	 * MISSING: calendar and tasks
	 */
  }, 

  applyTasksCollection: function(dom) {
	/*
	 * MISSING: calendar and tasks
	 */
  }

}

