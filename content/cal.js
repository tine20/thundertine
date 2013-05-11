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

var ttineCal = {

  category: 'calendars',
  mapActiveSyncToThunderbird: {
  // mapping table for ActiveSync(property) -> Thunderbird(value)
  // ActiveSync						 Thunderbird		// additional ActiveSync settings
	"Calendar_Subject": 			"title",
	"Calendar_Location": 			"LOCATION",
	"Calendar_StartTime": 			"startDate",
	"Calendar_EndTime": 			"endDate",
	"Calendar_Timezone": 			"",
	"Calendar_AllDayEvent": 		"startDate.isDate",
	"Calendar_DtStamp": 			"creationDate",
	"Calendar_UID": 				"",
	"Calendar_OrganizerName": 		"ORGANIZER.commonName",
	"Calendar_OrganizerEmail": 		"ORGANIZER.id",
	"Calendar_Sensitivity": 		"",
	"Calendar_BusyStatus": 			"",
	"Calendar_Reminder": 			"alarmOffset",
	"Calendar_MeetingStatus": 		"", //"status",
	"Calendar_Attendees": 			"",
	"Calendar_Attendee": 			"",
	"Calendar_Email": 				"",
	"Calendar_Name": 				"",
	"Calendar_AttendeeStatus": 		"",
	"Calendar_AteendeeType": 		"",
	"Calendar_Categories":			"",
	"Calendar_Category":			"",
	"Calendar_Recurrence":			"",
	"Calendar_Type":				"",
	"Calendar_Until":				"",
	"Calendar_Interval":			"",
	"Calendar_Occurrences":			"",
	"Calendar_DayOfWeek":			"",
	"Calendar_DayOfMonth":			"",
	"Calendar_WeekOfMonth":			"",
	"Calendar_MonthOfYear":			"",
	"AirSyncBase_Body":				"DESCRIPTION"
  },

  supportedDom: function() {
	var doc = document.implementation.createDocument("", "", null);
	var data = doc.createElement('Supported');
		
	for (var property in this.mapActiveSyncToThunderbird) {
		data.appendChild(doc.createElement(property));
		//if (property == 'Contacts_Picture')
		//	data.lastChild.setAttribute('ghosted', 'true');
	}

	return data;
  },
  
  commandsDom: function(async) {
	var uri = async.local;
	var cal = config.getCalByUri(uri, true);
	var cards = async.cards;

	//devTools.enter('ttineCal', 'commandsDom', 'cards: ' + (cards == undefined ? cards : cards.length));
	// init async read
	if (cards == undefined) {
		// init commands array
		async.commands = [];
		async.changes = [];
		async.cards = [];
		async.onGetResult = ttineCal.collectCards;
		async.onOperationComplete = ttineCal.commandsDom;
		this.getCalendarItems(cal.calendar, cal.calendar.ITEM_FILTER_TYPE_EVENT, async);
		return null;
	}
	
	// generate dom
	try {
		var syncConfig = config.getSyncConfigByCategoryUri(this.category, uri);
		
		// go for new and changed cards
		for (var idx in cards) {
			var card = cards[idx];
			if (card instanceof Components.interfaces.calIEvent) {
				var tineId = card.getProperty('TineSyncId');
				if (tineId == undefined || tineId == null)
					tineId = '';
				var clientId = null;
		
				// unsynced (or left out) cards
				if (tineId == '' || tineId.substr(0,7) == 'client-' )
					clientId = 'client-' + ttineCal.uniqueId();
		
				var md5 = ttineCal.md5hashForCard(card, true);
				var cardDom = ttineCal.asDom(card, md5, clientId); 
		
				if (cardDom != null) {
					var newCard = null;
					// unsyncted cards need a preliminary id
					if (clientId != null) {
						newCard = card.parentItem.clone();
						newCard.setProperty('TineSyncId', clientId);
					}
					
					switch (cardDom.nodeName) {
						case 'Change':
							if (newCard == null)
								newCard = card.parentItem.clone();
							newCard.setProperty('TineSyncMD5', md5);
						case 'Add':
							async.commands.push(cardDom);
							break;
						case 'ServerId':
							async.changes.push(cardDom);
							break;
					}

					// save changes
					if (newCard != null)
						newCard.calendar.modifyItem(newCard, card.parentItem, null);
					//devTools.writeMsg('ttineCal', 'commandsDom', 'dom: ' + wbxml.domStr(cardDom));
				}
			}
		}

		// add cards which doesn't exist anymore
		var cardsCnt = cards.length;
		for (var idx in syncConfig.managedCards) {
			var managedCard = syncConfig.managedCards[idx];
			var i = 0;
			while (i < cardsCnt) {
				if (cards[i].getProperty('TineSyncId') == managedCard)
					break;
				i += 1;
			}
			
			if (i == cardsCnt)
				async.commands.push(ttineCal.asDelDom(managedCard));
		} 
	} catch(e) {
		devTools.writeMsg('ttineCal', 'commandsDom', 'error: ' + e);
	}
	
	async.complete = true;
	return null;
  },
  
  asDom: function(card, md5, clientId) {
	//devTools.enter('ttineCal', 'asDom');
	var doc = document.implementation.createDocument("", "", null);
	var command = null;

	//devTools.writeMsg('ttineCal', 'asDom', 'tineId: ' + card.getProperty('TineSyncId') + ', clientId: ' + clientId + ', md5: ' + md5 + ' (' + (md5 != card.getProperty('TineSyncMD5') ? 'y ' + card.getProperty('TineSyncMD5') : 'n') + ')');
	// read card data
	if (card.getProperty('TineSyncMD5') != md5 || clientId != null) {
		var data = doc.createElement('ApplicationData');;
		var hasTimezone = false;
		for (var property in this.mapActiveSyncToThunderbird) {
			var asField = property;
			var tbField = this.mapActiveSyncToThunderbird[property];
	
			if (tbField == '')
				continue;
			
			var tbValue = null;
			if(tbField.substr(0,1) != '%') {
				tbValue = ttineCal.cardPropertyAsText(card, tbField);
			}
			
			if (tbValue == null && asField != 'AirSyncBase_Body')
				data.appendChild(doc.createElement(asField));
			else if (tbValue != '') {
				var field = doc.createElement(asField);
				
				if (asField == 'AirSyncBase_Body') {
					var typeASB = doc.createElement('AirSyncBase_Type');
					typeASB.appendChild(doc.createTextNode('1'));
					field.appendChild(typeASB);
					var dataASB = doc.createElement('AirSyncBase_Data');
					dataASB.appendChild(doc.createTextNode(tbValue));
					field.appendChild(dataASB);
				} else
					field.appendChild(doc.createTextNode(tbValue));
				
				data.appendChild(field);
				if (hasTimezone == false && card.hasProperty(tbField) && card[tbField] instanceof Components.interfaces.calIDateTime) {
					data.appendChild(doc.createElement('Calendar_Timezone'));
					// todo convert
					hasTimezone = true;
				}
			}
		}
		var attendees = card.getAttendees({});
		for (var idx in attendees)
			devTools.writeMsg('ttineCal', 'asDom', idx + ' name: ' + attendees[idx].commonname + ', id: ' + attendees[idx].id + ' (' + (attendees[idx].isOrganizer ? 'y' : 'n') + ')');
		var categories = card.getCategories({});
		for (var idx in categories)
			devTools.writeMsg('ttineCal', 'asDom', idx + ' category: ' + categories[idx]);
		// calculate meta data and build command
		try {
			if (clientId != null) {
				command = doc.createElement('Add');
				command.appendChild(doc.createElement('ClientId'));
				command.lastChild.appendChild(doc.createTextNode(clientId)); 
			} else if (card.getProperty('TineSyncMD5') != md5) {
				command = doc.createElement('Change');
				command.appendChild(doc.createElement('ServerId'));
				command.lastChild.appendChild(doc.createTextNode(card.getProperty('TineSyncId')));
			}
		} catch(e) {
			devTools.writeMsg('ttineCal', 'asDom', 'oops!');
		}

		if (command != null)
			command.appendChild(data);
	} else {
		//command = doc.createElement('ServerId');
		//command.appendChild(doc.createTextNode(card.getProperty('TineSyncId')));
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

  cardPropertyAsText: function(card, name) {
	//devTools.enter('ttineCal', 'cardPropertyAsText');
	var result = '';
	
	var names = name.split('.');
	var pName = names[0];
	var pSubName = (names.length > 1 ? names[1] : undefined);
	switch (pName) {
		case 'creationDate':
		case 'startDate':
		case 'endDate':
			if (pSubName == undefined)
				result = ttineCal.getStringFromCalIDateTime(card[pName]);
			else
				result = (card['startDate'][pSubName] == true ? '1' : '0');
			break;
		case 'ORGANIZER': // is not stored to DB
			//var organizer = card.getProperty('ORGANIZER');
			//if (organizer != null && organizer != undefined)
			//	result = card.getProperty('ORGANIZER')[pSubName];
			break;
		case 'alarmOffset':
			var alarms = card.getAlarms({});
			if (alarms.length > 0)
				result = alarms[0].offset.minutes;
			break;
		default:
			result = helper.unescapeNodeValue((pName.toUpperCase() != pName ? card[pName] : card.getProperty(pName)));
			break;
	}
	
	result = (result == null ? '' : result);
	//devTools.writeMsg('ttineCal', 'cardPropertyAsText', 'name: ' + name + ', value: ' + result);
	return result;
  },
  
  md5hashForCard: function(card, report) {
    var result = '';
	  
	if (card instanceof Components.interfaces.calIEvent) {
		// read card data
		var md5text = '';
		for (var property in this.mapActiveSyncToThunderbird) {
			var tbField = this.mapActiveSyncToThunderbird[property];
			
			if (tbField == '')
				continue;
		
			var tbValue = null;
			if(tbField.substr(0,1) != '%') {
				tbValue = ttineCal.cardPropertyAsText(card, tbField);
			}

			if (tbValue != '' && tbValue != null) 
				md5text = md5text + tbValue;
		} 
		result = ttineCal.md5hash(md5text);
		
		if (typeof report == 'boolean' && report == true && result != card.getProperty('TineSyncMD5')) {
			devTools.writeMsg('ttineCal', 'md5hashForCard', card.getProperty('TineSyncId') + ', in: \'' + md5text + '\'\n\tmd5: ' + result + '\n\told: ' + card.getProperty('TineSyncMD5'));
		}
	} else
		devTools.writeMsg('ttineCal', 'md5hashForCard', 'in: not instanceof Components.interfaces.calIEvent');
	
	return result;
  },
  
  md5hash: function(md5input) {
	return ttineAb.md5hash(md5input);
  }, 
  
  uniqueId: function() {
	  return ttineAb.uniqueId();
  },

  removeCard: function(async, cards, tineSyncId) {
	try {
		var card = null, cardIdx = null;
		for (var idx in cards) {
			if (cards[idx].getProperty('TineSyncId') == tineSyncId) {
				card = cards[idx];
				cardIdx = idx;
				break;
			}
		}
		
		if(card != null) {
			devTools.writeMsg("ttineCal", "removeCard", "syncID: " + tineSyncId);

			card.calendar.deleteItem(card, { onOperationComplete: function() { } });
			async.cards.splice(cardIdx, 1);
		}
	} catch (err) {
		helper.prompt("removeCard: Couldn't delete calendar entry. Please check your books.\n\n"+err);
	}
  }, 

  responseCard: function(async, tineSyncId, fields, values) {
	var cards = async.cards;
	
	try {
		var card = null, cardIdx = null;
		for (var idx in cards) {
			if (cards[idx].getProperty('TineSyncId') == tineSyncId) {
				card = cards[idx];
				cardIdx = idx;
				break;
			}
		}
		if(card == null)
			throw "Unknown calendar entry, with internal id "+tineSyncId;

		devTools.writeMsg("cal", "responseCard", "syncID: " + tineSyncId);

		var newCard = card.parentItem.clone();

		// change requested fields
		for (var f = 0; f < fields.length; f++) { 
			var field = fields[f]; 
			var value = values[f];
			// if card is changed calculate new md5
			if (field == 'TineSyncMD5')
				value = ttineCal.md5hashForCard(newCard);
			
			newCard.setProperty(field, value); 
		}
		// save changes
		newCard.calendar.modifyItem(newCard, card.parentItem, null);
		async.cards[cardIdx] = newCard;
	} catch (err) {
		helper.prompt("responseCard: Couldn't update calendar entry. Please check your books.\n\n"+err);
	}
  }, 

  commandCard: function(async, command, id, appDataDom) { 
	try {
		var cards = async.cards;

		if(command == 'Add' || command == 'Change') {
			var uri = async.local;
			var syncConfig = config.getSyncConfigByCategoryUri(this.category, uri);
			var calendar = config.getCalByUri(uri, true).calendar; 
			var card = null, parentCardIdx = null;
			
			// If cards are resent (syncKey = 0) don't change existing (managed) cards
			if(command == 'Change' || syncConfig.managedCards.indexOf(id) >= 0 ) { 
				for (var idx in cards) {
					if (cards[idx].getProperty('TineSyncId') == id) {
						cards[idx].parentItem;
						parentCardIdx = idx;
						card = ttineCal.getCleanCardClone(cards[idx]);
						break;
					}

				} 
			// new card
			} else {
				card = Components.classes["@mozilla.org/calendar/event;1"].
						createInstance(Components.interfaces.calIEvent);  
				card.setProperty('TineSyncId', id);
				card['startDate'] = ttineCal.getCalIDateTimeFromString('19700101T000000Z');
			}

			if (card == null) 
				throw command + " of card failed.";
			
			// apply server data
			var cnt = appDataDom.childNodes.length;

			for (var i=0; i<cnt; i++) {
				var childNode = appDataDom.childNodes[i];
				var asField = childNode.nodeName;
				var asValue = childNode.firstChild.nodeValue;
				
				var tbField = this.mapActiveSyncToThunderbird[asField];
				
				if (tbField == '')
					continue;
				
				try {
					var names = tbField.split('.');
					var pName = names[0];
					var pSubName = (names.length > 1 ? names[1] : undefined);
					switch (pName) {
						// readonly
						case 'creationDate':
							continue;
							break;
						case 'startDate':
						case 'endDate':
							if (pSubName == undefined)
								card[pName] = ttineCal.getCalIDateTimeFromString(asValue);
							else
								card[pName][pSubName] = (asValue == '1');
							break;
						case 'ORGANIZER':
							ttineCal.getOrganizer(card)[pSubName] = asValue;
							break;
						case 'alarmOffset':
							var alarm = ttineCal.getAlarm(card);
							alarm.offset.minutes = -asValue;
							alarm.offset.normalize();
							break;
						case 'DESCRIPTION':
							// toDo better parse
							//var type = childNode.firstChild.firstChild.nodeValue;
							asValue = childNode.lastChild.firstChild.nodeValue;
							card.setProperty(pName, asValue);
							break;
						default:
							if (pName.toUpperCase() != pName)
								card[pName] = helper.unescapeNodeValue(asValue);
							else
								card.setProperty(pName, asValue);
							break;
					}
					//devTools.writeMsg('ttineCal', 'commandCard', 'processing ' + tbField + ': ' + asValue);
				} catch(setValueEx) {
					devTools.writeMsg('ttineCal', 'commandCard', 'processing ' + tbField + ' failed -> ' + setValueEx);
				}
			}
			
			card.setProperty('TineSyncMD5', ttineCal.md5hashForCard(card, true));

			// save changes. If cards are resent (syncKey = 0) don't change existing (managed) cards
			if (command == 'Change' || syncConfig.managedCards.indexOf(id) >= 0 ) {
				//devTools.writeMsg('ttineCal', 'commandCard', 'modifying card');
				calendar.modifyItem(card, cards[parentCardIdx], null);
				async.cards[parentCardIdx] = card;
			} else if (command == 'Add') {
				//devTools.writeMsg('ttineCal', 'commandCard', 'adding card');
				calendar.addItem(card, null);
				async.cards.push(card);
			}
			devTools.writeMsg('ttineCal', 'commandCard', 'command: ' + command + ', md5: ' + card.getProperty('TineSyncMD5'));
		}

		if(command == 'Delete')
			this.removeCard(async, cards, id);
	} catch (err) {
		helper.prompt("commandCard: Server sent new cards but they couldn't be applied to the local Calendar. \n\n"+err);
	}
  },
  
  getCleanCardClone: function(card) {
	var result = card.parentItem.clone();
		
	// clean up
	try {
		for (var property in this.mapActiveSyncToThunderbird) {
			var tbField = this.mapActiveSyncToThunderbird[property];
	
			if (tbField == '')
				continue;
			
			var names = tbField.split('.');
			var pName = names[0];
			//var pSubName = (names.length > 1 ? names[1] : undefined);
			switch (pName) {
				// readonly
				case 'creationDate':
				case 'startDate':
				case 'endDate':
				case 'title':
					continue;
					break;
				case 'alarmOffset':
					var alarms = result.getAlarms({});
					for (var idx in alarms)
						result.deleteAlarm(alarms[idx]);
					break;
				default:
					if (pName.toUpperCase() == pName) // && card.getProperty(pName) != undefined)
						result.deleteProperty(pName);
					break;
			}
		}
		result.setCategories(0, []);
		result.removeAllAttendees();
		result.removeAllAttachments();
		result.removeAllRelations();
	} catch(e) {
		devTools.writeMsg('ttineCal', 'getCleanCardClone', 'error: ' + e);
	}
	 
	return result;
  },
	  
  getOrganizer: function(card) {
	var pName = 'ORGANIZER';
	
	if (card.getProperty(pName) == undefined) {
		var organizer = Components.classes["@mozilla.org/calendar/attendee;1"].
				createInstance(Components.interfaces.calIAttendee);
		organizer.isOrganizer = true;
		card.setProperty(pName, organizer);
	}
	return card.getProperty(pName);
  },
  
  getAlarm: function(card) {
	var alarms = card.getAlarms({});
	var alarm = null;
	
	if (alarms.length == 0) {
		var alarmOffset = Components.classes["@mozilla.org/calendar/duration;1"].
				createInstance(Components.interfaces.calIDuration);
		
		alarm = Components.classes["@mozilla.org/calendar/alarm;1"].
				createInstance(Components.interfaces.calIAlarm);
		alarm.action = "DISPLAY";
		alarm.related = Components.interfaces.calIAlarm.ALARM_RELATED_START;
		alarm.offset = alarmOffset;
		
		card.addAlarm(alarm);
	} else
		alarm = alarms[0];
	
	return alarm;
  },

  getCalIDateTimeFromString: function(dateString) {
	//devTools.writeMsg('ttineCal', 'getCalIDateTimeFromString', 'date: ' + dateString);
	var result = Components.classes["@mozilla.org/calendar/datetime;1"].
				createInstance(Components.interfaces.calIDateTime);
	
	try {
		result.resetTo(dateString.substring(0, 4), dateString.substring(4, 6) - 1, dateString.substring(6, 8), dateString.substring(9, 11), dateString.substring(11, 13), dateString.substring(13, 15), UTC());
		result = result.getInTimezone(calendarDefaultTimezone());
	} catch(e) {
		devTools.writeMsg('ttineCal', 'getCalIDateTimeFromString', 'error: ' + e);
		result = null;
	}
	
	return result;
  },
  
  getStringFromCalIDateTime: function(dateTime) {
	  var utc = dateTime.getInTimezone(UTC());
	  var result = utc.year;
	  
	  result += (utc.month + 1 < 10 ? '0' + (utc.month + 1).toString() : (utc.month + 1).toString());
	  result += (utc.day < 10 ? '0' + utc.day : utc.day);
	  result += 'T';
	  result += (utc.hour < 10 ? '0' + utc.hour : utc.hour);
	  result += (utc.minute < 10 ? '0' + utc.minute : utc.minute);
	  result += (utc.second < 10 ? '0' + utc.second : utc.second);
	  result += 'Z';
	  
	  return result;
  },
  
  managedCards: function(async) {
	var uri = async.local;
	var cal = config.getCalByUri(uri, true);
	var cards = async.cards;

	// collecting cards
	if (async.cards == undefined) {
		try {
			async.managedCardsOnly = true;
			async.cards = [];
			async.onGetResult = ttineCal.collectCards;
			async.onOperationComplete = ttineCal.managedCards;
			this.getCalendarItems(cal.calendar, cal.calendar.ITEM_FILTER_TYPE_EVENT, async);
		} catch(e) {
			async.complete = true;
			async.aborted = true;
		}
	// process cards
	} else {
		var syncConfig = config.getSyncConfigByCategoryUri(this.category, uri);
		syncConfig.managedCards = Array();
		for (var idx in cards) { 
			var card = cards[idx];
			if (card instanceof Components.interfaces.calIEvent) {
				var tineId = card.getProperty('TineSyncId'); 
				if(tineId != null && tineId.substr(0,7) != 'client-')
					syncConfig.managedCards.push(tineId);
			}
		}

		if (typeof async.managedCardsOnly == 'boolean') {
			devTools.writeMsg('ttineCal', 'managedCards', 'init remote: ' + syncConfig.remote + ' #' + syncConfig.managedCards.length);
			async.complete = true;
		}
	}
  },

  doClearExtraFields: function(async) { 
	var uri = async.local;
	var cal = config.getCalByUri(uri, true);
	var cards = async.cards;
	var cleanData = (typeof async.deleteData == 'boolean' && async.deleteData == true ? true : false);

	// collecting cards
	if (async.cards == undefined) {
		try {
			async.doClearExtraFieldsOnly = true;
			async.cards = [];
			async.onGetResult = ttineCal.collectCards;
			async.onOperationComplete = ttineCal.doClearExtraFields;
			this.getCalendarItems(cal.calendar, cal.calendar.ITEM_FILTER_TYPE_EVENT, async);
		} catch(e) {
			async.complete = true;
			async.aborted = true;
		}
	// process cards
	} else {
		for (var idx in cards) { 
			var card = cards[idx];
			if (card instanceof Components.interfaces.calIEvent) {
				if (cleanData == false) {
					var newCard = card.parentItem.clone();
					newCard.deleteProperty('TineSyncId'); 
					newCard.deleteProperty('TineSyncMD5');
					cal.calendar.modifyItem(newCard, card.parentItem, null);
				} else
					cal.calendar.deleteItem(card, { onOperationComplete: function() { } });
			}
		}

		if (typeof async.doClearExtraFieldsOnly == 'boolean')
			async.complete = true;
	}
  },

  getCalendarItems: function(calendar, itemType, async) {
	calendar.getItems(itemType | calendar.ITEM_FILTER_COMPLETED_ALL, 0, null, null, 
		{
			onGetResult: ttineCal.onGetResult, 
		  	onOperationComplete: ttineCal.onOperationComplete,
		  	asyncObjRef: async,
		});
  },

  onGetResult: function(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
	var async = this.asyncObjRef;
	  
	if (!Components.isSuccessCode(aStatus)) {
    	async.complete = true;
        async.aborted = true;
        return;
    } else {
		if (async.onGetResult != undefined && (typeof async.onGetResult == 'function'))
			for (var i in aItems)
    			async.onGetResult(async, aItems[i]);
    }
  },

  onOperationComplete: function(aCalendar, aStatus, aOperationType, aId, aDateTime) {
	var async = this.asyncObjRef;
	if (async.onOperationComplete != undefined && (typeof async.onOperationComplete == 'function'))
		async.onOperationComplete(async);
	else
		async.complete = true;
  },
  
  collectCards: function(async, item) {
	async.cards.push(item);
  },
  
  applyCollection: function(async) {
	var uri = async.local;
	var cal = config.getCalByUri(uri, true);

	// calendar seems to be deleted 
	if (cal.calendar == undefined) {
		async.complete = true;
		async.aborted = true;
		return null;
	}
	
	// collecting cards
	if (async.cards == undefined) {
		try {
			async.cards = [];
			async.onGetResult = ttineCal.collectCards;
			async.onOperationComplete = ttineCal.applyCollection;
			this.getCalendarItems(cal.calendar, cal.calendar.ITEM_FILTER_TYPE_EVENT, async);
		} catch(e) {
			async.complete = true;
			async.aborted = true;
		}
		return null;
	// process cards
	} else {
		var responses = async.responses;
		var commands = async.commands;
		var cards = async.cards;
		
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
						ttineCal.removeCard(cards, (cServerId ? cServerId : cClientId));
					}
					continue;
				} 
	
				if (cardDom.nodeName == 'Add') {
					ttineCal.responseCard(async, cClientId, Array('TineSyncId', 'TineSyncMD5'), Array(cServerId, '') );
				} else if (cardDom.nodeName == 'Change')
					ttineCal.responseCard(async, cServerId, Array('TineSyncMD5'), Array('') );
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
					ttineCal.commandCard(async, cardDom.nodeName, cServerId, cAppData); 
				}
			}
		}
	
		// keep track of cards for deleting
		ttineCal.managedCards(async);
		
		async.complete = true;
	}
	
	return null;
  }
};
