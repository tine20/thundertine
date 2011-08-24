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
	// ask folders
	helper.debugOut("folder.update()\n");
	var folderRequest = ["FolderHierarchy_FolderSync", ["FolderHierarchy_SyncKey", config.folderSyncKey]];
	wbxml.httpRequest(folderRequest, 'FolderSync'); 
  }, 

  updateFinish: function(req) { 
	helper.debugOut("folder.updateFinish()\n");
	var response = wbxml.wbxml2obj(req.responseText), r, i, entry, folder_id, folder_name; 
	if (!response) {
		return false;
	}
	
	//{"FolderHierarchy_FolderSync":
	//   {"FolderHierarchy_Status":"1",
	//    "FolderHierarchy_SyncKey":"xxx",
	//    "FolderHierarchy_Changes":
	//       {"FolderHierarchy_Count":"20",
	//        "FolderHierarchy_Add":[
	//           {"FolderHierarchy_ServerId":"xxx",
	//            "FolderHierarchy_ParentId":"0",
	//            "FolderHierarchy_DisplayName":"Inbox",
	//            "FolderHierarchy_Type":"2"},
	//           {"FolderHierarchy_ServerId":"xxx",
	//            "FolderHierarchy_ParentId":"0",
	//            "FolderHierarchy_DisplayName":"Outbox",
	//            "FolderHierarchy_Type":"6"},
	//           ...
	//       ]}
	//   }
	//}

	if (config.folderSyncKey == 0) {	// first request
		config.folderIds = [];
		config.folderNames = [];
		config.folderTypes = []; 
	}
	
	if (response.FolderHierarchy_FolderSync.FolderHierarchy_Status != '1') {
		helper.prompt(errortxt.folder['code'+response.firstChild.children[i].firstChild.nodeValue]);
		return false;
	}

	config.folderSyncKey = response.FolderHierarchy_FolderSync.FolderHierarchy_SyncKey;
	
	r = response.FolderHierarchy_FolderSync.FolderHierarchy_Changes;
	if (r) {
		if (r.FolderHierarchy_Add) {
			for (i = 0; i < r.FolderHierarchy_Add.length; i++) {
				entry = r.FolderHierarchy_Add[i];
				config.folderIds.push(entry.FolderHierarchy_ServerId);
				config.folderNames.push(entry.FolderHierarchy_DisplayName);
				config.folderTypes.push(entry.FolderHierarchy_Type); 
			}
		}
		if (r.FolderHierarchy_Update) {
			for (i = 0; i < r.FolderHierarchy_Update.length; i++) {
				entry = r.FolderHierarchy_Update[i];
				folder_id = entry.FolderHierarchy_ServerId;
				folder_name = entry.FolderHierarchy_DisplayName;
				config.folderNames[config.folderIds.indexOf(folder_id)] = folder_name;
			}
		}
		if (r.FolderHierarchy_Delete) {
			for (i = 0; i < r.FolderHierarchy_Delete.length; i++) {
				entry = r.FolderHierarchy_Delete[i];
				folder_id = entry.FolderHierarchy_ServerId;
				config.folderNames.splice(config.folderIds.indexOf(folder_id), 1);
				config.folderTypes.splice(config.folderIds.indexOf(folder_id), 1);
				config.folderIds.splice(config.folderIds.indexOf(folder_id), 1);
			}
		}
	}
	return true;
  },

  /*
   * before sync make sure folder still exists
   */
  stillExists: function(collectionId) {
	return config.folderIds.indexOf(collectionId) >= 0;
  }, 

  /*
   * preference GUI needs this
   */
  listFolderIds: function(type) {
	var resArr = [], i;
	for (i=0; i<config.folderIds.length; i++) {
		if (type=='Contacts' && (config.folderTypes[i]==9 || config.folderTypes[i]==14)) {
			resArr.push(config.folderIds[i]);
		}
	}
	return resArr.length > 0 ? resArr : false;
  },

  listFolderNames: function(type) {
	var resArr = [], i;
	for (i=0; i<config.folderIds.length; i++) {
		if (type=='Contacts' && (config.folderTypes[i]==9 || config.folderTypes[i]==14)) {
			resArr.push(config.folderNames[i]);
		}
	}
	return resArr.length > 0 ? resArr : false;
  }

};
