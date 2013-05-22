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
  asyncCollectionsPending: undefined,

  execute: function(dispatcher) {
	// new command set is given
	if (typeof dispatcher != 'undefined')
		this.dispatcher = dispatcher;

	this.dispatch();
  },

  dispatch: function(req, err) {
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
			var asyncStatus = { running: false};
			var status = this.response(req, err, asyncStatus);

			if (asyncStatus.running == true)
				return null;
			
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
		//devTools.leave('sync', 'dispatch', 'empty dispatcher');
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

  runExtraSync: function() {
	if (this.dispatcher.indexOf('sync') == -1)
		this.dispatcher.splice(this.dispatcher.indexOf('finish')-1, 0, 'sync');
  },

  request: function() {
	var start = null;
	var dom = null;

	var forceInitAddedConfigs = false;
	var syncConfig = config.getSyncConfig();

	// init request
	if (this.asyncCollectionsPending == undefined) {
		start = Date.now();
		var doc = document.implementation.createDocument("", "", null);
		dom = doc.createElement('Sync');
		// collections
		dom.appendChild(doc.createElement('Collections'));

		// we need to initialize added syncConfigs
		if (syncConfig.lastMergeAddedNewConfigs != undefined) {
			forceInitAddedConfigs = (syncConfig.lastMergeAddedNewConfigs == true ? true : false);
			syncConfig.lastMergeAddedNewConfigs = undefined;
		}

		this.asyncCollectionsPending = { 'type': 'request', 'wait': [], 'start': start, 'dom': dom };
		for (var idx in config.categories) {
			var category = config.categories[idx];
			var list = syncConfig[category];
			var cnt = list.configured.length;
			devTools.writeMsg('sync', 'request', category + ': #' + cnt);

			for (var i=0; i<cnt; i++) {
				var selConf = list.configured[i];
				if (selConf.syncKey == undefined)
					selConf.syncKey = 0;

				// skip already synced syncConfigs
				if (forceInitAddedConfigs && selConf.syncKey > 0)
					continue;

				var async = Object();
				async.complete = false;
				async.category = category;
				async.syncKey = selConf.syncKey;
				async.local = selConf.local;
				async.remote = selConf.remote;
				var collection = this.createCollection(async);

				// needs async polling?
				if (async.complete == false) {
					this.asyncCollectionsPending.wait.push(async);
					continue;
				}
				if (collection != null)
					dom.lastChild.appendChild(collection);
			}
		}

		// start async timer, if needed
		if (this.requestAsyncTimer() == true) {
			return true;
		}
		
		// no wait required
		this.asyncCollectionsPending = undefined;
	// poll async request completion
	} else {
		start = this.asyncCollectionsPending.start;
		dom = this.asyncCollectionsPending.dom;
		var i = 0;
		while (this.asyncCollectionsPending.wait.length > i) {
			var async = this.asyncCollectionsPending.wait[i];
			if (async.complete == true) {
				var collection = this.createCollection(async);
				if (collection != null)
					dom.lastChild.appendChild(collection);
				this.asyncCollectionsPending.wait.splice(i, 1);
			} else
				i += 1;
		}

		// restart async timer, if needed
		if (this.requestAsyncTimer() == true)
			return true;
	}

	// don't send empty collections
	if (dom.childNodes.length == 0)
		return false;

	config.addSyncInfos('start');

	// asynchronous -> ends up in this.dispatch()
	wbxml.httpRequest(dom);

	this.asyncCollectionsPending = undefined;
	devTools.writeMsg('sync', 'request', 'send in ' + ((Date.now() - start) / 1000).toFixed(3) + ' s');

	return true; // to avoid warnings
  },

  requestAsyncTimer: function() {
	var result = false;

	if (this.asyncCollectionsPending.wait.length > 0) {
		if (this.asyncCollectionsPending.timeout == undefined)
			this.asyncCollectionsPending.timeout = 0;

		// increase timeout
		if (this.asyncCollectionsPending.timeout < 50)
			this.asyncCollectionsPending.timeout += 10;
		else if (this.asyncCollectionsPending.timeout < 100)
			this.asyncCollectionsPending.timeout += 50;
		else
			this.asyncCollectionsPending.timeout = 250;

		window.setTimeout('sync.request();', this.asyncCollectionsPending.timeout);
		result = true;
	}

	return result;
  },

  response: function(req, err, asyncStatus) {
	var start = null;
	var syncStatus = null;
	var syncConfig = config.getSyncConfig();

	config.addSyncInfos('stop');

	if (this.asyncCollectionsPending == undefined) {
		start = Date.now();
		if (err != undefined) {
			config.lastSyncStatus = -1;
			return false;
		}

		// config.lastSyncStatus = 0;
		var resText = req.responseText;
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
			//devTools.leave('sync', 'response', 'empty response: dispGoTo ' + this.dispGoTo + ', dispatcher ' + JSON.stringify(this.dispatcher));
			// stop infinite loop
			this.dispGoTo = '';
			this.dispatcher = [ 'finish' ];
			devTools.leave('sync', 'response', 'empty response ' + (syncConfig.lastSyncDuration != undefined ? ' (' + syncConfig.lastSyncDuration/1000 + ' s)' : ''));
			return true; // empty response -> no changes / no syncKey change
		}
		
		var dom = wbxml.doXml(resText);		
		// Sync Status (this one is different to Collection Status and only defined if no Collection stati are present!)
		if(typeof helper.doEvaluateXPath(dom, "/Sync/Status")[0] == 'undefined') {
			syncStatus = 1;
		} else {
			syncStatus = helper.doEvaluateXPath(dom, "/Sync/Status")[0].firstChild.nodeValue;
		}
	
		// init async handler
		this.asyncCollectionsPending = { 'type': 'response', 'wait': [], 'start': start };
		
		if (syncStatus == 1) {
			// process configured categories
			for (var idx in config.categories) {
				var category = config.categories[idx];
				var cnt = syncConfig[category].configured.length;
	
				for (var i=0; i<cnt; i++) { 
					var selConfig = syncConfig[category].configured[i];
					var remote = selConfig.remote;
	
					var selCollection = helper.doEvaluateXPath(dom, "/Sync/Collections/Collection[CollectionId='"+remote+"']");
	
					if (selCollection.length > 0) {
						var status = helper.doEvaluateXPath(selCollection[0], "//Status");
		//				devTools.writeMsg('sync', 'response', 'status[0]: ' + wbxml.domStr(status[0]));
						if (status[0].firstChild.nodeValue == 7)
							selConfig.syncStatus = 7;
						else if (status[0].firstChild.nodeValue != 1) {
		//					devTools.leave("sync", "response", "status: " + status[0].firstChild.nodeValue);
							selConfig.syncStatus = status[0].firstChild.nodeValue;
							continue;
						} 
	
						var syncKey = helper.doEvaluateXPath(selCollection[0], "//SyncKey");
						if(typeof syncKey[0].firstChild.nodeValue != 'undefined')
							selConfig.syncKey = syncKey[0].firstChild.nodeValue;
	
						var async = {complete: false};
						async.category = category;
						async.local = selConfig.local;
						async.responses = helper.doEvaluateXPath(dom, "/Sync/Collections/Collection[CollectionId='"+remote+"']/Responses");
						async.commands = helper.doEvaluateXPath(dom, "/Sync/Collections/Collection[CollectionId='"+remote+"']/Commands");
						this.applyCollection(async);

						// needs async polling?
						if (async.complete == false) {
							this.asyncCollectionsPending.wait.push(async);
							continue;
						}
					} else {
						devTools.writeMsg('sync', 'response', 'no data for remote ' + remote);
					}
				}
			}
			
			// start async timer, if needed
			if (this.responseAsyncTimer() == true) {
				asyncStatus.running = true;
				return true;
			}

			// release async handler
			this.asyncCollectionsPending = undefined;
		}
	} else {
		start = this.asyncCollectionsPending.start;
		syncStatus = 1;
		var i = 0;
		while (this.asyncCollectionsPending.wait.length > i) {
			var async = this.asyncCollectionsPending.wait[i];
			if (async.complete == true) {
				this.asyncCollectionsPending.wait.splice(i, 1);
			} else
				i += 1;
		}

		// restart async timer, if needed
		if (this.requestAsyncTimer() == true) {
			asyncStatus.running = true;
			return true;
		}
		
		// release async handler
		this.asyncCollectionsPending = undefined;
	}
	
	devTools.leave('sync', 'response', 'syncStatus ' + syncStatus + (syncConfig.lastSyncDuration != undefined ? ' (' + (syncConfig.lastSyncDuration/1000).toFixed(3) + ' s)' : '') + ', processed in ' + ((Date.now() - start) / 1000).toFixed(3) + ' s');
	return syncStatus;
  },

  responseAsyncTimer: function() {
	var result = false;

	if (this.asyncCollectionsPending.wait.length > 0) {
		if (this.asyncCollectionsPending.timeout == undefined)
			this.asyncCollectionsPending.timeout = 0;

		// increase timeout
		if (this.asyncCollectionsPending.timeout < 50)
			this.asyncCollectionsPending.timeout += 10;
		else if (this.asyncCollectionsPending.timeout < 100)
			this.asyncCollectionsPending.timeout += 50;
		else
			this.asyncCollectionsPending.timeout = 250;

		window.setTimeout('sync.dispatch();', this.asyncCollectionsPending.timeout);
		result = true;
	}

	return result;
  },

  createCollection: function(async) {
	var result = null;

	//devTools.writeMsg('sync', 'createCollection', 'add ' + type + '[' + i + '], syncKey: ' + syncKey);
	switch (async.category) {
		case 'contacts':
			result = this.createContactCollection(async.syncKey, async.local, async.remote);
			// contacts are always read in sync
			async.complete = true;
	  		break;
		case 'calendars':
			// calendars are always read in async
			result = this.createCalendarCollection(async);
	  		break;
		case 'tasks':
			// calendars are always read in async
			result = this.createTaskCollection(async);
	  		break;
	}

	return result;
  }, 

  createContactCollection: function(syncKey, local, remote) {
	var doc = document.implementation.createDocument("", "", null);

	// collections -> Collection
	var commands = null;
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
		// collections -> Collection -> Supported
		dom.appendChild( ttineAb.supportedDom() );
		// collections -> Collection -> Options
		dom.appendChild(doc.createElement('Options')); 
		dom.appendChild(doc.createElement('GetChanges'));
		dom.lastChild.appendChild(doc.createElement('Class'));
		dom.lastChild.lastChild.appendChild(doc.createTextNode('Contacts')); 
		// queue next request (get entries with key of 1)
		this.runExtraSync();
	} else { 
		// collections -> Collection -> GetChanges?
		dom.appendChild(doc.createElement('GetChanges'));
		// collections -> Collection -> Commands
		commands = ttineAb.commandsDom(local); 
		if (commands != null) {
			dom.appendChild(doc.createElement('Commands'));
			for(var i = 0; i<commands.length; i++)
				dom.lastChild.appendChild(commands[i]);
		} 
	}
	devTools.leave('sync', 'createContactCollection', "syncKey: " + syncKey + ", remoteFolder: " + remote + (syncKey != 0 ? ', commands: #' + (commands != null ? commands.length : 0) : ''));
	return dom;
  }, 

  createCalendarCollection: function(async) {
	if (config.enableExperimentalCode == false) {
		async.complete = true;
		return null;
	}

	// no lightning
	if (config.isCalendarAccessible() == false) {
		async.complete = true;
		return null;
	}

	var cal = config.getCalByUri(async.local, true);
	// calendar seems to be deleted 
	if (cal.calendar == undefined) {
		async.complete = true;
		async.aborted = true;
		return null;
	}

	var syncKey = async.syncKey;
	var remote = async.remote;
	
	var doc = document.implementation.createDocument("", "", null);

	// collections -> Collection
	var dom = doc.createElement('Collection');

	// collections -> Collection -> Class
	dom.appendChild(doc.createElement('Class'));
		dom.lastChild.appendChild(doc.createTextNode('Calendar'));

	// collections -> Collection -> SyncKey
	dom.appendChild(doc.createElement('SyncKey')); 
		dom.lastChild.appendChild(doc.createTextNode(syncKey));

	// collections -> Collection -> CollectionId
	dom.appendChild(doc.createElement('CollectionId'));
		dom.lastChild.appendChild(doc.createTextNode(remote));

	if (syncKey == 0) {
		// syncKey == 0 doesn't requires async reads
		async.complete = true;
		// collections -> Collection -> Supported
		dom.appendChild( ttineCal.supportedDom() );
		// collections -> Collection -> Options
		dom.appendChild(doc.createElement('Options'));
		dom.appendChild(doc.createElement('GetChanges'));
		dom.lastChild.appendChild(doc.createElement('Class'));
		dom.lastChild.lastChild.appendChild(doc.createTextNode('Calendar')); 
		this.runExtraSync();
	} else {
		if (async.complete == false) {
			return ttineCal.commandsDom(async);
		} else {
			// collections -> Collection -> GetChanges?
			dom.appendChild(doc.createElement('GetChanges'));
			var changes = async.changes; 
			if (changes != null) {
				for(var i = 0; i<changes.length; i++)
					dom.lastChild.appendChild(changes[i]);
			}
			// collections -> Collection -> Commands
			var commands = async.commands; 
			if (commands != null) {
				dom.appendChild( doc.createElement('Commands') );
				for(var i = 0; i<commands.length; i++)
					dom.lastChild.appendChild(commands[i]);
			}
		}
	}
	devTools.leave('sync', 'createCalendarCollection', "syncKey: " + syncKey + ", remoteFolder: " + remote + (async.commands != undefined ? ', commands: #' + async.commands.length : '') + (async.changes != undefined ? ', changes: #' + async.changes.length : ''));
	return dom;
  },

  createTaskCollection: function(async) {
	async.complete = true;
	if (config.enableExperimentalCode == false)
		return null;

	// no lightning
	if (config.isCalendarAccessible() == false)
		return null;

	return null;
  }, 

  applyCollection: function(async) {
	switch (async.category) {
		case 'contacts':
			this.applyContactsCollection(async);
			// contacts are always written in sync
			async.complete = true;
		  	break;
		case 'calendars':
			this.applyCalendarCollection(async);
		  	break;
		case 'tasks':
			this.applyTasksCollection(async);
		  	break;
	}
  },

  applyContactsCollection: function(async) {
	var uri = async.local;
	var responses = async.responses;
	var commands = async.commands;
	
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
				if (cStatus == 8) {
					ttineAb.removeCard(uri, (cServerId ? cServerId : cClientId));
				}
				continue;
			} 

			if (cardDom.nodeName == 'Add')
				ttineAb.responseCard(uri, cClientId, Array("TineSyncId", 'TineSyncMD5'), Array(cServerId, '') ); 
			else if (cardDom.nodeName == 'Change')
				ttineAb.responseCard(uri, cServerId, Array('TineSyncMD5'), Array('') );
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
				ttineAb.commandCard(uri, cardDom.nodeName, cServerId, cAppData); 
			}
		}
	}

	// keep track of cards for deleting
	ttineAb.managedCards(uri);
  }, 

  applyCalendarCollection: function(async) {
	  ttineCal.applyCollection(async);
  }, 

  applyTasksCollection: function(uri, responses, commands) {
	devTools.writeMsg('sync', 'applyTasksCollection', 'uri: ' + uri + '\n\nresponses: ' + (responses.length > 0 ? wbxml.domStr(responses[0]) : responses) + '\n\ncommands: ' + (commands.length > 0 ? wbxml.domStr(commands[0]) : commands));
	/*
	 * MISSING: calendar and tasks
	 */
  },
  
  initManagedCards: function() {
	var syncConfig = config.getSyncConfig();

	// restore managedCards arrays
	for (var idx in config.categories) {
		var category = config.categories[idx];
		var list = syncConfig[category];

		var cnt = list.configured.length;
		for (var i=0; i<cnt; i++) {
			var selConf = list.configured[i];

			var async = Object();
			async.complete = false;
			async.category = category;
			async.syncKey = selConf.syncKey;
			async.local = selConf.local;
			async.remote = selConf.remote;

			switch (async.category) {
				case 'contacts':
					ttineAb.managedCards(async.local);
					devTools.writeMsg('ttineAb', 'managedCards', 'init remote: ' + selConf.remote + ' #' + selConf.managedCards.length);
					// contacts are always read in sync
					async.complete = true;
			  		break;
				case 'calendars':
					// calendars are always read in async
					ttineCal.managedCards(async);
			  		break;
				case 'tasks':
					// calendars are always read in async
					//ttineCal.managedCards(async);
			  		break;
			}
		}
	}
  }
};
