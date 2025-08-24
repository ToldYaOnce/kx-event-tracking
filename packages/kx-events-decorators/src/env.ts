export const getEventsQueueUrl = (): string => {
  const queueUrl = process.env.EVENTS_QUEUE_URL;
  if (!queueUrl) {
    throw new Error('EVENTS_QUEUE_URL environment variable is required');
  }
  return queueUrl;
};

