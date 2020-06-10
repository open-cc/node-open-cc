import {
  ApiDeps,
  envProp
} from '@open-cc/api-common';
import fetch from 'node-fetch';
import * as debug from 'debug';

const log = debug('');
const kamailioBaseUrl = envProp(() => process.env.KAMAILIO_URL, 'http://kamailio:5060');
const kamailioRpcEndpoint = `${kamailioBaseUrl}/RPC`;
const isRunning = true;

const contactsCache = {};
let prevContacts = {};

async function getContacts(rpcEndpoint) {
  const res = await fetch(rpcEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'ul.dump'
    })
  });
  if (res.status === 200) {
    const contentType = res.headers.get('content-type');
    if (contentType && /application\/json/.test(contentType)) {
      const json = await res.json();
      if (json.result && json.result.Domains) {
        return json.result.Domains.reduce((contacts, domain) => {
          if (domain.Domain) {
            for (const aor of (domain.Domain.AoRs || [])) {
              if (aor.Info) {
                for (const contact of aor.Info.Contacts || []) {
                  contacts.push(contact);
                }
              }
            }
          }
          return contacts;
        }, []);
      }
    }
  }
  return [];
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(() => resolve(), ms));
}

export default async ({router} : ApiDeps) => {

  async function notifyWorkerStatus() {
    try {
      const contacts = await getContacts(kamailioRpcEndpoint);
      if (JSON.stringify(contacts) == JSON.stringify(prevContacts)) {
        return;
      }
      log('Got contacts', JSON.stringify(contacts, null, 2));
      prevContacts = contacts;
      const removeContacts = [];
      for (const contact of contacts) {
        contactsCache[contact.Contact.Address] = {
          ...(contact.Contact),
          active: true
        };
      }
      for (const contactKey of Object.keys(contactsCache)) {
        const cachedContact = contactsCache[contactKey];
        await router.broadcast({
          stream: 'workers',
          partitionKey: '_',
          data: {
            name: 'UpdateWorkerRegistration',
            connected: cachedContact.active,
            workerId: cachedContact.Address,
            address: cachedContact.Address
          }
        });
        if (!cachedContact.active) {
          removeContacts.push(contactKey);
        }
      }
      for (const removeContact of removeContacts) {
        delete contactsCache[removeContact];
      }
      for (const contact of contacts) {
        contactsCache[contact.Contact.Address].active = false;
      }
    } catch (err) {
      log('Failed to get contacts', err);
    }
  }

  while (isRunning) {
    await delay(1000);
    await notifyWorkerStatus();
  }

};
