/**
 * Example: Using the Events Query API
 * 
 * This example shows how to use the deployed Events Query API to retrieve
 * and analyze event data from your tracking system.
 */

// Example API endpoints (replace with your actual API URL from CDK outputs)
const API_BASE_URL = 'https://your-api-id.execute-api.region.amazonaws.com/prod';

/**
 * Query events with various filters
 */
async function queryEvents() {
  // Get events for a specific client
  const clientEvents = await fetch(
    `${API_BASE_URL}/events?clientId=client_123&limit=10`
  );
  const clientData = await clientEvents.json();
  console.log('Client Events:', clientData);

  // Get events by type
  const userEvents = await fetch(
    `${API_BASE_URL}/events?entityType=user&eventType=user_created&limit=5`
  );
  const userData = await userEvents.json();
  console.log('User Creation Events:', userData);

  // Get events with date range
  const recentEvents = await fetch(
    `${API_BASE_URL}/events?startDate=2024-01-01&endDate=2024-12-31&limit=20`
  );
  const recentData = await recentEvents.json();
  console.log('Recent Events:', recentData);

  // Get events with pagination
  const paginatedEvents = await fetch(
    `${API_BASE_URL}/events?limit=10&offset=20`
  );
  const paginatedData = await paginatedEvents.json();
  console.log('Paginated Events:', paginatedData);
}

/**
 * Get event chain (journey tracking)
 */
async function getEventChain() {
  const eventId = 'some-event-uuid';
  
  const chainResponse = await fetch(
    `${API_BASE_URL}/events/chain/${eventId}`
  );
  const chainData = await chainResponse.json();
  
  console.log('Event Chain:', chainData);
  
  // The chain shows the complete user journey
  chainData.data.forEach((event: any, index: number) => {
    console.log(`Step ${index + 1}:`, {
      eventType: event.eventType,
      entityType: event.entityType,
      occurredAt: event.occurredAt,
      previousEventId: event.previousEventId,
    });
  });
}

/**
 * Get analytics data
 */
async function getAnalytics() {
  // Overall analytics
  const overallAnalytics = await fetch(`${API_BASE_URL}/analytics`);
  const overallData = await overallAnalytics.json();
  console.log('Overall Analytics:', overallData);

  // Client-specific analytics
  const clientAnalytics = await fetch(
    `${API_BASE_URL}/analytics?clientId=client_123`
  );
  const clientData = await clientAnalytics.json();
  console.log('Client Analytics:', clientData);
}

/**
 * Advanced query patterns
 */
async function advancedQueries() {
  // Get all events for a user session
  const sessionEvents = await fetch(
    `${API_BASE_URL}/events?sessionId=session_456&clientId=client_123`
  );
  const sessionData = await sessionEvents.json();
  console.log('Session Events:', sessionData);

  // Get campaign-related events
  const campaignEvents = await fetch(
    `${API_BASE_URL}/events?campaignId=campaign_789&limit=50`
  );
  const campaignData = await campaignEvents.json();
  console.log('Campaign Events:', campaignData);

  // Get events for a specific user
  const userEvents = await fetch(
    `${API_BASE_URL}/events?userId=user_123&limit=25`
  );
  const userData = await userEvents.json();
  console.log('User Events:', userData);
}

/**
 * Error handling example
 */
async function handleErrors() {
  try {
    const response = await fetch(`${API_BASE_URL}/events?clientId=invalid`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      console.error('API Error:', data.error, data.message);
      return;
    }
    
    console.log('Success:', data);
  } catch (error) {
    console.error('Request failed:', error);
  }
}

/**
 * Real-time dashboard example
 */
async function createDashboard() {
  const dashboard = {
    async refresh() {
      const [events, analytics] = await Promise.all([
        fetch(`${API_BASE_URL}/events?limit=10`).then(r => r.json()),
        fetch(`${API_BASE_URL}/analytics`).then(r => r.json()),
      ]);

      console.log('Dashboard Data:', {
        recentEvents: events.data,
        totalEvents: analytics.data.totalEvents,
        totalPoints: analytics.data.totalPoints,
        eventsByType: analytics.data.eventsByType,
        eventsPerDay: analytics.data.eventsPerDay,
      });
    },

    async getClientSummary(clientId: string) {
      const [events, analytics] = await Promise.all([
        fetch(`${API_BASE_URL}/events?clientId=${clientId}&limit=5`).then(r => r.json()),
        fetch(`${API_BASE_URL}/analytics?clientId=${clientId}`).then(r => r.json()),
      ]);

      return {
        recentEvents: events.data,
        summary: analytics.data,
      };
    }
  };

  // Refresh dashboard every 30 seconds
  setInterval(() => dashboard.refresh(), 30000);
  
  // Initial load
  await dashboard.refresh();
  
  return dashboard;
}

// Example usage
async function main() {
  console.log('🔍 Querying Events API...');
  
  await queryEvents();
  await getEventChain();
  await getAnalytics();
  await advancedQueries();
  await handleErrors();
  
  // Create a dashboard
  const dashboard = await createDashboard();
  
  // Get summary for a specific client
  const clientSummary = await dashboard.getClientSummary('client_123');
  console.log('Client Summary:', clientSummary);
}

// Run examples (uncomment to use)
// main().catch(console.error);

export {
  queryEvents,
  getEventChain,
  getAnalytics,
  advancedQueries,
  handleErrors,
  createDashboard,
};

/**
 * API Response Examples:
 * 
 * GET /events?clientId=client_123&limit=2
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "eventId": "uuid-1",
 *       "clientId": "client_123",
 *       "previousEventId": null,
 *       "userId": "user_456",
 *       "entityType": "user",
 *       "eventType": "user_created",
 *       "source": "api",
 *       "pointsAwarded": 100,
 *       "occurredAt": "2024-01-15T10:30:00.000Z",
 *       "metadata": { "email": "user@example.com" }
 *     }
 *   ],
 *   "count": 1,
 *   "pagination": { "limit": 2, "offset": 0 }
 * }
 * 
 * GET /analytics?clientId=client_123
 * {
 *   "success": true,
 *   "data": {
 *     "totalEvents": 150,
 *     "eventsByType": [
 *       { "entity_type": "user", "event_type": "user_created", "count": "50" },
 *       { "entity_type": "order", "event_type": "order_placed", "count": "30" }
 *     ],
 *     "totalPoints": 2500,
 *     "eventsPerDay": [
 *       { "date": "2024-01-15", "count": "25" },
 *       { "date": "2024-01-14", "count": "18" }
 *     ]
 *   },
 *   "clientId": "client_123"
 * }
 */


