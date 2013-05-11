/*

Copyright (C) 2013 by XXX

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; version 2
of the License ONLY.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

*/

var dialog = {
    category : null,
	prefSuffix: null,
	  
	reset: function() {
		var dialogSelectOptions = this.getSelectOptions();
		dialogSelectOptions.selectedIndex = -1;
		  
		dialogSelectOptions.removeChild(dialogSelectOptions.firstChild);
		dialogSelectOptions.appendChild(document.createElement("menupopup"));
	},
	  
	open: function(configOptions) {
		window.openDialog(
			"chrome://ttine/content/thunderbirdDialog.xul",
			"ttine-dialog-window", 
			"chrome,modal,toolbar,centerscreen", 
			configOptions
		);
	},
	  
	onOpen: function() {
		var dialogSelectOptions = this.getSelectOptions();
		var configOptions = window.arguments[0];

		this.reset();
		this.category = configOptions.category;
		switch (this.category) {
		case 'contacts':
			this.prefSuffix = 'Addressbook';
			break;
		case 'calendars':
			this.prefSuffix = 'Calendar';
			break;
		case 'tasks':
			this.prefSuffix = 'Task';
			break;
		}

		var ttine = window.opener.ttine;

		if (configOptions.configure != undefined) {
			var selectedItem = config.parseJSONFromString(configOptions.selectedItem);
			var dialogLabel = document.getElementById('dialogLabel');
			var dialogOptionLabel = document.getElementById('dialogOptionLabel');
			  
			// selection
			if (configOptions.selectItems.length > 0) {
				var selIdx = -1;
				for (var i=0;i<configOptions.selectItems.length;i++) {
					var selectItem = config.parseJSONFromString(configOptions.selectItems[i]);
		
					//devTools.writeMsg('dialog', 'reset', 'item: ' + selectItem);
					if (selectItem != null) {
						if (selectedItem.label.toLowerCase() == selectItem.label.toLowerCase())
							selIdx = i;
						this.addSelectOption(selectItem.label, selectItem.value);
					}
				}
				dialogSelectOptions.selectedIndex = (selIdx > 0 ? selIdx : 0);
			}
			// prepare dialog
			if (configOptions.configure == "local") {
				var ab = config.getAbByUri(selectedItem.value);
				let cards = ab.childCards;
				var cnt = 0;
				while (cards.hasMoreElements()) {
					cnt++;
					cards.getNext();
				}
				dialogLabel.textContent = ttine.strings.getString('syncConfigLocal' + this.prefSuffix) + " '" + ab.dirName + "' (" + cnt + " " + ttine.strings.getString('syncConfigEntries') + ") " + ttine.strings.getString('syncConfigSyncWith');
				dialogOptionLabel.label = ttine.strings.getString('syncConfigRemoteDirectory');
			}
			if (configOptions.configure == "remote") {
				dialogLabel.textContent = ttine.strings.getString('syncConfigRemoteDirectory') + " '" + selectedItem.label + "' " + ttine.strings.getString('syncConfigSyncWith');
				dialogOptionLabel.label = ttine.strings.getString('syncConfigLocal' + this.prefSuffix);
				  
				// new entry at the end of list
				this.addSelectOption('[' + ttine.strings.getString('addNewMenuItem') + ']', null);
			}
		}
	},
	  
	getSelectOptions: function() {
		return document.getElementById('dialogSelectOptions');
	},

	addSelectOption: function(label, value, node) {
		//devTools.enter('dialog', 'addSelectOption', 'label ' + label + ', value ' + value);
		var refNode = (node != undefined ? node : null);
		  
		var dialogSelectOptions = this.getSelectOptions();
		var ab = document.createElement('menuitem');
		  
		ab.setAttribute('label', label);
		ab.setAttribute('value', value);
		dialogSelectOptions.firstChild.insertBefore(ab, refNode);
		//devTools.leave('dialog', 'addSelectOption');
	},
	  
	calCreateCallback: function(e) {
		devTools.writeMsg('dialog', 'calCreateCallback', 'arguments ' + (arguments != undefined ? arguments.length : arguments));
	},
	  
	onDialogClose: function(flag) {
		var dialogSelectOptions = this.getSelectOptions();
		var selectedOption = dialogSelectOptions.selectedItem;
			
		if (flag == true) {
			var selectedValue = selectedOption.getAttribute('value');
			 
			if (this.category == 'contacts' || this.category == 'calendars' || this.category == 'tasks') {
				// new option selected
				if (selectedValue == '') {
					// open modal dialog from here
					if (this.category == 'contacts')
						window.openDialog("chrome://messenger/content/addressbook/abAddressBookNameDialog.xul", "", "chrome,modal=yes,resizable=no,centerscreen", null);
					if (this.category == 'calendars' || this.category == 'tasks')
						window.openDialog("chrome://calendar/content/calendarCreation.xul", "caEditServer", "chrome,titlebar,modal,centerscreen", function(e) { this.calCreateCallback(e); } );
				
					// process changes
					var addedAb = window.opener.newAb(this.category, true);
						
					// no new ab created
					if (addedAb == null)
						return false;
						
					// update selectedOption
					this.addSelectOption(addedAb.dirName, addedAb.URI, selectedOption);
					dialogSelectOptions.selectedIndex -= 1;
					selectedValue = addedAb.URI;
					return false;
				}
			}
			window.opener.processUserSelection(this.category, selectedValue);
		} 

		return true;
	}
}