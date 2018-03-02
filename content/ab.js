/*
 * 
 * Copyright (C) 2010 by Santa Noel
 * 
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * of the License ONLY.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 * 
 */

var ttineAb = {
	category: 'contacts',
  mapActiveSyncToThunderbird: {
  // mapping table for ActiveSync(property) -> Thunderbird(value)
  // ActiveSync						 Thunderbird		// additional ActiveSync settings
	"Contacts_FileAs": 				"DisplayName",
	"Contacts_FirstName": 			"FirstName",
	"Contacts_LastName": 			"LastName",
	"Contacts_MiddleName": 			"NickName",
	"Contacts_Email1Address": 		"PrimaryEmail",
	"Contacts_Email2Address": 		"SecondEmail",
	"Contacts_HomeStreet": 			"HomeAddress",
	"Contacts_HomeCity": 			"HomeCity",
	"Contacts_HomeState": 			"HomeState",
	"Contacts_HomePostalCode": 		"HomeZipCode",
	"Contacts_HomeCountry": 		"HomeCountry",
	"Contacts_BusinessStreet": 		"WorkAddress",
	"Contacts_BusinessCity": 		"WorkCity",
	"Contacts_BusinessState": 		"WorkState",
	"Contacts_BusinessPostalCode": 	"WorkZipCode",
	"Contacts_BusinessCountry": 	"WorkCountry",
	"Contacts_CompanyName": 		"Company",
	"Contacts_Department": 			"Department",
	"Contacts_JobTitle": 			"JobTitle",
	"Contacts_OfficeLocation": 		"Custom1",
	"Contacts_HomePhoneNumber": 	"HomePhone",
	"Contacts_BusinessPhoneNumber": "WorkPhone", 
	"Contacts_BusinessFaxNumber": 	"FaxNumber",
	"Contacts_HomeFaxNumber": 		"PagerNumber",
	"Contacts_MobilePhoneNumber": 	"CellularNumber",
	"Contacts_Birthday": 			"%Birthday",
	"Contacts_Webpage": 			"WebPage1",
	"Contacts_Suffix": 				"Custom2",
	"Contacts_Picture": 			"%Picture", 		// ghosted="true" applied in supportedDom()
	"Contacts_Categories": 			"%Categories"
  },

  supportedDom: function() {
	var doc = document.implementation.createDocument("", "", null);
	var data = doc.createElement('Supported');

	for (var property in this.mapActiveSyncToThunderbird) {
		data.appendChild(doc.createElement(property));
		if (property == 'Contacts_Picture')
			data.lastChild.setAttribute('ghosted', 'true');
	}

	return data;
  },

  getSpecialAbValue: function(card, field) {
	// create special fields (those marked in map with a "%") for ActiveSync
	var ret = '';
	if (field.substr(0,1) == '%')
		field = field.substr(1, field.length-1);
	// Anniversary isn't supported by Tine 2.0
	// Birthday
	if (field=='Birthday') {
		if (card.getProperty("BirthYear", "0") >0 && card.getProperty("BirthMonth", "0") >0 && card.getProperty("BirthDay", "0") > 0) {
			var aHours = 0;
			var dLoc = new Date(
				card.getProperty("BirthYear", "0000"),
				(card.getProperty("BirthMonth", "01") -1), // Month in js is from 0 to 11
				card.getProperty("BirthDay", "00"),
				aHours,0,0,0 //,00,00,000 // to avoid warnings
			);
			var tzOff = dLoc.getTimezoneOffset() * 60000;
			//
			// WINDOWS can't handle timezones before 1970 !!
			// patch it, if running windows for dates < 1970
			//
			if ((navigator.platform.substr(0,3)=='Win') && (dLoc.getFullYear()<=1970)) {
				// Calculating with 1st february makes sure the year will be 1970 in normal time any case
				var dTmp = new Date(1970, 1, 1, 0, 0, 0, 0); //01, 01, 00, 00, 00, 000); // to avoid warnings 
				tzOff = dTmp.getTimezoneOffset() * 60000;
			}
			var dAs = new Date(dLoc.getTime() + tzOff);
			var rYear = dAs.getFullYear();
			var rMonth = dAs.getMonth()+1;
				if (rMonth<10) rMonth = '0'+rMonth;
			var rDay = (dAs.getDate()>9) ? dAs.getDate() : '0'+dAs.getDate();
			var rHour = (dAs.getHours()>9) ? dAs.getHours() : '0'+dAs.getHours();
			var rMinute = (dAs.getMinutes()>9) ? dAs.getMinutes() : '0'+dAs.getMinutes();
			ret = rYear+'-'+rMonth+'-'+rDay+'T'+rHour+':'+rMinute+':00.000Z';
		}
	// Picture
	} else if (field=='Picture') {
		var photo = card.getProperty("PhotoName", ""); 
		if (card.getProperty("PhotoType", "") == 'file' && 
			(photo.substr(photo.length-4, 4) == '.jpg' || photo.substr(photo.length-5, 5) == '.jpeg') ) {
			// get folder for pictures
			var file = Components.classes["@mozilla.org/file/directory_service;1"]
						         .getService(Components.interfaces.nsIProperties)
						         .get("ProfD", Components.interfaces.nsIFile);
			file.append(config.picDir);
			file.append(photo); 
			if( file.exists() && !file.isDirectory() ) {
				var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"]
					.createInstance(Components.interfaces.nsIFileInputStream); 
				fstream.init(file, 0x01, parseInt('0444', 8), 0);
				var stream = Components.classes["@mozilla.org/binaryinputstream;1"]
					.createInstance(Components.interfaces.nsIBinaryInputStream);
				stream.setInputStream(fstream);
				var base64 = btoa(stream.readBytes(stream.available())); 
				// Specifikation limits size to 48KB
				if (base64.length < 49152 || config.contactsLimitPictureSize == false)
					ret = base64;
			}
		} else
			ret = null;
	}

	return ret;
  },

  setSpecialAbValue: function(card, tbField, asValue) {
	if (tbField=='Birthday') {
		if (asValue != '') {
			var asDate = new Date(asValue.substr(0,4), asValue.substr(5,2)-1, asValue.substr(8,2), asValue.substr(11,2), asValue.substr(14,2) );
			var locDate = new Date(asDate.getTime() + (asDate.getTimezoneOffset() * 60000 * -1));
			var aMonth = (locDate.getMonth()+1);
			if (aMonth<10) aMonth = '0' + aMonth;
			var aDay = locDate.getDate();
			if (aDay < 10) aDay = '0' + aDay;
			var tbDate = locDate.getFullYear() + '-' + aMonth + '-' + aDay; 
			card.setProperty("BirthYear", tbDate.substr(0,4) );
			card.setProperty("BirthMonth", tbDate.substr(5,2) );
			card.setProperty("BirthDay", tbDate.substr(8,2) );
		}
		else {
			card.deleteProperty("BirthYear");
			card.deleteProperty("BirthMonth");
			card.deleteProperty("BirthDay"); 
		}
	} else if (tbField=='Categories') {
		var Customfield = '';
		for (var i=0; i<asValue.childNodes.length; i++) {
			Customfield = Customfield + asValue.childNodes[i].firstChild.nodeValue;
			if (i<(asValue.childNodes.length-1))
				Customfield = Customfield + ", ";
		}
		card.setProperty("Custom4", Customfield );
	} else if (tbField=='Picture') { 
		// delete image
		if (asValue == '') {
			var file = Components.classes["@mozilla.org/file/directory_service;1"]
						         .getService(Components.interfaces.nsIProperties)
						         .get("ProfD", Components.interfaces.nsIFile);
			file.append(config.picDir);
			file.append(card.getProperty("PhotoName", "")); 
			if( file.exists() && !file.isDirectory() )
				file.remove(false);
			card.setProperty("PhotoName", "" );
			card.setProperty("PhotoType", "" );
			card.setProperty("PhotoURI", "" );
			card.deleteProperty("PhotoName");
			card.deleteProperty("PhotoType");
			card.deleteProperty("PhotoURI");
		// modify or new
		} else {
			var photo = card.getProperty("PhotoName", ""); 
			if (photo == '') {
				photo = this.uniqueId() + '.jpg';
				card.setProperty("PhotoName", photo );
			}
			var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
				.createInstance(Components.interfaces.nsIFileOutputStream);
			var file = Components.classes["@mozilla.org/file/directory_service;1"]
						         .getService(Components.interfaces.nsIProperties)
						         .get("ProfD", Components.interfaces.nsIFile);
			file.append(config.picDir);
			file.append(photo); 
			foStream.init(file, 0x02 | 0x08 | 0x20, parseInt('0600', 8), 0);   // write, create, truncate
				var binary = atob(asValue);
				foStream.write(binary, binary.length);
			foStream.close();
			card.setProperty("PhotoType", "file" );
			var filePath = 'file:///' + file.path.replace(/\\/g, '\/').replace(/^\s*\/?/, '').replace(/\ /g, '%20');
			card.setProperty("PhotoURI", filePath );
		}
    }
  },

  commandsDom: function(uri) {
	var addressBook = config.getAbByUri(uri);
	var result = null;

	try {
		var cardArr = new Array();
		let cards = addressBook.childCards;
		// go for new and changed cards
		while (cards.hasMoreElements()) {
			try {
				let card = cards.getNext();

				if (card instanceof Components.interfaces.nsIAbCard) {
					var tineId = card.getProperty("TineSyncId", "");
					var clientId = null;

					// unsynced (or left out) cards
					if (tineId == "" || tineId.substr(0,7) == 'client-' )
						clientId = 'client-' + this.uniqueId();

					var cardDom = this.asDom(card, clientId); 

					if (cardDom != null) {
						// unsyncted cards need a preliminary id
						if (clientId != null) {
							card.setProperty("TineSyncId", clientId);
							addressBook.modifyCard(card);
						} else if (cardDom.nodeName == 'Change')
							addressBook.modifyCard(card);

						cardArr.push(cardDom);
					}
				}
			} catch(newEx) {
				alert("commandsDom: new cards exception" + newEx);
			}
		}

		// add cards which doesn't exist anymore
		var abSyncConfig = config.getSyncConfigByCategoryUri(this.category, uri);
		var cnt = abSyncConfig.managedCards.length;
		for (var i=0; i<cnt; i++) {
			try {
				var tineSyncId = abSyncConfig.managedCards[i];
				let card = addressBook.getCardFromProperty("TineSyncId", tineSyncId, false); 
				if(card == null) {
					var doc = document.implementation.createDocument("", "", null);
					cardArr.push(doc.appendChild(this.asDelDom(tineSyncId)));
				}
			} catch(addEx) {
				alert("commandsDom: add cards exception" + addEx);
			}
		}

		if (cardArr.length > 0)
			result = cardArr;
	} catch (err) {
		helper.prompt("commandsDom: Cannot access addressbook . Please edit ThunderTine options\n" + err);
	}

    return result;
  },

  asDom: function(card, clientId) {
	var doc = document.implementation.createDocument("", "", null);
	// read card data

	var md5 = this.md5hashForCard(card);
	var command = null;

	if (card.getProperty("TineSyncMD5", "") != md5 || clientId != null) {
		var data = doc.createElement('ApplicationData');
		for (var property in this.mapActiveSyncToThunderbird) {
			var asField = property;
			var tbField = this.mapActiveSyncToThunderbird[property];
			var tbValue = null;
			if(tbField.substr(0,1) != '%') 
				tbValue = card.getProperty(tbField, "");
			else
				tbValue = this.getSpecialAbValue(card, tbField);
	
			if (tbValue == null)
				data.appendChild(doc.createElement(asField));
			else if (tbValue != '') {
				var field = doc.createElement(asField);
				field.appendChild(doc.createTextNode(tbValue));
				data.appendChild(field);
			}
		} 
		// calculate meta data and build command
		if (clientId != null) {
			command = doc.createElement('Add');
			command.appendChild(doc.createElement('ClientId'));
			command.lastChild.appendChild(doc.createTextNode(clientId)); 
		} else if (card.getProperty("TineSyncMD5", "") != md5) {
			devTools.writeMsg('ttineAb', 'asDom', md5 + ' != ' + card.getProperty("TineSyncMD5", ""));
			command = doc.createElement('Change');
			command.appendChild(doc.createElement('ServerId'));
			command.lastChild.appendChild(doc.createTextNode(card.getProperty("TineSyncId", "")));
			// change doesn't get a repsonse from server (so set md5 here)
			card.setProperty('TineSyncMD5', md5);
		}

		if (command != null)
			command.appendChild(data);
	} else {
		//command = doc.createElement('ServerId');
		//command.appendChild(doc.createTextNode(card.getProperty("TineSyncId", ""))); 
	} 

    return command;
  },

  asDelDom: function(id) {
	var doc = document.implementation.createDocument("", "", null);
	var command = doc.createElement('Delete');
	command.appendChild(doc.createElement('ServerId'));
	command.lastChild.appendChild(doc.createTextNode(id));
	return command;
  }, 

  md5hashForCard: function(card) {
	var result = '';
	var md5text = '';

	for (var property in this.mapActiveSyncToThunderbird) {
		var tbField = this.mapActiveSyncToThunderbird[property];
		var tbValue = null;
		if(tbField.substr(0,1) != '%') 
			tbValue = card.getProperty(tbField, '');
		else
			tbValue = this.getSpecialAbValue(card, tbField);

		if (tbValue != '' && tbValue != null) {
			md5text += tbValue;
		}
	} 

	result = this.md5hash(md5text);

	//devTools.writeMsg('ttineAb', 'md5hashForCard', card.getProperty('TineSyncId', '') + ', in: \'' + md5text + '\', out: ' + result);
	return result;
  },

  md5hash: function(md5input) {
	var md5 = Components.classes["@mozilla.org/security/hash;1"]
			.createInstance(Components.interfaces.nsICryptoHash);
	var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
			.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
	converter.charset = "UTF-8";
	var converterResult = {};
	var md5data = converter.convertToByteArray(md5input, converterResult);
	md5.init(md5.MD5);
	md5.update(md5data, md5data.length);
	var md5temp = md5.finish(false);
	var md5output = '';
	for(var i=0; i<md5temp.length-1; i++)
		md5output = md5output + md5temp.charCodeAt(i).toString(16); 
	return md5output;
  }, 

  uniqueId: function() {
	// wait for two miliseconds to make sure id is unique
	var endTime = (new Date()).getTime()+1;
	while((new Date()).getTime()<endTime){}; 
	return this.md5hash(endTime);
  }, 

  removeCard: function(uri, tineSyncId) {
	var addressBook = config.getAbByUri(uri);

	try {
		let card = addressBook.getCardFromProperty("TineSyncId", tineSyncId, false); 

		if(card == null)
			throw "Unknown addressbook entry, with internal id "+tineSyncId;

		devTools.writeMsg("ab", "removeCard", "syncID: " + tineSyncId + ", name: " + card.getProperty("LastName", "<emtpy>") + ", firstname: " + card.getProperty("FirstName", "<emtpy>"));
		// delete card
		let cardsToDelete = Components.classes["@mozilla.org/array;1"]
        	.createInstance(Components.interfaces.nsIMutableArray);
		cardsToDelete.appendElement(card, false);

		addressBook.deleteCards(cardsToDelete); 
	} catch (err) {
		helper.prompt("removeCard: Couldn't delete Addressbook entry. Please check your books.\n\n"+err);
	}
  }, 

  responseCard: function(uri, tineSyncId, fields, values) {
	var addressBook = config.getAbByUri(uri);

	try {
		let card = addressBook.getCardFromProperty("TineSyncId", tineSyncId, false); 
		if(card == null)
			throw "Unknown addressbook entry, with internal id "+tineSyncId;

		devTools.writeMsg("ab", "responseCard", "syncID: " + tineSyncId + ", name: " + card.getProperty("LastName", "<emtpy>") + ", firstname: " + card.getProperty("FirstName", "<emtpy>"));
		// change requested fields
		for (var f = 0; f < fields.length; f++) { 
			var field = fields[f]; 
			var value = values[f];
			// if card is changed calculate new md5
			if (field == 'TineSyncMD5') {
				// read card data
				var md5text = '';
				for (var property in this.mapActiveSyncToThunderbird) {
					var tbField = this.mapActiveSyncToThunderbird[property];
					var tbValue = null;
					if(tbField.substr(0,1) != '%') 
						tbValue = card.getProperty(tbField, "");
					else 
						tbValue = this.getSpecialAbValue(card, tbField);

					if (tbValue != '' && tbValue != null) 
						md5text = md5text + tbValue;
				} 
				value = this.md5hash(md5text); 
			} 
			card.setProperty(field, value); 
		}
		// save changes
		addressBook.modifyCard(card); 
	} catch (err) {
		helper.prompt("responseCard: Couldn't update Addressbook entry. Please check your books.\n\n"+err);
	}
  }, 

  commandCard: function(uri, command, id, appDataDom) { 
	var addressBook = config.getAbByUri(uri);
	var changed = [];

	try {
		if(command == 'Add' || command == 'Change') {
			var abSyncConfig = config.getSyncConfigByCategoryUri(this.category, uri);
			var card = null; 
			// If cards are resent (syncKey = 0) don't change existing (managed) cards
			if(command == 'Change' || abSyncConfig.managedCards.indexOf(id) >= 0 ) { 
				card = addressBook.getCardFromProperty("TineSyncId", id, false); 
			} else { // new card
				card = Components.classes["@mozilla.org/addressbook/cardproperty;1"]  
					.createInstance(Components.interfaces.nsIAbCard);  
				card.setProperty("TineSyncId", id);
			}
			if (card == null) 
				throw command+" of card failed.";

			// apply server data
			var cnt = appDataDom.childNodes.length;

			for (var i=0; i<cnt; i++) {
				var childNode = appDataDom.childNodes[i];
				var asField = childNode.nodeName;
				var asValue = null;
				if (asField == 'Contacts_Picture') {
					// stupid Mozilla 4kb bug -> Need extra function to retrieve nodeValue!!
					asValue = this._largeDomValue(childNode); 
				} else if (asField == 'Contacts_Categories') {
					asValue = childNode;
				} else
					asValue = childNode.firstChild.nodeValue;

				var tbField = this.mapActiveSyncToThunderbird[asField];

				// ignore unmapped fields
				if (tbField == undefined)
					continue;

				if(tbField.substr(0,1) == '%') 
					this.setSpecialAbValue(card, tbField.substr(1, tbField.length-1), asValue);
				else {
					asValue = helper.unescapeNodeValue(asValue);
					card.setProperty(tbField, asValue);
				}
				changed.push(tbField);
			}
			this.cleanCard(card, changed);

			// give md5hash (otherwise it will be sent to the server again)
			card.setProperty('TineSyncMD5', this.md5hashForCard(card));
			// save changes. If cards are resent (syncKey = 0) don't change existing (managed) cards
			if (command == 'Change' || abSyncConfig.managedCards.indexOf(id) >= 0 )
				addressBook.modifyCard(card); 
			else if (command == 'Add')
				addressBook.addCard(card);
		}

		if(command == 'Delete')
			this.removeCard(uri, id);
	} catch (err) {
		helper.prompt("commandCard: Server sent new cards but they couldn't be applied to the local Addressbook. \n\n"+err);
	}
  },

  cleanCard: function(card, changed) {
	// clean up
	try {
		for (var property in this.mapActiveSyncToThunderbird) {
			var tbField = this.mapActiveSyncToThunderbird[property];
	
			if (tbField == '' || changed.indexOf(tbField) >= 0)
				continue;
			
			switch (tbField) {
				case '%Birthday':
				case '%Picture':
					if (this.getSpecialAbValue(card, tbField) != '')
						this.setSpecialAbValue(card, tbField, '');
					break;
				case '%Categorie':
					this.setSpecialAbValue(card, tbField, []);
					break;
				default:
					if (card.getProperty(tbField, '') != '')
						card.deleteProperty(tbField);
					break;
			}
		}
	} catch(e) {
		devTools.writeMsg('ttineAb', 'cleanCard', 'error: ' + e);
	}
  },

  // this function handles a mozilla bug. Every nodeValue is truncated to maximum of 4096 chars (bytes)!! Hate it.
  _largeDomValue: function(node) {
	var content = null;

	if(node.firstChild.textContent && node.normalize) {
		node.normalize(node.firstChild);
		content=node.firstChild.textContent;
	}
	else if(node.firstChild.nodeValue) 
		content=node.firstChild.nodeValue;

	return content;
  },

  managedCards: function(uri) {
	var addressBook = config.getAbByUri(uri);

	let cards = addressBook.childCards;
	var abSyncConfig = config.getSyncConfigByCategoryUri(this.category, uri);
	abSyncConfig.managedCards = Array();
	while (cards.hasMoreElements()) { 
		let card = cards.getNext();
		if (card instanceof Components.interfaces.nsIAbCard) {
			var tineId = card.getProperty("TineSyncId", ""); 
			if(tineId != '' && tineId.substr(0,7) != 'client-')
				abSyncConfig.managedCards.push(tineId);
		}
	}
  },

  doClearExtraFields: function(uri, deleteData) { 
	var addressBook = config.getAbByUri(uri);
	let cards = addressBook.childCards;
	var cleanData = (typeof deleteData == 'boolean' && deleteData == true ? true : false);

	while (cards.hasMoreElements()) { 
		let card = cards.getNext();
		if (card instanceof Components.interfaces.nsIAbCard) {
			// do not manage this card anymore
			if (cleanData == false) {
				// Anyhow deleting properties doesn't work. Null them instead.
				card.setProperty("TineSyncMD5", null);
				card.setProperty("TineSyncId", null); 
				addressBook.modifyCard(card); 
				card.deleteProperty("TineSyncMD5");
				card.deleteProperty("TineSyncId");
			} else {
				// delete card
				let cardsToDelete = Components.classes["@mozilla.org/array;1"]
		        	.createInstance(Components.interfaces.nsIMutableArray);
				cardsToDelete.appendElement(card, false);

				addressBook.deleteCards(cardsToDelete); 
			}
		}
	}
  }

};
