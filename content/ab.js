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

var ab = {
  
  // mapping table for ActiveSync -> Thunderbird
  // ActiveSync fields, which are not defined here, are injected as lines "{field:value}\n" into the Notes field
  map: {
    "Contacts_FileAs":              "DisplayName",
    "Contacts_FirstName":           "FirstName",
    "Contacts_LastName":            "LastName",
    "Contacts_MiddleName":          "NickName",
    //"Contacts2_NickName":           "NickName",
    "Contacts_Email1Address":       "PrimaryEmail",
    "Contacts_Email2Address":       "SecondEmail",
    "Contacts_HomeStreet":          "%HomeAddress",			// HomeAddress, HomeAddress2
    "Contacts_HomeCity":            "HomeCity",
    "Contacts_HomeState":           "HomeState",
    "Contacts_HomePostalCode":      "HomeZipCode",
    "Contacts_HomeCountry":         "HomeCountry",
    "Contacts_BusinessStreet":      "%WorkAddress",			// WorkAddress, WorkAddress2
    "Contacts_BusinessCity":        "WorkCity",
    "Contacts_BusinessState":       "WorkState",
    "Contacts_BusinessPostalCode":  "WorkZipCode",
    "Contacts_BusinessCountry":     "WorkCountry",
    "Contacts_CompanyName":         "Company",
    "Contacts_Department":          "Department",
    "Contacts_JobTitle":            "JobTitle",
    "Contacts_OfficeLocation":      "Custom1",
    "Contacts_HomePhoneNumber":     "HomePhone",
    "Contacts_BusinessPhoneNumber": "WorkPhone",
    "Contacts_BusinessFaxNumber":   "FaxNumber",
    "Contacts_HomeFaxNumber":       "PagerNumber",
    //"Contacts_PagerNumber":         "PagerNumber",
    "Contacts_MobilePhoneNumber":   "CellularNumber",
    "Contacts_Birthday":            "%Birthday",			// BirthYear, BirthMonth, BirthDay
    "Contacts_Webpage":             "WebPage1",
    "Contacts_Suffix":              "Custom2",
    "Contacts_Picture":             "%Picture",				// PhotoName, PhotoType
    "Contacts_Categories":          "%Categories",			// Custom4 (complex value, ghosted)
    "Contacts_Children":            "%Children",			// Custom3 (complex value, ghosted)
    "Contacts_Body":                "%Notes",				// unmapped ActiveSync fields and Notes
    "Contacts2_IMAddress":          "_AimScreenName"
  },

  // if notes contains a line "{field:value}\n" then value is returned
  getUnmappedField: function(notes, field) {
	var pos1 = notes.indexOf("{"+field+":");
	if (pos1>=0) {
		var pos2 = notes.indexOf("}\n", pos1);
		return notes.substring(pos1+field.length+2, pos2<0?notes.length:pos2);
	}
	return undefined;
  },

  // insert or update a line "{field:value}\n" in notes
  setUnmappedField: function(notes, field, value) {
	var pos1, pos2;
	pos1 = notes.indexOf("{"+field+":");
	if (pos1>=0) {
		pos2 = notes.indexOf("}\n", pos1);
		pos2 = pos2<0?notes.length:pos2+2;
	} else {
		pos1 = pos2 = 0;
	}
	return notes.substr(0, pos1) + "{" + field + ":" + value + "}\n" + notes.substr(pos2);
  },
  
  // returns the data from the lines "{field:value}\n" as a dict
  getUnmappedFieldDict: function(notes) {
  	var pos1, pos2, pos3, fields = {};
  	pos1 = notes.indexOf("{");
  	while (pos1>=0) {
  		pos2 = notes.indexOf(":", pos1);
  		if (pos2>=0) {
  			pos3 = notes.indexOf("}\n", pos2);
  			if (pos3>=0) {
  				fields[notes.substring(pos1+1, pos2)] = notes.substring(pos2+1, pos3);
  			}
  		}
  		pos1 = notes.indexOf("{", pos1+1);
  	}
  	return fields;
  },

  // returns the position of the first beginning of the notes
  getUnmappedSplitPosition: function(notes) {
  	var pos1, pos2, start = 0;
  	pos1 = notes.indexOf("{");
  	while (pos1>=0) {
  		pos2 = notes.indexOf("}\n", pos1);
  		if (pos2>=0) {
  			start = pos2+2;
  		}
  		pos1 = notes.indexOf("{", pos2>=0?pos2:pos1+1);
  	}
  	return start;
  },


  getSpecialAbValue: function(card, field) {
   	//helper.debugOut("ab.getSpecialAbValue(card, '"+field+"')\n");
    var ret, aHours, dLoc, tzOff, dTmp, dAs, rYear, rMonth, rDay, rHour, rMinute, rMinute, photo, file, fstream, stream, base64, notes, adr2;
    // create special fields (those marked in map with a "%") for ActiveSync
    ret = '';
    if (field.substr(0, 1) == '%') {
        field = field.substr(1);
    }
    // Anniversary isn't supported by Tine 2.0
    // Birthday
    if (field=='Birthday') {
        if (card.getProperty("BirthYear", "0") >0 && card.getProperty("BirthMonth", "0") >0 && card.getProperty("BirthDay", "0") >0) {
            aHours = 0;
            // Tine 2.0 manipulates dates from iPhones (subtract 12 hours)
            if (config.deviceType == 'iPhone') {
                aHours = 12;
            }
            dLoc = new Date(
                card.getProperty("BirthYear", "0000"),
                (card.getProperty("BirthMonth", "01") -1), // Month in js is from 0 to 11
                card.getProperty("BirthDay", "00"),
                aHours,0,0
            );
            tzOff = dLoc.getTimezoneOffset() * 60000;
            //
            // WINDOWS can't handle timezones before 1970 !!
            // patch it, if running windows for dates < 1970
            //
            if ((navigator.platform.substr(0,3)=='Win') && (dLoc.getFullYear()<=1970)) {
                // Calculating with 1st february makes sure the year will be 1970 in normal time any case
                dTmp = new Date(1970, 1, 1, 0, 0, 0); 
                tzOff = dTmp.getTimezoneOffset() * 60000;
            }
            dAs = new Date(dLoc.getTime() + tzOff);
            rYear = dAs.getFullYear();
            rMonth = dAs.getMonth()+1;
            if (rMonth<10) {
                rMonth = '0'+rMonth;
            }
            rDay = (dAs.getDate()>9) ? dAs.getDate() : '0'+dAs.getDate();
            rHour = (dAs.getHours()>9) ? dAs.getHours() : '0'+dAs.getHours();
            rMinute = (dAs.getMinutes()>9) ? dAs.getMinutes() : '0'+dAs.getMinutes();
            ret = rYear+'-'+rMonth+'-'+rDay+'T'+rHour+':'+rMinute+':00.000Z';
        }
        else {
            ret = ''; 
        }
    }
    // Picture
    else if (field=='Picture') {
        photo = card.getProperty("PhotoName", ""); 
        if (card.getProperty("PhotoType", "") == 'file' && 
            (photo.substr(photo.length-4, 4) == '.jpg' || photo.substr(photo.length-5, 5) == '.jpeg') ) {
            // get folder for pictures
            file = Components.classes["@mozilla.org/file/directory_service;1"]
                                 .getService(Components.interfaces.nsIProperties)
                                 .get("ProfD", Components.interfaces.nsIFile);
            file.append(config.picDir);
            file.append(photo); 
            if ( file.exists() && !file.isDirectory() ) {
                fstream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                    .createInstance(Components.interfaces.nsIFileInputStream); 
                fstream.init(file, 0x01, 0444, 0);
                stream = Components.classes["@mozilla.org/binaryinputstream;1"]
                    .createInstance(Components.interfaces.nsIBinaryInputStream);
                stream.setInputStream(fstream);
                base64 = btoa(stream.readBytes(stream.available())); 
                // Specifikation limits size to 48KB
                if (base64.length < 49152 || config.contactsLimitPictureSize == false) {
                    ret = base64;
                } else{
                    ret = '';
                }
            }
        }
        else {
            ret = null;
        }
    }
    // Notes
    else if (field=='Notes') {
    	notes = card.getProperty("Notes", "");
    	ret = notes.replace(/{[^{}]*}\n/g,""); 	// remove "{field:value}\n" lines
    	//helper.debugOut("  Notes='"+ret+"'\n");
    }
    // HomeAddress
    else if (field=='HomeAddress') {
    	ret = card.getProperty("HomeAddress", "");
    	adr2 = card.getProperty("HomeAddress2", "");
    	if (adr2) {
    		ret += "\n" + adr2;
    	}
    }
    // WorkAddress
    else if (field=='WorkAddress') {
    	ret = card.getProperty("WorkAddress", "");
    	adr2 = card.getProperty("WorkAddress2", "");
    	if (adr2) {
    		ret += "\n" + adr2;
    	}
    }
    return ret;
  },

  setSpecialAbValue: function(card, tbField, asValue) {
   	//helper.debugOut("ab.setSpecialAbValue(card, '"+tbField+"', '"+asValue+"')\n");
    var asDate, locDate, aMonth, aDay, tbDate, tbField, photo, foStream, file, filePath, notes, adr2, pos;
    if (tbField=='Birthday') {
        if (asValue != '') {
            asDate = new Date(asValue.substr(0,4), asValue.substr(5,2)-1, asValue.substr(8,2), asValue.substr(11,2), asValue.substr(14,2) );
            locDate = new Date(asDate.getTime() + (asDate.getTimezoneOffset() * 60000 * -1));
            aMonth = (locDate.getMonth()+1);
            if (aMonth<10) {
                aMonth = '0' + aMonth;
            }
            aDay = locDate.getDate();
            if (aDay < 10) {
                aDay = '0' + aDay;
            }
            tbDate = locDate.getFullYear() + '-' + aMonth + '-' + aDay; 
            card.setProperty("BirthYear", tbDate.substr(0,4) );
            card.setProperty("BirthMonth", tbDate.substr(5,2) );
            card.setProperty("BirthDay", tbDate.substr(8,2) );
        }
        else {
            card.deleteProperty("BirthYear");
            card.deleteProperty("BirthMonth");
            card.deleteProperty("BirthDay"); 
        }
    }
    else if (tbField=='Categories') {
        card.setProperty("Custom4", (asValue.Contacts_Category||[]).join(", "));
    }
    else if (tbField=='Children') {
        card.setProperty("Custom3", (asValue.Contacts_Children||[]).join(", ") );
    }
    else if (tbField=='Picture') { 
        // delete image
        if (asValue == '') {
            file = Components.classes["@mozilla.org/file/directory_service;1"]
                                 .getService(Components.interfaces.nsIProperties)
                                 .get("ProfD", Components.interfaces.nsIFile);
            file.append(config.picDir);
            file.append(card.getProperty("PhotoName", "")); 
            if ( file.exists() && !file.isDirectory() ) {
                file.remove(false);
            }
            card.setProperty("PhotoName", "" );
            card.setProperty("PhotoType", "" );
            card.setProperty("PhotoURI", "" );
            card.deleteProperty("PhotoName");
            card.deleteProperty("PhotoType");
            card.deleteProperty("PhotoURI");
        }
        // modify or new
        else {
            photo = card.getProperty("PhotoName", ""); 
            if (photo == '') {
                photo = this.uniqueId() + '.jpg';
                card.setProperty("PhotoName", photo );
            }
            foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                .createInstance(Components.interfaces.nsIFileOutputStream);
            file = Components.classes["@mozilla.org/file/directory_service;1"]
                                 .getService(Components.interfaces.nsIProperties)
                                 .get("ProfD", Components.interfaces.nsIFile);
            file.append(config.picDir);
            file.append(photo); 
            foStream.init(file, 0x02 | 0x08 | 0x20, 0600, 0);   // write, create, truncate
                var binary = atob(asValue);
                foStream.write(binary, binary.length);
            foStream.close();
            card.setProperty("PhotoType", "file" );
            filePath = 'file:///' + file.path.replace(/\\/g, '\/').replace(/^\s*\/?/, '').replace(/\ /g, '%20');
            card.setProperty("PhotoURI", filePath );
        }
    }
    // Notes
    else if (tbField=='Notes') {
    	notes = card.getProperty("Notes", "");
    	notes = notes.substr(0, this.getUnmappedSplitPosition(notes)) + asValue;
    	card.setProperty("Notes", notes);
    	//helper.debugOut("  set Notes='"+notes+"'\n");
    }
    // HomeAddress
    else if (tbField=='HomeAddress') {
        pos = asValue.indexOf("\n");
        if (pos<0) {
        	pos = asValue.length;
        }
        card.setProperty("HomeAddress", asValue.substr(0, pos));;
        card.setProperty("HomeAddress2", asValue.substr(pos+1));;
    }
    // WorkAddress
    else if (tbField=='WorkAddress') {
        pos = asValue.indexOf("\n");
        if (pos<0) {
        	pos = asValue.length;
        }
        card.setProperty("WorkAddress", asValue.substr(0, pos));;
        card.setProperty("WorkAddress2", asValue.substr(pos+1));;
    }
  },

  // prepare the commands to be sent to the server
  // ["Add", [...], "Add", [...], "Change", [...], "Delete", [...], ...
  commandsDom: function(contactsLocalFolder) { 
    helper.debugOut("ab.commandsDom('"+contactsLocalFolder+"')\n");
   	var entry, clientId, tineId, i;
                	
    var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
    
    try {
        var addressBook = abManager.getDirectory(contactsLocalFolder);
        if (addressBook.fileName && !addressBook.isRemote && !addressBook.isMailList) { 
            var cardArr = [];
            var cards = addressBook.childCards;
            // go for new and changed cards
            while (cards.hasMoreElements()) { 
                var card = cards.getNext();
                if (card instanceof Components.interfaces.nsIAbCard) { 
                    tineId = card.getProperty("TineSyncId", "");
                    // unsynced (or left out) cards
                    if (tineId == "" || tineId.substr(0,7) == 'client-' ) {
                        clientId = 'client-'+this.uniqueId();
                        entry = this.asAddChangeCommand(card, clientId); 
                    }
                    else {
                        entry = this.asAddChangeCommand(card);
                    }
                    if (entry) {
                        // unsynced cards need a preliminary id
                        if (tineId == "" || tineId.substr(0,7) == 'client-' ) {
                            card.setProperty("TineSyncId", clientId);
                            addressBook.modifyCard(card);
                        }
                        if (entry[0]=="Change") {
							addressBook.modifyCard(card);  // TineSyncMD5 has been updated! Save the card
						}
					    helper.debugOut("  push entry:"+JSON.stringify(entry)+"\n");
                        cardArr.push(entry[0], entry[1]);
                    } 
                }
            }
            // add cards which doesn't exist anymore
            var mcards = config.managedCards[contactsLocalFolder];
            for (i=0; i < mcards.length; i++) {
                var card = addressBook.getCardFromProperty("TineSyncId", mcards[i], false); 
                if (card == null) {
                    entry = this.asDeleteCommand(mcards[i]);
				    helper.debugOut("  push entry:"+JSON.stringify(entry)+"\n");
                    cardArr.push(entry[0], entry[1]);
                }
            }
            
            return cardArr.length>0 ? cardArr : null;
        }
    }
    catch (err) {
        helper.prompt("Cannot access addressbook. Please edit ThunderTine options\n" + err);
    }
    return null;
  },

  // [tagname, null, tagname, null, ...]
  // returns the fields managed by the client (fields which are not ghosted)
  // (ghosted fields are not removed from the server if thes are not uploaded to the server)
  asSupported: function() {
    var supported = [];
    for (var asField in this.map) {
    	if (asField!="Contacts_Categories" && asField!="Contacts_Children") {	// Categories and Children are ghosted
    		supported.push(asField, null);
    	}
    }
    return supported;
  },

  // prepare a command for one card to be sent to the server
  // ["Add",    ["ClientId", "xxx", "ApplicationData", [...]]
  // ["Change", ["ServerId", "xxx", "ApplicationData", [...]]
  // null
  asAddChangeCommand: function(card, clientId) {
    // read card data
    var data, tbField, tbValue, md5, tineId, command;
    data = [];		// ApplicationData
    for (var asField in this.map) {
        tbField = this.map[asField];
        if (tbField.substr(0, 1) != '%') {
            tbValue = card.getProperty(tbField, "");
        } else {
            tbValue = this.getSpecialAbValue(card, tbField);
        }
       	data.push(asField, tbValue);
    }
    
	// iterate over special fields embedded in notes
	var unmappedFields = this.getUnmappedFieldDict(card.getProperty("Notes", ""));
	for (asField in unmappedFields) {
		tbValue = unmappedFields[asField];
       	data.push(asField, tbValue);
	}
    
    /* TEST: enumerate all Thunderbird properties
    var enumerator = card.properties;
	while (enumerator.hasMoreElements()) {
	    var property = enumerator.getNext().QueryInterface(Components.interfaces.nsIProperty);
	    helper.debugOut("  '"+property.name + "': '" + property.value + "'\n");
	}
	*/
    
    // calculate meta data and build command
    md5 = this.md5hashForCard(card);
    tineId = card.getProperty("TineSyncId", "");
    command = null;
    if (tineId == "" || tineId.substr(0,7) == 'client-' ) {
    	helper.debugOut("  card.getProperty('TineSyncId')='"+tineId+"'  ->  is new at client, prepare a change command\n");
        command = ['Add', ['ClientId', clientId, "ApplicationData", data]];
    }
    else if (card.getProperty("TineSyncMD5", "") != md5) {
    	helper.debugOut("  card.getProperty('TineSyncId')='"+tineId+"', card.getProperty('TineSyncMD5')='"+card.getProperty("TineSyncMD5", "")+"', md5='"+md5+"'  ->  prepare a change command\n");
        command = ['Change', ['ServerId', card.getProperty("TineSyncId", ""), "ApplicationData", data]];
		// set new TineSyncMD5 so that the card is not sent again to the server (would be better
		// to update TineSyncMD5 only after the server has sent his confirmation)
		card.setProperty("TineSyncMD5", md5);
    }
    return command;
  },

  // ["Delete", ["ServerId", "xxx"]]
  asDeleteCommand: function(id) {
    return ["Delete", ["ServerId", id]];
  }, 

  md5hash: function(md5input) {
    var md5, converter, converterResult, md5data, md5temp, md5output;
    md5 = Components.classes["@mozilla.org/security/hash;1"]
            .createInstance(Components.interfaces.nsICryptoHash);
    converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
            .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    converterResult = {};
    md5data = converter.convertToByteArray(md5input, converterResult);
    md5.init(md5.MD5);
    md5.update(md5data, md5data.length);
    md5temp = md5.finish(false);
    md5output = '';
    for(var i=0; i<md5temp.length-1; i++) {
        md5output = md5output + md5temp.charCodeAt(i).toString(16); 
    }
    return md5output;
  }, 

  md5hashForCard: function(card) {
	var tbField, tbValue, value, md5text = '';
	for (var asField in this.map) {
		tbField = this.map[asField];
		if (tbField.substr(0, 1) != '%') {
			tbValue = card.getProperty(tbField, "");
		} else {
			tbValue = this.getSpecialAbValue(card, tbField);
		}
		if (tbValue) {
			md5text = md5text + tbValue;		// this does not work reliably, as the field order is not deterministic
		}
	}
	// iterate over special fields embedded in notes
	var unmappedFields = this.getUnmappedFieldDict(card.getProperty("Notes", ""));
	for (asField in unmappedFields) {
		tbValue = unmappedFields[asField];
		md5text = md5text + tbValue;
	}
	
	value = this.md5hash(md5text); 
	//helper.debugOut("md5hashForCard(): md5-value='"+value+"', md5text='"+md5text.substr(0,100)+"...\n");
	return value;
  },

  uniqueId: function() {
    // wait for two miliseconds to make sure id is unique
    var endTime = (new Date()).getTime()+1;
    while ((new Date()).getTime()<endTime) {}; 
    return this.md5hash(endTime);
  }, 

  listAbs: function() {
    var resArr = [];
    var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
    
    // find book
    var allAddressBooks = abManager.directories; 
    while (allAddressBooks.hasMoreElements()) { 
        var addressBook = allAddressBooks.getNext();
        // found right book -> read cards
        if (addressBook instanceof Components.interfaces.nsIAbDirectory && !addressBook.isRemote && addressBook.fileName != 'history.mab') {
            resArr.push(addressBook.URI);
        }
    }

    return resArr;
  }, 

  // process server response for a single update (store server id and update md5)
  // update fields with values
  responseCard: function(contactsLocalFolder, tineSyncId, fields, values) {
    helper.debugOut("ab.responseCard('"+contactsLocalFolder+"', '"+tineSyncId+"', "+JSON.stringify(fields)+", "+JSON.stringify(values)+"\n");
    var f, field, value, tbField, tbValue;
    var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
    try {
        var addressBook = abManager.getDirectory(contactsLocalFolder); 
        if (addressBook.fileName && !addressBook.isRemote && !addressBook.isMailList) { 
            var card = addressBook.getCardFromProperty("TineSyncId", tineSyncId, false); 
            if (card == null) {
                throw "Unknown addressbook entry, with internal id "+tineSyncId; 
            }
            // change requested fields
            for (f = 0; f < fields.length; f++) { 
                field = fields[f]; 
                value = values[f];
                // if card is changed calculate new md5
                if (field == 'TineSyncMD5') {
                	value = this.md5hashForCard(card);
                }
                card.setProperty(field, value); 
            }
            // save changes
            addressBook.modifyCard(card);
        }
    }
    catch (err) {
        helper.prompt("Couldn't update Addressbook entry. Please check your books.\n\n"+err);
    }
  }, 

  // process commands sent by the server
  // command = "Add", "Change", "Delete"
  // appData = {...}
  commandCard: function(contactsLocalFolder, command, id, appData) {
    helper.debugOut("ab.commandCard('"+contactsLocalFolder+"', '"+command+"', "+id+", "+JSON.stringify(appData)+"\n");
    var asValue, tbField, i;
    
    var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);

    try {
        var addressBook = abManager.getDirectory(contactsLocalFolder); 
        if (addressBook.fileName && !addressBook.isRemote && !addressBook.isMailList) { 
            if (command == 'Add' || command == 'Change') {
                var card = null; 
                // If cards are resent (syncKey = 0) don't change existing (managed) cards
                if (command == 'Change' || config.managedCards[contactsLocalFolder].indexOf(id) >= 0 ) {
                    card = addressBook.getCardFromProperty("TineSyncId", id, false);
                    card.setProperty("Notes", ""); 		// clear all "{field:value}\n" lines
                } else { // new card
                    card = Components.classes["@mozilla.org/addressbook/cardproperty;1"]  
                        .createInstance(Components.interfaces.nsIAbCard);  
                    card.setProperty("TineSyncId", id);
                }
                if (card == null) {
                    throw command+" of card failed.";
                }
                // apply server data
                
                // iterate over the appData fields sent by the server
                for (var asField in appData) {
                	asValue = appData[asField];
                	
                    tbField = this.map[asField];
                    if (tbField) {
                        if (tbField.substr(0, 1) == '%') {
                            this.setSpecialAbValue(card, tbField.substr(1), asValue);
                        } else {
                            card.setProperty(tbField, asValue);
                        }
                    }
                    else {
                        //helper.prompt("The Server tries to change "+asField+", which isn't known to Thunderbird!");
                        // ActiveSync field is unknown to Thunderbird. Save it hidden? Maybe later. Otherwise next sync will overwrite if empty.
                    	var notes = card.getProperty("Notes", "");
                    	notes = this.setUnmappedField(notes, asField, asValue);
                    	card.setProperty("Notes", notes);
                    }
                }
                
                // clear supported fields that have not been sent by the server
                for (asField in this.map) {
                	if (appData[asField]===undefined) {
                		tbField = this.map[asField];
                        if (tbField.substr(0, 1) == '%') {
                            this.setSpecialAbValue(card, tbField.substr(1), "");
                        } else {
                            card.setProperty(tbField, "");
                        }
                	}
                }

                // give md5hash (otherwise it will be sent to the server again)
                card.setProperty('TineSyncMD5', this.md5hashForCard(card));
                // save changes. If cards are resent (syncKey = 0) don't change existing (managed) cards
                if (command == 'Change' || config.managedCards[contactsLocalFolder].indexOf(id) >= 0 ) {
                    addressBook.modifyCard(card); 
                } else if (command == 'Add'){
                    addressBook.addCard(card);
                }
            }
            else if(command == 'Delete') {
                var card = addressBook.getCardFromProperty("TineSyncId", id, false); 
                if (card!=null) {
                    // remove picture (if it is in Tb cache only)
                    this.setSpecialAbValue(card, "Picture", "");
                    // remove card
                    var cardsToDelete = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);  
                    cardsToDelete.appendElement(card, false);  
                    addressBook.deleteCards(cardsToDelete);  
                }
            }
        }
    }
    catch (err) {
        helper.prompt("Server sent new cards but they couldn't be applied to the local Addressbook. \n\n"+err);
    }
  },

  // save list of TineSyncIds in config.managedCards
  managedCards: function(contactsLocalFolder) {
    var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);

    var addressBook = abManager.getDirectory(contactsLocalFolder);
    var cards = addressBook.childCards;
    var mcards = [];
    while (cards.hasMoreElements()) { 
        var card = cards.getNext();
        if (card instanceof Components.interfaces.nsIAbCard) {
            var tineId = card.getProperty("TineSyncId", ""); 
            if (tineId != '' && tineId.substr(0,7) != 'client-') {
                mcards.push(tineId);
            }
        }
    }
    helper.debugOut("ab.managedCards('"+contactsLocalFolder+"'): managedCards="+JSON.stringify(mcards)+"\n");
    config.managedCards[contactsLocalFolder] = mcards;
  },

  doClearExtraFields: function(contactsLocalFolder) { 

    var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
    var addressBook = abManager.getDirectory(contactsLocalFolder); 
    var cards = addressBook.childCards;
    while (cards.hasMoreElements()) { 
        var card = cards.getNext();
        if (card instanceof Components.interfaces.nsIAbCard) {
            // do not manage this card anymore
            var id = card.getProperty("TineSyncId", "");
            if (id && config.managedCards[contactsLocalFolder]) {
                var pos = config.managedCards[contactsLocalFolder].indexOf(id);
                if (pos >= 0) {
                	config.managedCards[contactsLocalFolder].splice(pos, 1);
                }
            }
            // Anyhow deleting properties doesn't work. Null them instead.
            card.setProperty("TineSyncMD5", "");
            card.setProperty("TineSyncId", ""); 
            addressBook.modifyCard(card); 
            card.deleteProperty("TineSyncMD5");
            card.deleteProperty("TineSyncId");
            // save changes
            addressBook.modifyCard(card);
        }
    }
  }, 

  stillExists: function(contactsLocalFolder) { 

    var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
    try {
        var addressBook = abManager.getDirectory(contactsLocalFolder);
        return true;
    }
    catch (err) {
        return false;
    }
  }

}
