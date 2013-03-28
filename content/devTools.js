var devTools = {
	
	writeMsg: function(comp, func, msg) {
		this.writeMsg(comp, func, msg, false);
	},
	
	writeMsg: function(comp, func, msg, timed) {
		this.write(comp + "." + func + ": " + (timed == true ? new Date() + " " : "") + msg);
    },
    
    enter: function(comp, func) {
    	enter(comp, func, null);
    },
    
    enter: function(comp, func, msg) {
    	this.write("enter: " + comp + "." + func + (msg != null ? " -> " + msg : ""));
    },
    
    leave: function(comp, func) {
    	this.write("leave: " + comp + "." + func);
    },
    
	write: function(msg) {
		if (config.isConsoleOutputEnabled()) {
			var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
				.getService(Components.interfaces.nsIConsoleService);
	
			consoleService.logStringMessage(msg);
		}
	}

}
