import {Twilio} from 'twilio';
import {
  IncomingPhoneNumberInstance,
  IncomingPhoneNumberInstanceUpdateOptions
} from 'twilio/lib/rest/api/v2010/account/incomingPhoneNumber';

export async function registerApp(
  client : Twilio, voiceUrl :
    string, statusCallbackUrl : string) : Promise<IncomingPhoneNumberInstance> {
  const config : IncomingPhoneNumberInstanceUpdateOptions = {
    voiceUrl: voiceUrl,
    voiceMethod: 'POST',
    smsMethod: 'POST',
    statusCallback: statusCallbackUrl,
    statusCallbackMethod: 'POST'
  };
  const incomingPhoneNumbers = await client.incomingPhoneNumbers
    .list();
  if (incomingPhoneNumbers.length === 0) {
    const availablePhoneNumbers = await client.availablePhoneNumbers('US')
      .local
      .list({areaCode: 272, limit: 1});
    incomingPhoneNumbers.push(await client.incomingPhoneNumbers
      .create({
        ...config,
        phoneNumber: availablePhoneNumbers[0].phoneNumber,
      }));
  } else {
    await incomingPhoneNumbers[0].update(config)
  }
  return incomingPhoneNumbers[0];
}
