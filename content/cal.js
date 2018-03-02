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
	"Calendar_OrganizerName": 		"ORGANIZER.commonName",
	"Calendar_OrganizerEmail": 		"ORGANIZER.id",
	"Calendar_BusyStatus": 			"",
	"Calendar_Reminder": 			"alarmOffset",
	"Calendar_Attendees": 			"ATTENDEES",
	"Calendar_Attendee": 			"",
	"Calendar_Email": 				"",
	"Calendar_Name": 				"",
	"Calendar_AttendeeStatus": 		"",
	"Calendar_AteendeeType": 		"",
	"Calendar_Recurrence":			"recurrenceInfo",
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
  attendeeRole: {
	'CHAIR':						0,
  	'REQ-PARTICIPANT':				1,
  	'OPT-PARTICIPANT':				2,
  	'NON-PARTICIPANT':				3
  },
  attendeeUserType: {
	'INDIVIDUAL':					1,
	'GROUP':						2,
	'RESOURCE':						3,
	'ROOM':							3,
	'UNKNOWN':						-1
  },
  attendeeStatus: {
	'NEEDS-ACTION': 				0,
	'ACCEPTED': 					3,
	'DECLINED': 					4,
	'TENTATIVE': 					2,
	'DELEGATED':					2,
	'COMPLETED':					3,
	'IN-PROCESS':					5
  },
  recurrenceType: {
	'DAILY':						0,
	'WEEKLY':						1,
	'MONTHLY':						2,
	'MONTHLYDAY':					3,
	'YEARLY':						5,
	'YEARLYDAY':					6
  },
  recurrenceDayOfWeek: {
	'day1':							0x01, 	// Sunday
	'day2':							0x02, 	// Monday
	'day3':							0x04, 	// Thuesday
	'day4':							0x08,	// Wednesday
	'day5':							0x10,	// Thursday
	'day6':							0x20,	// Friday
	'day7':							0x40,	// Saturday
	'LastOfMonth':					0x7f,  
	'WorkingDays':					0x3e	// Monday to Friday 
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
		async.aborted = true;
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
					hasTimezone = true;
				}
			}
		}
		// attendees
		var attendeesNode = this.getAttendeesAsDom(card, doc);
		if (attendeesNode != null)
			data.appendChild(attendeesNode);
		// recurrence
		var recurrenceNode = this.getRecurrenceAsDom(card, doc);
		if (recurrenceNode != null)
			data.appendChild(recurrenceNode);
		
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
		case 'ATTENDEES':
		case 'recurrenceInfo':
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
		// attendees
		var attendees = this.getAttendees(card);
		for (var idx in attendees)
			md5text = md5text + attendees[idx]['email'] + attendees[idx]['name'] + attendees[idx]['status'] + attendees[idx]['userType'];
		// recurrence
		var recurrence = this.getRecurrence(card);
		if (recurrence != null) {// toDo more fields
			md5text = md5text + recurrence['type'] + recurrence['interval'];
			if (recurrence['count'] != undefined)
				md5text = md5text + recurrence['count'];
			if (recurrence['untilDate'] != undefined)
				md5text = md5text + recurrence['untilDate'];
			if (recurrence['dayOfWeek'] != undefined)
				md5text = md5text + recurrence['dayOfWeek'];
			if (recurrence['dayOfMonth'] != undefined)
				md5text = md5text + recurrence['dayOfMonth'];
			if (recurrence['weekOfMonth'] != undefined)
				md5text = md5text + recurrence['weekOfMonth'];
			if (recurrence['monthOfYear'] != undefined)
				md5text = md5text + recurrence['monthOfYear'];
		}

		result = ttineCal.md5hash(md5text);
		
		if (typeof report == 'boolean' && report == true && result != card.getProperty('TineSyncMD5')) {
			devTools.writeMsg('ttineCal', 'md5hashForCard', card.getProperty('TineSyncId') + ', in: \'' + md5text + '\'\n\tmd5: ' + result + '\n\told: ' + card.getProperty('TineSyncMD5'));
		}
	}
	
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
				// to avoid runtime problems set mandatory default
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
				
				if (tbField == '' || tbField == undefined)
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
								if (!(card.startDate.isDate && pName == 'endDate'))
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
							var descriptions = helper.doEvaluateXPath(childNode, "//AirSyncBase_Data");
							if (descriptions.length >= 0)
								card.setProperty(pName, descriptions[0].firstChild.nodeValue);
							break;
						case 'ATTENDEES':
							this.getAttendeesFromDom(card, cards[parentCardIdx], childNode);
							break;
						case 'recurrenceInfo':
							this.getRecurrenceFromDom(card, cards[parentCardIdx], childNode);
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
				case 'recurrenceInfo':
					result[pName] = null;
					break;
				default:
					if (pName.toUpperCase() == pName)
						result.deleteProperty(pName);
					break;
			}
		}
		result.removeAllAttendees();
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

  getRecurrenceFromDom: function(card, oldCard, recurrenceNode) {
	try {
		var recurrence = {};
		
		for (var idx in recurrenceNode.childNodes) {
			var childNode = recurrenceNode.childNodes[idx];
			
			var asField = null, asValue = null;
			
			switch (childNode.nodeName) {
				case 'Calendar_Type':
					asField = 'type';
					for (var type in this.recurrenceType)
						if (this.recurrenceType[type] == childNode.firstChild.nodeValue) {
							asValue = type;
							break;
						}
					break;
				case 'Calendar_Interval':
					asField = 'interval';
					break;
				case 'Calendar_Occurrences':
					asField = 'count';
					asValue = parseInt(childNode.firstChild.nodeValue, 10);
					asValue = (asValue >= 999 ? -1 : asValue);
					break;
				case 'Calendar_Until':
					asField = 'untilDate';
					asValue = this.getCalIDateTimeFromString(childNode.firstChild.nodeValue);
					break;
				case 'Calendar_DayOfWeek':
					asField = 'dayOfWeek';
					break;
				case 'Calendar_DayOfMonth':
					asField = 'dayOfMonth';
					break;
				case 'Calendar_WeekOfMonth':
					asField = 'weekOfMonth';
					break;
				case 'Calendar_MonthOfYear':
					asField = 'monthOfYear';
					break;
				default:
					continue;
					break;
			}

			if (asValue == null)
				asValue = parseInt(childNode.firstChild.nodeValue, 10);
			if (asField != null) {
				recurrence[asField] = asValue;
			}
		}
		
		devTools.writeMsg('ttineCal', 'recurrenceFromDom', 'recurrence: ' + JSON.stringify(recurrence));
		var recurrenceInfo = Components.classes["@mozilla.org/calendar/recurrence-info;1"].
				createInstance(Components.interfaces.calIRecurrenceInfo);
		var recurrenceRule = Components.classes["@mozilla.org/calendar/recurrence-rule;1"].
				createInstance(Components.interfaces.calIRecurrenceRule);
		var asComponent = null;
		
		recurrenceInfo.item = card;

		// set basic settings
		recurrenceRule.interval = recurrence.interval;
		if (recurrence.count != undefined)
			recurrenceRule.count = recurrence.count; 
		if (recurrence.untilDate != undefined)
			recurrenceRule.untilDate = recurrence.untilDate;

		asValue = [];
		switch (this.recurrenceType[recurrence.type]) {
			case this.recurrenceType.DAILY:
				devTools.writeMsg('ttineCal', 'recurrenceFromDom', 'DAILY: ');
				break;
			case this.recurrenceType.WEEKLY:
				if (recurrence.dayOfWeek == undefined)
					for (var i=1; i<=7; i++)
						asValue.push(i);
				else
					for (var i=1; i<=7; i++)
						if (recurrence.dayOfWeek & this.recurrenceDayOfWeek['day' + i])
							asValue.push(i);
				
				// working days
				if (asValue.length == 5 && recurrence.dayOfWeek == this.recurrenceDayOfWeek.WorkingDays) {
					recurrence.type = 'DAILY';
				}
				asComponent = 'BYDAY';
				break;
			case this.recurrenceType.MONTHLY:
				if (recurrence.dayOfWeek != undefined)
					asValue.push((recurrence.dayOfWeek == this.recurrenceDayOfWeek.LastOfMonth ? -1 : dayOfWeek));
				if (recurrence.dayOfMonth != undefined)
					asValue.push(recurrence.dayOfMonth);

				asComponent = 'BYMONTHDAY';
				break;
			case this.recurrenceType.MONTHLYDAY:
				if (recurrence.dayOfWeek != this.recurrenceDayOfWeek.LastOfMonth) {
					recurrence.type = 'MONTHLY';
					
					for (var i=1; i<=7; i++)
						if (recurrence.dayOfWeek & this.recurrenceDayOfWeek['day' + i]) {
							asValue.push(i);
							break;
						}
					if (asValue.length == 0)
						throw new Error('mapping failed!');

					if (recurrence.weekOfMonth != undefined && recurrence.weekOfMonth <= 4)
						asValue[0] += recurrence.weekOfMonth * 8; // 9 to 47
					if (recurrence.weekOfMonth != undefined && recurrence.weekOfMonth == 5)
						asValue[0] = -1 * (asValue[0] + 8); // -9 to -15
					asComponent = 'BYDAY';
				}
				break;
			case this.recurrenceType.YEARLY:
				if (recurrence.dayOfMonth != undefined && recurrence.monthOfYear != undefined) {
					recurrenceRule.setComponent('BYMONTH', 1, [recurrence.monthOfYear]);
					asValue.push(recurrence.dayOfMonth);
					asComponent = 'BYMONTHDAY';
				}
				break;
			case this.recurrenceType.YEARLYDAY:
				if (recurrence.dayOfWeek != undefined && recurrence.weekOfMonth != undefined && recurrence.monthOfYear) {
					recurrence.type = 'YEARLY';
					recurrenceRule.setComponent('BYMONTH', 1, [recurrence.monthOfYear]);

					for (var i=1; i<=7; i++)
						if (recurrence.dayOfWeek & this.recurrenceDayOfWeek['day' + i]) {
							asValue.push(i);
							break;
						}
					if (asValue.length == 0)
						throw new Error('mapping failed!');

					if (recurrence.weekOfMonth <= 4)
						asValue[0] += recurrence.weekOfMonth * 8; // 9 to 47
					if (recurrence.weekOfMonth == 5)
						asValue[0] = -1 * (asValue[0] + 8); // -9 to -15
					asComponent = 'BYDAY';
				}
				break;
		}

		// at least the mapped type and component
		recurrenceRule.type = recurrence.type;
		if (asComponent != null && asValue.length > 0)
			recurrenceRule.setComponent(asComponent, asValue.length, asValue);
		
		recurrenceInfo.appendRecurrenceItem(recurrenceRule);
		card.recurrenceInfo = recurrenceInfo;
	} catch(e) {
		devTools.writeMsg('ttineCal', 'getRecurrenceFromDom', 'error: ' + e + '\ndom: ' + wbxml.domStr(recurrenceNode));
		// keep old values
		card.recurrenceInfo = null;
	}
  },
  
  getRecurrenceAsDom: function(card, doc) {
	var recurrence = this.getRecurrence(card);
	var result = null;
	
	if (recurrence != null) {
		result = doc.createElement('Calendar_Recurrence');

		//devTools.writeMsg('ttineCal', 'getRecurrenceAsDom', 'recurrence: ' + JSON.stringify(recurrence));
		for (var property in recurrence) {
			var name = '';
			switch (property) {
				case 'type':
					name = 'Calendar_Type';
					break;
				case 'interval':
					name = 'Calendar_Interval';
					break;
				case 'count':
					name = 'Calendar_Occurrences';
					break;
				case 'untilDate':
					name = 'Calendar_Until';
					break;
				case 'dayOfWeek':
					name = 'Calendar_DayOfWeek';
					break;
				case 'dayOfMonth':
					name = 'Calendar_DayOfMonth';
					break;
				case 'weekOfMonth':
					name = 'Calendar_WeekOfMonth';
					break;
				case 'monthOfYear':
					name = 'Calendar_MonthOfYear';
					break;
				default:
					continue;
					break;
			}
			//devTools.writeMsg('ttineCal', 'getRecurrenceAsDom', property + ': ' + recurrence[property] + ' -> ' + name);
			if (name != '') {
				result.appendChild(doc.createElement(name));
				result.lastChild.appendChild(doc.createTextNode(recurrence[property]));
			}
		}
		//devTools.writeMsg('ttineCal', 'getRecurrenceAsDom', 'result: ' + wbxml.domStr(result));
	}
	
	return result;
  },

  getRecurrence: function(card) {
	var result = null;

	try {
		if (card['recurrenceInfo'] != null) {
			var recurrences = card['recurrenceInfo'].getRecurrenceItems({});
			//devTools.writeMsg('ttineSync', 'getRecurrence', 'recurrences: #' + recurrences.length);
			var recurrence = recurrences[0];
	
			result = {};
			
			result.type = this.recurrenceType[recurrence.type];
			result.interval = recurrence.interval;
			if (recurrence.isByCount == true) {
				result.count = (recurrence.count == -1 ? 999 : recurrence.count);
				result.count = (result.count > 999 ? 999 : result.count);
			}
			if (recurrence.isByCount == false && recurrence.untilDate != null) {
				var untilDate = Components.classes["@mozilla.org/calendar/datetime;1"].
						createInstance(Components.interfaces.calIDateTime);
				untilDate.resetTo(recurrence.untilDate.year, recurrence.untilDate.month, recurrence.untilDate.day, 23, 59, 59, calendarDefaultTimezone());
				result.untilDate = this.getStringFromCalIDateTime(untilDate);
			}
			var component = null;
			if ((result.type == this.recurrenceType.DAILY || result.type == this.recurrenceType.WEEKLY) && (component = recurrence.getComponent('BYDAY', {})) != null) {
				result.dayOfWeek = 0;
				for (var i in component)
					result.dayOfWeek += (this.recurrenceDayOfWeek['day' + component[i]] != undefined ? this.recurrenceDayOfWeek['day' + component[i]] : 0);

				// parse failed
				if (result.dayOfWeek == 0 || result.dayOfWeek == this.recurrenceDayOfWeek.LastOfMonth)
					result.dayOfWeek = undefined;
				// dayOfWeek doesn't work with daily type
				else if (result.type == this.recurrenceType.DAILY)
					result.type = this.recurrenceType.WEEKLY;
			}
			if (result.type == this.recurrenceType.MONTHLY && (component = recurrence.getComponent('BYDAY', {})) != null && component.length > 0) {
				//devTools.writeMsg('ttineCal', 'getRecurrence', 'monthly: BYDAY ' + JSON.stringify(component));
				// all the fucking stuff each, first, second ... last sunday
				if (component.length == 1 && this.recurrenceDayOfWeek['day' + (Math.abs(component[0]) % 8)] != undefined) {
					result.dayOfWeek = this.recurrenceDayOfWeek['day' + (Math.abs(component[0]) % 8)];
					if (component[0] < 0)
						result.weekOfMonth = 5;
					if (component[0] > 7)
						result.weekOfMonth = ((component[0] / 8) >> 0);

					result.type = (result.weekOfMonth != undefined ? this.recurrenceType.MONTHLYDAY : this.recurrenceType.WEEKLY);
				// not supported yet
				} else
					return null;
			}
			if (result.type == this.recurrenceType.MONTHLY && (component = recurrence.getComponent('BYMONTHDAY', {})) != null && component.length > 0) {
				//devTools.writeMsg('ttineCal', 'getRecurrence', 'monthly: BYMONTHDAY ' + JSON.stringify(component));
				// last day of month
				if (component.length == 1 && component[0] == -1)
					result.dayOfWeek = this.recurrenceDayOfWeek.LastOfMonth;
				// one day of month
				else if (component.length == 1 && component[0] >= 1 && component[0] <= 31)
					result.dayOfMonth = component[0];
				// each day of month
				else if (component.length == 31) {
					result.type = this.recurrenceType.DAILY;
				// list of days in month not supported yet
				} else
					return null;
			}
			var month = null, day = null;
			if (result.type == this.recurrenceType.YEARLY && (month = recurrence.getComponent('BYMONTH', {})) != null && month.length > 0 && 
					(day = recurrence.getComponent('BYMONTHDAY', {})) != null && day.length > 0) {
				result.dayOfMonth = day[0];
				result.monthOfYear = month[0];
			}
			if (result.type == this.recurrenceType.YEARLY && (month = recurrence.getComponent('BYMONTH', {})) != null && month.length > 0 && 
					(day = recurrence.getComponent('BYDAY', {})) != null && day.length > 0) {
				// all the fucking stuff each, first, second ... last sunday
				if (day.length == 1 && this.recurrenceDayOfWeek['day' + (Math.abs(day[0]) % 8)] != undefined) {
					result.monthOfYear = month[0];
					result.dayOfWeek = this.recurrenceDayOfWeek['day' + (Math.abs(day[0]) % 8)];
					if (day[0] < 0)
						result.weekOfMonth = 5;
					if (day[0] > 7)
						result.weekOfMonth = ((day[0] / 8) >> 0);
					result.type = this.recurrenceType.YEARLYDAY;
				} else
					return null;
			}
		}
	} catch(e) {
		devTools.writeMsg('ttineCal', 'getRecurrence', 'error: ' + e);
	}
	
	return result;
  },
	  
  getAttendeesFromDom: function(card, oldCard, attendeesNode) {
	var attendees = helper.doEvaluateXPath(attendeesNode, "//Calendar_Attendee");
	for (var idx in attendees) {
		try {
			var attendee = attendees[idx];
			var email = helper.doEvaluateXPath(attendee, "//Calendar_Email");

			// missing mandatory
			if (email.length == 0)
				continue;

			email = 'mailto:' + helper.unescapeNodeValue(email[0].firstChild.nodeValue);
			var existingAttendee = (oldCard != undefined ? oldCard.getAttendeeById(email) : null);
			var newAttendee = null; 
				
			// create new attendee if not found 
			if (existingAttendee == null) {
				newAttendee = Components.classes["@mozilla.org/calendar/attendee;1"].
					createInstance(Components.interfaces.calIAttendee);
			// clone existing attendee
			} else
				newAttendee = existingAttendee.clone();
			
			// write defaults
			newAttendee.id = email;
			newAttendee.deleteProperty('commonName');
			newAttendee.deleteProperty('participationStatus');
			newAttendee.deleteProperty('userType');
			
			for (var i in attendee.childNodes) {
				var child = attendee.childNodes[i];

				switch (child.nodeName) {
					case 'Calendar_Name':
						newAttendee.setProperty('commonName', helper.unescapeNodeValue(child.firstChild.nodeValue));
						break;
					case 'Calendar_AttendeeStatus':
						for (var status in this.attendeeStatus)
							if (this.attendeeStatus[status] == child.firstChild.nodeValue) {
								newAttendee.setProperty('participationStatus', status);
								break;
							}
						break;
					case 'Calendar_AttendeeType':
						for (var userType in this.attendeeUserType)
							if (this.attendeeUserType[userType] == child.firstChild.nodeValue) {
								newAttendee.setProperty('userType', userType);
								break;
							}
						break;
				}
			}
			
			card.addAttendee(newAttendee);
		} catch(e) {
			devTools.writeMsg('ttineCal', 'getAttendeesFromDom', '#' + idx + ': error ' + e);
		}
	}
  },
  
  getAttendeesAsDom: function(card, doc) {
	var result = null;
	var attendees = this.getAttendees(card);
	
	for (var idx in attendees) {
		if (result == null)
			result = doc.createElement('Calendar_Attendees');

		var attendee = doc.createElement('Calendar_Attendee');
		for (var property in attendees[idx]) {
			var name = '';
			switch (property) {
				case 'email':
					name = 'Calendar_Email';
					break;
				case 'name':
					name = 'Calendar_Name';
					break;
				case 'status':
					name = 'Calendar_AttendeeStatus';
					break;
				case 'userType':
					name = 'Calendar_AttendeeType';
					break;
				default:
					continue;
					break;
			}
			
			if (attendees[idx][property] != '') {
				attendee.appendChild(doc.createElement(name));
				attendee.lastChild.appendChild(doc.createTextNode(attendees[idx][property]));
			}
		}
		result.appendChild(attendee);
	}
	
	return result;
  },
  
  getAttendees: function(card) {
	var result = [];

	var attendees = card.getAttendees({});
	for (var idx in attendees) {
		var attendee = {};
		attendee.email = (attendees[idx].id != undefined ? attendees[idx].id.replace('mailto:', '') : '');
		attendee.name = (attendees[idx].commonName != undefined ? attendees[idx].commonName : '');
		attendee.status = (attendees[idx].participationStatus != undefined && 
				this.attendeeStatus[attendees[idx].participationStatus] != undefined ? this.attendeeStatus[attendees[idx].participationStatus] : '');
		attendee.role = (attendees[idx].role != undefined && 
				this.attendeeRole[attendees[idx].role] != undefined ? this.attendeeRole[attendees[idx].role] : 1);
		attendee.userType = (attendees[idx].userType != undefined && 
				this.attendeeUserType[attendees[idx].userType] != undefined &&
				this.attendeeUserType[attendees[idx].userType] >= 0 ? this.attendeeUserType[attendees[idx].userType] : 1);
		
		result.push(attendee);
	}

	return result;
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
