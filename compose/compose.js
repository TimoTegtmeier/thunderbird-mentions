console.log('Mention JS loaded.');

let books = [];

(() => {
    document.body.addEventListener('keydown', onKeyDown);
})();

// Keep track of the last key pressed.
let lastChar = '';

// Search control
let results = [];
let resultsIndex = 1;

// Track keystrokes.
async function onKeyDown(event) {
    
    let searchBoxExist = document.getElementById('searchBox');

    if(searchBoxExist) {
        let key = event.key;
        let input = document.getElementById('searchContact');
        let isPrintableCharacter = String.fromCharCode(event.keyCode).match(/(\w|\s)/g);

        // Don't print the key on the body.
        event.stopPropagation();
        event.preventDefault();
        
        if(key === 'Escape' || key === 'Tab' || key === 'Delete') {
            removeSearchBox();
        } else if(key === 'ArrowDown' && results.length) {
            // Move down on the list.
            resultsIndex = (resultsIndex < results.length) ? resultsIndex + 1 : resultsIndex;
            markResult();
        } else if(key === 'ArrowUp' && results.length) {
            // Move up on the list.
            resultsIndex = (resultsIndex > 1) ? resultsIndex - 1 : resultsIndex;
            markResult();
        } else if(key === 'Backspace') {
            if(input.value.length > 0) {
                input.setAttribute('value', input.value.slice(0, input.value.length - 1));
            } else {
                // Close the Searchbox.
                removeSearchBox();
            }
        } else if(key === 'Space' || key === ' ') {
            // Only add Space after the first letter.
            if(input.value.length > 0) {
                input.setAttribute('value', input.value + ' ');
            }
        } else if(key === 'Enter') {
            if(results.length > 0) {
                $('#' + results[resultsIndex - 1].id).trigger('click');
            } 
        } else if(isPrintableCharacter) {
            // Print the key on the box.
            input.setAttribute('value', input.value + key);

            let val = input.value;
            if(val.length >= 3) {
                // Search when the box is over 3 characters
                cleanResults();
                results = await searchResults(val);
                await listResults(results);
                markResult();
            }
        }
    } else {
        if((lastChar === ' ' || lastChar === 'Enter' || lastChar ==='Tab' || lastChar === '') && event.key === '@') {

            // Get the context of the cursor.
            let selection = document.getSelection().focusNode;

            // If no selection, then come up a node.
            if(selection.nodeName === '#text' || selection.nodeName === 'TEXT') {
                selection = selection.parentNode;
            }

            insertSearchBox(selection);
            
            // Don't print the @
            event.stopPropagation();
            event.preventDefault();
        }

        // Forget other key presses that don't affect the content.
        let ignoreKey = event.key == 'Shift' || event.key == 'OS' || event.key == 'Alt' || event.key == 'AltGraph' || event.key == 'Control';
        if(!ignoreKey) {
            lastChar = event.key;
        }
    }
    return false;
}

// Send Message to add contact.
function addContactsToCC(contacts) {
    return browser.runtime.sendMessage({ addContactsToCC: contacts });
}

// Ask background for matches.
async function searchResults(v) {
    let resultContacts = await browser.runtime.sendMessage({ searchContact: v });
    return resultContacts;
 }

// Remove the Search Box.
function removeSearchBox() {
    // Remove Box.
    let box = document.getElementById('searchBox');
    // Remove the box.
    box.remove();
}

// Clean Results from Search
function cleanResults() {
    results = [];
    resultsIndex = 1;
    let list = document.getElementById('results');
    list.innerHTML = '';
 }
 
 // List results on the box.
 async function listResults(r) {
    // Mark the Box...
    let list = document.getElementById('results');
    for(var i in r) {
       let result = await buildContact(r[i]);
       $(list).append(result);
    }
 }
 
 // Clear any marked results.
 async function clearMarkedResults() {
    let li = document.getElementsByClassName('contact');
    for(var i in li) {
        $(li).removeClass('selected');
    }
 }
 
 // Mark a result from the list.
 async function markResult() {
    clearMarkedResults();
 
    // If there are results, then mark.
    if(results.length) {
        let l = document.getElementById(results[resultsIndex - 1].id);   
        $(l).addClass('selected');
    }
 }

// Builds a contact.
async function buildContact(contact) {
    let c = document.createElement('li');
    c.id = contact.id;
    c.className = 'contact';
    c.innerHTML = contact.properties.DisplayName + ' (' + contact.properties.PrimaryEmail + ')';
    c.setAttribute('data-name', contact.properties.DisplayName);
    c.setAttribute('data-url', 'mailto:' + contact.properties.PrimaryEmail);
    c.setAttribute('data-email', contact.properties.PrimaryEmail);
 
    $(c).on('click', function(event) {
        let timestamp = (new Date()).getTime();
        let name = $(this).attr('data-name');
        let url = $(this).attr('data-url');
        let email = $(this).attr('data-email');
        let id = $(this).attr('id') + '-' + timestamp;
        let contact = {
            email,
            name,
            url,
            id
        }
    
        removeSearchBox();
    
        insertFullComponent(contact)
            .then(addFinalSpace)
            .then((c) => { return addContactsToCC([c]); });
    })
    return c;
 }

function insertSearchBox(obj) {

    let wrapper = document.createElement('span');
    wrapper.id = 'searchBox';
    wrapper.className = 'searchBox';
    
    let at = document.createElement('label');
    at.innerHTML = '@';
    at.style = 'border: 0px;';

    let input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.id = 'searchContact';
    input.setAttribute('style', 'border: 0px solid white; width: auto;');

    let box = document.createElement('div');
    box.id = 'resultsWrapper';
    $(box).html('<ul id="results" class="results"><li class="contact">Search for contact...</li></ul>');

    wrapper.append(box);
    wrapper.append(at);
    wrapper.append(input);

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

        // Properties brought from the Popup.
        let url = "mailto:" + contact.email;
        let name = contact.name;
        let email = contact.email;
        let id = generateLinkId();

        let span = document.createElement('span');

        // Build component to be added to the body.
        let str = document.createElement('a');
        str.setAttribute('href', url);
        str.setAttribute('data-email', email);
        str.setAttribute('data-name', name);
        
        str.id = id;
        str.innerText = '@' + name;

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

function generateLinkId() {
    return "OWAAM" +
        ([1e7]+1e3+4e3+8e3+1e11)
            .replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4)
            .toString(16)
            .toUpperCase()) +
        "Z";
}