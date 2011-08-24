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

var wbxml = {

  /*
   * THIS TAGS ARE HIGHLY SPECIFIC FOR MS-ActiveSync. THEY'RE NOT USABLE FOR wbxml STANDARD IN GENERAL!!
   */

  // {tagname: 0x<codepage><token>}
  tags: {
	// AirSync (codepage 0x00)
	'Sync':                              0x0005,
	'Responses':                         0x0006,
	'Add':                               0x0007,
	'Change':                            0x0008,
	'Delete':                            0x0009,
	'Fetch':                             0x000A,
	'SyncKey':                           0x000B,
	'ClientId':                          0x000C,
	'ServerId':                          0x000D,
	'Status':                            0x000E,
	'Collection':                        0x000F,
	'Class':                             0x0010,
	'Version':                           0x0011,
	'CollectionId':                      0x0012,
	'GetChanges':                        0x0013,
	'MoreAvailable':                     0x0014,
	'WindowSize':                        0x0015,
	'Commands':                          0x0016,
	'Options':                           0x0017,
	'FilterType':                        0x0018,
	'Truncation':                        0x0019,
	'RTFTruncation':                     0x001A,
	'Conflict':                          0x001B,
	'Collections':                       0x001C,
	'ApplicationData':                   0x001D,
	'DeletesAsMoves':                    0x001E,
	'NotifyGUID':                        0x001F,
	'Supported':                         0x0020,
	'SoftDelete':                        0x0021,
	'MIMESupport':                       0x0022,
	'MIMETruncation':                    0x0023,
	'Wait':                              0x0024,
	'Limit':                             0x0025,
	'Partial':                           0x0026,
	'ConversationMode':                  0x0027,
	'MaxItems':                          0x0028,
	'HeartbeatInterval':                 0x0029,

	// Contacts (codepage 0x01)
	'Contacts_Anniversary':              0x0105,
	'Contacts_AssistantName':            0x0106,
	'Contacts_AssistantTelephoneNumber': 0x0107,
	'Contacts_Birthday':                 0x0108,
	'Contacts_Body':                     0x0109,
	'Contacts_Business2PhoneNumber':     0x010C,
	'Contacts_BusinessCity':             0x010D,
	'Contacts_BusinessCountry':          0x010E,
	'Contacts_BusinessPostalCode':       0x010F,
	'Contacts_BusinessState':            0x0110,
	'Contacts_BusinessStreet':           0x0111,
	'Contacts_BusinessFaxNumber':        0x0112,
	'Contacts_BusinessPhoneNumber':      0x0113,
	'Contacts_CarPhoneNumber':           0x0114,
	'Contacts_Categories':               0x0115,
	'Contacts_Category':                 0x0116,
	'Contacts_Children':                 0x0117,
	'Contacts_Child':                    0x0118,
	'Contacts_CompanyName':              0x0119,
	'Contacts_Department':               0x011A,
	'Contacts_Email1Address':            0x011B,
	'Contacts_Email2Address':            0x011C,
	'Contacts_Email3Address':            0x011D,
	'Contacts_FileAs':                   0x011E,
	'Contacts_FirstName':                0x011F,
	'Contacts_Home2PhoneNumber':         0x0120,
	'Contacts_HomeCity':                 0x0121,
	'Contacts_HomeCountry':              0x0122,
	'Contacts_HomePostalCode':           0x0123,
	'Contacts_HomeState':                0x0124,
	'Contacts_HomeStreet':               0x0125,
	'Contacts_HomeFaxNumber':            0x0126,
	'Contacts_HomePhoneNumber':          0x0127,
	'Contacts_JobTitle':                 0x0128,
	'Contacts_LastName':                 0x0129,
	'Contacts_MiddleName':               0x012A,
	'Contacts_MobilePhoneNumber':        0x012B,
	'Contacts_OfficeLocation':           0x012C,
	'Contacts_OtherCity':                0x012D,
	'Contacts_OtherCountry':             0x012E,
	'Contacts_OtherPostalCode':          0x012F,
	'Contacts_OtherState':               0x0130,
	'Contacts_OtherStreet':              0x0131,
	'Contacts_PagerNumber':              0x0132,
	'Contacts_RadioPhoneNumber':         0x0133,
	'Contacts_Spouse':                   0x0134,
	'Contacts_Suffix':                   0x0135,
	'Contacts_Title':                    0x0136,
	'Contacts_Webpage':                  0x0137,
	'Contacts_YomiCompanyName':          0x0138,
	'Contacts_YomiFirstName':            0x0139,
	'Contacts_YomiLastName':             0x013A,
	'Contacts_CompressedRTF':            0x013B,
	'Contacts_Picture':                  0x013C,
	'Contacts_Alias':                    0x013D,
	'Contacts_WeightedRank':             0x013E,

	// FolderHierarchy (codepage 0x07)
	'FolderHierarchy_DisplayName':       0x0707,
	'FolderHierarchy_ServerId':          0x0708,
	'FolderHierarchy_ParentId':          0x0709,
	'FolderHierarchy_Type':              0x070A,
	'FolderHierarchy_Status':            0x070C,
	'FolderHierarchy_Changes':           0x070E,
	'FolderHierarchy_Add':               0x070F,
	'FolderHierarchy_Delete':            0x0710,
	'FolderHierarchy_Update':            0x0711,
	'FolderHierarchy_SyncKey':           0x0712,
	'FolderHierarchy_FolderCreate':      0x0713,
	'FolderHierarchy_FolderDelete':      0x0714,
	'FolderHierarchy_FolderUpdate':      0x0715,
	'FolderHierarchy_FolderSync':        0x0716,
	'FolderHierarchy_Count':             0x0717,

	// Contacts2 (codepage 0x0C)
	'Contacts2_CustomerId':              0x0C05,
	'Contacts2_GovernmentId':            0x0C06,
	'Contacts2_IMAddress':               0x0C07,
	'Contacts2_IMAddress2':              0x0C08,
	'Contacts2_IMAddress3':              0x0C09,
	'Contacts2_ManagerName':             0x0C0A,
	'Contacts2_CompanyMainPhone':        0x0C0B,
	'Contacts2_AccountName':             0x0C0C,
	'Contacts2_NickName':                0x0C0D,
	'Contacts2_MMS':                     0x0C0E,

	// AirSyncBase (codepage 0x11)
	'AirSyncBase_BodyPreference':        0x1105,
	'AirSyncBase_Type':                  0x1106,
	'AirSyncBase_TruncationSize':        0x1107,
	'AirSyncBase_AllOrNone':             0x1108,
	'AirSyncBase_Body':                  0x110A,
	'AirSyncBase_Data':                  0x110B,
	'AirSyncBase_EstimatedDataSize':     0x110C,
	'AirSyncBase_Truncated':             0x110D,
	'AirSyncBase_Attachments':           0x110E,
	'AirSyncBase_Attachment':            0x110F,
	'AirSyncBase_DisplayName':           0x1110,
	'AirSyncBase_FileReference':         0x1111,
	'AirSyncBase_Method':                0x1112,
	'AirSyncBase_ContentId':             0x1113,
	'AirSyncBase_ContentLocation':       0x1114,
	'AirSyncBase_IsInline':              0x1115,
	'AirSyncBase_NativeBodyType':        0x1116,
	'AirSyncBase_ContentType':           0x1117,
	'AirSyncBase_Preview':               0x1118
  },

  // reverse lookup table, initialized programmatically (see function at the end of this file)
  // {codepage: {token: tagname}}
  tokens: {},
  
  // these tags are translated into javascript arrays
  multi: {
	'Add': true,
	'Change': true,
	'Delete': true,
	'Collection': true,
	'SoftDelete': true,
	'Contacts_Category': true,
	'Contacts_Child': true,
	'FolderHierarchy_Add': true,
	'FolderHierarchy_Delete': true,
	'FolderHierarchy_Update': true
  },

  // [tag, content, tag, content, ...] -> wbxml
  // contect may be null or ""
  // example:
  //   <FolderSync><FolderSync_SyncKey>0</FolderSync_SyncKey></FolderSync>
  //   ['FolderSync', ['FolderSync_SyncKey', '0']]
  obj2wbxml: function(obj) {  
	var header = String.fromCharCode(0x03,0x01,0x6A,0x00); 

	var wbxml_codepage = 0;		// state used in inner function

	function obj2wbxml_internal(obj) {
		var i, tagname, content, parts, aPage;
		var wbxml_data = '';
		for (i=0; i<obj.length; i+=2) {
			tagname = obj[i];
			content = obj[i+1];

			if (wbxml.tags[tagname]===undefined) { new SyntaxError("wbxml2obj: tag '"+tagname+"' is unknown."); }

			// page of current tag
			aPage = wbxml.tags[tagname]>>8;
			if (aPage != wbxml_codepage) {
				// change codePage
				wbxml_data += String.fromCharCode(0x00) + String.fromCharCode(aPage); 
				wbxml_codepage = aPage;
			}
			// open tag
			var token = wbxml.tags[tagname]&0xFF;

			if (content!==null && content!=="") {
				token = token + 0x40;
			}
			wbxml_data = wbxml_data + String.fromCharCode(token);
			// content
			if (content!==null && content!=="") {
				if (typeof content == 'object') {
					wbxml_data += obj2wbxml_internal(content);
				} else {
					wbxml_data += String.fromCharCode(0x03) + wbxml.utf8Encode(String(content)) + String.fromCharCode(0x00);
				}
			}
			// close tag (if content inside)
			if (content!==null && content!=="") {
				wbxml_data += String.fromCharCode(0x01); 
			}
		}
		return wbxml_data;
	}

	return header + obj2wbxml_internal(obj);
  },

  // convert wbxml to javascript data structure
  // wbxml -> {tag: content, tag: [content, content, ...], ...}
  wbxml2obj: function(wbxml_data) {
	// check for wbxml input in ms airsync dialect
	if (!wbxml_data || String(wbxml_data).substr(0, 4) != String.fromCharCode(0x03,0x01,0x6A,0x00)) {
		return null;
	}
	
	var i = 4, page = 0;	// used in inner function via closure

	function wbxml2obj_internal() {
		var c, beg, tagname, inside, content;
		var obj = {};
		while (i < wbxml_data.length) {
			c = wbxml_data.charCodeAt(i++);

			if (c==0x00) {				// code page changes: 00 xx
				page = wbxml_data.charCodeAt(i++);
			}
			else if (c==0x03) {			// inline string: 03 xx xx xx xx 00
				beg = i;
				i = wbxml_data.indexOf(String.fromCharCode(0), beg);
				if (i<0) {
					i = wbxml_data.length;		// should never happen
				}
				// obj must not contain anything!
				obj = wbxml_data.substring(beg, i++);
				//obj = wbxml.utf8Decode(obj);
			}
			else if (c==0x01) {			// end tag
				return obj;
			}
			else if (c>=0x05) {			// tags
				// remove type addition from tags
				inside = (c & 0x40);
				c &= 0x3F;

				// find tag
				if (wbxml.tokens[page]===undefined) { new SyntaxError("wbxml2obj: codepage 0x"+page.toString(16)+" cannot be processed."); }
				if (wbxml.tokens[page][c]===undefined) { new SyntaxError("wbxml2obj: token 0x"+ c.toString(16)+" from codepage 0x" + page.toString(16) + " cannot be processed."); }
				
				tagname = wbxml.tokens[page][c];

				if (inside) {
					content = wbxml2obj_internal();		// get content
				} else {
					content = '1';				// boolean, default is '1' (true)
				}

				if (wbxml.multi[tagname]) {		// array?
					if (obj[tagname]) {
						obj[tagname].push(content);	// append
					} else {
						obj[tagname] = [content];	// create array
					}
				} else {						// single element
					if (obj[tagname]) {
						throw new SyntaxError("wbxml2obj: tag '"+tagname+"' occurs multiple times.");
					}
					obj[tagname] = content;
				}
			}
		}
		return obj;
	}
	
	// now call the function
	return wbxml2obj_internal();
  },

  utf8Encode: function (string) {
	var utf8string = "", n, c;
	for (n = 0; n < string.length; n++) {
		c = string.charCodeAt(n);
		if (c < 128) {
			utf8string += String.fromCharCode(c);					// 0xxxxxxx
		}
		else if(c < 2048) {
			utf8string += String.fromCharCode((c >> 6) | 192);		// 110xxxxx
			utf8string += String.fromCharCode((c & 63) | 128);  	// 10xxxxxx
		}
		else {
			utf8string += String.fromCharCode((c >> 12) | 224);			// 1110xxxx
			utf8string += String.fromCharCode(((c >> 6) & 63) | 128);	// 10xxxxxx
			utf8string += String.fromCharCode((c & 63) | 128);          // 10xxxxxx
		}
	}
	return utf8string;
  },
 
  utf8Decode: function (utf8string) {
	var string = "";
	var i = 0, c, c2, c3;
	while ( i < utf8string.length ) {
		c = utf8string.charCodeAt(i);
		if (c < 128) {
			string += String.fromCharCode(c);
			i++;
		}
		else if((c > 191) && (c < 224)) {
			c2 = utf8string.charCodeAt(i+1);
			string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
			i += 2;
		}
		else {
			c2 = utf8string.charCodeAt(i+1);
			c3 = utf8string.charCodeAt(i+2);
			string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
			i += 3;
		}
	}
	return string;
  }, 

  httpRequest: function(obj, command, f) { 
	// set default function values
	helper.debugOut("\nREQUEST: "+JSON.stringify(obj)+"\n");

	var wbxml_data = this.obj2wbxml(obj);
	
	// request
	var req = new XMLHttpRequest(); 
	req.mozBackgroundRequest = true; 
	req.open("POST", config.url+'?Cmd='+command+'&User='+config.user+'&DeviceId=ThunderTine'+config.deviceId+'&DeviceType='+config.deviceType, true);
	//req.overrideMimeType('application/vnd.ms-sync.wbxml'); 
	req.overrideMimeType("text/plain; charset=utf-8");        // Overrides the MIMEtype returned by the server (avoids the error message in TB console)
	req.setRequestHeader("User-Agent", config.deviceType+' ActiveSync');
	req.setRequestHeader("Content-Type", 'application/vnd.ms-sync.wbxml');
	req.setRequestHeader("Authorization", 'Basic '+btoa(config.user+':'+config.pwd));
	req.setRequestHeader("MS-ASProtocolVersion", '2.5');
	req.setRequestHeader("Content-Length", wbxml_data.length);
	req.onload = function () {
		if (req.readyState == 4) {
			if (req.status == 200) {
				// if(req.getResponseHeader('X-API')!='http://www.tine20.org/apidocs/tine20/') 
				//     helper.prompt(ttine.strings.getString('notTine'));

				helper.debugOut("\nRESPONSE: "+JSON.stringify(wbxml.wbxml2obj(req.responseText))+"\n");
				f(req);  	// invoke callback function
			}
			else {
				helper.debugOut("\nRESPONSE: Failed: "+req.responseText+"\n");
				sync.failed('http', req);
			}
		} 
	};
	req.upload.onerror = function (e) {
		helper.prompt("Error " + e.target.status + " occurred while uploading.");
	};
	req.sendAsBinary(wbxml_data);
  }

};

// initialize internal wbxml.tokens datastructure
(function() {
	var codepage, tag;
	for (var tokenname in wbxml.tags) {
		codepage = wbxml.tags[tokenname]>>8;
		tag = wbxml.tags[tokenname]&0xFF;
  		if (!wbxml.tokens[codepage]) {
			wbxml.tokens[codepage] = {}
		}
		wbxml.tokens[codepage][tag] = tokenname;
	}
})();
