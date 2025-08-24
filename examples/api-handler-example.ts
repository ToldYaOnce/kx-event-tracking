/**
 * Example: API Handler with @EventTracking decorator
 * 
 * This example shows how to use the @EventTracking decorator with an API Gateway Lambda handler.
 * The decorator extracts clientId and previousEventId from request headers or body.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { EventTracking } from 'kx-events-decorators';

interface CreateUserRequest {
  email: string;
  name: string;
  clientId?: string; // Can be provided in body
  previousEventId?: string; // Can be provided in body
}

interface UserResponse {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

class UserService {
  /**
   * Creates a new user account
   * 
   * Expected headers:
   * - X-Client-Id: string (required)
   * - X-Previous-Event-Id: string (optional, for event chaining)
   * 
   * Or clientId can be provided in the request body
   */
  @EventTracking('user', 'user_created', {
    source: 'api',
    entityId: 'user-service', // Will be overridden by actual user ID after creation
  })
  async createUser(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    try {
      // Parse request body
      const body: CreateUserRequest = JSON.parse(event.body || '{}');
      
      // Validate required fields
      if (!body.email || !body.name) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            error: 'Missing required fields: email, name',
          }),
        };
      }

      // Simulate user creation
      const user: UserResponse = {
        id: `user_${Date.now()}`,
        email: body.email,
        name: body.name,
        createdAt: new Date().toISOString(),
      };

      // Return successful response
      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: user,
        }),
      };
    } catch (error) {
      console.error('Failed to create user:', error);
      
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Internal server error',
        }),
      };
    }
  }

  /**
   * Updates user profile
   * Demonstrates event chaining with previousEventId
   */
  @EventTracking('user', 'user_updated', {
    source: 'api',
  })
  async updateUser(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    try {
      const userId = event.pathParameters?.id;
      const body = JSON.parse(event.body || '{}');

      if (!userId) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'User ID is required' }),
        };
      }

      // Simulate user update
      const updatedUser = {
        id: userId,
        ...body,
        updatedAt: new Date().toISOString(),
      };

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: updatedUser,
        }),
      };
    } catch (error) {
      console.error('Failed to update user:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  }
}

// Export handler functions
const userService = new UserService();

export const createUserHandler = userService.createUser.bind(userService);
export const updateUserHandler = userService.updateUser.bind(userService);

/**
 * Example usage with curl:
 * 
 * Create user:
 * curl -X POST https://api.example.com/users \
 *   -H "Content-Type: application/json" \
 *   -H "X-Client-Id: client_123" \
 *   -d '{"email": "user@example.com", "name": "John Doe"}'
 * 
 * Update user (with event chaining):
 * curl -X PUT https://api.example.com/users/user_123 \
 *   -H "Content-Type: application/json" \
 *   -H "X-Client-Id: client_123" \
 *   -H "X-Previous-Event-Id: event_456" \
 *   -d '{"name": "John Smith"}'
 */
