"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDbConnection = getDbConnection;
exports.closeDbConnection = closeDbConnection;
exports.insertEvents = insertEvents;
exports.initializeSchema = initializeSchema;
const pg_1 = require("pg");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
let dbClient = null;
let credentials = null;
const secretsClient = new client_secrets_manager_1.SecretsManagerClient({
    region: process.env.AWS_REGION || 'us-east-1',
});
/**
 * Retrieves database credentials from AWS Secrets Manager
 */
async function getDbCredentials() {
    if (credentials) {
        return credentials;
    }
    const secretArn = process.env.DB_SECRET_ARN;
    if (!secretArn) {
        throw new Error('DB_SECRET_ARN environment variable is required');
    }
    try {
        const command = new client_secrets_manager_1.GetSecretValueCommand({
            SecretId: secretArn,
        });
        const response = await secretsClient.send(command);
        if (!response.SecretString) {
            throw new Error('Secret value is empty');
        }
        credentials = JSON.parse(response.SecretString);
        return credentials;
    }
    catch (error) {
        console.error('Failed to retrieve database credentials:', error);
        throw error;
    }
}
/**
 * Creates a new database connection
 */
async function createDbConnection() {
    const creds = await getDbCredentials();
    const client = new pg_1.Client({
        host: creds.host,
        port: creds.port,
        database: creds.dbname,
        user: creds.username,
        password: creds.password,
        ssl: {
            rejectUnauthorized: false, // RDS uses SSL by default
        },
    });
    await client.connect();
    return client;
}
/**
 * Gets or creates a database connection
 */
async function getDbConnection() {
    if (!dbClient) {
        dbClient = await createDbConnection();
    }
    return dbClient;
}
/**
 * Closes the database connection
 */
async function closeDbConnection() {
    if (dbClient) {
        await dbClient.end();
        dbClient = null;
    }
}
/**
 * Inserts events into the database with idempotency
 * Uses ON CONFLICT (event_id) DO NOTHING for idempotency
 */
async function insertEvents(events) {
    if (events.length === 0) {
        return;
    }
    const client = await getDbConnection();
    try {
        await client.query('BEGIN');
        const insertQuery = `
      INSERT INTO events (
        event_id, client_id, previous_event_id, user_id, entity_id, entity_type,
        event_type, source, campaign_id, points_awarded, session_id, occurred_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (event_id) DO NOTHING
    `;
        for (const event of events) {
            const values = [
                event.eventId,
                event.clientId,
                event.previousEventId,
                event.userId || null,
                event.entityId || null,
                event.entityType,
                event.eventType,
                event.source || null,
                event.campaignId || null,
                event.pointsAwarded || null,
                event.sessionId || null,
                event.occurredAt,
                event.metadata ? JSON.stringify(event.metadata) : null,
            ];
            await client.query(insertQuery, values);
        }
        await client.query('COMMIT');
        console.log(`Successfully inserted ${events.length} events`);
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Failed to insert events:', error);
        throw error;
    }
}
/**
 * Initializes the database schema
 */
async function initializeSchema() {
    const client = await getDbConnection();
    const schemaSQL = `
    CREATE TABLE IF NOT EXISTS events (
      event_id          UUID PRIMARY KEY,
      client_id         VARCHAR(128) NOT NULL,
      previous_event_id UUID NULL,
      user_id           VARCHAR(128),
      entity_id         VARCHAR(128),
      entity_type       VARCHAR(48),
      event_type        VARCHAR(48) NOT NULL,
      source            VARCHAR(32),
      campaign_id       VARCHAR(128),
      points_awarded    INTEGER,
      session_id        VARCHAR(128),
      occurred_at       TIMESTAMPTZ NOT NULL,
      metadata          JSONB,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT fk_events_previous
        FOREIGN KEY (previous_event_id) REFERENCES events(event_id)
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_client_time
      ON events (client_id, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_events_user_time
      ON events (user_id, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_events_type_time
      ON events (event_type, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_events_campaign_time
      ON events (campaign_id, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_events_prev
      ON events (previous_event_id);

    CREATE INDEX IF NOT EXISTS idx_events_metadata_gin
      ON events USING GIN (metadata);
  `;
    try {
        await client.query(schemaSQL);
        console.log('Database schema initialized successfully');
    }
    catch (error) {
        console.error('Failed to initialize database schema:', error);
        throw error;
    }
}
