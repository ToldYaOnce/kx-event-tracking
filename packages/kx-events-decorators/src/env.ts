export const getEventsQueueUrl = (): string => {
  const queueUrl = process.env.EVENTS_QUEUE_URL;
  if (!queueUrl) {
    throw new Error('EVENTS_QUEUE_URL environment variable is required');
  }
  return queueUrl;
};

export const getEventBusName = (): string => {
  const busName = process.env.EVENT_BUS_NAME;
  if (!busName) {
    throw new Error('EVENT_BUS_NAME environment variable is required');
  }
  return busName;
};

