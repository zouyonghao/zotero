/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2006–2013 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

"use strict";

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/osfile.jsm");
import FilePicker from 'zotero/modules/filePicker';

Zotero_Preferences.General = {
	_openURLResolvers: null,

	init: function () {
		// JS-based strings
		var checkbox = document.getElementById('launchNonNativeFiles-checkbox');
		if (checkbox) {
			checkbox.label = Zotero.getString(
				'zotero.preferences.launchNonNativeFiles', Zotero.appName
			);
		}
		var menuitems = document.querySelectorAll('.fileHandler-internal');
		for (let menuitem of menuitems) {
			menuitem.setAttribute('label', Zotero.appName);
		}

		// Set OpenURL resolver drop-down to last-known name
		if (Zotero.Prefs.get('openURL.resolver')) {
			let name = Zotero.Prefs.get('openURL.name');
			if (name) {
				document.getElementById('openurl-primary-popup').firstChild.setAttribute('label', name);
			}
		}
		
		this.refreshLocale();
		this.updateAutoRenameFilesUI();
		this._updateFileHandlerUI();
		this._initEbookFontFamilyMenu();
	},

	_getAutomaticLocaleMenuLabel: function () {
		return Zotero.getString(
			'zotero.preferences.locale.automaticWithLocale',
			Zotero.Locale.availableLocales[Zotero.locale] || Zotero.locale
		);
	},
	
	
	refreshLocale: function () {
		var autoLocaleName, currentValue;
		
		// If matching OS, get the name of the current locale
		if (Zotero.Prefs.get('intl.locale.requested', true) === '') {
			autoLocaleName = this._getAutomaticLocaleMenuLabel();
			currentValue = 'automatic';
		}
		// Otherwise get the name of the locale specified in the pref
		else {
			autoLocaleName = Zotero.getString('zotero.preferences.locale.automatic');
			currentValue = Zotero.locale;
		}
		
		// Populate menu
		var menu = document.getElementById('locale-menu');
		var menupopup = menu.firstChild;
		menupopup.textContent = '';
		// Show "Automatic (English)", "Automatic (Français)", etc.
		menu.appendItem(autoLocaleName, 'automatic');
		menu.menupopup.appendChild(document.createXULElement('menuseparator'));
		// Add all available locales
		for (let locale in Zotero.Locale.availableLocales) {
			menu.appendItem(Zotero.Locale.availableLocales[locale], locale);
		}
		menu.value = currentValue;
	},
	
	onLocaleChange: function () {
		var requestedLocale = Services.locale.requestedLocale;
		var menu = document.getElementById('locale-menu');
		
		if (menu.value == 'automatic') {
			// Changed if not already set to automatic (unless we have the automatic locale name,
			// meaning we just switched away to the same manual locale and back to automatic)
			var changed = requestedLocale
				&& requestedLocale == Zotero.locale
				&& menu.label != this._getAutomaticLocaleMenuLabel();
			Services.locale.requestedLocales = [];
		}
		else {
			// Changed if moving to a locale other than the current one
			var changed = requestedLocale != menu.value
			Services.locale.requestedLocales = [menu.value];
		}
		
		// https://searchfox.org/mozilla-central/rev/961a9e56a0b5fa96ceef22c61c5e75fb6ba53395/browser/base/content/utilityOverlay.js#383-387
		if (Services.locale.isAppLocaleRTL) {
			Zotero.Prefs.set("bidi.browser.ui", true, true);
		}
		
		if (!changed) {
			return;
		}
		
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
		var index = ps.confirmEx(null,
			Zotero.getString('general.restartRequired'),
			Zotero.getString('general.restartRequiredForChange', Zotero.appName),
			buttonFlags,
			Zotero.getString('general.restartNow'),
			Zotero.getString('general.restartLater'),
			null, null, {});
		
		if (index == 0) {
			Zotero.Utilities.Internal.quitZotero(true);
		}
	},
	
	updateAutoRenameFilesUI: function () {
		setTimeout(() => {
			document.getElementById('rename-linked-files').disabled = !Zotero.Prefs.get('autoRenameFiles');
		});
	},
	
	//
	// File handlers
	//
	chooseFileHandler: async function (type) {
		var pref = this._getFileHandlerPref(type);
		var currentPath = Zotero.Prefs.get(pref);
		
		var fp = new FilePicker();
		if (currentPath && currentPath != 'system') {
			fp.displayDirectory = OS.Path.dirname(currentPath);
		}
		fp.init(
			window,
			Zotero.getString('zotero.preferences.chooseApplication'),
			fp.modeOpen
		);
		fp.appendFilters(fp.filterApps);
		if (await fp.show() != fp.returnOK) {
			this._updateFileHandlerUI();
			return false;
		}
		this.setFileHandler(type, fp.file);
	},
	
	setFileHandler: function (type, handler) {
		var pref = this._getFileHandlerPref(type);
		Zotero.Prefs.set(pref, handler);
		this._updateFileHandlerUI();
	},
	
	_updateFileHandlerUI: function () {
		function update(type) {
			let handler = Zotero.Prefs.get('fileHandler.' + type);
			let menulist = document.getElementById('fileHandler-' + type);
			var customMenuItem = menulist.querySelector('.fileHandler-custom');
			
			// System default
			if (handler == 'system') {
				customMenuItem.hidden = true;
				menulist.selectedIndex = 1;
			}
			// Custom handler
			else if (handler) {
				let icon;
				try {
					let urlspec = Zotero.File.pathToFileURI(handler);
					icon = "moz-icon://" + urlspec + "?size=16";
				}
				catch (e) {
					Zotero.logError(e);
				}

				let handlerFilename = OS.Path.basename(handler);
				if (Zotero.isMac) {
					handlerFilename = handlerFilename.replace(/\.app$/, '');
				}
				customMenuItem.setAttribute('label', handlerFilename);
				if (icon) {
					customMenuItem.className = 'menuitem-iconic';
					customMenuItem.setAttribute('image', icon);
				}
				else {
					customMenuItem.className = '';
				}
				customMenuItem.hidden = false;
				menulist.selectedIndex = 2;

				// There's almost certainly a better way to do this...
				// but why doesn't the icon just behave by default?
				menulist.shadowRoot.querySelector('[part="icon"]').style.height = '16px';
			}
			// Zotero
			else {
				menulist.selectedIndex = 0;
				customMenuItem.hidden = true;
			}
		}
		
		update('pdf');
		update('epub');
		update('snapshot');
		var inNewWindowCheckbox = document.getElementById('open-reader-in-new-window');
		inNewWindowCheckbox.disabled = ['pdf', 'epub', 'snapshot'].every(type => Zotero.Prefs.get('fileHandler.' + type));
	},
	
	_getFileHandlerPref: function (type) {
		if (type != 'pdf' && type != 'epub' && type != 'snapshot') {
			throw new Error(`Unknown file type ${type}`);
		}
		return 'fileHandler.' + type;
	},

	handleOpenURLPopupShowing: async function (event) {
		if (event.target.id != 'openurl-primary-popup') {
			return;
		}
		if (!this._openURLResolvers) {
			let menupopup = document.getElementById('openurl-primary-popup');
			menupopup.firstChild.setAttribute('label', Zotero.getString('general.loading'));
			try {
				this._openURLResolvers = await Zotero.Utilities.Internal.OpenURL.getResolvers();
			}
			catch (e) {
				Zotero.logError(e);
				menupopup.firstChild.setAttribute('label', "Error loading resolvers");
				return;
			}
		}
		this.updateOpenURLResolversMenu();
	},
	
	
	updateOpenURLResolversMenu: function () {
		if (!this._openURLResolvers) {
			Zotero.debug("Resolvers not loaded -- not updating menu");
			return;
		}
		
		var currentResolver = Zotero.Prefs.get('openURL.resolver');
		
		var openURLMenu = document.getElementById('openurl-menu');
		var menupopup = openURLMenu.firstChild;
		menupopup.innerHTML = '';
		
		var customMenuItem = document.createXULElement('menuitem');
		customMenuItem.setAttribute('label', Zotero.getString('general.custom'));
		customMenuItem.setAttribute('value', 'custom');
		customMenuItem.setAttribute('type', 'checkbox');
		menupopup.appendChild(customMenuItem);
		
		menupopup.appendChild(document.createXULElement('menuseparator'));
		
		var selectedName;
		var lastContinent;
		var lastCountry;
		var currentContinentPopup;
		var currentMenuPopup;
		for (let r of this._openURLResolvers) {
			// Create submenus for continents
			if (r.continent != lastContinent) {
				let menu = document.createXULElement('menu');
				menu.setAttribute('label', r.continent);
				openURLMenu.firstChild.appendChild(menu);
				
				currentContinentPopup = currentMenuPopup = document.createXULElement('menupopup');
				menu.appendChild(currentContinentPopup);
				lastContinent = r.continent;
			}
			if (r.country != lastCountry) {
				// If there's a country, create a submenu for it
				if (r.country) {
					let menu = document.createXULElement('menu');
					menu.setAttribute('label', r.country);
					currentContinentPopup.appendChild(menu);
					
					let menupopup = document.createXULElement('menupopup');
					menu.appendChild(menupopup);
					currentMenuPopup = menupopup;
				}
				// Otherwise use the continent popup
				else {
					currentMenuPopup = currentContinentPopup;
				}
				lastCountry = r.country;
			}
			let menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', r.name);
			menuitem.setAttribute('value', r.url);
			menuitem.setAttribute('type', 'checkbox');
			currentMenuPopup.appendChild(menuitem);
			var checked = r.url == Zotero.Prefs.get('openURL.resolver');
			menuitem.setAttribute('checked', checked);
			if (checked) {
				selectedName = r.name;
			}
		}
		
		// From directory
		if (selectedName) {
			openURLMenu.setAttribute('label', selectedName);
			// If we found a match, update stored name
			Zotero.Prefs.set('openURL.name', selectedName);
		}
		// Custom
		else {
			openURLMenu.setAttribute('label', Zotero.getString('general.custom'));
			customMenuItem.setAttribute('checked', true);
			Zotero.Prefs.clear('openURL.name');
		}
	},
	
	
	handleOpenURLSelected: function (event) {
		event.stopPropagation();
		event.preventDefault();
		
		if (event.target.localName != 'menuitem') {
			Zotero.debug("Ignoring click on " + event.target.localName);
			return;
		}
		
		var openURLMenu = document.getElementById('openurl-menu');
		
		var openURLServerField = document.getElementById('openURLServerField');
		var openURLVersionMenu = document.getElementById('openURLVersionMenu');
		
		// If "Custom" selected, clear URL field
		if (event.target.value == "custom") {
			Zotero.Prefs.clear('openURL.name');
			Zotero.Prefs.set('openURL.resolver', '');
			Zotero.Prefs.clear('openURL.version');
			openURLServerField.value = '';
			openURLServerField.focus();
		}
		else {
			Zotero.Prefs.set('openURL.name', openURLServerField.value = event.target.label);
			Zotero.Prefs.set('openURL.resolver', openURLServerField.value = event.target.value);
			Zotero.Prefs.set('openURL.version', openURLVersionMenu.value = "1.0");
		}
		
		openURLMenu.firstChild.hidePopup();
		
		setTimeout(() => {
			this.updateOpenURLResolversMenu();
		});
	},
	
	onOpenURLCustomized: function () {
		setTimeout(() => {
			this.updateOpenURLResolversMenu();
		});
	},

	EBOOK_FONT_STACKS: {
		Baskerville: 'Baskerville, serif',
		Charter: 'Charter, serif',
		Futura: 'Futura, sans-serif',
		Georgia: 'Georgia, serif',
		// Helvetica and equivalent-ish
		Helvetica: 'Helvetica, Arial, Open Sans, Liberation Sans, sans-serif',
		Iowan: 'Iowan, serif',
		'New York': 'New York, serif',
		OpenDyslexic: 'OpenDyslexic, eulexia, serif',
		// Windows has called Palatino by many names
		Palatino: 'Palatino, Palatino Linotype, Adobe Palatino, Book Antiqua, URW Palladio L, FPL Neu, Domitian, serif',
		// Times New Roman and equivalent-ish
		'Times New Roman': 'Times New Roman, Linux Libertine, Liberation Serif, serif',
	},

	async _initEbookFontFamilyMenu() {
		let enumerator = Cc["@mozilla.org/gfx/fontenumerator;1"].createInstance(Ci.nsIFontEnumerator);
		let fonts = new Set(await enumerator.EnumerateAllFontsAsync());

		let menulist = document.getElementById('reader-ebook-font-family');
		let popup = menulist.menupopup;
		for (let [label, stack] of Object.entries(this.EBOOK_FONT_STACKS)) {
			// If no font in the stack exists on the user's system, don't add it to the list
			// Exclude the generic family name at the end, which is only there in case no font specified by name in the
			// stack supports a specific character (e.g. non-Latin)
			if (!stack.split(', ').slice(0, -1).some(font => fonts.has(font))) {
				continue;
			}
			
			let menuitem = document.createXULElement('menuitem');
			menuitem.label = label;
			menuitem.value = stack;
			menuitem.style.fontFamily = stack;
			popup.append(menuitem);
		}

		if (popup.childElementCount && fonts.size) {
			popup.append(document.createXULElement('menuseparator'));
		}
		for (let font of fonts) {
			let menuitem = document.createXULElement('menuitem');
			menuitem.label = font;
			menuitem.value = font;
			menuitem.style.fontFamily = `'${font.replace(/'/g, "\\'")}'`;
			popup.append(menuitem);
		}
	},
}
