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

  update: function() {
	devTools.enter('folder', 'update');
	var folders = config.getFolders();
	
	// ask folders
	var folderRequest = '<?xml version="1.0" encoding="UTF-8"?>'+"\n"+
		'<FolderHierarchy_FolderSync><FolderHierarchy_SyncKey>' + 
		(folders.syncKey == undefined ? 0 : folders.syncKey) + 
		'</FolderHierarchy_SyncKey></FolderHierarchy_FolderSync>';
	wbxml.httpRequest(folderRequest, 'FolderSync'); 
	devTools.leave('folder', 'update');
  }, 

  updateFinish: function(req) { 
	devTools.enter('folder', 'updateFinish');
	var syncConfig = config.getSyncConfig();
	var folders = config.getFolders();
	
	var response = wbxml.doXml(req.responseText); 
	if (response == false) {
		devTools.leave('folder', 'updateFinish', 'response == false');
		return false;
	}

	for (var i = 0; i < response.firstChild.childNodes.length; i++) {
		var currNode = response.firstChild.childNodes[i];
		// status
		if (response.firstChild.childNodes[i].nodeName == 'Status' && currNode.firstChild.nodeValue != '1') {
			helper.prompt(errortxt.folder['code'+currNode.firstChild.nodeValue]);
			devTools.leave('folder', 'updateFinish', 'status: ' + currNode.firstChild.nodeValue);
			return false;
		}
		else if (currNode.nodeName == 'FolderHierarchy_SyncKey')
			folders.syncKey = currNode.firstChild.nodeValue;
		else if (currNode.nodeName == 'FolderHierarchy_Changes' && currNode.childNodes.length > 0) {
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
						var type = null, subType = null, special = null;

						switch (serverType) {
						 	// email
							case '2':
							case '4':
							case '5':
							case '12':
								type = 'email';
								special = (serverType == 2 ? 'inbox' : (serverType == 4 ? 'trash' : (serverType == 5 ? 'send' : null))); 
								break;
							// contacts
							case '9':
							case '14':
								type = 'contacts';
								subType = (serverType == 9 ? 'private' : (serverType == 14 ? 'shared' : null)); 
								break;
							// calendars
							case '8':
								type = 'calendars';
								break;
							// tasks
							case '7': 
								type = 'tasks';
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
							jsonStr += ' }';
	
							//config.addFolder(syncConfig, type, JSON.parse(jsonStr));
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
		} 
	}
	
	devTools.leave('folder', 'updateFinish', 'folders: contacts ' + folders.contacts.length + ', calendars '+ folders.calendars.length + ', tasks '+ folders.tasks.length);
	return true;
  }
}
