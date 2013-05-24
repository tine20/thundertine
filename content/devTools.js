var devTools = {
	
	writeMsg: function(comp, func, msg, timed) {
		this.write(comp + "." + func + (msg != undefined ? ": " + (timed == true ? new Date() + " " : "") + msg : ""));
    },
    
    enter: function(comp, func, msg) {
    	this.write("enter: " + comp + "." + func + (msg != undefined ? " -> " + msg : ""));
    },
    
    leave: function(comp, func, msg) {
    	this.write("leave: " + comp + "." + func + (msg != undefined ? " -> " + msg : ""));
    },
    
	write: function(msg) {
		if (config.isConsoleOutputEnabled()) {
			var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
				.getService(Components.interfaces.nsIConsoleService);
	
			consoleService.logStringMessage(msg);
		}
	}

};