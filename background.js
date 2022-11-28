// Background.js
console.log('@Contact Mention - Background Script loaded.');

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
    if(request.searchContact) {
        let val = request.searchContact;
        let results = searchResults(val);
        return Promise.resolve(results);
    } else if(request.addContacts) {
        // Add the Contact to BCC now.
        return addContactToAddressLine(sender.tab.id, request.addContacts)
    } else {
        // Listen to the Popup with the final anwser   
        console.log('Another Message received from Popup.', request);
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
    }).map(x => {
        return {
            id: generateMentionId(),
            name: x.properties.DisplayName,
            email: x.properties.PrimaryEmail
        };
    });
 
    return results;
 }

// Listen to the Compose Action Button
function addAddressBookListeners() {
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

// Add Contacts to the CC of the Compose Window.
async function addContactToAddressLine(tabId, contacts = []) {

    // Gather the compose details to add contacts.
    let details = await messenger.compose.getComposeDetails(tabId);
    
    // Is this a compose window?
    if(!details)
        return Promise.resolve(contacts);

    // Add the contacts to the CC
    for(var i = 0; i < contacts.length; i++) {
        let contact = contacts[i];
        
        console.log("Adding contact", contact);

        let email = contact.email;
        let name = contact.name;

        let to = details.to;
        let cc = details.cc;
        let bcc = details.bcc;

        // Check if email is already in the list of receivers
        if(to.filter((n) => { return (n.indexOf(email) > 0); }).length ||
           cc.filter((n) => { return (n.indexOf(email) > 0); }).length)
            continue;

        // Add contact
        to.push(name + ' <' + email + '>');    

        // Set the Details back again.
        await messenger.compose.setComposeDetails(tabId, {
            to, cc, bcc
        });
    }

    // Return the contacts for next thing (if any).
    return Promise.resolve(contacts);
}

function generateMentionId() {
    return "OWAAM" +
        ([1e7]+1e3+4e3+8e3+1e11)
            .replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4)
            .toString(16)
            .toUpperCase()) +
        "Z";
}