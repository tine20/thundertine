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

var folder = {

  /*
   *
   * update FolderHierarchy
   *
   */

  isResponsePending: function(folders) {
//	devTools.enter('folder', 'isResponsePending', 'folders ' + folders);
	var result = false;

	if (folders != undefined) {
		if (folders.lastSyncTime != undefined && folders.lastSyncDuration == undefined) {
			// toDo ask timeout
			result = true;
		}
		if (folders.action != undefined) {
			//result = true;
		}
	}
	
//	devTools.leave('folder', 'isResponsePending', 'result ' + result);
	return result;
  }, 
  
  addSyncInfos: function(folders, action) {
//	devTools.enter('folder', 'addSyncInfos', 'action: ' + action);
	if (folders != undefined) {
		switch(action) {
			case 'start':
				folders.lastSyncDuration = undefined;
				folders.lastSyncTime = Date.now();
				break;
			case 'stop':
				folders.lastSyncDuration = (Date.now() - folders.lastSyncTime); 
				folders.lastSyncTime = Date.now();
				break;
		}
	}
//	devTools.leave('folder', 'addSyncInfos');
  },
  
  serverTypeToLocal: function(serverType) {
	var type = null;
	
	switch (serverType) {
	 	// email
		case '2':	// inbox
		case '3':	// drafts
		case '4':	// trash
		case '5':	// sent
		case '6':	// outbox
		case '12':	// user created
			type = 'email';
			break;
		// contacts
		case '9':	// default
		case '14':	// user created
			type = 'contacts';
			break;
		// calendars
		case '8':	// default
		case '13':	// user created
			type = 'calendars';
			break;
		// tasks
		case '7': 	// default
		case '15':	// user created
			type = 'tasks';
			break;
		// notes
		case '10': 	// default
		case '17':	// user created
			type = 'notes';
			break;
		// journals
		case '11': 	// default
		case '16':	// user created
			type = 'journals';
			break;
		// others
		default: 
			devTools.writeMsg('folders', 'serverTypeToLocal', 'unkonwn folder type: ' + serverType);
			break;
	}

	return type;
  },
  
  syncFolder: function(notifyOptionDlg) {
	return this.initAction('Sync', undefined, undefined, undefined, undefined, notifyOptionDlg); 
  }, 

  createFolder: function(parentId, serverType, name, notifyOptionDlg) {
	return this.initAction('Create', undefined, parentId, serverType, name, notifyOptionDlg); 
  }, 

  deleteFolder: function(serverId, notifyOptionDlg) {
	return this.initAction('Delete', serverId, undefined, undefined, undefined, notifyOptionDlg); 
  }, 

  updateFolder: function(serverId, parentId, name, notifyOptionDlg) {
	return this.initAction('Update', serverId, parentId, undefined, name, notifyOptionDlg); 
  }, 

  initAction: function(name, pServerId, pParentId, pServerType, pName, notifyOptionDlg) {
	var folders = config.getFolders();

	// running action?
	if (this.isResponsePending(folders)) {
		devTools.leave('folders', 'initAction', 'isResponsePending false');
		return false;
	}
		
	// parameter check
	if (pServerType != undefined && this.serverTypeToLocal(pServerType) == null) {
		devTools.leave('folders', 'initAction', 'serverType null');
		return false;
	}
	
	folders.action = { }
	folders.action.name = name;
	if (pServerId != undefined)
		folders.action.pServerId = pServerId;
	if (pParentId != undefined)
		folders.action.pParentId = pParentId;
	if (pServerType != undefined)
		folders.action.pServerType = pServerType;
	if (pName != undefined)
		folders.action.pName = pName;
	if (notifyOptionDlg != undefined)
		folders.action.notifyOptionDlg = 'y';
	
//	devTools.leave('folders', 'initAction', 'true');
	return true;
  },

  performAction: function() {
//	devTools.enter('folder', 'performAction');
	var folders = config.getFolders();
	var syncKey = (folders.syncKey == undefined ? 0 : folders.syncKey); 

	// reset retryCounter
	if (folders.retryCounter != undefined)
		folders.retryCounter = undefined;

	if (folders == undefined || (folders != undefined && folders.action == undefined)) {
		devTools.leave('folder', 'performAction', 'no action false');
		return false;
	}
	
	devTools.writeMsg('folders', 'performAction', 'name: ' + folders.action.name);
	
	var folderRequest = '<?xml version="1.0" encoding="UTF-8"?>'+"\n";
	folderRequest += '<FolderHierarchy_Folder' + folders.action.name + '>'; 
	folderRequest += '<FolderHierarchy_SyncKey>' + syncKey + '</FolderHierarchy_SyncKey>';
	switch(folders.action.name) {
		case 'Sync':
			break;
		case 'Create':
			folderRequest += '<FolderHierarchy_ParentId>' + folders.action.pParentId + '</FolderHierarchy_ParentId>'; 
			folderRequest += '<FolderHierarchy_Type>' + folders.action.pServerType + '</FolderHierarchy_Type>';
			folderRequest += '<FolderHierarchy_DisplayName>' + folders.action.pName + '</FolderHierarchy_DisplayName>';
			break;
		case 'Delete':
			folderRequest += '<FolderHierarchy_ServerId>' + folders.action.pServerId + '</FolderHierarchy_ServerId>';
			break;
		case 'Update':
			folderRequest += '<FolderHierarchy_ServerId>' + folders.action.pServerId + '</FolderHierarchy_ServerId>';
			folderRequest += '<FolderHierarchy_ParentId>' + folders.action.pParentId + '</FolderHierarchy_ParentId>'; 
			folderRequest += '<FolderHierarchy_DisplayName>' + folders.action.pName + '</FolderHierarchy_DisplayName>';
			break;
		default:
			devTools.leave('folder', 'performAction', 'unkonwon action false');
			return false;
			break;
	}
	folderRequest += '</FolderHierarchy_Folder' + folders.action.name + '>';
			
//	devTools.writeMsg('folder', 'performAction', 'request: ' + folderRequest);
	wbxml.httpRequest(folderRequest, 'Folder' + folders.action.name);
	
	this.addSyncInfos(folders, 'start');

//	devTools.leave('folder', 'performAction', 'true');
	return true;
  },

  finishAction: function(req, err) {
//	devTools.enter('folder', 'performAction', 'req ' + req + ', err ' + err);
	var folders = config.getFolders();
	var result = false;

	this.addSyncInfos(folders, 'stop');

	if (req == undefined) {
		folders.lastSyncStatus = -1;
		folders.action = undefined;
		return false;
	}
	
	if (err != undefined) {
		devTools.writeMsg('folder', 'finishAction', 'err ' + JSON.stringify(err));
	}
	
	var response = wbxml.doXml(req.responseText); 
	if (response == false) {
//		devTools.leave('folder', 'finishAction', 'response: no parsable xml\ntext: ' + req.responseText);
		folders.lastSyncStatus = -1;
		folders.action = undefined;
		return false;
	}
//	devTools.writeMsg('folder', 'finishAction', 'response: ' + (response != null ? wbxml.domStr(response) : 'null'));

	switch(folders.action.name) {
		case 'Sync':
			result = this.syncFinish(response, req, err);
			break;
		case 'Create':
		case 'Delete':
		case 'Update':
			result = this.createDeleteOrUpdateFinish(folders.action.name, response, req, err);
			break;
		default:
			break;
	}
	
	if (folders.action.notifyOptionDlg != undefined)
		remoteFoldersFinish(err);
	
	// if sync ends up in http 500
	// we need a second run (folders.action is required)
	if (err == undefined || (err != undefined && err.retryLastAction == undefined))
		folders.action = undefined;
	
//	devTools.leave('folder', 'performAction', result + (err != undefined ? ' (err: ' + JSON.stringify(err) + ')' : ''));
	return result;
  },
  
  createDeleteOrUpdateFinish: function(action, response, req, err) {
	var folders = config.getFolders();
	var result = false;

	var serverId = null, syncKey = null;
	for (var i = 0; i < response.firstChild.childNodes.length; i++) {
		var currNode = response.firstChild.childNodes[i];
//		devTools.writeMsg('folder', 'createDeleteOrUpdateFinish', 'nodeName ' + currNode.nodeName);
		var subtag_value = currNode.firstChild.nodeValue;

		switch (currNode.nodeName) {
			case 'FolderHierarchy_Status':
				folders.lastSyncStatus = subtag_value;
				if (folders.lastSyncStatus != '1') {
					helper.prompt(errortxt.folder['code'+currNode.firstChild.nodeValue]);
					devTools.leave('folder', 'createFinish', 'status ' + folders.lastSyncStatus);
					return false;
				}
				break;
			case 'FolderHierarchy_SyncKey':
				syncKey = subtag_value;
				break;
			case 'FolderHierarchy_ServerId':
				serverId = (subtag_value != null && subtag_value != '0' ? subtag_value : null);
				break;
			default:
				devTools.writeMsg('folder', 'createDeleteOrUpdateFinish', 'unhandled node: ' + currNode.nodeName + ' ' + (currNode.firstChild != undefined ? currNode.firstChild.nodeValue : 'no child'));
				break;
		}
	}

	switch (action) {
		case 'Create':
			var type = this.serverTypeToLocal(folders.action.pServerType);
//			devTools.writeMsg('folder', 'createDeleteOrUpdateFinish', 'syncKey ' + syncKey + ', serverId ' + serverId + ', serverType ' + folders.action.pServerType + ', type ' + type);
			if (serverId != null && syncKey != null && type != null) {
				var jsonStr = '{ "name": "' + folders.action.pName + '", "id": "' + serverId + '"';
				jsonStr += (folders.action.pParentId != '0' ? ', "parent": "' + folders.action.pParentId + '"' : '');
				jsonStr += ' }';
	
				config.addFolder(type, JSON.parse(jsonStr));
				result = true;
			}
			break;
		case 'Delete':
//			devTools.writeMsg('folder', 'createDeleteOrUpdateFinish', 'syncKey ' + syncKey);
			if (syncKey != null) {
				config.removeFolder(folders.action.pServerId);
				result = true;
			}
			break;
		case 'Update':
			var folder = config.getFolder(undefined, folders.action.pServerId);
			folder.name = folders.action.pName;
			if (folders.action.pParentId != '0')
				folder.parent = folders.action.pParentId;
			result = true;
			break;
	}	

	if (result == true) {
		folders.syncKey = syncKey;
	}
	
	devTools.leave('folder', 'createDeleteOrUpdateFinish', 'folders: syncKey ' + folders.syncKey + ', contacts ' + folders.contacts.length + ', calendars '+ folders.calendars.length + ', tasks '+ folders.tasks.length + (folders.lastSyncDuration != undefined ? ' (' + folders.lastSyncDuration/1000 + ' s)' : ''));
	return result;
  }, 

  syncFinish: function(response, req, err) { 
	var folders = config.getFolders();
	
	if (err != undefined) {
		folders.lastSyncStatus = -1;

		// added folders on server results in http 500
		if (err.reason == 'http' && err.status == 500) {
			// arm for retry folder snyc 
			if (folders.retryCounter == undefined) {
				devTools.writeMsg('folder', 'syncFinish', 'start retry');
				folders.retryCounter = 1;
				err.retryLastAction = true;
				err.dontPromptUser = true;
			}
		} else
			// clear retry folder snyc 
			if (folders.retryCounter == undefined) {
				devTools.writeMsg('folder', 'syncFinish', 'stop retry');
				folders.retryCounter = undefined;
			}

		return false;
	}
	
	for (var i = 0; i < response.firstChild.childNodes.length; i++) {
		var currNode = response.firstChild.childNodes[i];
		// status
		if (currNode.nodeName == 'FolderHierarchy_Status') {
			folders.lastSyncStatus = currNode.firstChild.nodeValue;
			
			if (folders.lastSyncStatus != '1') {
				helper.prompt(errortxt.folder['code'+currNode.firstChild.nodeValue]);
				return false;
			}
		} else if (currNode.nodeName == 'FolderHierarchy_SyncKey') {
			folders.syncKey = currNode.firstChild.nodeValue;
		} else if (currNode.nodeName == 'FolderHierarchy_Changes') {
			var cnt = response.firstChild.childNodes[i].childNodes.length;

			for (var c=0; c<cnt; c++) {
				var node = currNode.childNodes[c];
				var action = null;

				switch (node.nodeName) {
					case 'FolderHierarchy_Add':
					case 'FolderHierarchy_Update':
						action = 'add';
						break;
					case 'FolderHierarchy_Delete':
						action = 'delete';
						break;
					default:
						continue;
						break;
				}
				
				if (action == 'add') {
					var aCnt = node.childNodes.length;
					var serverId = null, serverName = null, serverType = null, serverParent = null;
					
					for (var f=0; f<aCnt; f++) { 
						var subtag_value = node.childNodes[f].firstChild.nodeValue;
						
						switch (node.childNodes[f].nodeName) {
							case 'FolderHierarchy_ServerId':
								serverId = subtag_value;
								break;
							case 'FolderHierarchy_DisplayName': 
								serverName = subtag_value;
								break;
							case 'FolderHierarchy_Type':
								serverType = subtag_value;
								break;
							case 'FolderHierarchy_ParentId':
								serverParent = (subtag_value != null && subtag_value != '0' ? subtag_value : null);
								break;
						}
					}

					if (serverId != null && serverName != null && serverType != null) {
						var subType = null, stdFolder = false;
						var type = this.serverTypeToLocal(serverType); 

						switch (type) {
							case 'email':
								subType = (serverType == '2' ? 'inbox' : (serverType == '3' ? 'draft' : (serverType == '4' ? 'trash' : (serverType == '5' ? 'sent' : (serverType == '6' ? 'outbox' : null))))); 
								break;
							case 'contacts':
								stdFolder = (serverType == '9'); 
								break;
							case 'calendars':
								stdFolder = (serverType == '8'); 
								break;
							case 'tasks': 
								stdFolder = (serverType == '7'); 
								break;
							// others
							default: 
								devTools.writeMsg('folders', 'updateFinish', 'unkonwn folder type: ' + serverType + '\n\n' + wbxml.domStr(node));
								break;
						}

						if (type != null) {
							var jsonStr = '{ "name": "' + serverName + '", "id": "' + serverId + '"';
							jsonStr += (serverParent != null ? ', "parent": "' + serverParent + '"' : '');
							jsonStr += (subType != null ? ', "type": "' + subType + '"' : '');
							jsonStr += (stdFolder == true ? ', "stdFolder": true' : '');
							jsonStr += ' }';
	
							config.addFolder(type, JSON.parse(jsonStr));
						}
					}
				}
				
				if (action == 'delete') {
					var aCnt = node.childNodes.length;
					var serverId = null;
					
					for (var f=0; f<aCnt; f++) { 
						var subtag_value = node.childNodes[f].firstChild.nodeValue;
						
						switch (node.childNodes[f].nodeName) {
							case 'FolderHierarchy_ServerId':
								serverId = subtag_value;
								break;
						}
					}

					if (serverId != null)
						config.removeFolder(serverId);
				}
			}
		} else {
			devTools.writeMsg('folder', 'syncFinish', 'unhandled node: ' + currNode.nodeName + ' ' + (currNode.firstChild != undefined ? currNode.firstChild.nodeValue : 'no child'));
 		}
	}
	
	devTools.leave('folder', 'syncFinish', 'folders: syncKey ' + folders.syncKey + ', contacts ' + folders.contacts.length + ', calendars '+ folders.calendars.length + ', tasks '+ folders.tasks.length + (folders.lastSyncDuration != undefined ? ' (' + folders.lastSyncDuration/1000 + ' s)' : ''));
	return true;
  }
}
