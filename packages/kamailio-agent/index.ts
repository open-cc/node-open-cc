import {
  ApiDeps,
  envProp
} from '@open-cc/api-common';
import fetch from 'node-fetch';
import * as debug from 'debug';
import {UpdateWorkerRegistration} from '@open-cc/core-api';

const log = debug('');
const logDebug = log.extend('debug');
const kamailioBaseUrl = envProp(() => process.env.KAMAILIO_URL, 'http://kamailio:5060');
const kamailioRpcEndpoint = `${kamailioBaseUrl}/RPC`;

const dispatcherDestinations = [];
async function updateDispatcherList(rpcEndpoint, destination) {
  if (dispatcherDestinations.indexOf(destination) === -1) {
    dispatcherDestinations.push(destination);
    log('updateDispatcherList', dispatcherDestinations);
    const newDispatcherList = dispatcherDestinations
      .map((server, index) => `${index + 1} ${server} 0 0 weight=50`)
      .join('\n');
    const res = await fetch(rpcEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'dispatcher_list.update',
        dispatcher_list: newDispatcherList
      })
    });
    log('updateDispatcherList status', res.status);
  }
}

const contactsCache = {};
let prevContacts = [];
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

function contactAddresses(contacts) {
  return contacts.map(contact => contact.Contact.Address);
}

function parseAddress(address) {
  const matcher = /^([^:]+):(([^@]+)@)?([^:]+)(:([0-9]+))?/.exec(address);
  if (matcher) {
    return {
      protocol: matcher[1],
      user: matcher[3],
      domain: matcher[4],
      port: matcher[6] || 5060
    }
  }
  throw new Error(`Failed to parse address '${address}'`);
}

export default async ({stream} : ApiDeps) => {

  stream('dispatcherlist')
    .on('DestinationReported', async (message : any) => {
      await updateDispatcherList(kamailioRpcEndpoint, message.address);
    });

  async function notifyWorkerStatus() {
    try {
      const contacts = await getContacts(kamailioRpcEndpoint);
      if (JSON.stringify(contactAddresses(contacts)) == JSON.stringify(contactAddresses(prevContacts))) {
        return;
      }
      prevContacts = contacts;
      logDebug('Got contacts', JSON.stringify(contacts, null, 2));
      const removeContacts = [];
      for (const contact of contacts) {
        contactsCache[contact.Contact.Address] = {
          ...(contact.Contact),
          active: true
        };
      }
      await stream('workers').broadcast(new UpdateWorkerRegistration(Object.keys(contactsCache)
        .map((contactsCacheKey) => {
          const cachedContact = contactsCache[contactsCacheKey]
          if (!cachedContact.active) {
            removeContacts.push(contactsCacheKey);
          }
          return cachedContact;
        })
        .map((cachedContact) => {
          const address = parseAddress(cachedContact.Address);
          const proxy = parseAddress(cachedContact.Socket);
          return {
            connected: cachedContact.active,
            workerId: address.user,
            address: `${address.protocol}:${address.user}@${address.domain}:${address.port}`,
            routingAddress: `${address.protocol}:${address.user}@${proxy.domain}:${proxy.port}`
          }
        })));
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

  process.nextTick(() => {
    const next = () => {
      setTimeout(async () => {
        await notifyWorkerStatus();
        next();
      }, 1000);
    };
    next();
  });

};
