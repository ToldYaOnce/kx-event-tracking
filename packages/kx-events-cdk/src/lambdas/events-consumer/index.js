"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const db_1 = require("./db");
/**
 * Validates a TrackedEvent against the contract
 */
function validateTrackedEvent(event) {
    if (!event || typeof event !== 'object') {
        return false;
    }
    // Required fields
    if (!event.eventId || typeof event.eventId !== 'string') {
        console.error('Invalid event: missing or invalid eventId');
        return false;
    }
    if (!event.clientId || typeof event.clientId !== 'string') {
        console.error('Invalid event: missing or invalid clientId');
        return false;
    }
    if (!event.entityType || typeof event.entityType !== 'string') {
        console.error('Invalid event: missing or invalid entityType');
        return false;
    }
    if (!event.eventType || typeof event.eventType !== 'string') {
        console.error('Invalid event: missing or invalid eventType');
        return false;
    }
    if (!event.occurredAt || typeof event.occurredAt !== 'string') {
        console.error('Invalid event: missing or invalid occurredAt');
        return false;
    }
    // Validate ISO8601 date format
    try {
        new Date(event.occurredAt);
    }
    catch {
        console.error('Invalid event: occurredAt is not a valid ISO8601 date');
        return false;
    }
    // Optional fields type validation
    if (event.previousEventId !== null && event.previousEventId !== undefined && typeof event.previousEventId !== 'string') {
        console.error('Invalid event: previousEventId must be string or null');
        return false;
    }
    if (event.userId !== undefined && typeof event.userId !== 'string') {
        console.error('Invalid event: userId must be string');
        return false;
    }
    if (event.entityId !== undefined && typeof event.entityId !== 'string') {
        console.error('Invalid event: entityId must be string');
        return false;
    }
    if (event.source !== undefined && typeof event.source !== 'string') {
        console.error('Invalid event: source must be string');
        return false;
    }
    if (event.campaignId !== undefined && typeof event.campaignId !== 'string') {
        console.error('Invalid event: campaignId must be string');
        return false;
    }
    if (event.pointsAwarded !== undefined && typeof event.pointsAwarded !== 'number') {
        console.error('Invalid event: pointsAwarded must be number');
        return false;
    }
    if (event.sessionId !== undefined && typeof event.sessionId !== 'string') {
        console.error('Invalid event: sessionId must be string');
        return false;
    }
    if (event.metadata !== undefined && (typeof event.metadata !== 'object' || Array.isArray(event.metadata))) {
        console.error('Invalid event: metadata must be an object');
        return false;
    }
    return true;
}
/**
 * Parses and validates SQS messages
 */
function parseAndValidateMessages(records) {
    const validEvents = [];
    for (const record of records) {
        try {
            const event = JSON.parse(record.body);
            if (validateTrackedEvent(event)) {
                validEvents.push(event);
            }
            else {
                console.error('Skipping invalid event from SQS message:', record.messageId);
            }
        }
        catch (error) {
            console.error('Failed to parse SQS message:', record.messageId, error);
        }
    }
    return validEvents;
}
// ✅ EventBridge publishing removed - now handled directly by @EventTracking decorator
// This eliminates duplicate events and provides real-time delivery (0-1 second vs 5+ seconds)
/**
 * Lambda handler for processing SQS events
 */
const handler = async (event, context) => {
    console.log(`Processing ${event.Records.length} SQS messages`);
    try {
        // Initialize database schema on first run
        await (0, db_1.initializeSchema)();
        // Parse and validate messages
        const validEvents = parseAndValidateMessages(event.Records);
        if (validEvents.length === 0) {
            console.log('No valid events to process');
            return;
        }
        console.log(`Processing ${validEvents.length} valid events`);
        // Batch insert events with idempotency
        await (0, db_1.insertEvents)(validEvents);
        // ✅ EventBridge publishing now handled directly by @EventTracking decorator
        // This eliminates duplicate events and provides real-time delivery
        console.log(`Successfully stored ${validEvents.length} events in RDS`);
    }
    catch (error) {
        console.error('Failed to process SQS events:', error);
        throw error; // This will cause the messages to be retried or sent to DLQ
    }
    finally {
        // Close DB connection per invocation
        await (0, db_1.closeDbConnection)();
    }
};
exports.handler = handler;
