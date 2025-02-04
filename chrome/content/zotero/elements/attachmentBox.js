/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2022 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org
    
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


{
	class AttachmentBox extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-attachment-info" data-pane="attachment-info">
				<html:div class="body">
					<attachment-preview id="attachment-preview" tabindex="0"/>
					<label id="url" crop="end" tabindex="0"
						ondragstart="let dt = event.dataTransfer; dt.setData('text/x-moz-url', this.value); dt.setData('text/uri-list', this.value); dt.setData('text/plain', this.value);"/>
					<html:div class="metadata-table">
						<html:div id="fileNameRow" class="meta-row">
							<html:div class="meta-label"><html:label id="fileName-label" class="key" data-l10n-id="attachment-info-filename"/></html:div>
							<html:div class="meta-data"><editable-text id="fileName" nowrap="true" tight="true"/></html:div>
						</html:div>
						<html:div id="accessedRow" class="meta-row">
							<html:div class="meta-label"><html:label id="accessed-label" class="key" data-l10n-id="attachment-info-accessed"/></html:div>
							<html:div class="meta-data"><editable-text id="accessed" nowrap="true" tight="true" readonly="true"/></html:div>
						</html:div>
						<html:div id="pagesRow" class="meta-row">
							<html:div class="meta-label"><html:label id="pages-label" class="key" data-l10n-id="attachment-info-pages"/></html:div>
							<html:div class="meta-data"><editable-text id="pages" nowrap="true" tight="true" readonly="true"/></html:div>
						</html:div>
						<html:div id="dateModifiedRow" class="meta-row" hidden="true" >
							<html:div class="meta-label"><html:label id="dateModified-label" class="key" data-l10n-id="attachment-info-modified"/></html:div>
							<html:div class="meta-data"><editable-text id="dateModified" nowrap="true" tight="true" readonly="true"/></html:div>
						</html:div>
						<html:div id="indexStatusRow" class="meta-row">
							<html:div class="meta-label"><html:label id="index-status-label" class="key" data-l10n-id="attachment-info-index"/></html:div>
							<html:div class="meta-data">
								<html:label id="index-status"/>
								<toolbarbutton id="reindex" tabindex="0" oncommand="this.hidden = true; setTimeout(function () { ZoteroPane_Local.reindexItem(); }, 50)"/>
							</html:div>
						</html:div>
					</html:div>
					<html:div id="note-container">
						<note-editor id="attachment-note-editor" notitle="1" flex="1"/>
						<button id="note-button" data-l10n-id="attachment-info-convert-note"/>
					</html:div>
					<button id="select-button" hidden="true"/>
					<popupset>
						<menupopup id="url-menu">
							<menuitem id="url-menuitem-copy"/>
						</menupopup>
					</popupset>
				</html:div>
			</collapsible-section>
		`);

		constructor() {
			super();

			this.editable = false;
			this.clickableLink = false;
			this.displayButton = false;
			this.displayNote = false;

			this.buttonCaption = null;
			this.clickHandler = null;

			this._mode = "view";

			this._item = null;

			this._section = null;
			this._preview = null;

			this._isRendering = false;
			
			this._isEditingFilename = false;
		}

		get mode() {
			return this._mode;
		}

		set mode(val) {
			Zotero.debug("Setting mode to '" + val + "'");
					
			this.editable = false;
			this.synchronous = false;
			this.displayURL = false;
			this.displayFileName = false;
			this.clickableLink = false;
			this.displayAccessed = false;
			this.displayPages = false;
			this.displayDateModified = false;
			this.displayIndexed = false;
			this.displayNote = false;
			
			switch (val) {
				case 'view':
					this.displayURL = true;
					this.displayFileName = true;
					this.clickableLink = true;
					this.displayAccessed = true;
					this.displayPages = true;
					this.displayIndexed = true;
					this.displayNote = true;
					this.displayDateModified = true;
					break;
				
				case 'edit':
					this.editable = true;
					this.displayURL = true;
					this.displayFileName = true;
					this.clickableLink = true;
					this.displayAccessed = true;
					this.displayPages = true;
					this.displayIndexed = true;
					this.displayNote = true;
					this.displayDateModified = true;
					break;
				
				case 'merge':
					this.synchronous = true;
					this.displayURL = true;
					this.displayFileName = true;
					this.displayAccessed = true;
					this.displayNote = true;
					this.displayDateModified = true;
					break;
				
				case 'mergeedit':
					this.synchronous = true;
					this.editable = true;
					this.displayURL = true;
					this.displayFileName = true;
					this.displayAccessed = true;
					this.displayNote = true;
					// Notes aren't currently editable in mergeedit pane
					this.displayDateModified = true;
					break;
				
				case 'filemerge':
					this.synchronous = true;
					this.displayURL = true;
					this.displayFileName = true;
					this.displayDateModified = true;
					break;
				
				default:
					throw new Error("Invalid mode '" + val + "' in <attachment-box>");
			}
			
			this._mode = val;
		}

		get usePreview() {
			return this.hasAttribute('data-use-preview');
		}

		set usePreview(val) {
			this.toggleAttribute('data-use-preview', val);
		}

		get item() {
			return this._item;
		}

		set item(val) {
			if (!(val instanceof Zotero.Item)) {
				throw new Error("'item' must be a Zotero.Item");
			}
			if (val.isAttachment()) {
				this._item = val;
				this.hidden = false;
				this.render();
			}
			else {
				this.hidden = true;
			}
		}

		init() {
			this._section = this.querySelector('collapsible-section');

			this._id('url').addEventListener('contextmenu', (event) => {
				this._id('url-menu').openPopupAtScreen(event.screenX, event.screenY, true);
			});

			let fileName = this._id("fileName");
			fileName.addEventListener('focus', () => {
				this._isEditingFilename = true;
			});
			fileName.addEventListener('blur', () => {
				this.editFileName(fileName.value);
				this._isEditingFilename = false;
			});

			this._preview = this._id("attachment-preview");

			let noteButton = this._id('note-button');
			noteButton.addEventListener("command", () => {
				this.convertAttachmentNote();
			});

			let copyMenuitem = this._id('url-menuitem-copy');
			copyMenuitem.label = Zotero.getString('general.copy');
			copyMenuitem.addEventListener('command', () => {
				Zotero.Utilities.Internal.copyTextToClipboard(this.item.getField('url'));
			});

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'attachmentbox');

			this._section.addEventListener("toggle", (ev) => {
				if (ev.target.open && this.usePreview) {
					this._preview.render();
				}
			});

			// Work around the reindex toolbarbutton not wanting to properly receive focus on tab.
			// Make <image> focusable. On focus of the image, bounce the focus to the toolbarbutton.
			// Temporarily remove tabindex from the <image> so that the focus can move past the
			// reindex button
			let reindexButton = this._id("indexStatusRow").querySelector(".meta-data toolbarbutton");
			if (reindexButton) {
				reindexButton.addEventListener("focusin", function (e) {
					if (e.target.tagName == "image") {
						reindexButton.focus();
						reindexButton.querySelector("image").removeAttribute("tabindex");
					}
				});
				reindexButton.addEventListener("blur", function (_) {
					setTimeout(() => {
						if (document.activeElement !== reindexButton) {
							reindexButton.querySelector("image").setAttribute("tabindex", "0");
						}
					});
				});
			}
			// Prevents the button from getting stuck in active state
			reindexButton.addEventListener("keydown", (e) => {
				if (e.key == " ") {
					e.preventDefault();
					reindexButton.click();
				}
			});

			this.querySelectorAll(".meta-label").forEach(label => label.addEventListener("click", this._handleMetaLabelClick));
		}

		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		notify(event, _type, ids, _extraData) {
			if (event != 'modify' || !this.item || !this.item.id) return;
			for (let id of ids) {
				if (id != this.item.id) {
					continue;
				}
				
				this.render();
				break;
			}
		}

		async render() {
			if (this._isRendering) {
				return;
			}
			Zotero.debug('Refreshing attachment box');
			this._isRendering = true;
			// Cancel editing filename when refreshing
			this._isEditingFilename = false;

			if (this.usePreview) {
				this._preview.item = this.item;
			}
			
			let fileNameRow = this._id('fileNameRow');
			let urlField = this._id('url');
			let accessed = this._id('accessedRow');
			let pagesRow = this._id('pagesRow');
			let dateModifiedRow = this._id('dateModifiedRow');
			let indexStatusRow = this._id('indexStatusRow');
			let selectButton = this._id('select-button');

			let fileExists = this._item.isFileAttachment() && await this._item.fileExists();
			let isImportedURL = this.item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL;
			let isLinkedURL = this.item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL;
			
			// URL
			if (this.displayURL && (isImportedURL || isLinkedURL)) {
				let urlSpec = this.item.getField('url');
				urlField.setAttribute('value', urlSpec);
				urlField.setAttribute('tooltiptext', urlSpec);
				urlField.setAttribute('hidden', false);
				if (this.clickableLink) {
					urlField.onclick = function (event) {
						if (event.button == 0) {
							ZoteroPane_Local.loadURI(this.value, event);
						}
					};
					urlField.className = 'zotero-text-link keyboard-clickable';
				}
				else {
					urlField.className = '';
				}
				urlField.hidden = false;
			}
			else {
				urlField.hidden = true;
			}
			
			// Access date
			if (this.displayAccessed && (isImportedURL || isLinkedURL)) {
				let itemAccessDate = this.item.getField('accessDate');
				if (itemAccessDate) {
					itemAccessDate = Zotero.Date.sqlToDate(itemAccessDate, true);
					this._id("accessed").value = itemAccessDate.toLocaleString();
					accessed.hidden = false;
				}
				else {
					accessed.hidden = true;
				}
			}
			else {
				accessed.hidden = true;
			}
			
			if (this.displayFileName && !isLinkedURL) {
				let fileName = this.item.attachmentFilename;
				
				if (fileName) {
					this._id("fileName").value = fileName;
					fileNameRow.hidden = false;
				}
				else {
					fileNameRow.hidden = true;
				}
			}
			else {
				fileNameRow.hidden = true;
			}
			this._id("fileName").toggleAttribute("readonly", (!this.editable || !fileExists));

			// Page count
			if (this.displayPages && this._item.isPDFAttachment()) {
				Zotero.Fulltext.getPages(this.item.id)
				.then(function (pages) {
					if (!this.item) return;
					
					pages = pages ? pages.total : null;
					if (pages) {
						this._id("pages").value = pages;
						pagesRow.hidden = false;
					}
					else {
						pagesRow.hidden = true;
					}
				}.bind(this));
			}
			else {
				pagesRow.hidden = true;
			}
			
			if (this.displayDateModified && fileExists && !this._item.isWebAttachment()) {
				// Conflict resolution uses a modal window, so promises won't work, but
				// the sync process passes in the file mod time as dateModified
				if (this.synchronous) {
					this._id("dateModified").value = Zotero.Date.sqlToDate(
						this.item.getField('dateModified'), true
					).toLocaleString();
					dateModifiedRow.hidden = false;
				}
				else {
					this.item.attachmentModificationTime
					.then(function (mtime) {
						if (!this._id) return;
						
						if (mtime) {
							this._id("dateModified").value = new Date(mtime).toLocaleString();
						}
						dateModifiedRow.hidden = !mtime;
					}.bind(this));
				}
			}
			else {
				dateModifiedRow.hidden = true;
			}
			
			// Full-text index information
			if (this.displayIndexed && fileExists && await Zotero.FullText.canIndex(this.item)) {
				this.updateItemIndexedState()
					.then(function () {
						if (!this.item) return;
						indexStatusRow.hidden = false;
					}.bind(this));
			}
			else {
				indexStatusRow.hidden = true;
			}
			
			// Make the image of the reindex toolbarbutton focusable because for some reason the
			// actual toolbarbutton does not receive focus on tab
			let reindexButton = indexStatusRow.querySelector("toolbarbutton");
			if (document.activeElement !== reindexButton) {
				reindexButton.querySelector("image").setAttribute("tabindex", "0");
			}

			this.initAttachmentNoteEditor();
			
			if (this.displayButton) {
				selectButton.label = this.buttonCaption;
				selectButton.hidden = false;
				selectButton.setAttribute('oncommand',
					event => this.clickHandler(event.target));
			}
			else {
				selectButton.hidden = true;
			}
			this._isRendering = false;
		}

		onViewClick(event) {
			ZoteroPane_Local.viewAttachment(this.item.id, event, !this.editable);
		}

		onShowClick(event) {
			ZoteroPane_Local.showAttachmentInFilesystem(this.item.id, event.originalTarget, !this.editable);
		}

		updateItemIndexedState() {
			return (async () => {
				let indexStatus = this._id('index-status');
				let reindexButton = this._id('reindex');
				
				let status = await Zotero.Fulltext.getIndexedState(this.item);
				if (!this.item) return;
				
				let str = 'fulltext.indexState.';
				switch (status) {
					case Zotero.Fulltext.INDEX_STATE_UNAVAILABLE:
						str += 'unavailable';
						break;
					case Zotero.Fulltext.INDEX_STATE_UNINDEXED:
						str = 'general.no';
						break;
					case Zotero.Fulltext.INDEX_STATE_PARTIAL:
						str += 'partial';
						break;
					case Zotero.Fulltext.INDEX_STATE_QUEUED:
						str += 'queued';
						break;
					case Zotero.Fulltext.INDEX_STATE_INDEXED:
						str = 'general.yes';
						break;
				}
				indexStatus.textContent = Zotero.getString(str);
				
				// Reindex button tooltip (string stored in zotero.properties)
				str = Zotero.getString('pane.items.menu.reindexItem');
				reindexButton.setAttribute('tooltiptext', str);
				
				let show = false;
				if (this.editable) {
					show = await Zotero.Fulltext.canReindex(this.item);
					if (!this.item) return;
				}
				
				if (show) {
					reindexButton.setAttribute('hidden', false);
				}
				else {
					reindexButton.setAttribute('hidden', true);
				}
			})();
		}

		async editFileName(newFilename) {
			if (!this._isEditingFilename) {
				return;
			}
			let item = this.item;
			// Rename associated file
			let nsIPS = Services.prompt;
			let getExtension = function (filename) {
				const extRegex = /\.\w{1,10}$/;
				if (extRegex.test(filename)) {
					return filename.match(extRegex)[0];
				}
				return "";
			};
			newFilename = newFilename.trim();
			let oldFilename = item.getFilename();
			if (oldFilename === newFilename) {
				return;
			}
			// Don't allow empty filename
			if (!newFilename) {
				this.render();
				return;
			}
			let newExt = getExtension(newFilename);
			let oldExt = getExtension(oldFilename);
			if (!newExt && oldExt) {
				// User did not specify extension. Use current
				newFilename += oldExt;
				newExt = oldExt;
			}
			if (newExt !== oldExt && oldExt) {
				// User changed extension. Confirm
				let index = Zotero.Prompt.confirm({
					window,
					title: Zotero.getString('general.warning'),
					text: Zotero.getString('pane.item.attachments.rename.confirmExtChange.text1', [oldExt, newExt])
						+ "\n\n"
						+ Zotero.getString('pane.item.attachments.rename.confirmExtChange.text2', Zotero.appName),
					button0: Zotero.getString('pane.item.attachments.rename.confirmExtChange.keep', oldExt),
					button1: Zotero.getString('pane.item.attachments.rename.confirmExtChange.change', newExt),
				});
				if (index == 0) {
					newFilename = newFilename.replace(/\.\w{1,10}$/, oldExt);
				}
			}
			let renamed = await item.renameAttachmentFile(newFilename);
			if (renamed == -1) {
				let confirmed = nsIPS.confirm(
					window,
					'',
					newFilename + ' exists. Overwrite existing file?'
				);
				if (!confirmed) {
					// If they said not to overwrite existing file,
					// do nothing
					return;
				}
				
				// Force overwrite, but make sure we check that this doesn't fail
				renamed = await item.renameAttachmentFile(newFilename, true);
			}
			
			if (renamed == -2) {
				nsIPS.alert(
					window,
					Zotero.getString('general.error'),
					Zotero.getString('pane.item.attachments.rename.error')
				);
			}
			else if (!renamed) {
				nsIPS.alert(
					window,
					Zotero.getString('pane.item.attachments.fileNotFound.title'),
					Zotero.getString('pane.item.attachments.fileNotFound.text1')
				);
			}
			this.render();
		}

		initAttachmentNoteEditor() {
			let noteContainer = this._id('note-container');
			let noteButton = this._id('note-button');
			let noteEditor = this._id('attachment-note-editor');

			if (!this.displayNote || this.item.note === '') {
				noteContainer.hidden = true;
				noteEditor.hidden = true;
				noteButton.hidden = true;
				return;
			}

			noteContainer.hidden = false;
			noteButton.hidden = this.mode !== 'edit';
			noteButton.setAttribute("data-l10n-args", `{"type": "${this.item.parentItem ? "child" : "standalone"}"}`);
			noteEditor.hidden = false;
			
			// Don't make note editable (at least for now)
			if (this.mode == 'merge' || this.mode == 'mergeedit') {
				noteEditor.mode = 'merge';
				noteEditor.displayButton = false;
			}
			else {
				// Force read-only
				noteEditor.mode = "view";
			}
			noteEditor.parent = null;
			noteEditor.item = this.item;

			noteEditor.viewMode = 'library';

			// Force hide note editor tags & related
			noteEditor._id('links-container').hidden = true;
		}

		async convertAttachmentNote() {
			if (!this.item.note || this.mode !== "edit") {
				return;
			}
			let newNote = new Zotero.Item('note');
			newNote.libraryID = this.item.libraryID;
			newNote.parentID = this.item.parentID;
			newNote.setNote(this.item.note);
			await newNote.saveTx();
			this.item.setNote("");
			await this.item.saveTx();
		}

		_handleMetaLabelClick = (event) => {
			let labelWrapper = event.target.closest(".meta-label");
			if (labelWrapper.nextSibling.contains(document.activeElement)) {
				document.activeElement.blur();
			}
			else if (!labelWrapper.nextSibling.firstChild.readOnly) {
				labelWrapper.nextSibling.firstChild.focus();
			}
		};

		_id(id) {
			return this.querySelector(`#${id}`);
		}
	}

	customElements.define("attachment-box", AttachmentBox);
}
