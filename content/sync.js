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

  lastSyncStatus: 0,

  /*
   * The dispatcher is the origin and destination of every action. 
   * It keeps the order for asynchronous calls. Always return to dispatch!
   */

  dispatcher: Array(), 
  dispGoTo: null, 
  syncCollections: Array(),

  execute: function(dispatcher) {
	// new command set is given
	if (typeof dispatcher != 'undefined')
		this.dispatcher = dispatcher;

	this.dispatch();
  },

  dispatch: function(req, err) {
//	devTools.enter('sync', 'dispatch', 'req ' + req + ', err ' + err + ', dispatcher ' + JSON.stringify(this.dispatcher) + ', dispToGo ' + JSON.stringify(this.dispToGo));
	var ignoreError = false;
	
	// just returned to here
	switch (this.dispGoTo) {
		case 'folderAction': 
			var result = folder.finishAction(req, err);
			var retry = false;

			// response processor needs retry?
			if (result == false && err != undefined)
				retry = (err.retryLastAction != undefined ? err.retryLastAction : false);
				
			if (retry == false) {
				this.dispatcher.splice(0,1);
				this.dispGoTo = null;
			} else
				ignoreError = true;
			break;
		case 'sync': 
			var status = this.response(req, err);

			if(status != 1 && status != 7) 
				this.failed(status);
			this.dispGoTo = null;
			break;
	}

	// break if err
	if (err != undefined && ignoreError == false) {
		this.failed(err.reason, err.statusText, err);
		return null;
	}
	// empty dispatcher means nothing to do
	if (this.dispatcher.length <= 0) {
//		devTools.leave('sync', 'dispatch', 'empty dispatcher');
		return null;
	}

	// go for next action
	switch(this.dispatcher[0]) {
		case "start":
			this.inProgress = true;
			if (typeof ttine.statusBar != 'undefined')
				ttine.statusBar('working');
			this.dispatcher.splice(0,1);
			this.dispatch();
			break;
		case "folderAction":
			this.dispGoTo = 'folderAction';
			folder.performAction();
			break;
		case "sync": 
			this.dispGoTo = 'sync';
			this.dispatcher.splice(0,1);
			if(this.request() == false) {
				this.dispGoTo = null;
				this.dispatch();
			}
			break;
		case "finish":
			this.inProgress = false; 
			if (typeof ttine.statusBar != 'undefined') {
				ttine.statusBar();
				ttine.startSyncTimer();
			}
			this.dispatcher.splice(0,1);
			this.lastSyncStatus = 1;
			break;
		default:
			this.dispGoTo = '';
	}
//	devTools.leave('sync', 'dispatch');
	return true; // to avoid warnings
  },

  failed: function (reason, txt, err) { 
	devTools.writeMsg('sync', 'failed', 'reason ' + reason + ', txt ' + txt + (err != undefined ? ', err ' + JSON.stringify(err) : ''));
    // In asynchron mode die silently -> visible in statusbar
	this.dispatcher = Array();
	
	if (reason == 'http') {
		var msg = true;
		
		if (err != undefined)
			msg = (err.dontPromptUser != undefined ? !err.dontPromptUser : true);
		
		if (msg)
			helper.prompt(ttine.strings.getString('connectionFailed')+"\n\n" + txt + "\n\n"+ttine.strings.getString('checkSettings'));
	} else
		this.lastSyncStatus = reason;

	// save timestamp sync finsish
	config.addSyncInfos('failed');
	
	sync.inProgress = false;
	ttine.initialized = false;
	ttine.statusBar('error');
  }, 

  /*
   * THE SYNC itself
   */

  request: function() { 
	var doc = document.implementation.createDocument("", "", null);
	var dom = doc.createElement('Sync');
	// collections
	dom.appendChild(doc.createElement('Collections'));

	/*
	 * add all configured collection types
	 */

	var forceInitAddedConfigs = false;
	var syncConfig = config.getSyncConfig();
	
	// we need to initialize added syncConfigs
	if (syncConfig.lastMergeAddedNewConfigs != undefined) {
		forceInitAddedConfigs = (syncConfig.lastMergeAddedNewConfigs == true ? true : false);
		syncConfig.lastMergeAddedNewConfigs = undefined;
	}
	
	var types = ['contacts', 'calendars', 'tasks'];
	for (var idx in types) {
		var type = types[idx];
		var list = syncConfig[type];
		var cnt = list.configured.length;
		devTools.writeMsg('sync', 'request', type + ': #' + cnt);
		
		for (var i=0; i<cnt; i++) {
			var selConf = list.configured[i];
			if (selConf.syncKey == undefined)
				selConf.syncKey = 0;
			// skip already synced syncConfigs
			if (forceInitAddedConfigs && selConf.syncKey > 0)
				continue;
			
			dom.lastChild.appendChild( this.createCollection(type, selConf.syncKey, selConf.local, selConf.remote) );
		}
	}

	// don't send empty collections
	if (dom.childNodes.length == 0) {
		devTools.leave('sync', 'request', 'empty collections');
		return false;
	}
	
	config.addSyncInfos('start');
	
	// asynchronous -> ends up in this.dispatch()
	wbxml.httpRequest(dom);

	return true; // to avoid warnings
  }, 

  response: function(req, err) {  
	config.addSyncInfos('stop');
	
	if (err != undefined) {
		config.lastSyncStatus = -1;
		return false;
	}

	// config.lastSyncStatus = 0;
	var resText = req.responseText;
	
//	devTools.leave('sync', 'response', 'responseText ' + resText);
	// check if WbXML returned
	if (resText.substr(0,4) != String.fromCharCode(0x03,0x01,0x6A,0x00) && resText != '') {
		helper.prompt("The Server respones \n\n"+resText);
		ttine.initialized = false;
		this.inProgress = false;
		ttine.statusBar();
		devTools.leave('sync', 'response', 'no WbXML returned:\n' + resText);
		return resText;
	} else if (resText == '') {
		/*
		 * Empty response indicates that there're no server side changes (for saving bandwidth). 
		 * Client may request empty then. Not implemented right now. It seem's like Tine 2.0 
		 * isn't using it. 
		 *
		 */
//		devTools.leave('sync', 'response', 'empty response: dispGoTo ' + this.dispGoTo + ', dispatcher ' + JSON.stringify(this.dispatcher));
		// stop infinite loop
		this.dispGoTo = '';
		this.dispatcher = [ 'finish' ];
		devTools.leave('sync', 'response', 'empty response');
		return true; // empty response -> no changes / no syncKey change
	} else
		var dom = wbxml.doXml(resText);		

	// Sync Status (this one is different to Collection Status and only defined if no Collection stati are present!)
	var syncStatus = null;
	if(typeof helper.doEvaluateXPath(dom, "/Sync/Status")[0] == 'undefined') {
		syncStatus = 1;
		devTools.writeMsg('sync', 'response', '/Sync/Status not in XML');
	} else {
		syncStatus = helper.doEvaluateXPath(dom, "/Sync/Status")[0].firstChild.nodeValue;
	}

	if (syncStatus == 1) { 
		/*
		 * At the Moment only contacts folder is synced. 
		 */
		var syncConfig = config.getSyncConfig();

		// contacts
		var cnt = syncConfig.contacts.configured.length;
		
		for (var i=0; i<cnt; i++) { 
			var contactConfig = syncConfig.contacts.configured[i];
			var remote = contactConfig.remote;
			
			var contactsColl = helper.doEvaluateXPath(dom, "/Sync/Collections/Collection[CollectionId='"+remote+"']");
			
			if (contactsColl.length > 0) {
				var status = helper.doEvaluateXPath(contactsColl[0], "//Status");
//				devTools.writeMsg('sync', 'response', 'status[0]: ' + wbxml.domStr(status[0]));
				if (status[0].firstChild.nodeValue == 7)
					contactConfig.syncStatus = 7;
				else if (status[0].firstChild.nodeValue != 1) {
//					devTools.leave("sync", "response", "status: " + status[0].firstChild.nodeValue);
					contactConfig.syncStatus = status[0].firstChild.nodeValue;
					continue;
				} 
		
				var syncKey = helper.doEvaluateXPath(contactsColl[0], "//SyncKey");
				if(typeof syncKey[0].firstChild.nodeValue != 'undefined')
					contactConfig.syncKey = syncKey[0].firstChild.nodeValue;
				
				this.applyContactsCollection(
					contactConfig.local, 
					helper.doEvaluateXPath(dom, "/Sync/Collections/Collection[CollectionId='"+remote+"']/Responses"),
					helper.doEvaluateXPath(dom, "/Sync/Collections/Collection[CollectionId='"+remote+"']/Commands")
				);
			} else {
				devTools.writeMsg('sync', 'response', 'no data for remote ' + remote);
			}
		}

		/*
		 * MISSING: Apply new calendar and task entries
		 */
	}

	devTools.leave('sync', 'response', 'syncStatus ' + syncStatus + (syncConfig.lastSyncDuration != undefined ? ' (' + syncConfig.lastSyncDuration/1000 + ' s)' : ''));
	return syncStatus;
  },

  createCollection: function(type, syncKey, local, remote) {
	var result = null;

//	devTools.writeMsg('sync', 'createCollection', 'add ' + type + '[' + i + '], syncKey: ' + syncKey);
	switch (type) {
		case 'contacts':
			result = this.createContactCollection(syncKey, local, remote);
	  		break;
		case 'calendars':
			result = this.createCalendarCollection(syncKey, local, remote);
	  		break;
		case 'tasks':
			result = this.createTaskCollection(syncKey, local, remote);
	  		break;
	}
	
	return result;
  }, 

  createContactCollection: function(syncKey, local, remote) {
//	devTools.enter('sync', 'createContactCollection', "syncKey: " + syncKey + ", remoteFolder: " + remote);
	
	var doc = document.implementation.createDocument("", "", null);
	
	// collections -> Collection
	var dom = doc.createElement('Collection');

	// collections -> Collection -> Class
	dom.appendChild(doc.createElement('Class'));
		dom.lastChild.appendChild(doc.createTextNode('Contacts'));

	// collections -> Collection -> SyncKey
	dom.appendChild(doc.createElement('SyncKey')); 
		dom.lastChild.appendChild(doc.createTextNode(syncKey));

	// collections -> Collection -> CollectionId
	dom.appendChild(doc.createElement('CollectionId'));
		dom.lastChild.appendChild(doc.createTextNode(remote));

	if (syncKey == 0) { 
//		devTools.writeMsg('sync', 'createContactCollection', "syncKey == 0");
		// collections -> Collection -> Supported
		dom.appendChild( ab.supportedDom() );
		// collections -> Collection -> Options
		dom.appendChild(doc.createElement('Options')); dom.appendChild(doc.createElement('GetChanges'));
		dom.lastChild.appendChild(doc.createElement('Class'));
			dom.lastChild.lastChild.appendChild(doc.createTextNode('Contacts')); 
		// queue next request (get entries with key of 1)
		this.dispatcher.splice(this.dispatcher.indexOf('finish')-1, 0, 'sync');
	} else { 
//		devTools.writeMsg('sync', 'createContactCollection', "syncKey > 1");
		// collections -> Collection -> GetChanges?
		dom.appendChild(doc.createElement('GetChanges'));
		// collections -> Collection -> Commands
		var commands = ab.commandsDom(local); 
		if (commands != null) { // && syncKey > 1
			dom.appendChild( doc.createElement('Commands') );
			for(var i = 0; i<commands.length; i++)
				dom.lastChild.appendChild(commands[i]);
		} 
	}
	devTools.leave('sync', 'createContactCollection', "syncKey: " + syncKey + ", remoteFolder: " + remote);
	return dom;
  }, 

  createCalendarCollection: function(syncKey, local, remote) {
	/*
	 * MISSING: calendar and tasks
	 */
  },

  createTaskCollection: function(syncKey, local, remote) {
	/*
	 * MISSING: calendar and tasks
	 */
  }, 

  applyContactsCollection: function(uri, responses, commands) {
//	devTools.enter("sync", "applyContactsCollection");
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
//				devTools.writeMsg("sync", "applyContactsCollection", "cStatus: " + cStatus);
				if (cStatus == 8) {
//					devTools.writeMsg("sync", "applyContactsCollection", "clientID: " + cClientId + ", serverID: " + cServerId + ", status: " + cStatus + ", cardDom: " + wbxml.domStr(cardDom));
					ab.removeCard(uri, (cServerId ? cServerId : cClientId));
				}
				continue;
			} 

			if (cardDom.nodeName == 'Add')
				ab.responseCard(uri, cClientId, Array("TineSyncId", 'TineSyncMD5'), Array(cServerId, '') ); 
			else if (cardDom.nodeName == 'Change')
				ab.responseCard(uri, cServerId, Array('TineSyncMD5'), Array('') );
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
				ab.commandCard(uri, cardDom.nodeName, cServerId, cAppData); 
			}
		}
	}

	// keep track of cards for deleting
	ab.managedCards(uri);
//	devTools.leave("sync", "applyContactsCollection");
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

