console.log('@Contact Mention - Compose Script loaded.');

let books = [];

(() => {
    document.body.addEventListener('keydown', onKeyDown);
})();

// Keep track of the last key pressed.
let lastChar = '';

// Search control
let results = [];
let resultsIndex = 0;

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
            resultsIndex = (resultsIndex < results.length - 1) ? resultsIndex + 1 : 0;
            markResult();
        } else if(key === 'ArrowUp' && results.length) {
            // Move up on the list.
            resultsIndex = (resultsIndex > 0) ? resultsIndex - 1 : results.length - 1;
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
                $('#am-li-' + results[resultsIndex].id).trigger('click');
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
function addContacts(contacts) {
    console.log("Adding contacts", contacts);
    return browser.runtime.sendMessage({ addContacts: contacts });
}

// Ask background for matches.
async function searchResults(v) {
    let resultContacts = await browser.runtime.sendMessage({ searchContact: v });
    console.log("Found contacts", resultContacts);
    return resultContacts;
 }

// Remove the Search Box.
function removeSearchBox() {
    document.getElementById('searchBox').remove();
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

    const inject = new Promise((resolve, _) => {
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
