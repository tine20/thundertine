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

var helper = {

  writefile: function(filename, data) {
    var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
        .createInstance(Components.interfaces.nsIFileOutputStream);
    var file = Components.classes["@mozilla.org/file/directory_service;1"]
        .getService(Components.interfaces.nsIProperties)
        .get("ProfD", Components.interfaces.nsILocalFile); // get profile folder
    file.append(filename); // set file name
    foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);   // write, create, truncate
    foStream.write(data, data.length);
    foStream.close();
  },

  readfile: function(filename) {
    var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"]
        .createInstance(Components.interfaces.nsIFileInputStream); 
	var bstream = Components.classes["@mozilla.org/binaryinputstream;1"]
	    .createInstance(Components.interfaces.nsIBinaryInputStream);
    var file = Components.classes["@mozilla.org/file/directory_service;1"]
        .getService(Components.interfaces.nsIProperties)
        .get("ProfD", Components.interfaces.nsILocalFile); // get profile folder
    var data;
    try {
        file.append(filename); // set file name
        fstream.init(file, 0x01, 0444, 0);
		bstream.setInputStream(fstream);
		data = bstream.readBytes(bstream.available());
        fstream.close();
    }
    catch(e) {
        return false;
    }
    return data; 
  }, 

  prompt: function(txt) {
    if (config.fullSilence==true) {
      Components.utils.reportError(txt);
    } else {
      var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                    .getService(Components.interfaces.nsIPromptService);
      promptService.alert(window, ttine.strings.getString("messageTitle"), txt);
    }
  },

  ask: function(txt) {
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);
    return promptService.confirm(window, ttine.strings.getString("messageTitle"), txt);
  },

  /*
   * The following functions are only for the ease of development. 
   * They have no functional sense.
   */

  debugOut: function(data) {
    if (config.debug) {
		var file = Components.classes["@mozilla.org/file/directory_service;1"]
			.getService(Components.interfaces.nsIProperties)
			.get("ProfD", Components.interfaces.nsILocalFile); // get profile folder
		file.append('debug.out');
		var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);
		foStream.init(file, 0x02 | 0x08 | 0x10, 0664, 0);   // write, create, append
		foStream.write(data, data.length);
		foStream.close();
	}
  },

  showExtraFields: function(contactsLocalFolder) {
    var res = '';

    var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
    
    var addressBook = abManager.getDirectory(contactsLocalFolder);
    var cards = addressBook.childCards;
    while (cards.hasMoreElements()) { 
        var card = cards.getNext();
        if (card instanceof Components.interfaces.nsIAbCard) { 
            res = res + card.getProperty("DisplayName", "")+"\n";
            res = res + card.getProperty("TineSyncId", "")+"\n";
            res = res + card.getProperty("TineSyncMD5", "")+"\n";
            res = res + card.getProperty("PhotoURI", "")+"\n";
            res = res + card.getProperty("PhotoType", "")+"\n";
            res = res + card.getProperty("PhotoName", "")+"\n";
            res = res + "==============================================\n";
        }
    }

    alert(res);
  }

};

