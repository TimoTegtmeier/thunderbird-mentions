debugLog('@Contact Mention - Compose Script loaded.');

(() => {
    document.body.addEventListener('keydown', onKeyDown);
    document.body.addEventListener('keyup', onKeyUp);
    document.body.addEventListener('click', onClickOutside);

    debugLog("document: focus?", document.hasFocus());
})();

// Search control
let results = [];
let resultsIndex = 0;
let shouldUpdateSearch = false;

// Remember last focused node and last focus offset
let anchorNode = null;
let anchorOffset = null;
let focusOffset = null;

function reset() {
    results = [];
    resultsIndex = 0;
    shouldUpdateSearch = false;

    anchorNode = null;
    anchorOffset = null;
    focusOffset = null;

    document.getElementById('am-searchBox')?.remove();
}

// Track keystrokes.
function onKeyDown(event) {
    
    debugLog("Keydownevent", event);
    let searchBoxExist = document.getElementById('am-searchBox');

    if(searchBoxExist) {
        let key = event.key;
        let stopPropagation = false;

        if(shouldStopSearch(key)) {
            reset();
            stopPropagation = true;
        } else if(key === 'Enter') {
            if(results.length > 0) {
                document.getElementById('am-li-' + results[resultsIndex].id)?.click();
                stopPropagation = true;
            } else {
                reset();
            }
        } else if(key === 'ArrowDown' && results.length) {
            // Move down on the list.
            resultsIndex = (resultsIndex < results.length - 1) ? resultsIndex + 1 : 0;
            markResult();
            stopPropagation = true;
        } else if(key === 'ArrowUp' && results.length) {
            // Move up on the list.
            resultsIndex = (resultsIndex > 0) ? resultsIndex - 1 : results.length - 1;
            markResult();
            stopPropagation = true;
        } else {
            shouldUpdateSearch = true;
        }

        if(stopPropagation) {
            event.stopPropagation();
            event.preventDefault();
        }
    } else if(event.key === '@') {
        rememberFocus();
        insertSearchBox();
    }
    return false;
}

// Handle updating the search term
function onKeyUp(_) {
    debugLog("Keyupevent", _);

    if(shouldUpdateSearch)
        Promise
            .resolve()
            .then(() => updateSearchTerm());
    shouldUpdateSearch = false;

    return false;
}

// Track clicks outside of the result list
function onClickOutside(event) {
    if(event.target?.classList?.contains('am-contact'))
        return;

    reset();
}

// Remember current text focus
function rememberFocus() {
    let selection = document.getSelection();
    anchorNode = selection.anchorNode;
    anchorOffset = selection.anchorOffset;
    focusOffset = selection.focusOffset;

    debugLog("Remebered position", anchorOffset, focusOffset)
}

function getSearchText() {
    if (!anchorNode)
        return "";

    let text = anchorNode.textContent.substring(anchorOffset, focusOffset);
    if (text.indexOf('@') == 0)
        text = text.substring(1);
    
    return text;
}

// Returns true, if the key hit should stop the search
function shouldStopSearch(key) {
    return key === ' ' || key === 'Escape' || key === 'Tab' || key == '@';
}

async function updateSearchTerm() {
    focusOffset = document.getSelection().focusOffset;
    let text = getSearchText();

    debugLog('Search term is', text);
    cleanResults();

    if(text.length >= 2) {
        results = await searchResults(text);
        await listResults(results);
        markResult();
    }
}

// Send Message to add contact.
function addContacts(contacts) {
    return browser.runtime.sendMessage({ addContacts: contacts });
}

// Ask background for matches.
async function searchResults(v) {
    let resultContacts = await browser.runtime.sendMessage({ searchContact: v });
    return resultContacts;
}

// Clean Results from Search
function cleanResults() {
    results = [];
    resultsIndex = 0;

    const el = document.getElementById('am-results');
    while(el.firstChild) {
        el.removeChild(el.firstChild);
    }
 }
 
 // List results on the box.
 async function listResults(contacts) {
    // Mark the Box...
    let list = document.getElementById('am-results');
    for(var contact of contacts) {
       let result = await buildContact(contact);
       list.appendChild(result);
    }
 }
 
 // Clear any marked results.
 async function clearMarkedResults() {
    let selected = document.getElementsByClassName('am-selected');
    for(var item of selected) {
        item.classList.remove('am-selected');
    }
 }
 
 // Mark a result from the list.
 async function markResult() {
    clearMarkedResults();
 
    // If there are results, then mark.
    if(results.length) {
        let l = document.getElementById("am-li-" + results[resultsIndex].id);
        l.classList.add('am-selected');
    }
 }

// Builds a contact.
async function buildContact(contact) {
    let li = document.createElement('li');
    li.id = "am-li-" + contact.id;
    li.className = 'am-contact';
    li.tabIndex = -1;
    li.innerText = contact.name + ' (' + contact.email + ')';
    li.addEventListener('click', () => {
        document.execCommand("undo", false);
        focusOffset = document.getSelection().focusOffset

        addContacts([contact]);
        insertMention(contact);
        reset();
    });
    return li;
}

function getSearchBoxPosition() {
    let selection = window.getSelection();
    let getRange = selection.getRangeAt(0); 
    let rect = getRange.getBoundingClientRect();
    var height = rect.height;

    if (selection.anchorNode instanceof Element) {
        let fs = window.getComputedStyle(selection.anchorNode, null).getPropertyValue('font-size');
        height = Math.max(parseInt(fs) + 1, height)
    }

    return {
        x: parseInt(rect.x),
        y: parseInt(Math.max(rect.y, 8) + height - 11)
    }
}

function insertSearchBox() {
    let pos = getSearchBoxPosition();

    let wrapper = document.createElement('div');
    wrapper.id = 'am-searchBox';
    wrapper.className = 'am-searchBox';
    wrapper.tabIndex = -1;
    wrapper.contenteditable = "false";
    wrapper.style.position = "absolute";
    wrapper.style.top = pos.y + "px";
    wrapper.style.left = pos.x + "px";
    
    let box = document.createElement('div');
    box.id = 'am-resultsWrapper';
    box.tabIndex = -1;
    box.contenteditable = "false";

    let list = document.createElement('ul');
    list.id = 'am-results';
    list.className = 'am-results';
    list.tabIndex = -1;
    list.contenteditable = "false";

    box.appendChild(list);
    wrapper.appendChild(box);

    // Append to Focus Node.
    document.body.append(wrapper);
}

// Inserts Mention on the body
function insertMention(contact) {
    if(!anchorNode)
        return;

    // Build component to be added to the body.
    let anchor = document.createElement('a');
    anchor.setAttribute('href', "mailto:" + contact.email);
    
    anchor.id = contact.id;
    anchor.innerText = '@' + contact.name;

    if (focusOffset > anchorOffset) {
        for(var i = 0; i < focusOffset - anchorOffset; i++)
            document.execCommand("delete", false);
    }
    document.execCommand("insertHTML", false, anchor.outerHTML);
    document.execCommand("insertText", false, " ");

    anchorNode = null;
    anchorOffset = null;
    focusOffset = null;
}

function debugLog(...args) {
    console.log.apply(console, args);
    browser.runtime.sendMessage({ debugLog: args.map(function(x) { return "" + x; }) });
}