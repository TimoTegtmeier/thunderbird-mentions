console.log('@Contact Mention - Compose Script loaded.');

(() => {
    document.body.addEventListener('keydown', onKeyDown);
    document.body.addEventListener('keyup', onKeyUp);
    document.body.addEventListener('click', onClick);
})();

// Search control
let results = [];
let resultsIndex = 0;
let shouldUpdateSearch = false;

let lastFocusNode = null;
let lastFocusOffset = null;

function saveSelection() {
    let selection = document.getSelection();
    lastFocusNode = selection.focusNode;
    lastFocusOffset = selection.focusOffset;
}

function onClick(event) {
    if($(event.target).hasClass('contact'))
        return;

    console.log('outside click detected - removing search box');
    removeSearchBox();
}

// Track keystrokes.
async function onKeyDown(event) {
    
    let searchBoxExist = document.getElementById('searchBox');

    if(searchBoxExist) {
        let key = event.key;
        let stopPropagation = false;

        if(shouldStopSearching(key)) {
            removeSearchBox();
        } else if(key === 'Enter') {
            if(results.length > 0) {
                $('#am-li-' + results[resultsIndex].id).trigger('click');
                stopPropagation = true;
            } else {
                removeSearchBox();
            }
        } else if(key === 'ArrowDown' && results.length) {
            // Move down on the list.
            resultsIndex = (resultsIndex < results.length - 1) ? resultsIndex + 1 : 0;
            markResult();
        } else if(key === 'ArrowUp' && results.length) {
            // Move up on the list.
            resultsIndex = (resultsIndex > 0) ? resultsIndex - 1 : results.length - 1;
            markResult();
        } else {
            shouldUpdateSearch = true;
        }

        if(stopPropagation) {
            event.stopPropagation();
            event.preventDefault();
        }
    } else {
        if(event.key === '@') {

            saveSelection();

            // Get the context of the cursor.
            let selection = lastFocusNode;
            if(!selection)
                return;

            // If no selection, then come up a node.
            if(selection.nodeName === '#text' || selection.nodeName === 'TEXT') {
                selection = selection.parentNode;
            }

            insertSearchBox(selection);
        }
    }
    return false;
}

function onKeyUp(_) {
    if(!shouldUpdateSearch)
        return false;

    shouldUpdateSearch = false;
    Promise
        .resolve()
        .then(() => updateSearchTerm());

    return false;
}

function shouldStopSearching(key) {
    return key === ' ' || key === 'Escape' || key === 'Space' || key === 'Tab';
}

async function updateSearchTerm() {
    saveSelection();

    let text = lastFocusNode.textContent.substring(0, lastFocusOffset);
    text = text.substring(text.lastIndexOf('@') + 1);

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

// Remove the Search Box.
function removeSearchBox() {
    document.getElementById('searchBox')?.remove();
}

// Clean Results from Search
function cleanResults() {
    results = [];
    resultsIndex = 0;
    document.getElementById('results').innerHTML = '';
 }
 
 // List results on the box.
 async function listResults(contacts) {
    // Mark the Box...
    let list = document.getElementById('results');
    for(var contact of contacts) {
       let result = await buildContact(contact);
       $(list).append(result);
    }
 }
 
 // Clear any marked results.
 async function clearMarkedResults() {
    $('li.contact').removeClass('selected');
 }
 
 // Mark a result from the list.
 async function markResult() {
    clearMarkedResults();
 
    // If there are results, then mark.
    if(results.length) {
        let l = document.getElementById("am-li-" + results[resultsIndex].id);   
        $(l).addClass('selected');
    }
 }

// Builds a contact.
async function buildContact(contact) {
    let c = document.createElement('li');
    c.id = "am-li-" + contact.id;
    c.className = 'contact';
    c.tabIndex = -1;
    c.innerHTML = contact.name + ' (' + contact.email + ')';
 
    $(c).on('click', () => {
        removeSearchBox();
        insertFullComponent(contact)
            .then(addFinalSpace)
            .then((c) => { return addContacts([c]); });
    });
    return c;
 }

function insertSearchBox(obj) {
    let wrapper = document.createElement('span');
    wrapper.id = 'searchBox';
    wrapper.className = 'searchBox';
    wrapper.tabIndex = -1;
    wrapper.setAttribute('contenteditable', false);
    
    let box = document.createElement('div');
    box.id = 'resultsWrapper';
    box.tabIndex = -1;
    $(box).html('<ul id="results" class="results" tabindex="-1"></ul>');

    wrapper.append(box);

    // Append to Focus Node.
    $(obj.lastElementChild).before(wrapper);

    return true;
}

// Inserts a final space.
function addFinalSpace(contact) {
    // And the space afterwards
    const inject = new Promise((resolve, reject) => {
        // Add Space in the end to continue writting.
        document.getSelection().collapseToEnd();
        $(document.body).trigger('focus');
        resolve(contact);
    })

    return inject;
}

// Inserts Mention on the body
function insertFullComponent(contact) {

    const inject = new Promise((resolve, reject) => {
        if(!lastFocusNode)
            reject();

        let text = lastFocusNode.textContent.substring(0, lastFocusOffset);
        text = text.substring(text.lastIndexOf('@'));
    
        let range = document.createRange();
        range.selectNode(lastFocusNode);
        range.endOffset = lastFocusOffset;
        range.startOffset = lastFocusOffset - text.length;

        let selection = document.getSelection();
        selection.addRange(range);
        selection.deleteFromDocument();
        selection.collapseToEnd();

        // Build component to be added to the body.
        let span = document.createElement('span');
        let str = document.createElement('a');
        str.setAttribute('href', "mailto:" + contact.email);
        
        str.id = contact.id;
        str.innerText = '@' + contact.name;

        span.append(str);

        // What if...
        document.execCommand("insertHTML", false, span.outerHTML);

        // Final Space.
        document.execCommand("insertText", false, ' ');

        // Return control to Script
        resolve(contact);
    });

    return inject;
}
