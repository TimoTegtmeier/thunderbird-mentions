// Background.js

// Agregation
let contacts = [];
let mailinglists = [];

// Init Plugin
(() => {
    // compose script
    browser.composeScripts.register({
        css: [
            {file: '/compose/compose.css'},
        ],
        js: [
            {file: "/jquery.min.js"}, 
            {file: "/compose/compose.js"},
        ]
    });

    // Get all the contacts up.
    compactBooks();

    // Listen to the Action button
    addComposeActionListener();

    // Disable the Button if there is no contacts
    addComposerActionDisablerListener();

    // Listen for the order to open the popup!
    browser.runtime.onMessage.addListener(handleMessage);
})();

// Flatten the Contact Books for purpose of search.
async function compactBooks() {
    
    // Clean
    contacts = [];
    mailinglists = [];

    // Merge
    let books = await browser.addressBooks.list(true)
    for(var b in books) {
        let c = books[b].contacts;
        contacts = contacts.concat(c);
        let m = books[b].mailingLists;
        mailinglists = mailinglists.concat(m);
    }
    console.log('Contacts Compacted.');
    return true;
}

// Handle the Popup Message
async function handleMessage(request, sender) {
    if(request.searchContact ){
        let val = request.searchContact;
        let results = searchResults(val);
        return Promise.resolve(results);
    } else if(request.addContactsToCC ) {
        // Add the Contact to BCC now.
        return addContactToAddressLine(sender.tab.id, request.addContactsToCC)
    } else {
        // Listen to the Popup with the final anwser   
        console.log('Another Message received from Popup.');
    }
}

// TODO: Contacts API has search function that might
//       be natively implemented. Faster than this rough
//       search for sure :).
function searchResults(v) {
    let results = contacts.filter((x) => { 
       if(x.properties && x.properties.DisplayName && x.properties.PrimaryEmail) {
          return ( x.properties.DisplayName.toLowerCase().indexOf(v) >= 0 || 
                      (x.properties.PrimaryEmail && x.properties.PrimaryEmail.toLowerCase().indexOf(v) >= 0))
       } else {
          return false;
       }
    })
 
    return results;
 }

// Listen to the Compose Action Button
function addComposerActionDisablerListener() {
    browser.tabs.onCreated.addListener(tab => {
        // Check if there are contacts...
        if(contacts.length == 0) {
            // Disable the button.
            browser.composeAction.disable(tab.id);
            browser.composeAction.setTitle({ 
                tabId: tab.id, 
                title: 'No contacts!'
            });
        }
    })

    // This is that when an addressBook is created, we 
    // re compact the contacts.
    browser.addressBooks.onCreated.addListener(addressBook => {
        compactBooks();
    })

    // We listen to the contacts to see if there is any
    // new one, and we re compact the books.
    browser.contacts.onCreated.addListener(contact => {
        compactBooks();
    })

    // We listen to the contacts to see if there is any
    // chante, and we re compact the books.
    browser.contacts.onUpdated.addListener(contact => {
        compactBooks();
    })
}

// Listen to the Compose Action Button
function addComposeActionListener() {
    browser.composeAction.onClicked.addListener(tab => {
        let tabId = tab.id;

        // Message the Composer for the Contacts.
        addContactToAddressLine(tabId); 
    });
}

// Add Contacts to the CC of the Compose Window.
async function addContactToAddressLine(tabId, contactsArrived = []) {

    // Gather the compose details to add contacts.
    let details = await messenger.compose.getComposeDetails(tabId);
    
    // Is this a compose window?
    if(details) {

        let body = details.body;
        let document = new DOMParser().parseFromString(details.body, "text/html");

        let contacts = document.getElementsByClassName('mentionContact');

        // Add the contacts to the CC
        for(var i=0; i<contacts.length; i++) {
            let contact = contacts[i];

            let email = contact.getAttribute('data-email');
            let name = contact.getAttribute('data-name');

            let to = details.to;
            let cc = details.cc;
            let bcc = details.bcc;

            let foundTo = false;
            let foundCC = false;
            let foundBCC = false;

            // first find it on the To.
            if(to.filter((n) => { return (n.indexOf(email) > 0); }).length) {
                foundTo = true;
            }

            // first find it on the CC.
            if(cc.filter((n) => { return (n.indexOf(email) > 0); }).length) {
                foundCC = true;
            }

            // first find it on the BCC.
            if(bcc.filter((n) => { return (n.indexOf(email) > 0); }).lenght) {
                foundBCC = false;
            }

            if(!foundCC && !foundTo && !foundBCC ) {
                cc.push(name + ' <' + email + '>');    
            }

            // Set the Details back again.
            await messenger.compose.setComposeDetails(tabId, {
                to, cc, bcc
            });
        }
    }

    // Return the contacts for next thing (if any).
    return Promise.resolve(contactsArrived);
}
